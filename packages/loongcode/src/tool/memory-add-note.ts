import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { MemoryStore } from "@loongcode/core/memory/store"

export const Parameters = Schema.Struct({
  content: Schema.String.annotate({
    description: "The note content to remember. Should be a durable, self-contained fact or preference.",
  }),
})

type Metadata = {
  path: string
}

export const MemoryAddNoteTool = Tool.define<typeof Parameters, Metadata, MemoryStore.Service>(
  "memory_add_note",
  Effect.gen(function* () {
    const store = yield* MemoryStore.Service

    return {
      description:
        "Explicitly save a note into persistent memory. Use this when the user tells you to 'remember X' " +
        "or asks you to persist a fact, preference, or convention. The note lands in the memory workspace " +
        "and is consolidated into the long-term memory index by the background pipeline.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const path = yield* store.addNote(params.content)
          return {
            title: "Memory note saved",
            output: `Saved to memory: ${path}`,
            metadata: { path },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
