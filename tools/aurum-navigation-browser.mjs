import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire('D:/deepseek-harness/package.json')
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
try {
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.setContent(`<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;font:14px system-ui;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
main{height:100vh;padding:36px 64px}#frame{position:relative;container-type:inline-size;height:760px}#port{height:740px;overflow:auto;padding:0 220px 0 140px}h1{font-size:25px}h2{font-size:20px}p{line-height:1.8}nav{position:absolute;right:12px;top:360px;width:28px;--turn-rail-band:740px}nav>div>button{display:block;width:28px;height:18px;border:0;border-top:2px solid var(--au-gold);background:transparent;cursor:pointer}#dock{height:0}footer{position:absolute;bottom:24px;left:24%;right:24%;height:72px;padding:24px;border:1px solid var(--au-line);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
</style></head><body data-ds-dark-theme><main><div id="frame"><div><nav><div><button data-index="0" aria-current="true" aria-label="第1轮"></button><button data-index="1" aria-label="第2轮"></button></div></nav></div><div><div id="port"><div data-chat-flow><div data-chat-flow-kind="assistant-step" data-chat-turn="0"><h1>优化主题的阅读体验</h1><p>保留暗金仪表的视觉特色，使用中性炭灰背景与暖白文字提升长时间阅读的清晰度。</p><h2>一、正文与侧栏</h2><p style="height:200px">正文、标题和辅助说明使用不同明度，避免小字融入背景。</p><h2>二、回答目录</h2><p style="height:200px">右侧导航可查看回答摘录，并快速跳转到相关章节。</p><h3>交互与键盘操作</h3><p style="height:300px">悬停查看，点击固定，Escape 收起。</p></div></div></div></div></div><div id="dock"></div><footer>输入消息…</footer></main></body></html>`)
const base = 'D:/deepseek-harness/node_modules/.pnpm/'
await page.addScriptTag({ path: base + 'react@18.3.1/node_modules/react/umd/react.development.js' })
await page.addScriptTag({ path: base + 'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/umd/react-dom.development.js' })
await page.evaluate(() => { window.__ModuleLoader__ = { load(entry) { window.themeEntry = entry } } })
await page.addScriptTag({ content: readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8') })
await page.evaluate(() => {
const mod = window.themeEntry.factory(name => name === 'react' ? React : ReactDOM)
const components = new Map()
const labels = {navTitle:'回答概览',navOutline:'本轮回答目录',navEmpty:'尚无回答摘录',navNoHeadings:'本轮回答没有可导航的标题',navUnloaded:'点击右侧轮次标记加载正文后，可查看标题目录',navPin:'固定回答概览',navUnpin:'收起回答概览',navExcerpt:'回答摘录'}
mod.apply({effect(fn){fn()},locale:{register(){},bind(){return key => labels[key] || key}},theme:{overrideTokens(_,tokens){for(const [name,value] of Object.entries(tokens)) document.body.style.setProperty(name,value.dark);return()=>{}}},slots:{inject(_,fn){fn()},register(options,Component){components.set(options.id,Component);return()=>{}}}})
const items = [{turn:0,anchorKey:'one',prompt:'如何保留暗金风格，同时让界面更清晰？',response:'建议将金色集中在仪表、交互强调与选中状态。正文改用暖白，配合中性炭灰背景，并提高辅助说明和代码注释的对比度。'},{turn:1,anchorKey:'two',prompt:'继续优化',response:'新增可固定的回答概览与标题目录。'}]
ReactDOM.createRoot(document.getElementById('dock')).render(React.createElement(components.get('aurum-navigation'),{sessionId:'visual',t:key=>labels[key]||key,useChat:selector=>selector({navigation:{items:()=>items}}),useProjection:()=>[]}))
})
await page.locator('nav[data-aurum-navigation]').waitFor()
assert.equal(await page.locator('.au-nav-pin').count(), 0)
await page.locator('nav button[data-index="0"]').hover()
await page.locator('.au-nav-panel').waitFor({state:'visible'})
const box = await page.locator('.au-nav-panel').boundingBox()
assert(box.x >= 0 && box.y >= 0 && box.y + box.height < 860)
assert.equal(await page.locator('.au-nav-heading').count(),4)
await page.screenshot({path:'D:/CodexData/visualizations/2026/10/31/01a1923f-a290-7d73-8b36-ce8ffcd51056/aurum-navigation-dark.png'})
await page.getByRole('button',{name:'二、回答目录',exact:true}).click()
await page.waitForTimeout(100)
assert(await page.locator('#port').evaluate(el=>el.scrollTop)>200)
assert(await page.locator('.au-nav-panel').isVisible())
await page.getByRole('button',{name:'一、正文与侧栏',exact:true}).click()
assert(await page.locator('.au-nav-panel').isVisible())
await page.mouse.move(100,100)
assert(await page.locator('.au-nav-panel').isHidden())
await page.locator('nav button[data-index="0"]').focus()
await page.locator('.au-nav-panel').waitFor({state:'visible'})
await page.keyboard.press('Escape')

assert(await page.locator('.au-nav-panel').isHidden())
assert.deepEqual(errors,[])
console.log('BROWSER OK: real Chromium layout, headings, scrolling, keyboard; dark preview saved')
} finally {await browser.close()}
