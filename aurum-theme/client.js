/**
 * Client half of 暗金主题 · Aurum Theme.
 *
 * One bundle owns three things that used to be three unrelated pieces:
 *  1. The palette. A single `overrideTokens` layer paints warm ivory (light) and
 *     neutral charcoal (dark) with gold accents over the active base theme, so every `--dsw-alias-*`
 *     consumer follows the Appearance switch without a second preference.
 *  2. The instrument rail above the composer. It reports the same durable
 *     projections the built-in stats read (`sessionStats`, `tokenUsage`,
 *     `contextPressure`) at transcript width, and while the theme is on it
 *     replaces the three built-in duplicates: the two composer stat pills, the
 *     composer context ring, and the per-turn usage pill.
 *  3. The theme row in Settings, which is the only switch the user needs.
 *
 * The theme is a client-side preference (`localStorage`): the durable theme
 * preference in the profile only knows light/dark/system, and writing a custom
 * id there would be reverted by the settings scope on the next adoption.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-aurum-theme',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { createPortal } = require('react-dom')
    const { useEffect, useMemo, useRef, useState } = React

    const NS = 'aurumTheme'
    const PACKAGE = '@local/dsh-aurum-theme'
    const STYLE_ID = 'dsh-aurum-theme-style'
    const BODY_ATTR = 'data-ds-aurum-theme'
    const STORAGE_KEY = 'dsh.aurum.theme.v1'
    const SAMPLE_WINDOW_MS = 2400
    const SAMPLE_FLOOR_MS = 300
    const HISTORY_LIMIT = 1200
    // Numeric samples only; retain up to eight recently viewed sessions per page.
    const speedHistories = new Map()

    const zh = {
      title: '暗金仪表',
      phaseDuration: '当前阶段（本页观察）', phaseActivity: '最近状态更新', phaseToolNames: '运行中工具',
      phaseWaiting: '等待模型',
      phaseGenerating: '生成中',
      phaseTools: '执行工具',
      context: '上下文',
      tokens: 'Token',
      speed: '速度',
      elapsed: '用时',
      detail: '详情',
      collapse: '收起',
      empty: '开始对话后，这里会实时显示 Token、速度与用时',
      input: '输入',
      output: '输出',
      turnsSteps: '轮次 / 步数',
      ttft: '首字延迟',
      cache: '缓存命中',
      modelTool: '模型 / 工具耗时',
      liveSpeed: '速度记录 · tok/s',
      recorded: '已保留 · 估算',
      timeAxis: '累计运行时间',
      turnLabel: '轮次',
      interpolated: '最近三轮 · 估算 · 空档连线',
      perSecond: 'tok/s',
      estimated: '估算',
      waitingSpeed: '等待速度采样',
      contextMix: '上下文构成',
      contextSystem: '系统',
      contextTools: '工具',
      contextMessages: '对话',
      navTitle: '回答概览',
      navOutline: '本轮回答目录',
      navEmpty: '尚无回答摘要',
      navNoHeadings: '本轮回答没有可导航的标题',
      navUnloaded: '点击右侧轮次标记加载正文后，可查看标题目录',
      navExcerpt: '回答摘录',
      settingsTitle: '暗金主题',
      settingsDesc: '中性底色、清晰正文与暗金仪表；开启后由仪表条替代输入框下方的内置统计。',
      settingsOn: '已开启',
      settingsOff: '已关闭',
      settingsHint: '配色跟随「外观」的浅色 / 深色切换',
    }

    const en = {
      title: 'Aurum telemetry',
      phaseDuration: 'Stage duration (this page)', phaseActivity: 'Last state update', phaseToolNames: 'Running tools',
      phaseWaiting: 'Waiting for model',
      phaseGenerating: 'Generating',
      phaseTools: 'Running tools',
      context: 'Context',
      tokens: 'Tokens',
      speed: 'Speed',
      elapsed: 'Elapsed',
      detail: 'Details',
      collapse: 'Collapse',
      empty: 'Token totals, live speed, and elapsed time appear here once the conversation starts.',
      input: 'Input',
      output: 'Output',
      turnsSteps: 'Turns / steps',
      ttft: 'First token',
      cache: 'Cache hit',
      modelTool: 'Model / tool time',
      liveSpeed: 'Speed history · tok/s',
      recorded: 'Retained · estimated',
      timeAxis: 'Cumulative run time',
      turnLabel: 'Turn',
      interpolated: 'Last three turns · estimated · gaps connected',
      perSecond: 'tok/s',
      estimated: 'est.',
      waitingSpeed: 'Waiting for speed samples',
      contextMix: 'Context mix',
      contextSystem: 'System',
      contextTools: 'Tools',
      contextMessages: 'Conversation',
      navTitle: 'Answer overview',
      navOutline: 'Answer outline',
      navEmpty: 'No answer preview yet',
      navNoHeadings: 'This answer has no navigable headings',
      navUnloaded: 'Select the turn marker to load the answer and its outline',
      navExcerpt: 'Answer excerpt',
      settingsTitle: 'Aurum theme',
      settingsDesc: 'Neutral surfaces, clear text, and gold telemetry; the rail replaces the built-in composer stats.',
      settingsOn: 'On',
      settingsOff: 'Off',
      settingsHint: 'Colours follow the light / dark choice under Appearance',
    }

    /**
     * Alias-layer palette: `[light, dark]` per token. Values are composed over
     * the active built-in theme, so the Appearance preference stays the single
     * source of truth for light/dark and `system` keeps working.
     */
    // Keep reading surfaces neutral; reserve gold for accents and telemetry.
    // Secondary, tertiary and caption labels must remain readable on layer-3.
    const TOKENS = {
      '--dsw-alias-bg-base': ['#faf9f6', '#151617'],
      '--dsw-alias-bg-document-preview': ['#faf9f6', '#151617'],
      '--dsw-alias-bg-document-selection': ['rgba(176,138,18,0.24)', 'rgba(223,193,100,0.24)'],
      '--dsw-alias-label-document-preview': ['#393936', '#eeede9'],
      '--dsw-alias-bg-layer-1': ['#ffffff', '#1d1e20'],
      '--dsw-alias-bg-layer-2': ['#f2f1ed', '#252629'],
      '--dsw-alias-bg-layer-3': ['#e9e8e3', '#2d2e31'],
      '--dsw-alias-bg-overlay': ['#ffffff', '#292a2d'],
      '--dsw-alias-bg-module-platform': ['#f2f1ed', '#202123'],
      '--dsw-alias-bg-multi-select': ['#eeede8', '#292a2d'],
      '--dsw-alias-bg-skeleton': ['rgba(126,96,20,0.06)', 'rgba(232,199,102,0.07)'],
      '--dsw-alias-bg-mask-1': ['rgba(58,42,10,0.24)', 'rgba(0,0,0,0.58)'],
      '--dsw-alias-bg-mask-2': ['rgba(58,42,10,0.11)', 'rgba(0,0,0,0.26)'],
      '--dsw-alias-bg-mask-3': ['rgba(43,31,6,0.5)', 'rgba(0,0,0,0.5)'],
      '--dsw-alias-bg-mask-photo': ['rgba(28,20,4,0.88)', 'rgba(0,0,0,0.9)'],
      '--dsw-alias-bg-mask-drop': ['rgba(255,252,243,0.72)', 'rgba(32,26,14,0.74)'],
      '--dsw-alias-border-l1': ['rgba(122,93,26,0.08)', 'rgba(232,199,102,0.08)'],
      '--dsw-alias-border-l2': ['rgba(122,93,26,0.14)', 'rgba(232,199,102,0.14)'],
      '--dsw-alias-border-l3': ['rgba(122,93,26,0.2)', 'rgba(232,199,102,0.19)'],
      '--dsw-alias-border-l4': ['rgba(122,93,26,0.26)', 'rgba(232,199,102,0.23)'],
      '--dsw-alias-border-l2-darkmode-thin': ['rgba(122,93,26,0.12)', 'rgba(232,199,102,0.1)'],
      '--dsw-alias-border-inverted': ['rgba(255,252,243,0)', 'rgba(255,255,255,0.06)'],
      '--dsw-alias-border-inverted2': ['rgba(255,252,243,0)', 'rgba(255,255,255,0.08)'],
      '--dsw-alias-label-primary': ['#242522', '#f3f2ee'],
      '--dsw-alias-label-primary-dimmed': ['#353632', '#e3e2dd'],
      '--dsw-alias-label-primary-foreground': ['#fffdf7', '#1a1306'],
      '--dsw-alias-label-primary-inverted': ['#fffdf7', '#171208'],
      '--dsw-alias-label-primary-bluish': ['#242522', '#f3f2ee'],
      '--dsw-alias-label-secondary': ['#50514c', '#cccac3'],
      '--dsw-alias-label-tertiary': ['#62635c', '#b5b3ab'],
      '--dsw-alias-label-caption': ['#60615a', '#aaa89f'],
      '--dsw-alias-label-dimmed': ['#e4d8bc', '#453b26'],
      '--dsw-alias-label-shimmer': ['rgba(53,41,15,0.3)', 'rgba(255,255,255,0.4)'],
      '--dsw-alias-label-deep-diving': ['#8a6a08', '#e3c45f'],
      '--dsw-alias-label-deep-diving-shimmer': ['#c9a227', '#f5dc8e'],
      '--dsw-alias-menu-icon': ['#50514c', '#cccac3'],
      '--dsw-alias-link': ['#8a6a08', '#e3c45f'],
      '--dsw-alias-markdown-citation': ['#f1e6cd', '#2a2314'],
      '--dsw-alias-markdown-code-block': ['#f2f1ed', '#191a1c'],
      '--dsw-alias-markdown-code-block-banner': ['#e9e8e3', '#242528'],
      '--dsw-alias-markdown-code-segment-selected': ['#ffffff', '#303134'],
      '--dsw-alias-markdown-code-segment-unselected': ['#f2f1ed', '#191a1c'],
      '--dsw-alias-markdown-inline-code': ['#eeede8', '#303134'],
      '--dsw-alias-markdown-placeholder': ['#efe3c9', '#231d12'],
      '--dsw-alias-markdown-tag': ['#f1e6ce', '#231d12'],
      '--dsw-alias-scrollbar-bg-l1': ['#e2d3b0', '#483b23'],
      '--dsw-alias-scrollbar-bg-l2': ['#ddcca6', '#3e331e'],
      '--dsw-alias-scrollbar-hover-l1': ['#d0be95', '#5a4a2d'],
      '--dsw-alias-scrollbar-hover-l2': ['#c9b58b', '#695735'],
      '--dsw-alias-state-business-primary': ['#8a6a08', '#dfc164'],
      '--dsw-alias-state-business-tertiary': ['#f2e5c4', '#3a2f17'],
      '--dsw-alias-state-error-primary': ['#b03a2a', '#e58372'],
      '--dsw-alias-state-error-secondary': ['#c65a48', '#ee9c8c'],
      '--dsw-alias-state-idle-primary': ['#d6c7a3', '#4e442c'],
      '--dsw-alias-state-success-primary': ['#3e7c4b', '#74c08d'],
      '--dsw-alias-state-success-secondary': ['#58a268', '#8fd3a5'],
      '--dsw-alias-state-success-tertiary': ['#e4f0e0', '#25321f'],
      '--dsw-alias-state-warn-primary': ['#b58208', '#e2ae4b'],
      '--dsw-alias-state-warn-secondary': ['#c9a227', '#edc46f'],
      '--dsw-alias-state-warn-tertiary': ['#fbefd2', '#3a2f17'],
      '--dsw-alias-state-warn-label': ['#8a6a08', '#e2ae4b'],
      '--dsw-alias-code-diff-added': ['rgba(62,124,75,0.08)', 'rgba(116,192,141,0.12)'],
      '--dsw-alias-code-diff-deleted': ['rgba(176,58,42,0.08)', 'rgba(229,131,114,0.12)'],
      '--dsw-alias-file-diff-added-bg': ['#e9f2e3', '#1f2e22'],
      '--dsw-alias-file-diff-added-gutter': ['#f0f7ec', '#17221a'],
      '--dsw-alias-file-diff-added-marker': ['#3e7c4b', '#74c08d'],
      '--dsw-alias-file-diff-deleted-bg': ['#f8e7e1', '#33211c'],
      '--dsw-alias-file-diff-deleted-gutter': ['#fbf0ec', '#261814'],
      '--dsw-alias-file-diff-deleted-marker': ['#b03a2a', '#e58372'],
      '--dsw-alias-brand-primary': ['#8a6a08', '#e3c45f'],
      '--dsw-alias-brand-primary-invert': ['#2c220d', '#f5ebd4'],
      '--dsw-alias-brand-primary-new-colorprimary-new-color': ['#8a6a08', '#e3c45f'],
      '--dsw-alias-brand-text': ['#2c220d', '#f4e8cb'],
      '--dsw-alias-button-contrast-fill': ['#6b5830', '#e3c45f'],
      '--dsw-alias-button-elevated-fill': ['#ffffff', '#303134'],
      '--dsw-alias-button-floating-fill': ['#ffffff', '#252629'],
      '--dsw-alias-button-floating-hover': ['#eeede8', '#353639'],
      '--dsw-alias-button-ghost-active-border': ['#a08c5e', '#6b5936'],
      '--dsw-alias-button-ghost-active-fill': ['#f1e6ce', '#2c2515'],
      '--dsw-alias-button-ghost-active-hover': ['#ede0c4', '#352c1a'],
      '--dsw-alias-button-info-fill': ['#9a7414', '#b8891a'],
      '--dsw-alias-button-info-hover': ['#7e5e06', '#cfa63a'],
      '--dsw-alias-button-primary-dimmed': ['#f1e6ce', '#352c1a'],
      '--dsw-alias-button-primary-fill': ['#8a6a08', '#e3c45f'],
      '--dsw-alias-button-primary-hover': ['#755a06', '#f0d77e'],
      '--dsw-alias-button-tool-bar-fill': ['rgba(84,60,10,0.5)', 'rgba(58,48,26,0.55)'],
      '--dsw-alias-button-tool-bar-fill-invisible': ['rgba(31,23,6,0.36)', 'rgba(20,16,8,0.4)'],
      '--dsw-alias-button-tool-bar-hover': ['rgba(84,60,10,0.6)', 'rgba(72,60,34,0.65)'],
      '--dsw-alias-interactive-bg-hover': ['rgba(138,106,8,0.07)', 'rgba(232,199,102,0.08)'],
      '--dsw-alias-interactive-bg-active': ['rgba(138,106,8,0.12)', 'rgba(232,199,102,0.14)'],
      '--dsw-alias-interactive-bg-hover-accent': ['rgba(138,106,8,0.16)', 'rgba(232,199,102,0.2)'],
      '--dsw-alias-interactive-bg-hover-danger': ['rgba(176,58,42,0.06)', 'rgba(229,131,114,0.14)'],
      '--dsw-alias-interactive-bg-hover-solid': ['#eeede8', '#303134'],
      '--dsw-alias-switch-thumb': ['#fffdf6', '#cdbb90'],
      '--dsw-alias-toast-bg': ['#3a2e14', '#3a2f17'],
      '--dsw-alias-toast-label': ['#fbf3dd', '#f6eacb'],
      '--dsw-alias-tooltip-bg': ['#332a14', '#332b16'],
      '--dsw-alias-tooltip-key-bg': ['rgba(84,70,38,0.55)', 'rgba(84,70,38,0.55)'],
      '--dsw-alias-turn-trigger-bg': ['#f5ebd6', 'rgba(232,199,102,0.08)'],
      '--dsw-alias-turn-trigger-bg-hover': ['rgba(138,106,8,0.1)', 'rgba(232,199,102,0.14)'],
      '--dsw-alias-settings-card-fill': ['#ffffff', '#1d1e20'],
      '--dsw-alias-settings-card-stroke': ['rgba(122,93,26,0.26)', 'rgba(232,199,102,0.2)'],
      '--dsw-specific-bubble': ['#eeede8', '#292a2d'],
      '--dsw-specific-bubble-highlight': ['#e7dfc9', '#393425'],
      /* The composer card and other input surfaces paint `background:` with this
         token, so a gradient is legal here and gives the input its warm sheen. */
      '--dsw-specific-input-major': [
        'linear-gradient(180deg, #ffffff 0%, #faf9f6 100%)',
        'linear-gradient(180deg, #252629 0%, #1d1e20 100%)',
      ],
      '--dsw-specific-login-input': ['#ffffff', '#1d1e20'],
      '--dsw-specific-menu': ['rgba(255,255,255,0.98)', 'rgba(37,38,41,0.98)'],
      '--dsw-menu-surface-fill': ['rgba(255,255,255,0.98)', 'rgba(37,38,41,0.98)'],
      '--dsw-alias-menu-group-header-fill': ['#f2f1ed', '#252629'],
      '--dsw-specific-selector': ['#eeede8', '#303134'],
      '--dsw-specific-sidebar-fill': ['#f0efeb', '#101112'],
      '--dsw-specific-sidebar-nav-item-active-accent': ['#e9dfc4', '#393425'],
      '--dsw-specific-sidebar-nav-item-active': ['#eae6da', '#302d24'],
      '--dsw-specific-sidebar-nav-item-hover': ['#e6e5df', '#242527'],
      '--dsw-specific-tip': ['#f2f1ed', '#252629'],
      '--dsw-focus-ring-color': ['rgba(138,106,8,0.55)', 'rgba(227,196,95,0.6)'],
      '--dsw-elevation-stroke-color': ['rgba(122,93,26,0.2)', 'rgba(232,199,102,0.18)'],
      '--dsw-shadow-lv1': ['0 2px 6px 0 rgba(92,68,12,0.06)', '0 2px 6px 0 rgba(0,0,0,0.36)'],
      '--dsw-shadow-lv2': ['0 4px 12px 0 rgba(92,68,12,0.05), 0 2px 8px 0 rgba(92,68,12,0.05)', '0 6px 16px 0 rgba(0,0,0,0.34), 0 2px 8px 0 rgba(0,0,0,0.3)'],
      '--dsw-shadow-lv3': ['0 0 1px 0 rgba(92,68,12,0.22), 0 12px 30px 0 rgba(92,68,12,0.1)', '0 0 1px 0 rgba(0,0,0,0.5), 0 14px 34px 0 rgba(0,0,0,0.5)'],
      '--shiki-token-constant': ['#8a6a08', '#e8c766'],
      '--shiki-token-string': ['#4c7a45', '#9bd08f'],
      '--shiki-token-comment': ['#66675f', '#aaa89f'],
      '--shiki-token-keyword': ['#a84e2e', '#e89a78'],
      '--shiki-token-parameter': ['#a66a12', '#e0b463'],
      '--shiki-token-function': ['#6f4e18', '#d8c58f'],
      '--shiki-token-string-expression': ['#3e7c4b', '#7fd39a'],
      '--shiki-token-punctuation': ['#6b5a35', '#b7a783'],
      '--shiki-token-link': ['#8a6a08', '#e8c766'],
    }

    const THEME_CSS = `
body[data-ds-aurum-theme] {
  --au-gold: #8a6a08;
  --au-gold-strong: #b08a12;
  --au-gold-soft: rgba(160, 118, 10, 0.16);
  --au-line: rgba(150, 112, 14, 0.26);
  --au-line-strong: rgba(150, 112, 14, 0.48);
  --au-cell-line: rgba(150, 112, 14, 0.22);
  --au-card: linear-gradient(112deg, rgba(201, 162, 39, 0.14), rgba(255, 252, 244, 0.94) 42%, rgba(201, 162, 39, 0.08));
  --au-card-glow: inset 0 1px 0 rgba(255, 255, 255, 0.72), 0 1px 2px rgba(92, 68, 12, 0.06), 0 10px 24px -14px rgba(92, 68, 12, 0.38);
  --au-swatch: linear-gradient(135deg, #fffdf6, #f2e5c6 58%, #d9b96a);
  --au-dialog: linear-gradient(168deg, #fffdf8, #f6eedf);
  --au-seg-system: #c9a227;
  --au-seg-tools: #b06a3a;
  --au-seg-messages: #6f8f68;
  color-scheme: light;
}
body[data-ds-aurum-theme][data-ds-dark-theme] {
  --au-gold: #e4c463;
  --au-gold-strong: #f4dd96;
  --au-gold-soft: rgba(232, 199, 102, 0.14);
  --au-line: rgba(232, 199, 102, 0.22);
  --au-line-strong: rgba(240, 215, 138, 0.42);
  --au-cell-line: rgba(232, 199, 102, 0.16);
  --au-card: linear-gradient(112deg, rgba(201, 162, 39, 0.14), rgba(28, 22, 13, 0.64) 44%, rgba(201, 162, 39, 0.06));
  --au-card-glow: inset 0 1px 0 rgba(244, 221, 150, 0.1), 0 1px 2px rgba(0, 0, 0, 0.3), 0 12px 28px -16px rgba(0, 0, 0, 0.8);
  --au-swatch: linear-gradient(135deg, #241d10, #3a2e15 55%, #c9a227);
  --au-dialog: linear-gradient(168deg, #221c12, #18130c);
  --au-seg-system: #e3c46a;
  --au-seg-tools: #d99a6c;
  --au-seg-messages: #9dc094;
  color-scheme: dark;
}

/* Warm elevation: the stock shadows are pure black and read cold on ivory and
   smoked-gold surfaces. Declared per element for the same reason the base sheet
   does — components rebind the stroke colour and need a fresh substitution. */
body[data-ds-aurum-theme],
body[data-ds-aurum-theme] * {
  --dsw-elevation-panel: var(--dsw-elevation-stroke), 0 3px 10px 0 rgba(92, 68, 12, 0.055), 0 0 18px 0 rgba(201, 162, 39, 0.05);
  --dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 4px 14px 0 rgba(92, 68, 12, 0.07), 0 0 24px 0 rgba(201, 162, 39, 0.07);
  --dsw-elevation-soft: var(--dsw-elevation-stroke), 0 6px 20px 0 rgba(92, 68, 12, 0.05), 0 0 26px 0 rgba(201, 162, 39, 0.05);
}
body[data-ds-aurum-theme][data-ds-dark-theme],
body[data-ds-aurum-theme][data-ds-dark-theme] * {
  --dsw-elevation-panel: var(--dsw-elevation-stroke), 0 4px 12px 0 rgba(0, 0, 0, 0.32), 0 0 18px 0 rgba(0, 0, 0, 0.22);
  --dsw-elevation-prominent: var(--dsw-elevation-stroke), 0 6px 18px 0 rgba(0, 0, 0, 0.38), 0 0 24px 0 rgba(0, 0, 0, 0.26);
  --dsw-elevation-soft: var(--dsw-elevation-stroke), 0 6px 20px 0 rgba(0, 0, 0, 0.34), 0 0 26px 0 rgba(0, 0, 0, 0.24);
}

body[data-ds-aurum-theme] ::selection {
  background: rgba(201, 162, 39, 0.28);
}
body[data-ds-aurum-theme][data-ds-dark-theme] ::selection {
  background: rgba(232, 199, 102, 0.24);
}

/* One warm halo on floating menu surfaces; the elevation tokens stay neutral. */
body[data-ds-aurum-theme] [data-menu-material] {
  box-shadow: var(--dsw-elevation-prominent), 0 0 26px rgba(201, 162, 39, 0.1);
}

/* Dialogs keep their own surface: several plugins paint bespoke panels here,
   so the theme contributes only the warm hairline and shadow and never
   replaces a background whose labels it cannot see. */
body[data-ds-aurum-theme] [role="dialog"] {
  border: 1px solid var(--au-line);
  box-shadow: var(--dsw-elevation-prominent), 0 24px 64px -28px rgba(92, 68, 12, 0.5);
}

/* Press feedback: a faint shade while a button is held. No transform: several
   built-in buttons already position themselves with one. */
body[data-ds-aurum-theme] button:active:not(:disabled):not(.au-toggle):not(.au-switch) {
  filter: brightness(0.97);
}

/* The rail already reports context and session totals, so the built-in
   duplicates would say the same thing twice. Each marker below is owned by
   ui-chat / ui-conversation: the two composer stat pills carry
   data-composer-stat, the composer context ring is the dock's remaining
   aria-haspopup dialog control, and the per-turn usage pill is the turn tail's
   only dialog trigger. */
body[data-ds-aurum-theme] [data-composer-stat] {
  display: none !important;
}
body[data-ds-aurum-theme] [data-composer-dock] > span:has(> button[aria-haspopup="dialog"] > svg > circle) {
  display: none !important;
}
body[data-ds-aurum-theme] [data-turn-tail] span:has(> button[aria-haspopup="dialog"]) {
  display: none !important;
}
/* Native assistant-tail actions put copy first; user-message actions are outside this scope. */
body[data-ds-aurum-theme] [data-turn-tail] [data-clock="end"] > button:not(:first-of-type) {
  display: none !important;
}

`

    const RAIL_CSS = `
/* The rail spans the transcript column exactly like the composer card: the
   dock wrapper already carries the side clearance, and the card's own cap adds
   back the 2 × 16px sides, so the same cap keeps both edges on one axis. */
.au-strip {
  box-sizing: border-box;
  position: relative;
  flex: none;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width, 780px);
  margin: 0 auto;
  border: 1px solid var(--au-line, rgba(150, 112, 14, 0.26));
  border-radius: var(--dsw-radius-panel, 12px);
  background: var(--au-card, #fffdf7);
  box-shadow: var(--au-card-glow, 0 1px 2px rgba(92, 68, 12, 0.08));
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  user-select: none;
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.au-strip::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: calc(var(--au-ratio, 0) * 100%);
  border-radius: 0 2px 2px 0;
  background: linear-gradient(90deg, var(--au-gold-soft, rgba(160, 118, 10, 0.2)), var(--au-gold, #8a6a08));
  opacity: 0.5;
  transition: width 0.6s ease;
}
.au-strip.live {
  border-color: var(--au-line-strong);
  box-shadow: var(--au-card-glow, 0 1px 2px rgba(92, 68, 12, 0.08)), 0 0 0 3px var(--au-gold-soft);
}
.au-row {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
  padding: 6px 12px 7px;
}
.au-stage { border: 0; background: transparent; color: inherit; padding: 0; font: inherit; cursor: pointer; white-space: nowrap; font-size: 12px; font-weight: 500; letter-spacing: normal; text-transform: none; }
.au-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
  font-size: 10.5px;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--au-gold, #8a6a08);
  white-space: nowrap;
}
.au-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.au-dot.live {
  background: var(--au-gold, #8a6a08);
  box-shadow: 0 0 0 3px var(--au-gold-soft, rgba(160, 118, 10, 0.16));
  animation: au-pulse 1.8s ease-in-out infinite;
}
@keyframes au-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.15); }
}
.au-ring {
  display: flex;
  align-items: center;
  gap: 7px;
  flex: none;
}
.au-ring svg {
  display: block;
  transform: rotate(-90deg);
}
.au-ring-meta {
  display: flex;
  flex-direction: column;
  line-height: 1.12;
}
.au-ring-meta b {
  font-size: 12px;
  font-weight: 600;
  color: var(--au-gold, #8a6a08);
}
.au-ring-meta small {
  font-size: 11px;
  letter-spacing: 0.4px;
  color: var(--dsw-alias-label-tertiary);
}
.au-divider {
  flex: none;
  width: 1px;
  height: 18px;
  background: var(--au-cell-line, rgba(150, 112, 14, 0.22));
}
.au-metrics {
  display: flex;
  align-items: center;
  gap: 20px;
  flex: 1;
  min-width: 0;
}
.au-metric {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}
.au-metric b {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--au-gold, #8a6a08);
  white-space: nowrap;
}
.au-metric small {
  font-size: 11px;
  letter-spacing: 0.45px;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.au-empty {
  flex: 1;
  min-width: 0;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.au-toggle {
  appearance: none;
  flex: none;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--au-line, rgba(150, 112, 14, 0.26));
  border-radius: 8px;
  background: transparent;
  color: var(--au-gold, #8a6a08);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s, transform 0.1s;
}
.au-toggle:hover {
  border-color: var(--au-gold, #8a6a08);
  color: var(--au-gold-strong, #b08a12);
  background: var(--au-gold-soft, rgba(160, 118, 10, 0.16));
}
.au-toggle:active {
  transform: translateY(1px);
}
.au-expand {
  margin: 0 12px 10px;
  padding-top: 9px;
  border-top: 1px solid var(--au-cell-line, rgba(150, 112, 14, 0.22));
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 18px;
}
.au-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--au-gold-soft);
}
.au-cell b {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--au-gold, #8a6a08);
  white-space: nowrap;
}
.au-cell small {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}
.au-chart {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.au-chart svg {
  width: 100%;
  height: auto;
  max-height: 140px;
  display: block;
}
.au-speed-legend { justify-content: flex-end; padding: 3px 6px 0; }
.au-chart text { fill: var(--dsw-alias-label-tertiary); font: 10px system-ui; }
.au-toggle:focus-visible { outline: 2px solid var(--au-gold); outline-offset: 3px; }
.au-chart small {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}
.au-context {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}
.au-context-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-tertiary);
}
.au-context-bar {
  display: flex;
  height: 5px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--au-cell-line, rgba(150, 112, 14, 0.22));
}
.au-context-bar span {
  display: block;
  height: 100%;
}
.au-context-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-tertiary);
}
.au-context-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.au-context-legend i {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  display: inline-block;
}
@media (prefers-reduced-motion: reduce) {
  .au-dot.live, .au-strip.live { animation: none; }
  .au-strip::after { transition: none; }
}
@media (max-width: 780px) {
  .au-brand .au-word { display: none; }
  .au-row { gap: 9px; }
  .au-metrics { gap: 12px; }
}
@media (max-width: 560px) {
  .au-row { flex-wrap: wrap; }
  .au-expand { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`

    const SETTINGS_CSS = `
.au-set {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.au-set-head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.au-set-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.au-set-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.au-set-badge {
  padding: 1px 7px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 999px;
  font-size: 8.5px;
  line-height: 13px;
  letter-spacing: 0.14em;
  color: var(--dsw-alias-label-tertiary);
}
.au-set-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.au-set-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.au-set-state {
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}
.au-set-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.au-set-palette {
  display: inline-flex;
  flex: none;
  align-items: stretch;
  height: 14px;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: 4px;
}
.au-set-palette i {
  display: block;
  width: 18px;
  height: 100%;
}
.au-set-hint {
  min-width: 0;
}
.au-switch {
  appearance: none;
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l4);
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover-solid);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.au-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-switch-thumb);
  box-shadow: 0 1px 2px rgba(40, 28, 6, 0.28);
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.16s ease;
}
.au-switch[aria-checked='true'] {
  background: linear-gradient(135deg, #c9a227, #8a6a08);
  border-color: rgba(138, 106, 8, 0.5);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 2px 8px rgba(92, 68, 12, 0.24);
}
.au-switch[aria-checked='true']::after {
  transform: translateX(18px);
  background: #fffdf6;
}
.au-switch:active::after {
  width: 18px;
}
.au-switch:focus-visible {
  outline: 3px solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}
`

    const NAV_CSS = `
/* Extend the existing rail, so its virtual marks and history loading stay owned by Chat. */
[data-aurum-navigation] { --au-nav-height: min(440px, max(120px, calc(var(--turn-rail-band, 70dvh) - 80px))); }
[data-aurum-navigation][data-au-open] > [role="tooltip"] { display: none; }
.au-nav-panel {
  position: absolute; right: calc(100% + 10px); top: 50%; transform: translateY(-50%);
  box-sizing: border-box; width: min(300px, calc(100cqw - 100px));
  max-height: var(--au-nav-height); overflow-y: auto; overscroll-behavior: contain;
  padding: 14px; border: 1px solid var(--au-line); border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent); cursor: auto; scrollbar-width: thin;
  overflow-wrap: anywhere;
}
/* Bridge the pointer gap between marks and the panel. */
[data-aurum-navigation][data-au-open]::after { content: ''; position: absolute; right: 100%; top: 50%; width: 12px; height: var(--au-nav-height); transform: translateY(-50%); }
.au-nav-panel[hidden] { display: none; }
.au-nav-title { color: var(--au-gold); font-size: 12px; font-weight: 600; margin-bottom: 8px; }
.au-nav-prompt { font-size: 13px; line-height: 1.5; font-weight: 600; margin-bottom: 10px; }
.au-nav-caption { font-size: 11px; line-height: 1.5; color: var(--dsw-alias-label-secondary); margin: 10px 0 4px; }
.au-nav-excerpt { font-size: 12px; line-height: 1.65; white-space: pre-wrap; color: var(--dsw-alias-label-secondary); }
.au-nav-outline { border-top: 1px solid var(--dsw-alias-border-l3); margin-top: 12px; padding-top: 2px; }
.au-nav-heading {
  display: block; width: 100%; padding: 6px 8px; text-align: start; border: 0; border-radius: 6px;
  font: inherit; font-size: 12px; line-height: 1.5; background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer; overflow-wrap: anywhere;
}
.au-nav-heading[data-level="3"] { padding-inline-start: 20px; }
.au-nav-heading:hover { background: var(--dsw-alias-interactive-bg-hover); }
.au-nav-heading[aria-current] { color: var(--au-gold); background: var(--au-gold-soft); }
.au-nav-heading:focus-visible { outline: 2px solid var(--au-gold); outline-offset: 2px; }
`

    const CSS = THEME_CSS + RAIL_CSS + SETTINGS_CSS + NAV_CSS

    // ---------------------------------------------------------------- state --

    const listeners = new Set()
    let state = { enabled: true }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw !== null && raw !== '') {
        const parsed = JSON.parse(raw)
        if (parsed !== null && typeof parsed === 'object' && typeof parsed.enabled === 'boolean') {
          state = { enabled: parsed.enabled }
        }
      }
    } catch (error) {
      // Private mode or a corrupt entry: fall back to the shipped default.
    }

    function notify() {
      for (const listener of listeners) listener()
    }

    function setEnabled(value) {
      if (state.enabled === value) return
      state = { enabled: value }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        // Persistence is best effort; the live toggle still applies.
      }
      notify()
    }

    function useEnabled() {
      const [enabled, setLocal] = useState(state.enabled)
      useEffect(function () {
        return subscribe(function () { setLocal(state.enabled) })
      }, [])
      return enabled
    }

    function subscribe(listener) {
      listeners.add(listener)
      return function () { listeners.delete(listener) }
    }

    function buildLayer() {
      const layer = {}
      for (const name of Object.keys(TOKENS)) {
        const pair = TOKENS[name]
        layer[name] = { light: pair[0], dark: pair[1] }
      }
      return layer
    }

    /** Install the aurum stylesheet once; the body marker decides what applies. */
    function installStyle() {
      if (typeof document === 'undefined' || document.head === null) return function () {}
      const previous = document.getElementById(STYLE_ID)
      if (previous !== null) previous.remove()
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.setAttribute('data-dsh-plugin', 'aurum-theme')
      style.textContent = CSS
      document.head.appendChild(style)
      return function () { style.remove() }
    }

    // -------------------------------------------------------------- helpers --

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value))
    }

    function formatTokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '0'
      if (value >= 1e6) return (value / 1e6).toFixed(value >= 1e7 ? 1 : 2) + 'M'
      if (value >= 1e4) return (value / 1e3).toFixed(1) + 'k'
      if (value >= 1e3) return (value / 1e3).toFixed(2) + 'k'
      return String(Math.round(value))
    }

    function formatDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '0s'
      if (ms < 1000) return (ms / 1000).toFixed(1) + 's'
      const seconds = ms / 1000
      if (seconds < 60) return seconds.toFixed(1) + 's'
      const whole = Math.round(seconds)
      const minutes = Math.floor(whole / 60)
      const rest = whole % 60
      if (minutes < 60) return minutes + 'm' + String(rest).padStart(2, '0') + 's'
      const hours = Math.floor(minutes / 60)
      return hours + 'h' + String(minutes % 60).padStart(2, '0') + 'm'
    }

    /** Characters of settled text inside one assistant block list. */
    function blockChars(blocks) {
      if (!Array.isArray(blocks)) return 0
      let total = 0
      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue
        if (block.kind !== 'text' && block.kind !== 'reasoning') continue
        if (typeof block.text === 'string') total += block.text.length
      }
      return total
    }

    function partialChars(partial) {
      if (partial === null || typeof partial !== 'object') return null
      return blockChars(partial.blocks)
    }

    /**
     * Live output rate in characters/second from the growing streaming prefix.
     * Samples land per published chunk; the rolling window smooths bursts.
     */
    function useLiveRate(partial, sessionId, running, turn) {
      const [rate, setRate] = useState(null)
      const [history, setHistory] = useState([])
      const samplesRef = useRef([])
      const lastPushRef = useRef(0)
      const sampleTurnRef = useRef(null)
      const clockRef = useRef({ elapsed: 0, started: null })
      const chars = running ? partialChars(partial) : null

      // History belongs to the session; transient gaps only reset the sampler.
      useEffect(function () {
        samplesRef.current = []
        lastPushRef.current = 0
        setRate(null)
        const saved = speedHistories.get(sessionId) || []
        setHistory(saved)
        sampleTurnRef.current = null
        clockRef.current = { elapsed: saved.length ? saved[saved.length - 1].at : 0, started: null }
      }, [sessionId])

      // Count only running intervals; tool/first-token waits inside a turn remain included.
      useEffect(function () {
        const clock = clockRef.current
        const now = Date.now()
        if (running && clock.started === null) clock.started = now
        if (!running && clock.started !== null) {
          clock.elapsed += Math.max(0, now - clock.started)
          clock.started = null
        }
      }, [running, sessionId])

      useEffect(function () {
        if (chars === null) {
          if (samplesRef.current.length > 0) {
            samplesRef.current = []
            setRate(null)
          }
          lastPushRef.current = 0
          return undefined
        }
        const now = Date.now()
        const samples = samplesRef.current
        if (sampleTurnRef.current !== turn) {
          samples.length = 0
          lastPushRef.current = 0
          sampleTurnRef.current = turn
        }
        // A new model step can replace the prefix without an intermediate null.
        if (samples.length && chars < samples[samples.length - 1].chars) {
          samples.length = 0
          lastPushRef.current = 0
          setRate(null)
        }
        samples.push({ at: now, chars: chars })
        while (samples.length > 2 && now - samples[0].at > SAMPLE_WINDOW_MS) samples.shift()
        const first = samples[0]
        const seconds = (now - first.at) / 1000
        if (seconds * 1000 < SAMPLE_FLOOR_MS) return undefined
        const value = Math.max(0, (chars - first.chars) / seconds)
        setRate(value)
        if (now - lastPushRef.current >= SAMPLE_FLOOR_MS) {
          lastPushRef.current = now
          const clock = clockRef.current
          const activeAt = clock.elapsed + (clock.started === null ? 0 : Math.max(0, now - clock.started))
          setHistory(function (previous) {
            const all = previous.concat([{ at: activeAt, value: value, turn: turn }])
            const turns = Array.from(new Set(all.map(row => row.turn))).slice(-3)
            const next = all.filter(row => turns.includes(row.turn))
            // Compact older samples while retaining the full time span.
            const kept = next.length > HISTORY_LIMIT
              ? next.filter(function (_, index) { return index % 2 === 0 || index === next.length - 1 }) : next
            if (sessionId) {
              speedHistories.delete(sessionId)
              speedHistories.set(sessionId, kept)
              if (speedHistories.size > 8) speedHistories.delete(speedHistories.keys().next().value)
            }
            return kept
          })
        }
        return undefined
      }, [chars, sessionId, turn])

      return { rate: rate, history: history }
    }

    /**
     * Elapsed time that keeps counting while a turn runs: the durable total is
     * the baseline and wall time since the last projection update stands in for
     * the in-flight step. The baseline resets on every accepted total.
     */
    function useElapsed(totalMs, running) {
      const [anchor, setAnchor] = useState(function () { return { value: totalMs, at: Date.now() } })
      const [stamp, setStamp] = useState(function () { return Date.now() })
      useEffect(function () {
        setAnchor({ value: totalMs, at: Date.now() })
        setStamp(Date.now())
      }, [totalMs, running])
      useEffect(function () {
        if (!running) return undefined
        const timer = setInterval(function () { setStamp(Date.now()) }, 1000)
        return function () { clearInterval(timer) }
      }, [running])
      if (!running) return totalMs
      return anchor.value + Math.max(0, stamp - anchor.at)
    }

    // ------------------------------------------------------------ components --

    function Ring(props) {
      const radius = 11
      const circumference = 2 * Math.PI * radius
      const ratio = clamp(props.ratio, 0, 1)
      return h('span', { className: 'au-ring' },
        h('svg', { width: 26, height: 26, viewBox: '0 0 26 26', 'aria-hidden': true },
          h('defs', null,
            h('linearGradient', { id: 'au-ring-grad', x1: '0', y1: '0', x2: '1', y2: '1' },
              h('stop', { offset: '0', stopColor: 'var(--au-gold-strong, #b08a12)' }),
              h('stop', { offset: '1', stopColor: 'var(--au-gold, #8a6a08)' }))),
          h('circle', { cx: 13, cy: 13, r: radius, fill: 'none', stroke: 'var(--au-cell-line, rgba(150,112,14,.22))', strokeWidth: 2.5 }),
          h('circle', {
            cx: 13, cy: 13, r: radius, fill: 'none',
            stroke: 'url(#au-ring-grad)', strokeWidth: 2.5, strokeLinecap: 'round',
            strokeDasharray: circumference, strokeDashoffset: circumference * (1 - ratio),
            style: { transition: 'stroke-dashoffset 0.5s ease' },
          })),
        h('span', { className: 'au-ring-meta' },
          h('b', null, props.label),
          h('small', null, props.caption)))
    }

    /** Three chronological turns share a time axis and meet at their colour boundaries. */
    function Sparkline(props) {
      const values = props.values
      const turns = Array.from(new Set(values.map(row => row.turn)))
      const colors = ['var(--au-gold)', 'var(--au-seg-messages)', 'var(--au-seg-tools)']
      const max = Math.max(10, Math.ceil(Math.max(0, ...values.map(row => row.value)) / 10) * 10)
      const start = values.length ? values[0].at : 0
      const span = values.length > 1 ? Math.max(1, values[values.length - 1].at - start) : 1000
      const x = row => 40 + (row.at - start) / span * 548
      const y = row => 92 - row.value / max * 76
      return h('div', null,
        h('div', { className: 'au-context-legend au-speed-legend' }, turns.map(turn =>
          h('span', { key: turn }, h('i', { style: { background: colors[((turn % 3) + 3) % 3] } }), props.t('turnLabel') + ' ' + (turn + 1)))),
        h('svg', { viewBox: '0 0 600 116', role: 'img', 'aria-label': props.t('liveSpeed') },
          h('title', null, props.t('interpolated')),
          [0, 0.5, 1].map(function (fraction) {
            const height = 92 - fraction * 76
            return h('g', { key: fraction },
              h('line', { x1: 40, x2: 588, y1: height, y2: height, stroke: 'var(--au-cell-line)', strokeDasharray: fraction ? '3 5' : undefined }),
              h('text', { x: 32, y: height + 3, textAnchor: 'end' }, String(Math.round(max * fraction))))
          }),
          turns.map(function (turn, index) {
            const rows = values.filter(row => row.turn === turn)
            const firstIndex = values.indexOf(rows[0])
            if (firstIndex > 0) rows.unshift(values[firstIndex - 1])
            const path = rows.map((row, i) => (i ? 'L' : 'M') + x(row).toFixed(1) + ' ' + y(row).toFixed(1)).join(' ')
            const color = colors[((turn % 3) + 3) % 3]
            const gradient = 'au-speed-fill-' + index
            return h('g', { key: turn },
              h('defs', null, h('linearGradient', { id: gradient, x1: '0', y1: '0', x2: '0', y2: '1' },
                h('stop', { offset: '0', stopColor: color, stopOpacity: 0.24 }),
                h('stop', { offset: '1', stopColor: color, stopOpacity: 0.02 }))),
              h('path', { className: 'au-speed-area', d: path + ' L' + x(rows[rows.length - 1]).toFixed(1) + ' 92 L' + x(rows[0]).toFixed(1) + ' 92 Z', fill: 'url(#' + gradient + ')' }),
              h('path', { className: 'au-speed-line', d: path, fill: 'none', stroke: color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }),
              rows.length === 1 ? h('circle', { cx: x(rows[0]), cy: y(rows[0]), r: 2.5, fill: color }) : null)
          }),
          h('text', { x: 40, y: 110 }, '0s'),
          h('text', { x: 314, y: 110, textAnchor: 'middle' }, props.t('timeAxis') + ' · ' + formatDuration(span / 2)),
          h('text', { x: 588, y: 110, textAnchor: 'end' }, formatDuration(span))))
    }

    function TelemetryRail(props) {
      const t = props.t
      const enabled = useEnabled()
      const stats = props.useProjection('sessionStats')
      const usage = props.useProjection('tokenUsage')
      const pressure = props.useProjection('contextPressure')
      const breakdown = props.useProjection('contextBreakdown')
      const running = props.useSession(function (snapshot) { return snapshot.running === true })
      const nodes = props.useChat(function (snapshot) { return snapshot.legacy.nodes })
      const partial = props.useChat(function (snapshot) { return snapshot.legacy.partial })
      const runningCalls = props.useChat(function (snapshot) { return snapshot.legacy.runningCalls })
      const activeTools = runningCalls.filter(call => call.phase === 'start')
      const phase = !running ? null : activeTools.length > 0 ? 'phaseTools'
        : partial && partial.blocks.length > 0 ? 'phaseGenerating' : 'phaseWaiting'
      const [expanded, setExpanded] = useState(false)
      const [stageClock, setStageClock] = useState(() => ({ phase, sessionId: props.sessionId, start: Date.now(), activity: Date.now() }))
      const [stageNow, setStageNow] = useState(Date.now)
      useEffect(() => {
        const now = Date.now()
        setStageClock(previous => ({ phase, sessionId: props.sessionId,
          start: previous.phase === phase && previous.sessionId === props.sessionId ? previous.start : now, activity: now }))
        setStageNow(now)
      }, [phase, partial, runningCalls, props.sessionId])
      useEffect(() => {
        if (!phase) return undefined
        const timer = setInterval(() => setStageNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [phase])
      const live = useLiveRate(partial, props.sessionId, running, partial && typeof partial.turn === 'number' ? partial.turn : (stats ? Math.max(0, stats.turns - 1) : 0))

      const inputTokens = usage
        ? usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
        : 0
      const outputTokens = usage ? usage.outputTokens : 0
      const totalTokens = inputTokens + outputTokens

      const contextWindow = pressure && typeof pressure.contextWindow === 'number' ? pressure.contextWindow : 0
      const usedTokens = pressure === undefined || pressure === null
        ? 0
        : typeof pressure.projectedTokens === 'number'
          ? pressure.projectedTokens
          : typeof pressure.pressureTokens === 'number' ? pressure.pressureTokens : 0
      const ratio = contextWindow > 0 ? clamp(usedTokens / contextWindow, 0, 1) : 0

      // The built-in ContextMeter's breakdown panel used to be the only place
      // that split the window into system / tools / conversation. The rail's
      // details take that job over, so the split stays available after the
      // composer meter is hidden.
      const mix = breakdown === undefined || breakdown === null
        ? []
        : [
          { key: 'contextSystem', value: breakdown.systemTokens, color: 'var(--au-seg-system)' },
          { key: 'contextTools', value: breakdown.toolsTokens, color: 'var(--au-seg-tools)' },
          { key: 'contextMessages', value: breakdown.messageTokens, color: 'var(--au-seg-messages)' },
        ].filter(function (row) { return typeof row.value === 'number' && row.value > 0 })
      const mixTotal = mix.reduce(function (sum, row) { return sum + row.value }, 0)

      const decodeMs = stats ? stats.decodeMs : 0
      const decodeTokens = stats ? stats.decodeTokens : 0
      const averageSpeed = decodeMs > 0 && decodeTokens > 0 ? decodeTokens / (decodeMs / 1000) : null
      const turns = stats ? stats.turns : 0
      const steps = stats ? stats.steps : 0
      const totalMs = stats ? stats.llmMs + stats.toolMs : 0
      const elapsedMs = useElapsed(totalMs, running)

      // Settled text calibrates the character→token estimate, so Chinese and
      // English sessions read differently without a second heuristic.
      const tokensPerChar = useMemo(function () {
        let chars = 0
        for (const node of nodes) {
          if (node !== null && typeof node === 'object' && node.kind === 'assistant') chars += blockChars(node.blocks)
        }
        if (chars > 0 && decodeTokens > 0) return clamp(decodeTokens / chars, 0.15, 2)
        return 0.55
      }, [nodes, decodeTokens])

      const liveSpeed = running && live.rate !== null ? live.rate * tokensPerChar : null
      const shownSpeed = liveSpeed !== null ? liveSpeed : averageSpeed
      const speedEstimated = liveSpeed !== null
      const history = useMemo(function () {
        return live.history.map(function (row) { return { at: row.at, value: row.value * tokensPerChar, turn: row.turn } })
      }, [live.history, tokensPerChar])
      const hasData = totalTokens > 0 || steps > 0 || usedTokens > 0

      if (!enabled) return null
      // With no reading and no turn in flight the rail would be an empty bar on
      // the landing draft; it appears with the first token or turn instead.
      if (!hasData && !running) return null

      return h('section', {
        className: running ? 'au-strip live' : 'au-strip',
        'data-aurum-rail': '',
        'aria-label': t('title'),
        style: { '--au-ratio': ratio.toFixed(4) },
      },
      h('div', { className: 'au-row' },
        h('span', { className: 'au-brand' },
          h('span', { className: running ? 'au-dot live' : 'au-dot' }),
          h('span', { role: 'status', 'aria-atomic': true }, phase ? h('button', { type: 'button', className: 'au-stage', 'data-aurum-phase': phase, 'aria-expanded': expanded, onClick: () => setExpanded(value => !value) }, t(phase)) : h('span', { className: 'au-word', 'data-aurum-phase': 'idle' }, t('title')))),
        h(Ring, {
          ratio: ratio,
          label: contextWindow > 0 ? Math.round(ratio * 100) + '%' : '—',
          caption: t('context'),
        }),
        h('span', { className: 'au-divider' }),
        hasData
          ? h('span', { className: 'au-metrics' },
            h('span', { className: 'au-metric' },
              h('b', null, formatTokens(totalTokens)),
              h('small', null, t('tokens'))),
            h('span', { className: 'au-metric' },
              h('b', null, shownSpeed === null ? '—' : (speedEstimated ? '≈' : '') + shownSpeed.toFixed(1)),
              h('small', null, t('speed') + ' · ' + t('perSecond'))),
            h('span', { className: 'au-metric' },
              h('b', null, formatDuration(elapsedMs)),
              h('small', null, t('elapsed'))))
          : h('span', { className: 'au-empty' }, t('empty')),
        // An empty session has nothing to break down, so the disclosure only
        // appears once a first reading exists.
        hasData
          ? h('button', {
            type: 'button',
            className: 'au-toggle',
            'aria-expanded': expanded,
            onClick: function () { setExpanded(function (value) { return !value }) },
          }, expanded ? t('collapse') : t('detail'))
          : null),
      expanded
        ? h('div', { className: 'au-expand' },
          phase ? h('div', { className: 'au-cell' }, h('b', null, formatDuration(Math.max(0, stageNow - stageClock.start))), h('small', null, t('phaseDuration'))) : null,
          phase ? h('div', { className: 'au-cell' }, h('b', null, new Date(stageClock.activity).toLocaleTimeString()), h('small', null, t('phaseActivity'))) : null,
          phase === 'phaseTools' ? h('div', { className: 'au-cell', style: { overflowWrap: 'anywhere' } }, h('b', null, activeTools.map(call => call.name).join(' · ')), h('small', null, t('phaseToolNames'))) : null,
          h('div', { className: 'au-cell' },
            h('b', null, formatTokens(inputTokens)),
            h('small', null, t('input') + ' · ' + t('tokens'))),
          h('div', { className: 'au-cell' },
            h('b', null, formatTokens(outputTokens)),
            h('small', null, t('output') + ' · ' + t('tokens'))),
          h('div', { className: 'au-cell' },
            h('b', null, turns + ' / ' + steps),
            h('small', null, t('turnsSteps'))),
          h('div', { className: 'au-cell' },
            h('b', null, stats && stats.ttftSteps > 0 ? formatDuration(stats.ttftMs / stats.ttftSteps) : '—'),
            h('small', null, t('ttft'))),
          h('div', { className: 'au-cell' },
            h('b', null, inputTokens > 0 && usage ? Math.round(usage.cacheReadTokens / inputTokens * 100) + '%' : '—'),
            h('small', null, t('cache'))),
          h('div', { className: 'au-cell' },
            h('b', null, formatDuration(stats ? stats.llmMs : 0) + ' / ' + formatDuration(stats ? stats.toolMs : 0)),
            h('small', null, t('modelTool'))),
          mixTotal > 0
            ? h('div', { className: 'au-context' },
              h('div', { className: 'au-context-head' },
                h('small', null, t('contextMix')),
                h('small', null, '~' + formatTokens(usedTokens) + ' / ' + formatTokens(contextWindow))),
              h('div', { className: 'au-context-bar' },
                mix.map(function (row) {
                  return h('span', {
                    key: row.key,
                    style: { width: (row.value / mixTotal * 100).toFixed(2) + '%', background: row.color },
                  })
                })),
              h('div', { className: 'au-context-legend' },
                mix.map(function (row) {
                  return h('span', { key: row.key },
                    h('i', { style: { background: row.color }, 'aria-hidden': true }),
                    t(row.key) + ' ~' + formatTokens(row.value))
                })))
            : null,
          h('div', { className: 'au-chart' },
            h(Sparkline, { values: history, t: t }),
            h('small', null, t('liveSpeed') + ' · ' + t(history.length ? 'interpolated' : 'waitingSpeed'))))
        : null)
    }

    // Same ordering and preview fallback as Chat's native turn rail. No log scans,
    // generated summaries, network requests, or persisted copies of conversation text.
    function navigationItems(loaded, outline) {
      const turns = new Map()
      if (Array.isArray(outline)) for (const row of outline) {
        if (!row || !Number.isSafeInteger(row.turn) || row.turn < 0
          || !Number.isSafeInteger(row.seq) || row.seq < 0 || Object.is(row.seq, -0)) continue
        turns.set(row.turn, { turn: row.turn, prompt: typeof row.prompt === 'string' ? row.prompt : '',
          response: typeof row.response === 'string' ? row.response : '' })
      }
      for (const row of loaded) {
        const old = turns.get(row.turn)
        turns.set(row.turn, { turn: row.turn, prompt: row.prompt || (old && old.prompt) || '',
          response: row.response || (old && old.response) || '' })
      }
      return Array.from(turns.values()).sort(function (a, b) { return a.turn - b.turn })
    }

    function AnswerNavigation(props) {
      const enabled = useEnabled()
      const marker = useRef(null)
      const loaded = props.useChat(function (snapshot) { return snapshot.navigation.items() })
      const outline = props.useProjection('turnOutline')
      const items = useMemo(function () { return navigationItems(loaded, outline) }, [loaded, outline])
      const latest = useRef(items)
      latest.current = items
      const refresh = useRef(null)
      const [view, setView] = useState(null)
      const [open, setOpen] = useState(false)
      const t = props.t

      useEffect(function () {
        if (!enabled || !marker.current) { setView(null); return }
        // Start at this session's dock and stop at its first transcript owner.
        let root = marker.current.parentElement
        while (root && !root.querySelector('[data-chat-flow]')) root = root.parentElement
        if (!root) return
        let nav = null
        let previewIndex = null
        let frame = 0
        let disposed = false
        let pointerInside = false
        setOpen(false)
        const visible = function (node) {
          return !node.closest('[hidden], [data-turn-process-hidden="true"], [data-turn-process-inline="true"], [data-variant="think"], [data-chat-group-part="reasoning"]')
            && node.getClientRects().length > 0
        }
        function update() {
          frame = 0
          if (disposed) return
          const flow = root.querySelector('[data-chat-flow]')
          const host = flow && flow.parentElement.parentElement.parentElement
          const found = host && Array.from(host.querySelectorAll('nav')).find(function (el) {
            return el.querySelector('button[data-index]') !== null
          })
          if (found !== nav) {
            detach()
            nav = found || null
            previewIndex = null
            if (nav) {
              nav.setAttribute('data-aurum-navigation', '')
              nav.addEventListener('pointerenter', enter)
              nav.addEventListener('pointerleave', leave)
              nav.addEventListener('pointermove', preview)
              nav.addEventListener('focusin', focus)
              nav.addEventListener('focusout', blur)
              nav.addEventListener('keydown', keydown)
            }
          }
          if (!nav) { setView(null); return }
          const active = nav.querySelector('button[data-index][aria-current="true"]')
          const index = previewIndex === null ? (active ? Number(active.dataset.index) : latest.current.length - 1) : previewIndex
          const item = latest.current[index]
          if (!item) { setView(null); return }
          const nodes = Array.from(root.querySelectorAll('[data-chat-flow-kind="assistant-step"][data-chat-turn]'))
            .filter(function (el) { return Number(el.dataset.chatTurn) === item.turn && visible(el) })
          const headings = nodes.flatMap(function (el) { return Array.from(el.querySelectorAll('h1, h2, h3')).filter(visible) })
          const port = flow.closest('[data-conversation-scroll]') || flow.parentElement
          const line = port.getBoundingClientRect().top + Math.min(100, port.clientHeight / 3)
          let current = -1
          headings.forEach(function (el, i) { if (el.getBoundingClientRect().top <= line) current = i })
          setView(function (old) {
            if (old && old.nav === nav && old.item === item && old.current === current && old.loaded === (nodes.length > 0)
              && old.headings.length === headings.length && headings.every(function (el, i) {
                return old.headings[i].element === el && old.headings[i].text === el.textContent
              })) return old
            return { nav: nav, item: item, loaded: nodes.length > 0, current: current,
              headings: headings.map(function (el) { return { element: el, text: el.textContent, level: el.tagName.slice(1) } }) }
          })
        }
        function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(update) }
        function enter() { pointerInside = true; setOpen(true); schedule() }
        function leave() { pointerInside = false; previewIndex = null; setOpen(false); schedule() }
        function preview(event) {
          const button = event.target.closest('button[data-index]')
          if (button && nav.contains(button)) { previewIndex = Number(button.dataset.index); schedule() }
        }
        function focus(event) { setOpen(true); preview(event) }
        function blur(event) { if (!pointerInside && !nav.contains(event.relatedTarget)) leave() }
        function keydown(event) {
          if (event.key === 'Escape') {
            event.preventDefault()
            // Move focus out of the now-hidden panel, retaining keyboard access to the rail.
            nav.querySelector('button[data-index][aria-current="true"], button[data-index]')?.focus({ preventScroll: true })
            setOpen(false)
          }
        }
        function detach() {
          if (!nav) return
          nav.removeAttribute('data-aurum-navigation')
          nav.removeAttribute('data-au-open')
          for (const pair of [['pointerenter', enter], ['pointerleave', leave], ['pointermove', preview],
            ['focusin', focus], ['focusout', blur], ['keydown', keydown]]) nav.removeEventListener(pair[0], pair[1])
        }
        const observer = new MutationObserver(function (records) {
          if (records.some(function (record) {
            const el = record.target.nodeType === 1 ? record.target : record.target.parentElement
            return !el?.closest('[data-au-navigation-ui]')
          })) schedule()
        })
        observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
          attributeFilter: ['aria-current', 'data-chat-turn', 'data-turn-process-hidden', 'data-turn-process-inline', 'hidden'] })
        root.addEventListener('scroll', schedule, true)
        window.addEventListener('resize', schedule)
        refresh.current = schedule
        update()
        return function () {
          disposed = true; refresh.current = null
          observer.disconnect(); root.removeEventListener('scroll', schedule, true)
          window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); detach()
        }
      }, [enabled, props.sessionId, items.length >= 2])
      useEffect(function () { if (refresh.current) refresh.current() }, [items])
      useEffect(function () {
        if (!view) return
        if (open) view.nav.setAttribute('data-au-open', '')
        else view.nav.removeAttribute('data-au-open')
      }, [view, open])

      function jump(heading) {
        const target = heading.element
        if (!target.isConnected) return
        // Use the owner's turn gesture first: it releases follow-tail and cancels
        // pending history jumps before we align the heading inside that turn.
        const index = items.findIndex(function (row) { return row.turn === view.item.turn })
        const mark = view.nav.querySelector('button[data-index="' + index + '"]')
        if (!mark) return
        mark.click()
        const flow = target.closest('[data-chat-flow]')
        const port = flow && (flow.closest('[data-conversation-scroll]') || flow.parentElement)
        if (!port) return
        port.scrollTo({ top: port.scrollTop + target.getBoundingClientRect().top - port.getBoundingClientRect().top - 16,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        // Keep focus on the directory control. Moving it into the transcript
        // used to fire focusout and dismiss the overview after each jump.
      }
      return h(React.Fragment, null,
        h('span', { ref: marker, hidden: true, 'data-aurum-navigation-seat': '' }),
        enabled && view ? createPortal(h(React.Fragment, null,
          h('section', { className: 'au-nav-panel', hidden: !open, 'data-au-navigation-ui': '', 'aria-label': t('navTitle') },
            h('div', { className: 'au-nav-title' }, t('navTitle') + ' · ' + (latest.current.findIndex(function (row) { return row.turn === view.item.turn }) + 1) + ' / ' + items.length),
            h('div', { className: 'au-nav-prompt' }, view.item.prompt),
            h('div', { className: 'au-nav-caption' }, t('navExcerpt')),
            h('div', { className: 'au-nav-excerpt' }, view.item.response || t('navEmpty')),
            h('div', { className: 'au-nav-outline' },
              h('div', { className: 'au-nav-caption' }, t('navOutline')),
              view.headings.length ? view.headings.map(function (heading, index) {
                return h('button', { key: index, type: 'button', className: 'au-nav-heading', 'data-level': heading.level,
                  'aria-current': index === view.current ? 'location' : undefined,
                  onClick: function () { jump(heading) } }, heading.text)
              }) : h('div', { className: 'au-nav-caption' }, t(view.loaded ? 'navNoHeadings' : 'navUnloaded'))))), view.nav) : null)
    }

    function ThemeRow(props) {
      const t = props.t
      const enabled = useEnabled()
      const palette = ['#faf9f6', '#cccac3', '#c9a227', '#252629', '#151617']
      return h('div', { className: 'au-set', 'data-aurum-settings': '' },
        h('div', { className: 'au-set-head' },
          h('div', { className: 'au-set-text' },
            h('div', { className: 'au-set-title' },
              t('settingsTitle'),
              h('span', { className: 'au-set-badge' }, 'AURUM')),
            h('div', { className: 'au-set-desc' }, t('settingsDesc'))),
          h('div', { className: 'au-set-control' },
            h('span', { className: 'au-set-state' }, enabled ? t('settingsOn') : t('settingsOff')),
            h('button', {
              type: 'button',
              role: 'switch',
              className: 'au-switch',
              'aria-checked': enabled,
              'aria-label': t('settingsTitle'),
              onClick: function () { setEnabled(!enabled) },
            }))),
        h('div', { className: 'au-set-foot' },
          h('span', { className: 'au-set-palette', 'aria-hidden': true },
            palette.map(function (color) {
              return h('i', { key: color, style: { background: color } })
            })),
          h('span', { className: 'au-set-hint' }, t('settingsHint'))))
    }

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.locale.register(NS, { zh: zh, en: en })
      }, 'aurum-theme: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.effect(installStyle, 'aurum-theme: stylesheet')

      ctx.effect(function () {
        let disposeLayer = null
        let marker = false
        function sync() {
          const on = state.enabled
          if (on && disposeLayer === null) disposeLayer = ctx.theme.overrideTokens(PACKAGE, buildLayer())
          else if (!on && disposeLayer !== null) {
            disposeLayer()
            disposeLayer = null
          }
          if (typeof document === 'undefined') return
          if (on && !marker) {
            document.body.setAttribute(BODY_ATTR, '')
            marker = true
          } else if (!on && marker) {
            document.body.removeAttribute(BODY_ATTR)
            marker = false
          }
        }
        const unsubscribe = subscribe(sync)
        sync()
        return function () {
          unsubscribe()
          if (disposeLayer !== null) disposeLayer()
          if (typeof document !== 'undefined') document.body.removeAttribute(BODY_ATTR)
        }
      }, 'aurum-theme: palette layer')

      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'aurum-theme',
          order: 20,
          locale: NS,
          label: function () { return t('title') },
        }, TelemetryRail)
      })

      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register({ name: 'conversation.input.dock', id: 'aurum-navigation', order: 21,
          locale: NS, label: function () { return t('navTitle') } }, AnswerNavigation)
      })

      ctx.slots.inject('plugins.tab', function () {
        return ctx.slots.register({
          name: 'plugins.tab',
          id: 'aurum-theme',
          order: 50,
          locale: NS,
          label: function () { return t('settingsTitle') },
        }, ThemeRow)
      })
    }

    return { inject: ['slots', 'locale', 'theme'], apply: apply }
  },
})
