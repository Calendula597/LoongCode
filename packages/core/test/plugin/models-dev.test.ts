import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Catalog } from "@loongcode/core/catalog"
import { Integration } from "@loongcode/core/integration"
import { Credential } from "@loongcode/core/credential"
import { EventV2 } from "@loongcode/core/event"
import { Flag } from "@loongcode/core/flag/flag"
import { Location } from "@loongcode/core/location"
import { ModelsDev } from "@loongcode/core/models-dev"
import { ModelsDevPlugin } from "@loongcode/core/plugin/models-dev"
import { Policy } from "@loongcode/core/policy"
import { AbsolutePath } from "@loongcode/core/schema"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"
import { catalogHost, host, integrationHost } from "./host"

const events = EventV2.defaultLayer
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make(import.meta.dir) })),
)
const policy = Policy.layer.pipe(Layer.provide(locationLayer))
const connections = Credential.defaultLayer.pipe(Layer.fresh)
const integrations = Integration.locationLayer.pipe(Layer.provide(events), Layer.provide(connections))
const catalog = Catalog.layer.pipe(
  Layer.provide(Layer.mergeAll(events, locationLayer, policy, connections, integrations)),
)
const layer = Layer.mergeAll(catalog.pipe(Layer.provide(connections)), integrations, connections, events, locationLayer)
const it = testEffect(layer)

describe("ModelsDevPlugin", () => {
  it.effect("registers key methods for providers with environment variables", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const previous = {
          path: Flag.LOONGCODE_MODELS_PATH,
          disabled: Flag.LOONGCODE_DISABLE_MODELS_FETCH,
        }
        Flag.LOONGCODE_MODELS_PATH = path.join(import.meta.dir, "fixtures", "models-dev.json")
        Flag.LOONGCODE_DISABLE_MODELS_FETCH = true
        return previous
      }),
      () =>
        Effect.gen(function* () {
          const integrations = yield* Integration.Service
          const catalog = yield* Catalog.Service
          yield* ModelsDevPlugin.effect(
            host({
              catalog: catalogHost(catalog),
              integration: integrationHost(integrations),
            }),
          )
          expect(yield* integrations.list()).toEqual([
            new Integration.Info({
              id: Integration.ID.make("acme"),
              name: "Acme",
              methods: [
                { type: "key" },
                {
                  type: "env",
                  names: ["ACME_API_KEY"],
                },
              ],
              connections: [],
            }),
          ])
        }).pipe(Effect.provide(ModelsDev.defaultLayer)),
      (previous) =>
        Effect.sync(() => {
          Flag.LOONGCODE_MODELS_PATH = previous.path
          Flag.LOONGCODE_DISABLE_MODELS_FETCH = previous.disabled
        }),
    ),
  )
})
