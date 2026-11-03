/** Theme the native question card through its question and option markers. */
window.__ModuleLoader__.load({
  id: '@local/dsh-choice-pilot',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'choicePilot'
    const zh = { history: '选择回顾', original: '定位原问题与回答', empty: '已跳过', unavailable: '原记录不在当前已加载页面' }
    const en = { history: 'Choice history', original: 'Locate question and answer', empty: 'Skipped', unavailable: 'Original record is not currently loaded' }
    Object.assign(zh, { next: '下一步建议', hint: '点击只填入草稿，审查后由你发送', inserted: '已填入草稿，请审查后手动发送', insertFailed: '暂时无法填入草稿，请稍后重试', saveFailed: '内容已填入，但草稿保存失败，请检查输入框并保留内容', filled: '已填入' })
    Object.assign(en, { next: 'Next-step suggestions', hint: 'Click to fill the draft. Review and send it yourself.', inserted: 'Added to your draft. Review it and send when ready.', insertFailed: 'Could not insert into the draft. Try again when editing is available.', saveFailed: 'Text was inserted, but saving the draft failed. Check the input and keep a copy.', filled: 'Added' })
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
.cp-followups{width:100%;max-width:var(--dsh-composer-card-max-width,780px);margin:6px auto;padding:12px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-layer-1);box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px}
.cp-followups h3{margin:0 0 4px;font:inherit;font-weight:600}.cp-followups p{margin:4px 0 8px;color:var(--dsw-alias-label-secondary);line-height:1.5}.cp-followups>div{display:flex;flex-wrap:wrap;gap:8px}.cp-followups button{min-height:44px;max-width:100%;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;font:inherit;text-align:left;overflow-wrap:anywhere;color:var(--dsw-alias-link);background:var(--dsw-alias-bg-layer-2);cursor:pointer}.cp-followups button:disabled{opacity:.6;cursor:default}.cp-followups button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:3px}.cp-followups [role=alert]{color:var(--dsw-alias-state-error-primary)}
@media(hover:hover){.cp-followups button:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}}
@media(prefers-reduced-motion:no-preference){.cp-followups button{transition:background-color 140ms ease,border-color 140ms ease,transform 140ms ease}.cp-followups button:active:not(:disabled){transform:translateY(1px)}}
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
    /** Read only successful structured suggestions, including native calls nested inside PTC. */
    function latestFollowups(chat) {
      let latest = null
      let latestUser = -1
      for (const key of chat.order) {
        const node = chat.nodes.get(key)
        if (node?.kind === 'user') latestUser = Math.max(latestUser, node.anchorSeq)
        if (node?.kind !== 'tool-call') continue
        const pending = [node.data.root]
        while (pending.length) {
          const block = pending.pop()
          if (!block) continue
          pending.push(...block.subCalls || [])
          if (block.kind !== 'tool-result' || block.isError || block.name !== 'suggest_followups') continue
          let suggestions = block.meta?.choicePilotFollowups
          // PTC records successful child-call arguments even when result metadata is absent.
          if (!suggestions && block.call?.argsRaw) {
            try { suggestions = JSON.parse(block.call.argsRaw).suggestions } catch { continue }
          }
          if (!Array.isArray(suggestions) || !suggestions.length || suggestions.length > 4
            || !suggestions.every(item => item && typeof item.label === 'string' && item.label.trim() && item.label.length <= 80
              && typeof item.prompt === 'string' && item.prompt.trim() && item.prompt.length <= 2000)) continue
          if (!latest || block.seq > latest.seq) latest = { seq: block.seq, callId: block.callId, suggestions }
        }
      }
      return latest && latest.seq > latestUser ? latest : null
    }
    function FollowupDrafts(props) {
      const chat = props.useChat(snapshot => snapshot)
      const phase = props.useInput(snapshot => snapshot.phase)
      const current = React.useMemo(() => latestFollowups(chat), [chat])
      const [feedback, setFeedback] = React.useState({ key: '', label: '', error: false })
      const used = React.useRef(new Set())
      const identity = props.sessionId + ':' + (current?.callId || '')
      React.useEffect(() => { used.current.clear(); setFeedback({ key: '', label: '', error: false }) }, [identity])
      if (!current) return null
      return h('section', { className: 'cp-followups', 'aria-label': props.t('next') },
        h('h3', null, props.t('next')), h('p', null, props.t('hint')),
        h('div', null, current.suggestions.map(item => h('button', {
          key: item.label, type: 'button', disabled: phase !== 'plain' || used.current.has(item.label),
          onClick: () => {
            if (used.current.has(item.label)) return
            try {
              const span = props.inputActions.captureInsertion()
              // Collapse after the retained selection: never replace selected text or inline references.
              const text = (span.end ? '\n\n' : '') + item.prompt + '\n\n'
              if (!props.inputActions.insertText(text, { ...span, start: span.end })) {
                setFeedback({ key: identity, label: '', error: true })
                return
              }
              used.current.add(item.label)
              setFeedback({ key: identity, label: item.label, error: false })
              try { props.inputActions.persistDraft() } catch {
                setFeedback({ key: identity, label: item.label, error: true })
              }
            } catch {
              setFeedback({ key: identity, label: '', error: true })
            }
          },
        }, item.label, used.current.has(item.label) ? ' · ' + props.t('filled') : ''))),
        feedback.key === identity ? h('p', { role: feedback.error ? 'alert' : 'status', 'aria-live': 'polite' }, props.t(feedback.error ? feedback.label ? 'saveFailed' : 'insertFailed' : 'inserted')) : null)
    }
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
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'choice-pilot-followups', order: 21, locale: NS }, FollowupDrafts))
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
