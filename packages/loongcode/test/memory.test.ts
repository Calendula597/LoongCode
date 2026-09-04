import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Memory } from "../src/memory"
import { Config } from "../src/config/config"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryWorkspace } from "@loongcode/core/memory/workspace"
import { Global } from "@loongcode/core/global"
import { FSUtil } from "@loongcode/core/fs-util"
import { testEffect } from "./lib/effect"

const configMock = Layer.mock(Config.Service, {
  get: () => Effect.succeed({ memory: undefined }),
})

const layer = Memory.layer.pipe(
  Layer.provide(configMock),
  Layer.provide(MemoryWorkspace.layer),
  Layer.provide(MemoryJobs.layer),
  Layer.provide(MemoryDatabase.layerFromPath(":memory:")),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.layerWith({ data: "memory-test" })),
)

const it = testEffect(layer)

describe("Memory inspect", () => {
  it.live("reports effective options and workspace", () =>
    Effect.gen(function* () {
      const memory = yield* Memory.Service
      const report = yield* memory.inspect()
      expect(report.options.generateMemories).toBe(false)
      expect(report.options.minRolloutIdleHours).toBe(6)
      expect(report.stage1Jobs).toEqual([])
      expect(report.stage1Outputs).toBe(0)
      expect(report.phase2Status).toBeUndefined()
    }),
  )
})
