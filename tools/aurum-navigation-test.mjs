import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire('D:/deepseek-harness/package.json')
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body><main id="session"><div id="frame"><div><nav><div><button data-index="0" aria-current="true">one</button><button data-index="1">two</button></div></nav></div><div><div id="port"><div data-chat-flow><div data-chat-flow-kind="assistant-step" data-chat-turn="0"><h1>Overview</h1><p>Answer</p><h2>Evidence</h2><h3>Details</h3><div data-turn-process-inline="true"><h2>Hidden reasoning</h2></div></div></div></div></div></div><div id="dock"></div></main></body></html>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'MutationObserver', 'HTMLElement', 'Node']) globalThis[key] = dom.window[key]
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.matchMedia = () => ({ matches: true })
window.HTMLElement.prototype.getClientRects = function () { return [this.getBoundingClientRect()] }
const React = req('./node_modules/.pnpm/react@18.3.1/node_modules/react/index.js')
const ReactDOM = req('./node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/index.js')
const { createRoot } = req('./node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js')
const { act } = React
let entry
window.__ModuleLoader__ = { load(value) { entry = value } }
new Function(readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8'))()
const mod = entry.factory(name => name === 'react' ? React : name === 'react-dom' ? ReactDOM : assert.fail(name))
const components = new Map()
const cleanup = []
mod.apply({
  locale: { register: () => () => {}, bind: () => key => key },
  effect(fn) { cleanup.push(fn()) },
  theme: { overrideTokens: () => () => {} },
  slots: { inject(_, fn) { fn() }, register(options, Component) { components.set(options.id, Component); return () => {} } },
})
const Nav = components.get('aurum-navigation')
const Settings = components.get('aurum-theme') // Last registration is the settings row.
let loaded = [{ turn: 0, anchorKey: 'a', prompt: 'Question <script>', response: 'First answer excerpt' }]
let outline = [{ turn: 0, seq: 0, prompt: 'fallback', response: 'fallback' }, { turn: 1, seq: 10, prompt: 'Old question', response: 'Unloaded answer' }]
const props = () => ({ sessionId: 'one', t: key => key, useChat: selector => selector({ navigation: { items: () => loaded } }), useProjection: () => outline })
const mount = createRoot(document.getElementById('dock'))
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 45)) }) }
await act(async () => mount.render(React.createElement(Nav, props())))
await settle()
const nav = document.querySelector('nav')
const panel = () => nav.querySelector('.au-nav-panel')
assert(panel())
assert(panel().hidden)
await act(async () => nav.dispatchEvent(new window.Event('pointerenter')))
assert(!panel().hidden)
assert.match(panel().textContent, /First answer excerpt/)
assert.equal(panel().querySelectorAll('.au-nav-heading').length, 3)
assert.equal(panel().querySelector('.au-nav-prompt').textContent, 'Question <script>')
assert.equal(panel().querySelectorAll('script').length, 0)
assert.equal(panel().querySelector('[data-level="3"]').textContent, 'Details')
// Heading navigation must invoke the native owner before scrolling.
let order = []
nav.querySelector('[data-index="0"]').addEventListener('click', () => order.push('native'))
document.getElementById('port').scrollTo = value => { order.push('heading'); assert.equal(value.behavior, 'auto') }
await act(async () => { panel().querySelectorAll('.au-nav-heading')[1].focus(); panel().querySelectorAll('.au-nav-heading')[1].click() })
assert.deepEqual(order, ['native', 'heading'])
assert(document.activeElement.classList.contains('au-nav-heading'))
assert(!panel().hidden)
await act(async () => panel().querySelectorAll('.au-nav-heading')[2].click())
assert(!panel().hidden)
assert.deepEqual(order, ['native', 'heading', 'native', 'heading'])
// Moving across marks adopts the matching unloaded outline entry.
await act(async () => nav.querySelector('[data-index="1"]').dispatchEvent(new window.Event('pointermove', { bubbles: true })))
await settle()
assert.match(panel().textContent, /Unloaded answer/)
assert.match(panel().textContent, /navUnloaded/)
assert.equal(panel().querySelectorAll('.au-nav-heading').length, 0)
// No pin control: pointer departure closes; Escape keeps rail keyboard access.
assert.equal(nav.querySelector('.au-nav-pin'), null)
await act(async () => nav.dispatchEvent(new window.Event('pointerleave')))
await settle()
assert(panel().hidden)
await act(async () => nav.querySelector('[data-index="0"]').focus())
await settle()
assert(!panel().hidden)
await act(async () => nav.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
assert(panel().hidden)
assert(document.activeElement.matches('button[data-index]'))
// Streaming preview and headings update without replacing the focused control.
await act(async () => nav.dispatchEvent(new window.Event('pointerenter')))
const directoryButton = panel().querySelector('.au-nav-heading')
loaded = [{ ...loaded[0], response: 'Updated streaming answer' }]
await act(async () => mount.render(React.createElement(Nav, props())))
await settle()
assert.match(panel().textContent, /Updated streaming answer/)
assert.equal(directoryButton, panel().querySelector('.au-nav-heading'))
await act(async () => {
  const heading = document.createElement('h2'); heading.textContent = 'New streamed section'
  document.querySelector('[data-chat-flow-kind]').appendChild(heading)
})
await settle()
assert.equal(panel().querySelectorAll('.au-nav-heading').length, 4)
// Session rebinding resets open state and stale text.
loaded = [{ turn: 7, anchorKey: 'b', prompt: 'New session', response: 'New answer' }]
outline = []
await act(async () => mount.render(React.createElement(Nav, { ...props(), sessionId: 'two' })))
await settle()
assert(panel().hidden)
assert.match(panel().textContent, /New answer/)
assert.doesNotMatch(panel().textContent, /Updated streaming answer/)
// Disabling the theme removes both the portal and its native marker.
const settingContainer = document.createElement('div'); document.body.appendChild(settingContainer)
const settingsRoot = createRoot(settingContainer)
await act(async () => settingsRoot.render(React.createElement(Settings, { t: key => key })))
await act(async () => settingContainer.querySelector('[role="switch"]').click())
assert.equal(panel(), null)
assert(!nav.hasAttribute('data-aurum-navigation'))
await act(async () => settingContainer.querySelector('[role="switch"]').click())
await settle()
assert(panel())
await act(async () => { mount.unmount(); settingsRoot.unmount() })
assert(!nav.hasAttribute('data-aurum-navigation'))
assert.equal(nav.querySelector('.au-nav-pin'), null)
for (const dispose of cleanup) if (typeof dispose === 'function') dispose()
dom.window.close()
console.log('NAVIGATION OK: summaries, headings, native jump, streaming, keyboard, hover dismissal, repeated jumps, session switch, toggle, cleanup')
