export * as MemoryDatabase from "./database"

import { EffectDrizzleSqlite } from "@loongcode/effect-drizzle-sqlite"
import { layer as sqliteLayer } from "#sqlite"
import { Context, Effect, Layer } from "effect"
import { dirname, join } from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { DatabaseMigration } from "../database/migration"
import { LayerNode } from "../effect/layer-node"
import { MemoryMigration } from "./migration"

const makeDatabase = EffectDrizzleSqlite.makeWithDefaults()
type DatabaseShape = Effect.Success<typeof makeDatabase>

export interface Interface {
  readonly db: DatabaseShape
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/v2/MemoryDatabase") {}

export function layerFromPath(filename: string) {
  const sqlite = sqliteLayer({ filename })
  const dbLayer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const db = yield* makeDatabase

      yield* db.run("PRAGMA journal_mode = WAL")
      yield* db.run("PRAGMA synchronous = NORMAL")
      yield* db.run("PRAGMA busy_timeout = 5000")
      yield* db.run("PRAGMA foreign_keys = ON")
      yield* DatabaseMigration.applyOnly(db, MemoryMigration.migrations)

      return { db }
    }).pipe(Effect.orDie),
  )
  return Layer.unwrap(
    Effect.gen(function* () {
      if (filename !== ":memory:") yield* Effect.promise(() => fs.mkdir(dirname(filename), { recursive: true }))
      return dbLayer.pipe(Layer.provide(sqlite))
    }),
  )
}

export const defaultLayer = Layer.unwrap(
  Effect.gen(function* () {
    const global = yield* Global.Service
    return layerFromPath(join(global.data, "memory", "memory.db"))
  }),
).pipe(Layer.provide(Global.defaultLayer))

export const node = LayerNode.make(layerFromPath(join(Global.Path.data, "memory", "memory.db")), [])
