export * as ConfigMemoryV1 from "./memory"

import { Schema } from "effect"

export const Info = Schema.Struct({
  generate_memories: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({ description: "Turn the background memory-learning pipeline on or off" }),
  ),
  use_memories: Schema.optional(Schema.Boolean).pipe(
    Schema.annotate({ description: "Inject the memory summary into the system prompt and expose memory tools" }),
  ),
  extract_model: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Model used for per-session memory extraction (provider/model)" }),
  ),
  consolidation_model: Schema.optional(Schema.String).pipe(
    Schema.annotate({ description: "Model used for memory consolidation (provider/model)" }),
  ),
  min_rollout_idle_hours: Schema.optional(Schema.Number).pipe(
    Schema.annotate({
      description: "How long a session must be idle before it is eligible for extraction (clamped 1-48, default 6h)",
    }),
  ),
  max_rollout_age_days: Schema.optional(Schema.Number).pipe(
    Schema.annotate({
      description: "Ignore sessions older than this many days for extraction (clamped 0-90, default 10)",
    }),
  ),
  max_rollouts_per_startup: Schema.optional(Schema.Number).pipe(
    Schema.annotate({ description: "Max sessions extracted per pass (clamped 1-128, default 2)" }),
  ),
  max_unused_days: Schema.optional(Schema.Number).pipe(
    Schema.annotate({ description: "Prune memories unused for this long (clamped 0-365, default 30)" }),
  ),
  max_raw_memories_for_consolidation: Schema.optional(Schema.Number).pipe(
    Schema.annotate({
      description: "How many raw memories feed each consolidation pass (clamped 1-4096, default 256)",
    }),
  ),
})
export type Info = Schema.Schema.Type<typeof Info>
