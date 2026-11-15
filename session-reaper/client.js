/** Move stopped sessions to recovery and manage recovered records. */
window.__ModuleLoader__.load({
  id: '@local/dsh-session-reaper',
  factory(require) {
    const React = require('react')
    const ReactDom = require('react-dom')
    const h = React.createElement
    const NS = 'sessionReaper'
    const zh = {"menu": "删除会话", "busy": "正在处理…", "done": "会话已移入回收区", "failed": "移入回收区失败：{message}", "refreshFailed": "会话已移入回收区，列表刷新失败", "close": "关闭", "running": "请先停止运行中的会话", "unknown": "宿主未返回有效结果", "open": "查看回收区", "trash": "回收区", "loading": "正在读取回收区…", "empty": "回收区为空", "selectAll": "全选", "purgeSelected": "永久删除所选", "purge": "永久删除", "restore": "恢复", "operationFailed": "操作失败：{message}", "retry": "重试"}
    const en = {"menu": "Delete session", "busy": "Working\u2026", "done": "Session moved to the recycle bin", "failed": "Could not move session: {message}", "refreshFailed": "Session moved. The list could not refresh.", "close": "Close", "running": "Stop the session first", "unknown": "The host returned an invalid response", "open": "Open recycle bin", "trash": "Recycle bin", "loading": "Loading recycle bin\u2026", "empty": "Recycle bin is empty", "selectAll": "Select all", "purgeSelected": "Permanently delete selected", "purge": "Delete permanently", "restore": "Restore", "operationFailed": "The operation failed: {message}", "retry": "Retry"}
    const CSS = `
.sr-menu-item{display:block;width:100%;padding:6px 10px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-state-error-primary,#cf5555);font:inherit;text-align:start;cursor:pointer}
.sr-menu-item:hover{background:var(--dsw-alias-bg-layer-2)}
.sr-menu-item:disabled,.sr-trash button:disabled{opacity:.5;cursor:default}
.sr-notice{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:8px;max-width:90vw;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:var(--dsw-shadow-lv2);font-size:13px}
.sr-notice.sr-notice-success{box-sizing:border-box;min-height:70px;width:max-content;padding:12px 16px;border:1px solid #8a6a08;border-radius:12px;background:#211c12;color:#e9dcbe;box-shadow:0 8px 30px #0005;font-size:13px;line-height:18px;pointer-events:none}
.sr-trash{box-sizing:border-box;width:min(620px,calc(100% - 32px));max-height:80vh;overflow:auto;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}
.sr-trash::backdrop{background:var(--dsw-alias-bg-mask,rgba(0,0,0,.4))}
.sr-trash h2{font-size:16px;font-weight:500;margin:0}
.sr-trash-header,.sr-trash-row,.sr-trash-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px}
.sr-trash-row{padding:8px 0;border-top:1px solid var(--dsw-alias-border-l2)}
.sr-trash-row label{flex:1 1 180px;overflow-wrap:anywhere}
.sr-trash button,.sr-notice button{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 8px;background:var(--dsw-alias-bg-layer-2);color:inherit;font:inherit;cursor:pointer}
.sr-trash button[data-danger]{color:var(--dsw-alias-state-error-primary)}
`
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-reaper: dictionaries')
      const t = ctx.locale.bind(NS)
      let state = { pending: new Set(), notice: null, showTrash: false }
      let workspaceId
      let active = true
      let timer
      const listeners = new Set()
      const store = { getSnapshot: () => state, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } }
      function publish(next) { if (!active) return; state = next; listeners.forEach(fn => fn()) }
      function notice(text, error = false, dismiss = false) {
        clearTimeout(timer)
        publish({ ...state, notice: { text, error } })
        if (dismiss) timer = setTimeout(() => publish({ ...state, notice: null }), 1000)
      }
      const current = () => ctx.uiSession.adapter.current.getSnapshot().key
      function setPending(id, pending) {
        const next = new Set(state.pending)
        if (pending) next.add(id)
        else next.delete(id)
        publish({ ...state, pending: next })
      }
      async function reap(id) {
        if (state.pending.has(id)) return
        const session = ctx.sessions.list.getSnapshot().byId[id]
        if (session?.running !== false) { notice(t('running'), true); return }
        setPending(id, true)
        const wasCurrent = current() === id
        try {
          const answer = await ctx.connection.rpc.call('/api', 'session-reaper/delete', { sessionId: id, displayTitle: session.displayTitle })
          if (!answer || answer.ok !== true) throw new Error(answer?.error?.message || t('unknown'))
          if (answer.value?.deleted !== id) throw new Error(t('unknown'))
          try {
            await ctx.sessions.refresh()
            if (current() === id || (wasCurrent && current() == null)) {
              const next = ctx.sessions.list.getSnapshot().ids.find(candidate => candidate !== id && !state.pending.has(candidate))
              if (next) ctx.uiWorkspace.openSession(next)
              else ctx.uiWorkspace.startSession()
            }
            notice(t('done'), false, true)
          } catch (error) { notice(t('refreshFailed'), true) }
        } catch (error) { notice(t('failed', { message: error?.message || String(error) }), true) }
        finally { setPending(id, false) }
      }
      async function request(action, payload = {}) {
        const answer = await ctx.connection.rpc.call('/api', 'session-reaper/' + action, payload)
        if (answer?.ok !== true) throw new Error(answer?.error?.message || t('unknown'))
        return answer.value
      }

      async function loadTrash() {
        const value = await request('list')
        if (typeof value?.workspaceId !== 'string' || !Array.isArray(value.records)) throw new Error(t('unknown'))
        workspaceId = value.workspaceId
        return value.records
      }

      function TrashPanel() {
        const ref = React.useRef(null)
        const [records, setRecords] = React.useState([])
        const [selected, setSelected] = React.useState(new Set())
        const [busy, setBusy] = React.useState(false)
        const [loaded, setLoaded] = React.useState(false)
        const [error, setError] = React.useState('')
        const close = () => publish({ ...state, showTrash: false })
        const keyOf = record => record.partition + '/' + record.directoryKey
        async function refresh() {
          const rows = await loadTrash()
          setRecords(rows)
          setSelected(previous => new Set(rows.map(keyOf).filter(key => previous.has(key))))
          setLoaded(true)
        }
        async function perform(action) {
          setBusy(true)
          setError('')
          try { await action() }
          catch (failure) { setError(t('operationFailed', { message: failure.message || String(failure) })) }
          finally { setBusy(false) }
        }
        function purge(records) {
          void perform(async () => {
            const result = await request('purge', { records })
            await refresh()
            if (result.failed.length) throw new Error(result.failed.join(' · '))
          })
        }
        function restore(record) {
          void perform(async () => {
            const result = await request('restore', record)
            if (result?.restored !== record.sessionId) throw new Error(t('unknown'))
            await refresh()
            await ctx.sessions.refresh()
          })
        }
        React.useEffect(() => {
          const dialog = ref.current
          dialog.showModal()
          void perform(refresh)
          return () => dialog.close()
        }, [])
        const allSelected = records.length > 0 && selected.size === records.length
        return ReactDom.createPortal(h('dialog', { className: 'sr-trash', ref, 'aria-label': t('trash'),
          onCancel(event) { event.preventDefault(); if (!busy) close() } },
          h('div', { className: 'sr-trash-header' }, h('h2', null, t('trash')),
            h('button', { type: 'button', disabled: busy, onClick: close }, t('close'))),
          error ? h('p', { role: 'alert' }, error, ' ',
            h('button', { type: 'button', disabled: busy, onClick: () => { void perform(refresh) } }, t('retry'))) : null,
          !loaded && !error ? h('p', { role: 'status' }, t('loading')) : null,
          loaded && !records.length ? h('p', null, t('empty')) : null,
          records.length ? h('div', { className: 'sr-trash-row' },
            h('label', null, h('input', { type: 'checkbox', checked: allSelected, disabled: busy,
              onChange: () => setSelected(allSelected ? new Set() : new Set(records.map(keyOf))) }), t('selectAll')),
            h('button', { type: 'button', 'data-danger': true, disabled: busy || !selected.size,
              onClick: () => purge(records.filter(record => selected.has(keyOf(record)))) }, t('purgeSelected'))) : null,
          records.map(record => {
            const key = keyOf(record)
            return h('div', { className: 'sr-trash-row', key },
              h('label', null, h('input', { type: 'checkbox', checked: selected.has(key), disabled: busy,
                onChange() {
                  const next = new Set(selected)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  setSelected(next)
                } }), record.title),
              h('div', { className: 'sr-trash-actions' },
                h('button', { type: 'button', disabled: busy, onClick: () => restore(record) }, t('restore')),
                h('button', { type: 'button', 'data-danger': true, disabled: busy, onClick: () => purge([record]) }, t('purge'))))
          })), document.body)
      }

      function DeleteMenuItem(props) {
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        const catalog = React.useSyncExternalStore(ctx.sessions.list.subscribe, ctx.sessions.list.getSnapshot)
        const menu = props.useMenuOpenState()
        const running = catalog.byId[props.sessionId]?.running === true
        const busy = snapshot.pending.has(props.sessionId)
        return h(React.Fragment, null, h('style', null, CSS), h('button', {
          type: 'button', role: 'menuitem', className: 'sr-menu-item', disabled: running || busy,
          title: running ? t('running') : t('menu'),
          onClick() { menu[1](false); void reap(props.sessionId) },
        }, busy ? t('busy') : t('menu')))
      }
      function Overlay() {
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        React.useEffect(() => {
          void loadTrash().catch(error => notice(t('operationFailed', { message: error.message }), true))
        }, [])
        return h(React.Fragment, null, h('style', null, CSS),
          snapshot.showTrash ? h(TrashPanel) : null,
          snapshot.notice ? ReactDom.createPortal(h('div', { className: snapshot.notice.error ? 'sr-notice' : 'sr-notice sr-notice-success' },
            h('span', { role: snapshot.notice.error ? 'alert' : 'status' }, snapshot.notice.text),
            snapshot.notice.error ? h('button', { type: 'button',
              onClick() { publish({ ...state, notice: null }) } }, t('close')) : null), document.body) : null)
      }
      ctx.effect(() => ctx.contextMenus.register({
        id: 'session-reaper.recycle-bin', target: 'workspace', order: 10,
        resolve: ({ workspaceId: target }) => target === workspaceId ? [{
          id: 'open-recycle-bin', label: t('open'), run: () => publish({ ...state, showTrash: true }),
        }] : [],
      }), 'session-reaper: recycle bin workspace action')
      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'session-reaper', order: 460, locale: NS }, DeleteMenuItem))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'session-reaper.notice', locale: NS }, Overlay))
      ctx.effect(() => () => { active = false; clearTimeout(timer); listeners.clear() }, 'session-reaper: cleanup')
    }
    return { inject: ['slots', 'locale', 'contextMenus', 'connection', 'uiSession', 'uiWorkspace', 'sessions'], apply }
  },
})
