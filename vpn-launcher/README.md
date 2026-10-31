# 可选 Windows Tailscale HTTPS 启动器

从插件仓库根目录运行 `start-dsh-web.bat -HarnessRoot "<DSH源码绝对路径>"`，或通过 `DSH_SOURCE` 指定源码目录。保持原来的 DSH_HOME；不把实际 Token 写入脚本。

先用 `-CheckOnly` 只读检查 Tailscale 状态和 Serve 配置。启动需要本机已安装 Tailscale、pnpm、Node 和完成依赖安装的 DSH checkout；首次可能需要开通 MagicDNS/HTTPS。启动器保持前台，Ctrl+C 停止 DSH；Serve 的后台配置会保留。

正常模式会配置私有 Serve HTTPS 443 到回环地址 3080，并启动带匹配可信域名与 public URL 的 DSH。脚本拒绝已占用的 3080、其他服务使用的 HTTPS 根路径和该端点的 Funnel。它不负责登录 Tailscale，也不修改防火墙。

本次发布只做 PowerShell 语法与配置逻辑检查，未在发布过程中运行正常模式以改变当前网络或启动第二个 DSH。实际手机连通性需要使用者验证。

固定 Token 前置条件见 [插件说明](../remote-access/README.md)，认证兼容补丁见 [补丁说明](../patches/README.md)。
