/** Bounded waits for explicitly unattended-safe ask_user_question calls. */
const AUTO = '[自动继续]'
const RECOMMENDED = /(?:[（(](?:推荐|recommended)[）)])\s*$/iu

/** Validate the deployment-owned foreground wait in seconds. */
export function resolveTimeout(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('choice-pilot: config 必须是对象')
  for (const key of Object.keys(config)) {
    if (key !== 'timeoutSeconds') throw new Error(`choice-pilot: 未知配置字段 ${key}`)
  }
  const seconds = config.timeoutSeconds ?? 120
  if (seconds !== -1 && (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 2147483)) {
    throw new Error('choice-pilot: timeoutSeconds 必须为 -1 或 1–2147483 的整数秒')
  }
  return seconds
}

/** Return a recorded automatic outcome, explicitly distinguished from a human reply. */
export function automaticResult(questions, seconds) {
  const answers = questions.map(question => {
    const recommended = (question.options ?? []).filter(option => RECOMMENDED.test(option.label))
    const selected = question.multi_select ? recommended.map(option => option.label)
      : recommended.length === 1 ? [recommended[0].label] : []
    return {
      id: question.id,
      selected,
      custom: `[选项领航自动处理，非用户回答] 等待 ${seconds} 秒未收到提交；${selected.length ? '采用明确标记的推荐项。' : '未提供信息或无唯一推荐项，跳过该问题及依赖缺失信息的工作。'}不得将本结果视为授权；继续独立工作，最终说明自动选择、跳过内容及影响。`,
    }
  })
  const value = { answers }
  return {
    isError: false,
    value,
    content: [{ type: 'text', text: JSON.stringify(value) }],
  }
}

/** Register a cancel-aware tool wrapper; disposal waits for active question calls to settle. */
export function registerTimeout(ctx, seconds) {
  if (seconds === -1) return
  const active = new Set()
  ctx.effect(() => async () => {
    for (const call of active) call.controller.abort(new Error('choice-pilot stopped'))
    await Promise.allSettled([...active].map(call => call.done))
  }, 'choice-pilot: active question waits')
  ctx.on('tools/execute', async (exec, next) => {
    const questions = exec.arguments?.questions
    if (exec.name !== 'ask_user_question' || !Array.isArray(questions) || !questions.length
      || !questions.every(question => typeof question.header === 'string' && question.header.startsWith(AUTO) && !question.intent)) return next()
    const originalSignal = exec.signal
    originalSignal.throwIfAborted()
    const controller = new AbortController()
    const requested = exec.arguments.timeout
    const duration = Number.isInteger(requested) && requested > 0 ? Math.min(seconds, requested) : seconds
    exec.signal = AbortSignal.any([originalSignal, controller.signal])
    let expired = false
    const timer = setTimeout(() => {
      expired = true
      controller.abort(new Error('choice-pilot question timeout'))
    }, duration * 1000)
    let release
    const call = { controller, done: new Promise(resolve => { release = resolve }) }
    active.add(call)
    try {
      const result = await next()
      originalSignal.throwIfAborted()
      // A submitted answer wins; unrelated tool failures must not become success.
      if (!result.isError && Array.isArray(result.value?.answers)) return result
      if (controller.signal.aborted && !expired) return result
      const cancelled = result.isError && ['ABORTED', 'ASK_ABORTED'].includes(result.error?.info?.code)
      if ((expired && cancelled) || (!result.isError && result.value?.pending === true)) {
        return automaticResult(questions, duration)
      }
      return result
    } finally {
      clearTimeout(timer)
      exec.signal = originalSignal
      active.delete(call)
      release()
    }
  }, { prepend: true })
}
