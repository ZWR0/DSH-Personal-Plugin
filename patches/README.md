# DSH 宿主兼容补丁

默认必需补丁为 `dsh-persistent-web-token.patch`（远行之钥）和 `dsh-compaction-token-budget.patch`（文脉护航）。版本、文件校验和测试路径统一由 [host-compatibility.json](../host-compatibility.json) 管理，新设备优先使用 [安装指南](../INSTALL.md) 中的 `prepare-host.mjs --prepare`。`git pull` 只同步补丁文件，不执行补丁、构建或重启。

远行之钥是管理界面，依赖 Connection 提供 `webAuthStatus`、`webAuthToken`、`setWebAuthToken` 和 `clearWebAuthToken`。原版 DSH 缺少这些接口时，仅安装插件不能启用固定 Token。

## 对应版本

默认补丁基线：DeepSeek Harness `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`0.2.2-rc.1`）。认证补丁包含 Connection 四个源码文件及 `browser-auth-persistent.host.spec.ts`；压缩补丁包含 `compaction-basic` 实现、预算回归测试及双语包文档。未包含 `.dsh`、凭据或真实 Token。可选补丁可能使用不同基线，应分别阅读说明。

压缩预算扩展在压力判断和摘要调用时派发同步的 `compaction/token-budget` waterfall，提供所属 Agent。无监听器保留预设；监听器可减少预留量和摘要输出上限，不能增大预设值；拒绝非法整数。插件卸载后恢复原生预算，不修改预设、模型容量、正常回答输出上限或 Session 记录格式。

补丁使用凭据记录保存固定 Token，支持读取旧版记录；切换或撤销 Token 时更新轮换世代，使旧 Cookie 与旧链接失效。环境变量 `DSH_WEB_TOKEN` 优先于持久设置。凭据记录格式含版本演进，回退代码前需检查旧版兼容性，不应通过删除凭据库回退。

## 应用

先停止原 DSH 实例并备份自己的数据目录，在 DSH 源码仓库中确认工作区状态。若认证源码已有个人修改，先保存，不要覆盖。

```powershell
git rev-parse HEAD
git status --short
git apply --check <插件仓库绝对路径>/patches/dsh-persistent-web-token.patch
git apply <插件仓库绝对路径>/patches/dsh-persistent-web-token.patch
git apply --check <插件仓库绝对路径>/patches/dsh-compaction-token-budget.patch
git apply <插件仓库绝对路径>/patches/dsh-compaction-token-budget.patch
pnpm exec vitest run packages/client/connection/tests/browser-auth.host.spec.ts packages/client/connection/tests/browser-auth-persistent.host.spec.ts
pnpm exec vitest run packages/compaction/compaction-basic/tests/compaction-basic.spec.ts packages/compaction/compaction-basic/tests/token-budget.host.spec.ts
```

`--check` 失败时不要强制应用：可能已应用补丁，也可能 DSH 版本不同。按当前源码审查适配，而不是整文件覆盖。基于源码启动时沿用项目原有启动流程；使用构建产物的部署需要重新构建相应 Host 包，例如项目的 `pnpm run build:lib:host`，并解决构建报告的问题后再启动。

应用补丁后安装 `remote-access` 插件，重启原服务并刷新网页；测试或修改源码不等于已更新旧的构建产物。

## 验证范围

认证层两份测试共 19 项通过，压缩与预算测试共 133 项通过；插件 Host 测试使用模拟凭据并包含独立 Node 子进程重启。当前工作区有用户保留的官方文件删除，完整检查及干净环境验证限制见 [验证记录](../docs/HOST-VALIDATION.md)。新增 CI 从固定的干净官方源码验证，不等于远端工作流已经通过，也不代替真实手机网络验证。

补丁含上游 DeepSeek Harness 源码上下文，保留其 [MIT 许可证](UPSTREAM-LICENSE)。插件仓库自身许可证见 [LICENSE](../LICENSE)。

## 可选嵌入登录诊断

见 [Web 嵌入登录诊断](WEB-AUTH-DIAGNOSTICS.md)。先应用默认关闭的脱敏诊断补丁，确认真实请求失败阶段后再决定 Cookie 兼容策略；当前未改变 SameSite 或 Origin/CSRF 检查。
