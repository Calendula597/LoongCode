import { Component, Show, createMemo } from "solid-js"
import { ButtonV2 } from "@loongcode/ui/v2/button-v2"
import { Tag } from "@loongcode/ui/v2/badge-v2"
import { Spinner } from "@loongcode/ui/spinner"
import { useLanguage } from "@/context/language"
import type { V2SkillMarketplaceResponse } from "@loongcode/sdk/v2"

export type SkillCardSkill = V2SkillMarketplaceResponse[number]

interface SkillRowProps {
  skill: SkillCardSkill
  onInstall: () => void
  onUninstall: () => void
  pending?: boolean
  pendingAction?: "install" | "uninstall"
}

export const SkillRow: Component<SkillRowProps> = (props) => {
  const language = useLanguage()
  const sourceTag = createMemo(() =>
    props.skill.source === "skillhub" ? "SkillHub" : props.skill.source === "gitee" ? "Gitee" : "GitHub",
  )
  const meta = createMemo(() => props.skill.description ?? props.skill.slug)

  return (
    <div class="settings-v2-skills-row" data-installed={props.skill.installed}>
      <div class="settings-v2-skills-lead">
        <div class="settings-v2-skills-copy">
          <span class="settings-v2-skills-name">{props.skill.name}</span>
          <Show when={meta()}>
            <span class="settings-v2-skills-meta">{meta()}</span>
          </Show>
        </div>
      </div>
      <div class="settings-v2-skills-actions">
        {/* Repo-sourced skills show `owner/repo` as the tag instead of the host name. */}
        <Show when={props.skill.repo} fallback={<Tag>{sourceTag()}</Tag>}>
          <Tag>{props.skill.repo}</Tag>
        </Show>
        <Show when={props.skill.installed}>
          <Tag>{language.t("settings.skills.installed")}</Tag>
        </Show>
        <Show
          when={!props.pending}
          fallback={
            <span class="settings-v2-skills-installing">
              <Spinner class="size-4 shrink-0" />
              {props.pendingAction === "uninstall"
                ? language.t("settings.skills.uninstalling")
                : language.t("settings.skills.installing")}
            </span>
          }
        >
          <Show
            when={props.skill.installed}
            fallback={
              <ButtonV2 variant="ghost-muted" size="small" onClick={props.onInstall}>
                {language.t("settings.skills.install")}
              </ButtonV2>
            }
          >
            <ButtonV2 variant="ghost-muted" size="small" onClick={props.onUninstall}>
              {language.t("settings.skills.uninstall")}
            </ButtonV2>
          </Show>
        </Show>
      </div>
    </div>
  )
}