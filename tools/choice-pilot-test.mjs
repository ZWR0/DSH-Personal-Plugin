import { harnessRequire } from './test-environment.mjs'
/** Load both plugin halves and verify isolated suggestion styling. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { apply } from '../choice-pilot/index.js'

const req = harnessRequire
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
const cleanups = []
let Followups
let section
const ctx = {
  on() { assert.fail('suggestions must not intercept tools or steer the agent') },
  tools: { register() {} },
  locale: { register() { return () => {} } },
  slots: { inject(name, register) { register() }, register(options, component) { assert.equal(options.id, 'choice-pilot-followups'); Followups = component; return () => {} } },
  effect(start) { cleanups.push(start()) },
  systemPrompt: { section(value) { section = value; return () => { section = undefined } } },
}
apply(ctx)
assert.equal(section.name, 'choice-pilot')
assert.doesNotMatch(section.text, /\[自动继续\]|自动处理|每个问题提供/)
let entry
runInNewContext(readFileSync(new URL('../choice-pilot/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load(value) { entry = value } } },
  document: dom.window.document,
})
entry.factory(name => name === 'react' ? req('react') : req(name)).apply(ctx)
assert.equal(dom.window.document.querySelectorAll('style[data-dsh-plugin="choice-pilot"]').length, 1)
const React = req('react')
const { createRoot } = req('react-dom/client')
for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{ configurable:true,value:dom.window[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mount = document.createElement('div'); document.body.append(mount)
const root = createRoot(mount)
let chat

const suggestions = [{ label: '检查本地模型配置', prompt: '请检查本地模型架构并解释速度差异，不修改配置。' }, { label: '解读配置片段', prompt: '我会补充配置文本，请根据我提供的内容解读模型架构。' }]
const followup = { key: 'f', kind: 'tool-call', anchorSeq: 8, data: { root: { kind: 'tool-result', name: 'suggest_followups', seq: 8, callId: 'followups', isError: false, meta: { choicePilotFollowups: suggestions }, subCalls: [] } } }
chat = { order: ['f'], nodes: new Map([['f', followup]]) }
let draft = '已有草稿'
let revision = 1
let insertions = 0
let persists = 0
let refuseInsertion = false
let sends = 0
let attachmentIds = []
const props = { sessionId: 's', t: key => key, useChat: selector => selector(chat), useInput: selector => selector({ phase: 'plain', draft, attachmentIds }), inputActions: {
  captureInsertion: () => ({ start: 0, end: 2, draftRev: revision }),
  insertText(text, span) { if (refuseInsertion) return false; assert.equal(span.start, span.end, 'never replace selected draft text'); assert.equal(span.draftRev, revision); draft = draft.slice(0, span.start) + text + draft.slice(span.end); revision++; insertions++; return true },
  persistDraft() { persists++ },
  submit() { sends++ },
  setDraft() { assert.fail('a followup must never overwrite the draft') },
} }
await React.act(async () => root.render(React.createElement(Followups, props)))
assert.equal(document.querySelectorAll('.cp-followup-options button').length, 2)
assert.equal(insertions, 0, 'rendering suggestions does not choose or insert one')
await React.act(async () => document.querySelector('.cp-followup-options button').click())
assert.match(draft, /已有.*请检查本地模型架构.*草稿/s)
assert.equal(persists, 1)
assert.equal(document.querySelector('.cp-followup-options button').disabled, true)
const toggle = document.querySelector('.cp-followup-toggle')
const options = document.getElementById(toggle.getAttribute('aria-controls'))
await React.act(async () => toggle.click())
assert.equal(toggle.getAttribute('aria-expanded'), 'false')
assert.equal(options.hidden, true)
await React.act(async () => toggle.click())
assert.equal(toggle.getAttribute('aria-expanded'), 'true')
assert.equal(options.hidden, false)
assert.equal(options.querySelector('button').disabled, true, 'reopening preserves the used option')
await React.act(async () => document.querySelector('.cp-followup-options button').click())
assert.equal(insertions, 1, 'repeat clicks do not duplicate text')
refuseInsertion = true
await React.act(async () => document.querySelectorAll('.cp-followup-options button')[1].click())
assert.equal(document.querySelector('.cp-followups [role=alert]').textContent, 'insertFailed')
refuseInsertion = false
props.inputActions.persistDraft = () => { throw new Error('storage unavailable') }
await React.act(async () => document.querySelectorAll('.cp-followup-options button')[1].click())
assert.equal(document.querySelector('.cp-followups [role=alert]').textContent, 'saveFailed')
assert.equal(document.querySelectorAll('.cp-followup-options button')[1].disabled, true, 'a save failure must not duplicate an inserted prompt')
assert.equal(sends, 0, 'existing drafts are never sent by a suggestion')
draft = ''
props.inputActions.persistDraft = () => { persists++ }
await React.act(async () => root.render(React.createElement(Followups, { ...props, sessionId: 'empty' })))
await React.act(async () => document.querySelector('.cp-followup-options button').click())
assert.equal(sends, 1, 'an explicit click with an empty composer submits through the native action')
assert.match(draft, /请检查本地模型架构/)
draft = ''; attachmentIds = ['attachment']
await React.act(async () => root.render(React.createElement(Followups, { ...props, sessionId: 'attachment' })))
await React.act(async () => document.querySelector('.cp-followup-options button').click())
assert.equal(sends, 1, 'existing attachments require review instead of being sent with a suggestion')
const child = { ...followup.data.root, meta: undefined, callId: 'ptc-child', call: { argsRaw: JSON.stringify({ suggestions }) } }
await React.act(async () => toggle.click())
chat = { order: ['p'], nodes: new Map([['p', { kind: 'tool-call', data: { root: { kind: 'tool-result', name: 'run_code', subCalls: [child] } } }]]) }
await React.act(async () => root.render(React.createElement(Followups, { ...props, sessionId: 'attachment' })))
assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'a new suggestion set opens in the same session')
assert.equal(document.querySelectorAll('.cp-followup-options button').length, 2, 'successful PTC children expose the same suggestions')
chat = { order: ['p'], nodes: new Map([['p', { kind: 'tool-call', data: { root: { ...child, isError: true } } }]]) }
await React.act(async () => root.render(React.createElement(Followups, props)))
assert.equal(document.querySelector('.cp-followups'), null, 'failed tools never offer suggested prompts')
const newerUser = { kind: 'user', anchorSeq: 10 }
chat = { order: ['f', 'u'], nodes: new Map([['f', followup], ['u', newerUser]]) }
await React.act(async () => root.render(React.createElement(Followups, props)))
assert.equal(document.querySelector('.cp-followups'), null, 'old suggestions disappear after the next user message')
chat = { order: [], nodes: new Map() }
await React.act(async () => root.render(React.createElement(Followups, { ...props, sessionId: 'other' })))
assert.equal(document.querySelector('.cp-followups'), null, 'suggestions do not leak to another session')
await React.act(async()=>root.unmount())
for (const dispose of cleanups.reverse()) dispose()
assert.equal(section, undefined)
assert.equal(dom.window.document.querySelector('style'), null)
dom.window.close()
console.log('CHOICE PILOT OK: prompt registration, browser loader, suggestion-only registration, draft preservation, sending and disposal')
