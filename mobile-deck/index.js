/**
 * 掌上行舟 Host half.
 *
 * The Host stores workbench preferences, followed sessions and alert rules.
 * Device audio settings remain in each browser. Session state, running state and the
 * question cards are already Client-visible through the shipped Session
 * Controller services, so this plugin must never poll the Host for them.
 *
 * The preferences are reached over the shared `/api` carrier through
 * Connection's authenticated exact routes, so the Host/Origin fence, browser
 * authentication, request caps and same-origin checks stay owned by the
 * existing middleware. Nothing here touches credentials or authentication.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const name = 'mobile-deck'
export const inject = ['connection', 'profileContext']

const ENDPOINT = 'mobile-deck/settings'
const SETTINGS_FILE = 'mobile-deck.json'
const SETTINGS_VERSION = 1
const LAYOUTS = ['auto', 'phone', 'pad']
const DEFAULT_RULES = { followed: [], question: true, approval: true, ended: true, onlyFollowed: false }
const DEFAULT_SETTINGS = { enabled: true, layout: 'auto', idleLimit: 8 }

const message = error => (error instanceof Error ? error.message : String(error))
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Clamp the idle-row budget to a range the UI can render honestly. */
function normalizeIdleLimit(value) {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.idleLimit
  return Math.min(30, Math.max(1, Math.round(numeric)))
}

/** Validate one settings candidate with a message the UI can show as-is. */
function normalize(input, base = DEFAULT_SETTINGS) {
  const next = { ...base }
  if (input.enabled !== undefined) {
    if (typeof input.enabled !== 'boolean') throw new Error('enabled 必须是布尔值')
    next.enabled = input.enabled
  }
  if (input.layout !== undefined) {
    if (!LAYOUTS.includes(input.layout)) throw new Error(`layout 必须是 ${LAYOUTS.join(' / ')} 之一`)
    next.layout = input.layout
  }
  if (input.idleLimit !== undefined) next.idleLimit = normalizeIdleLimit(input.idleLimit)
  return next
}

/** Preferences are not secret, but they are local: they live beside the profile, never in source. */
async function readSettings(directory) {
  try {
    const value = JSON.parse(await readFile(join(directory, SETTINGS_FILE), 'utf8'))
    if (!isRecord(value)) return { ...DEFAULT_SETTINGS }
    return normalize(value, DEFAULT_SETTINGS)
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_SETTINGS }
    if (error instanceof SyntaxError) return { ...DEFAULT_SETTINGS }
    throw new Error(`读取掌上行舟配置失败：${message(error)}`)
  }
}

async function writeSettings(directory, next) {
  await mkdir(directory, { recursive: true })
  const target = join(directory, SETTINGS_FILE)
  const temporary = `${target}.${randomBytes(8).toString('hex')}.tmp`
  await writeFile(temporary, `${JSON.stringify({ version: SETTINGS_VERSION, ...next }, null, 2)}\n`, {
    encoding: 'utf8', flag: 'wx', mode: 0o600,
  })
  await rename(temporary, target)
}

/** Validate persisted or submitted shared alert preferences. */
function normalizeRules(input, base = DEFAULT_RULES) {
  if (!isRecord(input)) throw new Error('提醒设置必须是对象')
  const next = { ...base }
  for (const key of ['question', 'approval', 'ended', 'onlyFollowed']) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw new Error(key + ' 必须是布尔值')
      next[key] = input[key]
    }
  }
  if (input.followed !== undefined) {
    if (!Array.isArray(input.followed) || input.followed.length > 200 || input.followed.some(id => typeof id !== 'string' || !id || id.length > 511)) throw new Error('关注列表最多 200 项，且必须是有效会话 ID')
    next.followed = [...new Set(input.followed)]
  }
  return next
}

/**
 * Register the preference surface on the shared `/api` channel.
 * @param ctx - Host plugin context carrying Connection and the profile directory.
 */
export function apply(ctx) {
  const directory = ctx.profileContext.dir

  async function handle(payload) {
    const body = isRecord(payload) ? payload : {}
    const action = typeof body.action === 'string' ? body.action : 'get'
    const current = await readSettings(directory)
    if (action === 'get') return current
    if (action !== 'save') throw new Error('未知操作')
    const next = normalize(isRecord(body.settings) ? body.settings : {}, current)
    await writeSettings(directory, next)
    return next
  }

  const rulesFile = join(directory, 'mobile-deck-rules.json')
  let queue = Promise.resolve()
  async function sharedRules(body) {
    let stored
    try { stored = JSON.parse(await readFile(rulesFile, 'utf8')) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (stored !== undefined && stored.version !== 1) throw new Error('提醒设置版本不受支持，请更新插件')
    const current = stored === undefined ? { ...DEFAULT_RULES } : normalizeRules(stored)
    const action = body?.action || 'get'
    if (action === 'get') return { ...current, initialized: stored !== undefined }
    if (action === 'import' && stored !== undefined) throw new Error('Host 已有提醒设置，未覆盖；请刷新后逐项调整')
    let next
    if (action === 'follow') {
      if (typeof body.sessionId !== 'string' || !body.sessionId || body.sessionId.length > 511 || typeof body.followed !== 'boolean') throw new Error('无效的关注操作')
      next = normalizeRules({ followed: body.followed ? [...new Set([...current.followed, body.sessionId])] : current.followed.filter(id => id !== body.sessionId) }, current)
    } else if (action === 'save' || action === 'import') next = normalizeRules(body.rules, current)
    else throw new Error('未知提醒设置操作')
    await mkdir(directory, { recursive: true })
    const temporary = rulesFile + '.' + randomBytes(8).toString('hex') + '.tmp'
    await writeFile(temporary, JSON.stringify({ version: 1, ...next }) + '\n', { flag: 'wx', mode: 0o600 })
    await rename(temporary, rulesFile)
    return { ...next, initialized: true }
  }
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/mobile-deck/rules', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      let body
      try { body = await request.json() } catch (error) { return new Response('Invalid JSON', { status: 400 }) }
      if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== 'mobile-deck/rules') return new Response('Invalid RPC envelope', { status: 400 })
      const operation = queue.then(() => sharedRules(body.payload))
      queue = operation.catch(error => { /* The failed request reports its error; later requests still run. */ })
      let result
      try { result = { ok: true, value: await operation } }
      catch (error) { result = { ok: false, error: { code: 'mobile-deck/rules-failed', message: message(error), details: {} } } }
      return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
    },
  }), 'mobile-deck: shared alert preferences')

  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/' + ENDPOINT,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async request => {
      let body
      try { body = await request.json() } catch { return new Response('Invalid JSON', { status: 400 }) }
      if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== ENDPOINT) {
        return new Response('Invalid RPC envelope', { status: 400 })
      }
      let result
      try { result = { ok: true, value: await handle(body.payload) } }
      catch (error) {
        result = { ok: false, error: { code: 'mobile-deck/settings-failed', message: message(error), details: {} } }
      }
      return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
    },
  }), 'mobile-deck: authenticated settings route')
}
