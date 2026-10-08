# 双轴代码审查报告 — 第二轮（未提交工作区）

- **审查日期**：2026-09-03
- **方法**：第二轮采用两个独立子代理 —— ①**对抗性验证**：逐条复核第一轮报告（`review-working-tree-2026-09-03.md`）的 29 项结论；②**深度挖掘**：第一轮未覆盖的维度（并发/租约、SQL 正确性、脱敏健壮性、citation 解析健壮性、路径安全、测试断言质量、数据丢失风险、prompt 质量）。
- **重要结论**：第一轮存在**大量误报**，其此前认定的最高优先级问题（extraction 会话身份、git diff 漏未跟踪文件）**均为误报**。第一轮报告不应再作为修复依据，以本报告为准。

---

## 一、第一轮结论复核

### ✅ 确认成立（14 项）

| # | 结论 | 证据 |
|---|---|---|
| S6 | `jobs.ts` if/else 可早返回 | jobs.ts:210/217, 338/355, 127/138 |
| S7 | `store.ts` let 重赋值 | store.ts:60-65 |
| S8 | `as unknown as Record<string, any>`（行号已漂移） | extraction.ts:135, consolidation.ts:110 |
| S9 | 裸 `fs/promises` | database.ts:7（:40 使用） |
| S11 | registry 重复实现 `use_memories` gating | registry.ts:209-210 vs context.ts:46 |
| S12 | `dbUsage`/`reclaimStaleStage1`/`phase2Status` 仅测试调用；`pruneOutputs`/`deleteSessionMemory` **零调用方** | jobs.ts |
| S16 | `index.ts:46-66` 直查 `MemoryTable`，重复 `MemoryJobs.phase2Status`（jobs.ts:394） | — |
| P1 | 钳制贴边而非回落默认、无 warning 机制、age 0-90 vs 规格 1-30 天 | options.ts:25-28, :38 |
| P2 | **总闸失效**：无 `memory` 节仍无条件合并 layers、建 `memory.db`、注册空 source | app-runtime.ts:83-85, database.ts:40, builtins.ts |
| P3 | `memory_inspect` 不回显警告（`report.warnings` 整个被丢弃） | memory-inspect.ts:30-44 |
| P4 | 工单 02 测试只覆盖 disabled 路径 | memory-context.test.ts |
| P5 | `memory_list` 无 session/usage 元数据；`add_note` 无重复主题辨识 | memory-list.ts:27-28, store.ts:125 |
| P6 | 首条消息 stamp、BackgroundJob 可见性、`session.deleted` 清理未实现；`exclude` 参数死代码 | — |
| P7 | 无 Flock/心跳、usage 加权缺失、`pruneOutputs` 未接线、`rollout_summaries/` 不写、`memorize` 为 deny-all、inspect 无 lastError | — |
| P8 | citation 无 `session:part` 去重键；记账/干净文本/降级无集成测试 | processor.ts:831-838 |
| P10 | `memory_read` 通用分页读取器；`memory_search` 超规格选项 | memory-read.ts:5-11, memory-search.ts:12-14 |

### ❌ 推翻（第一轮误报，13 项）

| 第一轮结论 | 事实 |
|---|---|
| ~~S1 `resolveModel` 逐字复制~~ | `shared.ts:15` 已有共享实现；结构化输出形状也共享（shared.ts:32-67）。仅模型解析**分支**部分重复，严重度大降 |
| ~~S2 根路径 6 处散落、`MemoryPaths.workspace` 死代码~~ | 实为 4 处（store.ts:44, workspace.ts:31, context.ts:49, database.ts:49）；`consolidation.ts:56` 在用 `MemoryPaths.workspace`，**非死代码** |
| ~~S3 静态导入破坏零成本跳过~~ | `app-runtime.ts:54-56` 只导入 Memory/Scheduler/Store；Extraction/Consolidation 是**动态导入**（scheduler.ts:26-27） |
| ~~S4 star import~~ | `processor.ts:34` 是具名导入 `{ Option }` |
| ~~S5 try/catch~~ | 实际用 `Effect.catchCause`（extraction.ts:164, consolidation.ts:160） |
| ~~S10 scheduler cast+discard~~ | scheduler.ts:50-53 正常使用 sessionID |
| ~~S13 两套租约活实例~~ | Extraction/Consolidation 不在 AppLayer，按次 kick 构建并 scoped-disposed（scheduler.ts:28-47） |
| ~~S14/P11 **extraction 用真实会话 ID**（原第一号优先问题）~~ | 用合成 `"memory-extraction"` ID（extraction.ts:28,133-134），与 consolidation 一致 |
| ~~S15/P9 .gitignore 混入无关条目~~ | 当前树 `.gitignore` 已无此变更（第一轮后工作区有变动） |
| ~~P4 教学文本在头部~~ | `CITATION_GUIDANCE` 是渲染尾部最后一项（context.ts:26,30），**符合规格** |
| ~~P5 五工具全被门控~~ | 4 工具门 `use_memories`，inspect/reset 只门 memory 存在（registry.ts:256-257），**符合规格** |
| ~~P7 `memory_reset` 完全缺失~~ | 工具**存在**（memory-reset.ts, registry.ts:256），且含 symlink 守卫（workspace.ts:64） |
| ~~P8 子代理 citation 豁免缺失~~ | 豁免**存在**（processor.ts:41-42, 834） |
| ~~P12 git diff 漏未跟踪文件（原第四号优先问题）~~ | `captureDiff` 先 `git add -A` 再 `diff --cached`（consolidation.ts:214-216）；`resetBaseline` 空状态早返回（:227） |
| ~~P13 永不重抽取~~ | re-claim 由 `sourceUpdatedAt` 比较驱动（jobs.ts:57-60）——但方向反了：**总是重抽取**，见新发现 N2 |
| ~~P6 回退链跳过 agent model~~ | `agent.model` 优先检查（extraction.ts:124-126）；实际偏差是**优先级倒置**（agent 压过显式配置），降级为低优先 |

### ⚠️ 修正（4 项）

- **S1** → 降级：仅模型解析分支重复。
- **S2** → 收窄：4 处而非 6 处。
- **P6** → 改写：回退链存在，问题变为 agent model 优先级高于显式配置。
- **P13** → 反转：不是"永不重抽取"，而是"总是重抽取"（见 N2）。

---

## 二、深度挖掘新发现（第一轮未覆盖）

### HIGH

**N1 — claim 竞态：读后写，无 CAS/事务** `jobs.ts:49-110, 319-375`
两个进程可同时读到过期/done 行、各自 UPDATE、各自返回 `true` → **extraction/consolidation 双重执行**。首次插入竞态撞唯一索引时 `orDie` 缺陷逃逸（claim 发生在 extraction.ts:163 / consolidation.ts:160 的 `catchCause` **之前**），直接杀死调度 kick fiber。

**N2 — 重抽取死循环：无界 LLM 开销** `extraction.ts:101` vs `jobs.ts:60`
`claimStage1` 收到 `sourceUpdatedAt: Date.now()`，而 `completeStage1` 也存 `Date.now()` → claim 时间永远更新 → done 作业**总是被重新 claim**。每个 idle 事件（外加 6h 扫描）都对最老的 2 个会话重复抽取，持续 10 天 —— 无界 LLM 花费。`memory-jobs.test.ts:53-63` 用合成时间戳（1、2）掩盖了该分歧。

**N3 — skills 路径穿越：任意文件写入** `consolidation.ts:152`
`writeFile(\`skills/${skill.name}/SKILL.md\`)` 直接拼接 LLM 控制的 `name`，无穿越守卫（`store.resolve` 存在但此处未用）—— `name: "../../…"` 可逃逸记忆根**写入任意文件**；被注入的转录内容可操纵它。

### MEDIUM

**N4 — 无心跳 + 无条件完成** `jobs.ts`
租约 claim 时写一次（1h）后不再续期；`worker_id`/`ownership_token` 事后无人校验（token 即行 id，jobs.ts:61）。`completeStage1`/`finishPhase2` 无条件执行 —— 过期 worker 可覆盖新 claim。

**N5 — `recordUsage` 丢失更新** `jobs.ts:201-224`
SELECT 后在应用层 `usage_count + 1`，非 `SET usage_count = usage_count + 1`；并发会话完成时丢计数（processor 按会话并发运行）。

**N6 — 脱敏盲区** `store.ts:122-128` + `consolidation.ts:111-130`
脱敏只应用于 extraction 转录；`memory_add_note` 内容与 consolidation prompt（rawMemories + 工作区 diff，含已提交基线的便签）**不脱敏** —— 秘密直达磁盘、git 历史与整合 provider，仅靠 prompt 规则兜底。

**N7 — citation 无数量上限** `processor.ts:831-838`
`cited.length` 无 cap；垃圾/超大 `session_ids` 数组在持久化路径上每 id 同步执行 2 条 SQL。（正则本身 backtrack 安全、畸形输入不会崩溃 —— 已验证。）

**N8 — 非原子工作区写入 + "undefined" 入 prompt** `consolidation.ts:58, 92-94, 147-156`
`readFileStringSafe` 对缺失文件返回 `undefined`（fs-util.ts:56-61），全新安装时 prompt 会嵌入字面 `"undefined"`。写入为直接覆盖（无 temp+rename）；写序列中途死亡留下半更新工作区且无基线 commit —— 下轮把半成品文件当"现状"。

**N9 — 测试质量** 全部 6 个 core 测试文件
均为单进程顺序 happy path；无并发 claim 测试、无 fake clock、无端到端 citation processor 测试；Phase2 租约过期与插入竞态未测。

### LOW

**N10** — `Stage1OutputTable` 无 `session_id` 索引（sql.ts:27-37），`completeStage1`/`pruneOutputs`/`deleteSessionMemory` 全表扫描；`Phase2JobTable.last_success_watermark` 从不写入。
**N11** — `git diff` 输出无 `maxOutputBytes`（consolidation.ts:216-218），`truncated` 标志被忽略 —— 大型手动编辑会淹没 prompt。
**N12** — `redact.ts` 不覆盖 JWT/AIza/basic-auth-URL/base64/多行 YAML；过度脱敏含 "token"/"key" 的行（如 `token_count = 5000`）。工具输出已应用脱敏（extraction.ts:89）—— 这点是对的。
**N13** — `..` 逃逸已挡，但工作区内**读取跟随 symlink**；`reset` 只检查根本身（store.ts:46-48, workspace.ts:64）。
**N14** — `rollout_slug` 提取后被静默丢弃（extraction.ts:154-160）；prompt 与 schema 匹配良好。

---

## 三、修订后的优先级（替代第一轮末尾建议）

| 优先级 | 问题 | 类型 |
|---|---|---|
| 1 | **N3** skills 路径穿越 → 任意文件写入（LLM 可被注入引导） | 安全 CRITICAL |
| 2 | **N1** claim 读后写竞态 + `orDie` 逃逸杀调度 fiber → 双重执行 | 并发 HIGH |
| 3 | **N2** 重抽取死循环 → 无界 LLM 花费 | 成本 HIGH |
| 4 | **P2** 总闸失效：无 memory 节仍建库/注册组件 | 规格 HIGH |
| 5 | N4 心跳缺失 + 无条件完成；N5 usage 原子性；N6 脱敏盲区；N8 非原子写入 | MEDIUM 组 |
| 6 | S12 死代码接线决策（`pruneOutputs`/`deleteSessionMemory` 零调用）；P1 配置钳制/warning | 收尾 |

> 与第一轮的差异说明：第一轮的"extraction 会话身份"与"git diff 缺陷"两大优先项经核实均为误报，勿据此修改代码。
