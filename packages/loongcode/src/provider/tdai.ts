import { ConfigProviderV1 } from "@loongcode/core/v1/config/provider"
import { ConfigTDAIV1 } from "@loongcode/core/v1/config/tdai"

// TDAI Identity synthesis: expands the experimental.tdai config section into
// ordinary openai-compatible provider entries, one per identity, so the model
// pickers and request path treat them exactly like hand-rolled provider
// entries. There is deliberately no header-less "bare" entry: every synthetic
// provider carries its identity headers verbatim on every model (see
// CONTEXT.md § TDAI Integration (experimental)).
const PREFIX = ConfigTDAIV1.PROVIDER_PREFIX
const SDK = "@ai-sdk/openai-compatible"

export type Expanded = {
  /** Synthetic provider entries keyed by `tdai/<agentKey>`. */
  providers: Record<string, ConfigProviderV1.Info>
  /** Fail-soft diagnostics for skipped agents or an incomplete connection. */
  warnings: string[]
}

export function expand(info: ConfigTDAIV1.Info | undefined): Expanded {
  if (!info) return { providers: {}, warnings: [] }
  const agents = Object.entries(info.agents ?? {})
  if (agents.length === 0) return { providers: {}, warnings: [] }

  const url = info.url
  const apiKey = info.apiKey
  const models = info.models
  if (!url || !apiKey || !models?.length) {
    const missing = [
      ...(!url ? ["url"] : []),
      ...(!apiKey ? ["apiKey"] : []),
      ...(!models?.length ? ["models"] : []),
    ].join(", ")
    return {
      providers: {},
      warnings: [`experimental.tdai is missing ${missing}; TDAI identities are disabled`],
    }
  }

  const warnings: string[] = []
  const providers = Object.fromEntries(
    agents.flatMap(([key, agent]) => {
      if (key.includes("/")) {
        warnings.push(`TDAI agent "${key}" has a "/" in its key and was skipped`)
        return []
      }
      const headers = agent.headers ?? {}
      if (Object.keys(headers).length === 0) {
        warnings.push(`TDAI agent "${key}" has no identity headers and was skipped`)
        return []
      }
      return [
        [
          `${PREFIX}${key}`,
          {
            name: agent.name ?? `TDAI ${key}`,
            npm: SDK,
            options: { baseURL: url, apiKey },
            models: Object.fromEntries(models.map((model) => [model, { headers: { ...headers } }])),
          },
        ] as const,
      ]
    }),
  )
  return { providers, warnings }
}

export * as TDAI from "./tdai"
