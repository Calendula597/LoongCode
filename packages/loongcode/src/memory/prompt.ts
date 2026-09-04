export * as MemoryPrompt from "./prompt"

import { Effect, Layer, Context } from "effect"
import { join } from "path"
import { Config } from "@/config/config"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { FSUtil } from "@loongcode/core/fs-util"
import { Global } from "@loongcode/core/global"
import { LayerNode } from "@loongcode/core/effect/layer-node"
import { MemoryPaths } from "@loongcode/core/memory/paths"

/** Token estimate: ~4 chars per token (matches the plugin port). */
const SUMMARY_TOKEN_BUDGET = 2500
const CHARS_PER_TOKEN = 4

const CITATION_GUIDANCE =
  "When your answer uses a memory, cite it at the very end of your reply with " +
  '<memory-citation session_ids=["ses_..."]></memory-citation> so the system can track which memories are useful.'

export interface Interface {
  /**
   * The memory summary block for the V1 system prompt, or `undefined` when
   * memory is disabled (`memory` section absent or `use_memories: false`).
   * Reads the same app config source the memory tools are gated on.
   */
  readonly summary: () => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/MemoryPrompt") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service

    const summary: Interface["summary"] = Effect.fn("MemoryPrompt.summary")(function* () {
      const memory = (yield* config.get()).memory
      if (memory === undefined) return undefined
      const opts = MemoryOptions.fromConfig(memory)
      if (!opts.useMemories) return undefined

      const file = MemoryPaths.fromRoot(join(global.data, "memory")).workspace.summary()
      const content = yield* fs.readFileStringSafe(file).pipe(Effect.orDie)
      if (content === undefined || content.trim().length === 0) return undefined
      const trimmed = content.slice(0, SUMMARY_TOKEN_BUDGET * CHARS_PER_TOKEN)
      return ["## Memory", trimmed, "", CITATION_GUIDANCE].join("\n")
    })

    return Service.of({ summary })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Config.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.defaultLayer),
)

export const node = LayerNode.make(layer, [Config.node, FSUtil.node, Global.node])
