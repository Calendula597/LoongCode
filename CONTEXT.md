# Loongcode Session Runtime

Loongcode sessions preserve durable conversational history while assembling the runtime context an agent needs to act correctly in its current environment.

## Language

**System Context**:
The structured collection of contextual facts presented to the model as initial instructions and chronological updates.
_Avoid_: System prompt

**Session History**:
The projected chronological conversation selected for a provider turn after applying the active compaction and **Context Epoch** cutoffs.
_Avoid_: Session Context

**Context Source**:
One independently observed typed value within the **System Context**, represented by a stable key, JSON codec, infallible loader, pure baseline/update renderers, and an optional removal renderer for dynamic sources.
_Avoid_: Prompt fragment

**System Context Registry**:
The Location-scoped registry of ordered, scoped producers that contribute to the current **System Context**.

**Mid-Conversation System Message**:
A durable chronological instruction that tells the model the newly effective state of a changed **Context Source**.
_Avoid_: System update, system notification, raw text diff

**Context Epoch**:
The span during which one effective agent's initially rendered **System Context** remains immutable, ending at compaction or another baseline-replacing transition.

**Baseline System Context**:
The full **System Context** rendered at the start of a **Context Epoch**.
_Avoid_: Live system prompt

**Context Snapshot**:
The overwriteable model-hidden JSON state used to compare each **Context Source** with the value last admitted to a provider turn.

**Unavailable Context**:
An expected temporary inability to observe a **Context Source** value; the runtime retains its prior effective state and emits no update, or omits it until first successfully loaded.

**Safe Provider-Turn Boundary**:
The point immediately before a provider call, after durable input promotion and any required tool settlement, where context changes may be admitted chronologically.

**Model Tool Output**:
The bounded projection of a Core-executed tool result persisted in Session history and replayed to the model. A tool may shape this projection semantically, but the Tool Registry enforces the final size limit.

**Managed Tool Output File**:
A temporary file created under Loongcode's shared tool-output directory to retain complete output that was too large for Session history.

**Model Request Options**:
Provider-semantic model settings selected from the Catalog and active Session variant before the LLM protocol adapter encodes them for a provider request.
_Avoid_: Request body, wire options

**Generation Controls**:
Provider-neutral sampling and output controls, partitioned from provider semantics and compatibility wire fields when model metadata enters the Catalog.

**PTY Environment**:
The host-supplied environment overlay applied by the server when creating a PTY, observed for the request Location and resolved PTY working directory.

### Memory

**Memory**:
The durable, user-scoped knowledge distilled from past Sessions and carried into future ones.
_Avoid_: Knowledge base, long-term store

**Memory Workspace**:
The single user-level directory of plain Markdown files, with a Git baseline, that holds the human-readable Memory.
_Avoid_: Memory store, memory folder

**Memory Summary**:
The bounded compact rendering of Memory contributed to the System Context.
_Avoid_: Memory prompt, summary injection

**Extraction**:
The per-Session background job that distills one sufficiently idle, finished Session into a raw memory note and a rollout summary.
_Avoid_: Session learning, phase 1

**Consolidation**:
The globally serialized background job that rewrites the Memory Workspace from ranked Extraction notes.
_Avoid_: Memory merge, phase 2

**Memory Citation**:
A model-emitted marker reporting which Session-sourced memories a reply used; recorded as usage and stripped before persistence.
_Avoid_: Citation tag, feedback marker

**Memory Sub-Agent**:
A sandboxed restricted agent (`memorize`, `memorize-extract`) that performs Extraction or Consolidation model work outside user Sessions.

### TDAI Integration (experimental)

**TDAI Identity**:
A named header-set overlay on the shared TDAI connection (e.g. `x-team-id`/`x-agent-id`/`x-task-id`/`x-conversation-id`), carrying no LoongCode-level prompt, permission, model binding, or credentials of its own. It namespaces memory attribution on the TDAI side and is not a LoongCode agent.
_Avoid_: Persona, role, sub-agent

**TDAI Task Binding**:
The task scoping headers (`x-team-id` + `x-task-id`) carried by a **TDAI Identity**, consumed read-only by LoongCode; task lifecycle is managed on TDAI.

**Identity Switch**:
The mid-Session change of the active **TDAI Identity**, surfaced as sub-entries of the base provider in the model picker, taking effect at the next provider turn.
_Avoid_: Agent switch (reserved for LoongCode agents)

**Proxy Session Key**:
The session id header (e.g. `x-conversation-id`) a **TDAI Identity** presents to the TDAI MemoryProxy, so each identity appears as a distinct proxy-side session under the same **TDAI Task Binding**.

## Relationships

- A **System Context** is an opaque carrier composed from zero or more **Context Sources**.
- **Session History** contains projected conversational messages and admitted **Mid-Conversation System Messages**; the active **Baseline System Context** remains separate provider-request state.
- The **System Context Registry** uses stable-keyed scoped contributions to assemble the current **System Context**; contributor removal naturally removes its sources at the next **Safe Provider-Turn Boundary**.
- A changed **Context Source** may produce one **Mid-Conversation System Message** containing its newly effective state.
- A **Mid-Conversation System Message** persists the exact combined rendered text sent to the model.
- The current **Context Snapshot** advances atomically with the corresponding durable **Mid-Conversation System Message**.
- A **Context Snapshot** stores one codec-encoded JSON value and, for removable dynamic sources, a pre-rendered removal message per stable **Context Source** key.
- Changes from multiple **Context Sources** admitted at one safe boundary combine into one **Mid-Conversation System Message**.
- Context changes are sampled and admitted lazily at a **Safe Provider-Turn Boundary**, never pushed asynchronously when their source changes.
- At a **Safe Provider-Turn Boundary**, newly promoted user input or settled tool results precede any combined **Mid-Conversation System Message**.
- The first provider turn renders the latest complete **Baseline System Context** and initializes its **Context Snapshot** without emitting a redundant **Mid-Conversation System Message**; unavailable initial context blocks the turn instead of persisting an incomplete baseline.
- Initial **System Context** preparation precedes the first durable input promotion so an unavailable baseline leaves that input pending and retryable; ordinary reconciliation remains after promotion.
- Compaction starts a new **Context Epoch** with a freshly rendered **Baseline System Context** and **Context Snapshot**; prior **Mid-Conversation System Messages** remain durable audit history but leave projected model history.
- A newly registered core or plugin-defined **Context Source** absent from the current snapshot emits its baseline rendering once at the next **Safe Provider-Turn Boundary**.
- **Context Source** keys are stable and namespaced; duplicate keys fail composition. `SystemContext.combine(...)` preserves caller order; the **System Context Registry** evaluates producers concurrently and combines them in stable contribution-key order so rendered context remains deterministic.
- Each **Context Source** loader returns one coherent typed value. `SystemContext.make(...)` hides that value type so differently typed sources compose uniformly. Its codec compares and stores that value; its pure renderers produce model-visible baseline, update, and removal text only when needed.
- `SystemContext.initialize(...)` observes a composed **System Context** once and produces a fresh **Baseline System Context** with its **Context Snapshot**.
- `SystemContext.reconcile(...)` observes a composed **System Context** once and returns exactly one next action: unchanged, updated, replacement ready, or replacement blocked.
- `SystemContext.replace(...)` represents an explicit baseline-replacing transition such as compaction or model/provider switch; it either produces a fresh generation or reports that replacement is blocked by unavailable admitted context.
- Context Epoch preparation retries until stable after optimistic revision mismatches so concurrent replacement requests cannot terminate an otherwise valid safe-boundary run.
- **Unavailable Context** uses stale-while-revalidate semantics and is distinct from a successfully loaded absence, which may emit removal text.
- Ordinary **Context Source** loaders return values directly; loaders that intentionally use stale-while-revalidate may explicitly return **Unavailable Context**.
- Nested project instruction discovery after successful reads remains a follow-up; when implemented, discovered instructions must be admitted durably at the next **Safe Provider-Turn Boundary**.
- Location-scoped services naturally re-resolve effective context when a moved session next runs in its destination location.
- Moving a Session clears its active **Context Epoch**, so the destination must initialize a complete baseline before another prompt can promote.
- Context Epoch initialization is fenced against the authoritative Session Location, so an old-Location runner cannot recreate source context after a concurrent move.
- Instruction discovery, source identity, persistence, and file loading belong to the instruction service; the **System Context** abstraction only composes effectful producers and renders loaded values.
- The first instruction-service slice observes global and upward project `AGENTS.md` files as one ordered aggregate **Context Source** at each **Safe Provider-Turn Boundary**.
- Built-in and instruction context producers register through the **System Context Registry** with stable contribution keys. Plugin-defined context registration and hot-reload lifecycle remain a follow-up built on the same scoped registry seam.
- Selected-agent available-skill guidance is a **Context Source** composed with Location-wide registry sources immediately before Context Epoch admission. It lists only names and descriptions permitted for that agent; skill bodies and locations are exposed only through the permission-checked `skill` tool.
- Switching the selected agent requests **Context Epoch** replacement. A switch admitted after the current **Safe Provider-Turn Boundary** applies to the next provider turn while leaving the already-prepared baseline durable. Epoch creation is fenced against the authoritative effective agent, and retries re-observe the current agent.
- A cross-agent replacement must complete before another provider turn; unavailable admitted context blocks that replacement instead of exposing the previous agent's privileged baseline.
- Local tool authorization and pending permission requests retain the effective agent of the provider turn that issued the call; a later agent switch cannot change that call's policy.
- Context source changes never wake idle sessions; the next naturally scheduled **Safe Provider-Turn Boundary** loads and compares current values lazily.
- Once admitted, a **Mid-Conversation System Message** remains durable even if the following provider attempt fails and is replayed unchanged on retry.
- **Mid-Conversation System Messages** remain durable Session-message history; normal user-facing transcript surfaces may hide them.
- The date **Context Source** initially preserves host-local calendar-date behavior; a configured user timezone may replace that default later.
- A **Context Epoch** begins with one immutable **Baseline System Context**.
- A **Context Epoch** durably records the effective agent that owns its **Baseline System Context**.
- A **Baseline System Context** is stored durably and reused verbatim across process restarts within its **Context Epoch**.
- A **Baseline System Context** durably preserves the exact joined text used for the active provider-cache prefix.
- Compaction or a model/provider switch starts a new **Context Epoch** because the baseline can be replaced without preserving the prior provider cache.
- A model/provider switch always starts a new **Context Epoch** while preserving chronological conversation history.
- **Model Request Options** remain provider-semantic through Catalog resolution. The Session runner maps them into the LLM package's provider-option namespace; the selected protocol adapter alone owns provider wire encoding.
- **Generation Controls**, protocol-semantic **Model Request Options**, and compatibility request body fields are separate Catalog domains. A shared ingestion adapter partitions legacy and models.dev AI-SDK-shaped options before routing.
- The **PTY Environment** is a server concern rather than a Core PTY concern. PTY creation merges caller values, then the host overlay, then Core-forced terminal invariants such as `TERM` and `LOONGCODE_TERMINAL`.
- A **PTY Environment** adapter observes plugins in the request Location while passing the resolved PTY working directory to the hook; standalone servers use an empty adapter.
- A **Mid-Conversation System Message** lowers to the provider's native chronological instruction role when supported and to a wrapped chronological fallback otherwise.
- When the effective aggregate instruction set changes, its **Mid-Conversation System Message** includes the complete current ordered set and supersedes the prior aggregate value; when no ambient instructions remain, the message states that previously loaded instructions no longer apply.
- Ambient project instruction discovery honors `LOONGCODE_DISABLE_PROJECT_CONFIG`; global instructions remain eligible.
- Oversized textual **Model Tool Output** retains a bounded preview in Session history while its complete text moves to managed tool-output storage. Arbitrary structured-result size is a separate concern.
- One tool settlement receives one aggregate textual limit, using the configured maximum lines or UTF-8 bytes, whichever is reached first. The limit is provider-independent; token pressure belongs to context assembly and compaction.
- Generic truncation preserves the beginning and end of textual output. Tools may apply a more meaningful strategy before the Tool Registry enforces the final limit.
- A truncated **Model Tool Output** identifies its complete text both in the bounded model-visible preview and as a typed managed output path. Managed output paths do not modify the tool's validated structured result.
- A **Managed Tool Output File** is temporary and may expire after its retention period. The bounded **Model Tool Output**, not the file, is the durable replayable record.
- Failure to retain a **Managed Tool Output File** does not change a successful tool operation into a failed one. The Session records an explicitly lossy bounded output without a path, while operators receive diagnostics for the storage failure.
- Once a tool operation succeeds, bounding its **Model Tool Output** and publishing its one durable settlement form an interruption-safe completion region. Raw oversized success is never published before a later correction.
- When a structured-only result would exceed the **Model Tool Output** limit, its validated structured value remains unchanged for Session consumers while model replay uses a bounded textual JSON preview and optional managed output path.
- Existing tool-managed output paths survive generic bounding. A fallback file retains exactly the complete projected text received by the Tool Registry and never claims to reconstruct output already discarded by tool-specific shaping.
- **Managed Tool Output Files** use globally unique names in one shared flat directory. Their absolute paths are readable and searchable by ordinary tools; other absolute paths remain outside Location-scoped filesystem authority.
- Provider-executed tool results remain provider-native transcript facts outside generic Tool Registry bounding. Their context control requires provider-aware pruning or compaction because some providers require exact structured round-trip payloads.

### Memory

- Memory is **global**: one user-scoped store with no per-project, per-Location, or per-workspace partitioning in storage, read path, or job scheduling. Projects appear only as soft labels within memory content.
- Location scoping constrains execution authority only (which process may load memory files), never memory content or visibility.
- The **Memory Summary** is a **Context Source** under a stable key (e.g. `memory/summary`); it enters the **Baseline System Context** at epoch start and changes surface as one **Mid-Conversation System Message** at the next **Safe Provider-Turn Boundary**.
- Memory changes never wake idle sessions and never replace an epoch by themselves.
- The read path lives in the V2 core (Context Source + Tool Registry tools); the write path lives in the host (background jobs over `llm.stream`), because memory learning is not part of Session execution authority.
- A Session becomes eligible for **Extraction** only after its last activity is older than the idle threshold (default 6h) and newer than the max age window (default 10 days); eligibility is computed from durable timestamps, never from live process state.
- Discovery runs at host startup (oldest eligible first), on Session idle events, and on a periodic rescan; event loss never loses memory — durable job state in the global memory database is the source of truth.
- **Consolidation** is serialized across processes by a heartbeat lease (Flock); a crashed holder is reclaimed after its lease goes stale.
- Extraction and Consolidation claims are lease-guarded so hard process kills leave no permanently stuck jobs.
- The memory database is one global SQLite file under the user-level data directory, separate from any per-Location session database; Session discovery and transcript reads query the host Session tables directly.
- `generate_memories` and `use_memories` are independent behavior switches; neither deletes data. Absence of the `memory` config section is the master off switch. Explicit reset is the only destructive operation.
- A **Memory Citation** is parsed and stripped before the text part is persisted; usage is recorded per cited Session, deduplicated per part, and **Memory Sub-Agent** sessions are exempt so consolidation cannot cite itself.
- Unused memories age out of the Memory Workspace after the configured window (default 30 days); usage-driven pruning is the only forgetting mechanism.

### TDAI Integration (experimental)

- The TDAI MemoryProxy connection (URL, API key, hand-configured model list) is declared once in a dedicated **TDAI (beta)** settings surface under `experimental.tdai`; **TDAI Identities** inherit it wholesale and add only their header set — a new identity never requires a provider entry.
- A **TDAI Identity** is a pure header overlay: it never pins a model. Model selection stays free across the configured model list, and an **Identity Switch** alone does not replace the **Context Epoch**; an accompanying model change follows the ordinary model-switch rule.
- Only **TDAI Identities** surface in the model picker (one entry each, switched like an LLM); no bare header-less TDAI entry exists, so the proxy never falls back to its interactive form flow. The settings UI may label identities "agents" within the TDAI (beta) surface, but they remain distinct from LoongCode agents.
- LoongCode injects the active identity's headers (task scoping plus **Proxy Session Key**) verbatim on requests to the base provider; all memory capture, recall injection, and LLM routing behind the proxy are TDAI's concern.
- Memory recall visibility follows the active **TDAI Identity** only; reads never span identities within the same task.
- LoongCode's own Memory pipeline (Extraction/Consolidation) is unaffected and coexists independently.
- Experimental v1 performs no identity validation: any header values are accepted, and task-agent linking is never written by LoongCode.

## Example dialogue

> **Dev:** "The date changed while the session was active. Should the **Mid-Conversation System Message** say what the old date was?"
> **Domain expert:** "No. Emit the newly effective date so the agent can act on the current **System Context**."

## Flagged ambiguities

- Legacy `experimental.chat.system.transform` can mutate the assembled baseline system prompt arbitrarily, but V2 plugins do not yet expose an equivalent hook. Decide separately whether to port it, replace dynamic uses with plugin-defined **Context Sources**, or narrow its semantics.
