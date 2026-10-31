/**
 * 知忆书阁 integration: real Cordis, real SystemPrompt/ToolsService, real
 * HostConnectionService routing, a real Session, and scoped agent contexts.
 * The Agent object is a minimal stand-in for the loop-owned interface; every
 * prompt registry, scope, event, route, and session event is the real one.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from 'file:///D:/deepseek-harness/vendor/cordis/lib/index.js'
import { HostConnectionService } from 'file:///D:/deepseek-harness/packages/client/connection/lib/index.js'
import {
  SystemPrompt, renderPrompt, renderContextSections, joinContextSections,
} from 'file:///D:/deepseek-harness/packages/bundle/base/node_modules/@deepseek-ai/dsh-system-prompt/lib/index.js'
import { ToolsService } from 'file:///D:/deepseek-harness/packages/bundle/base/node_modules/@deepseek-ai/dsh-tools/lib/index.js'
import { Session } from 'file:///D:/deepseek-harness/packages/bundle/base/node_modules/@deepseek-ai/dsh-session/lib/index.js'
import { createScope } from 'file:///D:/deepseek-harness/packages/core/scope/lib/index.js'
import * as plugin from '../context-library/index.js'
import * as lib from '../context-library/library.js'

const base = await mkdtemp(join(tmpdir(), 'dsh-context-library-integration-'))
const profile = join(base, 'profile')
const library = join(profile, 'context-library')
const projectA = join(base, 'alpha')
const projectB = join(base, 'beta')
await mkdir(profile, { recursive: true })
await mkdir(projectA, { recursive: true })
await mkdir(projectB, { recursive: true })

const settings = lib.resolveSettings({ budgetTokens: 4000 })
await lib.saveEntry({ root: library, type: 'identity', id: 'identity', title: '身份', body: '称呼：小林\n偏好：中文、先结论。', status: 'active', scope: 'global', enabled: true })
await lib.saveEntry({ root: library, type: 'projects', id: 'alpha', title: 'Alpha 项目', body: 'Alpha 的完整项目说明。', status: 'active', scope: 'project', projectPath: projectA, enabled: true })
await lib.saveEntry({ root: library, type: 'projects', id: 'beta', title: 'Beta 项目', body: 'BETA-PRIVATE。', status: 'active', scope: 'project', projectPath: projectB, enabled: true })
await lib.saveEntry({ root: library, type: 'decisions', id: 'alpha-db', title: 'Alpha 数据库', body: 'Alpha 使用 PostgreSQL。', status: 'active', scope: 'project', projectPath: projectA, enabled: true, key: true })

const sessions = new Map()
const agents = new Map()
const cwdBySession = new Map()
const ctx = new Context()
let connection
const baseFiber = ctx.plugin(c => { connection = new HostConnectionService(c, [], {}) })
await baseFiber
ctx.provide('profileContext', { dir: profile })
ctx.provide('agents', {
  list: () => [...agents.values()],
  get: id => agents.get(id),
  requireInitiator: () => { throw new Error('no initiator') },
  roots: () => [...agents.values()],
})
ctx.provide('workingDirectory', {
  defaultDirectory: projectA,
  get: session => cwdBySession.get(session.id) ?? projectA,
  ensure: async () => projectA,
  set: async () => projectA,
})
ctx.provide('sessions', { get: id => sessions.get(id), list: () => [...sessions.values()] })
ctx.provide('webServer', { register: () => () => {} })

const systemPrompt = new SystemPrompt(ctx, {
  includeHarnessIdentity: true,
  includeRuntimeContext: true,
  personaPrefix: 'BASE-DEPLOYMENT-PERSONA',
  personaSuffix: 'BASE-SUFFIX-RULES',
  toolOrder: undefined,
})
const tools = new ToolsService(ctx)
tools.setExecutor({
  describe: definitions => ({
    schemas: definitions.map(definition => ({ name: definition.name, description: definition.description, parameters: definition.parameters })),
    knownNames: definitions.map(definition => definition.name),
  }),
  execute: async () => ({ results: [], additionalContexts: [], concluded: false }),
})
systemPrompt.context({ name: 'test-runtime-fact', order: 1, text: 'RUNTIME-CWD-FACT', required: true })
tools.register({
  name: 'echo_test',
  description: 'test tool',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  output: { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false }, render: () => [{ type: 'text', text: 'ok' }] },
  execute: async () => ({ ok: true }),
})

function makeAgent(sessionId, cwd) {
  const session = Session.create(sessionId)
  sessions.set(sessionId, session)
  cwdBySession.set(sessionId, cwd)
  const agent = { id: sessionId, session, status: 'idle', options: {}, model: {}, inbox: {} }
  const scope = createScope(ctx, agent)
  agent.ctx = scope.ctx
  agents.set(sessionId, agent)
  return agent
}

let fiber
let rpcId = 0
const results = []
const ok = name => { results.push(name); console.log('  ok · ' + name) }

function request(endpoint, payload = {}, method = 'context-library/' + endpoint) {
  return new Request('http://localhost/api/context-library/' + endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: String(++rpcId), method, payload }),
  })
}

try {
  fiber = ctx.plugin(plugin)
  await fiber
  const shared = connection.createSharedFetchHandler('/api')
  const owner = { principal: { kind: 'owner' } }
  const call = async (endpoint, payload) => {
    const response = await shared.fetch(request(endpoint, payload), owner)
    assert.equal(response.status, 200, `${endpoint} status`)
    const envelope = await response.json()
    assert.equal(envelope.type, 'server-response')
    assert.equal(envelope.rpcId, String(rpcId))
    return envelope.result
  }
  const value = async (endpoint, payload) => {
    const result = await call(endpoint, payload)
    assert.equal(result.ok, true, `${endpoint} failed: ${result.error?.message}`)
    return result.value
  }

  const status = await value('status')
  assert.equal(status.root, resolve(library))
  assert.equal(status.counts.identity, 1)
  assert.equal(status.counts.projects, 2)
  assert.equal(status.tokenMethod, 'heuristic-chars-div-4')
  ok('real plugin startup registers status over the authenticated /api carrier')

  const tree = await value('tree')
  assert.equal(tree.entries.length, 4)
  assert.equal(tree.settings.mode, 'supplement')
  ok('tree route returns entries, settings, and replacement scope')

  assert.equal((await shared.fetch(request('status'), { principal: { kind: 'guest' } })).status, 403)
  assert.equal((await shared.fetch(request('status', {}, 'wrong/method'), owner)).status, 400)
  assert.equal((await shared.fetch(request('unknown'), owner)).status, 404)
  ok('guest requests, bad envelopes, and unknown routes are rejected')

  const agentA = makeAgent('session-alpha', projectA)
  const agentB = makeAgent('session-beta', projectB)
  ctx.emit('agent/created', { agent: agentA, source: 'startup' })
  ctx.emit('agent/created', { agent: agentB, source: 'startup' })

  const assemblyA = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  const sectionA = assemblyA.contexts.find(item => item.name === 'context-library')
  assert.ok(sectionA !== undefined)
  assert.match(sectionA.text, /称呼：小林/)
  assert.match(sectionA.text, /Alpha 的完整项目说明/)
  assert.match(sectionA.text, /Alpha 使用 PostgreSQL/)
  assert.doesNotMatch(sectionA.text, /BETA-PRIVATE/)
  assert.ok(assemblyA.contexts.some(item => item.name === 'test-runtime-fact'))
  assert.ok(assemblyA.tools.some(item => item.name === 'echo_test'))
  const assemblyB = await systemPrompt.assemble({ scope: agentB, agent: agentB })
  const sectionB = assemblyB.contexts.find(item => item.name === 'context-library')
  assert.match(sectionB.text, /BETA-PRIVATE/)
  assert.doesNotMatch(sectionB.text, /### Project · Alpha 项目/)
  assert.doesNotMatch(sectionB.text, /### Decision · Alpha 数据库/)
  ok('scoped assembly isolates projects while preserving required runtime context and tools')

  const previewA = await value('plan', { sessionId: 'session-alpha' })
  const marker = lib.parseMarker(previewA.plan.text)
  assert.ok(marker !== null)
  assert.equal(lib.parseMarker(sectionA.text).planId, marker.planId)
  assert.equal(previewA.last, null, 'no request has been admitted yet')
  ok('preview plan and injected context share one plan id; “not loaded yet” is honest')

  // Emit the runtime-context snapshot exactly as the loop's projection would,
  // then verify the preview reads the real Session history.
  const sections = renderContextSections(assemblyA)
  const snapshotText = joinContextSections(sections)
  agentA.session.append('user/message', {
    role: 'user',
    content: [{ type: 'text', text: snapshotText }],
    source: { kind: 'runtime-context', form: 'snapshot', sections },
    id: 'msg-context-1',
    time: Date.now(),
  }, { surfaceOp: 'append' })
  const afterLoad = await value('plan', { sessionId: 'session-alpha' })
  assert.ok(afterLoad.last !== null)
  assert.equal(afterLoad.last.planId, marker.planId)
  assert.equal(afterLoad.last.snapshots, 1)
  ok('“actually loaded” is read back from a real Session runtime-context snapshot')

  const repeatA = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  const repeatSection = repeatA.contexts.find(item => item.name === 'context-library')
  const stable = text => String(text).replace(/ at=[^\]]+\]/, ' at=X]')
  assert.equal(stable(repeatSection.text), stable(sectionA.text))
  assert.equal(lib.parseMarker(repeatSection.text).planId, lib.parseMarker(sectionA.text).planId)
  ok('repeated assembly renders the identical version (native projection dedupes by text)')

  const custom = await value('saveSettings', { mode: 'custom' })
  assert.equal(custom.settings.mode, 'custom')
  const customA = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  const prefix = customA.sections.find(item => item.name === 'deployment:persona-prefix')
  const harness = customA.sections.find(item => item.name === 'harness:identity')
  const contextSection = customA.contexts.find(item => item.name === 'context-library')
  assert.match(harness.text, /称呼：小林/)
  assert.equal(prefix.text, 'BASE-DEPLOYMENT-PERSONA')
  assert.doesNotMatch(harness.text, /powered by DeepSeek Harness/)
  assert.ok(harness !== undefined)
  assert.deepEqual(customA.sections.filter(item => item.name !== 'harness:identity'), assemblyA.sections.filter(item => item.name !== 'harness:identity'), 'all other system sections remain byte-for-byte unchanged')
  assert.ok(customA.contexts.some(item => item.name === 'test-runtime-fact'))
  assert.ok(customA.tools.some(item => item.name === 'echo_test'))
  assert.doesNotMatch(contextSection.text, /称呼：小林/, 'identity moves to the prefix in custom mode')
  assert.match(joinContextSections(renderContextSections(customA)), /RUNTIME-CWD-FACT/)
  ok('custom mode replaces Harness identity only and preserves deployment persona, runtime context, and tools')

  const customTree = await value('tree')
  const persona = customTree.replacement.sections[0]
  assert.ok(persona.active)
  assert.ok(persona.attachedSessions.includes('session-alpha'))

  const agentC = makeAgent('session-conflict', projectA)
  const releaseIdentity = agentC.ctx.systemPrompt.section({ name: 'harness:identity', order: -1000, text: 'PRESET-IDENTITY' })
  ctx.emit('agent/created', { agent: agentC, source: 'startup' })
  const identityConflict = await systemPrompt.assemble({ scope: agentC, agent: agentC })
  assert.equal(identityConflict.sections.find(item => item.name === 'harness:identity').text, 'PRESET-IDENTITY')
  assert.match(identityConflict.contexts.find(item => item.name === 'context-library').text, /称呼：小林/)
  assert.ok((await value('tree')).replacement.sections[0].errors.some(item => item.sessionId === agentC.id))
  releaseIdentity()
  await value('saveSettings', { mode: 'custom' })
  const recovered = await systemPrompt.assemble({ scope: agentC, agent: agentC })
  assert.match(recovered.sections.find(item => item.name === 'harness:identity').text, /称呼：小林/)
  await value('saveSettings', { enabled: false })
  const disabled = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  assert.match(disabled.sections.find(item => item.name === 'harness:identity').text, /powered by DeepSeek Harness/)
  await value('saveSettings', { enabled: true })
  ok('identity conflicts fall back honestly, saving settings retries, and disabling restores the original identity')

  await value('saveSettings', { mode: 'supplement' })
  const supplementAgain = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  assert.equal(supplementAgain.sections.find(item => item.name === 'deployment:persona-prefix').text, 'BASE-DEPLOYMENT-PERSONA')
  assert.match(supplementAgain.sections.find(item => item.name === 'harness:identity').text, /powered by DeepSeek Harness/)
  assert.match(supplementAgain.contexts.find(item => item.name === 'context-library').text, /称呼：小林/)
  ok('leaving custom mode restores the deployment persona and identity runtime context')

  const proposeTool = tools.get('context_library_propose')
  assert.ok(proposeTool !== undefined)
  const proposal = await proposeTool.execute({
    kind: 'create', type: 'long_term', title: 'Review preference',
    body: 'PENDING-BODY-MUST-NOT-LEAK', scope: 'global', enabled: true,
    reason: '用户明确说以后代码审查都要先给风险清单。',
    evidence: [{ kind: 'user-stated', note: '用户：以后评审都先列风险。' }],
  }, { agent: agentA, signal: new AbortController().signal, callId: 'call-1' })
  assert.equal(proposal.outcome, 'pending')
  const pendingView = await value('pending')
  assert.equal(pendingView.proposals.length, 1)
  const beforeApproval = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  assert.doesNotMatch(beforeApproval.contexts.find(item => item.name === 'context-library').text, /PENDING-BODY-MUST-NOT-LEAK/)
  assert.equal(proposal.proposalId.startsWith('p-'), true)
  ok('agent proposals are pending only and never enter the prompt')

  const denied = await call('decide', { id: proposal.proposalId, action: 'approve', expectedBaseHash: 'forged' })
  assert.equal(denied.ok, false)
  const persisted = await value('pending')
  assert.equal(persisted.proposals.length, 1, 'a failed approval leaves the proposal pending')
  const stillAbsent = lib.computePlan({ profileDir: profile, settings: lib.resolveSettings({}), cwd: projectA, counter: lib.makeTokenCounter(undefined), now: Date.now() })
  assert.doesNotMatch(stillAbsent.text, /PENDING-BODY-MUST-NOT-LEAK/)
  ok('a forged approval hash writes nothing')

  const approved = await value('decide', { id: proposal.proposalId, action: 'approve', expectedBaseHash: null })
  assert.equal(approved.proposal.status, 'applied')
  const afterApproval = await systemPrompt.assemble({ scope: agentA, agent: agentA })
  assert.match(afterApproval.contexts.find(item => item.name === 'context-library').text, /PENDING-BODY-MUST-NOT-LEAK/)
  const replay = await call('decide', { id: proposal.proposalId, action: 'approve', expectedBaseHash: null })
  assert.equal(replay.ok, false)
  ok('approval applies exactly once and is replayed as an error')

  const updateProposal = await proposeTool.execute({
    kind: 'update', type: 'projects', id: 'alpha', title: 'Alpha 项目',
    body: 'Alpha 审批后的新说明。', scope: 'project', projectPath: projectA,
    expectedVersion: (await lib.readEntry({ root: library, id: 'alpha' })).version,
    reason: '项目范围变化。', evidence: [{ kind: 'confirmed', note: '用户确认新的项目范围。' }],
  }, { agent: agentA, signal: new AbortController().signal, callId: 'call-2' })
  await writeFile(join(library, 'projects', 'alpha.md'), (await readFile(join(library, 'projects', 'alpha.md'), 'utf8')).replace('Alpha 的完整项目说明。', '外部版本说明。'))
  const conflict = await value('decide', { id: updateProposal.proposalId, action: 'approve', expectedBaseHash: (await value('pending')).proposals[0].baseHash })
  assert.equal(conflict.conflict, true)
  assert.match(await readFile(join(library, 'projects', 'alpha.md'), 'utf8'), /外部版本说明。/)
  ok('external file changes produce a conflict and are never overwritten')

  const guardWrite = tools.checkGuards({ name: 'write', arguments: { file_path: join(library, 'identity.md'), content: 'x' }, agent: agentA })
  assert.match(String(guardWrite), /context_library_propose/)
  const guardBash = tools.checkGuards({ name: 'bash', arguments: { command: 'echo hi > "' + join(library, 'identity.md') + '"' }, agent: agentA })
  assert.match(String(guardBash), /context_library_propose/)
  const guardRead = tools.checkGuards({ name: 'read', arguments: { file_path: join(library, 'identity.md') }, agent: agentA })
  assert.equal(guardRead, undefined)
  ok('the tool guard denies direct file/patch/shell writes but allows reads')

  const importDocs = [{ path: 'user_profile.md', content: '# Owner\nPrefers reproducible research.' }]
  const importPreview = await value('importPreview', { documents: importDocs })
  assert.equal(importPreview.items[0].id, 'owner-profile')
  assert.equal(importPreview.items[0].body, undefined)
  assert.equal((await shared.fetch(request('importApply', { documents: importDocs, planId: importPreview.planId }), { principal: { kind: 'guest' } })).status, 403)
  const imported = await value('importApply', { documents: importDocs, planId: importPreview.planId })
  assert.equal(imported.saved.length, 1)
  assert.equal(imported.failed.length, 0)
  assert.equal((await call('importApply', { documents: importDocs, planId: importPreview.planId })).ok, false)
  ok('owner-only Markdown import previews, writes formatted entries, and refuses stale plans')

  const filesBefore = await readFile(join(library, 'identity.md'), 'utf8')
  await fiber.dispose()
  fiber = null
  assert.equal((await shared.fetch(request('status'), owner)).status, 404)
  assert.equal(tools.get('context_library_read'), undefined)
  assert.equal(tools.get('context_library_propose'), undefined)
  assert.equal(lib.parseMarker((await systemPrompt.assemble({ scope: agentA, agent: agentA })).contexts.find(item => item.name === 'context-library')?.text ?? ''), null)
  assert.equal(await readFile(join(library, 'identity.md'), 'utf8'), filesBefore)
  ok('disposal removes routes, tools, guard, and injection while keeping user files')

  console.log(`\nCONTEXT LIBRARY INTEGRATION OK: ${results.length} checks`)
} finally {
  if (fiber) await fiber.dispose()
  await baseFiber.dispose()
  const expectedPrefix = join(tmpdir(), 'dsh-context-library-integration-')
  if (!base.startsWith(expectedPrefix)) throw new Error('refusing to remove an unexpected path: ' + base)
  await rm(base, { recursive: true, force: true })
}
