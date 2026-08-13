import { Component, createMemo, createResource, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { ButtonV2 } from "@loongcode/ui/v2/button-v2"
import { Tag } from "@loongcode/ui/v2/badge-v2"
import { TextInputV2 } from "@loongcode/ui/v2/text-input-v2"
import { IconButtonV2 } from "@loongcode/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@loongcode/ui/v2/icon"
// SkillHub API key UI is disabled: SkillHub's "my skills" list endpoint is
// cookie-session-only (API tokens get 403), so a configured key cannot surface
// private skills in the catalogue. The code is commented rather than deleted so
// it can be restored once SkillHub supports token-based listing.
// import { Dialog, DialogFooter } from "@loongcode/ui/v2/dialog-v2"
// import { FieldV2 } from "@loongcode/ui/v2/field-v2"
// import { useDialog } from "@loongcode/ui/context/dialog"
import { useServerSDK } from "@/context/server-sdk"
import { useLanguage } from "@/context/language"
import { SettingsListV2 } from "../settings-v2/parts/list"
import { errorMessage } from "./util"

// SkillHub API key dialog — disabled, see the note at the imports above.
// function SkillHubKeyDialog(props: { onSaved: () => void }) {
//   const dialog = useDialog()
//   const language = useLanguage()
//   const serverSDK = useServerSDK()
//   const client = createMemo(() => serverSDK().createClient({ throwOnError: false }))
//   const [store, setStore] = createStore({
//     key: "",
//     error: undefined as string | undefined,
//     saving: false,
//   })
//
//   const save = async () => {
//     const key = store.key.trim()
//     if (!key) {
//       setStore("error", language.t("settings.skills.skillhub.dialog.required"))
//       return
//     }
//     setStore({ error: undefined, saving: true })
//     const res = await client().v2.skill.setSkillHubKey({ key })
//     setStore("saving", false)
//     if (res.error) {
//       setStore("error", errorMessage(res.error, language.t("settings.skills.skillhub.dialog.invalid")))
//       return
//     }
//     props.onSaved()
//     dialog.close()
//   }
//
//   return (
//     <Dialog
//       title={language.t("settings.skills.skillhub.dialog.title")}
//       description={language.t("settings.skills.skillhub.dialog.description")}
//       fit
//     >
//       <form
//         onSubmit={(e) => {
//           e.preventDefault()
//           void save()
//         }}
//         class="flex w-full min-w-0 flex-1 flex-col gap-4 px-4 pt-4"
//       >
//         <FieldV2 invalid={!!store.error}>
//           <FieldV2.Label>{language.t("settings.skills.skillhub.dialog.label")}</FieldV2.Label>
//           <FieldV2.Control>
//             <TextInputV2
//               autofocus
//               type="password"
//               appearance="large"
//               placeholder={language.t("settings.skills.skillhub.dialog.placeholder")}
//               value={store.key}
//               invalid={!!store.error}
//               onInput={(e) => setStore("key", e.currentTarget.value)}
//               aria-label={language.t("settings.skills.skillhub.dialog.label")}
//             />
//           </FieldV2.Control>
//         </FieldV2>
//         <Show when={store.error}>
//           <p class="settings-v2-skills-error">{store.error}</p>
//         </Show>
//       </form>
//       <DialogFooter>
//         <ButtonV2 variant="ghost-muted" disabled={store.saving} onClick={() => dialog.close()}>
//           {language.t("settings.skills.skillhub.dialog.cancel")}
//         </ButtonV2>
//         <ButtonV2 type="button" disabled={store.saving} onClick={() => void save()}>
//           {store.saving ? "..." : language.t("settings.skills.skillhub.dialog.save")}
//         </ButtonV2>
//       </DialogFooter>
//     </Dialog>
//   )
// }

export const RepoManager: Component<{ onChanged?: () => void }> = (props) => {
  const serverSDK = useServerSDK()
  const language = useLanguage()
  const client = createMemo(() => serverSDK().createClient({ throwOnError: false }))
  const [state, setState] = createStore({
    newRepoUrl: "",
    adding: false,
    error: null as string | null,
  })

  const [repos, { refetch }] = createResource(async () => {
    const res = await client().v2.skill.repos()
    return res.data ?? []
  })

  const addRepo = async () => {
    const url = state.newRepoUrl.trim()
    if (!url) return
    setState({ adding: true, error: null })
    const res = await client().v2.skill.addRepo({ url })
    setState({ adding: false })
    if (res.error) {
      setState({ error: errorMessage(res.error, language.t("settings.skills.error.addRepo")) })
      return
    }
    setState({ newRepoUrl: "" })
    await refetch()
    // Repo membership feeds the marketplace skill list — let the parent refresh it.
    props.onChanged?.()
  }

  const removeRepo = async (url: string) => {
    await client().v2.skill.removeRepo({ url })
    await refetch()
    props.onChanged?.()
  }

  // SkillHub key actions — disabled, see the note at the imports above.
  // const openSkillHubDialog = () => {
  //   dialog.show(() => <SkillHubKeyDialog onSaved={() => void refetchSkillHub()} />)
  // }
  //
  // const disconnectSkillHub = async () => {
  //   await client().v2.skill.removeSkillHubKey()
  //   await refetchSkillHub()
  // }

  return (
    <>
      <div class="settings-v2-skills-repos-add">
        <TextInputV2
          appearance="base"
          placeholder={language.t("settings.skills.repoPlaceholder")}
          value={state.newRepoUrl}
          onInput={(e) => setState({ newRepoUrl: e.currentTarget.value })}
          onKeyDown={(e) => e.key === "Enter" && addRepo()}
          spellcheck={false}
          autocorrect="off"
          autocomplete="off"
          autocapitalize="off"
          aria-label={language.t("settings.skills.repoAria")}
        />
        <ButtonV2 variant="ghost-muted" icon="plus" disabled={state.adding} onClick={addRepo}>
          {state.adding ? language.t("settings.skills.addingRepo") : language.t("settings.skills.addRepo")}
        </ButtonV2>
      </div>
      <SettingsListV2>
        <div class="settings-v2-skills-row">
          <div class="settings-v2-skills-lead">
            <img src="/favicon.svg" class="h-4 w-4 shrink-0 self-center" alt="" />
            <div class="settings-v2-skills-copy self-center">
              <span class="settings-v2-skills-name">{language.t("settings.skills.skillhub.pinnedName")}</span>
            </div>
          </div>
          <div class="settings-v2-skills-actions">
            <Tag>{language.t("settings.skills.skillhub.enabled")}</Tag>
          </div>
          {/* API key actions — disabled, see the note at the imports above. When
              configured, the primary action used to become disconnect.
          <div class="settings-v2-skills-actions">
            <Show
              when={skillHub()?.configured}
              fallback={
                <ButtonV2 variant="ghost-muted" size="small" onClick={openSkillHubDialog}>
                  {language.t("settings.skills.skillhub.configure")}
                </ButtonV2>
              }
            >
              <ButtonV2 variant="ghost-muted" size="small" onClick={() => void disconnectSkillHub()}>
                {language.t("settings.skills.skillhub.disconnect")}
              </ButtonV2>
            </Show>
          </div>
          */}
        </div>
      </SettingsListV2>
      <Show when={state.error}>
        <p class="settings-v2-skills-error">{state.error}</p>
      </Show>
      <Show when={(repos() ?? []).length > 0}>
        <SettingsListV2>
          <For each={repos() ?? []}>
            {(repo) => (
              <div class="settings-v2-skills-row">
                <div class="settings-v2-skills-lead">
                  <div class="settings-v2-skills-copy">
                    <span class="settings-v2-skills-name">
                      {repo.owner}/{repo.name}
                    </span>
                    <span class="settings-v2-skills-meta">{repo.branch}</span>
                  </div>
                </div>
                <div class="settings-v2-skills-actions">
                  <Tag>{repo.host === "gitee" ? "Gitee" : "GitHub"}</Tag>
                  <IconButtonV2
                    type="button"
                    variant="ghost-muted"
                    size="small"
                    icon={<IconV2 name="close" size="large" class="text-v2-icon-icon-muted" />}
                    aria-label={language.t("settings.skills.removeRepo", { name: `${repo.owner}/${repo.name}` })}
                    onClick={() => removeRepo(repo.url)}
                  />
                </div>
              </div>
            )}
          </For>
        </SettingsListV2>
      </Show>
    </>
  )
}