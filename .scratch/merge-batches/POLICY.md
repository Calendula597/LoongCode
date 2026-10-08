# Merge Conflict Resolution Policy (LoongCode fork ← upstream OpenCode v2)

You are resolving git merge conflicts in the repo at `D:\workplace\local\LoongCode`.
The repo is mid-merge (`git merge refs/remotes/upstream/dev` on branch `loongcode`).

HARD RULES:
- NEVER run: git commit, git add, git checkout, git merge --abort, builds, tests, bun install.
- Only READ files and EDIT the specific files assigned to you (via the Edit/Write tools).
- The final file must contain NO conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and must be syntactically valid (TS/TSX/JSON/MD/YAML/Nix).
- Match repo code style: 2-space indent, no semicolons in TS/TSX, double quotes.

## Background

This repo is "LoongCode", a fork of OpenCode (upstream: anomalyco/opencode), syncing upstream v2.0.x into the fork.
In conflict markers: `<<<<<<< HEAD` side = the fork (ours), `>>>>>>> refs/remotes/upstream/dev` side = upstream (theirs).

## The fork renamed everything; upstream code uses the old names

When merging, take upstream's logic but re-apply fork naming:

| Upstream (theirs) | Fork (ours) |
|---|---|
| npm scope `@opencode-ai/*` | `@loongcode/*` (NO "-ai" suffix!) |
| `packages/opencode` (dir), binary/CLI `opencode` | `packages/loongcode`, `loongcode` |
| config dir `.opencode` | `.loongcode` |
| env vars `OPENCODE_*` | `LOONGCODE_*` |
| brand strings `OpenCode` / `opencode` (user-visible) | `LoongCode` / `loongcode` |

EXCEPTIONS — keep the upstream form for:
- Real URLs/domains (opencode.ai, github.com/sst/opencode, models.dev, npm registry URLs), OAuth client IDs/secrets, third-party package names that are not workspace packages of this repo.
- Identifiers that refer to the actual upstream project (e.g. a comment linking to an upstream issue).
- When OURS explicitly changed a URL/ID (fork's own endpoints, LGDG/灵拓 infrastructure), keep ours.

## Fork-only features to PRESERVE (found on the HEAD side)

- memory system (记忆), skill marketplace (技能市场), TDAI 身份, LGDG/灵拓 provider customization, ssh 功能
- fork's V2 session work: SessionV2, durable `session_input`, `SessionExecution.wake`, system-context algebra
- Chinese-language comments/docs added by the fork; Gitee CI (`.workflow/`); fork release scripts
- Fork package versions (0.0.x) in package.json files — keep fork `name`/`version`, but merge upstream's dependency/script additions (with scope renamed to `@loongcode/*`)

## How to resolve each hunk

1. Pure branding difference → upstream logic + fork branding.
2. Upstream added/changed logic, ours unchanged except branding → take theirs, rename to fork naming.
3. Ours has fork-only feature code → keep it, adapted to upstream's new structure/APIs if the surroundings changed.
4. Both sides added different logic at the same spot → keep both unless clearly redundant.
5. Upstream refactored/deleted an API the fork code uses → adapt the fork code to upstream's new API (check nearby files or upstream's new location of the logic when unsure).
6. Test files: keep fork's added tests AND upstream's new tests where both make sense.

## Workflow

1. Read your batch file (one repo-relative path per line). Those files are yours; touch nothing else.
2. For each file: Read it fully, then use Edit to resolve every conflict hunk. Large files may need several reads.
3. After finishing all files, use Grep on each resolved file for `^(<<<<<<<|=======|>>>>>>>)` to prove no markers remain.

## Report back (concise)

- resolved X/Y files
- paths where you preserved fork-only features (list only)
- any hunk you were unsure about: path + one-line reason (do NOT leave markers for these — make your best call)
