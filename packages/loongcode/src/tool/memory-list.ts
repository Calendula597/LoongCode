import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { MemoryStore } from "@loongcode/core/memory/store"

export const Parameters = Schema.Struct({
  path: Schema.optional(Schema.String).annotate({
    description: "Directory relative to the memory workspace to list (default root)",
  }),
})

type Metadata = {
  entries: MemoryStore.ListEntry[]
}

export const MemoryListTool = Tool.define<typeof Parameters, Metadata, MemoryStore.Service>(
  "memory_list",
  Effect.gen(function* () {
    const store = yield* MemoryStore.Service

    return {
      description:
        "List files and directories in the persistent memory workspace. Returns sorted entries " +
        "relative to the memory root. Use to discover what memories exist before reading or searching.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const entries = yield* store.list(params.path)
          const lines = entries.map((e) => `${e.kind === "directory" ? "dir " : "file"} ${e.path}`)
          return {
            title: `Listed ${entries.length} memory entr${entries.length === 1 ? "y" : "ies"}`,
            output: lines.length ? lines.join("\n") : "(empty)",
            metadata: { entries },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
