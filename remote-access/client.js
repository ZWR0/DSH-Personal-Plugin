/**
 * Client half of Remote Access.
 *
 * Manages the DSH Web launch token and the public base URL. The Host keeps the
 * credential and performs token validation; this page never stores a token in
 * the browser and asks for the full token only on an explicit reveal or copy.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-remote-access',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const NS = 'remoteAccess'

    const zh = {
      tab: '远行之钥',
      title: '远行之钥',
      subtitle: '管理 DSH Web 的启动 Token 与固定访问地址，避免重启后已收藏的登录链接失效。',
      guideTitle: '三步连接手机 / 平板',
      guideToken: '1 · 选择「固定 Token」即可自动生成并立即启用；需要自定义时在下方填写后保存。所有设备使用同一个 DSH 登录凭据。',
      guideUrl: '2 · 保持电脑与远端设备的 Tailscale 在线，填写电脑启动器显示的访问地址并保存。',
      guideLink: '3 · 复制登录链接，在手机 / 平板浏览器打开并收藏。Token 不是 Tailscale 的登录密钥。',
      urlUnsaved: '地址尚未保存，请先保存后复制登录链接。',
      modeTitle: '认证模式',
      modeHint: '随机 Token 每次启动重新生成；固定 Token 保存在本机凭据库中，重启后继续有效。',
      ephemeral: '随机 Token',
      ephemeralHint: '保持 DSH 默认行为，每次启动生成新的随机 Token。',
      persistent: '固定 Token',
      persistentHint: '使用持久化的 Token，重启后收藏的登录链接仍可用。',
      environment: '环境变量接管',
      environmentHint: '检测到 DSH_WEB_TOKEN，Token 由环境变量决定；界面只能查看，不能修改。',
      active: '当前',
      tokenTitle: 'Token 管理',
      tokenHint: '自动生成使用 32 字节（256 位）密码学安全随机数；自定义 Token 需 32–256 个 URL 安全字符。',
      tokenPlaceholder: '输入自定义 Token，或点击生成',
      generate: '生成安全 Token',
      save: '保存并启用',
      revoke: '撤销固定 Token',
      confirmRevoke: '确认撤销',
      show: '显示',
      hide: '隐藏',
      copyToken: '复制 Token',
      tokenMissing: '尚未配置固定 Token',
      tokenConfigured: '已配置固定 Token',
      urlTitle: '远程访问地址',
      urlHint: '填写启动器显示的 Tailscale Serve HTTPS 地址，例如 https://device.tailnet.ts.net/。此处只保存地址，不启动网络服务。',
      urlPlaceholder: 'https://device.tailnet.ts.net/',
      saveUrl: '保存地址',
      copyBase: '复制基础地址',
      copyAuth: '复制登录链接',
      statusTitle: '连接状态',
      statusMode: '认证模式',
      statusToken: 'Token 配置',
      statusWeb: 'Web 服务',
      statusBase: '远程地址',
      statusEffective: '配置状态',
      statusRestart: '重启要求',
      yes: '是',
      no: '否',
      running: '运行中',
      notSet: '未设置',
      effective: '已生效',
      notEffective: '未生效',
      restartNo: '无需重启 · 即时生效',
      restartYes: '需要重启 DSH',
      securityTitle: '固定 Token 的安全提示',
      securityBody: '固定 Token 不会随重启变化，任何获得该链接的人都能登录 DSH。请只在可信设备上收藏，不要公开分享；怀疑泄露时立即撤销并重新生成。',
      copyWarning: '登录链接包含 Token，复制后请妥善保管。',
      copied: '已复制',
      copyFailed: '复制失败',
      saved: '已保存',
      generated: '已生成新 Token，请点击「保存并启用」',
      revoked: '已撤销固定 Token，恢复随机模式',
      loading: '读取中…',
      failed: '读取失败：{message}',
      operationFailed: '操作失败：{message}',
      refresh: '刷新',
      hostHint: '若提示 404/405，请确认插件已启用并在插件页查看启动异常。',
    }

    const en = {
      tab: 'Wayfarer Key',
      title: 'Wayfarer Key',
      subtitle: 'Manage the DSH Web launch token and a stable public URL so bookmarked sign-in links survive restarts.',
      guideTitle: 'Connect your phone / tablet in three steps',
      guideToken: '1 · Select Persistent token to generate and enable one immediately, or enter a custom token below and save. All devices use the same DSH credential.',
      guideUrl: '2 · Connect both devices to Tailscale. Save the computer URL shown by your launcher.',
      guideLink: '3 · Copy the sign-in link, open it on your phone / tablet and bookmark it. This is a DSH token, not a Tailscale auth key.',
      urlUnsaved: 'Save the edited URL before copying a sign-in link.',
      modeTitle: 'Authentication mode',
      modeHint: 'An ephemeral token is regenerated on every start; a persistent token is stored in this machine’s credential store.',
      ephemeral: 'Ephemeral token',
      ephemeralHint: 'Keep the DSH default: a new random token on every start.',
      persistent: 'Persistent token',
      persistentHint: 'Keep one token across restarts so bookmarked links keep working.',
      environment: 'Managed by environment',
      environmentHint: 'DSH_WEB_TOKEN is set, so the environment owns the token; it can be viewed but not changed here.',
      active: 'Active',
      tokenTitle: 'Token management',
      tokenHint: 'Generated tokens use 32 bytes (256 bits) of cryptographic randomness; custom tokens need 32–256 URL-safe characters.',
      tokenPlaceholder: 'Enter a custom token or generate one',
      generate: 'Generate secure token',
      save: 'Save and enable',
      revoke: 'Revoke persistent token',
      confirmRevoke: 'Confirm revoke',
      show: 'Show',
      hide: 'Hide',
      copyToken: 'Copy token',
      tokenMissing: 'No persistent token configured',
      tokenConfigured: 'Persistent token configured',
      urlTitle: 'Remote access URL',
      urlHint: 'Enter the HTTPS base URL published by Tailscale or another reverse proxy. DSH does not change or enable proxy configuration.',
      urlPlaceholder: 'https://device.tailnet.ts.net/',
      saveUrl: 'Save URL',
      copyBase: 'Copy base URL',
      copyAuth: 'Copy sign-in link',
      statusTitle: 'Connection status',
      statusMode: 'Authentication mode',
      statusToken: 'Token',
      statusWeb: 'Web service',
      statusBase: 'Remote URL',
      statusEffective: 'Configuration',
      statusRestart: 'Restart',
      yes: 'Yes',
      no: 'No',
      running: 'Running',
      notSet: 'Not set',
      effective: 'Active',
      notEffective: 'Not active',
      restartNo: 'Not required · applied immediately',
      restartYes: 'Restart DSH',
      securityTitle: 'Security notice for persistent tokens',
      securityBody: 'A persistent token never changes on restart, so anyone with the link can sign in. Store it only on trusted devices and never share it; revoke and regenerate immediately if it leaks.',
      copyWarning: 'The sign-in link contains the token. Keep the copied value safe.',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      saved: 'Saved',
      generated: 'Token generated. Click “Save and enable”.',
      revoked: 'Persistent token revoked; back to ephemeral mode.',
      loading: 'Loading…',
      failed: 'Load failed: {message}',
      operationFailed: 'Operation failed: {message}',
      refresh: 'Refresh',
      hostHint: 'On 404/405, confirm the plugin is enabled and check its startup diagnostics.',
    }

    const STYLE = [
      '.ra-root{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);}',
      '.ra-head{display:flex;align-items:flex-start;gap:12px;}',
      '.ra-globe{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-brand-primary);}',
      '.ra-headText{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1;}',
      '.ra-title{margin:0;font-size:16px;line-height:24px;font-weight:600;letter-spacing:.2px;}',
      '.ra-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.ra-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);}',
      '.ra-cardHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
      '.ra-cardTitle{margin:0;font-size:13px;line-height:20px;font-weight:600;}',
      '.ra-hint{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);}',
      '.ra-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
      '.ra-mode{display:flex;align-items:flex-start;gap:10px;padding:12px;border-radius:12px;cursor:pointer;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);transition:border-color .15s,background .15s;}',
      '.ra-mode:hover{border-color:var(--dsw-alias-border-l2);}',
      '.ra-mode.on{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);}',
      '.ra-mode input{margin:3px 0 0;}',
      '.ra-modeBody{display:flex;flex-direction:column;gap:3px;min-width:0;}',
      '.ra-modeName{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;}',
      '.ra-chip{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;font-size:10px;',
      'border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}',
      '.ra-chip.on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}',
      '.ra-field{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.ra-input{flex:1;min-width:200px;height:32px;padding:0 10px;border-radius:9px;font:inherit;font-size:12px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;outline:0;}',
      '.ra-input:focus{border-color:var(--dsw-alias-brand-primary);}',
      '.ra-input.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
      '.ra-btn{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:inherit;font:inherit;',
      'font-size:12px;cursor:pointer;transition:border-color .15s,color .15s,background .15s;}',
      '.ra-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}',
      '.ra-btn:disabled{opacity:.45;cursor:default;}',
      '.ra-btn.primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);',
      'background:var(--dsw-alias-bg-layer-2);}',
      '.ra-btn.danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
      '.ra-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;}',
      '.ra-stat{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:10px;',
      'background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);}',
      '.ra-stat small{font-size:10px;letter-spacing:.3px;color:var(--dsw-alias-label-secondary);}',
      '.ra-stat b{font-size:12px;line-height:18px;font-weight:600;overflow-wrap:anywhere;}',
      '.ra-ok{color:var(--dsw-alias-state-success-primary);}',
      '.ra-warn{color:var(--dsw-alias-state-warn-primary);}',
      '.ra-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);}',
      '.ra-notice{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-brand-primary);}',
      '.ra-security{border-color:var(--dsw-alias-state-warn-secondary);}',
      '.ra-security .ra-cardTitle{color:var(--dsw-alias-state-warn-primary);}',
      '.ra-warnLine{display:flex;align-items:flex-start;gap:6px;font-size:11px;line-height:17px;color:var(--dsw-alias-state-warn-primary);}',
      '.ra-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.ra-spacer{flex:1;}',
      '@media (max-width:720px){.ra-modes{grid-template-columns:1fr;}.ra-field .ra-btn{width:100%;}}',
    ].join('')

    // The UI-primitives artwork named 'globe-outline', redrawn at 20px so the
    // plugin matches the native icon set instead of introducing a new one.
    function icon() {
      return h('svg', {
        width: 20, height: 20, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': true, focusable: false,
      },
      h('path', {
        d: 'M7.99986 14.0887C11.3626 14.0887 14.0886 11.3627 14.0886 7.99998C14.0886 4.63727 11.3626 1.91125 7.99986 1.91125C4.63715 1.91125 1.91113 4.63727 1.91113 7.99998C1.91113 11.3627 4.63715 14.0887 7.99986 14.0887Z',
        stroke: 'currentColor', strokeWidth: 1.45,
      }),
      h('path', { d: 'M2.34619 8H13.6538', stroke: 'currentColor', strokeWidth: 1.45, strokeLinecap: 'square' }),
      h('path', {
        d: 'M7.99976 14.0889C9.23509 14.0889 10.1743 11.3629 10.1743 8.00006C10.1743 4.63739 9.23509 1.91138 7.99976 1.91138',
        stroke: 'currentColor', strokeWidth: 1.45,
      }),
      h('path', {
        d: 'M7.99973 14.0889C6.76445 14.0889 5.8252 11.3629 5.8252 8.00006C5.8252 4.63739 6.76445 1.91138 7.99973 1.91138',
        stroke: 'currentColor', strokeWidth: 1.45,
      }))
    }

    async function copyText(value) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        return
      }
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      if (!ok) throw new Error('copy rejected')
    }

    function errorText(cause) {
      return cause && cause.message ? cause.message : String(cause)
    }

    function RemoteAccessTab(props) {
      const t = props.t
      const [state, setState] = useState({ status: 'loading', data: null, error: null })
      const [tokenDraft, setTokenDraft] = useState('')
      const [baseDraft, setBaseDraft] = useState('')
      const [showToken, setShowToken] = useState(false)
      const [busy, setBusy] = useState(false)
      const [notice, setNotice] = useState('')
      const [confirmRevoke, setConfirmRevoke] = useState(false)
      const timer = useRef(null)

      const faceRef = useRef(props)
      faceRef.current = props

      const flash = useCallback(function (text) {
        setNotice(text)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(function () { setNotice('') }, 3200)
      }, [])

      const call = useCallback(function (endpoint, payload) {
        return faceRef.current.remoteAccessCall(endpoint, payload || {})
      }, [])

      const load = useCallback(function () {
        setState(function (current) { return { status: 'loading', data: current.data, error: null } })
        return call('status').then(function (data) {
          setState({ status: 'idle', data: data, error: null })
          setBaseDraft(data && data.baseUrl ? data.baseUrl : '')
          setTokenDraft('')
          setShowToken(false)
        }, function (cause) {
          setState({ status: 'error', data: null, error: errorText(cause) })
        })
      }, [call])

      useEffect(function () { void load() }, [load])
      useEffect(function () {
        return function () { if (timer.current !== null) clearTimeout(timer.current) }
      }, [])

      const data = state.data
      const mode = data ? data.mode : 'ephemeral'
      const envMode = mode === 'environment'
      const fixed = mode === 'persistent'

      async function refresh(next) {
        if (next && next.mode) setState({ status: 'idle', data: next, error: null })
        else await load()
      }

      async function saveMode(target) {
        if (busy) return
        setBusy(true)
        try {
          const next = await call('save', {
            mode: target,
            token: tokenDraft.trim() === '' ? undefined : tokenDraft.trim(),
          })
          await refresh(next)
          setTokenDraft('')
          setShowToken(false)
          flash(target === 'persistent' ? t('saved') : t('revoked'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function generate() {
        if (busy) return
        setBusy(true)
        try {
          const result = await call('generate')
          setTokenDraft(result.token)
          setShowToken(true)
          flash(t('generated'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function reveal() {
        if (showToken) { setShowToken(false); setTokenDraft(''); return }
        if (busy) return
        setBusy(true)
        try {
          const result = await call('reveal')
          setTokenDraft(result.token)
          setShowToken(true)
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function copy(kind) {
        try {
          let value
          if (kind === 'token') {
            const result = await call('reveal')
            value = result.token
          } else if (kind === 'base') {
            value = data && data.baseUrl ? data.baseUrl : ''
            if (!value) throw new Error(t('notSet'))
          } else {
            const result = await call('link')
            value = result.url
            flash(t('copyWarning'))
          }
          await copyText(value)
          if (kind !== 'auth') flash(t('copied'))
        } catch (cause) {
          flash(t('copyFailed') + ' · ' + errorText(cause))
        }
      }

      async function saveUrl() {
        if (busy) return
        setBusy(true)
        try {
          const next = await call('save', { baseUrl: baseDraft })
          await refresh(next)
          setBaseDraft(next.baseUrl)
          flash(t('saved'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      async function revoke() {
        if (busy || !confirmRevoke) { setConfirmRevoke(true); return }
        setBusy(true)
        try {
          const next = await call('revoke')
          await refresh(next)
          setTokenDraft('')
          setShowToken(false)
          setConfirmRevoke(false)
          flash(t('revoked'))
        } catch (cause) {
          flash(t('operationFailed', { message: errorText(cause) }))
        } finally {
          setBusy(false)
        }
      }

      const urlDirty = !!data && baseDraft.trim() !== data.baseUrl
      const modeLabel = mode === 'environment' ? t('environment') : fixed ? t('persistent') : t('ephemeral')

      return h('section', { className: 'ra-root', 'aria-label': t('title') },
        h('style', null, STYLE),
        h('header', { className: 'ra-head' },
          h('span', { className: 'ra-globe' }, icon()),
          h('div', { className: 'ra-headText' },
            h('h2', { className: 'ra-title' }, t('title')),
            h('p', { className: 'ra-sub' }, t('subtitle')))),
        state.status === 'error'
          ? h('div', { className: 'ra-card' },
            h('p', { role: 'alert', className: 'ra-error' }, t('failed', { message: state.error })),
            h('p', { className: 'ra-hint' }, t('hostHint')),
            h('div', { className: 'ra-foot' },
              h('button', { className: 'ra-btn', type: 'button', onClick: function () { void load() } }, t('refresh'))))
          : null,
        state.status === 'loading' && !data
          ? h('div', { className: 'ra-card' }, h('p', { className: 'ra-hint' }, t('loading')))
          : null,
        data ? h(React.Fragment, null,
          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('guideTitle')),
            h('p', { className: 'ra-hint' }, t('guideToken')),
            h('p', { className: 'ra-hint' }, t('guideUrl')),
            h('p', { className: 'ra-hint' }, t('guideLink'))),
          envMode ? h('div', { className: 'ra-card' },
            h('p', { className: 'ra-cardTitle' }, t('environment')),
            h('p', { className: 'ra-hint' }, t('environmentHint'))) : null,

          h('div', { className: 'ra-card' },
            h('div', { className: 'ra-cardHead' },
              h('h3', { className: 'ra-cardTitle' }, t('modeTitle')),
              h('span', { className: fixed ? 'ra-chip on' : 'ra-chip' }, modeLabel)),
            h('p', { className: 'ra-hint' }, t('modeHint')),
            h('div', { className: 'ra-modes' },
              h('label', { className: mode === 'ephemeral' ? 'ra-mode on' : 'ra-mode' },
                h('input', {
                  type: 'radio', name: 'ra-mode', checked: mode === 'ephemeral', disabled: busy || envMode,
                  onChange: function () { void saveMode('ephemeral') },
                }),
                h('span', { className: 'ra-modeBody' },
                  h('span', { className: 'ra-modeName' }, t('ephemeral'),
                    mode === 'ephemeral' ? h('span', { className: 'ra-chip on' }, t('active')) : null),
                  h('span', { className: 'ra-hint' }, t('ephemeralHint')))),
              h('label', { className: fixed ? 'ra-mode on' : 'ra-mode' },
                h('input', {
                  type: 'radio', name: 'ra-mode', checked: fixed, disabled: busy || envMode,
                  onChange: function () { void saveMode('persistent') },
                }),
                h('span', { className: 'ra-modeBody' },
                  h('span', { className: 'ra-modeName' }, t('persistent'),
                    fixed ? h('span', { className: 'ra-chip on' }, t('active')) : null),
                  h('span', { className: 'ra-hint' }, t('persistentHint')))))),

          h('div', { className: 'ra-card' },
            h('div', { className: 'ra-cardHead' },
              h('h3', { className: 'ra-cardTitle' }, t('tokenTitle')),
              h('span', { className: data.configured ? 'ra-chip on' : 'ra-chip' },
                data.configured ? t('tokenConfigured') : t('tokenMissing'))),
            h('p', { className: 'ra-hint' }, t('tokenHint')),
            data.tokenMasked ? h('p', { className: 'ra-hint mono' }, '•• ' + data.tokenMasked) : null,
            h('div', { className: 'ra-field' },
              h('input', {
                'aria-label': t('tokenTitle'), className: 'ra-input mono', type: showToken ? 'text' : 'password',
                value: tokenDraft,
                placeholder: data.configured && !showToken ? data.tokenMasked : t('tokenPlaceholder'),
                autoComplete: 'off', spellCheck: false, disabled: busy || envMode,
                onChange: function (event) { setTokenDraft(event.target.value) },
              })),
            h('div', { className: 'ra-field' },
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || envMode, onClick: function () { void generate() } }, t('generate')),
              h('button', { className: 'ra-btn primary', type: 'button', disabled: busy || envMode, onClick: function () { void saveMode('persistent') } }, t('save')),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || envMode, onClick: function () { void reveal() } }, showToken ? t('hide') : t('show')),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || !data.configured, onClick: function () { void copy('token') } }, t('copyToken')),
              h('span', { className: 'ra-spacer' }),
              h('button', { className: confirmRevoke ? 'ra-btn danger' : 'ra-btn danger', type: 'button', disabled: busy || !data.configured || envMode, onClick: function () { void revoke() } }, confirmRevoke ? t('confirmRevoke') : t('revoke')))),

          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('urlTitle')),
            h('p', { className: 'ra-hint' }, t('urlHint')),
            h('div', { className: 'ra-field' },
              h('input', {
                'aria-label': t('urlTitle'), className: 'ra-input mono', type: 'text', value: baseDraft, placeholder: t('urlPlaceholder'),
                spellCheck: false, disabled: busy,
                onChange: function (event) { setBaseDraft(event.target.value) },
              }),
              h('button', { className: 'ra-btn', type: 'button', disabled: busy, onClick: function () { void saveUrl() } }, t('saveUrl'))),
            data.baseUrl ? h('p', { className: 'ra-hint', 'data-testid': 'ra-base-url' }, data.baseUrl) : h('p', { className: 'ra-hint' }, t('notSet')),
            h('div', { className: 'ra-field' },
              h('button', { className: 'ra-btn', type: 'button', disabled: busy || !data.baseUrl, onClick: function () { void copy('base') } }, t('copyBase')),
              h('button', { className: 'ra-btn primary', type: 'button', disabled: busy || urlDirty || !data.baseUrl || !data.configured, onClick: function () { void copy('auth') } }, t('copyAuth'))),
            urlDirty ? h('p', { className: 'ra-warnLine' }, t('urlUnsaved')) : null,
            h('p', { className: 'ra-warnLine' }, t('copyWarning'))),

          h('div', { className: 'ra-card' },
            h('h3', { className: 'ra-cardTitle' }, t('statusTitle')),
            h('div', { className: 'ra-grid' },
              stat(t('statusMode'), modeLabel),
              stat(t('statusToken'), data.configured ? t('yes') : t('no'), data.configured ? 'ok' : 'warn'),
              stat(t('statusWeb'), data.webRunning ? t('running') : t('notSet'), data.webRunning ? 'ok' : 'warn'),
              stat(t('statusBase'), data.baseUrl || t('notSet')),
              stat(t('statusEffective'), data.configured || mode === 'environment' ? t('effective') : t('notEffective'),
                data.configured || mode === 'environment' ? 'ok' : 'warn'),
              stat(t('statusRestart'), data.restartRequired ? t('restartYes') : t('restartNo')))),

          h('div', { className: 'ra-card ra-security' },
            h('h3', { className: 'ra-cardTitle' }, t('securityTitle')),
            h('p', { className: 'ra-hint' }, t('securityBody'))),

          h('div', { className: 'ra-foot' },
            notice ? h('span', { role: 'status', className: 'ra-notice' }, notice) : null,
            h('span', { className: 'ra-spacer' }),
            h('button', { className: 'ra-btn', type: 'button', disabled: busy, onClick: function () { void load() } }, t('refresh'))))
          : null)
    }

    function stat(label, value, tone) {
      return h('div', { className: 'ra-stat' },
        h('small', null, label),
        h('b', { className: tone === 'ok' ? 'ra-ok' : tone === 'warn' ? 'ra-warn' : undefined }, value))
    }

    function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'remote-access: dictionaries')
      const t = ctx.locale.bind(NS)
      const unwrap = function (answer) {
        if (answer && answer.ok === true) return answer.value
        const failure = answer && answer.error ? answer.error : undefined
        throw new Error(failure ? (failure.message || failure.code) : 'remote-access call failed')
      }
      const face = {
        remoteAccessCall: function (endpoint, payload) {
          return ctx.connection.rpc.call('/api', 'remote-access/' + endpoint, payload || {}).then(unwrap)
        },
      }
      ctx.slots.inject('plugins.tab', function () {
        return ctx.slots.register({
          name: 'plugins.tab',
          id: 'remote-access',
          order: 40,
          label: function () { return t('tab') },
          locale: NS,
          inject: function () { return face },
        }, RemoteAccessTab)
      })
    }

    return { inject: ['slots', 'locale', 'connection'], apply: apply }
  },
})
