// Lightweight entry point that exports only the built-in plugin env helpers.
// Built as a separate bundle so desktop entry points can import it without
// pulling in the full server (and its transformers.js dependency chain).
export { applyBuiltInPluginEnv, BUILT_IN_PLUGIN_ENV } from "@/config/builtin"
