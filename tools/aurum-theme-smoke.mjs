/**
 * Offline smoke test for the aurum-theme client half.
 *
 * Loads the module exactly as the browser loader would (a
 * `window.__ModuleLoader__.load` call), applies it against a fake Cordis
 * context with a minimal DOM, then renders the rail and the settings row with
 * representative projections. This catches syntax, shape, and wiring errors
 * that installation alone would hide.
 *
 * Run: node tools/aurum-theme-smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('../../node_modules/.pnpm', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:')
const reactEntry = `${ROOT}/react@18.3.1/node_modules/react/index.js`
const serverEntry = `${ROOT}/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/server.node.js`

const React = createRequire(import.meta.url)(reactEntry)
const { renderToStaticMarkup } = await import(pathToFileURL(serverEntry).href)

const source = readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8')

// --- minimal DOM -----------------------------------------------------------
const headChildren = []
const store = new Map()
const styleElement = { id: '', textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v }, remove() {} }
const bodyElement = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v }, removeAttribute(k) { delete this.attrs[k] } }
const documentStub = {
  body: bodyElement,
  head: { appendChild(node) { headChildren.push(node) }, removeChild() {} },
  getElementById() { return null },
  createElement() { return styleElement },
}
const localStorageStub = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, String(value)) },
}

// --- loader capture --------------------------------------------------------
let entry
const windowStub = { __ModuleLoader__: { load(mod) { entry = mod } }, localStorage: localStorageStub }
new Function('window', 'document', 'localStorage', source)(windowStub, documentStub, localStorageStub)
if (!entry || typeof entry.factory !== 'function') throw new Error('module did not register a factory')

const mod = entry.factory(name => {
  if (name === 'react') return React
  if (name === 'react-dom') return createRequire(import.meta.url)(`${ROOT}/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/index.js`)
  throw new Error(`unexpected require: ${name}`)
})
if (entry.id !== '@local/dsh-aurum-theme') throw new Error(`wrong module id: ${entry.id}`)
for (const service of ['slots', 'locale', 'theme']) {
  if (!Array.isArray(mod.inject) || !mod.inject.includes(service)) throw new Error(`missing ${service} injection`)
}

// --- fake context ----------------------------------------------------------
let overrides = null
let overrideDisposed = 0
const registrations = []
const disposers = []
const ctx = {
  effect(fn, label) {
    const dispose = fn()
    disposers.push({ label, dispose })
    return dispose
  },
  locale: {
    register() { return () => {} },
    bind() { return key => key },
  },
  theme: {
    overrideTokens(source, tokens) {
      overrides = { source, tokens }
      return () => { overrideDisposed += 1 }
    },
  },
  slots: {
    inject(key, callback) { disposers.push({ label: key, dispose: callback() }) },
    register(options, Component) {
      registrations.push({ options, Component })
      return () => {}
    },
  },
}

mod.apply(ctx)

if (overrides === null) throw new Error('overrideTokens was never called')
if (overrides.source !== '@local/dsh-aurum-theme') throw new Error(`wrong override source: ${overrides.source}`)
const names = Object.keys(overrides.tokens)
if (names.length < 110) throw new Error(`only ${names.length} tokens overridden`)
for (const name of names) {
  const value = overrides.tokens[name]
  if (!name.startsWith('--')) throw new Error(`token name does not look like a custom property: ${name}`)
  if (typeof value.light !== 'string' || value.light === '' || typeof value.dark !== 'string' || value.dark === '') {
    throw new Error(`token ${name} lacks a light/dark pair`)
  }
}
// Check actual palette values, including the brightest neutral reading surface.
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
let minimumContrast = Infinity
for (const mode of ['light', 'dark']) {
  for (const label of ['primary', 'primary-dimmed', 'secondary', 'tertiary', 'caption']) {
    for (const surface of ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-layer-3', '--dsw-specific-sidebar-fill', '--dsw-specific-sidebar-nav-item-active-accent']) {
      const foreground = luminance(overrides.tokens[`--dsw-alias-label-${label}`][mode])
      const background = luminance(overrides.tokens[surface][mode])
      const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
      minimumContrast = Math.min(minimumContrast, contrast)
      if (contrast < 4.5) throw new Error(`${mode} ${label} on ${surface}: contrast ${contrast.toFixed(2)} < 4.5`)
    }
  }
  const comment = luminance(overrides.tokens['--shiki-token-comment'][mode])
  const code = luminance(overrides.tokens['--dsw-alias-markdown-code-block'][mode])
  if ((Math.max(comment, code) + 0.05) / (Math.min(comment, code) + 0.05) < 4.5) throw new Error(`${mode} code comments lack contrast`)
}
console.log(`Minimum reading-token contrast: ${minimumContrast.toFixed(2)}:1`)

if (bodyElement.attrs['data-ds-aurum-theme'] === undefined) throw new Error('body marker missing')
if (!styleElement.textContent.includes('[data-composer-stat]')) throw new Error('stylesheet lacks the composer pill suppression')
if (!styleElement.textContent.includes('[data-turn-tail]')) throw new Error('stylesheet lacks the per-turn usage suppression')
// The rail fills the composer stack, which already carries the side clearance,
// and takes the card's own cap so both edges sit on one axis at 1440px.
if (!styleElement.textContent.includes('width: 100%;')) throw new Error('rail does not fill the composer stack')
if (!styleElement.textContent.includes('max-width: var(--dsh-composer-card-max-width')) throw new Error('rail width is not the composer card width')
if (styleElement.textContent.includes('animation: au-sheen')) throw new Error('rail still sweeps its background while live')

const row = registrations.find(item => item.options.name === 'plugins.tab')
const dock = registrations.find(item => item.options.name === 'conversation.input.dock')
if (registrations.some(item => !['aurum-theme', 'aurum-navigation'].includes(item.options.id))) throw new Error('slot ids drifted')
if (!registrations.some(item => item.options.id === 'aurum-navigation')) throw new Error('answer navigation was never registered')
if (!row) throw new Error('settings row was never registered')
if (!dock) throw new Error('rail was never registered')
if (row.options.order !== 50) throw new Error(`settings row order ${row.options.order}`)
if (dock.options.order !== 20) throw new Error(`rail order ${dock.options.order}`)

// --- render smoke ----------------------------------------------------------
const projections = {
  sessionStats: {
    turns: 3, steps: 9, llmMs: 245000, toolMs: 12000, ttftMs: 1700, ttftSteps: 8, decodeMs: 30000, decodeTokens: 150,
  },
  tokenUsage: {
    uncachedInputTokens: 240000, cacheReadTokens: 4300000, cacheWriteTokens: 0, outputTokens: 1370000,
  },
  contextPressure: { projectedTokens: 191000, pressureTokens: 188000, contextWindow: 1000000 },
}
const chatSnapshot = {
  legacy: {
    nodes: [{ kind: 'assistant', blocks: [{ kind: 'text', text: 'x'.repeat(4000) }] }],
    runningCalls: [],
    partial: { turn: 3, step: 9, blocks: [{ kind: 'text', text: 'y'.repeat(400) }] },
  },
}
const props = {
  t: key => key,
  useProjection: key => projections[key],
  useSession: selector => selector({ running: true }),
  useChat: selector => selector(chatSnapshot),
}
const html = renderToStaticMarkup(React.createElement(dock.Component, props))
if (!html.includes('au-strip')) throw new Error('rendered markup lacks the rail')
if (!html.includes('5.91M')) throw new Error('token total missing from the rail')
if (!html.includes('19%')) throw new Error(`context reading missing: ${html.slice(0, 300)}`)
if (!html.includes('--au-ratio')) throw new Error('rail does not publish its context ratio')
if (!html.includes('5.0')) throw new Error('session average speed missing from the rail')

// Stage labels follow live chat facts, with tool execution taking priority.
for (const [running, partial, calls, expected] of [
  [true, null, [], 'phaseWaiting'],
  [true, { blocks: [] }, [], 'phaseWaiting'],
  [true, { blocks: [{ kind: 'text', text: 'hello' }] }, [], 'phaseGenerating'],
  [true, { blocks: [{ kind: 'reasoning', text: 'thinking' }] }, [], 'phaseGenerating'],
  [true, { blocks: [{ kind: 'text', text: 'hello' }] }, [{ phase: 'start', name: 'search' }], 'phaseTools'],
  [true, null, [{ phase: 'start', name: 'search' }, { phase: 'start', name: 'read' }], 'phaseTools'],
  [false, { blocks: [{ kind: 'text', text: 'old' }] }, [{ phase: 'start', name: 'search' }], 'idle'],
]) {
  const markup = renderToStaticMarkup(React.createElement(dock.Component, {
    ...props,
    useSession: selector => selector({ running }),
    useChat: selector => selector({ legacy: { nodes: [], partial, runningCalls: calls } }),
  }))
  if (!markup.includes('data-aurum-phase="' + expected + '"')) throw new Error('stage mismatch: ' + expected)
  if (!markup.includes('role="status"')) throw new Error('stage has no accessible status')
}

const emptyHtml = renderToStaticMarkup(React.createElement(dock.Component, {
  ...props,
  useProjection: () => undefined,
  useSession: selector => selector({ running: false }),
  useChat: selector => selector({ legacy: { nodes: [], partial: null, runningCalls: [] } }),
}))
// A landing draft has no reading and no turn in flight: the rail stays out of
// the way until the first token or turn arrives.
if (emptyHtml !== '') throw new Error(`empty session still renders the rail: ${emptyHtml.slice(0, 120)}`)

const rowHtml = renderToStaticMarkup(React.createElement(row.Component, { t: key => key }))
if (!rowHtml.includes('role="switch"')) throw new Error('settings row lacks the switch')
if (!rowHtml.includes('aria-checked="true"')) throw new Error('switch does not start enabled')

// --- dispose contract ------------------------------------------------------
const palette = disposers.find(item => item.label === 'aurum-theme: palette layer')
if (!palette) throw new Error('palette effect missing')
palette.dispose()
if (overrideDisposed !== 1) throw new Error('layer was not disposed with the effect')
if (bodyElement.attrs['data-ds-aurum-theme'] !== undefined) throw new Error('body marker survived dispose')

console.log(JSON.stringify({
  moduleId: entry.id,
  inject: mod.inject,
  tokens: names.length,
  styleBytes: styleElement.textContent.length,
  slots: [...registrations.keys()],
  settingsOrder: row.options.order,
  railOrder: dock.options.order,
  railPreview: html.replace(/></g, '>\n<').slice(0, 260),
}, null, 2))
console.log('SMOKE OK')
