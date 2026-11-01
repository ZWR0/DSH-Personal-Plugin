# Web 嵌入登录诊断（第一阶段）

本补丁只增加默认关闭的脱敏 HTTP 诊断，不更改灵光打开链接、Cookie 属性、可信 Host、Origin、CSRF 或代理策略。嵌入 Cookie 兼容配置尚未实现：必须先从真实灵光请求确认故障阶段，不能把人工省略 Cookie 的测试当作灵光故障证据。

## 扩展点检查

- `connection/request` 在认证完成后才触发，无法诊断被拒绝的请求。
- `BrowserAuth.authorizeIndex` 负责 Token 换 Cookie 和 303 跳转；Cookie 目前为 SameSite=Strict、HttpOnly，Secure 只由本地 TLS 决定。
- 新增 `webserver/request-observe` 观察事件，在 HTTP 路由认证前触发；诊断监听器只读取事实，在响应 finish/close 时记录，不改变路由。
- API HTTP 和 WebSocket admission 均调用 Connection 的 Host/Origin/Fetch-Metadata 防护；跨站请求拒绝，未增加允许来源。
- HTTP 到 Tailscale HTTPS 的转发目前不会被视作原生 TLS；补丁不读取或信任 X-Forwarded-*。public URL 不等于代理信任配置。

## 应用和启停

依赖已应用 `dsh-persistent-web-token.patch` 的源码，匹配本仓库现有固定 Token 版本。先停止原 DSH，在 DSH 源码目录检查个人修改，然后执行：

```powershell
git apply --check <插件仓库绝对路径>/patches/dsh-web-auth-diagnostics.patch
git apply <插件仓库绝对路径>/patches/dsh-web-auth-diagnostics.patch
```

在实际启用的 `connection` 配置中增加 `authDiagnostics: true`。默认 false，关闭后重载/重启连接插件。保留原有 trustedHosts、recovery、请求上限和 Cookie 生命周期配置；Cordis overlay 替换整个 config，不应为启用诊断丢弃部署设置。使用构建产物时需重建相关包再启动。此交付没有修改或重启本机运行实例。

仅输出 `[web-auth]` JSON：`path`（不含 query/fragment）、`tokenPresent`、`tokenMatched`、`cookiePresent`、`cookieAuthenticated` 和实际 `status`。未发出 HTTP 头就断开时 status 为 null。Cookie 存在指请求带 Cookie 头，认证通过指有效浏览器会话 Cookie；不表示 API operator Cookie 是否有效。长连接 HTTP 在结束或断开时才记录；WebSocket upgrade 不经过 HTTP response，此补丁不记录其握手状态，不能用它宣称实时连接验证成功。

不记录 Token（包括遮罩）、Cookie 值、完整 URL、Host、Origin、Referer、响应 Location 或正文。其他现有日志、终端打印的启动登录链接不属于这个诊断通道，不要整份上传。避免并行测试多个客户端造成序列混淆。

## 真实复现

1. 开启诊断，普通浏览器使用现有登录入口登录，查看页面并执行一次只读 API 请求，确认实际实时连接是否建立。
2. 使用相同既有入口在灵光中登录，不修改打开链接逻辑。记录时间，只收集对应的脱敏诊断行。
3. 查找路径 `/` 上 tokenPresent=true、tokenMatched=true、status=303；随后 `/` 若 cookieAuthenticated=false、status=401，说明换取阶段成功、跳转请求未通过 Cookie 认证。cookiePresent=false 表示没有带 Cookie；true 表示带了 Cookie 头，但不能据此认定会话 Cookie 自身存在。
4. tokenMatched=false 应先排查旧链接/轮换；API 403 应排查 Origin/Fetch-Metadata，不能解释为 Cookie 丢失。只有 API 401 也不足以确定浏览器拦截第三方 Cookie。
5. 服务端无法确定 Cookie 未被接受还是未被发送。须结合真实设备 WebView 的 Cookie/存储策略或远程调试确认；不能仅从服务端 401 判定第三方 Cookie 被拦截。
6. 复现后关闭诊断。

## 确认后的第二阶段约束

只有真实诊断确认上述 303→401 路径，再添加默认关闭的嵌入兼容选项。开启时仅浏览器会话 Cookie 使用 SameSite=None; Secure; HttpOnly，普通模式保持 Strict，独立 API operator Cookie 不隐式改变。Tailscale HTTPS 终止须通过经过验证的明确外部 HTTPS 配置及本地代理边界处理；不得无条件信任转发头，也不能只因宣告 public URL 就赋予所有请求 HTTPS 身份。

保持写操作、API、实时连接的 Origin/CSRF 检查。只有实际需要时才增加精确来源白名单；不得使用 * 或允许 opaque null 来源。若第三方 Cookie 仍被浏览器策略阻止，应报告该限制并停止，不放宽安全检查。

## 本地验证与限制

从插件仓库运行 `node tools/web-auth-diagnostics-test.mjs`；可用 DSH_SOURCE 指定本地源码。脚本将源码复制到 tools/.test-tmp，检查并应用补丁；若源码已包含完全匹配的补丁，先仅在临时副本中反向还原再验证应用。只使用内存凭据，不修改真实 DSH。测试覆盖 303 换取、缺 Cookie 后的 401、有效 Cookie 登录、API 路径认证事实、错误/重复 Token、无效 Cookie 和日志事实脱敏。

该测试不代表真实浏览器、灵光、API 操作或 WebSocket 端到端验证通过；未完成整包构建和实际部署。当前没有真实灵光请求样本，因此尚不能确认根因，未发布嵌入 Cookie 策略变更。
