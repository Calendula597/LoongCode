import { describe, expect, test } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { FSUtil } from "@loongcode/core/fs-util"
import { Global } from "@loongcode/core/global"
import { SystemContext } from "@loongcode/core/system-context"
import { SystemContextRegistry } from "@loongcode/core/system-context/registry"
import { MemoryContext } from "@loongcode/core/memory/context"
import { testEffect } from "./lib/effect"

const layer = MemoryContext.layer.pipe(
  Layer.provideMerge(SystemContextRegistry.layer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Global.layerWith({ data: "memory-context-test" })),
)

const it = testEffect(layer)

describe("MemoryContext", () => {
  it.effect("registers a memory/summary source", () =>
    Effect.gen(function* () {
      const registry = yield* SystemContextRegistry.Service
      const context = yield* registry.load()
      const initialized = yield* SystemContext.initialize(context)
      // No Config service present → memory disabled → empty baseline
      expect(initialized.baseline).toBe("")
      expect(Object.keys(initialized.snapshot)).toEqual([])
    }),
  )

  test("renders summary text when enabled", () => {
    const context = SystemContext.combine([
      SystemContext.make({
        key: SystemContext.Key.make("memory/summary"),
        codec: Schema.toCodecJson(Schema.String),
        load: Effect.succeed("User prefers bun over npm."),
        baseline: (summary) => `## Memory\n${summary}`,
        update: (_p, summary) => `Memory updated: ${summary}`,
      }),
    ])
    const initialized = Effect.runSync(SystemContext.initialize(context))
    expect(initialized.baseline).toBe("## Memory\nUser prefers bun over npm.")
  })
})
