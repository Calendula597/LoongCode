# Built-in Plugin Architecture

**Date:** 2026-08-05
**Status:** Proposed
**Scope:** Refactor the current one-off opencode-mem integration into a reusable built-in plugin framework so that future internal plugins can be added with minimal boilerplate and no scattered environment-variable or config-injection changes.

---

## Problem Statement

LoongCode currently ships `opencode-mem` as a built-in plugin. The integration works but is not extensible:

- **Environment variables are scattered across 5 entry points.** `HF_ENDPOINT` and `HF_HUB_OFFLINE` are duplicated in `loongcode/index.ts`, `desktop/index.ts`, `desktop/sidecar.ts`, `desktop/wsl/sidecar.ts`, and `config/plugin.ts`. Adding a new entry point or a second plugin with its own env requirements risks silent omission.

- **Plugin-specific logic pollulates the generic plugin module.** 75% of `config/plugin.ts` is opencode-mem-only code (embedding model download, HF mirror configuration, memory jsonc read/write). A second built-in plugin has nowhere to live without further bloating this file.

- **Config loading has hardcoded per-plugin branches.** `config.ts` has 4 lines of memory-specific logic inline in the generic config merge flow. Each new plugin would add another branch here.

- **Front-end status coupling is one-to-one.** `memory_downloading` is an ad-hoc field injected into the config payload. A second plugin needs its own `xxx_downloading` field and a matching front-end handler.

The user plans to embed multiple additional plugins and needs a clean, repeatable pattern.

---

## Solution

Introduce a `BuiltInPlugin` interface and a registry. Each built-in plugin lives in its own module under `config/builtin/`. Entry points, config loading, and front-end status all read from the registry via a single loop — no per-plugin code in shared infrastructure.

---

## User Stories

1. As a LoongCode maintainer, I want to add a new built-in plugin by creating a single file and registering it, so that I don't need to modify entry points, config.ts, or front-end code.

2. As a LoongCode maintainer, I want each built-in plugin to declare its own environment variables, so that they are applied consistently across all entry points without manual duplication.

3. As a LoongCode maintainer, I want each built-in plugin to own its setup logic (model downloads, config file seeding, status reporting), so that the generic plugin module stays clean.

4. As a LoongCode maintainer, I want the config loader to iterate over all registered built-in plugins generically, so that no per-plugin branches exist in the config merge flow.

5. As a LoongCode maintainer, I want the front-end to read a unified `builtin_plugins` status object from the config payload, so that adding a new plugin doesn't require front-end changes.

6. As a LoongCode maintainer, I want the default global config to list all built-in plugin specifiers automatically, so that a fresh install has all internal plugins enabled without explicit listing.

7. As a LoongCode maintainer, I want a built-in plugin to be disabled by setting `"<pluginId>": false` in the config, so that users can opt out of any internal plugin.

8. As a LoongCode maintainer, I want a built-in plugin's download progress to surface in the front-end via a generic status field, so that users see a consistent "downloading..." indicator for any plugin that needs to fetch assets.

9. As a LoongCode maintainer, I want a built-in plugin to be able to auto-correct its own external config file when it drifts (wrong model name, unsafe defaults), so that the plugin initializes successfully after updates.

10. As a LoongCode maintainer, I want the registry to be a plain array constant, so that it is tree-shakeable, testable, and has no runtime side effects at import time.

11. As a LoongCode maintainer, I want the existing `opencode-mem` integration to be migrated to the new pattern, so that it serves as the reference implementation.

12. As a LoongCode maintainer, I want entry-point env application to happen in a single function call before any plugin imports, so that transformers.js and similar libraries see the correct environment from the start.

13. As a LoongCode maintainer, I want the WSL sidecar to also use the registry for env vars, so that Linux-side subprocesses get the same offline/mirror settings.

14. As a LoongCode maintainer, I want plugin specifiers to be version-pinned in the registry, so that CI bumps are explicit and cache-keyed.

15. As a LoongCode maintainer, I want the `isDefaultMemoryPlugin` / `isMemoryDownloading` exports to remain available during migration, so that existing tests pass before they are updated to the new API.

---

## Implementation Decisions

### 1. `BuiltInPlugin` interface

A new interface defines the contract for built-in plugins:

```ts
type PluginStatus = {
  downloading: boolean
  message?: string
}

type BuiltInPlugin = {
  id: string                         // "memory"
  specifier: string                  // "opencode-mem@2.24.0"
  env: Record<string, string>        // { HF_ENDPOINT: "...", HF_HUB_OFFLINE: "1" }
  ensure(): void                     // check cache, start bg download, fix config
  status(): PluginStatus             // report current state for front-end
  isDeclared(spec: ConfigPluginV1.Spec): boolean  // match this plugin's specifier
}
```

The interface is intentionally synchronous for `ensure()` and `status()` — model downloads kick off in the background via `setTimeout` (as the current implementation already does), and `status()` reads an in-memory flag. No Effect types are needed.

### 2. Registry

A single array constant in a new module `config/builtin/index.ts`:

```ts
export const BUILT_IN_PLUGINS: BuiltInPlugin[] = [MemoryPlugin]
```

Each plugin is a separate module under `config/builtin/` (e.g. `config/builtin/memory.ts`). The registry file re-exports nothing but the array and the interface type.

### 3. Entry-point env application

A single function replaces the 5 scattered `process.env` assignments:

```ts
export function applyBuiltInPluginEnv(): void {
  for (const plugin of BUILT_IN_PLUGINS) {
    for (const [key, value] of Object.entries(plugin.env)) {
      process.env[key] = value
    }
  }
}
```

All entry points call `applyBuiltInPluginEnv()` before any import that could trigger a plugin's `transformers.js` or similar lazy load. The function lives in `config/builtin/index.ts` and is safe to call multiple times.

### 4. Config loader integration

The 4 lines of memory-specific code in `config.ts` become a generic loop:

```ts
if (result.memory !== false) {  // existing gate, stays for backward compat
  for (const plugin of BUILT_IN_PLUGINS) {
    if (result[plugin.id] === false) continue
    yield* Effect.sync(() => plugin.ensure())
    const declared = (result.plugin ?? []).some((spec) => plugin.isDeclared(spec))
    if (!declared) {
      yield* mergePluginOrigins(Global.Path.config, [plugin.specifier], "global")
    }
  }
}
;(result as Record<string, unknown>).builtin_plugins =
  Object.fromEntries(BUILT_IN_PLUGINS.map((p) => [p.id, p.status()]))
```

The per-plugin `"memory": false` gate is replaced by `result[plugin.id] === false`, so each plugin has its own opt-out key. Backward compatibility: `"memory": false` still works because the memory plugin's `id` is `"memory"`.

### 5. Front-end status

The front-end reads `config.builtin_plugins` instead of `config.memory_downloading`:

```ts
const plugins = serverSync().data.config.builtin_plugins as Record<string, PluginStatus>
const downloading = Object.values(plugins).some((p) => p.downloading)
```

The memory switch's `disabled` prop and description use the generic field. New plugins get the same treatment for free if they expose a `downloading` status. The old `memory_downloading` field is removed.

### 6. Migration of existing opencode-mem code

All opencode-mem-specific code (EMBEDDING_MODEL, HF_MIRROR, flatCacheDir, flatModelDir, isModelCached, preloadEmbeddingModel, downloadWithRetry, downloadFile, ensureDefaultMemoryConfig, DEFAULT_MEMORY_OPTIONS, preloading flag) moves from `config/plugin.ts` to `config/builtin/memory.ts`. The `config/plugin.ts` module keeps only the generic functions it already has: `load`, `pluginSpecifier`, `pluginOptions`, `resolvePluginSpec`, `deduplicatePluginOrigins`, `isDefaultMemoryPlugin` (deprecated, delegates to `MemoryPlugin.isDeclared`).

### 7. WSL sidecar

The `wsl/sidecar.ts` script currently hardcodes `HF_ENDPOINT` and `HF_HUB_OFFLINE` as shell exports. After refactoring, these are generated from the registry:

```ts
const envExports = BUILT_IN_PLUGINS
  .flatMap((p) => Object.entries(p.env))
  .map(([k, v]) => `export ${k}=${shellEscape(v)}`)
  .join("\n")
```

### 8. Default global config seeding

The existing `{ $schema: "...", plugin: [ConfigPlugin.DEFAULT_MEMORY_PLUGIN] }` in config.ts becomes:

```ts
{ $schema: "...", plugin: BUILT_IN_PLUGINS.map((p) => p.specifier) }
```

---

## Testing Decisions

### Seam

The highest existing seam is `Config.use.get()` — the full config loading flow. The current `test/config/memory.test.ts` suite already uses this seam to verify that the default memory plugin is injected, not duplicated, and skippable via `memory: false`. This seam remains the primary test boundary.

### What to test

1. **Registry-level unit tests** (new): `BUILT_IN_PLUGINS` has expected length, each plugin has a unique `id`, `env` values are strings, `ensure()` and `status()` don't throw.

2. **Config integration tests** (existing pattern, extended): The existing `config.memory` test cases are generalized:
   - "appends all built-in plugins when not declared" — verify `config.plugin` contains every `plugin.specifier`.
   - "does not append a built-in plugin when its id is false" — verify `result[plugin.id] === false` skips that plugin.
   - "does not duplicate a built-in plugin when already declared" — one match per plugin.

3. **Env application test** (new): Call `applyBuiltInPluginEnv()` in a test, assert `process.env` contains all expected keys, restore env after test.

4. **Per-plugin tests** (new, `test/config/builtin/memory.test.ts`): `isModelCached()` returns true after files are created, `status().downloading` is false when cache is present, `ensure()` writes the jsonc config when missing.

### Prior art

The existing `test/config/memory.test.ts` and `test/config/config.test.ts` suites provide the Effect layer setup pattern (`testEffect(layer)`, `provideInstanceEffect(dir)`, `withGlobalConfig`). New tests follow this pattern.

### What NOT to test

- Download retry logic (network-dependent, already exercised manually).
- transformers.js cache lookup behavior (third-party library internals).
- Front-end rendering (no test infrastructure for solid-js components in this repo).

---

## Out of Scope

- Plugin hot-reloading or dynamic registration — the registry is a compile-time array.
- Plugin dependency resolution (ordering, conflicts) — assumed independent.
- A plugin marketplace or user-installable plugins via UI — this spec covers built-in (shipped) plugins only.
- Refactoring the `Npm.add` install path or the plugin loader (`plugin/index.ts`).
- Migrating auto-capture provider configuration (separate concern, tracked elsewhere).
- Removing the `opencode-mem.jsonc` external config file — the plugin reads it directly and this spec preserves that behavior.

---

## Further Notes

### Migration path

The refactoring can be done in 3 incremental commits:

1. **Extract `config/builtin/memory.ts`** — move all opencode-mem code verbatim, keep `config/plugin.ts` re-exporting the old names for test compatibility.
2. **Introduce registry + `applyBuiltInPluginEnv()`** — add `config/builtin/index.ts`, update all entry points to call the single function, remove scattered env assignments.
3. **Generalize config.ts + front-end** — replace memory-specific branches with the registry loop, switch front-end from `memory_downloading` to `builtin_plugins`.

Each commit leaves the application functional.

### Why synchronous `ensure()`

The current `ensureDefaultMemoryConfig()` is synchronous — it sets env vars, checks cache, starts a background download via `setTimeout`, and returns. The `BuiltInPlugin.ensure()` preserves this pattern. Plugins that need async work (like model downloads) schedule it in the background and report progress via `status()`. This avoids changing the Effect-returning config flow to await plugin setup.

### Backward compatibility

- `config.plugin.ts` retains `DEFAULT_MEMORY_PLUGIN`, `isDefaultMemoryPlugin`, and `isMemoryDownloading` as thin delegates to `MemoryPlugin` during migration. They can be removed once all callers are updated.
- `"memory": false` in user configs continues to work because the memory plugin's `id` is `"memory"`.
- The `opencode-mem.jsonc` file path and format are unchanged.
