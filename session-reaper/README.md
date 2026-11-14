# 会话清道

`@local/dsh-session-reaper` · **0.5.0**

在会话侧栏的「…」菜单选择「删除会话」，核对标题后确认。每次删除一个已停止的会话。确认后有 5 秒可以点击「撤销」。等待期间会话仍可见，刷新或退出页面会取消待执行的删除。到期后永久删除本机会话记录。

插件先释放会话并刷新写入，再通过宿主持久化接口定位实际 JSONL 日志，校验路径后删除该会话目录，并核验目录及持久化记录已消失。支持 `DSH_HOME/sessions` 下的普通和 Zstandard 压缩日志。已经从侧栏消失的旧记录需要单独核对，升级时不会自动扫描清理。

验证：`node tools/session-reaper-client-test.mjs` 和 `node tools/session-reaper-lifecycle-test.mjs`。
