import { fileURLToPath } from 'node:url'
import { browserOptions, dependencyPath, harnessRequire } from './test-environment.mjs'
/** Render real plugin components with isolated sessions; never issue a delete. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
const req = harnessRequire
const { chromium } = req('playwright')
const output = new URL('./.test-tmp/experience/', import.meta.url)
mkdirSync(output, { recursive: true })
const theme = readFileSync(new URL('../aurum-theme/client.js', import.meta.url), 'utf8')
const tokens = [...theme.matchAll(/'(--dsw-[^']+)': \['([^']*)', '([^']*)'\]/g)]
const browser = await chromium.launch(browserOptions())
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<style>body{margin:0;font:14px system-ui;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}*{box-sizing:border-box}</style><div data-chat-flow-kind="assistant-step"><p id="quote-source">需要核对的研究结论</p></div><div id="mount"></div>')
  await page.addScriptTag({ path: dependencyPath('react/umd/react.development.js') })
  await page.addScriptTag({ path: dependencyPath('react-dom/umd/react-dom.development.js') })
  await page.evaluate(() => { window.plugins = {}; window.__ModuleLoader__ = { load(entry) { plugins[entry.id] = entry } } })
  for (const plugin of ['quote-relay', 'session-reaper', 'choice-pilot']) await page.addScriptTag({ content: readFileSync(new URL(`../${plugin}/client.js`, import.meta.url), 'utf8') })
  await page.evaluate(() => {
    window.entries = {}; window.disposers = []; window.deleteCalls = 0
    const catalog = { ids: ['a', 'b', 'run'], byId: {
      a: { id: 'a', displayTitle: '文献整理与来源核对', cwd: '/research', running: false, updatedAt: 1 },
      b: { id: 'b', displayTitle: '插件布局与交互优化', cwd: '/work', running: false, updatedAt: 1 },
      run: { id: 'run', displayTitle: '正在运行的任务', cwd: '/work', running: true, updatedAt: 1 },
    } }
    for (const entry of Object.values(plugins)) {
      let dict
      const ctx = {
        effect(start) { const dispose = start(); if (typeof dispose === 'function') disposers.push(dispose) },
        locale: { register(_, value) { dict = value; return () => {} }, bind() { return (key, values = {}) => dict.zh[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '') } },
        slots: { inject(_, register) { register() }, register(options, component) { entries[options.name + ':' + options.id] = { component, t: (key, values = {}) => dict.zh[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '') }; return () => {} } },
        sessions: { list: { getSnapshot: () => catalog, subscribe: () => () => {} }, refresh: async () => {} },
        uiSession: { adapter: { current: { getSnapshot: () => ({ key: 'a' }) } } }, uiWorkspace: {},
        connection: { rpc: { call: async () => { deleteCalls++; throw Error('Deletion forbidden in visual preview') } } },
      }
      entry.factory(name => name === 'react' ? React : ReactDOM).apply(ctx)
    }
    window.root = ReactDOM.createRoot(document.getElementById('mount'))
    window.showHistory = () => {
      const item = entries['conversation.input.dock:choice-pilot-history']
      const chat = { order: ['reply'], nodes: { get: () => ({ key: 'reply', kind: 'question-reply', data: { callId: 'record', questions: [{id:'next',question:'接下来进行哪些工作？'}], answers: [{id:'next',selected:['追踪公告','整理笔记'],custom:'只使用公开来源'}] } }) } }
      root.render(React.createElement(item.component, { sessionId:'a', t:item.t, useChat:selector=>selector(chat) }))
    }
    window.showCleanup = () => root.render(React.createElement(React.Fragment, null,
      React.createElement(entries['plugins.tab:session-reaper'].component), React.createElement(entries['shell.overlay:session-reaper.notice'].component)))
    window.showQuote = () => {
      const item = entries['conversation.input.right:quote-relay']
      root.render(React.createElement(item.component, { t: item.t, sessionId: 'a', useInput: selector => selector({ draft: '' }), inputActions: { insertQuote: () => true } }))
    }
  })
  for (const dark of [false, true]) {
    await page.evaluate(({ tokens, dark }) => {
      for (const [, key, light, night] of tokens) document.body.style.setProperty(key, dark ? night : light)
      document.body.toggleAttribute('data-ds-dark-theme', dark)
    }, { tokens, dark })
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await page.evaluate(() => showCleanup())
      await page.locator('.sr-row').first().waitFor()
      assert.equal(await page.locator('.sr-row').count(), 2)
      await page.locator('.sr-row input').first().check()
      await page.locator('.sr-panel button').click()
      await page.getByRole('dialog').waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ animations: 'disabled', path: fileURLToPath(new URL(`cleanup-${dark ? 'dark' : 'light'}-${width}.png`, output)) })
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'detached' })
      await page.evaluate(() => showQuote())
      await page.evaluate(() => {
        const range = document.createRange(); range.selectNodeContents(document.getElementById('quote-source'))
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
      })
      await page.getByRole('button', { name: /^引用 \d+ 字$/ }).waitFor()
      assert.equal(await page.locator('.qr-btn').count(),1)
      assert.equal(await page.locator('.qr-tray').count(),0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ animations: 'disabled', path: fileURLToPath(new URL(`quotes-${dark ? 'dark' : 'light'}-${width}.png`, output)) })
      await page.evaluate(() => showHistory())
      await page.locator('.cp-history summary').click()
      assert.match(await page.locator('.cp-history').textContent(), /追踪公告.*整理笔记.*只使用公开来源/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ animations: 'disabled', path: fileURLToPath(new URL(`choices-${dark ? 'dark' : 'light'}-${width}.png`, output)) })
    }
  }
  assert.equal(await page.evaluate(() => deleteCalls), 0)
  assert.deepEqual(errors, [])
  await page.evaluate(() => { root.unmount(); disposers.reverse().forEach(dispose => dispose()) })
  console.log('EXPERIENCE VISUAL OK: real cleanup/quote components, light/dark, 390/1280px, dialog dismissal, no deletion')
} finally { await browser.close() }
