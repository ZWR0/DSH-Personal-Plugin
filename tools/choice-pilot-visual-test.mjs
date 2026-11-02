/** Browser verification of plugin styling on the native question DOM markers. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const req = createRequire(new URL('../../package.json', import.meta.url))
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const theme = readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8')
const tokens = [...theme.matchAll(/'(--dsw-[^']+)': \['([^']*)', '([^']*)'\]/g)]
const source = readFileSync(new URL('../choice-pilot/client.js', import.meta.url), 'utf8')
const out = new URL('./.test-tmp/choice-pilot/', import.meta.url)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
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
  </div><footer>原生选项样式预览 · 已选 2 项</footer></section>`)
  await page.evaluate(() => { window.__ModuleLoader__ = { load(entry) { window.plugin = entry.factory(() => ({})) } } })
  await page.addScriptTag({ content: source })
  await page.evaluate(() => {
    window.plugin.apply({ locale: {register(){return()=>{}}}, slots:{inject(){},register(){}}, effect(start) { window.disposeStyle = start() } })
  })
  for (const dark of [false, true]) {
    await page.evaluate(({ tokens, dark }) => {
      for (const [, key, light, night] of tokens) document.body.style.setProperty(key, dark ? night : light)
    }, { tokens, dark })
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 620 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      const selected = page.locator('[data-option-row]').first()
      const unselected = page.locator('[data-option-row]').last()
      assert.notEqual(await selected.evaluate(el => getComputedStyle(el).backgroundColor), await unselected.evaluate(el => getComputedStyle(el).backgroundColor))
      assert.ok((await selected.locator('button').boundingBox()).height >= 44)
      await page.screenshot({ path: fileURLToPath(new URL(`${dark ? 'dark' : 'light'}-${width}.png`, out)) })
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await page.locator('[data-option-row]').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s')
  await page.evaluate(() => window.disposeStyle())
  assert.equal(await page.locator('style[data-dsh-plugin="choice-pilot"]').count(), 0)
  console.log('CHOICE PILOT VISUAL OK: light/dark, 390/1280px, selected contrast, touch height, reduced motion and unload')
} finally {
  await browser.close()
}
