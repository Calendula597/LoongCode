# Memory is global with no per-project partitioning

Memory uses one user-scoped global store — one memory SQLite database plus one Markdown memory workspace under the user-level data directory — with no storage, read-path, or job-level partitioning by project, Location, or workspace. This mirrors the upstream codex design invariant exactly: codex deliberately removed per-project memory scoping in early 2026, and the port rejects re-adding it. Location scoping constrains execution authority only (which process may load the files), never memory content. Session discovery and transcript reads query the host Session tables across per-Location databases directly, rather than going through an HTTP API like the plugin had to.

## Considered Options

- Per-Location stores: rejected — the most valuable memories ("prefers table-driven tests") belong to no project, monorepo/worktree boundaries are undrawable, and per-scope stores each consolidate over a thinner slice of evidence.
- Global store with per-Location read-path filtering: rejected as covert partitioning — it breaks cache-stable injection (different content per Location) and reintroduces the scoping the design removes.

## Consequences

- Unrelated projects' details can surface in the summary; accepted as the cost of cross-project transfer.
- Consolidation requires cross-process serialization (Flock heartbeat lease), since any host instance may claim it.
- The global memory database lives next to the memory workspace, separate from per-directory session databases; backup/reset treats the pair as one unit.
