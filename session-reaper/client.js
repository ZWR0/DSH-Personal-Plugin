/** Preview and confirm permanent deletion of stopped sessions. */
window.__ModuleLoader__.load({
  id: '@local/dsh-session-reaper',
  factory(require) {
    const React = require('react')
    const ReactDom = require('react-dom')
    const h = React.createElement
    const NS = 'sessionReaper'
    const zh = { tab: '会话清道', preview: '清理预览', confirm: '确认永久删除 {count} 个会话', cancel: '取消', scope: '按项目筛选', allProjects: '所有项目', older: '最近更新早于（天）', search: '搜索会话', choose: '选择待清理会话', warning: '永久删除后无法撤回；运行中的会话不会删除', noMatches: '没有符合条件的已停止会话', previewCount: '已选 {count} 个会话',  menu: '删除会话', busy: '正在删除…', done: '会话已永久删除', failed: '删除失败：{message}', refreshFailed: '会话已删除，但列表刷新失败，请刷新网页。', close: '关闭', running: '会话正在运行，请先停止再删除', hint: '预览并确认永久删除此会话', unknown: '服务器未返回有效删除结果，请刷新列表检查' }
    const en = { tab: 'Session reaper', preview: 'Review cleanup', confirm: 'Permanently delete {count} sessions', cancel: 'Cancel', scope: 'Filter by project', allProjects: 'All projects', older: 'Last updated more than (days)', search: 'Search sessions', choose: 'Choose sessions to delete', warning: 'Permanent deletion cannot be undone. Running sessions are excluded.', noMatches: 'No stopped sessions match', previewCount: '{count} sessions selected',  menu: 'Delete session', busy: 'Deleting…', done: 'Session permanently deleted', failed: 'Delete failed: {message}', refreshFailed: 'Deleted, but list refresh failed. Reload the page.', close: 'Close', running: 'Stop the running session before deleting', hint: 'Preview and confirm permanent deletion', unknown: 'Invalid deletion response. Refresh the list to check.' }
    const CSS = '.sr-panel h2,.sr-dialog h3{font-weight:500}.sr-panel input[type=checkbox]{accent-color:var(--dsw-alias-state-business-primary)}.sr-row:has(:checked){background:var(--dsw-alias-bg-layer-2);border-radius:8px}.sr-dialog button:focus-visible,.sr-panel button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.sr-dialog button:disabled,.sr-panel button:disabled{opacity:.5;cursor:not-allowed}.sr-panel{padding:24px;color:var(--dsw-alias-label-primary);font-size:13px}.sr-filters{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px}.sr-filters label{display:grid;gap:6px;min-width:0}.sr-panel input,.sr-panel select{font:inherit;max-width:100%;padding:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:inherit}.sr-row{display:flex;align-items:center;gap:8px;min-height:44px;overflow-wrap:anywhere}.sr-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:var(--dsw-alias-bg-mask,rgba(0,0,0,.4));padding:20px}.sr-dialog{width:min(520px,100%);max-height:80vh;overflow:auto;padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px}.sr-dialog button,.sr-panel button{font:inherit;padding:8px 12px;margin:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}.sr-dialog button:last-child{color:var(--dsw-alias-state-error-primary)}' + '.sr-menu-item{display:flex;align-items:center;width:100%;padding:0 10px;height:30px;border:0;background:transparent;color:var(--dsw-alias-state-error-primary,#cf5555);font:inherit;font-size:12px;text-align:left;border-radius:7px;cursor:pointer}.sr-menu-item:hover{background:rgba(214,88,88,.12)}.sr-menu-item:disabled{opacity:.5;cursor:not-allowed}.sr-menu-item:focus-visible{outline:2px solid #c9a227}.sr-notice{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:12px;max-width:min(560px,90vw);padding:12px 16px;border:1px solid #8a6a08;border-radius:12px;background:#211c12;color:#e9dcbe;box-shadow:0 8px 30px #0005;font-size:13px;overflow-wrap:anywhere}.sr-notice button{background:transparent;border:1px solid #8a6a08;border-radius:6px;color:inherit;padding:4px 8px;white-space:nowrap;cursor:pointer}'
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-reaper: dictionaries')
      const t = ctx.locale.bind(NS)
      let state = { pending: new Set(), notice: null, preview: null }
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
        if (state.pending.size) return false
        if (ctx.sessions.list.getSnapshot().byId[target.id]?.running !== false) { notice(t('running'), true); return false }
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
          return true
        } catch (error) { notice(t('failed', { message: error?.message || String(error) }), true); return false }
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
          onClick() { menu[1](false); publish({ ...state, preview: [props.sessionId] }) },
        }, busy ? t('busy') : t('menu')))
      }
      function CleanupPanel() {
        const catalog = React.useSyncExternalStore(ctx.sessions.list.subscribe, ctx.sessions.list.getSnapshot)
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        const [project, setProject] = React.useState('')
        const [days, setDays] = React.useState('30')
        const [query, setQuery] = React.useState('')
        const [selected, setSelected] = React.useState(new Set())
        const projects = [...new Set(catalog.ids.map(id => catalog.byId[id]?.cwd).filter(Boolean))]
        const rows = catalog.ids.map(id => catalog.byId[id]).filter(row => row && row.running === false && (!project || row.cwd === project) &&
          (!Number(days) || row.updatedAt && row.updatedAt < Date.now() - Number(days) * 86400000) &&
          (!query || (row.displayTitle || row.title || row.id).toLowerCase().includes(query.toLowerCase())))
        const chosen = rows.filter(row => selected.has(row.id))
        return h('section', { className: 'sr-panel' }, h('style', null, CSS), h('h2', null, t('tab')),
          h('p', null, t('warning')),
          h('div', { className: 'sr-filters' },
            h('label', null, t('scope'), h('select', { value: project, onChange: event => setProject(event.target.value) }, h('option', { value: '' }, t('allProjects')), projects.map(value => h('option', { key: value, value }, value)))),
            h('label', null, t('older'), h('input', { type: 'number', min: 0, value: days, onChange: event => setDays(event.target.value) })),
            h('label', null, t('search'), h('input', { value: query, onChange: event => setQuery(event.target.value) }))),
          h('div', { role: 'group', 'aria-label': t('choose') }, rows.map(row => h('label', { className: 'sr-row', key: row.id },
            h('input', { type: 'checkbox', checked: selected.has(row.id), onChange: event => { const checked = event.target.checked; setSelected(current => { const next = new Set(current); checked ? next.add(row.id) : next.delete(row.id); return next }) } }), row.displayTitle || row.title || row.id)), !rows.length ? h('p', null, t('noMatches')) : null),
          h('p', { role: 'status' }, t('previewCount', { count: chosen.length })),
          h('button', { type: 'button', disabled: !chosen.length || snapshot.pending.size > 0, onClick: () => publish({ ...state, preview: chosen.map(row => row.id) }) }, t('preview')))
      }
      function ConfirmPreview({ ids }) {
        const ref = React.useRef(null)
        const [busy, setBusy] = React.useState(false)
        const [remaining, setRemaining] = React.useState(ids)
        const [failure, setFailure] = React.useState('')
        const alive = React.useRef(true)
        const close = () => publish({ ...state, preview: null })
        React.useEffect(() => {
          alive.current = true
          const previous = document.activeElement
          ref.current?.querySelector('button')?.focus()
          const key = event => {
            if (event.key === 'Escape' && !state.pending.size) { event.preventDefault(); close() }
            if (event.key === 'Tab') {
              const buttons = [...ref.current.querySelectorAll('button:not(:disabled)')]
              if (!buttons.length) { event.preventDefault(); return }
              const next = event.shiftKey ? buttons.at(-1) : buttons[0]
              if (event.shiftKey && document.activeElement === buttons[0] || !event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); next.focus() }
            }
          }
          document.addEventListener('keydown', key)
          return () => { alive.current = false; document.removeEventListener('keydown', key); if (previous?.isConnected) previous.focus() }
        }, [])
        async function commit() {
          if (busy) return
          setBusy(true)
          let failed = false
          for (const id of remaining) {
            if (!alive.current) break
            if (!await reap({ id })) { failed = true; if (alive.current) setFailure(state.notice?.text || t('unknown')); break }
            if (alive.current) setRemaining(current => current.filter(value => value !== id))
          }
          if (alive.current) { setBusy(false); if (!failed) close() }
        }
        return ReactDom.createPortal(h('div', { className: 'sr-backdrop' }, h('div', { className: 'sr-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t('preview'), ref },
          h('style', null, CSS), h('h3', null, t('preview')), h('p', null, t('warning')),
          failure ? h('p', { role: 'alert' }, failure) : null,
          h('ul', null, remaining.map(id => h('li', { key: id }, ctx.sessions.list.getSnapshot().byId[id]?.displayTitle || id))),
          h('button', { type: 'button', disabled: busy, onClick: close }, t('cancel')),
          h('button', { type: 'button', disabled: busy || !remaining.length, onClick: () => { void commit() } }, t(busy ? 'busy' : 'confirm', { count: remaining.length })))), document.body)
      }
      function Notice() {
        const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot)
        if (snapshot.preview) return h(ConfirmPreview, { key: snapshot.preview.join(':'), ids: snapshot.preview })
        if (!snapshot.notice) return null
        return ReactDom.createPortal(h('div', { className: 'sr-notice', role: snapshot.notice.error ? 'alert' : 'status' },
          h('style', null, CSS), snapshot.notice.text,
          h('button', { type: 'button', onClick() { clearTimeout(timer); publish({ ...state, notice: null }) } }, t('close'))), document.body)
      }
      ctx.slots.inject('sidebar.workspaces.session.menu.item', () => ctx.slots.register({ name: 'sidebar.workspaces.session.menu.item', id: 'session-reaper', order: 460, locale: NS }, DeleteMenuItem))
      ctx.slots.inject('plugins.tab', () => ctx.slots.register({ name: 'plugins.tab', id: 'session-reaper', order: 80, locale: NS, label: () => t('tab') }, CleanupPanel))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'session-reaper.notice', locale: NS }, Notice))
      ctx.effect(() => () => { active = false; clearTimeout(timer); listeners.clear() }, 'session-reaper: cleanup')
    }
    return { inject: ['slots', 'locale', 'connection', 'uiSession', 'uiWorkspace', 'sessions'], apply }
  },
})
