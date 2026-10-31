# DSH 固定 Web Token 兼容补丁

远行之钥 0.2.1 是管理界面，依赖 Connection 提供 `webAuthStatus`、`webAuthToken`、`setWebAuthToken` 和 `clearWebAuthToken`。原版 DSH 缺少这些接口时，仅安装插件不能启用固定 Token。

## 对应版本

补丁基线：DeepSeek Harness `ce7073d51254c26cd63b22a60835b8f948deb447`（本机版本 `0.2.2-alpha.2`）。包含 Connection 四个源码文件的修改，以及 `browser-auth-persistent.host.spec.ts` 回归测试。未包含 `.dsh`、凭据或真实 Token。

补丁使用凭据记录保存固定 Token，支持读取旧版记录；切换或撤销 Token 时更新轮换世代，使旧 Cookie 与旧链接失效。环境变量 `DSH_WEB_TOKEN` 优先于持久设置。凭据记录格式含版本演进，回退代码前需检查旧版兼容性，不应通过删除凭据库回退。

## 应用

先停止原 DSH 实例并备份自己的数据目录，在 DSH 源码仓库中确认工作区状态。若认证源码已有个人修改，先保存，不要覆盖。

```powershell
git rev-parse HEAD
git status --short
git apply --check <插件仓库绝对路径>/patches/dsh-persistent-web-token.patch
git apply <插件仓库绝对路径>/patches/dsh-persistent-web-token.patch
pnpm exec vitest run packages/client/connection/tests/browser-auth.host.spec.ts packages/client/connection/tests/browser-auth-persistent.host.spec.ts
```

`--check` 失败时不要强制应用：可能已应用补丁，也可能 DSH 版本不同。按当前源码审查适配，而不是整文件覆盖。基于源码启动时沿用项目原有启动流程；使用构建产物的部署需要重新构建相应 Host 包，例如项目的 `pnpm run build:lib:host`，并解决构建报告的问题后再启动。

应用补丁后安装 `remote-access` 插件，重启原服务并刷新网页；测试或修改源码不等于已更新旧的构建产物。

## 验证范围

发布前已检查补丁可应用到该基线的独立文件副本；认证层两份测试共 19 项通过，插件 Host 测试包含独立 Node 子进程重启与模拟凭据存储，浏览器测试使用模拟 Host。未在其他 DSH 提交或完整全新构建上验证，也未代替真实手机网络验证。

补丁含上游 DeepSeek Harness 源码上下文，保留其 [MIT 许可证](UPSTREAM-LICENSE)。插件仓库自身许可证见 [LICENSE](../LICENSE)。
