# Memory is a V2 core first-class feature read through a Context Source

LoongCode embeds the codex-derived two-phase memory system (extraction → consolidation → injection → citation feedback, ported from opencode-codex-memory) as a first-class V2 core feature rather than a plugin. The read path registers the Memory Summary as a Context Source (`memory/summary`) in the System Context Registry, so cache-stable epoch-level injection and mid-conversation updates come from the existing Context Epoch machinery for free — this also resolves the flagged ambiguity about replacing `experimental.chat.system.transform` dynamic uses with Context Sources. The write path (extraction/consolidation background jobs) lives in the host package because it needs `llm.stream`, the provider stack, and the event bus — V2 core stays provider-free; memory's "citizenship" is in how it enters context, not where the pipeline runs.

## Considered Options

- Bundled plugin (opencode-codex-memory's own shape): rejected because the V1 plugin hook seam cannot participate in epoch lifecycle — it forces the every-turn byte-identical append workaround (upstream D1) and can never emit a durable mid-conversation system message.
- Host-side built-in feature outside core: rejected because the injection seam would then bypass the System Context Registry.

## Consequences

- Plugin-defined Context Source registration remains a follow-up; memory does not wait for it because it lives in core.
- Absence of the `memory` config section is the master off switch; `generate_memories`/`use_memories` switch behavior only and never delete data.
