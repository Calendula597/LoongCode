import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { SkillMarketplace } from "@/skill/marketplace"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"
import { InvalidRequestError } from "../errors"

const SkillRepoSchema = Schema.Struct({
  host: Schema.Literals(["github", "gitee"]),
  url: Schema.String,
  owner: Schema.String,
  name: Schema.String,
  branch: Schema.String,
})

const InstallRequest = Schema.Struct({
  source: Schema.Literals(["skillhub", "github", "gitee"]),
  name: Schema.String,
})

const UninstallRequest = Schema.Struct({
  name: Schema.String,
})

const RepoRequest = Schema.Struct({
  url: Schema.String,
})

const SetSkillHubKeyRequest = Schema.Struct({
  key: Schema.String,
})

const SkillHubStatusResponse = Schema.Struct({
  configured: Schema.Boolean,
})

const OkResponse = Schema.Struct({ ok: Schema.Boolean })

export const SkillMarketplacePaths = {
  marketplace: "/api/skill/marketplace",
  install: "/api/skill/marketplace/install",
  uninstall: "/api/skill/marketplace/uninstall",
  repos: "/api/skill/repos",
  addRepo: "/api/skill/repos/add",
  removeRepo: "/api/skill/repos/remove",
  skillhub: "/api/skill/skillhub",
} as const

export const SkillMarketplaceGroup = HttpApiGroup.make("instance.skill-marketplace")
  .add(
    HttpApiEndpoint.get("skill.marketplace", SkillMarketplacePaths.marketplace, {
      query: WorkspaceRoutingQuery,
      success: described(Schema.Array(SkillMarketplace.DiscoverableSkill), "Discoverable skills"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.marketplace",
        summary: "List discoverable skills",
        description: "Browse skills available for installation from SkillHub and GitHub/Gitee repos.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("skill.install", SkillMarketplacePaths.install, {
      query: WorkspaceRoutingQuery,
      payload: InstallRequest,
      success: described(OkResponse, "Installation result"),
      error: InvalidRequestError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.install",
        summary: "Install a skill",
        description: "Download and install a skill from SkillHub or a GitHub/Gitee repo.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("skill.uninstall", SkillMarketplacePaths.uninstall, {
      query: WorkspaceRoutingQuery,
      payload: UninstallRequest,
      success: described(OkResponse, "Uninstall result"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.uninstall",
        summary: "Uninstall a skill",
        description: "Remove an installed skill from config.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("skill.repos", SkillMarketplacePaths.repos, {
      query: WorkspaceRoutingQuery,
      success: described(Schema.Array(SkillRepoSchema), "Repo skill sources"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.repos",
        summary: "List repo skill sources",
        description: "List configured GitHub/Gitee repository skill sources.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("skill.addRepo", SkillMarketplacePaths.addRepo, {
      query: WorkspaceRoutingQuery,
      payload: RepoRequest,
      success: described(SkillRepoSchema, "Parsed repo info"),
      error: InvalidRequestError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.addRepo",
        summary: "Add a repo skill source",
        description: "Add a GitHub or Gitee repository URL as a skill source.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("skill.removeRepo", SkillMarketplacePaths.removeRepo, {
      query: WorkspaceRoutingQuery,
      payload: RepoRequest,
      success: described(OkResponse, "Removal result"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.removeRepo",
        summary: "Remove a repo skill source",
        description: "Remove a repository URL from skill sources.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.get("skill.skillhubStatus", SkillMarketplacePaths.skillhub, {
      query: WorkspaceRoutingQuery,
      success: described(SkillHubStatusResponse, "Skill Hub credential status"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.skillhubStatus",
        summary: "Get Skill Hub credential status",
        description: "Report whether a Skill Hub API key is configured.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.put("skill.setSkillHubKey", SkillMarketplacePaths.skillhub, {
      query: WorkspaceRoutingQuery,
      payload: SetSkillHubKeyRequest,
      success: described(OkResponse, "Save result"),
      error: InvalidRequestError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.setSkillHubKey",
        summary: "Set Skill Hub API key",
        description: "Validate and persist a Skill Hub API key.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.delete("skill.removeSkillHubKey", SkillMarketplacePaths.skillhub, {
      query: WorkspaceRoutingQuery,
      success: described(OkResponse, "Removal result"),
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.skill.removeSkillHubKey",
        summary: "Remove Skill Hub API key",
        description: "Remove the configured Skill Hub API key.",
      }),
    ),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "skill-marketplace",
      description: "Skill marketplace routes for browsing and installing skills.",
    }),
  )
  .middleware(InstanceContextMiddleware)
  .middleware(WorkspaceRoutingMiddleware)
  .middleware(Authorization)
