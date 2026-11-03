// Browser module: DSH React, settings transport, and real navigation slots.
window.__ModuleLoader__.load({
  id: '@local/dsh-aurum-desktop',
  factory: (require) => {
    const React = require('react'), h = React.createElement;
    const NS = 'aurumDesktop';
    const allToolNames='open_browser health snapshot accessibility_tree list_windows find element_info click double_click move drag scroll type_text keypress focus invoke set_value activate_window wait ocr screenshot wait_for close_window move_window launch_app tools'.split(' ');
    const toolGroups=[
      ['observe',[
        ['health','检查连接','Check connection','检查桌面工具是否可用','Check desktop tool availability'],
        ['snapshot','截图与控件概览','Screen and controls','同时查看画面和界面控件','Capture the screen and UI controls'],
        ['accessibility_tree','读取界面控件','Read UI controls','查看窗口里的控件结构','Read the control hierarchy'],
        ['find','查找控件','Find controls','按文字或类型查找控件','Find controls by text or type'],
        ['element_info','查看控件详情','Inspect a control','读取控件属性和可用操作','Read control properties and actions'],
        ['ocr','识别屏幕文字','Read screen text','从画面中识别文字和位置','Recognize visible text and positions'],
        ['screenshot','截取屏幕','Take a screenshot','查看窗口或桌面的画面','Capture a window or desktop']
      ]],
      ['input',[
        ['click','单击','Click','点击控件或屏幕位置','Click a control or screen position'],
        ['double_click','双击','Double-click','双击控件或屏幕位置','Double-click a control or position'],
        ['move','移动鼠标','Move pointer','移动鼠标到指定位置','Move the pointer to a position'],
        ['drag','拖动鼠标','Drag','按指定路径拖动','Drag along a specified path'],
        ['scroll','滚动','Scroll','滚动页面或控件','Scroll a page or control'],
        ['type_text','输入文字','Type text','在当前输入位置填写文字','Enter text at the current focus'],
        ['keypress','按键与组合键','Press keys','发送按键或组合键','Send a key or key combination']
      ]],
      ['windows',[
        ['open_browser','打开网页','Open a website','独立标签页，可展示或后台运行','Open an independent tab, visible or in the background'],
        ['launch_app','启动应用','Launch an app','通过桌面启动应用，工具结束后仍可使用','Start an app that remains open after the tool exits'],
        ['list_windows','查看窗口列表','List windows','查找已打开的窗口','Find open windows'],
        ['activate_window','切换窗口','Activate a window','将目标窗口切到前台','Bring a window to the foreground'],
        ['move_window','移动窗口','Move a window','调整窗口在屏幕上的位置','Reposition a window'],
        ['close_window','关闭窗口','Close a window','请求应用关闭窗口','Ask an app to close a window'],
        ['focus','聚焦控件','Focus a control','将输入焦点移到控件','Move input focus to a control'],
        ['invoke','执行控件操作','Use a control','调用按钮、选项或展开操作','Invoke, toggle, select or expand a control'],
        ['set_value','设置控件内容','Set a control value','直接填写可编辑控件','Fill an editable control directly']
      ]],
      ['other',[
        ['wait','等待片刻','Wait briefly','等待指定时间后继续','Pause before continuing'],
        ['wait_for','等待目标出现','Wait for a target','等待窗口、控件或文字出现','Wait for a window, control or text'],
        ['tools','工具说明与管理','Tool reference and management','查看说明并管理已获准的工具','Describe and manage user-allowed tools']
      ]]
    ];
    const liteToolNames='open_browser list_windows find click scroll type_text keypress ocr screenshot wait_for launch_app tools'.split(' ');
    const defaults = {browserFirst:true,browserReuseExisting:false,browserVisible:true,browserApp:'default',browserSignIn:false,toolPreset:'full',enabledTools:allToolNames,indicatorEnabled:true,cursorIndicatorEnabled:true,remoteIndicatorVisible:true,indicatorText:'灵犀御机正在操控电脑',indicatorPosition:'top',indicatorIdleMs:800,stopShortcut:''};
    const equal=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
    const dictionaries = {
      zh: {nav:'电脑操控',title:'Windows 桌面操作',intro:'查看接管提示，使用 Esc 停止桌面操作。',mode:'工具模式',lite:'精简模式',full:'全能模式',modeHint:'精简模式保留常用工具，其余按需加载。切换模式会在当前动作结束后重载工具。',indicator:'显示接管提示',indicatorHint:'显示屏幕边缘光晕和提示条；关闭后仍可按 Esc 停止。',text:'提示文字',position:'提示位置',top:'屏幕顶部',bottom:'屏幕底部',delay:'操作结束后隐藏延时（毫秒）',delayHint:'连续动作共用提示，避免每次点击都闪烁。范围 200–3000 毫秒。',corner:'用鼠标停止操作',cornerHint:'鼠标停在屏幕左上角约 500 毫秒可拒绝后续输入；普通鼠标移动不会停止。',stop:'停止与恢复',stopHint:'用户按 Esc 后保持暂停。普通鼠标和其他按键不触发停止，程序发送的 Esc 也不触发停止。恢复前请确认 agent 的任务仍符合你的意图。',resume:'恢复桌面控制',resumed:'已请求恢复桌面控制',preview:'预览接管提示',previewed:'已请求预览；如果之前按 Esc 暂停，请先恢复控制。',save:'保存',discard:'取消修改',saved:'已保存',failed:'保存失败',unavailable:'当前宿主未提供可写设置，请在本机 DSH 中打开此页面。',invalid:'请填写 1–120 字的单行提示文字，并将隐藏延时设为 200–3000 的整数。',persistFailed:'宿主未确认设置已保存，请刷新后重试。'},
      en: {nav:'Computer Use',title:'Windows computer use',intro:'See when the agent controls your desktop. Press Esc to stop.',mode:'Tool mode',lite:'Lite',full:'Full',modeHint:'Lite keeps common tools and loads others on demand. A mode change reloads tools after the current action finishes.',indicator:'Show takeover indicator',indicatorHint:'Show the screen-edge glow and banner. Esc remains available when the indicator is off.',text:'Banner text',position:'Banner position',top:'Top of screen',bottom:'Bottom of screen',delay:'Hide delay after an action (ms)',delayHint:'Keep the indicator between consecutive actions. Range: 200–3000 ms.',corner:'Keep the mouse-corner failsafe',cornerHint:'Parking the pointer in the top-left corner for about 500 ms can refuse further input. Ordinary mouse movement does not stop control.',stop:'Stop and resume',stopHint:'Physical Esc keeps desktop input paused. Other mouse/keyboard input and agent-generated Esc do not stop control. Check the task before resuming.',resume:'Resume desktop control',resumed:'Desktop control resume requested',preview:'Preview takeover indicator',previewed:'Preview requested; resume first if you previously stopped with Esc.',save:'Save',discard:'Discard changes',saved:'Saved',failed:'Save failed',unavailable:'Writable settings are unavailable. Open this page in your local DSH host.',invalid:'Use 1–120 characters on one line and an integer hide delay between 200 and 3000.',persistFailed:'The host did not confirm the saved settings. Refresh and retry.'}
    };
    const extraCopy={
      zh:{intro:'选择 agent 使用的工具，设置接管提示与停止方式。',toolsTitle:'工具模式',toolsHint:'精简模式覆盖日常操作，需要时可继续加载更多工具。',lite:'精简',full:'全能',liteSummary:'常用工具，减少上下文占用',fullSummary:'启动时提供全部桌面工具',liteCount:'12 个初始工具',fullCount:'26 个初始工具',modeAfter:'切换模式会等当前动作结束后生效。',indicatorTitle:'接管提示',indicator:'显示屏幕边缘与提示条',indicatorHint:'让你知道 agent 何时正在操作电脑。',position:'提示位置',top:'顶部',bottom:'底部',preview:'预览接管提示',previewHint:'请先保存更改，再预览屏幕上的实际效果。',previewOff:'提示已关闭',previewOn:'接管时的屏幕示意',previewNote:'提示不抢焦点，鼠标可以穿透。',appearance:'提示的更多选项',text:'提示文字',delay:'操作后保留提示',delayHint:'连续动作保持显示，减少闪烁。200–3000 毫秒。',stop:'停止与恢复',escTitle:'按 Esc 停止操作',stopHint:'停止后保持暂停，准备好再恢复。普通鼠标移动和其他按键不会停止接管。',resume:'恢复桌面控制',extraStop:'其他停止方式',corner:'用鼠标停止操作',cornerHint:'鼠标在屏幕左上角停留约 500 毫秒后拒绝后续输入；关闭后仍可按 Esc 停止。',save:'保存更改',discard:'放弃更改',dirty:'有未保存的更改',clean:'更改后点击保存',ms:'毫秒'},
      en:{intro:'Choose the agent’s tools and how desktop control is shown and stopped.',toolsTitle:'Tool mode',toolsHint:'Lite covers everyday tasks. More tools can be loaded when needed.',lite:'Lite',full:'Full',liteSummary:'Common tools with less context',fullSummary:'All desktop tools at startup',liteCount:'12 initial tools',fullCount:'26 initial tools',modeAfter:'Mode changes take effect after the current action finishes.',indicatorTitle:'Takeover indicator',indicator:'Show screen edges and a banner',indicatorHint:'See when the agent is operating your computer.',position:'Banner position',top:'Top',bottom:'Bottom',preview:'Preview indicator',previewHint:'Save changes before previewing the actual screen indicator.',previewOff:'Indicator is off',previewOn:'Screen preview during control',previewNote:'The indicator keeps focus and lets clicks pass through.',appearance:'More indicator options',text:'Banner text',delay:'Keep visible after an action',delayHint:'Stay visible between consecutive actions. 200–3000 milliseconds.',stop:'Stop and resume',escTitle:'Press Esc to stop',stopHint:'Control stays paused until you resume. Ordinary mouse movement and other keys do not stop it.',resume:'Resume desktop control',extraStop:'Additional stop option',corner:'Top-left mouse-corner failsafe',cornerHint:'Refuse further input after the pointer stays in the top-left corner for about 500 ms. Turn off to use Esc alone.',save:'Save changes',discard:'Discard changes',dirty:'Unsaved changes',clean:'Save after making changes',ms:'ms'}
    };
    for(const lang of ['zh','en'])Object.assign(dictionaries[lang],extraCopy[lang]);
    Object.assign(dictionaries.zh,{intro:'选择 agent 使用的工具，设置接管提示与停止方式。',extraStop:'其他停止方式',corner:'用鼠标停止操作',cornerHint:'将鼠标移到桌面最左上角，停留约半秒，工具就会停止点击和输入。移开鼠标后可继续；Esc 始终可用。'});
    Object.assign(dictionaries.en,{extraStop:'Other ways to stop',corner:'Stop using the mouse',cornerHint:'Move the pointer to the top-left corner of the desktop and leave it there for about half a second to stop clicks and typing. Move it away to continue. Esc is always available.'});
    Object.assign(dictionaries.zh,{});
    Object.assign(dictionaries.en,{});
    Object.assign(dictionaries.zh,{extraStop:'自定义停止方式',stopHint:'停止后保持暂停，准备好再恢复。普通鼠标移动不会停止接管。',shortcutHint:'点击“录制快捷键”，再按下想用的按键或组合键，例如 F8 或 Ctrl + Alt + K。保存后生效，Esc 始终保留。',record:'录制快捷键',rerecord:'重新录制',cancelRecord:'取消录制',clearShortcut:'清除',noShortcut:'尚未设置',listening:'请按下快捷键…（Esc 取消）',unsupportedKey:'请使用字母、数字、功能键或常用按键，可搭配 Ctrl、Alt、Shift、Win。',recordCancelled:'已取消录制',recordTimedOut:'录制已超时，请点击按钮重试。'});
    Object.assign(dictionaries.en,{extraStop:'Custom stop shortcut',stopHint:'Control stays paused until you resume. Ordinary mouse movement does not stop it.',shortcutHint:'Click Record shortcut, then press a key or combination, such as F8 or Ctrl + Alt + K. Save to apply. Esc always remains available.',record:'Record shortcut',rerecord:'Record again',cancelRecord:'Cancel recording',clearShortcut:'Clear',noShortcut:'Not set',listening:'Press your shortcut… (Esc to cancel)',unsupportedKey:'Use a letter, number, function key or common key, optionally with Ctrl, Alt, Shift or Win.',recordCancelled:'Recording cancelled',recordTimedOut:'Recording timed out. Click the button to try again.'});
    Object.assign(dictionaries.zh,{clearShortcut:'恢复默认（Esc）',noShortcut:'Esc（默认）',shortcutHint:'点击“录制快捷键”，再按下想用的按键或组合键，例如 F8 或 Ctrl + Alt + K。保存后生效；恢复默认后仅保留 Esc。'});
    Object.assign(dictionaries.en,{clearShortcut:'Restore default (Esc)',noShortcut:'Esc (default)',shortcutHint:'Click Record shortcut, then press a key or combination, such as F8 or Ctrl + Alt + K. Save to apply. Restoring the default keeps only Esc.'});
    Object.assign(dictionaries.zh,{indicatorIntro:'DSH 操作桌面时，用屏幕边缘、提示条和鼠标指示提醒你。',stopIntro:'随时中断当前这一轮桌面操作。'});
    Object.assign(dictionaries.en,{indicatorIntro:'Screen edges, a status pill and a pointer indicator show when DSH is using the desktop.',stopIntro:'Interrupt the current operation series at any time.'});
    Object.assign(dictionaries.zh,{cursorIndicator:'突出显示鼠标',cursorIndicatorHint:'接管时在鼠标下方显示深色箭头与浅金描边，便于看清操作位置。停止或接管结束后自动消失。'});
    Object.assign(dictionaries.en,{cursorIndicator:'Highlight the pointer',cursorIndicatorHint:'Show a dark arrow and champagne edge at the pointer during control. They disappear when control stops or ends.'});
    Object.assign(dictionaries.zh,{toolsTitle:'工具加载',toolsHint:'默认加载全部工具。需要调整时，展开下方设置，选择 agent 可以使用的工具。',customTools:'自定义工具',toolsSelected:'已启用',toolsUnit:'个工具',allTools:'恢复默认（全部启用）',noTools:'全部关闭',toolAfter:'保存后，会在当前动作结束时更新可用工具。',toolGroup_observe:'屏幕与内容',toolGroup_input:'鼠标与键盘',toolGroup_windows:'窗口与控件',toolGroup_other:'等待与工具管理'});
    Object.assign(dictionaries.en,{toolsTitle:'Tool loading',toolsHint:'All tools are loaded by default. Expand the options below to choose which tools the agent can use.',customTools:'Customize tools',toolsSelected:'Enabled',toolsUnit:'tools',allTools:'Restore defaults (enable all)',noTools:'Disable all',toolAfter:'Saved tool changes take effect after the current action finishes.',toolGroup_observe:'Screen and content',toolGroup_input:'Mouse and keyboard',toolGroup_windows:'Windows and controls',toolGroup_other:'Waiting and tool management'});
    for(const entries of toolGroups.map(group=>group[1]))for(const [name,zh,en,zhHint,enHint]of entries){dictionaries.zh['tool_'+name]=zh;dictionaries.en['tool_'+name]=en;dictionaries.zh['toolHint_'+name]=zhHint;dictionaries.en['toolHint_'+name]=enHint;}
    Object.assign(dictionaries.zh,{toolsHint:'先选择整体加载方案，需要逐项调整时选择“自定义”。',full:'全部',fullSummary:'加载全部桌面工具，默认推荐',lite:'精简',liteSummary:'只加载常用工具，减少上下文占用',custom:'自定义',customSummary:'自己选择需要加载的工具',customTools:'自定义工具清单',allTools:'全选',customMemory:'切换方案会保留自定义清单。更改后点击保存。',lazy:'懒启动',lazySummary:'启动只加载管理入口，桌面工具按需加载',lazyCount:'启动 1 项 · 允许全部 26 项',lazyHint:'开始桌面任务时，agent 先加载所需工具，会多一次工具调用。已加载工具仍占用上下文。'});
    Object.assign(dictionaries.en,{toolsHint:'Choose a loading preset. Select Custom to choose individual tools.',full:'All',fullSummary:'Load every desktop tool; the default',lite:'Lite',liteSummary:'Common tools with less context',custom:'Custom',customSummary:'Choose exactly which tools to load',customTools:'Custom tool selection',allTools:'Select all',customMemory:'Switching presets keeps your custom selection. Save to apply.',lazy:'Lazy',lazySummary:'Start with management only; load desktop tools on demand',lazyCount:'1 at startup · all 25 allowed',lazyHint:'The agent loads tools before a desktop task, adding a tool call. Loaded tools still use context.'});
    Object.assign(dictionaries.zh,{remoteVisible:'远程与录屏可见',remoteVisibleHint:'让 UU 远程、屏幕共享和录屏看到接管提示与鼠标标识。默认开启，也适用于虚拟屏幕。'});
    Object.assign(dictionaries.en,{remoteVisible:'Visible in remote sessions and recordings',remoteVisibleHint:'Show the takeover indicator and pointer marker in remote access, screen sharing and recordings. On by default, including virtual displays.'});
    function shortcutFromEvent(event) {
      const code=event.code||'',special={Space:'Space',Enter:'Enter',NumpadEnter:'Enter',Tab:'Tab',Backspace:'Backspace',Delete:'Delete',Insert:'Insert',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Pause:'Pause',CapsLock:'CapsLock',NumLock:'NumLock',ScrollLock:'ScrollLock'};
      let key=/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)?code:special[code];
      if(!key&&event.keyCode>=65&&event.keyCode<=90)key=String.fromCharCode(event.keyCode);
      if(!key&&event.keyCode>=48&&event.keyCode<=57)key=String.fromCharCode(event.keyCode);
      if(!key&&event.keyCode>=112&&event.keyCode<=135)key='F'+(event.keyCode-111);
      return key?[event.ctrlKey&&'Ctrl',event.altKey&&'Alt',event.shiftKey&&'Shift',event.metaKey&&'Win',key].filter(Boolean).join('+'):null;
    }
    const css=`
      [data-wincu-settings]{--wcu-card:var(--dsw-alias-settings-card-fill,var(--dsw-alias-bg-layer-2,Canvas));--wcu-card-stroke:var(--dsw-alias-settings-card-stroke,var(--dsw-alias-border-l4,rgba(128,128,128,.34)));--wcu-sunken:var(--dsw-alias-bg-module-platform,color-mix(in srgb,CanvasText 4%,Canvas));--wcu-control:var(--dsw-alias-bg-layer-1,Canvas);--wcu-fg:var(--dsw-alias-label-primary,CanvasText);--wcu-muted:var(--dsw-alias-label-secondary,#61666b);--wcu-subtle:var(--dsw-alias-label-secondary,#61666b);--wcu-line:var(--dsw-alias-border-l2,rgba(128,128,128,.2));--wcu-line-strong:var(--dsw-alias-border-l3,rgba(128,128,128,.3));--wcu-hover:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));--wcu-accent:var(--dsw-alias-state-business-primary,#8b6914);--wcu-primary:var(--dsw-alias-button-primary-fill,#0f1115);--wcu-primary-fg:var(--dsw-alias-label-primary-foreground,#fff);--wcu-selected:var(--dsw-static-neutral-bluish-400,#adb2b8);--wcu-tip-bg:var(--dsw-alias-tooltip-bg,#2b2f36);--wcu-tip-fg:#fff;color:var(--wcu-fg);font:14px/1.55 var(--dsw-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif);max-width:720px;list-style:none;box-sizing:border-box;margin:0;padding:0 0 8px}
      [data-wincu-settings] *{box-sizing:border-box}
      [data-wincu-settings] h2{font-size:18px;line-height:1.4;font-weight:500;margin:0}
      [data-wincu-settings] h3{font-size:15px;line-height:22px;font-weight:500;margin:0}
      [data-wincu-settings] p{margin:4px 0 0;color:var(--wcu-muted);font-size:13px;line-height:1.55}
      [data-wincu-settings] .wcu-header{padding:0 0 12px}
      [data-wincu-settings] .wcu-header>p{color:var(--wcu-subtle)}
      [data-wincu-settings] [data-wincu-tool-count]{flex:none;font-size:12px;line-height:20px;color:var(--wcu-muted);padding:2px 10px;border-radius:999px;background:var(--wcu-sunken)}
      [data-wincu-settings] input[type=radio],[data-wincu-settings] input[type=checkbox]{accent-color:var(--wcu-accent);width:16px;height:16px;flex:none;margin:2px 0 0}
      [data-wincu-settings] summary{cursor:pointer;color:var(--wcu-fg);font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:7px;padding:11px 0;width:fit-content}
      [data-wincu-settings] summary::-webkit-details-marker{display:none}
      [data-wincu-settings] summary:before{content:'';width:0;height:0;border-style:solid;border-width:4.5px 0 4.5px 6px;border-color:transparent transparent transparent currentColor;opacity:.55;transition:transform .15s}
      [data-wincu-settings] details[open]>summary:before{transform:rotate(90deg)}
      [data-wincu-settings] .wcu-tool-detail[hidden]{display:none}
      [data-wincu-settings] .wcu-tool-body{padding:0 0 10px}
      [data-wincu-settings] .wcu-tool-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
      [data-wincu-settings] .wcu-tool-group{border:0;border-top:.5px solid var(--wcu-line);padding:10px 0 2px;margin:8px 0 0;min-width:0}
      [data-wincu-settings] .wcu-tool-group legend{float:left;width:100%;padding:0;margin:0 0 6px}
      [data-wincu-settings] .wcu-tool-group-label{display:flex;gap:8px;align-items:center;font-size:13px;font-weight:500;cursor:pointer}
      [data-wincu-settings] .wcu-tool-group-label input{margin:0}
      [data-wincu-settings] .wcu-tool-group-label .wcu-tool-count{margin-left:auto;font-weight:400}
      [data-wincu-settings] .wcu-tool-grid{clear:both;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px}
      [data-wincu-settings] .wcu-tool-item{display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:var(--dsw-radius-sm,8px);cursor:pointer;min-width:0}
      [data-wincu-settings] .wcu-tool-item:hover{background:var(--wcu-hover)}
      [data-wincu-settings] .wcu-tool-item strong{display:block;font-size:13px;font-weight:500;line-height:20px}
      [data-wincu-settings] .wcu-tool-item small{display:block;font-size:12px;color:var(--wcu-subtle);line-height:1.45}
      [data-wincu-settings] .wcu-tool-count{font-size:12px;color:var(--wcu-subtle);white-space:nowrap}
      [data-wincu-settings] .wcu-segment{display:inline-flex;width:fit-content;gap:2px;padding:2px;border-radius:10px;background:var(--wcu-control);border:.5px solid var(--wcu-line-strong)}
      [data-wincu-settings] .wcu-segment label{position:relative;display:inline-flex;align-items:center;padding:4px 14px;border-radius:8px;font-size:13px;color:var(--wcu-muted);cursor:pointer;transition:background .15s,color .15s}
      [data-wincu-settings] .wcu-segment label:has(input:checked){background:color-mix(in srgb,var(--wcu-accent) 14%,var(--wcu-control));color:var(--wcu-accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--wcu-accent) 35%,transparent)}
      [data-wincu-settings] .wcu-segment label:has(input:focus-visible){outline:2px solid var(--wcu-accent);outline-offset:1px}
      [data-wincu-settings] .wcu-segment label:has(input:disabled){opacity:.45;cursor:not-allowed}
      [data-wincu-settings] .wcu-segment input{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
      [data-wincu-settings] .wcu-control{font:inherit;font-size:13px;color:var(--wcu-fg);background:var(--wcu-control);border:.5px solid var(--wcu-line-strong);border-radius:var(--dsw-radius-sm,8px);padding:7px 10px;min-height:34px;max-width:100%;width:100%}
      [data-wincu-settings] .wcu-number{display:flex;gap:8px;align-items:center;color:var(--wcu-subtle);font-size:12px}
      [data-wincu-settings] .wcu-number input{width:100px}
      [data-wincu-settings] .wcu-key{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:38px;height:26px;padding:0 8px;font:500 12px/1 'Segoe UI',sans-serif;color:var(--wcu-fg);border:.5px solid var(--wcu-line-strong);border-bottom-width:2px;border-radius:6px;background:var(--wcu-control)}
      [data-wincu-settings] .wcu-shortcut-value[data-recording=true]{border-color:var(--wcu-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--wcu-accent) 22%,transparent)}
      [data-wincu-settings] button{font:inherit;font-size:13px;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border:.5px solid var(--wcu-line-strong);border-radius:var(--dsw-radius-md,12px);background:transparent;color:var(--wcu-fg);cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s}
      [data-wincu-settings] button:hover:enabled{background:var(--wcu-hover)}
      [data-wincu-settings] button.wcu-primary{background:var(--wcu-primary);border-color:transparent;color:var(--wcu-primary-fg)}
      [data-wincu-settings] button.wcu-primary:hover:enabled{background:var(--wcu-primary);opacity:.86}
      [data-wincu-settings] button.wcu-small{height:28px;padding:0 10px;font-size:12px;border-radius:var(--dsw-radius-sm,8px)}
      [data-wincu-settings] button:disabled,[data-wincu-settings] input:disabled,[data-wincu-settings] fieldset:disabled{opacity:.4;cursor:not-allowed}
      [data-wincu-settings] .wcu-control:focus-visible,[data-wincu-settings] button:focus-visible,[data-wincu-settings] input:focus-visible,[data-wincu-settings] summary:focus-visible{outline:2px solid var(--wcu-accent);outline-offset:2px}
      [data-wincu-settings] .wcu-footer{position:sticky;bottom:12px;z-index:1;display:flex;gap:12px;justify-content:space-between;align-items:center;margin-top:4px;padding:10px 10px 10px 16px;border:.5px solid var(--wcu-card-stroke);border-radius:var(--dsw-radius-lg,16px);background:var(--wcu-card);box-shadow:0 8px 24px rgba(0,0,0,.12)}
      [data-wincu-settings] .wcu-actions{display:flex;gap:8px}
      [data-wincu-settings] .wcu-status{font-size:12px;color:var(--wcu-subtle)}
      [data-wincu-settings] [data-tone=error]{color:var(--dsw-alias-state-error-primary,#d93f3f)}
      [data-wincu-settings] [data-tone=success]{color:var(--dsw-alias-state-success-primary,#2f9e5b)}
      [data-wincu-settings] .wcu-section{border:.5px solid var(--wcu-card-stroke);border-radius:var(--dsw-radius-xl,20px);background:var(--wcu-card);padding:8px 14px 12px;margin-bottom:10px}
      [data-wincu-settings] .wcu-section-head{display:flex;align-items:center;gap:4px;min-height:34px;margin-bottom:6px}
      [data-wincu-settings] .wcu-end{margin-left:auto}
      [data-wincu-settings] .wcu-section-head>.wcu-end{display:flex;align-items:center;gap:8px}
      [data-wincu-settings] .wcu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 16px}
      [data-wincu-settings] .wcu-item{display:flex;align-items:center;gap:12px;min-width:0}
      [data-wincu-settings] .wcu-item-main{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
      [data-wincu-settings] .wcu-item-title{display:block;font-size:14px;line-height:22px;color:var(--wcu-fg)}
      [data-wincu-settings] label.wcu-item-title{cursor:pointer}
      [data-wincu-settings] .wcu-nowrap{white-space:nowrap}
      [data-wincu-settings] .wcu-item-title .wcu-info{vertical-align:top;margin-left:2px}
      [data-wincu-settings] .wcu-caption{font-size:12px;line-height:18px;color:var(--wcu-subtle)}
      [data-wincu-settings] .wcu-hint{margin:6px 0 10px;font-size:12px;color:var(--wcu-subtle)}
      [data-wincu-settings] .wcu-item-main .wcu-hint{margin:0}
      [data-wincu-settings] .wcu-art{flex:none;display:flex;align-items:center;justify-content:center;width:96px;height:60px;border-radius:var(--dsw-radius-md,12px);background:var(--wcu-sunken);border:.5px solid var(--wcu-line);overflow:hidden;transition:border-color .15s,opacity .15s;--wcu-desk:color-mix(in srgb,var(--wcu-accent) 13%,var(--wcu-control));--wcu-bar:color-mix(in srgb,var(--wcu-fg) 7%,var(--wcu-control));--wcu-ink:color-mix(in srgb,var(--wcu-fg) 16%,transparent);--wcu-ink-strong:color-mix(in srgb,var(--wcu-fg) 34%,transparent)}
      [data-wincu-settings] .wcu-art>svg{display:block;width:100%;height:100%}
      [data-wincu-settings] label.wcu-art{cursor:pointer}
      [data-wincu-settings] label.wcu-art:hover{border-color:var(--wcu-line-strong)}
      [data-wincu-settings] .wcu-item:has(input:disabled) .wcu-art{cursor:not-allowed;opacity:.55}
      [data-wincu-settings] .wcu-art .a-win{fill:var(--wcu-control)}
      [data-wincu-settings] .wcu-art .a-frame{fill:none;stroke:var(--wcu-line-strong);stroke-width:.75}
      [data-wincu-settings] .wcu-art .a-desk{fill:var(--wcu-desk);stroke:var(--wcu-line-strong);stroke-width:.75}
      [data-wincu-settings] .wcu-art .a-bar{fill:var(--wcu-bar)}
      [data-wincu-settings] .wcu-art .a-sep{fill:none;stroke:var(--wcu-line-strong);stroke-width:.5}
      [data-wincu-settings] .wcu-art .a-ink{fill:var(--wcu-ink)}
      [data-wincu-settings] .wcu-art .a-ink2{fill:var(--wcu-ink-strong)}
      [data-wincu-settings] .wcu-art .a-acc{fill:var(--wcu-accent)}
      [data-wincu-settings] .wcu-art .a-edge{stroke:var(--wcu-accent);stroke-width:1.2}
      [data-wincu-settings] .wcu-art .a-caret{fill:none;stroke:var(--wcu-accent);stroke-width:1}
      [data-wincu-settings] .wcu-art .a-glow{fill:none;stroke:var(--wcu-accent);stroke-width:1.3}
      [data-wincu-settings] .wcu-art .a-soft{stroke-width:4;stroke-opacity:.22}
      [data-wincu-settings] .wcu-art .a-pill{fill:#23262d;stroke:rgba(255,255,255,.24);stroke-width:.6}
      [data-wincu-settings] .wcu-art .a-dot{fill:var(--wcu-accent)}
      [data-wincu-settings] .wcu-art .a-text{fill:#fff;fill-opacity:.85}
      [data-wincu-settings] .wcu-art .a-key{fill:none;stroke:#fff;stroke-opacity:.55;stroke-width:.7}
      [data-wincu-settings] .wcu-art .a-ptr{fill:#fff;stroke:#1d2025;stroke-width:1;stroke-linejoin:round}
      [data-wincu-settings] .wcu-art .a-dsh{fill:#23262d;stroke:var(--wcu-accent);stroke-width:1;stroke-linejoin:round;filter:drop-shadow(0 0 1.6px var(--wcu-accent))}
      [data-wincu-settings] .wcu-art .a-ghost{fill:none;stroke:var(--wcu-ink-strong);stroke-width:.9;stroke-dasharray:3 2}
      [data-wincu-settings] .wcu-art .a-open{fill:none;stroke:var(--wcu-accent);stroke-width:.9;stroke-dasharray:2 1.6}
      [data-wincu-settings] .wcu-art .a-eye{fill:none;stroke:var(--wcu-ink-strong);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
      [data-wincu-settings] .wcu-art .a-spot0{stop-color:var(--wcu-accent);stop-opacity:.42}
      [data-wincu-settings] .wcu-art .a-spot1{stop-color:var(--wcu-accent);stop-opacity:0}
      [data-wincu-settings] .wcu-art .a-tag{fill:#fff;font:500 7px/1 'Segoe UI',sans-serif}
      [data-wincu-settings] .wcu-art .a-cap{fill:var(--wcu-fg);font:500 12px/1 'Segoe UI',sans-serif}
      [data-wincu-settings] .wcu-item:has(.wcu-presets)>.wcu-item-main{flex:1}
      [data-wincu-settings] .wcu-segment.wcu-presets{display:flex;width:auto;align-self:stretch}
      [data-wincu-settings] .wcu-presets>label{flex:1;justify-content:center}
      [data-wincu-settings] .wcu-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:6px 16px;padding:0 0 6px}
      [data-wincu-settings] .wcu-field{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-height:36px;font-size:13px;color:var(--wcu-muted)}
      [data-wincu-settings] .wcu-field>.wcu-item-title{font-size:13px;line-height:22px;color:var(--wcu-muted)}
      [data-wincu-settings] .wcu-info{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:50%;color:var(--wcu-subtle);cursor:help;outline:none}
      [data-wincu-settings] .wcu-info>svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linecap:round}
      [data-wincu-settings] .wcu-info:hover,[data-wincu-settings] .wcu-info[data-open],[data-wincu-settings] .wcu-info:focus-visible{color:var(--wcu-fg);background:var(--wcu-hover)}
      [data-wincu-settings] .wcu-info:focus-visible{box-shadow:0 0 0 2px var(--wcu-accent)}
      [data-wincu-settings] .wcu-tip{display:none;position:fixed;inset:auto;margin:0;z-index:2147483000;width:max-content;max-width:min(300px,calc(100vw - 16px));padding:8px 11px;overflow:visible;border-radius:var(--dsw-radius-sm,8px);background:var(--wcu-tip-bg);color:var(--wcu-tip-fg);border:.5px solid rgba(255,255,255,.1);font-size:12px;font-weight:400;line-height:1.6;text-align:left;white-space:normal;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:default}
      [data-wincu-settings] .wcu-tip[data-open]{display:block;animation:wcu-tip-in .12s ease-out}
      [data-wincu-settings] .wcu-tip:after{content:'';position:absolute;width:7px;height:7px;background:inherit;border:inherit;transform:rotate(45deg)}
      [data-wincu-settings] .wcu-tip[data-side=top]:after{left:calc(var(--wcu-caret,50%) - 4px);bottom:-4px;border-top:0;border-left:0}
      [data-wincu-settings] .wcu-tip[data-side=bottom]:after{left:calc(var(--wcu-caret,50%) - 4px);top:-4px;border-bottom:0;border-right:0}
      [data-wincu-settings] .wcu-tip[data-side=left]:after{right:-4px;top:calc(50% - 4px);border-bottom:0;border-left:0}
      @keyframes wcu-tip-in{from{opacity:0}}
      [data-wincu-settings] input[role=switch]{appearance:none;flex:none;width:36px;height:20px;margin:0;border-radius:999px;background:var(--dsw-alias-border-l4,rgba(128,128,128,.38));position:relative;cursor:pointer;transition:background .15s}
      [data-wincu-settings] input[role=switch]:after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s}
      [data-wincu-settings] input[role=switch]:checked{background:var(--wcu-accent)}
      [data-wincu-settings] input[role=switch]:checked:after{transform:translateX(16px)}
      [data-wincu-settings] .wcu-field .wcu-text{width:min(190px,100%)}
      [data-wincu-settings] .wcu-detail>summary{padding:10px 0 8px}
      [data-wincu-settings] .wcu-tool-detail{margin:12px 0 0;border:.5px solid var(--wcu-line-strong);border-radius:var(--dsw-radius-md,12px);padding:0 14px}
      [data-wincu-settings] .wcu-shortcut-value{flex-wrap:wrap;align-content:center;gap:2px;padding:4px;font-size:12px;line-height:1.4;color:var(--wcu-muted);text-align:center}
      [data-wincu-settings] .wcu-shortcut-value .wcu-key{min-width:22px;height:20px;padding:0 5px;font-size:10.5px}
      [data-wincu-settings] .wcu-shortcut-value small{font-size:11px;color:var(--wcu-subtle)}
      [data-wincu-settings] .wcu-plus{font-size:9px;color:var(--wcu-subtle)}
      [data-wincu-settings] .wcu-shortcut-value:is([data-keys='3'],[data-keys='4']) .wcu-key{min-width:18px;padding:0 3px;font-size:9.5px}
      [data-wincu-settings] .wcu-shortcut-value[data-recording=true] small{flex-basis:100%}
      [data-wincu-settings] select.wcu-control{width:auto;min-width:132px;min-height:30px;padding:4px 8px;cursor:pointer}
      [data-wincu-settings] .wcu-notice{margin:12px 0 2px;padding:10px 14px 4px;border-radius:var(--dsw-radius-md,12px);background:var(--wcu-sunken);border:.5px solid var(--wcu-line);font-size:12.5px;line-height:1.6;color:var(--wcu-muted)}
      [data-wincu-settings] .wcu-notice strong{display:block;margin:0 0 2px;font-size:13px;font-weight:500;color:var(--wcu-fg)}
      [data-wincu-settings] .wcu-notice ol,[data-wincu-settings] .wcu-notice ul{margin:0 0 8px;padding-left:20px}
      [data-wincu-settings] .wcu-notice li{margin:2px 0}
      [data-wincu-settings] .wcu-address{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:4px 0}
      [data-wincu-settings] .wcu-address code{font:12px/1.5 Consolas,'Cascadia Mono',monospace;color:var(--wcu-fg);background:var(--wcu-control);border:.5px solid var(--wcu-line-strong);border-radius:6px;padding:1px 6px;user-select:all;overflow-wrap:anywhere}
      [data-wincu-settings] .wcu-address button.wcu-small{height:24px;padding:0 8px;border-radius:6px}
      [data-wincu-settings] .wcu-tool-search{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      [data-wincu-settings] .wcu-tool-search .wcu-control{min-width:0;flex:1}
      [data-wincu-settings] .wcu-tool-item:has(input:checked){background:color-mix(in srgb,var(--wcu-accent) 8%,var(--wcu-card))}
      [data-wincu-settings] .wcu-section-head{flex-wrap:wrap}
      [data-wincu-settings] .wcu-segment.wcu-presets{flex-wrap:wrap}
      [data-wincu-settings] .wcu-presets>label{min-width:64px}
      @media(max-width:480px){[data-wincu-settings] .wcu-grid,[data-wincu-settings] .wcu-fields{grid-template-columns:minmax(0,1fr)}[data-wincu-settings] .wcu-item:has(.wcu-presets){flex-direction:column;align-items:stretch}[data-wincu-settings] .wcu-item:has(.wcu-presets)>.wcu-art{display:none}[data-wincu-settings] .wcu-footer{bottom:8px;padding:10px}[data-wincu-settings] .wcu-actions{width:100%}[data-wincu-settings] .wcu-actions button{flex:1}}
      @media(pointer:coarse){[data-wincu-settings] input.wcu-control,[data-wincu-settings] select.wcu-control{font-size:16px}[data-wincu-settings] button{min-height:40px}[data-wincu-settings] .wcu-info{width:28px;height:28px}}
      @media(prefers-reduced-motion:reduce){[data-wincu-settings] *,[data-wincu-settings] *:after{transition:none!important;animation:none!important}}
      @media(max-width:640px){[data-wincu-settings] .wcu-tool-grid{grid-template-columns:1fr}[data-wincu-settings] .wcu-section{padding:8px 14px 12px}[data-wincu-settings] .wcu-footer{flex-wrap:wrap}}
    `;
    Object.assign(dictionaries.zh,{pluginDescription:'让 AI 操作 Windows 桌面，支持控制提示、停止快捷键和工具选择。',openSettings:'点击进行具体设置 →',notLoaded:'未能读取电脑操控设置。宿主尚未提供此配置，请刷新页面或重新启动 DSH 后重试。',loadingSettings:'正在读取电脑操控设置…',reloadSettings:'刷新页面',delayHint:'整轮操作结束后再隐藏提示。范围 200–3000 毫秒。'});
    Object.assign(dictionaries.en,{pluginDescription:'Let the agent use Windows apps, with control indicators, stop shortcuts and tool selection.',openSettings:'Click to configure →',notLoaded:'Computer Use settings could not be read. The host has not exposed this configuration. Refresh or restart DSH.',loadingSettings:'Loading Computer Use settings…',reloadSettings:'Refresh page',delayHint:'Hide the indicator after the complete operation series ends. Range: 200–3000 ms.'});
    Object.assign(dictionaries.zh,{stop:'停止操作',stopHint:'Esc 只停止当前这一轮操作。下次发起任务或说“继续”即可再次使用，无需到设置恢复。普通鼠标移动和其他按键不会停止。',previewed:'已请求预览',indicatorHint:'操作和短暂思考期间持续显示；最后一次桌面操作完成后，空闲 30 秒自动收起。'});
    Object.assign(dictionaries.en,{stop:'Stop control',stopHint:'Esc stops this operation series. A new task or a request to continue can use the desktop automatically, with no settings change. Ordinary pointer movement and other keys do not stop control.',previewed:'Preview requested',indicatorHint:'Stay visible through actions and short reasoning gaps; hide after 30 seconds without another desktop action.'});
    // Chinese first: a feature's English name appears once, in brackets, where
    // the page first names it. Each hint sits behind an info icon.
    Object.assign(dictionaries.zh,{title:'电脑操控（Computer Use）',intro:'让 DSH 操作 Windows 桌面程序和网页。',moreInfo:'说明',pluginDescription:'让 AI 操作 Windows 桌面程序和网页，可设置浏览器操控、接管提示、停止快捷键和工具。',
      browserTitle:'浏览器操控（Browser Use）',browserInfo:'DSH 专用浏览器单独启动，不会用到你自己的浏览器。默认每次使用临时的空白配置，不带你的登录、Cookie 和浏览记录；打开“记住登录”后改用长期保留的配置。退出 DSH 或空闲 10 分钟后自动关闭。',
      browserApp:'使用的浏览器',browserAppHint:'默认跟随 Windows 的默认浏览器；默认浏览器不是 Edge 或 Chrome 时，使用已安装的 Chrome 或 Edge。Firefox 系（Firefox、LibreWolf、Floorp、Waterfox、Vantage 等）在这里手动选，Windows 默认的那一个优先。更改在当前动作结束后生效，并关闭已打开的 DSH 浏览器。',
      browserApp_default:'默认浏览器',browserApp_edge:'Edge',browserApp_chrome:'Chrome',browserApp_firefox:'Firefox 系（实验性）',firefoxNotice:'Firefox 系为实验功能：DSH 启动的 Firefox 在后台运行，没有窗口，所以“显示浏览器窗口”已关闭。想看到窗口，可以自己带 --remote-debugging-port 启动浏览器，再用 WCU_BROWSER_BIDI_URL（BiDi 地址）连接；一个浏览器同一时间只接受一个控制会话。记住登录会给 Firefox 单独保留一个配置，但没有窗口，暂时不能在里面手动登录。',browserAppShort:'默认',
      browserSignIn:'记住登录（cookies）',browserSignInHint:'默认关闭：DSH 浏览器每次用全新的临时配置，网站看不到任何登录。打开后改用长期保留的配置，你在它窗口里登录过的网站会一直保持登录，见下方说明。更改在当前动作结束后生效，并关闭已打开的 DSH 浏览器。',
      signInSetup:'怎么用',signInStep1:'DSH 浏览器改用长期保留的配置。在它的窗口（蓝框）里登录过的网站，下次还是登录状态。你的浏览器里不用做任何设置，也不会弹出允许提示。',
      signInStep2:'第一次用到要登录的网站时，DSH 会请你在它的窗口里登录一次。密码和验证码由你自己输入，DSH 不代填。',
      signInStepHidden:'现在“显示浏览器窗口”是关着的，看不到 DSH 浏览器，要先打开它才能登录。',
      signInStepEdge:'用 Edge 时，Edge 会自动用你 Windows 上的微软账户登录这个配置，必应、Outlook 等微软网站会直接是登录状态；不想这样就选 Chrome。',
      signInStep3:'登录保存在这台电脑的下面这个文件夹里，关掉开关也不会删除。要清除全部登录，退出 DSH 后删除这个文件夹。',
      signInRisks:'风险',signInRisk1:'DSH 会以你的身份操作你在 DSH 浏览器里登录过的网站，发消息、下单、删除都可能发生。agent 被要求在这类操作前先问你，但不能完全保证。',
      signInRisk2:'网页上的文字可能诱导 agent 做你没让它做的事。',signInRisk3:'DSH 浏览器开着时，本机上的其他程序也能通过它的调试端口连上它，用你在里面的登录身份访问网站。',
      copy:'复制',copied:'已复制',
      browserFirst:'网页优先用浏览器操控',browserFirstHint:'能直接读写网页时在后台完成，不移动鼠标；浏览器自己的模态弹窗可能来到前台。桌面程序、浏览器工具栏和读不到的网页内容，仍由电脑操控完成。',
      browserVisible:'显示浏览器窗口',browserVisibleHint:'开启时打开一个可见的 DSH 浏览器窗口，窗口框是 DSH 蓝；DSH 正在操作的标签页，图标换成金色箭头，网页上的小箭头标出它点的位置，不遮挡网页内容，也不移动你的鼠标。普通网页操作在后台完成；浏览器自己的模态弹窗可能短暂来到前台。关闭后浏览器在后台运行，看不到窗口。更改在当前动作结束后生效，并关闭已打开的 DSH 浏览器。',
      toolsTitle:'工具',toolsInfo:'全部：启动时加载 25 个工具。精简：只加载 11 个常用工具，减少上下文占用。懒启动：启动时只加载管理入口，开始桌面任务时再加载，会多一次工具调用。自定义：自己挑选，切换方案时保留清单。保存后在当前动作结束时生效。',
      indicatorTitle:'接管提示',indicatorInfo:'DSH 用鼠标和键盘操作桌面时，用屏幕边缘、提示条和鼠标指示提醒你。浏览器操控、读取界面和在后台完成的控件操作不显示这些提示。',
      indicator:'屏幕边缘与提示条',appearance:'更多选项',preview:'预览',delay:'操作后保留提示',
      escTitle:'按 Esc 停止',stopHint:'Esc 只停止当前这一轮操作；下次发起任务或说“继续”即可再次使用，无需到设置恢复。普通鼠标移动和其他按键不会停止。浏览器操控在后台进行，不占用 Esc，要停止请用 DSH 里的停止按钮。'});
    Object.assign(dictionaries.en,{title:'Computer Use',intro:'Let DSH operate Windows desktop apps and web pages.',moreInfo:'Details',pluginDescription:'Let the agent use Windows apps and web pages, with Browser Use, control indicators, stop shortcuts and tool selection.',
      browserTitle:'Browser Use',browserInfo:'The DSH browser starts separately and never uses your own browser. By default it starts each time with a temporary empty profile: none of your sign-ins, cookies or history. With “Keep sign-ins” on, it keeps one profile instead. It closes when DSH exits or after 10 idle minutes.',
      browserApp:'Browser',browserAppHint:'Follows the Windows default browser; when that is neither Edge nor Chrome, an installed Chrome or Edge is used. Firefox-family browsers (Firefox, LibreWolf, Floorp, Waterfox, Vantage and others) are chosen here; the Windows default one comes first. Changes apply after the current action and close open DSH browsers.',
      browserApp_default:'Default browser',browserApp_edge:'Edge',browserApp_chrome:'Chrome',browserApp_firefox:'Firefox family (experimental)',firefoxNotice:'Firefox-family support is experimental. The Firefox that DSH starts runs in the background without a window, so Show the browser window is off. To see a window, start the browser yourself with --remote-debugging-port and connect it through WCU_BROWSER_BIDI_URL (its BiDi address); a browser accepts one controlling session at a time. Keep sign-ins keeps a separate Firefox profile, but with no window you cannot sign in to it by hand yet.',browserAppShort:'Default',
      browserSignIn:'Keep sign-ins (cookies)',browserSignInHint:'Off by default: the DSH browser starts each time with a fresh temporary profile, so sites see no sign-ins. When on, it keeps one profile, and sites you sign in to in its window stay signed in; see below. Changes apply after the current action and close open DSH browsers.',
      signInSetup:'How it works',signInStep1:'The DSH browser keeps its profile. Sites you sign in to in its window (the blue frame) are still signed in next time. Nothing to set up in your own browser, and no prompts to allow.',
      signInStep2:'The first time a task needs a site that asks you to sign in, DSH asks you to sign in once in its window. You type passwords and codes yourself; DSH does not fill them in.',
      signInStepHidden:'“Show the browser window” is off now, so the DSH browser cannot be seen. Turn it on to sign in.',
      signInStepEdge:'With Edge, Edge signs this profile in with the Microsoft account of your Windows, so Bing, Outlook and other Microsoft sites are signed in already. To avoid that, choose Chrome.',
      signInStep3:'Sign-ins are kept on this computer in the folder below, also after you turn this off. To remove them all, exit DSH and delete the folder.',
      signInRisks:'Risks',signInRisk1:'DSH acts as you on the sites you signed in to in the DSH browser: it can send messages, place orders or delete things. The agent is told to ask you first, but this cannot be guaranteed.',
      signInRisk2:'Text on a web page can try to make the agent do things you did not ask for.',signInRisk3:'While the DSH browser runs, other programs on this computer can also connect to it through its debugging port and use the sign-ins in it.',
      copy:'Copy',copied:'Copied',
      browserFirst:'Prefer Browser Use for web pages',browserFirstHint:'Read and operate pages directly in the background without moving the pointer. Browser-native modal dialogs may activate their window. Desktop apps, the browser toolbar and page content it cannot read still go through Computer Use.',
      browserVisible:'Show the browser window',browserVisibleHint:'When on, a visible DSH browser window opens with a gold frame. The tab DSH works in shows a gold arrow as its icon, and a small arrow on the page marks where it clicks; nothing covers the page and your pointer stays put. Ordinary page actions run in the background; browser-native modal dialogs may briefly activate the window. When off, the browser runs in the background with no window. Changes apply after the current action and close open DSH browsers.',
      toolsTitle:'Tools',toolsInfo:'All: load 26 tools at startup. Lite: 12 common tools, less context. Lazy: only the management entry at startup; tools load at the first desktop task, adding one tool call. Custom: your own selection, kept when you switch presets. Saved changes apply after the current action.',
      indicatorTitle:'Takeover indicator',indicatorInfo:'Screen edges, a banner and a pointer indicator show when DSH uses your mouse and keyboard. Browser Use, reading the screen and control actions done in the background show none of them.',
      indicator:'Screen edges and banner',appearance:'More options',preview:'Preview',delay:'Keep visible after an action',
      escTitle:'Press Esc to stop',stopHint:'Esc stops this operation series. A new task or a request to continue resumes automatically, with no settings change. Ordinary pointer movement and other keys do not stop control. Browser Use runs in the background and does not use Esc; stop it with the stop button in DSH.'});
    Object.assign(dictionaries.zh,{escAlways:'始终可用',listening:'请按下快捷键…',listeningCancel:'按 Esc 取消'});
    Object.assign(dictionaries.en,{escAlways:'Always on',listening:'Press your shortcut…',listeningCancel:'Esc to cancel'});
    // A hint opens on hover, focus or click, above its icon: a pointer hangs
    // down and to the right of its tip, so even a large pointer leaves the text
    // readable. The pointer can rest on the hint, and a click keeps it open.
    // It shows in the top layer, where no scroller or dialog clips it.
    function Info({id,label,text}){
      const anchor=React.useRef(null),tip=React.useRef(null),timer=React.useRef(0);
      const [open,setOpen]=React.useState(false),[pinned,setPinned]=React.useState(false);
      const show=(next,delay)=>{clearTimeout(timer.current);timer.current=setTimeout(()=>{setOpen(next);if(!next)setPinned(false);},delay);};
      const toggle=()=>{if(pinned)show(false,0);else{clearTimeout(timer.current);setOpen(true);setPinned(true);}};
      React.useEffect(()=>()=>clearTimeout(timer.current),[]);
      React.useLayoutEffect(()=>{
        const icon=anchor.current,el=tip.current;
        if(!open||!icon||!el)return;
        try{el.showPopover();}catch{}
        const r=icon.getBoundingClientRect(),width=el.offsetWidth,height=el.offsetHeight,view=document.documentElement,gap=8,edge=8;
        let side='top',left=r.left+r.width/2-width/2,top=r.top-gap-height;
        if(top<edge){if(r.left-gap-width>=edge){side='left';left=r.left-gap-width;top=r.top+r.height/2-height/2;}else{side='bottom';top=r.bottom+gap;}}
        left=Math.max(edge,Math.min(left,view.clientWidth-edge-width));top=Math.max(edge,Math.min(top,view.clientHeight-edge-height));
        Object.assign(el.style,{left:left+'px',top:top+'px'});el.dataset.side=side;el.style.setProperty('--wcu-caret',Math.round(r.left+r.width/2-left)+'px');
        const close=()=>{clearTimeout(timer.current);setOpen(false);setPinned(false);};
        const key=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
        const press=event=>{if(!icon.contains(event.target))close();};
        window.addEventListener('scroll',close,true);window.addEventListener('resize',close);window.addEventListener('keydown',key,true);window.addEventListener('pointerdown',press,true);
        return ()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);window.removeEventListener('keydown',key,true);window.removeEventListener('pointerdown',press,true);try{el.hidePopover();}catch{}};
      },[open]);
      return h('span',{className:'wcu-info',ref:anchor,tabIndex:0,role:'button','aria-label':label,'aria-describedby':id,'data-open':open||undefined,
        onPointerEnter:()=>show(true,120),onPointerLeave:()=>{if(!pinned)show(false,250);},onFocus:()=>show(true,0),onBlur:()=>{if(!pinned)show(false,0);},
        onClick:event=>{event.preventDefault();if(!tip.current?.contains(event.target))toggle();},onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}}},
        h('svg',{viewBox:'0 0 16 16','aria-hidden':true,focusable:false},h('circle',{cx:8,cy:8,r:6.4}),h('path',{d:'M8 7.3v3.9M8 4.9v.2'})),
        h('span',{className:'wcu-tip',id,role:'tooltip',ref:tip,popover:'manual','data-open':open||undefined},text));
    }
    // Where the DSH browser keeps its profiles (kept-edge, kept-chrome), in the
    // form File Explorer's address bar accepts.
    const KEPT_FOLDER='%LOCALAPPDATA%\\dsh-computer-use-win\\agent-browser';
    // Copies a folder path to paste into File Explorer. Without clipboard
    // access the path is left selected.
    function CopyButton({text,t}){
      const [done,setDone]=React.useState(false);
      React.useEffect(()=>{if(!done)return;const timer=setTimeout(()=>setDone(false),1500);return ()=>clearTimeout(timer);},[done]);
      const copy=async event=>{
        const code=event.currentTarget.previousElementSibling;
        let ok=true;
        try{await navigator.clipboard.writeText(text);}
        catch{const range=document.createRange(),selection=getSelection();range.selectNodeContents(code);selection.removeAllRanges();selection.addRange(range);ok=document.execCommand('copy');}
        setDone(ok);
      };
      return h('button',{type:'button',className:'wcu-small',onClick:copy},t(done?'copied':'copy'));
    }
    // Each setting has a small picture of what it changes. The pictures use the
    // page's theme tokens through the a-* classes in css.
    const drawing=(...children)=>h('svg',{viewBox:'0 0 112 70','aria-hidden':true,focusable:false},...children);
    const box=(className,x,y,width,height,rx=0)=>h('rect',{className,x,y,width,height,rx});
    const arrow=(x,y)=>h('path',{className:'a-ptr',d:`M${x} ${y}v15.5l3.8-3.6 2.7 6.1 2.6-1.1-2.7-6h5.4z`});
    // DSH's own pointer inside a page: smaller, in the accent colour.
    const dshArrow=(x,y)=>h('path',{className:'a-dsh',d:`M${x} ${y}v11l2.7-2.6 1.9 4.3 1.9-.8-1.9-4.2h3.8z`});
    const monitor=()=>[box('a-desk',9,5,94,52,4),h('path',{className:'a-bar',d:'M9.4 50h93.2v3.6a3.4 3.4 0 0 1-3.4 3.4H12.8a3.4 3.4 0 0 1-3.4-3.4z'}),box('a-ink2',49,52,3,3,.8),box('a-ink',54.5,52,3,3,.8),box('a-ink',60,52,3,3,.8),h('path',{className:'a-ink',d:'M50 57h12l1.5 6h-15z'}),box('a-ink',41,63,30,2,1)];
    const banner=y=>[box('a-pill',33,y,46,9,4.5),h('circle',{className:'a-dot',cx:38.5,cy:y+4.5,r:1.8}),box('a-text',42.5,y+3.55,23,1.9,.95),box('a-key',68,y+2,8,5,1.2)];
    const arts={
      // On: the page is read and filled directly; the tab icon turns into DSH's
      // badge and a small DSH pointer marks the spot. Off: your pointer does it.
      browserFirst:on=>drawing(box('a-win',8,7,96,56,5),h('path',{className:'a-bar',d:'M8 12a5 5 0 0 1 5-5h86a5 5 0 0 1 5 5v6H8z'}),h('path',{className:'a-sep',d:'M8 18h96'}),
        ...(on?[box('a-acc',12,9.2,6.6,6.6,1.8)]:[h('circle',{className:'a-ink2',cx:14,cy:12.5,r:1.4}),h('circle',{className:'a-ink2',cx:18.5,cy:12.5,r:1.4}),h('circle',{className:'a-ink2',cx:23,cy:12.5,r:1.4})]),box('a-win',29,10,52,5,2.5),
        box(on?'a-win a-edge':'a-win a-frame',18,25,52,10,3),box('a-ink2',22,29,22,2,1),box(on?'a-acc':'a-ink2',73,25,21,10,3),
        box('a-ink',18,41,64,2.6,1.3),box('a-ink',18,47,50,2.6,1.3),box('a-ink',18,53,38,2.6,1.3),box('a-frame',8,7,96,56,5),
        ...(on?[h('path',{className:'a-caret',d:'M46.5 27.5v5'}),dshArrow(83,29)]:[arrow(80,29)])),
      // On: the DSH browser window, its frame in DSH blue. Off: no window; the browser runs unseen.
      browserVisible:on=>drawing(...monitor(),...(on?[box('a-win',24,12,64,34,3),h('path',{className:'a-acc',d:'M24 15a3 3 0 0 1 3-3h58a3 3 0 0 1 3 3v3H24z'}),box('a-ink',29,23,36,2.4,1.2),box('a-ink',29,28,46,2.4,1.2),box('a-ink',29,33,28,2.4,1.2),box('a-frame',24,12,64,34,3)]
        :[box('a-ghost',24,12,64,34,3),h('path',{className:'a-eye',d:'M48 29c2.4-3.2 5-4.8 8-4.8s5.6 1.6 8 4.8c-2.4 3.2-5 4.8-8 4.8s-5.6-1.6-8-4.8zM49 35.5l14-13'})])),
      // The browser Browser Use runs, by name, in a window with DSH's tab badge.
      app:label=>drawing(box('a-win',8,7,96,56,5),h('path',{className:'a-bar',d:'M8 12a5 5 0 0 1 5-5h86a5 5 0 0 1 5 5v6H8z'}),h('path',{className:'a-sep',d:'M8 18h96'}),
        box('a-acc',12,9.2,6.6,6.6,1.8),box('a-win',22,10,40,5,2.5),box('a-frame',8,7,96,56,5),h('text',{className:'a-cap',x:56,y:45,textAnchor:'middle'},label)),
      // On: the DSH browser (its tab badge) keeps a signed-in account and its
      // cookies. Off: no one signed in.
      signIn:on=>drawing(box('a-win',8,7,96,56,5),h('path',{className:'a-bar',d:'M8 12a5 5 0 0 1 5-5h86a5 5 0 0 1 5 5v6H8z'}),h('path',{className:'a-sep',d:'M8 18h96'}),
        box('a-acc',12,9.2,6.6,6.6,1.8),h('circle',{className:on?'a-acc':'a-ghost',cx:95,cy:12.5,r:3.4}),box('a-ink',18,27,40,3,1.5),box('a-ink',18,34,30,3,1.5),box('a-ink',18,41,36,3,1.5),box('a-ink',18,48,24,3,1.5),
        h('circle',{className:on?'a-acc':'a-ghost',cx:80,cy:39,r:11}),...(on?[h('circle',{className:'a-win',cx:76,cy:35,r:1.6}),h('circle',{className:'a-win',cx:84,cy:37.5,r:1.4}),h('circle',{className:'a-win',cx:78.5,cy:44,r:1.7})]:[]),
        box('a-frame',8,7,96,56,5)),
      // Glowing screen edges and the status banner, at the top or the bottom.
      indicator:(on,bottom)=>drawing(...monitor(),box('a-win',22,15,48,27,2.5),h('path',{className:'a-bar',d:'M22 17.5a2.5 2.5 0 0 1 2.5-2.5h43a2.5 2.5 0 0 1 2.5 2.5v2.5H22z'}),box('a-ink',26,25,30,2.2,1.1),box('a-ink',26,30,22,2.2,1.1),box('a-frame',22,15,48,27,2.5),
        ...(on?[box('a-glow a-soft',12,8,88,46,2.5),box('a-glow',9.8,5.8,92.4,50.4,3.6),...banner(bottom?40:9.5)]:[])),
      // The active pointer has a dark fill, champagne edge and a close shadow.
      cursor:on=>drawing(box('a-ink',14,13,42,3,1.5),box('a-ink',14,20,30,3,1.5),box('a-ink',14,27,36,3,1.5),
        h('path',{d:'M50 25 62 29C64 29.7 64 31 62 32C59.5 32.5 56 31.5 55.8 35.4C55.6 36.7 55.2 38 54.5 39.5C53.6 41.2 52 41 51.5 38.5L48 27C47.5 25 48.5 24.5 50 25Z',fill:on?'#1b2221':'var(--wcu-subtle)',stroke:on?'#d9b76d':'var(--wcu-line)',strokeWidth:.85,strokeLinejoin:'round',style:{filter:on?'drop-shadow(0 0 4px #a87a2290) drop-shadow(0 0 9px #a87a2250)':'none'}})),
      // One square per tool: filled loads at startup, dashed loads on demand, faint is off.
      tools:(loaded,allowed)=>drawing(...toolGroups.flatMap(([,entries],row)=>entries.map(([name],col)=>box(loaded.has(name)?'a-acc':allowed.has(name)?'a-open':'a-ink',15.5+col*12,12.5+row*12,9,9,2.2)))),
      esc:()=>drawing(box('a-ink2',33,19,46,34,7),box('a-win',33,16,46,34,7),box('a-frame',33,16,46,34,7),h('text',{className:'a-cap',x:56,y:37.2,textAnchor:'middle'},'Esc'))
    };
    function Card({scope,t,savePatch,as='li',idPrefix='wincu',view}) {
      if(view==='summary')return h('span',{'data-wincu-summary':true},t('pluginDescription'),' ',h('span',{style:{color:'var(--dsw-alias-label-link,#71a7ff)'}},t('openSettings')));
      return h(SettingsGate,{scope,t,savePatch,as,idPrefix});
    }
    function SettingsGate(props){
      const state=React.useSyncExternalStore(fn=>props.scope.subscribe(fn),()=>props.scope.getSnapshot());
      if((state.status!==undefined&&state.status!=='ready')||!state.value)return h(props.as,{'data-wincu-unavailable':true},h('p',{role:'status'},props.t(state.status==='loading'?'loadingSettings':'notLoaded')),h('button',{type:'button',onClick:()=>window.location.reload()},props.t('reloadSettings')));
      return h(SettingsCard,props);
    }
    function SettingsCard({scope,t,savePatch,as='li',idPrefix='wincu'}) {
      const state = React.useSyncExternalStore(listener => scope.subscribe(listener), () => scope.getSnapshot());
      const available=state.status===undefined?state.value!==undefined:state.status==='ready';
      const writable=available&&state.writable;
      const saved = {...defaults,...state.value};
      if(!state.value?.toolPreset||saved.toolPreset==='auto')saved.toolPreset=saved.enabledTools.length===allToolNames.length?'full':'custom';
      const [draft,setDraft] = React.useState(saved), [dirty,setDirty] = React.useState(false);
      const [saving,setSaving] = React.useState(false), [message,setMessage] = React.useState(''),[tone,setTone]=React.useState('');
      const [toolSearch,setToolSearch] = React.useState('');
      const [recording,setRecording] = React.useState(false), [recordMessage,setRecordMessage] = React.useState('');
      const savedKey = JSON.stringify(Object.fromEntries(Object.keys(defaults).map(key=>[key,saved[key]])));
      React.useEffect(()=>{if(!dirty)setDraft(saved);},[savedKey,dirty]);
      // The Firefox that DSH starts has no window yet, so choosing Firefox turns
      // the window switch off, and choosing another browser turns it back.
      const visibleBeforeFirefox=React.useRef(null);
      const change = (field,value) => {const next={...draft,[field]:value};
        if(field==='browserReuseExisting'&&value)next.browserVisible=true;
        if(field==='browserApp'&&value==='firefox'&&draft.browserApp!=='firefox'){visibleBeforeFirefox.current=draft.browserVisible;next.browserVisible=false;}
        else if(field==='browserApp'&&draft.browserApp==='firefox'&&value!=='firefox'&&visibleBeforeFirefox.current!==null){next.browserVisible=visibleBeforeFirefox.current;visibleBeforeFirefox.current=null;}
        setDraft(next);setDirty(Object.keys(defaults).some(key=>!equal(next[key],saved[key])));setMessage('');};
      const selectTools=(names,enabled)=>{const selected=new Set(draft.enabledTools);for(const name of names)enabled?selected.add(name):selected.delete(name);change('enabledTools',allToolNames.filter(name=>selected.has(name)));};
      React.useEffect(()=>{
        if(!recording)return;
        if(!writable||saving){setRecording(false);return;}
        const cancel=()=>{setRecording(false);setRecordMessage('recordCancelled');};
        const keydown=event=>{
          if(event.isComposing)return;
          event.preventDefault();event.stopImmediatePropagation();
          if(event.key==='Escape'||event.code==='Escape'){cancel();return;}
          if(event.repeat||['Control','Alt','Shift','Meta','OS'].includes(event.key))return;
          const shortcut=shortcutFromEvent(event);
          if(!shortcut){setRecordMessage('unsupportedKey');return;}
          change('stopShortcut',shortcut);setRecordMessage('');setRecording(false);
        };
        const timer=setTimeout(()=>{setRecording(false);setRecordMessage('recordTimedOut');},15000);
        window.addEventListener('keydown',keydown,true);window.addEventListener('blur',cancel);
        return ()=>{clearTimeout(timer);window.removeEventListener('keydown',keydown,true);window.removeEventListener('blur',cancel);};
      },[recording,writable,saving,savedKey]);
      const run = async (patch,success) => {
        setSaving(true);setMessage('');
        try {await savePatch(patch);setMessage(t(success));setTone('success');return true;}
        catch(error){setMessage(t('failed')+': '+String(error.message||error));setTone('error');return false;}
        finally{setSaving(false);}
      };
      const save = async () => {
        if(!draft.indicatorText.trim()||draft.indicatorText.length>120||/[\r\n\x00-\x1f]/.test(draft.indicatorText)||!Number.isInteger(draft.indicatorIdleMs)||draft.indicatorIdleMs<200||draft.indicatorIdleMs>3000){setMessage(t('invalid'));setTone('error');return;}
        const patch=Object.fromEntries(Object.keys(defaults).filter(key=>!equal(draft[key],saved[key])).map(key=>[key,draft[key]]));
        if(await run(patch,'saved'))setDirty(false);
      };
      const disabled = saving||!writable||recording,indicatorDisabled=disabled||!draft.indicatorEnabled;
      const activeTools=draft.toolPreset==='lazy'?['tools']:draft.toolPreset==='full'?allToolNames:draft.toolPreset==='lite'?liteToolNames:draft.enabledTools;
      const customDisabled=disabled||draft.toolPreset!=='custom';
      const query=toolSearch.trim().toLocaleLowerCase();
      const visibleGroups=toolGroups.map(([group,entries])=>[group,entries.filter(([name])=>[name,'windows_computer_use_'+name,t('tool_'+name),t('toolHint_'+name)].some(text=>text.toLocaleLowerCase().includes(query)))]).filter(([,entries])=>entries.length);
      const radio=(field,value,label)=>h('label',{key:value},h('input',{type:'radio',name:idPrefix+'-'+field,id:idPrefix+'-'+field+'-'+value,value,checked:draft[field]===value,disabled:indicatorDisabled,onChange:()=>change(field,value)}),label);
      const button=(label,props)=>h('button',{type:'button',...props},t(label));
      const info=key=>h(Info,{id:idPrefix+'-tip-'+key,label:t('moreInfo'),text:t(key)});
      const head=(id,title,hint,...end)=>h('div',{className:'wcu-section-head'},h('h3',{id},t(title)),hint&&info(hint),end.length>0&&h('div',{className:'wcu-end'},...end));
      // A setting reads as a picture of its effect, then its name and control,
      // two to a row, so no switch sits far from its name.
      const item=(art,...main)=>h('div',{className:'wcu-item'},art,h('div',{className:'wcu-item-main'},...main));
      // The hint icon stays on the line of the title's last word (or last two
      // Chinese characters), so a narrow column never leaves it alone on a line.
      const title=(text,hint,props)=>{const cut=/[\u2e80-\u9fff\uff00-\uffef]$/.test(text)?text.length-2:text.lastIndexOf(' ')+1;return h(props?.htmlFor?'label':'span',{className:'wcu-item-title',...props},text.slice(0,cut),h('span',{className:'wcu-nowrap'},text.slice(cut),hint&&info(hint)));};
      const picture=art=>h('div',{className:'wcu-art','aria-hidden':true},art);
      const toggle=(field,label,locked)=>h('input',{id:idPrefix+'-'+field,type:'checkbox',role:'switch','aria-label':t(label),checked:draft[field],disabled:disabled||locked,onChange:e=>change(field,e.target.checked)});
      const switchItem=(field,label,hint,art,locked)=>item(h('label',{className:'wcu-art',htmlFor:idPrefix+'-'+field,'aria-hidden':true},art),title(t(label),hint,{htmlFor:idPrefix+'-'+field}),toggle(field,label,locked));
      const field=(label,control)=>h('div',{className:'wcu-field'},label,control);
      const allowedTools=['full','lazy'].includes(draft.toolPreset)?allToolNames:activeTools;
      const keycap=(key,label)=>h('kbd',{className:'wcu-key',key},label);
      const shortcutKeys=recording?[h('span',{key:'listen'},t('listening')),h('small',{key:'cancel'},t('listeningCancel'))]
        :draft.stopShortcut?draft.stopShortcut.split('+').flatMap((key,i)=>i?[h('span',{className:'wcu-plus',key:'+'+i},' + '),keycap(i,key)]:[keycap(i,key)])
        :[keycap('esc','Esc'),h('small',{key:'default'},t('noShortcut').slice(3))];
      return h(as,{'data-wincu-settings':'true'},h('style',null,css),
        h('header',{className:'wcu-header'},
          h('h2',{style:{display:'flex',alignItems:'center',gap:12}},h('svg',{width:32,height:32,viewBox:'0 0 64 64','aria-hidden':true},h('rect',{x:4,y:4,width:56,height:56,rx:14,fill:'#1d1e20',stroke:'#b18b32'}),h('path',{d:'M14 17h36v25H14z M25 49h14 M32 42v7',fill:'none',stroke:'#d9b75d',strokeWidth:2}),h('path',{d:'M28 24v22l6-6 5 11 5-2-5-11h9z',fill:'#d9b75d',stroke:'#493710'})),t('title')),h('p',null,t('intro'))),
        h('section',{className:'wcu-section','data-wincu-browser-policy':true,'aria-labelledby':idPrefix+'-browser-title'},
          head(idPrefix+'-browser-title','browserTitle','browserInfo'),
          h('div',{className:'wcu-grid'},
            switchItem('browserFirst','browserFirst','browserFirstHint',arts.browserFirst(draft.browserFirst)),
            switchItem('browserVisible','browserVisible','browserVisibleHint',arts.browserVisible(draft.browserVisible),draft.browserApp==='firefox'||draft.browserReuseExisting),
            item(h('label',{className:'wcu-art',htmlFor:idPrefix+'-browserApp','aria-hidden':true},arts.app(draft.browserApp==='default'?t('browserAppShort'):draft.browserApp==='firefox'?'Firefox':t('browserApp_'+draft.browserApp))),
              title(t('browserApp'),'browserAppHint',{htmlFor:idPrefix+'-browserApp'}),
              h('select',{className:'wcu-control',id:idPrefix+'-browserApp',value:draft.browserApp,disabled,onChange:e=>change('browserApp',e.target.value)},
                ...['default','edge','chrome','firefox'].map(app=>h('option',{key:app,value:app},t('browserApp_'+app))))),
            switchItem('browserSignIn','browserSignIn','browserSignInHint',arts.signIn(draft.browserSignIn),draft.browserReuseExisting)),
          h('div',{className:'wcu-fields'},field(title(t('browserReuseExisting'),'browserReuseHint',{htmlFor:idPrefix+'-browserReuseExisting'}),toggle('browserReuseExisting','browserReuseExisting'))),
          // Kept sign-ins need nothing set up, but how to sign in, where the
          // sign-ins stay and the risks remain in view while the switch is on.
          draft.browserApp==='firefox'&&h('p',{className:'wcu-notice','data-wincu-firefox-notice':true},t('firefoxNotice')),
          draft.browserSignIn&&!draft.browserReuseExisting&&draft.browserApp!=='firefox'&&h('div',{className:'wcu-notice','data-wincu-signin-notice':true},
            h('strong',null,t('signInSetup')),
            h('ol',null,h('li',null,t('signInStep1')),h('li',null,t('signInStep2')),
              !draft.browserVisible&&h('li',{'data-wincu-signin-hidden':true},t('signInStepHidden')),
              draft.browserApp!=='chrome'&&h('li',{'data-wincu-signin-edge':true},t('signInStepEdge')),
              h('li',null,t('signInStep3'),h('span',{className:'wcu-address'},h('code',null,KEPT_FOLDER),h(CopyButton,{text:KEPT_FOLDER,t})))),
            h('strong',null,t('signInRisks')),
            h('ul',null,...[1,2,3].map(n=>h('li',{key:n},t('signInRisk'+n)))))),
        h('section',{className:'wcu-section','aria-labelledby':idPrefix+'-tools-title'},
          head(idPrefix+'-tools-title','toolsTitle','toolsInfo',h('span',{className:'wcu-tool-count','data-wincu-tool-count':true},draft.toolPreset==='lazy'?t('lazyCount'):t('toolsSelected')+' '+activeTools.length+' / '+allToolNames.length)),
          item(picture(arts.tools(new Set(activeTools),new Set(allowedTools))),
            h('div',{className:'wcu-segment wcu-presets',role:'radiogroup','aria-label':t('toolsTitle')},...['full','lite','lazy','custom'].map(preset=>h('label',{key:preset},h('input',{type:'radio',name:idPrefix+'-toolPreset',id:idPrefix+'-toolPreset-'+preset,value:preset,checked:draft.toolPreset===preset,disabled,onChange:()=>change('toolPreset',preset)}),t(preset)))),
            h('p',{className:'wcu-hint','data-wincu-preset-hint':true},t(draft.toolPreset+'Summary'))),
          h('details',{className:'wcu-tool-detail','data-wincu-tools':true,hidden:draft.toolPreset!=='custom',open:draft.toolPreset==='custom'},h('summary',null,t('customTools')),
            h('div',{className:'wcu-tool-body'},
              h('div',{className:'wcu-tool-search'},h('input',{className:'wcu-control',type:'search',value:toolSearch,'aria-label':t('searchTools'),placeholder:t('searchTools'),onChange:e=>setToolSearch(e.target.value)}),toolSearch&&button('clearSearch',{className:'wcu-small',onClick:()=>setToolSearch('')})),
              !visibleGroups.length&&h('p',{role:'status'},t('noToolMatches')),
              h('div',{className:'wcu-tool-toolbar'},button('allTools',{className:'wcu-small',disabled:customDisabled||draft.enabledTools.length===allToolNames.length,onClick:()=>change('enabledTools',[...allToolNames])}),button('noTools',{className:'wcu-small',disabled:customDisabled||!draft.enabledTools.length,onClick:()=>change('enabledTools',[])})),
              ...visibleGroups.map(([group,entries])=>{const names=entries.map(entry=>entry[0]),count=names.filter(name=>draft.enabledTools.includes(name)).length;return h('fieldset',{className:'wcu-tool-group',disabled:customDisabled,key:group},
                h('legend',null,h('label',{className:'wcu-tool-group-label'},h('input',{type:'checkbox',id:idPrefix+'-tool-group-'+group,checked:count===names.length,'aria-checked':count&&count<names.length?'mixed':count===names.length,ref:input=>{if(input)input.indeterminate=count>0&&count<names.length;},onChange:e=>selectTools(names,e.target.checked)}),t('toolGroup_'+group),h('span',{className:'wcu-tool-count'},count+' / '+names.length))),
                h('div',{className:'wcu-tool-grid'},...entries.map(([name])=>h('label',{className:'wcu-tool-item',key:name,title:'windows_computer_use_'+name},h('input',{type:'checkbox',id:idPrefix+'-tool-'+name,'data-wincu-tool':name,checked:draft.enabledTools.includes(name),disabled:customDisabled,onChange:e=>selectTools([name],e.target.checked)}),h('span',null,h('strong',null,t('tool_'+name)),h('small',null,t('toolHint_'+name)))))));})))),
        h('section',{className:'wcu-section','aria-labelledby':idPrefix+'-indicator-title'},
          head(idPrefix+'-indicator-title','indicatorTitle','indicatorInfo',button('preview',{className:'wcu-small',disabled:disabled||dirty||(!draft.indicatorEnabled&&!draft.cursorIndicatorEnabled),onClick:()=>run({previewToken:Date.now()},'previewed'),title:dirty?t('previewHint'):undefined})),
          h('div',{className:'wcu-grid'},
            switchItem('indicatorEnabled','indicator','indicatorHint',arts.indicator(draft.indicatorEnabled,draft.indicatorPosition==='bottom')),
            switchItem('cursorIndicatorEnabled','cursorIndicator','cursorIndicatorHint',arts.cursor(draft.cursorIndicatorEnabled,idPrefix+'-spot'))),
          h('details',{className:'wcu-detail'},h('summary',null,t('appearance')),
            h('div',{className:'wcu-fields'},
              field(title(t('text'),null,{htmlFor:idPrefix+'-indicatorText'}),h('input',{className:'wcu-control',id:idPrefix+'-indicatorText',type:'text',maxLength:120,value:draft.indicatorText,disabled:indicatorDisabled,onChange:e=>change('indicatorText',e.target.value)})),
              field(title(t('position'),null,{id:idPrefix+'-position-label'}),h('div',{className:'wcu-segment',role:'radiogroup','aria-labelledby':idPrefix+'-position-label'},radio('indicatorPosition','top',t('top')),radio('indicatorPosition','bottom',t('bottom')))),
              field(title(t('delay'),'delayHint',{htmlFor:idPrefix+'-delay'}),h('div',{className:'wcu-number'},h('input',{className:'wcu-control',id:idPrefix+'-delay',type:'number',min:200,max:3000,step:100,value:draft.indicatorIdleMs,disabled:indicatorDisabled,onChange:e=>change('indicatorIdleMs',Number(e.target.value))}),h('span',null,t('ms')))),
              field(title(t('remoteVisible'),'remoteVisibleHint',{htmlFor:idPrefix+'-remoteIndicatorVisible'}),toggle('remoteIndicatorVisible','remoteVisible'))))),
        h('section',{className:'wcu-section','aria-labelledby':idPrefix+'-stop-title'},
          head(idPrefix+'-stop-title','stop',null,button('clearShortcut',{className:'wcu-small',disabled:disabled||!draft.stopShortcut,onClick:()=>{change('stopShortcut','');setRecordMessage('');}})),
          h('div',{className:'wcu-grid'},
            item(picture(arts.esc()),title(t('escTitle'),'stopHint'),h('span',{className:'wcu-caption'},t('escAlways'))),
            h('div',{className:'wcu-item','data-wincu-shortcut':'true'},
              h('output',{className:'wcu-art wcu-shortcut-value','data-recording':recording,'data-keys':draft.stopShortcut.split('+').length,'aria-live':'polite','aria-label':t('extraStop')},...shortcutKeys),
              h('div',{className:'wcu-item-main'},title(t('extraStop'),'shortcutHint'),
                button(recording?'cancelRecord':draft.stopShortcut?'rerecord':'record',{className:'wcu-small',disabled:saving||!writable,onClick:()=>{setRecordMessage('');setRecording(!recording);}})))),
          recordMessage&&h('p',{role:'status',className:'wcu-hint'},t(recordMessage))),
        !writable&&h('p',{role:'status','data-tone':'error'},t(available?'unavailable':'notLoaded')),
        h('footer',{className:'wcu-footer'},h('span',{className:'wcu-status',role:'status','aria-live':'polite','data-tone':message?tone:undefined},message||t(dirty?'dirty':'clean')),
          h('div',{className:'wcu-actions'},button('discard',{disabled:!dirty||saving||recording,onClick:()=>{setDraft(saved);setDirty(false);setMessage('');setRecordMessage('');}}),button('save',{className:'wcu-primary',disabled:!dirty||disabled,onClick:save}))));
    }
    Object.assign(dictionaries.zh,{nav:'灵犀御机',title:'灵犀御机',intro:'暗金插件包 · 操作 Windows 桌面与网页，实时查看 Agent 鼠标位置',cursorIndicatorHint:'显示独立圆角深色箭头、细暗金描边与渐淡轮廓阴影，实时跟随桌面鼠标；仅在 Agent 操作期间或预览时显示。关闭后全部隐藏。'});
    Object.assign(dictionaries.en,{nav:'Aurum Desktop',title:'Aurum Desktop',intro:'Windows control with a live gold agent pointer',cursorIndicatorHint:'Show the dark agent arrow, champagne edge and close shadow during desktop control or preview.'});
    Object.assign(dictionaries.zh,{intro:'桌面与网页操控 · 暗金指示 · 随时停止',searchTools:'搜索工具名称或用途',clearSearch:'清除搜索',noToolMatches:'没有匹配的工具，请尝试其他关键词',fullSummary:'全部 26 项，随时可用',liteSummary:'常用 12 项，减少上下文占用',lazySummary:'启动仅 1 项，按需加载',customSummary:'按用途搜索，勾选需要的工具',cursorIndicatorHint:'操作时显示暗金鼠标，结束后自动隐藏。不会改变系统指针。',shortcutHint:'录制 F8 或 Ctrl + Alt + K 等快捷键，保存后生效。Esc 始终可用。',remoteVisibleHint:'让远程连接、屏幕共享和录屏看到提示与鼠标标识。'});
    Object.assign(dictionaries.en,{intro:'Desktop and web control · Gold indicators · Stop anytime',searchTools:'Search tools by name or purpose',clearSearch:'Clear search',noToolMatches:'No matching tools. Try another keyword.',fullSummary:'All 26 tools, ready to use',liteSummary:'12 common tools, less context',lazySummary:'Start with 1 tool; load on demand',customSummary:'Search by purpose and choose tools',cursorIndicatorHint:'Show the gold pointer during control and hide it afterwards. Your system pointer is unchanged.',shortcutHint:'Record F8 or Ctrl + Alt + K, then save. Esc is always available.',remoteVisibleHint:'Show indicators in remote sessions, screen sharing and recordings.'});
    Object.assign(dictionaries.zh,{indicator:'桌面接管与浏览器状态',indicatorHint:'桌面接管显示边缘提示；网页任务显示操作进度条，不抢占系统鼠标。浏览器任务用 DSH 停止按钮中断。',cursorIndicatorHint:'网页任务显示独立页面指针，可与系统鼠标同时使用；桌面接管标记跟随系统鼠标。全屏仍可查看操作状态。',indicatorInfo:'网页操作显示暗金状态条与独立页面指针；桌面真实输入显示接管边缘与系统鼠标标记。读取和等待状态会显示当前进展。'});
    Object.assign(dictionaries.en,{indicator:'Desktop and browser status',indicatorHint:'Show desktop takeover edges or a browser progress pill without borrowing your pointer. Use the DSH stop button for browser tasks.',cursorIndicatorHint:'Web tasks use an independent page pointer alongside your system pointer. Desktop takeover follows the system pointer. Status stays visible in fullscreen.',indicatorInfo:'Web tasks show a gold status pill and an independent page pointer. Desktop input shows takeover edges and the system pointer marker. Reading and waiting states report progress.'});
    Object.assign(dictionaries.zh,{browserReuseExisting:'复用已有浏览器',browserReuseHint:'在正常 Edge/Chrome 中请求新标签页，保留 DSH 页面。会沿用该浏览器登录状态，并共享桌面焦点；关闭后使用独立浏览器与独立页面指针。'});
    Object.assign(dictionaries.en,{browserReuseExisting:'Reuse the existing browser',browserReuseHint:'Request a new tab in the normal Edge/Chrome browser and preserve DSH. Uses that browser’s sign-ins and shared desktop focus. Turn off for an independent browser and page pointer.'});
    Object.assign(dictionaries.zh,{browserInfo:'可复用已有浏览器的新标签页，或使用独立的 DSH 浏览器。复用模式沿用正常浏览器的登录状态和桌面焦点；独立模式可显示不占用系统鼠标的页面指针。',browserFirstHint:'网页任务优先使用所选浏览器入口；原生控件或不支持的内容再用桌面操作。',browserVisibleHint:'控制独立 DSH 浏览器的窗口显示。复用已有浏览器时保持可见。'});
    Object.assign(dictionaries.en,{browserInfo:'Reuse a normal browser in a new tab, or use an independent DSH browser. Reuse shares the normal browser’s sign-ins and desktop focus; isolated mode supports a page pointer independent of your mouse.',browserFirstHint:'Prefer the selected browser entry for web tasks. Use desktop input for native controls or unsupported content.',browserVisibleHint:'Show the independent DSH browser window. Reused browsers remain visible.'});
    function apply(ctx) {
      ctx.effect(()=>ctx.locale.register(NS,dictionaries));

      const t=ctx.locale.bind?ctx.locale.bind(NS):key=>key;
      let mounted=false;
      let modernRemote;
      ctx.inject(['remote','remote.settings'],owner=>{modernRemote=owner.remote.settings;return ()=>{modernRemote=undefined;};});
      const mount=(scope,owner,namespace)=>{
      if(mounted)return;mounted=true;
      const connection=typeof scope.mutate==='function'?undefined:owner.connection;
      const savePatch=async patch=>{
        const current=scope.getSnapshot();
        if(current.status!==undefined&&current.status!=='ready')throw Error(t('notLoaded'));
        if(modernRemote&&owner.configForms){
          const response=await modernRemote.mutate(namespace,Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),current.revision);
          if(response.ok)owner.configForms.describe().acceptView(response.value);
          else await owner.configForms.describe().load();
          if(!response.ok)throw Error(response.error?.message||response.error?.code||t('persistFailed'));
        }else if(typeof scope.mutate==='function'){
          const accepted=await scope.mutate(Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),scope.getSnapshot().revision);
          if(!accepted)throw Error(t('persistFailed'));
        }else if(connection?.api?.settings?.mutate){
          const snapshot=scope.getSnapshot();
          const response=await connection.api.settings.mutate({ns:namespace,ops:Object.entries(patch).map(([field,value])=>({op:'set',path:[field],value})),...(snapshot.revision===undefined?{}:{expectedRevision:snapshot.revision})});
          if(!response.result?.ok)throw Error(response.result?.message||response.result?.error||t('persistFailed'));
          await scope.load();
        }else{
          for(const [field,value]of Object.entries(patch))await scope.set(field,value);
        }
        const value=scope.getSnapshot().value??{};
        if(Object.entries(patch).some(([key,next])=>!equal(value[key],next)))throw Error(t('persistFailed'));
      };
      ctx.slots.inject('plugins.tab',()=>ctx.slots.register({name:'plugins.tab',id:'aurum-desktop',order:55,label:()=>t('nav'),locale:NS,inject:()=>({scope,savePatch,as:'section',idPrefix:'wincu-page'})},Card));
      };
      ctx.inject(['configForms'],owner=>mount(owner.configForms.get('mcp-dsh-computer-use-win'),owner,'mcp-dsh-computer-use-win'));
      ctx.inject(['settingsScope','connection','remote'],owner=>mount(owner.settingsScope.bind({namespace:'windows-computer-use'}),owner,'windows-computer-use'));
    }
    return {apply,inject:['slots','locale']};
  }
});
