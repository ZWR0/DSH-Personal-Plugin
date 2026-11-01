# 暗金工坊 · DSH Web UI 本地插件套件

本仓库包含 **7 个 DSH 插件**，覆盖本地插件管理、会话清理、主题、引用、提问、上下文和远程登录。安装时以所下载目录中的 `package.json` 为准。

版本核对日期：**2026-11-01**。插件统一使用四字中文名，名称不附加功能或英文后缀。包名、插件 ID 和配置路径保持兼容。当前版本见下表。仓库另附认证层兼容补丁与可选启动器；安装前须先核对其 DSH 基线和依赖。

插件使用 `@local/*` 包名，安装在 DSH profile 中。其余六个插件不直接修改官方包；远行之钥依赖匹配的 DSH 认证层扩展，仓库提供独立兼容补丁，不能只复制界面插件就获得固定 Token 能力。

## 插件一览

| 插件 | 版本 | 包名 / 目录 | 用途 |
| --- | --- | --- | --- |
| 行囊宝匣 | 0.5.3 | `@local/dsh-local-vault` · [local-vault](local-vault/README.md) | 扫描本机插件目录，批量安装选中项 |
| 会话清道 | 0.3.1 | `@local/dsh-session-reaper` · [session-reaper](session-reaper/README.md) | 立即永久删除已停止的会话 |
| 暗金主题 | 0.3.1 | `@local/dsh-aurum-theme` · [aurum-theme](aurum-theme/README.md) | 暗金配色、会话仪表、回答概览与标题目录 |
| 引文速递 | 0.2.1 | `@local/dsh-quote-relay` · [quote-relay](quote-relay/README.md) | 将回复中的选中文本插入输入框引用卡片 |
| 选项领航 | 0.2.1 | `@local/dsh-choice-pilot` · [choice-pilot](choice-pilot/README.md) | 引导模型使用 DSH 原生提问工具澄清关键需求 |
| 知忆书阁 | 0.3.1 | `@local/dsh-context-library` · [context-library](context-library/README.md) | Agent 身份、Owner 资料、记忆导入与按需加载 |
| 远行之钥 | 0.3.2 | `@local/dsh-remote-access` · [remote-access](remote-access/README.md) | 固定 DSH Web 登录 Token、手机扫码连接 |

原独立暗金仪表已并入暗金主题。旧文档中的 `aurum-telemetry/`、`live-interject/`、`config-recipes/` 不属于当前工作区的可安装目录。

本表描述本次提交中的源码，旧克隆或旧 ZIP 不会自动更新。请在更新源码后按下方说明重启或刷新。

## 获取源码

```powershell
git clone https://github.com/ZWR0/DSH-Personal-Plugin.git
cd DSH-Personal-Plugin
```

也可以在 GitHub 点击「Code → Download ZIP」后解压。首次安装选择克隆或解压后的插件文件夹，不要选择 ZIP 文件。更新已克隆的仓库前，先保存自己的修改，再按 Git 提示拉取更新；不要覆盖仍在使用的个人书库或凭据。

## 安装与更新

1. 首次使用时，在 DSH 原生插件页安装源码目录下的 `local-vault` 文件夹。
2. 重启 DSH 并刷新网页，进入「插件 → 行囊宝匣 → 目录安装」。
3. 选择源码根目录（克隆后通常为 `DSH-Personal-Plugin`），检查扫描结果，点击「一键安装选中项」。
4. 按安装结果提示完成重启或刷新。也可以通过原生插件页分别安装需要的插件目录。

通过本地目录链接安装时，profile 会引用源码，无需把源码再次复制到 profile。链接安装并不代表运行进程会自动重载所有修改：

| 修改内容 | 如何生效 |
| --- | --- |
| 客户端脚本、界面样式 | 刷新网页；仍旧时强制刷新 |
| Host 脚本、工具、提示词或 API | 在原终端停止 DSH，再启动，最后刷新网页 |
| 安装、依赖或插件配置 | 遵循原生管理器返回的重启提示 |

源码启动示例：在你的 DeepSeek Harness 源码目录下运行以下命令，并沿用原启动环境中的 `DSH_HOME` 等设置。

```powershell
node --import tsx/esm apps/cli/src/bin.ts web
```

**先在原终端按 Ctrl+C 停止旧实例，再启动。** `EADDRINUSE 127.0.0.1:3080` 表示已有进程监听该端口，不表示插件代码一定损坏；不要重复启动多个实例。切换 `DSH_HOME` 会切换数据目录，应保持原值。

## 知忆书阁：从这里开始

进入「设置 → 知忆书阁」，按资料用途选择入口：

| 你要添加什么 | 入口 | 存储方式 |
| --- | --- | --- |
| Axiom 的名称、定位、原则、表达习惯 | 设置 Agent 身份 | 唯一的 `identity.md` |
| 你的称呼、背景和稳定偏好 | 我的资料（Owner） | 独立的 `long_term/owner-profile.md` |
| 已确认的事实、偏好与工作习惯 | 添加长期记忆 | 自动生成 ID 的记忆条目 |
| 已有 Owner / Memory Markdown | 导入 Markdown / 导入文件夹 | 预览分类后，生成书库格式的副本 |

不需要手动给 Markdown 写元数据，也不需要复制文件到插件目录。Axiom 的 `identity.md`、`principles.md`、`personality.md` 可在一次导入中合并；`user_profile.md`、`owner.md`、`owner-profile.md` 识别为 Owner 资料。项目和决策导入后默认停用，绑定项目目录后再启用。

聊天框书本按钮只展示简洁的状态、预算和条目名称；鼠标悬停查看更多说明，历史与其他条目按需展开。「待发送」表示下一次请求的计划，不能当成已发送给模型。

自定义模式**仅替换 `harness:identity`**，保留部署人设前后缀、其他系统约束、工具、运行环境、项目指令、技能和历史。身份文档不会自动赋予 Axiom runtime 的任务控制或检索能力。

详见 [知忆书阁使用说明](context-library/README.md)。公开仓库提供[通用书库模板](https://github.com/ZWR0/DSH-Personal-Plugin/tree/main/examples/context-library)；本地 `axiom-context/` 含个人资料，不属于发布内容。

## 其他插件

### 行囊宝匣

0.5.3 将“选择可卸载项 / 清空选择”合并为一个随选择状态切换的按钮。来源与插件详情可展开查看；按钮提供轻阴影、悬浮与按压反馈，支持键盘焦点及减少动态效果偏好。批量安装与卸载显示进度条、已处理数量及当前插件；进度按插件数量计算。已安装列表支持多选、二次确认卸载和逐项结果，失败项保留选择以便重试。批量卸载排除官方、不可移除项和行囊宝匣自身；离开页面后不再启动后续卸载，已经开始的操作会继续。

选择 **DSH Host 所在设备** 的插件总目录后自动保存并扫描。根目录及下两级中的合法 bundle 可被识别；不进入目录链接、隐藏目录和 `node_modules`。有效的已安装项跳过，同名来源冲突时显示原因。支持手动输入 Host 上的绝对路径；没有原生文件夹选择能力时也可点击「保存目录并扫描」。旧目录不可用时保留路径并提示重新设置。

移动插件目录后，输入新总目录并保存扫描，选中「待迁移」项后一键安装：仅对旧本地来源已不存在、包名一致且可移除的插件，自动移除旧安装记录并安装新来源，保留启停状态；有效来源和官方插件不迁移。失败后重新扫描重试，恢复所需启停状态保存在 profile 的 `local-vault-recovery.json`。不删除磁盘插件文件。行囊宝匣不迁移自身：若行囊宝匣已无法启动，请先在原生插件页移除旧行囊宝匣记录、安装新目录的 `local-vault` 并重启，再批量处理其他插件。配置保存在 profile 的 `local-vault.json`。

安装调用原生 PluginManager，逐项显示结果；失败不阻断其他项，也不自动批准安装脚本。离开页面后不再开始下一项，已开始的安装仍可能完成。

### 会话清道

在会话菜单中点击“删除会话”立即永久删除，无需确认，也没有撤回或回收站。运行中的会话禁止删除；已停止的当前会话可删除，随后刷新列表并切换会话。删除失败时显示原因。0.3.1 统一显示名称，保留现有删除行为。

当前实现适配 DSH 的 Agent 生命周期和 JSONL 会话目录，仅支持匹配 `DSH_HOME/sessions` 的存储布局。上游内部结构变化或路径校验失败时拒绝删除。验证脚本只操作临时会话。

### 暗金主题

在「设置 → 通用 → 暗金主题」启停，跟随原生浅色 / 深色 / 系统设置。主题包含仪表条和回答导航，隐藏重复的原生用量读数；关闭后恢复原生样式。详细行为与兼容边界见 [主题 README](aurum-theme/README.md)。

### 引文速递

在同一条 assistant 正文中划选文本，点击输入框工具行的引用按钮。优先使用原生引用卡片，保留草稿；旧接口环境回退为 Markdown 引用。支持单字选区，超过 8000 个 Unicode 字符时要求缩小范围，不截断原文。思考区、编辑区及跨回复选择不处理。

### 选项领航

这是 Host 提示词插件，复用部署实际提供的 `ask_user_question` 和输入区问题卡片，不增加重复的工具或弹窗。引导模型先查证已有信息，只对关键缺失和必要取舍提问；必要答案到达前不执行依赖部分。它依赖模型遵循指引，无法保证所有需求歧义都被发现。

### 远行之钥

在「插件 → 远行之钥」管理固定 DSH 登录 Token，保存远程基础地址并通过手机扫码登录。固定 Token 由 DSH_HOME 的凭据库保存；轮换或撤销会使旧链接和认证 Cookie 失效，`DSH_WEB_TOKEN` 环境变量优先于界面设置。插件保存地址，不自动修改 Tailscale、代理或防火墙。

**0.3.2：**连接状态改为简洁信息栏，远程地址独占一行，移除重启要求和固定 Token 安全提示卡片。配置 Token 并保存地址后，可点击「显示登录二维码」，通过已有 `/link` 接口获取链接，在浏览器本地生成登录二维码供手机或平板扫码，不调用第三方二维码服务，也不依赖新增 `/qr` 接口（修复 HTTP 404）。隐藏二维码、修改地址、更新或撤销 Token、刷新状态或切到后台时会清除二维码。扫码设备仍需具备可达的网络路径；二维码包含登录凭据，请勿公开分享。

**安装前先阅读 [认证兼容补丁](patches/README.md)。** 已验证基线为 DSH `ce7073d51254c26cd63b22a60835b8f948deb447`；原版缺少相关 Connection 接口时，仅安装插件无法工作。Windows 可选 [Tailscale HTTPS 启动器](vpn-launcher/README.md) 通过参数指定源码目录，不包含本机凭据。

完整安装、固定 Token 设置及故障排查见 [远行之钥 README](remote-access/README.md)。

## 工作区与迁移

```text
DSH-Personal-Plugin/
├─ local-vault/
├─ session-reaper/
├─ aurum-theme/
├─ quote-relay/
├─ choice-pilot/
├─ context-library/
├─ remote-access/       # 远行之钥，需认证兼容扩展
├─ axiom-context/       # 仅本地：个人书库，不上传
├─ examples/            # 公开仓库：通用书库模板
├─ patches/             # DSH 认证层兼容补丁与上游许可证
├─ vpn-launcher/        # 可选 Windows Tailscale HTTPS 启动器
└─ tools/               # 测试、截图及本机诊断脚本，不是插件
```

迁移时复制需要的插件目录，在新设备重新安装，并重新选择本机路径。插件源码、profile 配置、模型凭据、会话与书库是不同资产；复制源码不会自动迁移其余数据。书库需连同 `.context-library` 一起备份，保留历史和待审记录；不要把个人书库或凭据当作公共插件源码分发。

## 验证

远程访问设置插件使用独立的加载 ID `local-remote-access-settings`，保留 DSH 内置 `remote-access` 权限服务。两者不能使用相同 ID，否则内置服务会被覆盖，工作区、会话等 UI 插件将无法激活。

以下命令均从源码根目录执行（`DSH-Personal-Plugin`）。部分脚本使用本机 `D:/deepseek-harness` 的依赖；浏览器测试还依赖 Edge。换设备后应先检查脚本中的绝对路径。文档更新本身不需要启动服务或重跑所有测试。

| 插件 | 测试脚本（位于 `tools/`） |
| --- | --- |
| 行囊宝匣 | `local-vault-host-test.mjs`、`local-vault-connection-test.mjs`、`local-vault-client-test.mjs` |
| 会话清道 | `session-reaper-lifecycle-test.mjs`、`session-reaper-client-test.mjs` |
| 暗金主题 | `aurum-theme-smoke.mjs`、`aurum-navigation-test.mjs`、`aurum-navigation-browser.mjs` |
| 引文速递 | `quote-relay-test.mjs` |
| 知忆书阁 | `context-library-core-test.mjs`、`context-library-import-test.mjs`、`context-library-integration-test.mjs`、`context-library-client-test.mjs` |
| 远行之钥 | `remote-access-host-test.mjs`（真实认证层与独立进程重启）、`remote-access-client-test.mjs`（桌面 / 手机布局、保存流程、旧主机接口兼容、二维码显示与隐藏检查）；先按插件 README 设置 `DSH_SOURCE` |

例如：

```powershell
node tools/context-library-import-test.mjs
node tools/context-library-integration-test.mjs
node tools/context-library-client-test.mjs
```

本地工作区的 `tools/` 还包含一次性修复和旧版 live 诊断脚本，公开仓库不收录这些脚本。它们可能访问本机认证、修改运行中 profile 的书库设置，或依赖旧界面和会话；不应把整个目录作为通用测试批量执行。知忆书阁的验证范围与限制见其 README。

## 发布范围与同步

仓库包含插件源码、文档、回归测试、通用模板及启动文件。个人 Owner 档案、真实 Memory、会话、凭据、运行日志、截图和本机认证修复脚本不随插件上传。

文档、版本信息与对应源码一起同步。插件功能更新后按需递增版本号；仅整理文档不额外增加插件版本。

使用、修改与分发遵循仓库的 [MIT License](https://github.com/ZWR0/DSH-Personal-Plugin/blob/main/LICENSE)。
