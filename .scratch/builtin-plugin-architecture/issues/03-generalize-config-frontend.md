# 03 — 泛化 config.ts 和前端状态

**What to build:** config.ts 中 memory 专属分支（ensureDefaultMemoryConfig 调用、isDeclared 检查、mergePluginOrigins、memory_downloading 注入）替换为遍历 `BUILT_IN_PLUGINS` 的通用循环。默认全局配置从 registry 生成 specifier 列表。`memory_downloading` 字段替换为 `builtin_plugins` 状态对象。前端 settings-v2/general.tsx 和 settings-general.tsx 切换到通用 `builtin_plugins` 字段。现有 memory 测试泛化为验证所有内置插件的行为。

**Blocked by:** 02 — 引入 registry 和 applyBuiltInPluginEnv

**Status:** ready-for-agent

- [ ] config.ts 的 memory 专属逻辑替换为 `for (const plugin of BUILT_IN_PLUGINS)` 循环
- [ ] 默认全局配置用 `BUILT_IN_PLUGINS.map(p => p.specifier)` 替代 `DEFAULT_MEMORY_PLUGIN`
- [ ] `memory_downloading` 替换为 `builtin_plugins` 对象
- [ ] settings-v2/general.tsx 切换到 `builtin_plugins` 通用字段
- [ ] settings-general.tsx 同上
- [ ] 现有 memory 测试泛化（验证所有 BUILT_IN_PLUGINS 的注入/去重/跳过）
- [ ] `bun typecheck` 通过
- [ ] 所有测试通过
