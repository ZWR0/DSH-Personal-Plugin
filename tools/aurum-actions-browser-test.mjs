/** Match the native assistant-tail button order; verify scoped and reversible hiding. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { browserOptions, dependencyPath, harnessRequire } from './test-environment.mjs'
const {chromium}=harnessRequire('playwright')
const browser=await chromium.launch(browserOptions())
try {
 const page=await browser.newPage()
 await page.setContent('<div id="root"></div><div data-turn-tail="0"><div data-clock="end"><button id="copy">复制</button><button id="like" aria-pressed="false">好的回答</button><button id="dislike" aria-pressed="true">有问题的回答</button><button id="branch">在新对话中分支</button><span>23:48</span></div></div><div data-chat-flow-kind="user"><div data-clock="start"><button id="user-copy">复制用户消息</button><button id="user-branch">用户分支</button></div></div>')
 await page.addScriptTag({path:dependencyPath('react/umd/react.development.js')})
 await page.addScriptTag({path:dependencyPath('react-dom/umd/react-dom.development.js')})
 await page.evaluate(()=>{window.__ModuleLoader__={load(entry){window.entry=entry}}})
 await page.addScriptTag({content:readFileSync(new URL('../aurum-theme/client.js',import.meta.url),'utf8')})
 await page.evaluate(()=>{
   const cleanup=[]
   entry.factory(name=>name==='react'?React:ReactDOM).apply({effect(fn){const result=fn();if(typeof result==='function')cleanup.push(result)},locale:{register(){return()=>{}},bind(){return key=>key}},theme:{overrideTokens(){return()=>{}}},slots:{inject(name,fn){fn()},register(){return()=>{}}}})
   window.stopTheme=()=>cleanup.reverse().forEach(fn=>fn())
   document.getElementById('copy').onclick=()=>window.copied=true
 })
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:700})
  for(const id of ['like','dislike','branch'])assert.equal(await page.locator('#'+id).isVisible(),false)
  for(const id of ['copy','user-copy','user-branch'])assert.equal(await page.locator('#'+id).isVisible(),true)
 }
 await page.locator('#copy').click();assert.equal(await page.evaluate(()=>window.copied),true)
 await page.evaluate(()=>document.body.removeAttribute('data-ds-aurum-theme'))
 for(const id of ['copy','like','dislike','branch'])assert.equal(await page.locator('#'+id).isVisible(),true)
 await page.evaluate(()=>window.stopTheme())
 assert.equal(await page.locator('[data-ds-aurum-theme]').count(),0)
 console.log('AURUM ACTIONS OK: copy retained, three assistant actions hidden, user actions intact, theme-off and unload restored; 390/1280px')
}finally{await browser.close()}
