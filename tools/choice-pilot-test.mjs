/** Load both plugin halves and verify reversible native-card styling. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createRequire } from 'node:module'
import { apply } from '../choice-pilot/index.js'

const req = createRequire(new URL('../../package.json', import.meta.url))
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
const cleanups = []
let History
let section
const ctx = {
  locale: { register() { return () => {} } },
  slots: { inject(name, register) { register() }, register(options, component) { History = component; return () => {} } },
  effect(start) { cleanups.push(start()) },
  systemPrompt: { section(value) { section = value; return () => { section = undefined } } },
}
apply(ctx)
assert.equal(section.name, 'choice-pilot')
let entry
runInNewContext(readFileSync(new URL('../choice-pilot/client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load(value) { entry = value } } },
  document: dom.window.document,
})
entry.factory(name => name === 'react' ? req('./node_modules/.pnpm/react@18.3.1/node_modules/react/index.js') : req(name)).apply(ctx)
assert.equal(dom.window.document.querySelectorAll('style[data-dsh-plugin="choice-pilot"]').length, 1)
const React = req('./node_modules/.pnpm/react@18.3.1/node_modules/react/index.js')
const { createRoot } = req('./node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js')
for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{ configurable:true,value:dom.window[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mount = document.createElement('div'); document.body.append(mount)
const root = createRoot(mount)
let chat = { order: ['q'], nodes: { get: () => ({ key:'q',kind:'question-reply',data:{callId:'call',questions:[{id:'a',question:'接下来做什么'}],answers:[{id:'a',selected:['追踪公告','整理笔记'],custom:'只用公开来源'}]} }) } }
await React.act(async () => root.render(React.createElement(History,{sessionId:'s',t:key=>key,useChat:selector=>selector(chat)})))
assert.match(document.body.textContent,/追踪公告.*整理笔记.*只用公开来源/)
await React.act(async()=>document.querySelector('.cp-history button').click())
assert.match(document.querySelector('[role=status]').textContent,/unavailable/)
chat = {order:[],nodes:{get(){}}}
await React.act(async () => root.render(React.createElement(History,{sessionId:'other',t:key=>key,useChat:selector=>selector(chat)})))
assert.equal(document.querySelector('.cp-history'),null)
await React.act(async()=>root.unmount())
for (const dispose of cleanups.reverse()) dispose()
assert.equal(section, undefined)
assert.equal(dom.window.document.querySelector('style'), null)
dom.window.close()
console.log('CHOICE PILOT OK: prompt registration, browser loader, stylesheet lifetime and disposal')
