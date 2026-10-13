import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Memory } from "@/memory"

export const Parameters = Schema.Struct({})

type Metadata = {
  reset: boolean
}

export const MemoryResetTool = Tool.define<typeof Parameters, Metadata, Memory.Service>(
  "memory_reset",
  Effect.gen(function* () {
    const memory = yield* Memory.Service

    return {
      description:
        "Wipe all persistent memory: deletes the memory workspace (MEMORY.md, memory_summary.md, skills, notes) " +
        "and clears the memory database (extraction jobs, outputs, citation usage). Refuses to run when the " +
        "memory root is a symlink. This is the only destructive memory operation.",
      parameters: Parameters,
      execute: () =>
        Effect.gen(function* () {
          const reset = yield* memory.reset()
          return {
            title: "Memory reset",
            output: reset
              ? "Memory reset complete. The memory workspace and database have been cleared."
              : "Memory reset refused: memory root is a symlink. Remove the symlink and retry.",
            metadata: { reset },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
