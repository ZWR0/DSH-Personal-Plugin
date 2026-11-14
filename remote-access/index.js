/** Host routes for the desktop-owned phone gateway. */
import { createLanGateway } from './lan-gateway.js'

export const name = 'remote-access'
export const inject = ['connection']
export const ENDPOINT_PREFIX = 'remote-access/'
export const ENDPOINTS = ['lan-status', 'lan-start', 'lan-stop', 'lan-code', 'lan-approve']

export function apply(ctx) {
  const lan = createLanGateway(ctx.connection, () => ctx.get('webServer').getOrigin())
  ctx.effect(() => () => lan.stop(), 'remote-access: stop phone gateway')

  const operations = {
    'lan-status': () => lan.status(),
    'lan-start': body => lan.start(body.address, body.mode === 'tailscale' ? 'tailscale' : 'lan'),
    'lan-stop': () => { lan.stop(); return lan.status() },
    'lan-code': () => lan.code(),
    'lan-approve': () => lan.approve(),
  }
  for (const endpoint of ENDPOINTS) {
    const method = ENDPOINT_PREFIX + endpoint
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/' + method,
      methods: ['POST'],
      requestBody: 'buffered',
      async fetch(request) {
        let body
        try { body = await request.json() }
        catch { return new Response('Invalid JSON', { status: 400 }) }
        if (body?.type !== 'client-request' || typeof body.rpcId !== 'string' || body.method !== method) {
          return new Response('Invalid RPC envelope', { status: 400 })
        }
        let result
        try {
          result = { ok: true, value: await operations[endpoint](body.payload ?? {}) }
        } catch (error) {
          result = { ok: false, error: { code: 'remote-access/failed', message: error instanceof Error ? error.message : String(error), details: {} } }
        }
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result }, {
          headers: { 'cache-control': 'no-store' },
        })
      },
    }), 'remote-access: ' + endpoint + ' owner route')
  }
}
