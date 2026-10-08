import { OpenCode } from "@loongcode/client"

type Client = ReturnType<typeof OpenCode.make>

export type OpenCodeClient = Client
export type SessionApi = Client["sessions"]
export type AgentApi = Client["agents"]
export type CommandApi = Client["commands"]
export type ReferenceApi = Client["references"]

// v2 split the v1 `catalog` group into separate `model` and `provider` groups, so the
// app-facing catalog shape is the combination of both accessors.
export type CatalogApi = {
  readonly model: Client["models"]
  readonly provider: Client["providers"]
}
