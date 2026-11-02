/**
 * Quote selected assistant reply text through the native composer quote API.
 * Older hosts fall back to Markdown. Selection stays local to the browser.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-quote-relay',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const NS = 'quoteRelay'
    const MIN_CHARS = 1
    const MAX_CHARS = 8000

    const zh = {
      action: '引用到输入框',
      actionCount: '引用 {count} 字',
      inserted: '已加入输入框',
      label: '引文速递',
      tooLong: '选中 {count} 字，最多引用 8000 字，请缩小选区',
      failed: '当前无法插入引用，请回到普通输入模式后重试',
    }

    const en = {
      action: 'Quote to composer',
      actionCount: 'Quote {count} chars',
      inserted: 'Added to composer',
      label: 'Quote relay',
      tooLong: '{count} characters selected; limit is 8000. Select a shorter passage.',
      failed: 'Cannot insert a quote now. Return to the normal composer and retry.',
    }

    const CSS = [
      '.qr-btn{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:8px;',
      'border:1px solid rgba(160,118,10,.36);background:linear-gradient(180deg,rgba(201,162,39,.16),rgba(201,162,39,.05));',
      'color:#7a5c06;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;animation:qr-in .16s ease-out;}',
      '.qr-btn:hover{border-color:#8a6a08;color:#5c4304;}',
      '.qr-btn svg{display:block;}',
      '.qr-btn:focus-visible{outline:2px solid #c9a227;outline-offset:3px;}',
      '.qr-btn:disabled{opacity:.65;cursor:not-allowed;}',
      '.qr-error{font-size:11px;max-width:260px;}',
      '.qr-done{display:inline-flex;align-items:center;height:26px;font-size:11px;color:#7a5c06;animation:qr-in .16s ease-out;}',
      'body[data-ds-dark-theme] .qr-btn{color:#e8c766;border-color:rgba(201,162,39,.42);}',
      'body[data-ds-dark-theme] .qr-btn:hover{color:#f0d78a;border-color:#c9a227;}',
      'body[data-ds-dark-theme] .qr-done{color:#e8c766;}',
      '@keyframes qr-in{from{opacity:0;transform:translateY(2px);}to{opacity:1;transform:none;}}',
      '@media (prefers-reduced-motion:reduce){.qr-btn,.qr-done{animation:none;}}',
    ].join('')

    function StyleTag() {
      return h('style', { key: 'qr-style', 'data-dsh-plugin': 'quote-relay' }, CSS)
    }

    function QuoteGlyph() {
      return h('svg', { width: 11, height: 11, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', {
          d: 'M3 9.5C3 6.9 4.6 4.9 7 4v2.1c-1.2.5-1.9 1.3-2.1 2.4H7V13H3zM9 9.5C9 6.9 10.6 4.9 13 4v2.1c-1.2.5-1.9 1.3-2.1 2.4H13V13H9z',
          fill: 'currentColor',
        }))
    }

    function editableOf(node) {
      if (!node) return null
      const element = node.nodeType === 1 ? node : node.parentElement
      if (!element) return null
      return element.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')
    }

    function selectionText() {
      if (typeof window === 'undefined' || typeof window.getSelection !== 'function') return ''
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''
      const text = selection.toString().replace(/\r\n/g, '\n')
      if (text.trim().length < MIN_CHARS) return ''
      if (editableOf(selection.anchorNode)) return ''
      if (editableOf(selection.focusNode)) return ''
      const anchor = selection.anchorNode && selection.anchorNode.nodeType === 1
        ? selection.anchorNode
        : selection.anchorNode ? selection.anchorNode.parentElement : null
      if (anchor && anchor.closest('[role="dialog"], [role="menu"], nav, [data-row-key], .lv-root, .sr-dialog')) return ''
      const focus = selection.focusNode?.nodeType === 1 ? selection.focusNode : selection.focusNode?.parentElement
      const seat = anchor?.closest('[data-chat-flow-kind="assistant-step"]')
      if (!seat || focus?.closest('[data-chat-flow-kind="assistant-step"]') !== seat) return ''
      const blocked = 'input, textarea, [contenteditable], button, [role="dialog"], [role="menu"], nav, [data-chat-group-part="reasoning"], [data-variant="think"], [hidden], [data-turn-process-hidden="true"]'
      if (anchor.closest(blocked) || focus.closest(blocked)) return ''
      const range = selection.getRangeAt(0)
      if ([...seat.querySelectorAll(blocked)].some(node => range.intersectsNode(node))) return ''
      return text.trim()
    }

    function quoteMarkdown(text) {
      return text.split('\n').map(function (line) { return line.trimEnd() === '' ? '>' : '> ' + line }).join('\n')
    }

    function QuoteButton(props) {
      const [selection, setSelection] = useState('')
      const [done, setDone] = useState(false)
      useEffect(() => { setSelection(''); setError('') }, [props.sessionId])
      const [error, setError] = useState('')
      const pending = useRef(false)
      const doneTimer = useRef(null)
      const draft = props.useInput(function (state) { return state.draft })
      const draftRef = useRef(draft)
      draftRef.current = draft

      useEffect(function () {
        let frame = 0
        const update = function () {
          if (frame !== 0) return
          frame = requestAnimationFrame(function () {
            frame = 0
            setSelection(selectionText())
            setError('')
          })
        }
        document.addEventListener('selectionchange', update)
        document.addEventListener('mouseup', update, true)
        document.addEventListener('keyup', update, true)
        return function () {
          if (frame !== 0) cancelAnimationFrame(frame)
          document.removeEventListener('selectionchange', update)
          document.removeEventListener('mouseup', update, true)
          document.removeEventListener('keyup', update, true)
          if (doneTimer.current !== null) clearTimeout(doneTimer.current)
        }
      }, [])

      const insert = useCallback(function () {
        const text = selectionText() || selection
        if (text === '') return
        if (pending.current || Array.from(text).length > MAX_CHARS) return
        pending.current = true
        try {
          if (typeof props.inputActions.insertQuote === 'function') {
            if (!props.inputActions.insertQuote(text)) {
              setError(props.t('failed'))
              return
            }
          } else {
            const quoted = quoteMarkdown(text)
            const current = draftRef.current || ''
            props.inputActions.setDraft(quoted + '\n\n' + current)
            if (typeof props.inputActions.focus === 'function') props.inputActions.focus()
          }
        } catch (_) {
          setError(props.t('failed'))
          return
        } finally {
          pending.current = false
        }
        setSelection('')
        const selection2 = window.getSelection()
        if (selection2) selection2.removeAllRanges()
        setDone(true)
        if (doneTimer.current !== null) clearTimeout(doneTimer.current)
        doneTimer.current = setTimeout(function () { setDone(false) }, 1400)
      }, [props, selection])

      if (done && selection === '') {
        return h(React.Fragment, null, h(StyleTag), h('span', { className: 'qr-done', role: 'status' }, props.t('inserted')))
      }
      if (selection === '') return null
      const count = Array.from(selection).length
      const title = count > MAX_CHARS ? props.t('tooLong', { count }) : props.t('action') + '\n' + selection.slice(0, 240) + (selection.length > 240 ? '…' : '')
      return h(React.Fragment, null,
        h(StyleTag),
        error ? h('span', { className: 'qr-error', role: 'alert' }, error) : null,
        selection ? h('button', {
          type: 'button',
          className: 'qr-btn',
          title: title,
          disabled: count > MAX_CHARS,
          'aria-label': count > MAX_CHARS ? title : props.t('actionCount', { count }),
          onMouseDown: function (event) { event.preventDefault() },
          onClick: insert,
        }, h(QuoteGlyph), props.t('actionCount', { count })) : null)
    }

    function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'quote-relay: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('conversation.input.right', function () {
        return ctx.slots.register({
          name: 'conversation.input.right',
          id: 'quote-relay',
          order: 5,
          locale: NS,
          label: function () { return t('label') },
        }, QuoteButton)
      })
    }

    return { inject: ['slots', 'locale'], apply: apply }
  },
})
