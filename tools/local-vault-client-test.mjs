import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire(new URL('../../package.json', import.meta.url))
const { JSDOM } = req('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>', { url: 'http://localhost', pretendToBeVisual: true })
for (const key of ['window', 'document', 'MutationObserver', 'HTMLElement', 'Node', 'navigator']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const base = './node_modules/.pnpm/'
const React = req(base+'react@18.3.1/node_modules/react/index.js')
const { act } = React
const { createRoot } = req(base+'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js')
const { Simulate } = req(base+'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/test-utils.js')
let module
window.__ModuleLoader__ = { load(value) { module = value } }
new Function(readFileSync(new URL('../local-vault/client.js', import.meta.url), 'utf8'))()
const plugin = module.factory(name => { assert.equal(name,'react');return React })
let Component, face, dictionaries
const t = (key, values = {}) => (dictionaries.zh[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '')
const path = 'D:\\插件目录 with spaces'
const candidates = [
 {name:'@local/a',path:path+'\\a',version:'1',installedVersion:'0.9',versionChanged:true,status:'ready'},
 {name:'@local/b',path:path+'\\b',version:'2',status:'ready'},
 {name:'@local/old',path:path+'\\old',status:'installed'},
 {name:'@local/conflict',path:path+'\\conflict',status:'conflict'},
]
let inventory = [], removals = [], removalWait
let saved = false, fail = true, installs = [], deferred, picked, pickerCalls = 0
picked = path
const ok = value => ({ok:true,value})
plugin.apply({
 locale:{register(_,value){dictionaries=value;return()=>{}},bind(){return t},resolveText:v=>v},effect(fn){fn()},
 slots:{inject(_,fn){fn()},register(options,value){Component=value;face=options.inject();return()=>{}}},
 uiWorkspace:{async pickDirectory(){pickerCalls++;return picked}},
 remote:{pluginManager:{listBundles:async()=>ok(inventory),removeBundle:async(name)=>{removals.push(name);if(removalWait)await removalWait;if(name==='@local/fail')return ok({application:'failed',error:{message:'remove fixture failed'}});inventory=inventory.filter(b=>b.name!==name);return ok({application:'restart-required'})}}},
 connection:{rpc:{async call(channel,endpoint,payload){
  assert.equal(channel,'/api');assert(endpoint.startsWith('local-vault/'));endpoint=endpoint.slice('local-vault/'.length)
  if(endpoint==='scan') return ok(saved?{directory:path,candidates,warnings:[]}:{directory:'',candidates:[],warnings:[]})
  if(endpoint==='save'){assert.equal(payload.directory,path);saved=true;return ok({directory:path,candidates,warnings:[{path:'bad',message:'invalid manifest'}]})}
  if(endpoint==='install'){
    installs.push(payload.path)
    if(deferred) await deferred
    if(payload.path.endsWith('\\b')&&fail)return {ok:false,error:{message:'fixture install failure'}}
    return ok({application:'restart-required',changed:true})
  }
  assert.fail(endpoint)
 }}}
})
let root=createRoot(document.getElementById('mount'))
await act(async()=>root.render(React.createElement(Component,{...face,t,openPackage(){}})))
const directory = () => document.querySelector('.lv-directory-path')
const button = text => [...document.querySelectorAll('button')].find(el=>el.textContent===text)
assert(directory())
assert(document.querySelector('.lv-directory input'))
await act(async()=>button(t('chooseDirectory')).click())
assert.equal(pickerCalls,1)
assert.equal(directory().value,path)
assert.equal(document.querySelectorAll('.lv-install-row').length,4)
assert.equal(document.querySelectorAll('.lv-install-row input:checked').length,2)
assert.equal(document.querySelectorAll('.lv-install-row input:disabled').length,2)
assert.match(document.body.textContent,/invalid manifest/)
await act(async()=>button(t('installSelected',{count:2})).click())
assert.deepEqual(installs,[path+'\\a',path+'\\b'])
assert.match(document.body.textContent,/成功 1，跳过 0，失败 1/)
assert.match(document.body.textContent,/需要重启/)
assert.match(document.body.textContent,/fixture install failure/)
assert.equal(document.querySelectorAll('.lv-install-row input:checked').length,1)
fail=false
await act(async()=>button(t('installSelected',{count:1})).click())
assert.equal(installs.length,3)
assert.match(document.body.textContent,/成功 1，跳过 0，失败 0/)
// Cancelling the OS picker must leave the saved directory and results intact.
picked = null
await act(async()=>button(t('chooseDirectory')).click())
assert.equal(directory().value,path)
assert.equal(document.querySelectorAll('.lv-install-row').length,4)
assert.match(document.body.textContent,/安装成功/)
// Native picker failures leave the previous plan usable too.
picked = undefined
face.pickDirectory = async()=>{throw new Error('picker unavailable')}
await act(async()=>root.render(React.createElement(Component,{...face,t,openPackage(){}})))
await act(async()=>button(t('chooseDirectory')).click())
assert.match(document.body.textContent,/绝对路径/)
assert.equal(directory().value,path)
// Manual input is usable when no native picker exists.
await act(async()=>{ Simulate.change(directory(), { target: { value: path } }) })
await act(async()=>button(t('saveScan')).click())
assert.equal(directory().value,path)
assert.equal(document.querySelectorAll('.lv-install-row').length,4)
await act(async()=>root.unmount())
// Leaving the page while one item is installing prevents the next item starting.
root=createRoot(document.getElementById('mount'))
await act(async()=>root.render(React.createElement(Component,{...face,t,openPackage(){}})))
let release
installs=[];deferred=new Promise(resolve=>{release=resolve})
await act(async()=>{button(t('installSelected',{count:2})).click();await new Promise(resolve=>setTimeout(resolve,0))})
assert.equal(installs.length,1)
assert(button(t('chooseDirectory')).disabled)
assert.equal(document.querySelector('progress').value,0)
assert.equal(document.querySelector('progress').max,2)
assert(document.querySelector('.lv-spinner'))
await act(async()=>root.unmount())
await act(async()=>{release();await new Promise(resolve=>setTimeout(resolve,0))})
assert.equal(installs.length,1)
// The selection action occupies one button and resets uninstall confirmation.
inventory = [
 { name: '@local/a', removable: true },
 { name: '@local/b', removable: true },
 { name: '@local/locked', removable: false },
 { name: '@local/dsh-local-vault', removable: true },
]
root=createRoot(document.getElementById('mount'))
await act(async()=>root.render(React.createElement(Component,{...face,t,openPackage(){}})))
assert(button(t('selectVisible')))
assert.equal(button(t('clearSelection')),undefined)
await act(async()=>button(t('selectVisible')).click())
assert.equal(document.querySelectorAll('.lv-card input:checked').length,2)
assert.equal(button(t('selectVisible')),undefined)
await act(async()=>button(t('uninstall',{count:2})).click())
assert(button(t('confirmBatch',{count:2})))
await act(async()=>button(t('clearSelection')).click())
assert.equal(document.querySelectorAll('.lv-card input:checked').length,0)
assert(button(t('uninstall',{count:0})).disabled)
await act(async()=>document.querySelector('.lv-card input').click())
assert(button(t('clearSelection')))
await act(async()=>button(t('clearSelection')).click())
assert(button(t('selectVisible')))
await act(async()=>Simulate.change(document.querySelector('input[type="search"]'),{target:{value:'@local/locked'}}))
assert(button(t('selectVisible')).disabled)
assert.deepEqual(removals,[])
await act(async()=>root.unmount())
dom.window.close()
console.log('VAULT CLIENT OK: save/scan, selection, skipped/conflicting entries, batch progress, partial failure, retry, restart notice, native picker, cancellation, picker errors, stop queue on unmount')
