import { afterEach, describe, expect, test } from "bun:test"
import { writeFile } from "fs/promises"
import path from "path"
import { Effect, Layer } from "effect"
import { ProviderV2 } from "@loongcode/core/provider"
import { ModelV2 } from "@loongcode/core/model"
import { Provider } from "@/provider/provider"
import { TDAI } from "@/provider/tdai"
import { LLMRequestPrep } from "@/session/llm/request"
import { Env } from "../../src/env"
import { Plugin } from "../../src/plugin/index"
import { Agent } from "../../src/agent/agent"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { SessionV1 } from "@loongcode/core/v1/session"
import { disposeAllInstances, reloadInstance, TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(Layer.mergeAll(Provider.defaultLayer, Env.defaultLayer, Plugin.defaultLayer))

afterEach(async () => {
  await disposeAllInstances()
})

const identityHeaders = {
  "x-team-id": "team-1",
  "x-agent-id": "agt-1",
  "x-task-id": "task-1",
  "x-conversation-id": "loongcode-main",
}

const tdaiConnection = {
  url: "http://tdai.example.com/codebuddy/default/v1",
  apiKey: "sk-mem-secret",
  models: ["deepseek-v4-flash", "glm-5.3", "kimi-k3"],
}

const tdaiConfig = {
  experimental: {
    tdai: {
      ...tdaiConnection,
      agents: {
        main: { name: "TDAI main", headers: identityHeaders },
        second: { headers: { "x-conversation-id": "loongcode-second" } },
        bare: { name: "no headers" },
      },
    },
  },
}

it.instance(
  "registers one synthetic provider per identity with shared connection",
  () =>
    Effect.gen(function* () {
      const main = yield* Provider.use.getProvider(ProviderV2.ID.make("tdai/main"))
      expect(main.name).toBe("TDAI main")
      expect(main.source).toBe("config")
      expect(main.options.baseURL).toBe("http://tdai.example.com/codebuddy/default/v1")
      expect(main.options.apiKey).toBe("sk-mem-secret")

      const second = yield* Provider.use.getProvider(ProviderV2.ID.make("tdai/second"))
      expect(second.name).toBe("TDAI second")
    }),
  { config: tdaiConfig },
)

it.instance(
  "synthetic providers expose the configured model list with verbatim headers on every model",
  () =>
    Effect.gen(function* () {
      const model = yield* Provider.use.getModel(ProviderV2.ID.make("tdai/main"), ModelV2.ID.make("glm-5.3"))
      expect(model.api.npm).toBe("@ai-sdk/openai-compatible")
      expect(model.providerID).toBe(ProviderV2.ID.make("tdai/main"))
      expect(model.headers).toEqual(identityHeaders)
    }),
  { config: tdaiConfig },
)

it.instance(
  "never registers a header-less bare TDAI entry",
  () =>
    Effect.gen(function* () {
      const providers = yield* Provider.use.list()
      const tdaiProviders = Object.entries(providers).filter(([id]) => id.startsWith("tdai/"))
      expect(tdaiProviders.map(([id]) => id)).toEqual(["tdai/main", "tdai/second"])
      for (const [, provider] of tdaiProviders) {
        const [firstModel] = Object.values(provider.models)
        expect(Object.keys(firstModel?.headers ?? {}).length).toBeGreaterThan(0)
        expect(typeof firstModel?.headers?.["x-conversation-id"]).toBe("string")
      }
    }),
  { config: tdaiConfig },
)

it.instance(
  "incomplete connection disables every identity with fail-soft behavior",
  () =>
    Effect.gen(function* () {
      const providers = yield* Provider.use.list()
      expect(Object.keys(providers).filter((id) => id.startsWith("tdai/"))).toEqual([])
    }),
  {
    config: {
      experimental: {
        tdai: {
          ...tdaiConnection,
          url: "http://tdai.example.com",
          apiKey: undefined,
          models: ["glm-5.3"],
          agents: { main: { headers: identityHeaders } },
        },
      },
    },
  },
)

it.instance(
  "no tdai config means no synthetic providers",
  () =>
    Effect.gen(function* () {
      const providers = yield* Provider.use.list()
      expect(Object.keys(providers).filter((id) => id.startsWith("tdai/"))).toEqual([])
    }),
  { config: { provider: { "plain-provider": { models: { m: {} } } } } },
)

it.instance(
  "reloads synthetic providers and drops deleted agents when config changes",
  () =>
    Effect.gen(function* () {
      const test = yield* TestInstance
      const providersBefore = yield* Provider.use.list()
      expect(Object.keys(providersBefore).filter((id) => id.startsWith("tdai/"))).toEqual(["tdai/main", "tdai/extra"])

      yield* Effect.promise(() =>
        writeFile(
          path.join(test.directory, "loongcode.json"),
          JSON.stringify({
            $schema: "https://modelhub.lgdg.cc/config.json",
            experimental: {
              tdai: {
                ...tdaiConnection,
                models: ["glm-5.3"],
                agents: {
                  renamed: { name: "Renamed", headers: identityHeaders },
                },
              },
            },
          }),
        ),
      )
      yield* reloadInstance({ directory: test.directory })

      const providersAfter = yield* Provider.use.list()
      expect(Object.keys(providersAfter).filter((id) => id.startsWith("tdai/"))).toEqual(["tdai/renamed"])
    }),
  {
    config: {
      experimental: {
        tdai: {
          ...tdaiConnection,
          models: ["glm-5.3"],
          agents: {
            main: { name: "TDAI main", headers: identityHeaders },
            extra: { name: "TDAI extra", headers: identityHeaders },
          },
        },
      },
    },
  },
)

it.instance(
  "identity headers reach LLMRequestPrep output verbatim",
  () =>
    Effect.gen(function* () {
      const model = yield* Provider.use.getModel(ProviderV2.ID.make("tdai/main"), ModelV2.ID.make("glm-5.3"))
      const provider = yield* Provider.use.getProvider(ProviderV2.ID.make("tdai/main"))
      const prepared = yield* LLMRequestPrep.prepare({
        user: {
          id: "msg_user-test",
          sessionID: "session-test",
          role: "user",
          time: { created: Date.now() },
          agent: "test",
          model: { providerID: model.providerID, modelID: model.id },
        } as SessionV1.User,
        sessionID: "session-test",
        model,
        agent: { name: "test", mode: "primary", options: {}, permission: [] } as Agent.Info,
        system: [],
        messages: [{ role: "user", content: "Hello" }],
        tools: {},
        provider,
        auth: undefined,
        plugin: {
          trigger: (_name: string, _input: unknown, output: unknown) => Effect.succeed(output),
          list: () => Effect.succeed([]),
          init: () => Effect.void,
        } as Plugin.Interface,
        flags: { outputTokenMax: 32_000, client: "test" } as RuntimeFlags.Info,
        isWorkflow: false,
      })
      expect(prepared.headers).toMatchObject(identityHeaders)
    }),
  { config: tdaiConfig },
)

describe("TDAI.expand", () => {
  test("skips agents without identity headers without dropping the rest", () => {
    const result = TDAI.expand({
      url: "http://tdai.example.com",
      apiKey: "sk-mem-secret",
      models: ["glm-5.3"],
      agents: {
        main: { headers: identityHeaders },
        bare: { name: "no headers" },
      },
    })
    expect(Object.keys(result.providers)).toEqual(["tdai/main"])
    expect(result.warnings).toEqual(['TDAI agent "bare" has no identity headers and was skipped'])
  })

  test("skips agent keys containing a slash so model strings stay unambiguous", () => {
    const result = TDAI.expand({
      url: "http://tdai.example.com",
      apiKey: "sk-mem-secret",
      models: ["glm-5.3"],
      agents: {
        main: { headers: identityHeaders },
        "bad/key": { headers: identityHeaders },
      },
    })
    expect(Object.keys(result.providers)).toEqual(["tdai/main"])
    expect(result.warnings).toEqual(['TDAI agent "bad/key" has a "/" in its key and was skipped'])
  })

  test("warns about an incomplete connection", () => {
    const result = TDAI.expand({
      url: "http://tdai.example.com",
      agents: { main: { headers: identityHeaders } },
    })
    expect(result.providers).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain("apiKey")
    expect(result.warnings[0]).toContain("models")
  })

  test("returns nothing when the section is absent", () => {
    expect(TDAI.expand(undefined)).toEqual({ providers: {}, warnings: [] })
  })
})
