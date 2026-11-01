# 远行之钥

`@local/dsh-remote-access` · **0.3.2** · Host + Web 客户端

在 DSH 插件页管理固定登录 Token 和远程基础地址，让重启后的收藏链接继续可用。Token 属于 DSH 登录凭据，与 Tailscale auth key、模型 API Key 不同。

## 安装前确认

**本插件依赖 DSH 认证层扩展，不是适用于任意原版 DSH 的纯界面插件。** 仓库同时提供 [兼容补丁与基线说明](../patches/README.md)。认证层需提供：

- `connection.webAuthStatus()`
- `connection.webAuthToken()`
- `connection.setWebAuthToken(token)`
- `connection.clearWebAuthToken()`

缺少接口时，插件会提示“认证层不支持固定 Token”。先按补丁说明检查版本、应用、测试及按需构建，再安装本目录；重启 DSH 后刷新网页。

插件加载 ID 为 `local-remote-access-settings`，**不能改成 `remote-access`**，否则可能覆盖 DSH 内置的同名权限服务，导致工作区和会话界面无法激活。

## 三步使用

1. 打开「插件 → 远行之钥」，选择固定 Token，自动生成并立即启用；也可填写自定义值后保存。
2. 填写并保存浏览器实际可达的完整地址，例如 `https://device.tailnet.ts.net/`。
3. 点击“显示登录二维码”，用自己的手机或平板扫码，在浏览器中打开并收藏。

DSH 必须保持运行，设备的网络路径也必须可用。固定域名和固定 Token 是两项设置；修改域名、切换 DSH_HOME、轮换 Token 后需重新核对链接。

## 0.3.2 更新

连接状态使用无嵌套卡片的信息栏：桌面四列、手机两列，远程地址独占一行。移除重启要求项和固定 Token 安全提示卡片，保留二维码旁的简短提示。

## 0.3.1 更新

二维码改为通过已有 `/link` 接口获取登录链接，在浏览器内生成，无需新增 `/qr` 路由，修复更新界面后主机端未重载导致的 HTTP 404。移除基础地址复制按钮和重复地址小字。更新后刷新插件页面即可加载新界面。

## Token 与持久化

自动生成的 Token 使用 32 字节密码学随机数。自定义 Token 为 32–256 个字符，只允许英文字母、数字、`-`、`_`；建议使用自动生成值。默认状态仍为 DSH 原有的临时 Token。

固定 Token 保存在 DSH_HOME 的凭据库；非敏感的基础地址保存在当前 profile 的 `remote-access.json`。插件源码不保存凭据。切换或撤销 Token 会使旧链接及旧认证 Cookie 失效，其他设备需要重新登录。

启动环境设置 `DSH_WEB_TOKEN` 时，由环境变量接管，界面不能轮换或撤销它；如果希望界面管理，应在原启动环境移除该变量并重启。沿用原来的 DSH_HOME，不同数据目录不会自动共享凭据。

状态接口只返回遮罩；显示 Token 或登录二维码需要显式操作。二维码在本机生成，不使用外部二维码服务；修改地址、认证配置或刷新状态会清除已显示的二维码。登录链接含凭据，只保存在自己的可信设备，不要贴入公开截图、日志或仓库。

## 可选：Windows Tailscale HTTPS 启动器

仓库提供 [启动器](../vpn-launcher/README.md)，用于已配置 Tailscale 的电脑；它不是安装插件的必需步骤。

```powershell
.\vpn-launcher\start-dsh-web.bat -HarnessRoot "D:\path\to\deepseek-harness" -CheckOnly
.\vpn-launcher\start-dsh-web.bat -HarnessRoot "D:\path\to\deepseek-harness"
```

也可设置 `DSH_SOURCE` 指向自己的 DSH 源码目录。`-CheckOnly` 只检查，不启动服务或更改 Serve 配置。正常启动将配置 `https://设备名.网络名.ts.net/` 到 `http://127.0.0.1:3080` 的 Serve 代理，并声明匹配的可信 Host 和 public URL。

首次使用可能需要在 Tailscale 启用 MagicDNS 和 HTTPS。电脑与远端设备需接入允许互访的 tailnet；设备名或网络域名变化后需更新地址。启动器固定使用 3080，不改用随机端口，不覆盖其他服务占用的根路径；发现对应 Funnel 公开入口时停止。

插件本身只保存地址，不会配置 Tailscale、反向代理、可信 Host 或防火墙。自己配置反向代理时，应同步核对 DSH 的 `--trusted-host` 与 `--public-url`。参考：[Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)。

## 验证

先确保 DSH 源码具备兼容补丁。从 DSH 源码目录执行 Host 测试，以便解析其 tsx 运行环境：

```powershell
$env:DSH_SOURCE = (Get-Location).Path
node --import tsx/esm "<插件仓库绝对路径>/tools/remote-access-host-test.mjs"
```

客户端测试从插件仓库根目录执行，设置相同的 `DSH_SOURCE`：

```powershell
node tools/remote-access-client-test.mjs
```

客户端脚本默认使用 Windows Edge，可通过 `DSH_BROWSER_PATH` 指定浏览器；依赖 DSH checkout 中当前版本的 Playwright 1.61.1、React 18.3.1 与相应 pnpm 布局。测试不读取或修改真实凭据，不代表已经从远程设备验证网络连通。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 不支持固定 Token | 检查补丁版本、四个接口及是否重载了正确构建产物 |
| 首页可打开但会话无法加载 | 核对实际域名与可信 Host；不要覆盖内置 remote-access 权限服务 |
| 重启后链接失效 | 检查 DSH_HOME 是否相同、固定 Token 是否启用、环境变量是否覆盖 |
| 复制按钮禁用 | 先保存地址；有未保存修改时不能按新地址生成链接 |
| `EADDRINUSE :3080` | 在原终端停止旧实例后再启动，避免重复启动 |
| 手机打不开 | 检查电脑是否运行、两端网络、代理与访问策略；界面“服务运行中”不代表外网验证成功 |

[返回套件说明](../README.md)
