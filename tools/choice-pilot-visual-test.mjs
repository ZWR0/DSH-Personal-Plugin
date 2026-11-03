import { fileURLToPath } from 'node:url'
import { browserOptions, dependencyPath, harnessRequire } from './test-environment.mjs'
/** Browser verification of followups and unchanged native question styling. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'

const req = harnessRequire
const { chromium } = req('playwright')
const theme = readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8')
const tokens = [...theme.matchAll(/'(--dsw-[^']+)': \['([^']*)', '([^']*)'\]/g)]
const source = readFileSync(new URL('../choice-pilot/client.js', import.meta.url), 'utf8')
const out = new URL('./.test-tmp/choice-pilot/', import.meta.url)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch(browserOptions())
try {
  const page = await browser.newPage()
  await page.setContent(`<style>
     :root{--dsw-radius-md:10px}*{box-sizing:border-box}body{margin:0;padding:24px;font:14px/1.6 system-ui;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
    section{max-width:700px;margin:auto;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:20px;background:var(--dsw-alias-bg-layer-1)}
    h2{font-size:16px;font-weight:500;margin:0 0 6px}p{margin:0 0 16px;color:var(--dsw-alias-label-secondary)}
    [data-option-row]>button{width:100%;padding:12px;text-align:left;border:0;background:transparent;font:inherit;cursor:pointer;border-radius:inherit}
    [data-option-description]{display:block;font-size:13px;padding-left:24px}footer{margin-top:16px;color:var(--dsw-alias-label-secondary)}
  </style><section data-question-key="preview"><h2>接下来希望进行哪些工作？</h2><p>可多选，选好后提交；也可以补充自己的方向</p><div role="group">
    <div data-option-row><button role="checkbox" aria-checked="true">☑ 追踪后续公告（推荐）<span data-option-description>检查官网和论文中的最新进展</span></button></div>
    <div data-option-row><button role="checkbox" aria-checked="true">☑ 整理为研究笔记（推荐）<span data-option-description>汇总与当前研究相关的信息</span></button></div>
    <div data-option-row><button role="checkbox" aria-checked="false">☐ 核对引用来源<span data-option-description>逐条验证作者、链接与发布日期</span></button></div>
  </div><footer>原生选项保持宿主样式 · 已选 2 项</footer></section>`)
  const nativeBefore = await page.locator('[data-option-row]').first().evaluate(el => ({ background: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius, padding: getComputedStyle(el).padding }))
  await page.addScriptTag({ path: dependencyPath('react/umd/react.development.js') })
  await page.addScriptTag({ path: dependencyPath('react-dom/umd/react-dom.development.js') })
  await page.evaluate(() => { window.__ModuleLoader__ = { load(entry) { window.plugin = entry.factory(() => React) } } })
  await page.addScriptTag({ content: source })
  await page.evaluate(() => {
    let dictionaries
    let Followups
    window.plugin.apply({ locale: {register(_name, value){dictionaries=value;return()=>{}}}, slots:{inject(_name, start){start()},register(options, component){if(options.id==='choice-pilot-followups')Followups=component}}, effect(start) { window.disposeStyle = start() } })
    const mount = document.createElement('div')
    mount.style.cssText = 'max-width:700px;margin:16px auto'
    document.body.appendChild(mount)
    const input = document.createElement('textarea')
    input.setAttribute('aria-label', 'Draft')
    input.style.cssText = 'display:block;width:100%;max-width:700px;margin:auto;min-height:100px;font:inherit'
    input.value = '已有草稿，请保留'
    document.body.appendChild(input)
    const chat = { order:['f'], nodes:new Map([['f',{kind:'tool-call',data:{root:{kind:'tool-result',name:'suggest_followups',seq:3,callId:'f',isError:false,subCalls:[],meta:{choicePilotFollowups:[{label:'检查本地模型配置',prompt:'请检查本地模型的架构与速度差异，不修改配置。'},{label:'解读我提供的配置',prompt:'我会提供配置片段，请据此分析模型架构。'}]}}}}]]) }
    ReactDOM.createRoot(mount).render(React.createElement(Followups, {sessionId:'preview',t:key=>dictionaries.zh[key],useChat:selector=>selector(chat),useInput:selector=>selector({phase:'plain',draft:input.value,attachmentIds:[]}),inputActions:{captureInsertion:()=>({start:input.value.length,end:input.value.length,draftRev:1}),insertText(text){input.value+=text;return true},persistDraft(){},submit(){throw Error('Must not send')}}}))
  })
  await page.locator('.cp-followups button').first().waitFor()
  for (const dark of [false, true]) {
    await page.evaluate(({ tokens, dark }) => {
      for (const [, key, light, night] of tokens) document.body.style.setProperty(key, dark ? night : light)
    }, { tokens, dark })
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 620 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      const selected = page.locator('[data-option-row]').first()
      assert.deepEqual(await selected.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, radius: getComputedStyle(el).borderRadius, padding: getComputedStyle(el).padding })), nativeBefore, 'Choice Pilot does not override the official question card')
      assert.ok((await page.locator('.cp-followups button').first().boundingBox()).height >= 44)
      await page.screenshot({ path: fileURLToPath(new URL(`${dark ? 'dark' : 'light'}-${width}.png`, out)), fullPage: true })
    }
  }
  assert.equal(await page.getByRole('textbox', {name:'Draft'}).inputValue(), '已有草稿，请保留')
  await page.locator('.cp-followups button').first().click()
  assert.match(await page.getByRole('textbox', {name:'Draft'}).inputValue(), /已有草稿，请保留.*请检查本地模型/s)
  assert.equal(await page.locator('.cp-followups button').first().isDisabled(), true)
  assert.match(await page.locator('.cp-followups [role=status]').textContent(), /手动发送/)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('[data-option-row]').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s')
  await page.evaluate(() => window.disposeStyle())
  assert.equal(await page.locator('style[data-dsh-plugin="choice-pilot"]').count(), 0)
  console.log('CHOICE PILOT VISUAL OK: unchanged official cards, followups in light/dark at 390/1280px, touch height, draft preservation, reduced motion and unload')
} finally {
  await browser.close()
}
