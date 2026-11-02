/** Cross-device persistence, concurrent updates, validation and failure preservation. */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply as mobile } from '../mobile-deck/index.js'
const root = await mkdtemp(join(tmpdir(), 'dsh-shared-features-'))
const routes = new Map(), disposers = []
const ctx = { profileContext: { dir: root }, effect(fn) { disposers.push(fn()) }, connection: { fetch: { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } } } }
let rpc = 0
function client(endpoint) {
  return async payload => {
    const response = await routes.get('/api/' + endpoint).fetch(new Request('http://localhost/api/' + endpoint, {
      method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: String(++rpc), method: endpoint, payload }),
    }))
    assert.equal(response.status, 200)
    return (await response.json()).result
  }
}
try {
  mobile(ctx)
  const deviceA = client('mobile-deck/rules'), deviceB = client('mobile-deck/rules')
  assert.equal((await deviceA({ action: 'get' })).value.initialized, false)
  assert.equal((await deviceA({ action: 'import', rules: { followed: ['old'], question: false } })).ok, true)
  assert.deepEqual((await deviceB({ action: 'get' })).value.followed, ['old'])
  assert.equal((await deviceB({ action: 'import', rules: { followed: [] } })).ok, false)
  await Promise.all([deviceA({ action: 'follow', sessionId: 'a', followed: true }), deviceB({ action: 'follow', sessionId: 'b', followed: true }), deviceA({ action: 'save', rules: { approval: false } })])
  const current = (await deviceB({ action: 'get' })).value
  assert.deepEqual(current.followed, ['old', 'a', 'b'])
  assert.equal(current.question, false); assert.equal(current.approval, false)
  const before = await readFile(join(root, 'mobile-deck-rules.json'), 'utf8')
  assert.equal((await deviceA({ action: 'save', rules: { question: 'yes' } })).ok, false)
  assert.equal((await deviceA({ action: 'save', rules: { followed: Array.from({length:201},(_,i)=>String(i)) } })).ok, false)
  assert.equal(await readFile(join(root, 'mobile-deck-rules.json'), 'utf8'), before)
  for (const dispose of disposers.splice(0)) dispose()
  mobile(ctx)
  assert.deepEqual((await deviceA({ action: 'get' })).value, current)
  console.log('SHARED FEATURES HOST OK: two devices, one-time import, concurrent merge, restart and validation')
} finally { for (const dispose of disposers) dispose(); await rm(root, {recursive:true,force:true}) }
