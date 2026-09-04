import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { MemoryStore } from "@loongcode/core/memory/store"

export const Parameters = Schema.Struct({
  queries: Schema.mutable(Schema.Array(Schema.String)).annotate({
    description: "Search substrings to match within memory files",
  }),
  path: Schema.optional(Schema.String).annotate({
    description: "Restrict the search to a file or directory relative to the memory workspace",
  }),
  case_sensitive: Schema.optional(Schema.Boolean).annotate({ description: "Case-sensitive matching (default true)" }),
  context_lines: Schema.optional(Schema.Int).annotate({ description: "Extra lines of context around each match" }),
  max_results: Schema.optional(Schema.Int).annotate({ description: "Max matches to return (default 200)" }),
})

type Metadata = {
  count: number
}

export const MemorySearchTool = Tool.define<typeof Parameters, Metadata, MemoryStore.Service>(
  "memory_search",
  Effect.gen(function* () {
    const store = yield* MemoryStore.Service

    return {
      description:
        "Search the persistent memory workspace (MEMORY.md, rollout_summaries/*, skills/*, notes) for substring " +
        "matches. Returns matching lines with file:line references so you can read the full entry with memory_read.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const queries = (params.queries ?? []).map((q) => q.trim()).filter(Boolean)
          if (queries.length === 0) {
            return {
              title: "Memory search",
              output: "No search queries provided.",
              metadata: { count: 0 },
            }
          }
          const matches = yield* store.search(queries, {
            path: params.path,
            caseSensitive: params.case_sensitive ?? true,
            contextLines: params.context_lines ?? 0,
            maxResults: params.max_results ?? 200,
          })
          const lines = matches.map((m) => `${m.path}:${m.line}: ${m.content.split("\n")[0]}`)
          return {
            title: `Found ${matches.length} memory match${matches.length === 1 ? "" : "es"}`,
            output: lines.length ? lines.join("\n") : "No matches found.",
            metadata: { count: matches.length },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
