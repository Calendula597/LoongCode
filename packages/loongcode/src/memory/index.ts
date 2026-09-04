export * as Memory from "./index"

import { Effect, Layer, Context } from "effect"
import { ConfigMemoryV1 } from "@loongcode/core/v1/config/memory"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { MemoryTable } from "@loongcode/core/memory/sql"
import { MemoryWorkspace } from "@loongcode/core/memory/workspace"
import { count, eq } from "drizzle-orm"
import { Config } from "@/config/config"
import { FSUtil } from "@loongcode/core/fs-util"
import { LayerNode } from "@loongcode/core/effect/layer-node"

export interface InspectReport {
  readonly options: MemoryOptions.MemoryOptions
  readonly raw: ConfigMemoryV1.Info | undefined
  readonly workspace: MemoryWorkspace.Info
  readonly stage1Jobs: Array<{ status: string; count: number }>
  readonly stage1Outputs: number
  readonly phase2Status: string | undefined
  readonly warnings: string[]
}

export interface Interface {
  readonly inspect: () => Effect.Effect<InspectReport>
  readonly reset: () => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/Memory") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const workspace = yield* MemoryWorkspace.Service
    const database = yield* MemoryDatabase.Service
    const jobs = yield* MemoryJobs.Service

    const inspect: Interface["inspect"] = Effect.fn("Memory.inspect")(function* () {
      const info = yield* config.get()
      const raw = info.memory
      const options = MemoryOptions.fromConfig(raw)
      const ws = yield* workspace.inspect()

      const jobRows = yield* database.db
        .select({ status: MemoryTable.Stage1JobTable.status, count: count() })
        .from(MemoryTable.Stage1JobTable)
        .groupBy(MemoryTable.Stage1JobTable.status)
        .all()
        .pipe(Effect.orDie)
      const stage1Jobs = jobRows.map((row) => ({ status: row.status, count: row.count }))

      const outputRows = yield* database.db
        .select({ count: count() })
        .from(MemoryTable.Stage1OutputTable)
        .all()
        .pipe(Effect.orDie)
      const stage1Outputs = outputRows[0]?.count ?? 0

      const phase2 = yield* database.db
        .select({ status: MemoryTable.Phase2JobTable.status, last_error: MemoryTable.Phase2JobTable.last_error })
        .from(MemoryTable.Phase2JobTable)
        .where(eq(MemoryTable.Phase2JobTable.job_key, "global"))
        .get()
        .pipe(Effect.orDie)

      return {
        options,
        raw,
        workspace: ws,
        stage1Jobs,
        stage1Outputs,
        phase2Status: phase2?.status,
        warnings: phase2?.last_error ? [`phase2 error: ${phase2.last_error}`] : [],
      }
    })

    const reset: Interface["reset"] = Effect.fn("Memory.reset")(function* () {
      const ok = yield* workspace.reset()
      if (!ok) return false
      yield* database.db.delete(MemoryTable.Stage1JobTable).run().pipe(Effect.orDie)
      yield* database.db.delete(MemoryTable.Stage1OutputTable).run().pipe(Effect.orDie)
      yield* database.db.delete(MemoryTable.CitationTable).run().pipe(Effect.orDie)
      yield* database.db.delete(MemoryTable.Phase2JobTable).run().pipe(Effect.orDie)
      return true
    })

    return Service.of({ inspect, reset })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Config.defaultLayer),
    Layer.provide(MemoryWorkspace.defaultLayer),
    Layer.provide(MemoryDatabase.defaultLayer),
    Layer.provide(MemoryJobs.defaultLayer),
    Layer.provide(FSUtil.defaultLayer),
  ),
)

export const node = LayerNode.make(layer, [
  Config.node,
  MemoryWorkspace.node,
  MemoryDatabase.node,
  MemoryJobs.node,
  FSUtil.node,
])
