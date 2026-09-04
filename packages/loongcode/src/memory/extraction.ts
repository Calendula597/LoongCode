export * as MemoryExtraction from "./extraction"

import { Effect, Layer, Context, Cause, Option } from "effect"
import { join } from "path"
import { LLM } from "@/session/llm"
import { Agent } from "@/agent/agent"
import { Provider } from "@/provider/provider"
import { ProviderV2 } from "@loongcode/core/provider"
import { ModelV2 } from "@loongcode/core/model"
import { Config } from "@/config/config"
import { Session } from "@/session/session"
import { SessionID } from "@/session/schema"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { MemoryPaths } from "@loongcode/core/memory/paths"
import { MemoryRedact } from "@loongcode/core/memory/redact"
import { FSUtil } from "@loongcode/core/fs-util"
import { MemoryShared } from "./shared"

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    rollout_summary: { type: "string", description: "Short recap of the session" },
    rollout_slug: { type: "string", description: "Short kebab-case slug for this session" },
    raw_memory: { type: "string", description: "The durable memory worth keeping, or empty" },
  },
  required: ["rollout_summary", "rollout_slug", "raw_memory"],
} as const

/** Synthetic sub-agent session used for extraction model calls (memory learning is not part of Session execution authority). */
const MEMORY_SUBSESSION = "memory-extraction"

export interface Interface {
  readonly discover: (input: {
    minIdleHours: number
    maxAgeDays: number
    limit: number
    exclude?: string
  }) => Effect.Effect<string[]>
  readonly extract: (sessionID: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/MemoryExtraction") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const sessions = yield* Session.Service
    const jobs = yield* MemoryJobs.Service
    const provider = yield* Provider.Service
    const agents = yield* Agent.Service
    const llm = yield* LLM.Service
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service

    const discover: Interface["discover"] = Effect.fn("MemoryExtraction.discover")(function* (input) {
      const now = Date.now()
      const all = yield* sessions.listGlobal({ roots: true, archived: false }).pipe(Effect.orDie)
      const minUpdated = now - input.maxAgeDays * 24 * 60 * 60 * 1000
      const maxUpdated = now - input.minIdleHours * 60 * 60 * 1000
      const byUpdated = new Map(all.map((s) => [s.id, s.time.updated]))
      const eligible = all
        .filter((s) => {
          if (input.exclude && s.id === input.exclude) return false
          if (s.parentID) return false
          if (s.time.updated < minUpdated) return false
          if (s.time.updated > maxUpdated) return false
          return true
        })
        .map((s) => s.id)
        .toSorted((a, b) => (byUpdated.get(a) ?? 0) - (byUpdated.get(b) ?? 0))
      return eligible.slice(0, input.limit)
    })

    const buildTranscript = Effect.fn("MemoryExtraction.buildTranscript")(function* (sessionID: string) {
      const msgs = yield* sessions.messages({ sessionID: SessionID.make(sessionID) }).pipe(Effect.orDie)
      const lines: string[] = []
      for (const m of msgs) {
        const role = m.info.role
        for (const part of m.parts) {
          if (part.type === "reasoning") continue
          if (part.type === "step-start" || part.type === "step-finish") continue
          if ("ignored" in part && part.ignored === true) continue
          if (part.type === "text") {
            if ("synthetic" in part && part.synthetic) continue
            lines.push(`[${role}] ${part.text}`)
          } else if (part.type === "tool") {
            const state = part.state
            if (state.status === "error") {
              lines.push(`[tool: ${part.tool}] [error] ${state.error}`)
            } else if (state.status === "completed") {
              const input = state.input ? JSON.stringify(state.input) : ""
              lines.push(`[tool: ${part.tool}] ${input}\n${state.output ?? ""}`)
            }
          }
        }
      }
      return MemoryRedact.redact(lines.join("\n"))
    })

    const extract: Interface["extract"] = Effect.fn("MemoryExtraction.extract")(function* (sessionID) {
      const opts = MemoryOptions.fromConfig((yield* config.get()).memory)
      // The watermark is the session's own last-activity timestamp, not wall
      // clock: a completed extraction stays done until the session gains new
      // activity. Using Date.now() here would always outrun the stored
      // watermark and re-extract every completed session on every pass.
      const sessionInfo = yield* sessions
        .get(SessionID.make(sessionID))
        .pipe(Effect.option)
      if (Option.isNone(sessionInfo)) return
      const sourceUpdatedAt = sessionInfo.value.time.updated
      const token = yield* jobs.claimStage1({
        sessionID,
        sourceUpdatedAt,
        leaseSeconds: 60 * 60,
      })
      if (token === false) return

      const resolveModel = (defaultID: { providerID: ProviderV2.ID; modelID: ModelV2.ID }) =>
        opts.extractModel === undefined
          ? provider.getSmallModel(defaultID.providerID).pipe(
              Effect.flatMap((small) =>
                small ? Effect.succeed(small) : provider.getModel(defaultID.providerID, defaultID.modelID),
              ),
            )
          : MemoryShared.resolveModel(opts.extractModel, provider)

      const run = Effect.gen(function* () {
        const transcript = yield* buildTranscript(sessionID)
        if (transcript.trim().length === 0) {
          yield* jobs.completeStage1({
            sessionID,
            ownershipToken: token,
            rawMemory: null,
            rolloutSummary: "",
            sourceUpdatedAt,
          })
          return
        }

        const defaultID = yield* provider.defaultModel().pipe(Effect.orDie)
        const agent = yield* agents.get("memorize-extract")
        const model = agent.model
          ? yield* provider.getModel(agent.model.providerID, agent.model.modelID).pipe(Effect.orDie)
          : yield* resolveModel(defaultID).pipe(Effect.orDie)

        let structured: unknown
        yield* MemoryShared.runStructured({
          llm,
          model,
          agent,
          user: MemoryShared.memoryUser(model, "memorize-extract", MEMORY_SUBSESSION),
          sessionID: MEMORY_SUBSESSION,
          schema: EXTRACTION_SCHEMA as unknown as Record<string, any>,
          small: true,
          prompt: [
            "Extract durable memory from the following session transcript.",
            "Return the result by calling the StructuredOutput tool.",
            "",
            "TRANSCRIPT:",
            "---",
            transcript,
          ].join("\n"),
          onSuccess(output) {
            structured = output
          },
        })

        if (structured === undefined) {
          yield* jobs.failStage1({ sessionID, ownershipToken: token, error: "no structured output", retryDelaySeconds: 60 * 60 })
          return
        }
        const record = structured as { rollout_summary?: string; rollout_slug?: string; raw_memory?: string }
        yield* jobs.completeStage1({
          sessionID,
          ownershipToken: token,
          rawMemory: record.raw_memory ?? "",
          rolloutSummary: record.rollout_summary ?? "",
          sourceUpdatedAt,
        })
        // Persist the rollout recap into the workspace so consolidation and
        // memory_read can reach it (rollout_summaries/<slug>.md).
        const summary = record.rollout_summary ?? ""
        const slug = (record.rollout_slug ?? "").replace(/[^a-z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
        if (summary && slug) {
          const file = join(MemoryPaths.workspace.rolloutSummaries(), `${slug}.md`)
          yield* fs.writeFileString(file, `${summary}\n`).pipe(Effect.ignore)
        }
      })

      yield* run.pipe(
        Effect.catchCause((cause) => {
          const error = Cause.squash(cause)
          return jobs.failStage1({
            sessionID,
            ownershipToken: token,
            error: error instanceof Error ? error.message : String(error),
            retryDelaySeconds: 60 * 60,
          })
        }),
      )
    })

    return Service.of({ discover, extract })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Config.defaultLayer),
    Layer.provide(Session.defaultLayer),
    Layer.provide(MemoryJobs.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(LLM.defaultLayer),
    Layer.provide(FSUtil.defaultLayer),
  ),
)
