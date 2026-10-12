# Loongcode Fork Design

**Date:** 2026-06-17  
**Status:** Approved  
**Scope:** Rebrand Loongcode monorepo into a company-internal product named `Loongcode`, integrate the company model cluster, and keep the multi-provider architecture intact.

---

## 1. Goal

Fork the Loongcode repository and transform it into `Loongcode`, a branded AI coding agent for internal company use. The fork must:

- Replace all user-facing `Loongcode` / `loongcode` branding with `Loongcode` / `loongcode`.
- Integrate the company model cluster `https://modelhub.lgdg.cc/aigateway/v1` as a first-class provider.
- Preserve the existing multi-provider architecture so users can still choose other providers.
- Replace core logo assets with the provided PNG set.
- Update CLI, VS Code extension, package names, and documentation accordingly.

---

## 2. Non-Goals

- Do not change core AI agent behavior, tool system, state machine, or routing logic.
- Do not remove or refactor subsystems such as `packages/web`, `packages/console`, `packages/stats`, or `packages/slack` in this phase.
- Do not rewrite CI/CD pipelines; only rename product references inside existing workflows.
- Do not update non-English / non-Chinese README files in this phase.
- Do not change third-party dependency packages (e.g., `@ai-sdk/*`, `@opentui/*`).
- Do not modify database schemas or migrations.

---

## 3. Architecture

The repository remains a Bun-based monorepo using workspaces. The high-level architecture after the fork:

```
Loongcode/
├── packages/
│   ├── loongcode/          # CLI/TUI entry point (renamed from loongcode)
│   ├── core/            # @loongcode/core
│   ├── app/             # @loongcode/app
│   ├── llm/             # @loongcode/llm
│   ├── ui/              # @loongcode/ui
│   ├── server/          # @loongcode/server
│   ├── tui/             # @loongcode/tui
│   ├── desktop/         # @loongcode/desktop
│   ├── sdk/js           # @loongcode/sdk
│   ├── plugin/          # @loongcode/plugin
│   ├── console/*        # @loongcode/console-*
│   ├── web/             # @loongcode/web
│   └── ...              # other packages renamed similarly
├── sdks/vscode/         # VS Code extension renamed to loongcode
└── docs/superpowers/specs/ # this document
```

### Provider integration

The LLM package already supports OpenAI-compatible providers. The company cluster will be added as a new profile in `packages/llm/src/providers/openai-compatible-profile.ts`:

```ts
lgdg: {
  provider: "lgdg",
  baseURL: "https://modelhub.lgdg.cc/aigateway/v1",
}
```

It will be exported from `packages/llm/src/providers/openai-compatible.ts` alongside DeepSeek, Groq, etc. Authentication will use a bearer token read from the `LG_CODE_API_KEY` environment variable or the settings UI.

### Model IDs

The cluster currently exposes two model IDs:

- `DeepSeek-V4-Flash-w8a8-mtp`
- `GLM-5.1-w4a8`

Both will be available as selectable models under the `LGDG_ModelHub` provider. A sensible default (to be confirmed during implementation) will be pre-selected.

---

## 4. Naming Conventions

| Current | New | Notes |
|---|---|---|
| `Loongcode` | `Loongcode` | User-facing product name |
| `loongcode` | `loongcode` | CLI command, package name, extension ID, settings keys |
| `@loongcode-ai/*` | `@loongcode/*` | Workspace package names |
| `loongcode-ai` | `loongcode` | Published npm package scope/name |
| `modelhub.lgdg.cc` / `https://modelhub.lgdg.cc/*` | `https://modelhub.lgdg.cc` | Model cluster base URL; other non-API `modelhub.lgdg.cc` URLs are removed |
| `https://github.com/Calendula597/LoongCode` | temporarily removed | Repository references are removed until the private repo is made public |
| `~/.loongcode` | `~/.loongcode` | User configuration directory |

### Environment variables

| Current | New |
|---|---|
| `OPENAI_API_KEY` (for OpenAI) | unchanged for OpenAI provider |
| `LOONGCODE_*` | `LOONGCODE_*` for Loongcode-specific settings |
| New | `LG_CODE_API_KEY` for the LGdg model cluster |

---

## 5. Logo & Asset Plan

The provided source assets are two PNGs: a green version and a white version. Only PNGs will be used; SVG imports in code will be changed to PNG imports.

### Required PNG deliverables

| Destination path | Suggested size | Source asset |
|---|---|---|
| `packages/app/public/favicon.png` | 96x96 | green |
| `packages/app/public/apple-touch-icon.png` | 180x180 | green |
| `packages/app/public/web-app-manifest-192x192.png` | 192x192 | green |
| `packages/app/public/web-app-manifest-512x512.png` | 512x512 | green |
| `packages/app/public/social-share.png` | 1200x630 | green |
| `packages/console/app/src/asset/logo-ornate-light.png` | ~40px height | green |
| `packages/console/app/src/asset/logo-ornate-dark.png` | ~40px height | white |
| `packages/web/src/assets/logo-light.png` | appropriate | green |
| `packages/web/src/assets/logo-dark.png` | appropriate | white |
| `packages/identity/mark-512x512.png` | 512x512 | green |
| `packages/identity/mark-96x96.png` | 96x96 | green |
| `sdks/vscode/images/icon.png` | 128x128 | green |
| `packages/console/mail/emails/templates/static/logo.png` | appropriate | green |
| `packages/desktop/icons/prod/icon.png` | 512x512 | green |

### TUI logo

The ANSI art file `logo-terminal-24col.ans` will be copied to `packages/loongcode/src/asset/logo-terminal.ans` and rendered on:

- TUI startup
- `loongcode --version`
- `loongcode --about` (if such a command exists)

### Optional / phase-two assets

- Full desktop icon sets for macOS, iOS, Android, Windows, and Linux.
- Console brand download page assets.
- Landing page marketing imagery.

---

## 6. File-Level Changes

### Package metadata

Every `package.json` in the monorepo needs updates for:

- `name`
- `dependencies` / `devDependencies` workspace references (`@loongcode-ai/*` → `@loongcode/*`)
- `repository`, `homepage`, `bugs` URLs (removed for now)
- `bin` entries (`loongcode` → `loongcode`)
- `scripts` that reference `loongcode`

Key files:

- `package.json`
- `packages/loongcode/package.json` (renamed from `packages/loongcode/package.json`)
- `packages/core/package.json`
- `packages/app/package.json`
- `packages/llm/package.json`
- `packages/ui/package.json`
- `packages/tui/package.json`
- `packages/server/package.json`
- `packages/desktop/package.json`
- `packages/web/package.json`
- `packages/sdk/js/package.json`
- `packages/plugin/package.json`
- `packages/console/*/package.json`
- `packages/stats/*/package.json`
- `packages/slack/package.json`
- `sdks/vscode/package.json`

### Source code strings

Search and replace user-visible strings:

- `Loongcode` → `Loongcode`
- `loongcode` → `loongcode` in product strings, commands, settings keys, directory names
- Keep `loongcode` only where it is a dependency/package name that is being renamed separately.

Important code areas:

- `packages/loongcode/src/`: CLI/TUI entry, command names, config paths
- `packages/core/src/`: config directory helpers, settings schema defaults
- `packages/app/src/`: page titles, notification bodies, project avatar URLs
- `packages/console/app/src/`: header, routes, meta tags
- `packages/ui/src/`: component labels, provider icon name mapping
- `packages/web/src/`: landing page copy
- `sdks/vscode/src/`: command titles, extension display name

### Model provider code

- `packages/llm/src/providers/openai-compatible-profile.ts`: add `lgdg` profile.
- `packages/llm/src/providers/openai-compatible.ts`: export `lgdg` provider.
- `packages/llm/src/assets/icons/provider/`: add `lgdg.png` (or reuse an existing icon) and update the sprite generation if needed.

### Configuration files

- `turbo.json`: task names like `@loongcode-ai/app#test` → `@loongcode/app#test`
- `.loongcode/tui.json` and `.loongcode/themes/*.json`: schema URLs removed or updated
- `.github/workflows/*.yml`: product name references updated
- `README.md`, `README.zh.md`: full rebrand

### Favicon / HTML

- `packages/app/index.html`: favicon links updated to PNG
- `packages/console/app/src/entry-server.tsx`: `og:image` and other meta tags updated

---

## 7. Provider Configuration

The LGdg provider will be configured as follows:

```ts
// packages/llm/src/providers/openai-compatible-profile.ts
export const profiles = {
  // ... existing profiles ...
  lgdg: {
    provider: "lgdg",
    baseURL: "https://modelhub.lgdg.cc/aigateway/v1",
  },
} as const
```

```ts
// packages/llm/src/providers/openai-compatible.ts
export const lgdg = define(profiles.lgdg)
```

Auth:

```ts
AuthOptions.bearer(input, "LG_CODE_API_KEY")
```

In the `packages/loongcode` provider registration, the LGdg provider will be registered so it appears in the UI alongside other providers.

---

## 8. Testing Strategy

- Run `bun install` after renaming packages to ensure workspace references resolve.
- Run `bun turbo typecheck` to catch broken imports.
- Run the CLI with `--version` and verify output shows `Loongcode`.
- Start the TUI and verify the ANSI logo renders.
- Start the web app and verify the header logo loads as PNG.
- Configure `LG_CODE_API_KEY` and send a chat request to the LGdg provider; verify the request hits `https://modelhub.lgdg.cc/aigateway/v1/chat/completions`.
- Verify other providers (e.g., OpenAI) still work when configured.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Mass rename breaks imports | Use codemod / scripted replace, then run typecheck |
| Lockfile stale after rename | Delete and regenerate `bun.lockb` |
| Desktop icon generation fails | Keep a single `icon.png` as fallback; full icon sets are phase-two |
| LGdg provider not appearing in UI | Verify provider registration in `packages/loongcode/src/provider/provider.ts` |
| Existing tests fail due to brand strings | Update snapshot / assertion strings |
| SVG-to-PNG import breaks build | Update import paths and ensure Vite handles PNG static assets |

---

## 10. Rollout Phases

### Phase 1: Core rebrand

- Rename packages and workspace references.
- Replace CLI/TUI strings and config directories.
- Add LGdg provider.
- Replace core logos with PNGs.
- Update README.md and README.zh.md.

### Phase 2: Extended assets

- Generate full desktop icon sets.
- Replace console brand download page assets.
- Add social-share and marketing imagery.

### Phase 3: Public release prep

- Add GitHub repository URL back to package.json files.
- Set up public documentation site (if needed).
- Publish `loongcode` npm package and VS Code extension.

---

## 11. Open Questions

None remaining; all clarified during brainstorming.

---

## 12. Decisions Log

| Decision | Rationale |
|---|---|
| Use `loongcode` not `lg-code` | Matches the user's explicit naming and common CLI conventions |
| Use `@loongcode/*` scope | Cleaner than `@loongcode-ai/*`; consistent with product name |
| Keep multi-provider architecture | User explicitly chose option C: internal cluster as one optional provider |
| Only PNG assets | User only has PNGs; SVG imports will be converted |
| Remove GitHub URLs temporarily | Repo is private; URLs will be re-added after public release |
| Use `modelhub.lgdg.cc` for all former `modelhub.lgdg.cc` URLs | User chose option A |
| Update README.md and README.zh.md only | Other languages deferred to phase-three |
| `LG_CODE_API_KEY` for auth | User-specified environment variable name |
| Display name `LGDG_ModelHub` | User-specified provider label |
| Default LGdg model ID | To be selected from `DeepSeek-V4-Flash-w8a8-mtp` or `GLM-5.1-w4a8` during implementation |
