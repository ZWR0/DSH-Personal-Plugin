/** Optional next-task suggestions; task questions belong to the official tool-ask-user plugin. */
import { registerFollowups } from './followups.js'
import { registerPreferenceDefaults } from './defaults.js'
export const inject = ['systemPrompt', 'tools']

const SECTION = [
  '## 选项领航：可选的后续行动',
  '当前任务完成后，如果存在有用的可选后续行动，先交付结果，再调用实际可用的 suggest_followups，提供 1–4 个简短 label 和完整、自包含的 prompt。没有有用建议时直接结束。',
  '建议按钮在输入框为空且无附件时，由用户点击发送请求；已有草稿或附件时仅追加，检查后发送。不要自动选择或执行，也不要把已经获得授权的必要工作改为下一轮建议。',
  '任务中缺少信息或需要用户决定时，由官方 tool-ask-user 提供的工具及其实际 schema、等待和回答规则处理；本插件不提供提问、审批或用户答案。不要把这些问题转换成后续建议，也不要用建议按钮代替知忆书阁的审批。',
].join('\n')

/** Register suggestions and opt-in defaults without wrapping official questions or steering the agent. */
export function apply(ctx, config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('choice-pilot: config 必须是对象')
  for (const key of Object.keys(config)) {
    if (!['timeoutSeconds', 'useRecommendedOnTimeout'].includes(key)) throw new Error(`choice-pilot: 未知配置字段 ${key}`)
  }
  if (config.timeoutSeconds !== undefined) {
    const seconds = config.timeoutSeconds
    if (seconds !== -1 && (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 2147483)) throw new Error('choice-pilot: 无效的旧 timeoutSeconds 配置')
    ctx.logger.warn('choice-pilot: timeoutSeconds 已停用并被忽略；请在官方 tool-ask-user 插件中配置 mode 和 timeout。')
  }
  if (config.useRecommendedOnTimeout !== undefined && typeof config.useRecommendedOnTimeout !== 'boolean') throw new Error('choice-pilot: useRecommendedOnTimeout 必须是布尔值')
  const enabled = config.useRecommendedOnTimeout === true
  if (enabled) registerPreferenceDefaults(ctx)
  registerFollowups(ctx)
  ctx.effect(() => ctx.systemPrompt.section({ name: 'choice-pilot', order: 60, text: SECTION + (enabled ? '\n已启用超时推荐策略。仅在普通偏好且方案可逆时，在官方问题 header 前加 [可逆偏好] 并明确标记推荐选项，question 中说明超时暂按推荐方案继续；沿用官方 timed 超时设置，不自建计时。审批、删除、付款、发布、对外发送、权限变更和必须取得真实答案的问题不得标记，按官方 schema 使用 timeout: -1 保持等待。未启用 timed 时不会有超时默认策略。插件追加的默认策略不是用户回答，迟到真实回答优先。' : '') }), 'choice-pilot: optional followup guidance')
}
