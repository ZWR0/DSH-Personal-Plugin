/** Offer clickable replies for ordinary conversation. */
import { registerFollowups } from './followups.js'

export const inject = ['systemPrompt', 'tools']

const SECTION = [
  '## 选项领航：聊天快捷回复',
  '在日常聊天中，如果用户可能想选话题、讲解深度、示例、比较方向或下一步，可以用 suggest_followups 给出 1–4 个简短按钮，让用户点一下就能表达意图。',
  '能直接回答时先回答。轻松聊天如果只需选一个方向，可以先用一句自然的引导，再给出按钮。每个按钮的 prompt 都要是用户点选后可直接发送的完整消息，尽量贴近用户口吻。',
  '选项应有实际区别，优先覆盖最可能的意图。没有自然分支、用户要求直接回答或不希望有选项时，直接结束。',
  '按钮只用于用户主动开启下一轮聊天。任务执行中所需的信息、确认和审批走官方交互。不要用这些按钮等待答复、替用户选择，或把已授权的工作推迟到下一轮。',
].join('\n')

export function apply(ctx) {
  registerFollowups(ctx)
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'choice-pilot',
    order: 60,
    text: SECTION,
  }), 'choice-pilot: chat quick replies')
}
