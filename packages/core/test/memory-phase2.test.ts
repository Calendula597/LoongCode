import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const layer = (dir: string) => MemoryJobs.layer.pipe(Layer.provide(MemoryDatabase.layerFromPath(dir)))

describe("MemoryJobs phase2", () => {
  it.live("claims, finishes, and enforces cooldown", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          const token = yield* jobs.claimPhase2({ leaseSeconds: 3600, cooldownSeconds: 6 * 60 * 60 })
          expect(token).not.toBe(false)
          // Second claim while running is rejected
          expect(yield* jobs.claimPhase2({ leaseSeconds: 3600, cooldownSeconds: 6 * 60 * 60 })).toBe(false)

          yield* jobs.finishPhase2({ ownershipToken: token as string, ok: true })
          expect((yield* jobs.phase2Status())?.status).toBe("done")

          // Cooldown still active → claim rejected
          expect(yield* jobs.claimPhase2({ leaseSeconds: 3600, cooldownSeconds: 6 * 60 * 60 })).toBe(false)
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )

  it.live("records failures with retry time", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          const token = yield* jobs.claimPhase2({ leaseSeconds: 3600, cooldownSeconds: 6 * 60 * 60 })
          expect(token).not.toBe(false)
          yield* jobs.finishPhase2({ ownershipToken: token as string, ok: false, error: "boom" })
          const status = yield* jobs.phase2Status()
          expect(status?.status).toBe("failed")
          expect(status?.lastError).toBe("boom")
          expect(status?.retryAt).toBeDefined()
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )
})
