# 04 — 移除旧委托并清理

**What to build:** 从 `plugin.ts` 删除 `DEFAULT_MEMORY_PLUGIN`、`isDefaultMemoryPlugin`、`isMemoryDownloading` 旧委托导出。更新 `script/bump-memory-plugin.ts` 指向 `config/builtin/memory.ts` 中的 specifier 常量。清理所有残留引用。最终 `plugin.ts` 只保留通用函数。

**Blocked by:** 03 — 泛化 config.ts 和前端状态

**Status:** ready-for-agent

- [ ] `plugin.ts` 删除 `DEFAULT_MEMORY_PLUGIN`、`isDefaultMemoryPlugin`、`isMemoryDownloading`
- [ ] `bump-memory-plugin.ts` 更新为从 `config/builtin/memory.ts` 读取/写入版本号
- [ ] 全局搜索确认无残留引用
- [ ] `bun typecheck` 通过
- [ ] 所有测试通过
