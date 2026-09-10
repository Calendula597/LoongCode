import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { MemoryInspectTool } from "@/tool/memory-inspect"
import { Memory } from "@/memory"
import { Config } from "@/config/config"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryWorkspace } from "@loongcode/core/memory/workspace"
import { Global } from "@loongcode/core/global"
import { FSUtil } from "@loongcode/core/fs-util"
import { Truncate } from "@/tool/truncate"
import { Agent } from "@/agent/agent"
import { SessionID, MessageID } from "@/session/schema"
import { testEffect } from "../lib/effect"
import type { ConfigMemoryV1 } from "@loongcode/core/v1/config/memory"

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const memoryLayer = (memory: ConfigMemoryV1.Info | undefined) =>
  Memory.layer.pipe(
    Layer.provide(Layer.mock(Config.Service, { get: () => Effect.succeed({ memory }) })),
    Layer.provide(MemoryWorkspace.layer),
    Layer.provide(MemoryJobs.layer),
    Layer.provide(MemoryDatabase.layerFromPath(":memory:")),
    Layer.provide(FSUtil.defaultLayer),
    Layer.provide(Global.layerWith({ data: "memory-test" })),
  )

const run = Effect.gen(function* () {
  const info = yield* MemoryInspectTool
  const tool = yield* info.init()
  return yield* tool.execute({}, ctx)
})

const itDisabled = testEffect(
  Layer.mergeAll(memoryLayer({ generate_memories: false, use_memories: false }), Truncate.defaultLayer, Agent.defaultLayer),
)
const itUseOnly = testEffect(
  Layer.mergeAll(memoryLayer({ generate_memories: false, use_memories: true }), Truncate.defaultLayer, Agent.defaultLayer),
)

describe("tool.memory-inspect", () => {
  itDisabled.instance("reports disabled when both memory switches are off", () =>
    Effect.gen(function* () {
      const result = yield* run
      expect(result.output).toContain("memory: disabled")
    }),
  )

  itUseOnly.instance("reports enabled with the active switches as suffixes", () =>
    Effect.gen(function* () {
      const result = yield* run
      expect(result.output).toContain("memory: enabled (use)")
      expect(result.output).not.toContain("(generate)")
    }),
  )
})
