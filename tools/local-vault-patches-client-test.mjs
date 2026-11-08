import { harnessRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { JSDOM } = harnessRequire('jsdom')
const dom = new JSDOM('<div id="mount"></div>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'MutationObserver', 'HTMLElement', 'Node', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = harnessRequire('react')
const { act } = React
const { createRoot } = harnessRequire('react-dom/client')
let module, Component, face, dictionaries
window.__ModuleLoader__ = { load(value) { module = value } }
new Function(readFileSync(new URL('../local-vault/client.js', import.meta.url), 'utf8'))()
const plugin = module.factory(() => React)
const t = key => dictionaries.zh[key] || key
let removable = true, fail = false, removals = 0
plugin.apply({
  locale: { register(_, value) { dictionaries = value; return () => {} }, bind: () => t, resolveText: value => value },
  effect: fn => fn(), slots: { inject: (_, fn) => fn(), register(options, component) { Component = component; face = options.inject(); return () => {} } },
  uiWorkspace: {}, remote: { pluginManager: { listBundles: async () => ({ ok: true, value: [] }) } },
  connection: { rpc: { async call(_, endpoint, payload) {
    const value = endpoint.endsWith('patch-status') ? { managed: true, revision: 'fixture', supported: true, patches: [{ file: 'fixture.patch', title: '压缩预算', plugin: '@local/dsh-context-guard', state: 'applied', removable, fallback: '保留预算保护' }] }
      : endpoint.endsWith('patch-remove') ? (() => { assert.deepEqual(payload, { patch: 'fixture.patch', confirm: true }); removals++; return { accepted: true, message: '维护已接受' } })()
      : { directory: '', candidates: [], warnings: [] }
    if (fail && endpoint.endsWith('patch-remove')) return { ok: false, error: { message: 'source conflict' } }
    return { ok: true, value }
  } } },
})
const root = createRoot(document.getElementById('mount'))
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === t(label))
try {
  await act(async () => root.render(React.createElement(Component, { ...face, t, openPackage() {} })))
  assert.match(document.body.textContent, /宿主补丁/)
  assert.match(document.body.textContent, /保留预算保护/)
  assert.equal(button('removePatch').disabled, false)
  await act(async () => button('removePatch').click())
  assert.equal(removals, 0)
  await act(async () => button('cancel').click())
  assert.equal(removals, 0)
  removable = false
  await act(async () => button('patchRefresh').click())
  assert.equal(button('removePatch').disabled, true)
  removable = true
  await act(async () => button('patchRefresh').click())
  await act(async () => button('removePatch').click())
  fail = true
  await act(async () => button('confirmPatchRemove').click())
  assert.match(document.body.textContent, /source conflict/)
  fail = false
  await act(async () => button('confirmPatchRemove').click())
  assert.match(document.body.textContent, /维护已接受/)
  assert(button('patchRefresh').disabled)
  console.log('VAULT PATCH UI OK: separate status, fallback, conflict blocking, explicit confirmation, failure, accepted maintenance')
} finally { await act(async () => root.unmount()); dom.window.close() }
