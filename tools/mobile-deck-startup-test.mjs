import { harnessRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const req = harnessRequire
const { JSDOM } = req('jsdom')
const source = readFileSync(new URL('../mobile-deck/client.js', import.meta.url), 'utf8')
async function run({ home = true, mobile = true, url = 'https://dsh.test/', enabled = true, navigate = false, panel = null, blocked = false, pending = false } = {}) {
  const dom = new JSDOM('', { url })
  const win = dom.window
  if (blocked) Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked') } })
  else win.localStorage.setItem('dsh.mobile-deck.mobile-home.v1', String(home))
  win.matchMedia = () => ({ matches: mobile })
  let entry
  win.__ModuleLoader__ = { load(value) { entry = value } }
  new Function('window', source)(win)
  const cleanup = [], panels = [], handlers = new Map(), listeners = new Set(), registrations = new Set()
  let current = panel, resolveHost, listPhase = pending ? 'pending' : 'ready'
  const listListeners = new Set()
  const host = new Promise(resolve => { resolveHost = resolve })
  const empty = { getSnapshot: () => new Map(), subscribe: () => () => {} }
  const ctx = {
    effect(fn) { const result = fn(); if (typeof result === 'function') cleanup.push(result) },
    locale: { register: () => () => {}, bind: () => key => key },
    slots: { inject: (_, fn) => fn(), register(o) { registrations.add(o.key || o.id); return () => {} } },
    on(key, fn) { handlers.set(key, fn); return () => handlers.delete(key) },
    sessions: { list: { getSnapshot: () => ({ phase: listPhase, ids: [], byId: {} }), subscribe(fn) { listListeners.add(fn); return () => listListeners.delete(fn) } }, async refresh() {} },
    uiSession: { sessionStatus: empty },
    layout: { panelInfo: { getSnapshot: () => ({ activePanelId: current }), subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } }, selectPanel(id) { assert.ok(registrations.has(id)); current = id; panels.push(id); listeners.forEach(fn => fn()) } },
    connection: { state: { getSnapshot: () => 'connected' }, rpc: { call: () => host } },
  }
  // Keep the real browser global APIs isolated from the mock Host response.
  const apply = entry.factory(() => ({})).apply
  const invoke = new Function('window', 'document', 'ctx', 'apply', 'return apply(ctx)')
  // Factory closures use the passed window from module evaluation; apply uses document globally.
  const previousDocument = globalThis.document
  globalThis.document = win.document
  try {
    invoke(win, win.document, ctx, apply)
    if (navigate) { current = 'plugins'; listeners.forEach(fn => fn()) }
    resolveHost({ ok: true, value: { enabled, layout: 'auto', idleLimit: 8 } })
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    if (pending) {
      assert.deepEqual(panels, [], 'startup waits for the host session catalog')
      listPhase = 'ready'; listListeners.forEach(fn => fn())
    }
    assert.deepEqual(panels, home && mobile && enabled && !navigate && !blocked && !url.includes('#') && !url.includes('sessionId') && panel === null ? ['mobile-deck'] : [])
    if (handlers.has('connection/reset')) handlers.get('connection/reset')()
    await Promise.resolve()
    assert.ok(panels.length <= 1, 'reconnect does not redirect again')
    for (const dispose of cleanup.reverse()) dispose()
    assert.equal(listeners.size, 0)
  } finally { globalThis.document = previousDocument; win.close() }
}
await run()
await run({ pending: true })
for (const options of [{ home: false }, { mobile: false }, { enabled: false }, { navigate: true }, { panel: 'plugins' }, { blocked: true }, { url: 'https://dsh.test/?sessionId=one' }, { url: 'https://dsh.test/#session/one' }]) await run(options)
console.log('MOBILE DECK STARTUP OK: opt-in mobile startup, desktop/disabled/deep-link/navigation guards, blocked storage, reconnect and teardown')
