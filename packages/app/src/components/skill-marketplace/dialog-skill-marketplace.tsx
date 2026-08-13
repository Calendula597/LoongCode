import { Component, For, Show, createResource, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { Dialog } from "@loongcode/ui/v2/dialog-v2"
import { TabsV2 } from "@loongcode/ui/v2/tabs-v2"
import { TextInputV2 } from "@loongcode/ui/v2/text-input-v2"
import { IconButtonV2 } from "@loongcode/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@loongcode/ui/v2/icon"
import { useLanguage } from "@/context/language"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import { SettingsListV2 } from "../settings-v2/parts/list"
import { SkillRow, type SkillCardSkill } from "./skill-card"
import { RepoManager } from "./repo-manager"
import { errorMessage } from "./util"
import "./skill-marketplace.css"

export const SkillMarketplace: Component = () => {
  const language = useLanguage()
  const serverSDK = useServerSDK()
  const serverSync = useServerSync()
  // Server-scoped (non-directory) client: this component also renders in the
  // global settings dialog, where no directory-scoped SDKProvider exists.
  const client = createMemo(() => serverSDK().createClient({ throwOnError: false }))
  const [state, setState] = createStore({
    search: "",
    pending: null as { name: string; action: "install" | "uninstall" } | null,
    error: null as string | null,
  })

  const [skills, { refetch }] = createResource<SkillCardSkill[]>(async () => {
    const res = await client().v2.skill.marketplace()
    return res.data ?? []
  })

  const filtered = createMemo(() => {
    const query = state.search.trim().toLowerCase()
    const list = skills() ?? []
    if (!query) return list
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(query) || s.description?.toLowerCase().includes(query),
    )
  })

  const installedSkills = createMemo(() => (skills() ?? []).filter((s) => s.installed))

  // pending spans the mutation request AND the list refresh that confirms it,
  // so the row spinner reflects the real "still working" state.
  const mutate = async (skill: SkillCardSkill, action: "install" | "uninstall") => {
    setState({ pending: { name: skill.name, action }, error: null })
    const fallback = () => language.t(`settings.skills.error.${action}`, { name: skill.name })
    try {
      const res =
        action === "install"
          ? await client().v2.skill.install({ source: skill.source, name: skill.name })
          : await client().v2.skill.uninstall({ name: skill.name })
      if (res.error) {
        setState({ error: errorMessage(res.error, fallback()) })
        return
      }
      serverSync().command.refresh()
      await refetch()
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : fallback() })
    } finally {
      setState({ pending: null })
    }
  }

  const install = (skill: SkillCardSkill) => mutate(skill, "install")
  const uninstall = (skill: SkillCardSkill) => mutate(skill, "uninstall")

  const renderRow = (skill: SkillCardSkill) => (
    <SkillRow
      skill={skill}
      onInstall={() => install(skill)}
      onUninstall={() => uninstall(skill)}
      pending={state.pending?.name === skill.name}
      pendingAction={state.pending?.name === skill.name ? state.pending.action : undefined}
    />
  )

  return (
    <TabsV2 orientation="horizontal" variant="normal" defaultValue="marketplace" class="skill-marketplace">
      <div class="settings-v2-tab-header settings-v2-skills-header">
        <div class="settings-v2-tab-header-row">
          <h2 class="settings-v2-tab-title">{language.t("settings.tab.skills")}</h2>
        </div>
        <TabsV2.List class="settings-v2-skills-tabs">
          <TabsV2.Trigger value="marketplace">{language.t("settings.skills.tab.marketplace")}</TabsV2.Trigger>
          <TabsV2.Trigger value="installed">
            {language.t("settings.skills.tab.installed")} ({installedSkills().length})
          </TabsV2.Trigger>
          <TabsV2.Trigger value="repos">{language.t("settings.skills.tab.repos")}</TabsV2.Trigger>
        </TabsV2.List>
      </div>

      <TabsV2.Content value="marketplace" class="settings-v2-tab-body settings-v2-skills-body">
        <div class="settings-v2-tab-search">
          <TextInputV2
            type="search"
            appearance="base"
            placeholder={language.t("settings.skills.searchPlaceholder")}
            value={state.search}
            onInput={(e) => setState({ search: e.currentTarget.value })}
            spellcheck={false}
            autocorrect="off"
            autocomplete="off"
            autocapitalize="off"
            aria-label={language.t("settings.skills.searchAria")}
          />
          <Show when={state.search}>
            <IconButtonV2
              type="button"
              variant="ghost-muted"
              size="small"
              class="settings-v2-tab-search-clear"
              icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
              onClick={() => setState({ search: "" })}
            />
          </Show>
        </div>
        <Show when={state.error}>
          <p class="settings-v2-skills-error">{state.error}</p>
        </Show>
        <Show
          when={filtered().length > 0}
          fallback={
            <div class="settings-v2-skills-status">
              <span>{skills() === undefined && skills.loading
                ? language.t("settings.skills.loading")
                : language.t("settings.skills.empty")}</span>
            </div>
          }
        >
          <SettingsListV2>
            <For each={filtered()}>{renderRow}</For>
          </SettingsListV2>
        </Show>
      </TabsV2.Content>

      <TabsV2.Content value="installed" class="settings-v2-tab-body settings-v2-skills-body">
        <Show
          when={installedSkills().length > 0}
          fallback={
            <div class="settings-v2-skills-status">
              <span>{language.t("settings.skills.noInstalled")}</span>
            </div>
          }
        >
          <SettingsListV2>
            <For each={installedSkills()}>{renderRow}</For>
          </SettingsListV2>
        </Show>
      </TabsV2.Content>

      <TabsV2.Content value="repos" class="settings-v2-tab-body settings-v2-skills-body">
        <RepoManager onChanged={() => void refetch()} />
      </TabsV2.Content>
    </TabsV2>
  )
}

export const DialogSkillMarketplace: Component = () => {
  return (
    <Dialog size="large" variant="settings" class="skill-marketplace-dialog">
      <SkillMarketplace />
    </Dialog>
  )
}
