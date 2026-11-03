/** Attach a recorded fallback policy after an official timed question remains pending. */
import { createUserMessage } from '@deepseek-ai/dsh-llm'

const RECOMMENDED = /[（(](?:推荐|recommended)[）)]\s*$/iu
const APPROVAL = /授权|批准|审批|删除|发布|付款|支付|对外发送|permission|approv|authoriz|delet|publish|payment|send/iu

/** Return only explicitly eligible preference defaults; never return an answer batch. */
export function preferenceDefaults(questions) {
  if (!Array.isArray(questions) || !questions.length) return []
  return questions.flatMap(question => {
    if (question?.intent || typeof question?.header !== 'string' || !question.header.startsWith('[可逆偏好]')
      || typeof question.question !== 'string' || APPROVAL.test(question.header + ' ' + question.question)
      || !Array.isArray(question.options)) return []
    const recommended = question.options.filter(option => typeof option.label === 'string' && RECOMMENDED.test(option.label))
    if (!recommended.length || (!question.multi_select && recommended.length !== 1)
      || recommended.some(option => APPROVAL.test(option.label + ' ' + (option.description || '')))) return []
    return [{ id: question.id, defaults: recommended.map(option => option.label) }]
  })
}

/** Preserve official results and cancellation; append policy context only after an accepted pending result. */
export function registerPreferenceDefaults(ctx) {
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (decision.kind !== 'accept' || 'value' in decision || 'content' in decision || exec.signal.aborted
      || exec.name !== 'ask_user_question' || result.isError || result.value?.pending !== true
      || result.value.callId !== exec.callId || exec.arguments?.timeout === -1) return decision
    const defaults = preferenceDefaults(exec.arguments?.questions)
    if (!defaults.length) return decision
    const context = createUserMessage({ source: { kind: 'choice-pilot-defaults', form: 'notice' }, content: [{ type: 'text', text:
      '[选项领航默认策略，非用户回答] 官方问题仍为 pending，用户尚未作答。对于下面标记为可逆偏好的问题，可暂按推荐方案继续可逆工作：'
      + JSON.stringify({ callId: exec.callId, defaults })
      + '。这是用户启用的插件默认策略，不是用户选择或批准。不得据此执行删除、付款、对外发送、发布或权限变更。未列出的问题继续等待真实答案，只做独立工作；不要重复提问。最终说明采用的默认方案。官方迟到回答仍有效，后续真实回答优先并修正尚未执行的工作。' }] })
    return { ...decision, additionalContexts: [...(decision.additionalContexts || []), context] }
  })
}
