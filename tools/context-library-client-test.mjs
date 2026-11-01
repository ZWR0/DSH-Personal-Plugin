/** Real browser rendering of the settings page and composer preview with mocked Host replies. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const req = createRequire('D:/deepseek-harness/package.json')
const { chromium } = req('./node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.js')
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
const now = new Date().toISOString()
const settings = {
  version: 1, enabled: true, mode: 'supplement', strategy: 'auto', root: 'D:\\lib\\context-library',
  budgetTokens: 4000, perType: { identity: 1200, projects: 1500, decisions: 1200, long_term: 1000 },
  catalogBudget: 600, suggestions: true,
}
const entries = [
  { id: 'identity', type: 'identity', title: '身份', status: 'active', scope: 'global', projectPath: '', enabled: true, key: true, version: '1111aaaa', bytes: 80, preview: '称呼：小林，偏好中文。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\identity.md', relPath: 'identity.md' },
  { id: 'alpha', type: 'projects', title: 'Alpha 项目', status: 'active', scope: 'project', projectPath: 'D:\\work\\alpha', enabled: true, key: true, version: '2222bbbb', bytes: 140, preview: 'Alpha 的目标与当前状态。', error: null, warnings: [], createdAt: now, updatedAt: now, path: 'D:\\lib\\context-library\\projects\\alpha.md', relPath: 'projects/alpha.md' },
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
  const base = 'D:/deepseek-harness/node_modules/.pnpm/'
  await page.addScriptTag({ path: base + 'react@18.3.1/node_modules/react/umd/react.development.js' })
  await page.addScriptTag({ path: base + 'react-dom@18.3.1_react@18.3.1/node_modules/react-dom/umd/react-dom.development.js' })
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
      tree: () => ok({ build: '0.3.0-easy-library', root: settings.root, entries, warnings: [{ path: 'projects/legacy.md', code: 'entry/format', message: '缺少元数据块。' }], pending: [proposal], pendingWarnings: [], settings, replacement, tokenMethod: 'native-token-meter' }),
      importPreview: payload => ok({ planId: 'import-test', items: [{ id: 'owner-profile', type: 'long_term', title: '我的资料（Owner）', enabled: true, action: 'create', sources: payload.documents.map(doc => doc.path), preview: 'Owner background' }], ignored: [] }),
      importApply: () => ok({ saved: [{ id: 'owner-profile', type: 'long_term' }], failed: [], ignored: [] }),
      entry: payload => ok({ entry: { ...entries.find(item => item.id === payload.id), body: 'Alpha 的正文内容。' }, history: [{ file: '2026__2222bbbb.md', version: '2222bbbb', savedAt: now, actor: 'user', reason: '' }] }),
      save: payload => ok({ entry: { ...entries[1], version: '9999eeee', title: payload.title }, version: '9999eeee', created: false, unchanged: false }),
      saveSettings: payload => ok({ settings: { ...settings, ...payload, perType: { ...settings.perType, ...(payload.perType || {}) } }, root: settings.root, previousRoot: settings.root, changedRoot: false, note: '' }),
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
    window.__settings = window.__components['settings.section']
    window.__composer = window.__components['conversation.input.right']
  }, { settings, entries, proposal, replacement, now })

  // Settings page
  await page.evaluate(() => {
    window.__root = ReactDOM.createRoot(document.getElementById('root'))
    window.__root.render(React.createElement(window.__settings.component, { ...window.__settings.face, t: window.__t, close() {} }))
  })
  await page.getByRole('heading', { name: /^知忆书阁$/ }).waitFor()
  await page.locator('details > summary').filter({ hasText: '高级设置' }).first().click()
  await page.getByText('D:\\lib\\context-library', { exact: true }).waitFor()
  await page.getByRole('button', { name: '我的资料（Owner）', exact: true }).click()
  assert.equal(await page.locator('.cl-field textarea').inputValue(), '## 如何称呼我\n\n## 我的背景\n\n## 稳定偏好\n')
  await page.locator('.cl-field textarea').fill('Owner prefers Chinese.')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'save' && c.payload.id === 'owner-profile' && c.payload.type === 'long_term' && c.payload.enabled)), true)
  await page.locator('input[type=file]').first().setInputFiles({ name: 'user_profile.md', mimeType: 'text/markdown', buffer: Buffer.from('# Owner\nResearcher.') })
  await page.getByText('导入预览', { exact: true }).waitFor()
  await page.getByRole('button', { name: '确认导入', exact: true }).click()
  await page.getByText('已导入 1 条', { exact: true }).waitFor()
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'importApply' && c.payload.planId === 'import-test')), true)
  await page.getByRole('button', { name: /^项目 2$/ }).click()
  await page.getByRole('listitem').filter({ hasText: 'Alpha 项目' }).click()
  await page.getByText('Alpha 的正文内容。').waitFor()
  await page.locator('.cl-field textarea').fill('Alpha 的正文内容（浏览器改写）。')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'save' && c.payload.expectedVersion === '2222bbbb')), true)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'save' && c.payload.body.includes('浏览器改写'))), true)

  await page.getByRole('button', { name: /^待审修订 1$/ }).click()
  await page.getByText('用户确认 Alpha 现在只做导出。').waitFor()
  await page.getByRole('button', { name: '同意', exact: true }).click()
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => window.__calls.some(c => c.endpoint === 'decide' && c.payload.action === 'approve' && c.payload.expectedBaseHash === 'hash-base')), true)

  await page.getByText('实际替换范围').click()
  await page.getByText(/无法替换：工具定义与约束/).waitFor()

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
  await page.locator('details > summary').filter({ hasText: '高级设置' }).first().click()
  await page.getByText(/身份未加载：缺少元数据块/).waitFor()
  assert.equal(await page.getByRole('listitem').filter({ hasText: '缺少元数据块' }).count(), 1)

  // Composer preview
  await page.evaluate(() => {
    window.__root.unmount()
    console.log('BODY?', !!document.body, document.body && document.body.tagName)
    window.__root = ReactDOM.createRoot(document.getElementById('root'))
    window.__root.render(React.createElement(window.__composer.component, { ...window.__composer.face, t: window.__t }))
  })
  await page.getByRole('button', { name: /知忆书阁/ }).click()
  await page.getByRole('dialog').waitFor()
  await page.getByText('待发送', { exact: true }).waitFor()
  await page.getByText('812 / 4000 tokens', { exact: true }).waitFor()
  assert.match(await page.getByText('待发送', { exact: true }).getAttribute('title'), /尚未发出/)
  assert.equal(await page.locator('.cl-dialog details[open]').count(), 0)
  assert.equal(await page.locator('.cl-dialog').getByText('Alpha 的目标与当前状态。', { exact: true }).count(), 0)
  assert.match(await page.locator('.cl-dialog .cl-plan-item').filter({ hasText: 'Alpha 项目' }).getAttribute('title'), /Alpha 的目标与当前状态/)
  assert((await page.locator('.cl-dialog').boundingBox()).width <= 480)
  await page.locator('.cl-dialog summary').filter({ hasText: '未加载与提示' }).click()
  await page.getByText('其他项目', { exact: true }).waitFor()
  await page.locator('.cl-dialog summary').filter({ hasText: '未加载与提示' }).click()
  await page.screenshot({ path: 'tools/shot-context-library-preview.png' })
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  assert.deepEqual(errors, [])
  console.log('CONTEXT LIBRARY CLIENT BROWSER OK: settings editor, pending approval, replacement disclosure, composer preview, Escape close, narrow layout; screenshots saved')
} finally {
  await browser.close()
}
