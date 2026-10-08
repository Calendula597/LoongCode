# 双轴代码审查报告 — Memory Pipeline（未提交工作区）

- **审查对象**：工作区未提交变更（相对 `HEAD`，含未跟踪文件）
- **审查日期**：2026-09-03
- **Spec 来源**：`.scratch/builtin-memory-pipeline/issues/01-06`
- **Standards 来源**：根 `AGENTS.md`、`packages/loongcode/AGENTS.md`、`CONTRIBUTING.md`、`CONTEXT.md` Memory 不变量 + Fowler 基线（Refactoring ch.3）
- **方法**：Standards / Spec 两轴由并行子代理独立审查，本报告仅聚合、不合并排序

**变更概况**：修改 10 文件（+148/−3），新增约 28 个未跟踪文件 —— core 侧 `memory.ts`/`memory/`/`v1/config/memory.ts` 与 6 个测试文件；loongcode 侧 `src/memory/`、5 个 memory 工具、2 个子代理 prompt；以及 `.scratch` 规格、`CONTEXT.md` Memory 术语段、`.gitignore`。

---

## Standards

### 硬性违规（违反仓库文档标准）

1. **Duplicated Code** — `resolveModel` 在 `extraction.ts:208` 与 `consolidation.ts:210` 逐字复制；`let structured` + `createStructuredOutputTool` + `Stream.filter(LLMEvent.is.toolCall) → runCollect → orDie` 形状同样双份。→ 提取共享 helper。
2. **Shotgun Surgery** — memory 根路径在 `store.ts:43`、`workspace.ts:30`、`context.ts:50`、`consolidation.ts:61`、`database.ts:49`、`loongcode/src/memory/index.ts` 六处独立推导；`MemoryPaths`（`paths.ts:40` 的 `workspace` 导出）本为此而生，现为死代码。改根路径需动 6 个文件。
3. **动态导入** — 根 AGENTS.md："Prefer dynamic imports for heavy modules… especially in startup-sensitive entrypoints"。`app-runtime.ts:54-57` 静态导入 Extraction/Consolidation（连带 LLM、Agent、Session、Git），破坏工单 01 的"无 memory 节零成本跳过"。
4. **Star import** — `processor.ts:34` `import * as Option from "effect/Option"` 违反 "Never use star imports"（`agent.ts:27` 有既有先例，属可辩护）。
5. **try/catch**（judgement）— `extraction.ts:107/184`、`consolidation.ts:78/187` 用 JS try/catch 包生成器体；标准偏好 `Effect.catchAll`/`tapError` 的 Effect 化边界。
6. **else 语句**（judgement）— `jobs.ts` `recordUsage`（207-220）、`claimPhase2`（335-370）、`completeStage1`（124-150）可用早返回改写。
7. **let 重赋值**（minor）— `store.ts:59-64`（`let body`、`let out`）vs "prefer const / ternaries"。
8. **`any`**（mitigated）— `extraction.ts:146`、`consolidation.ts:149` `as unknown as Record<string, any>`，受既有 `createStructuredOutputTool` 签名所迫。
9. **裸 `fs/promises`** — `database.ts:7` vs "Use Bun APIs" / FileSystem 优先。
10. **cast + destructure + discard** — `scheduler.ts:42-43` `const { sessionID } = event.data as {…}; void sessionID`；直接 `kick()` 即可。

### Fowler 基线（均为 judgement call）

- **Duplicated gating** — `registry.ts:209-210` 重实现 `context.ts:47` 的 `use_memories` 语义，存在漂移风险。
- **Speculative Generality** — `jobs.ts` 的 `dbUsage`/`reclaimStaleStage1`/`pruneOutputs`/`deleteSessionMemory`/`phase2Status` 无生产调用方（仅测试引用）；`pruneOutputs` 未接线却已写入 CONTEXT.md 剪枝不变量。若工单 04-06 后续落地则属预铺，否则为死重。
- **Layer 重复** — `app-runtime.ts` 同时合并 `MemoryExtraction/MemoryConsolidation.defaultLayer` **和** 自带副本的 `MemoryScheduler.defaultLayer` → 两套持有租约的活实例并存。
- **V2 不变量风险** — `extraction.ts:127-133` 在**真实会话**的 `sessionID`/user record 下跑 `llm.stream`（consolidation 则用合成 `"memory-consolidation"` ID，两者不一致）；CONTEXT.md 明确"记忆学习不属于 Session 执行权限"。
- **Divergent Change** — `.gitignore` 混入 `.analysis/`、`graphify-out/`、`docs/`、`specs/` 与本特性无关的工具产物条目（`specs/` 还被 `packages/loongcode/AGENTS.md` 引用）。
- **Feature Envy**（minor）— `loongcode/src/memory/index.ts` 直查 `MemoryTable`，重复 `MemoryJobs.phase2Status`。

### 符合项

self-export 模式（`src/config`）、Drizzle snake_case、config 自导出、CONTEXT.md 术语格式（含 Avoid 别名）、agent 注册形状、测试文件结构均合规。

---

## Spec

### (a) 缺失 / 部分实现

**工单 01 — 记忆地基**
- 「未知 key 记 warning 不 hard-fail」「越界回落默认并记 warning」：无 warning 机制；Effect Schema 静默丢弃未知 key；`options.ts:37-40` 钳制贴边（999→48）而非回落默认；age 区间 0–90 vs 规格「1–30 天」。
- 「无 `memory` 节时…不创建任何文件/目录、不注册任何记忆组件」：`app-runtime.ts` 无条件合并 `Memory/MemoryStore/MemoryExtraction/MemoryConsolidation/MemoryScheduler`；`MemoryDatabase.defaultLayer` 在 layer 构建时即创建 `memory.db`；`MemoryContext.layer` 始终注册（空的）source。
- 「`memory_inspect` 回显…警告」：inspect 不显示警告。

**工单 02 — Memory Summary Context Source**
- 测试只覆盖 disabled 路径；「摘要文件变化 → 恰好一条 Mid-Conversation System Message」「reconcile 返回 Unchanged」、~2500 token 截断、`use_memories:false` baseline 断言均未测。
- 教学文本位于渲染**头部**，规格要求「渲染尾部」。

**工单 03 — Memory 工具面**
- 无 "SessionV2.prompt + fake LLM" 测试。
- 「`memory_list` 返回清单（含来源 session 与 usage 元数据）」：只列文件。
- 「`memory_add_note` 写便签文件，重复主题可辨识」：写 `note-<ts>.md`，无主题可辨识机制。
- 五个工具全部被 `use_memories` 门控，规格只门控四个（inspect 是工单 01 的控制工具）。

**工单 04 — Extraction 管线**
- 「会话首条消息 stamp memory_mode」「抽取作业在 BackgroundJob 注册表可见」「`session.deleted` → stage-1 产物与作业清除」（`deleteSessionMemory` 无人调用）未实现。
- 模型回退链跳过「agent 定义 model」。
- 「记忆子代理会话豁免」仅靠 `parentID` 过滤（`exclude` 参数是死代码）。

**工单 05 — Consolidation 管线**
- **`memory_reset` 工具完全缺失**（「拒绝 symlink 记忆根后执行整体清除」）。
- 无 Flock/心跳租约（仅 DB 租约），与「跨进程 Flock 串行」不符。
- 「记忆选取按 usage 加权」缺失：`stage1Outputs` 只按时间排序、从不 join citations；`pruneOutputs` 从未调用。
- `rollout_summaries/` 从不写入工作区。
- `memorize` agent 为 `"*": "deny"`（全禁）vs 规格「文件工具 only」。
- inspect 缺 lastError（「inspect 可见错误」「近期错误」）。

**工单 06 — Citation 闭环**
- 无 `session:part` 去重键（依赖 processor 块恰好执行一次）。
- **子代理豁免缺失**：`processor.ts:822-830` 无任何豁免逻辑 vs 「记忆子代理会话…显式豁免（防自激振荡）」。
- 记账数字、入库文本干净度、豁免与降级路径无集成测试。

### (b) 范围蔓延（scope creep）

- `.gitignore` 的 `docs/`、`specs/`、`.analysis/`、`graphify-out/` 与任何工单无关。
- `memory_read` 做成通用分页工作区读取器（规格：「读 MEMORY.md 全文」）；`memory_search` 增加 case/context 选项（规格：「v0 LIKE/子串匹配」）。

### (c) 已实现但疑似错误

- `extraction.ts:129-136` 在**源会话的 ID** 下执行子代理 LLM 调用 — 规格：「记忆子代理会话」应在用户会话之外；与 consolidation 的合成 ID 做法也不一致。
- `consolidation.ts:236` — `git diff` 不含未跟踪文件，**新建文件**的手动编辑永远进不了整合 prompt，违反「该编辑体现在下次整合结果中（不被覆盖）」；`resetBaseline` 在无变更时 commit 退出码 1 → 假 `finishPhase2 failed`。
- `jobs.ts` `input_watermark` 只存不比 — 已抽取会话再有新活动后**永远不会被重新抽取**。

---

## 汇总

| 轴 | 发现数 | 最严重问题 |
|---|---|---|
| Standards | 16 项（10 硬性 + 6 基线） | memory 根路径六处散落的 Shotgun Surgery；`app-runtime.ts` 静态导入破坏「零成本跳过」 |
| Spec | 20 项（缺失 16 + 蔓延 2 + 疑似错误 3，含 1 项跨轴） | extraction 在源会话 ID 下执行子代理 LLM 调用 — 同时违反规格与 V2 会话权限不变量 |

**建议优先处理**（跨轴交集，按风险排序）：
1. extraction 会话身份问题（Spec (c) + Standards V2 不变量）— 权限与数据污染双重风险
2. 总闸失效：无条件 layer 合并 + 静态导入（Spec 01 + Standards #3）
3. 子代理 citation 豁免缺失（Spec 06）— 自激振荡风险
4. `git diff` 漏未跟踪文件 + 无变更 commit 假失败（Spec 05 (c)）
5. `resolveModel` 重复 + 路径六处散落（Standards #1/#2）— 后续所有工单的地基
