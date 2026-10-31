/**
 * Client half of 行囊 · Local Plugin Vault.
 *
 * A read/management view over the profile's `pluginManager` Remote focused on
 * locally authored bundles (`@local/*`, or installed from a filesystem path).
 * It never invents install machinery: enable/disable/remove call the same Host
 * operations the Plugins page calls, and the migration manifest is plain text
 * the person can carry to another device.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-local-vault',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'localVault'

    const zh = {
      buildBlocked: '安装脚本需要在原生插件管理页单独处理',
      changeOverridden: '已安装，但启用状态被更高优先级配置覆盖',
      chooseDirectory: "选择插件文件夹",
      choosingDirectory: "选择文件夹中…",
      directoryTitle: "目录安装",
      directoryHint: "点击文件夹按钮选择 dsh 所在设备的插件目录；扫描当前目录及下两级目录，不进入 node_modules 或目录链接。",
      directoryPath: "本地插件目录（绝对路径）",
      saveScan: "保存目录并扫描",
      rescan: "重新扫描",
      installSelected: "一键安装选中项（{count}）",
      selectReady: "选择全部待安装项",
      scanEmpty: "此目录未找到可安装的 DSH bundle。",
      scanFirst: "点击文件夹按钮选择目录，自动保存并扫描，之后可直接安装选中插件。",
      ready: "待安装",
      installed: "已安装 · 跳过",
      conflict: "同名冲突",
      installing: "安装中",
      installedNow: "安装成功",
      installFailed: "安装失败 · 可重试",
      scanBusy: "扫描中…",
      installProgress: "安装进度 {done} / {total}",
      installDone: "本次完成：成功 {success}，跳过 {skipped}，失败 {failed}。",
      restartHint: "部分插件需要重启 dsh 后生效。",
      dirtyDirectory: "目录已修改，请保存并扫描后再安装。",
      scanWarnings: "扫描提示",
      hostHint: "若提示 HTTP 404/405，请在「已安装」中查看行囊的启动异常详情。",
      installNote: "已安装插件保留当前版本及启停状态；仅安装选中的新插件并启用。关闭此页后不再开始后续安装，已开始的安装会继续。",

      tab: '行囊',
      title: '本地插件行囊',
      subtitle: '保存本地插件目录，扫描并批量安装；集中管理与迁移个人插件。',
      search: '搜索包名、路径或版本',
      refresh: '刷新',
      refreshTitle: '重新读取 profile 中的 bundle',
      emptyLocal: '还没有本地插件。把插件目录安装进 profile 后，这里会以「个人」标签出现。',
      emptyMatch: '没有匹配的插件。',
      loading: '读取中…',
      failed: '读取失败：{message}',
      showAll: '显示全部非官方',
      personal: '个人',
      thirdParty: '第三方',
      disabled: '已停用',
      enabled: '已启用',
      version: '版本',
      spec: '来源',
      rows: '{count} 个插件项',
      enable: '启用',
      disable: '停用',
      remove: '移除',
      confirmRemove: '确认移除',
      cancel: '取消',
      open: '详情',
      copySpec: '复制路径',
      copied: '已复制',
      copyFailed: '复制失败',
      manifest: '迁移清单',
      download: '下载 JSON',
      manifestTitle: 'DSH 本地插件迁移清单',
      manifestHint: '把插件目录复制到新设备，先安装行囊，再设置总目录并批量安装；清单用于核对版本与来源。',
      steps: '恢复步骤',
      step1: '把每个「来源」目录完整复制到新设备（保持可读）。',
      step2: '新设备先安装「行囊」，再通过文件夹按钮选择插件总目录，扫描后一键安装选中项。',
      step3: '重启后确认启用状态；本地 bundle 与官方包互不覆盖。',
      statBundles: '本地包',
      statEnabled: '启用中',
      statRows: '插件项',
      actionFailed: '操作失败：{message}',
      changeApplied: '已应用',
      changeRestart: '需要重启 dsh 后生效',
    }

    const en = {
      buildBlocked: 'Handle build script permissions in the native Plugins page',
      changeOverridden: 'Installed, but a higher-priority configuration overrides activation',
      chooseDirectory: "Choose plugin folder",
      choosingDirectory: "Choosing folder…",
      directoryTitle: "Install from directory",
      directoryHint: "Choose a plugin folder on the DSH host. Scans this directory and two levels below, excluding node_modules and directory links.",
      directoryPath: "Local plugin directory (absolute path)",
      saveScan: "Save directory and scan",
      rescan: "Rescan",
      installSelected: "Install selected ({count})",
      selectReady: "Select all pending plugins",
      scanEmpty: "No installable DSH bundles found here.",
      scanFirst: "Choose a folder to save and scan it, then install selected plugins.",
      ready: "Ready",
      installed: "Installed · skipped",
      conflict: "Duplicate name",
      installing: "Installing",
      installedNow: "Installed successfully",
      installFailed: "Failed · retry available",
      scanBusy: "Scanning…",
      installProgress: "Progress {done} / {total}",
      installDone: "Finished: {success} installed, {skipped} skipped, {failed} failed.",
      restartHint: "Some plugins require restarting DSH.",
      dirtyDirectory: "Directory changed. Save and scan before installing.",
      scanWarnings: "Scan notes",
      hostHint: "For HTTP 404/405, inspect Vault startup errors in Installed plugins.",
      installNote: "Existing versions and enablement stay unchanged. Selected new plugins are installed and enabled. Leaving this tab stops subsequent installs; an install already started continues.",

      tab: 'Vault',
      title: 'Local Plugin Vault',
      subtitle: 'Save a local plugin directory, scan and install in bulk, and manage or migrate personal bundles.',
      search: 'Search name, path, or version',
      refresh: 'Refresh',
      refreshTitle: 'Re-read the profile bundles',
      emptyLocal: 'No local bundles yet. Install a plugin directory into this profile and it appears here as Personal.',
      emptyMatch: 'No matching bundle.',
      loading: 'Reading…',
      failed: 'Read failed: {message}',
      showAll: 'Show all non-official',
      personal: 'Personal',
      thirdParty: 'Third-party',
      disabled: 'Disabled',
      enabled: 'Enabled',
      version: 'Version',
      spec: 'Source',
      rows: '{count} rows',
      enable: 'Enable',
      disable: 'Disable',
      remove: 'Remove',
      confirmRemove: 'Confirm remove',
      cancel: 'Cancel',
      open: 'Details',
      copySpec: 'Copy path',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      manifest: 'Migration manifest',
      download: 'Download JSON',
      manifestTitle: 'DSH local plugin migration manifest',
      manifestHint: 'Copy your plugin directories to the new device, install Vault first, then set the parent directory and install in bulk. Use the manifest to compare versions and sources.',
      steps: 'Restore steps',
      step1: 'Copy every Source directory to the new device, keeping it readable.',
      step2: 'Install Vault on the new device first, then save the parent plugin directory, scan, and install selected bundles.',
      step3: 'After a restart, re-enable what you need. Local bundles never overwrite official packages.',
      statBundles: 'Local bundles',
      statEnabled: 'Enabled',
      statRows: 'Rows',
      actionFailed: 'Action failed: {message}',
      changeApplied: 'Applied',
      changeRestart: 'Restart dsh to apply',
    }

    const PATH_SPEC = /^(?:[a-zA-Z]:[\\/]|\\\\|\/|\.{1,2}[\\/]|file:)/

    function isPersonalBundle(bundle) {
      if (bundle.official) return false
      const spec = bundle.installTarget && bundle.installTarget.spec ? bundle.installTarget.spec : ''
      if (typeof spec === 'string' && PATH_SPEC.test(spec)) return true
      return typeof bundle.name === 'string' && bundle.name.startsWith('@local/')
    }

    function specOf(bundle) {
      const spec = bundle.installTarget && bundle.installTarget.spec ? bundle.installTarget.spec : undefined
      if (typeof spec === 'string' && spec !== '') return spec
      return typeof bundle.source === 'string' && bundle.source !== '' ? bundle.source : bundle.name
    }

    function errorText(error) {
      if (error && typeof error === 'object' && typeof error.message === 'string') return error.message
      return String(error)
    }

    function copyText(text) {
      const clip = navigator.clipboard
      if (clip && typeof clip.writeText === 'function') return clip.writeText(text)
      return new Promise(function (resolve, reject) {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        try {
          const ok = document.execCommand('copy')
          document.body.removeChild(area)
          if (ok) resolve()
          else reject(new Error('execCommand copy refused'))
        } catch (cause) {
          document.body.removeChild(area)
          reject(cause)
        }
      })
    }

    function download(name, text) {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
    }

    const STYLE = [
      '.lv-root{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);}',
      '.lv-head{display:flex;flex-direction:column;gap:4px;}',
      '.lv-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:.3px;',
      'background:linear-gradient(92deg,#b8860b 0%,#e8c766 45%,#a67c00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}',
      '.lv-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.lv-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.lv-search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;padding:0 10px;height:32px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);}',
      '.lv-search input{flex:1;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:13px;}',
      '.lv-search span{font-size:12px;color:#b8860b;}',
      '.lv-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,background .15s,color .15s;}',
      '.lv-btn:hover:not(:disabled){border-color:#b8860b;color:#b8860b;}',
      '.lv-btn:disabled{opacity:.45;cursor:default;}',
      '.lv-btn.primary{border-color:rgba(184,134,11,.55);background:linear-gradient(180deg,rgba(201,162,39,.16),rgba(184,134,11,.06));color:#b8860b;}',
      '.lv-btn.danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
      '.lv-stats{display:flex;gap:22px;padding:12px 16px;border-radius:14px;border:1px solid rgba(184,134,11,.22);',
      'background:linear-gradient(135deg,rgba(201,162,39,.10),rgba(20,18,14,.02) 60%,rgba(184,134,11,.06));}',
      '.lv-stat{display:flex;flex-direction:column;gap:2px;}',
      '.lv-stat b{font-size:18px;line-height:22px;font-weight:600;font-variant-numeric:tabular-nums;color:#b8860b;}',
      '.lv-stat small{font-size:11px;letter-spacing:.4px;color:var(--dsw-alias-label-secondary);}',
      '.lv-list{display:flex;flex-direction:column;gap:2px;}',
      '.lv-card{display:flex;align-items:flex-start;gap:12px;padding:12px 10px;border-radius:12px;transition:background .15s;}',
      '.lv-card:hover{background:var(--dsw-alias-bg-layer-1);}',
      '.lv-icon{width:36px;height:36px;flex:none;border-radius:9px;display:grid;place-items:center;overflow:hidden;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);}',
      '.lv-icon img{width:100%;height:100%;object-fit:cover;}',
      '.lv-glyph{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;font-size:13px;font-weight:600;',
      'color:#e8c766;background:linear-gradient(145deg,#2a2418,#15130d);border:1px solid rgba(201,162,39,.35);}',
      '.lv-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}',
      '.lv-name{font-size:13px;line-height:19px;font-weight:600;overflow-wrap:anywhere;}',
      '.lv-path{margin:0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}',
      '.lv-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary);}',
      '.lv-tag{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;font-size:10px;letter-spacing:.4px;',
      'border:1px solid var(--dsw-alias-border-l1);}',
      '.lv-tag.gold{border-color:rgba(184,134,11,.5);color:#b8860b;background:rgba(201,162,39,.08);}',
      '.lv-tag.off{color:var(--dsw-alias-label-secondary);}',
      '.lv-actions{display:flex;align-items:center;gap:6px;flex:none;flex-wrap:wrap;justify-content:flex-end;}',
      '.lv-empty{padding:28px 16px;border-radius:14px;border:1px dashed var(--dsw-alias-border-l2);',
      'font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary);text-align:center;}',
      '.lv-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);}',
      '.lv-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l1);}',
      '.lv-hint{margin:0;flex:1;min-width:200px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);}',
      '.lv-toast{font-size:11px;color:#b8860b;}',
      '@media (max-width:720px){.lv-actions{width:100%;justify-content:flex-start;}.lv-card{flex-wrap:wrap;}}',
    ].join('')

    const INSTALL_STYLE = `
.lv-install{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.lv-install h3{margin:0;font-size:14px}.lv-directory{display:flex;flex-wrap:wrap;gap:8px}
.lv-directory-path{flex:1;min-width:180px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12px;overflow-wrap:anywhere}
.lv-directory .lv-btn{height:auto;min-height:32px}.lv-directory svg{flex:none}
.lv-install-list{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:8px}
.lv-install-row{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.6}
.lv-install-row input{margin-top:5px}.lv-install-row label{display:flex;gap:8px;flex:1;min-width:0;cursor:pointer}
.lv-install-row .lv-body{gap:1px}.lv-install-row small{font-size:11px;color:var(--dsw-alias-label-secondary)}
.lv-install button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
`

    function DirectoryInstaller(props) {
      const t = props.t
      const [directory, setDirectory] = useState('')
      const [plan, setPlan] = useState(null)
      const [selected, setSelected] = useState(new Set())
      const [phase, setPhase] = useState('scan')
      const [error, setError] = useState('')
      const [summary, setSummary] = useState(null)
      const [progress, setProgress] = useState(null)
      const alive = useRef(true)
      const lock = useRef(false)
      const face = useRef(props)
      face.current = props
      const busy = phase !== 'idle'
      const blocked = busy || props.externalBusy
      const dirty = !plan || directory.trim() !== plan.directory
      const adopt = function (result) {
        setPlan(result); setDirectory(result.directory)
        setSelected(new Set(result.candidates.filter(function (item) { return item.status === 'ready' }).map(function (item) { return item.path })))
      }
      async function scan(save, pick = false) {
        if (lock.current) return
        lock.current = true; setPhase(pick ? 'pick' : 'scan'); setError('')
        face.current.onBusyChange(true)
        try {
          const chosen = pick ? await face.current.pickDirectory() : directory
          if (!alive.current || (pick && chosen === null)) return
          setPhase('scan'); setSummary(null)
          const result = await face.current.vaultCall(save ? 'save' : 'scan', save ? { directory: chosen } : {})
          if (alive.current) adopt(result)
        } catch (cause) { if (alive.current) { setError(errorText(cause)); if (!pick) setPlan(null) } }
        finally { lock.current = false; if (alive.current) { setPhase('idle'); face.current.onBusyChange(false) } }
      }
      useEffect(function () {
        alive.current = true
        void scan(false)
        return function () { alive.current = false; face.current.onBusyChange(false) }
      }, [])
      async function install() {
        if (lock.current || dirty || selected.size === 0 || props.externalBusy) return
        lock.current = true; setPhase('install'); setError(''); setSummary(null)
        face.current.onBusyChange(true)
        const queue = plan.candidates.filter(function (item) { return selected.has(item.path) && ['ready', 'installFailed'].includes(item.status) })
        const totals = { success: 0, skipped: 0, failed: 0, restart: false }
        const update = function (path, status, detail) {
          if (!alive.current) return
          setPlan(function (old) { return { ...old, candidates: old.candidates.map(function (item) { return item.path === path ? { ...item, status: status, detail: detail } : item }) } })
        }
        try {
          for (let index = 0; index < queue.length && alive.current; index++) {
            const item = queue[index]
            setProgress({ done: index, total: queue.length })
            update(item.path, 'installing', '')
            try {
              const result = await face.current.vaultCall('install', { path: item.path })
              if (!result || ['failed', 'cancelled'].includes(result.application)) {
                const detail = result?.error?.diagnostic || result?.error?.message || result?.error?.code || result?.application || 'Install failed'
                throw new Error(detail + (result?.pendingBuilds?.length ? ' · ' + t('buildBlocked') + ': ' + result.pendingBuilds.join(', ') : ''))
              }
              if (result.skipped) totals.skipped++; else totals.success++
              if (result.application === 'restart-required') totals.restart = true
              update(item.path, result.skipped ? 'installed' : 'installedNow', result.application === 'restart-required' ? t('changeRestart') : result.application === 'overridden' ? t('changeOverridden') : '')
              if (alive.current) setSelected(function (old) { const next = new Set(old); next.delete(item.path); return next })
            } catch (cause) { totals.failed++; update(item.path, 'installFailed', errorText(cause).slice(0, 1800)) }
            if (alive.current) setProgress({ done: index + 1, total: queue.length })
          }
          if (alive.current) { setSummary(totals); void face.current.onInstalled() }
        } finally {
          lock.current = false
          if (alive.current) { setPhase('idle'); face.current.onBusyChange(false) }
        }
      }
      const selectable = plan ? plan.candidates.filter(function (item) { return ['ready', 'installFailed'].includes(item.status) }) : []
      return h('section', { className: 'lv-install', 'aria-label': t('directoryTitle'), 'aria-busy': busy },
        h('style', null, INSTALL_STYLE), h('h3', null, t('directoryTitle')),
        h('p', { className: 'lv-hint' }, t('directoryHint')),
        h('div', { className: 'lv-directory' },
          h('output', { className: 'lv-directory-path', 'aria-label': t('directoryPath') }, directory || t('scanFirst')),
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked,
            title: t('chooseDirectory'), 'aria-label': t('chooseDirectory'), onClick: function () { void scan(true, true) } },
            h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
              h('path', { d: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h6l2 3h11l-3 10H4L2 9a2 2 0 0 1 1-2Z', strokeLinejoin: 'round' })),
            t('chooseDirectory')),
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked, onClick: function () { void scan(false) } }, t('rescan'))),
        error ? h('div', { role: 'alert', className: 'lv-error' }, error, ' ', t('hostHint')) : null,
        dirty && plan?.directory ? h('p', { className: 'lv-hint' }, t('dirtyDirectory')) : null,
        plan && plan.candidates.length ? h('div', { className: 'lv-install-list' }, plan.candidates.map(function (item) {
          const canSelect = ['ready', 'installFailed'].includes(item.status)
          return h('div', { className: 'lv-install-row', key: item.path },
            h('label', null, h('input', { type: 'checkbox', checked: selected.has(item.path), disabled: blocked || !canSelect,
              onChange: function (event) { const checked = event.target.checked; setSelected(function (old) { const next = new Set(old); if (checked) next.add(item.path); else next.delete(item.path); return next }) } }),
            h('span', { className: 'lv-body' }, h('span', { className: 'lv-name' }, item.name + (item.version ? ' · ' + item.version : '')),
              h('small', { className: 'lv-path' }, item.path), h('small', null, t(item.status)),
              item.detail ? h('span', { className: item.status === 'installFailed' ? 'lv-error' : 'lv-hint' }, item.detail) : null)))
        })) : !busy ? h('p', { className: 'lv-hint' }, t(plan?.directory ? 'scanEmpty' : 'scanFirst')) : null,
        plan?.warnings.length ? h('details', null, h('summary', null, t('scanWarnings') + ' · ' + plan.warnings.length),
          plan.warnings.map(function (item, i) { return h('p', { key: i, className: 'lv-hint' }, item.path + ': ' + item.message) })) : null,
        h('div', { className: 'lv-toolbar' },
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked || dirty || !selectable.length,
            onClick: function () { setSelected(new Set(selectable.map(function (item) { return item.path }))) } }, t('selectReady')),
          h('button', { className: 'lv-btn primary', type: 'button', disabled: blocked || dirty || selected.size === 0,
            onClick: function () { void install() } }, t('installSelected', { count: selected.size }))),
        h('div', { role: 'status', 'aria-live': 'polite', className: 'lv-hint' },
          phase === 'pick' ? t('choosingDirectory') : phase === 'scan' ? t('scanBusy') : phase === 'install' && progress ? t('installProgress', progress) :
            summary ? t('installDone', summary) + (summary.restart ? ' ' + t('restartHint') : '') : ''),
        h('p', { className: 'lv-hint' }, t('installNote')))
    }

    function StyleTag() {
      return h('style', { key: 'lv-style', 'data-dsh-plugin': 'local-vault' }, STYLE)
    }

    function Stat(props) {
      return h('div', { className: 'lv-stat' }, h('b', null, props.value), h('small', null, props.label))
    }

    function BundleCard(props) {
      const bundle = props.bundle
      const personal = props.personal
      const busy = props.busy
      const title = bundle.meta && bundle.meta.title ? props.resolveText(bundle.meta.title) : bundle.name
      const description = bundle.meta && bundle.meta.description ? props.resolveText(bundle.meta.description) : bundle.description
      const icon = bundle.meta && typeof bundle.meta.icon === 'string' ? bundle.meta.icon : undefined
      const rows = Array.isArray(bundle.rows) ? bundle.rows.length : 0
      const confirm = props.confirm
      return h('div', { className: 'lv-card' },
        h('div', { className: 'lv-icon' },
          icon
            ? h('img', { src: icon, alt: '', loading: 'lazy' })
            : h('div', { className: 'lv-glyph' }, (bundle.name || '?').replace('@local/', '').slice(0, 1).toUpperCase())),
        h('div', { className: 'lv-body' },
          h('div', { className: 'lv-name' }, title),
          description ? h('p', { className: 'lv-path' }, description) : null,
          h('p', { className: 'lv-path' }, specOf(bundle)),
          h('div', { className: 'lv-meta' },
            h('span', { className: personal ? 'lv-tag gold' : 'lv-tag' }, personal ? props.t('personal') : props.t('thirdParty')),
            h('span', { className: bundle.enabled ? 'lv-tag gold' : 'lv-tag off' }, bundle.enabled ? props.t('enabled') : props.t('disabled')),
            bundle.version ? h('span', null, 'v' + bundle.version) : null,
            h('span', null, props.t('rows', { count: rows })))),
        h('div', { className: 'lv-actions' },
          h('button', {
            type: 'button', className: 'lv-btn', disabled: busy,
            onClick: function () { props.onToggle(bundle) },
          }, bundle.enabled ? props.t('disable') : props.t('enable')),
          h('button', {
            type: 'button', className: 'lv-btn', disabled: busy,
            onClick: function () { props.onCopy(bundle) },
          }, props.t('copySpec')),
          h('button', {
            type: 'button', className: 'lv-btn', disabled: busy,
            onClick: function () { props.onOpen(bundle) },
          }, props.t('open')),
          h('button', {
            type: 'button', className: confirm ? 'lv-btn danger' : 'lv-btn danger', disabled: busy,
            onClick: function () { props.onRemove(bundle) },
          }, confirm ? props.t('confirmRemove') : props.t('remove'))))
    }

    function LocalVaultTab(props) {
      const t = props.t
      const [state, setState] = useState({ status: 'loading', bundles: [], error: null })
      const [query, setQuery] = useState('')
      const [showAll, setShowAll] = useState(false)
      const [busy, setBusy] = useState(null)
      const [bulkBusy, setBulkBusy] = useState(false)
      const [notice, setNotice] = useState(null)
      const [confirmName, setConfirmName] = useState(null)
      const [copied, setCopied] = useState(null)
      const confirmTimer = useRef(null)
      // The inject face is a fresh object every render; keep the loader stable so
      // the mount effect cannot restart the read on every render.
      const faceRef = useRef(props)
      faceRef.current = props

      const load = useCallback(function () {
        setState(function (current) { return { status: 'loading', bundles: current.bundles, error: null } })
        return faceRef.current.listBundles().then(function (bundles) {
          setState({ status: 'idle', bundles: Array.isArray(bundles) ? bundles : [], error: null })
        }, function (error) {
          setState({ status: 'error', bundles: [], error: errorText(error) })
        })
      }, [])

      useEffect(function () { void load() }, [load])
      useEffect(function () {
        return function () {
          if (confirmTimer.current !== null) clearTimeout(confirmTimer.current)
        }
      }, [])

      const personal = useMemo(function () {
        return state.bundles.filter(isPersonalBundle)
      }, [state.bundles])
      const pool = showAll ? state.bundles.filter(function (b) { return !b.official }) : personal
      const visible = useMemo(function () {
        const needle = query.trim().toLowerCase()
        if (needle === '') return pool
        return pool.filter(function (bundle) {
          const hay = [bundle.name, specOf(bundle), bundle.version, bundle.description].filter(Boolean).join(' ').toLowerCase()
          return hay.indexOf(needle) >= 0
        })
      }, [pool, query])

      const enabledCount = personal.filter(function (b) { return b.enabled }).length
      const rowCount = personal.reduce(function (sum, b) { return sum + (Array.isArray(b.rows) ? b.rows.length : 0) }, 0)

      const manifest = useMemo(function () {
        const lines = []
        lines.push('# ' + t('manifestTitle'))
        lines.push('')
        lines.push(t('manifestHint'))
        lines.push('')
        personal.forEach(function (bundle) {
          lines.push('- ' + bundle.name + (bundle.version ? '@' + bundle.version : '') + ' — ' + (bundle.enabled ? t('enabled') : t('disabled')))
          lines.push('  - ' + t('spec') + ': ' + specOf(bundle))
          if (Array.isArray(bundle.rows) && bundle.rows.length > 0) {
            lines.push('  - rows: ' + bundle.rows.map(function (row) { return row.rowId }).join(', '))
          }
        })
        lines.push('')
        lines.push('## ' + t('steps'))
        lines.push('1. ' + t('step1'))
        lines.push('2. ' + t('step2'))
        lines.push('3. ' + t('step3'))
        return lines.join('\n')
      }, [personal, t])

      const flash = function (message) {
        setNotice(message)
        setTimeout(function () { setNotice(function (current) { return current === message ? null : current }) }, 2400)
      }

      const toggle = function (bundle) {
        setBusy(bundle.name)
        setNotice(null)
        props.setBundleEnabled(bundle.name, !bundle.enabled).then(function (result) {
          setBusy(null)
          if (result && result.application === 'failed') {
            flash(t('actionFailed', { message: result.error && result.error.code ? result.error.code : 'failed' }))
            return
          }
          flash(result && result.application === 'restart-required' ? t('changeRestart') : t('changeApplied'))
          void load()
        }, function (error) {
          setBusy(null)
          flash(t('actionFailed', { message: errorText(error) }))
        })
      }

      const copy = function (bundle) {
        copyText(specOf(bundle)).then(function () {
          setCopied(bundle.name)
          setTimeout(function () { setCopied(function (current) { return current === bundle.name ? null : current }) }, 1600)
        }, function () { flash(t('copyFailed')) })
      }

      const remove = function (bundle) {
        if (confirmName !== bundle.name) {
          setConfirmName(bundle.name)
          if (confirmTimer.current !== null) clearTimeout(confirmTimer.current)
          confirmTimer.current = setTimeout(function () { setConfirmName(null) }, 4000)
          return
        }
        if (confirmTimer.current !== null) clearTimeout(confirmTimer.current)
        setConfirmName(null)
        setBusy(bundle.name)
        props.removeBundle(bundle.name).then(function (result) {
          setBusy(null)
          if (result && result.application === 'failed') {
            flash(t('actionFailed', { message: result.error && result.error.code ? result.error.code : 'failed' }))
            return
          }
          flash(t('changeApplied'))
          void load()
        }, function (error) {
          setBusy(null)
          flash(t('actionFailed', { message: errorText(error) }))
        })
      }

      return h('div', { className: 'lv-root' },
        h(StyleTag),
        h('div', { className: 'lv-head' },
          h('h2', { className: 'lv-title' }, t('title')),
          h('p', { className: 'lv-sub' }, t('subtitle'))),
        h(DirectoryInstaller, { t: t, vaultCall: props.vaultCall, pickDirectory: props.pickDirectory, externalBusy: busy !== null, onBusyChange: setBulkBusy, onInstalled: load }),
        h('div', { className: 'lv-stats' },
          h(Stat, { value: personal.length, label: t('statBundles') }),
          h(Stat, { value: enabledCount, label: t('statEnabled') }),
          h(Stat, { value: rowCount, label: t('statRows') })),
        h('div', { className: 'lv-toolbar' },
          h('label', { className: 'lv-search' },
            h('span', { 'aria-hidden': true }, '⌕'),
            h('input', {
              type: 'search', value: query, placeholder: t('search'),
              'aria-label': t('search'),
              onChange: function (event) { setQuery(event.target.value) },
            })),
          h('button', {
            type: 'button', className: 'lv-btn', title: t('refreshTitle'),
            disabled: state.status === 'loading',
            onClick: function () { void load() },
          }, t('refresh')),
          h('button', {
            type: 'button', className: showAll ? 'lv-btn primary' : 'lv-btn',
            'aria-pressed': showAll,
            onClick: function () { setShowAll(function (value) { return !value }) },
          }, t('showAll'))),
        state.status === 'error'
          ? h('p', { className: 'lv-error' }, t('failed', { message: state.error || '' }))
          : null,
        state.status === 'loading' && state.bundles.length === 0
          ? h('div', { className: 'lv-empty' }, t('loading'))
          : visible.length === 0
            ? h('div', { className: 'lv-empty' }, pool.length === 0 ? t('emptyLocal') : t('emptyMatch'))
            : h('div', { className: 'lv-list' }, visible.map(function (bundle) {
              return h(BundleCard, {
                key: bundle.name,
                bundle: bundle,
                personal: isPersonalBundle(bundle),
                busy: busy !== null || bulkBusy,
                confirm: confirmName === bundle.name,
                copied: copied === bundle.name,
                t: t,
                resolveText: props.resolveText,
                onToggle: toggle,
                onCopy: copy,
                onRemove: remove,
                onOpen: function (target) { props.openPackage(target.name) },
              })
            })),
        h('div', { className: 'lv-foot' },
          h('p', { className: 'lv-hint' }, t('manifestHint')),
          notice ? h('span', { className: 'lv-toast', role: 'status' }, notice) : null,
          copied ? h('span', { className: 'lv-toast', role: 'status' }, t('copied')) : null,
          h('button', {
            type: 'button', className: 'lv-btn primary',
            onClick: function () {
              copyText(manifest).then(function () { flash(t('copied')) }, function () { flash(t('copyFailed')) })
            },
          }, t('manifest')),
          h('button', {
            type: 'button', className: 'lv-btn',
            onClick: function () {
              const payload = {
                kind: 'dsh-local-plugin-manifest',
                version: 1,
                generatedAt: new Date().toISOString(),
                bundles: personal.map(function (bundle) {
                  return {
                    name: bundle.name,
                    version: bundle.version,
                    enabled: bundle.enabled,
                    spec: specOf(bundle),
                    rows: Array.isArray(bundle.rows) ? bundle.rows.map(function (row) { return row.rowId }) : [],
                  }
                }),
                restore: [t('step1'), t('step2'), t('step3')],
              }
              download('dsh-local-bundles.json', JSON.stringify(payload, null, 2))
            },
          }, t('download'))))
    }

    function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'local-vault: dictionaries')
      const t = ctx.locale.bind(NS)
      // Every pluginManager Remote answers a RemoteResult envelope; the page
      // treats a refused call as an error instead of an empty inventory.
      const unwrap = function (answer) {
        if (answer && answer.ok === true) return answer.value
        const failure = answer && answer.error ? answer.error : undefined
        throw new Error(failure ? (failure.message || failure.code) : 'plugin-manager call failed')
      }
      const face = {
        pickDirectory: function () {
          const desktop = globalThis.__DSH_DIRECTORY_PICKER__
          return desktop ? desktop.pick() : ctx.uiWorkspace.pickDirectory()
        },
        vaultCall: function (endpoint, payload) { return ctx.connection.rpc.call('/api', 'local-vault/' + endpoint, payload || {}).then(unwrap) },
        listBundles: function () { return Promise.resolve(ctx.remote.pluginManager.listBundles()).then(unwrap) },
        setBundleEnabled: function (name, enabled) {
          return Promise.resolve(ctx.remote.pluginManager.setBundleEnabled(name, enabled)).then(unwrap)
        },
        removeBundle: function (name) { return Promise.resolve(ctx.remote.pluginManager.removeBundle(name)).then(unwrap) },
        resolveText: function (value) { return ctx.locale.resolveText(value) },
      }
      ctx.slots.inject('plugins.tab', function () {
        return ctx.slots.register({
          name: 'plugins.tab',
          id: 'local-vault',
          order: 30,
          label: function () { return t('tab') },
          locale: NS,
          inject: function () { return face },
        }, LocalVaultTab)
      })
    }

    return { inject: ['slots', 'locale', 'remote', 'remote.pluginManager', 'connection', 'uiWorkspace'], apply: apply }
  },
})
