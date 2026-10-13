# TDAI Identity — experimental header-overlay identities on one base provider

Status: ready-for-agent
ADRs: [0005-tdai-identity-header-overlay](../docs/adr/0005-tdai-identity-header-overlay.md)
Glossary: [CONTEXT.md](../CONTEXT.md) § TDAI Integration (experimental)

## Problem Statement

Today, routing LoongCode traffic through the TDAI MemoryProxy requires one full provider config entry per TDAI agent identity. Each entry duplicates `baseURL`, `apiKey`, and the entire model list, differing only in four identity headers (`x-team-id` / `x-agent-id` / `x-task-id` / `x-conversation-id`). Switching identity means hand-editing JSON to add another near-identical provider block, then picking it in the model picker. This is tedious, error-prone, and scales linearly with the number of identities a task needs.

## Solution

Introduce a dedicated **TDAI (beta)** settings surface holding the MemoryProxy connection — URL, API key, and a hand-configured model list — plus a list of **TDAI Identities** (labeled "agents" in the UI), each declaring only its name and header set (team/agent/task ids plus its own `x-conversation-id`). Everything lives in global config under `experimental.tdai`; no generic provider entries are involved. Only identities surface in the model picker — one entry each, switched exactly like switching an LLM — and selecting one routes requests through the shared connection with that identity's headers injected verbatim. Models remain freely switchable across the configured list, an identity switch alone never replaces the **Context Epoch**, and no bare header-less entry exists (so the proxy never falls back to its interactive form flow). Everything behind the proxy (memory capture, recall injection, LLM routing) remains TDAI's concern.

## User Stories

1. As a LoongCode user with TDAI access, I want a dedicated TDAI (beta) settings item where I enter the proxy URL and API key once, so that I never create or duplicate generic provider entries.
2. As a user, I want to hand-configure the model list in the same settings item, so that the available models match what my proxy actually serves.
3. As a user, I want to add a new identity (agent) in the settings by filling in only a name and its team/agent/task ids, so that creating an identity takes seconds without hand-editing JSON.
4. As a user, I want identities to appear as individual entries in the model picker — switched exactly like switching an LLM — so that the experience needs no new UI concepts.
5. As a user, I want to switch identity mid-conversation by picking a different entry, so that one Session can act under multiple TDAI agent identities within the same task.
6. As a user, I want to switch models freely after selecting an identity, so that identity choice never constrains model choice.
7. As a user, I want identity headers injected verbatim into requests, so that behavior matches my current hand-rolled provider entries exactly.
8. As a user, I want each identity to carry its own `x-conversation-id` (Proxy Session Key), so that the proxy registers each identity as a distinct session without any TDAI-side changes.
9. As a user, I want my identity selection persisted per Session like any model selection, so that restarting or resuming the Session keeps the identity.
10. As a user, I want an identity switch that keeps the same model to not invalidate my provider cache prefix (no Context Epoch replacement), so that switching identities mid-task is cheap.
11. As a user, I want a model change accompanying an identity switch to follow the ordinary model-switch rule, so that behavior stays predictable.
12. As a user, I want no bare header-less TDAI entry in the picker, so that I can never accidentally route a request that triggers the proxy's interactive form flow.
13. As a user, I want to edit or delete identities in the panel later, so that header typos are fixable without finding the config file.
14. As a user, I want LoongCode's own Memory pipeline to keep working untouched alongside TDAI, so that enabling the experiment never regresses existing behavior.
15. As a user without TDAI config, I want LoongCode to behave exactly as before, so that the experiment is invisible unless opted in.
16. As a TUI user, I want identities selectable in the TUI model picker too, so that the feature is not Desktop-only.
17. As a team admin, I want the whole TDAI configuration stored in global config (panel-editable), so that it can also be provisioned by managed config where needed.

## Implementation Decisions

- **Config schema**: new optional `experimental.tdai` section in `ConfigV1.Info` (schema lives with the other v1 config modules), self-contained — no generic provider entry is involved:
  ```jsonc
  {
    "experimental": {
      "tdai": {
        "url": "http://…/codebuddy/default/v1",
        "apiKey": "sk-mem-…",
        "models": ["deepseek-v4-flash", "glm-5.3-flash", "glm-5.3", "kimi-k3"],
        "agents": {
          "main": {
            "name": "TDAI main",
            "headers": {
              "x-team-id": "team-…",
              "x-agent-id": "agt-…",
              "x-task-id": "task-…",
              "x-conversation-id": "loongcode-main"
            }
          }
        }
      }
    }
  }
  ```
  `headers` is an arbitrary string map (no fixed key set — v1 validates nothing). Absence of the section disables the feature entirely (master off switch, mirroring the `memory` config convention). `url`/`apiKey`/`models` are required when any agent is defined; incomplete config disables the feature with a warning (fail soft).
- **Single primary seam — Catalog synthesis**: a core plugin hooking `catalog.transform` reads `experimental.tdai` and registers one synthetic provider per agent (`Catalog.Editor.provider.update`), built from the shared connection (openai-compatible api shape, url/apiKey, one catalog model per configured model name) with `request.headers` set to the agent's header set. Synthetic provider ids are namespaced (e.g. `tdai/<agentKey>`); display names surface as-is in pickers. No changes to model enumeration, selection state, or the request path — headers flow through the existing static `ProviderV2.Info.request.headers` → `LLMRequestPrep` pipeline. No bare header-less provider is registered.
- **Selection state**: unchanged. App stores `ModelKey { providerID, modelID }` per Session; the synthetic providerID makes identity selection durable per Session for free. TUI's `model.json` key format works as-is since synthetic providers are ordinary catalog entries.
- **Epoch semantics**: identity switch with unchanged model does not start a new **Context Epoch** (all synthetic providers share the same api shape). A simultaneous model change follows the existing model/provider-switch rule. Confirm during implementation that epoch keying compares the effective api/model, not the raw providerID string — if it compares providerID, identity switches would spuriously replace epochs and this must be adjusted.
- **Settings surface**: a dedicated **TDAI (beta)** item in Desktop/app settings — fields for URL, API key, model list (add/remove rows), and an agents list (name + header rows, with the four conventional header keys prefilled) — reusing the custom-provider-form row-editing pattern and writing via the existing `global.config.update` mutation (deep-merge patch, JSONC-preserving, triggers instance reload via the existing dispose broadcast). UI copy says "agents"; code and docs say **TDAI Identity**.
- **No dynamic injection**: identity headers are static config. No `chat.headers` hook, no per-request state lookup. If a future need arises (e.g. per-Session conversation ids), that becomes a separate decision.
- **Zero TDAI-side changes**: the proxy's existing preset-identity header path auto-registers each identity's header set as a distinct session.
- **Agent key charset**: agent keys must not contain `/`. Synthetic provider ids are the only provider ids containing `/`, so string-form model references (`provider/model`, used by `session.command`, config `model`/`small_model`, agent and command `model` overrides, CLI `--model`) rely on the `tdai/` prefix rule: `parseModel` (loongcode and the TUI copy) splits the provider id as the first two segments after the prefix and the model id as the rest. `TDAI.expand` fail-soft skips agent keys containing `/` with a warning, keeping the string format unambiguous. Catalog-aware parsing or a structured model reference would lift this constraint; that remains a separate decision.

## Testing Decisions

- Good tests here assert external behavior: given a config with `experimental.tdai` agents, the catalog exposes one synthetic provider per agent with the configured model list and the agent's headers on `request.headers`; given no config, the catalog is untouched. Do not test internal cloning mechanics.
- **Catalog synthesis** (core): unit tests at the catalog seam — existing prior art in catalog/plugin transform tests (`packages/core` catalog tests and plugin-driven provider registration tests). Cases: agent registered with the configured model list and its headers on `request.headers`; incomplete connection config (missing url/apiKey/models) → feature disabled + warning; config absent → no-op; config reload → agents update.
- **Config schema** (core): schema decode round-trip tests following the existing v1 config module test pattern (see `ConfigAgentV1` / `ConfigMemoryV1` style).
- **Header flow**: one integration-level assertion that a synthetic provider's `request.headers` survive into `LLMRequestPrep.prepare` output (existing request-prep tests are the prior art), proving verbatim injection without mocking the network.
- Panel editor: manual verification only for v1 (consistent with how custom-provider-form evolved); no new UI test harness in this spec.
- Run tests from package dirs (`packages/core`, `packages/loongcode`), never repo root; typecheck via `bun typecheck` in package dirs.

## Out of Scope

- Identity validation against TDAI metadata (agent exists, same team, auto `linkTaskAgent`) — documented follow-up; v1 accepts any header values.
- Model pinning per identity (identities never constrain the model list).
- A model-tool or slash command for identity switching (the model picker is the only switch surface in v1).
- Any TDAI/MemoryProxy/MemoryCore/MemoryPanel changes.
- Per-Session or computed Proxy Session Keys (e.g. `<sessionID>:<agentID>`) — headers are verbatim config.
- Migrating existing duplicated provider entries into base+identities form (users do this by hand once).
- Memory recall visibility semantics on the TDAI side (per-identity isolation is TDAI's own behavior, not LoongCode's).

## Further Notes

- Domain vocabulary (TDAI Identity, Identity Switch, Proxy Session Key, TDAI Task Binding) is defined in CONTEXT.md and should be used in code comments and UI copy.
- Known consequence (recorded in ADR 0005): two LoongCode Sessions using the same identity share one proxy-side session — memory continuity by design; give identities distinct `x-conversation-id` values to avoid it.
- If the experiment graduates, the documented follow-ups are: TDAI-metadata validation + auto-link, a proper proxy-side switch-identity API to collapse the per-identity session fan-out, and optional dynamic header injection.
