/** Deterministic deadline, cancellation and teardown regressions; no model calls. */
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { automaticResult, registerTimeout, resolveTimeout } from '../choice-pilot/timeout.js'
import { harnessUrl } from './test-environment.mjs'
import { registerFollowups } from '../choice-pilot/followups.js'

const questions = [
  { id: 'one', header: '[自动继续]方案', options: [{ label: 'A（推荐）' }, { label: 'B' }] },
  { id: 'text', header: '[自动继续]路径' },
  { id: 'multi', header: '[自动继续]检查', multi_select: true, options: [{ label: 'A (Recommended)' }, { label: 'B（推荐）' }, { label: 'C' }] },
  { id: 'ambiguous', header: '[自动继续]方案', options: [{ label: 'A（推荐）' }, { label: 'B（推荐）' }] },
].map(question => ({ ...question, question: '请选择或补充；120 秒后自动继续。' }))
assert.deepEqual(automaticResult(questions, 120).value.answers.map(answer => answer.selected), [['A（推荐）'], [], ['A (Recommended)', 'B（推荐）'], []])
assert.match(automaticResult(questions, 120).value.answers[1].custom, /非用户回答.*跳过/)
for (const config of [null, [], { typo: 1 }, { timeoutSeconds: 0 }, { timeoutSeconds: 1.5 }, { timeoutSeconds: 2147484 }]) assert.throws(() => resolveTimeout(config))
assert.equal(resolveTimeout(), 120)
assert.equal(resolveTimeout({ timeoutSeconds: -1 }), -1)
registerTimeout({ on() { assert.fail('disabled policy must not register a wrapper') } }, -1)

let listener, dispose
registerTimeout({ on(event, fn) { assert.equal(event, 'tools/execute'); listener = fn }, effect(start) { dispose = start() } }, 120)
const success = { isError: false, value: { answers: [{ id: 'one', selected: ['B'], custom: 'human' }] }, content: [] }
const cancelled = { isError: true, error: { message: 'cancelled', info: { code: 'ABORTED' } }, content: [] }
const make = () => ({ name: 'ask_user_question', arguments: { questions }, signal: new AbortController().signal })
const cooperative = exec => new Promise(resolve => exec.signal.addEventListener('abort', () => resolve(cancelled), { once: true }))
mock.timers.enable({ apis: ['setTimeout'] })
try {
  let exec = make()
  const original = exec.signal
  let pending = listener(exec, () => cooperative(exec))
  mock.timers.tick(120000)
  assert.deepEqual((await pending).value.answers.map(answer => answer.selected), [['A（推荐）'], [], ['A (Recommended)', 'B（推荐）'], []])
  assert.equal(exec.signal, original)
  exec = make()
  exec.arguments.timeout = 5
  pending = listener(exec, () => cooperative(exec))
  mock.timers.tick(5000)
  assert.match((await pending).value.answers[0].custom, /等待 5 秒/)
  assert.equal(await listener(make(), async () => success), success, 'real answer wins')
  exec = make()
  exec.arguments.questions = [{ id: 'approval', header: '必须确认' }]
  assert.equal(await listener(exec, async () => success), success, 'unmarked questions delegate')
  exec.arguments.questions = [{ id: 'approval', header: '[自动继续]确认', intent: { kind: 'approval' } }]
  assert.equal(await listener(exec, async () => success), success, 'approval intent never defaults')
  exec = make()
  const upstream = new AbortController()
  exec.signal = upstream.signal
  pending = listener(exec, () => cooperative(exec))
  upstream.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  exec = make()
  const failure = { isError: true, error: { message: 'provider failed', info: { code: 'NO_PROVIDER' } }, content: [] }
  pending = listener(exec, () => new Promise(resolve => exec.signal.addEventListener('abort', () => resolve(failure), { once: true })))
  mock.timers.tick(120000)
  assert.equal(await pending, failure, 'unrelated failures stay failures')
  exec = make()
  pending = listener(exec, () => cooperative(exec))
  await dispose()
  assert.equal(await pending, cancelled, 'unload cancels without an automatic answer')
} finally { mock.timers.reset() }
console.log('CHOICE PILOT TIMEOUT OK: recommendations, missing input, deadline, real answers, approval exclusion, cancellation, failure and unload')

const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
const { default: SystemPrompt } = await import(harnessUrl('packages/core/system-prompt/lib/index.js'))
const { default: Tools } = await import(harnessUrl('packages/core/tools/lib/index.js'))
const native = await import(harnessUrl('packages/core/tool-executor-native/lib/index.js'))
const askUser = await import(harnessUrl('packages/interaction/tool-ask-user/lib/index.js'))
const { UserQuestionError } = await import(harnessUrl('packages/interaction/user-questions/lib/index.js'))
const { executeToolFixture } = await import(harnessUrl('packages/test-support/tool-testkit/lib/index.js'))
const ctx = new Context()
let markStarted
const started = new Promise(resolve => { markStarted = resolve })
ctx.provide('userQuestions', {
  ask(request) {
    markStarted()
    return new Promise((_resolve, reject) => request.signal.addEventListener('abort', () => {
      reject(new UserQuestionError('question aborted', 'ASK_ABORTED'))
    }, { once: true }))
  },
})
try {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(native)
  await ctx.plugin(askUser)
  const fiber = ctx.plugin({ apply: context => registerTimeout(context, 120) })
  await fiber
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const result = executeToolFixture(ctx, { callId: 'unattended', name: 'ask_user_question', arguments: { questions }, signal: new AbortController().signal })
    await Promise.race([started, result.then(value => { throw new Error(`tool settled before asking: ${JSON.stringify(value)}`) })])
    mock.timers.tick(120000)
    const settled = await result
    assert.equal(settled.isError, false, JSON.stringify(settled))
    assert.deepEqual(settled.value.answers[0].selected, ['A（推荐）'])
    assert.match(settled.content[0].text, /非用户回答/)
  } finally { mock.timers.reset() }
  await fiber.dispose()
  registerFollowups(ctx)
  const suggestions = [{ label: 'Inspect config', prompt: 'Please inspect the model config without changing it.' }]
  const result = await executeToolFixture(ctx, { callId: 'next-step', name: 'suggest_followups', arguments: { suggestions }, signal: new AbortController().signal })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.equal(result.concludesTurn, true, 'suggestions end the current turn without waiting')
  assert.deepEqual(result.meta.choicePilotFollowups, suggestions, 'suggestions survive canonical presentation metadata')
  const invalid = await executeToolFixture(ctx, { callId: 'bad-next-step', name: 'suggest_followups', arguments: { suggestions: [{ label: 'Inspect', prompt: ' ' }] }, signal: new AbortController().signal })
  assert.equal(invalid.isError, true)
} finally { await ctx.fiber.dispose() }
console.log('CHOICE PILOT PIPELINE OK: native ask tool, schema rendering, cancellation normalization and recorded automatic outcome')
