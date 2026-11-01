# 会话清道

`@local/dsh-session-reaper` · **0.3.1** · Host + Web 客户端

在会话菜单中直接清理已停止的会话。

## 使用

安装本目录，重启 DSH 并刷新网页。在会话的“…”菜单中点击“删除会话”。删除立即永久生效，无需确认，没有撤回入口或回收站；运行中的会话受保护，需先停止。

支持删除已停止的当前会话，完成后刷新列表并切换到其他会话或新会话。操作失败会显示原因；删除成功但刷新失败时，手动刷新列表检查。

## 兼容边界

当前实现适配 DSH 的 Agent 生命周期及 JSONL 会话目录，只支持匹配 `DSH_HOME/sessions` 的布局。上游内部结构改变、路径校验失败或无法安全释放会话时会拒绝删除。

0.3.1 仅统一显示名称，不包含其他分支或历史本地版本的撤回功能。

## 验证

```powershell
node tools/session-reaper-lifecycle-test.mjs
node tools/session-reaper-client-test.mjs
```

从仓库根目录执行，测试使用临时会话。依赖和环境要求见[仓库说明](../README.md#验证)。
