/** Reversible session removal over an authenticated, session-independent route. */
import { rm, lstat, realpath, mkdir, rename, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, relative, sep, dirname, basename, isAbsolute } from 'node:path'

/**
 * Services the command needs: registry, storage identity, and running-state
 * authority. `storageDomain` and `sessionQuery` are probed with `ctx.get`
 * because a deployment may compose without either.
 */
export const inject = ['connection', 'sessionPersistence', 'sessionController', 'agents', 'sessions', 'workspaceRegistry']

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
  if (matches.length !== 1) throw new Error('当前 DSH 版本无法安全释放此会话，请升级会话清道适配后重试。')
  return matches[0]
}

async function checkedDirectory(path, create = false) {
  if (create) await mkdir(path, { recursive: true })
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink() || relative(path, await realpath(path)) !== '') {
    throw new Error('会话目录包含重定向。')
  }
  return path
}

async function requireMissing(path) {
  try { await lstat(path) } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  throw new Error('目标已有会话记录。')
}

const partitionPattern = /^[-A-Za-z0-9._~]+$/
const sessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const logPattern = /^session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/
const metadataFile = '.session-reaper.json'

async function trashRoot(create) {
  const home = await realpath(dshHome())
  return checkedDirectory(join(home, 'session-reaper-trash'), create)
}

async function trashPartition(partition, create) {
  if (typeof partition !== 'string' || !partitionPattern.test(partition)
    || partition.endsWith('.')) throw new Error('会话存储分区非法。')
  return checkedDirectory(join(await trashRoot(create), partition), create)
}

function validateRecord({ sessionId, directoryKey }) {
  if (typeof sessionId !== 'string' || !sessionIdPattern.test(sessionId) || sessionId.endsWith('.')) {
    throw new Error('会话 ID 非法。')
  }
  if (directoryKey !== sessionId && directoryKey !== 'session-' + sessionId) throw new Error('会话目录名非法。')
}

async function listRecords(root) {
  const records = []
  for (const partition of await readdir(root, { withFileTypes: true })) {
    if (!partition.isDirectory() || !partitionPattern.test(partition.name) || partition.name.endsWith('.')) continue
    const bucket = await checkedDirectory(join(root, partition.name))
    for (const entry of await readdir(bucket, { withFileTypes: true })) {
      if (!entry.isDirectory() || !sessionIdPattern.test(entry.name) || entry.name.endsWith('.')) continue
      const directory = await checkedDirectory(join(bucket, entry.name))
      const files = await readdir(directory, { withFileTypes: true })
      if (!files.some(file => file.isFile() && logPattern.test(file.name))) continue
      let metadata
      if (files.some(file => file.name === metadataFile && file.isFile())) {
        try { metadata = JSON.parse(await readFile(join(directory, metadataFile), 'utf8')) }
        catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error }
      }
      const sessionId = metadata?.sessionId === entry.name.slice(8) && entry.name.startsWith('session-')
        ? metadata.sessionId : entry.name
      records.push({ sessionId, partition: partition.name, directoryKey: entry.name,
        title: typeof metadata?.title === 'string' ? metadata.title : sessionId })
    }
  }
  return records
}

export function apply(ctx) {
  const pending = new Set()
  async function list() {
    const root = await trashRoot(true)
    const workspace = await ctx.workspaceRegistry.create(root, '回收区')
    return { workspaceId: workspace.id, records: await listRecords(root) }
  }

  async function purge(payload, signal) {
    if (!Array.isArray(payload?.records)) throw new Error('缺少待删除的会话。')
    const failed = []
    for (const record of payload.records) {
      signal?.throwIfAborted()
      try {
        validateRecord(record)
        const { sessionId, partition, directoryKey } = record
        const lock = sessionId.toLowerCase()
        if (pending.has(lock)) throw new Error('此会话正在处理。')
        pending.add(lock)
        try {
          const directory = await checkedDirectory(join(await trashPartition(partition, false), directoryKey))
          const files = await readdir(directory, { withFileTypes: true })
          if (!files.some(file => file.isFile() && logPattern.test(file.name))) throw new Error('未找到会话日志。')
          await rm(directory, { recursive: true })
        } finally { pending.delete(lock) }
      } catch (error) { failed.push(error instanceof Error ? error.message : String(error)) }
    }
    return { failed }
  }

  async function change(action, payload, signal) {
    const { sessionId, partition, directoryKey, displayTitle } = payload ?? {}
    if (typeof sessionId !== 'string' || !sessionIdPattern.test(sessionId) || sessionId.endsWith('.')) throw new Error('会话 ID 非法')
    const lock = sessionId.toLowerCase()
    if (pending.has(lock)) throw new Error('此会话正在处理，请勿重复操作')
    pending.add(lock)
    try {
      signal?.throwIfAborted()
      // Fail closed: a failed running-state lookup must never permit deletion.
      const listed = await ctx.sessionController.list({}, AbortSignal.timeout(5000))
      if (listed.items.some(item => item.sessionId === sessionId && item.running)) throw new Error('会话正在运行，请先停止再删除。')
      if (action === 'restore') {
        validateRecord({ sessionId, directoryKey })
        const source = await checkedDirectory(join(await trashPartition(partition, false), directoryKey))
        const root = await realpath(sessionsRoot())
        const parent = await checkedDirectory(join(root, partition), true)
        const target = join(parent, directoryKey)
        await requireMissing(target)
        const snapshot = await ctx.sessionPersistence.stat(sessionId)
        if (snapshot || ctx.agents.get(sessionId) || ctx.sessions.get(sessionId)) throw new Error('同一会话已存在。')
        signal?.throwIfAborted()
        await rename(source, target)
        await reconcileSearchIndex(ctx)
        return { restored: sessionId }
      }
      const agent = ctx.agents.get(sessionId)
      if (agent && agent.status !== 'idle') throw new Error('会话仍在运行或收尾，请稍后重试。')
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
      if (ctx.agents.get(sessionId) || ctx.sessions.get(sessionId)) {
        throw new Error('会话已重新打开，请关闭后重试。')
      }
      const snapshot = await ctx.sessionPersistence.stat(sessionId)
      if (!snapshot) throw new Error('宿主未找到此会话的持久化记录。')
      const location = snapshot.location
      if (snapshot.header.id !== sessionId || location?.kind !== 'jsonl' || !isAbsolute(location.path)) {
        throw new Error('无法确认此会话的 JSONL 日志位置。')
      }
      const root = resolve(sessionsRoot())
      const directory = dirname(resolve(location.path))
      const parts = relative(root, directory).split(sep)
      const key = encodeSegment(sessionId)
      const filename = basename(location.path)
      if (parts.length !== 2 || parts[0] === '..' || isAbsolute(parts[0])
        || ![key, `session-${key}`].includes(parts[1])
        || !logPattern.test(filename)) {
        throw new Error('会话日志不在受支持的 sessions 目录中。')
      }
      const canonicalRoot = await realpath(root)
      const canonical = await realpath(directory)
      const info = await lstat(location.path)
      if (relative(join(canonicalRoot, ...parts), canonical) !== '' || !info.isFile() || info.isSymbolicLink()) {
        throw new Error('会话路径包含重定向或日志不是普通文件。')
      }
      const destination = join(await trashPartition(parts[0], true), parts[1])
      await requireMissing(destination)
      signal?.throwIfAborted()
      if (ctx.agents.get(sessionId) || ctx.sessions.get(sessionId)) {
        throw new Error('会话已重新打开，请关闭后重试。')
      }
      await rename(canonical, destination)
      const title = typeof displayTitle === 'string' ? displayTitle.slice(0, 512) : snapshot.header.title
      try {
        await writeFile(join(destination, metadataFile), JSON.stringify({ sessionId, title }), { flag: 'wx' })
      } catch (error) {
        if (error.code !== 'EEXIST') ctx.logger.warn('session-reaper: ' + String(error))
      }
      await forgetProjectionCache(ctx, sessionId)
      await reconcileSearchIndex(ctx)
      return { deleted: sessionId, partition: parts[0], directoryKey: parts[1] }
    } finally { pending.delete(lock) }
  }
  for (const action of ['delete', 'restore', 'list', 'purge']) {
    const method = 'session-reaper/' + action
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/' + method, methods: ['POST'], requestBody: 'buffered',
      fetch: async request => {
        let body
        try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
        if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== method) return new Response('Invalid RPC envelope', { status: 400 })
        let result
        try {
          const value = action === 'list' ? await list()
            : action === 'purge' ? await purge(body.payload, request.signal)
              : await change(action, body.payload, request.signal)
          result = { ok: true, value }
        }
        catch (error) { result = { ok: false, error: { code: method + '-failed', message: error instanceof Error ? error.message : String(error), details: {} } } }
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
      },
    }), 'session-reaper: authenticated ' + action)
  }
}
