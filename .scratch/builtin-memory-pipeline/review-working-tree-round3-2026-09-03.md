# 双轴代码审查报告 — 第三轮（未提交工作区）

- **审查日期**：2026-09-03
- **方法**：①**对抗性验证**——第二轮 N1-N14 均为单源结论，本轮逐条复核；②**接线审计**——前三轮从未验证过"整条管线是否真正连通"（配置→调度→抽取→整合→Context Source→citation→usage 闭环）；③**经验证据**——实际运行 typecheck 与测试（前两轮只读代码）。
- **⚠️ 重要背景**：**工作区在第二轮报告产出后发生了大幅变动**——extraction/consolidation 移至 `packages/loongcode/src/memory/` 并重写（CAS claim、路径守卫、脱敏扩展、citation cap 均已加入）。本轮所有行号与结论均针对**当前树**。第二轮报告的 N 项部分已失效，以本报告为准。

---

## 一、第二轮 N1-N14 复核结果

### ❌ 已被重写修复（7 项推翻）

| 第二轮结论 | 当前事实 |
|---|---|
| ~~N1 claim 读后写竞态（HIGH）~~ | `claimStage1` 已是事务内原子条件 UPDATE + `changes()` 校验，插入竞态走 `onConflictDoNothing`（jobs.ts:71-139）；`claimPhase2` 同样（jobs.ts:364-424） |
| ~~N2 重抽取死循环（HIGH）~~ | extraction.ts:103-117 已改传 `session.time.updated`；jobs.ts:98-101 仅在有更新活动时 re-claim；memory-jobs.test.ts:54-66 正好测此行为 |
| ~~N3 skills 路径穿越（HIGH）~~ | `resolveSafe` 守卫拒绝 `..`/绝对路径（consolidation.ts:68-79）；slug 已消毒（extraction.ts:184） |
| ~~N5 recordUsage 丢失更新~~ | 已是原子 upsert `usage_count = usage_count + 1`（jobs.ts:248-260） |
| ~~N7 citation 无上限~~ | `extractCitedSessionIds` 全局去重（citation.ts:33-38）+ `MEMORY_CITATION_CAP = 16` 截断（processor.ts:44, 837） |
| ~~N11 git diff 无上限~~ | 所有 git 调用已带 `maxOutputBytes: 512KB`（consolidation.ts:230-239），truncated 标志已呈现（:240-246） |
| ~~N14 rollout_slug 丢弃~~ | 已持久化到 `rollout_summaries/<slug>.md`（extraction.ts:183-188） |

### ⚠️ 部分确认 / 降级（7 项残留）

- **N4**（MEDIUM→LOW 部分）：`completeStage1`/`finishPhase2` 已有 ownership-token 守卫（jobs.ts:151-156, 439-445）；**残留**：`Stage1OutputTable` upsert 未被 token 守卫（jobs.ts:158-190），>1h 运行的过期 worker 仍可覆盖产出；`reclaimStaleStage1` 仍无生产调用方。
- **N6**（MEDIUM→LOW）：`addNote` 已脱敏（store.ts:126-130）、rawMemories 已脱敏（consolidation.ts:117）；**残留**：工作区 diff 与既有 MEMORY.md 进 prompt 未脱敏（consolidation.ts:134-148）—— 用户手写内容，风险低。
- **N8**（MEDIUM→LOW 部分）："undefined" 已修复（缺失文件 → `""`，consolidation.ts:61-65）；**残留**：写入仍是非原子直接覆盖（consolidation.ts:73-82, fs-util.ts:111-124），无 temp+rename；半成品文件会进入下轮 diff。
- **N9**（部分）：租约过期回收（memory-jobs.test.ts:121-133）、done 门控（:54-66）、phase2 双 claim 拒绝（memory-phase2.test.ts:20-29）已有测试；**残留**：仍无多 fiber 并发 claim 测试、无 TestClock、无端到端 processor citation 测试。
- **N10**（部分）：`session_id` 唯一索引已建（sql.ts:40）；**残留**：`last_success_watermark` 仍是从不写入的死列（sql.ts:61, migration.ts:64）。
- **N12**（降 LOW）：JWT/AIza/basic-auth/私钥模式已在（redact.ts:10-21），词边界已修 over-redaction（:26-27）；仅缺通用 base64/YAML。
- **N13**（LOW，维持）：仅查根 symlink；直接读取跟随工作区内 symlink（store.ts:52-58）—— 缓解：目录遍历不进入 symlink 目录（store.ts:84-89）。

---

## 二、接线审计新发现（F 系列）

### 🔴 F1 — CRITICAL：记忆读路径在生产中完全断开
`MemoryContext` 把 source 注册进 `SystemContextRegistry`（core/memory/context.ts:56），但该 registry 的唯一消费者是 core **V2** runner（core/src/session/runner/llm.ts:171）。**生产会话走 V1 loop**：所有 app 入口调用 `SessionPrompt.Service`（server/.../session.ts:51, control-plane/workspace.ts:174），其 system prompt 仅由 env+instructions+skills 组装（prompt.ts:1333），全 app 包零处引用 `SystemContextRegistry`。
**后果**：模型永远看不到 memory summary 与 citation 教学文本 → 永不发 citation → `recordUsage` 永不被真实会话触发 → **citation→usage→整合加权整条闭环静默死亡**。当前只有写入侧在跑：会后台抽取、整合，但用户毫无感知、usage 永远为零、30 天淘汰会清掉一切。
**佐证**：loongcode 侧唯一的 memory 测试只测了 `memory_inspect`，没有任何测试验证"会话里真的能看到记忆"。

### 🟠 F2 — HIGH：idle kick 内联跑在发布者 fiber 上
core `notify` 用顺序 `Effect.forEach` 执行监听器、不 fork（core/src/event.ts:418-428）；scheduler 监听器直接返回 `kick()`（loongcode/memory/scheduler.ts:50-53），完整抽取+整合 LLM 管线在 `status.set → publish(Idle)`（session/status.ts:82）→ processor.ts:955/981 的会话收尾流程中**内联执行**——会话完成被阻塞数分钟。

### 🟠 F3 — HIGH（降级后）：kick 无合并/互斥，可重叠
scheduler 无 in-flight 守卫；另一会话的 idle 与 6h 重扫 fiber 并发，各自 `Effect.scoped` 构建管线 + SQLite 连接。~~双重执行~~（N1 的 CAS 已挡住，验证代理确认）→ 现残留在**浪费与争用**：输掉 claim 的一方白跑整条发现扫描、白建连接。

### 🟡 F4 — MEDIUM：两条配置管线分叉，gating 不一致
scheduler/工具读 app `@/config/config`（实例缓存、可被 plugin 改写、支持 managed/remote）；`MemoryContext` 读 core 的 per-location config（location-layer.ts:61 → core/config.ts:139，location 打开时一次性重解析本地文件）。经 managed config 下发或 plugin 改写的 `memory` 节 → **工具启用但 summary 为空**（或反向）。

### 🟡 F5 — MEDIUM：`max_unused_days` 无消费者，usage 淘汰不可达
解析、钳制、inspect 显示俱全（options.ts:40, memory-inspect.ts:37），唯一功能汇 `MemoryJobs.pruneOutputs`（jobs.ts:310）**零调用方**；调度器从不排程剪枝；`memory.deleted` 事件在整棵树中不存在。与第二轮确认的 S12 同根。

### ⚪ F6 — LOW：死 barrel
`packages/core/src/memory.ts` + `core/memory/index.ts` 纯 re-export，生产代码无一处导入 `@loongcode/core/memory`（仅测试）。

**验证完好（不重复报告）**：config schema 注册链、scheduler 与 app 共享 memoized Config/EventV2 实例、per-kick scope 正确 dispose 且 SQLite 关闭（sqlite.bun.ts:163）、citation 教学格式与解析器逐字符匹配（tag/attribute/cap 16/子代理名单一致）。

---

## 三、经验证据

| 检查 | 结果 |
|---|---|
| `bun typecheck`（packages/core） | ✅ 通过（tsgo --noEmit 无输出） |
| `bun typecheck`（packages/loongcode） | ✅ 通过 |
| `bun test memory`（packages/core） | ✅ 27 pass / 0 fail（6 文件，67 断言） |
| `bun test memory`（packages/loongcode） | ✅ 1 pass / 0 fail |

注意：全部测试通过 + typecheck 干净，恰恰印证 F1——现有测试没有任何一个验证 V1 生产会话的记忆读路径，**绿灯是盲区的绿灯**。

---

## 四、最终权威优先级（第三版，替代前两轮清单）

| 优先级 | 问题 | 状态来源 |
|---|---|---|
| **1** | **F1 读路径断开**：V1 生产会话看不到 memory summary/citations，整条 usage 闭环死亡 —— 当前特性对用户实际是"只写不读" | 本轮 CRITICAL |
| **2** | **F2 idle kick 内联阻塞会话收尾数分钟**；应 fork 独立 fiber | 本轮 HIGH |
| **3** | **N4 残留 + N8 残留**：Stage1Output upsert 无 token 守卫（过期 worker 覆盖产出）；工作区写入非原子（崩溃留半成品且进下轮 diff） | 二轮残留 |
| **4** | **F4 配置双管线分叉**：managed/plugin 配置下工具与 summary gating 不一致 | 本轮 MEDIUM |
| **5** | **F5 淘汰不可达**：`max_unused_days`/`pruneOutputs`/`memory.deleted` 事件全链路无消费者 | 本轮 + S12 |
| **6** | **F3 kick 无合并**：CAS 已防双重执行，残留为浪费与争用；建议 in-flight 防抖 | 本轮降级 |
| **7** | 收尾项：死 `last_success_watermark` 列、N9 测试盲区（并发 claim/TestClock/端到端 citation）、N13 symlink 读取、F6 死 barrel、N12 缺 base64/YAML 模式 | 各轮残留 |

> **三轮累计轨迹**：第一轮 29 项 → 第二轮复核推翻 13 项 + 新增 14 项 → 第三轮确认工作区重写修复 7 项 + 接线审计揪出真正的 CRITICAL（F1）。教训：逐组件审查通过的代码，仍可能作为系统整体是断开的——F1 每个局部都"正确"。
