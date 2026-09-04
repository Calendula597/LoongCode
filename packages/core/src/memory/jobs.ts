export * as MemoryJobs from "./jobs"

import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import { LayerNode } from "../effect/layer-node"
import { Identifier } from "../util/identifier"
import { MemoryDatabase } from "./database"
import { MemoryTable } from "./sql"

export type Stage1Status = "pending" | "running" | "done" | "failed"

export interface Stage1Output {
  readonly sessionID: string
  readonly rawMemory: unknown
  readonly rolloutSummary: string
  readonly sourceUpdatedAt: number
}

export interface Stage1Completion extends Stage1Output {
  readonly ownershipToken: string
}

export interface ClaimInput {
  readonly sessionID: string
  readonly sourceUpdatedAt: number
  readonly leaseSeconds: number
  readonly inputWatermark?: number
}

export interface Stage1Failure {
  readonly sessionID: string
  readonly ownershipToken: string
  readonly error: string
  readonly retryDelaySeconds: number
}

export interface Interface {
  /** Returns the ownership token on success, or `false` when the claim was lost. */
  readonly claimStage1: (input: ClaimInput) => Effect.Effect<string | false>
  readonly completeStage1: (input: Stage1Completion) => Effect.Effect<void>
  readonly failStage1: (input: Stage1Failure) => Effect.Effect<void>
  readonly stage1Outputs: (input?: { limit?: number }) => Effect.Effect<Stage1Output[]>
  readonly recordUsage: (sessionIDs: string[]) => Effect.Effect<void>
  readonly dbUsage: (sessionID: string) => Effect.Effect<number>
  readonly jobStatus: (sessionID: string) => Effect.Effect<Stage1Status | undefined>
  readonly reclaimStaleStage1: (now: number) => Effect.Effect<number>
  readonly pruneOutputs: (maxUnusedDays: number) => Effect.Effect<number>
  readonly deleteSessionMemory: (sessionID: string) => Effect.Effect<boolean>
  /** Returns the ownership token on success, or `false` when the claim was lost. */
  readonly claimPhase2: (input: { leaseSeconds: number; cooldownSeconds: number }) => Effect.Effect<string | false>
  readonly finishPhase2: (input: { ownershipToken: string; ok: boolean; error?: string }) => Effect.Effect<void>
  readonly phase2Status: () => Effect.Effect<{ status: string; lastError?: string; retryAt?: number } | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/v2/MemoryJobs") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const { db } = yield* MemoryDatabase.Service

    const claimStage1: Interface["claimStage1"] = Effect.fn("MemoryJobs.claimStage1")(function* (input) {
      const now = Date.now()
      const leaseUntil = now + input.leaseSeconds * 1000
      const worker = `mjob_${Identifier.ascending()}`

      // Atomic claim: a single conditional UPDATE acts as compare-and-swap, so
      // two processes racing on the same session cannot both win. A completed
      // job stays done unless the session gained new activity since it was
      // last extracted (sourceUpdatedAt newer than the stored watermark).
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx
            .update(MemoryTable.Stage1JobTable)
            .set({
              status: "running",
              worker_id: worker,
              ownership_token: worker,
              lease_until: leaseUntil,
              started_at: now,
              finished_at: null,
              retry_at: null,
              last_error: null,
              source_updated_at: input.sourceUpdatedAt,
              time_updated: now,
            })
            .where(
              and(
                eq(MemoryTable.Stage1JobTable.session_id, input.sessionID),
                or(
                  ne(MemoryTable.Stage1JobTable.status, "running"),
                  lt(MemoryTable.Stage1JobTable.lease_until, now),
                ),
                or(
                  isNull(MemoryTable.Stage1JobTable.retry_at),
                  lt(MemoryTable.Stage1JobTable.retry_at, now + 1),
                ),
                or(
                  ne(MemoryTable.Stage1JobTable.status, "done"),
                  lt(MemoryTable.Stage1JobTable.source_updated_at, input.sourceUpdatedAt),
                ),
              ),
            )
            .run()
            .pipe(Effect.orDie)
          const changed = yield* tx.get<{ n: number }>(sql`SELECT changes() as n`).pipe(Effect.orDie)
          if ((changed?.n ?? 0) > 0) return worker

          // No row to update — insert a fresh claim. A concurrent insert on the
          // same session hits the unique index; that race is a lost claim, not
          // a defect. onConflictDoNothing swallows the violation, so verify the
          // insert actually landed via changes().
          yield* tx
            .insert(MemoryTable.Stage1JobTable)
            .values({
              id: worker,
              session_id: input.sessionID,
              status: "running",
              worker_id: worker,
              ownership_token: worker,
              lease_until: leaseUntil,
              retry_remaining: 3,
              retry_at: null,
              input_watermark: input.inputWatermark ?? 0,
              source_updated_at: input.sourceUpdatedAt,
              started_at: now,
              finished_at: null,
              last_error: null,
              time_created: now,
              time_updated: now,
            })
            .onConflictDoNothing()
            .run()
            .pipe(Effect.orDie)
          const inserted = yield* tx.get<{ n: number }>(sql`SELECT changes() as n`).pipe(Effect.orDie)
          if ((inserted?.n ?? 0) > 0) return worker
          return false as const
        }),
      ).pipe(Effect.orDie)
    })

    const completeStage1: Interface["completeStage1"] = Effect.fn("MemoryJobs.completeStage1")(function* (input) {
      const now = Date.now()
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          // Ownership-guarded: an expired worker whose lease was reclaimed must
          // not overwrite the newer claim's state — neither the job row nor the
          // extraction output. If the guard updates nothing, the caller lost
          // ownership and the output write is skipped entirely.
          yield* tx
            .update(MemoryTable.Stage1JobTable)
            .set({ status: "done", finished_at: now, retry_at: null, last_error: null, time_updated: now })
            .where(
              and(
                eq(MemoryTable.Stage1JobTable.session_id, input.sessionID),
                eq(MemoryTable.Stage1JobTable.ownership_token, input.ownershipToken),
              ),
            )
            .run()
          const claimed = yield* tx.get<{ n: number }>(sql`SELECT changes() as n`).pipe(Effect.orDie)
          if ((claimed?.n ?? 0) === 0) return
          const existingOutput = yield* tx
            .select()
            .from(MemoryTable.Stage1OutputTable)
            .where(eq(MemoryTable.Stage1OutputTable.session_id, input.sessionID))
            .get()
            .pipe(Effect.orDie)
          if (existingOutput) {
            yield* tx
              .update(MemoryTable.Stage1OutputTable)
              .set({
                raw_memory: input.rawMemory,
                rollout_summary: input.rolloutSummary,
                source_updated_at: input.sourceUpdatedAt,
                time_updated: now,
              })
              .where(eq(MemoryTable.Stage1OutputTable.session_id, input.sessionID))
              .run()
          } else {
            yield* tx
              .insert(MemoryTable.Stage1OutputTable)
              .values({
                id: `mout_${Identifier.ascending()}`,
                session_id: input.sessionID,
                raw_memory: input.rawMemory,
                rollout_summary: input.rolloutSummary,
                source_updated_at: input.sourceUpdatedAt,
                usage_count: 0,
                last_usage: null,
                time_created: now,
                time_updated: now,
              })
              .run()
          }
        }),
      ).pipe(Effect.orDie)
    })

    const failStage1: Interface["failStage1"] = Effect.fn("MemoryJobs.failStage1")(function* (input) {
      const now = Date.now()
      const row = yield* db
        .select()
        .from(MemoryTable.Stage1JobTable)
        .where(eq(MemoryTable.Stage1JobTable.session_id, input.sessionID))
        .get()
        .pipe(Effect.orDie)
      if (!row) return
      const remaining = Math.max(0, row.retry_remaining - 1)
      const retryAt = input.retryDelaySeconds * 1000 + now
      yield* db
        .update(MemoryTable.Stage1JobTable)
        .set({
          status: remaining > 0 ? "pending" : "failed",
          retry_remaining: remaining,
          retry_at: remaining > 0 ? retryAt : null,
          finished_at: now,
          last_error: input.error,
          lease_until: null,
          time_updated: now,
        })
        .where(
          and(
            eq(MemoryTable.Stage1JobTable.session_id, input.sessionID),
            eq(MemoryTable.Stage1JobTable.ownership_token, input.ownershipToken),
          ),
        )
        .run()
        .pipe(Effect.orDie)
    })

    const stage1Outputs: Interface["stage1Outputs"] = Effect.fn("MemoryJobs.stage1Outputs")(function* (input = {}) {
      const rows = yield* db
        .select()
        .from(MemoryTable.Stage1OutputTable)
        .orderBy(desc(MemoryTable.Stage1OutputTable.source_updated_at))
        .limit(input.limit ?? 256)
        .all()
        .pipe(Effect.orDie)
      return rows.map((row) => ({
        sessionID: row.session_id,
        rawMemory: row.raw_memory,
        rolloutSummary: row.rollout_summary ?? "",
        sourceUpdatedAt: row.source_updated_at,
      }))
    })

    const recordUsage: Interface["recordUsage"] = Effect.fn("MemoryJobs.recordUsage")(function* (sessionIDs) {
      const now = Date.now()
      for (const sessionID of sessionIDs) {
        // Atomic increment: a SELECT-then-SET loses counts when sessions with
        // citations complete concurrently.
        yield* db
          .insert(MemoryTable.CitationTable)
          .values({ session_id: sessionID, usage_count: 1, last_usage: now, time_created: now, time_updated: now })
          .onConflictDoUpdate({
            target: MemoryTable.CitationTable.session_id,
            set: {
              usage_count: sql`${MemoryTable.CitationTable.usage_count} + 1`,
              last_usage: now,
              time_updated: now,
            },
          })
          .run()
          .pipe(Effect.orDie)
      }
    })

    const dbUsage: Interface["dbUsage"] = Effect.fn("MemoryJobs.dbUsage")(function* (sessionID) {
      const row = yield* db
        .select({ usage_count: MemoryTable.CitationTable.usage_count })
        .from(MemoryTable.CitationTable)
        .where(eq(MemoryTable.CitationTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      return row?.usage_count ?? 0
    })

    const jobStatus: Interface["jobStatus"] = Effect.fn("MemoryJobs.jobStatus")(function* (sessionID) {
      const row = yield* db
        .select({ status: MemoryTable.Stage1JobTable.status })
        .from(MemoryTable.Stage1JobTable)
        .where(eq(MemoryTable.Stage1JobTable.session_id, sessionID))
        .get()
        .pipe(Effect.orDie)
      return row?.status as Stage1Status | undefined
    })

    const reclaimStaleStage1: Interface["reclaimStaleStage1"] = Effect.fn("MemoryJobs.reclaimStaleStage1")(function* (
      now,
    ) {
      const stale = yield* db
        .select()
        .from(MemoryTable.Stage1JobTable)
        .where(and(eq(MemoryTable.Stage1JobTable.status, "running"), lt(MemoryTable.Stage1JobTable.lease_until, now)))
        .all()
        .pipe(Effect.orDie)
      for (const row of stale) {
        yield* db
          .update(MemoryTable.Stage1JobTable)
          .set({
            status: "pending",
            lease_until: null,
            worker_id: null,
            ownership_token: null,
            time_updated: now,
          })
          .where(eq(MemoryTable.Stage1JobTable.id, row.id))
          .run()
          .pipe(Effect.orDie)
      }
      return stale.length
    })

    const pruneOutputs: Interface["pruneOutputs"] = Effect.fn("MemoryJobs.pruneOutputs")(function* (maxUnusedDays) {
      const cutoff = Date.now() - maxUnusedDays * 24 * 60 * 60 * 1000
      const stale = yield* db
        .select()
        .from(MemoryTable.Stage1OutputTable)
        .where(
          or(
            lt(MemoryTable.Stage1OutputTable.time_updated, cutoff),
            lt(MemoryTable.Stage1OutputTable.time_created, cutoff),
          ),
        )
        .all()
        .pipe(Effect.orDie)
      for (const row of stale) {
        yield* db
          .delete(MemoryTable.Stage1OutputTable)
          .where(eq(MemoryTable.Stage1OutputTable.session_id, row.session_id))
          .run()
          .pipe(Effect.orDie)
      }
      return stale.length
    })

    const deleteSessionMemory: Interface["deleteSessionMemory"] = Effect.fn("MemoryJobs.deleteSessionMemory")(
      function* (sessionID) {
        const job = yield* db
          .select()
          .from(MemoryTable.Stage1JobTable)
          .where(eq(MemoryTable.Stage1JobTable.session_id, sessionID))
          .get()
          .pipe(Effect.orDie)
        if (!job) return false
        yield* db
          .delete(MemoryTable.Stage1JobTable)
          .where(eq(MemoryTable.Stage1JobTable.session_id, sessionID))
          .run()
          .pipe(Effect.orDie)
        yield* db
          .delete(MemoryTable.Stage1OutputTable)
          .where(eq(MemoryTable.Stage1OutputTable.session_id, sessionID))
          .run()
          .pipe(Effect.orDie)
        return true
      },
    )

    const claimPhase2: Interface["claimPhase2"] = Effect.fn("MemoryJobs.claimPhase2")(function* (input) {
      const now = Date.now()
      const leaseUntil = now + input.leaseSeconds * 1000
      const worker = `p2_${Identifier.ascending()}`

      // Atomic CAS claim (see claimStage1). Cooldown after a clean success is
      // enforced in the same conditional UPDATE, so a racing pair of processes
      // cannot both pass the read-check-then-write gap.
      return yield* db.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx
            .update(MemoryTable.Phase2JobTable)
            .set({
              status: "running",
              worker_id: worker,
              ownership_token: worker,
              lease_until: leaseUntil,
              started_at: now,
              finished_at: null,
              retry_at: null,
              last_error: null,
              time_updated: now,
            })
            .where(
              and(
                eq(MemoryTable.Phase2JobTable.job_key, "global"),
                or(
                  ne(MemoryTable.Phase2JobTable.status, "running"),
                  lt(MemoryTable.Phase2JobTable.lease_until, now),
                ),
                or(isNull(MemoryTable.Phase2JobTable.retry_at), lt(MemoryTable.Phase2JobTable.retry_at, now)),
                or(
                  ne(MemoryTable.Phase2JobTable.status, "done"),
                  isNull(MemoryTable.Phase2JobTable.finished_at),
                  lt(MemoryTable.Phase2JobTable.finished_at, now - input.cooldownSeconds * 1000),
                ),
              ),
            )
            .run()
            .pipe(Effect.orDie)
          const changed = yield* tx.get<{ n: number }>(sql`SELECT changes() as n`).pipe(Effect.orDie)
          if ((changed?.n ?? 0) > 0) return worker

          // No existing row — insert the global claim. onConflictDoNothing
          // swallows a concurrent insert's unique violation, so verify via
          // changes() rather than assuming success.
          yield* tx
            .insert(MemoryTable.Phase2JobTable)
            .values({
              job_key: "global",
              status: "running",
              worker_id: worker,
              ownership_token: worker,
              lease_until: leaseUntil,
              retry_remaining: 3,
              started_at: now,
              finished_at: null,
              last_error: null,
              time_created: now,
              time_updated: now,
            })
            .onConflictDoNothing()
            .run()
            .pipe(Effect.orDie)
          const inserted = yield* tx.get<{ n: number }>(sql`SELECT changes() as n`).pipe(Effect.orDie)
          if ((inserted?.n ?? 0) > 0) return worker
          return false as const
        }),
      ).pipe(Effect.orDie)
    })

    const finishPhase2: Interface["finishPhase2"] = Effect.fn("MemoryJobs.finishPhase2")(function* (input) {
      const now = Date.now()
      yield* db
        .update(MemoryTable.Phase2JobTable)
        .set({
          status: input.ok ? "done" : "failed",
          finished_at: now,
          retry_at: input.ok ? null : now + 3600 * 1000,
          last_error: input.ok ? null : (input.error ?? "phase2 failed"),
          lease_until: null,
          time_updated: now,
        })
        .where(
          and(
            eq(MemoryTable.Phase2JobTable.job_key, "global"),
            eq(MemoryTable.Phase2JobTable.ownership_token, input.ownershipToken),
          ),
        )
        .run()
        .pipe(Effect.orDie)
    })

    const phase2Status: Interface["phase2Status"] = Effect.fn("MemoryJobs.phase2Status")(function* () {
      const row = yield* db
        .select()
        .from(MemoryTable.Phase2JobTable)
        .where(eq(MemoryTable.Phase2JobTable.job_key, "global"))
        .get()
        .pipe(Effect.orDie)
      if (!row) return undefined
      return {
        status: row.status,
        ...(row.last_error ? { lastError: row.last_error } : {}),
        ...(row.retry_at !== null ? { retryAt: row.retry_at } : {}),
      }
    })

    return Service.of({
      claimStage1,
      completeStage1,
      failStage1,
      stage1Outputs,
      recordUsage,
      dbUsage,
      jobStatus,
      reclaimStaleStage1,
      pruneOutputs,
      deleteSessionMemory,
      claimPhase2,
      finishPhase2,
      phase2Status,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(MemoryDatabase.defaultLayer))
export const node = LayerNode.make(layer, [MemoryDatabase.node])
