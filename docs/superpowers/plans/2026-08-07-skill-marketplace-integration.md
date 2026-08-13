# Skill Marketplace Integration Plan

> Integrating CC-Switch's Skill repository management and marketplace UI capabilities into LoongCode.

## Decision Summary

| # | Decision | Choice |
|---|----------|--------|
| 1 | Integration scope | GitHub repo sources + ZIP/tarball discovery + Marketplace UI |
| 2 | Frontend target | Both Web App (`packages/app`) and TUI (`packages/tui`) |
| 3 | Architecture | Independent `SkillMarketplace` layer; installed skills re-enter existing `SkillV2` as `DirectorySource` |
| 4 | Persistence | Write to `loongcode.jsonc` `skills` config array |
| 5 | Config write-back | New `ConfigWriter` service extending `Config.Interface` |
| 6 | Archive extraction | GitHub tarball (`.tar.gz`) + Bun native `gunzipSync` |
| 7 | SkillHub | Keep as default source, change from "pull all" to on-demand metadata listing |
| 8 | GitHub repos | Addable as optional user-configured sources |
| 9 | Metadata for SkillHub | Download `SKILL.md` per skill to extract `name`/`description` |
| 10 | API design | 6 new REST endpoints under `/api/skill/` |

---

## Current State (What Exists)

### LoongCode Skill Pipeline

```
loongcode.jsonc (skills: ["path", "url"])
    │
    ▼
discoverSkills() orchestrator  ─── packages/loongcode/src/skill/index.ts
    ├── ~/.claude/skills/**/SKILL.md
    ├── ~/.agents/skills/**/SKILL.md
    ├── .loongcode/skills/**/SKILL.md
    ├── config skills.paths[]  ──→ local dirs, scan SKILL.md
    ├── config skills.urls[]   ──→ index.json protocol, download files
    └── SkillHub.pullAll()      ──→ REST API, download ALL files for ALL skills
    │
    ▼
Skill.Service (state: {skills: Record<name, Info>})
    │
    ├── SkillGuidance  ──→ SystemContext (available_skills list in model context)
    └── SkillTool      ──→ loads skill content on model request
```

### Key Files

| File | Role |
|------|------|
| [packages/core/src/skill.ts](file:///D:/workplace/local/LoongCode/packages/core/src/skill.ts) | `SkillV2` core: `Source` union, `Info` schema, `Service` with `list()`/`load()` |
| [packages/core/src/skill/discovery.ts](file:///D:/workplace/local/LoongCode/packages/core/src/skill/discovery.ts) | `SkillDiscovery`: URL → `index.json` → file download |
| [packages/core/src/skill/guidance.ts](file:///D:/workplace/local/LoongCode/packages/core/src/skill/guidance.ts) | `SkillGuidance`: available skills in System Context |
| [packages/core/src/tool/skill.ts](file:///D:/workplace/local/LoongCode/packages/core/src/tool/skill.ts) | `SkillTool`: model-callable skill loader |
| [packages/loongcode/src/skill/index.ts](file:///D:/workplace/local/LoongCode/packages/loongcode/src/skill/index.ts) | `Skill.Service`: orchestrator, scans all sources |
| [packages/loongcode/src/skill/skillhub.ts](file:///D:/workplace/local/LoongCode/packages/loongcode/src/skill/skillhub.ts) | `SkillHub`: REST API client for `skillhub.lgdg.cc` |
| [packages/loongcode/src/skill/discovery.ts](file:///D:/workplace/local/LoongCode/packages/loongcode/src/skill/discovery.ts) | `Discovery`: `index.json` protocol client |
| [packages/core/src/config.ts](file:///D:/workplace/local/LoongCode/packages/core/src/config.ts) | `Config.Service`: read-only config discovery + parse |
| [packages/core/src/global.ts](file:///D:/workplace/local/LoongCode/packages/core/src/global.ts) | `Global.Service`: paths (`data`, `cache`, `repos`, etc.) |
| [packages/tui/src/component/dialog-skill.tsx](file:///D:/workplace/local/LoongCode/packages/tui/src/component/dialog-skill.tsx) | TUI skill selection dialog |
| [packages/sdk/openapi.json](file:///D:/workplace/local/LoongCode/packages/sdk/openapi.json) | OpenAPI spec → auto-generated JS SDK |

### CC-Switch Reference Architecture

| CC-Switch Component | What It Does |
|---------------------|--------------|
| `RepoManagerPanel.tsx` | Add/remove GitHub repos by URL |
| `SkillCard.tsx` | Skill card with install/uninstall |
| `SkillsPage.tsx` | Full marketplace page with search/filter |
| `skill.rs` (commands) | Tauri commands: add_repo, discover, install |
| `skill.rs` (services) | ZIP download, scan SKILL.md, install to SSOT |
| `skills.rs` (DAO) | SQLite tables: skill_repos, installed_skills |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (Web App + TUI)                     │
│  ┌──────────────────────┐    ┌───────────────────────────────────┐  │
│  │ Web App Marketplace  │    │ TUI Skill Manager (lightweight)   │  │
│  │ - Skill card grid    │    │ - List + search                   │  │
│  │ - Search/filter       │    │ - Install/uninstall               │  │
│  │ - Repo manager panel  │    │ - Repo add/remove                 │  │
│  │ - Install/uninstall   │    └───────────────────────────────────┘  │
│  └──────────┬───────────┘                    │                        │
└─────────────┼────────────────────────────────┼──────────────────────┘
              │ SDK (auto-generated)            │
              ▼                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        HTTP API (OpenAPI)                            │
│  GET    /api/skill/marketplace    → list discoverable skills         │
│  POST   /api/skill/marketplace/install  → install a skill            │
│  DELETE /api/skill/marketplace/install  → uninstall a skill         │
│  GET    /api/skill/repos          → list GitHub repo sources         │
│  POST   /api/skill/repos          → add GitHub repo source           │
│  DELETE /api/skill/repos          → remove GitHub repo source        │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   SkillMarketplace.Service                           │
│                   (packages/loongcode/src/skill/marketplace.ts)      │
│                                                                      │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ SkillHub Adapter│  │ GitHub Repo       │  │ ConfigWriter       │ │
│  │ (metadata only) │  │ Adapter           │  │ (write skills[])   │ │
│  │                 │  │ (tarball + scan)  │  │                    │ │
│  │ list()          │  │ list(repo)        │  │ write(key, value)  │ │
│  │ install(ns,slug)│  │ install(repo,name)│  │                    │ │
│  └────────┬────────┘  └────────┬─────────┘  └────────┬───────────┘ │
│           │                    │                      │             │
│           ▼                    ▼                      ▼             │
│  GET /api/web/skills   github.com/.../tar.gz    loongcode.jsonc      │
│  download SKILL.md     extract + scan          jsonc-parser + Flock │
│  (metadata only)       (metadata only)         (persist paths)      │
└──────────────────────────────────────────────────────────────────────┘
                           │
                           ▼ (installed skill path written to config)
┌──────────────────────────────────────────────────────────────────────┐
│                   Existing Skill Pipeline (unchanged)               │
│  discoverSkills() → scan skills.paths[] → Skill.Service             │
│  → SkillGuidance → SkillTool                                         │
│  (installed skills appear as local DirectorySource entries)         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Backend Core

#### Task 1: `ConfigWriter` Service
**Location:** `packages/core/src/config/writer.ts`

New service extending `Config.Interface` with a `write` method.

```ts
export * as ConfigWriter from "./writer"

import path from "path"
import { Context, Effect, Layer } from "effect"
import { Flock } from "../util/flock"
import { FSUtil } from "../fs-util"
import { Global } from "../global"
import { Config } from "../config"
import { parse, modify, stringify } from "jsonc-parser"

export interface Interface extends Config.Interface {
  readonly write: (key: string, value: unknown) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/v2/ConfigWriter") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const global = yield* Global.Service

    const write = Effect.fn("ConfigWriter.write")(function* (key: string, value: unknown) {
      const entries = yield* config.entries()
      const doc = entries.findLast((entry) => entry.type === "document" && entry.info[key] !== undefined)
        ?? entries.find((entry) => entry.type === "document")
      if (!doc || !doc.path) return

      yield* Flock.withLock(doc.path, function* () {
        const text = yield* fs.readFileStringSafe(doc.path!)
        const errors: ParseError[] = []
        const ast = parse(text, errors, { allowTrailingComma: true })
        const modified = modify(ast, [key], value)
        yield* fs.writeString(doc.path!, stringify(modified))
      })
    })

    // Delegate read methods to Config.Service
    const entries = config.entries
    return Service.of({ entries, write })
  }),
)
```

**Key dependencies:** `jsonc-parser` (already in project), `Flock` (already in project), `Config.Service`

**Config module export:** Add to `packages/core/src/config/index.ts`:
```ts
export * as ConfigWriter from "./writer"
```

#### Task 2: `SkillMarketplace` Service
**Location:** `packages/loongcode/src/skill/marketplace.ts`

Orchestrates SkillHub and GitHub repo sources for browsing and installing.

**Responsibilities:**
- `list()`: Aggregate metadata from SkillHub + all configured GitHub repos
- `install(source, name)`: Download files to `global.data/skills/{name}/`, write path to config `skills.paths`
- `uninstall(name)`: Remove from config `skills.paths`, optionally delete local files
- `repos()`: List configured GitHub repos from config `skills.urls` (filter for GitHub URLs)
- `addRepo(url)`: Parse GitHub URL → write to config `skills.urls`
- `removeRepo(url)`: Remove from config `skills.urls`

**SkillHub adapter (metadata only):**
- Call `GET /api/web/skills?page=0&size=100` (fix pagination later)
- For each item: download only `SKILL.md` → parse frontmatter → return `{name, description, namespace, slug, source: "skillhub"}`
- Cache metadata in memory (refresh on demand)

**GitHub repo adapter (tarball scan):**
- Download `https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.tar.gz`
- Extract with `Bun.gunzipSync` + tar stream parsing
- Scan for `SKILL.md` files recursively
- Parse frontmatter → return `{name, description, repo, source: "github"}`
- Do NOT persist the extracted files; only extract metadata

**Install flow (both sources):**
1. Download files to `global.data/skills/{name}/` (SkillHub: API file download; GitHub: extract from tarball)
2. Call `ConfigWriter.write("skills", [...currentPaths, newLocalPath])`
3. The existing `discoverSkills` orchestrator picks up the new path on next scan

**Schema:**
```ts
export const DiscoverableSkill = Schema.Struct({
  name: Schema.String,
  description: Schema.String.pipe(Schema.optional),
  source: Schema.Literal("skillhub", "github"),
  // SkillHub-specific
  namespace: Schema.String.pipe(Schema.optional),
  slug: Schema.String.pipe(Schema.optional),
  // GitHub-specific
  repo: Schema.String.pipe(Schema.optional),  // owner/name
  installed: Schema.Boolean,                  // computed from config skills.paths
})
```

#### Task 3: Modify `discoverSkills` Orchestrator
**Location:** `packages/loongcode/src/skill/index.ts`

- Remove `skillhub.pullAll()` call from startup
- Instead, SkillHub skills are only loaded if their path exists in `config.skills.paths` (i.e., user installed them)
- The existing `config.skills.paths` scan already handles this — installed SkillHub skills will be found by their local path

**Change:** In `discoverSkills()`, remove the block:
```ts
// REMOVE THIS:
if (!disableExternalSkills) {
  const skillhubDirs = yield* skillhub.pullAll()
  for (const dir of skillhubDirs) {
    yield* scan(state, dir, SKILL_PATTERN)
  }
}
```

Installed SkillHub skills are already in `config.skills.paths` → already scanned by the existing `cfg.skills?.paths` loop.

#### Task 4: API Routes
**Location:** Add to OpenAPI spec (`packages/sdk/openapi.json`) + server route handlers

New endpoints:

```
GET    /api/skill/marketplace         → SkillMarketplace.list()
POST   /api/skill/marketplace/install → SkillMarketplace.install()
DELETE /api/skill/marketplace/install → SkillMarketplace.uninstall()
GET    /api/skill/repos               → SkillMarketplace.repos()
POST   /api/skill/repos               → SkillMarketplace.addRepo()
DELETE /api/skill/repos               → SkillMarketplace.removeRepo()
```

After adding routes to OpenAPI spec, regenerate SDK:
```bash
./packages/sdk/js/script/build.ts
```

#### Task 5: Tarball Download + Extract Utility
**Location:** `packages/loongcode/src/skill/tarball.ts`

```ts
// Download GitHub tarball, extract to temp dir, return directory paths containing SKILL.md
export function downloadAndScan(repo: { owner: string, name: string, branch: string }): Effect.Effect<string[]>
```

Implementation:
- HTTP GET `https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.tar.gz`
- `Bun.gunzipSync(body)` to decompress
- Parse tar stream (use `tar-stream` npm package or manual tar header parsing)
- Extract to `global.cache/skills/github/{owner}-{name}-{branch}/`
- Glob for `**/SKILL.md` → return matching directories

**Security (from CC-Switch patterns + existing LoongCode patterns):**
- Validate owner/name/branch are safe segments (`isSafeSegment` from existing `discovery.ts`)
- Check `FSUtil.contains(extractRoot, targetPath)` for path traversal prevention
- Limit extraction size (zip bomb protection)
- GitHub archive URLs always match `github.com/{owner}/{repo}/archive/...` pattern

### Phase 2: Web App Marketplace UI

#### Task 6: SkillsPage Component
**Location:** `packages/app/src/pages/skills.tsx`

Port CC-Switch's `SkillsPage.tsx` to SolidJS (LoongCode's frontend framework).

**Components:**
- `SkillsPage` — main page with tabs: "Marketplace" | "Installed" | "Repos"
- `SkillCard` — card showing name, description, source badge, install/uninstall button
- `RepoManagerPanel` — add/remove GitHub repo URLs
- `SearchBar` — filter by name/description

**Data fetching:** Use auto-generated SDK client:
```ts
const client = createLgcodeClient()
const skills = await client.v2.skill.marketplace()  // or similar
```

#### Task 7: TUI Skill Manager
**Location:** `packages/tui/src/component/dialog-skill-marketplace.tsx`

Lightweight TUI dialog extending the existing `dialog-skill.tsx` pattern.

**Features:**
- List discoverable skills (name + description)
- Search/filter
- Install/uninstall
- Repo add/remove (simpler than Web App)

Uses `DialogSelect` pattern from existing `dialog-skill.tsx`.

### Phase 3: Integration & Polish

#### Task 8: Default GitHub Repos
On first launch (when `skills` config is empty), optionally inject default repos:
- `anthropics/skills`
- `ComposioHQ/awesome-claude-skills`

This can be done in the `SkillMarketplace` layer initialization.

#### Task 9: Regenerate SDK
After all API routes are defined:
```bash
./packages/sdk/js/script/build.ts
```

#### Task 10: Tests
**Location:** `packages/loongcode/test/skill/marketplace.test.ts`

- Test SkillHub adapter metadata extraction
- Test GitHub repo tarball download + scan
- Test install/uninstall lifecycle (config write-back)
- Test ConfigWriter service

---

## Data Flow Summary

### Browse Skills
```
User opens Marketplace UI
  → GET /api/skill/marketplace
  → SkillMarketplace.list()
    → SkillHub adapter: GET /api/web/skills, download SKILL.md per skill, parse frontmatter
    → GitHub repo adapter: download tarball per repo, scan SKILL.md, parse frontmatter
    → Merge + deduplicate by name
    → Mark installed = true if name exists in config skills.paths
  ← Return DiscoverableSkill[]
```

### Install a Skill
```
User clicks "Install" on a SkillCard
  → POST /api/skill/marketplace/install { source, name, namespace?, slug?, repo? }
  → SkillMarketplace.install()
    → If SkillHub: download all files via API to global.data/skills/{name}/
    → If GitHub: extract skill directory from cached tarball to global.data/skills/{name}/
    → ConfigWriter.write("skills", [...currentPaths, newLocalPath])
  → Config persisted, skill available on next discoverSkills() scan
  ← Return success
```

### Uninstall a Skill
```
User clicks "Uninstall"
  → DELETE /api/skill/marketplace/install { name }
  → SkillMarketplace.uninstall()
    → Read current skills.paths from config
    → Filter out the path for this skill
    → ConfigWriter.write("skills", filteredPaths)
    → Optionally delete local directory
  ← Return success
```

### Add GitHub Repo Source
```
User enters "https://github.com/anthropics/skills" in RepoManagerPanel
  → POST /api/skill/repos { url }
  → SkillMarketplace.addRepo()
    → Parse URL → owner/name/branch
    → Validate via GitHub API (repo exists, branch exists)
    → Read current skills.urls from config
    → ConfigWriter.write("skills", [...currentUrls, githubUrl])
  ← Return success
```

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `packages/core/src/config/writer.ts` | `ConfigWriter` service |
| **Edit** | `packages/core/src/config.ts` | Add `export * as ConfigWriter from "./writer"` |
| **Create** | `packages/loongcode/src/skill/marketplace.ts` | `SkillMarketplace` service |
| **Create** | `packages/loongcode/src/skill/tarball.ts` | GitHub tarball download + extract utility |
| **Edit** | `packages/loongcode/src/skill/index.ts` | Remove `skillhub.pullAll()` from startup |
| **Edit** | `packages/sdk/openapi.json` | Add 6 new API endpoints |
| **Create** | `packages/app/src/pages/skills.tsx` | Web App Marketplace page |
| **Create** | `packages/app/src/components/skill-card.tsx` | Skill card component |
| **Create** | `packages/app/src/components/repo-manager.tsx` | Repo manager panel |
| **Create** | `packages/tui/src/component/dialog-skill-marketplace.tsx` | TUI skill manager dialog |
| **Edit** | `packages/tui/src/routes/home.tsx` | Add skill marketplace route/entry |
| **Run** | `./packages/sdk/js/script/build.ts` | Regenerate JS SDK |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| SkillHub API pagination missing (`page=0&size=100`) | Implement pagination loop in `list()`; or request SkillHub team to add `total` field |
| GitHub rate limiting on tarball downloads | In-memory TTL cache (5 min) in `SkillMarketplace` — see "Marketplace Response Caching Spec" below |
| Tarball extraction memory usage | Stream-extract, don't load full archive into memory; limit file count |
| Config write race conditions | `Flock` for file-level locking (already in project) |
| Breaking change: removing `skillhub.pullAll()` | Installed SkillHub skills continue to work via `config.skills.paths`; only "auto-discover all" behavior changes |
| `jsonc-parser` modify API preserves comments | Verified: `modify()` + `stringify()` preserves formatting and comments |

---

## Refinement Decisions (2026-08-11, confirmed via grilling session)

### Decision Summary

| # | Decision | Choice |
|---|----------|--------|
| 11 | SkillHub credential storage | Existing `Auth.Service` under providerID `"skillhub"`; anonymous access when unset; no fallback token |
| 12 | Hardcoded SkillHub token | **Removed** from `skillhub.ts` (leftover from the old pullAll flow) |
| 13 | Private ("my") skills source | `GET /api/web/me/skills` with bearer token (endpoint verified: 401 anonymous / 403 with the old scoped token) |
| 14 | Private skills presentation | Merged into the marketplace list with a "我的" badge; file downloads reuse the same files endpoint + bearer token (adjust later if the backend requires a different path) |
| 15 | Repo source tag | Full `owner/repo` (e.g. `anthropics/skills`), not the host name |
| 16 | Marketplace sort order | SkillHub group first — my skills first, then public skills in API order (already `updatedAt` desc); then repo groups in **reverse `skills.urls` array order** (last added first); scan order within a repo |
| 17 | Install completion semantics | Frontend pending state spans the install request **and** the list refetch; backend hot-rescans `Skill.Service` after install so the skill is usable without restart |
| 18 | Installed state display | Right side shows an "已安装" tag; the uninstall button stays next to it (weakened styling) |
| 19 | Marketplace UI i18n | App panel fully internationalized (zh/zh-TW get Chinese, other locales English); TUI dialog stays English |
| 20 | API key validation | Validate via `/api/web/me/skills` before saving; persist only on 200, surface "API Key 无效" on 401/403 |

### Facts Discovered During Review

- `GET /api/web/me/skills` exists on SkillHub (401 anonymous, 403 with the old scoped token — a real user key should pass).
- The SkillHub list API returns a `total` field — proper pagination is now unblocked (replaces the hardcoded `page=0&size=100`).
- `Skill.Service` scans skills **once per directory** (`InstanceState.make` in `skill/index.ts`). A marketplace install writes files + config but the running app never rescans — the skill is unusable until restart. This is the root cause of the "install looks done but isn't" UX.
- `discoverSkills` still calls `discovery.pull(url)` for every entry in `skills.urls` (legacy `index.json` protocol). GitHub/Gitee repo URLs added via the marketplace have no `index.json`, so every startup issues silently-failing 404 requests per configured repo.
- `Auth.Service` (`@/auth`) exposes `get/all/set/remove` — everything the SkillHub credential flow needs. The existing HTTP surface only has `PUT /auth/{id}` (set), so dedicated marketplace endpoints are required for status, validated-save, and disconnect.

### New / Changed Endpoints

```
GET    /api/skill/skillhub         → { configured: boolean }        (Auth.get("skillhub") !== undefined)
PUT    /api/skill/skillhub         → body { key }                   (validate via /api/web/me/skills, Auth.set on 200)
DELETE /api/skill/skillhub         → Auth.remove("skillhub")
```

`PUT` replaces the original plan of the frontend calling `PUT /auth/{id}` directly — validation-before-save must happen server-side.

### Schema Changes

```ts
export const DiscoverableSkill = Schema.Struct({
  // ...existing fields...
  mine: Schema.optional(Schema.Boolean),  // true for entries from /api/web/me/skills
})
```

### Implementation Tasks (Phase 4)

#### Task 11: SkillHub Auth Wiring
- Delete `SKILLHUB_TOKEN` from `skillhub.ts`; strip the bearer from its requests.
- `marketplace.ts`: yield `Auth.Service`; every SkillHub call (list, files, file download, me/skills) attaches `Authorization: Bearer <key>` when a key exists, anonymous otherwise.

#### Task 12: My-Skills Merge + Sort Order
- `list()`: when a key is configured, also fetch `/api/web/me/skills`; map entries with `mine: true`, dedupe against public entries by `namespace/slug`.
- Return order: `[my skills..., skillhub public (API order)..., repo groups in reverse skills.urls order (scan order within repo)]`.

#### Task 13: Repo Source Tag (App)
- `skill-card.tsx`: github/gitee rows render `skill.repo` (`owner/repo`) as the tag instead of "GitHub"/"Gitee".

#### Task 14: Repo Group Ordering
- `marketplace.ts` `list()`: iterate `effectiveRepoUrls(cfg)` in reverse array order.

#### Task 15: Install UX States (App)
- Pending row shows spinner + "安装中…" for the full install request + refetch (current pending logic already spans both; add the label and keep the row disabled).
- Installed rows: right side renders an "已安装" `Tag` plus a de-emphasized uninstall button.

#### Task 16: Hot-Rescan After Install
- `skill/index.ts`: expose `Skill.Service.refresh()` that invalidates the `discovered` and `state` InstanceStates so the next `all()/available()` re-runs discovery.
- Marketplace `install`/`uninstall` handlers call `refresh()` after the config write.

#### Task 17: Marketplace Panel i18n (App only)
- Extract all hardcoded strings into i18n keys: search placeholder, "Loading skills...", "No skills found.", "No skills installed.", "No repos configured.", "Add"/"Adding...", "Install"/"Uninstall", "安装中…", "已安装", "我的", error fallbacks, repo input placeholder, Skill Hub entry texts ("龙岗数据Skill Hub", "未配置 API Key", "已连接", "断开", "API Key 无效").
- zh/zh-TW: Chinese translations; other 18 locales: English (parity test requires all keys present).
- TUI dialog unchanged (no i18n facility in TUI).

#### Task 18: Skill Hub Pinned Entry + API Key Dialog
- Repos tab: pinned "龙岗数据Skill Hub" entry above the repo list; status text "未配置 API Key" / "已连接"; click opens an API key dialog modeled on `DialogConnectProvider`'s `ApiAuthView`.
- Dialog submit → `PUT /api/skill/skillhub { key }` (server validates, saves); error surfaces as "API Key 无效".
- Configured state: button becomes "断开" → `DELETE /api/skill/skillhub`.

#### Task 19: Skip Repo URLs in Legacy Discovery Pull
- `discoverSkills`: skip `skills.urls` entries that parse as GitHub/Gitee repo URLs (`parseRepoUrl`) — they are browse-only marketplace sources, not `index.json` protocol sources.

### Additional Risks (Phase 4)

| Risk | Mitigation |
|------|------------|
| `/api/web/me/skills` down or key revoked mid-session | Catch per-request; degrade to public-only listing (same as existing SkillHub error handling) |
| Key validation adds latency to save | One extra request at save time only; acceptable UX vs. silently storing a bad key |
| Hot-rescan re-runs full discovery (glob scans) | Discovery is local FS glob + cached downloads; runs once per install, not per keystroke |
| `skills.urls` double duty (index.json sources vs repo browse sources) | Task 19 keeps them separated; a future config split (`skills.repos`) can clean this up |

---

## Marketplace Response Caching Spec (2026-08-12, confirmed via grilling session)

### Problem Statement

Every time the user opens the skill marketplace, the backend re-downloads every configured repo's tarball (N full archive downloads) and re-fetches the full SkillHub catalogue (public + "my skills"). With several repos configured or a slow network, the marketplace takes seconds to load on every single open. The same redundancy hits install: installing a repo skill re-downloads the exact tarball that `list()` just downloaded. Worse, a single dead repo adds its full connection timeout to every open because failures are never remembered.

### Solution

The marketplace service caches its upstream responses in memory with a short TTL. Opening the marketplace within the TTL is served entirely from cache — no network at all. Install reuses the cached tarball, eliminating the duplicate download. Failed downloads are also cached, so a dead repo no longer stalls every open with its timeout. Mutations that change what the cache means (adding/removing a repo, changing the SkillHub key) invalidate the affected cache entries immediately, so the user never sees a stale result after their own action.

### User Stories

1. As a desktop app user, I want the marketplace to open instantly when I reopen it within a few minutes, so that browsing skills feels responsive.
2. As a user with several repos configured, I want open time to not scale with repo count on repeat opens, so that adding sources doesn't punish me.
3. As a user on a slow or proxied network, I want repeat marketplace opens to avoid redundant downloads, so that I don't burn bandwidth and time.
4. As a user installing a repo skill right after browsing, I want the install to reuse the already-downloaded tarball, so that installation is fast.
5. As a user with a temporarily unreachable repo, I want the marketplace to stay fast while the repo is down, so that one dead source doesn't freeze every open with a timeout.
6. As a user who just added a repo, I want the new repo's skills to appear immediately, so that I can install them right away.
7. As a user who just removed a repo, I want its skills to disappear from the list immediately, so that I don't try to install something that will fail.
8. As a user who just connected or disconnected my SkillHub key, I want the list to reflect my new private-skill visibility immediately, so that the "我的" section is always accurate.
9. As a user, I want repository updates to show up within a bounded, predictable time (the TTL), so that I understand why a just-published skill isn't visible yet.
10. As a TUI user, I want the same caching benefits as the desktop app, so that both clients are equally fast.

### Implementation Decisions

- **Cache layer: backend only.** The cache lives in the `SkillMarketplace` service (a long-lived service). Both TUI and app benefit with zero frontend changes, and the install path shares the same cache. The frontend keeps its current fetch-on-open behavior; cache hits make the response fast.
- **What is cached — repo side: raw tarball bytes.** Cache the `Uint8Array` returned by the tarball download, keyed by repo identity (`host/owner/name/branch`). Both `list()` (scan for skills) and `install` (extract files) consume the same buffer, so one cache entry serves both. Parsed scan results are not cached — scanning is cheap; downloading is the cost.
- **What is cached — SkillHub side: the full fetched lists.** The public catalogue and the "my skills" list each get a cache entry covering the complete paginated fetch result.
- **Failures are cached too.** A failed tarball download (network error, non-200, timeout) caches the null/failure result for the same TTL, preventing a dead repo from adding its timeout to every marketplace open.
- **Storage: in-memory Map.** Tarballs are typically a few hundred KB, so memory is sufficient. The cache dies with the process, which is acceptable — a restart simply re-warms on next open. No disk cache, no cleanup strategy, no concurrency-on-write concerns.
- **Invalidation: TTL of 5 minutes.** A simple timestamp comparison per entry; no new dependencies. Within the TTL the list may be up to 5 minutes stale — acceptable because repo updates are not minute-sensitive, and the user-facing rule is predictable: "worst case, you see 5-minute-old data."
- **Precise invalidation on mutation:** `addRepo`/`removeRepo` invalidate the tarball cache; `setSkillHubKey`/`removeSkillHubKey` invalidate the SkillHub list caches. `install`/`uninstall` do **not** invalidate anything — installed state is read live from config on every `list()`, never from the cache.
- **No frontend caching layer.** Deliberately rejected: it would leave the install-time duplicate download unsolved, would need separate implementations in TUI and app, and would double the invalidation surface.
- **Rejected alternatives:** conditional requests / commit-SHA checks (still N API calls per open, plus GitHub/Gitee rate-limit risk); manual refresh button (users keep seeing stale data without knowing why); 1-minute TTL (too little benefit); 30-minute TTL (staleness becomes confusing); disk cache (complexity without meaningful win at these sizes).

### Testing Decisions

- Good tests assert external behavior of the `SkillMarketplace` service (what `list()`/`install()` return and how many upstream HTTP requests were made), not cache internals.
- All tests run against a stubbed HTTP layer (the existing hermetic test pattern: a stub `HttpClient` that fails the test on any unexpected request), with a fake clock or injected "now" to control TTL expiry deterministically.
- Cases: second `list()` within TTL issues zero upstream requests; `list()` after TTL re-downloads; a failed download is not retried within TTL; `addRepo`/`removeRepo` force re-download of the affected repo on next `list()`; `setSkillHubKey`/`removeSkillHubKey` force a SkillHub refetch; `install` after `list()` issues no tarball download.
- Prior art: `test/skill/marketplace.test.ts` (stubbed-HttpClient service tests with a request-counting stub as the natural seam).

### Out of Scope

- Frontend caching of the marketplace response (rejected — see Implementation Decisions).
- Disk-persistent caching across restarts.
- Conditional requests / ETag / commit-SHA freshness checks.
- A manual "refresh" button in the UI.
- Caching of SkillHub skill file downloads (per-file install payloads) — only lists and repo tarballs are cached.
- Per-entry TTL configuration by the user.

### Further Notes

- The cache is per-server-process. The desktop sidecar and a TUI-spawned server each hold their own cache — acceptable, since both are user-local.
- The 5-minute staleness window also bounds how quickly a revoked SkillHub key's private skills disappear on their own; the explicit key-change invalidation covers the intentional case, so this is only about out-of-band revocation.
