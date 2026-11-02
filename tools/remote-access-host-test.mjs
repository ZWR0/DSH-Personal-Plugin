import { dependencyPath, harnessRoot } from './test-environment.mjs'
/**
 * End-to-end check of the Remote Access Host half against the real BrowserAuth.
 *
 * Run from the DSH checkout so bare specifiers resolve:
 *   node --import tsx/esm "<this file>"
 *
 * It models a restart by rebuilding BrowserAuth from the same credential store,
 * which is exactly what a new `dsh web` process does.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = harnessRoot
const { BrowserAuth } = await import(pathToFileURL(`${REPO}/packages/client/connection/src/browser-auth.ts`).href)
const plugin = await import('../remote-access/index.js')

const failures = []
const check = (name, condition, detail) => {
  if (condition) {
    console.log(`  ok   ${name}`)
    return
  }
  failures.push(`${name}${detail === undefined ? '' : ` — ${detail}`}`)
  console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${detail}`}`)
}


/** One record map per Harness home, shared across restarts. */
class KeyedCredentials {
  records = new Map()
  readRecord(key) { return Promise.resolve(this.records.get(String(key))) }
  async modifyRecord(key, mutate) {
    const next = await mutate(this.records.get(String(key)))
    if (next !== undefined) this.records.set(String(key), next)
    return this.records.get(String(key))
  }
  async deleteRecord(key) { this.records.delete(String(key)) }
}

/**
 * Child mode: a genuinely separate Node process reads the serialized credential
 * store and reports which sign-in URL a fresh `dsh web` boot would accept.
 */
if (process.argv[2] === '--child') {
  const store = new KeyedCredentials()
  store.records = new Map(Object.entries(JSON.parse(readFileSync(process.argv[3], 'utf8'))))
  const auth = await BrowserAuth.create({}, store, 30)
  process.stdout.write(JSON.stringify({
    url: auth.authenticatedUrl('https://msd.example.ts.net/'),
    status: auth.status(),
  }))
  process.exit(0)
}

/** Mount the plugin over a fake Context and return its RPC dispatcher. */
async function mountPlugin({ store, directory, secure = false }) {
  const routes = new Map()
  const host = 'localhost:3080'
  const indexRequest = { method: 'GET', url: '/?token=' + currentAuth.token(), headers: { host } }
  let cookie
  currentAuth.authorizeIndex(indexRequest, {
    writeHead(_status, headers) { cookie = headers['set-cookie'].split(';', 1)[0] },
    end() {},
  }, secure)
  const connection = {
    authorizeIndex: (request, response) => currentAuth.authorizeIndex(request, response, secure),
    webAuthStatus: () => currentAuth.status(),
    webAuthToken: () => currentAuth.token(),
    setWebAuthToken: token => currentAuth.setPersistentToken(token),
    clearWebAuthToken: () => currentAuth.clearPersistentToken(),
    fetch: {
      register: route => {
        if (routes.has(route.path)) throw new Error('duplicate route')
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
  }

  const ctx = {
    profileContext: { dir: directory },
    connection,
    get: name => (name === 'webServer' ? { protocol: 'https:' } : undefined),
    effect: callback => callback(),
  }
  plugin.apply(ctx)
  if (routes.size !== plugin.ENDPOINTS.length) throw new Error('missing exact routes')
  const route = routes.get('/api/remote-access/status')
  if ((await route.fetch(new Request('http://localhost/api/remote-access/status', { method: 'POST', body: '{}' }))).status !== 400) throw new Error('invalid envelope accepted')
  return async (endpoint, payload) => {
    const previousCookie = cookie
    const previousToken = currentAuth.token()
    if (!currentAuth.isAuthenticated({ headers: { host, cookie } }, secure)) {
      throw new Error('HTTP 401: browser cookie was not renewed')
    }
    const route = routes.get(`/api/${plugin.ENDPOINT_PREFIX}${endpoint}`)
    if (!route || route.methods.join() !== 'POST' || route.requestBody !== 'buffered') throw new Error('invalid route registration')
    const response = await route.fetch(new Request(`http://localhost${route.path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', host, cookie },
      body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: plugin.ENDPOINT_PREFIX + endpoint, payload }),
    }))
    const renewed = response.headers.get('set-cookie')
    if (response.headers.get('cache-control') !== 'no-store') throw new Error('credential response is cacheable')
    if (renewed !== null) cookie = renewed.split(';', 1)[0]
    if (currentAuth.token() !== previousToken) {
      check('rotation renews the initiating browser cookie', renewed !== null)
      check('renewed cookie authenticates the next request', currentAuth.isAuthenticated({ headers: { host, cookie } }, secure))
      check('another browser with the previous cookie is rejected', !currentAuth.isAuthenticated({ headers: { host, cookie: previousCookie } }, secure))
      check('renewed cookie keeps HttpOnly and SameSite', renewed?.includes('HttpOnly') && renewed?.includes('SameSite=Strict'))
      check('renewed cookie follows listener TLS', renewed?.includes('; Secure') === secure)
    } else if (renewed !== null) {
      throw new Error('unchanged authentication unexpectedly renewed a cookie')
    }
    const envelope = await response.json()
    if (envelope.type !== 'server-response' || envelope.rpcId !== 'test') throw new Error('invalid response envelope')
    const result = envelope.result
    if (result.ok === true) return result.value
    throw new Error(result.error.message)
  }
}

const bundlePatch = readFileSync(new URL('../remote-access/cordis.patch.yml', import.meta.url), 'utf8')
check('settings plugin preserves the built-in remote-access entry',
  bundlePatch.includes('id: local-remote-access-settings') && !/^\s*- id: remote-access\s*$/m.test(bundlePatch))

let currentAuth
const directory = await mkdtemp(join(tmpdir(), 'remote-access-test-'))
const store = new KeyedCredentials()
const original = process.env.DSH_WEB_TOKEN
delete process.env.DSH_WEB_TOKEN

try {
  console.log('default ephemeral mode')
  currentAuth = await BrowserAuth.create({}, store, 30)
  let call = await mountPlugin({ store, directory })
  let status = await call('status')
  check('mode is ephemeral', status.mode === 'ephemeral', status.mode)
  check('token is not configured', status.configured === false)
  check('web service is running', status.webRunning === true)
  check('no restart pending', status.restartRequired === false)
  await check('link is refused while ephemeral', await call('link').then(() => false, () => true))

  console.log('base URL is stored beside the profile, not in source')
  status = await call('save', { mode: 'ephemeral', baseUrl: 'https://msd.example.ts.net' })
  check('base URL normalized with a trailing slash', status.baseUrl === 'https://msd.example.ts.net/', status.baseUrl)
  const saved = JSON.parse(await readFile(join(directory, 'remote-access.json'), 'utf8'))
  check('settings file carries the base URL', saved.baseUrl === 'https://msd.example.ts.net/')

  console.log('enable a generated fixed token')
  status = await call('save', { mode: 'persistent' })
  check('mode is persistent', status.mode === 'persistent', status.mode)
  check('token reports as configured', status.configured === true)
  const firstToken = currentAuth.token()
  check(
    'status hides the token body',
    status.tokenMasked !== firstToken
      && status.tokenMasked === `${firstToken.slice(0, 4)}****${firstToken.slice(-4)}`,
    status.tokenMasked,
  )
  check('generated token has 256 bits of entropy', /^[A-Za-z0-9_-]{43}$/u.test(firstToken), firstToken.length)
  const link = await call('link')
  check('sign-in URL carries the token', new URL(link.url).searchParams.get('token') === firstToken)
  check('sign-in URL uses the stored base', link.url.startsWith('https://msd.example.ts.net/?token='), link.url)

  console.log('URL-only saves preserve authentication')
  await call('save', { baseUrl: 'http://100.64.0.1:3080/dsh' })
  check('URL-only save preserves fixed token', currentAuth.token() === firstToken && (await call('status')).mode === 'persistent')
  check('subpath preserved', (await call('status')).baseUrl === 'http://100.64.0.1:3080/dsh/')
  await call('save', { baseUrl: 'https://msd.example.ts.net/' })

  console.log('custom token validation')
  for (const [value, why] of [['short', 'too short'], ['x'.repeat(257), 'too long'], ['bad token!', 'bad characters']]) {
    await check(`rejects a ${why} token`, await call('save', { mode: 'persistent', token: value }).then(() => false, () => true))
  }
  check('rejected tokens leave the running token alone', currentAuth.token() === firstToken)

  console.log('restart keeps the token and the link')
  currentAuth = await BrowserAuth.create({}, store, 30)
  call = await mountPlugin({ store, directory })
  status = await call('status')
  check('restart stays in persistent mode', status.mode === 'persistent', status.mode)
  check('restart reuses the stored base URL', status.baseUrl === 'https://msd.example.ts.net/')
  check('restart keeps the same token', currentAuth.token() === firstToken)
  check('restart keeps the same sign-in URL', (await call('link')).url === link.url)
  let bookmarkedCookie
  let bookmarkedStatus
  currentAuth.authorizeIndex(
    { method: 'GET', url: `/?token=${firstToken}`, headers: { host: 'msd.example.ts.net' } },
    { writeHead(status, headers) { bookmarkedStatus = status; bookmarkedCookie = headers?.['set-cookie']?.split(';', 1)[0] }, end() {} },
  )
  check('bookmarked URL still authenticates', bookmarkedStatus === 303
    && currentAuth.isAuthenticated({ headers: { host: 'msd.example.ts.net', cookie: bookmarkedCookie } }))

  console.log('a wrong token fails authentication')
  let denied = { status: undefined }
  currentAuth.authorizeIndex(
    { method: 'GET', url: '/?token=wrong-token', headers: { host: 'msd.example.ts.net' } },
    { writeHead(code) { denied.status = code }, end() {} },
  )
  check('wrong token is rejected with 401', denied.status === 401, String(denied.status))

  console.log('updating the token retires the old one')
  const nextToken = 'n'.repeat(43)
  status = await call('save', { mode: 'persistent', token: nextToken })
  check('token changed', status.configured === true && currentAuth.token() === nextToken)
  denied = { status: undefined }
  currentAuth.authorizeIndex(
    { method: 'GET', url: `/?token=${firstToken}`, headers: { host: 'msd.example.ts.net' } },
    { writeHead(code) { denied.status = code }, end() {} },
  )
  check('old token now fails', denied.status === 401, String(denied.status))
  check('new link uses the new token', (await call('link')).url.includes(nextToken))

  console.log('revoking the fixed token')
  status = await call('revoke')
  check('mode returns to ephemeral', status.mode === 'ephemeral', status.mode)
  check('revoked token is no longer the running one', currentAuth.token() !== nextToken)
  denied = { status: undefined }
  currentAuth.authorizeIndex(
    { method: 'GET', url: `/?token=${nextToken}`, headers: { host: 'msd.example.ts.net' } },
    { writeHead(code) { denied.status = code }, end() {} },
  )
  check('revoked token fails', denied.status === 401, String(denied.status))

  console.log('a restarted process honours the revocation')
  currentAuth = await BrowserAuth.create({}, store, 30)
  call = await mountPlugin({ store, directory })
  check('still ephemeral after restart', (await call('status')).mode === 'ephemeral')
  check('revoked token is gone from the store', currentAuth.token() !== nextToken)

  console.log('DSH_WEB_TOKEN outranks the stored token')
  await call('save', { mode: 'persistent', token: 'p'.repeat(43) })
  process.env.DSH_WEB_TOKEN = 'e'.repeat(43)
  currentAuth = await BrowserAuth.create({}, store, 30)
  call = await mountPlugin({ store, directory })
  status = await call('status')
  check('environment mode is reported', status.mode === 'environment', status.mode)
  check('environment token wins', currentAuth.token() === 'e'.repeat(43))
  await check('token management is refused', await call('save', { mode: 'persistent', token: 'z'.repeat(43) }).then(() => false, () => true))

  await call('save', { baseUrl: 'http://100.64.0.1:3080/' })
  check('environment mode can save URL without token changes', currentAuth.token() === 'e'.repeat(43) && (await call('status')).baseUrl === 'http://100.64.0.1:3080/')
  await call('save', { baseUrl: 'https://msd.example.ts.net/' })

  console.log('a second, separate Node process honours the stored token')
  delete process.env.DSH_WEB_TOKEN
  currentAuth = await BrowserAuth.create({}, store, 30)
  call = await mountPlugin({ store, directory })
  const carried = 'c'.repeat(43)
  await call('save', { mode: 'persistent', token: carried })
  const storeFile = join(directory, 'credential-store.json')
  writeFileSync(storeFile, JSON.stringify(Object.fromEntries(store.records)), 'utf8')
  const child = JSON.parse(execFileSync(process.execPath, [
    dependencyPath('tsx/cli'),
    fileURLToPath(import.meta.url),
    '--child',
    storeFile,
  ], { cwd: REPO, encoding: 'utf8' }))
  check('the fresh process boots in persistent mode', child.status.mode === 'persistent', child.status.mode)
  check(
    'the fresh process accepts the same sign-in URL',
    child.url === `https://msd.example.ts.net/?token=${carried}`,
    child.url,
  )

  console.log('TLS listener keeps the initiating browser authenticated')
  call = await mountPlugin({ store, directory, secure: true })
  await call('save', { mode: 'persistent', token: 't'.repeat(43) })
  await call('save', { baseUrl: 'https://msd.example.ts.net/' })
  await call('save', { mode: 'persistent', token: 't'.repeat(43) })
  await call('revoke')
  check('TLS browser can save after revocation', (await call('save', { baseUrl: 'https://msd.example.ts.net/' })).mode === 'ephemeral')
} finally {
  if (original === undefined) delete process.env.DSH_WEB_TOKEN
  else process.env.DSH_WEB_TOKEN = original
  await rm(directory, { recursive: true, force: true })
}

console.log(failures.length === 0 ? '\nall checks passed' : `\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`)
process.exitCode = failures.length === 0 ? 0 : 1
