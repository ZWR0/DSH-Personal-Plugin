/** 知忆书阁 core: storage, scope isolation, budget, proposals, history, path safety. */
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, symlink, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import * as lib from '../context-library/library.js'

const base = await mkdtemp(join(tmpdir(), 'dsh-context-library-core-'))
const profile = join(base, 'profile')
const library = join(profile, 'context-library')
const projectA = join(base, 'work', 'alpha')
const projectB = join(base, 'work', 'beta')
await mkdir(projectA, { recursive: true })
await mkdir(projectB, { recursive: true })
await mkdir(profile, { recursive: true })
const results = []
const ok = name => { results.push(name); console.log('  ok · ' + name) }

try {
  const settings = lib.resolveSettings({ mode: 'supplement', strategy: 'auto', budgetTokens: 4000 })
  const counter = lib.makeTokenCounter(undefined)
  const save = (input) => lib.saveEntry({ root: library, ...input, now: Date.now() })

  await save({ type: 'identity', id: 'identity', title: '身份', body: '称呼：小林\n偏好：中文、先结论。', status: 'active', scope: 'global', enabled: true })
  await save({ type: 'projects', id: 'alpha', title: 'Alpha 项目', body: 'Alpha 的目标与路径。', status: 'active', scope: 'project', projectPath: projectA, enabled: true })
  await save({ type: 'projects', id: 'beta', title: 'Beta 项目', body: 'BETA-SECRET-CONTENT', status: 'active', scope: 'project', projectPath: projectB, enabled: true })
  await save({ type: 'decisions', id: 'alpha-db', title: 'Alpha 选 PostgreSQL', body: '决定使用 PostgreSQL。', status: 'active', scope: 'project', projectPath: projectA, enabled: true, key: true })
  await save({ type: 'decisions', id: 'old-db', title: '旧决策', body: '旧决策正文', status: 'active', scope: 'global', enabled: true, key: false })
  await save({ type: 'long_term', id: 'pref', title: '长期偏好', body: '长期偏好：简洁回答。', status: 'active', scope: 'global', enabled: true })

  const alpha = lib.computePlan({ profileDir: profile, settings, cwd: projectA, counter, now: Date.now() })
  assert.match(alpha.text, /称呼：小林/)
  assert.match(alpha.text, /Alpha 的目标与路径/)
  assert.match(alpha.text, /决定使用 PostgreSQL/)
  assert.match(alpha.text, /长期偏好：简洁回答/)
  assert.doesNotMatch(alpha.text, /BETA-SECRET-CONTENT/)
  assert.match(alpha.text, /Beta 项目/)
  assert.ok(alpha.items.find(item => item.id === 'beta').status === 'other-project')
  assert.ok(alpha.loaded.every(item => item.id !== 'beta'))
  assert.ok(alpha.items.find(item => item.id === 'old-db').status === 'catalog')
  ok('current project loads only its own entries; other project is catalog-only')

  const beta = lib.computePlan({ profileDir: profile, settings, cwd: projectB, counter, now: Date.now() })
  assert.match(beta.text, /BETA-SECRET-CONTENT/)
  assert.doesNotMatch(beta.text, /### Project · Alpha 项目/)
  assert.doesNotMatch(beta.text, /### Decision · Alpha/)
  assert.ok(beta.loaded.every(item => item.id !== 'alpha' && item.id !== 'alpha-db'))
  assert.ok(beta.items.find(item => item.id === 'alpha').status === 'other-project')
  ok('project scope isolation is physical-directory based')

  const nested = lib.computePlan({ profileDir: profile, settings, cwd: join(projectA, 'src', 'deep'), counter, now: Date.now() })
  assert.match(nested.text, /Alpha 的目标与路径/)
  ok('a session below a bound project still matches')

  const tiny = lib.resolveSettings({ ...settings, budgetTokens: 260, perType: { identity: 200, projects: 200, decisions: 200, long_term: 200 } })
  const bounded = lib.computePlan({ profileDir: profile, settings: tiny, cwd: projectA, counter, now: Date.now() })
  assert.ok(bounded.used <= tiny.budgetTokens, `used ${bounded.used} <= ${tiny.budgetTokens}`)
  assert.ok(bounded.omitted.length > 0)
  for (const item of bounded.omitted) assert.ok(item.reason.endsWith('budget'))
  for (const item of bounded.omitted) {
    const body = item.id === 'identity' ? '称呼：小林' : item.id === 'alpha' ? 'Alpha 的目标与路径' : item.id === 'alpha-db' ? '决定使用 PostgreSQL' : '长期偏好：简洁回答'
    assert.doesNotMatch(bounded.text, new RegExp(body), `omitted ${item.id} must not appear`)
  }
  ok('budget omission is explicit, total is respected, and no entry is half-truncated')

  const catalogOnly = lib.computePlan({ profileDir: profile, settings: { ...settings, strategy: 'catalog' }, cwd: projectA, counter, now: Date.now() })
  assert.equal(catalogOnly.loaded.length, 0)
  assert.match(catalogOnly.text, /Alpha 项目/)
  assert.doesNotMatch(catalogOnly.text, /### Project ·/)
  ok('catalog strategy injects titles without bodies')

  const beforeVersion = alpha.loaded.find(item => item.id === 'alpha').version
  const updated = await save({ type: 'projects', id: 'alpha', title: 'Alpha 项目', body: 'Alpha 的目标与路径（已更新）。', status: 'active', scope: 'project', projectPath: projectA, enabled: true, expectedVersion: beforeVersion })
  assert.notEqual(updated.version, beforeVersion)
  const alphaV2 = lib.computePlan({ profileDir: profile, settings, cwd: projectA, counter, now: Date.now() })
  assert.match(alphaV2.text, /已更新/)
  assert.notEqual(alphaV2.planId, alpha.planId)
  assert.notEqual(lib.renderContextText(alpha, new Date().toISOString()), lib.renderContextText(alphaV2, new Date().toISOString()))
  ok('a file change yields a new version and plan id; unchanged renders dedupe')

  const history = await lib.listHistory({ root: library, type: 'projects', id: 'alpha' })
  assert.ok(history.length >= 1)
  const restored = await lib.restoreVersion({ root: library, type: 'projects', id: 'alpha', version: history[0].version })
  assert.match(restored.entry.body, /Alpha 的目标与路径。/)
  assert.ok((await lib.listHistory({ root: library, type: 'projects', id: 'alpha' })).length >= 2)
  ok('revision history is written, listable, and restorable')

  await assert.rejects(
    () => save({ type: 'projects', id: 'alpha', title: 'Alpha 项目', body: 'NOPE', status: 'active', scope: 'project', projectPath: projectA, enabled: true, expectedVersion: 'deadbeef' }),
    error => error.code === 'entry/conflict',
  )
  assert.match((await readFile(join(library, 'projects', 'alpha.md'), 'utf8')), /Alpha 的目标与路径。/)
  assert.doesNotMatch((await readFile(join(library, 'projects', 'alpha.md'), 'utf8')), /NOPE/)
  ok('stale expectedVersion is refused and the newer external content is preserved')

  await assert.rejects(
    () => save({ type: 'identity', id: 'identity', title: '身份', body: 'api_key = sk-abcdefghijklmnopqrstuvwx', status: 'active', scope: 'global', enabled: true }),
    error => error.code === 'entry/credential',
  )
  ok('credential-looking content is refused')

  await assert.rejects(() => save({ type: 'projects', id: '../escape', title: 'x', body: 'x', status: 'active', scope: 'global', enabled: true }), error => error.code === 'entry/invalid-id')
  await assert.rejects(() => lib.getEntry({ root: library, type: 'projects', id: '../identity' }), error => error.code === 'entry/invalid-id')
  ok('id traversal is rejected')

  let symlinkSupported = true
  try {
    await symlink(join(base, 'outside.md'), join(library, 'projects', 'linked.md'))
    await writeFile(join(base, 'outside.md'), 'outside')
  } catch { symlinkSupported = false }
  if (symlinkSupported) {
    await assert.rejects(() => lib.getEntry({ root: library, type: 'projects', id: 'linked' }), error => error.code === 'path/link')
    ok('symlinked entry is refused')
  } else {
    console.log('  skip · symlink escape (link creation not permitted here)')
  }

  const proposal = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'create', type: 'long_term', title: '部署偏好', body: '部署时优先使用只读账号。',
      scope: 'global', enabled: true, reason: '用户明确说以后都用只读账号部署。',
      evidence: [{ kind: 'user-stated', note: '用户原话：以后部署都用只读账号。' }],
      sessionId: 'session-test',
    },
  })
  assert.equal(proposal.proposal.status, 'pending')
  const pending = await lib.listPending({ root: library })
  assert.equal(pending.proposals.length, 1)
  const withPending = lib.computePlan({ profileDir: profile, settings, cwd: projectA, counter, now: Date.now() })
  assert.doesNotMatch(withPending.text, /部署时优先使用只读账号/)
  ok('pending proposal is persisted but never enters the context plan')

  const duplicate = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'create', type: 'long_term', title: '部署偏好', body: '部署时优先使用只读账号。',
      scope: 'global', enabled: true, reason: 'duplicate',
      evidence: [{ kind: 'user-stated', note: 'same' }],
    },
  })
  assert.equal(duplicate.existing, true)
  ok('identical pending proposals are deduplicated')

  await assert.rejects(
    () => lib.decideProposal({ root: library, id: proposal.proposal.id, action: 'approve', expectedBaseHash: 'wrong' }),
    error => error.code === 'proposal/stale-approval',
  )
  await assert.rejects(() => lib.getEntry({ root: library, type: 'long_term', id: proposal.proposal.entryId }), error => error.code === 'entry/not-found')
  ok('approval without the bound hash writes nothing')

  const deferred = await lib.decideProposal({ root: library, id: proposal.proposal.id, action: 'defer', expectedBaseHash: proposal.proposal.baseHash })
  assert.equal(deferred.proposal.status, 'deferred')
  await assert.rejects(() => lib.getEntry({ root: library, type: 'long_term', id: proposal.proposal.entryId }), error => error.code === 'entry/not-found')
  const suppressed = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'create', type: 'long_term', title: '部署偏好', body: '部署时优先使用只读账号。',
      scope: 'global', enabled: true, reason: 'again', evidence: [{ kind: 'user-stated', note: 'again' }],
    },
  })
  assert.equal(suppressed.suppressed, true)
  ok('defer writes nothing and suppresses the same suggestion later')

  const create2 = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'create', type: 'decisions', title: '缓存选型', body: '缓存使用 Redis。', scope: 'global', enabled: true, key: true,
      reason: '用户确认了缓存选型。', evidence: [{ kind: 'confirmed', note: '用户回答：就按 Redis。' }],
    },
  })
  const applied = await lib.decideProposal({ root: library, id: create2.proposal.id, action: 'approve', expectedBaseHash: null })
  assert.equal(applied.proposal.status, 'applied')
  const savedDecision = await lib.readEntry({ root: library, id: create2.proposal.entryId })
  assert.match(savedDecision.body, /Redis/)
  await assert.rejects(
    () => lib.decideProposal({ root: library, id: create2.proposal.id, action: 'approve', expectedBaseHash: null }),
    error => error.code === 'proposal/already-resolved',
  )
  assert.equal((await lib.listHistory({ root: library, type: 'decisions', id: create2.proposal.entryId })).length, 0)
  ok('approval writes exactly once and the resolved proposal cannot be replayed')

  const update = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'update', type: 'projects', id: 'alpha', title: 'Alpha 项目', body: 'Alpha v3 内容。',
      scope: 'project', projectPath: projectA, expectedVersion: (await lib.readEntry({ root: library, id: 'alpha' })).version,
      reason: '项目范围已变化。', evidence: [{ kind: 'user-stated', note: '用户：Alpha 现在只做导出。' }],
    },
  })
  await writeFile(join(library, 'projects', 'alpha.md'), (await readFile(join(library, 'projects', 'alpha.md'), 'utf8')).replace('Alpha 的目标与路径。', '外部改写的正文。'))
  const conflict = await lib.decideProposal({ root: library, id: update.proposal.id, action: 'approve', expectedBaseHash: update.proposal.baseHash })
  assert.equal(conflict.conflict, true)
  assert.match(await readFile(join(library, 'projects', 'alpha.md'), 'utf8'), /外部改写的正文。/)
  assert.doesNotMatch(await readFile(join(library, 'projects', 'alpha.md'), 'utf8'), /Alpha v3 内容/)
  const rebased = await lib.rebaseProposal({ root: library, id: update.proposal.id })
  assert.match(rebased.proposal.before, /外部改写的正文/)
  const resolved = await lib.decideProposal({ root: library, id: update.proposal.id, action: 'approve', expectedBaseHash: rebased.proposal.baseHash })
  assert.equal(resolved.conflict, undefined)
  assert.match(await readFile(join(library, 'projects', 'alpha.md'), 'utf8'), /Alpha v3 内容/)
  ok('external modification creates a conflict, then an explicit rebase allows a fresh approval')

  const expiredCreate = await lib.createProposal({
    root: library, settings, cwd: projectA,
    proposal: {
      kind: 'create', type: 'long_term', title: '过期测试', body: 'EXPIRED-CONTENT', scope: 'global', enabled: true,
      reason: 'test', evidence: [{ kind: 'user-stated', note: 'test' }],
    },
  })
  const pendingPath = join(library, '.context-library', 'pending', expiredCreate.proposal.id + '.json')
  const record = JSON.parse(await readFile(pendingPath, 'utf8'))
  record.expiresAt = new Date(Date.now() - 1000).toISOString()
  await writeFile(pendingPath, JSON.stringify(record))
  await assert.rejects(
    () => lib.decideProposal({ root: library, id: record.id, action: 'approve', expectedBaseHash: null }),
    error => error.code === 'proposal/expired',
  )
  const allLongTerm = (await lib.listEntries(library)).entries.filter(entry => entry.type === 'long_term')
  assert.ok(allLongTerm.every(entry => !entry.body.includes('EXPIRED-CONTENT')))
  ok('expired proposal never writes, even with an explicit approve attempt')

  const custom = lib.computePlan({ profileDir: profile, settings: { ...settings, mode: 'custom' }, cwd: projectA, customActive: true, counter, now: Date.now() })
  assert.equal(custom.identityReplaced, true)
  assert.doesNotMatch(custom.text, /称呼：小林/)
  assert.match(custom.customPrefixText, /称呼：小林/)
  const supplement = lib.computePlan({ profileDir: profile, settings, cwd: projectA, customActive: false, counter, now: Date.now() })
  assert.equal(supplement.identityReplaced, false)
  assert.match(supplement.text, /称呼：小林/)
  ok('custom mode renders identity for the replaceable Harness section; supplement keeps runtime context')

  const tmpFiles = []
  for (const directory of [library, join(library, 'projects'), join(library, '.context-library', 'history', 'projects', 'alpha')]) {
    try {
      for (const name of await readdir(directory)) if (name.endsWith('.tmp')) tmpFiles.push(join(directory, name))
    } catch { /* directory may not exist */ }
  }
  assert.deepEqual(tmpFiles, [])
  assert.ok((await stat(join(library, 'identity.md'))).isFile())
  ok('atomic writes leave no temporary files behind')

  console.log(`\nCONTEXT LIBRARY CORE OK: ${results.length} checks`)
} finally {
  const expectedPrefix = join(tmpdir(), 'dsh-context-library-core-')
  if (!base.startsWith(expectedPrefix)) throw new Error('refusing to remove an unexpected path: ' + base)
  await rm(base, { recursive: true, force: true })
}
