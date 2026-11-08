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

先停止原 DSH，备份 DSH_HOME 并查看 `git status --short`。存在自己的源码修改或删除时使用单独的干净源码目录，不运行 `git reset --hard` 来满足脚本要求。官方已有工作区不会被准备脚本自动切换到指定提交。

个人插件更新执行插件仓库自己的 `git pull`，然后按清单检查宿主。官方 `master` 更新与个人插件更新独立；不要在生产目录直接拉取 master 后假设全部插件兼容。清单外的版本应先在新目录审查和适配补丁，再运行测试。

认证补丁使用版本化的凭据记录。不要通过回退源码或删除凭据库来回滚；先确认新旧代码的记录兼容性，保留独立数据备份。

## 维护并同步到 GitHub

1. 在独立干净目录检出准备支持的官方完整提交，适配宿主补丁；每个补丁包含源码、相关测试和必要文档，不整份复制官方仓库。
2. 将所有默认必需补丁加入清单，更新宿主提交、版本、包管理器和测试路径。修改补丁后重新计算 SHA-256，可用 `Get-FileHash patches/<文件>.patch -Algorithm SHA256`。
3. 从该官方提交开始运行 `--prepare`，再运行插件兼容回归和实际 profile 安装检查。完整构建及检查通过才将组合标为完整验证。
4. 更新本安装文档、补丁说明和验证记录；在个人仓库提交并推送。宿主目录里的修改不会随插件仓库提交自动上传，必须先导出到补丁。

仓库的 [GitHub Actions](.github/workflows/host-compatibility.yml) 会检出清单指定的干净官方源码，执行补丁准备与相关插件回归。CI 不访问你的个人 profile、凭据或远程网络，也不验证 Windows 桌面控制或手机真机。工作流需要推送后才能取得远端验证结果。
