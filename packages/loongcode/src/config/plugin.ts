import { Glob } from "@loongcode/core/util/glob"
import { ConfigPluginV1 } from "@loongcode/core/v1/config/plugin"
import { pathToFileURL } from "url"
import { isPathPluginSpec, parsePluginSpecifier, resolvePathPluginTarget } from "@/plugin/shared"
import path from "path"
import os from "os"
import { existsSync, writeFileSync, readFileSync, mkdirSync, createWriteStream, statSync, unlinkSync } from "fs"

export type Scope = "global" | "local"

// Built-in default memory plugin. Pin the version so Npm.add's spec-keyed cache
// auto-refreshes when CI bumps this constant; runtime updates without a release are
// intentionally not supported.
export const DEFAULT_MEMORY_PLUGIN = "opencode-mem@2.24.0"

export function isDefaultMemoryPlugin(plugin: ConfigPluginV1.Spec): boolean {
  const spec = pluginSpecifier(plugin)
  if (spec.startsWith("file://")) return false
  return parsePluginSpecifier(spec).pkg === "opencode-mem"
}

// opencode-mem reads its own jsonc config and would create an all-on template on
// first run, so we pre-seed conservative defaults: no auto capture, no web UI, no
// toast. The tuple `plugin` options field is not read by this plugin.
const DEFAULT_MEMORY_OPTIONS = {
  autoCaptureEnabled: false,
  webServerEnabled: false,
  toastEnabled: false,
}

const EMBEDDING_MODEL = "Xenova/multilingual-e5-small"
const HF_MIRROR = "https://hf-mirror.com"

// transformers.js FileCache expects flat paths under cacheDir:
//   <cacheDir>/<model_id>/<filename>
// e.g. <cacheDir>/Xenova/multilingual-e5-small/tokenizer.json
// This is NOT the HuggingFace hub layout (models--<org>--<model>/snapshots/<sha>/).
function flatCacheDir() {
  return path.join(os.homedir(), ".opencode-mem", "data", ".cache")
}

function flatModelDir() {
  return path.join(flatCacheDir(), EMBEDDING_MODEL)
}

function isModelCached() {
  return existsSync(path.join(flatModelDir(), "tokenizer.json"))
    && existsSync(path.join(flatModelDir(), "config.json"))
}

async function preloadEmbeddingModel() {
  if (isModelCached()) return

  console.log(`[memory] downloading embedding model (~130MB, one-time)...`)

  try {
    const infoRes = await fetch(`${HF_MIRROR}/api/models/${EMBEDDING_MODEL}`)
    const info = (await infoRes.json()) as { sha: string; siblings: { rfilename: string }[] }
    const { siblings } = info

    // HF API siblings may omit non-LFS files (tokenizer etc.), so merge with the
    // known set of files transformers.js always needs for this model.
    // Skip fp16/ort model variants — CPU-only, the quantized bnb4 is sufficient.
    const knownFiles = [
      "config.json",
      "tokenizer.json",
      "tokenizer_config.json",
      "special_tokens_map.json",
    ]
    const skipSuffixes = ["_fp16.onnx", "_ort.onnx", "model.onnx_data"]
    const apiFiles = siblings
      .map((s) => s.rfilename)
      .filter((f) => !skipSuffixes.some((s) => f.endsWith(s)))
    const files = [...new Set([...knownFiles, ...apiFiles])]

    const modelDir = flatModelDir()
    mkdirSync(modelDir, { recursive: true })

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const url = `${HF_MIRROR}/${EMBEDDING_MODEL}/resolve/main/${file}`
      const dest = path.join(modelDir, file)
      const label = `${file}`

      mkdirSync(path.dirname(dest), { recursive: true })

      // Resume from partial download if it exists
      const existing = existsSync(dest) ? statSync(dest).size : 0
      if (existing > 0) process.stdout.write(`[memory] ${label} resuming from ${Math.round(existing / 1024)}KB...\n`)

      await downloadWithRetry(url, dest, existing, label)
      process.stdout.write(`\r[memory] ${label} done\n`)
    }

    console.log("[memory] embedding model download complete")
  } catch (err) {
    console.error("[memory] embedding model download failed:", (err as Error).message)
  }
}

let preloading = false

export function isMemoryDownloading() {
  return preloading
}

async function downloadWithRetry(url: string, dest: string, offset: number, label: string, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await downloadFile(url, dest, offset, label)
      return
    } catch (err) {
      const msg = (err as Error).message
      // HTTP 416 means the Range offset exceeds the file size (e.g. small files
      // with a stale partial write). Delete the partial and restart from zero.
      if (msg === "HTTP 416") {
        try { unlinkSync(dest) } catch {}
        offset = 0
      }
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000
        offset = offset === 0 ? 0 : (existsSync(dest) ? statSync(dest).size : 0)
        process.stdout.write(`\n[memory] retrying ${label} in ${delay / 1000}s (attempt ${attempt + 2}/${retries + 1})...\n`)
        await new Promise((r) => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }
}

async function downloadFile(url: string, dest: string, offset: number, label: string) {
  const headers: Record<string, string> = {}
  if (offset > 0) headers["Range"] = `bytes=${offset}-`

  const res = await fetch(url, { headers })
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)

  const total = parseInt(res.headers.get("content-length") || "0", 10) + offset
  const reader = res.body!.getReader()
  const writer = createWriteStream(dest, { flags: offset > 0 ? "a" : "w" })

  let received = offset
  const startTime = Date.now()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      writer.write(value)
      if (total > 0) {
        const pct = Math.round((received / total) * 100)
        const elapsed = (Date.now() - startTime) / 1000
        const speed = elapsed > 0 ? Math.round(received / elapsed / 1024) : 0
        process.stdout.write(`\r[memory] ${label} ${pct}% (${speed} KB/s)`)
      }
    }
  } finally {
    writer.end()
  }
}

export function ensureDefaultMemoryConfig(): void {
  process.env.HF_ENDPOINT = HF_MIRROR
  // Prevent transformers.js from trying to reach the network to verify the
  // cache — all model files are pre-downloaded and verified locally.
  process.env.HF_HUB_OFFLINE = "1"

  if (isModelCached()) {
    console.log("[memory] embedding model cache found, ready to use")
  } else {
    console.log("[memory] embedding model download starting in background...")
    if (!preloading) {
      preloading = true
      setTimeout(() => {
        preloadEmbeddingModel().finally(() => { preloading = false }).catch(() => {})
      }, 0)
    }
  }

  const file = path.join(os.homedir(), ".config", "opencode", "opencode-mem.jsonc")
  if (!existsSync(file)) {
    writeFileSync(
      file,
      JSON.stringify({ ...DEFAULT_MEMORY_OPTIONS, embeddingModel: EMBEDDING_MODEL }, null, 2),
    )
    return
  }

  // Ensure the embedding model and conservative defaults are set. The plugin
  // creates an all-on template on first run, but auto-capture needs a provider
  // and the web server can fail silently — disable both unless the user opts in.
  try {
    const raw = readFileSync(file, "utf-8")
    let updated = raw
    if (!updated.includes(`"embeddingModel": "${EMBEDDING_MODEL}"`)) {
      updated = updated.replace(/"embeddingModel"\s*:\s*"[^"]+"/, `"embeddingModel": "${EMBEDDING_MODEL}"`)
    }
    for (const [key, value] of Object.entries(DEFAULT_MEMORY_OPTIONS)) {
      const pattern = new RegExp(`"${key}"\\s*:\\s*(true|false)`)
      if (!pattern.test(updated)) continue
      updated = updated.replace(pattern, `"${key}": ${value}`)
    }
    if (updated !== raw) {
      writeFileSync(file, updated)
      console.log(`[memory] config updated to match pre-downloaded model and defaults`)
    }
  } catch {
    // If the file is malformed, overwrite with defaults
    writeFileSync(
      file,
      JSON.stringify({ ...DEFAULT_MEMORY_OPTIONS, embeddingModel: EMBEDDING_MODEL }, null, 2),
    )
  }
}

// Origin keeps the original config provenance attached to a spec.
// After multiple config files are merged, callers still need to know which file declared the plugin
// and whether it should behave like a global or project-local plugin.
export type Origin = {
  spec: ConfigPluginV1.Spec
  source: string
  scope: Scope
}

export async function load(dir: string) {
  const plugins: ConfigPluginV1.Spec[] = []

  for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    plugins.push(pathToFileURL(item).href)
  }
  return plugins
}

export function pluginSpecifier(plugin: ConfigPluginV1.Spec): string {
  return Array.isArray(plugin) ? plugin[0] : plugin
}

export function pluginOptions(plugin: ConfigPluginV1.Spec): ConfigPluginV1.Options | undefined {
  return Array.isArray(plugin) ? plugin[1] : undefined
}

// Path-like specs are resolved relative to the config file that declared them so merges later on do not
// accidentally reinterpret `./plugin.ts` relative to some other directory.
export async function resolvePluginSpec(
  plugin: ConfigPluginV1.Spec,
  configFilepath: string,
): Promise<ConfigPluginV1.Spec> {
  const spec = pluginSpecifier(plugin)
  if (!isPathPluginSpec(spec)) return plugin

  const base = path.dirname(configFilepath)
  const file = (() => {
    if (spec.startsWith("file://")) return spec
    if (path.isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec)) return pathToFileURL(spec).href
    return pathToFileURL(path.resolve(base, spec)).href
  })()

  const resolved = await resolvePathPluginTarget(file).catch(() => file)

  if (Array.isArray(plugin)) return [resolved, plugin[1]]
  return resolved
}

// Dedupe on the load identity (package name for npm specs, exact file URL for local specs), but keep the
// full Origin so downstream code still knows which config file won and where follow-up writes should go.
export function deduplicatePluginOrigins(plugins: Origin[]): Origin[] {
  const seen = new Set<string>()
  const list: Origin[] = []

  for (const plugin of plugins.toReversed()) {
    const spec = pluginSpecifier(plugin.spec)
    const name = spec.startsWith("file://") ? spec : parsePluginSpecifier(spec).pkg
    if (seen.has(name)) continue
    seen.add(name)
    list.push(plugin)
  }

  return list.toReversed()
}

export * as ConfigPlugin from "./plugin"
