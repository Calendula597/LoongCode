import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Memory } from "@/memory"

export const Parameters = Schema.Struct({})

type Metadata = {
  options: Memory.InspectReport["options"]
  stage1Jobs: Memory.InspectReport["stage1Jobs"]
  stage1Outputs: number
  phase2Status: string | undefined
}

export const MemoryInspectTool = Tool.define<typeof Parameters, Metadata, Memory.Service>(
  "memory_inspect",
  Effect.gen(function* () {
    const memory = yield* Memory.Service

    return {
      description:
        "Inspect the current memory state. Returns the effective memory configuration, " +
        "stage-1 extraction job status and counts, stage-1 output count, phase-2 consolidation " +
        "status, and the memory workspace layout. Use it to verify configuration and debug why " +
        "memory is not building. Read-only.",
      parameters: Parameters,
      execute: () =>
        Effect.gen(function* () {
          const report = yield* memory.inspect()
          const o = report.options
          const lines = [
            "memory: enabled" + (o.generateMemories ? " (generate)" : "") + (o.useMemories ? " (use)" : ""),
            `extract_model: ${o.extractModel ?? "default"}`,
            `consolidation_model: ${o.consolidationModel ?? "default"}`,
            `min_rollout_idle_hours: ${o.minRolloutIdleHours}`,
            `max_rollout_age_days: ${o.maxRolloutAgeDays}`,
            `max_rollouts_per_startup: ${o.maxRolloutsPerStartup}`,
            `max_unused_days: ${o.maxUnusedDays}`,
            `max_raw_memories_for_consolidation: ${o.maxRawMemoriesForConsolidation}`,
            `workspace: ${report.workspace.workspaceDir}`,
            `workspace_files: ${report.workspace.files.join(", ") || "none"}`,
            `stage1_jobs: ${report.stage1Jobs.map((j) => `${j.status}=${j.count}`).join(" ") || "none"}`,
            `stage1_outputs: ${report.stage1Outputs}`,
            `phase2_status: ${report.phase2Status ?? "none"}`,
          ]
          return {
            title: "Memory inspection",
            output: lines.join("\n"),
            metadata: {
              options: o,
              stage1Jobs: report.stage1Jobs,
              stage1Outputs: report.stage1Outputs,
              phase2Status: report.phase2Status,
            },
          }
        }).pipe(Effect.orDie),
    } satisfies Tool.DefWithoutID<typeof Parameters, Metadata>
  }),
)
