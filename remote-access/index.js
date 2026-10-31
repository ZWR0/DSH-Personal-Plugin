/**
 * Remote Access Host half.
 *
 * Owns nothing about authentication itself: the launch token lives in
 * Connection's browser-session credential record, and this plugin is only the
 * authenticated management surface over the shared `/api` carrier. Endpoints
 * are reached through Connection's owner-only exact routes, so the Host/Origin fence,
 * browser authentication, request caps and CSRF-relevant same-origin checks all
 * stay owned by the existing middleware.
 */
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const name = 'remote-access'
export const inject = ['connection', 'profileContext']

export const ENDPOINT_PREFIX = 'remote-access/'
export const ENDPOINTS = ['status', 'save', 'generate', 'reveal', 'link', 'revoke']

/** Mirrors the core rule so the UI can answer in the user's language before the Host validates. */
const TOKEN_MIN = 32
const TOKEN_MAX = 256
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/
const SETTINGS_FILE = 'remote-access.json'
const SETTINGS_VERSION = 1

const message = error => (error instanceof Error ? error.message : String(error))
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value)

/** A 32-byte cryptographic token: 256 bits of entropy, URL and cookie safe. */
function generateToken() {
  return randomBytes(32).toString('base64url')
}

/** Validate a custom token with a message the UI can show as-is. */
function normalizeToken(value) {
  if (typeof value !== 'string') throw new Error('Token 必须是字符串')
  const token = value.trim()
  if (token.length < TOKEN_MIN || token.length > TOKEN_MAX) {
    throw new Error(`Token 长度必须为 ${TOKEN_MIN}–${TOKEN_MAX} 个字符`)
  }
  if (!TOKEN_PATTERN.test(token)) throw new Error('Token 只能包含 A–Z、a–z、0–9、- 和 _')
  return token
}

/**
 * Normalize the advertised remote base URL.
 * The plugin never edits proxy configuration; it only records what the operator
 * says the browser reaches.
 */
function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return ''
  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('远程访问地址必须是完整的 http(s) 地址')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('远程访问地址必须是 http(s) 地址')
  if (url.username !== '' || url.password !== '') throw new Error('远程访问地址不能包含用户名或密码')
  url.hash = ''
  url.search = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

/** Settings are not secret, but they are local: they live beside the profile, never in source. */
async function readSettings(directory) {
  try {
    const value = JSON.parse(await readFile(join(directory, SETTINGS_FILE), 'utf8'))
    return { baseUrl: isRecord(value) && typeof value.baseUrl === 'string' ? value.baseUrl : '' }
  } catch (error) {
    if (error.code === 'ENOENT') return { baseUrl: '' }
    throw new Error(`读取远程访问配置失败：${message(error)}`)
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

/** Compose the fixed sign-in URL from the stored base and the running token. */
function signInUrl(baseUrl, token) {
  const url = new URL(baseUrl)
  url.searchParams.set('token', token)
  return url.href
}

/**
 * Register the management surface on the shared `/api` channel.
 * @param ctx - Host plugin context carrying Connection and the profile directory.
 */
export function apply(ctx) {
  const directory = ctx.profileContext.dir

  /** Read the browser-auth face; older Hosts without it fail with a clear message instead of a TypeError. */
  function auth() {
    const connection = ctx.connection
    for (const method of ['webAuthStatus', 'webAuthToken', 'setWebAuthToken', 'clearWebAuthToken']) {
      if (typeof connection[method] !== 'function') {
        throw new Error('当前 DSH 版本的认证层不支持固定 Token，请更新并重启 DSH')
      }
    }
    return connection
  }

  async function status() {
    const connection = auth()
    const authStatus = connection.webAuthStatus()
    const settings = await readSettings(directory)
    return {
      mode: authStatus.mode,
      stable: authStatus.stable,
      source: authStatus.source,
      configured: authStatus.mode !== 'ephemeral',
      tokenMasked: authStatus.tokenMasked,
      rotatedAt: authStatus.rotatedAt,
      baseUrl: settings.baseUrl,
      webRunning: ctx.get('webServer') !== undefined,
      // The running process already uses the value it just stored, and a
      // restart reloads the same record, so no restart is ever pending.
      restartRequired: false,
      envOverride: authStatus.mode === 'environment',
    }
  }

  async function save(body) {
    const connection = auth()
    if (body.mode !== undefined && !['persistent', 'ephemeral'].includes(body.mode)) {
      throw new Error('未知认证模式')
    }
    if (body.mode === 'persistent' && typeof body.token === 'string' && body.token.trim() !== '') normalizeToken(body.token)
    if (body.mode !== undefined && connection.webAuthStatus().mode === 'environment') {
      throw new Error('DSH_WEB_TOKEN 环境变量已接管 Token，请先取消该变量再在界面中修改')
    }
    let settings = await readSettings(directory)
    if (typeof body.baseUrl === 'string') {
      settings = { baseUrl: normalizeBaseUrl(body.baseUrl) }
      await writeSettings(directory, settings)
    }
    const wantsPersistent = body.mode === 'persistent'
    const current = connection.webAuthStatus()
    if (wantsPersistent) {
      if (current.mode === 'environment') {
        throw new Error('DSH_WEB_TOKEN 环境变量已接管 Token，请先取消该变量再在界面中修改')
      }
      const supplied = typeof body.token === 'string' ? body.token.trim() : ''
      if (supplied !== '') await connection.setWebAuthToken(normalizeToken(supplied))
      else if (current.mode !== 'persistent') await connection.setWebAuthToken(generateToken())
    } else if (body.mode === 'ephemeral' && current.mode === 'persistent') {
      await connection.clearWebAuthToken()
    }
    return status()
  }

  async function handle(endpoint, payload) {
    const body = isRecord(payload) ? payload : {}
    switch (endpoint) {
      case 'status':
        return status()
      case 'generate':
        return { token: generateToken() }
      case 'reveal':
        return { token: auth().webAuthToken() }
      case 'save':
        return save(body)
      case 'revoke':
        if (auth().webAuthStatus().mode === 'environment') {
          throw new Error('DSH_WEB_TOKEN 环境变量已接管 Token，请先取消该变量再在界面中撤销')
        }
        await auth().clearWebAuthToken()
        return status()
      case 'link': {
        const current = auth().webAuthStatus()
        if (current.mode === 'ephemeral') throw new Error('固定 Token 未启用，当前认证链接会在服务重启后失效')
        const settings = await readSettings(directory)
        const base = typeof body.baseUrl === 'string' && body.baseUrl.trim() !== ''
          ? normalizeBaseUrl(body.baseUrl)
          : settings.baseUrl
        if (base === '') throw new Error('请先设置远程访问基础地址')
        return { url: signInUrl(base, auth().webAuthToken()) }
      }
      default:
        throw new Error('未知操作')
    }
  }

  for (const endpoint of ENDPOINTS) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/' + ENDPOINT_PREFIX + endpoint,
      methods: ['POST'],
      requestBody: 'buffered',
      // Exact routes are owner-only; Connection retains authentication,
      // Host/Origin checks, request limits and transport admission.
      fetch: async request => {
        let body
        try { body = await request.json() }
        catch { return new Response('Invalid JSON', { status: 400 }) }
        if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string'
          || body.method !== ENDPOINT_PREFIX + endpoint) {
          return new Response('Invalid RPC envelope', { status: 400 })
        }
        let result
        try { result = { ok: true, value: await handle(endpoint, body.payload) } }
        catch (error) {
          result = { ok: false, error: { code: 'remote-access/failed', message: message(error), details: {} } }
        }
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
      },
    }), 'remote-access: ' + endpoint + ' authenticated route')
  }
}
