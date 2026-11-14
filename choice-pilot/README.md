# 选项领航

`@local/dsh-choice-pilot` · **0.10.0**

给日常对话提供可点击的快捷回复。比如聊到一个概念时，点「举个例子」「讲讲原理」或「和另一种方法比较」，就能指导 Agent 的下一轮回复。

- 输入框为空且没有附件时，点选即发送。有草稿或附件时，回复内容追加到草稿，检查后发送。
- 每次给出 1–4 个不同方向。没有自然的聊天分支时，可以直接结束。
- 执行任务中的澄清、确认、等待和审批由 DSH 官方交互处理。

升级后可从 profile 的 `choice-pilot` 配置中移除旧的 `useRecommendedOnTimeout` 和 `timeoutSeconds`。快捷回复只在用户主动点击后提交。

验证：`node tools/choice-pilot-test.mjs`。
