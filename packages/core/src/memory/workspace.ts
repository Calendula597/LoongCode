export * as MemoryWorkspace from "./workspace"

import { Effect, Layer, Context } from "effect"
import { join } from "path"
import { FSUtil } from "../fs-util"
import { Global } from "../global"
import { LayerNode } from "../effect/layer-node"
import { MemoryPaths } from "./paths"

export interface Info {
  readonly root: string
  readonly workspaceDir: string
  readonly memoryFile: string
  readonly summaryFile: string
  readonly files: string[]
}

export interface Interface {
  readonly ensure: () => Effect.Effect<void>
  readonly inspect: () => Effect.Effect<Info>
  readonly reset: () => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/v2/MemoryWorkspace") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service
    const paths = MemoryPaths.fromRoot(join(global.data, "memory"))

    const ensure: Interface["ensure"] = Effect.fn("MemoryWorkspace.ensure")(function* () {
      for (const dir of [
        paths.workspace.dir(),
        paths.workspace.rolloutSummaries(),
        paths.workspace.skills(),
        paths.workspace.extensions(),
        paths.workspace.adHocNotes(),
      ]) {
        yield* fs.ensureDir(dir).pipe(Effect.orDie)
      }
      for (const file of [paths.workspace.summary(), paths.workspace.memory()]) {
        const exists = yield* fs.existsSafe(file).pipe(Effect.orDie)
        if (!exists) yield* fs.writeFileString(file, "").pipe(Effect.orDie)
      }
    })

    const inspect: Interface["inspect"] = Effect.fn("MemoryWorkspace.inspect")(function* () {
      yield* ensure()
      const entries = yield* fs.readDirectoryEntries(paths.workspace.dir()).pipe(Effect.orDie)
      return {
        root: paths.root(),
        workspaceDir: paths.workspace.dir(),
        memoryFile: paths.workspace.memory(),
        summaryFile: paths.workspace.summary(),
        files: entries.map((entry) => `${entry.type}:${entry.name}`),
      }
    })

    const reset: Interface["reset"] = Effect.fn("MemoryWorkspace.reset")(function* () {
      // Refuse to run through a symlinked root: it cannot be tricked into
      // deleting something else (mirrors the upstream memory_reset guard).
      const rootInfo = yield* fs.stat(paths.root()).pipe(Effect.orElseSucceed(() => undefined))
      if (rootInfo?.type === "SymbolicLink") return false
      yield* fs.remove(paths.root(), { recursive: true, force: true }).pipe(Effect.orDie)
      yield* ensure()
      return true
    })

    return Service.of({ ensure, inspect, reset })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(Global.defaultLayer), Layer.provide(FSUtil.defaultLayer))

export const node = LayerNode.make(layer, [FSUtil.node, Global.node])
