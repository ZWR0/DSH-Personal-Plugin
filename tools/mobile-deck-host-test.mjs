// Host-half test for 掌上行舟: the authenticated settings route, its
// validation and its on-disk record. Uses a temporary profile directory only.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject } from '../mobile-deck/index.js'

const directory = await mkdtemp(join(tmpdir(), 'mobile-deck-host-'))
const routes = new Map()
const disposers = []
const ctx = {
  profileContext: { dir: directory },
  connection: {
    fetch: {
      register(route) {
        routes.set(route.path, route)
        const dispose = () => routes.delete(route.path)
        disposers.push(dispose)
        return dispose
      },
    },
  },
  effect(fn) { return fn() },
}

try {
  apply(ctx)
  assert.deepEqual(inject, ['connection', 'profileContext'])
  assert.deepEqual([...routes.keys()].sort(), ['/api/mobile-deck/rules', '/api/mobile-deck/settings'])
  const route = routes.get('/api/mobile-deck/settings')
  assert.deepEqual(route.methods, ['POST'])
  assert.equal(route.requestBody, 'buffered')

  let rpcId = 0
  const call = async (method, payload) => {
    const response = await route.fetch(new Request('http://localhost/api/mobile-deck/settings', {
      method: 'POST',
      body: JSON.stringify({ type: 'client-request', rpcId: `r${++rpcId}`, method, payload }),
    }))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.type, 'server-response')
    assert.equal(body.rpcId, `r${rpcId}`)
    return body.result
  }

  // Defaults before any write.
  assert.deepEqual(await call('mobile-deck/settings', { action: 'get' }),
    { ok: true, value: { enabled: true, layout: 'auto', idleLimit: 8 } })

  // A valid save is validated, clamped and persisted.
  const saved = await call('mobile-deck/settings', { action: 'save', settings: { enabled: false, layout: 'pad', idleLimit: 99 } })
  assert.deepEqual(saved, { ok: true, value: { enabled: false, layout: 'pad', idleLimit: 30 } })
  const record = JSON.parse(await readFile(join(directory, 'mobile-deck.json'), 'utf8'))
  assert.deepEqual(record, { version: 1, enabled: false, layout: 'pad', idleLimit: 30 })
  const mode = (await stat(join(directory, 'mobile-deck.json'))).mode & 0o777
  if (process.platform !== 'win32') assert.equal(mode, 0o600, 'the record is owner-only')

  // Reads round-trip and partial saves keep the other fields.
  assert.deepEqual(await call('mobile-deck/settings', { action: 'get' }), saved)
  assert.deepEqual(await call('mobile-deck/settings', { action: 'save', settings: { layout: 'phone' } }),
    { ok: true, value: { enabled: false, layout: 'phone', idleLimit: 30 } })

  // Invalid input fails with a message the UI can show, and nothing is written.
  const rejected = await call('mobile-deck/settings', { action: 'save', settings: { layout: 'desktop' } })
  assert.equal(rejected.ok, false)
  assert.match(rejected.error.message, /layout/)
  assert.equal((await call('mobile-deck/settings', { action: 'save', settings: { enabled: 'yes' } })).ok, false)
  assert.equal((await call('mobile-deck/settings', { action: 'nope' })).ok, false)
  assert.equal(JSON.parse(await readFile(join(directory, 'mobile-deck.json'), 'utf8')).layout, 'phone')

  // The envelope is required: a foreign body is refused before any work.
  const bad = await route.fetch(new Request('http://localhost/api/mobile-deck/settings', {
    method: 'POST', body: JSON.stringify({ hello: 'world' }),
  }))
  assert.equal(bad.status, 400)
  const badMethod = await route.fetch(new Request('http://localhost/api/mobile-deck/settings', {
    method: 'POST',
    body: JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'other/path', payload: {} }),
  }))
  assert.equal(badMethod.status, 400)
  const badJson = await route.fetch(new Request('http://localhost/api/mobile-deck/settings', { method: 'POST', body: 'not json' }))
  assert.equal(badJson.status, 400)

  // A corrupt record falls back to defaults instead of failing the page.
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(directory, 'mobile-deck.json'), '{ not json', 'utf8')
  assert.deepEqual(await call('mobile-deck/settings', { action: 'get' }),
    { ok: true, value: { enabled: true, layout: 'auto', idleLimit: 8 } })

  // Teardown removes the route.
  for (const dispose of disposers) dispose()
  assert.equal(routes.size, 0)
  console.log('MOBILE DECK HOST OK: defaults, validation, clamping, atomic record, envelope checks, corrupt-record fallback')
} finally {
  await rm(directory, { recursive: true, force: true })
}
