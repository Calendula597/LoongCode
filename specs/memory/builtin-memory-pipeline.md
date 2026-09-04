# Spec: LoongCode 内置记忆系统（codex 两阶段管线移植）

> 状态：ready-for-agent
> 日期：2026-09-03
> 前置文档：`specs/memory.md`（分层总方案，本 spec 落地其 v2 档）、`CONTEXT.md`（Memory 术语表）、`docs/adr/0002`–`0004`（架构决策记录）
> 移植源：`opencode-codex-memory`（Codex 记忆系统的 OpenCode 插件移植，本 spec 将其内化为 LoongCode 核心功能）

## Problem Statement

LoongCode 的每个会话都从零开始。用户在每个新会话里重复交代构建命令、代码风格偏好、各仓库的惯例和踩过的坑。会话结束，这些学习成本全部蒸发。现有 `specs/memory.md` 定义的分层方案中，v0（文件制手动记忆）与 v1（外置团队记忆）已规划，但**自动学习管线**——无需模型自觉、从已结束的会话中后台提炼持久记忆——尚无实现。用户希望：正常使用 LoongCode，记忆自动积累；换个项目、隔一周回来，agent 依然记得这个人怎么工作、这些仓库怎么构建。

## Solution

将 codex 两阶段记忆管线（经 `opencode-codex-memory` 验证的架构）内化为 LoongCode 的 V2 核心一等公民功能：

- **写路径（host 后台作业）**：会话闲置达标后，后台小模型从转录提炼记忆笔记（Extraction）；全局串行的整合作业将其合并、去重、淘汰进 Markdown 记忆工作区（Consolidation）
- **读路径（core Context Source）**：记忆摘要作为 `memory/summary` Context Source 进入 Baseline System Context，变更在安全 provider-turn 边界以 Mid-Conversation System Message 呈现；`memory_*` 工具支持模型主动检索
- **反馈闭环（citation）**：模型引用所用记忆，宿主记账并剥离标记，usage 驱动 30 天淘汰
- **全局单存储**：用户级 `memory.db` + `memories/` 工作区，无项目分区；发现与转录直查各项目 Session 表
- **配置**：`loongcode.json` 的 `memory` 节，出现即启用；`generate_memories`/`use_memories` 独立开关，关闭不删数据

## User Stories

### 记忆积累（写路径）

1. As a LoongCode 用户, I want 我结束的会话在闲置 6 小时后自动被提炼成记忆, so that 我不需要手动记录任何东西
2. As a LoongCode 用户, I want 抽取作业在后台静默运行, so that 我的交互体验不被 LLM 提取调用拖慢
3. As a LoongCode 用户, I want 多个已闲置会话被并行抽取（受每轮上限约束）, so that 记忆积累不会因会话数量而堆积
4. As a LoongCode 用户, I want 抽取在进程崩溃后于下次启动自动重试, so that 硬杀进程不丢记忆
5. As a LoongCode 用户, I want 会话转录中的 API key、token、密码在进入抽取前被脱敏, so that 秘密不进记忆库
6. As a LoongCode 用户, I want 超过 10 天未抽取的旧会话被跳过, so that 记忆库不被陈旧噪音污染
7. As a LoongCode 用户, I want 每轮抽取有条数上限（默认 2）, so that 单次后台预算可控
8. As a LoongCode 用户, I want 抽取失败有界重试后进入失败态并可在 inspect 中看到错误, so that 慢性失败可诊断而非无限重试
9. As a LoongCode 用户, I want 被删除的会话其记忆与作业一并清除, so that 删除会话是彻底的遗忘信号

### 整合（Consolidation）

10. As a LoongCode 用户, I want 零散的抽取笔记被周期性合并成一份连贯记忆（MEMORY.md + 摘要）, so that 记忆可读而非碎片堆积
11. As a LoongCode 用户, I want 十条相似观察合并为一条规则、矛盾被解决, so that 记忆密度随时间提升
12. As a LoongCode 用户, I want 整合作业跨进程串行（Flock 心跳租约）, so that 两个 LoongCode 窗口不会互相覆盖记忆
13. As a LoongCode 用户, I want 持有租约的进程崩溃后其租约因心跳停跳而被安全回收, so that 整合不会死锁
14. As a LoongCode 用户, I want 整合有冷却时间（默认 6h）, so that 小模型开销可预期
15. As a LoongCode 用户, I want 整合以 git baseline diff 驱动（只看上次成功以来的变更）, so that 我的手动编辑被保留并参与下次整合
16. As a LoongCode 用户, I want 30 天未被引用的记忆被淘汰, so that 记忆库不会无限膨胀
17. As a LoongCode 用户, I want 有价值的操作流程沉淀为 skills/ 目录下的技能文件, so that 记忆升级为可复用程序

### 记忆召回（读路径）

18. As a Loongcode 用户, I want 记忆摘要自动进入每个新会话的系统上下文, so that 新会话第一天就带着历史经验
19. As a LoongCode 用户, I want 摘要注入不破坏 provider 前缀缓存, so that 记忆功能几乎不增加 token 成本
20. As a LoongCode 用户, I want 会话进行中记忆被更新时收到一条按时间顺序的系统消息, so that 模型知道记忆变了而不用我重启会话
21. As a LoongCode 用户, I want 记忆变更不打断正在流式输出的回复、不唤醒空闲会话, so that 交互节奏不被后台作业干扰
22. As a LoongCode 用户, I want 模型能主动用 memory_search 检索完整记忆库, so that 细节问题（"上次那个部署脚本"）也能召回
23. As a LoongCode 用户, I want 模型能用 memory_read 读 MEMORY.md、memory_list 列出记忆清单, so that 模型有全部记忆面
24. As a LoongCode 用户, I want 我对模型说"记住 X"时它用 memory_add_note 落一条便签, so that 显式指示和自动学习共存
25. As a LoongCode 用户, I want 我手动编辑 memories/ 下的 Markdown 后变更在下一安全边界被感知, so that 人工编辑是一等公民
26. As a LoongCode 用户, I want 摘要有 token 上限（约 2500）, so that 注入成本小且可预测

### 引用反馈（citation 闭环）

27. As a LoongCode 用户, I want 模型引用所用记忆时宿主记账使用次数, so that 常用记忆被保留和强化
28. As a LoongCode 用户, I want citation 标记在持久化前被剥离, so that 我的界面和历史记录里永远看不到机器暗号
29. As a LoongCode 用户, I want 记忆子代理（memorize/memorize-extract）的会话豁免 citation 计数, so that 整合器不能给自己刷使用量
30. As a LoongCode 用户, I want 模型忘记发 citation 时系统静默降级, so that 不配合不产生任何故障

### 配置与控制

31. As a LoongCode 用户, I want `memory` 配置节缺省即整体关闭, so that 不要记忆的用户零成本跳过
32. As a LoongCode 用户, I want `generate_memories: false` 只停写入而保留注入, so that 我可以冻结记忆现状继续消费
33. As a LoongCode 用户, I want `use_memories: false` 停注入并隐藏工具, so that 我可以默默积累后再开闸
34. As a LoongCode 用户, I want 开关切换不删任何数据, so that 反悔零成本
35. As a LoongCode 用户, I want 显式 memory_reset 是唯一删除入口且拒绝 symlink 根, so that 误删和攻击面都被封死
36. As a LoongCode 用户, I want memory_inspect 回显生效配置（钳制后）、作业状态与近期错误, so that "为什么没记忆"可自查
37. As a LoongCode 用户, I want 指定 extract_model / consolidation_model, so that 抽取用便宜模型、整合用强模型
38. As a LoongCode 用户, I want 未指定模型时自动回退（小模型/主模型）, so that 零配置也能跑

### 数据与隐私

39. As a LoongCode 用户, I want 记忆全部存本地（一个 SQLite + Markdown 目录）, so that 可 grep、可编辑、可备份、可删除
40. As a LoongCode 用户, I want 备份=拷贝整个数据目录（DB 与工作区成对）, so that 恢复不出现状态错位
41. As a LoongCode 用户, I want 记忆跨项目共享（带项目来源标签）, so that 我的工作习惯跟着我进新仓库
42. As a LoongCode 用户, I want 抽取与整合子代理被沙箱化（无 shell/网络、文件权仅限记忆工作区）, so that 被污染的转录不能诱导副作用

## Implementation Decisions

> 领域词汇遵循 `CONTEXT.md` Memory 节（Memory / Memory Workspace / Memory Summary / Extraction / Consolidation / Memory Citation / Memory Sub-Agent）。架构决策见 ADR 0002–0004，此处只列 ADR 未覆盖的实现级决定。

### 模块与归属

- **core（`packages/core`）**：Memory Summary Context Source（stable key `memory/summary`）、System Context Registry 注册、memory 工具的 schema 与纯逻辑（读文件/检索/列目录/便签——纯 IO 无 LLM）
- **host（`packages/loongcode`）**：Extraction/Consolidation 后台作业、发现扫描、citation 剥离、memorize/memorize-extract 子代理定义、配置节、memory_reset/memory_inspect/memory_mode 控制工具
- 归属判据：进 Context Context 的在 core；需要 `llm.stream`/provider 栈/事件总线的在 host（ADR 0002）

### 存储

- 全局 `memory.db`（用户数据目录，全局路径服务解析）：表 `memory_stage1_jobs`（claim/lease/retry/状态）、`memory_stage1_outputs`（raw memory + rollout summary）、`memory_citations`（usage_count/last_usage，按来源 session 计）、`memory_phase2_job`（单行全局租约镜像——Flock 之外的 DB 态记录）
- `memories/` 工作区：`MEMORY.md`（全量索引）、`memory_summary.md`（注入摘要）、`raw_memories.md`、`rollout_summaries/`、`skills/`、`extensions/ad_hoc/notes/`（显式便签）、`.git/`（整合基线，复用仓内 git 服务而非 isomorphic-git）
- 表 schema 用 Drizzle snake_case，迁移走 core 统一迁移管线，但挂在全局 DB 而非 per-Location DB
- 会话发现与转录获取**直查各 Location 的 Session 表**（时间戳算闲置、parts 拼转录），不经 HTTP API

### 发现与调度

- 触发：host 启动扫描（最老优先）、`session.idle` 事件、低频重扫 fiber（默认 6h 周期）；首条消息 stamp memory_mode（enabled/disabled 快照，防中途开关导致语义撕裂）
- 闲置判定只信 durable 时间戳（`time_updated`），不信进程内存态
- 两阶段 claim 均带 lease：进程硬杀后悬挂行可被下个发现轮次安全 reclaim（对插件版 stage1 无 lease 缺陷的修正）
- 单进程内 in-flight 去重（同插件版 `phase1InFlight` 模式），跨进程靠 DB claim + Flock

### LLM 调用

- Extraction：`llm.stream` 小模型路径（`getSmallModel` 回退链：显式配置 → agent 定义 model → small model），structured output（json_schema），transcript 内联投喂、工具面只有结构化捕获工具
- Consolidation：主模型路径，工具面只给文件工具且 directory 绑定记忆工作区（子会话目录即记忆根，项目路径自然越界拒绝）
- 两类子代理注册为受限 agent（`"*": "deny"` + 显式 allowlist），citation 管线按 agent 身份豁免

### 读路径

- `memory/summary` Context Source：loader 读 `memory_summary.md`（mtime 缓存可选——System Context 惰性 reconcile 已天然按值比较），codec 取文件文本，baseline/update 渲染器纯函数
- 摘要截断 ~2500 token（chars/4 估算，与插件版一致）
- `use_memories: false` → 该 source 不注册 + memory 工具不进 Tool Registry + 注入指导文本不出现（读侧整体 gating）

### citation 管线

- 单一剥离点：V1 会话 assistant text part 持久化之前（对插件版三重冗余钩子的简化）
- 解析 `<memory-citation session_ids="[...]">` 尾块 → 记账（按 part 去重）→ 剥离后入库
- 注入指导（引用格式教学）附在 Memory Summary 渲染尾部，占注入预算

### 配置

- `ConfigMemory` 模块（config 目录自导出模式）：`generate_memories`、`use_memories`、`extract_model`、`consolidation_model`、`min_rollout_idle_hours`(1–48, 默认 6)、`max_rollout_age_days`(1–30, 默认 10)、`max_rollouts_per_startup`(默认 2)、`max_unused_days`(默认 30)、`max_raw_memories_for_consolidation`(默认 256)
- 数值钳制区间照搬 codex；未知 key 走现有 config 解析容错并记 warning
- 无 `memory` 节 = 总闸关（不注册任何记忆组件）

### 不做（本期明确排除，见 Out of Scope）

- `disable_on_external_context`、`codex_interop`、`claude_import` 不移植

## Testing Decisions

**好的测试只测外部行为**：给定种子数据（会话 + 时间戳）与 fake LLM 响应，断言可观察产物——DB 行、工作区文件内容、System Context 的 baseline/update 输出、工具返回、记账数字。不测内部调用序列、不 mock 内部模块。

**唯一新接缝：记忆管线 in-process 集成测试**（位于 `packages/loongcode/test/memory/`），组合：

- 临时目录作全局数据根（真 SQLite、真 memories/ 工作区、真 git baseline）
- fake `LLMClient.Service.stream`（沿用 `packages/core/test/session-runner.test.ts` 的 Layer.succeed 模式），按调用语义返回预置的结构化抽取结果/整合结果
- 时钟控制：注入可调 Clock 或直接种子 `time_updated`，模拟"闲置 6h+"
- 一条测试走全链：种子会话 → 发现断言（选中/排除理由）→ 抽取断言（脱敏、产物落库、状态迁移）→ 整合断言（文件重写、baseline 重置、冷却记录）→ Context Source 断言（baseline 渲染、变更 reconcile 产生 update 文本）→ citation 断言（记账 + 剥离 + 子代理豁免）

**复用既有接缝**：

- `SystemContextRegistry` 的 `testEffect` harness（`packages/core/test/system-context/`）——`memory/summary` 的 initialize/reconcile/DuplicateKey 语义，范本 `registry.test.ts`/`builtins.test.ts`
- `SessionV2.prompt` + fake LLM 的工具行为测试（`packages/core/test/tool-*.test.ts` 范本）——memory 工具的参数校验与返回
- Flock worker fixture（`packages/core/test/fixture/flock-worker.ts`）——租约抢占与陈旧回收（整合串行化的跨进程面）
- `background-job.test.ts`——作业在 BackgroundJob 注册表中的可见性

**明确不测**：真实 provider 调用、真实 token 计数、TUI 呈现。

## Out of Scope

- v0 文件制手动记忆与 v1 TdaiBackend 外置团队记忆（`specs/memory.md` 的另外两档，接口预留但不实现）
- `disable_on_external_context`（web/MCP 会话排除）、`codex_interop`（与 Codex CLI 双向同步）、`claude_import`（Claude Code 记忆导入）——插件版特性，待主环跑通后评估
- 神经 embedding 检索（光谱上留给插件/TDAI 档，见 `specs/memory.md` 4.2）
- 守护进程/常驻服务（本地优先哲学：进程不活不跑，接受延迟）
- V2 SessionExecution 内的后台工位整合（runner 的 bounded background work 是 planned 项，将来迁移，不阻塞本期）
- 多 agent 角色记忆治理（team/user/agent 三维隔离——v1/v3 档）

## Further Notes

- **对插件版已知缺陷的两处修正**：stage1 claim 加 lease（防硬杀悬挂）；citation 剥离点从三重冗余钩子收敛为单一持久化前管线
- **快关快用场景的承诺语义**：记忆"迟到不丢失"——durable 状态是权威，事件与进程只是加速器；10 天窗口是丢失上界
- **与 v0/v1 档的兼容**：`MemoryBackend` 接口（save/search/list/forget/recall）仍是三档统一面；本 spec 的管线产出落同一 Markdown 工作区，手动记忆（便签）与自动记忆在同一物理面合并
- **memory_reset 安全性**：拒绝 symlink 记忆根（防符号链接攻击重定向删除），与插件版一致
- 摘要注入的 cache 分段由 Baseline System Context 的持久化机制天然保证，无需插件版的 byte-identical append 技巧（ADR 0002）
