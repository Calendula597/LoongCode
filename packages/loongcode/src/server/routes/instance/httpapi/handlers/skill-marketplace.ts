import { SkillMarketplace } from "@/skill/marketplace"
import { Skill } from "@/skill"
import { Command } from "@/command"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { InvalidRequestError } from "../errors"

export const skillMarketplaceHandlers = HttpApiBuilder.group(InstanceHttpApi, "instance.skill-marketplace", (handlers) =>
  Effect.gen(function* () {
    const marketplace = yield* SkillMarketplace.Service
    const skill = yield* Skill.Service
    const command = yield* Command.Service

    const list = Effect.fn("SkillMarketplaceHttpApi.list")(function* () {
      return yield* marketplace.list()
    })

    const install = Effect.fn("SkillMarketplaceHttpApi.install")(function* (ctx: { payload: { source: "skillhub" | "github" | "gitee"; name: string } }) {
      yield* marketplace.install(ctx.payload).pipe(
        Effect.catchTag("SkillMarketplace.InstallError", (error) =>
          Effect.fail(new InvalidRequestError({ message: error.message, kind: "install_failed" })),
        ),
      )
      yield* skill.refresh()
      yield* command.refresh()
      return { ok: true }
    })

    const uninstall = Effect.fn("SkillMarketplaceHttpApi.uninstall")(function* (ctx: { payload: { name: string } }) {
      yield* marketplace.uninstall(ctx.payload.name)
      yield* skill.refresh()
      yield* command.refresh()
      return { ok: true }
    })

    const repos = Effect.fn("SkillMarketplaceHttpApi.repos")(function* () {
      return yield* marketplace.repos()
    })

    const addRepo = Effect.fn("SkillMarketplaceHttpApi.addRepo")(function* (ctx: { payload: { url: string } }) {
      return yield* marketplace.addRepo(ctx.payload.url).pipe(
        Effect.catchTag("SkillMarketplace.InvalidRepoUrlError", (error) =>
          Effect.fail(new InvalidRequestError({ message: error.message, kind: "invalid_url" })),
        ),
      )
    })

    const removeRepo = Effect.fn("SkillMarketplaceHttpApi.removeRepo")(function* (ctx: { payload: { url: string } }) {
      yield* marketplace.removeRepo(ctx.payload.url)
      return { ok: true }
    })

    const skillhubStatus = Effect.fn("SkillMarketplaceHttpApi.skillhubStatus")(function* () {
      return yield* marketplace.skillHubStatus()
    })

    const setSkillHubKey = Effect.fn("SkillMarketplaceHttpApi.setSkillHubKey")(function* (ctx: { payload: { key: string } }) {
      yield* marketplace.setSkillHubKey(ctx.payload.key).pipe(
        Effect.catchTag("SkillMarketplace.InvalidSkillHubKeyError", (error) =>
          Effect.fail(new InvalidRequestError({ message: error.message, kind: "invalid_skillhub_key" })),
        ),
      )
      return { ok: true }
    })

    const removeSkillHubKey = Effect.fn("SkillMarketplaceHttpApi.removeSkillHubKey")(function* () {
      yield* marketplace.removeSkillHubKey()
      return { ok: true }
    })

    return handlers
      .handle("skill.marketplace", list)
      .handle("skill.install", install)
      .handle("skill.uninstall", uninstall)
      .handle("skill.repos", repos)
      .handle("skill.addRepo", addRepo)
      .handle("skill.removeRepo", removeRepo)
      .handle("skill.skillhubStatus", skillhubStatus)
      .handle("skill.setSkillHubKey", setSkillHubKey)
      .handle("skill.removeSkillHubKey", removeSkillHubKey)
  }),
)
