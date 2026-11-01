import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire('D:/deepseek-harness/package.json')
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
try {
 const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
 await page.setContent('<body><div id="root"></div></body>')
 const base = 'D:/deepseek-harness/node_modules/.pnpm/'
 await page.addScriptTag({ path: base+'react@18.3.1/node_modules/react/umd/react.development.js' })
 await page.addScriptTag({ path: base+'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/umd/react-dom.development.js' })
 await page.evaluate(() => { window.__ModuleLoader__ = {load(entry){window.entry=entry}} })
 await page.addScriptTag({content:readFileSync(new URL('../aurum-theme/client.js',import.meta.url),'utf8')})
 await page.evaluate(() => {
  const components = new Map(); const labels = {}
  window.entry.factory(n=>n==='react'?React:ReactDOM).apply({effect(fn){fn()},locale:{register(ns,d){Object.assign(labels,d.zh || d)},bind(){return k=>labels[k]||k}},theme:{overrideTokens(_,tokens){for(const [k,v] of Object.entries(tokens))document.body.style.setProperty(k,v.light);return()=>{}}},slots:{inject(_,fn){fn()},register(o,c){if(o.name === 'conversation.input.dock')components.set(o.id,c);return()=>{}}}})
  const C=components.get('aurum-theme'); window.root=ReactDOM.createRoot(document.getElementById('root'))
  window.draw=(chars,running=true,id='a')=>root.render(React.createElement(C,{sessionId:id,t:k=>labels[k]||k,useSession:f=>f({running}),useChat:f=>f({legacy:{nodes:[],partial:running?{blocks:[{kind:'text',text:'x'.repeat(chars)}]}:null}}),useProjection:k=>({sessionStats:{turns:1,steps:1,llmMs:3000,toolMs:0,decodeMs:1000,decodeTokens:100},tokenUsage:{uncachedInputTokens:1000,cacheReadTokens:0,cacheWriteTokens:0,outputTokens:100}}[k])}))
  draw(1)
 })
 await page.locator('.au-toggle').click()
 await page.waitForTimeout(350)
 await page.evaluate(()=>draw(100))
 await page.waitForTimeout(350)
 await page.evaluate(()=>draw(200))
 await page.waitForTimeout(50)
 const path=await page.locator('.au-chart path').getAttribute('d');assert(path.includes('L'))
 await page.evaluate(()=>draw(200,false));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-chart path').getAttribute('d'),path)
 await page.evaluate(()=>draw(0,false,'b'));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-chart path').getAttribute('d'),'')
 await page.evaluate(()=>draw(200,false,'a'));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-chart path').getAttribute('d'),path)
 console.log('HISTORY OK: timestamp curve retained after completion and session switch; sessions isolated')
} finally {await browser.close()}
