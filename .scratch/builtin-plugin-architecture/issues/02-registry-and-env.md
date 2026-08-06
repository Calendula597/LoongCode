# 02 — 引入 registry 和 applyBuiltInPluginEnv

**What to build:** 创建 `config/builtin/index.ts`，导出 `BuiltInPlugin` 类型、`BUILT_IN_PLUGINS` 数组常量和 `applyBuiltInPluginEnv()` 函数。更新全部 5 个入口点（loongcode/index.ts、desktop/index.ts、sidecar.ts、wsl/sidecar.ts）调用 `applyBuiltInPluginEnv()` 替代散落的 `process.env` 赋值。WSL sidecar 从 registry 生成 shell env exports。

**Blocked by:** 01 — 提取 memory 插件模块

**Status:** ready-for-agent

- [ ] 创建 `config/builtin/index.ts`（类型 + registry + applyBuiltInPluginEnv）
- [ ] loongcode/index.ts 调用 `applyBuiltInPluginEnv()` 替代内联 env 赋值
- [ ] desktop/index.ts 同上
- [ ] desktop/sidecar.ts 同上
- [ ] desktop/wsl/sidecar.ts 从 registry 生成 env exports
- [ ] `bun typecheck` 通过
- [ ] 现有测试全部通过
