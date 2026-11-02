// Client-half test for 掌上行舟: real-state grouping, takeover navigation,
// guarded stop semantics, offline banner, layout switching, disable handling
// and teardown. No network, no credentials, no real sessions.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const req = createRequire(new URL('../../package.json', import.meta.url))
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<div id="mount"></div>', { pretendToBeVisual: true, url: 'https://dsh.test/' })
for (const key of ['window', 'document', 'navigator']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = req('./node_modules/.pnpm/react@18.3.1/node_modules/react/index.js')
const { createRoot } = req('./node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js')

// ---------------------------------------------------------------- harness state

const listeners = { list: new Set(), status: new Set(), connection: new Set() }
let catalog = { ids: [], byId: {}, phase: 'ready' }
let statusMap = new Map()
let connectionState = 'connected'
let cancelled = []
let opened = []
let started = 0
let reconnected = 0
let panelSelections = []
let rpcCalls = []
let refreshCount = 0
let stopGate = null
let refreshImpl = async () => {}
const registrations = new Map()
const cleanups = new Map()
const eventHandlers = new Map()

const emit = (set, value) => { set.forEach(fn => fn(value)) }
const catalogRow = (id, extra = {}) => ({
  id,
  displayTitle: `会话 ${id}`,
  running: false,
  blank: false,
  updatedAt: Date.now() - 60_000,
  retainedBy: {},
  ...extra,
})

function buildCatalog() {
  const rows = [
    catalogRow('wait', { running: true, displayTitle: '等待提问的会话', cwd: 'D:/work/alpha' }),
    catalogRow('run', { running: true, displayTitle: '正在跑的会话' }),
    catalogRow('idle-1', { displayTitle: '空闲一' }),
    catalogRow('idle-2', { displayTitle: '空闲二' }),
    catalogRow('sub', { origin: 'subagent', displayTitle: '子代理' }),
    catalogRow('blank', { blank: true, displayTitle: '空白会话' }),
  ]
  return { ids: rows.map(row => row.id), byId: Object.fromEntries(rows.map(row => [row.id, row])), phase: 'ready' }
}
catalog = buildCatalog()
statusMap = new Map([
  ['wait', { running: true, pendingInteraction: { key: 'q1', kind: 'question', sessionId: 'wait' }, completionUnread: false }],
  ['run', { running: true, pendingInteraction: undefined, completionUnread: false }],
  ['idle-1', { running: false, pendingInteraction: undefined, completionUnread: true }],
])

const ctx = {
  effect(fn, label) {
    const result = fn()
    if (typeof result === 'function') cleanups.set(label, result)
    return () => { if (typeof result === 'function') result() }
  },
  on(event, handler) {
    eventHandlers.set(event, handler)
    return () => eventHandlers.delete(event)
  },
  locale: {
    register() { return () => {} },
    // Bound translate with the zh dictionary the plugin registered.
    bind() {
      const dict = dictionaries.mobileDeck.zh
      return (key, values = {}) => String(dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => (values[name] === undefined ? '' : String(values[name])))
    },
  },
  slots: {
    inject(name, create) {
      const dispose = create()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    register(options, component) {
      registrations.set(`${options.name}:${options.key ?? options.id}`, { options, component })
      return () => registrations.delete(`${options.name}:${options.key ?? options.id}`)
    },
  },
  sessions: {
    list: { getSnapshot: () => catalog, subscribe(fn) { listeners.list.add(fn); return () => listeners.list.delete(fn) } },
    async refresh() {
      refreshCount += 1
      await refreshImpl()
      emit(listeners.list)
    },
    binding() { return undefined },
    retain(id) {
      return {
        ready: Promise.resolve(),
        binding: { session: { cancel: async () => { cancelled.push(id); if (stopGate) await stopGate.promise; return { ok: true, value: { accepted: true } } } } },
        release() {},
      }
    },
  },
  uiSession: {
    sessionStatus: { getSnapshot: () => statusMap, subscribe(fn) { listeners.status.add(fn); return () => listeners.status.delete(fn) } },
  },
  connection: {
    state: { getSnapshot: () => connectionState, subscribe(fn) { listeners.connection.add(fn); return () => listeners.connection.delete(fn) } },
    generation: { getSnapshot: () => ({ id: 1, host: { name: 'host' } }), subscribe: () => () => {} },
    reconnect() { reconnected += 1 },
    rpc: {
      async call(channel, method, payload) {
        assert.equal(channel, '/api')
        assert.equal(method, 'mobile-deck/settings')
        rpcCalls.push(payload)
        if (payload.action === 'get') return { ok: true, value: { enabled: true, layout: 'auto', idleLimit: 1 } }
        if (payload.action === 'save') {
          const next = { enabled: true, layout: 'auto', idleLimit: 1, ...payload.settings }
          return { ok: true, value: next }
        }
        return { ok: false, error: { code: 'mobile-deck/settings-failed', message: '未知操作' } }
      },
    },
  },
  uiWorkspace: {
    openSession(id) { opened.push(id) },
    startSession() { started += 1 },
  },
  layout: { selectPanel(id) { panelSelections.push(id) } },
}

// ---------------------------------------------------------------- load module

let module
const dictionaries = {}
window.__ModuleLoader__ = { load(value) { module = value } }
new Function(readFileSync(new URL('../mobile-deck/client.js', import.meta.url), 'utf8'))()
const api = module.factory(name => (name === 'react' ? React : undefined))
assert.deepEqual(api.inject, ['slots', 'locale', 'connection', 'sessions', 'uiSession', 'uiWorkspace', 'layout'])

// Capture the dictionaries the plugin registers so `bind` can translate.
const originalRegister = ctx.locale.register
ctx.locale.register = (ns, dicts) => { dictionaries[ns] = dicts; return originalRegister(ns, dicts) }

const flush = async () => { await React.act(async () => { await Promise.resolve() }) }
await React.act(async () => { api.apply(ctx); await Promise.resolve() })
await flush()

assert.ok(registrations.has('plugins.tab:mobile-deck'), 'the settings page is registered')
assert.ok(registrations.has('main:mobile-deck'), 'the workbench panel is registered')
assert.equal(registrations.has('sidebar.panellist:mobile-deck'), false, 'no separate sidebar entry')
assert.equal(registrations.get('main:mobile-deck').options.key, 'mobile-deck')
assert.deepEqual(registrations.get('plugins.tab:mobile-deck').options.label(), '掌上行舟')

// ---------------------------------------------------------------- workbench UI

const root = createRoot(document.getElementById('mount'))
const Workbench = registrations.get('main:mobile-deck').component
await React.act(async () => root.render(React.createElement(Workbench)))

const titles = () => [...document.querySelectorAll('.mdk-grouptitle')].map(node => node.textContent)
const rows = () => [...document.querySelectorAll('.mdk-rowtitle')].map(node => node.textContent)

assert.deepEqual(titles(), ['等待我回答', '正在运行', '最近会话'])
assert.deepEqual(rows(), ['等待提问的会话', '正在跑的会话', '空闲一'], 'waiting first, subagent and blank excluded, idle limited to 1')
assert.ok(!document.body.textContent.includes('子代理'))
const chips = [...document.querySelectorAll('.mdk-chip')].map(node => node.dataset.state)
assert.deepEqual(chips.slice(0, 3), ['waiting', 'running', 'idle'])
assert.ok(!document.querySelector('.mdk-guide'), 'usage guide removed')

// Wide layouts select a detail first; Open explicitly enters the conversation.
await React.act(async () => document.querySelectorAll('.mdk-row')[0].click())
assert.deepEqual(opened, [], 'wide row selection stays on the workbench')
assert.match(document.querySelector('.mdk-detail').textContent, /等待提问的会话/)
// Opening uses the native conversation.
await React.act(async () => document.querySelector('.mdk-rowacts .mdk-btn').click())
assert.deepEqual(opened, ['wait'])
assert.deepEqual(panelSelections, ['conversation'])

// Search covers the full catalog before applying the recent-session limit.
const search = document.querySelector('.mdk-search')
async function searchFor(value) {
  await React.act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(search, value)
    search.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}
await searchFor('空闲二')
assert.deepEqual(rows(), ['空闲二'], 'search reaches recent sessions outside the initial limit')
await searchFor('ALPHA')
assert.deepEqual(rows(), ['等待提问的会话'], 'working-directory search ignores case')
await searchFor('no-such-session')
assert.match(document.querySelector('.mdk-emptytitle').textContent, /没有匹配/)
await searchFor('')
assert.equal(rows().length, 3)
assert.equal(document.querySelector('.mdk-guide'), null)

// New session entry.
const newButton = [...document.querySelectorAll('.mdk-btn')].find(node => node.textContent === '新建会话')
await React.act(async () => newButton.click())
assert.equal(started, 1)
assert.equal(panelSelections.at(-1), 'conversation')

// ---------------------------------------------------------------- stop semantics

stopGate = (() => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } })()
const runRow = [...document.querySelectorAll('.mdk-rowwrap')].find(node => node.textContent.includes('正在跑的会话'))
const stopButton = () => [...runRow.querySelectorAll('.mdk-btn')].find(node => node.dataset.variant === 'danger')
await React.act(async () => stopButton().click())
assert.deepEqual(cancelled, ['run'], 'one click requests a stop from the Host')
assert.ok(stopButton().disabled, 'a second request is blocked while the first is pending')
await React.act(async () => stopButton().click())
assert.deepEqual(cancelled, ['run'], 'double click cannot send a second stop')
assert.match(runRow.querySelector('.mdk-stopnote').textContent, /请求停止中/)

refreshImpl = async () => {
  catalog = { ...catalog, byId: { ...catalog.byId, run: { ...catalog.byId.run, running: false } } }
  statusMap = new Map(statusMap)
  statusMap.set('run', { running: false, pendingInteraction: undefined, completionUnread: true })
  emit(listeners.status)
}
await React.act(async () => stopGate.resolve())
await flush()

const afterStop = [...document.querySelectorAll('.mdk-rowwrap')].find(node => node.textContent.includes('正在跑的会话'))
assert.match(afterStop.querySelector('.mdk-stopnote').textContent, /已停止/, 'the Host row confirms the stop')
assert.equal([...afterStop.querySelectorAll('.mdk-btn')].some(node => node.dataset.variant === 'danger'), false, 'the stop action disappears once the row is idle')
assert.ok(refreshCount >= 1, 'the list is resynced after a stop')

// ---------------------------------------------------------------- connection

connectionState = 'disconnected'
await React.act(async () => emit(listeners.connection))
assert.match(document.querySelector('.mdk-banner').textContent, /可能已过期/)
const retry = [...document.querySelectorAll('.mdk-banner .mdk-btn')].find(node => node.textContent === '重新连接')
await React.act(async () => retry.click())
assert.equal(reconnected, 1)

connectionState = 'connected'
await React.act(async () => emit(listeners.connection))
assert.equal(document.querySelector('.mdk-banner'), null)

// A phone viewport opens a row directly instead of selecting a hidden detail.
await React.act(async () => root.render(null))
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
await React.act(async () => root.render(React.createElement(Workbench)))
assert.equal(document.querySelector('.mdk-root').dataset.layout, 'phone')
assert.equal(document.querySelector('.mdk-detail'), null)
const beforePhoneOpen = opened.length
await React.act(async () => document.querySelector('.mdk-row').click())
assert.equal(opened.length, beforePhoneOpen + 1)
assert.equal(opened.at(-1), 'wait')

// Filters and activity distinguish approval from questions, deduplicate snapshots.
const filterButton = text => [...document.querySelectorAll('.mdk-filters button')].find(el => el.textContent.startsWith(text))
await React.act(async () => filterButton('待处理').click())
assert.deepEqual(rows(), ['等待提问的会话'])
await React.act(async () => filterButton('未查看').click())
assert.ok(!rows().includes('等待提问的会话'))
await React.act(async () => filterButton('全部').click())
await React.act(async () => document.querySelector('.mdk-sound input[role=switch]').click())
assert.match(document.querySelector('.mdk-sound [role=alert]').textContent, /无法启用提示音/, 'unsupported audio gives an actionable state')
// Real control flow: activation immediately plays a sample and state changes play once.
const tones = [], gains = []
let fakeAudio
window.AudioContext = class {
  constructor() { fakeAudio = this; this.state = 'suspended'; this.currentTime = 0; this.destination = {} }
  async resume() { this.state = 'running'; if (this.onstatechange) this.onstatechange() }
  createOscillator() {
    const tone = { frequency: {}, connect() {}, disconnect() {}, starts: 0, stops: 0, start() { this.starts++ }, stop() { this.stops++ } }
    tones.push(tone); return tone
  }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime(value) { gains.push(value) }, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
  async close() { this.state = 'closed' }
}
await React.act(async () => [...document.querySelectorAll('.mdk-sound button')].find(el => el.textContent === '试听').click())
assert.equal(tones.length, 2, 'activation gives an audible two-note sample immediately')
assert.match(document.querySelector('.mdk-soundstatus').textContent, /已激活/)
assert.equal(JSON.parse(window.localStorage.getItem('dsh.mobile-deck.sound.v1')).enabled, true)
const beforeEvents = document.querySelectorAll('.mdk-event').length
statusMap = new Map(statusMap).set('wait', { running: true, pendingInteraction: { key: 'approval-2', kind: 'approval', sessionId: 'wait' }, completionUnread: false })
await React.act(async () => emit(listeners.status))
assert.match(document.querySelector('.mdk-chip').textContent, /需要授权/)
assert.equal(document.querySelectorAll('.mdk-event').length, beforeEvents + 1)
await React.act(async () => { emit(listeners.status); emit(listeners.list) })
assert.equal(document.querySelectorAll('.mdk-event').length, beforeEvents + 1, 'same pending request is not repeated')
assert.match(document.querySelector('.mdk-activity').textContent, /需要授权/)
assert.equal(tones.length, 4, 'one new authorization produces one chime, duplicate snapshots stay silent')
fakeAudio.state = 'suspended'
await React.act(async () => fakeAudio.onstatechange())
assert.match(document.querySelector('.mdk-soundstatus').textContent, /等待点击激活/)
await React.act(async () => document.querySelector('.mdk-sound input[role=switch]').click())
assert.match(document.querySelector('.mdk-soundstatus').textContent, /已静音/)
assert.ok(tones.every(tone => tone.stops >= 2), 'muting stops any scheduled tones')
assert.equal(JSON.parse(window.localStorage.getItem('dsh.mobile-deck.sound.v1')).enabled, false)
// A late browser resume must not override a user's immediate mute.
let resumePending
const normalResume = fakeAudio.resume.bind(fakeAudio)
fakeAudio.resume = () => new Promise(resolve => { resumePending = () => { fakeAudio.state = 'running'; resolve() } })
const beforeLateResume = tones.length
await React.act(async () => document.querySelector('.mdk-sound input[role=switch]').click())
assert.match(document.querySelector('.mdk-soundstatus').textContent, /正在激活/)
await React.act(async () => document.querySelector('.mdk-sound input[role=switch]').click())
await React.act(async () => resumePending())
assert.match(document.querySelector('.mdk-soundstatus').textContent, /已静音/)
assert.equal(tones.length, beforeLateResume)
fakeAudio.resume = normalResume



// Unsupported hosts show an error instead of pretending a preview opened.
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '文件').click())
assert.match(document.querySelector('.mdk-banner').textContent, /当前宿主未提供文件面板/)

// Native file navigation waits for the requested session and uses the public tab API.
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
const fileListeners = new Set(), fileTabs = []
let fileSession = 'some-other-session'
ctx.sidebarRight = {
  mounted: { getSnapshot: () => fileSession, subscribe(fn) { fileListeners.add(fn); return () => fileListeners.delete(fn) } },
  openTab(kind) { fileTabs.push({ kind, session: fileSession }) },
}
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '文件').click())
assert.equal(fileTabs.length, 0)
fileSession = 'wait'
await React.act(async () => {
  emit(fileListeners)
  await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
})
assert.deepEqual(fileTabs, [{ kind: 'files', session: 'wait' }])
assert.equal(fileListeners.size, 0, 'native file navigation releases its subscription')

// Composer shortcut works without opening the sidebar and shows an attention badge.
const ComposerEntry = registrations.get('conversation.input.left:mobile-deck').component
await React.act(async () => root.render(React.createElement(ComposerEntry)))
assert.ok(document.querySelector('.mdk-launchbadge'))
await React.act(async () => document.querySelector('.mdk-launch').click())
assert.equal(panelSelections.at(-1), 'mobile-deck')

// Results load only on demand from durable file/changes records, never assistant prose.
await React.act(async () => root.render(React.createElement(Workbench)))
const originalRetain = ctx.sessions.retain
let resultListeners = new Set(), resultReleased = 0, olderLoads = 0
let resultWindow = { hasMore: true, entries: [
  { type: 'event', event: { type: 'assistant/message', seq: 1, data: { text: 'created imaginary.txt' } } },
  { type: 'event', event: { type: 'deliverables/presented', seq: 2, data: { turn: 1, callId: 'p1', files: [{ path: 'D:/work/report #1?.md', description: '交付报告' }, { path: '' }] } } },
  { type: 'event', event: { type: 'workspace/changes', seq: 3, data: { turn: 1 } } },
] }
ctx.sessions.retain = () => ({ ready: Promise.resolve(), binding: {
  eventSource: { getSnapshot: () => resultWindow, subscribe(fn) { resultListeners.add(fn); return () => resultListeners.delete(fn) } },
  session: { async loadOlder() { olderLoads++; resultWindow = { ...resultWindow, hasMore: false }; emit(resultListeners) } },
}, release() { resultReleased++ } })
const originalFetch = globalThis.fetch
const summaryCalls = []
globalThis.fetch = async (url, options) => {
  summaryCalls.push({ url: String(url), options })
  return { ok: true, json: async () => ({ turn: 1, files: [
    { path: 'D:/work/report #1?.md', display: 'report #1?.md', added: 3, deleted: 1 },
    { path: 'D:/work/code.js', display: 'code.js', added: 5, deleted: 0 },
  ] }) }
}
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '成果').click())
await flush()
assert.equal(document.querySelectorAll('.mdk-result').length, 2, 'paths deduplicate across presented and changes')
assert.ok(!document.querySelector('.mdk-results').textContent.includes('imaginary.txt'), 'prose is not a file source')
assert.equal(summaryCalls.length, 1)
assert.equal(summaryCalls[0].options.credentials, 'same-origin')
assert.ok(summaryCalls[0].url.includes('sessionId=wait'))
assert.match(document.querySelector('.mdk-results').textContent, /交付报告/)
const nativeResources = []
ctx.sidebarRight.openResource = (address, options) => nativeResources.push({ address, options })
await React.act(async () => [...document.querySelectorAll('.mdk-result button')].find(el => el.textContent === '预览').click())
await React.act(async () => { await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
assert.match(nativeResources.at(-1).address, /file\/session\/wait\/D:\/work\/report%20%231%3F.md$/)
await React.act(async () => [...document.querySelectorAll('.mdk-result button')].find(el => el.textContent === '变更对比').click())
await React.act(async () => { await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))) })
assert.equal(nativeResources.at(-1).address, 'dsh-resource://changes-review/session/wait/3/1')
assert.deepEqual(nativeResources.at(-1).options, { params: { index: 0 } })
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '加载更早记录').click())
await flush()
assert.equal(olderLoads, 1)
assert.equal(summaryCalls.length, 1, 'stable summaries are cached for this result view')
assert.equal([...document.querySelectorAll('.mdk-results button')].some(el => el.textContent === '加载更早记录'), false)
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '收起成果').click())
assert.equal(resultListeners.size, 0)
assert.equal(resultReleased, 1, 'closing results releases the session reference')

// A missing summary preserves presented files with a partial-result message.
globalThis.fetch = async () => ({ ok: false, status: 403 })
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '成果').click())
await flush()
assert.equal(document.querySelectorAll('.mdk-result').length, 1)
assert.match(document.querySelector('.mdk-results').textContent, /1 条变更摘要无法读取/)
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '收起成果').click())
// More than 20 recorded batches stay bounded initially and expand without rereading history.
resultWindow = { hasMore: false, entries: Array.from({ length: 25 }, (_, index) => ({ type: 'event', event: {
  type: 'deliverables/presented', seq: index + 1, data: { turn: index + 1, callId: 'p' + index, files: [{ path: 'out/' + index + '.md' }] },
} })) }
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '成果').click())
await flush()
assert.equal(document.querySelectorAll('.mdk-result').length, 20)
const beforeOlder = olderLoads
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '加载更早记录').click())
await flush()
assert.equal(document.querySelectorAll('.mdk-result').length, 25)
assert.equal(olderLoads, beforeOlder, 'already loaded records do not request another history page')
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '收起成果').click())

// Closing results aborts in-flight summary requests and releases the borrowed session.
resultWindow = { hasMore: false, entries: [{ type: 'event', event: { type: 'workspace/changes', seq: 99, data: { turn: 2 } } }] }
let resolvePendingSummary, pendingSummarySignal
const beforeRelease = resultReleased
globalThis.fetch = async (_, options) => {
  pendingSummarySignal = options.signal
  return await new Promise(resolve => { resolvePendingSummary = resolve })
}
await React.act(async () => [...document.querySelectorAll('.mdk-rowacts button')].find(el => el.textContent === '成果').click())
await flush()
assert.ok(pendingSummarySignal)
await React.act(async () => [...document.querySelectorAll('.mdk-results button')].find(el => el.textContent === '收起成果').click())
assert.equal(pendingSummarySignal.aborted, true)
assert.equal(resultReleased, beforeRelease + 1)
await React.act(async () => resolvePendingSummary({ ok: false, status: 404 }))
assert.equal(document.querySelector('.mdk-results'), null)
ctx.sessions.retain = originalRetain
globalThis.fetch = originalFetch

// Followed sessions are pinned within urgency groups and can be filtered.
await React.act(async () => document.querySelector('.mdk-follow').click())
assert.equal(JSON.parse(window.localStorage.getItem('dsh.mobile-deck.alert-rules.v1')).followed[0], 'wait')
await React.act(async () => filterButton('关注').click())
assert.deepEqual(rows(), ['等待提问的会话'])
await React.act(async () => filterButton('全部').click())
const originalStatuses = statusMap
const RulePage = registrations.get('plugins.tab:mobile-deck').component
await React.act(async () => root.render(React.createElement(RulePage)))
const rule = name => document.querySelector('input[aria-label="' + name + '"]')
await React.act(async () => { rule('提问 / 审阅').click(); rule('任务结束').click(); rule('仅关注').click() })
const savedRules = JSON.parse(window.localStorage.getItem('dsh.mobile-deck.alert-rules.v1'))
assert.deepEqual({question:savedRules.question,approval:savedRules.approval,ended:savedRules.ended,onlyFollowed:savedRules.onlyFollowed}, {question:false,approval:true,ended:false,onlyFollowed:true})
await React.act(async () => document.querySelector('.mdk-sound input[role=switch]').click())
const beforeRuleTones = tones.length
await React.act(async () => root.render(React.createElement(Workbench)))
statusMap = new Map(statusMap).set('wait', { running: true, pendingInteraction: { key: 'rule-approval', kind: 'approval', toolName: 'bash', reason: '需要执行构建', sessionId: 'wait' }, completionUnread: false })
await React.act(async () => emit(listeners.status))
assert.equal(tones.length, beforeRuleTones + 2, 'followed approval is audible')
assert.match(document.querySelector('.mdk-pending').textContent, /bash · 需要执行构建/)
statusMap = new Map(statusMap).set('idle-1', { running:false, pendingInteraction: { key:'unfollowed-approval', kind:'approval', sessionId:'idle-1' }, completionUnread:false })
await React.act(async () => emit(listeners.status))
assert.equal(tones.length, beforeRuleTones + 2, 'unfollowed requests remain visible but silent')
statusMap = new Map(statusMap).set('wait', { running:true, pendingInteraction:{key:'plan-review-new',kind:'plan-review',sessionId:'wait',questions:[{question:'请审阅部署计划'}]},completionUnread:false })
await React.act(async () => emit(listeners.status))
assert.equal(tones.length, beforeRuleTones + 2, 'disabled review category is silent')
assert.match(document.querySelector('.mdk-pending').textContent, /请审阅部署计划/)
await React.act(async () => filterButton('待处理').click())
assert.equal(document.querySelector('.mdk-grouptitle').textContent, '待处理中心')
assert.equal(document.querySelectorAll('.mdk-rowwrap').length, 2, 'silent requests are never hidden')
await React.act(async () => root.render(React.createElement(RulePage)))
await React.act(async () => { rule('提问 / 审阅').click(); rule('任务结束').click(); rule('仅关注').click(); document.querySelector('.mdk-sound input[role=switch]').click() })
statusMap = originalStatuses

// ---------------------------------------------------------------- settings page

const SettingsPage = registrations.get('plugins.tab:mobile-deck').component
await React.act(async () => root.render(React.createElement(SettingsPage)))
const volumeSlider = document.querySelector('input[aria-label="提示音音量"]')
await React.act(async () => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(volumeSlider, '40')
  volumeSlider.dispatchEvent(new window.Event('input', { bubbles: true }))
})
assert.equal(JSON.parse(window.localStorage.getItem('dsh.mobile-deck.sound.v1')).volume, .4)
const homeToggle = document.querySelector('input[aria-label="手机默认打开掌上行舟"]')
await React.act(async () => homeToggle.click())
assert.equal(window.localStorage.getItem('dsh.mobile-deck.mobile-home.v1'), 'true')
const padChoice = [...document.querySelectorAll('.mdk-choice')].find(node => node.textContent === '平板分栏')
await React.act(async () => padChoice.click())
await flush()
assert.deepEqual(rpcCalls.at(-1), { action: 'save', settings: { layout: 'pad' } })
assert.ok(document.body.textContent.includes('已保存'))

const toggle = document.querySelector('input[aria-label="启用移动工作台"]')
await React.act(async () => toggle.click())
await flush()
assert.deepEqual(rpcCalls.at(-1), { action: 'save', settings: { enabled: false } })
assert.equal(registrations.has('main:mobile-deck'), false, 'disabling removes the sidebar entry and the panel')
assert.equal(registrations.has('sidebar.panellist:mobile-deck'), false)
assert.ok(registrations.has('plugins.tab:mobile-deck'), 'the settings page survives so it can be re-enabled')

await React.act(async () => toggle.click())
await flush()
assert.ok(registrations.has('main:mobile-deck'), 're-enabling restores the panel')
await React.act(async () => toggle.click())
await flush()
await React.act(async () => root.render(React.createElement(ComposerEntry)))
assert.equal(document.querySelector('.mdk-launch'), null, 'disabled workbench hides the composer shortcut')

// ---------------------------------------------------------------- teardown

const beforeFocusRefreshes = refreshCount
for (const [label, dispose] of cleanups) {
  if (!label.startsWith('mobile-deck:')) continue
  await React.act(async () => { dispose() })
}
await React.act(async () => { window.dispatchEvent(new window.Event('focus')); await Promise.resolve() })
assert.equal(refreshCount, beforeFocusRefreshes, 'teardown removes the foreground listeners')
assert.equal(registrations.has('main:mobile-deck'), false, 'teardown releases the panel')
assert.equal(registrations.has('sidebar.panellist:mobile-deck'), false)

await React.act(async () => root.unmount())
console.log('MOBILE DECK CLIENT OK: grouping/search/filters, task activity deduplication, audio fallback, composer badge/navigation, native files/results lifecycle and pagination, device preference, stop, offline state, enable switching and teardown')
