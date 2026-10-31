import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const harnessRoot = resolve(process.env.DSH_SOURCE || 'D:/deepseek-harness')
const req = createRequire(resolve(harnessRoot, 'package.json'))
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const browser = await chromium.launch({ executablePath: process.env.DSH_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
try {
 const page = await browser.newPage({viewport:{width:1000,height:1000}})
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.setContent('<div id="root"></div><style>body{font:14px system-ui;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-bg-base:#171717;--dsw-alias-bg-layer-1:#222;--dsw-alias-border-l1:#444;--dsw-alias-brand-primary:#c9a227;background:#171717}*{box-sizing:border-box}</style>')
 const base=harnessRoot+'/node_modules/.pnpm/'
 await page.addScriptTag({path:base+'react@18.3.1/node_modules/react/umd/react.development.js'})
 await page.addScriptTag({path:base+'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/umd/react-dom.development.js'})
 await page.evaluate(()=>{window.__ModuleLoader__={load(v){window.entry=v}}})
 await page.addScriptTag({content:readFileSync(new URL('../remote-access/client.js',import.meta.url),'utf8')})
 await page.evaluate(()=>{
 let dict;let component;let face
 window.calls=[];window.model={mode:'ephemeral',configured:false,baseUrl:'',webRunning:true}
 const t=k=>dict.zh[k]||k
 window.entry.factory(()=>React).apply({effect:f=>f(),locale:{register:(_,d)=>{dict=d},bind:()=>t},slots:{inject:(_,f)=>f(),register:(o,c)=>{component=c;face=o.inject()}},connection:{rpc:{call:async(_,e,p)=>{window.calls.push({e,p});if(e.endsWith('/save')){if(p.mode){window.model.mode=p.mode;window.model.configured=p.mode==='persistent'}if(p.baseUrl!==undefined)window.model.baseUrl=p.baseUrl.replace(/\/?$/,'/')}return {ok:true,value:{...window.model}}}}}})
 ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(component,{...face,t}))
 })
 await page.getByText('三步连接手机 / 平板',{exact:true}).waitFor()
 await page.getByRole('radio').nth(1).check()
 await page.getByRole('button',{name:'保存地址',exact:true}).waitFor()
 const field=page.getByRole('textbox',{name:'远程访问地址',exact:true})
 await field.fill('http://100.64.0.1:3080')
 await page.getByRole('button',{name:'保存地址',exact:true}).click()
 await page.waitForFunction(()=>window.model.baseUrl.endsWith('3080/'))
 assert.equal(await page.getByRole('button',{name:'复制登录链接',exact:true}).isEnabled(),true)
 assert.equal(await page.evaluate(()=>window.calls.filter(x=>x.e.endsWith('/save')).at(-1).p.mode),undefined)
 await field.fill('http://100.64.0.2:3080/')
 assert.equal(await page.getByRole('button',{name:'复制登录链接',exact:true}).isDisabled(),true)
 for(const width of [1000,390]){
  await page.setViewportSize({width,height:1000})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 }
 assert.deepEqual(errors,[])
 console.log('Client checks passed: guide, mode, URL-only save, unsaved link guard, desktop/mobile overflow, runtime errors')
}finally{await browser.close()}
