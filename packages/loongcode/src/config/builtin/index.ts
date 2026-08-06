import { MemoryPlugin, type BuiltInPlugin, type PluginStatus } from "./memory"

export type { BuiltInPlugin, PluginStatus }

export const BUILT_IN_PLUGINS: BuiltInPlugin[] = [MemoryPlugin]

// Flattened env vars from all built-in plugins — for consumers that need the raw
// key-value pairs (e.g. WSL sidecar generating shell exports).
export const BUILT_IN_PLUGIN_ENV: Record<string, string> = Object.fromEntries(
  BUILT_IN_PLUGINS.flatMap((p) => Object.entries(p.env)),
)

// Apply all built-in plugin environment variables to the current process.
// Must be called before any module imports a plugin's dependencies (e.g.
// @huggingface/transformers) so they see the correct environment from the start.
export function applyBuiltInPluginEnv(): void {
  for (const [key, value] of Object.entries(BUILT_IN_PLUGIN_ENV)) {
    process.env[key] = value
  }
}
