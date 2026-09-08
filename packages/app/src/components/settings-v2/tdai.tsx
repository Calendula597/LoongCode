import { ButtonV2 } from "@loongcode/ui/v2/button-v2"
import { IconButtonV2 } from "@loongcode/ui/v2/icon-button-v2"
import { TextInputV2 } from "@loongcode/ui/v2/text-input-v2"
import { Icon } from "@loongcode/ui/v2/icon"
import { createEffect, createMemo, on, type Component, Index, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { useServerSync } from "@/context/server-sync"
import { SettingsListV2 } from "./parts/list"
import { SettingsRowV2 } from "./parts/row"
import "./settings-v2.css"

const DEFAULT_HEADER_KEYS = [
  "x-team-id",
  "x-agent-id",
  "x-task-id",
  "x-conversation-id",
]

const DEFAULT_HEADER_KEY_SET = new Set(DEFAULT_HEADER_KEYS.map((key) => key.toLowerCase()))
const isDefaultHeaderKey = (key: string) => DEFAULT_HEADER_KEY_SET.has(key.trim().toLowerCase())

let rowID = 0
const nextRowID = () => `row-${rowID++}`

type HeaderRow = {
  id: string
  key: string
  value: string
}

type ModelRow = {
  id: string
  value: string
}

type AgentDraft = {
  id: string
  key: string
  name: string
  headers: HeaderRow[]
}

type FormState = {
  url: string
  apiKey: string
  models: ModelRow[]
  agents: AgentDraft[]
  saving: boolean
  loaded: boolean
}

const emptyHeaderRows = (): HeaderRow[] =>
  DEFAULT_HEADER_KEYS.map((key) => ({ id: nextRowID(), key, value: "" }))

const emptyAgent = (): AgentDraft => ({
  id: nextRowID(),
  key: "",
  name: "",
  headers: emptyHeaderRows(),
})

const agentHeadersToRows = (headers: Record<string, string> | undefined): HeaderRow[] => {
  const entries = Object.entries(headers ?? {})
  const existingKeys = new Set(entries.map(([key]) => key))
  return [
    ...entries.map(([key, value]) => ({ id: nextRowID(), key, value })),
    ...DEFAULT_HEADER_KEYS.filter((key) => !existingKeys.has(key)).map((key) => ({
      id: nextRowID(),
      key,
      value: "",
    })),
  ]
}

const rowsToHeaders = (rows: HeaderRow[]): Record<string, string> =>
  Object.fromEntries(
    rows
      .map((row) => [row.key.trim(), row.value.trim()] as const)
      .filter(([key, value]) => key && value),
  )

const rowsToModels = (rows: ModelRow[]): string[] =>
  rows.map((row) => row.value.trim()).filter(Boolean)

const buildAgentConfig = (agent: AgentDraft) => {
  const name = agent.name.trim() || undefined
  const headers = rowsToHeaders(agent.headers)
  return {
    ...(name ? { name } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
  }
}

const buildAgentsRecord = (agents: AgentDraft[]): Record<string, ReturnType<typeof buildAgentConfig>> =>
  Object.fromEntries(
    agents
      .filter((agent) => agent.key.trim())
      .map((agent) => [agent.key.trim(), buildAgentConfig(agent)]),
  )

export const SettingsTDAIV2: Component = () => {
  const language = useLanguage()
  const serverSync = useServerSync()

  const tdai = createMemo(() => serverSync().data.config.experimental?.tdai)

  const [store, setStore] = createStore<FormState>({
    url: "",
    apiKey: "",
    models: [],
    agents: [],
    saving: false,
    loaded: false,
  })

  const isPristine = () =>
    store.url === "" && store.apiKey === "" && store.models.length === 0 && store.agents.length === 0

  createEffect(
    on(
      () => tdai(),
      (config) => {
        if (config === undefined) return
        if (store.loaded) return
        if (!isPristine()) return
        setStore({
          url: config.url ?? "",
          apiKey: config.apiKey ?? "",
          models: (config.models ?? []).map((value) => ({ id: nextRowID(), value })),
          agents: Object.entries(config.agents ?? {}).map(([key, agent]) => ({
            id: nextRowID(),
            key,
            name: agent?.name ?? "",
            headers: agentHeadersToRows(agent?.headers),
          })),
          loaded: true,
        })
      },
    ),
  )

  const addModel = () => setStore("models", (models) => [...models, { id: nextRowID(), value: "" }])
  const updateModel = (id: string, value: string) =>
    setStore("models", (models) => models.map((row) => (row.id === id ? { ...row, value } : row)))
  const removeModel = (id: string) =>
    setStore("models", (models) => models.filter((row) => row.id !== id))

  const addAgent = () => setStore("agents", (agents) => [...agents, emptyAgent()])
  const updateAgent = (id: string, patch: Partial<AgentDraft>) =>
    setStore("agents", (agents) => agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)))
  const removeAgent = (id: string) => setStore("agents", (agents) => agents.filter((agent) => agent.id !== id))

  const addAgentHeader = (agentID: string) =>
    setStore("agents", (agents) =>
      agents.map((agent) =>
        agent.id === agentID
          ? { ...agent, headers: [...agent.headers, { id: nextRowID(), key: "", value: "" }] }
          : agent,
      ),
    )
  const updateAgentHeader = (agentID: string, id: string, patch: Partial<HeaderRow>) =>
    setStore("agents", (agents) =>
      agents.map((agent) =>
        agent.id === agentID
          ? { ...agent, headers: agent.headers.map((row) => (row.id === id ? { ...row, ...patch } : row)) }
          : agent,
      ),
    )
  const removeAgentHeader = (agentID: string, id: string) =>
    setStore("agents", (agents) =>
      agents.map((agent) =>
        agent.id === agentID
          ? { ...agent, headers: agent.headers.filter((row) => row.id !== id) }
          : agent,
      ),
    )

  const buildTDAIConfig = () => ({
    url: store.url.trim(),
    apiKey: store.apiKey.trim(),
    models: rowsToModels(store.models),
    agents: buildAgentsRecord(store.agents),
  })

  const save = () => {
    setStore("saving", true)
    return serverSync()
      .updateConfig({ experimental: { tdai: buildTDAIConfig() } })
      .finally(() => setStore("saving", false))
  }

  const canSave = createMemo(() => {
    const config = tdai()
    const current = buildTDAIConfig()
    return (
      (current.url || undefined) !== (config?.url ?? undefined) ||
      (current.apiKey || undefined) !== (config?.apiKey ?? undefined) ||
      JSON.stringify(current.models) !== JSON.stringify(config?.models ?? []) ||
      JSON.stringify(current.agents) !== JSON.stringify(config?.agents ?? {})
    )
  })

  return (
    <>
      <div class="settings-v2-tab-header settings-v2-tab-header--stacked">
        <div>
          <h2 class="settings-v2-tab-title">{language.t("settings.tdai.title")}</h2>
          <p class="settings-v2-tab-description">{language.t("settings.tdai.description")}</p>
        </div>
        <ButtonV2 size="normal" variant="contrast" disabled={store.saving || !canSave()} onClick={save}>
          {store.saving ? language.t("common.saving") : language.t("common.save")}
        </ButtonV2>
      </div>

      <div class="settings-v2-tab-body settings-v2-tdai">
        <div class="settings-v2-section">
          <h3 class="settings-v2-section-title">{language.t("settings.tdai.section.connection")}</h3>
          <SettingsListV2>
            <SettingsRowV2
              title={language.t("settings.tdai.url.title")}
              description={language.t("settings.tdai.url.description")}
            >
              <TextInputV2
                type="text"
                class="settings-v2-tdai-input"
                value={store.url}
                placeholder={language.t("settings.tdai.url.placeholder")}
                onInput={(event) => setStore("url", event.currentTarget.value)}
              />
            </SettingsRowV2>

            <SettingsRowV2
              title={language.t("settings.tdai.apiKey.title")}
              description={language.t("settings.tdai.apiKey.description")}
            >
              <TextInputV2
                type="password"
                class="settings-v2-tdai-input"
                value={store.apiKey}
                placeholder={language.t("settings.tdai.apiKey.placeholder")}
                onInput={(event) => setStore("apiKey", event.currentTarget.value)}
              />
            </SettingsRowV2>

            <SettingsRowV2
              title={language.t("settings.tdai.models.title")}
              description={language.t("settings.tdai.models.description")}
            >
              <div class="settings-v2-tdai-models">
                <Index each={store.models}>
                  {(row) => (
                    <div class="settings-v2-tdai-model-row">
                      <TextInputV2
                        type="text"
                        class="settings-v2-tdai-model-input"
                        value={row().value}
                        placeholder={language.t("settings.tdai.model.placeholder")}
                        onInput={(event) => updateModel(row().id, event.currentTarget.value)}
                      />
                      <IconButtonV2
                        type="button"
                        variant="ghost-muted"
                        size="small"
                        icon={<Icon name="minus" size="large" class="text-v2-icon-icon-muted" />}
                        onClick={() => removeModel(row().id)}
                      />
                    </div>
                  )}
                </Index>
                <ButtonV2 size="small" variant="neutral" icon="plus" onClick={addModel}>
                  {language.t("settings.tdai.model.add")}
                </ButtonV2>
              </div>
            </SettingsRowV2>
          </SettingsListV2>
        </div>

        <div class="settings-v2-section">
          <div class="settings-v2-section-header">
            <h3 class="settings-v2-section-title">{language.t("settings.tdai.section.identities")}</h3>
            <ButtonV2 size="small" variant="neutral" onClick={addAgent}>
              {language.t("settings.tdai.identity.add")}
            </ButtonV2>
          </div>
          <Show
            when={store.agents.length > 0}
            fallback={
              <div class="settings-v2-tdai-empty">{language.t("settings.tdai.identities.empty")}</div>
            }
          >
            <SettingsListV2>
              <Index each={store.agents}>
                {(agent) => (
                  <div data-component="settings-v2-tdai-identity">
                    <div data-slot="settings-v2-tdai-identity-header">
                      <TextInputV2
                        type="text"
                        class="settings-v2-tdai-identity-key"
                        value={agent().key}
                        placeholder={language.t("settings.tdai.identity.keyPlaceholder")}
                        onInput={(event) => updateAgent(agent().id, { key: event.currentTarget.value })}
                      />
                      <TextInputV2
                        type="text"
                        class="settings-v2-tdai-identity-name"
                        value={agent().name}
                        placeholder={language.t("settings.tdai.identity.namePlaceholder")}
                        onInput={(event) => updateAgent(agent().id, { name: event.currentTarget.value })}
                      />
                      <IconButtonV2
                        type="button"
                        variant="ghost-muted"
                        size="small"
                        icon={<Icon name="trash" size="large" class="text-v2-icon-icon-muted" />}
                        onClick={() => removeAgent(agent().id)}
                      />
                    </div>
                    <SettingsRowV2
                      title={language.t("settings.tdai.identity.headers")}
                      description={language.t("settings.tdai.identity.headersDescription")}
                    >
                      <div class="settings-v2-tdai-headers">
                        <Index each={agent().headers}>
                          {(row) => (
                            <div class="settings-v2-tdai-header-row">
                              <TextInputV2
                                type="text"
                                class="settings-v2-tdai-header-key"
                                value={row().key}
                                disabled={isDefaultHeaderKey(row().key)}
                                placeholder={language.t("settings.tdai.header.keyPlaceholder")}
                                onInput={(event) =>
                                  updateAgentHeader(agent().id, row().id, { key: event.currentTarget.value })
                                }
                              />
                              <TextInputV2
                                type="text"
                                class="settings-v2-tdai-header-value"
                                value={row().value}
                                placeholder={language.t("settings.tdai.header.valuePlaceholder")}
                                onInput={(event) =>
                                  updateAgentHeader(agent().id, row().id, { value: event.currentTarget.value })
                                }
                              />
                              <Show when={!isDefaultHeaderKey(row().key)}>
                                <IconButtonV2
                                  type="button"
                                  variant="ghost-muted"
                                  size="small"
                                  icon={<Icon name="trash" size="large" class="text-v2-icon-icon-muted" />}
                                  onClick={() => removeAgentHeader(agent().id, row().id)}
                                />
                              </Show>
                            </div>
                          )}
                        </Index>
                        <ButtonV2 size="small" variant="neutral" icon="plus" onClick={() => addAgentHeader(agent().id)}>
                          {language.t("settings.tdai.header.add")}
                        </ButtonV2>
                      </div>
                    </SettingsRowV2>
                  </div>
                )}
              </Index>
            </SettingsListV2>
          </Show>
        </div>
      </div>
    </>
  )
}
