/** Permanent session deletion over an authenticated, session-independent route. */
import { rm, lstat, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep, dirname } from 'node:path'

/**
 * Services the command needs: registry, storage identity, and running-state
 * authority. `storageDomain` and `sessionQuery` are probed with `ctx.get`
 * because a deployment may compose without either.
 */
export const inject = ['connection', 'sessionPersistence', 'sessionController', 'agents', 'sessions']

/** `~/.dsh`, or the deployment's DSH_HOME when set. */
function dshHome() {
  return process.env.DSH_HOME && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME
    : join(homedir(), '.dsh')
}

/** The JSONL backend's session root. */
function sessionsRoot() {
  return join(dshHome(), 'sessions')
}

/**
 * The identity and version the `session-projection-cache` plugin opens (see
 * `@deepseek-ai/dsh-session-projection-cache/src/spec.ts`). Only the table is
 * touched here, so the record schema is not restated: a version bump only
 * makes this lookup miss, which the file fallback below covers.
 */
const PROJECTION_CACHE_DOMAIN = { name: 'session_projcache', version: 7, compatibleVersions: [3, 4, 5, 6] }

/**
 * Delete one session's projection-cache record.
 *
 * Through the mounted `storageDomain` when this deployment has one: that
 * handle shares the JSON backend's in-memory state, so the deletion is
 * coherent instead of racing the cache service's own writes. Otherwise (or
 * when the domain is not open under a compatible version) the per-record
 * document is removed directly; a missing document is not an error.
 * @param {import('@deepseek-ai/cordis').Context} ctx - host plugin context.
 * @param {string} sessionId - the reaped session.
 */
async function forgetProjectionCache(ctx, sessionId) {
  const domain = ctx.get('storageDomain')
  const opened = domain === undefined ? undefined : domain.get(PROJECTION_CACHE_DOMAIN.name)
  if (opened !== undefined) {
    try {
      await opened.table('sessions').delete(sessionId)
      return
    } catch (error) {
      ctx.logger.warn(`session-reaper: projection cache record for ${sessionId} was not removed through storageDomain: ${String(error)}`)
    }
  }
  const directory = join(dshHome(), 'storages', 'session_projcache', 'sessions')
  const names = new Set([encodeSegment(sessionId), encodeSegment(`session-${sessionId}`), `session-${encodeSegment(sessionId)}`])
  for (const name of names) {
    try {
      await rm(join(directory, `${name}.json`), { force: true })
    } catch (error) {
      ctx.logger.warn(`session-reaper: projection cache document for ${sessionId} was not removed: ${String(error)}`)
    }
  }
}

/** The `session-query` index reconciles removals on its next read; ask it to check now. */
async function reconcileSearchIndex(ctx) {
  const query = ctx.get('sessionQuery')
  const refresh = query === undefined ? undefined : query.refresh ?? query.refreshIndex ?? query.reconcile
  if (typeof refresh !== 'function') return
  try { await refresh.call(query) } catch { /* the index also reconciles lazily on its next read */ }
}

/** Best-effort removal of list-level and derived references so no dangling row survives. */
async function forgetReferences(ctx, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    try { await registry.unarchiveSession(sessionId) } catch { /* absent references are not an error */ }
    try { await registry.unpinSession(sessionId) } catch { /* absent references are not an error */ }
  }
  await forgetProjectionCache(ctx, sessionId)
  await reconcileSearchIndex(ctx)
}

/**
 * The JSONL backend's project-directory key: filesystem separators collapse to
 * one `-`, unsafe code units escape as `~XXXX`, and the plain variant is
 * bounded. Mirrored here instead of imported so the plugin owns no build-time
 * edge into a storage backend.
 * @param {string} cwd - the session's project directory.
 * @returns {string} the single readable project directory name.
 */
function projectKey(cwd) {
  let readable = ''
  let separatorRun = false
  for (let index = 0; index < cwd.length; index++) {
    const code = cwd.charCodeAt(index)
    const char = String.fromCharCode(code)
    if (char === '/' || char === '\\' || char === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (char !== '~' && /^[A-Za-z0-9._-]$/.test(char)) {
      readable += char
      separatorRun = false
    } else {
      readable += '~' + code.toString(16).toUpperCase().padStart(4, '0')
      separatorRun = false
    }
  }
  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

/** The backend's injective single-segment escape for a session id. */
function encodeSegment(raw) {
  if (raw === '.') return '~002E'
  if (raw === '..') return '~002E~002E'
  let out = ''
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index)
    const char = String.fromCharCode(code)
    if (char !== '~' && /^[A-Za-z0-9._-]$/.test(char)) out += char
    else out += '~' + code.toString(16).toUpperCase().padStart(4, '0')
  }
  return out
}

/**
 * Current DSH exposes lifecycle disposers only to the creator. Its Cordis
 * effect tree adopts the exact Agent scope into agentLoop.scope(id). Use that
 * one narrowly matched effect to drain the writer, never dispose the shared
 * loop/owner. Refuse deletion if this runtime no longer exposes that adapter.
 */
export function lifecycleDisposer(agent) {
  const fiber = agent.ctx?.fiber?.parent?.fiber
  const label = `agentLoop.scope(${agent.id})`
  const matches = [...(fiber?._disposables ?? [])].filter(dispose =>
    Object.getOwnPropertySymbols(dispose).some(key => dispose[key]?.label === label))
  if (matches.length !== 1) throw new Error('当前 DSH 版本无法安全释放此会话，请升级清道夫适配后重试。')
  return matches[0]
}

export function apply(ctx) {
  const pending = new Set()
  async function remove(sessionId, signal) {
    if (typeof sessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sessionId)) throw new Error('会话 ID 非法')
    if (pending.has(sessionId)) throw new Error('此会话正在删除，请勿重复操作')
    pending.add(sessionId)
    try {
      signal?.throwIfAborted()
      // Fail closed: a failed running-state lookup must never permit deletion.
      const listed = await ctx.sessionController.list({}, AbortSignal.timeout(5000))
      if (listed.items.some(item => item.sessionId === sessionId && item.running)) throw new Error('会话正在运行，请先停止再删除。')
      const agent = ctx.agents.get(sessionId)
      if (agent && agent.status !== 'idle') throw new Error('会话仍在运行或收尾，请稍后重试。')
      const snapshot = await ctx.sessionPersistence.stat(sessionId)
      const root = resolve(sessionsRoot())
      let directory
      if (snapshot) {
        directory = resolve(root, projectKey(snapshot.header.cwd ?? ''), encodeSegment(sessionId))
        if (snapshot.location && (snapshot.location.kind !== 'jsonl' || resolve(dirname(snapshot.location.path)) !== directory)) throw new Error('会话存储位置与当前 sessions 配置不符，未删除。')
        if (directory === root || !directory.startsWith(root + sep)) throw new Error('会话目录越过 sessions 根目录，已拒绝执行。')
        try {
          const info = await lstat(directory)
          if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('会话目录不是普通目录，已拒绝执行。')
          const canonicalRoot = await realpath(root)
          const canonical = await realpath(directory)
          if (!canonical.startsWith(canonicalRoot + sep)) throw new Error('会话目录实际位置越过 sessions 根目录。')
        } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      signal?.throwIfAborted()
      if (agent) {
        const dispose = lifecycleDisposer(agent)
        // No await between the final status check and initiating teardown.
        if (agent.status !== 'idle') throw new Error('会话已开始运行，请先停止再删除。')
        await dispose()
        if (ctx.agents.get(sessionId) || ctx.sessions.get(sessionId)) throw new Error('会话尚未完全释放，未删除存储，请稍后重试。')
      } else if (ctx.sessions.get(sessionId)) {
        throw new Error('会话存储仍被占用，请稍后重试。')
      }
      // Drain persistence before removal; no command lifecycle event can recreate it.
      await ctx.sessionPersistence.flush()
      if (directory) await rm(directory, { recursive: true, force: true })
      await forgetReferences(ctx, sessionId)
      return { deleted: sessionId }
    } finally { pending.delete(sessionId) }
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/session-reaper/delete', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      let body
      try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
      if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== 'session-reaper/delete') return new Response('Invalid RPC envelope', { status: 400 })
      let result
      try { result = { ok: true, value: await remove(body.payload?.sessionId, request.signal) } }
      catch (error) { result = { ok: false, error: { code: 'session-reaper/delete-failed', message: error instanceof Error ? error.message : String(error), details: {} } } }
      return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
    },
  }), 'session-reaper: authenticated permanent deletion')
}
