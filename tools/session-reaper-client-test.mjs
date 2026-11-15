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
const listeners=new Set()
let workspaceAction
module.factory(name=>name==='react'?React:ReactDom).apply({
 contextMenus:{register(entry){workspaceAction=entry;return ()=>{}}},
 effect(fn,label){const result=fn();if(label==='session-reaper: cleanup')cleanup=result},
 locale:{register(_,v){dict=v},bind(){return(k,v={})=>dict.zh[k].replace(/\{(\w+)\}/g,(_,n)=>v[n]??'')}},
 slots:{inject(_,fn){fn()},register(options,C){if(options.name==='shell.overlay')Notice=C;else if(options.name==='plugins.tab')assert.fail("bulk cleanup tab should not be registered");else if(options.name==='sidebar.workspaces.session.menu.item')Menu=C}},
 uiSession:{adapter:{current:{getSnapshot:()=>({key:current})}}},
 uiWorkspace:{openSession(id){opened.push(id);current=id},startSession(){opened.push('new');current='new'}},
 sessions:{list:{getSnapshot:()=>catalog,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}},async refresh(){if(refreshFailure)throw Error('offline');catalog=calls.at(-1).method==='session-reaper/restore'?{ids:['target','other'],byId:{target:{running:false}}}:{ids:['other'],byId:{}};listeners.forEach(fn=>fn())}},
 connection:{rpc:{async call(channel,method,payload){assert.equal(channel,'/api');if(method==='session-reaper/list')return {ok:true,value:{workspaceId:'recycle',records:[]}};calls.push({method,payload});await new Promise(r=>resolveCall=r);return reject?{ok:false,error:{message:'正在运行'}}:{ok:true,value:method==='session-reaper/delete'?{deleted:payload.sessionId,partition:'--workspace--',directoryKey:payload.sessionId}:{restored:payload.sessionId}}}}}
})
const root=createRoot(document.getElementById('mount'))
async function render(){await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(Menu,{sessionId:'target',useMenuOpenState:()=>[true,()=>{}]}),React.createElement(Notice))))}
const button=()=>document.querySelector('.sr-menu-item')
await render()
await React.act(async()=>button().click())
assert.equal(calls.length,1,'Delete dispatches immediately')
assert.equal(document.querySelector('dialog'),null)
assert.equal(document.querySelector('.sr-notice'),null)
assert.equal(button().disabled,true)
assert.equal(workspaceAction.resolve({workspaceId:'recycle'})[0].label,'查看回收区')
assert.deepEqual(workspaceAction.resolve({workspaceId:'other'}),[])
await React.act(async()=>resolveCall())
assert.deepEqual(opened,['other'])
assert.match(document.querySelector('[role=status]').textContent,/已移入回收区/)
const timeout=[...timers].find(([,timer])=>timer.delay===1000)
assert(timeout)
await React.act(async()=>timeout[1].callback())
assert.equal(document.querySelector('.sr-notice'),null)
current='target';reject=true;catalog={ids:['target','other'],byId:{target:{running:false}}}
await React.act(async()=>button().click());await React.act(async()=>resolveCall());assert.match(document.querySelector('[role=alert]').textContent,/正在运行/);assert.equal(current,'target');assert.equal(button().disabled,false)
await React.act(async()=>document.querySelector('.sr-notice button').click())
reject=false;refreshFailure=true
await React.act(async()=>button().click());await React.act(async()=>resolveCall());assert.match(document.querySelector('[role=alert]').textContent,/已移入回收区.*刷新失败/)
await React.act(async()=>{catalog={ids:['target'],byId:{target:{running:true}}};listeners.forEach(fn=>fn())});assert.equal(button().disabled,true);assert.match(button().title,/先停止/)
await React.act(async()=>root.unmount());cleanup()
console.log('REAPER CLIENT OK: direct deletion and timed feedback, double-click guard, current-session navigation, refusal feedback, refresh failure and running guard')
