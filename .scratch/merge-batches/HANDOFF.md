# 交接文档：LoongCode 同步 upstream OpenCode v2（merge 进行中）

> 生成时间：2026-09-28。本文档供另一个 agent 接手继续完成 merge。
> 开始前先通读 `.scratch/merge-batches/POLICY.md`（冲突解决策略，子代理任务模板也引用了它）。

## 1. 任务目标

将 upstream OpenCode v2 合并进 fork 的 `loongcode` 分支，完成后推送到 github 远程的**新分支**（不要直接推 `loongcode`）：

```bash
git push github loongcode:sync-upstream-v2
```

- 上游：`upstream/dev` = `b471c2b449`（v2.0.18 时代，tag 最新 v2.0.18）
- 合并基点（merge-base）：`213ff3f2d77`；上游领先 1642 个提交，fork 有 124 个定制提交
- fork 的定制：品牌改名（opencode→loongcode）、记忆系统、技能市场、TDAI 身份、LGDG/灵拓供应商、ssh、Gitee CI、V2 session 架构

## 2. 当前 git 状态（重要）

- **处于 merge 中间态**：在 `loongcode` 分支上 `git merge --no-ff refs/remotes/upstream/dev` 已开始、尚未提交（`MERGE_HEAD` 存在）
- 当前分支：`loongcode`（本地），尚未做任何 commit/push
- 冲突总数 626（UU）+ 128（其他类型）；其他类型已全部解决，**剩余 541 个 UU 文件**
- **用户未提交的工作已 stash**：`stash@{0}` = "wip: codex-tdai-memory dirty tree before upstream sync"（28 个文件，含 `skill-marketplace.css`、i18n 各语言文件、skill marketplace 前后端）。这是 `codex-tdai-memory` 分支的工作，merge 完成后 checkout 回该分支再 `git stash pop`。千万不要 drop 或覆盖

### 网络注意事项

直连 GitHub 不通（SSH 443/22 均被重置）。抓取上游须走本地代理：

```bash
git -c http.proxy=http://127.0.0.1:7890 fetch https://github.com/anomalyco/opencode.git '+refs/heads/*:refs/remotes/upstream/*'
```

推送到 github 远程同理可能需要代理（远程 URL 是 SSH，若失败可改用 `git -c http.proxy=... push https://github.com/Calendula597/LoongCode.git loongcode:sync-upstream-v2`）。

## 3. 已完成的工作

### 3.1 机械类冲突（全部解决）

- **DU（119，fork 删除/上游更新）**：全部保持删除。含 `packages/console`（fork 有意移除）、`packages/stats`、`packages/slack`、`.opencode/tool/`、`README.zht.md` 等
- **UA（90，上游在重命名目录下的新文件）**：全部接受上游内容（如 `packages/loongcode/src/tool/code-mode.ts`、`v2-compat` 测试 fixtures）。⚠️ 这些文件内容仍是上游品牌（import `@opencode-ai/codemode` 等），需品牌修正（见 §6）
- **UD（27，上游删除/fork 更新）**：除一个外全部接受上游删除（fork 侧改动只是品牌字符串替换，已核实）。例外：`packages/app/src/components/dialog-select-provider.tsx`（含 LGDG/灵拓供应商定制），fork 版本已存到 `.scratch/ours-dialog-select-provider.tsx`，需在验证阶段确认 LGDG 定制在新 UI 中保留
- **AA**（llm 测试）：取上游（覆盖 fork 的单测）；**AU/DD**（max-steps.txt 重命名对）：保留 fork 路径
- **bun.lock**：取上游版本，待 `bun install` 重新生成
- **手工解决**：根 `package.json`（保留 loongcode dev/sso 脚本 + 上游 translate:app）、`turbo.json`（上游新增 test 任务改为 `@loongcode/*` scope）、`nix/desktop.nix`（上游 desktopItems/图标安装 + loongcode 品牌）、`sdks/vscode/package.json`（取 fork：name loongcode-vscode, v0.0.66）
- **packages/web（80 个文档文件）**：整体取上游版本。⚠️ 品牌替换（OpenCode→LoongCode 等）未做，需品牌修正（见 §6）

### 3.2 UU 批次：48 批中已完成 15 批

批次文件清单在 `.scratch/merge-batches/batch-01.txt` ~ `batch-48.txt`（每行一个文件路径）。

**已完成**：12, 19, 31, 32, 33, 36, 38, 39, 41, 42, 43, 44, 45, 46, 47
（loongcode 尾部测试、core 测试、desktop、ui、protocol、enterprise、cli、storybook 及小包的 package.json）

**待恢复（33 批，541 个文件）**：

| 批次 | 范围 |
|---|---|
| 01–11 | packages/loongcode（主包，大头：package.json + src + test） |
| 13–18, 20–21 | packages/core（src + test） |
| 22–29 | packages/app（含 AGENTS.md、components、context） |
| 30 | packages/desktop（剩余部分） |
| 34 | packages/server |
| 35 | packages/tui |
| 37 | packages/session-ui（新上游包，文件内仍有标记） |
| 40 | packages/sdk（含 openapi.json，⚠️ 大文件） |
| 48 | 根杂项：.github workflows/publish、.loongcode agent 配置、CONTEXT.md、CONTRIBUTING.md、README.zh.md、script/beta.ts、specs/v2 × 2 |

**恢复方式**：用 AgentSwarm `resume_agent_ids` 恢复（agent_id 与批次对应：agent-0→batch-01 … agent-47→batch-48，被中断的 agent-0..10,12..17,19..29,34,35,47）。子代理配置已改为 K2.8（见 §5）。若 resume 不可用，直接用原模板新建 swarm，items 为上表批次文件，prompt 模板见本仓库 git 历史或 §7。

### 3.3 已完成批次留下的待办（子代理报告汇总）

- `packages/session-ui/package.json` 的 name 仍是 `@opencode-ai/session-ui`，但 enterprise/storybook/turbo.json 已引用 `@loongcode/session-ui` → 必须统一改名（见 §6）
- `packages/loongcode/test/tool/websearch.test.ts` 期望 `loongcode-go` provider 变体，要求 `registry.ts`（batch-01/02 范围）的 webSearch 检查包含 `-go` 变体
- `packages/ui/src/context/marked.tsx` 取了上游版（主题名 "OpenCode"），因其新拆分的 marked-theme 模块用该名注册 → 品牌修正时要成套改名，别只改这一个文件
- 上游把 models 默认源从 `models.dev` 改为 `models.opencode.ai`（ui/vite.config.ts、cli/script/generate.ts）已取上游值；若 fork 有意用 models.dev 需回改

## 4. 关键决策与规则（后续解决必须遵守）

1. **scope 是 `@loongcode/*`，不是 `@loongcode-ai/*`**（实测 packages/*/package.json；AGENTS.md 里的 `@loongcode-ai` 示例是错的）
2. fork 包版本保持 `0.0.66`；上游版本号（1.18.x/2.x）不引入
3. 保留 fork 功能：记忆、技能市场、TDAI、LGDG/灵拓供应商（含 `modelhub.lgdg.cc` 等 URL）、ssh、`.workflow/` Gitee CI、V2 session（SessionV2/durable input/system-context）
4. 保留真实上游 URL/域名（opencode.ai、github.com/sst/opencode、models.opencode.ai）、OAuth client ID、第三方包名
5. 上游 v2 大重构：server groups 拆到 `packages/protocol`（schema 来自新包 `@opencode-ai/schema`）、新包 client/codemode/sdk-next/httpapi-codegen/identity 等；fork 删除的 stats/slack/console 若被上游代码引用会在验证阶段暴露，届时再决定是否复活

## 5. 环境配置变更（已生效）

`~/.kimi-code/config.toml` 已加：

```toml
[secondary_model]
default_model = "kimi-code/kimi-for-coding"   # 即 K2.8 Preview
```

子代理将默认用 K2.8。配置写入时已备份 `config.toml.20260928-105638.bak`。若接手会话已重载则已生效；否则需 `/reload`。

## 6. 全部冲突解决后的收尾清单（按顺序）

1. `grep -rn "^<<<<<<<" --include="*.ts" ...` 全仓扫描确认零标记（用 Grep 工具）
2. **品牌修正 pass**：
   - 新上游包的 package.json name：`@opencode-ai/*` → `@loongcode/*`（session-ui、protocol、schema、client、sdk-next、codemode、httpapi-codegen、identity、containers 等逐一确认）
   - 全仓 import/引用同步改（`@opencode-ai/session-ui` 有 ~40 处引用）
   - UA 接受的 90 个文件内的 `@opencode-ai/*` import
   - `packages/web` 取上游后的品牌字符串
   - marked 主题名等成套标识
3. `bun install` 重新生成 bun.lock
4. **验证 LGDG 供应商**：对照 `.scratch/ours-dialog-select-provider.tsx`，确认 LGDG/灵拓 provider 定制在合并后的 provider 选择 UI 中仍存在（上游重做了该 UI）
5. `bun typecheck`（从各包目录分别跑，如 packages/loongcode；**不要在仓库根跑测试**）— 修复类型错误，常见坑：上游删除/重命名的 API、fork 删除包被引用、scope 改名遗漏
6. 提交 merge：`chore: merge upstream opencode v2.0.18 (sync from upstream/dev)`（conventional commits）
7. `git push github loongcode:sync-upstream-v2`
8. 告知用户：本地 `loongcode` 分支现包含 merge 提交（github/loongcode 未动）；`codex-tdai-memory` 的 stash 恢复方式；LGDG dialog 等验证结论

## 7. 子代理任务模板（如需重新发起而非 resume）

```
You are resolving git merge conflicts in the repo at D:\workplace\local\LoongCode,
mid-merge (branch loongcode, merging upstream OpenCode v2). In conflict markers:
<<<<<<< HEAD = the fork (ours), >>>>>>> refs/remotes/upstream/dev = upstream (theirs).

First read `.scratch/merge-batches/POLICY.md` and follow it exactly.

Your assigned files are listed in `.scratch/merge-batches/{{item}}` (one path per line).
Resolve EVERY conflict hunk in EVERY listed file per the policy, then verify with Grep
that no `^(<<<<<<<|=======|>>>>>>>)` markers remain. Use Read + Edit only — never run
git add/commit, builds, or tests. Report: resolved X/Y; fork-only features preserved;
unsure hunks (path + one-line reason).
```

## 8. 参考信息

- ⚠️ `.scratch/` **没有被 gitignore**。解决冲突后不要用 `git add -A` / `git add .` 一把梭（会把交接文档、批次清单、`.scratch/ours-dialog-select-provider.tsx` 提交进去）；只 add 冲突文件本身，或 add 后 `git restore --staged .scratch` 再提交
- fork 历史同步方式：过去用 cherry-pick（见 log 中 "port upstream fixes"），本次改为正式 merge
- 工作区其他分支：`dev`（7b08f5e4d，删除了 console）、`memory`、`skillhub`、`ssh`、`codex-tdai-memory`——本次不动它们
- AGENTS.md 已在 merge 中自动更新为上游 v2 版（含 packages/client、generated-effect 等新条目）
