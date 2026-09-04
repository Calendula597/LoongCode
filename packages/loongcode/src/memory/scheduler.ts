export * as MemoryScheduler from "./scheduler"

import { Context, Duration, Effect, Layer, Ref, Schedule, Scope } from "effect"
import { Config } from "@/config/config"
import { MemoryOptions } from "@loongcode/core/memory/options"
import { SessionStatus } from "@/session/status"
import { EventV2Bridge } from "@/event-v2-bridge"

export interface Interface {
  readonly kick: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/MemoryScheduler") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const events = yield* EventV2Bridge.Service
    // The service's own long-lived scope: kicked fibers are children of it, so
    // they outlive the publishing fiber and die with the scheduler.
    const serviceScope = yield* Scope.Scope

    // In-flight guard: overlapping idle events and the rescan fiber would
    // otherwise each build the pipeline and race the discovery scan. The CAS
    // claims keep correctness; this just avoids wasted work.
    const inFlight = yield* Ref.make(false)

    const kick: Interface["kick"] = Effect.fn("MemoryScheduler.kick")(function* () {
      const busy = yield* Ref.modify(inFlight, (current) => {
        if (current) return [true, current]
        return [false, true]
      })
      if (busy) return
      const released = Ref.set(inFlight, false)
      try {
        const opts = MemoryOptions.fromConfig((yield* config.get()).memory)
        if (!opts.generateMemories) return
        // Lazy-load the write pipeline so a config without a `memory` section
        // never instantiates the heavy LLM/Agent/Session/Git dependency chain.
        const { MemoryExtraction } = yield* Effect.promise(() => import("./extraction"))
        const { MemoryConsolidation } = yield* Effect.promise(() => import("./consolidation"))
        const { MemoryJobs } = yield* Effect.promise(() => import("@loongcode/core/memory/jobs"))
        const pipeline = Layer.mergeAll(
          MemoryExtraction.defaultLayer,
          MemoryConsolidation.defaultLayer,
          MemoryJobs.defaultLayer,
        )
        yield* Effect.scoped(
          Layer.build(pipeline).pipe(
            Effect.flatMap((env) =>
              Effect.gen(function* () {
                const extraction = yield* MemoryExtraction.Service.pipe(Effect.provide(env))
                const consolidation = yield* MemoryConsolidation.Service.pipe(Effect.provide(env))
                const jobs = yield* MemoryJobs.Service.pipe(Effect.provide(env))
                const candidates = yield* extraction.discover({
                  minIdleHours: opts.minRolloutIdleHours,
                  maxAgeDays: opts.maxRolloutAgeDays,
                  limit: opts.maxRolloutsPerStartup,
                })
                for (const sessionID of candidates) {
                  yield* extraction.extract(sessionID).pipe(Effect.ignore)
                }
                yield* consolidation.consolidate().pipe(Effect.ignore)
                // Forgetting is part of the loop: prune extraction outputs that
                // outlived max_unused_days (usage-driven expiry, CONTEXT.md).
                yield* jobs.pruneOutputs(opts.maxUnusedDays).pipe(Effect.ignore)
              }),
            ),
          ),
        )
      } finally {
        yield* released
      }
    })

    const unsubscribe = yield* events.listen((event) => {
      if (event.type !== SessionStatus.Event.Idle.type) return Effect.void
      // The event bus runs listeners inline on the publisher fiber — the
      // session's own finish path. The pipeline takes minutes; it must run on
      // an independent fiber.
      return Effect.forkIn(serviceScope)(kick().pipe(Effect.ignore)).pipe(Effect.asVoid)
    })

    yield* Effect.addFinalizer(() => unsubscribe)

    // Periodic rescan fiber: catch sessions that missed the idle event.
    yield* Effect.forkScoped(
      kick().pipe(
        Effect.repeat(Schedule.fixed(Duration.hours(6))),
        Effect.ignore,
      ),
    )

    return Service.of({ kick })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Config.defaultLayer),
  Layer.provide(EventV2Bridge.defaultLayer),
)
