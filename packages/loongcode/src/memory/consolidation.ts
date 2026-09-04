export * as MemoryConsolidation from "./consolidation"

import { Cause, Effect, Layer, Context } from "effect"
import { dirname, isAbsolute, join, relative } from "path"
import { rename } from "fs/promises"
import { LLM } from "@/session/llm"
import { Agent } from "@/agent/agent"
import { Provider } from "@/provider/provider"
import { Config } from "@/config/config"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { MemoryRedact } from "@loongcode/core/memory/redact"
import { FSUtil } from "@loongcode/core/fs-util"
import { MemoryPaths } from "@loongcode/core/memory/paths"
import { Git } from "@/git"
import { MemoryShared } from "./shared"

const CONSOLIDATION_SCHEMA = {
  type: "object",
  properties: {
    memory_summary: { type: "string", description: "The compact summary injected into the system prompt" },
    memory_md: { type: "string", description: "The full MEMORY.md handbook content" },
    raw_memories_md: { type: "string", description: "The merged raw memories file content" },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          content: { type: "string" },
        },
        required: ["name", "content"],
      },
      description: "Reusable procedures to write under skills/<name>/SKILL.md",
    },
  },
  required: ["memory_summary", "memory_md", "raw_memories_md"],
} as const

const MEMORY_SUBSESSION = "memory-consolidation"

export interface Interface {
  readonly consolidate: () => Effect.Effect<boolean>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/MemoryConsolidation") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const jobs = yield* MemoryJobs.Service
    const provider = yield* Provider.Service
    const agents = yield* Agent.Service
    const llm = yield* LLM.Service
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const git = yield* Git.Service
    const memoryRoot = MemoryPaths.workspace.dir()

    // Missing files on a fresh install read as empty strings — never let the
    // literal "undefined" leak into a consolidation prompt.
    const readFile = (name: string) =>
      fs.readFileStringSafe(join(memoryRoot, name)).pipe(
        Effect.map((text) => text ?? ""),
        Effect.orDie,
      )
    // Path-traversal guard: LLM-controlled names (e.g. skill.name from the
    // structured output) must never escape the memory workspace.
    const resolveSafe = (name: string) => {
      const base = relative(memoryRoot, join(memoryRoot, name))
      if (base.startsWith("..") || isAbsolute(base)) return undefined
      return join(memoryRoot, name)
    }
    const writeFile = (name: string, content: string) =>
      Effect.gen(function* () {
        const full = resolveSafe(name)
        if (full === undefined) {
          yield* Effect.logWarning("memory consolidation: rejecting path outside memory workspace", { name })
          return
        }
        yield* fs.ensureDir(dirname(full)).pipe(Effect.orDie)
        // Atomic replace: a crash mid-write sequence must not leave a
        // half-updated file that the next pass would take as the current state.
        const temp = `${full}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        yield* fs.writeFileString(temp, content).pipe(Effect.orDie)
        yield* Effect.tryPromise({
          try: () => rename(temp, full),
          catch: (cause) => new Error(`atomic rename failed for ${name}: ${String(cause)}`),
        }).pipe(Effect.orDie)
      })

    const consolidate: Interface["consolidate"] = Effect.fn("MemoryConsolidation.consolidate")(function* () {
      const opts = MemoryOptions.fromConfig((yield* config.get()).memory)
      if (!opts.generateMemories) return false

      const token = yield* jobs.claimPhase2({ leaseSeconds: 3600, cooldownSeconds: 6 * 60 * 60 })
      if (token === false) return false

      const run = Effect.gen(function* () {
        yield* fs.ensureDir(memoryRoot).pipe(Effect.orDie)
        yield* ensureBaseline(git, memoryRoot)

        const diff = yield* captureDiff(git, memoryRoot)
        const outputs = yield* jobs.stage1Outputs({ limit: opts.maxRawMemoriesForConsolidation })
        if (outputs.length === 0 && diff.changes.length === 0) {
          yield* jobs.finishPhase2({ ownershipToken: token, ok: true })
          return
        }

        const defaultID = yield* provider.defaultModel().pipe(Effect.orDie)
        const agent = yield* agents.get("memorize")
        const model = agent.model
          ? yield* provider.getModel(agent.model.providerID, agent.model.modelID).pipe(Effect.orDie)
          : opts.consolidationModel === undefined
            ? yield* provider.getModel(defaultID.providerID, defaultID.modelID).pipe(Effect.orDie)
            : yield* MemoryShared.resolveModel(opts.consolidationModel, provider).pipe(Effect.orDie)

        const [summary, memory, rawMemories] = yield* Effect.all([
          readFile("memory_summary.md"),
          readFile("MEMORY.md"),
          Effect.succeed(
            outputs
              .map((o) => (o.rawMemory === null || o.rawMemory === "" ? "" : String(o.rawMemory)))
              .filter(Boolean)
              .map((raw) => MemoryRedact.redact(raw))
              .join("\n\n"),
          ),
        ])

        let structured: unknown
        yield* MemoryShared.runStructured({
          llm,
          model,
          agent,
          user: MemoryShared.memoryUser(model, "memorize", MEMORY_SUBSESSION),
          sessionID: MEMORY_SUBSESSION,
          schema: CONSOLIDATION_SCHEMA as unknown as Record<string, any>,
          prompt: [
            "Consolidate the raw memories and workspace changes into the memory files.",
            "Return the result by calling the StructuredOutput tool.",
            "",
            "CURRENT memory_summary.md:",
            "---",
            summary,
            "---",
            "CURRENT MEMORY.md:",
            "---",
            memory,
            "---",
            "NEW raw memories:",
            "---",
            rawMemories,
            "---",
            "WORKSPACE DIFF:",
            "---",
            diff.unifiedDiff,
          ].join("\n"),
          onSuccess(output) {
            structured = output
          },
        })

        if (structured === undefined) {
          yield* jobs.finishPhase2({ ownershipToken: token, ok: false, error: "no structured output" })
          return
        }
        const record = structured as {
          memory_summary?: string
          memory_md?: string
          raw_memories_md?: string
          skills?: Array<{ name?: string; content?: string }>
        }

        yield* writeFile("memory_summary.md", record.memory_summary ?? "")
        yield* writeFile("MEMORY.md", record.memory_md ?? "")
        yield* writeFile("raw_memories.md", record.raw_memories_md ?? "")
        for (const skill of record.skills ?? []) {
          if (skill.name && skill.content) {
            yield* writeFile(`skills/${skill.name}/SKILL.md`, skill.content)
          }
        }

        yield* resetBaseline(git, memoryRoot)
        yield* jobs.finishPhase2({ ownershipToken: token, ok: true })
      })

      yield* run.pipe(
        Effect.catchCause((cause) => {
          const error = Cause.squash(cause)
          return jobs.finishPhase2({ ownershipToken: token, ok: false, error: error instanceof Error ? error.message : String(error) })
        }),
      )
      return true
    })

    return Service.of({ consolidate })
  }),
)

export const defaultLayer = Layer.suspend(() =>
  layer.pipe(
    Layer.provide(Config.defaultLayer),
    Layer.provide(MemoryJobs.defaultLayer),
    Layer.provide(Provider.defaultLayer),
    Layer.provide(Agent.defaultLayer),
    Layer.provide(LLM.defaultLayer),
    Layer.provide(Git.defaultLayer),
    Layer.provide(FSUtil.defaultLayer),
  ),
)

function ensureBaseline(git: Git.Interface, dir: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    const head = yield* git
      .run(["rev-parse", "--verify", "HEAD"], { cwd: dir, maxOutputBytes: 4096 })
      .pipe(Effect.orElseSucceed(emptyResult))
    if (head.exitCode !== 0) {
      yield* git.run(["init", "-q"], { cwd: dir }).pipe(Effect.orDie)
      yield* git.run(["config", "user.email", "memory@loongcode.local"], { cwd: dir }).pipe(Effect.ignore)
      yield* git.run(["config", "user.name", "loongcode memory"], { cwd: dir }).pipe(Effect.ignore)
      yield* git.run(["add", "-A"], { cwd: dir }).pipe(Effect.orDie)
      yield* git.run(["commit", "-q", "-m", "memory baseline"], { cwd: dir }).pipe(Effect.orDie)
    }
  })
}

/**
 * Captures the workspace diff since the baseline, including untracked files.
 * Untracked files are staged first so `git diff` (which ignores them) is
 * combined with `git diff --cached` for a complete picture of manual edits
 * and ad-hoc notes. Nothing is committed here �?the baseline stays put so the
 * next pass still spans last-successful-run -> now.
 */
function captureDiff(git: Git.Interface, dir: string): Effect.Effect<{ changes: string[]; unifiedDiff: string }> {
  return Effect.gen(function* () {
    // Large manual edits must not flood the consolidation prompt — cap the
    // diff the same way the 1h lease caps consolidation runtime.
    const maxOutputBytes = 512 * 1024
    const status = yield* git.run(["status", "--porcelain"], { cwd: dir, maxOutputBytes }).pipe(Effect.orDie)
    const changes = status.text().split("\n").filter(Boolean)
    if (changes.length === 0) return { changes: [], unifiedDiff: "" }

    // Stage everything (tracked edits + untracked additions) without committing.
    yield* git.run(["add", "-A"], { cwd: dir }).pipe(Effect.orDie)

    const stagedDiff = yield* git.run(["diff", "--cached", "--", "."], { cwd: dir, maxOutputBytes }).pipe(Effect.orDie)
    const unstagedDiff = yield* git.run(["diff", "--", "."], { cwd: dir, maxOutputBytes }).pipe(Effect.orDie)
    const truncated = stagedDiff.truncated || unstagedDiff.truncated
    const unifiedDiff = [stagedDiff.text(), unstagedDiff.text()].filter(Boolean).join("\n")
    return {
      changes,
      unifiedDiff: truncated
        ? `${unifiedDiff}\n\n[workspace diff truncated at ${maxOutputBytes} bytes]`
        : unifiedDiff,
    }
  })
}

/** Commits the consolidated workspace. No-op (not an error) when nothing changed. */
function resetBaseline(git: Git.Interface, dir: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    yield* git.run(["add", "-A"], { cwd: dir }).pipe(Effect.orDie)
    const status = yield* git.run(["status", "--porcelain"], { cwd: dir }).pipe(Effect.orDie)
    if (status.text().trim().length === 0) return
    yield* git.run(["commit", "-q", "-m", "memory baseline"], { cwd: dir }).pipe(Effect.orDie)
  })
}

function emptyResult() {
  return { exitCode: 1, text: () => "", stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), truncated: false }
}
