import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true})
const source=readFileSync(new URL('../mobile-deck/client.js',import.meta.url),'utf8')
const test=readFileSync(new URL('./mobile-deck-client-test.mjs',import.meta.url),'utf8')
const fixture=test.slice(test.indexOf('const listeners ='),test.indexOf('// ---------------------------------------------------------------- load module')).replace(/\s*assert.equal\(channel, '\/api'\)/,'').replace(/\s*assert.equal\(method, 'mobile-deck\/settings'\)/,'')
const theme=readFileSync(new URL('../aurum-theme/client.js',import.meta.url),'utf8')
const tokens=[...theme.matchAll(/'(--dsw-[^']+)': \['([^']*)', '([^']*)'\]/g)]
const out=new URL('./.test-tmp/mobile-deck-visual/', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:')
mkdirSync(out,{recursive:true})
try{
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message))
await page.route('https://dsh.fixture.test/**', route => route.fulfill(route.request().url().includes('changes.summary')
 ? {status:200,contentType:'application/json',body:JSON.stringify({turn:1,files:[{path:'D:/work/outputs/report.md',display:'outputs/report.md',added:12,deleted:2}]})}
 : {status:200,contentType:'text/html',body:'<html><body></body></html>'}))
await page.goto('https://dsh.fixture.test/')
await page.setContent('<style>body{margin:0;padding:24px;font:14px system-ui;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}#mount{max-width:1400px;margin:auto}</style><div id="mount"></div>')
const base=new URL('../../node_modules/.pnpm/',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:')
await page.addScriptTag({path:base+'react@18.3.1/node_modules/react/umd/react.development.js'})
await page.addScriptTag({path:base+'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/umd/react-dom.development.js'})
await page.evaluate(()=>{window.__ModuleLoader__={load(v){window.entry=v}}})
await page.addScriptTag({content:source})
await page.evaluate(fixture+`
const dictionaries={};const original=ctx.locale.register;
ctx.locale.register=(ns,d)=>{dictionaries[ns]=d;return original(ns,d)};
window.entry.factory(()=>React).apply(ctx);
ctx.sessions.retain=(id)=>({ready:Promise.resolve(),binding:{session:{loadOlder:async()=>{}},eventSource:{getSnapshot:()=>({hasMore:false,entries:[
 {type:'event',event:{type:'deliverables/presented',seq:2,data:{turn:1,callId:'p1',files:[{path:'D:/work/outputs/report.md',description:'任务报告 · Markdown'},{path:'D:/work/outputs/overview.png',description:'结果图表'}]}}},
 {type:'event',event:{type:'workspace/changes',seq:3,data:{turn:1}}},
 ...(id==='idle-2'?[{type:'event',event:{type:'turn/end',seq:4,data:{turn:1,reason:{kind:'error'}}}}]:[])
]}),subscribe:()=>()=>{}}},release(){}})
statusMap.set('idle-1',{running:false,pendingInteraction:{key:'approval',kind:'approval',toolName:'shell',reason:'需要运行检查',sessionId:'idle-1'},completionUnread:false});
window.previewRoot=ReactDOM.createRoot(document.getElementById('mount'));
window.showPanel=()=>previewRoot.render(React.createElement(registrations.get('main:mobile-deck').component));
window.showShortcut=()=>previewRoot.render(React.createElement(registrations.get('conversation.input.left:mobile-deck').component));
window.showSettings=()=>previewRoot.render(React.createElement(registrations.get('plugins.tab:mobile-deck').component));
`)
for(const dark of [false,true]){
 await page.evaluate(({tokens,dark})=>{for(const [,key,light,night] of tokens)document.body.style.setProperty(key,dark?night:light);document.body.style.colorScheme=dark?'dark':'light'}, {tokens,dark})
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>showPanel());await page.locator('.mdk-row').first().waitFor()
  await page.locator('.mdk-row').first().focus()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'panel fits viewport')
  const color=await page.locator('.mdk-row').first().evaluate(el=>({text:getComputedStyle(el).color,bg:getComputedStyle(el.parentElement).backgroundColor}))
  assert.notEqual(color.text,color.bg)
  for (const button of await page.locator('.mdk-btn[data-variant=primary]').all()) {
    assert.notEqual(await button.evaluate(el=>getComputedStyle(el).backgroundImage),'none','primary actions retain their contrast background')
  }
  assert.equal(await page.locator('.mdk-tools>.mdk-btn .mdk-icon').count(),3)
  await page.screenshot({path:`${out}/${dark?'dark':'light'}-${width}.png`,fullPage:true})
  await page.locator('.mdk-filters button').filter({hasText:'待处理'}).click()
  await page.locator('[data-todo-kind=failure]').waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'todo center fits viewport')
  await page.screenshot({path:`${out}/${dark?'dark':'light'}-todos-${width}.png`,fullPage:true})
  await page.locator('.mdk-filters button').filter({hasText:'全部'}).click()
  await page.getByRole('button',{name:'成果 等待提问的会话',exact:true}).click()
  await page.locator('.mdk-result').first().waitFor()
  assert.equal(await page.locator('.mdk-result').count(),2)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'results fit viewport')
  await page.screenshot({path:`${out}/${dark?'dark':'light'}-results-${width}.png`,fullPage:true})
  await page.evaluate(()=>showSettings());await page.locator('.mdk-toggle').first().waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'settings fit viewport')
  await page.screenshot({path:`${out}/${dark?'dark':'light'}-settings-${width}.png`,fullPage:true})
 }
}
// Mount both real composer controls together; book internals exposed only in this test.
const bookSource=readFileSync(new URL('../context-library/client.js',import.meta.url),'utf8').replace('    function unwrap(answer)', '    window.__bookPreview = ComposerButton;\n    function unwrap(answer)')
await page.addScriptTag({content:bookSource})
await page.evaluate(()=>{window.entry.factory(name=>name==='react'?React:ReactDOM)})
await page.setViewportSize({width:390,height:500})
await page.evaluate(()=>{
 showShortcut()
 const extra=document.createElement('div');extra.id='book-mount';document.getElementById('mount').append(extra)
 ReactDOM.createRoot(extra).render(React.createElement(window.__bookPreview,{t:k=>k,call:async()=>({count:2}),currentSessionId:()=>''}))
 document.getElementById('mount').style.cssText='display:flex;gap:12px;align-items:center;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;background:var(--dsw-alias-bg-layer-1)'
})
await page.locator('.cl-book').waitFor()
for(const selector of ['.cl-book','.mdk-launch']){
 const bounds=await page.locator(selector).boundingBox()
 assert.equal(bounds.width,44);assert.equal(bounds.height,44)
 assert.ok(await page.locator(selector).getAttribute('aria-label'))
}
await page.screenshot({path:out+'/mobile-shortcuts.png'})
await page.locator('.mdk-launch').click()
// Fixture layout records navigation without replacing the preview root.
await page.evaluate(()=>showSettings())
await page.locator('.mdk-choice').first().waitFor()
// Use the real Web Audio graph under a trusted browser click. This verifies scheduling,
// not the physical speaker volume or the mobile OS mute setting.
await page.evaluate(()=>{
 window.scheduledTones=0
 const make=AudioContext.prototype.createOscillator
 AudioContext.prototype.createOscillator=function(...args){window.scheduledTones++;return make.apply(this,args)}
})
await page.getByRole('switch',{name:'声音反馈',exact:true}).check()
await page.waitForFunction(()=>document.querySelector('.mdk-soundstatus')?.textContent==='已激活' && window.scheduledTones===2)
await page.getByRole('slider',{name:'提示音音量'}).fill('40')
assert.equal(await page.locator('.mdk-volume output').textContent(),'40%')
await page.getByRole('button',{name:'试听',exact:true}).click()
await page.waitForFunction(()=>window.scheduledTones===4)
await page.getByRole('switch',{name:'声音反馈',exact:true}).uncheck()
assert.equal(await page.locator('.mdk-soundstatus').textContent(),'已静音')
const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('dsh.mobile-deck.sound.v1')))
assert.deepEqual(stored,{enabled:false,volume:.4})
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('.mdk-choice').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s')
// Reproduce the host plugin header: flex item, intrinsic tab grid, clipped page.
await page.setViewportSize({width:390,height:800})
await page.evaluate(()=>{
 const host=document.createElement('div');host.id='host-tabs-fixture';host.style.cssText='width:100%;min-width:0;overflow:hidden'
 const header=document.createElement('header');header.style.cssText='display:flex;flex-wrap:wrap;width:100%;min-width:0'
 const strip=document.createElement('div');strip.dataset.pluginHeaderPart='tabs';strip.style.cssText='display:flex;flex:0 0 auto'
 const tabs=document.createElement('div');tabs.setAttribute('role','tablist');tabs.style.cssText='display:grid;grid-template-columns:repeat(9,minmax(0,1fr));width:fit-content;min-width:240px;padding:2px'
 for(const title of ['已安装','发现','暗金主题','知忆书阁','远行之钥','行囊宝匣','选项领航','会话清道','掌上行舟']){
  const button=document.createElement('button');button.setAttribute('role','tab');button.textContent=title;button.style.cssText='padding:0 12px';tabs.append(button)
 }
 strip.append(tabs);header.append(strip);host.append(header);document.body.prepend(host)
})
const strip=page.locator('#host-tabs-fixture [data-plugin-header-part=tabs]')
assert.ok(await strip.evaluate(el=>el.scrollWidth>el.clientWidth),'all tabs form a scrollable strip')
assert.ok(await strip.evaluate(el=>el.clientWidth<=innerWidth),'strip stays inside phone viewport')
await strip.evaluate(el=>{el.scrollLeft=el.scrollWidth})
const lastTab=page.locator('#host-tabs-fixture [role=tab]').last()
assert.ok(await lastTab.evaluate(el=>{const box=el.getBoundingClientRect(),root=el.closest('[data-plugin-header-part=tabs]').getBoundingClientRect();return box.left>=root.left-1&&box.right<=root.right+1}),'last plugin tab is reachable')
await strip.evaluate(el=>{el.scrollLeft=0})
await lastTab.focus()
assert.ok(await strip.evaluate(el=>el.scrollLeft>0),'keyboard focus reveals the last tab')
await lastTab.click()
await page.screenshot({path:out+'/mobile-plugin-tabs.png',fullPage:true})
assert.deepEqual(errors,[])
console.log('MOBILE DECK VISUAL OK: light/dark, 390/1280px, panel/settings overflow, icons, reduced motion; screenshots: '+out)
}finally{await browser.close()}
