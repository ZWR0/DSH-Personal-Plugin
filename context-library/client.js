/**
 * 知忆书阁 · Custom Context — Client half.
 *
 * Settings page: category catalog, search/filter, editor, load/budget config,
 * revision history and the pending-approval ledger. Composer entry: a compact
 * book button that opens the current session's context preview, which is the
 * exact plan the Host injects on the next request.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-context-library',
  factory(require) {
    const React = require('react')
    const ReactDom = require('react-dom')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const BUILD = '0.4.0-compact-settings'
    const NS = 'contextLibrary'
    const TYPES = ['identity', 'projects', 'decisions', 'long_term']
    const TYPE_KEY = {
      identity: 'typeIdentity',
      projects: 'typeProject',
      decisions: 'typeDecision',
      long_term: 'typeLongTerm',
    }
    const SINGULAR = { identity: 'identity', projects: 'project', decisions: 'decision', long_term: 'long_term' }

    const zh = {
      compactWaiting: '待发送', compactCurrent: '已同步', compactChanged: '有更新', compactEntries: '条', compactOther: '未加载与提示', compactLast: '上次加载',
      importTitle: '添加资料', importFiles: '导入 Markdown', importFolder: '导入文件夹', importHint: '选择 Owner 或 Memory 文件，自动分类，无需编辑格式。',
      importPreview: '导入预览', importConfirm: '确认导入', importDone: '已导入 {count} 条', importPartial: '已导入 {count} 条，失败 {failed} 条。',
      importSkipped: '忽略 {count} 个说明或空文件', importNew: '新增', importUpdate: '更新（保留历史）', importEnabled: '启用', importDisabled: '停用',
      importProjectHint: '项目与决策先停用；在编辑器绑定项目目录后启用。', importLimit: '每次最多 64 个 Markdown、共 768 KB。',
      quickOwner: '我的资料（Owner）', quickMemory: '添加长期记忆', quickAgent: '设置 Agent 身份', quickOwnerBody: '## 如何称呼我\n\n## 我的背景\n\n## 稳定偏好\n',
      quickMemoryBody: '## 需要长期记住的事实或偏好\n\n', advanced: '高级设置', simpleHint: '身份写 Agent；我的资料写你自己；长期记忆写已确认的事实和偏好。',
      loadingSettings: '加载设置', entryProperties: '条目属性', editContent: '编辑', filterEntries: '筛选', previewEmpty: '暂无内容', emptyShort: '书库暂无条目',
      modeHelp: '补充模式保留原身份；自定义模式只替换 harness:identity，其余系统约束、工具、环境与历史保留。',
      strategyHelp: '自动加载相关内容并启用 Agent 建议，建议需批准后保存；仅目录按需读取；关闭停止加载和主动建议。',
      historyHelp: '已保存条目的历史版本，可恢复。Agent 建议先进入待审修订，批准后才保存。',
      changeCount: '新增 {add} 行 · 删除 {del} 行', editedDiff: '本次手动修改',
      nav: '知忆书阁',
      label: '知忆书阁',
      title: '知忆书阁',
      subtitle: '维护身份、项目、决策与长期记忆，在每次模型请求前按预算加载。Agent 只能提出修订，写入必须由你批准。',

      buildInfo: '界面 {client} · 后端 {host}',
      buildMismatch: '界面与后端版本不一致，请刷新页面；仍不一致时重载插件。',
      identityInvalid: '身份未加载：{message} 原始 Axiom 文档需要转换为书库条目；请选择已适配的 axiom-context 目录，或通过编辑器保存符合格式的身份。',
      identityReady: '身份条目有效；将在会话创建或下一次请求时尝试替换 Harness 身份。',
      metadataHint: '书库条目需要以 --- 元数据块开头，包含 id 和 type。原始 Axiom identity 目录不能直接作为适配后的书库。',
      loading: '读取中…',
      readFailed: '读取失败：{message}',
      retry: '重试',
      refresh: '刷新',
      cancel: '取消',
      close: '关闭',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      saveFailed: '保存失败：{message}',
      busy: '处理中…',

      storageTitle: '书库位置',
      storageHint: '普通 Markdown 文件，可直接阅读、备份和迁移。切换目录不会搬移、覆盖或删除旧书库。',
      rootPath: '当前绝对路径',
      chooseFolder: '选择文件夹',
      choosing: '选择文件夹中…',
      useDefault: '恢复默认位置',
      rootChanged: '书库目录已切换，旧目录保持不变。',

      modeTitle: '加载模式',
      modeSupplement: '补充模式',
      modeSupplementHint: '保留 DSH 原有系统上下文，额外加载书库内容。',
      modeCustom: '自定义模式',
      modeCustomHint: '仅用身份条目替换 Harness 身份（harness:identity），保留其余系统段落。',
      customUnavailable: '自定义模式未生效：身份条目为空、未启用，或该会话已有专属人设。',
      customAttached: '已替换 Harness 身份 · {count} 个会话',
      customErrors: '以下会话无法替换人设：{list}',
      replacementTitle: '实际替换范围',
      replacementIntro: '自定义模式只替换 system prompt 中的 harness:identity 身份声明。以下内容始终保留：',
      preservedHarness: '部署人设前缀/后缀、其余系统约束',
      preservedRuntime: '真实工作目录、沙箱与审批状态',
      preservedTools: '工具定义、工具使用约束与技能机制',
      preservedAgents: '仍然适用的项目 AGENTS.md 等指令',
      preservedHistory: '历史会话记录（不删除、不抹除）',
      cannotReplace: '无法替换：工具定义与约束、runtime context、AGENTS.md、技能机制、历史会话。补充模式下不替换任何系统段落。',

      strategyTitle: '加载策略',
      strategyAuto: '自动',
      strategyAutoHint: '自动加载相关条目，并提出待审批的修订建议。',
      strategyCatalog: '仅目录',
      strategyCatalogHint: '只注入标题与摘要目录，正文按需读取。',
      strategyOff: '关闭',
      strategyOffHint: '停止注入，Agent 也不会主动提出修订。用户文件保留。',

      budgetTitle: '加载预算',
      budgetHint: '按 DSH token-meter 估算；没有原生估算时明确标注为粗略估算。超出预算时列出省略项，绝不截断文件。',
      totalBudget: '总预算（tokens）',
      catalogBudget: '目录预算（tokens）',
      perTypeIdentity: '身份',
      perTypeProjects: '项目',
      perTypeDecisions: '决策',
      perTypeLongTerm: '长期记忆',
      suggestionsTitle: 'Agent 主动建议',
      suggestionsHint: '跟随正常聊天，不额外调用模型。只能在有聊天依据时提出，默认去重并遵守你的拒绝。检测是概率性的，不保证发现所有变化。',
      tokenNative: 'DSH token-meter',
      tokenHeuristic: '粗略估算（字符 ÷ 4）',

      catalogTitle: '目录',
      pendingNav: '待审修订',
      searchPlaceholder: '搜索 ID、标题或正文…',
      filterType: '类型',
      filterScope: '作用域',
      all: '全部',
      scopeGlobal: '全局',
      scopeProject: '项目',
      typeIdentity: '身份',
      typeProject: '项目',
      typeDecision: '决策',
      typeLongTerm: '长期记忆',
      statusActive: '生效',
      statusArchived: '已归档',
      enabledOn: '启用',
      enabledOff: '停用',
      stateLoaded: '已准备加载',
      stateCatalog: '仅目录',
      stateDisabled: '已停用',
      stateArchived: '已归档',
      stateReplaced: '已由 Harness 身份段落承载',
      stateOmitted: '超出预算',
      stateError: '格式错误',
      stateOff: '未加载',
      stateOtherProject: '其他项目',
      stateNotEnabled: '未启用加载',
      newEntry: '新建条目',
      newInType: '新建{type}',
      emptyLibrary: '书库还是空的。写下的内容才会被加载；不会替你编造身份、兴趣或项目。',
      emptyLibraryHint: '可以先用模板建立身份条目，逐项填写称呼、背景、偏好和协作习惯。',
      createTemplate: '使用身份模板',
      templateIdentityTitle: 'Agent 身份',
      templateIdentityBody: '## Agent 名称\nAxiom\n\n## 定位\n我的个人 AI 助手。\n\n## 沟通习惯\n默认中文，表达直接，说明证据与不确定性。\n\n## 原则\n如实说明能力，遵循实际工具权限。\n',
      templateHint: '新建条目并保存后才会写入磁盘。',

      editorTitle: '条目编辑',
      entryId: '稳定 ID',
      entryIdHint: '小写字母、数字、点、下划线和连字符；保存后不再改变。',
      entryTitle: '标题',
      entryType: '类型',
      entryStatus: '状态',
      entryScope: '作用域',
      entryEnabled: '启用加载',
      entryKey: '关键决策（自动加载）',
      projectPath: '绑定项目目录（绝对路径）',
      bindFolder: '选择项目目录',
      unbind: '解除绑定',
      entryBody: '内容（Markdown）',
      archive: '归档',
      unarchive: '恢复生效',
      delete: '删除',
      deleteConfirm: '再次点击确认删除',
      deleteHint: '删除会保留历史版本；审批中的修订不受影响。',
      history: '修订历史',
      noHistory: '还没有历史版本。',
      restore: '恢复',
      restoring: '恢复中…',
      restored: '已恢复旧版本',
      noSelection: '从左侧选择条目，或新建一条。',
      untitled: '未命名',
      unchanged: '内容没有变化。',
      template: '模板',

      pendingTitle: '待审修订',
      pendingEmpty: '没有待审修订。Agent 只能在聊天中发现值得保存的信息时提出建议。',
      pendingHint: '批准、编辑后批准、拒绝或本次不记都必须由你在这里明确操作。关闭页面、超时、继续聊天都不算同意。',
      approve: '同意',
      approveEdited: '编辑后同意',
      reject: '拒绝',
      defer: '本次不记',
      editBeforeApprove: '编辑提案内容',
      conflictTitle: '文件已在审批期间被修改',
      conflictHint: '建议绑定的版本是 {version}，当前版本是 {current}。未覆盖新内容，请重新对比后再次确认。',
      rebase: '以当前文件为准重新对比',
      rebasing: '重新对比中…',
      expired: '已过期，不能批准；请让 Agent 重新提出。',
      applied: '已写入',
      rejected: '已拒绝',
      deferred: '本次不记',
      evidenceUser: '用户明确陈述',
      evidenceConfirmed: '已确认结论',
      evidenceInference: '模型推断 · 待确认',
      predictedEffect: '对后续预加载的影响',
      reason: '建议理由',
      diffTitle: '修改前后差异',
      target: '目标文件',
      expires: '有效期至',
      kindCreate: '新建',
      kindUpdate: '修改',
      kindArchive: '归档',
      kindDelete: '删除',
      mergeHint: '多处相关变更已合并为一次询问。',
      noPendingDiff: '没有可显示的差异。',
      approved: '修订已写入，后续请求使用新版本。',
      approveFailed: '批准失败：{message}',
      rejectFailed: '操作失败：{message}',
      editTitle: '标题',

      entriesCount: '{count} 个条目',
      pendingCountLabel: '{count} 条待审',
      version: '版本',
      updated: '更新于',
      bytes: '字节',
      warningsTitle: '提示',
      errorsTitle: '读取问题',

      sessionTitle: '当前会话上下文',
      noSession: '请先打开一个会话。',
      openPreview: '查看当前会话加载内容',
      previewTitle: '当前会话上下文',
      previewHint: '这里展示下一次请求准备加载的内容，与真实注入使用同一份加载计划。刷新页面不会改变已加载的历史。',
      modeLabel: '模式',
      projectLabel: '项目匹配',
      projectNone: '未匹配任何项目条目',
      projectMatched: '匹配 {count} 个项目路径',
      budgetUsed: '预算占用 {used} / {total} tokens · {method}',
      loadNext: '下一次请求准备加载',
      loadActual: '最近一次请求实际加载',
      notLoaded: '待加载：本会话尚未发出携带知忆书阁上下文的请求。',
      loadedCurrent: '已加载（与下一次一致）',
      loadedStale: '历史中是旧版本；下一次请求将更新。',
      actualAt: '时间 {time}',
      versions: '条目版本',
      snapshots: '历史快照 {count} 份',
      omittedTitle: '被省略、禁用或读取失败',
      omittedHint: '以下条目没有进入下一次请求，原因已列出。',
      warningsTitle2: '读取提示',
      pendingInPreview: '待审修订不会进入上下文，也不会被描述为已记住。',
      previewRefresh: '重新计算',
      previewLoading: '正在读取加载计划…',
      previewFailed: '读取加载计划失败：{message}',
      historyNote: '旧快照仍留在历史中；本面板只描述“下一次请求”和“最近一次实际加载”，不会改写历史。',
      tokenCount: '{count} tokens',
      entryPreview: '内容预览',
      noEntriesLoaded: '本次没有加载任何条目。',
      pendingBadge: '{count} 条待审',

      errorConflict: '版本冲突，请刷新后重试。',
      errorCredential: '内容疑似包含凭据，已拒绝保存。',
      errorTooLarge: '内容超过 128 KB。',
      errorInvalidId: 'ID 不合法。',
      errorMissingProject: '项目作用域需要绑定项目目录。',
      unknownError: '未知错误',
      reasonTypeBudget: '超出该类型的预算',
      reasonTotalBudget: '超出总预算',
      perTypeUsage: '各类占用',
      notLoadedTitle: '未加载条目',
      projectPathsLabel: '匹配路径',
      actualVersions: '实际版本',
    }

    const en = {
      compactWaiting: 'Not sent', compactCurrent: 'In sync', compactChanged: 'Changed', compactEntries: 'entries', compactOther: 'Not loaded & notes', compactLast: 'Previous load',
      importTitle: 'Add context', importFiles: 'Import Markdown', importFolder: 'Import folder', importHint: 'Choose Owner or Memory files. Classification and formatting are automatic.',
      importPreview: 'Import preview', importConfirm: 'Confirm import', importDone: 'Imported {count} entries', importPartial: 'Imported {count}; failed {failed}.',
      importSkipped: 'Skipped {count} documentation or empty files', importNew: 'New', importUpdate: 'Update (history kept)', importEnabled: 'Enabled', importDisabled: 'Disabled',
      importProjectHint: 'Projects and decisions start disabled. Bind a project directory before enabling.', importLimit: 'Up to 64 Markdown files, 768 KB per import.',
      quickOwner: 'About me (Owner)', quickMemory: 'Add memory', quickAgent: 'Agent identity', quickOwnerBody: '## Name\n\n## Background\n\n## Stable preferences\n',
      quickMemoryBody: '## Confirmed facts or preferences to remember\n\n', advanced: 'Advanced settings', simpleHint: 'Identity describes the agent; Owner describes you; memory contains confirmed facts and preferences.',
      loadingSettings: 'Loading settings', entryProperties: 'Entry properties', editContent: 'Edit', filterEntries: 'Filter', previewEmpty: 'No content yet', emptyShort: 'No library entries',
      modeHelp: 'Supplement keeps the original identity. Custom replaces only harness:identity; other constraints, tools, environment, and history remain.',
      strategyHelp: 'Automatic loads relevant entries and enables agent proposals, which require approval before saving. Catalog reads on demand. Off stops loading and proposals.',
      historyHelp: 'Saved entry versions available for restore. Agent proposals appear in Pending first and are saved only after approval.',
      changeCount: '{add} lines added · {del} removed', editedDiff: 'Your edits',
      nav: 'Context Library',
      label: 'Context Library',
      title: 'Context Library',
      subtitle: 'Maintain identity, projects, decisions, and long-term memory; load a bounded selection before each request. Agents may only propose revisions — you approve every write.',

      buildInfo: 'Client {client} · Host {host}',
      buildMismatch: 'Client and Host versions differ. Refresh the page; reload the plugin if the mismatch persists.',
      identityInvalid: 'Identity not loaded: {message} Convert raw Axiom documents into library entries; select the adapted axiom-context directory or save a valid identity in the editor.',
      identityReady: 'Identity entry is valid; replacement will be attempted when a session is created or on its next request.',
      metadataHint: 'Entries require a --- metadata block with id and type. The raw Axiom identity directory is not an adapted library.',
      loading: 'Reading…',
      readFailed: 'Read failed: {message}',
      retry: 'Retry',
      refresh: 'Refresh',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      saveFailed: 'Save failed: {message}',
      busy: 'Working…',

      storageTitle: 'Library location',
      storageHint: 'Plain Markdown files you can read, back up, and move. Changing the directory never moves, overwrites, or deletes the old library.',
      rootPath: 'Current absolute path',
      chooseFolder: 'Choose folder',
      choosing: 'Choosing folder…',
      useDefault: 'Use default location',
      rootChanged: 'Library directory changed; the old directory is untouched.',

      modeTitle: 'Load mode',
      modeSupplement: 'Supplement',
      modeSupplementHint: 'Keep the original DSH system context and add the library.',
      modeCustom: 'Custom',
      modeCustomHint: 'Replace only the Harness identity (harness:identity); preserve all other system sections.',
      customUnavailable: 'Custom mode is inactive: the identity entry is empty or disabled, or this session already has its own persona.',
      customAttached: 'Harness identity replaced · {count} session(s)',
      customErrors: 'Sessions that cannot replace their persona: {list}',
      replacementTitle: 'Actual replacement scope',
      replacementIntro: 'Custom mode replaces only harness:identity in the system prompt. These are always preserved:',
      preservedHarness: 'Deployment persona prefix/suffix and other system constraints',
      preservedRuntime: 'Real working directory, sandbox and approval state',
      preservedTools: 'Tool definitions, tool constraints and the skill mechanism',
      preservedAgents: 'Applicable project AGENTS.md and other instructions',
      preservedHistory: 'Existing session history (never deleted or erased)',
      cannotReplace: 'Cannot replace: tool definitions and constraints, runtime context, AGENTS.md, the skill mechanism, or session history. Supplement mode replaces no system section.',

      strategyTitle: 'Load strategy',
      strategyAuto: 'Automatic',
      strategyAutoHint: 'Load relevant entries and propose revisions for approval.',
      strategyCatalog: 'Catalog only',
      strategyCatalogHint: 'Inject only titles and summaries; read full entries on demand.',
      strategyOff: 'Off',
      strategyOffHint: 'Stop injecting and stop agent suggestions. User files are kept.',

      budgetTitle: 'Load budget',
      budgetHint: 'Prices use the DSH token-meter; without it the panel says plainly that numbers are approximate. Over-budget entries are listed as omissions, never truncated.',
      totalBudget: 'Total budget (tokens)',
      catalogBudget: 'Catalog budget (tokens)',
      perTypeIdentity: 'Identity',
      perTypeProjects: 'Projects',
      perTypeDecisions: 'Decisions',
      perTypeLongTerm: 'Long-term',
      suggestionsTitle: 'Agent suggestions',
      suggestionsHint: 'Follows ordinary chat with no extra model calls. Proposals require chat evidence, are deduplicated, and respect your rejection. Detection is probabilistic, not guaranteed.',
      tokenNative: 'DSH token-meter',
      tokenHeuristic: 'Approximate (chars ÷ 4)',

      catalogTitle: 'Catalog',
      pendingNav: 'Pending',
      searchPlaceholder: 'Search id, title, or body…',
      filterType: 'Type',
      filterScope: 'Scope',
      all: 'All',
      scopeGlobal: 'Global',
      scopeProject: 'Project',
      typeIdentity: 'Identity',
      typeProject: 'Project',
      typeDecision: 'Decision',
      typeLongTerm: 'Long-term',
      statusActive: 'Active',
      statusArchived: 'Archived',
      enabledOn: 'Enabled',
      enabledOff: 'Disabled',
      stateLoaded: 'Will load',
      stateCatalog: 'Catalog only',
      stateDisabled: 'Disabled',
      stateArchived: 'Archived',
      stateReplaced: 'Carried by Harness identity',
      stateOmitted: 'Over budget',
      stateError: 'Format error',
      stateOff: 'Not loaded',
      stateOtherProject: 'Other project',
      stateNotEnabled: 'Not enabled',
      newEntry: 'New entry',
      newInType: 'New {type}',
      emptyLibrary: 'The library is empty. Only what you write is loaded; no identity, interest, or project is invented for you.',
      emptyLibraryHint: 'Start from the identity template and fill in how to address you, your background, preferences, and collaboration habits.',
      createTemplate: 'Use identity template',
      templateIdentityTitle: 'Identity',
      templateIdentityBody: '## Agent name\nAxiom\n\n## Role\nMy personal AI assistant.\n\n## Communication\nUse evidence and acknowledge uncertainty.\n\n## Principles\nDescribe capabilities honestly and follow actual tool permissions.\n',
      templateHint: 'A new entry is written only after you save it.',

      editorTitle: 'Entry editor',
      entryId: 'Stable id',
      entryIdHint: 'Lowercase letters, digits, dot, underscore and hyphen; immutable after save.',
      entryTitle: 'Title',
      entryType: 'Type',
      entryStatus: 'Status',
      entryScope: 'Scope',
      entryEnabled: 'Load this entry',
      entryKey: 'Key decision (auto-load)',
      projectPath: 'Bound project directory (absolute)',
      bindFolder: 'Choose project folder',
      unbind: 'Unbind',
      entryBody: 'Body (Markdown)',
      archive: 'Archive',
      unarchive: 'Restore active',
      delete: 'Delete',
      deleteConfirm: 'Click again to confirm delete',
      deleteHint: 'Deletion keeps revision history; pending proposals are unaffected.',
      history: 'Revision history',
      noHistory: 'No earlier versions yet.',
      restore: 'Restore',
      restoring: 'Restoring…',
      restored: 'Old version restored',
      noSelection: 'Select an entry on the left, or create one.',
      untitled: 'Untitled',
      unchanged: 'No content changed.',
      template: 'Template',

      pendingTitle: 'Pending revisions',
      pendingEmpty: 'No pending revisions. An agent can propose only when it finds lasting information in chat.',
      pendingHint: 'Approve, edit-and-approve, reject, or defer only here, explicitly. Closing the page, timeout, and continuing the chat are never consent.',
      approve: 'Approve',
      approveEdited: 'Edit and approve',
      reject: 'Reject',
      defer: 'Not this time',
      editBeforeApprove: 'Edit proposed content',
      conflictTitle: 'The file changed during approval',
      conflictHint: 'The proposal was bound to {version}; the current version is {current}. Nothing was overwritten. Re-compare, then confirm again.',
      rebase: 'Re-compare against the current file',
      rebasing: 'Re-comparing…',
      expired: 'Expired and cannot be approved; ask the agent to propose again.',
      applied: 'Written',
      rejected: 'Rejected',
      deferred: 'Deferred',
      evidenceUser: 'Explicitly stated',
      evidenceConfirmed: 'Confirmed conclusion',
      evidenceInference: 'Model inference · needs confirmation',
      predictedEffect: 'Effect on the next load',
      reason: 'Reason',
      diffTitle: 'Before and after',
      target: 'Target file',
      expires: 'Expires',
      kindCreate: 'Create',
      kindUpdate: 'Update',
      kindArchive: 'Archive',
      kindDelete: 'Delete',
      mergeHint: 'Related changes are merged into one question.',
      noPendingDiff: 'No diff to show.',
      approved: 'Revision written; later requests use the new version.',
      approveFailed: 'Approve failed: {message}',
      rejectFailed: 'Action failed: {message}',
      editTitle: 'Title',

      entriesCount: '{count} entries',
      pendingCountLabel: '{count} pending',
      version: 'Version',
      updated: 'Updated',
      bytes: 'bytes',
      warningsTitle: 'Notes',
      errorsTitle: 'Read problems',

      sessionTitle: 'Current session context',
      noSession: 'Open a session first.',
      openPreview: 'View what this session loads',
      previewTitle: 'Current session context',
      previewHint: 'This is the plan for the next request, built by the same loader that injects it. Refreshing does not change what is already in history.',
      modeLabel: 'Mode',
      projectLabel: 'Project match',
      projectNone: 'No project entry matched',
      projectMatched: '{count} project path(s) matched',
      budgetUsed: 'Budget {used} / {total} tokens · {method}',
      loadNext: 'Next request will load',
      loadActual: 'Last request actually loaded',
      notLoaded: 'Pending: this session has not yet sent a request carrying context-library content.',
      loadedCurrent: 'Loaded (same as next request)',
      loadedStale: 'History holds an older version; the next request will update it.',
      actualAt: 'at {time}',
      versions: 'Entry versions',
      snapshots: 'History snapshots: {count}',
      omittedTitle: 'Omitted, disabled, or failed',
      omittedHint: 'These entries are not in the next request; each reason is shown.',
      warningsTitle2: 'Read notes',
      pendingInPreview: 'Pending revisions never enter context and are never described as remembered.',
      previewRefresh: 'Recompute',
      previewLoading: 'Reading the load plan…',
      previewFailed: 'Could not read the load plan: {message}',
      historyNote: 'Older snapshots stay in history. This panel describes only “next request” and “last actual load”; it never rewrites history.',
      tokenCount: '{count} tokens',
      entryPreview: 'Content preview',
      noEntriesLoaded: 'No entries are loaded for this request.',
      pendingBadge: '{count} pending',

      errorConflict: 'Version conflict. Refresh and try again.',
      errorCredential: 'The content looks like a credential and was refused.',
      errorTooLarge: 'Content exceeds 128 KB.',
      errorInvalidId: 'Invalid id.',
      errorMissingProject: 'A project-scoped entry needs a bound project directory.',
      unknownError: 'Unknown error',
      reasonTypeBudget: 'Over this type\'s budget',
      reasonTotalBudget: 'Over the total budget',
      perTypeUsage: 'Per-type usage',
      notLoadedTitle: 'Not loaded',
      projectPathsLabel: 'Matched paths',
      actualVersions: 'Actual versions',
    }

    const CSS = [
      '.cl-root{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary);}',
      '.cl-head{display:flex;align-items:center;gap:8px;}',
      '.cl-title{margin:0;font-size:17px;line-height:25px;font-weight:600;letter-spacing:.3px;',
      'background:linear-gradient(92deg,#b8860b 0%,#e8c766 45%,#a67c00 100%);-webkit-background-clip:text;background-clip:text;color:transparent;}',
      '.cl-sub{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);}',
      '.cl-storage-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
      '.cl-storage-row .cl-path{flex:1;min-width:180px;}',
      '.cl-controls{display:grid;grid-template-columns:1fr 1.3fr;gap:24px;}',
      '.cl-control{display:flex;flex-direction:column;gap:8px;min-width:0;}',
      '.cl-control-label{font-size:11px;color:var(--dsw-alias-label-secondary);}',
      '.cl-loading-settings .cl-choice{flex-wrap:nowrap;}',
      '.cl-loading-settings .cl-choice button{min-width:0;align-items:center;text-align:center;justify-content:center;}',
      '.cl-budget[open]>.cl-fields,.cl-budget[open]>.cl-meta-grid,.cl-entry-preview[open]>.cl-pre{margin-top:12px;}',
      '.cl-entry-preview .cl-pre{max-height:300px;overflow:auto;}',
      '.cl-side>.cl-details .cl-fields{grid-template-columns:1fr;margin-top:12px;}',
      '.cl-help{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:16px;height:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:50%;font-size:10px;color:var(--dsw-alias-label-secondary);cursor:help;outline-offset:3px;}',
      '.cl-tooltip{display:none;position:absolute;top:calc(100% + 8px);left:0;z-index:30;width:260px;max-width:70vw;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 6px 24px #0002;font-size:12px;line-height:1.6;font-weight:400;overflow-wrap:anywhere;}',
      '.cl-help:hover>.cl-tooltip,.cl-help:focus>.cl-tooltip{display:block;}',
      '@media(max-width:620px){.cl-controls{grid-template-columns:1fr;gap:18px;}}',
      '.cl-switch{appearance:none;width:30px;height:18px;border-radius:20px;background:var(--dsw-alias-border-l2,#888);position:relative;cursor:pointer;transition:background .15s;flex-shrink:0;}',
      '.cl-switch::before{content:"";position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;background:#fff;transition:transform .15s;}',
      '.cl-switch:checked{background:#b8860b;}.cl-switch:checked::before{transform:translateX(12px);}',
      '.cl-switch:focus-visible{outline:2px solid #c9a227;outline-offset:3px;}.cl-switch:disabled{opacity:.5;}',
      '.cl-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;}',
      '.cl-card{padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:9px;min-width:0;}',
      '.cl-card h3{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px;}',
      '.cl-card h3::before{content:"";width:3px;height:13px;border-radius:2px;background:linear-gradient(180deg,#e8c766,#8a6a08);}',
      '.cl-hint{margin:0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);}',
      '.cl-path{margin:0;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:17px;overflow-wrap:anywhere;color:#8a6a08;}',
      '.cl-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
      '.cl-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 11px;border-radius:9px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;cursor:pointer;transition:border-color .15s,background .15s,color .15s;}',
      '.cl-btn:hover:not(:disabled){border-color:#b8860b;color:#b8860b;}',
      '.cl-btn:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}',
      '.cl-btn:disabled{opacity:.45;cursor:default;}',
      '.cl-btn.primary{border-color:rgba(184,134,11,.55);background:linear-gradient(180deg,rgba(201,162,39,.16),rgba(184,134,11,.06));color:#b8860b;}',
      '.cl-btn.danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
      '.cl-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;}',
      '.cl-field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--dsw-alias-label-secondary);}',
      '.cl-field input,.cl-field select,.cl-field textarea{font:inherit;font-size:12px;color:var(--dsw-alias-label-primary);',
      'background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 9px;min-width:0;}',
      '.cl-field textarea{min-height:260px;resize:vertical;line-height:1.6;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}',
      '.cl-field input:focus-visible,.cl-field select:focus-visible,.cl-field textarea:focus-visible{outline:2px solid #c9a227;outline-offset:1px;}',
      '.cl-choice{display:flex;gap:8px;flex-wrap:wrap;}',
      '.cl-choice button{flex:1;min-width:120px;text-align:left;white-space:normal;display:flex;flex-direction:column;gap:2px;padding:9px 11px;border-radius:10px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);font:inherit;font-size:12px;color:inherit;cursor:pointer;}',
      '.cl-choice button small{font-size:10px;line-height:15px;color:var(--dsw-alias-label-secondary);white-space:normal;overflow-wrap:anywhere;}',
      '.cl-choice button[aria-pressed="true"]{border-color:rgba(184,134,11,.65);background:linear-gradient(180deg,rgba(201,162,39,.14),rgba(184,134,11,.04));}',
      '.cl-choice button:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}',
      '.cl-workspace{display:flex;flex-direction:column;gap:18px;}',
      '.cl-workspace>.cl-side,.cl-workspace>.cl-main{width:100%;}',
      '.cl-workspace>.cl-main{border-top:1px solid var(--dsw-alias-border-l1);padding-top:18px;}',
      '.cl-workspace .cl-list{max-height:180px;}',
      '.cl-entry-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}',
      '.cl-entry-tools select{height:30px;max-width:100%;padding:0 26px 0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12px;cursor:pointer;}',
      '.cl-entry-tools select:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}',
      '.cl-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;}',
      '.cl-main>.cl-details .cl-fields{margin-top:12px;}',
      '.cl-side{display:flex;flex-direction:column;gap:8px;min-width:0;}',
      '.cl-cats{display:flex;flex-wrap:wrap;gap:5px;}',
      '.cl-cat{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);',
      'background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;cursor:pointer;}',
      '.cl-cat[aria-pressed="true"]{border-color:rgba(184,134,11,.6);color:#b8860b;background:rgba(201,162,39,.1);}',
      '.cl-cat:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}',
      '.cl-search{display:flex;align-items:center;gap:8px;padding:0 10px;height:32px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);}',
      '.cl-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:12px;}',
      '.cl-filters{display:flex;gap:6px;flex-wrap:wrap;}',
      '.cl-filters select{font:inherit;font-size:11px;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:4px 6px;}',
      '.cl-list{display:flex;flex-direction:column;gap:3px;max-height:420px;overflow:auto;padding-right:2px;}',
      '.cl-item{display:flex;flex-direction:column;gap:3px;padding:8px 9px;border-radius:10px;border:1px solid transparent;background:transparent;',
      'text-align:left;font:inherit;color:inherit;cursor:pointer;min-width:0;}',
      '.cl-item:hover{background:var(--dsw-alias-bg-layer-1);}',
      '.cl-item[aria-current="true"]{border-color:rgba(184,134,11,.5);background:rgba(201,162,39,.09);}',
      '.cl-item:focus-visible{outline:2px solid #c9a227;outline-offset:1px;}',
      '.cl-item-title{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.cl-item-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-secondary);}',
      '.cl-chip{display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);font-size:9px;letter-spacing:.3px;}',
      '.cl-chip.gold{border-color:rgba(184,134,11,.5);color:#b8860b;background:rgba(201,162,39,.08);}',
      '.cl-chip.err{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
      '.cl-main{display:flex;flex-direction:column;gap:10px;min-width:0;}',
      '.cl-empty{padding:26px 16px;border-radius:14px;border:1px dashed var(--dsw-alias-border-l2);font-size:12px;line-height:19px;',
      'color:var(--dsw-alias-label-secondary);text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;}',
      '.cl-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);}',
      '.cl-notice{margin:0;font-size:11px;line-height:17px;color:#8a6a08;}',
      '.cl-history{display:flex;flex-direction:column;gap:4px;font-size:11px;}',
      '.cl-history-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 7px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);}',
      '.cl-history-row code{font-size:10px;color:#8a6a08;}',
      '.cl-history-row .cl-btn{height:24px;font-size:10px;padding:0 8px;}',
      '.cl-pending{display:flex;flex-direction:column;gap:10px;}',
      '.cl-pending-card{display:flex;flex-direction:column;gap:8px;padding:13px 14px;border:1px solid var(--dsw-alias-border-l1);border-radius:13px;background:var(--dsw-alias-bg-layer-1);}',
      '.cl-pending-head{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;}',
      '.cl-pending-head h4{margin:0;font-size:13px;font-weight:600;flex:1;min-width:180px;}',
      '.cl-pending-actions{display:flex;gap:6px;flex-wrap:wrap;}',
      '.cl-diff{max-height:240px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);',
      'font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;line-height:16px;padding:6px 0;}',
      '.cl-diff div{padding:0 9px;white-space:pre-wrap;overflow-wrap:anywhere;}',
      '.cl-diff .add{background:rgba(60,150,90,.14);color:#2e7d4f;}',
      '.cl-diff .del{background:rgba(200,70,70,.13);color:#a33;}',
      '.cl-diff .same{color:var(--dsw-alias-label-secondary);}',
      '.cl-evidence{display:flex;gap:5px;flex-wrap:wrap;}',
      '.cl-evidence .cl-chip.inference{border-color:rgba(184,134,11,.55);color:#b8860b;}',
      '.cl-meta-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:11px;color:var(--dsw-alias-label-secondary);}',
      '.cl-meta-grid b{display:block;color:var(--dsw-alias-label-primary);font-weight:600;font-size:12px;overflow-wrap:anywhere;}',
      '.cl-section-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin:0;}',
      '.cl-section-title .cl-count{font-size:10px;font-weight:400;color:var(--dsw-alias-label-secondary);}',
      '.cl-details{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1);}',
      '.cl-details summary{cursor:pointer;font-size:12px;font-weight:600;}',
      '.cl-details summary:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}',
      '.cl-pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:18px;}',
      '.cl-book{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px;border-radius:8px;',
      'border:1px solid rgba(160,118,10,.36);background:linear-gradient(180deg,rgba(201,162,39,.14),rgba(201,162,39,.04));',
      'color:#7a5c06;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;position:relative;}',
      '.cl-book:hover{border-color:#8a6a08;color:#5c4304;}',
      '.cl-book:focus-visible{outline:2px solid #c9a227;outline-offset:3px;}',
      '.cl-book svg{display:block;}',
      '.cl-badge{display:inline-flex;align-items:center;justify-content:center;min-width:15px;height:15px;padding:0 4px;border-radius:999px;',
      'background:#b8860b;color:#1b160c;font-size:9px;font-weight:700;}',
      '.cl-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;',
      'background:rgba(10,9,6,.55);backdrop-filter:blur(3px);}',
      '.cl-dialog{width:min(480px,100%);max-height:min(76vh,640px);overflow:auto;border:1px solid rgba(184,134,11,.4);border-radius:16px;',
      'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 24px 80px #0007;padding:18px 18px 16px;display:flex;flex-direction:column;gap:12px;}',
      '.cl-dialog-head{display:flex;align-items:flex-start;gap:10px;}',
      '.cl-dialog-head h2{margin:0;font-size:15px;line-height:22px;flex:1;}',
      '.cl-dialog-head .cl-btn{height:26px;padding:0 9px;}',
      '.cl-dialog .cl-hint{font-size:11px;}',
      '.cl-plan-list{display:flex;flex-direction:column;gap:5px;}',
      '.cl-plan-item{padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:3px;}',
      '.cl-plan-item-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:600;}',
      '.cl-plan-item small{font-size:10px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;}',
      '.cl-bar{height:7px;border-radius:999px;background:var(--dsw-alias-border-l1);overflow:hidden;}',
      '.cl-bar span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#e8c766,#b8860b);}',
      '.cl-real{display:flex;flex-direction:column;gap:4px;padding:9px 11px;border-radius:10px;border:1px dashed var(--dsw-alias-border-l2);font-size:11px;line-height:17px;}',
      '.cl-book{justify-content:center;min-width:28px;height:28px;padding:0 6px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);}',
      '.cl-book:hover,.cl-book[aria-expanded="true"]{background:rgba(201,162,39,.10);border-color:transparent;color:var(--dsw-alias-label-primary);}',
      '.cl-book svg{width:16px;height:16px;}.cl-book .cl-badge{position:absolute;top:-4px;right:-5px;min-width:13px;height:13px;padding:0 3px;font-size:8px;}',
      '.cl-dialog{gap:14px;border-color:var(--dsw-alias-border-l1);box-shadow:0 20px 64px #0004;}',
      '.cl-dialog-head{align-items:center;gap:6px;}.cl-dialog-head h2{font-weight:600;}',
      '.cl-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex-shrink:0;}',
      '.cl-icon-btn:hover:not(:disabled){background:rgba(201,162,39,.10);color:var(--dsw-alias-label-primary);}',
      '.cl-icon-btn:focus-visible{outline:2px solid #c9a227;outline-offset:2px;}.cl-icon-btn:disabled{opacity:.5;cursor:default;}',
      '.cl-icon-btn.spinning svg{animation:cl-spin 1s linear infinite;}@keyframes cl-spin{to{transform:rotate(360deg);}}',
      '.cl-plan-mode,.cl-plan-status{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);}',
      '.cl-plan-status::before{content:"";display:inline-block;width:4px;height:4px;border-radius:50%;background:#b8860b;margin:0 7px 2px 0;}',
      '.cl-budget-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;}.cl-budget-line b{font-size:16px;font-weight:600;}',
      '.cl-dialog .cl-bar{height:4px;margin-top:-5px;}.cl-bar.near span{background:#b8860b;}.cl-bar.full span{background:var(--dsw-alias-state-error-primary,#b54b3e);}',
      '.cl-dialog .cl-plan-list{gap:0;}.cl-dialog .cl-plan-item{padding:10px 0;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);border-radius:0;background:transparent;}',
      '.cl-dialog .cl-plan-item-head{display:flex;align-items:baseline;gap:14px;flex-wrap:nowrap;list-style:none;cursor:pointer;}',
      '.cl-plan-item-head::-webkit-details-marker{display:none;}.cl-plan-item-head:focus-visible{outline:2px solid #c9a227;outline-offset:3px;}',
      '.cl-plan-type{font-size:11px;font-weight:400;color:var(--dsw-alias-label-secondary);flex:0 0 64px;}',
      '.cl-plan-item-head>span:last-child{overflow-wrap:anywhere;min-width:0;}.cl-entry-summary{padding:9px 0 0 78px;font-size:11px;line-height:1.6;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);}',
      '.cl-entry-summary p{margin:0 0 5px;}.cl-entry-summary code{font:inherit;}',
      '.cl-dialog>.cl-details{border:0;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0;padding:11px 0 0;background:transparent;}',
      '.cl-dialog>.cl-details summary{font-size:12px;font-weight:500;}.cl-dialog>.cl-details[open]>:not(summary){margin-top:10px;}',
      'body[data-ds-dark-theme] .cl-book{border-color:transparent;color:var(--dsw-alias-label-secondary);}',
      '@media(max-width:600px){.cl-icon-btn{width:36px;height:36px;}.cl-dialog .cl-plan-item-head{min-height:28px;align-items:center;}}',
      '@media(prefers-reduced-motion:reduce){.cl-icon-btn.spinning svg{animation:none;}}',
      'body[data-ds-dark-theme] .cl-title{background:linear-gradient(92deg,#c9a227 0%,#f0d78a 45%,#a67c00 100%);-webkit-background-clip:text;background-clip:text;}',
      'body[data-ds-dark-theme] .cl-btn.primary,body[data-ds-dark-theme] .cl-path,body[data-ds-dark-theme] .cl-notice{color:#e8c766;}',
      'body[data-ds-dark-theme] .cl-btn:hover:not(:disabled){color:#e8c766;}',
      'body[data-ds-dark-theme] .cl-book{color:#e8c766;border-color:transparent;}',
      'body[data-ds-dark-theme] .cl-book:hover{color:#f0d78a;border-color:transparent;}',
      'body[data-ds-dark-theme] .cl-diff .add{color:#8fd6a8;}',
      'body[data-ds-dark-theme] .cl-diff .del{color:#f0a0a0;}',
      'body[data-ds-dark-theme] .cl-history-row code{color:#e8c766;}',
      '@media (max-width:820px){.cl-workspace{grid-template-columns:minmax(0,1fr);}.cl-list{max-height:260px;}}',
      '@media (max-width:600px){.cl-overlay{padding:10px;}.cl-dialog{max-height:92vh;}.cl-field textarea{min-height:200px;}}',
      '@media (prefers-reduced-motion:reduce){.cl-btn,.cl-book{transition:none;}}',
      '.cl-book{position:relative;flex:none;width:28px;min-width:28px;height:28px;padding:0;border-radius:8px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);box-shadow:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.cl-book svg{width:16px;height:16px}.cl-book .cl-badge{top:-3px;right:-3px;min-width:16px;height:16px;font-size:10px;line-height:16px;background:var(--dsw-alias-link,#866719);color:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 0 0 2px var(--dsw-alias-bg-base,#faf9f6)}body[data-ds-dark-theme] .cl-book{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}.cl-book:active{filter:brightness(.92);background:var(--dsw-alias-bg-layer-2);box-shadow:none}',
      '@media(pointer:coarse),(max-width:600px){.cl-book{width:44px;min-width:44px;height:44px;border-radius:13px}}@media(hover:hover){.cl-book:hover,body[data-ds-dark-theme] .cl-book:hover{border-color:var(--dsw-alias-link,#866719);color:var(--dsw-alias-link,#866719);background:var(--dsw-alias-bg-layer-2);box-shadow:none}}@media(prefers-reduced-motion:no-preference){.cl-book{transition:transform .16s ease,box-shadow .2s ease}.cl-book:active{transform:scale(.94)}}',
    ].join('')

    function StyleTag() {
      return h('style', { key: 'cl-style', 'data-dsh-plugin': 'context-library' }, CSS)
    }

    function errorText(error) {
      if (error && typeof error === 'object' && typeof error.message === 'string') return error.message
      return String(error)
    }

    function formatTime(value) {
      if (typeof value !== 'string' || value === '') return '—'
      const time = Date.parse(value)
      if (Number.isNaN(time)) return value
      try { return new Date(time).toLocaleString() } catch { return value }
    }

    function shortPreview(text, limit) {
      const plain = String(text ?? '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`\-]+/g, ' ').replace(/\s+/g, ' ').trim()
      return plain.length > limit ? plain.slice(0, limit) + '…' : plain
    }

    function lineDiff(before, after) {
      const a = String(before ?? '').split('\n')
      const b = String(after ?? '').split('\n')
      if (a.length > 500 || b.length > 500) return { truncated: true, a, b }
      const n = a.length
      const m = b.length
      const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
        }
      }
      const rows = []
      let i = 0
      let j = 0
      while (i < n && j < m) {
        if (a[i] === b[j]) { rows.push({ type: 'same', text: a[i] }); i++; j++ }
        else if (table[i + 1][j] >= table[i][j + 1]) { rows.push({ type: 'del', text: a[i] }); i++ }
        else { rows.push({ type: 'add', text: b[j] }); j++ }
      }
      while (i < n) { rows.push({ type: 'del', text: a[i++] }) }
      while (j < m) { rows.push({ type: 'add', text: b[j++] }) }
      return { truncated: false, rows }
    }

    function TypeChip(props) {
      return h('span', { className: 'cl-chip' }, props.t(TYPE_KEY[props.type] ?? props.type))
    }

    function StatusChip(props) {
      const item = props.item
      if (!item) return null
      if (item.error) return h('span', { className: 'cl-chip err' }, props.t('stateError'))
      if (item.status === 'archived') return h('span', { className: 'cl-chip' }, props.t('stateArchived'))
      if (item.enabled === false) return h('span', { className: 'cl-chip' }, props.t('stateDisabled'))
      return h('span', { className: 'cl-chip gold' }, props.t('statusActive'))
    }

    function Diff(props) {
      const diff = useMemo(function () { return lineDiff(props.before, props.after) }, [props.before, props.after])
      if (diff.truncated) {
        return h('div', { className: 'cl-hint' },
          h('div', null, '— before —'), h('pre', { className: 'cl-pre' }, shortPreview(diff.a.join('\n'), 1200)),
          h('div', null, '— after —'), h('pre', { className: 'cl-pre' }, shortPreview(diff.b.join('\n'), 1200)))
      }
      return h('div', { className: 'cl-diff' }, diff.rows.map(function (row, index) {
        return h('div', { key: index, className: row.type }, (row.type === 'add' ? '+ ' : row.type === 'del' ? '- ' : '  ') + row.text)
      }))
    }

    function EvidenceChip(props) {
      const key = props.kind === 'user-stated' ? 'evidenceUser' : props.kind === 'confirmed' ? 'evidenceConfirmed' : 'evidenceInference'
      return h('span', { className: props.kind === 'inference' ? 'cl-chip inference' : 'cl-chip' }, props.t(key))
    }

    function kindLabel(t, kind) {
      return t(kind === 'create' ? 'kindCreate' : kind === 'update' ? 'kindUpdate' : kind === 'archive' ? 'kindArchive' : 'kindDelete')
    }

    function reasonText(t, reason) {
      switch (reason) {
        case 'other-project': return t('stateOtherProject')
        case 'not-enabled': return t('stateNotEnabled')
        case 'disabled': return t('stateDisabled')
        case 'archived': return t('stateArchived')
        case 'type-budget': return t('reasonTypeBudget')
        case 'total-budget': return t('reasonTotalBudget')
        case 'strategy-off':
        case 'plugin-off': return t('stateOff')
        case 'needs-project-scope': return t('errorMissingProject')
        case 'format': return t('stateError')
        default: return reason || ''
      }
    }

    function MarkdownImport(props) {
      const t = props.t
      const [busy, setBusy] = useState(false)
      const importUnavailable = props.hostBuild !== BUILD
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [preview, setPreview] = useState(null)
      const [documents, setDocuments] = useState([])
      const folderRef = useRef(null)
      const mounted = useRef(true)
      useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
      async function select(event) {
        const files = Array.from(event.target.files || []).filter(file => /\.md$/i.test(file.name))
        event.target.value = ''
        setPreview(null); setDocuments([]); setError(''); setNotice('')
        if (!files.length) return
        if (files.length > 64 || files.reduce((sum, file) => sum + file.size, 0) > 768 * 1024) { setError(t('importLimit')); return }
        setBusy(true)
        try {
          const docs = await Promise.all(files.map(async file => ({ path: file.webkitRelativePath || file.name, content: await file.text() })))
          const result = await props.call('importPreview', { documents: docs })
          if (mounted.current) { setDocuments(docs); setPreview(result) }
        } catch (cause) { if (mounted.current) setError(errorText(cause)) }
        finally { if (mounted.current) setBusy(false) }
      }
      async function commit() {
        setBusy(true); setError('')
        try {
          const result = await props.call('importApply', { documents, planId: preview.planId })
          if (!mounted.current) return
          setNotice(t(result.failed.length ? 'importPartial' : 'importDone', { count: result.saved.length, failed: result.failed.length }))
          setError(result.failed.map(item => item.id + ': ' + item.message).join(' · '))
          setPreview(null); setDocuments([]); props.onDone()
        } catch (cause) { if (mounted.current) { setError(errorText(cause)); setPreview(null) } }
        finally { if (mounted.current) setBusy(false) }
      }
      return h('section', { className: 'cl-card' },
        h('div', { className: 'cl-toolbar' }, h('h3', null, t('importTitle')), h(Help, { text: t('importHint') + ' ' + t('importLimit') }),
          h('span', { style: { flex: 1 } }),
          h('button', { className: 'cl-btn primary', type: 'button', disabled: busy || importUnavailable, onClick: () => folderRef.current.click(), title: importUnavailable ? t('buildMismatch') : t('importLimit') }, t('importFolder'))),
        h('input', { ref: folderRef, type: 'file', accept: '.md,text/markdown', multiple: true, webkitdirectory: '', hidden: true, 'aria-label': t('importFolder'), onChange: select }),
        error ? h('p', { className: 'cl-error', role: 'alert' }, error) : null,
        notice ? h('p', { className: 'cl-notice', role: 'status' }, notice) : null,
        preview ? h('div', null,
          h('h4', null, t('importPreview')),
          h('div', { className: 'cl-plan-list' }, preview.items.map(item => h('div', { key: item.type + '/' + item.id, className: 'cl-plan-item', title: item.sources.join('\n') + '\n' + item.preview, tabIndex: 0 },
            h('div', { className: 'cl-plan-item-head' }, h(TypeChip, { t, type: item.type }), h('span', null, item.title),
              h('span', { className: 'cl-chip' }, t(item.action === 'create' ? 'importNew' : 'importUpdate')),
              h('span', { className: 'cl-chip' }, t(item.enabled ? 'importEnabled' : 'importDisabled')))))),
          preview.items.some(item => !item.enabled) ? h('p', { className: 'cl-hint' }, t('importProjectHint')) : null,
          preview.ignored.length ? h('p', { className: 'cl-hint', title: preview.ignored.join('\n') }, t('importSkipped', { count: preview.ignored.length })) : null,
          h('div', { className: 'cl-toolbar' },
            h('button', { type: 'button', className: 'cl-btn primary', disabled: busy || !preview.items.length, onClick: commit }, busy ? t('saving') : t('importConfirm')),
            h('button', { type: 'button', className: 'cl-btn', disabled: busy, onClick: () => { setPreview(null); setDocuments([]) } }, t('cancel')))) : null)
    }

    function PlanPanel(props) {
      const t = props.t
      const data = props.data
      if (data === null) return h('p', { className: 'cl-hint' }, props.loading ? t('previewLoading') : t('noSession'))
      const plan = data.plan
      const last = data.last
      const session = data.session || {}
      if (plan === null) {
        return h('div', { className: 'cl-empty' }, t('noSession'),
          session.cwd ? h('code', { className: 'cl-path' }, session.cwd) : null)
      }
      const loaded = (plan.loaded || []).concat((plan.items || []).filter(item => item.status === 'replaced'))
      const issues = (plan.omitted || []).concat((plan.items || []).filter(item => item.error || ['disabled', 'archived', 'other-project', 'off'].includes(item.status)))
      const warnings = plan.warnings || []
      const same = last !== null && last.planId === plan.planId
      const percent = Math.round((plan.used || 0) / (plan.budget.total || 1) * 100)
      const tone = percent >= 100 ? 'full' : percent >= 85 ? 'near' : ''
      const status = last === null ? t('compactWaiting') : same ? t('compactCurrent') : t('compactChanged')
      return h(React.Fragment, null,
        h('div', { className: 'cl-toolbar' },
          h('span', { className: 'cl-plan-mode', title: plan.mode === 'custom' ? t('modeCustomHint') : t('modeSupplementHint'), tabIndex: 0 }, plan.mode === 'custom' ? t('modeCustom') : t('modeSupplement')),
          h('span', { className: 'cl-plan-status', role: 'status', title: last === null ? t('notLoaded') : t('historyNote'), tabIndex: 0 }, status)),
        h('div', { className: 'cl-budget-line', title: t('budgetUsed', { used: plan.used || 0, total: plan.budget.total, method: plan.tokenMethod === 'native-token-meter' ? t('tokenNative') : t('tokenHeuristic') }), tabIndex: 0 },
          h('b', null, (plan.used || 0) + ' / ' + plan.budget.total + ' tokens'),
          h('span', { className: 'cl-hint' }, percent + '% · ' + loaded.length + ' ' + t('compactEntries'))),
        h('div', { className: 'cl-bar ' + tone, role: 'meter', 'aria-label': t('budgetTitle'), 'aria-valuemin': 0, 'aria-valuemax': plan.budget.total, 'aria-valuenow': Math.min(plan.used || 0, plan.budget.total), 'aria-valuetext': (plan.used || 0) + ' / ' + plan.budget.total + ' tokens' },
          h('span', { style: { width: Math.min(100, Math.round((plan.used || 0) / (plan.budget.total || 1) * 100)) + '%' } })),
        loaded.length === 0 ? h('p', { className: 'cl-hint' }, t('noEntriesLoaded')) : h('div', { className: 'cl-plan-list' }, loaded.map(item =>
          h('details', { key: item.type + '/' + item.id, className: 'cl-plan-item cl-plan-entry',
            title: [item.preview, item.relPath, item.projectPath, 'v' + item.version].filter(Boolean).join('\n') },
            h('summary', { className: 'cl-plan-item-head' }, h('span', { className: 'cl-plan-type' }, t(TYPE_KEY[item.type])), h('span', null, item.title)),
            h('div', { className: 'cl-entry-summary' },
              item.preview ? h('p', null, item.preview) : null,
              h('code', null, [item.relPath, item.projectPath, item.version ? 'v' + item.version : ''].filter(Boolean).join(' · ')))))),
        issues.length + warnings.length > 0 ? h('details', { className: 'cl-details' },
          h('summary', null, t('compactOther') + ' · ' + (issues.length + warnings.length)),
          issues.map(item => h('div', { key: item.type + '/' + item.id, className: 'cl-plan-item', title: item.error || reasonText(t, item.reason) },
            h('span', null, item.title), h('small', null, item.error || reasonText(t, item.reason)))),
          warnings.map((item, index) => h('p', { key: index, className: 'cl-hint' }, item.message))) : null,
        last !== null ? h('details', { className: 'cl-details' },
          h('summary', null, t('compactLast')),
          h('p', { className: 'cl-hint' }, formatTime(last.at) + ' · ' + Object.keys(last.versions || {}).length + ' ' + t('compactEntries')),
          h('small', { title: t('historyNote') }, same ? t('loadedCurrent') : t('loadedStale'))) : null)
    }

    function PendingCard(props) {
      const t = props.t
      const proposal = props.proposal
      const [editing, setEditing] = useState(false)
      const [title, setTitle] = useState(proposal.title || '')
      const [body, setBody] = useState(proposal.afterBody || '')
      const [busy, setBusy] = useState('')
      const [error, setError] = useState('')
      const [conflict, setConflict] = useState(null)
      const expired = proposal.expired === true || (proposal.expiresAt && Date.parse(proposal.expiresAt) < Date.now())
      const editable = proposal.kind === 'create' || proposal.kind === 'update'
      const changes = useMemo(() => lineDiff(proposal.before || '', proposal.after || ''), [proposal.before, proposal.after])
      const counts = changes.truncated ? null : { add: changes.rows.filter(row => row.type === 'add').length, del: changes.rows.filter(row => row.type === 'del').length }

      const act = function (action, withEdits) {
        if (busy !== '' || expired) return
        setBusy(action); setError('')
        const payload = {
          id: proposal.id,
          action,
          expectedBaseHash: proposal.baseHash,
        }
        if (withEdits && editable) { payload.afterBody = body; payload.afterTitle = title }
        props.call('decide', payload).then(function (result) {
          setBusy('')
          if (result && result.conflict === true) {
            setConflict({ currentVersion: result.currentVersion || null, note: result.note })
            return
          }
          props.onDone(action === 'approve' ? t('approved') : action === 'reject' ? t('rejected') : t('deferred'))
        }, function (cause) {
          setBusy(''); setError(t(action === 'approve' ? 'approveFailed' : 'rejectFailed', { message: errorText(cause) }))
        })
      }

      const rebase = function () {
        if (busy !== '') return
        setBusy('rebase'); setError('')
        props.call('rebase', { id: proposal.id }).then(function (result) {
          setBusy(''); setConflict(null)
          if (result && result.proposal) {
            setTitle(result.proposal.title || title)
            setBody(result.proposal.afterBody || body)
            props.onRebased(result.proposal)
          }
        }, function (cause) { setBusy(''); setError(t('rejectFailed', { message: errorText(cause) })) })
      }

      return h('div', { className: 'cl-pending-card' },
        h('div', { className: 'cl-pending-head' },
          h('span', { className: 'cl-chip gold' }, kindLabel(t, proposal.kind)),
          h(TypeChip, { t: t, type: proposal.type }),
          h('h4', null, proposal.title || proposal.entryId),
          h('span', { className: 'cl-chip' }, proposal.entryId)),
        h('div', { className: 'cl-meta-grid' },
          h('div', null, t('target'), h('b', null, (proposal.type === 'identity' ? 'identity.md' : proposal.type + '/' + proposal.entryId + '.md'))),
          h('div', null, t('entryScope'), h('b', null, proposal.scope === 'project' ? t('scopeProject') + ': ' + (proposal.projectPath || '') : t('scopeGlobal'))),
          h('div', null, t('expires'), h('b', null, formatTime(proposal.expiresAt)))),
        h('p', { className: 'cl-hint' }, h('b', null, t('reason') + '：'), ' ', proposal.reason || ''),
        h('div', { className: 'cl-evidence' }, (proposal.evidence || []).map(function (item, index) {
          return h(EvidenceChip, { key: index, t: t, kind: item.kind })
        })),
        (proposal.evidence || []).length > 0
          ? h('ul', { className: 'cl-hint', style: { margin: 0, paddingInlineStart: '18px' } },
            proposal.evidence.map(function (item, index) { return h('li', { key: index }, item.note) }))
          : null,
        proposal.predictedEffect
          ? h('p', { className: 'cl-hint' }, t('predictedEffect') + '：', proposal.predictedEffect.note || '')
          : null,
        editable && editing
          ? h(React.Fragment, null,
            h('label', { className: 'cl-field' }, t('editTitle'), h('input', { value: title, onChange: function (e) { setTitle(e.target.value) } })),
            h('label', { className: 'cl-field' }, t('entryBody'), h('textarea', { value: body, onChange: function (e) { setBody(e.target.value) } })),
            h('h4', null, t('editedDiff')), h(Diff, { before: proposal.afterBody || '', after: body }))
          : null,
        counts ? h('p', { className: 'cl-chip gold' }, t('changeCount', counts)) : null,
        h('details', { className: 'cl-details', open: editing || conflict !== null ? true : undefined },
          h('summary', null, t('diffTitle')),
          h(Diff, { before: proposal.before || '', after: proposal.after || '' })),
        expired ? h('p', { className: 'cl-error' }, t('expired')) : null,
        conflict !== null
          ? h('div', { className: 'cl-error' },
            h('b', null, t('conflictTitle')),
            h('p', { className: 'cl-hint' }, t('conflictHint', {
              version: String(proposal.baseVersion || '—'),
              current: conflict.currentVersion === null || conflict.currentVersion === undefined ? '∅' : String(conflict.currentVersion),
            })),
            h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '', onClick: rebase },
              busy === 'rebase' ? t('rebasing') : t('rebase')))
          : null,
        error !== '' ? h('p', { className: 'cl-error', role: 'alert' }, error) : null,
        h('div', { className: 'cl-pending-actions' },
          editable ? h('button', {
            type: 'button', className: 'cl-btn', disabled: busy !== '' || expired,
            onClick: function () { setEditing(function (value) { return !value }) },
          }, t('editBeforeApprove')) : null,
          h('button', {
            type: 'button', className: 'cl-btn primary', disabled: busy !== '' || expired || conflict !== null,
            onClick: function () { act('approve', editing) },
          }, busy === 'approve' ? t('busy') : (editing ? t('approveEdited') : t('approve'))),
          h('button', {
            type: 'button', className: 'cl-btn', disabled: busy !== '' || expired,
            onClick: function () { act('reject', false) },
          }, t('reject')),
          h('button', {
            type: 'button', className: 'cl-btn', disabled: busy !== '' || expired,
            onClick: function () { act('defer', false) },
          }, t('defer'))))
    }

    function Help(props) {
      return h('span', { className: 'cl-help', tabIndex: 0, role: 'note', 'aria-label': props.text },
        h('span', { 'aria-hidden': true }, '?'), h('span', { className: 'cl-tooltip', role: 'tooltip' }, props.text))
    }

    function SettingsPage(props) {
      const t = props.t
      const [tree, setTree] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [category, setCategory] = useState('identity')
      const [query, setQuery] = useState('')
      const [scopeFilter, setScopeFilter] = useState('all')
      const [draft, setDraft] = useState(null)
      const [history, setHistory] = useState([])
      const [busy, setBusy] = useState('')
      const [confirmDelete, setConfirmDelete] = useState(false)
      const [form, setForm] = useState(null)
      const [picking, setPicking] = useState(false)
      const alive = useRef(true)
      const face = useRef(props)
      face.current = props

      const flash = function (text, isError) {
        setNotice(text)
        if (!isError) setTimeout(function () { setNotice(function (current) { return current === text ? '' : current }) }, 2600)
      }

      const loadTree = useCallback(function (quiet) {
        if (!quiet) setLoading(true)
        return face.current.call('tree', {}).then(function (value) {
          if (!alive.current) return
          setTree(value)
          setForm(value.settings)
          setError('')
        }, function (cause) {
          if (alive.current) setError(t('readFailed', { message: errorText(cause) }))
        }).then(function () { if (alive.current) setLoading(false) })
      }, [t])

      useEffect(function () {
        alive.current = true
        void loadTree(false)
        return function () { alive.current = false }
      }, [loadTree])

      const entries = tree ? tree.entries : []
      const filtered = useMemo(function () {
        const needle = query.trim().toLowerCase()
        return entries.filter(function (entry) {
          if (category !== 'pending' && entry.type !== category) return false
          if (scopeFilter !== 'all' && entry.scope !== scopeFilter) return false
          if (needle === '') return true
          const hay = [entry.id, entry.title, entry.preview, entry.projectPath].filter(Boolean).join(' ').toLowerCase()
          return hay.indexOf(needle) >= 0
        })
      }, [entries, category, scopeFilter, query])

      const openEntry = function (entry) {
        setCategory(entry.type)
        setBusy('entry'); setError(''); setConfirmDelete(false)
        face.current.call('entry', { type: entry.type, id: entry.id }).then(function (value) {
          if (!alive.current) return
          const item = value.entry
          setDraft({
            mode: 'edit', type: item.type, originalType: item.type, id: item.id, title: item.title,
            body: item.body, status: item.status, scope: item.scope, projectPath: item.projectPath || '',
            enabled: item.enabled, key: item.key, version: item.version,
          })
          setHistory(value.history || [])
          setBusy('')
        }, function (cause) { setBusy(''); setError(t('readFailed', { message: errorText(cause) })) })
      }

      const newEntry = function (type, template) {
        const kind = type || (category === 'pending' ? 'identity' : category)
        setCategory(kind)
        setConfirmDelete(false); setHistory([])
        setDraft({
          mode: 'create', type: kind, originalType: kind, id: kind === 'identity' ? 'identity' : 'note-' + Date.now().toString(36),
          title: template ? t('templateIdentityTitle') : '',
          body: template ? t('templateIdentityBody') : '',
          status: 'active', scope: 'global', projectPath: '',
          enabled: true, key: true, version: null,
        })
      }

      const updateDraft = function (patch) { setDraft(function (current) { return { ...current, ...patch } }) }

      const refreshAfterMutation = function (message) {
        flash(message)
        return loadTree(true).then(function () {
          if (draft && draft.mode === 'edit') {
            face.current.call('entry', { type: draft.originalType, id: draft.id }).then(function (value) {
              if (!alive.current) return
              setDraft(function (current) {
                if (!current || current.id !== value.entry.id) return current
                return { ...current, version: value.entry.version, title: value.entry.title, body: value.entry.body, status: value.entry.status, scope: value.entry.scope, projectPath: value.entry.projectPath || '', enabled: value.entry.enabled, key: value.entry.key }
              })
              setHistory(value.history || [])
            }, function () { /* the list refresh is still authoritative */ })
          }
        })
      }

      const saveDraft = function () {
        if (draft === null || busy !== '') return
        setBusy('save'); setError('')
        const create = draft.mode === 'create'
        const payload = {
          type: draft.type, id: create ? (draft.id || undefined) : draft.id,
          title: draft.title, body: draft.body, status: draft.status, scope: draft.scope,
          projectPath: draft.projectPath, enabled: draft.enabled, key: draft.key,
          expectedVersion: create ? null : draft.version, createOnly: create,
        }
        face.current.call('save', payload).then(function (value) {
          if (!alive.current) return
          if (value.unchanged) { setBusy(''); flash(t('unchanged')); return }
          setDraft(function (current) {
            if (!current) return current
            return { ...current, mode: 'edit', id: value.entry.id, originalType: value.entry.type, version: value.version, status: value.entry.status, scope: value.entry.scope, projectPath: value.entry.projectPath || '', enabled: value.entry.enabled, key: value.entry.key }
          })
          setBusy('')
          void refreshAfterMutation(t('saved'))
        }, function (cause) {
          setBusy(''); setError(t('saveFailed', { message: errorText(cause) }))
        })
      }

      const archiveDraft = function (archived) {
        if (draft === null || busy !== '') return
        setBusy('archive'); setError('')
        face.current.call('save', {
          type: draft.type, id: draft.id, title: draft.title, body: draft.body,
          status: archived ? 'archived' : 'active', scope: draft.scope, projectPath: draft.projectPath,
          enabled: draft.enabled, key: draft.key, expectedVersion: draft.version,
        }).then(function () {
          if (!alive.current) return
          setDraft(function (current) { return current ? { ...current, status: archived ? 'archived' : 'active' } : current })
          setBusy(''); void refreshAfterMutation(t('saved'))
        }, function (cause) { setBusy(''); setError(t('saveFailed', { message: errorText(cause) })) })
      }

      const deleteDraft = function () {
        if (draft === null || draft.mode !== 'edit' || busy !== '') return
        if (!confirmDelete) { setConfirmDelete(true); setTimeout(function () { if (alive.current) setConfirmDelete(false) }, 4000); return }
        setBusy('delete'); setError('')
        face.current.call('delete', { type: draft.type, id: draft.id, expectedVersion: draft.version, confirm: true }).then(function () {
          if (!alive.current) return
          setBusy(''); setDraft(null); setHistory([]); setConfirmDelete(false)
          void refreshAfterMutation(t('saved'))
        }, function (cause) { setBusy(''); setError(t('saveFailed', { message: errorText(cause) })) })
      }

      const restore = function (row) {
        if (draft === null || busy !== '') return
        setBusy('restore'); setError('')
        face.current.call('restore', { type: draft.type, id: draft.id, version: row.version }).then(function () {
          if (!alive.current) return
          setBusy(''); void refreshAfterMutation(t('restored'))
        }, function (cause) { setBusy(''); setError(t('saveFailed', { message: errorText(cause) })) })
      }

      const pickProject = function () {
        if (picking) return
        setPicking(true)
        Promise.resolve(face.current.pickDirectory()).then(function (value) {
          if (!alive.current) return
          if (typeof value === 'string' && value !== '') updateDraft({ projectPath: value, scope: 'project' })
        }, function (cause) { setError(errorText(cause)) }).then(function () { if (alive.current) setPicking(false) })
      }

      const pickRoot = function () {
        if (picking || form === null) return
        setPicking(true)
        Promise.resolve(face.current.pickDirectory()).then(function (value) {
          if (!alive.current || typeof value !== 'string' || value === '') return
          return face.current.call('saveSettings', { root: value }).then(function (result) {
            if (!alive.current) return
            flash(t('rootChanged'))
            setForm(result.settings)
            void loadTree(true)
          })
        }, function (cause) { setError(errorText(cause)) }).then(function () { if (alive.current) setPicking(false) })
      }

      const saveSettings = function (patch, message) {
        if (form === null || busy !== '') return
        const next = { ...form, ...patch }
        setForm(next)
        setBusy('settings'); setError('')
        face.current.call('saveSettings', next).then(function (result) {
          if (!alive.current) return
          setBusy('')
          setForm(result.settings)
          flash(message || t('saved'))
          void loadTree(true)
        }, function (cause) { setBusy(''); setError(errorText(cause)); void loadTree(true) })
      }

      const resetRoot = function () {
        if (form === null || busy !== '') return
        setBusy('settings'); setError('')
        face.current.call('saveSettings', { root: '' }).then(function (result) {
          if (!alive.current) return
          setBusy(''); setForm(result.settings); flash(t('rootChanged')); void loadTree(true)
        }, function (cause) { setBusy(''); setError(errorText(cause)) })
      }

      const onPendingDone = function (message) {
        flash(message)
        void loadTree(true)
      }

      const pending = tree ? tree.pending || [] : []
      const settings = form || (tree ? tree.settings : null)
      const replacement = tree ? tree.replacement : null
      const counts = tree ? (tree.entries || []).reduce(function (acc, entry) {
        acc[entry.type] = (acc[entry.type] || 0) + 1
        return acc
      }, {}) : {}

      return h('div', { className: 'cl-root' },
        h(StyleTag),
        h('div', { className: 'cl-head' },
          h('h2', { className: 'cl-title' }, t('title')),
          h(Help, { text: t('subtitle') + ' ' + t('buildInfo', { client: BUILD, host: tree && tree.build || '—' }) })),
        tree && tree.build !== BUILD ? h('p', { className: 'cl-error', role: 'status' }, t('buildMismatch')) : null,
        error !== '' ? h('p', { className: 'cl-error', role: 'alert' }, error) : null,
        notice !== '' ? h('p', { className: 'cl-notice', role: 'status' }, notice) : null,
        loading && tree === null ? h('div', { className: 'cl-empty' }, t('loading')) : null,

        tree !== null && settings !== null ? h(React.Fragment, null,
          h('section', { className: 'cl-card cl-storage' },
            h('div', { className: 'cl-toolbar' }, h('h3', null, t('storageTitle')), h(Help, { text: t('storageHint') + ' ' + t('metadataHint') })),
            h('div', { className: 'cl-storage-row' },
              h('code', { className: 'cl-path', title: tree.root }, tree.root),
              h('div', { className: 'cl-toolbar' },
                h('button', { type: 'button', className: 'cl-btn primary', disabled: picking || busy !== '', onClick: pickRoot }, picking ? t('choosing') : t('chooseFolder')),
                h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '', onClick: resetRoot }, t('useDefault')))),
            entries.some(entry => entry.type === 'identity' && entry.error)
              ? h('p', { className: 'cl-error', role: 'alert' }, t('identityInvalid', { message: entries.find(entry => entry.type === 'identity' && entry.error).error })) : null),
          h('section', { className: 'cl-card cl-loading-settings' },
            h('h3', null, t('loadingSettings')),
            h('div', { className: 'cl-controls' },
              h('div', { className: 'cl-control' },
                h('div', { className: 'cl-toolbar cl-control-label' }, t('modeTitle'), h(Help, { text: t('modeHelp') })),
                h('div', { className: 'cl-choice', role: 'group', 'aria-label': t('modeTitle') },
                  h('button', { type: 'button', 'aria-pressed': settings.mode === 'supplement', disabled: busy !== '', title: t('modeSupplementHint'), onClick: () => saveSettings({ mode: 'supplement' }) }, t('modeSupplement')),
                  h('button', { type: 'button', 'aria-pressed': settings.mode === 'custom', disabled: busy !== '', title: t('modeCustomHint'), onClick: () => saveSettings({ mode: 'custom' }) }, t('modeCustom')))),
              h('div', { className: 'cl-control' },
                h('div', { className: 'cl-toolbar cl-control-label' }, t('strategyTitle'), h(Help, { text: t('strategyHelp') })),
                h('div', { className: 'cl-choice', role: 'group', 'aria-label': t('strategyTitle') },
                  h('button', { type: 'button', 'aria-pressed': settings.strategy === 'auto', disabled: busy !== '', title: t('strategyAutoHint'), onClick: () => saveSettings({ strategy: 'auto', suggestions: true }) }, t('strategyAuto')),
                  h('button', { type: 'button', 'aria-pressed': settings.strategy === 'catalog', disabled: busy !== '', title: t('strategyCatalogHint'), onClick: () => saveSettings({ strategy: 'catalog', suggestions: false }) }, t('strategyCatalog')),
                  h('button', { type: 'button', 'aria-pressed': settings.strategy === 'off', disabled: busy !== '', title: t('strategyOffHint'), onClick: () => saveSettings({ strategy: 'off', suggestions: false }) }, t('strategyOff'))))),
            replacement !== null && replacement.sections[0].errors.length > 0
              ? h('p', { className: 'cl-error' }, t('customErrors', { list: replacement.sections[0].errors.map(item => item.sessionId.slice(0, 16)).join(', ') })) : null),
          h(MarkdownImport, { t, hostBuild: tree.build, call: face.current.call, onDone: () => { void loadTree(true) } }),
            h('details', { className: 'cl-details cl-budget' },
              h('summary', { title: t('budgetHint') }, t('budgetTitle')),
              h('div', { className: 'cl-fields' },
                h('label', { className: 'cl-field' }, t('totalBudget'),
                  h('input', {
                    type: 'number', min: 200, step: 100, value: settings.budgetTokens, disabled: busy !== '',
                    onChange: function (event) { setForm({ ...form, budgetTokens: Number(event.target.value) }) },
                    onBlur: function () { saveSettings({ budgetTokens: Number(form.budgetTokens) }) },
                  })),
                h('label', { className: 'cl-field' }, t('catalogBudget'),
                  h('input', {
                    type: 'number', min: 0, step: 50, value: settings.catalogBudget, disabled: busy !== '',
                    onChange: function (event) { setForm({ ...form, catalogBudget: Number(event.target.value) }) },
                    onBlur: function () { saveSettings({ catalogBudget: Number(form.catalogBudget) }) },
                  }))),
              h('div', { className: 'cl-meta-grid' },
                TYPES.map(function (type) {
                  return h('label', { key: type, className: 'cl-field' }, t(TYPE_KEY[type]) + ' · ' + (counts[type] || 0),
                    h('input', {
                      type: 'number', min: 100, step: 100, value: settings.perType[type], disabled: busy !== '',
                      onChange: function (event) { setForm({ ...form, perType: { ...form.perType, [type]: Number(event.target.value) } }) },
                      onBlur: function () { saveSettings({ perType: form.perType }) },
                    }))
                }))),
          (tree.warnings || []).length > 0
            ? h('details', { className: 'cl-details' },
              h('summary', null, t('warningsTitle') + ' · ' + tree.warnings.length),
              tree.warnings.map(function (item, index) {
                return h('p', { key: index, className: 'cl-hint' }, (item.path || '') + ' · ' + (item.message || ''))
              }))
            : null,
          h('section', { className: 'cl-card cl-workspace' },
            h('aside', { className: 'cl-side' },
              h('div', { className: 'cl-cats', role: 'group' },
                TYPES.map(function (type) {
                  return h('button', {
                    key: type, type: 'button', className: 'cl-cat', 'aria-pressed': category === type,
                    onClick: function () { setCategory(type); setDraft(null); setHistory([]) },
                  }, t(TYPE_KEY[type]) + (counts[type] ? ' ' + counts[type] : ''))
                }),
                h('button', {
                  type: 'button', className: 'cl-cat', 'aria-pressed': category === 'pending',
                  onClick: function () { setCategory('pending') },
                }, t('pendingNav') + (pending.length ? ' ' + pending.length : ''))),
              category === 'pending' ? null : h(React.Fragment, null,
                h('label', { className: 'cl-search' }, h('span', { 'aria-hidden': true }, '⌕'),
                  h('input', { type: 'search', value: query, placeholder: t('searchPlaceholder'), 'aria-label': t('searchPlaceholder'),
                    onChange: function (event) { setQuery(event.target.value) } })),
                h('div', { className: 'cl-entry-tools' },
                  h('select', { value: scopeFilter, 'aria-label': t('filterScope'), onChange: function (event) { setScopeFilter(event.target.value) } },
                    h('option', { value: 'all' }, t('filterScope') + ' · ' + t('all')),
                    h('option', { value: 'global' }, t('scopeGlobal')),
                    h('option', { value: 'project' }, t('scopeProject'))),
                h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '', onClick: function () { newEntry() } },
                  t('newInType', { type: t(TYPE_KEY[category]) })))),
              category === 'pending'
                ? h('p', { className: 'cl-hint' }, t('pendingHint'))
                : (filtered.length === 0
                  ? h('div', { className: 'cl-empty' },
                    h('span', null, entries.length === 0 ? t('emptyShort') : t('noSelection')),
                    entries.length === 0
                      ? h(React.Fragment, null,
                        h(Help, { text: t('emptyLibraryHint') }),
                        h('button', { type: 'button', className: 'cl-btn primary', disabled: busy !== '', onClick: function () { newEntry('identity', true) } }, t('createTemplate')))
                      : null)
                  : h('div', { className: 'cl-list', role: 'list' }, filtered.map(function (entry) {
                    return h('button', {
                      key: entry.type + '/' + entry.id, type: 'button', role: 'listitem', className: 'cl-item',
                      'aria-current': draft && draft.id === entry.id && draft.type === entry.type ? 'true' : undefined,
                      onClick: function () { openEntry(entry) },
                    },
                    h('span', { className: 'cl-item-title' }, entry.title || entry.id),
                    h('span', { className: 'cl-item-meta' },
                      h(TypeChip, { t: t, type: entry.type }),
                      h(StatusChip, { t: t, item: entry }),
                      entry.scope === 'project' ? h('span', { className: 'cl-chip' }, t('scopeProject')) : null,
                      h('span', null, 'v' + entry.version)),
                    entry.error ? h('span', { className: 'cl-error' }, entry.error) : null)
                  }))),
            ),
            h('section', { className: 'cl-main' },
              category === 'pending'
                ? h(React.Fragment, null,
                  h('h3', { className: 'cl-section-title' }, t('pendingTitle'), h('span', { className: 'cl-count' }, pending.length)),
                  pending.length === 0
                    ? h('div', { className: 'cl-empty' }, t('pendingEmpty'))
                    : h('div', { className: 'cl-pending' }, pending.map(function (proposal) {
                      return h(PendingCard, {
                        key: proposal.id, t: t, call: face.current.call, proposal: proposal,
                        onDone: onPendingDone,
                        onRebased: function (next) {
                          setTree(function (current) {
                            if (!current) return current
                            return { ...current, pending: current.pending.map(function (item) { return item.id === next.id ? next : item }) }
                          })
                        },
                      })
                    })))
                : draft === null
                  ? h('div', { className: 'cl-empty' },
                    h('span', null, t('noSelection')),
                    h('button', { type: 'button', className: 'cl-btn primary', disabled: busy !== '', onClick: function () { newEntry() } }, t('newEntry')))
                  : h(React.Fragment, null,
                    h('div', { className: 'cl-toolbar' },
                      h('h3', { className: 'cl-section-title' }, draft.mode === 'create' ? t('newEntry') : t('editorTitle')),
                      draft.mode === 'edit' ? h('span', { className: 'cl-hint' }, 'v' + (draft.version || '')) : h(Help, { text: t('templateHint') })),
                    h('details', { className: 'cl-details' }, h('summary', null, t('entryProperties')),
                    h('div', { className: 'cl-fields' },
                      h('label', { className: 'cl-field' }, t('entryId'),
                        h('input', {
                          value: draft.id, disabled: draft.mode === 'edit' || busy !== '',
                          placeholder: 'identity / my-project',
                          onChange: function (event) { updateDraft({ id: event.target.value }) },
                        })),
                      h('label', { className: 'cl-field' }, t('entryType'),
                        h('select', {
                          value: draft.type, disabled: draft.mode === 'edit' || busy !== '',
                          onChange: function (event) { updateDraft({ type: event.target.value }) },
                        }, TYPES.map(function (type) { return h('option', { key: type, value: type }, t(TYPE_KEY[type])) }))),
                      h('label', { className: 'cl-field' }, t('entryStatus'),
                        h('select', { value: draft.status, disabled: busy !== '', onChange: function (event) { updateDraft({ status: event.target.value }) } },
                          h('option', { value: 'active' }, t('statusActive')),
                          h('option', { value: 'archived' }, t('statusArchived')))),
                      h('label', { className: 'cl-field' }, t('entryScope'),
                        h('select', { value: draft.scope, disabled: busy !== '', onChange: function (event) { updateDraft({ scope: event.target.value }) } },
                          h('option', { value: 'global' }, t('scopeGlobal')),
                          h('option', { value: 'project' }, t('scopeProject'))))),
                    draft.scope === 'project'
                      ? h(React.Fragment, null,
                        h('label', { className: 'cl-field' }, t('projectPath'),
                          h('input', { value: draft.projectPath, disabled: busy !== '', onChange: function (event) { updateDraft({ projectPath: event.target.value }) } })),
                        h('div', { className: 'cl-toolbar' },
                          h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '' || picking, onClick: pickProject },
                            picking ? t('choosing') : t('bindFolder')),
                          draft.projectPath !== ''
                            ? h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '', onClick: function () { updateDraft({ projectPath: '' }) } }, t('unbind'))
                            : null))
                      : null),
                    h('label', { className: 'cl-field' }, t('entryTitle'),
                      h('input', { value: draft.title, disabled: busy !== '', onChange: function (event) { updateDraft({ title: event.target.value }) } })),
                    h('div', { className: 'cl-toolbar' },
                      h('label', { className: 'cl-toolbar' },
                        h('input', { type: 'checkbox', role: 'switch', className: 'cl-switch', checked: draft.enabled === true, disabled: busy !== '', onChange: function (event) { updateDraft({ enabled: event.target.checked }) } }),
                        h('span', { className: 'cl-hint' }, t('entryEnabled'))),
                      draft.type === 'decision'
                        ? h('label', { className: 'cl-toolbar' },
                          h('input', { type: 'checkbox', role: 'switch', className: 'cl-switch', checked: draft.key !== false, disabled: busy !== '', onChange: function (event) { updateDraft({ key: event.target.checked }) } }),
                          h('span', { className: 'cl-hint' }, t('entryKey')))
                        : null),
                    h('label', { className: 'cl-field' }, h('span', { className: 'cl-sr-only' }, t('entryBody')),
                      h('textarea', { value: draft.body, disabled: busy !== '', onChange: function (event) { updateDraft({ body: event.target.value }) } })),
                    h('div', { className: 'cl-toolbar' },
                      h('button', { type: 'button', className: 'cl-btn primary', disabled: busy !== '', onClick: saveDraft },
                        busy === 'save' ? t('saving') : t('save')),
                      draft.mode === 'edit'
                        ? h('button', { type: 'button', className: 'cl-btn', disabled: busy !== '', onClick: function () { archiveDraft(draft.status !== 'archived') } },
                          draft.status === 'archived' ? t('unarchive') : t('archive'))
                        : null,
                      draft.mode === 'edit'
                        ? h('button', { type: 'button', className: 'cl-btn danger', disabled: busy !== '', onClick: deleteDraft },
                          confirmDelete ? t('deleteConfirm') : t('delete'))
                        : null,
                      null),
                    h('details', { className: 'cl-details' },
                      h('summary', { title: t('historyHelp') }, t('history') + ' · ' + history.length),
                      history.length === 0
                        ? h('p', { className: 'cl-hint' }, t('noHistory'))
                        : h('div', { className: 'cl-history' }, history.map(function (row) {
                          return h('div', { key: row.file, className: 'cl-history-row' },
                            h('code', null, row.version),
                            h('span', null, formatTime(row.savedAt)),
                            h('span', null, row.actor || ''),
                            h('button', {
                              type: 'button', className: 'cl-btn', disabled: busy !== '',
                              onClick: function () { restore(row) },
                            }, busy === 'restore' ? t('restoring') : t('restore')))
                        })))))))
        : null)
    }

    function BookGlyph() {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M8 4.3C6.9 3.6 5.4 3.3 3.6 3.4c-.5 0-.9.4-.9.9v7.2c0 .5.4.9.9.9 1.6-.1 3 .2 4.4 1' }),
        h('path', { d: 'M8 4.3c1.1-.7 2.6-1 4.4-.9.5 0 .9.4.9.9v7.2c0 .5-.4.9-.9.9-1.6-.1-3 .2-4.4 1' }),
        h('path', { d: 'M8 4.3v9.1' }),
        h('path', { d: 'M9.9 2.2h3v5.4l-1.5-1.3-1.5 1.3z', fill: 'currentColor', stroke: 'none' }))
    }

    function DialogIcon(props) {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        props.close ? h('path', { d: 'M6 6l12 12M18 6L6 18' }) : h('path', { d: 'M20 7v5h-5M19 12a7 7 0 1 0-2 5M20 7l-3-3' }))
    }

    function ComposerButton(props) {
      const t = props.t
      const [open, setOpen] = useState(false)
      const [count, setCount] = useState(0)
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState('')
      const [notice, setNotice] = useState('')
      const [pendingList, setPendingList] = useState([])
      const closeRef = useRef(null)
      const dialogRef = useRef(null)
      const alive = useRef(true)
      const face = useRef(props)
      face.current = props

      useEffect(function () {
        alive.current = true
        let timer = 0
        const poll = function () {
          if (document.visibilityState === 'hidden') return
          face.current.call('count', {}).then(function (value) {
            if (alive.current) setCount(value.count || 0)
          }, function () { /* badge failures stay silent */ })
        }
        poll()
        timer = setInterval(poll, 20000)
        return function () { alive.current = false; clearInterval(timer) }
      }, [])

      const load = useCallback(function () {
        const sessionId = face.current.currentSessionId()
        if (typeof sessionId !== 'string' || sessionId === '') { setData(null); return }
        setLoading(true); setError('')
        Promise.all([
          face.current.call('plan', { sessionId }),
          face.current.call('pending', {}),
        ]).then(function (results) {
          if (!alive.current) return
          setData(results[0])
          setCount(results[0].pendingCount || 0)
          setPendingList(results[1].proposals || [])
          setLoading(false)
        }, function (cause) {
          if (!alive.current) return
          setLoading(false); setError(t('previewFailed', { message: errorText(cause) }))
        })
      }, [t])

      const openDialog = function () {
        setOpen(true); setNotice(''); setData(null)
        load()
      }

      useEffect(function () {
        if (!open) return
        const previous = document.activeElement
        const focusTimer = setTimeout(function () { if (closeRef.current) closeRef.current.focus() }, 0)
        const onKey = function (event) {
          if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); return }
          if (event.key !== 'Tab' || dialogRef.current === null) return
          const nodes = Array.from(dialogRef.current.querySelectorAll('button, summary, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter(function (node) { return node.disabled !== true && node.offsetParent !== null })
          if (nodes.length === 0) return
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
        }
        document.addEventListener('keydown', onKey, true)
        return function () {
          clearTimeout(focusTimer)
          document.removeEventListener('keydown', onKey, true)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [open])

      const onPendingDone = function (message) {
        setNotice(message)
        load()
      }

      return h(React.Fragment, null,
        h(StyleTag),
        h('button', {
          type: 'button', className: 'cl-book', title: t('openPreview'), 'aria-haspopup': 'dialog', 'aria-expanded': open,
          'aria-label': count > 0 ? t('label') + ' · ' + t('pendingBadge', { count }) : t('label'),
          onClick: openDialog,
        },
        h(BookGlyph),
        count > 0 ? h('span', { className: 'cl-badge', 'aria-hidden': true }, count > 99 ? '99+' : String(count)) : null),
        open
          ? ReactDom.createPortal(
            h('div', { className: 'cl-overlay', onMouseDown: function (event) { if (event.target === event.currentTarget) setOpen(false) } },
              h('div', {
                className: 'cl-dialog', role: 'dialog', 'aria-busy': loading, 'aria-modal': 'true', 'aria-labelledby': 'cl-preview-title', ref: dialogRef,
              },
              h(StyleTag),
              h('div', { className: 'cl-dialog-head' },
                h('h2', { id: 'cl-preview-title', title: t('previewHint'), tabIndex: 0 }, t('previewTitle')),
                h('button', { type: 'button', className: 'cl-icon-btn' + (loading ? ' spinning' : ''), title: t('previewRefresh'), 'aria-label': t('previewRefresh'), disabled: loading, onClick: load }, h(DialogIcon)),
                h('button', { type: 'button', className: 'cl-icon-btn', title: t('close'), 'aria-label': t('close'), ref: closeRef, onClick: function () { setOpen(false) } }, h(DialogIcon, { close: true }))),

              error !== '' ? h('p', { className: 'cl-error', role: 'alert' }, error) : null,
              notice !== '' ? h('p', { className: 'cl-notice', role: 'status' }, notice) : null,
              h(PlanPanel, { t: t, data: data, loading: loading }),
              pendingList.length > 0
                ? h('details', { className: 'cl-details' },
                  h('summary', null, t('pendingTitle') + ' · ' + pendingList.length),
                  h('div', { className: 'cl-pending' }, pendingList.map(function (proposal) {
                    return h(PendingCard, {
                      key: proposal.id, t: t, call: face.current.call, proposal: proposal,
                      onDone: onPendingDone,
                      onRebased: function (next) {
                        setPendingList(function (current) { return current.map(function (item) { return item.id === next.id ? next : item }) })
                      },
                    })
                  })))
                : null)),
            document.body)
          : null)
    }

    function unwrap(answer) {
      if (answer && answer.ok === true) return answer.value
      const failure = answer && answer.error ? answer.error : undefined
      throw new Error(failure ? (failure.message || failure.code) : 'context-library call failed')
    }

    function apply(ctx) {
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'context-library: dictionaries')
      const t = ctx.locale.bind(NS)
      const face = {
        call: function (endpoint, payload) {
          return ctx.connection.rpc.call('/api', 'context-library/' + endpoint, payload || {}).then(unwrap)
        },
        pickDirectory: function () {
          const desktop = globalThis.__DSH_DIRECTORY_PICKER__
          return desktop ? desktop.pick() : ctx.uiWorkspace.pickDirectory()
        },
        currentSessionId: function () {
          try { return ctx.uiSession.adapter.current.getSnapshot().key } catch { return '' }
        },
      }
      ctx.slots.inject('plugins.tab', function () {
        return ctx.slots.register({
          name: 'plugins.tab',
          id: 'context-library',
          order: 60,
          label: function () { return t('nav') },
          locale: NS,
          inject: function () { return face },
        }, SettingsPage)
      })
      ctx.slots.inject('conversation.input.left', function () {
        return ctx.slots.register({
          name: 'conversation.input.left',
          id: 'context-library',
          order: 6,
          label: function () { return t('label') },
          locale: NS,
          inject: function () { return face },
        }, ComposerButton)
      })
    }

    return { inject: ['slots', 'locale', 'connection', 'uiSession', 'uiWorkspace'], apply: apply }
  },
})
