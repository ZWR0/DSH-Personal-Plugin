/** Register optional next-turn prompts without asking or answering a question. */
export function registerFollowups(ctx) {
  const schema = {
    type: 'object', additionalProperties: false, required: ['suggestions'],
    properties: { suggestions: { type: 'array', description: 'One to four optional next-turn drafts.', items: {
      type: 'object', additionalProperties: false, required: ['label', 'prompt'],
      properties: { label: { type: 'string', description: 'Nonblank button label, at most 80 characters.' }, prompt: { type: 'string', description: 'Complete user request, at most 2000 characters.' } },
    } } },
  }
  ctx.tools.register({
    name: 'suggest_followups',
    description: 'Offer 1–4 optional next-turn suggestions after delivering the current result. Each prompt is a complete user request. This ends the current turn without waiting or executing a suggestion. Clicking only inserts text into the draft; only the user can send it. Never use this for information or decisions required to complete the current task.',
    parameters: schema,
    output: {
      schema,
      render: (_args, value) => [{ type: 'text', text: 'Optional next-turn drafts are available: ' + value.suggestions.map(item => item.label).join(' / ') + '. Nothing was selected or sent.' }],
      presentationMeta: (_args, value) => ({ choicePilotFollowups: value.suggestions }),
    },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const suggestions = args?.suggestions
      if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => key !== 'suggestions')
        || !Array.isArray(suggestions) || suggestions.length < 1 || suggestions.length > 4
        || suggestions.some(item => !item || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 80
          || typeof item.prompt !== 'string' || !item.prompt.trim() || item.prompt.length > 2000 || Object.keys(item).some(key => key !== 'label' && key !== 'prompt'))
        || new Set(suggestions.map(item => item.label.trim())).size !== suggestions.length) {
        throw new Error('suggest_followups requires 1–4 distinct labels and nonblank complete prompts')
      }
      exec.concludeTurn()
      return { suggestions: suggestions.map(item => ({ label: item.label.trim(), prompt: item.prompt.trim() })) }
    },
    presentCall: () => ({ card: 'generic', title: 'Next-step suggestions' }),
  })
}
