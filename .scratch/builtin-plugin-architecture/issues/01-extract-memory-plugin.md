# 01 — 提取 memory 插件模块

**What to build:** 将 opencode-mem 全部专属代码（EMBEDDING_MODEL、HF_MIRROR、flatCacheDir、preloadEmbeddingModel、downloadWithRetry、downloadFile、ensureDefaultMemoryConfig、DEFAULT_MEMORY_OPTIONS、preloading 标志位）从 `config/plugin.ts` 移到新模块 `config/builtin/memory.ts`，实现 `BuiltInPlugin` 接口。`plugin.ts` 保留 `DEFAULT_MEMORY_PLUGIN`、`isDefaultMemoryPlugin`、`isMemoryDownloading` 作为委托到 `MemoryPlugin` 的薄层，所有现有测试不变通过。

**Blocked by:** 无 — 可立即开始

**Status:** ready-for-agent

- [ ] 创建 `config/builtin/memory.ts`，实现 `BuiltInPlugin` 接口（id, specifier, env, ensure, status, isDeclared）
- [ ] 将 `plugin.ts` 中所有 opencode-mem 专属代码移入 `memory.ts`
- [ ] `plugin.ts` 旧导出改为委托（`DEFAULT_MEMORY_PLUGIN = MemoryPlugin.specifier` 等）
- [ ] `bun typecheck` 通过
- [ ] 现有 `test/config/memory.test.ts` 全部通过
