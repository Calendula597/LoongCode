import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { MemoryStore } from "@loongcode/core/memory/store"

export const Parameters = Schema.Struct({
  path: Schema.String.annotate({
    description: "Relative path inside the memory workspace (e.g. MEMORY.md, rollout_summaries/session-xyz.md)",
  }),
  line_offset: Schema.optional(Schema.Int).annotate({ description: "1-indexed line to start reading from" }),
  max_lines: Schema.optional(Schema.Int).annotate({ description: "Maximum number of lines to return" }),
})

type Metadata = {
  path: string
  truncated: boolean
}

export const MemoryReadTool = Tool.define<typeof Parameters, Metadata, MemoryStore.Service>(
  "memory_read",
  Effect.gen(function* () {
    const store = yield* MemoryStore.Service

    return {
      description:
        "Read a file from the persistent memory workspace (MEMORY.md, rollout_summaries/*, skills/*, etc.). " +
        "Paths are relative to the memory workspace and cannot escape it. Supports line_offset/max_lines for " +
        "reading a window of a large file.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const result = yield* store.read(params.path, {
            lineOffset: params.line_offset,
            maxLines: params.max_lines,
          })
          return {
            title: `Read ${params.path}`,
            output: result.text,
            metadata: { path: params.path, truncated: result.truncated },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
