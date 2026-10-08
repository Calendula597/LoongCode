# 代码审查最终报告 — 第四轮验收（未提交工作区）

- **审查日期**：2026-09-03
- **方法**：①修复验证——逐条核实第三轮权威清单（F1-F5、N4/N8/N9 等）在当前树上的端到端状态；②工单验收——六张工单 checkbox 逐一对照实现与测试；③新鲜眼扫描——针对第三轮之后新改动（system.ts/prompt.ts/processor.ts 的 F1 修复）找新引入问题。
- **本轮背景**：工作区再次变动——新增 `packages/loongcode/src/memory/prompt.ts`（MemoryPrompt），`system.ts` 暴露 `memory()`，`prompt.ts` 把记忆块拼入 V1 system prompt，scheduler 加了 fork 与 in-flight 守卫，jobs/consolidation 加了 token 守卫与原子写入。**这是针对第三轮 F 系列的修复提交前状态。**

---

## 一、第三轮优先清单验收：7/8 端到端修复 ✅

| 优先级 | 第三轮问题 | 判定 | 证据 |
|---|---|---|---|
| 1 | F1 读路径断开（CRITICAL） | ✅ **FIXED** | `sys.memory()` → `MemoryPrompt.summary()`（system.ts:111-115）进入 V1 prompt 组装（prompt.ts:1327-1336）；读真实工作区 `memory_summary.md`（与 consolidation 写入同一路径，prompt.ts:44）；`memory` 节 + `useMemories` 双重 gating（prompt.ts:39-42）；2500×4 截断（:47）；CITATION_GUIDANCE 在内（:48）；缺文件 → `undefined` 安全降级。旧 V2 registry 路径仍在但仅 V2 消费，无双重注入。排除 `memorize*` 子代理 ✅ |
| 2 | F2 idle kick 内联阻塞（HIGH） | ✅ **FIXED** | 监听器 `Effect.forkIn(serviceScope)`（scheduler.ts:77-83），会话收尾不再被管线阻塞 |
| 3 | N4 残留：产出 upsert 无 token 守卫 | ✅ **FIXED** | `completeStage1` ownership-token 守卫 UPDATE + `changes()` 校验 + 早返回（jobs.ts:141-190） |
| 3 | N8 残留：工作区写入非原子 | ✅ **FIXED** | temp + `rename` 原子写入（consolidation.ts:84-88, 174-179） |
| 4 | F4 配置双管线分叉 | ✅ **FIXED（V1）** | `MemoryPrompt` 消费 app `@/config/config`（prompt.ts:5,39），与工具 gating 同源同默认（registry.ts:211-212, options.ts:34）。core `MemoryContext` 仍读 per-location config —— 仅 V2 路径，残留可接受 |
| 5 | F5 淘汰不可达 | ✅ **FIXED** | `pruneOutputs(maxUnusedDays)` 已接入每次 kick（scheduler.ts:67）。`memory.deleted` 事件仍不存在 —— 剪枝静默发生，但链路可达 |
| 6 | F3 kick 无合并 | ✅ **FIXED** | `Ref` in-flight 守卫（scheduler.ts:27-34, finally :72-74）。注意：重叠 kick 被**丢弃**而非排队 —— 长 kick 期间 idle 的会话要等 6h 重扫。可接受 |
| 7 | 尾项 | **基本修复** | `last_success_watermark` 死列已删；死 barrel `core/src/memory.ts` 已删；N13 symlink 读取维持 LOW；**N9 测试盲区仍在**（见下） |

---

## 二、六张工单验收：全部 PARTIAL

| 工单 | 判定 | 未达成项 |
|---|---|---|
| **01 地基** | PARTIAL | ①「memory 节缺省时不创建任何文件/目录、不注册组件、无损耗」—— `AppLayer` 仍无条件合并三层（app-runtime.ts:83-85），无节也建 `memory.db`+WAL+迁移、调度 fiber 照常启动。**← 唯一 ship 阻塞项**。②「未知 key 记 warning」无实现。③集成测试只覆盖 inspect 空态 |
| **02 Summary Source** | PARTIAL | 「摘要变化 → 恰好一条 durable Mid-Conversation Message」：V1 侧每步重读文件、无 durable 消息；V2 侧 reconcile 无测试。「testEffect 范式断言 initialize/reconcile/update」未满足（memory-context.test.ts 只测空 baseline） |
| **03 工具面** | PARTIAL | `memory_list` 仍只返回 `{path, kind}`（缺 session/usage 元数据）；无 SessionV2+fake LLM 工具级测试；`add_note` 仍 `note-<ts>.md` 无主题辨识 |
| **04 Extraction** | PARTIAL | `memory_mode` 控制工具与首条消息 stamp 缺失（repo 全树无 hit）；`deleteSessionMemory`（jobs.ts:337）死代码、`session.deleted` 无接线；BackgroundJob 注册表可见性缺失。核心循环（闲置/年龄窗、脱敏、回退链、CAS 租约、有界重试、子代理排除）**扎实且有测试** |
| **05 Consolidation** | PARTIAL | 「usage 加权」未实现：`stage1Outputs` 只按 `source_updated_at` 排序；`pruneOutputs` 按 time 而非 `last_usage` 剪枝。「flock worker 范式跨进程测试」未满足（仅进程内 DB 测试）。文件工具子代理改为 StructuredOutput-only 属偏差，但穿越守卫/原子 rename/symlink 拒绝/git 基线均正确 |
| **06 Citation** | PARTIAL（最接近完成） | 行为全部实现（strip-before-persist、cap 16、子代理豁免、容错解析）；仅缺「记账数字/入库干净度/豁免降级」的 processor 级端到端测试 |

---

## 三、新鲜眼发现（F1 修复代码本身）

1. **零测试覆盖新读路径** —— `test/session/system.test.ts:48` 只 mock `MemoryPrompt → undefined` 并断言 skill 排序，对记忆注入与 memorize 排除**零断言**。F1 的修复没有任何测试守卫，回归将无感。
2. **`Effect.ignore` 吞掉记账错误**（processor.ts:838-840）—— `recordUsage` 的真实 DB 失败静默丢失，usage 数据缺失不可见。建议至少 log。
3. **summary 每步重读无快照**（prompt.ts）—— 每轮每步重读 config+文件，IO 可忽略，但会话中途 summary 文件被整合改写时**无快照语义**，同轮内可能读到不同版本。建议 session-scoped `Effect.cached`。
4. **无崩溃路径**（已排除）：`Agent.Info.name` 必填（agent.ts:38）；`Set.has(undefined)` 安全；MemoryJobs 缺席时 strip 仍执行、仅跳过记账 —— 行为正确。

---

## 四、最终结论

### Ship 判定：**No — with fixes**

**唯一 ship 阻塞项**：为 memory 引导加配置闸 —— 无 `memory` 节时不应创建 `memory.db`/WAL/调度 fiber（工单 01 第一条 checkbox，也是 CONTEXT.md「总闸」不变量）。

### 遗留清单（提交后可跟进，非阻塞）

1. V1 读路径端到端测试（system.test.ts 目前对注入零断言）—— 防回归
2. 工单 04 收尾：`memory_mode` 工具 + stamp、`session.deleted` 清理接线、BackgroundJob 可见性
3. 工单 05 收尾：usage 加权选取（join citations）+ 按 `last_usage` 剪枝
4. 工单 02：V1 侧 durable「记忆已更新」消息或明确降级说明
5. `memory_list` usage 元数据、`add_note` 主题辨识、未知 key warning
6. `Effect.ignore` 记账错误加日志；summary 会话级缓存
7. 测试补强：并发 claim、TestClock、flock 跨进程范式、processor 级 citation e2e
8. LOW：工作区内 symlink 读取（N13）；`memory.deleted` 事件缺失（静默剪枝）

### 四轮轨迹

| 轮次 | 发现 | 被后续推翻 |
|---|---|---|
| 1 双轴 | 36 项 | 13 项（45% 误报率的教训：对抗性复核必要） |
| 2 验证+深挖 | 推翻 13 + 新增 14 | 7 项（工作区重写修复） |
| 3 接线审计 | F1-F6（含 CRITICAL F1） | — |
| 4 验收 | F 系列修复验证 7/8 ✅，工单全 PARTIAL，1 个 ship 阻塞 | — |

> **收尾观察**：特性核心循环（抽取→整合→读路径→citation 记账）现已端到端连通且实现质量良好；剩余工作集中在**总闸、usage 加权、测试盲区**三块。建议先修总闸再提交，其余按遗留清单跟进。
