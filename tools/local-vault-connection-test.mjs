import { harnessUrl } from './test-environment.mjs'
/** Uses real Cordis service scopes and Connection routing, not plain-object doubles. */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
const { HostConnectionService } = await import(harnessUrl('packages/client/connection/lib/index.js'))
import * as vault from '../local-vault/index.js'
const temporary = await mkdtemp(join(tmpdir(), 'dsh-vault-connection-'))
const ctx = new Context()
const routes = []
// Sibling service scopes reproduce production's strict injection checks.
const web = ctx.plugin(c => { c.provide('webServer', { register(route) { routes.push(route); return () => {} } }) })
await web
ctx.provide('profileContext', { dir: temporary })
ctx.provide('pluginManager', { listBundles: async () => [] })
let connection
const base = ctx.plugin(c => { connection = new HostConnectionService(c, [], {}) })
await base
let fiber
try {
  fiber = ctx.plugin(vault)
  await fiber
  const shared = connection.createSharedFetchHandler('/api')
  let rpcId = 0
  const request = (endpoint, payload = {}, method = 'local-vault/' + endpoint) => new Request('http://localhost/api/local-vault/' + endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: String(++rpcId), method, payload }),
  })
  const owner = { principal: { kind: 'owner' } }
  const call = async (endpoint, payload) => {
    const response = await shared.fetch(request(endpoint, payload), owner)
    assert.equal(response.status, 200)
    const envelope = await response.json()
    assert.equal(envelope.type, 'server-response')
    assert.equal(envelope.rpcId, String(rpcId))
    return envelope.result
  }
  assert.deepEqual(await call('scan'), { ok: true, value: { directory: '', candidates: [], warnings: [] } })
  assert.equal((await shared.fetch(request('scan'), { principal: { kind: 'guest' } })).status, 403)
  assert.equal((await shared.fetch(request('scan', {}, 'wrong/method'), owner)).status, 400)
  const saved = await call('save', { directory: fileURLToPath(new URL('../', import.meta.url)) })
  assert.equal(saved.ok, true)
  assert(saved.value.candidates.some(item => item.name === '@local/dsh-local-vault'))
  assert(saved.value.candidates.some(item => item.name === '@local/dsh-remote-access'))
  assert.equal((await call('scan')).value.candidates.length, saved.value.candidates.length)
  assert.equal((await call('settings')).value.directory, saved.value.directory)
  assert.equal(routes.length, 0, 'Vault must reuse /api rather than register an independent HTTP prefix')
  await fiber.dispose(); fiber = null
  assert.equal((await shared.fetch(request('scan'), owner)).status, 404)
  console.log('VAULT CONNECTION OK: real scoped startup, authenticated /api exact routes, envelope validation, save/scan/settings and teardown; no installed plugins changed')
} finally {
  if (fiber) await fiber.dispose()
  await base.dispose(); await web.dispose()
  const prefix = join(tmpdir(), 'dsh-vault-connection-')
  assert(temporary.startsWith(prefix) && temporary.length > prefix.length)
  await rm(temporary, { recursive: true, force: true })
}
