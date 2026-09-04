export * as MemoryStore from "./store"

import { Effect, Layer, Context } from "effect"
import { join, relative, sep } from "path"
import { FSUtil } from "../fs-util"
import { Global } from "../global"
import { LayerNode } from "../effect/layer-node"
import { MemoryPaths } from "./paths"
import { MemoryRedact } from "./redact"

export interface ReadResult {
  readonly path: string
  readonly text: string
  readonly truncated: boolean
}

export interface ListEntry {
  readonly path: string
  readonly kind: "file" | "directory"
}

export interface SearchMatch {
  readonly path: string
  readonly line: number
  readonly content: string
}

export interface Interface {
  readonly read: (rel: string, opts?: { lineOffset?: number; maxLines?: number; maxBytes?: number }) => Effect.Effect<ReadResult>
  readonly list: (rel?: string) => Effect.Effect<ListEntry[]>
  readonly search: (
    queries: string[],
    opts?: { path?: string; caseSensitive?: boolean; contextLines?: number; maxResults?: number },
  ) => Effect.Effect<SearchMatch[]>
  readonly addNote: (content: string) => Effect.Effect<string>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/v2/MemoryStore") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const rootDir = MemoryPaths.fromRoot(join(global.data, "memory")).workspace.dir()

    const resolve = (rel: string) => {
      const base = relative(rootDir, join(rootDir, rel))
      return base.startsWith("..") || base.includes(sep + "..") ? undefined : join(rootDir, rel)
    }

    const read: Interface["read"] = Effect.fn("MemoryStore.read")(function* (rel, opts = {}) {
      const full = resolve(rel)
      if (!full) return { path: rel, text: "Not found: path escapes memory workspace", truncated: false }
      const exists = yield* fs.existsSafe(full).pipe(Effect.orDie)
      if (!exists) return { path: rel, text: `Not found: ${rel}`, truncated: false }
      const text = yield* fs.readFileStringSafe(full).pipe(Effect.orDie)
      if (text === undefined) return { path: rel, text: "Not found", truncated: false }
      const lines = text.split(/\r?\n/)
      const start = (opts.lineOffset ?? 1) - 1
      const paged = lines.slice(Math.max(0, start), opts.maxLines === undefined ? undefined : Math.max(0, start) + opts.maxLines)
      const joined = paged.join("\n")
      const maxBytes = opts.maxBytes ?? 256 * 1024
      const truncated = joined.length > maxBytes
      const out = truncated ? joined.slice(0, maxBytes) : joined
      return { path: rel, text: out, truncated }
    })

    const list: Interface["list"] = Effect.fn("MemoryStore.list")(function* (rel = "") {
      if (rel && !resolve(rel)) return []
      const dir = rel ? join(rootDir, rel) : rootDir
      const entries = yield* fs.readDirectoryEntries(dir).pipe(Effect.orElseSucceed(() => []))
      return entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => ({
          path: rel ? `${rel}/${entry.name}` : entry.name,
          kind: entry.type === "directory" ? ("directory" as const) : ("file" as const),
        }))
    })

    const walk = (dir: string, acc: string[]): Effect.Effect<string[], never> =>
      Effect.gen(function* () {
        const entries = yield* fs.readDirectoryEntries(dir).pipe(Effect.orElseSucceed(() => []))
        for (const entry of entries) {
          if (entry.name.startsWith(".")) continue
          const full = join(dir, entry.name)
          if (entry.type === "directory") yield* walk(full, acc)
          else acc.push(full)
        }
        return acc
      })

    const search: Interface["search"] = Effect.fn("MemoryStore.search")(function* (queries, opts = {}) {
      if (opts.path && !resolve(opts.path)) return []
      const dir = opts.path ? join(rootDir, opts.path) : rootDir
      const files = yield* walk(dir, [])
      const caseSensitive = opts.caseSensitive ?? true
      const qs = queries.map((q) => (caseSensitive ? q : q.toLowerCase()))
      const matches: SearchMatch[] = []
      for (const file of files) {
        const text = yield* fs.readFileStringSafe(file).pipe(Effect.orDie)
        if (text === undefined) continue
        const lines = text.split(/\r?\n/)
        for (let i = 0; i < lines.length; i++) {
          const line = caseSensitive ? lines[i] : lines[i].toLowerCase()
          if (qs.some((q) => line.includes(q))) {
            const context = opts.contextLines ?? 0
            const start = Math.max(0, i - context)
            const end = Math.min(lines.length, i + context + 1)
            matches.push({
              path: relative(rootDir, file).split(sep).join("/"),
              line: i + 1,
              content: lines.slice(start, end).join("\n"),
            })
          }
        }
      }
      const max = opts.maxResults ?? 200
      return matches.slice(0, max)
    })

    const addNote: Interface["addNote"] = Effect.fn("MemoryStore.addNote")(function* (content) {
      const dir = join(rootDir, "extensions", "ad_hoc", "notes")
      yield* fs.ensureDir(dir).pipe(Effect.orDie)
      // Redact secrets before the note lands on disk: dictated content bypasses
      // the extraction transcript path, which has its own redaction step.
      const name = `note-${Date.now()}.md`
      const full = join(dir, name)
      yield* fs.writeFileString(full, MemoryRedact.redact(content.trim()) + "\n").pipe(Effect.orDie)
      return `extensions/ad_hoc/notes/${name}`
    })

    return Service.of({ read, list, search, addNote })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Global.defaultLayer), Layer.provide(FSUtil.defaultLayer))

export const node = LayerNode.make(layer, [FSUtil.node, Global.node])
