/**
 * Client half of 行囊宝匣.
 *
 * A read/management view over the profile's `pluginManager` Remote focused on
 * locally authored bundles (`@local/*`, or installed from a filesystem path).
 * It never invents install machinery: enable/disable/remove call the same Host
 * operations the Plugins page calls.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-local-vault',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'localVault'

    const zh = {
      hostPatches: '宿主补丁', patchRefresh: '检查补丁状态', patchExplanation: '插件本体与宿主补丁分别管理。撤销保留插件包及个人设置，由受管启动器完成停机、备份、撤销、重建和重启。',
      unsupportedHost: '清单外版本，请先适配验证', patchState: '源码补丁状态', removePatch: '撤销补丁并重启', confirmPatchRemove: '确认停机并撤销',
      patchConfirmation: '所有任务必须已停止。此操作会中断页面连接；重建失败时尝试恢复补丁并重新构建，仍失败则保留停机。认证补丁撤销后需要重新登录。',
      patchWaiting: '维护中，正在等待宿主重新上线。认证变更可能需要从启动终端的新链接重新登录；失败详情及进度见受管启动终端。',
      patchApplied: '已应用', patchPending: '未应用', patchConflict: '冲突，需人工适配', patchUnmanaged: '未由受管启动器检查',
      patchPhaseRunning: '运行中', patchPhaseStopping: '正在停机', patchPhaseBackup: '正在备份', patchPhaseRemoving: '正在撤销', patchPhaseBuilding: '正在重建', patchPhaseRollback: '正在恢复补丁', patchPhaseRemoved: '撤销完成，已重新启动', patchPhaseRestored: '撤销失败，已恢复补丁并重新启动', patchPhaseFailed: '维护失败，请查看启动终端',
      help: '使用说明', selectVisible: '选择可卸载项', clearSelection: '清空选择', uninstall: '卸载选中（{count}）', confirmBatch: '确认卸载（{count}）', removing: '正在卸载', removed: '已卸载', removeFailed: '卸载失败', batchDone: '已完成', results: '处理结果',
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
      repair: '待迁移 · 保留启停状态',
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
      pickerFallback: '此界面不支持文件夹选择，请在左侧输入 DSH 所在设备的绝对路径，然后点击「保存目录并扫描」。',
      hostHint: "若提示 HTTP 404/405，请在「已安装」中查看行囊宝匣的启动异常详情。",
      installNote: "有效的已安装插件会跳过；旧来源失效且新目录包名一致时，选中安装会自动移除旧记录并迁移，保留启停状态。迁移失败可重新扫描重试。关闭此页后不再开始后续安装，已开始的安装会继续。",

      tab: '行囊宝匣',
      title: '行囊宝匣',
      subtitle: '扫描安装 · 批量管理 · 目录迁移',
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
      sourceVersion: '源码 {version}', managerVersion: '管理器登记 {version}', runtimeUnknown: '运行版本未由宿主提供；源码更新后客户端需刷新，Host 逻辑需重启', versionChanged: '版本不同，请检查更新与生效状态', appliedRefresh: '管理器已应用；刷新本页加载最新客户端',
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
      statBundles: '本地包',
      statEnabled: '启用中',
      statRows: '插件项',
      actionFailed: '操作失败：{message}',
      changeApplied: '已应用',
      changeRestart: '需要重启 dsh 后生效',
    }

    const en = {
      hostPatches: 'Host patches', patchRefresh: 'Check patch status', patchExplanation: 'Plugins and Host patches are separate. Removal keeps plugin packages and personal settings; the managed launcher stops, backs up, removes, rebuilds and restarts the Host.',
      unsupportedHost: 'Unlisted revision; adaptation required', patchState: 'Source patch state', removePatch: 'Remove patch and restart', confirmPatchRemove: 'Confirm shutdown and removal',
      patchConfirmation: 'Stop all tasks first. The page will disconnect. A failed rebuild attempts to restore the patch and rebuild; if that fails, the Host stays stopped. Removing authentication requires a new login.',
      patchWaiting: 'Waiting for the Host to restart. Authentication changes may require the new login link from the launcher terminal. Check that terminal for progress and failures.',
      patchApplied: 'Applied', patchPending: 'Not applied', patchConflict: 'Conflict; adaptation required', patchUnmanaged: 'Not inspected by managed launcher',
      patchPhaseRunning: 'Running', patchPhaseStopping: 'Stopping', patchPhaseBackup: 'Backing up', patchPhaseRemoving: 'Removing', patchPhaseBuilding: 'Rebuilding', patchPhaseRollback: 'Restoring patch', patchPhaseRemoved: 'Removed and restarted', patchPhaseRestored: 'Removal failed; patch restored and restarted', patchPhaseFailed: 'Maintenance failed; check launcher terminal',
      help: 'Instructions', selectVisible: 'Select removable', clearSelection: 'Clear selection', uninstall: 'Uninstall selected ({count})', confirmBatch: 'Confirm uninstall ({count})', removing: 'Uninstalling', removed: 'Uninstalled', removeFailed: 'Uninstall failed', batchDone: 'Finished', results: 'Results',
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
      repair: "Relocate · preserve enablement",
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
      pickerFallback: "Folder picker unavailable. Enter an absolute path on the DSH host and save to scan.",
      hostHint: "For HTTP 404/405, inspect Vault startup errors in Installed plugins.",
      installNote: "Valid installations are skipped. Selected bundles with missing local sources are removed and reinstalled from the new directory with enablement preserved. Rescan to retry failures. Leaving this tab stops subsequent installs; an install already started continues.",

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
      sourceVersion: 'Source {version}', managerVersion: 'Manager reports {version}', runtimeUnknown: 'Host does not report the running version. Refresh client changes; restart for Host changes.', versionChanged: 'Version differs; check update activation', appliedRefresh: 'Manager applied the change; reload to load the latest client',
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
      'font:inherit;font-size:12px;cursor:pointer;box-shadow:0 2px 5px rgba(30,24,8,.05),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease,color .16s ease;}',
      '.lv-btn:hover:not(:disabled){border-color:#b8860b;color:#b8860b;}',
      '.lv-btn:disabled{opacity:.45;cursor:default;box-shadow:none;}',
      '.lv-root .lv-btn:not(:disabled):active{transform:translateY(1px) scale(.98);box-shadow:inset 0 2px 4px rgba(30,24,8,.10)}',
      '.lv-root .lv-btn:focus-visible,.lv-root input:focus-visible,.lv-root summary:focus-visible{outline:2px solid #b8860b;outline-offset:3px}',
      '.lv-root .lv-btn[aria-pressed="true"]{border-color:rgba(184,134,11,.55);background:rgba(184,134,11,.10);box-shadow:inset 0 1px 3px rgba(100,72,8,.10)}',
      '.lv-root input[type="checkbox"]{width:15px;height:15px;flex:none;accent-color:#b8860b;cursor:pointer;transition:transform .15s ease,filter .15s ease;filter:drop-shadow(0 1px 2px rgba(30,24,8,.10))}',
      '.lv-root input[type="checkbox"]:not(:disabled):active{transform:scale(.9)}.lv-root input[type="checkbox"]:disabled{cursor:default;filter:none}',
      '.lv-search:focus-within,.lv-directory-path:focus{border-color:rgba(184,134,11,.65);box-shadow:0 0 0 3px rgba(184,134,11,.08)}',
      '.lv-search,.lv-directory-path{transition:border-color .16s ease,box-shadow .16s ease}.lv-root .lv-install{box-shadow:0 4px 16px rgba(30,24,8,.035)}',
      '.lv-root .lv-toolbar{gap:8px 10px}.lv-root .lv-foot{padding-top:12px;gap:10px}.lv-root .lv-stats{flex-wrap:wrap}',
      '.lv-root .lv-list{gap:6px}.lv-root .lv-card{border:1px solid transparent;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}',
      '.lv-root .lv-card:has(>input:checked){border-color:rgba(184,134,11,.25);background:rgba(184,134,11,.045)}',
      '.lv-root .lv-progress-head{flex-wrap:wrap}.lv-root .lv-progress-head span{font-variant-numeric:tabular-nums}',
      '@media(hover:hover){.lv-root .lv-btn:not(:disabled):hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(100,72,8,.12)}.lv-root .lv-card:hover{border-color:rgba(184,134,11,.13);box-shadow:0 3px 12px rgba(30,24,8,.04)}}',
      '@media(max-width:560px){.lv-root .lv-directory-path{flex-basis:100%;min-width:0}.lv-root .lv-directory .lv-btn{flex:1;justify-content:center}.lv-root .lv-actions{gap:8px}}',
      '@media(prefers-reduced-motion:reduce){.lv-root .lv-btn,.lv-root input,.lv-root .lv-card,.lv-root .lv-search{transition:none!important;transform:none!important}}',
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
      '.lv-help{font-size:11px;color:var(--dsw-alias-label-secondary)}.lv-root details>summary{cursor:pointer}',
      '.lv-progress{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;background:rgba(184,134,11,.07);font-size:12px}',
      '.lv-progress-head{display:flex;justify-content:space-between;gap:12px}.lv-progress progress{width:100%;height:10px;accent-color:#b8860b}',
      '.lv-current{display:flex;align-items:center;gap:8px;overflow-wrap:anywhere}.lv-spinner{width:10px;height:10px;border:2px solid rgba(184,134,11,.2);border-top-color:#b8860b;border-radius:50%;animation:lv-spin .9s linear infinite;flex:none}',
      '@keyframes lv-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.lv-spinner{animation:none}}',
      '[data-state="installedNow"]{color:#23834d}[data-state="installFailed"]{color:var(--dsw-alias-state-error-primary)}[data-state="installing"]{color:#b8860b}',
      '.lv-stats{padding:8px 12px;gap:18px}.lv-stat{flex-direction:row;align-items:center;gap:6px}.lv-stat b{font-size:15px}.lv-install-list details{font-size:11px}',
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

    function PatchManager(props) {
      const [state, setState] = useState(null)
      const [error, setError] = useState('')
      const [confirm, setConfirm] = useState(null)
      const [busy, setBusy] = useState(false)
      const [waiting, setWaiting] = useState(false)
      const alive = useRef(true)
      const load = async function () {
        try {
          const next = await props.vaultCall('patch-status', {})
          if (alive.current) { setState(next); setError(''); return next }
        } catch (failure) { if (alive.current) setError(failure.message) }
      }
      useEffect(function () {
        alive.current = true; void load()
        return function () { alive.current = false }
      }, [])
      useEffect(function () {
        if (!waiting) return
        const started = Date.now()
        let checking = false
        const timer = setInterval(async function () {
          if (checking) return
          if (Date.now() - started > 10 * 60 * 1000) { clearInterval(timer); setWaiting(false); return }
          checking = true
          try {
            const next = await load()
            if (next?.job && ['restarted-without-patch', 'restarted-with-patch', 'failed'].includes(next.job.phase)) setWaiting(false)
          } finally { checking = false }
        }, 2500)
        return function () { clearInterval(timer) }
      }, [waiting])
      async function remove(file) {
        if (busy || waiting || props.externalBusy) return
        setBusy(true); setError('')
        try {
          const result = await props.vaultCall('patch-remove', { patch: file, confirm: true })
          if (alive.current) { setState(old => ({ ...old, job: { phase: 'stopping', message: result.message } })); setWaiting(true); setConfirm(null) }
        } catch (failure) { if (alive.current) setError(failure.message) }
        finally { if (alive.current) setBusy(false) }
      }
      const disabled = busy || waiting || props.externalBusy
      const phases = { running: 'patchPhaseRunning', stopping: 'patchPhaseStopping', 'backing-up': 'patchPhaseBackup', removing: 'patchPhaseRemoving', building: 'patchPhaseBuilding', 'migrating-auth': 'patchPhaseBackup', 'rolling-back': 'patchPhaseRollback', 'restarted-without-patch': 'patchPhaseRemoved', 'restarted-with-patch': 'patchPhaseRestored', failed: 'patchPhaseFailed' }
      const states = { applied: 'patchApplied', pending: 'patchPending', conflict: 'patchConflict', unmanaged: 'patchUnmanaged' }
      return h('section', { className: 'lv-install', 'aria-label': props.t('hostPatches') },
        h('style', null, '.lv-patch-card{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid rgba(158,132,70,.24);border-radius:10px;overflow-wrap:anywhere}.lv-patch-card p{margin:0}.lv-patch-card button{align-self:flex-start}.lv-patch-card+.lv-patch-card{margin-top:12px}'),
        h('h3', null, props.t('hostPatches')),
        h('p', { className: 'lv-hint' }, props.t('patchExplanation')),
        h('button', { className: 'lv-btn', type: 'button', disabled: disabled, onClick: function () { void load() } }, props.t('patchRefresh')),
        state?.message ? h('p', { className: 'lv-hint' }, state.message) : null,
        state?.revision ? h('p', { className: 'lv-hint' }, 'DSH ' + state.revision + (state.supported ? '' : ' · ' + props.t('unsupportedHost'))) : null,
        (state?.patches || []).map(function (patch) {
          return h('div', { key: patch.file, className: 'lv-patch-card' },
            h('strong', null, patch.title), h('p', null, patch.plugin),
            h('p', null, props.t('patchState') + ': ' + props.t(states[patch.state] || patch.state)),
            h('p', { className: 'lv-hint' }, patch.fallback),
            confirm === patch.file ? h('div', null,
              h('p', { role: 'alert' }, props.t('patchConfirmation')),
              h('button', { type: 'button', className: 'lv-btn', disabled: disabled, onClick: function () { void remove(patch.file) } }, props.t('confirmPatchRemove')),
              h('button', { type: 'button', className: 'lv-btn', disabled: disabled, onClick: function () { setConfirm(null) } }, props.t('cancel')))
              : h('button', { type: 'button', className: 'lv-btn', disabled: disabled || !patch.removable, onClick: function () { setConfirm(patch.file) } }, props.t('removePatch')))
        }),
        state?.job ? h('p', { role: 'status' }, props.t(phases[state.job.phase] || state.job.phase) + ' · ' + (state.job.message || '')) : null,
        waiting ? h('p', { role: 'status' }, props.t('patchWaiting')) : null,
        error ? h('p', { className: 'lv-error', role: 'alert' }, error) : null)
    }

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
        setSelected(new Set(result.candidates.filter(function (item) { return ['ready', 'repair'].includes(item.status) }).map(function (item) { return item.path })))
      }
      async function scan(save, pick = false) {
        if (lock.current) return
        lock.current = true; setPhase(pick ? 'pick' : 'scan'); setError('')
        face.current.onBusyChange(true)
        try {
          const chosen = pick ? await face.current.pickDirectory() : directory
          if (!alive.current || (pick && chosen === null)) return
          setPhase('scan'); setSummary(null); setProgress(null)
          const result = await face.current.vaultCall(save ? 'save' : 'scan', save ? { directory: chosen } : {})
          if (alive.current) adopt(result)
        } catch (cause) { if (alive.current) { setError(pick ? t('pickerFallback') : errorText(cause)); if (!pick) setPlan(null) } }
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
        const queue = plan.candidates.filter(function (item) { return selected.has(item.path) && ['ready', 'repair', 'installFailed'].includes(item.status) })
        const totals = { success: 0, skipped: 0, failed: 0, restart: false }
        const update = function (path, status, detail) {
          if (!alive.current) return
          setPlan(function (old) { return { ...old, candidates: old.candidates.map(function (item) { return item.path === path ? { ...item, status: status, detail: detail } : item }) } })
        }
        try {
          for (let index = 0; index < queue.length && alive.current; index++) {
            const item = queue[index]
            setProgress({ done: index, total: queue.length, current: item.name })
            update(item.path, 'installing', '')
            try {
              const result = await face.current.vaultCall('install', { path: item.path })
              if (!result || ['failed', 'cancelled'].includes(result.application)) {
                const detail = result?.error?.diagnostic || result?.error?.message || result?.error?.code || result?.application || 'Install failed'
                throw new Error(detail + (result?.pendingBuilds?.length ? ' · ' + t('buildBlocked') + ': ' + result.pendingBuilds.join(', ') : ''))
              }
              if (result.skipped) totals.skipped++; else totals.success++
              if (result.application === 'restart-required') totals.restart = true
              update(item.path, result.skipped ? 'installed' : 'installedNow', result.application === 'restart-required' ? t('changeRestart') : result.application === 'overridden' ? t('changeOverridden') : t('appliedRefresh'))
              if (alive.current) setSelected(function (old) { const next = new Set(old); next.delete(item.path); return next })
            } catch (cause) { totals.failed++; update(item.path, 'installFailed', errorText(cause).slice(0, 1800)) }
            if (alive.current) setProgress({ done: index + 1, total: queue.length, current: item.name })
          }
          if (alive.current) { setSummary(totals); void face.current.onInstalled() }
        } finally {
          lock.current = false
          if (alive.current) { setPhase('idle'); face.current.onBusyChange(false) }
        }
      }
      const selectable = plan ? plan.candidates.filter(function (item) { return ['ready', 'repair', 'installFailed'].includes(item.status) }) : []
      return h('section', { className: 'lv-install', 'aria-label': t('directoryTitle'), 'aria-busy': busy },
        h('style', null, INSTALL_STYLE), h('h3', null, t('directoryTitle')),
        h('p', { className: 'lv-hint' }, t('runtimeUnknown')),

        h('div', { className: 'lv-directory' },
          h('input', { className: 'lv-directory-path', 'aria-label': t('directoryPath'), value: directory, placeholder: t('directoryPath'), disabled: blocked, onChange: function (event) { setDirectory(event.target.value) } }),
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked,
            title: t('chooseDirectory'), 'aria-label': t('chooseDirectory'), onClick: function () { void scan(true, true) } },
            h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
              h('path', { d: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h6l2 3h11l-3 10H4L2 9a2 2 0 0 1 1-2Z', strokeLinejoin: 'round' })),
            t('chooseDirectory')),
          h('button', { className: 'lv-btn primary', type: 'button', disabled: blocked || !directory.trim(), onClick: function () { void scan(true) } }, t('saveScan')),
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked, onClick: function () { void scan(false) } }, t('rescan'))),
        error ? h('div', { role: 'alert', className: 'lv-error' }, error, ' ', t('hostHint')) : null,
        dirty && plan?.directory ? h('p', { className: 'lv-hint' }, t('dirtyDirectory')) : null,
        plan && plan.candidates.length ? h('div', { className: 'lv-install-list' }, plan.candidates.map(function (item) {
          const canSelect = ['ready', 'repair', 'installFailed'].includes(item.status)
          return h('div', { className: 'lv-install-row', key: item.path },
            h('label', null, h('input', { type: 'checkbox', checked: selected.has(item.path), disabled: blocked || !canSelect,
              onChange: function (event) { const checked = event.target.checked; setSelected(function (old) { const next = new Set(old); if (checked) next.add(item.path); else next.delete(item.path); return next }) } }),
            h('span', { className: 'lv-body' }, h('span', { className: 'lv-name' }, item.name),
              h('span', { className: 'lv-hint' }, t('sourceVersion', { version: item.version || '—' }) + ' · ' + t('managerVersion', { version: item.installedVersion || '—' })),
              item.versionChanged ? h('span', { className: 'lv-tag gold' }, t('versionChanged')) : null,
              h('small', { className: 'lv-tag', 'data-state': item.status }, t(item.status)), h('details', null, h('summary', null, t('spec')), h('small', { className: 'lv-path' }, item.path)),
              item.detail ? h('span', { className: item.status === 'installFailed' ? 'lv-error' : 'lv-hint' }, item.detail) : null)))
        })) : !busy ? h('p', { className: 'lv-hint' }, t(plan?.directory ? 'scanEmpty' : 'scanFirst')) : null,
        plan?.warnings.length ? h('details', null, h('summary', null, t('scanWarnings') + ' · ' + plan.warnings.length),
          plan.warnings.map(function (item, i) { return h('p', { key: i, className: 'lv-hint' }, item.path + ': ' + item.message) })) : null,
        h('div', { className: 'lv-toolbar' },
          h('button', { className: 'lv-btn', type: 'button', disabled: blocked || dirty || !selectable.length,
            onClick: function () { setSelected(new Set(selectable.map(function (item) { return item.path }))) } }, t('selectReady')),
          h('button', { className: 'lv-btn primary', type: 'button', disabled: blocked || dirty || selected.size === 0,
            onClick: function () { void install() } }, t('installSelected', { count: selected.size }))),
        progress ? h(BatchProgress, { progress, label: summary ? t('batchDone') : t('installing'), active: phase === 'install' }) : null,
        h('div', { role: 'status', 'aria-live': 'polite', className: 'lv-hint' },
          phase === 'pick' ? t('choosingDirectory') : phase === 'scan' ? t('scanBusy') : phase === 'install' && progress ? t('installProgress', progress) :
            summary ? t('installDone', summary) + (summary.restart ? ' ' + t('restartHint') : '') : ''))
    }

    function BatchProgress({ progress, label, active }) {
      const percent = progress.total ? Math.round(progress.done / progress.total * 100) : 0
      return h('div', { className: 'lv-progress', 'aria-live': 'polite' },
        h('div', { className: 'lv-progress-head' }, h('strong', null, label), h('span', null, progress.done + ' / ' + progress.total + ' · ' + percent + '%')),
        h('progress', { max: progress.total || 1, value: progress.done, 'aria-label': label }),
        active && progress.current ? h('small', { className: 'lv-current' }, h('span', { className: 'lv-spinner', 'aria-hidden': true }), progress.current) : null)
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
        props.onSelect ? h('input', { type: 'checkbox', 'aria-label': bundle.name, checked: props.selected, disabled: busy || !props.canRemove, onChange: props.onSelect }) : null,
        h('div', { className: 'lv-icon' },
          icon
            ? h('img', { src: icon, alt: '', loading: 'lazy' })
            : h('div', { className: 'lv-glyph' }, (bundle.name || '?').replace('@local/', '').slice(0, 1).toUpperCase())),
        h('div', { className: 'lv-body' },
          h('div', { className: 'lv-name' }, title),
          h('details', { className: 'lv-help' }, h('summary', null, props.t('open')), description ? h('p', { className: 'lv-path' }, description) : null, h('p', { className: 'lv-path' }, specOf(bundle))),
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
      const [removeSelected, setRemoveSelected] = useState(new Set())
      const [confirmBatch, setConfirmBatch] = useState(false)
      const [removal, setRemoval] = useState(null)
      const operationLock = useRef(false)
      const mounted = useRef(true)
      useEffect(function () { mounted.current = true; return function () { mounted.current = false } }, [])
      const canRemove = bundle => bundle.removable === true && !bundle.official && bundle.name !== '@local/dsh-local-vault'
      async function uninstallSelected() {
        if (operationLock.current || busy !== null || bulkBusy) return
        if (!confirmBatch) { setConfirmBatch(true); return }
        const queue = state.bundles.filter(bundle => removeSelected.has(bundle.name) && canRemove(bundle))
        if (!queue.length) return
        operationLock.current = true; setBusy('batch-remove'); setConfirmBatch(false)
        const results = []
        let restart = false
        try {
          for (const bundle of queue) {
            if (!mounted.current) break
            setRemoval({ done: results.length, total: queue.length, current: bundle.name, results: [...results], active: true })
            try {
              const result = await faceRef.current.removeBundle(bundle.name)
              if (!result || ['failed', 'cancelled'].includes(result.application)) throw new Error(result?.error?.diagnostic || result?.error?.message || result?.error?.code || result?.application || 'Uninstall failed')
              restart ||= result.application === 'restart-required'
              results.push({ name: bundle.name, status: 'removed' })
              if (mounted.current) setRemoveSelected(old => { const next = new Set(old); next.delete(bundle.name); return next })
            } catch (error) { results.push({ name: bundle.name, status: 'removeFailed', detail: errorText(error) }) }
            if (mounted.current) setRemoval({ done: results.length, total: queue.length, results: [...results], active: true, restart })
          }
        } finally {
          operationLock.current = false
          if (mounted.current) { setBusy(null); setRemoval({ done: results.length, total: queue.length, results, active: false, restart }); void load() }
        }
      }
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

      const flash = function (message) {
        setNotice(message)
        setTimeout(function () { setNotice(function (current) { return current === message ? null : current }) }, 2400)
      }

      const toggle = function (bundle) {
        if (operationLock.current || busy !== null || bulkBusy) return
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
        if (operationLock.current || busy !== null || bulkBusy) return
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
        h(PatchManager, { t: t, vaultCall: props.vaultCall, externalBusy: busy !== null || bulkBusy }),
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
        h('div', { className: 'lv-toolbar' },
          h('button', { type: 'button', className: 'lv-btn', disabled: busy !== null || bulkBusy || (!removeSelected.size && !visible.some(canRemove)), onClick: function () {
            setRemoveSelected(removeSelected.size ? new Set() : new Set(visible.filter(canRemove).map(b => b.name)))
            setConfirmBatch(false)
          } }, t(removeSelected.size ? 'clearSelection' : 'selectVisible')),
          h('button', { className: 'lv-btn danger', disabled: busy !== null || bulkBusy || !removeSelected.size, onClick: function () { void uninstallSelected() } }, t(confirmBatch ? 'confirmBatch' : 'uninstall', { count: removeSelected.size })),
          confirmBatch ? h('button', { className: 'lv-btn', onClick: function () { setConfirmBatch(false) } }, t('cancel')) : null),
        removal ? h('section', { className: 'lv-install' },
          h(BatchProgress, { progress: removal, label: t(removal.active ? 'removing' : 'batchDone'), active: removal.active }),
          removal.restart ? h('p', { className: 'lv-hint' }, t('changeRestart')) : null,
          h('details', { open: true }, h('summary', null, t('results')), removal.results.map(item => h('p', { key: item.name, className: item.detail ? 'lv-error' : 'lv-hint' }, t(item.status) + ' · ' + item.name, item.detail ? ' · ' + item.detail : '')))) : null,
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
                selected: removeSelected.has(bundle.name), canRemove: canRemove(bundle),
                onSelect: function (event) { const checked = event.target.checked; setConfirmBatch(false); setRemoveSelected(old => { const next = new Set(old); if (checked) next.add(bundle.name); else next.delete(bundle.name); return next }) },
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
        notice || copied ? h('div', { className: 'lv-foot', role: 'status' },
          notice ? h('span', { className: 'lv-toast' }, notice) : null,
          copied ? h('span', { className: 'lv-toast' }, t('copied')) : null) : null)
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
