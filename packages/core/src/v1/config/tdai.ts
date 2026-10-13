export * as ConfigTDAIV1 from "./tdai"

import { Schema } from "effect"

// Synthetic TDAI providers are exposed under this namespace so core session
// logic can recognize identity switches without inferring the prefix from the
// provider id string in multiple places.
export const PROVIDER_PREFIX = "tdai/"

// TDAI Identity: a header-overlay identity routed through the shared TDAI
// MemoryProxy connection. UI copy says "agents"; code and docs say TDAI
// Identity (see CONTEXT.md § TDAI Integration (experimental)).
export const Agent = Schema.Struct({
  name: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Display name shown in model pickers (defaults to the agent key)" }),
  ),
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)).pipe(
    Schema.annotate({
      description:
        "Identity headers injected verbatim into every request (x-team-id / x-agent-id / x-task-id / x-conversation-id)",
    }),
  ),
})
export type Agent = Schema.Schema.Type<typeof Agent>

export const Info = Schema.Struct({
  url: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "TDAI MemoryProxy base URL shared by every identity" }),
  ),
  apiKey: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "TDAI MemoryProxy API key shared by every identity" }),
  ),
  models: Schema.optional(Schema.mutable(Schema.Array(Schema.String))).pipe(
    Schema.annotate({ description: "Hand-configured model list served through the proxy" }),
  ),
  agents: Schema.optional(Schema.Record(Schema.String, Agent)).pipe(
    Schema.annotate({ description: "Named TDAI identities; each becomes its own selectable provider" }),
  ),
})
export type Info = Schema.Schema.Type<typeof Info>
