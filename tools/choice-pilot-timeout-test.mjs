/** Official blocking/timed behavior stays identical with Choice Pilot mounted and disposed. */
import assert from 'node:assert/strict'
import { harnessUrl } from './test-environment.mjs'
import * as choicePilot from '../choice-pilot/index.js'
const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
const { default: SystemPrompt } = await import(harnessUrl('packages/core/system-prompt/lib/index.js'))
const { default: Tools } = await import(harnessUrl('packages/core/tools/lib/index.js'))
const native = await import(harnessUrl('packages/core/tool-executor-native/lib/index.js'))
const askUser = await import(harnessUrl('packages/interaction/tool-ask-user/lib/index.js'))
const { UserQuestionError } = await import(harnessUrl('packages/interaction/user-questions/lib/index.js'))
const { executeToolFixture } = await import(harnessUrl('packages/test-support/tool-testkit/lib/index.js'))

const { preferenceDefaults, registerPreferenceDefaults } = await import('../choice-pilot/defaults.js')
const safe = { id: 'style', header: '[可逆偏好]格式', question: '选择排版格式', options: [{ label: '精简（推荐）' }, { label: '完整' }] }
assert.deepEqual(preferenceDefaults([safe]), [{ id: 'style', defaults: ['精简（推荐）'] }])
assert.deepEqual(preferenceDefaults([{ ...safe, multi_select: true, options: [{ label: 'A（推荐）' }, { label: 'B (Recommended)' }] }])[0].defaults, ['A（推荐）', 'B (Recommended)'])
for (const question of [{ ...safe, header: '普通标题' }, { ...safe, intent: { kind: 'approval' } }, { ...safe, options: [] }, { ...safe, options: [{ label: 'A（推荐）' }, { label: 'B（推荐）' }] }, { ...safe, question: '批准发布吗？' }, { ...safe, options: [{ label: '删除文件（推荐）' }] }, { ...safe, options: undefined }]) assert.deepEqual(preferenceDefaults([question]), [])
let observer
registerPreferenceDefaults({ on(event, listener) { assert.equal(event, 'tools/post-execute'); observer = listener } })
const execution = { name: 'ask_user_question', callId: 'pending-test', arguments: { questions: [safe] }, signal: new AbortController().signal }
const pendingResult = { isError: false, value: { pending: true, callId: 'pending-test' } }
for (const decision of [{ kind: 'block', feedback: [] }, { kind: 'accept', value: { pending: true } }, { kind: 'accept', content: [] }]) assert.equal(await observer(execution, pendingResult, async () => decision), decision)
const accepted = { kind: 'accept' }
for (const result of [{ isError: true }, { isError: false, value: { answers: [] } }, { isError: false, value: { pending: true, callId: 'other' } }]) assert.equal(await observer(execution, result, async () => accepted), accepted)
const aborted = new AbortController(); aborted.abort()
assert.equal(await observer({ ...execution, signal: aborted.signal }, pendingResult, async () => accepted), accepted)
assert.equal(await observer({ ...execution, arguments: { ...execution.arguments, timeout: -1 } }, pendingResult, async () => accepted), accepted)
const priorContext = { role: 'user', source: { kind: 'test' }, content: [] }
const enriched = await observer(execution, pendingResult, async () => ({ kind: 'accept', additionalContexts: [priorContext] }))
assert.equal(enriched.additionalContexts[0], priorContext)
assert.equal(pendingResult.value.answers, undefined)

const questions = [{ id: 'mode', header: '[自动继续]旧标题', question: '请选择模式', multi_select: true, options: [{ label: 'A (Recommended)' }, { label: 'B' }] }]
for (const mode of ['legacy', 'timed']) {
  const ctx = new Context()
  let outcome = 'answer'
  const answer = { answers: [{ id: 'mode', selected: ['B'], custom: '用户的补充' }] }
  const failure = new UserQuestionError('question aborted', 'ASK_ABORTED')
  let requestSignal
  let observedTimeout
  let resolveWait
  let markWaiting
  const waitingStarted = new Promise(resolve => { markWaiting = resolve })
  ctx.provide('userQuestions', {
    async ask(request) { requestSignal = request.signal; if (outcome === 'error') throw failure; if (outcome === 'wait') return new Promise(resolve => { resolveWait = resolve; markWaiting() }); return answer },
    async askTimed(request, callId, timeout) {
      requestSignal = request.signal; observedTimeout = timeout
      if (outcome === 'error') throw failure
      return outcome === 'pending' ? { pending: true, callId } : answer
    },
  })
  try {
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(Tools)
    await ctx.plugin(native)
    await ctx.plugin(askUser, { mode, timeout: 17 })
    const original = ctx.tools.get('ask_user_question')
    const schema = JSON.stringify(ctx.tools.schemas())
    const agent = { id: 'compat', ctx }
    const signal = new AbortController().signal
    const run = args => executeToolFixture(ctx, { agent, callId: 'compat-question', name: 'ask_user_question', arguments: { questions, ...args }, signal })
    const before = await run()
    const fiber = ctx.plugin(choicePilot)
    await fiber
    assert.equal(ctx.tools.get('ask_user_question'), original)
    assert.equal(JSON.stringify(ctx.tools.schemas().filter(tool => tool.name === 'ask_user_question')), JSON.stringify(JSON.parse(schema).filter(tool => tool.name === 'ask_user_question')))
    assert.deepEqual(await run(), before, `${mode}: native answers and presentation are unchanged`)
    assert.equal(requestSignal, signal, 'the official tool retains the original cancellation signal')
    if (mode === 'timed') {
      outcome = 'pending'
      const pending = await run()
      assert.equal(pending.isError, false)
      assert.equal(pending.value.pending, true)
      assert.equal(pending.value.answers, undefined, 'a recommended option is never fabricated as an answer')
      assert.equal(observedTimeout, 17000)
      await run({ timeout: 3 })
      assert.equal(observedTimeout, 3000, 'per-call native timeout remains authoritative')
      const indefinite = await run({ timeout: -1 })
      assert.deepEqual(indefinite.value, answer, 'indefinite mode still uses the official blocking path')
    }
    outcome = 'error'
    const failed = await run()
    assert.equal(failed.isError, true, 'cancellation/errors never become automatic answers')
    outcome = 'answer'
    const suggestions = [{ label: 'Inspect config', prompt: 'Inspect the model config without changing it.' }]
    const result = await executeToolFixture(ctx, { callId: 'next', name: 'suggest_followups', arguments: { suggestions }, signal })
    assert.equal(result.isError, false)
    assert.equal(result.concludesTurn, true)
    assert.deepEqual(result.meta.choicePilotFollowups, suggestions)
    outcome = 'wait'
    const waitingQuestion = run(mode === 'timed' ? { timeout: -1 } : {})
    await waitingStarted
    await fiber.dispose()
    resolveWait(answer)
    assert.deepEqual(await waitingQuestion, before, 'an official question in flight survives Choice Pilot unload')
    outcome = 'answer'
    assert.equal(ctx.tools.get('suggest_followups'), undefined)
    assert.equal(ctx.tools.get('ask_user_question'), original)
    assert.deepEqual(await run(), before, 'unloading Choice Pilot leaves official questions usable')
    if (mode === 'timed') {
      const enabled = ctx.plugin(choicePilot, { useRecommendedOnTimeout: true })
      await enabled
      outcome = 'pending'
      const safeQuestions = [{ id: 'style', header: '[可逆偏好]排版', question: '选择报告格式；超时按推荐版式继续。', options: [{ label: '简洁版（推荐）' }, { label: '详细版' }] }]
      const pending = await run({ questions: safeQuestions })
      assert.equal(pending.value.pending, true)
      assert.equal(pending.value.answers, undefined)
      assert.equal(JSON.parse(pending.content[0].text).pending, true, 'the official logged result is unchanged')
      assert.equal(pending.additionalContexts.length, 1)
      assert.equal(pending.additionalContexts[0].source.kind, 'choice-pilot-defaults')
      assert.match(pending.additionalContexts[0].content[0].text, /非用户回答/)
      assert.match(pending.additionalContexts[0].content[0].text, /简洁版/)
      const approval = await run({ questions: [{ ...safeQuestions[0], question: '批准删除文件吗？' }] })
      assert.equal(approval.value.pending, true)
      assert.equal(approval.additionalContexts?.length || 0, 0)
      outcome = 'answer'
      assert.equal((await run({ questions: safeQuestions })).additionalContexts?.length || 0, 0, 'real answers win over defaults')
      await enabled.dispose()
      outcome = 'pending'
      assert.equal((await run({ questions: safeQuestions })).additionalContexts?.length || 0, 0)
    }

  } finally { await ctx.fiber.dispose() }
}
let warnings = []
choicePilot.apply({ tools: { register() {} }, effect(start) { start() }, systemPrompt: { section() {} }, logger: { warn: text => warnings.push(text) } }, { timeoutSeconds: 120 })
assert.equal(warnings.length, 1, 'old timeout settings warn instead of silently changing official behavior')
console.log('CHOICE PILOT NATIVE COMPATIBILITY OK: official blocking/timed schemas, answers, pending, timeout, cancellation, followups and unload')
