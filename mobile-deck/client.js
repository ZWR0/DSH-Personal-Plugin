/**
 * 掌上行舟 Client half.
 *
 * A mobile-first workbench page that reads the shipped Session Controller
 * services for real state and hands the actual conversation back to the native
 * Conversation view. It owns no session data of its own, never scans the DOM,
 * and never invents a task status: every chip below comes from
 * `ctx.sessions.list` (Host catalog rows and running state) or
 * `ctx.uiSession.sessionStatus` (running / pending interaction / unseen stop).
 *
 * Capability boundaries kept on purpose:
 * - Sending, steering, attachments and question cards stay in the native
 *   composer and question UI, reached through `openSession`; this page never
 *   pretends to offer them when the Host does not.
 * - Stop asks the Host and reports `请求中 → 已请求停止 / 已停止` from the
 *   refreshed Host row, never from a local guess.
 * - No timers: resync happens on connection reset, focus, visibility, online
 *   and pageshow, plus an explicit refresh button.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-mobile-deck',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'mobileDeck'
    const PANEL_ID = 'mobile-deck'
    const ENDPOINT = 'mobile-deck/settings'
    const RULES_KEY = 'dsh.mobile-deck.alert-rules.v1'
    const SOUND_KEY = 'dsh.mobile-deck.sound.v1'
    const HOME_KEY = 'dsh.mobile-deck.mobile-home.v1'
    /** A lifecycle event may resync at most this often; repeated focus events stay free. */
    const RESYNC_MIN_MS = 15000
    /** iPad portrait stays single-column; iPad landscape and desktops get the split. */
    const WIDE_QUERY = '(min-width: 820px) and (min-height: 500px)'
    const LAYOUTS = ['auto', 'phone', 'pad']

    const zh = {
      nav: '掌上行舟',
      pageTitle: '掌上行舟',
      pageHint: '任务在电脑上运行；这里只显示状态与接管入口。',
      settingsHint: '布局与启停可在「插件 → 掌上行舟」中调整。',
      search: '搜索会话标题或工作目录',
      follow: '关注', unfollow: '取消关注', clearFollowed: '清空关注', filterFollowed: '关注', rulesTitle: '提醒规则',
      ruleQuestion: '提问 / 审阅', ruleApproval: '授权', ruleEnded: '任务结束', ruleOnlyFollowed: '仅关注',
      rulesHint: '仅控制提示音与即时播报，动态和待处理列表仍显示全部。仅关注开启但未关注会话时不会提醒。',
      rulesFailed: '无法同步 Host 提醒设置，请检查连接后刷新重试', rulesSync: '关注与提醒规则同步到 Host；音量留在此设备', importRules: '导入此浏览器旧设置', rulesLoading: '正在同步提醒设置', followLimit: '最多关注 200 个会话。',
      todoRecheck: '重新核对失败记录', todoAll: '全部待办', todoQuestion: '待回答', todoApproval: '待授权', todoFailure: '失败任务', todoOpen: '进入处理', todoReview: '标记已查看', todoEmpty: '当前没有这类待办', todoScan: '正在核对最近失败记录…', todoPartial: '{n} 个会话记录暂不可读，请刷新重试', todoHint: '问题和授权按最新状态移除；失败可标记已查看，新一轮失败会重新出现', todoFailureHint: '最近一轮明确失败；进入会话查看详情并决定是否重试',
      pendingCenter: '待处理中心', pendingMissing: '打开会话查看请求详情', reviewNeeded: '需要审阅',
      pushUnavailable: '后台推送尚需宿主支持，关闭网页或锁屏后不保证提醒。',

      compactHome: '默认进入', compactEnabled: '启用工作台', settingsHelp: '设置说明', remoteCompact: '地址与登录由远行之钥管理。',
      mobileHome: '手机默认打开掌上行舟', mobileHomeHint: '仅保存到此浏览器。触屏窄屏启动时进入工作台；保留会话深链接，不影响电脑。',
      mobileHomeFailed: '浏览器无法保存此设置，请检查存储权限。',

      filterAll: '全部', filterWaiting: '待处理', filterRunning: '运行中', filterUnread: '未查看',
      stateApproval: '需要授权', stateQuestion: '需要回答', stateAttention: '需要处理',
      files: '工作区文件', filesFailed: '文件入口不可用：{message}', filesUnsupported: '当前宿主未提供文件面板，请进入会话查看文件链接。',
      alerts: '动态', alertsEmpty: '暂无新动态', soundOn: '提示音已开', soundOff: '开启提示音', soundFailed: '此浏览器无法启用提示音',
      soundHint: '开启或点击试听会播放提示音。刷新后需在页面内操作以激活声音；无声时检查手机媒体音量。锁屏后不保证提醒。',
      soundLabel: '声音反馈', soundTest: '试听', soundTestEnable: '开启并试听', soundVolume: '提示音音量', soundMuted: '已静音', soundReady: '已激活', soundWaiting: '等待点击激活', soundBusy: '正在激活…', soundStorage: '声音设置无法保存，刷新后会恢复。',

      ended: '任务已结束', alertOpen: '查看',

      searchEmpty: '没有匹配的会话',
      searchEmptyHint: '换个关键词，或清空搜索查看全部会话。',

      connConnected: '已连接',
      connConnecting: '正在重连',
      connDisconnected: '连接不可用',
      connUnknown: '等待连接',
      lastSync: '最近同步 {time}',
      neverSynced: '尚未完成同步',
      staleHint: '连接不可用时显示的状态可能已过期；恢复后会重新同步会话与缺失消息。',
      retry: '重新连接',
      refresh: '刷新',
      refreshing: '正在刷新…',
      newSession: '新建会话',
      creatingSession: '正在创建…', createFailed: '新建会话失败：{message}', openCreated: '打开新会话', createdReady: '独立会话已创建，点击打开即可开始',
      newSessionHint: '创建独立对话，不携带已有消息或草稿',
      groupWaiting: '等待我回答',
      groupRunning: '正在运行',
      groupIdle: '最近会话',
      groupWaitingHint: '这些会话在等你回答，才会继续。',
      groupRunningHint: '任务仍在电脑上运行。',
      groupIdleHint: '既没有运行任务，也没有等待你的提问；这不代表它们已经完成。',
      stateWaiting: '等待回答',
      stateRunning: '运行中',
      stateIdle: '空闲',
      stateUnread: '已结束（未查看）',
      handleRequest: '处理请求',
      open: '进入会话',
      stopping: '请求停止中…',
      stopPending: '已请求停止，等待确认',
      stopped: '已停止',
      stop: '停止',
      stopFailed: '停止失败：{message}',
      stopUnsupported: '当前 DSH 版本不支持在此直接停止会话，请打开会话后停止。',
      stopUnknown: '服务器未返回有效结果，请刷新列表核对。',
      previewNone: '选择一个会话查看详情。',
      detailTitle: '会话详情',
      detailWorkspace: '工作目录',
      detailUpdated: '最近活动',
      detailId: '会话 ID',
      detailTakeover: '接管说明',
      takeoverBody: '回复、运行中补发指令、回答提问卡片、选择图片或文件都在原生会话页完成，本页不复刻这些控件。',
      detailOpenHint: '打开后可查看流式回复与工具执行详情。',
      emptyTitle: '没有可见会话',
      emptyBody: '新建一个会话，或在电脑上开始任务后再回来。',
      loadingTitle: '正在读取会话列表…',
      errorTitle: '读取会话列表失败',
      disabledTitle: '掌上行舟已停用',
      disabledBody: '在「插件 → 掌上行舟」中启用后可显示移动工作台。',
      settingsNav: '掌上行舟',
      settingsIntro: '工作台本身不执行任务：会话、模型调用与文件操作仍在电脑上运行。',
      settingsEnabled: '启用移动工作台',
      settingsEnabledHint: '关闭后隐藏工作台与输入框入口，可在本页重新启用。',
      settingsLayout: '布局',
      settingsLayoutHint: '「自动」按可用宽度与高度选择单栏或分栏；手机与平板选项用于测试或特殊设备。',
      layoutAuto: '自动',
      layoutPhone: '手机单栏',
      layoutPad: '平板分栏',
      settingsIdle: '显示最近会话数量',
      settingsIdleHint: '只影响既不运行也不等待的会话；范围 1–30。',
      save: '保存',
      saving: '正在保存…',
      saved: '已保存',
      saveFailed: '保存失败：{message}',
      settingsStatus: '连接状态',
      settingsStatusHint: '本页不轮询：连接恢复、窗口重新可见或手动刷新时才同步。',
      settingsRemote: '远程访问',
      settingsRemoteHint: '远程地址与固定 Token 由「远行之钥」管理；本插件不保存任何凭据。',
      relNow: '刚刚',
      relMinutes: '{n} 分钟前',
      relHours: '{n} 小时前',
      relYesterday: '昨天',
      relDays: '{n} 天前',
      unknownError: '未知错误',
    }

    const en = {
      nav: 'Pocket deck',
      pageTitle: 'Pocket deck',
      pageHint: 'Tasks keep running on the computer; this page only shows status and the way in.',
      settingsHint: 'Layout and enablement live in Plugins → Pocket deck.',
      search: 'Search session titles or working directories',
      follow: 'Follow', unfollow: 'Unfollow', clearFollowed: 'Clear followed', filterFollowed: 'Following', rulesTitle: 'Alert rules',
      ruleQuestion: 'Questions / reviews', ruleApproval: 'Approvals', ruleEnded: 'Task ended', ruleOnlyFollowed: 'Followed only',
      rulesHint: 'Controls sound and live announcements only; activity and pending lists still show everything. Followed-only mode is silent if no sessions are followed.',
      rulesFailed: 'Could not sync alert settings. Check the connection and refresh.', rulesSync: 'Follows and alerts sync through the Host; volume stays on this device.', importRules: 'Import this browser’s old settings', rulesLoading: 'Syncing alert settings', followLimit: 'You can follow up to 200 sessions.',
      todoRecheck: 'Recheck failure records', todoAll: 'All actions', todoQuestion: 'Questions', todoApproval: 'Approvals', todoFailure: 'Failed tasks', todoOpen: 'Handle request', todoReview: 'Mark reviewed', todoEmpty: 'No actions in this category', todoScan: 'Checking recent failure records…', todoPartial: '{n} session records unavailable; refresh to retry', todoHint: 'Answered questions and resolved approvals disappear. Review failures; a new failed turn appears again.', todoFailureHint: 'The latest turn failed. Open the conversation to inspect it and decide whether to retry.',
      pendingCenter: 'Needs attention', pendingMissing: 'Open the conversation for request details', reviewNeeded: 'Review needed',
      pushUnavailable: 'Background push requires host support; alerts are not reliable while locked or the page is closed.',

      compactHome: 'Mobile home', compactEnabled: 'Workbench', settingsHelp: 'About these settings', remoteCompact: 'Address and sign-in are managed by Remote Key.',
      mobileHome: 'Open Pocket deck on mobile startup', mobileHomeHint: 'Saved only in this browser. Opens on narrow touch screens, preserves session deep links, and does not affect your computer.',
      mobileHomeFailed: 'This browser could not save the setting. Check storage permissions.',

      filterAll: 'All', filterWaiting: 'Needs you', filterRunning: 'Running', filterUnread: 'Unseen',
      stateApproval: 'Approval needed', stateQuestion: 'Answer needed', stateAttention: 'Needs attention',
      files: 'Workspace files', filesFailed: 'Files unavailable: {message}', filesUnsupported: 'This host has no files panel. Open the conversation to use file links.',
      alerts: 'Activity', alertsEmpty: 'No new activity', soundOn: 'Sound on', soundOff: 'Enable sound', soundFailed: 'Sound is unavailable in this browser',
      soundHint: 'Enable or test to hear a sample. After reloading, interact with the page to activate audio. Check media volume if silent. Sound is not reliable while locked.',
      soundLabel: 'Sound feedback', soundTest: 'Test', soundTestEnable: 'Enable & test', soundVolume: 'Alert volume', soundMuted: 'Muted', soundReady: 'Active', soundWaiting: 'Tap to activate', soundBusy: 'Activating…', soundStorage: 'Sound settings could not be saved and will reset on reload.',

      ended: 'Task ended', alertOpen: 'View',

      searchEmpty: 'No matching sessions',
      searchEmptyHint: 'Try another keyword or clear the search to see all sessions.',

      connConnected: 'Connected',
      connConnecting: 'Reconnecting',
      connDisconnected: 'Connection unavailable',
      connUnknown: 'Waiting for connection',
      lastSync: 'Synced {time}',
      neverSynced: 'Not synced yet',
      staleHint: 'The connection is down, so the state below may be stale; it resyncs when the connection returns.',
      retry: 'Reconnect',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      newSession: 'New session',
      creatingSession: 'Creating…', createFailed: 'Could not create session: {message}', openCreated: 'Open new session', createdReady: 'Your independent session is ready to open',
      newSessionHint: 'Create an independent conversation without existing messages or drafts',
      groupWaiting: 'Waiting for you',
      groupRunning: 'Running',
      groupIdle: 'Recent sessions',
      groupWaitingHint: 'These sessions need your answer before they continue.',
      groupRunningHint: 'Work is still running on the computer.',
      groupIdleHint: 'Neither running nor waiting on you. That does not mean they completed.',
      stateWaiting: 'Needs answer',
      stateRunning: 'Running',
      stateIdle: 'Idle',
      stateUnread: 'Finished (unseen)',
      handleRequest: 'Handle request',
      open: 'Open conversation',
      stopping: 'Requesting stop…',
      stopPending: 'Stop requested, awaiting confirmation',
      stopped: 'Stopped',
      stop: 'Stop',
      stopFailed: 'Stop failed: {message}',
      stopUnsupported: 'This DSH version cannot stop a session from here; open the session and stop it there.',
      stopUnknown: 'The server returned no valid result. Refresh the list to check.',
      previewNone: 'Select a session to see its details.',
      detailTitle: 'Session details',
      detailWorkspace: 'Working directory',
      detailUpdated: 'Last activity',
      detailId: 'Session ID',
      detailTakeover: 'Taking over',
      takeoverBody: 'Replying, steering a running turn, answering question cards and picking images or files all happen in the native conversation page; this page does not duplicate those controls.',
      detailOpenHint: 'The native conversation shows streaming replies and tool execution details.',
      emptyTitle: 'No visible sessions',
      emptyBody: 'Start a new session, or begin a task on the computer and come back.',
      loadingTitle: 'Loading sessions…',
      errorTitle: 'Could not load sessions',
      disabledTitle: 'Pocket deck is off',
      disabledBody: 'Enable it under Plugins → Pocket deck to show the mobile workbench.',
      settingsNav: 'Pocket deck',
      settingsIntro: 'The workbench runs nothing itself: sessions, model calls and file operations stay on the computer.',
      settingsEnabled: 'Enable the mobile workbench',
      settingsEnabledHint: 'Turning this off hides the workbench and composer entry; you can re-enable them here.',
      settingsLayout: 'Layout',
      settingsLayoutHint: 'Auto follows the available width; the phone and pad options are for testing or unusual devices.',
      layoutAuto: 'Auto',
      layoutPhone: 'Phone (single column)',
      layoutPad: 'Pad (two panes)',
      settingsIdle: 'Recent sessions shown',
      settingsIdleHint: 'Only affects sessions that are neither running nor waiting; range 1–30.',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Save failed: {message}',
      settingsStatus: 'Connection',
      settingsStatusHint: 'This page does not poll: it syncs when the connection returns, the window becomes visible, or you refresh.',
      settingsRemote: 'Remote access',
      settingsRemoteHint: 'The remote address and fixed token belong to Remote Key; this plugin stores no credentials.',
      relNow: 'just now',
      relMinutes: '{n} min ago',
      relHours: '{n} h ago',
      relYesterday: 'yesterday',
      relDays: '{n} d ago',
      unknownError: 'unknown error',
    }

    /** Every rule is scoped to `mdk-` class names so no style leaks into the app. */
    const CSS = [
      '.mdk-todos>p{margin:8px 0 12px}.mdk-todofilters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}.mdk-todofilters .mdk-choice{min-height:36px}.mdk-todofailure{padding:14px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}.mdk-chip[data-state=failed]{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}@media(pointer:coarse),(max-width:600px){.mdk-todofilters .mdk-choice{min-height:44px}}@media(max-width:600px){.mdk-todofilters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.mdk-todofilters .mdk-choice{justify-content:center}}',
      '.mdk-root{display:flex;flex-direction:column;min-height:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary,#252622);font:inherit}',
      '.mdk-head{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--dsw-alias-bg-base,#faf9f6);border-bottom:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16))}',
      '.mdk-headtext{min-width:0;flex:1 1 180px}',
      '.mdk-title{font-size:16px;font-weight:600}',
      '.mdk-sub{margin-top:2px;font-size:12px;color:var(--dsw-alias-label-secondary,#62645e);overflow-wrap:anywhere}',
      '.mdk-conn{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));font-size:12px;white-space:nowrap}',
      '.mdk-dot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#4b9a6d);flex:none}',
      '.mdk-conn[data-state="connecting"] .mdk-dot{background:var(--dsw-alias-state-warning-primary,#c9a227)}',
      '.mdk-conn[data-state="disconnected"] .mdk-dot,.mdk-conn[data-state="auth"] .mdk-dot{background:var(--dsw-alias-state-error-primary,#cf5555)}',
      '.mdk-conn[data-state="unknown"] .mdk-dot{background:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-banner{margin:10px 14px 0;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-state-warning-primary,#c9a227);font-size:12px;line-height:1.5;overflow-wrap:anywhere}',
      '.mdk-banner[data-kind="error"]{border-color:var(--dsw-alias-state-error-primary,#cf5555)}',
      '.mdk-tools{display:flex;flex-wrap:wrap;gap:8px;padding:12px 14px 4px}',
      '.mdk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));background:var(--dsw-alias-bg-layer-1,#ffffff);color:inherit;font:inherit;font-size:13px;cursor:pointer}',
      '.mdk-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#c9a227);outline-offset:2px}',
      '.mdk-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.mdk-btn[data-variant="primary"]{border-color:var(--dsw-alias-brand-primary,#c9a227)}',
      '.mdk-btn[data-variant="danger"]{border-color:var(--dsw-alias-state-error-primary,#cf5555);color:var(--dsw-alias-state-error-primary,#cf5555);min-height:44px;padding:0 12px;font-size:12px}',
      '.mdk-search{flex:1 1 220px;min-width:0;min-height:44px;box-sizing:border-box;padding:0 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));background:var(--dsw-alias-bg-layer-1,#ffffff);color:inherit;font:inherit;font-size:16px}',
      '.mdk-search:focus-visible,.mdk-guide summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#c9a227);outline-offset:2px}',
      '.mdk-guide{margin:8px 14px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-guide summary{cursor:pointer;min-height:44px;align-content:center}',
      '.mdk-body{display:flex;flex:1 1 auto;min-height:0}',
      '.mdk-list{flex:1 1 auto;min-width:0;padding:4px 0 16px}',
      '.mdk-group{padding:10px 14px 0}',
      '.mdk-grouphead{display:flex;align-items:baseline;gap:8px}',
      '.mdk-grouptitle{margin:0;font-size:13px;font-weight:600}',
      '.mdk-count{font-size:12px;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-grouphint{margin:2px 0 10px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-rowwrap{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}',
      '.mdk-row{display:flex;flex-direction:column;gap:6px;width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));background:var(--dsw-alias-bg-layer-1,#ffffff);text-align:left;font:inherit;color:inherit;cursor:pointer}',
      '.mdk-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#c9a227);outline-offset:2px}',
      '.mdk-row[aria-current="true"]{border-color:var(--dsw-alias-brand-primary,#c9a227)}',
      '.mdk-rowtop{display:flex;gap:10px;align-items:flex-start;justify-content:space-between}',
      '.mdk-rowtitle{font-size:14px;font-weight:600;line-height:1.4;overflow-wrap:anywhere;word-break:break-word}',
      '.mdk-chip{flex:none;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:999px;font-size:11px;white-space:nowrap;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16))}',
      '.mdk-chip[data-state="waiting"]{border-color:var(--dsw-alias-state-warning-primary,#c9a227);color:var(--dsw-alias-state-warning-primary,#c9a227)}',
      '.mdk-chip[data-state="running"]{border-color:var(--dsw-alias-state-success-primary,#4b9a6d);color:var(--dsw-alias-state-success-primary,#4b9a6d)}',
      '.mdk-rowmeta{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary,#62645e);overflow-wrap:anywhere}',
      '.mdk-rowacts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
      '.mdk-stopnote{font-size:12px;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-stopnote[data-kind="error"]{color:var(--dsw-alias-state-error-primary,#cf5555)}',
      '.mdk-detail{flex:0 0 340px;max-width:42%;box-sizing:border-box;padding:12px 14px 20px;border-left:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));overflow:auto}',
      '.mdk-card{border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));border-radius:12px;padding:12px;background:var(--dsw-alias-bg-layer-1,#ffffff)}',
      '.mdk-card+.mdk-card{margin-top:10px}',
      '.mdk-k{font-size:11px;letter-spacing:.04em;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-v{margin-top:3px;font-size:13px;line-height:1.5;overflow-wrap:anywhere}',
      '.mdk-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}',
      '.mdk-empty{padding:28px 14px;text-align:center}',
      '.mdk-emptytitle{font-size:14px;font-weight:600}',
      '.mdk-emptybody{margin-top:6px;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-pad{padding-bottom:max(16px,env(safe-area-inset-bottom))}',
      '.mdk-settings{display:flex;flex-direction:column;gap:14px;padding:4px 2px max(18px,env(safe-area-inset-bottom));max-width:720px}',
      '.mdk-field{border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));border-radius:12px;padding:12px}',
      '.mdk-fieldhead{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.mdk-label{font-size:13px;font-weight:600}',
      '.mdk-hint{margin-top:4px;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-toggle{min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center}',
      '.mdk-choices{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}',
      '.mdk-choice{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer}',
      '.mdk-choice[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary,#c9a227);color:var(--dsw-alias-brand-primary,#c9a227)}',
      '.mdk-choice:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#c9a227);outline-offset:2px}',
      '.mdk-num{min-height:44px;width:88px;box-sizing:border-box;padding:0 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(105,91,62,.16));background:transparent;color:inherit;font:inherit;font-size:16px}',
      '.mdk-note{font-size:12px;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-note[data-kind="error"]{color:var(--dsw-alias-state-error-primary,#cf5555)}',
      '.mdk-note[data-kind="ok"]{color:var(--dsw-alias-state-success-primary,#4b9a6d)}',
      '.mdk-root[data-layout=pad] .mdk-body{flex-wrap:wrap}.mdk-root[data-layout=pad] .mdk-list{flex-basis:280px}.mdk-root[data-layout=pad] .mdk-detail{flex:1 1 280px;max-width:100%}',
      '.mdk-root{--mdk-accent:var(--dsw-alias-link,#866719);--mdk-line:var(--dsw-alias-border-l2,rgba(105,91,62,.16));--mdk-soft:var(--dsw-alias-bg-layer-2,#f2f1ed);--mdk-shadow:0 2px 5px rgba(35,28,12,.03),0 10px 28px rgba(35,28,12,.035);background:var(--dsw-alias-bg-base,#faf9f6);isolation:isolate}',
      '.mdk-root *{box-sizing:border-box}.mdk-root button,.mdk-root input{-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
      '.mdk-head{padding:20px 24px;gap:16px;background:var(--dsw-alias-bg-base,#faf9f6);border-bottom:1px solid var(--mdk-line)}',
      '.mdk-title{font-size:20px;letter-spacing:.03em;display:flex;align-items:center;gap:10px}.mdk-title .mdk-icon{color:var(--mdk-accent);width:22px;height:22px}',
      '.mdk-sub{margin-top:5px;line-height:1.5}.mdk-conn{background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 2px 8px rgba(35,28,12,.03);padding:9px 12px;max-width:100%;white-space:normal;line-height:1.4}',
      '.mdk-tools{gap:10px;padding:12px 24px 18px;align-items:center}.mdk-searchbox{display:flex;align-items:center;gap:9px;flex:1 1 260px;min-width:0;border:1px solid var(--mdk-line);border-radius:12px;padding-left:13px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:inset 0 1px 3px rgba(35,28,12,.025)}',
      '.mdk-searchbox>.mdk-icon{color:var(--dsw-alias-label-secondary,#62645e)}.mdk-search{width:100%;border:0;background:transparent;padding-left:0;outline:none;border-radius:12px}.mdk-search::placeholder{color:var(--dsw-alias-label-tertiary,#74766f);opacity:1}.mdk-searchbox:focus-within{border-color:var(--mdk-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--mdk-accent) 12%,transparent)}',
      '.mdk-btn,.mdk-choice{font-weight:500;border-color:var(--mdk-line);box-shadow:0 1px 2px rgba(35,28,12,.04);user-select:none}.mdk-btn[data-variant=primary]{background:linear-gradient(135deg,#8b6c28,#70531b);border-color:#806020;color:#fffdf5;box-shadow:0 3px 8px rgba(119,87,25,.18),inset 0 1px rgba(255,255,255,.14)}',
      '.mdk-btn[data-variant=danger]{background:transparent}.mdk-btn:disabled{opacity:.5;box-shadow:none}.mdk-icon{width:17px;height:17px;flex:none;vertical-align:middle;pointer-events:none}',
      '.mdk-guide{margin:0 24px;padding:0;border-bottom:1px solid var(--mdk-line)}.mdk-guide summary{width:fit-content;color:var(--dsw-alias-label-secondary,#62645e)}.mdk-guide p{max-width:760px;margin:0 0 14px;line-height:1.8}',
      '.mdk-body{padding:0 10px;gap:6px;align-items:flex-start}.mdk-group{padding:10px 14px 0}.mdk-grouptitle{font-size:14px}.mdk-count{background:var(--mdk-soft);border-radius:6px;padding:2px 7px;font-size:11px}.mdk-grouphint{line-height:1.65;margin:5px 0 12px}',
      '.mdk-rowwrap{gap:0;margin-bottom:12px;border:1px solid var(--mdk-line);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:var(--mdk-shadow);overflow:hidden}.mdk-rowwrap:has(.mdk-row[aria-current=true]){border-color:var(--mdk-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--mdk-accent) 10%,transparent),var(--mdk-shadow)}',
      '.mdk-row{background:transparent;border:0;border-radius:0;padding:16px 16px 12px;gap:10px}.mdk-row:focus-visible{outline-offset:-3px;border-radius:12px}.mdk-rowtitle{font-size:14px;font-weight:600}.mdk-rowmeta{font-size:12px;line-height:1.5}.mdk-rowwrap>.mdk-rowacts{margin:0 16px;padding:8px 0 10px;border-top:1px solid var(--mdk-line);justify-content:flex-end}.mdk-rowacts .mdk-btn{font-size:12px;padding:0 11px}.mdk-rowacts .mdk-btn:not([data-variant=primary]){background:transparent;box-shadow:none}',
      '.mdk-chip{background:var(--mdk-soft);color:var(--dsw-alias-label-secondary,#62645e);border-color:transparent;font-weight:500}.mdk-chip[data-state=waiting]{background:color-mix(in srgb,var(--mdk-accent) 10%,transparent);color:var(--mdk-accent)}.mdk-chip[data-state=running]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#377a50) 10%,transparent)}',
      '.mdk-detail{border-left:0;padding-top:10px}.mdk-card{padding:16px;border-color:var(--mdk-line);border-radius:14px;box-shadow:var(--mdk-shadow)}.mdk-k{font-size:12px}.mdk-v{line-height:1.7;margin-top:6px}.mdk-empty{padding:48px 24px}.mdk-empty>.mdk-icon{width:30px;height:30px;color:var(--mdk-accent);margin-bottom:14px;opacity:.7}',
      '.mdk-settings{width:100%;max-width:780px;gap:12px;padding:8px 8px max(24px,env(safe-area-inset-bottom))}.mdk-field{padding:18px 20px;background:var(--dsw-alias-bg-layer-1,#fff);border-color:var(--mdk-line);border-radius:14px;box-shadow:var(--mdk-shadow)}.mdk-label{display:flex;align-items:center;gap:8px;font-size:14px}.mdk-label>.mdk-icon{color:var(--mdk-accent)}.mdk-hint{line-height:1.75;margin-top:6px}.mdk-choices{gap:6px}.mdk-choice{background:var(--mdk-soft);border-color:transparent}.mdk-choice[aria-pressed=true]{background:var(--dsw-alias-bg-layer-1,#fff);border-color:var(--mdk-accent);color:var(--mdk-accent);box-shadow:0 2px 6px rgba(35,28,12,.07)}',
      '.mdk-num{border-color:var(--mdk-line);background:var(--mdk-soft)}.mdk-toggle input{appearance:none;-webkit-appearance:none;position:relative;width:40px;height:24px;border-radius:99px;background:var(--dsw-alias-label-tertiary,#74766f);border:1px solid transparent;cursor:pointer;margin:0}.mdk-toggle input:before{content:"";display:block;width:18px;height:18px;margin:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}.mdk-toggle input:checked{background:var(--mdk-accent)}.mdk-toggle input:checked:before{transform:translateX(16px)}.mdk-toggle input:disabled{opacity:.5;cursor:wait}.mdk-toggle input:focus-visible,.mdk-num:focus-visible{outline:2px solid var(--mdk-accent);outline-offset:3px}',
      '.mdk-btn:active:not(:disabled),.mdk-choice:active:not(:disabled){filter:brightness(.94)}',
      '@media(hover:hover){.mdk-btn:hover:not(:disabled),.mdk-choice:hover:not(:disabled){filter:brightness(1.04);border-color:var(--mdk-accent);box-shadow:0 4px 12px rgba(35,28,12,.09)}.mdk-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(138,106,8,.045))}.mdk-guide summary:hover{color:var(--mdk-accent)}}',
      '@media(max-width:600px){.mdk-head{padding:16px;gap:10px}.mdk-title{font-size:18px}.mdk-headtext{flex-basis:100%}.mdk-tools{padding:12px 16px;gap:8px}.mdk-searchbox{flex-basis:100%}.mdk-tools>.mdk-btn{flex:1;padding:0 10px}.mdk-guide{margin:0 16px}.mdk-body{padding:0 2px}.mdk-rowtop{flex-wrap:wrap;gap:8px}.mdk-rowtitle{flex:1 1 150px}.mdk-field{padding:16px}.mdk-settings{padding-left:2px;padding-right:2px}.mdk-conn{font-size:11px}}',
      '@media(prefers-reduced-motion:no-preference){.mdk-btn,.mdk-choice,.mdk-row,.mdk-rowwrap,.mdk-toggle input,.mdk-toggle input:before{transition:transform .16s ease,box-shadow .2s ease,border-color .2s ease,background-color .2s ease}.mdk-btn:active:not(:disabled),.mdk-choice:active:not(:disabled){transform:translateY(1px) scale(.975);box-shadow:inset 0 2px 4px rgba(35,28,12,.1)}.mdk-row:active{transform:scale(.992)}.mdk-btn[data-busy=true]>.mdk-icon{animation:mdk-spin 1s linear infinite}@keyframes mdk-spin{to{transform:rotate(360deg)}}}',
      '@media (prefers-reduced-motion: no-preference){.mdk-row,.mdk-btn,.mdk-choice{transition:border-color .15s ease,background-color .15s ease}}',
      '.mdk-filters{display:flex;flex-wrap:wrap;gap:6px;padding:0 24px 10px}.mdk-filters .mdk-choice{display:flex;gap:7px;align-items:center;padding:0 12px}.mdk-events{margin:0 24px 10px;border-bottom:1px solid var(--mdk-line);padding-bottom:8px;font-size:12px}.mdk-events summary{min-height:44px;cursor:pointer;align-content:center;list-style:none;display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary,#62645e)}.mdk-events[open] summary{color:var(--mdk-accent)}.mdk-event{display:flex;justify-content:space-between;gap:14px;width:100%;min-height:44px;text-align:left;background:transparent;border:0;border-top:1px solid var(--mdk-line);color:inherit;font:inherit;cursor:pointer;padding:10px 0}.mdk-event span{overflow-wrap:anywhere}.mdk-event time{flex:none;color:var(--dsw-alias-label-secondary,#62645e)}.mdk-event:focus-visible,.mdk-events summary:focus-visible{outline:2px solid var(--mdk-accent);outline-offset:2px}.mdk-activity{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}',
      '.mdk-filemessage{font-size:12px;max-width:220px;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary,#62645e)}',
      '.mdk-launch{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;padding:0;border-radius:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);box-shadow:none;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.mdk-launch .mdk-icon{width:16px;height:16px}.mdk-launchbadge{position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;border-radius:99px;background:var(--dsw-alias-link,#866719);color:var(--dsw-alias-bg-layer-1,#fff);font:600 10px/16px system-ui;padding:0 4px;box-shadow:0 0 0 2px var(--dsw-alias-bg-base,#faf9f6)}.mdk-launch:focus-visible{outline:2px solid var(--dsw-alias-link,#866719);outline-offset:3px}.mdk-launch:active{filter:brightness(.92);background:var(--dsw-alias-bg-layer-2);box-shadow:none}',
      '@media(pointer:coarse){.mdk-launch{width:44px;height:44px;border-radius:13px}}@media(hover:hover){.mdk-launch:hover{border-color:var(--dsw-alias-link,#866719);background:var(--dsw-alias-bg-layer-2);box-shadow:none}}@media(prefers-reduced-motion:no-preference){.mdk-launch{transition:transform .16s ease,box-shadow .2s ease}.mdk-launch:active{transform:scale(.94)}}@media(max-width:600px){.mdk-launch{width:44px;height:44px;border-radius:13px}.mdk-events{margin-left:16px;margin-right:16px}.mdk-filters{padding-left:16px;padding-right:16px;flex-wrap:nowrap;gap:5px}.mdk-filters .mdk-choice{flex:1;min-width:0;justify-content:center;white-space:nowrap;font-size:12px;padding:0 7px;gap:4px}.mdk-filters .mdk-count{padding:1px 4px;font-size:10px}}',
      '.mdk-soundrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.mdk-soundtitle{display:flex;align-items:center;gap:7px;flex:1;font-size:12px;min-width:140px}.mdk-soundtitle>.mdk-icon{color:var(--mdk-accent)}.mdk-soundstatus{color:var(--dsw-alias-label-secondary,#62645e);font-size:11px}.mdk-sound .mdk-btn{min-height:44px;padding:0 12px;font-size:12px}.mdk-volume{display:flex;align-items:center;gap:12px;margin-top:12px;font-size:12px}.mdk-volume input{min-width:0;flex:1;min-height:44px;accent-color:var(--mdk-accent);cursor:pointer}.mdk-volume output{min-width:36px;text-align:right;font-variant-numeric:tabular-nums}',
      '.mdk-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:960px;align-items:start}.mdk-settings>.mdk-preferences,.mdk-settings>.mdk-note{grid-column:1/-1}.mdk-preferences{padding:0;overflow:hidden}.mdk-switchgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.mdk-switchcell{min-width:0;padding:14px 16px;align-content:center}.mdk-switchcell+.mdk-switchcell{border-left:1px solid var(--mdk-line)}.mdk-switchcell .mdk-fieldhead{gap:8px}.mdk-switchcell .mdk-label{font-size:13px;line-height:1.4;gap:6px}.mdk-switchcell .mdk-toggle{flex:none}.mdk-soundcompact .mdk-soundrow{flex-wrap:nowrap;gap:8px}.mdk-soundcompact .mdk-soundtitle{min-width:0;flex-wrap:wrap;font-size:13px;font-weight:600;gap:5px}.mdk-soundcompact .mdk-soundstatus{font-weight:400}.mdk-tuning{padding:0 16px;border-top:1px solid var(--mdk-line)}.mdk-tuning .mdk-volume{margin:0;gap:12px;min-height:58px}.mdk-tuning .mdk-volume>span{white-space:nowrap}.mdk-settingshelp{padding:0 16px;color:var(--dsw-alias-label-secondary,#62645e);font-size:12px;border-top:1px solid var(--mdk-line)}.mdk-settingshelp summary{cursor:pointer;min-height:44px;align-content:center}.mdk-settingshelp summary:focus-visible{outline:2px solid var(--mdk-accent);outline-offset:2px}.mdk-settingshelp p{line-height:1.6;margin:0 0 10px}@media(max-width:600px){.mdk-settings{grid-template-columns:minmax(0,1fr)}.mdk-switchgrid{grid-template-columns:repeat(3,minmax(0,1fr))}.mdk-switchcell{padding:10px 6px}.mdk-switchcell .mdk-fieldhead,.mdk-soundcompact .mdk-soundrow{flex-direction:column;gap:4px}.mdk-switchcell .mdk-label{font-size:12px;min-height:38px;justify-content:center;text-align:center}.mdk-switchcell .mdk-label .mdk-icon{width:15px;height:15px}.mdk-soundcompact .mdk-soundtitle{justify-content:center;align-content:center;min-height:38px;flex:none;font-size:12px;gap:3px}.mdk-soundcompact .mdk-soundstatus{flex-basis:100%;text-align:center;font-size:10px}.mdk-tuning{padding:0 12px}.mdk-tuning .mdk-volume{gap:7px;flex-wrap:wrap;padding:8px 0}.mdk-tuning .mdk-volume input{flex-basis:80px}.mdk-tuning .mdk-volume .mdk-btn{padding:0 9px}.mdk-settingshelp{padding:0 12px}}',
      '.mdk-rowwrap{position:relative}.mdk-rowtop{padding-right:34px}.mdk-follow{position:absolute;right:5px;top:5px;z-index:1;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary,#62645e);display:grid;place-items:center;cursor:pointer;touch-action:manipulation}.mdk-follow[aria-pressed=true]{color:var(--mdk-accent);background:color-mix(in srgb,var(--mdk-accent) 8%,transparent)}.mdk-follow[aria-pressed=true] .mdk-icon{fill:color-mix(in srgb,var(--mdk-accent) 22%,transparent)}.mdk-follow:focus-visible{outline:2px solid var(--mdk-accent);outline-offset:-3px}.mdk-follow:active{filter:brightness(.8)}.mdk-pending{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,#62645e);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.mdk-rules{grid-column:1/-1;padding:12px 16px}.mdk-rulegrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin-top:6px}.mdk-rule{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 8px;font-size:12px;min-height:44px}.mdk-rule+.mdk-rule{border-left:1px solid var(--mdk-line)}.mdk-rules .mdk-settingshelp{padding:0;border-top:0}@media(max-width:600px){.mdk-rulegrid{grid-template-columns:repeat(2,minmax(0,1fr))}.mdk-rule:nth-child(3){border-left:0}.mdk-rule:nth-child(n+3){border-top:1px solid var(--mdk-line)}}',
      '.mdk-rulegrid{gap:10px;margin-top:12px}.mdk-rule,.mdk-rule+.mdk-rule{padding:8px 12px;border:1px solid var(--dsw-alias-border-l3,rgba(105,91,62,.25));border-radius:11px;background:var(--dsw-alias-bg-layer-2,#f2f1ed);justify-content:flex-start;gap:12px;box-shadow:inset 0 1px rgba(255,255,255,.08)}.mdk-rule>span:first-child{flex:1;line-height:1.5}.mdk-rule .mdk-toggle{flex:none}.mdk-rule:has(input:checked){border-color:color-mix(in srgb,var(--mdk-accent) 46%,var(--mdk-line));background:color-mix(in srgb,var(--mdk-accent) 6%,var(--dsw-alias-bg-layer-1,#fff))}.mdk-rule:focus-within,.mdk-switchcell:focus-within{outline:2px solid var(--mdk-accent);outline-offset:2px}.mdk-rule:last-child{border-style:dashed}.mdk-switchgrid{gap:10px;padding:12px;background:var(--dsw-alias-bg-base,#faf9f6)}.mdk-switchcell,.mdk-switchcell+.mdk-switchcell{padding:10px 12px;border:1px solid var(--dsw-alias-border-l3,rgba(105,91,62,.25));border-radius:11px;background:var(--dsw-alias-bg-layer-1,#fff)}.mdk-switchcell:has(input:checked){border-color:color-mix(in srgb,var(--mdk-accent) 46%,var(--mdk-line));background:color-mix(in srgb,var(--mdk-accent) 6%,var(--dsw-alias-bg-layer-1,#fff))}.mdk-tuning{background:var(--dsw-alias-bg-layer-1,#fff)}@media(max-width:600px){.mdk-rule:nth-child(3),.mdk-rule:nth-child(n+3){border:1px solid var(--dsw-alias-border-l3,rgba(105,91,62,.25))}.mdk-rule:last-child{border-style:dashed}.mdk-rule{gap:6px;padding:6px 9px}.mdk-rulegrid{gap:8px}.mdk-switchgrid{gap:6px;padding:8px}.mdk-switchcell,.mdk-switchcell+.mdk-switchcell{padding:8px 4px}.mdk-switchcell .mdk-label{font-size:11px;gap:3px}.mdk-soundcompact .mdk-soundtitle{font-size:11px}}',
      '.mdk-workbench{flex:1 1 0;min-height:0;height:100%;overflow-y:auto;overscroll-behavior-y:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch}.mdk-workbench>*{flex-shrink:0}.mdk-workbench>.mdk-body{flex:0 0 auto}.mdk-workbench .mdk-detail{min-width:0;overflow:visible}.mdk-workbench{scroll-padding-bottom:max(16px,env(safe-area-inset-bottom))}.mdk-root{min-width:0}.mdk-title,.mdk-grouptitle,.mdk-rowtitle{font-weight:500}.mdk-rowtop,.mdk-rowtitle{min-width:0}',
      '@media(max-width:600px){.mdk-head{position:static;padding:16px;gap:12px}.mdk-title{font-size:18px}.mdk-sub{font-size:12px;line-height:1.6}.mdk-conn{font-size:12px;padding:7px 10px}.mdk-tools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:12px 16px}.mdk-searchbox{grid-column:1/-1;width:100%;min-height:48px}.mdk-search{font-size:16px;min-height:48px}.mdk-tools>.mdk-btn{min-width:0;min-height:44px;padding:6px;font-size:13px;line-height:1.4;white-space:normal}.mdk-filters{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:0 16px 12px;overflow:visible}.mdk-filters .mdk-choice{grid-column:span 2;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:44px;padding:8px;font-size:13px;line-height:1.4;white-space:normal}.mdk-filters .mdk-choice:nth-child(n+4){grid-column:span 3}.mdk-filters .mdk-count{display:inline-block;font-size:12px;padding:1px 5px}.mdk-row{padding:14px;gap:10px}.mdk-rowtop{flex-wrap:wrap;gap:8px;padding-right:44px}.mdk-rowtitle{flex:1 1 100%;font-size:16px;line-height:1.5}.mdk-chip{font-size:12px;max-width:100%;white-space:normal;overflow-wrap:anywhere}.mdk-rowmeta,.mdk-pending,.mdk-hint{font-size:13px;line-height:1.6}.mdk-rowwrap>.mdk-rowacts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 14px;padding:10px 0 12px}.mdk-rowwrap>.mdk-rowacts>.mdk-btn{min-width:0;min-height:44px;font-size:13px;padding:6px;white-space:normal}.mdk-rowwrap>.mdk-rowacts>.mdk-stopnote{grid-column:1/-1}.mdk-switchgrid{grid-template-columns:minmax(0,1fr);gap:8px;padding:10px}.mdk-switchcell,.mdk-switchcell+.mdk-switchcell{padding:10px 12px}.mdk-switchcell .mdk-fieldhead,.mdk-soundcompact .mdk-soundrow{flex-direction:row;gap:12px}.mdk-switchcell .mdk-label{font-size:13px;min-height:44px;justify-content:flex-start;text-align:left}.mdk-soundcompact .mdk-soundtitle{justify-content:flex-start;min-height:44px;font-size:13px}.mdk-soundcompact .mdk-soundstatus{flex-basis:auto;font-size:12px;text-align:left}.mdk-switchcell .mdk-toggle{flex:none}}',
      '.mdk-workbench .mdk-conn{box-shadow:none}.mdk-workbench .mdk-rowwrap{box-shadow:0 2px 8px color-mix(in srgb,var(--dsw-alias-label-primary) 3%,transparent)}.mdk-workbench .mdk-rowwrap:has(.mdk-row[aria-current=true]){box-shadow:none}.mdk-workbench .mdk-filters .mdk-choice{box-shadow:none;background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}.mdk-workbench .mdk-filters .mdk-choice[aria-pressed=true]{background:color-mix(in srgb,var(--mdk-accent) 8%,var(--dsw-alias-bg-layer-1));border-color:color-mix(in srgb,var(--mdk-accent) 25%,var(--mdk-line));color:var(--mdk-accent)}.mdk-workbench .mdk-filters .mdk-count{background:transparent;color:inherit;font-variant-numeric:tabular-nums}.mdk-workbench .mdk-card-files{color:var(--mdk-accent);border-color:var(--mdk-line)}.mdk-workbench .mdk-btn[data-variant=quiet],.mdk-workbench .mdk-rowacts .mdk-btn[data-variant=danger]{background:transparent;border-color:transparent;box-shadow:none}.mdk-workbench .mdk-rowacts{column-gap:10px}.mdk-workbench .mdk-rowwrap>.mdk-rowacts{padding-top:10px;padding-bottom:12px}.mdk-workbench .mdk-card-open[data-variant=primary]{box-shadow:none}.mdk-workbench .mdk-btn[data-variant=quiet]:focus-visible,.mdk-workbench .mdk-btn[data-variant=danger]:focus-visible{outline-offset:-2px}',
      '@media(hover:hover){.mdk-workbench .mdk-btn[data-variant=quiet]:hover:not(:disabled){background:var(--mdk-soft);border-color:transparent;box-shadow:none}.mdk-workbench .mdk-rowacts .mdk-btn[data-variant=danger]:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);box-shadow:none}.mdk-workbench .mdk-filters .mdk-choice:hover:not([aria-pressed=true]){background:var(--mdk-soft)}}',
      '@media(max-width:600px){.mdk-workbench .mdk-rowwrap>.mdk-rowacts{grid-template-columns:repeat(2,minmax(0,1fr))}.mdk-workbench .mdk-rowwrap>.mdk-rowacts>.mdk-btn:only-of-type,.mdk-workbench .mdk-rowwrap>.mdk-rowacts>.mdk-btn:nth-of-type(3):last-of-type{grid-column:1/-1}}',
      '.mdk-workbench .mdk-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;gap:10px}.mdk-workbench .mdk-searchbox{grid-column:auto;min-width:0;min-height:48px}.mdk-workbench .mdk-newsession{min-width:112px;min-height:48px;padding:10px 16px;border-radius:12px;white-space:nowrap;font-size:14px;font-weight:600;box-shadow:0 3px 10px color-mix(in srgb,var(--mdk-accent) 12%,transparent)}.mdk-workbench .mdk-newsession:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}.mdk-workbench .mdk-newsession[data-busy=true]{cursor:progress}.mdk-create-notice{margin:0 24px 12px;padding:10px 12px;border:1px solid var(--mdk-line);border-radius:10px;background:var(--mdk-soft);font-size:13px;line-height:1.6;overflow-wrap:anywhere}.mdk-create-notice[role=alert]{color:var(--dsw-alias-state-error-primary)}',
      '@media(hover:hover){.mdk-workbench .mdk-newsession:hover:not(:disabled){box-shadow:0 4px 14px color-mix(in srgb,var(--mdk-accent) 20%,transparent);filter:brightness(1.04)}}@media(prefers-reduced-motion:no-preference){.mdk-workbench .mdk-btn,.mdk-workbench .mdk-choice{transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease}.mdk-workbench .mdk-btn:active:not(:disabled),.mdk-workbench .mdk-choice:active:not(:disabled){transform:translateY(1px)}}@media(max-width:600px){.mdk-workbench .mdk-tools{padding:12px 16px}.mdk-workbench .mdk-newsession{padding:10px 12px}.mdk-create-notice{margin-inline:16px}}',
    ].join('')

    function ActionIcon({ name }) {
      const paths = {
        newSession: 'M12 5v14M5 12h14',
        open: 'M7 17 17 7M7 7h10v10', refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
        retry: 'M20 7v5h-5M6 7a7 7 0 1 1-1 9', stop: 'M7 7h10v10H7z',
        save: 'M5 4h12l3 3v13H4V4h1m3 0v6h8V4M8 20v-6h8v6', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
        layout: 'M4 5h16v14H4zM12 5v14', settingsEnabled: 'M12 3v9M6 6a9 9 0 1 0 12 0',
        settingsIdle: 'M5 6h14M5 12h14M5 18h9', settingsStatus: 'M3 12h4l3-7 4 14 3-7h4',
        settingsRemote: 'M8 12h8M9 7l-2 0a5 5 0 0 0 0 10h2m6-10h2a5 5 0 0 1 0 10h-2',
        star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
        volume: 'M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14', mute: 'M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6',
        files: 'M3 7h7l2 2h9v11H3zM3 7V4h7l2 3', bell: 'M6 17h12l-2-3V9a4 4 0 0 0-8 0v5zM10 20h4',
        deck: 'M7 3h10v18H7zM10 6h4M9 14h6l-2 3h-2zM12 9v5m0-5 3 3h-3',
      }
      return h('svg', { className: 'mdk-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false },
        h('path', { d: paths[name] || paths.layout }))
    }

    /** A minimal external store: one snapshot, a subscriber set, guarded publish. */
    function createStore(initial) {
      let snapshot = initial
      let active = true
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        publish(next) {
          if (!active || Object.is(snapshot, next)) return
          snapshot = next
          for (const listener of [...listeners]) listener()
        },
        dispose() {
          active = false
          listeners.clear()
        },
      }
    }

    function formatClock(timestamp) {
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return ''
      try {
        return new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      } catch { return '' }
    }

    function formatDate(timestamp) {
      try {
        return new Date(timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })
      } catch { return '' }
    }

    /** Turn one Remote failure into a branch the page can label honestly. */
    function classifyFailure(failure) {
      const code = failure && typeof failure.code === 'string' ? failure.code : ''
      const text = failure && typeof failure.message === 'string' ? failure.message : code
      if (/unauth|forbidden|login|401|403|auth/i.test(code + ' ' + text)) return { kind: 'auth', text: text || 'auth' }
      return { kind: 'error', text: text || code || 'unknown' }
    }

    // The host owns this tab strip; scope the compatibility rule to its public marker.
    // Install at plugin activation, not inside SettingsPage (the last tab may be unreachable).
    const PLUGIN_TABS_CSS = `
@media(max-width:819px){
  [data-plugin-header-part="tabs"]{flex:1 1 100%!important;min-width:0!important;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;pointer-events:auto!important;scrollbar-width:thin;scroll-padding-inline:8px;-webkit-app-region:no-drag}
  [data-plugin-header-part="tabs"]>[role="tablist"]{width:max-content!important;min-width:max-content!important;max-width:none;flex:0 0 auto}
  [data-plugin-header-part="tabs"] [role="tab"]{white-space:nowrap;min-width:max-content;min-height:44px;flex-shrink:0;-webkit-app-region:no-drag;touch-action:pan-x pan-y}
}
`

    function apply(ctx) {
      let stopBrowsing = () => {}
      /** Keep touch navigation in reading mode until the user targets the composer. */
      function prepareConversationBrowsing() {
        stopBrowsing()
        if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return
        const isComposer = target => target && typeof target.closest === 'function' && target.closest('[data-composer-input]')
        const dismissAutomaticFocus = event => {
          if (isComposer(event.target)) event.target.blur()
        }
        const beginTyping = event => {
          if (isComposer(event.target)) stopBrowsing()
        }
        const navigateKeyboard = event => {
          if (event.key === 'Tab') stopBrowsing()
        }
        stopBrowsing = () => {
          document.removeEventListener('focusin', dismissAutomaticFocus, true)
          document.removeEventListener('pointerdown', beginTyping, true)
          document.removeEventListener('mousedown', beginTyping, true)
          document.removeEventListener('keydown', navigateKeyboard, true)
          stopBrowsing = () => {}
        }
        document.addEventListener('focusin', dismissAutomaticFocus, true)
        document.addEventListener('pointerdown', beginTyping, true)
        document.addEventListener('mousedown', beginTyping, true)
        document.addEventListener('keydown', navigateKeyboard, true)
        const focused = document.activeElement
        if (isComposer(focused)) focused.blur()
      }
      ctx.effect(() => () => stopBrowsing(), 'mobile-deck: conversation browsing focus')
      ctx.effect(() => {
        const style = document.createElement('style')
        style.dataset.mobileDeckPluginTabs = 'true'
        style.textContent = PLUGIN_TABS_CSS
        document.head.appendChild(style)
        const revealFocusedTab = event => {
          const tab = event.target && typeof event.target.closest === 'function' && event.target.closest('[data-plugin-header-part="tabs"] [role="tab"]')
          if (tab && typeof tab.scrollIntoView === 'function' && window.matchMedia && window.matchMedia('(max-width:819px)').matches) tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
        }
        document.addEventListener('focusin', revealFocusedTab)
        return () => { style.remove(); document.removeEventListener('focusin', revealFocusedTab) }
      }, 'mobile-deck: mobile plugin tab scrolling')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mobile-deck: dictionaries')
      const t = ctx.locale.bind(NS)

      const settings = createStore({ phase: 'loading', enabled: true, layout: 'auto', idleLimit: 8, error: null })
      const freshness = createStore({ lastSyncAt: 0, refreshing: false, lastError: null })
      const stops = createStore({})
      let savedSound = { enabled: false, volume: .65 }
      try {
        const value = JSON.parse(window.localStorage.getItem(SOUND_KEY) || 'null')
        if (value && typeof value.enabled === 'boolean') savedSound.enabled = value.enabled
        if (value && typeof value.volume === 'number' && Number.isFinite(value.volume)) savedSound.volume = Math.min(1, Math.max(.1, value.volume))
      } catch (_) { /* unavailable or damaged browser storage uses defaults */ }
      const activity = createStore({ items: [], sound: savedSound.enabled, volume: savedSound.volume, soundReady: false, soundBusy: false, error: '', storageError: '' })
      const fileNotice = createStore('')
      const creation = createStore({ busy: false, error: '', sessionId: null })
      const historyEpoch = createStore(0)
      let initialMobileHome = false
      try { initialMobileHome = window.localStorage.getItem(HOME_KEY) === 'true' } catch (_) { /* storage may be blocked */ }
      const devicePreferences = createStore({ mobileHome: initialMobileHome, error: '' })
      let startupHandled = false
      let startupNavigationChanged = false
      let initialPanel
      try { initialPanel = ctx.layout.panelInfo && ctx.layout.panelInfo.getSnapshot().activePanelId } catch (_) { /* optional host read face */ }
      function saveMobileHome(value) {
        try {
          window.localStorage.setItem(HOME_KEY, String(value))
          devicePreferences.publish({ mobileHome: value, error: '' })
        } catch (_) { devicePreferences.publish({ ...devicePreferences.getSnapshot(), error: t('mobileHomeFailed') }) }
      }
      function enterMobileHome() {
        if (startupHandled || settings.getSnapshot().phase !== 'ready' || ctx.sessions.list.getSnapshot().phase !== 'ready') return
        startupHandled = true
        if (settings.getSnapshot().error) return
        if (!initialMobileHome || !settings.getSnapshot().enabled || startupNavigationChanged) return
        if (!window.matchMedia || !window.matchMedia('(max-width: 819px) and (pointer: coarse)').matches) return
        const url = new URL(window.location.href)
        if (url.hash || [...url.searchParams.keys()].some(key => /session|resource|path|panel/i.test(key))) return
        if (!ctx.layout.panelInfo) return
        const panel = ctx.layout.panelInfo.getSnapshot().activePanelId
        if (panel != null && panel !== 'conversation') return
        try { ctx.layout.selectPanel(PANEL_ID) } catch (error) { console.warn('mobile-deck: mobile startup navigation unavailable', error) }
      }
      let audio = null
      let audioRequest = 0
      let audioTimer = null
      let cancelActivation = null
      const activeTones = new Set()
      let cancelFileOpen = null
      let initialRules = { followed: [], question: true, approval: true, ended: true, onlyFollowed: false, error: '' }
      try {
        const value = JSON.parse(window.localStorage.getItem(RULES_KEY) || 'null')
        if (value && Array.isArray(value.followed)) initialRules.followed = [...new Set(value.followed.filter(id => typeof id === 'string' && id.length > 0 && id.length < 512))].slice(0, 200)
        for (const key of ['question', 'approval', 'ended', 'onlyFollowed']) if (value && typeof value[key] === 'boolean') initialRules[key] = value[key]
      } catch (_) { /* missing or damaged device preferences use defaults */ }
      const legacyRules = initialRules
      const alertRules = createStore({ followed: [], question: true, approval: true, ended: true, onlyFollowed: false, ready: false, saving: false, initialized: false, error: '' })
      let rulesEpoch = 0
      let rulesQueue = Promise.resolve()
      let rulesPending = 0
      async function rulesCall(payload) {
        const answer = await ctx.connection.rpc.call('/api', 'mobile-deck/rules', payload)
        if (!answer || answer.ok !== true) throw new Error(answer?.error?.message || t('rulesFailed'))
        if (!Array.isArray(answer.value?.followed)) throw new Error(t('rulesFailed'))
        return answer.value
      }
      async function refreshRules() {
        if (!active || alertRules.getSnapshot().saving) return
        const epoch = ++rulesEpoch
        try {
          const value = await rulesCall({ action: 'get' })
          if (active && epoch === rulesEpoch) alertRules.publish({ ...value, ready: true, saving: false, error: '' })
        } catch (error) {
          if (active && epoch === rulesEpoch) alertRules.publish({ ...alertRules.getSnapshot(), ready: false, error: t('rulesFailed') })
        }
      }
      function saveRules(patch, action = 'save') {
        if (!alertRules.getSnapshot().ready) return
        ++rulesEpoch
        rulesPending++
        alertRules.publish({ ...alertRules.getSnapshot(), saving: true, error: '' })
        rulesQueue = rulesQueue.then(async () => {
          if (!active) return
          try {
            const value = await rulesCall({ action, ...(action === 'follow' ? patch : { rules: patch }) })
            rulesPending--
            if (active) alertRules.publish({ ...value, ready: true, saving: rulesPending > 0, error: '' })
          } catch (error) {
            rulesPending--
            if (active) alertRules.publish({ ...alertRules.getSnapshot(), saving: rulesPending > 0, error: t('rulesFailed') })
          }
        })
      }
      function toggleFollow(id) {
        const value = alertRules.getSnapshot()
        if (value.saving) return
        if (!value.followed.includes(id) && value.followed.length >= 200) { alertRules.publish({ ...value, error: t('followLimit') }); return }
        saveRules({ sessionId: id, followed: !value.followed.includes(id) }, 'follow')
      }
      function shouldAlert(item) {
        const rules = alertRules.getSnapshot()
        return rules.ready && rules[item.kind] !== false && (!rules.onlyFollowed || rules.followed.includes(item.sessionId))
      }
      function pendingContext(status) {
        const pending = status && status.pendingInteraction
        if (!pending) return ''
        const trim = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 180) : ''
        if (pending.kind === 'approval') return [trim(pending.toolName), trim(pending.reason)].filter(Boolean).join(' · ') || t('pendingMissing')
        if (Array.isArray(pending.questions)) return pending.questions.map(item => trim(item && item.question)).filter(Boolean).join(' · ').slice(0, 180) || t('pendingMissing')
        return t('pendingMissing')
      }
      const reviewedFailures = createStore({})
      const failureRecords = createStore({})
      const observed = new Map()
      let activitySeq = 0

      function pendingLabel(status) {
        const kind = status && status.pendingInteraction && status.pendingInteraction.kind
        return t(kind === 'approval' ? 'stateApproval' : kind === 'plan-review' ? 'reviewNeeded' : kind === 'question' ? 'stateQuestion' : 'stateAttention')
      }
      function visibleItems() {
        const catalog = ctx.sessions.list.getSnapshot()
        const statuses = ctx.uiSession.sessionStatus.getSnapshot()
        return catalog.ids.map(id => ({ row: catalog.byId[id], status: statuses.get ? statuses.get(id) : statuses[id] }))
          .filter(item => item.row && !item.row.blank && item.row.origin !== 'subagent')
      }
      function attentionCount() {
        return visibleItems().filter(({ status }) => status && (status.pendingInteraction || status.completionUnread)).length
      }
      function persistSound() {
        const value = activity.getSnapshot()
        try {
          window.localStorage.setItem(SOUND_KEY, JSON.stringify({ enabled: value.sound, volume: value.volume }))
          activity.publish({ ...activity.getSnapshot(), storageError: '' })
        } catch (_) { activity.publish({ ...activity.getSnapshot(), storageError: t('soundStorage') }) }
      }
      function stopTones() {
        for (const tone of activeTones) { try { tone.stop() } catch (_) { /* already ended */ } }
        activeTones.clear()
      }
      function muteSound() {
        audioRequest++
        if (cancelActivation) { cancelActivation(); cancelActivation = null }
        if (audioTimer) { clearTimeout(audioTimer); audioTimer = null }
        stopTones()
        activity.publish({ ...activity.getSnapshot(), sound: false, soundReady: false, soundBusy: false, error: '' })
        persistSound()
      }
      async function activateSound(preview = true) {
        const request = ++audioRequest
        if (cancelActivation) { cancelActivation(); cancelActivation = null }
        if (audioTimer) clearTimeout(audioTimer)
        activity.publish({ ...activity.getSnapshot(), sound: true, soundBusy: true, error: '' })
        persistSound()
        try {
          const Audio = window.AudioContext || window.webkitAudioContext
          if (!Audio) throw new Error('unsupported')
          if (!audio || audio.state === 'closed') {
            audio = new Audio()
            audio.onstatechange = () => {
              if (!active) return
              const value = activity.getSnapshot()
              activity.publish({ ...value, soundReady: value.sound && audio.state === 'running' })
            }
          }
          // Call resume directly from the user's gesture; never auto-play on page load.
          const resumed = audio.resume()
          await Promise.race([resumed, new Promise(resolve => { cancelActivation = resolve }), new Promise((_, reject) => {
            audioTimer = setTimeout(() => reject(new Error('audio activation timed out')), 3000)
          })])
          if (!active || request !== audioRequest || !activity.getSnapshot().sound) return
          if (audio.state !== 'running') throw new Error('audio remains suspended')
          activity.publish({ ...activity.getSnapshot(), soundReady: true, soundBusy: false, error: '' })
          if (preview) chime()
        } catch (_) {
          if (active && request === audioRequest) activity.publish({ ...activity.getSnapshot(), soundReady: false, soundBusy: false, error: t('soundFailed') })
        } finally {
          if (request === audioRequest) {
            cancelActivation = null
            if (audioTimer) { clearTimeout(audioTimer); audioTimer = null }
          }
        }
      }
      function chime() {
        const value = activity.getSnapshot()
        if (!active || !value.sound || !audio || audio.state !== 'running') return
        try {
          for (const [offset, frequency] of [[0, 740], [.17, 988]]) {
            const tone = audio.createOscillator(), volume = audio.createGain()
            const at = audio.currentTime + offset
            tone.type = 'sine'; tone.frequency.value = frequency
            volume.gain.setValueAtTime(0, at)
            volume.gain.linearRampToValueAtTime(.28 * value.volume, at + .015)
            volume.gain.exponentialRampToValueAtTime(.001, at + .17)
            tone.connect(volume); volume.connect(audio.destination)
            activeTones.add(tone)
            tone.onended = () => { activeTones.delete(tone); tone.disconnect(); volume.disconnect() }
            tone.start(at); tone.stop(at + .19)
          }
        } catch (_) {
          stopTones()
          activity.publish({ ...activity.getSnapshot(), soundReady: false, error: t('soundFailed') })
        }
      }
      function recordActivity(baseline = false) {
        if (!active || settings.getSnapshot().enabled === false || ctx.connection.state.getSnapshot() !== 'connected') return
        const ids = new Set(), additions = []
        for (const { row, status } of visibleItems()) {
          ids.add(row.id)
          const previous = observed.get(row.id)
          const pending = status && status.pendingInteraction
          const unread = Boolean(status && status.completionUnread)
          if (!baseline) {
            if (pending && (!previous || previous.pending !== pending.key)) additions.push({ id: ++activitySeq, sessionId: row.id, title: row.displayTitle || row.title || row.id, kind: pending.kind === 'approval' ? 'approval' : 'question', label: pendingLabel(status), at: Date.now() })
            if (unread && (!previous || !previous.unread)) additions.push({ id: ++activitySeq, sessionId: row.id, title: row.displayTitle || row.title || row.id, kind: 'ended', label: t('ended'), at: Date.now() })
          }
          observed.set(row.id, { pending: pending && pending.key, unread })
        }
        for (const id of observed.keys()) if (!ids.has(id)) observed.delete(id)
        if (additions.length) {
          const notifications = additions.filter(shouldAlert)
          activity.publish({ ...activity.getSnapshot(), items: [...additions.reverse(), ...activity.getSnapshot().items].slice(0, 30),
            announcement: notifications.length ? notifications.at(-1).label + ' · ' + notifications.at(-1).title : activity.getSnapshot().announcement || '' })
          if (notifications.length) chime()
        }
      }
      function openFiles(id) {
        if (cancelFileOpen) cancelFileOpen()
        fileNotice.publish('')
        const sidebar = ctx.sidebarRight
        if (!sidebar || !sidebar.mounted || typeof sidebar.openTab !== 'function') {
          fileNotice.publish(t('filesUnsupported')); return
        }
        let disposed = false, unsubscribe = null, timer = null, frame = null
        const cleanup = () => { disposed = true; if (unsubscribe) unsubscribe(); if (timer) clearTimeout(timer); if (frame !== null) cancelAnimationFrame(frame); cancelFileOpen = null }
        cancelFileOpen = cleanup
        const attempt = () => {
          if (disposed || !active || sidebar.mounted.getSnapshot() !== id) return
          cleanup()
          try { sidebar.openTab('files', { destination: 'sidebar' }) } catch (error) { fileNotice.publish(t('filesFailed', { message: String(error.message || error) })) }
        }
        try {
          const schedule = () => {
            if (disposed || frame !== null) return
            frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { frame = null; attempt() }) })
          }
          unsubscribe = sidebar.mounted.subscribe(schedule)
          openSession(id)
          // Opening a new session may mint its native sidebar store after React commits.
          timer = setTimeout(() => { cleanup(); fileNotice.publish(t('filesFailed', { message: t('filesNotReady') })) }, 5000)
          schedule()
        } catch (error) { cleanup(); fileNotice.publish(t('filesFailed', { message: String(error.message || error) })) }
      }

      let active = true
      let lastAttempt = 0
      let disposePanel = null

      function relativeTime(timestamp) {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return ''
        const delta = Math.max(0, Date.now() - timestamp)
        const minute = 60000
        const hour = 60 * minute
        if (delta < minute) return t('relNow')
        if (delta < hour) return t('relMinutes', { n: Math.floor(delta / minute) })
        if (delta < 24 * hour) return t('relHours', { n: Math.floor(delta / hour) })
        const days = Math.floor(delta / (24 * hour))
        if (days === 1) return t('relYesterday')
        if (days < 30) return t('relDays', { n: days })
        return formatDate(timestamp)
      }

      function callHost(payload) {
        return ctx.connection.rpc.call('/api', ENDPOINT, payload).then(answer => {
          if (!answer || answer.ok !== true) throw classifyFailure(answer && answer.error)
          return answer.value
        })
      }

      function normalizeSettings(value) {
        const source = value && typeof value === 'object' ? value : {}
        return {
          phase: 'ready',
          enabled: source.enabled !== false,
          layout: LAYOUTS.includes(source.layout) ? source.layout : 'auto',
          idleLimit: Number.isFinite(source.idleLimit) ? Math.min(30, Math.max(1, Math.round(source.idleLimit))) : 8,
          error: null,
        }
      }

      function markSynced() {
        const snapshot = freshness.getSnapshot()
        const now = Date.now()
        if (now - snapshot.lastSyncAt < 1000) return
        freshness.publish({ ...snapshot, lastSyncAt: now, lastError: null })
      }

      /** Resync the Host-authoritative list, carrying failures into the banner. */
      async function refreshSessions() {
        if (!active) return
        lastAttempt = Date.now()
        freshness.publish({ ...freshness.getSnapshot(), refreshing: true })
        try {
          await Promise.all([ctx.sessions.refresh(), refreshRules()])
          if (!active) return
          freshness.publish({ ...freshness.getSnapshot(), refreshing: false, lastError: null })
          markSynced()
        } catch (error) {
          if (!active) return
          freshness.publish({
            ...freshness.getSnapshot(),
            refreshing: false,
            lastError: String((error && error.message) || error),
          })
        }
      }

      function setStop(id, next) {
        const copy = { ...stops.getSnapshot() }
        if (next === null) delete copy[id]
        else copy[id] = next
        stops.publish(copy)
      }

      /**
       * Run one Session verb on a short-lived reference. The native view owns the
       * long-lived reference; this page borrows one only for the call.
       */
      async function withSession(id, run) {
        const existing = ctx.sessions.binding(id)
        if (existing) return run(existing.session)
        if (typeof ctx.sessions.retain !== 'function') throw new Error(t('stopUnsupported'))
        const reference = ctx.sessions.retain(id, { source: 'mobileDeck' })
        try {
          await reference.ready
          return await run(reference.binding.session)
        } finally {
          try { reference.release() } catch (_) { /* the generation may already be gone */ }
        }
      }

      /** Ask the Host to cancel; report only what the refreshed Host row confirms. */
      async function requestStop(id) {
        if (stops.getSnapshot()[id]) return
        setStop(id, { phase: 'requesting' })
        let result
        try {
          result = await withSession(id, session => session.cancel())
        } catch (error) {
          setStop(id, { phase: 'error', text: String((error && error.message) || error) })
          return
        }
        if (!result || result.ok !== true) {
          const failure = classifyFailure(result && result.error)
          setStop(id, { phase: 'error', text: failure.text || t('stopUnknown') })
          return
        }
        setStop(id, { phase: 'stopping' })
        await refreshSessions()
        if (!active) return
        const row = ctx.sessions.list.getSnapshot().byId[id]
        setStop(id, row && row.running === false ? { phase: 'stopped' } : { phase: 'stopping' })
      }

      function revealConversation() {
        try { ctx.layout.selectPanel(null) } catch (error) {
          console.warn('mobile-deck: could not reveal the native conversation', error)
        }
      }

      function openSession(id) {
        prepareConversationBrowsing()
        try { ctx.uiWorkspace.openSession(id) } catch (error) {
          stopBrowsing()
          console.warn('mobile-deck: could not open the session', error)
          return
        }
        revealConversation()
      }

      async function startSession(cwd) {
        const previous = creation.getSnapshot()
        if (previous.busy) return
        creation.publish({ ...previous, busy: true, error: '' })
        stopBrowsing()
        let sessionId = previous.sessionId
        try {
          const navigation = ctx.layout.beginNavigation()
          if (!sessionId) sessionId = await ctx.sessions.create(cwd ? { cwd } : {})
          if (!active) return
          if (navigation.aborted || !settings.getSnapshot().enabled) {
            creation.publish({ busy: false, error: '', sessionId })
            return
          }
          ctx.uiWorkspace.openSession(sessionId)
          revealConversation()
          creation.publish({ busy: false, error: '', sessionId: null })
        } catch (error) {
          if (active) creation.publish({ busy: false, sessionId, error: t('createFailed', { message: String(error.message || error) }) })
        }
      }

      async function saveSettings(patch) {
        const before = settings.getSnapshot()
        settings.publish({ ...before, phase: 'saving', error: null })
        try {
          const next = normalizeSettings(await callHost({ action: 'save', settings: patch }))
          if (!active) return null
          settings.publish(next)
          syncPanelRegistration(next.enabled)
          return next
        } catch (error) {
          if (!active) return null
          settings.publish({ ...before, phase: 'ready', error: (error && error.text) || t('unknownError') })
          return null
        }
      }

      // ---------------------------------------------------------- UI primitives

      function useStore(store) {
        return React.useSyncExternalStore(store.subscribe, store.getSnapshot)
      }

      function useWideEnough() {
        const read = () => {
          if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
          return window.matchMedia(WIDE_QUERY).matches
        }
        const [wide, setWide] = React.useState(read)
        React.useEffect(() => {
          if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
          const query = window.matchMedia(WIDE_QUERY)
          const update = () => setWide(query.matches)
          update()
          if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', update)
            return () => query.removeEventListener('change', update)
          }
          if (typeof query.addListener === 'function') {
            query.addListener(update)
            return () => query.removeListener(update)
          }
          return undefined
        }, [])
        return wide
      }

      function ConnectionChip() {
        const state = useStore(ctx.connection.state)
        const fresh = useStore(freshness)
        const mode = state === 'connected' ? 'connected'
          : state === 'connecting' ? 'connecting'
            : state === 'disconnected' ? 'disconnected' : 'unknown'
        const label = mode === 'connected' ? t('connConnected')
          : mode === 'connecting' ? t('connConnecting')
            : mode === 'disconnected' ? t('connDisconnected') : t('connUnknown')
        const detail = fresh.lastSyncAt ? t('lastSync', { time: formatClock(fresh.lastSyncAt) }) : t('neverSynced')
        return h('div', { className: 'mdk-conn', 'data-state': mode, role: 'status', 'aria-live': 'polite' },
          h('span', { className: 'mdk-dot', 'aria-hidden': 'true' }),
          h('span', null, label + ' · ' + detail))
      }

      /** One row: a large tap target plus its own quick actions, never hover-only. */
      function SessionCard(props) {
        const { row, status, selected, onSelect, onOpen, twoPane } = props
        const stopMap = useStore(stops)
        const rules = useStore(alertRules)
        const followed = rules.followed.includes(row.id)
        const stop = stopMap[row.id]
        const running = row.running === true || Boolean(status && status.running === true)
        const waiting = Boolean(status && status.pendingInteraction)
        const phase = waiting ? 'waiting' : running ? 'running' : 'idle'
        const chip = waiting ? pendingLabel(status)
          : running ? t('stateRunning')
            : status && status.completionUnread ? t('stateUnread') : t('stateIdle')
        const meta = []
        if (row.cwd) meta.push(String(row.cwd).split(/[\\/]/).filter(Boolean).pop() || row.cwd)
        if (row.updatedAt) {
          const text = relativeTime(row.updatedAt)
          if (text) meta.push(text)
        }
        return h('div', { className: 'mdk-rowwrap', 'data-followed': followed },
          h('button', { type: 'button', className: 'mdk-follow', disabled: !rules.ready || rules.saving, 'aria-pressed': followed,
            'aria-label': t(followed ? 'unfollow' : 'follow') + ' ' + (row.displayTitle || row.id), title: t(followed ? 'unfollow' : 'follow'), onClick: () => toggleFollow(row.id) }, h(ActionIcon, { name: 'star' })),
          h('button', {
            type: 'button',
            className: 'mdk-row',
            'aria-current': selected ? 'true' : undefined,
            onClick: () => { onSelect(row.id); if (!twoPane) onOpen(row.id) },
            onFocus: () => onSelect(row.id),
          },
            h('span', { className: 'mdk-rowtop' },
              h('span', { className: 'mdk-rowtitle' }, row.displayTitle || row.title || row.id),
              h('span', { className: 'mdk-chip', 'data-state': phase }, chip)),
            waiting ? h('span', { className: 'mdk-pending' }, pendingContext(status)) : null,
            meta.length ? h('span', { className: 'mdk-rowmeta' }, meta.map((text, index) => h('span', { key: index }, text))) : null),
          h('div', { className: 'mdk-rowacts' },
            waiting ? h('button', {
              type: 'button', className: 'mdk-btn mdk-card-open', 'data-variant': 'primary',
              'aria-label': t('handleRequest') + ' ' + (row.displayTitle || row.id), onClick: () => onOpen(row.id),
            }, h(ActionIcon, { name: 'open' }), t('handleRequest')) : null,
            h('button', { type: 'button', className: 'mdk-btn mdk-card-files', 'aria-label': t('files') + ' ' + (row.displayTitle || row.id), onClick: () => openFiles(row.id) }, h(ActionIcon, { name: 'files' }), t('files')),
            running
              ? h('button', {
                type: 'button',
                className: 'mdk-btn',
                'data-variant': 'danger',
                disabled: Boolean(stop) && stop.phase !== 'stopped' && stop.phase !== 'error',
                onClick: () => { void requestStop(row.id) },
              }, h(ActionIcon, { name: 'stop' }), stop && stop.phase === 'requesting' ? t('stopping') : t('stop'))
              : null,
            stop
              ? h('span', {
                className: 'mdk-stopnote',
                'data-kind': stop.phase === 'error' ? 'error' : undefined,
                role: 'status',
              }, stop.phase === 'error'
                ? t('stopFailed', { message: stop.text })
                : stop.phase === 'stopped' ? t('stopped')
                  : stop.phase === 'stopping' ? t('stopPending') : t('stopping'))
              : null))
      }


      function SoundControls({ detailed = false, compact = false, tuningOnly = false }) {
        const value = useStore(activity)
        const status = !value.sound ? 'soundMuted' : value.soundBusy ? 'soundBusy' : value.soundReady ? 'soundReady' : 'soundWaiting'
        return h('div', { className: 'mdk-sound' + (compact ? ' mdk-soundcompact' : '') },
          !tuningOnly ? h('div', { className: 'mdk-soundrow' },
            h('div', { className: 'mdk-soundtitle' }, h(ActionIcon, { name: value.sound ? 'volume' : 'mute' }),
              h('span', null, t('soundLabel')), h('span', { className: 'mdk-soundstatus', role: 'status' }, t(status))),
            h('label', { className: 'mdk-toggle' }, h('input', { type: 'checkbox', role: 'switch', checked: value.sound,
              'aria-label': t('soundLabel'), onChange: event => { if (event.target.checked) { void activateSound() } else muteSound() } })),
            !compact ? h('button', { type: 'button', className: 'mdk-btn', disabled: value.soundBusy, onClick: () => { void activateSound() } }, t(value.sound ? 'soundTest' : 'soundTestEnable')) : null) : null,
          detailed ? h('div', { className: 'mdk-volume', role: 'group', 'aria-label': t('soundVolume') }, h('span', null, t('soundVolume')),
            h('input', { type: 'range', min: 10, max: 100, step: 5, value: Math.round(value.volume * 100), 'aria-label': t('soundVolume'),
              onChange: event => { activity.publish({ ...activity.getSnapshot(), volume: Number(event.target.value) / 100 }); persistSound() } }),
            h('output', null, Math.round(value.volume * 100) + '%'),
            tuningOnly ? h('button', { type: 'button', className: 'mdk-btn', disabled: value.soundBusy, onClick: () => { void activateSound() } }, t(value.sound ? 'soundTest' : 'soundTestEnable')) : null) : null,
          detailed && !tuningOnly ? h('p', { className: 'mdk-hint' }, t('soundHint')) : null,
          !compact && value.error ? h('p', { role: 'alert', className: 'mdk-hint' }, value.error) : null,
          !compact && value.storageError ? h('p', { role: 'status', className: 'mdk-hint' }, value.storageError) : null)
      }

      function AlertRuleControls() {
        const rules = useStore(alertRules)
        return h('div', { className: 'mdk-field mdk-rules' },
          h('div', { className: 'mdk-fieldhead' }, h('div', { className: 'mdk-label' }, h(ActionIcon, { name: 'bell' }), t('rulesTitle')),
            h('button', { type: 'button', className: 'mdk-btn', disabled: !rules.ready || rules.saving || !rules.followed.length, onClick: () => saveRules({ followed: [] }) }, t('clearFollowed'), ' · ', rules.followed.length)),
          h('div', { className: 'mdk-rulegrid' }, [['question', 'ruleQuestion'], ['approval', 'ruleApproval'], ['ended', 'ruleEnded'], ['onlyFollowed', 'ruleOnlyFollowed']].map(([key, label]) =>
            h('label', { key, className: 'mdk-rule' }, h('span', null, t(label)), h('span', { className: 'mdk-toggle' },
              h('input', { type: 'checkbox', role: 'switch', checked: rules[key], disabled: !rules.ready, 'aria-label': t(label), onChange: event => saveRules({ [key]: event.target.checked }) }))))),
          h('p', { className: 'mdk-hint' }, t('rulesSync')),
          !rules.initialized && (legacyRules.followed.length || Object.keys(legacyRules).some(key => ['question','approval','ended'].includes(key) && legacyRules[key] === false) || legacyRules.onlyFollowed) ? h('button', { className: 'mdk-btn', disabled: !rules.ready || rules.saving, onClick: () => saveRules(legacyRules, 'import') }, t('importRules')) : null,
          h('details', { className: 'mdk-settingshelp' }, h('summary', null, t('settingsHelp')), h('p', null, t('rulesHint')), h('p', null, t('pushUnavailable'))),
          rules.error ? h('p', { role: 'alert', className: 'mdk-hint' }, rules.error) : null)
      }

      function DetailPane(props) {
        const { row, status } = props
        if (!row) {
          return h('aside', { className: 'mdk-detail', 'aria-label': t('detailTitle') },
            h('div', { className: 'mdk-card' }, h('div', { className: 'mdk-v' }, t('previewNone'))))
        }
        const running = row.running === true || Boolean(status && status.running === true)
        const waiting = Boolean(status && status.pendingInteraction)
        const chip = waiting ? pendingLabel(status)
          : running ? t('stateRunning')
            : status && status.completionUnread ? t('stateUnread') : t('stateIdle')
        return h('aside', { className: 'mdk-detail', 'aria-label': t('detailTitle') },
          h('div', { className: 'mdk-card' },
            h('div', { className: 'mdk-k' }, t('detailTitle')),
            h('div', { className: 'mdk-v' }, row.displayTitle || row.title || row.id),
            h('div', { className: 'mdk-v' },
              h('span', { className: 'mdk-chip', 'data-state': waiting ? 'waiting' : running ? 'running' : 'idle' }, chip))),
          row.cwd
            ? h('div', { className: 'mdk-card' },
              h('div', { className: 'mdk-k' }, t('detailWorkspace')),
              h('div', { className: 'mdk-v mdk-mono' }, row.cwd))
            : null,
          h('div', { className: 'mdk-card' },
            h('div', { className: 'mdk-k' }, t('detailUpdated')),
            h('div', { className: 'mdk-v' },
              row.updatedAt ? relativeTime(row.updatedAt) + ' · ' + formatClock(row.updatedAt) : '—'),
            h('div', { className: 'mdk-k', style: { marginTop: 10 } }, t('detailId')),
            h('div', { className: 'mdk-v mdk-mono' }, row.id)),
          h('div', { className: 'mdk-card' },
            h('div', { className: 'mdk-k' }, t('detailTakeover')),
            h('div', { className: 'mdk-v' }, t('takeoverBody')),
            h('div', { className: 'mdk-v' }, t('detailOpenHint'))),
          h('div', { className: 'mdk-rowacts', style: { marginTop: 12 } },
            h('button', {
              type: 'button', className: 'mdk-btn', 'data-variant': 'primary', onClick: () => openSession(row.id),
            }, h(ActionIcon, { name: 'open' }), t('open'))))
      }

      /** Pending interactions stay live; failure history is inspected only while this center is open. */
      function AttentionCenter({ rows, keyword, onSelect, twoPane, selectedId }) {
        const epoch = useStore(historyEpoch)
        const reviewed = useStore(reviewedFailures)
        const [category, setCategory] = React.useState('all')
        const [attempt, setAttempt] = React.useState(0)
        const failures = useStore(failureRecords)
        const setFailures = update => failureRecords.publish(update(failureRecords.getSnapshot()))
        const [scan, setScan] = React.useState({ loading: true, unavailable: 0 })
        const signature = JSON.stringify(rows.map(({row,status}) => [row.id, row.updatedAt, row.running === true || status?.running === true]))
        React.useEffect(() => {
          let disposed = false, release = null
          const candidates = JSON.parse(signature).filter(([, , running]) => !running)
          setScan({ loading: true, unavailable: 0 })
          let unavailable = 0
          ;(async () => {
            for (const [id] of candidates) {
              if (disposed) return
              try {
                if (typeof ctx.sessions.retain !== 'function') throw new Error('Session history unavailable')
                const reference = ctx.sessions.retain(id, { source: 'mobileDeck' })
                let released = false
                const disposeReference = () => { if (!released) { released = true; reference.release() } }
                release = disposeReference
                try {
                  await reference.ready
                  if (disposed) return
                  const current = reference.binding.session?.getSnapshot?.()
                  if (current?.openState === 'error') throw new Error('Session history unavailable')
                  const source = reference.binding.eventSource
                  if (!source) throw new Error('Session history unavailable')
                  const entries = source.getSnapshot().entries.filter(entry => entry.type === 'event').map(entry => entry.event)
                  const latestTurn = entries.reduce((turn, event) => Number.isSafeInteger(event?.data?.turn) ? Math.max(turn, event.data.turn) : turn, 0)
                  const latest = entries.filter(event => event && (event.type === 'turn/start' || event.type === 'turn/end')).sort((a,b) => b.seq - a.seq)[0]
                  setFailures(previous => {
                    const next = { ...previous }
                    if (latest?.type === 'turn/end' && latest.data?.turn === latestTurn && latest.data?.reason?.kind === 'error') next[id] = { key: String(latest.seq), turn: latest.data.turn }
                    else delete next[id]
                    return next
                  })
                } finally { disposeReference(); release = null }
              } catch (error) { if (!disposed) unavailable++ }
            }
            if (!disposed) setScan({ loading: false, unavailable })
          })()
          return () => { disposed = true; if (release) release() }
        }, [signature, epoch, attempt])
        const actions = []
        for (const item of rows) {
          const pending = item.status?.pendingInteraction
          const running = item.row.running === true || item.status?.running === true
          const failure = failures[item.row.id]
          if (pending) actions.push({ ...item, kind: pending.kind === 'approval' ? 'approval' : 'question', key: pending.key })
          else if (!running && failure && reviewed[item.row.id] !== failure.key) actions.push({ ...item, kind: 'failure', key: failure.key })
        }
        const matching = actions.filter(item => (!keyword || [item.row.displayTitle,item.row.title,item.row.cwd].some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(keyword))) && (category === 'all' || item.kind === category))
        return h('section', { className: 'mdk-group mdk-todos', 'data-mobile-todos': '' },
          h('div', { className: 'mdk-grouphead' }, h('h2', { className: 'mdk-grouptitle' }, t('pendingCenter')), h('span', { className: 'mdk-count' }, String(actions.length))),
          h('p', { className: 'mdk-hint' }, t('todoHint')),
          h('div', { className: 'mdk-todofilters', role: 'group', 'aria-label': t('pendingCenter') },
            [['all','todoAll'],['question','todoQuestion'],['approval','todoApproval'],['failure','todoFailure']].map(([value,label]) => h('button', { type: 'button', className: 'mdk-choice', key: value, 'aria-pressed': category === value, onClick: () => setCategory(value) }, t(label), h('span', { className: 'mdk-count' }, String(value === 'all' ? actions.length : actions.filter(item => item.kind === value).length))))),
          scan.loading ? h('p', { className: 'mdk-hint', role: 'status' }, t('todoScan')) : null,
          scan.unavailable ? h('p', { className: 'mdk-hint', role: 'status' }, t('todoPartial', { n: scan.unavailable })) : null,
          !matching.length && !scan.loading ? h('p', { className: 'mdk-hint' }, t('todoEmpty')) : null,
          matching.map(item => item.kind === 'failure'
            ? h('div', { className: 'mdk-todofailure', key: item.row.id, 'data-todo-kind': 'failure' },
              h('div', { className: 'mdk-rowtop' }, h('span', { className: 'mdk-rowtitle' }, item.row.displayTitle || item.row.title || item.row.id), h('span', { className: 'mdk-chip', 'data-state': 'failed' }, t('todoFailure'))),
              h('p', { className: 'mdk-hint' }, t('todoFailureHint')),
              h('div', { className: 'mdk-rowacts' }, h('button', { className: 'mdk-btn', type: 'button', onClick: () => openSession(item.row.id) }, t('todoOpen')),
                h('button', { className: 'mdk-btn', type: 'button', onClick: () => reviewedFailures.publish({ ...reviewedFailures.getSnapshot(), [item.row.id]: item.key }) }, t('todoReview'))))
            : h(SessionCard, { key: item.row.id, row: item.row, status: item.status, selected: selectedId === item.row.id, twoPane, onSelect, onOpen: openSession })),
          h('button', { className: 'mdk-btn', type: 'button', disabled: scan.loading, onClick: () => setAttempt(value => value + 1) }, h(ActionIcon, { name: 'refresh' }), t('todoRecheck')))
      }

      function EmptyState(props) {
        return h('div', { className: 'mdk-empty' },
          h(ActionIcon, { name: 'deck' }),
          h('div', { className: 'mdk-emptytitle' }, props.title),
          props.body ? h('div', { className: 'mdk-emptybody' }, props.body) : null)
      }

      function Workbench() {
        const snapshot = useStore(settings)
        const list = useStore(ctx.sessions.list)
        const statuses = useStore(ctx.uiSession.sessionStatus)
        const fresh = useStore(freshness)
        const connectionState = useStore(ctx.connection.state)
        const wide = useWideEnough()
        const [selectedId, setSelectedId] = React.useState(null)
        const [query, setQuery] = React.useState('')
        const [filter, setFilter] = React.useState('all')
        const knownFailures = useStore(failureRecords)
        const reviewed = useStore(reviewedFailures)
        const events = useStore(activity)
        const fileError = useStore(fileNotice)
        const newConversation = useStore(creation)
        const rules = useStore(alertRules)

        const twoPane = snapshot.layout === 'pad' ? true : snapshot.layout === 'phone' ? false : wide
        const offline = connectionState === 'disconnected'
        const loading = snapshot.phase === 'loading' || list.phase === 'pending'

        const rows = React.useMemo(() => {
          const build = []
          for (const id of list.ids) {
            const row = list.byId[id]
            if (!row) continue
            if (row.origin === 'subagent') continue
            if (row.blank === true) continue
            build.push({ row, status: statuses.get ? statuses.get(id) : statuses[id] })
          }
          build.sort((left, right) => Number(rules.followed.includes(right.row.id)) - Number(rules.followed.includes(left.row.id)) || (right.row.updatedAt || 0) - (left.row.updatedAt || 0))
          return build
        }, [list, statuses, rules.followed])

        const isRunning = item => item.row.running === true || Boolean(item.status && item.status.running === true)
        const isWaiting = item => Boolean(item.status && item.status.pendingInteraction)
        const isTodo = item => isWaiting(item) || !isRunning(item) && knownFailures[item.row.id] && reviewed[item.row.id] !== knownFailures[item.row.id].key
        const keyword = query.trim().toLocaleLowerCase()
        const searched = keyword ? rows.filter(({ row }) =>
          [row.displayTitle, row.title, row.cwd].some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(keyword))) : rows
        const filtered = searched.filter(item => filter === 'followed' ? rules.followed.includes(item.row.id) : filter === 'waiting' ? isWaiting(item) : filter === 'running' ? !isWaiting(item) && isRunning(item) : filter === 'unread' ? Boolean(item.status && item.status.completionUnread) : true)
        const waiting = filtered.filter(isWaiting)
        const running = filtered.filter(item => !isWaiting(item) && isRunning(item))
        const idleRows = filtered.filter(item => !isWaiting(item) && !isRunning(item))
        const idle = [...idleRows.filter(item => rules.followed.includes(item.row.id)), ...idleRows.filter(item => !rules.followed.includes(item.row.id)).slice(0, snapshot.idleLimit)]
        const selected = rows.find(item => item.row.id === selectedId)

        function renderGroup(titleKey, hintKey, items) {
          if (items.length === 0) return null
          return h('section', { className: 'mdk-group', key: titleKey },
            h('div', { className: 'mdk-grouphead' },
              h('h2', { className: 'mdk-grouptitle' }, t(filter === 'waiting' && titleKey === 'groupWaiting' ? 'pendingCenter' : titleKey)),
              h('span', { className: 'mdk-count' }, String(items.length))),

            items.map(item => h(SessionCard, {
              key: item.row.id,
              row: item.row,
              status: item.status,
              selected: selectedId === item.row.id,
              twoPane,
              onSelect: setSelectedId,
              onOpen: openSession,
            })))
        }

        let body
        if (snapshot.enabled === false) {
          body = h(EmptyState, { title: t('disabledTitle'), body: t('disabledBody') })
        } else if (loading && rows.length === 0) {
          body = h(EmptyState, { title: t('loadingTitle') })
        } else if (rows.length === 0) {
          body = h(EmptyState, { title: t('emptyTitle'), body: t('emptyBody') })
        } else if (filter === 'waiting') {
          body = h(AttentionCenter, { rows, keyword, selectedId, onSelect: setSelectedId, twoPane })
        } else if (filtered.length === 0) {
          body = h(EmptyState, { title: t('searchEmpty'), body: t('searchEmptyHint') })
        } else {
          body = h(React.Fragment, null,
            renderGroup('groupWaiting', 'groupWaitingHint', waiting),
            renderGroup('groupRunning', 'groupRunningHint', running),
            renderGroup('groupIdle', 'groupIdleHint', idle))
        }

        let banner = null
        if (offline) {
          banner = h('div', { className: 'mdk-banner', 'data-kind': 'error', role: 'alert' },
            h('div', null, t('staleHint')),
            h('div', { style: { marginTop: 8 } },
              h('button', {
                type: 'button', className: 'mdk-btn', onClick: () => ctx.connection.reconnect(),
              }, h(ActionIcon, { name: 'retry' }), t('retry'))))
        } else if (snapshot.error) {
          banner = h('div', { className: 'mdk-banner', 'data-kind': 'error', role: 'alert' },
            h('div', null, t('saveFailed', { message: snapshot.error })))
        } else if (fresh.lastError) {
          banner = h('div', { className: 'mdk-banner', 'data-kind': 'error', role: 'alert' },
            h('div', null, t('errorTitle') + '：' + fresh.lastError),
            h('div', { style: { marginTop: 8 } },
              h('button', {
                type: 'button', className: 'mdk-btn', disabled: fresh.refreshing,
                onClick: () => { void refreshSessions() },
              }, h(ActionIcon, { name: 'refresh' }), t('refresh'))))
        }

        return h('div', { className: 'mdk-root mdk-pad mdk-workbench', 'data-layout': twoPane ? 'pad' : 'phone' },
          h('style', null, CSS),
          h('header', { className: 'mdk-head' },
            h('div', { className: 'mdk-headtext' },
              h('div', { className: 'mdk-title' }, h(ActionIcon, { name: 'deck' }), t('pageTitle')),
              h('div', { className: 'mdk-sub' }, t('pageHint'))),
            h(ConnectionChip)),
          banner,
          h('div', { className: 'mdk-tools', 'aria-busy': newConversation.busy },
            h('label', { className: 'mdk-searchbox' }, h(ActionIcon, { name: 'search' }), h('input', {
              type: 'search', className: 'mdk-search', value: query,
              placeholder: t('search'), 'aria-label': t('search'),
              onChange: event => setQuery(event.target.value),
            })),
            h('button', {
              type: 'button', className: 'mdk-btn mdk-newsession', 'data-variant': 'primary', disabled: newConversation.busy || offline,
              'data-busy': newConversation.busy, 'aria-description': t('newSessionHint'),
              onClick: () => { void startSession(selected && selected.row.cwd) },
            }, h(ActionIcon, { name: 'newSession' }), t(newConversation.busy ? 'creatingSession' : newConversation.sessionId ? 'openCreated' : 'newSession'))),
          newConversation.error || newConversation.sessionId ? h('div', { className: 'mdk-create-notice', role: newConversation.error ? 'alert' : 'status' }, newConversation.error || t('createdReady')) : null,
          h('div', { className: 'mdk-filters', role: 'group', 'aria-label': t('filterAll') },
            [['all', 'filterAll', rows.length], ['followed', 'filterFollowed', rows.filter(item => rules.followed.includes(item.row.id)).length], ['waiting', 'filterWaiting', rows.filter(isTodo).length], ['running', 'filterRunning', rows.filter(item => !isWaiting(item) && isRunning(item)).length], ['unread', 'filterUnread', rows.filter(item => item.status && item.status.completionUnread).length]].map(([value, key, count]) =>
              h('button', { key: value, type: 'button', className: 'mdk-choice', 'aria-pressed': filter === value, onClick: () => setFilter(value) }, t(key), h('span', { className: 'mdk-count' }, count)))),
          h('div', { className: 'mdk-activity', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, events.announcement || ''),
          fileError || rules.error ? h('div', { className: 'mdk-banner', role: 'alert' }, fileError || rules.error) : null,
          h('details', { className: 'mdk-events' },
            h('summary', null, h(ActionIcon, { name: 'bell' }), t('alerts'), ' · ', events.items.length),

            events.items.length ? events.items.map(item => h('button', { key: item.id, type: 'button', className: 'mdk-event', onClick: () => openSession(item.sessionId) },
              h('span', null, item.label + ' · ' + item.title), h('time', null, formatClock(item.at)))) : h('p', { className: 'mdk-hint' }, t('alertsEmpty'))),
          h('div', { className: 'mdk-body' },
            h('div', { className: 'mdk-list' }, body),
            twoPane ? h(DetailPane, { row: selected && selected.row, status: selected && selected.status }) : null))
      }

      /** One settings surface; it stays available while the workbench itself is off. */
      function SettingsPage() {
        const snapshot = useStore(settings)
        const fresh = useStore(freshness)
        const device = useStore(devicePreferences)
        const [note, setNote] = React.useState({ kind: '', text: '' })
        const [idleDraft, setIdleDraft] = React.useState(String(snapshot.idleLimit))

        React.useEffect(() => { setIdleDraft(String(snapshot.idleLimit)) }, [snapshot.idleLimit])

        async function commit(patch) {
          setNote({ kind: '', text: t('saving') })
          const saved = await saveSettings(patch)
          if (!saved) {
            setNote({ kind: 'error', text: t('saveFailed', { message: settings.getSnapshot().error || t('unknownError') }) })
            return
          }
          setNote({ kind: 'ok', text: t('saved') })
        }

        return h('div', { className: 'mdk-root' },
          h('style', null, CSS),
          h('div', { className: 'mdk-settings' },
            h(AlertRuleControls),
            h('div', { className: 'mdk-field mdk-preferences' },
              h('div', { className: 'mdk-switchgrid' },
                h('div', { className: 'mdk-switchcell' }, h(SoundControls, { compact: true })),
                h('div', { className: 'mdk-switchcell' },
                  h('div', { className: 'mdk-fieldhead' },
                    h('div', { className: 'mdk-label', title: t('mobileHomeHint') }, h(ActionIcon, { name: 'deck' }), t('compactHome')),
                    h('label', { className: 'mdk-toggle' }, h('input', { type: 'checkbox', checked: device.mobileHome, 'aria-label': t('mobileHome'), onChange: event => saveMobileHome(event.target.checked) })))),
                h('div', { className: 'mdk-switchcell' },
                  h('div', { className: 'mdk-fieldhead' },
                    h('div', { className: 'mdk-label', title: t('settingsEnabledHint') }, h(ActionIcon, { name: 'settingsEnabled' }), t('compactEnabled')),
                    h('label', { className: 'mdk-toggle' }, h('input', {
                      type: 'checkbox', checked: snapshot.enabled !== false, disabled: snapshot.phase === 'saving' || snapshot.phase === 'loading',
                      'aria-label': t('settingsEnabled'), onChange: event => { void commit({ enabled: event.target.checked }) },
                    }))))),
              h('div', { className: 'mdk-tuning' }, h(SoundControls, { detailed: true, tuningOnly: true })),
              device.error ? h('p', { role: 'alert', className: 'mdk-hint' }, device.error) : null,
              h('details', { className: 'mdk-settingshelp' }, h('summary', null, t('settingsHelp')),
                h('p', null, t('soundHint')), h('p', null, t('mobileHomeHint')), h('p', null, t('settingsEnabledHint')))),
            h('div', { className: 'mdk-field' },
              h('div', { className: 'mdk-label' }, h(ActionIcon, { name: 'layout' }), t('settingsLayout')),

              h('div', { className: 'mdk-choices', role: 'group', 'aria-label': t('settingsLayout') },
                [['auto', 'layoutAuto'], ['phone', 'layoutPhone'], ['pad', 'layoutPad']].map(pair => h('button', {
                  key: pair[0],
                  type: 'button',
                  className: 'mdk-choice',
                  'aria-pressed': snapshot.layout === pair[0] ? 'true' : 'false',
                  disabled: snapshot.phase === 'saving',
                  onClick: () => { void commit({ layout: pair[0] }) },
                }, t(pair[1]))))),
            h('div', { className: 'mdk-field' },
              h('div', { className: 'mdk-label' }, h(ActionIcon, { name: 'settingsIdle' }), t('settingsIdle')),

              h('div', { className: 'mdk-choices' },
                h('input', {
                  className: 'mdk-num',
                  type: 'number',
                  min: 1,
                  max: 30,
                  value: idleDraft,
                  'aria-label': t('settingsIdle'),
                  onChange: event => setIdleDraft(event.target.value),
                }),
                h('button', {
                  type: 'button',
                  className: 'mdk-btn',
                  disabled: snapshot.phase === 'saving',
                  onClick: () => {
                    const parsed = Number(idleDraft)
                    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 30) {
                      setNote({ kind: 'error', text: t('settingsIdleHint') })
                      return
                    }
                    void commit({ idleLimit: Math.round(parsed) })
                  },
                }, h(ActionIcon, { name: 'save' }), t('save')))),
            h('div', { className: 'mdk-field' },
              h('div', { className: 'mdk-label' }, h(ActionIcon, { name: 'settingsStatus' }), t('settingsStatus')),

              h(ConnectionChip)),
            h('div', { className: 'mdk-field' },
              h('div', { className: 'mdk-label' }, h(ActionIcon, { name: 'settingsRemote' }), t('settingsRemote')),
              h('div', { className: 'mdk-hint', title: t('settingsRemoteHint') }, t('remoteCompact'))),
            note.text
              ? h('div', { className: 'mdk-note', 'data-kind': note.kind || undefined, role: 'status' }, note.text)
              : null,
            h('div', { className: 'mdk-note' },
              fresh.lastSyncAt ? t('lastSync', { time: formatClock(fresh.lastSyncAt) }) : t('neverSynced'))))
      }

      function ComposerEntry() {
        useStore(ctx.sessions.list)
        useStore(ctx.uiSession.sessionStatus)
        const prefs = useStore(settings)
        const fileError = useStore(fileNotice)
        if (!prefs.enabled) return null
        const count = attentionCount()
        return h(React.Fragment, null, h('style', null, CSS),
          h('button', { type: 'button', className: 'mdk-launch', title: t('nav'), 'aria-label': t('nav') + (count ? ' · ' + count : ''), onClick: () => ctx.layout.selectPanel(PANEL_ID) },
            h(ActionIcon, { name: 'deck' }), count ? h('span', { className: 'mdk-launchbadge', 'aria-hidden': true }, count > 99 ? '99+' : count) : null), fileError ? h('span', { className: 'mdk-filemessage', role: 'alert' }, fileError) : null)
      }

      /** Keep the workbench panel available to the composer while enabled. */
      function syncPanelRegistration(enabled) {
        if (!enabled) stopBrowsing()
        if (enabled && !disposePanel) {
          const disposeMain = ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          }, Workbench))
          disposePanel = () => {
            try { disposeMain() } catch (_) { /* already released */ }
          }
          return
        }
        if (!enabled && disposePanel) {
          observed.clear()
          if (cancelFileOpen) cancelFileOpen()
          const dispose = disposePanel
          disposePanel = null
          dispose()
        }
      }

      ctx.effect(() => () => { if (disposePanel) { disposePanel(); disposePanel = null } },
        'mobile-deck: panel registration')

      ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
        name: 'conversation.input.left', id: PANEL_ID, order: 7, label: () => t('nav'), locale: NS,
      }, ComposerEntry))

      ctx.slots.inject('plugins.tab', () => ctx.slots.register({
        name: 'plugins.tab',
        id: PANEL_ID,
        order: 70,
        label: () => t('settingsNav'),
        locale: NS,
      }, SettingsPage))

      ctx.effect(() => {
        if (!ctx.layout.panelInfo || typeof ctx.layout.panelInfo.subscribe !== 'function') return
        return ctx.layout.panelInfo.subscribe(() => {
          if (ctx.layout.panelInfo.getSnapshot().activePanelId !== initialPanel) startupNavigationChanged = true
        })
      }, 'mobile-deck: protect startup navigation')

      ctx.effect(() => {
        let cancelled = false
        void refreshRules()
        callHost({ action: 'get' })
          .then(value => {
            if (cancelled || !active) return
            const next = normalizeSettings(value)
            settings.publish(next)
            syncPanelRegistration(next.enabled)
            enterMobileHome()
          })
          .catch(error => {
            if (cancelled || !active) return
            // A failed read must not silently hide the workbench: keep it on and say so.
            settings.publish({ ...settings.getSnapshot(), phase: 'ready', error: (error && error.text) || t('unknownError') })
            syncPanelRegistration(true)
          })
        return () => { cancelled = true }
      }, 'mobile-deck: load preferences')

      ctx.effect(() => {
        const unlock = event => {
          if (!event.isTrusted || settings.getSnapshot().enabled === false) return
          if (event.target && typeof event.target.closest === 'function' && event.target.closest('.mdk-sound')) return
          if (!(window.AudioContext || window.webkitAudioContext)) return
          const value = activity.getSnapshot()
          if (value.sound && !value.soundReady && !value.soundBusy) void activateSound(false)
        }
        window.addEventListener('pointerdown', unlock, { passive: true })
        window.addEventListener('keydown', unlock)
        return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock) }
      }, 'mobile-deck: audio gesture unlock')

      ctx.effect(() => {
        recordActivity(true)
        const removeStatus = ctx.uiSession.sessionStatus.subscribe(() => recordActivity())
        const removeList = ctx.sessions.list.subscribe(() => recordActivity())
        return () => { removeStatus(); removeList() }
      }, 'mobile-deck: task alerts')

      ctx.effect(() => {
        const unsubscribe = ctx.sessions.list.subscribe(() => {
          if (ctx.sessions.list.getSnapshot().phase === 'ready') { markSynced(); enterMobileHome() }
        })
        return unsubscribe
      }, 'mobile-deck: sync clock')

      ctx.effect(() => ctx.on('connection/reset', () => {
        historyEpoch.publish(historyEpoch.getSnapshot() + 1)
        void refreshSessions()
      }), 'mobile-deck: resync after a new connection generation')

      ctx.effect(() => {
        const onWake = () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
          if (Date.now() - lastAttempt < RESYNC_MIN_MS) return
          void refreshSessions()
        }
        const onVisible = () => { if (document.visibilityState === 'visible') onWake() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', onWake)
        window.addEventListener('online', onWake)
        window.addEventListener('pageshow', onWake)
        return () => {
          document.removeEventListener('visibilitychange', onVisible)
          window.removeEventListener('focus', onWake)
          window.removeEventListener('online', onWake)
          window.removeEventListener('pageshow', onWake)
        }
      }, 'mobile-deck: foreground resync')

      ctx.effect(() => () => {
        active = false
        audioRequest++
        if (cancelActivation) { cancelActivation(); cancelActivation = null }
        if (audioTimer) clearTimeout(audioTimer)
        stopTones()
        settings.dispose()
        freshness.dispose()
        stops.dispose()
        activity.dispose()
        failureRecords.dispose()
        reviewedFailures.dispose()
        fileNotice.dispose()
        devicePreferences.dispose()
        historyEpoch.dispose()
        alertRules.dispose()
        if (cancelFileOpen) cancelFileOpen()
        if (audio) { audio.onstatechange = null; void audio.close().catch(() => {}) }
      }, 'mobile-deck: teardown')
    }

    return {
      inject: ['slots', 'locale', 'connection', 'sessions', 'uiSession', 'uiWorkspace', 'layout', 'sidebarRight'],
      apply,
    }
  },
})
