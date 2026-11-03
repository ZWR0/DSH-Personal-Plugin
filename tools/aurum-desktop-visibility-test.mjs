import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { harnessRequire } from './test-environment.mjs'
import { browserRoutingInstructions, TOOL_NAMES, LITE_TOOL_NAMES } from '../aurum-desktop/mcp/settings.mjs'
import { isQuietCall } from '../aurum-desktop/mcp/browser.mjs'
import { installActivity } from '../aurum-desktop/mcp/activity.mjs'
import { TakeoverControl } from '../aurum-desktop/mcp/takeover.mjs'

assert(TOOL_NAMES.includes('open_browser'))
assert(LITE_TOOL_NAMES.includes('open_browser'))
assert.equal(isQuietCall('open_browser',{url:'https://example.com',activate:true}),true)
assert.match(browserRoutingInstructions(),/start with open_browser/)
assert.doesNotMatch(browserRoutingInstructions({},[]),/start with open_browser/)

const { JSDOM } = harnessRequire('jsdom')
const dom = new JSDOM('<div id="player"></div>', { runScripts: 'outside-only' })
const source = readFileSync(new URL('../aurum-desktop/mcp/browser.mjs', import.meta.url), 'utf8')
const begin = source.indexOf("const INDICATOR_SCRIPT = '(' + function () {")
const end = source.indexOf("}.toString() + ')();';", begin)
let fullscreen = null
Object.defineProperty(dom.window.document, 'fullscreenElement', { get: () => fullscreen })
dom.window.HTMLElement.prototype.showPopover = function () {}
try {
  dom.window.eval('(' + source.slice(begin + "const INDICATOR_SCRIPT = '(' + ".length, end + 1) + ')()')
  dom.window.__dshStatus('working', { x: 320, y: 180 }, { action: 'click', indicatorEnabled: true, cursorIndicatorEnabled: true })
  assert.equal(dom.window.__dshIndicator().pointer, true)
  assert.equal(dom.window.__dshIndicator().status, true)
  dom.window.__dshStatus('working',{x:640,y:320,click:true},{action:'click',indicatorEnabled:true,cursorIndicatorEnabled:true,pointerAnimationMs:240})
  assert.equal(dom.window.__dshIndicator().trail,'320,180 640,320')
  assert.equal(dom.window.__dshIndicator().clicking,true)
  fullscreen = dom.window.document.getElementById('player')
  dom.window.document.dispatchEvent(new dom.window.Event('fullscreenchange'))
  assert.equal(dom.window.__dshIndicator().mountedInFullscreen, true)
  assert.equal(dom.window.__dshIndicator().pointer, true)
  dom.window.__dshStatus('working', null, { indicatorEnabled: false, cursorIndicatorEnabled: false })
  assert.equal(dom.window.__dshIndicator().pointer, false)
  assert.equal(dom.window.__dshIndicator().status, false)
  fullscreen = null
  dom.window.document.dispatchEvent(new dom.window.Event('fullscreenchange'))
  dom.window.__dshStatus('idle')
  assert.equal(dom.window.__dshIndicator().status, false)
} finally { dom.window.close() }

const folder = mkdtempSync(join(tmpdir(), 'aurum-visibility-'))
const file = join(folder, 'activity.json'), handlers = {}, cleanup = []
const control = new TakeoverControl({ testMode: true, activityFile: file })
try {
  installActivity({ on(name, fn) { handlers[name] = fn }, effect(fn) { cleanup.push(fn()) }, logger: { error(error) { throw error } } }, file)
  const exec = { name: 'mcp__wincu__windows_computer_use_click', arguments: { elementId: 't123:10' }, agent: { session: { id: 'test' }, phase: { kind: 'running', turn: 1 } } }
  await handlers['tools/execute']({...exec,name:'mcp__wincu__windows_computer_use_open_browser',arguments:{url:'https://example.com',activate:true}},async()=>{
    await control.sync()
    const status=await control.command('status')
    assert.equal(status.statusOnly,true)
    assert.equal(status.pointerVisible,false)
  })
  await handlers['tools/execute'](exec, async () => {
    assert.equal(JSON.parse(readFileSync(file)).browserAction, 'click')
    await control.sync()
    const status = await control.command('status')
    assert.equal(status.statusOnly, true)
    assert.equal(status.pointerVisible, false)
    assert.equal(status.overlayClickThrough, true)
    assert.match(status.indicatorText, /点击页面/)
    const escape = await control.command('test_key', { vk: 27 })
    assert.equal(escape.consumed, false)
    assert.equal(escape.paused, false)
  })
  await control.sync()
  assert.match((await control.command('status')).indicatorText, /等待下一步/)
  await handlers['tools/execute']({ ...exec, arguments: { x: 100, y: 100 } }, async () => {
    await control.sync()
    const status = await control.command('status')
    assert.equal(status.statusOnly, false)
    assert.equal(status.pointerVisible, false)
    const targeted=await control.command('pointer_target',{x:400,y:300})
    assert.equal(targeted.pointerVisible,true)
    assert.equal(targeted.pointerSource,'agent-target')
  })
  const realNow = Date.now
  try {
    const waitingAt = realNow() + 31000
    Date.now = () => waitingAt
    await handlers['tools/execute']({ ...exec, name:'mcp__wincu__windows_computer_use_snapshot', arguments:{} }, async()=>{
      assert.equal(JSON.parse(readFileSync(file)).indicator, true, 'Thinking longer than 30 seconds retains the desktop series')
    })
  } finally { Date.now = realNow }
  handlers['session/event']({ id: 'test' }, { type: 'turn/end', data: { turn: 1 } })
  assert.equal(JSON.parse(readFileSync(file)).active, false)
  console.log('PASS: fullscreen page pointer, visibility switches, browser status, no Esc interception, desktop handoff and turn cleanup')
} finally {
  for (const dispose of cleanup.reverse()) dispose?.()
  await control.close()
  rmSync(folder, { recursive: true, force: true })
}
