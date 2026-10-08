# Handoff — TDAI Identity (experimental) implementation

## Mission

Implement the experimental TDAI integration in the LoongCode repo (`d:\workplace\local\LoongCode`): let users configure a TDAI MemoryProxy connection once (URL, API key, model list) plus a list of header-overlay identities ("agents"), each selectable in the model picker like an LLM, with identity headers injected verbatim into requests. Zero TDAI-side changes.

## Read these first (all decisions are captured there — do not re-derive)

1. **Spec**: `specs/tdai-identity.md` — problem, 17 user stories, implementation decisions (config schema, catalog synthesis seam, epoch semantics, settings surface), testing decisions, out of scope.
2. **ADR**: `docs/adr/0005-tdai-identity-header-overlay.md` — why per-identity verbatim headers instead of a TDAI-side switch API; rejected alternatives.
3. **Glossary**: `CONTEXT.md` § "TDAI Integration (experimental)" — canonical terms: **TDAI Identity**, **Identity Switch**, **Proxy Session Key**, **TDAI Task Binding**. Use this vocabulary in code/comments; UI copy says "agents". Note the deliberate distinction from LoongCode agents.
4. **Tickets** (work these in frontier order): `.scratch/tdai-identity/issues/`
   - `01-config-schema-catalog-synthesis.md` — **start here, no blockers**
   - `02-identity-selection-header-injection.md` — blocked by 01
   - `03-panel-tdai-settings-item.md` — blocked by 01, can parallel 02

## Key context not in the artifacts

- **Primary seam (agreed)**: a core plugin on the `catalog.transform` hook synthesizes one provider per agent (`tdai/<agentKey>`), built from the shared openai-compatible connection with `request.headers` = the agent's header set. Enumeration, per-Session selection state (`ModelKey {providerID, modelID}`), and the request path need **no changes** — headers ride the existing static `ProviderV2.Info.request.headers` → `LLMRequestPrep` pipeline.
- **Open verification point (ticket 02)**: whether Context Epoch keying compares raw providerID or effective api/model. If providerID, identity switches would spuriously replace epochs — adjust to compare effective api/model.
- **Explored seam map** (from prior codebase exploration, trust but verify):
  - Catalog: `packages/core/src/catalog.ts` (`Catalog.Service`, `Catalog.Editor.provider.update`); providers served via `packages/loongcode/src/server/routes/instance/httpapi/handlers/config.ts`; UI consumes via `packages/app/src/hooks/use-providers.ts` + `packages/app/src/context/models.tsx`.
  - Headers flow: config `options.headers` → `ConfigProviderOptionsV1.Lowerer` → `ProviderV2.Info.request.headers` → `packages/loongcode/src/session/llm/request.ts` (`LLMRequestPrep.prepare`, per-request). The TDAI feature uses the static path only — no `chat.headers` hook.
  - Settings UI pattern: `packages/app/src/components/dialog-custom-provider-form.ts` (row-based headers/models editing) + `global.config.update` mutation (`packages/app/src/context/server-sync.tsx`); server side `GlobalHttpApi.configUpdate` in `packages/loongcode/src/server/routes/instance/httpapi/handlers/global.ts`.
  - Selection state: app `packages/app/src/context/local.tsx` (`ModelKey`), TUI `packages/tui/src/context/local.tsx` (`model.json`).
- **Real-world reference config** (what users hand-roll today, to be replaced by this feature): two near-identical `@ai-sdk/openai-compatible` provider entries differing only in headers `x-team-id` / `x-agent-id` / `x-task-id` / `x-conversation-id`, model list: deepseek-v4-flash, glm-5.3-flash, glm-5.3, kimi-k3. (Credentials intentionally omitted — get them from the user if needed for manual verification.)
- **TDAI side (read-only reference)**: `D:\workplace\local\TencentDB-Agent-Memory` — `MemoryProxy` honors preset identity headers (`src/session/preset.ts`: `x-team-id`/`x-agent-id`/`x-task-id`) and derives its session id from `x-conversation-id` et al. (`src/identity.ts`). Do not modify anything in that repo.

## Constraints & conventions

- Repo rules in `AGENTS.md`: Effect patterns, module self-export shape, no barrels in multi-sibling dirs, config modules follow the `export * as ConfigX from "./x"` pattern.
- Run tests/typecheck from package dirs (`packages/core`, `packages/loongcode`, `packages/app`), never repo root; `bun typecheck`, not raw `tsc`.
- Branch: short hyphenated name ≤3 words (e.g. `tdai-identity`), base branch is `dev` (not main). Conventional commits (`feat(core): …`).
- Avoid mocks; test external behavior at the seams named in the tickets.
- v1 explicitly excludes: identity validation against TDAI metadata, model pinning per agent, slash-command/model-tool switching, dynamic header injection, UI test automation.

## Suggested skills

- `executing-plans` or `subagent-driven-development` — to work tickets 01→02/03 with checkpoints.
- `test-driven-development` — tickets carry acceptance criteria suited to red-green at the catalog seam.
- `verification-before-completion` — before claiming any ticket done (bun typecheck + package-local tests).
- `requesting-code-review` — before merging.
- If requirements seem to drift: `grilling` + `domain-modeling` (keep CONTEXT.md / ADR updated in lockstep, as was done throughout design).

## State of artifacts

Spec, ADR 0005, CONTEXT.md, and all three tickets are current and mutually consistent as of this handoff. Nothing has been implemented yet; the only repo changes so far are those documents themselves (uncommitted — check `git status` and commit them first if appropriate, e.g. `docs: add tdai identity spec, adr and tickets`).
