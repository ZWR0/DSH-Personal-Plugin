/** Render optional next-task suggestions without changing official question cards. */
window.__ModuleLoader__.load({
  id: '@local/dsh-choice-pilot',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'choicePilot'
    const zh = {}
    const en = {}
    Object.assign(zh, { next: '下一步建议', expand: '展开建议', collapse: '收起', inserted: '已填入草稿，请审查后手动发送', insertFailed: '暂时无法填入草稿，请稍后重试', saveFailed: '内容已填入，但草稿保存失败，请检查输入框并保留内容', filled: '已选择', submitted: '已提交发送；若发送失败，请在输入框重试' })
    Object.assign(en, { next: 'Next-step suggestions', expand: 'Show suggestions', collapse: 'Collapse', inserted: 'Added to your draft. Review it and send when ready.', insertFailed: 'Could not insert into the draft. Try again when editing is available.', saveFailed: 'Text was inserted, but saving the draft failed. Check the input and keep a copy.', filled: 'Selected', submitted: 'Submitted. If sending fails, retry from the composer.' })
    const CSS = `
.cp-followups {
  display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:8px;
  width:100%;max-width:var(--dsh-composer-card-max-width,780px);margin:6px auto;padding:8px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-panel,12px);
  background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-shadow-lv2);
  box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px
}
.cp-followups[data-collapsed=true] {
  justify-content:flex-end;padding:0;border:0;background:transparent;box-shadow:none
}
.cp-followup-options {display:flex;flex:1 1 220px;min-width:0;flex-wrap:wrap;gap:8px}
.cp-followup-options[hidden] {display:none}
.cp-followups button {
  min-height:44px;max-width:100%;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-md,10px);font:inherit;text-align:left;overflow-wrap:anywhere;
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);cursor:pointer
}
.cp-followup-options button {box-shadow:var(--dsw-shadow-lv1)}
.cp-followups .cp-followup-toggle {margin-inline-start:auto;background:transparent}
.cp-followups button:disabled {opacity:.6;cursor:default}
.cp-followups button:focus-visible {outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.cp-followups p {flex-basis:100%;margin:0;color:var(--dsw-alias-label-secondary);line-height:1.5}
.cp-followups [role=alert] {color:var(--dsw-alias-state-error-primary)}
@media(hover:hover) {
  .cp-followups button:hover:not(:disabled) {border-color:var(--dsw-alias-state-business-primary)}
  .cp-followup-options button:hover:not(:disabled) {box-shadow:var(--dsw-shadow-lv2)}
}
@media(prefers-reduced-motion:no-preference) {
  .cp-followup-options button {transition:border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease}
  .cp-followup-options button:active:not(:disabled) {transform:translateY(1px)}
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
      const input = props.useInput(snapshot => snapshot)
      const phase = input.phase
      const current = React.useMemo(() => latestFollowups(chat), [chat])
      const [feedback, setFeedback] = React.useState({ key: '', label: '', error: false })
      const [collapsed, setCollapsed] = React.useState(false)
      const optionsId = React.useId()
      const used = React.useRef(new Set())
      const identity = props.sessionId + ':' + (current?.callId || '')
      React.useEffect(() => {
        used.current.clear()
        setFeedback({ key: '', label: '', error: false })
        setCollapsed(false)
      }, [identity])
      if (!current) return null
      return h('section', { className: 'cp-followups', 'aria-label': props.t('next'), 'data-collapsed': collapsed },
        h('div', { id: optionsId, className: 'cp-followup-options', hidden: collapsed }, current.suggestions.map(item => h('button', {
          key: item.label, type: 'button', disabled: phase !== 'plain' || used.current.has(item.label),
          onClick: () => {
            if (used.current.has(item.label)) return
            try {
              const span = props.inputActions.captureInsertion()
              const send = input.draft === '' && input.attachmentIds?.length === 0
              // Collapse after the retained selection: never replace selected text or inline references.
              const text = (span.end ? '\n\n' : '') + item.prompt + '\n\n'
              if (!props.inputActions.insertText(text, { ...span, start: span.end })) {
                setFeedback({ key: identity, label: '', error: true })
                return
              }
              used.current.add(item.label)
              setFeedback({ key: identity, label: item.label, error: false, sent: send })
              if (send) { props.inputActions.submit(); return }
              try { props.inputActions.persistDraft() } catch {
                setFeedback({ key: identity, label: item.label, error: true })
              }
            } catch {
              setFeedback({ key: identity, label: '', error: true })
            }
          },
        }, item.label, used.current.has(item.label) ? ' · ' + props.t('filled') : ''))),
        h('button', {
          className: 'cp-followup-toggle', type: 'button', 'aria-expanded': !collapsed, 'aria-controls': optionsId,
          onClick: () => setCollapsed(value => !value),
        }, props.t(collapsed ? 'expand' : 'collapse')),
        !collapsed && feedback.key === identity ? h('p', { role: feedback.error ? 'alert' : 'status', 'aria-live': 'polite' }, props.t(feedback.error ? feedback.label ? 'saveFailed' : 'insertFailed' : feedback.sent ? 'submitted' : 'inserted')) : null)
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'choice-pilot: dictionaries')
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({ name: 'conversation.input.dock', id: 'choice-pilot-followups', order: 21, locale: NS }, FollowupDrafts))
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshPlugin = 'choice-pilot'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'choice-pilot: followup styling')
      },
    }
  },
})
