# 本地文件树定位支持

此补丁供掌上行舟 0.7.x 的文件定位功能使用。当前 0.8.1 使用原生工作区文件入口，不调用 revealPath，也不需要应用此补丁。

掌上行舟 0.7.0 的「定位文件」使用宿主公开导航 `sidebarRight.openTab('files', { destination: 'sidebar', params: { revealPath } })`。文件树展开父目录、标记目标行，由用户点击文件行打开原生预览，不从插件直接构造预览地址。

已包含相同源码修改的工作区不要重复应用补丁。迁移到其他匹配的 DSH 源码副本时，先在该副本根目录执行 `git apply --check <补丁路径>`，检查通过后再执行 `git apply <补丁路径>`。补丁为本目录的 `local-file-reveal.patch`，不包含认证修改或凭据。若检查失败，停止并对照文件树相关源码合并，不要强制覆盖。

更新后执行 `pnpm run build:artifacts`，再执行 `pnpm run build:check`。使用原 profile 重启 DSH，然后刷新浏览器。仅更新个人插件时也能打开本地文件页，但旧宿主会忽略文件定位参数，需要手动展开目录。文件不在工作区内或已被删除时不会扩大读取范围。

聚焦验证：`pnpm exec vitest run packages/client/ui-sidebar-files/tests/files-body.client.spec.tsx packages/client/ui-sidebar-files/tests/files-navigator.client.spec.tsx packages/client/ui-sidebar-files/tests/definition.client.spec.ts packages/client/ui-sidebar-files/tests/face.client.spec.ts`。
