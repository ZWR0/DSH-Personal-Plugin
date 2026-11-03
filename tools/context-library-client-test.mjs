import { browserOptions, dependencyPath, harnessRequire } from './test-environment.mjs'
/** Real browser rendering of the settings page and composer preview with mocked Host replies. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const req = harnessRequire
const { chromium } = req('playwright')
const browser = await chromium.launch(browserOptions())
const importFolder = await mkdtemp(join(tmpdir(),'context-folder-import-'))
await writeFile(join(importFolder,'user_profile.md'),'# Owner\nResearcher.')
const now = new Date().toISOString()
const settings = {
  version: 1, enabled: true, mode: 'supplement', strategy: 'auto', root: 'D:\\lib\\context-library',
  budgetTokens: 4000, perType: { identity: 1200, projects: 1500, decisions: 1200, long_term: 1000 },
  catalogBudget: 600, suggestions: true,
}
const entries = [
  { id: 'identity', type: 'identity', title: '身份', status: 'active', scope: 'global', projectPath: '', enabled: true, key: true, version: '1111aaaa', characters: 18, bytes: 80, preview: '称呼：小林，偏好中文。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\identity.md', relPath: 'identity.md' },
  { id: 'alpha', type: 'projects', title: 'Alpha 项目', status: 'active', scope: 'project', projectPath: 'D:\\work\\alpha', enabled: true, key: true, version: '2222bbbb', characters: 1234, bytes: 140, preview: 'Alpha 的目标与当前状态。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\projects\\alpha.md', relPath: 'projects/alpha.md' },
  { id: 'beta', type: 'projects', title: 'Beta 项目', status: 'active', scope: 'project', projectPath: 'D:\\work\\beta', enabled: true, key: true, version: '3333cccc', bytes: 90, preview: 'Beta 项目。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\projects\\beta.md', relPath: 'projects/beta.md' },
  { id: 'db', type: 'decisions', title: '数据库选型', status: 'active', scope: 'global', projectPath: '', enabled: true, key: true, version: '4444dddd', bytes: 60, preview: '使用 PostgreSQL。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\decisions\\db.md', relPath: 'decisions/db.md' },
]
const proposal = {
  id: 'p-123e4567-e89b-12d3-a456-426614174000', createdAt: now, expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  status: 'pending', kind: 'update', type: 'projects', entryId: 'alpha', title: 'Alpha 项目',
  scope: 'project', projectPath: 'D:\\work\\alpha', statusAfter: 'active', enabled: true, key: true,
  reason: '用户确认 Alpha 现在只做导出。', evidence: [{ kind: 'user-stated', note: '用户：Alpha 现在只做导出。' }],
  baseHash: 'hash-base', baseVersion: '2222bbbb',
  before: '---\nid: alpha\ntitle: Alpha 项目\n---\n\nAlpha 的旧说明。\n',
  after: '---\nid: alpha\ntitle: Alpha 项目\n---\n\nAlpha 的新说明：只做导出。\n',
  afterBody: 'Alpha 的新说明：只做导出。',
  predictedEffect: { loads: true, note: '会话工作目录匹配时加载。' },
  dedupeKey: 'dedupe-1',
}
const replacement = {
  mode: 'supplement', enabled: true,
  sections: [{ section: 'harness:identity', active: false, attachedSessions: [], errors: [] }, { section: 'deployment:persona-suffix', active: false }],
  preserved: [], note: 'Custom mode replaces only harness:identity.',
}
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 980 } })
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error('PAGEERROR:', error.stack || error.message) })
  page.on('console', message => { if (message.type() === 'error') console.error('CONSOLE:', message.text()) })
  await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;padding:28px max(20px,calc((100vw - 1020px)/2));font:14px system-ui;background:#151617;color:#f3f2ee;--dsw-alias-label-primary:#f3f2ee;--dsw-alias-label-secondary:#cccac3;--dsw-alias-bg-base:#151617;--dsw-alias-bg-layer-1:#1d1e20;--dsw-alias-bg-layer-2:#252629;--dsw-alias-border-l1:#353639;--dsw-alias-border-l2:#424347;--dsw-alias-border-l3:#505155;--dsw-alias-state-error-primary:#ee9c8c;--dsw-alias-state-business-primary:#e3c45f}input{accent-color:#c9a227}button{white-space:nowrap}</style></head><body><div id="root"></div></body></html>`)
    await page.addScriptTag({ path: dependencyPath('react/umd/react.development.js') })
  await page.addScriptTag({ path: dependencyPath('react-dom/umd/react-dom.development.js') })
  await page.evaluate(() => { window.__ModuleLoader__ = { load(value) { window.entry = value } } })
  await page.addScriptTag({ content: readFileSync(new URL('../context-library/client.js', import.meta.url), 'utf8') })
  await page.evaluate(() => {
    const components = {}
    let dict
    const t = (key, values = {}) => (dict.zh[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '')
    const plugin = window.entry.factory(name => name === 'react' ? React : ReactDOM)
    plugin.apply({
      effect: fn => fn(),
      locale: { register(_, value) { dict = value }, bind: () => t, resolveText: value => value },
      slots: {
        inject(name, fn) { fn() },
        register(options, component) {
          components[options.name] = { component, face: options.inject ? options.inject() : {} }
          return () => {}
        },
      },
      connection: { rpc: { call: () => Promise.reject(new Error('mock not ready')) } },
      uiWorkspace: { pickDirectory: async () => 'D:\\work\\alpha' },
      uiSession: { adapter: { current: { getSnapshot: () => ({ key: 'session-test' }) } } },
    })
    window.__components = components
    window.__t = t
  })
  // Functions cannot cross the evaluate boundary; rebuild the mock in page scope.
  await page.evaluate(({ settings, entries, proposal, replacement, now }) => {
    window.__calls = []
    const ok = value => ({ ok: true, value })
    const mock = {
      tree: () => ok({ build: '0.6.2-document-composition', root: settings.root, entries, warnings: [{ path: 'projects/legacy.md', code: 'entry/format', message: '缺少元数据块。' }], pending: [proposal], pendingWarnings: [], settings, replacement, tokenMethod: 'native-token-meter' }),
      importPreview: payload => ok({ planId: 'import-test', items: [{ id: 'owner-profile', type: 'long_term', title: '我的资料（Owner）', enabled: true, action: 'create', sources: payload.documents.map(doc => doc.path), preview: 'Owner background' }], ignored: [] }),
      importApply: () => ok({ saved: [{ id: 'owner-profile', type: 'long_term' }], failed: [], ignored: [] }),
      entry: payload => ok({ entry: { ...entries.find(item => item.id === payload.id), body: 'Alpha 的正文内容。' }, history: [{ file: '2026__2222bbbb.md', version: '2222bbbb', savedAt: now, actor: 'user', reason: '' }] }),
      save: payload => ok({ entry: { ...entries[1], version: '9999eeee', title: payload.title }, version: '9999eeee', created: false, unchanged: false }),
      saveSettings: payload => { Object.assign(settings, { ...payload, perType: { ...settings.perType, ...(payload.perType || {}) } }); return ok({ settings, root: settings.root, previousRoot: settings.root, changedRoot: false, note: '' }) },
      pending: () => ok({ proposals: [proposal], warnings: [] }),
      decide: payload => ok({ proposal: { ...proposal, status: payload.action === 'approve' ? 'applied' : 'deferred' } }),
      rebase: () => ok({ proposal: { ...proposal, baseHash: 'hash-new', baseVersion: '7777ffff' } }),
      count: () => ok({ count: 1 }),
      plan: () => ok({
        session: { id: 'session-test', live: true, cwd: 'D:\\work\\alpha', customActive: false, agentStatus: 'idle', customError: null, lastProvider: null },
        plan: {
          at: now, planId: 'p-123456789abc', mode: 'supplement', strategy: 'auto', enabled: true, customActive: false,
          identityReplaced: false, tokenMethod: 'native-token-meter', used: 812,
          budget: { total: 4000, catalog: 120, overhead: 80, byType: {} },
          project: { cwd: 'D:\\work\\alpha', paths: ['D:\\work\\alpha'] },
          loaded: [
            { id: 'identity', type: 'identity', title: '身份', scope: 'global', projectPath: '', version: '1111aaaa', relPath: 'identity.md', preview: '称呼：小林，偏好中文。', tokens: 200, status: 'loaded' },
            { id: 'alpha', type: 'projects', title: 'Alpha 项目', scope: 'project', projectPath: 'D:\\work\\alpha', version: '2222bbbb', relPath: 'projects/alpha.md', preview: 'Alpha 的目标与当前状态。', tokens: 320, status: 'loaded' },
          ],
          items: [], catalogIncluded: [], catalogOmitted: 0,
          omitted: [{ id: 'beta', type: 'projects', title: 'Beta 项目', version: '3333cccc', reason: 'other-project', tokens: 0 }],
          warnings: [],
        },
        last: null, pendingCount: 1, replacement, settings, warning: null,
      }),
    }
    window.__mock = mock
    window.__call = (endpoint, payload) => {
      window.__calls.push({ endpoint, payload })
      const fn = mock[endpoint]
      if (!fn) return Promise.reject(new Error('no mock for ' + endpoint))
      const answer = fn(payload)
      if (!answer.ok) return Promise.reject(new Error(answer.error?.message || answer.error?.code || 'mock failed'))
      return Promise.resolve(answer.value)
    }
    // Rebind the already-created faces to this in-page mock.
    for (const [name, component] of Object.entries(window.__components)) {
      component.face.call = window.__call
    }
    window.__settings = window.__components['plugins.tab']
    window.__composer = window.__components['conversation.input.left']
  }, { settings, entries, proposal, replacement, now })

  // Settings page
  await page.evaluate(() => {
    window.__root = ReactDOM.createRoot(document.getElementById('root'))
    window.__root.render(React.createElement(window.__settings.component, { ...window.__settings.face, t: window.__t, close() {} }))
  })
  await page.getByRole('heading', { name: /^知忆书阁$/ }).waitFor()
  await page.getByText('D:\\lib\\context-library', { exact: true }).waitFor()
  assert.equal(await page.locator('.cl-budget').count(), 0)
  assert.equal(await page.getByText('总预算（tokens）', { exact: true }).count(), 0)
  assert.equal(await page.getByText('仅保存有明确陈述或确认依据的新增和更新', { exact: false }).count(), 0)
  const autoSave = page.getByRole('switch', { name: '自动记忆', exact: true })
  assert((await autoSave.boundingBox()).height >= 44)
  await autoSave.click()
  await page.waitForFunction(() => document.querySelector('.cl-autosave')?.getAttribute('aria-checked') === 'true')
  assert.equal(await page.evaluate(() => window.__calls.filter(c => c.endpoint === 'saveSettings').at(-1).payload.autoSave), true)
  await mkdir('DSH-Personal-Plugin/tools/.test-tmp/ui-refinement', { recursive: true })
  const originalStyle = await page.locator('body').getAttribute('style')
  for (const [theme, width] of [['dark', 1180], ['dark', 390], ['light', 1180], ['light', 390]]) {
    await page.setViewportSize({ width, height: 900 })
    if (theme === 'light') await page.evaluate(() => {
      Object.assign(document.body.style, { background: '#faf9f6', color: '#24221c' })
      for (const [key, value] of Object.entries({ '--dsw-alias-label-primary': '#24221c', '--dsw-alias-label-secondary': '#605b50', '--dsw-alias-bg-base': '#faf9f6', '--dsw-alias-bg-layer-1': '#ffffff', '--dsw-alias-bg-layer-2': '#f4f1e9', '--dsw-alias-border-l1': '#e4dfd3', '--dsw-alias-border-l2': '#d7cebb' })) document.body.style.setProperty(key, value)
    })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    const row = await page.locator('.cl-memory-head').boundingBox()
    if (width > 600) assert(row.height <= 48, 'round inputs and the switch share one compact row')
    await page.locator('.cl-memory-settings').screenshot({ path: `DSH-Personal-Plugin/tools/.test-tmp/ui-refinement/memory-${theme}-${width}.png` })
  }
  await page.locator('body').evaluate((element, style) => { if (style === null) element.removeAttribute('style'); else element.setAttribute('style', style) }, originalStyle)
  await page.setViewportSize({ width: 1180, height: 980 })
  await autoSave.press('Space')
  await page.waitForFunction(() => document.querySelector('.cl-autosave')?.getAttribute('aria-checked') === 'false')
  await page.getByRole('group',{name:'加载策略',exact:true}).getByRole('button',{name:'仅目录',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.endpoint==='saveSettings').at(-1).payload.suggestions),false)
  await page.getByRole('group',{name:'加载策略',exact:true}).getByRole('button',{name:'自动',exact:true}).click()
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.endpoint==='saveSettings').at(-1).payload.suggestions),true)
  assert.equal(await page.getByRole('button',{name:'导入 Markdown',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'我的资料（Owner）',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'添加长期记忆',exact:true}).count(),0)
  await page.locator('input[type=file]').setInputFiles(importFolder)
  await page.getByText('导入预览', { exact: true }).waitFor()
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await page.getByText('已导入 1 条', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'importApply' && c.payload.planId === 'import-test')), true)
  await page.getByRole('button', { name: /^项目 2$/ }).click()
  assert.match(await page.getByRole('listitem').filter({ hasText: 'Alpha 项目' }).textContent(), /1,234 字符/)
  assert.doesNotMatch(await page.getByRole('listitem').filter({ hasText: 'Alpha 项目' }).textContent(), /v2222bbbb/)
  await page.getByRole('listitem').filter({ hasText: 'Alpha 项目' }).click()
  await page.locator('.cl-field textarea').waitFor()
  await page.locator('.cl-field textarea').fill('Alpha 的正文内容（浏览器改写）。')
  assert.equal(await page.getByRole('button',{name:'内容预览',exact:true}).count(),0)
  assert.equal(await page.getByRole('button',{name:'编辑',exact:true}).count(),0)
  await page.getByRole('combobox',{name:'作用域',exact:true}).selectOption('global')
  assert.equal(await page.getByRole('listitem').count(),0)
  await page.getByRole('combobox',{name:'作用域',exact:true}).selectOption('all')
  assert.equal(await page.getByRole('listitem').count(),2)
  assert.equal(await page.locator('.cl-field textarea').inputValue(),'Alpha 的正文内容（浏览器改写）。')
  await page.locator('.cl-main summary').filter({hasText:'条目属性'}).click()
  await page.locator('.cl-main .cl-field').filter({hasText:'作用域'}).locator('select').selectOption('project')
  await page.getByRole('button',{name:'选择项目目录',exact:true}).click()
  await page.getByRole('switch',{name:'启用加载',exact:true}).uncheck()
  await page.getByRole('switch',{name:'启用加载',exact:true}).check()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'save' && c.payload.expectedVersion === '2222bbbb')), true)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'save' && c.payload.body.includes('浏览器改写'))), true)
  await page.locator('.cl-main summary').filter({hasText:'条目属性'}).click()
  await page.locator('.cl-loading-settings .cl-help').first().focus()
  assert.equal(await page.locator('.cl-loading-settings .cl-help').first().locator('.cl-tooltip').isVisible(),true)
  await page.getByRole('heading',{name:'加载设置',exact:true}).click()
  await page.screenshot({path:'tools/shot-context-library-compact-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:900})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'tools/shot-context-library-compact-mobile.png',fullPage:true})
  await page.setViewportSize({width:1180,height:980})
  await page.getByRole('button',{name:/^身份 1$/}).click()
  await page.getByRole('button',{name:'新建身份',exact:true}).click()
  await page.locator('.cl-field textarea').fill('New identity draft')
  assert.equal(await page.locator('.cl-field textarea').inputValue(),'New identity draft')
  assert.equal(await page.getByRole('button',{name:'内容预览',exact:true}).count(),0)

  await page.getByRole('button', { name: /^待审修订 1$/ }).click()
  await page.getByText('用户确认 Alpha 现在只做导出。').waitFor()
  await page.getByRole('button', { name: '同意', exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'decide' && c.payload.action === 'approve' && c.payload.expectedBaseHash === 'hash-base')), true)

  assert.equal(await page.getByText('实际替换范围',{exact:true}).count(),0)
  assert.equal(await page.locator('.cl-main summary').filter({hasText:'高级设置'}).count(),0)
  assert.equal(await page.locator('.cl-workspace').evaluate(el=>getComputedStyle(el).display),'flex')

  await page.setViewportSize({ width: 520, height: 900 })
  const wide = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter(element => element.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 12)
    .map(element => ({ tag: element.tagName, cls: element.className, right: Math.round(element.getBoundingClientRect().right), text: (element.textContent || '').slice(0, 40) })))
  if (wide.length > 0) console.log('OVERFLOW', JSON.stringify(wide))
  const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, inner: window.innerWidth, body: document.body.scrollWidth }))
  console.log('NARROW', JSON.stringify(metrics))
  const scrollables = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter(element => element.scrollWidth > element.clientWidth + 1)
    .slice(0, 12)
    .map(element => ({ tag: element.tagName, cls: element.className, sw: element.scrollWidth, cw: element.clientWidth, text: (element.textContent || '').slice(0, 50) })))
  if (scrollables.length) console.log('SCROLLABLE', JSON.stringify(scrollables))
  assert(metrics.scrollWidth <= metrics.inner)
  await page.screenshot({ path: 'tools/shot-context-library-settings.png', fullPage: true })
  await page.setViewportSize({ width: 1180, height: 980 })

  await page.evaluate(() => {
    const original = window.__mock.tree
    window.__mock.tree = () => {
      const result = original()
      return { ...result, value: { ...result.value, build: 'old-host', entries: result.value.entries.map(entry => entry.type === 'identity' ? { ...entry, error: '缺少元数据块（文件必须以 --- 开头）。', enabled: false } : entry) } }
    }
    window.__root.unmount()
    window.__root = ReactDOM.createRoot(document.getElementById('root'))
    window.__root.render(React.createElement(window.__settings.component, { ...window.__settings.face, t: window.__t, close() {} }))
  })
  await page.getByText(/界面与后端版本不一致/).waitFor()
  await page.getByText(/身份未加载：缺少元数据块/).waitFor()
  assert.equal(await page.getByRole('listitem').filter({ hasText: '缺少元数据块' }).count(), 1)

  // Composer preview
  await page.getByRole('button', { name: /^待审修订/ }).click()
  const reviewCard = page.locator('.cl-pending-card').first()
  await reviewCard.waitFor()
  assert.match(await reviewCard.textContent(), /新增 1 行 · 删除 1 行/)
  await reviewCard.getByRole('button', { name: '编辑提案内容', exact: true }).click()
  await reviewCard.locator('textarea').fill('用户手动修订的记忆')
  assert.match(await reviewCard.textContent(), /本次手动修改/)
  assert.match(await reviewCard.locator('.cl-diff').first().textContent(), /用户手动修订的记忆/)
  await page.evaluate(() => { window.__mock.decide = () => ({ok:true,value:{conflict:true,currentVersion:'changed'}}) })
  await reviewCard.getByRole('button', { name: '编辑后同意', exact: true }).click()
  await reviewCard.getByText('文件已在审批期间被修改', { exact: true }).waitFor()
  assert.equal(await reviewCard.getByRole('button', { name: '编辑后同意', exact: true }).isDisabled(), true)

  await page.evaluate(() => {
    window.__root.unmount()
    console.log('BODY?', !!document.body, document.body && document.body.tagName)
    window.__root = ReactDOM.createRoot(document.getElementById('root'))
    window.__root.render(React.createElement(window.__composer.component, { ...window.__composer.face, t: window.__t }))
  })
  await page.getByRole('button', { name: /知忆书阁/ }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByText('文档合计', { exact: true }).waitFor()
  assert.match(await page.locator('.cl-preload-total').textContent(), /520 tokens/)
  assert.equal(await page.locator('.cl-composition>span').count(), 2)
  const usage = await page.locator('.cl-preload-document').allTextContents()
  assert.match(usage[0], /200tokens · 38.5%/)
  assert.match(usage[1], /320tokens · 61.5%/)
  assert.equal(await page.locator('.cl-dialog .cl-details').count(), 0)
  assert.equal(await page.getByText('未加载与提示', { exact: true }).count(), 0)
  assert((await page.locator('.cl-dialog').boundingBox()).width <= 480)
  for (const width of [390, 1180]) {
    await page.setViewportSize({ width, height: 850 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.cl-dialog').screenshot({ path: `DSH-Personal-Plugin/tools/.test-tmp/ui-refinement/preload-${width}.png` })
  }
  await page.evaluate(() => {
    const original = window.__mock.plan
    window.__mock.plan = () => {
      const value = original()
      value.value.plan.loaded = value.value.plan.loaded.filter(item => item.id !== 'identity')
      value.value.plan.items = [{ id: 'identity', type: 'identity', title: '身份', tokens: 160, status: 'replaced' }]
      return value
    }
  })
  await page.getByRole('button', { name: '重新计算', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.cl-preload-total')?.textContent.includes('480 tokens'))
  assert.equal(await page.locator('.cl-preload-document').count(), 2, 'custom identity is included exactly once')
  await page.evaluate(() => { window.__mock.plan = () => ({ ok: true, value: { plan: { loaded: [], items: [], tokenMethod: 'native-token-meter' }, session: {} } }) })
  await page.getByRole('button', { name: '重新计算', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.cl-preload-total')?.textContent.includes('0 tokens'))
  assert.equal(await page.locator('.cl-composition').count(), 0, 'empty plans have no invalid percentage segments')
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.evaluate(() => {
    const dock = window.__components['conversation.input.dock']
    window.__mock.decide = payload => ({ ok: true, value: { proposal: { id: payload.id, status: 'applied' } } })
    window.__root.render(React.createElement(dock.component, { ...dock.face, t: window.__t, sessionId: 'session-test', useChat: f => f({ order: [], nodes: new Map() }) }))
  })
  // Pending entries belong to their originating chat, including on the first mount.
  assert.equal(await page.locator('.cl-pending-card').count(), 0)
  await page.evaluate(() => {
    const dock = window.__components['conversation.input.dock']
    const old = window.__mock.pending
    window.__mock.pending = () => { const answer = old(); answer.value.proposals[0].source = { sessionId: 'session-test' }; return answer }
    window.__root.render(React.createElement(dock.component, { ...dock.face, t: window.__t, sessionId: 'session-test', useChat: f => f({ order: ['t'], nodes: new Map([['t', { kind: 'tool-call', data: { root: { kind: 'tool-result', name: 'context_library_propose', seq: 1 } } }]]) }) }))
  })
  await page.locator('.cl-pending-card').waitFor()
  await page.getByRole('button', { name: '同意', exact: true }).click()
  await page.locator('.cl-pending-card').waitFor({ state: 'detached' })
  assert.equal(await page.evaluate(() => window.__calls.some(item => item.endpoint === 'decide' && item.payload.action === 'approve' && item.payload.expectedBaseHash === 'hash-base')), true)
  assert.deepEqual(errors, [])
  console.log('CONTEXT LIBRARY CLIENT BROWSER OK: settings editor, pending approval, compact settings, automatic suggestions, single-column editor, integrated properties, direct body editing and compact scope filter, folder-only import, composer preview, Escape close, narrow layout; screenshots saved')
} finally {
  await browser.close()
  await rm(importFolder,{recursive:true,force:true})
}
