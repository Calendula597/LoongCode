import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("LOONGCODE_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@loongcode/RuntimeFlags", {
  autoShare: bool("LOONGCODE_AUTO_SHARE"),
  pure: bool("LOONGCODE_PURE"),
  disableDefaultPlugins: bool("LOONGCODE_DISABLE_DEFAULT_PLUGINS"),
  disableEmbeddedWebUi: bool("LOONGCODE_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("LOONGCODE_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("LOONGCODE_DISABLE_LSP_DOWNLOAD"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("LOONGCODE_DISABLE_CLAUDE_CODE"),
    direct: bool("LOONGCODE_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("LOONGCODE_DISABLE_CLAUDE_CODE"),
    direct: bool("LOONGCODE_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("LOONGCODE_ENABLE_EXA"),
    legacy: bool("LOONGCODE_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("LOONGCODE_ENABLE_PARALLEL"),
    legacy: bool("LOONGCODE_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("LOONGCODE_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("LOONGCODE_ENABLE_QUESTION_TOOL"),
  experimentalReferences: enabledByExperimental("LOONGCODE_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: enabledByExperimental("LOONGCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("LOONGCODE_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("LOONGCODE_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("LOONGCODE_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("LOONGCODE_EXPERIMENTAL_PLAN_MODE"),
  experimentalCodeMode: enabledByExperimental("LOONGCODE_EXPERIMENTAL_CODE_MODE"),
  experimentalEventSystem: enabledByExperimental("LOONGCODE_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("LOONGCODE_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("LOONGCODE_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("LOONGCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("LOONGCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("LOONGCODE_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("LOONGCODE_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("LOONGCODE_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Layer.provide(
  Service.layer,
  Layer.mergeAll(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer), Layer.orDie)

export const defaultLayer = Service.layer.pipe(Layer.orDie)

export const node = LayerNode.make({
  service: Service,
  layer: Service.layer.pipe(Layer.orDie),
  deps: [],
})

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@loongcode/core/effect/layer-node"
