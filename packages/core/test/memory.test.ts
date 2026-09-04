import path from "path"
import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { sql } from "drizzle-orm"
import { ConfigMemoryV1 } from "@loongcode/core/v1/config/memory"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const decode = Schema.decodeSync(ConfigMemoryV1.Info)

describe("ConfigMemoryV1", () => {
  test("decodes a full memory config section", () => {
    const info = decode({
      generate_memories: false,
      use_memories: true,
      min_rollout_idle_hours: 2,
      max_rollouts_per_startup: 5,
    })
    expect(info.generate_memories).toBe(false)
    expect(info.use_memories).toBe(true)
    expect(info.min_rollout_idle_hours).toBe(2)
    expect(info.max_rollouts_per_startup).toBe(5)
  })

  test("decodes an empty memory section to undefined defaults", () => {
    const info = decode({})
    expect(info.generate_memories).toBeUndefined()
    expect(info.use_memories).toBeUndefined()
  })
})

describe("MemoryOptions", () => {
  test("returns disabled options when no memory section exists", () => {
    const opts = MemoryOptions.fromConfig(undefined)
    expect(opts.generateMemories).toBe(false)
    expect(opts.useMemories).toBe(false)
  })

  test("applies defaults for an empty section", () => {
    const opts = MemoryOptions.fromConfig(decode({}))
    expect(opts.generateMemories).toBe(true)
    expect(opts.useMemories).toBe(true)
    expect(opts.minRolloutIdleHours).toBe(6)
    expect(opts.maxRolloutAgeDays).toBe(10)
    expect(opts.maxRolloutsPerStartup).toBe(2)
    expect(opts.maxUnusedDays).toBe(30)
    expect(opts.maxRawMemoriesForConsolidation).toBe(256)
  })

  test("clamps values to codex ranges", () => {
    const opts = MemoryOptions.fromConfig(
      decode({
        min_rollout_idle_hours: 999,
        max_rollout_age_days: -5,
        max_rollouts_per_startup: 0,
      }),
    )
    expect(opts.minRolloutIdleHours).toBe(48)
    expect(opts.maxRolloutAgeDays).toBe(0)
    expect(opts.maxRolloutsPerStartup).toBe(1)
  })

  test("falls back on non-finite numbers", () => {
    const opts = MemoryOptions.fromConfig(
      decode({ min_rollout_idle_hours: Number.NaN }),
    )
    expect(opts.minRolloutIdleHours).toBe(6)
  })
})

describe("MemoryDatabase", () => {
  it.live("bootstraps memory tables and applies migrations", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const memory = yield* MemoryDatabase.Service
          const tables = yield* memory.db.all<{ name: string }>(
            sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'memory_%'`,
          )
          const names = tables.map((t) => t.name).toSorted()
          expect(names).toEqual([
            "memory_citations",
            "memory_phase2_job",
            "memory_stage1_jobs",
            "memory_stage1_outputs",
          ])
          const migrationCount = yield* memory.db.get<{ count: number }>(
            sql`SELECT COUNT(*) as count FROM migration`,
          )
          expect(Number(migrationCount?.count)).toBeGreaterThan(0)
        }).pipe(
          Effect.provide(
            MemoryDatabase.layerFromPath(path.join(tmp.path, "memory", "memory.db")),
          ),
        ),
      ),
    ),
  )
})
