import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { harnessRequire } from './test-environment.mjs'
const req = harnessRequire
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<div data-chat-flow-kind="assistant-step"><p id="reply">短句</p><button>菜单文字</button></div><aside>侧栏文字</aside><div id="mount"></div>', {pretendToBeVisual:true})
for (const key of ['window','document','navigator']) Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]})
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window)
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window)
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const React=req('react')
const {createRoot}=req('react-dom/client')
let module,Component,dictionaries
window.__ModuleLoader__={load(v){module=v}}
new Function(readFileSync(new URL('../quote-relay/client.js',import.meta.url),'utf8'))()
module.factory(name=>name==='react'?React:req('react-dom')).apply({effect:f=>f(),locale:{register(_,v){dictionaries=v},bind(){return ()=>''}},slots:{inject(_,f){f()},register(_,v){Component=v}}})
const t=(k,v={})=>dictionaries.zh[k].replace(/\{(\w+)\}/g,(_,n)=>v[n]??'')
let accepted=true,calls=[],draft='已有草稿',writes=0
const props={t,useInput:f=>f({draft}),inputActions:{insertQuote(text){calls.push(text);return accepted},setDraft(){writes++}}}
const root=createRoot(document.getElementById('mount'))
await React.act(async()=>root.render(React.createElement(Component,props)))
async function select(selector,text){await React.act(async()=>{const el=document.querySelector(selector);if(text!==undefined)el.textContent=text;const range=document.createRange();range.selectNodeContents(el);window.getSelection().removeAllRanges();window.getSelection().addRange(range);document.dispatchEvent(new window.Event('selectionchange'));await new Promise(r=>setTimeout(r,35))})}
const button=()=>[...document.querySelectorAll('.qr-btn')].find(button=>button.getAttribute('aria-label')) || null
await select('aside');assert.equal(button(),null)
await select('[data-chat-flow-kind] button');assert.equal(button(),null)
await select('#reply');assert.match(button().textContent,/2/)
await React.act(async()=>button().click());assert.deepEqual(calls,['短句']);assert.equal(writes,0);assert.match(document.querySelector('[role=status]').textContent,/已加入/)
await select('#reply','新引用');assert(button())
accepted=false
await React.act(async()=>button().click());assert.match(document.querySelector('[role=alert]').textContent,/无法插入/);assert(button());assert.equal(writes,0)
await select('#reply','😀'.repeat(8001));assert.equal(button().disabled,true);assert.match(button().title,/8001/)
await select('#reply','😀'.repeat(8000));assert.equal(button().disabled,false)
await select('#reply',' ');assert.equal(button(),null)
accepted=true
await select('#reply','直接引用')
assert.equal(document.querySelectorAll('.qr-btn').length,1,'selection offers only direct insertion')
assert.equal(document.querySelector('.qr-tray'),null)
await React.act(async()=>button().click())
assert.equal(calls.at(-1),'直接引用')
await React.act(async()=>root.unmount())
console.log('Quote relay: selection scope, short text, native insertion, refusal, Unicode limit and cleanup passed')
