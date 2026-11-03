/** Request one logged correction when an assistant claims a memory save without using the library tool. */
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Register bounded save verification; the reminder cannot approve or write anything. */
export function registerSaveRepair(ctx, enabled) {
  const repaired = new WeakMap()
  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    if (signal.aborted || !enabled() || repaired.get(agent) === turn) return
    const events = agent.session.snapshotEvents()
    const start = events.findLastIndex(event => event.type === 'turn/start' && event.data.turn === turn)
    const current = events.slice(start + 1)
    if (current.some(event => event.type === 'tool/call' && event.data.name === 'context_library_propose')) return
    const last = current.findLast(event => event.type === 'assistant/message')
    const text = last?.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? ''
    if (!/(?:已(?:保存|记住|写入|更新)[^\n]{0,80}(?:记忆|约定|偏好|书库)|(?:记忆|约定|偏好|书库)[^\n]{0,80}(?:已保存|保存成功)|(?:saved|remembered)[^\n]{0,80}(?:memory|preference|library))/iu.test(text)) return
    repaired.set(agent, turn)
    agent.steer(createUserMessage({ source: { kind: 'context-library', form: 'notice' }, content: [{ type: 'text', text: '[知忆书阁保存校验，非用户回答] 本轮没有 context_library_propose 调用，普通文字声称已保存不能作为保存证据。若用户要求记住，请现在实际调用 context_library_propose，使用当前书库，按工具返回的 saved/pending 如实报告。不得虚构条目 ID、保存成功或用户批准；不要读取无关文件。这是本轮唯一一次自动修正。' }] }))
  })
}
