# 会话清道

`@local/dsh-session-reaper` · **0.5.0**

点击已停止会话的「删除会话」即可移入回收区。成功提示会在 1 秒后收起。

插件自动注册指向 `DSH_HOME/session-reaper-trash` 的「回收区」工作区，也会复用相同目录的现有工作区。通过侧栏「回收区」的「…」菜单选择「查看回收区」，即可查看回收记录、恢复原会话、永久删除单条或勾选后批量永久删除。永久删除直接执行，失败会显示在回收区列表中。

回收记录保留原会话 ID 和日志。恢复后会话回到原来的工作区。旧版回收记录没有保存的标题时显示会话 ID。

验证使用 `node tools/session-reaper-client-test.mjs` 和 `node tools/session-reaper-lifecycle-test.mjs`。
