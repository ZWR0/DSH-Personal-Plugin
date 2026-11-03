import { browserOptions, dependencyPath, harnessRequire } from './test-environment.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const req = harnessRequire
const { chromium } = req('playwright')
const browser = await chromium.launch(browserOptions())
try {
 const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
 await page.route('http://aurum.test/**', route => route.fulfill({contentType:'text/html',body:'<body><div id="root"></div></body>'}))
 await page.goto('http://aurum.test/')
  await page.addScriptTag({ path: dependencyPath('react/umd/react.development.js') })
 await page.addScriptTag({ path: dependencyPath('react-dom/umd/react-dom.development.js') })
 await page.evaluate(() => { window.__ModuleLoader__ = {load(entry){window.entry=entry}} })
 await page.addScriptTag({content:readFileSync(new URL('../aurum-theme/client.js',import.meta.url),'utf8')})
 await page.evaluate(() => {
  window.mountFixture = () => {
  const components = new Map(); const labels = {}
  window.entry.factory(n=>n==='react'?React:ReactDOM).apply({effect(fn){fn()},locale:{register(ns,d){Object.assign(labels,d.zh || d)},bind(){return k=>labels[k]||k}},theme:{overrideTokens(_,tokens){for(const [k,v] of Object.entries(tokens))document.body.style.setProperty(k,v.light);return()=>{}}},slots:{inject(_,fn){fn()},register(o,c){if(o.name === 'conversation.input.dock')components.set(o.id,c);return()=>{}}}})
  const C=components.get('aurum-theme'); window.root=ReactDOM.createRoot(document.getElementById('root'))
  window.draw=(chars,running=true,id='a',turn=0,calls=[])=>root.render(React.createElement(C,{sessionId:id,t:k=>labels[k]||k,useSession:f=>f({running}),useChat:f=>f({order: window.turnNodes ? [...window.turnNodes.keys()] : [], nodes: window.turnNodes || new Map(),legacy:{nodes:window.usageNodes || [],runningCalls:calls,partial:running&&chars>0?{turn,blocks:[{kind:'text',text:'x'.repeat(chars)}]}:null}}),useProjection:k=>({sessionStats:{turns:1,steps:1,llmMs:3000,toolMs:0,decodeMs:1000,decodeTokens:100},tokenUsage:{uncachedInputTokens:1000,cacheReadTokens:0,cacheWriteTokens:0,outputTokens:100}}[k])}))
  draw(1)
  }
  mountFixture()
 })
 for (const [chars,calls,phase] of [[0,[],'phaseWaiting'],[20,[],'phaseGenerating'],[20,[{ phase: 'start', name: 'search' }],'phaseTools'],[0,[],'phaseWaiting']]) {
  await page.evaluate(({chars,calls})=>draw(chars,true,'stage',0,calls),{chars,calls})
  await page.locator('[data-aurum-phase="'+phase+'"]').waitFor()
 }
 await page.evaluate(()=>draw(0,true,'stage',0,[{phase:'start',name:'fixture_tool'}]))
 await page.locator('.au-stage').click()
 await page.locator('.au-expand').waitFor()
 assert.match(await page.locator('.au-expand').textContent(),/fixture_tool/)
 assert.match(await page.locator('.au-expand').textContent(),/本页观察/)
 await page.locator('.au-stage').click()
 await page.setViewportSize({width:390,height:700})
 await page.evaluate(()=>draw(0,true,'stage',0,[{ phase: 'start', name: 'search' }]))
 await page.locator('[data-aurum-phase="phaseTools"]').waitFor()
 assert.equal(await page.locator('.au-stage').isVisible(),true)
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.setViewportSize({width:1000,height:700})
 await page.evaluate(()=>draw(1))
 await page.locator('.au-row > .au-toggle').click()
 await page.evaluate(()=>{
  window.turnNodes = new Map([
   ['old', {kind:'turn-tail',data:{turn:0,tokenUsage:{uncachedInputTokens:1,cacheReadTokens:0,cacheWriteTokens:0,outputTokens:2}}}],
   ['latest', {kind:'turn-tail',data:{turn:4,tokenUsage:{uncachedInputTokens:12345,totalTokens:21434,outputTokens:6789},closing:{finalNode:{usage:{outputTokens:456,reasoningTokens:100},requestConfig:{maxTokens:8192}}}}}],
   ['running', {kind:'assistant-step',data:{turn:5}}]
  ]);draw(1)
 })
 await page.evaluate(()=>{
  window.usageNodes=[{kind:'assistant',turn:0,blocks:[],usage:{inputTokens:1000,totalTokens:1240,outputTokens:40}},
   {kind:'assistant',turn:0,blocks:[],usage:{inputTokens:800,outputTokens:90}},
   {kind:'assistant',turn:-1,blocks:[],usage:{inputTokens:99999,outputTokens:99999}}];draw(1)
 })
 await page.waitForFunction(()=>document.querySelector('[data-aurum-peaks]')?.textContent==='1.20k / 90')
 assert.equal(await page.locator('.au-help').count(),0)
 await page.evaluate(()=>{window.usageNodes=[];draw(1)})
 const usagePanel=page.locator('[data-aurum-turn-usage]')
 await page.waitForFunction(()=>document.querySelector('[data-aurum-turn-usage]')?.textContent.includes('14,645'))
 assert.doesNotMatch(await usagePanel.textContent(),/结束轮次|#5/)
 const centers=await page.locator('.au-metric').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.x+r.width/2}))
 assert(Math.abs((centers[1]-centers[0])-(centers[2]-centers[1]))<2, 'Metrics must be evenly spaced')
 assert.deepEqual(await usagePanel.locator('b').allTextContents(),['14,645 / 6,789','456 / 8,192'])
 await page.setViewportSize({width:390,height:700})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.setViewportSize({width:1000,height:700})
 await page.evaluate(()=>{window.turnNodes.set('latest',{kind:'turn-tail',data:{turn:4}});draw(1)})
 await page.waitForFunction(()=>document.querySelector('[data-aurum-turn-usage] b')?.textContent==='— / —')
 assert.deepEqual(await usagePanel.locator('b').allTextContents(),['— / —','— / —'])
 await page.waitForTimeout(350)
 await page.evaluate(()=>draw(100))
 await page.waitForTimeout(350)
 await page.evaluate(()=>draw(200))
 await page.waitForTimeout(50)
 const path=await page.locator('.au-speed-line').getAttribute('d');assert(path.includes('L'))
 await page.evaluate(()=>draw(200,false));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-speed-line').getAttribute('d'),path)
 await page.evaluate(()=>draw(0,false,'b'));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-speed-line').count(),0)
 await page.evaluate(()=>draw(200,false,'a'));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-speed-line').getAttribute('d'),path)
 for (let turn=1;turn<=3;turn++) {
  await page.evaluate(()=>draw(200,false,'a'))
  await page.waitForTimeout(50)
  // Simulate ten minutes of idle time without delaying the browser test.
  await page.evaluate(()=>{ const original=Date.now; Date.now=()=>original()+600000 })
  await page.evaluate(t=>draw(1,true,'a',t),turn)
  await page.waitForTimeout(350)
  await page.evaluate(t=>draw(100,true,'a',t),turn)
  await page.waitForTimeout(50)
 }
 const duration=await page.locator('.au-chart svg > text').last().textContent()
 assert(!duration.includes('m'), 'Idle minutes leaked into the run-time axis: '+duration)
 assert.equal(await page.locator('.au-speed-line').count(),4)
 assert.equal(await page.locator('.au-speed-area').count(),4)
 assert.equal(await page.locator('.au-speed-legend span').count(),4)
 const colors=await page.locator('.au-speed-line').evaluateAll(es=>es.map(e=>e.getAttribute('stroke')))
 assert(new Set(colors).size >= 3)
 const paths=await page.locator('.au-speed-line').evaluateAll(es=>es.map(e=>e.getAttribute('d')))
 assert(paths.every(d=>(d.match(/M/g)||[]).length===1))
 await page.evaluate(()=>draw(0,false,'a'));await page.waitForTimeout(50)
 const savedPaths=await page.locator('.au-speed-line').evaluateAll(es=>es.map(e=>e.getAttribute('d')))
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('dsh.aurum.speed-history.v1')))
 assert.equal(stored.version,1)
 assert(stored.sessions.find(([id])=>id==='a')[1].some(row=>row.turn===0))
 await page.evaluate(()=>root.unmount())
 await page.addScriptTag({content:readFileSync(new URL('../aurum-theme/client.js',import.meta.url),'utf8')})
 await page.evaluate(()=>{mountFixture();draw(0,false,'a')})
 await page.waitForTimeout(100)
 await page.locator('.au-row > .au-toggle').click()
 assert.deepEqual(await page.locator('.au-speed-line').evaluateAll(es=>es.map(e=>e.getAttribute('d'))),savedPaths)
 if (process.env.AURUM_SCREENSHOT) await page.screenshot({path:process.env.AURUM_SCREENSHOT})
 await page.evaluate(()=>draw(0,false,'b'));await page.waitForTimeout(50)
 assert.equal(await page.locator('.au-speed-line').count(),0)
 console.log('HISTORY OK: compact paired usage, peak isolation, centered equal spacing;  module reload restores curves; interruption and session isolation; four turns retained; idle excluded')
} finally {await browser.close()}
