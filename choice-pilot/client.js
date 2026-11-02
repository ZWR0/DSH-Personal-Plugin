/** Theme the native question card through its question and option markers. */
window.__ModuleLoader__.load({
  id: '@local/dsh-choice-pilot',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'choicePilot'
    const zh = { history: '选择回顾', original: '定位原问题与回答', empty: '已跳过', unavailable: '原记录不在当前已加载页面' }
    const en = { history: 'Choice history', original: 'Locate question and answer', empty: 'Skipped', unavailable: 'Original record is not currently loaded' }
    const CSS = `
.cp-history {
  width:100%;max-width:var(--dsh-composer-card-max-width,780px);margin:4px auto;
  padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:13px;
}
.cp-history > summary {display:flex;align-items:center;gap:8px;min-height:38px;cursor:pointer;list-style:none;font-weight:500}
.cp-history > summary::-webkit-details-marker {display:none}
.cp-history > summary::before {content:'›';font-size:18px;line-height:1;transform:rotate(0deg)}
.cp-history[open] > summary::before {transform:rotate(90deg)}
.cp-history > div {padding:12px 0 14px;border-top:1px solid var(--dsw-alias-border-l2)}
.cp-history dl {margin:0}
.cp-history dt {margin-bottom:10px;color:var(--dsw-alias-label-primary);font-weight:500;overflow-wrap:anywhere}
.cp-history dd {display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
.cp-answer {padding:4px 9px;border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;max-width:100%}
.cp-custom {flex-basis:100%;margin:4px 0;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.cp-history button {font:inherit;color:var(--dsw-alias-link);background:transparent;border:0;padding:5px 0;cursor:pointer;text-align:left}
.cp-history button:focus-visible,.cp-history summary:focus-visible {outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px;border-radius:4px}
[data-question-key] > [aria-labelledby] {
  border:1px solid var(--dsw-alias-border-l2);
  box-shadow:0 8px 28px color-mix(in srgb,var(--dsw-alias-label-primary) 5%,transparent);
}
[data-question-key] [role="group"]:has(> [data-option-row]),
[data-question-key] [role="radiogroup"]:has(> [data-option-row]) {display:flex;flex-direction:column;gap:8px;padding:12px 16px}
[data-question-key] [data-option-row] {
  margin:0;border:1px solid transparent;border-radius:12px;
  background:var(--dsw-alias-bg-layer-1);box-shadow:none;
}
[data-question-key] [data-option-row] > [role] {
  min-height:56px;padding:12px 14px;gap:12px;border-radius:inherit;
  color:var(--dsw-alias-label-primary);
}
[data-question-key] [data-option-line] {gap:8px;line-height:22px}
[data-question-key] [data-option-description] {color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;margin-top:4px}
[data-question-key] [data-option-row]:has([aria-checked="true"]) {
  border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,var(--dsw-alias-border-l2));
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 7%,var(--dsw-alias-bg-layer-1));
  box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 6%,transparent);
}
[data-question-key] [data-option-row]:has(:focus-visible) {outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}
@media (hover:hover) {
  [data-question-key] [data-option-row]:has([role]:not(:disabled)):hover {background:var(--dsw-alias-bg-layer-2)}
  .cp-history button:hover {text-decoration:underline;text-underline-offset:3px}
}
@media (max-width:600px) {
  .cp-history > summary,.cp-history button {min-height:44px}
  [data-question-key] [role="group"]:has(> [data-option-row]),[data-question-key] [role="radiogroup"]:has(> [data-option-row]) {padding:10px;gap:8px}
}
@media (prefers-reduced-motion:no-preference) {
  [data-question-key] [data-option-row] {transition:background-color 160ms ease,border-color 160ms ease,box-shadow 160ms ease}
  .cp-history > summary::before {transition:transform 160ms ease}
}
@media (prefers-reduced-motion:reduce) {
  [data-question-key] [data-option-row],.cp-history > summary::before {transition:none}
}

`
    function ChoiceHistory(props) {
      const chat = props.useChat(snapshot => snapshot)
      const replies = React.useMemo(() => chat.order.map(key => chat.nodes.get(key)).filter(node => node?.kind === 'question-reply').slice(-5), [chat])
      const [error, setError] = React.useState('')
      React.useEffect(() => setError(''), [props.sessionId])
      if (!replies.length) return null
      return h('details', { className: 'cp-history' }, h('summary', null, props.t('history')),
        error ? h('p', { role: 'status' }, error) : null,
        replies.map(node => h('div', { key: node.key },
          h('dl', null, node.data.questions.map(question => {
            const answer = node.data.answers.find(item => item.id === question.id)
            return h('div', { key: question.id }, h('dt', null, question.question), h('dd', null,
              (answer?.selected || []).map(value => h('span', { className: 'cp-answer', key: value }, value)),
              answer?.custom ? h('p', { className: 'cp-custom' }, answer.custom) : null,
              !answer?.selected?.length && !answer?.custom ? props.t('empty') : null))
          })),
          h('button', { type: 'button', onClick: () => {
            const target = [...document.querySelectorAll('[data-question-reply]')].find(element => element.dataset.questionReply === node.data.callId)
            if (target) { target.scrollIntoView({ block: 'center', behavior: 'auto' }); setError('') }
            else setError(props.t('unavailable'))
          } }, props.t('original')))))
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'choice-pilot: dictionaries')
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'choice-pilot-history', order: 22, locale: NS }, ChoiceHistory))
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshPlugin = 'choice-pilot'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'choice-pilot: native question styling')
      },
    }
  },
})
