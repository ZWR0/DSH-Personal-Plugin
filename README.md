# 暗金工坊 · DSH Web UI 本地插件套件

本仓库包含 **6 个可单独安装、启停的本地插件**，包名均为 `@local/*`。插件安装在 DSH profile 中，不直接修改官方包。下表版本以各目录的 `package.json` 为准。

## 插件一览

| 插件 | 版本 | 包名 / 目录 | 用途 |
| --- | --- | --- | --- |
| 行囊 | 0.3.1 | `@local/dsh-local-vault` · [local-vault](local-vault/) | 扫描本机插件目录，批量安装选中项 |
| 清道夫 | 0.3.0 | `@local/dsh-session-reaper` · [session-reaper](session-reaper/) | 从会话菜单永久删除已停止的会话 |
| 暗金主题 | 0.3.0 | `@local/dsh-aurum-theme` · [aurum-theme](aurum-theme/README.md) | 暗金配色、会话仪表、回答概览与标题目录 |
| 引文速递 | 0.2.0 | `@local/dsh-quote-relay` · [quote-relay](quote-relay/) | 将回复中的选中文本插入输入框引用卡片 |
| 选项领航 | 0.2.0 | `@local/dsh-choice-pilot` · [choice-pilot](choice-pilot/) | 引导模型使用 DSH 原生提问工具澄清关键需求 |
| 知忆书阁 | 0.3.0 | `@local/dsh-context-library` · [context-library](context-library/README.md) | Agent 身份、Owner 资料、记忆导入与按需加载 |

原独立暗金仪表已并入暗金主题。旧文档中的 `aurum-telemetry/`、`live-interject/`、`config-recipes/` 不属于当前工作区的可安装目录。

## 安装与更新

1. 首次使用时，在 DSH 原生插件页安装本仓库的 `local-vault` 文件夹。
2. 重启 DSH 并刷新网页，进入「插件 → 行囊 → 目录安装」。
3. 选择克隆后的仓库根目录，检查扫描结果，点击「一键安装选中项」。
4. 按安装结果提示完成重启或刷新。也可以通过原生插件页分别安装需要的插件目录。

通过本地目录链接安装时，profile 会引用源码，无需把源码再次复制到 profile。链接安装并不代表运行进程会自动重载所有修改：

| 修改内容 | 如何生效 |
| --- | --- |
| 客户端脚本、界面样式 | 刷新网页；仍旧时强制刷新 |
| Host 脚本、工具、提示词或 API | 在原终端停止 DSH，再启动，最后刷新网页 |
| 安装、依赖或插件配置 | 遵循原生管理器返回的重启提示 |

本机源码启动示例：在你的 DeepSeek Harness 源码目录下运行以下命令，并沿用原启动环境中的 `DSH_HOME` 等设置。

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

详见 [知忆书阁使用说明](context-library/README.md)。仓库只提供 [通用书库模板](examples/context-library/README.md)，不包含个人 Owner 档案或真实记忆。

## 其他插件

### 行囊

选择 **DSH Host 所在设备** 的插件总目录后自动保存并扫描。根目录及下两级中的合法 bundle 可被识别；不进入目录链接、隐藏目录和 `node_modules`。已安装项跳过，同名来源冲突时显示原因。配置保存在 profile 的 `local-vault.json`。

安装调用原生 PluginManager，逐项显示结果；失败不阻断其他项，也不自动批准安装脚本。离开页面后不再开始下一项，已开始的安装仍可能完成。

### 清道夫

会话「… → 删除会话」会**立即永久删除，无确认弹窗或回收站**。运行中的会话禁止删除；已停止的当前会话可以直接删除。成功后刷新列表并切换会话，失败显示原因，不自动重试。

当前实现适配 DSH 的 Agent 生命周期和 JSONL 会话目录，仅支持匹配 `DSH_HOME/sessions` 的存储布局。上游内部结构变化或路径校验失败时拒绝删除。验证脚本只操作临时会话。

### 暗金主题

在「设置 → 通用 → 暗金主题」启停，跟随原生浅色 / 深色 / 系统设置。主题包含仪表条和回答导航，隐藏重复的原生用量读数；关闭后恢复原生样式。详细行为与兼容边界见 [主题 README](aurum-theme/README.md)。

### 引文速递

在同一条 assistant 正文中划选文本，点击输入框工具行的引用按钮。优先使用原生引用卡片，保留草稿；旧接口环境回退为 Markdown 引用。支持单字选区，超过 8000 个 Unicode 字符时要求缩小范围，不截断原文。思考区、编辑区及跨回复选择不处理。

### 选项领航

这是 Host 提示词插件，复用部署实际提供的 `ask_user_question` 和输入区问题卡片，不增加重复的工具或弹窗。引导模型先查证已有信息，只对关键缺失和必要取舍提问；必要答案到达前不执行依赖部分。它依赖模型遵循指引，无法保证所有需求歧义都被发现。

## 工作区与迁移

```text
DSH-Personal-Plugin/
├─ local-vault/
├─ session-reaper/
├─ aurum-theme/
├─ quote-relay/
├─ choice-pilot/
├─ context-library/
├─ examples/            # 通用模板，不是插件 bundle
└─ tools/               # 测试、截图及本机诊断脚本，不是插件
```

迁移时复制需要的插件目录，在新设备重新安装，并重新选择本机路径。插件源码、profile 配置、模型凭据、会话与书库是不同资产；复制源码不会自动迁移其余数据。书库需连同 `.context-library` 一起备份，保留历史和待审记录；不要把个人书库或凭据当作公共插件源码分发。

## 验证

以下命令均从仓库根目录执行。部分脚本使用本机 `D:/deepseek-harness` 的依赖；浏览器测试还依赖 Edge。换设备后应先检查脚本中的绝对路径。文档更新本身不需要启动服务或重跑所有测试。

| 插件 | 测试脚本（位于 `tools/`） |
| --- | --- |
| 行囊 | `local-vault-host-test.mjs`、`local-vault-connection-test.mjs`、`local-vault-client-test.mjs` |
| 清道夫 | `session-reaper-lifecycle-test.mjs`、`session-reaper-client-test.mjs` |
| 暗金主题 | `aurum-theme-smoke.mjs`、`aurum-navigation-test.mjs`、`aurum-navigation-browser.mjs` |
| 引文速递 | `quote-relay-test.mjs` |
| 知忆书阁 | `context-library-core-test.mjs`、`context-library-import-test.mjs`、`context-library-integration-test.mjs`、`context-library-client-test.mjs` |

例如：

```powershell
node tools/context-library-import-test.mjs
node tools/context-library-integration-test.mjs
node tools/context-library-client-test.mjs
```

仓库未收录本机凭据签发、运行中设置修复脚本、日志、截图和真实书库。测试仅使用临时目录或模拟数据；插件涉及的真实服务兼容性仍需在你的 DSH 环境验证。

## 公开范围与许可证

本仓库发布六个插件、使用文档、通用模板和上表中的回归测试。测试中 `D:/deepseek-harness` 为开发环境路径示例，部分依赖固定 pnpm 布局与版本；不是安装插件时的固定路径要求，也不代表已支持所有 DSH 版本。

使用、修改与分发遵循仓库现有的 [MIT License](LICENSE)。
