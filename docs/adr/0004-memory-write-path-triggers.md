# Memory write path runs in the host on idle events plus a periodic rescan

Extraction and consolidation are triggered by Session idle events and a first message stamp (mirroring opencode-codex-memory), plus a host-owned periodic rescan fiber (~6h) and a startup scan that prefers the oldest eligible sessions — a capability the plugin deliberately lacks ("no process timer") because plugins cannot keep resident loops. There is no daemon: when no process is alive nothing runs, and that is accepted (local-first philosophy). Durable job state in the global memory database is the source of truth — lost events or killed processes delay memory but never lose it, because eligibility is computed from durable timestamps (`time_updated`) and both phase-1 and phase-2 claims are lease-guarded so hard kills leave no permanently stuck jobs. Phase-2 consolidation serializes across processes via the core Flock heartbeat lease, which reclaims a crashed holder once its heartbeat goes stale.

## Considered Options

- V2 SessionExecution seam: rejected — V2 has no global (non-Session) background work slot; memory learning is not part of Session execution authority.
- Manual CLI command / cron: rejected — breaks the zero-configuration automatic learning that is the feature's core value.
- Synchronous extraction at session end: rejected — LLM extraction cost must never sit on the interactive path.

## Consequences

- Fast-open/fast-close usage patterns delay extraction until a later process window; the 10-day max-age window bounds the loss.
- Extraction and consolidation models are configurable (`extract_model` → small-model fallback, `consolidation_model` → primary model), mirroring codex's cheap-extraction / capable-consolidation split.
