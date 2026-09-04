import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { MemoryJobs } from "@loongcode/core/memory/jobs"
import { MemoryDatabase } from "@loongcode/core/memory/database"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const layer = (dir: string) => MemoryJobs.layer.pipe(Layer.provide(MemoryDatabase.layerFromPath(dir)))

describe("MemoryJobs", () => {
  it.live("claims, completes, and reports stage-1 jobs", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          const token = yield* jobs.claimStage1({
            sessionID: "ses_test1",
            sourceUpdatedAt: Date.now(),
            leaseSeconds: 60,
          })
          expect(token).not.toBe(false)
          expect(yield* jobs.jobStatus("ses_test1")).toBe("running")

          // A second claim while running is rejected
          expect(
            yield* jobs.claimStage1({ sessionID: "ses_test1", sourceUpdatedAt: Date.now(), leaseSeconds: 60 }),
          ).toBe(false)

          yield* jobs.completeStage1({
            sessionID: "ses_test1",
            ownershipToken: token as string,
            rawMemory: { note: "user prefers bun" },
            rolloutSummary: "Learned bun preference",
            sourceUpdatedAt: Date.now(),
          })
          expect(yield* jobs.jobStatus("ses_test1")).toBe("done")
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )

  it.live("does not re-claim completed sessions without new activity", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          const token = yield* jobs.claimStage1({ sessionID: "ses_done", sourceUpdatedAt: 1, leaseSeconds: 60 })
          expect(token).not.toBe(false)
          yield* jobs.completeStage1({
            sessionID: "ses_done",
            ownershipToken: token as string,
            rawMemory: {},
            rolloutSummary: "",
            sourceUpdatedAt: 1,
          })
          // Same sourceUpdatedAt → no new activity → rejected
          expect(yield* jobs.claimStage1({ sessionID: "ses_done", sourceUpdatedAt: 1, leaseSeconds: 60 })).toBe(false)
          // Newer sourceUpdatedAt → session gained activity → re-claimed
          expect(yield* jobs.claimStage1({ sessionID: "ses_done", sourceUpdatedAt: 2, leaseSeconds: 60 })).not.toBe(
            false,
          )
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )

  it.live("fails with bounded retries then marks failed", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          const token = yield* jobs.claimStage1({ sessionID: "ses_fail", sourceUpdatedAt: 1, leaseSeconds: 60 })
          expect(token).not.toBe(false)
          yield* jobs.failStage1({
            sessionID: "ses_fail",
            ownershipToken: token as string,
            error: "boom",
            retryDelaySeconds: 0,
          })
          // retryDelaySeconds 0 → retry_at in past → immediately reclaimable
          const retryToken = yield* jobs.claimStage1({
            sessionID: "ses_fail",
            sourceUpdatedAt: 1,
            leaseSeconds: 60,
          })
          expect(retryToken).not.toBe(false)
          yield* jobs.failStage1({
            sessionID: "ses_fail",
            ownershipToken: retryToken as string,
            error: "boom",
            retryDelaySeconds: 0,
          })
          const thirdToken = yield* jobs.claimStage1({
            sessionID: "ses_fail",
            sourceUpdatedAt: 1,
            leaseSeconds: 60,
          })
          expect(thirdToken).not.toBe(false)
          yield* jobs.failStage1({
            sessionID: "ses_fail",
            ownershipToken: thirdToken as string,
            error: "boom",
            retryDelaySeconds: 0,
          })
          expect(yield* jobs.jobStatus("ses_fail")).toBe("failed")
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )

  it.live("reclaims stale running jobs after lease expiry", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          yield* jobs.claimStage1({ sessionID: "ses_stale", sourceUpdatedAt: 1, leaseSeconds: -1 })
          const reclaimed = yield* jobs.reclaimStaleStage1(Date.now())
          expect(reclaimed).toBe(1)
          expect(
            yield* jobs.claimStage1({ sessionID: "ses_stale", sourceUpdatedAt: 1, leaseSeconds: 60 }),
          ).not.toBe(false)
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )

  it.live("records and increments citation usage", () =>
    Effect.acquireRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ).pipe(
      Effect.flatMap((tmp) =>
        Effect.gen(function* () {
          const jobs = yield* MemoryJobs.Service
          yield* jobs.recordUsage(["ses_used"])
          const count = yield* jobs.dbUsage("ses_used")
          expect(count).toBe(1)
          yield* jobs.recordUsage(["ses_used"])
          expect(yield* jobs.dbUsage("ses_used")).toBe(2)
        }).pipe(Effect.provide(layer(path.join(tmp.path, "memory.db")))),
      ),
    ),
  )
})
