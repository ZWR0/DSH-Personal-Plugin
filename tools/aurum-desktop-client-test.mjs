import { harnessRequire as req } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { JSDOM } = req('jsdom')
const dom = new JSDOM('<div id="mount"></div>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = req('react'), { act } = React
const { createRoot } = req('react-dom/client')
const { Simulate } = req('react-dom/test-utils')
let module, Component, face, dictionaries
window.__ModuleLoader__ = { load(value) { module = value } }
new Function(readFileSync(new URL('../aurum-desktop/mcp/client.js', import.meta.url), 'utf8'))()
const plugin = module.factory(() => React)
let snapshot = { status: 'ready', writable: true, value: { toolPreset: 'full' } }
const listeners = new Set(), patches = []
const scope = {
  getSnapshot: () => snapshot,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  async mutate(ops) {
    patches.push(ops)
    snapshot = { ...snapshot, value: { ...snapshot.value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) } }
    for (const fn of listeners) fn()
    return true
  },
}
const t = key => dictionaries.zh[key] ?? key
plugin.apply({
  effect(fn) { fn() },
  locale: { register(_, value) { dictionaries = value; return () => {} }, bind: () => t },
  slots: { inject(_, fn) { fn() }, register(options, component) { Component = component; face = options.inject(); return () => {} } },
  inject(names, fn) { if (names[0] === 'configForms') fn({ configForms: { get: () => scope } }) },
})
const root = createRoot(document.getElementById('mount'))
const button = key => [...document.querySelectorAll('button')].find(el => el.textContent === t(key))
const change = async (element, value) => act(async () => Simulate.change(element, { target: { value } }))
try {
  await act(async () => root.render(React.createElement(Component, { ...face, t })))
  await act(async () => document.querySelector('[value="custom"]').click())
  assert.equal(document.querySelectorAll('[data-wincu-tool]').length, 26)
  const search = document.querySelector('input[type="search"]')
  await change(search, ' WINDOWS_COMPUTER_USE_SCREENSHOT ')
  assert.equal(document.querySelectorAll('[data-wincu-tool]').length, 1)
  assert.equal(document.querySelector('[data-wincu-tool]').dataset.wincuTool, 'screenshot')
  // A filtered group changes only its matches; hidden selections survive saving.
  await act(async () => document.querySelector('.wcu-tool-group-label input').click())
  await act(async () => button('save').click())
  assert.equal(snapshot.value.enabledTools.length, 25)
  assert(!snapshot.value.enabledTools.includes('screenshot'))
  assert(snapshot.value.enabledTools.includes('ocr'))
  await change(search, '不存在的工具')
  assert.equal(document.querySelectorAll('[data-wincu-tool]').length, 0)
  assert(document.body.textContent.includes(t('noToolMatches')))
  await act(async () => button('clearSearch').click())
  assert.equal(document.querySelectorAll('[data-wincu-tool]').length, 26)
  assert(!document.querySelector('[data-wincu-tool="screenshot"]').checked)
  await change(search, '识别')
  assert.equal(document.querySelectorAll('[data-wincu-tool]').length, 1)
  await act(async () => button('noTools').click())
  await act(async () => button('save').click())
  assert.deepEqual(snapshot.value.enabledTools, [])
  const text = document.querySelector('[id$="-indicatorText"]')
  await change(text, '')
  const savedCount = patches.length
  await act(async () => button('save').click())
  assert.equal(patches.length, savedCount)
  assert(document.body.textContent.includes(t('invalid')))
  await change(text, '桌面任务执行中')
  await act(async () => button('save').click())
  assert.equal(snapshot.value.indicatorText, '桌面任务执行中')
  await change(text, '尚未保存')
  await act(async () => button('discard').click())
  assert.equal(text.value, '桌面任务执行中')
  await act(async()=>document.querySelector('[id$="-browserReuseExisting"]').click())
  await act(async()=>button('save').click())
  assert.equal(snapshot.value.browserReuseExisting,true)
  assert(document.querySelector('[id$="-browserSignIn"]').disabled)
  assert(document.querySelector('[id$="-browserVisible"]').disabled)
  console.log('PASS: tool search, filtered group selection, global disable, banner validation, save and discard')
} finally {
  await act(async () => root.unmount())
  dom.window.close()
}
