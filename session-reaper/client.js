/** Direct permanent deletion; no confirmation or trash workflow. */
window.__ModuleLoader__.load({
  id: '@local/dsh-session-reaper',
  factory(require) {
    const React = require('react')
    const ReactDom = require('react-dom')
    const h = React.createElement
    const NS = 'sessionReaper'
    const zh = { menu: '删除会话', busy: '正在删除…', done: '会话已永久删除', failed: '删除失败：{message}', refreshFailed: '会话已删除，但列表刷新失败，请刷新网页。', close: '关闭', running: '会话正在运行，请先停止再删除', hint: '立即永久删除此会话，无需确认', unknown: '服务器未返回有效删除结果，请刷新列表检查' }
    const en = { menu: 'Delete session', busy: 'Deleting…', done: 'Session permanently deleted', failed: 'Delete failed: {message}', refreshFailed: 'Deleted, but list refresh failed. Reload the page.', close: 'Close', running: 'Stop the running session before deleting', hint: 'Permanently delete immediately without confirmation', unknown: 'Invalid deletion response. Refresh the list to check.' }
    const CSS = '.sr-menu-item{display:flex;align-items:center;width:100%;padding:0 10px;height:30px;border:0;background:transparent;color:var(--dsw-alias-state-error-primary,#cf5555);font:inherit;font-size:12px;text-align:left;border-radius:7px;cursor:pointer}.sr-menu-item:hover{background:rgba(214,88,88,.12)}.sr-menu-item:disabled{opacity:.5;cursor:not-allowed}.sr-menu-item:focus-visible{outline:2px solid #c9a227}.sr-notice{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:12px;max-width:min(560px,90vw);padding:12px 16px;border:1px solid #8a6a08;border-radius:12px;background:#211c12;color:#e9dcbe;box-shadow:0 8px 30px #0005;font-size:13px;overflow-wrap:anywhere}.sr-notice button{background:transparent;border:1px solid #8a6a08;border-radius:6px;color:inherit;padding:4px 8px;white-space:nowrap;cursor:pointer}'
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-reaper: dictionaries')
      const t = ctx.locale.bind(NS)
      let state = { pending: new Set(), notice: null }
      let active = true
      let timer
      const listeners = new Set()
      const store = { getSnapshot: () => state, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) } }
      function publish(next) { if (!active) return; state = next; listeners.forEach(fn => fn()) }
      function notice(text, error = false) {
        clearTimeout(timer)
        publish({ ...state, notice: { text, error } })
        if (!error) timer = setTimeout(() => publish({ ...state, notice: null }), 2600)
      }
      const current = () => ctx.uiSession.adapter.current.getSnapshot().key
      async function reap(target) {
        if (state.pending.size) return
        publish({ ...state, pending: new Set([target.id]), notice: null })
        const wasCurrent = current() === target.id
        try {
          const answer = await ctx.connection.rpc.call('/api', 'session-reaper/delete', { sessionId: target.id })
          if (!answer || answer.ok !== true) throw new Error(answer?.error?.message || t('unknown'))
          if (answer.value?.deleted !== target.id) throw new Error(t('unknown'))
          // Navigation/refresh failure must never be reported as deletion failure.
          try {
            await ctx.sessions.refresh()
            if (current() === target.id || (wasCurrent && current() == null)) {
              const next = ctx.sessions.list.getSnapshot().ids.find(id => id !== target.id)
              if (next) ctx.uiWorkspace.openSession(next)
              else ctx.uiWorkspace.startSession()
            }
            notice(t('done'))
          } catch (_) { notice(t('refreshFailed'), true) }
        } catch (error) { notice(t('failed', { message: error?.message || String(error) }), true) }
        finally { publish({ ...state, pending: new Set() }) }
      }
      function DeleteMenuItem(props) {
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        const catalog = React.useSyncExternalStore(ctx.sessions.list.subscribe, ctx.sessions.list.getSnapshot)
        const menu = props.useMenuOpenState()
        const running = catalog.byId[props.sessionId]?.running === true
        const busy = snapshot.pending.has(props.sessionId)
        return h(React.Fragment, null, h('style', null, CSS), h('button', {
          type: 'button', role: 'menuitem', className: 'sr-menu-item', disabled: running || snapshot.pending.size > 0,
          title: running ? t('running') : t('hint'),
          onClick() { menu[1](false); void reap({ id: props.sessionId }) },
        }, busy ? t('busy') : t('menu')))
      }
      function Notice() {
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        if (!snapshot.notice) return null
        return ReactDom.createPortal(h('div', { className: 'sr-notice', role: snapshot.notice.error ? 'alert' : 'status' },
          h('style', null, CSS), snapshot.notice.text,
          h('button', { type: 'button', onClick() { clearTimeout(timer); publish({ ...state, notice: null }) } }, t('close'))), document.body)
      }
      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'session-reaper', order: 460, locale: NS }, DeleteMenuItem))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'session-reaper.notice', locale: NS }, Notice))
      ctx.effect(() => () => { active = false; clearTimeout(timer); listeners.clear() }, 'session-reaper: cleanup')
    }
    return { inject: ['slots', 'locale', 'connection', 'uiSession', 'uiWorkspace', 'sessions'], apply }
  },
})
