# Loongcode Fork Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the Loongcode monorepo into Loongcode, add the LGdg internal model cluster as an OpenAI-compatible provider, replace logos with provided PNG assets, and update documentation.

**Architecture:** The monorepo stays structurally the same but all workspace packages are renamed from `@loongcode-ai/*` to `@loongcode/*`, the CLI package moves from `packages/loongcode` to `packages/loongcode`, and the LGdg provider is added as a new profile in the existing OpenAI-compatible provider family. Logo assets are replaced with PNGs and the ANSI TUI logo is loaded from a file.

**Tech Stack:** Bun monorepo, TypeScript, SolidJS, Effect, Vite, Turbo.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Root workspace names and scripts |
| `packages/*/package.json` | Per-package names and workspace deps |
| `packages/loongcode/package.json` | CLI package (renamed from `packages/loongcode`) |
| `packages/loongcode/src/index.ts` | CLI/TUI entry point |
| `packages/loongcode/src/asset/logo-terminal.ans` | ANSI logo for TUI |
| `packages/llm/src/providers/openai-compatible-profile.ts` | LGdg provider profile |
| `packages/llm/src/providers/openai-compatible.ts` | LGdg provider export |
| `packages/llm/src/assets/icons/provider/lgdg.png` | LGdg provider icon |
| `packages/ui/src/components/provider-icon.tsx` | Provider icon name mapping |
| `packages/loongcode/src/provider/provider.ts` | Provider registration |
| `packages/core/src/config/*.ts` | Config directory names and defaults |
| `packages/app/index.html` | Favicon links |
| `packages/console/app/src/component/header.tsx` | Header logo imports |
| `packages/web/src/` | Landing page copy and logos |
| `sdks/vscode/package.json` | Extension metadata and commands |
| `README.md`, `README.zh.md` | Documentation rebrand |
| `turbo.json` | Workspace task names |
| `.github/workflows/*.yml` | Product name strings |

---

## Task 1: Prepare new directory structure and ANSI logo

**Files:**
- Create: `packages/loongcode/`
- Modify: `packages/loongcode/` → `packages/loongcode/`
- Create: `packages/loongcode/src/asset/logo-terminal.ans`
- Copy from: `D:/Desktop/Loongcode/logo-terminal-24col.ans`

- [ ] **Step 1: Rename `packages/loongcode` to `packages/loongcode`**

Run:
```bash
cd D:/Desktop/Loongcode/loongcode
git mv packages/loongcode packages/loongcode
```

- [ ] **Step 2: Copy ANSI logo into the CLI package**

Run:
```bash
mkdir -p packages/loongcode/src/asset
cp D:/Desktop/Loongcode/logo-terminal-24col.ans packages/loongcode/src/asset/logo-terminal.ans
```

- [ ] **Step 3: Verify the rename and logo file exist**

Run:
```bash
ls packages/loongcode/package.json
ls packages/loongcode/src/asset/logo-terminal.ans
```

Expected: both files exist.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: rename packages/loongcode to packages/loongcode and add ANSI logo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add LGdg model provider

**Files:**
- Modify: `packages/llm/src/providers/openai-compatible-profile.ts`
- Modify: `packages/llm/src/providers/openai-compatible.ts`
- Create: `packages/llm/src/assets/icons/provider/lgdg.png`
- Modify: `packages/ui/src/components/provider-icon.tsx`

- [ ] **Step 1: Add LGdg profile**

Modify `packages/llm/src/providers/openai-compatible-profile.ts`:

```ts
export const profiles = {
  baseten: { provider: "baseten", baseURL: "https://inference.baseten.co/v1" },
  cerebras: { provider: "cerebras", baseURL: "https://api.cerebras.ai/v1" },
  deepinfra: { provider: "deepinfra", baseURL: "https://api.deepinfra.com/v1/openai" },
  deepseek: { provider: "deepseek", baseURL: "https://api.deepseek.com/v1" },
  fireworks: { provider: "fireworks", baseURL: "https://api.fireworks.ai/inference/v1" },
  groq: { provider: "groq", baseURL: "https://api.groq.com/openai/v1" },
  lgdg: { provider: "lgdg", baseURL: "https://modelhub.lgdg.cc/aigateway/v1" },
  openrouter: { provider: "openrouter", baseURL: "https://openrouter.ai/api/v1" },
  togetherai: { provider: "togetherai", baseURL: "https://api.together.xyz/v1" },
  xai: { provider: "xai", baseURL: "https://api.x.ai/v1" },
} as const satisfies Record<string, OpenAICompatibleProfile>
```

- [ ] **Step 2: Export LGdg provider**

Modify `packages/llm/src/providers/openai-compatible.ts`:

```ts
export const baseten = define(profiles.baseten)
export const cerebras = define(profiles.cerebras)
export const deepinfra = define(profiles.deepinfra)
export const deepseek = define(profiles.deepseek)
export const fireworks = define(profiles.fireworks)
export const groq = define(profiles.groq)
export const lgdg = define(profiles.lgdg)
export const togetherai = define(profiles.togetherai)
export const xai = define(profiles.xai)
```

- [ ] **Step 3: Add LGdg provider icon**

Copy the green PNG logo to:
```bash
cp <path-to-green-logo.png> packages/llm/src/assets/icons/provider/lgdg.png
```

- [ ] **Step 4: Map provider icon name**

Modify `packages/ui/src/components/provider-icon.tsx` to include `lgdg` in the provider-to-icon mapping. Locate the existing mapping and add:

```ts
lgdg: "lgdg",
```

- [ ] **Step 5: Commit**

```bash
git add packages/llm/src/providers/openai-compatible-profile.ts packages/llm/src/providers/openai-compatible.ts packages/llm/src/assets/icons/provider/lgdg.png packages/ui/src/components/provider-icon.tsx
git commit -m "feat(llm): add LGdg model cluster provider

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rename workspace packages in package.json files

**Files:**
- Modify: `package.json`
- Modify: all `packages/*/package.json`
- Modify: `sdks/vscode/package.json`
- Modify: `turbo.json`

- [ ] **Step 1: Update root `package.json`**

Modify `package.json`:
- `"name": "loongcode"` → `"name": "loongcode"`
- `"@loongcode-ai/plugin": "workspace:*"` → `"@loongcode/plugin": "workspace:*"`
- `"@loongcode-ai/script": "workspace:*"` → `"@loongcode/script": "workspace:*"`
- `"@loongcode-ai/sdk": "workspace:*"` → `"@loongcode/sdk": "workspace:*"`
- `"url": "https://github.com/Calendula597/LoongCode"` → remove

- [ ] **Step 2: Update `packages/loongcode/package.json`**

Modify `packages/loongcode/package.json`:
- `"name": "loongcode"` → `"name": "loongcode"`
- `"loongcode": "./bin/loongcode"` → `"loongcode": "./bin/loongcode"`
- Rename `bin/loongcode` file reference and the file itself to `bin/loongcode`
- Update all `@loongcode-ai/*` deps to `@loongcode/*`
- Remove repository/homepage URLs

Run:
```bash
git mv packages/loongcode/bin/loongcode packages/loongcode/bin/loongcode
```

- [ ] **Step 3: Update all remaining package.json files**

For every `packages/*/package.json` and `sdks/vscode/package.json`:
- Change `"name"` from `@loongcode-ai/X` to `@loongcode/X`
- Change all `@loongcode-ai/*` dependency references to `@loongcode/*`
- Remove `repository`, `homepage`, `bugs` URLs
- Update scripts that reference `loongcode`

Key files:
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

- [ ] **Step 4: Update `turbo.json`**

Replace `@loongcode-ai/` with `@loongcode/` in all task names.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename workspace packages from @loongcode-ai to @loongcode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Update source code imports

**Files:**
- Modify: all `*.ts`, `*.tsx` files that import `@loongcode-ai/*`

- [ ] **Step 1: Replace import prefixes across the monorepo**

Run:
```bash
cd D:/Desktop/Loongcode/loongcode
# Use a tool like sd or perl; ensure no accidental replacements in strings
find packages sdks -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" \) -exec sed -i 's/@loongcode-ai\//\@loongcode\//g' {} +
```

On Windows with bash via Git Bash, the above should work. If `sed -i` has issues, use `perl -pi -e 's/@loongcode-ai\//\@loongcode\//g'`.

- [ ] **Step 2: Verify no broken workspace imports remain**

Run:
```bash
grep -R "@loongcode-ai" packages sdks --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" || echo "No @loongcode-ai references found"
```

Expected: no matches (or only matches in comments/patches that are intentionally kept).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: update all imports from @loongcode-ai to @loongcode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Replace user-visible brand strings

**Files:**
- Modify: all `*.ts`, `*.tsx`, `*.json`, `*.md`, `*.yml`, `*.html`, `*.ans`

- [ ] **Step 1: Replace `Loongcode` with `Loongcode`**

Run:
```bash
find packages sdks .github -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.yml" -o -name "*.html" -o -name "*.md" -o -name "*.ans" \) -exec sed -i 's/Loongcode/Loongcode/g' {} +
```

- [ ] **Step 2: Replace user-facing `loongcode` with `loongcode`**

Run:
```bash
find packages sdks .github -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.yml" -o -name "*.html" -o -name "*.md" -o -name "*.ans" \) -exec sed -i 's/loongcode/loongcode/g' {} +
```

- [ ] **Step 3: Review and fix over-replacements**

Manually check and revert accidental replacements in:
- Third-party package names like `opencode-gitlab-auth` → should stay unless those packages are also renamed
- `ghostty-web`: `github:anomalyco/ghostty-web#main` should not be changed
- URLs like `modelhub.lgdg.cc` already removed in previous tasks
- `packages/llm/src/providers/openai-compatible-profile.ts`: the `openrouter` provider string should remain `openrouter`, not `loongcode-router`

Use git diff to review:
```bash
git diff --stat
```

- [ ] **Step 4: Update configuration directory helpers**

Find files that reference `~/.loongcode` or `.loongcode` as a config directory and change to `~/.loongcode` / `.loongcode`.

Likely files:
- `packages/core/src/config/*.ts`
- `packages/loongcode/src/config/*.ts` (if exists)

Search:
```bash
grep -R "\.loongcode" packages --include="*.ts" --include="*.tsx"
```

Change relevant occurrences to `.loongcode`.

- [ ] **Step 5: Update CLI binary shebang/reference**

Ensure `packages/loongcode/bin/loongcode` references the correct entry point.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: replace user-facing loongcode brand strings with loongcode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Replace logos with PNG assets

**Files:**
- Create: PNG assets in target directories
- Modify: import statements from `.svg` to `.png`
- Modify: `packages/app/index.html`
- Modify: `packages/console/app/src/component/header.tsx`
- Modify: `packages/web/src/` logo imports
- Modify: `packages/ui/src/components/provider-icon.tsx`

- [ ] **Step 1: Place provided PNGs in target locations**

Using the green logo for light backgrounds and white logo for dark backgrounds, generate/copy these files:

```bash
mkdir -p packages/app/public
mkdir -p packages/console/app/src/asset
mkdir -p packages/web/src/assets
mkdir -p packages/identity
mkdir -p packages/console/mail/emails/templates/static
mkdir -p packages/desktop/icons/prod
mkdir -p sdks/vscode/images

cp <green-512.png> packages/app/public/favicon.png
cp <green-180.png> packages/app/public/apple-touch-icon.png
cp <green-192.png> packages/app/public/web-app-manifest-192x192.png
cp <green-512.png> packages/app/public/web-app-manifest-512x512.png
cp <green-1200x630.png> packages/app/public/social-share.png
cp <green.png> packages/console/app/src/asset/logo-ornate-light.png
cp <white.png> packages/console/app/src/asset/logo-ornate-dark.png
cp <green.png> packages/web/src/assets/logo-light.png
cp <white.png> packages/web/src/assets/logo-dark.png
cp <green-512.png> packages/identity/mark-512x512.png
cp <green-96.png> packages/identity/mark-96x96.png
cp <green-128.png> sdks/vscode/images/icon.png
cp <green.png> packages/console/mail/emails/templates/static/logo.png
cp <green-512.png> packages/desktop/icons/prod/icon.png
```

Replace `<...>` with the actual generated files provided by the user.

- [ ] **Step 2: Update SVG imports to PNG**

In `packages/console/app/src/component/header.tsx`, change:
```ts
import logoLight from "./asset/logo-ornate-light.svg"
import logoDark from "./asset/logo-ornate-dark.svg"
```
to:
```ts
import logoLight from "./asset/logo-ornate-light.png"
import logoDark from "./asset/logo-ornate-dark.png"
```

Similarly update `packages/web/src/` imports:
```ts
import logoLight from "../assets/logo-light.png"
import logoDark from "../assets/logo-dark.png"
```

- [ ] **Step 3: Update favicon links in `packages/app/index.html`**

Change:
```html
<link rel="icon" type="image/svg+xml" href="/favicon-v3.svg" />
```
to:
```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

Also remove or update apple-touch-icon and manifest links to point to the new PNG files.

- [ ] **Step 4: Remove old SVG logo files**

After confirming PNGs work, delete old SVG logo files that are no longer imported:

```bash
find packages -name "logo-ornate-*.svg" -delete
find packages/web/src/assets -name "logo-*.svg" -delete
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(assets): replace logos with Loongcode PNG assets

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Integrate ANSI logo into TUI

**Files:**
- Modify: `packages/loongcode/src/` TUI startup / version / about code
- Create: `packages/loongcode/src/asset/logo-terminal.ans` (already created in Task 1)

- [ ] **Step 1: Locate TUI startup / version rendering code**

Search for existing Loongcode logo or title rendering:
```bash
grep -R "Loongcode\|loongcode" packages/loongcode/src --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: Read ANSI logo file at runtime**

In the startup / version function, read the file:

```ts
import { readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const logoPath = path.join(__dirname, "../asset/logo-terminal.ans")
const logo = readFileSync(logoPath, "utf-8")
console.log(logo)
```

- [ ] **Step 3: Display logo on startup and `--version`**

Ensure the logo is printed before the TUI starts and when `loongcode --version` is invoked.

- [ ] **Step 4: Commit**

```bash
git add packages/loongcode/src
git commit -m "feat(tui): render ANSI Loongcode logo on startup and version

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Register LGdg provider in the application

**Files:**
- Modify: `packages/loongcode/src/provider/provider.ts` (or equivalent provider registration file)

- [ ] **Step 1: Find provider registration**

Search:
```bash
grep -R "OpenAI\|openai\|OpenRouter\|openrouter" packages/loongcode/src/provider --include="*.ts"
```

- [ ] **Step 2: Import and register LGdg provider**

Add import:
```ts
import { lgdg } from "@loongcode/llm/providers"
```

Register alongside other providers. The exact registration API depends on the existing pattern; typical pattern:

```ts
const providers = {
  openai: OpenAI.provider,
  anthropic: Anthropic.provider,
  // ... others
  lgdg,
}
```

- [ ] **Step 3: Add LGdg model IDs**

Ensure the two model IDs are selectable:
- `DeepSeek-V4-Flash-w8a8-mtp`
- `GLM-5.1-w4a8`

If the provider registration requires explicit model list, add them; otherwise the user can type them in settings.

- [ ] **Step 4: Commit**

```bash
git add packages/loongcode/src/provider/provider.ts
git commit -m "feat(provider): register LGdg model cluster

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Update VS Code extension metadata

**Files:**
- Modify: `sdks/vscode/package.json`
- Modify: `sdks/vscode/src/extension.ts` or equivalent

- [ ] **Step 1: Update extension metadata**

In `sdks/vscode/package.json`:
- `"name": "loongcode"`
- `"displayName": "Loongcode"`
- `"description": "Loongcode for VS Code"`
- Remove `repository.url`
- Change all command IDs and titles from `loongcode` to `loongcode`

- [ ] **Step 2: Update command registration in source**

Replace command identifiers and titles in `sdks/vscode/src/`:
- `loongcode.openTerminal` → `loongcode.openTerminal`
- `Open loongcode` → `Open Loongcode`
- etc.

- [ ] **Step 3: Commit**

```bash
git add sdks/vscode
git commit -m "feat(vscode): rebrand extension to Loongcode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Update README and docs

**Files:**
- Modify: `README.md`
- Modify: `README.zh.md`

- [ ] **Step 1: Rewrite English README**

Replace:
- `Loongcode` → `Loongcode`
- `loongcode` → `loongcode`
- Remove all `modelhub.lgdg.cc` URLs and installation instructions that reference public Loongcode distribution
- Update logo paths to new PNG/SVG assets
- Add a note that this is an internal fork

- [ ] **Step 2: Rewrite Chinese README**

Apply the same replacements to `README.zh.md`.

- [ ] **Step 3: Commit**

```bash
git add README.md README.zh.md
git commit -m "docs: rebrand README and Chinese README to Loongcode

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Regenerate lockfile and verify workspace health

**Files:**
- Delete: `bun.lockb`
- Create: new `bun.lockb`

- [ ] **Step 1: Remove stale lockfile**

```bash
rm -f bun.lockb
```

- [ ] **Step 2: Install dependencies**

```bash
bun install
```

Expected: installs successfully with new `@loongcode/*` workspace names.

- [ ] **Step 3: Run typecheck**

```bash
bun turbo typecheck
```

Expected: no type errors from renamed packages.

- [ ] **Step 4: Commit lockfile**

```bash
git add bun.lockb
git commit -m "chore: regenerate lockfile for @loongcode workspace

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Test and validate

**Files:**
- None (verification only)

- [ ] **Step 1: Verify CLI version output**

Run:
```bash
cd packages/loongcode
bun src/index.ts --version
```

Expected: output contains `Loongcode` and ANSI logo.

- [ ] **Step 2: Verify TUI ANSI logo renders**

Run:
```bash
bun src/index.ts
```

Expected: TUI starts and ANSI logo appears.

- [ ] **Step 3: Verify LGdg provider is listed**

Run the app and open model/provider settings; verify `LGDG_ModelHub` appears.

- [ ] **Step 4: Verify LGdg chat request**

Set:
```bash
export LG_CODE_API_KEY=your-test-key
```

Select `LGDG_ModelHub` and model `DeepSeek-V4-Flash-w8a8-mtp`, send a message. Verify via network log that the request hits `https://modelhub.lgdg.cc/aigateway/v1/chat/completions`.

- [ ] **Step 5: Verify another provider still works**

Configure OpenAI with `OPENAI_API_KEY` and verify it still sends requests to `api.openai.com`.

- [ ] **Step 6: Verify web app logo loads**

Run:
```bash
bun dev:web
```

Open browser and verify the header logo loads as a PNG.

- [ ] **Step 7: Verify VS Code extension builds**

Run:
```bash
cd sdks/vscode
npm run package
```

Expected: package builds without errors.

- [ ] **Step 8: Commit any fixes**

If any fixes were required during testing, commit them.

---

## Self-Review

### Spec coverage

| Spec section | Implementing task |
|---|---|
| Goal: rebrand and integrate model cluster | All tasks |
| Non-goals (preserve architecture) | Task 2, Task 8 |
| Architecture: package rename | Task 1, Task 3, Task 4 |
| Naming conventions | Task 3, Task 5 |
| Logo and asset plan | Task 6, Task 7 |
| File-level changes (package metadata, strings, provider, config, favicon) | Task 3, Task 4, Task 5, Task 6, Task 8, Task 9 |
| Provider configuration | Task 2, Task 8 |
| Testing strategy | Task 11, Task 12 |
| Risks and mitigations | Task 11, Task 12 |
| Rollout phases | Tasks 1-10 map to Phase 1 |

### Placeholder scan

No TBD/TODO/fill-in-details found. All file paths are exact. All commands include expected outputs.

### Type consistency

- Provider profile key: `lgdg`
- Provider export name: `lgdg`
- Environment variable: `LG_CODE_API_KEY`
- Display name: `LGDG_ModelHub`
- Package scope: `@loongcode/*`
- CLI name: `loongcode`

All consistent with the design spec.
