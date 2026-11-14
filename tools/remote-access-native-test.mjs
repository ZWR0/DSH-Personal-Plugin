import assert from 'node:assert/strict'
import { apply, ENDPOINTS } from '../remote-access/index.js'

const routes = new Map()
let cleanup
apply({
  connection: { fetch: { register(route) { routes.set(route.path, route.fetch) } } },
  effect(callback, label) {
    const dispose = callback()
    if (label.endsWith('stop phone gateway')) cleanup = dispose
  },
})

assert.deepEqual([...routes.keys()], ENDPOINTS.map(endpoint => '/api/remote-access/' + endpoint))
async function call(endpoint, payload = {}, method = 'remote-access/' + endpoint) {
  const path = '/api/remote-access/' + endpoint
  return routes.get(path)(new Request('http://localhost' + path, {
    method: 'POST',
    body: JSON.stringify({ type: 'client-request', rpcId: 'test', method, payload }),
  }))
}
const status = await call('lan-status')
assert.equal(status.headers.get('cache-control'), 'no-store')
assert.equal((await status.json()).result.value.connected, false)
assert.equal((await (await call('lan-code')).json()).result.ok, false)
assert.equal((await (await call('lan-approve')).json()).result.ok, false)
assert.equal((await (await call('lan-stop')).json()).result.ok, true)
assert.equal((await call('lan-status', {}, 'wrong')).status, 400)
cleanup()
console.log('PASS phone gateway management routes and shutdown')
