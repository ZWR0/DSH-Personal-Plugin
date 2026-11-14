import { harnessRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const req=harnessRequire
const {JSDOM}=req('jsdom')
const dom=new JSDOM('<div id="mount"></div>',{pretendToBeVisual:true})
for(const k of ['window','document','navigator'])Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]})
globalThis.IS_REACT_ACT_ENVIRONMENT=true
const React=req('react')
const ReactDom=req('react-dom')
const {createRoot}=req('react-dom/client')
let module,Menu,Notice,dict,cleanup,current='target',calls=[],opened=[],refreshFailure=false,reject=false,resolveCall
let catalog={ids:['target','other'],byId:{target:{running:false}}}
window.__ModuleLoader__={load(v){module=v}}
const timers = new Map()
let timerId = 0
new Function('setTimeout', 'clearTimeout', readFileSync(new URL('../session-reaper/client.js',import.meta.url),'utf8'))(
  (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId },
  id => timers.delete(id),
)
function expireUndo() {
  const entry = [...timers].find(([, timer]) => timer.delay === 5000)
  assert(entry, 'Expected a five-second undo window')
  timers.delete(entry[0])
  entry[1].callback()
}
const listeners=new Set()
module.factory(name=>name==='react'?React:ReactDom).apply({
 effect(fn,label){const result=fn();if(label==='session-reaper: cleanup')cleanup=result},
 locale:{register(_,v){dict=v},bind(){return(k,v={})=>dict.zh[k].replace(/\{(\w+)\}/g,(_,n)=>v[n]??'')}},
 slots:{inject(_,fn){fn()},register(options,C){if(options.name==='shell.overlay')Notice=C;else if(options.name==='plugins.tab')assert.fail("bulk cleanup tab should not be registered");else if(options.name==='sidebar.workspaces.session.menu.item')Menu=C}},
 uiSession:{adapter:{current:{getSnapshot:()=>({key:current})}}},
 uiWorkspace:{openSession(id){opened.push(id);current=id},startSession(){opened.push('new');current='new'}},
 sessions:{list:{getSnapshot:()=>catalog,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}},async refresh(){if(refreshFailure)throw Error('offline');catalog={ids:['other'],byId:{}};listeners.forEach(fn=>fn())}},
 connection:{rpc:{async call(channel,method,payload){assert.equal(channel,'/api');assert.equal(method,'session-reaper/delete');calls.push(payload);await new Promise(r=>resolveCall=r);return reject?{ok:false,error:{message:'正在运行'}}:{ok:true,value:{deleted:payload.sessionId}}}}}
})
const root=createRoot(document.getElementById('mount'))
async function render(){await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(Menu,{sessionId:'target',useMenuOpenState:()=>[true,()=>{}]}),React.createElement(Notice))))}
const button=()=>document.querySelector('.sr-menu-item')
await render()
await React.act(async()=>button().click())
assert.equal(calls.length,0,'Preview must not delete')
assert(document.querySelector('[role=dialog]'))
await React.act(async()=>document.querySelector('.sr-dialog button:last-child').click())
assert.equal(calls.length,0)
assert.equal(button().disabled,true)
assert.match(document.querySelector('[role=status]').textContent,/5 秒/)
await React.act(async()=>document.querySelector('.sr-notice button').click())
assert.equal(calls.length,0)
assert.equal(current,'target')
assert.equal(button().disabled,false)
assert.match(document.querySelector('[role=status]').textContent,/已撤销/)
assert.equal([...timers.values()].some(timer=>timer.delay===5000),false)
await React.act(async()=>button().click())
await React.act(async()=>document.querySelector('.sr-dialog button:last-child').click())
await React.act(async()=>expireUndo())
assert.equal(calls.length,1)
assert.equal(button().disabled,true)
await React.act(async()=>button().click());assert.equal(calls.length,1)
await React.act(async()=>resolveCall());assert.deepEqual(opened,['other']);assert.match(document.querySelector('[role=status]').textContent,/永久删除/)
current='target';reject=true;catalog={ids:['target','other'],byId:{target:{running:false}}}
await React.act(async()=>button().click());await React.act(async()=>document.querySelector('.sr-dialog button:last-child').click());await React.act(async()=>expireUndo());await React.act(async()=>resolveCall());assert.match(document.querySelector('[role=alert]').textContent,/正在运行/);assert.equal(current,'target');assert.equal(button().disabled,false)
await React.act(async()=>document.querySelector('.sr-notice button').click())
reject=false;refreshFailure=true
await React.act(async()=>button().click());await React.act(async()=>document.querySelector('.sr-dialog button:last-child').click());await React.act(async()=>expireUndo());await React.act(async()=>resolveCall());assert.match(document.querySelector('[role=alert]').textContent,/已删除.*刷新失败/)
await React.act(async()=>{catalog={ids:['target'],byId:{target:{running:true}}};listeners.forEach(fn=>fn())});assert.equal(button().disabled,true);assert.match(button().title,/先停止/)
await React.act(async()=>root.unmount());cleanup()
console.log('REAPER CLIENT OK: preview and confirmation, double-click guard, current-session navigation, refusal feedback, refresh failure and running guard')
