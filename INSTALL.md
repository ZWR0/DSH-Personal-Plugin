# 新设备安装与升级

本套件包含普通插件和需要额外宿主能力的插件。远行之钥需要固定 Web Token 扩展；文脉护航需要压缩预算扩展。只下载插件、修改 YAML 或执行 `git pull` 都不会自动应用宿主补丁。

## 支持的组合

以 [host-compatibility.json](host-compatibility.json) 为唯一版本清单：官方 DSH `0.2.2-rc.1`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`，Node >=24.9，pnpm `11.28.5`。清单记录必须的两个补丁、SHA-256 和宿主测试。可选的文件定位及登录诊断补丁不属于默认安装。

源码检查、构建接口检查、运行实例检查是三个阶段。只有重启原 Host 后，运行实例才会加载新产物。此组合的本地验证记录及限制见 [验证说明](docs/HOST-VALIDATION.md)。

## 全新设备

安装 Git、Node 和指定的 pnpm 后，在自己选择的父目录执行。下列目录名可更换，后续路径相应调整：

```powershell
git clone https://github.com/deepseek-ai/deepseek-harness.git
git -C deepseek-harness checkout --detach fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159
git clone https://github.com/ZWR0/DSH-Personal-Plugin.git
node DSH-Personal-Plugin/tools/prepare-host.mjs --host deepseek-harness --check
node DSH-Personal-Plugin/tools/prepare-host.mjs --host deepseek-harness --prepare
```

`--check` 只检查；`--apply` 仅应用补丁；`--prepare` 应用补丁、安装锁定依赖、构建、运行宿主测试、检查类型和构建能力。任一步失败即停止，不启动服务。`--verify` 检查已生成产物。脚本不执行 checkout、reset、clean，不自动覆盖配置，不停止现有进程。版本不符、补丁部分应用或与本地代码冲突时停止。其他源码修改也会阻止应用；`.dsh/` 和嵌套的本插件仓库不计入源码冲突。

补丁可重复检查：完全应用时跳过；全部待应用补丁先联合检查，再统一应用。应用成功后的安装或构建失败不会自动撤销补丁，修复环境后可重跑。SHA-256 用于发现文件损坏，不是签名或来源认证。

准备成功后，沿用 DSH 官方支持的 profile 启动流程。先安装 `local-vault`，在行囊宝匣中选择插件总目录，扫描并安装需要的插件；也可以通过原生插件管理器逐个安装。脚本不自动启用插件。重启原 profile、刷新浏览器；在行囊宝匣中重新扫描确认所需运行接口。

Windows 灵犀御机需要 Windows；上述宿主准备不代表 Linux 上支持桌面控制。Tailscale 配置见 [启动器说明](vpn-launcher/README.md)。

## 个人配置与数据迁移

个人设置放在实际 `DSH_HOME/profiles/<profile>/cordis.patch.yml`，不要修改官方 bundle 的 YAML。`cordis.yml` 通常是空根配置，不用旧完整配置覆盖它。参考 [无凭据模型配置模板](examples/personal-profile.patch.yml)，填写本机模型 ID、服务地址和真实上下文容量，再合并需要的行。同一 ID 保留一个个人覆盖；覆盖通常替换整项 config，需要保留该项其他设置。

模板不包含插件安装记录。通过插件管理器重新安装，避免复制旧 `node_modules` 和旧机器绝对路径。`pnpm-lock.yaml`、`pnpm-workspace.yaml` 保留匹配宿主版本，不恢复成旧版“本地文件”。

凭据、Token、会话、书库及 profile 数据单独私下备份和迁移，沿用原 DSH_HOME。不要提交 `.credentials.yaml`、`.dsh/`、登录链接或真实模型密钥。更换设备后核对书库路径、模型地址、远程域名和 HTTPS 配置。

## 已有设备与官方升级

### 页面撤销宿主补丁

行囊宝匣 0.7.0 分开展示插件本体与宿主补丁。需要页面内撤销时，先用受管启动器替换原来的启动命令，明确指定原 DSH_HOME 和 profile：

```powershell
node DSH-Personal-Plugin/tools/managed-host.mjs --host deepseek-harness --home "D:\path\to\original\.dsh" --profile web -- --host 127.0.0.1 --port 3080
```

首次使用前在原 profile 安装并启用行囊宝匣。`--` 后的参数原样交给 DSH 的 Web profile；远程部署需沿用自己的 trusted-host、public-url 等参数。启动器不自动配置 Tailscale，也不自动替换其他服务。普通启动仍可管理插件，但不提供修改宿主源码的页面权限。

在「行囊宝匣 → 宿主补丁」检查源码补丁状态、关联插件和撤销后的保留能力，点击撤销并确认。所有 Agent 必须空闲。经过认证的 owner 请求通过当前子进程专属 IPC 交给外部启动器；预检通过后调用 DSH 原生 appExit 退出并等待完成。启动器再次检查源码、备份、反向应用补丁、完整构建及检查，再用相同参数和数据目录重启。不会卸载插件本体。

撤销后构建失败会尝试重新应用原补丁并重新构建；恢复或再次构建失败时保持停机，终端显示原因。页面断线后尝试读取重启结果，最多等待十分钟；Host 无法启动时以启动终端和 `DSH_HOME/host-maintenance/state.json` 为准。没有失败后无限重启或强制覆盖。

备份存于 `DSH_HOME/host-maintenance/backups/`，包含补丁、受影响源码及存在的 `.credentials.yaml`。这是私人备份，不能提交或分享。认证补丁撤销后原 Cookie 和固定登录链接可能失效，须从启动终端重新登录。保留插件包不代表保留固定 Token 功能；重新应用补丁也不会自动恢复被旧认证代码更新过的凭据，不自动覆盖凭据备份。

文脉护航撤销预算补丁后保留请求前预算保护与一次原生历史压缩补救，失去额外预留量和摘要输出限制。远行之钥的固定 Token 和二维码登录依赖认证补丁，撤销后这些操作不可用，地址等设置与插件包仍保留。

建议先撤销补丁，再更新官方源码。更新后只在补丁仍能完整反向应用、没有其他本地源码修改时允许自动撤销；遇到部分应用、上游冲突或你有意删除官方文件时禁止操作，需人工适配。清单外版本即使撤销成功也不宣称全部插件兼容。

启动器使用单实例锁；异常关机留下 `supervisor.lock` 时，先确认旧启动器和 Host 都已停止，再手动处理锁文件。不要同时用普通启动命令启动同一 profile。

先停止原 DSH，备份 DSH_HOME 并查看 `git status --short`。存在自己的源码修改或删除时使用单独的干净源码目录，不运行 `git reset --hard` 来满足脚本要求。官方已有工作区不会被准备脚本自动切换到指定提交。

个人插件更新执行插件仓库自己的 `git pull`，然后按清单检查宿主。官方 `master` 更新与个人插件更新独立；不要在生产目录直接拉取 master 后假设全部插件兼容。清单外的版本应先在新目录审查和适配补丁，再运行测试。

认证补丁使用版本化的凭据记录。不要通过回退源码或删除凭据库来回滚；先确认新旧代码的记录兼容性，保留独立数据备份。

## 维护并同步到 GitHub

1. 在独立干净目录检出准备支持的官方完整提交，适配宿主补丁；每个补丁包含源码、相关测试和必要文档，不整份复制官方仓库。
2. 将所有默认必需补丁加入清单，更新宿主提交、版本、包管理器和测试路径。修改补丁后重新计算 SHA-256，可用 `Get-FileHash patches/<文件>.patch -Algorithm SHA256`。
3. 从该官方提交开始运行 `--prepare`，再运行插件兼容回归和实际 profile 安装检查。完整构建及检查通过才将组合标为完整验证。
4. 更新本安装文档、补丁说明和验证记录；在个人仓库提交并推送。宿主目录里的修改不会随插件仓库提交自动上传，必须先导出到补丁。

仓库的 [GitHub Actions](.github/workflows/host-compatibility.yml) 会检出清单指定的干净官方源码，执行补丁准备与相关插件回归。CI 不访问你的个人 profile、凭据或远程网络，也不验证 Windows 桌面控制或手机真机。工作流需要推送后才能取得远端验证结果。
