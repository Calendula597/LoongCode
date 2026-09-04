export * as MemoryContext from "./context"

import { Effect, Layer, Option, Schema } from "effect"
import { join } from "path"
import { Global } from "../global"
import { Config } from "../config"
import { MemoryPaths } from "./paths"
import { SystemContext } from "../system-context/index"
import { SystemContextRegistry } from "../system-context/registry"
import { FSUtil } from "../fs-util"

/** Token estimate: ~4 chars per token (matches the plugin port). */
const SUMMARY_TOKEN_BUDGET = 2500
const CHARS_PER_TOKEN = 4

const key = SystemContext.Key.make("memory/summary")
const CITATION_GUIDANCE =
  "When your answer uses a memory, cite it at the very end of your reply with " +
  "<memory-citation session_ids=[\"ses_...\"]></memory-citation> so the system can track which memories are useful."
const text = (summary: string) =>
  SystemContext.make({
    key,
    codec: Schema.toCodecJson(Schema.String),
    load: Effect.succeed(summary),
    baseline: (summary) =>
      ["## Memory", "The following is a summary of what you have learned about the user from past sessions.", "", summary, "", CITATION_GUIDANCE].join(
        "\n",
      ),
    update: (_previous, summary) =>
      ["Your memory summary has been updated:", "", summary, "", CITATION_GUIDANCE].join("\n"),
    removed: () => "Your memory is no longer available.",
  })

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const registry = yield* SystemContextRegistry.Service

    const config = yield* Effect.serviceOption(Config.Service)
    const entries = yield* Option.match(config, {
      onNone: () => Effect.succeed<Config.Entry[]>([]),
      onSome: (service) => service.entries(),
    })
    const memory = Config.latest(entries, "memory")
    const useMemories = memory === undefined ? false : (memory.use_memories ?? true)

    const readSummary = Effect.fn("MemoryContext.readSummary")(function* () {
      const file = MemoryPaths.fromRoot(join(global.data, "memory")).workspace.summary()
      const content = yield* fs.readFileStringSafe(file)
      if (content === undefined) return ""
      const chars = Math.min(content.length, SUMMARY_TOKEN_BUDGET * CHARS_PER_TOKEN)
      return content.slice(0, chars)
    })

    yield* registry.register({
      key,
      load: (useMemories
        ? readSummary().pipe(
            Effect.map((summary) => (summary.length === 0 ? SystemContext.empty : text(summary))),
          )
        : Effect.succeed(SystemContext.empty)
      ).pipe(
        Effect.catch(() => Effect.succeed(SystemContext.empty)),
        Effect.catchDefect(() => Effect.succeed(SystemContext.empty)),
      ),
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Global.defaultLayer))
