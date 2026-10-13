import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { Config } from "@loongcode/core/config"
import { ConfigMigrateV1 } from "@loongcode/core/v1/config/migrate"
import { ConfigV1 } from "@loongcode/core/v1/config/config"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.empty)

const decodeV1 = Schema.decodeUnknownSync(ConfigV1.Info)
const decodeV2 = Schema.decodeUnknownSync(Config.Info)

const tdai = {
  url: "http://tdai.example.com/codebuddy/default/v1",
  apiKey: "sk-mem-secret",
  models: ["deepseek-v4-flash", "glm-5.3-flash", "glm-5.3", "kimi-k3"],
  agents: {
    main: {
      name: "TDAI main",
      headers: {
        "x-team-id": "team-1",
        "x-agent-id": "agt-1",
        "x-task-id": "task-1",
        "x-conversation-id": "loongcode-main",
      },
    },
    support: { headers: { "x-team-id": "team-1", "x-conversation-id": "loongcode-support" } },
  },
}

describe("ConfigTDAIV1", () => {
  it.effect("decodes experimental.tdai on v1 config and keeps arbitrary header keys", () =>
    Effect.sync(() => {
      const info = decodeV1({ experimental: { tdai } })
      expect(info.experimental?.tdai?.url).toBe(tdai.url)
      expect(info.experimental?.tdai?.apiKey).toBe(tdai.apiKey)
      expect(info.experimental?.tdai?.models).toEqual(tdai.models)
      expect(info.experimental?.tdai?.agents?.main).toEqual(tdai.agents.main)
      expect(info.experimental?.tdai?.agents?.support).toEqual(tdai.agents.support)
    }),
  )

  it.effect("decodes into the v2 experimental section unchanged", () =>
    Effect.sync(() => {
      const info = decodeV2({ experimental: { tdai } })
      expect(info.experimental?.tdai?.agents?.main?.headers).toEqual(tdai.agents.main.headers)
    }),
  )

  it.effect("round-trips tdai through v1 to v2 migration", () =>
    Effect.sync(() => {
      const migrated = ConfigMigrateV1.migrate(decodeV1({ experimental: { tdai } }))
      expect(migrated.experimental?.tdai).toEqual(tdai)
      const decoded = decodeV2(migrated)
      expect(decoded.experimental?.tdai?.models).toEqual(tdai.models)
    }),
  )

  it.effect("migrate keeps tdai when policies are absent and vice versa", () =>
    Effect.sync(() => {
      const onlyTdai = ConfigMigrateV1.migrate(decodeV1({ experimental: { tdai } }))
      expect(onlyTdai.experimental).toEqual({ policies: undefined, tdai })
      const onlyPolicies = ConfigMigrateV1.migrate(
        decodeV1({ experimental: { policies: [{ effect: "deny", action: "provider.use", resource: "openai" }] } }),
      )
      expect(onlyPolicies.experimental?.policies).toHaveLength(1)
      expect(onlyPolicies.experimental?.tdai).toBeUndefined()
    }),
  )

  it.effect("absence of the section leaves config untouched", () =>
    Effect.sync(() => {
      const info = decodeV1({ shell: "/bin/zsh" })
      expect(info.experimental).toBeUndefined()
      expect(decodeV2(ConfigMigrateV1.migrate(info)).experimental).toBeUndefined()
    }),
  )
})
