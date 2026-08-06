import { expect, describe } from "bun:test"
import { Effect, Layer } from "effect"
import path from "path"
import { CrossSpawnSpawner } from "@loongcode/core/cross-spawn-spawner"
import { FSUtil } from "@loongcode/core/fs-util"
import { Global } from "@loongcode/core/global"
import { Config } from "../../src/config/config"
import { ConfigPlugin } from "../../src/config/plugin"
import { provideInstanceEffect, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { AuthTest } from "../fake/auth"
import { AccountTest } from "../fake/account"
import { NpmTest } from "../fake/npm"
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { EffectFlock } from "@loongcode/core/util/effect-flock"
import { Env } from "../../src/env"
import { HttpClient } from "effect/unstable/http"

const infra = CrossSpawnSpawner.defaultLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
)

const layer = Config.layer.pipe(
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(AuthTest.empty),
  Layer.provide(AccountTest.empty),
  Layer.provideMerge(infra),
  Layer.provide(NpmTest.noop),
  Layer.provide(Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) => Effect.die(`unexpected http request: ${request.method} ${request.url}`)))),
  Layer.provideMerge(FSUtil.defaultLayer),
)

const it = testEffect(layer)

const schemaConfig = (config: object) => ({ $schema: "https://modelhub.lgdg.cc/config.json", ...config })

const writeConfigEffect = (dir: string, config: object, name = "loongcode.json") =>
  FSUtil.use.writeWithDirs(path.join(dir, name), JSON.stringify(config))

const withGlobalConfigDir = <A, E, R>(dir: string, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Global.Path.config
      ;(Global.Path as { config: string }).config = dir
      return previous
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        ;(Global.Path as { config: string }).config = previous
      }),
  )

const withGlobalConfig = <A, E, R>(
  input: { config?: object; name?: string },
  fn: (input: { dir: string }) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const dir = yield* tmpdirScoped()
    if (input.config) yield* writeConfigEffect(dir, schemaConfig(input.config), input.name)
    return yield* withGlobalConfigDir(dir, fn({ dir }))
  })

describe("config.memory", () => {
  it.effect("appends default memory plugin when not declared", () =>
    withGlobalConfig({}, ({ dir }) =>
      Effect.gen(function* () {
        const config = yield* Config.use.get().pipe(provideInstanceEffect(dir))
        expect(config.plugin).toContain(ConfigPlugin.DEFAULT_MEMORY_PLUGIN)
      }).pipe(Effect.provide(testInstanceStoreLayer), Effect.provide(CrossSpawnSpawner.defaultLayer)),
    ),
  )

  it.effect("does not append default memory plugin when memory is false", () =>
    withGlobalConfig({ config: { memory: false } }, ({ dir }) =>
      Effect.gen(function* () {
        const config = yield* Config.use.get().pipe(provideInstanceEffect(dir))
        expect(config.plugin).not.toContain(ConfigPlugin.DEFAULT_MEMORY_PLUGIN)
      }).pipe(Effect.provide(testInstanceStoreLayer), Effect.provide(CrossSpawnSpawner.defaultLayer)),
    ),
  )

  it.effect("does not duplicate default memory plugin when already declared", () =>
    withGlobalConfig({ config: { plugin: [ConfigPlugin.DEFAULT_MEMORY_PLUGIN] } }, ({ dir }) =>
      Effect.gen(function* () {
        const config = yield* Config.use.get().pipe(provideInstanceEffect(dir))
        const matches = (config.plugin ?? []).filter((spec) => ConfigPlugin.isDefaultMemoryPlugin(spec))
        expect(matches).toHaveLength(1)
      }).pipe(Effect.provide(testInstanceStoreLayer), Effect.provide(CrossSpawnSpawner.defaultLayer)),
    ),
  )
})
