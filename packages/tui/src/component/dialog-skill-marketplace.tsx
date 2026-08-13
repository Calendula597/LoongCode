import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { createResource, createMemo, createSignal, Show } from "solid-js"
import { useDialog } from "../ui/dialog"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useProject } from "../context/project"
import { useToast } from "../ui/toast"
import type { V2SkillMarketplaceResponse } from "@loongcode/sdk/v2"

type DiscoverableSkill = V2SkillMarketplaceResponse[number]

type RepoEntry = {
  kind: "repo"
  host: "github" | "gitee"
  url: string
  owner: string
  name: string
  branch: string
}

type MarketEntry = DiscoverableSkill | RepoEntry

function isRepo(value: MarketEntry): value is RepoEntry {
  return "kind" in value && value.kind === "repo"
}

function isSkill(value: MarketEntry): value is DiscoverableSkill {
  return !isRepo(value)
}

// The endpoints' 401 error body is typed `unknown`, so res.error narrows to `{}`.
function errorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) return String(error.message)
  return fallback
}

export function DialogSkillMarketplace() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const project = useProject()
  const toast = useToast()
  dialog.setSize("large")

  const [installing, setInstalling] = createSignal<string | null>(null)

  // Slash commands snapshot the command list at bootstrap; refetch after a
  // marketplace install/uninstall so new skills appear without a restart.
  const refreshCommands = async () => {
    const res = await sdk.client.command.list({ workspace: project.workspace.current() })
    sync.set("command", res.data ?? [])
  }

  const [data, { refetch }] = createResource(async () => {
    const [marketRes, reposRes] = await Promise.all([
      sdk.client.v2.skill.marketplace(),
      sdk.client.v2.skill.repos(),
    ])
    return { skills: marketRes.data ?? [], repos: reposRes.data ?? [] }
  })

  const install = async (skill: DiscoverableSkill) => {
    setInstalling(skill.name)
    const res = await sdk.client.v2.skill.install({ source: skill.source, name: skill.name })
    setInstalling(null)
    if (res.error) {
      toast.show({ title: "Error", message: errorMessage(res.error, "Failed to install"), variant: "error" })
      return
    }
    toast.show({ title: "Installed", message: `Skill "${skill.name}" installed.`, variant: "success" })
    await Promise.all([refreshCommands(), refetch()])
  }

  const uninstall = async (skill: DiscoverableSkill) => {
    const res = await sdk.client.v2.skill.uninstall({ name: skill.name })
    if (res.error) {
      toast.show({ title: "Error", message: errorMessage(res.error, "Failed to uninstall"), variant: "error" })
      return
    }
    toast.show({ title: "Uninstalled", message: `Skill "${skill.name}" uninstalled.`, variant: "success" })
    await Promise.all([refreshCommands(), refetch()])
  }

  const addRepo = async () => {
    const url = await DialogPrompt.show(dialog, "Add skill repo", { placeholder: "https://gitee.com/owner/repo" })
    if (!url) return
    const trimmed = url.trim()
    if (!trimmed) return
    const res = await sdk.client.v2.skill.addRepo({ url: trimmed })
    if (res.error) {
      toast.show({ title: "Error", message: errorMessage(res.error, "Failed to add repo"), variant: "error" })
      return
    }
    toast.show({ title: "Repo added", message: `Added "${trimmed}".`, variant: "success" })
    await refetch()
  }

  const removeRepo = async (repo: RepoEntry) => {
    const res = await sdk.client.v2.skill.removeRepo({ url: repo.url })
    if (res.error) {
      toast.show({ title: "Error", message: errorMessage(res.error, "Failed to remove repo"), variant: "error" })
      return
    }
    toast.show({ title: "Repo removed", message: `Removed "${repo.owner}/${repo.name}".`, variant: "success" })
    await refetch()
  }

  const options = createMemo<DialogSelectOption<MarketEntry>[]>(() => {
    const list = data()
    const repoOptions: DialogSelectOption<MarketEntry>[] = (list?.repos ?? []).map((repo) => ({
      title: `${repo.owner}/${repo.name}`,
      description: repo.url,
      value: { ...repo, kind: "repo" },
      category: "Repos",
      details: [repo.branch],
    }))
    const skills = list?.skills ?? []
    const maxWidth = Math.max(0, ...skills.map((s) => s.name.length))
    const skillOptions: DialogSelectOption<MarketEntry>[] = skills.map((skill) => {
      const busy = installing() === skill.name
      const prefix = skill.installed ? "● " : "○ "
      const sourceTag = skill.source === "skillhub" ? "[SkillHub]" : skill.source === "gitee" ? "[Gitee]" : "[GitHub]"
      return {
        title: prefix + skill.name.padEnd(maxWidth),
        description: busy
          ? "Installing..."
          : skill.description?.replace(/\s+/g, " ").trim(),
        value: skill,
        category: sourceTag,
        details: skill.repo ? [skill.repo] : undefined,
      }
    })
    return [...repoOptions, ...skillOptions]
  })

  const actions = createMemo(() => [
    {
      command: "dialog.skills.install",
      title: "install",
      disabled: (option: DialogSelectOption<MarketEntry> | undefined) =>
        !option || !isSkill(option.value) || option.value.installed,
      onTrigger: (option: DialogSelectOption<MarketEntry>) => {
        if (isSkill(option.value)) void install(option.value)
      },
    },
    {
      command: "dialog.skills.uninstall",
      title: "uninstall",
      disabled: (option: DialogSelectOption<MarketEntry> | undefined) =>
        !option || !isSkill(option.value) || !option.value.installed,
      onTrigger: (option: DialogSelectOption<MarketEntry>) => {
        if (isSkill(option.value)) void uninstall(option.value)
      },
    },
    {
      command: "dialog.skills.repo.remove",
      title: "remove repo",
      disabled: (option: DialogSelectOption<MarketEntry> | undefined) => !option || !isRepo(option.value),
      onTrigger: (option: DialogSelectOption<MarketEntry>) => {
        if (isRepo(option.value)) void removeRepo(option.value)
      },
    },
    {
      command: "dialog.skills.repo.add",
      title: "add repo",
      onTrigger: () => void addRepo(),
    },
  ])

  return (
    <DialogSelect
      title="Skill Marketplace"
      placeholder="Search skills..."
      options={options()}
      actions={actions()}
      emptyView={<Show when={data.loading} fallback="No skills found.">Loading skills...</Show>}
    />
  )
}