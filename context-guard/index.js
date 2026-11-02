/** Host-only pre-step safety: the existing compaction service owns summaries and Session changes. */
/** Required Web services; compaction itself is resolved inside the selected preset. */
export const inject = ['agentPresets', 'tokenMeter', 'llm']

/**
 * Validate the emergency request ceiling and unmeasured-input margin.
 * @param config - Plugin settings supplied by cordis.yml.
 * @returns Validated request safety settings; throws for invalid values.
 */
export function resolveConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('context-guard: config 必须是对象')
  for (const key of Object.keys(config)) if (!['maxPressureRatio', 'reserveTokens'].includes(key)) throw new Error('context-guard: 未知配置字段 ' + key)
  const maxPressureRatio = config.maxPressureRatio ?? 0.9
  const reserveTokens = config.reserveTokens ?? 8192
  if (!Number.isFinite(maxPressureRatio) || maxPressureRatio <= 0 || maxPressureRatio >= 1) throw new Error('context-guard: maxPressureRatio 必须大于 0 且小于 1')
  if (!Number.isSafeInteger(reserveTokens) || reserveTokens < 0) throw new Error('context-guard: reserveTokens 必须是非负整数')
  return { maxPressureRatio, reserveTokens }
}

/**
 * Compact before the ordinary pressure listener can swallow a failure.
 * No synthetic summary, pruning, or model-visible message is created here.
 * @param ctx - Web Host context supplying preset services, metering and model metadata.
 * @param config - Emergency ceiling and request margin; trigger policy stays with compaction-basic.
 */
export function apply(ctx, config = {}) {
  const policy = resolveConfig(config)
  ctx.on('agent/pre-step', async ({ agent, signal, messages, modelSelection }, next) => {
    signal.throwIfAborted()
    const compaction = ctx.agentPresets.serviceFor(agent, 'compaction')
    if (!compaction) {
      const error = new Error('当前会话预设未提供压缩服务，未发送请求；请切换到带有 compaction-basic 的预设。')
      error.code = 'CONTEXT_COMPACTION_UNAVAILABLE'
      throw error
    }
    try {
      await compaction.compactIfNeeded(agent, 'pressure', signal)
    } catch (cause) {
      if (signal.aborted) throw cause
      const error = new Error('自动压缩未完成，已停止本次模型请求。请查看压缩错误，使用 /compact 重试，或调整摘要模型与压缩预算后继续。', { cause })
      error.code = 'CONTEXT_COMPACTION_FAILED'
      throw error
    }
    signal.throwIfAborted()
    const info = await ctx.llm.resolveModelInfo(modelSelection.provider, modelSelection.model, signal)
    const capacity = info.context?.contextWindow
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      const error = new Error('无法确认模型上下文容量，未发送请求；请在模型配置中设置正确的 contextWindow。')
      error.code = 'CONTEXT_CAPACITY_UNKNOWN'
      throw error
    }
    const header = agent.session.requestHeader()
    const sameRoute = header?.config.provider === modelSelection.provider && header?.config.model === modelSelection.model
    const output = (sameRoute ? header.config.maxTokens : undefined) ?? info.defaultMaxTokens ?? 0
    const queued = messages.reduce((sum, message) => sum + ctx.tokenMeter.estimateMessage(message), 0)
    const pressure = ctx.tokenMeter.measure(agent.session).totalTokens + queued
    const ceiling = Math.floor(Math.min(capacity * policy.maxPressureRatio, capacity - output - policy.reserveTokens))
    if (ceiling <= 0 || pressure >= ceiling) {
      const error = new Error(`上下文剩余空间不足，未发送本次模型请求（估算输入 ${pressure}，安全上限 ${Math.max(0, ceiling)}）。请运行 /compact，拆分过大的输入，或检查模型输出预算；历史压缩不能降低当前消息与固定提示的大小。`)
      error.code = 'CONTEXT_BUDGET_EXCEEDED'
      throw error
    }
    return next()
  }, { prepend: true })
}
