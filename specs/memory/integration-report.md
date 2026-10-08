# LoongCode 内置记忆系统集成报告

> 分支：`codex-tdai-memory` · 日期：2026-09-09 · 主要提交：`70c0d74d7`（core 管线）、`9265d40ad`（host 接线）
> 设计依据：`specs/memory.md`（分层总方案 v2 档）、`CONTEXT.md` Memory 术语表、`docs/adr/0002–0004`
> 移植源：`opencode-codex-memory`（OpenAI Codex 记忆系统的 OpenCode 插件移植）

---

## 一、这次集成干了什么

LoongCode（OpenCode 二开）获得了一套**本地优先、自动运行**的跨会话记忆能力，用户无需任何手动操作：

1. **自动学习（写路径）**——会话闲置 ≥6 小时后，后台小模型自动把该会话的转录提炼成"记忆笔记"（含秘密脱敏）；多条笔记再由主模型周期性合并、去重、淘汰，写入一份人可读的 Markdown 记忆工作区（`MEMORY.md` + `memory_summary.md` + `skills/` + `rollout_summaries/`）。
2. **自动召回（读路径）**——记忆摘要自动注入每个新会话的系统提示（附引用教学），模型也可以用 `memory_search` / `memory_read` 等工具主动查全量记忆。
3. **反馈闭环（citation）**——模型回答用到了记忆时在末尾发 `<memory-citation session_ids=[...]>` 暗号；宿主在持久化前解析、记账、剥离标记。使用次数驱动整合期的保留排序，30 天无引用的记忆被淘汰——记忆库不会变成垃圾场。
4. **完全可控**——`loongcode.json` 的 `memory` 节缺省即整体关闭（零成本跳过）；`generate_memories` / `use_memories` 独立开关写路径与读路径；`memory_reset` 是唯一破坏性清除入口。

设计不变量（来自 ADR 与 CONTEXT.md）：

- **记忆全局**：一份用户级存储，不按项目/Location 分区；项目仅作为内容里的软标签。
- **写路径在 host、读路径在 core**：注入走 core 的 System Context 机制；抽取/整合需要 provider 栈，住在 host。
- **学习不属于会话执行**：抽取/整合跑在合成子会话 ID（`memory-extraction` / `memory-consolidation`）下，不污染用户会话，子代理权限 deny-all。
- **迟到不丢失**：作业状态全部持久化在全局 `memory.db`，事件丢失/进程被杀只延迟、不丢失；claim 带 lease，硬杀后可被安全回收。

---

## 二、怎么集成的（架构与接缝）

### 2.1 总体架构

```
                    ┌─ 读路径（core + host 接线）──────────────────────────┐
                    │  SystemPrompt.memory() → V1 system prompt 注入摘要   │
  用户会话 ─────────┤  memory_read / search / list / add_note 工具         │
       │           │  processor text-end：citation 解析→记账→剥离→持久化   │
       │           └──────────────────┬───────────────────────────────────┘
       │ 闲置≥6h                      │ citation usage 记账
       ▼                              ▼
  ┌─ 写路径（host，后台）─────────────────────────────────────────────┐
  │ MemoryScheduler（idle 事件 + 6h 重扫 fiber + startup）            │
  │   ├─ Extraction：转录→脱敏→小模型结构化提炼→stage-1 落库           │
  │   └─ Consolidation：Flock式租约+git基线 diff→主模型重写工作区      │
  └──────────────────────────┬────────────────────────────────────────┘
                             ▼
        全局 memory.db（作业/产物/引用计数）+ memories/ 工作区（git 基线）
```

### 2.2 存储层（`packages/core/src/memory/`）

| 模块 | 职责 |
|---|---|
| `sql.ts` + `migration.ts` | 4 张表（stage1_jobs / stage1_outputs / citations / phase2_job），独立全局 `memory.db`，不经 per-Location 主库迁移 |
| `database.ts` | MemoryDatabase 服务：独立 SQLite 连接，`Layer.build` 前惰性建目录 |
| `options.ts` | 配置钳制（对齐 Codex 区间），缺省=全关 |
| `paths.ts` | `MemoryPaths.fromRoot()`——记忆根/工作区路径的**唯一**推导点 |
| `workspace.ts` | 工作区布局引导、inspect、`reset`（拒 symlink 根） |
| `store.ts` | memory_read/search/list/add_note 的纯 IO（路径越界守卫、便签脱敏） |
| `jobs.ts` | stage-1 / phase-2 作业状态机：**事务内 CAS claim**（条件 UPDATE + `changes()` 判定 + `onConflictDoNothing` 插入）、ownership_token 完成守卫、有界重试、悬挂回收、剪枝、原子 usage 递增 |
| `redact.ts` | 秘密脱敏（API key/JWT/AIza/URL basic-auth/私钥/赋值行），词边界防误伤 |
| `citation.ts` | `<memory-citation>` 解析/剥离（纯函数） |
| `context.ts` | core 侧 System Context Source（供 V2 runner 路径使用） |

### 2.3 宿主接线（`packages/loongcode/src/`）

**读路径（F1 修复的核心）：**

- `memory/prompt.ts`（MemoryPrompt 服务）：读摘要（截断 ~2500 token）+ citation 教学，gating 读 **app 配置源**——与工具同一管线。
- `session/system.ts`：`SystemPrompt.Service` 新增 `memory()` 方法。
- `session/prompt.ts:1327`：V1 生产循环组装 system 时并入 `memoryBlock`（`memorize*` 子代理不注入）。
- `session/processor.ts` text-end：持久化前 citation 解析 → 记账（按 part 去重、上限 16、子代理豁免）→ 剥离。

**写路径：**

- `memory/extraction.ts`：发现（`listGlobal` + `time_updated` 闲置/年龄窗口、最老优先）→ 转录拼装+脱敏 → `memorize-extract` 子代理 + 强制 StructuredOutput → 落库（watermark = 会话真实 `time.updated`）→ `rollout_summaries/<slug>.md` 落盘。
- `memory/consolidation.ts`：git 基线（init/commit/diff，含未跟踪文件、512KB 截断）→ `memorize` 子代理结构化重写 → **temp+rename 原子写**（skills 名经路径穿越守卫）→ 重置基线。
- `memory/scheduler.ts`：idle 事件 **fork 独立 fiber**（不阻塞会话收尾）+ 6h 重扫 fiber + in-flight 防抖；写管线**动态 import**——无 `memory` 节零成本跳过；每轮整合后执行剪枝。
- `memory/shared.ts`：`resolveModel` / `runStructured` / `memoryUser` 共享 helper。
- `agent/agent.ts`：隐藏 `memorize` / `memorize-extract` 子代理（deny-all 权限）。
- `tool/memory-*.ts`：7 个工具——4 读工具受 `use_memories` 门控，inspect/reset 控制工具仅受 `memory` 节存在门控。

**配置：** `loongcode.json` 的 `memory` 节（core `v1/config/memory.ts` + core `Config.Info` 同步注册）。

### 2.4 关键机制说明

| 机制 | 实现 |
|---|---|
| 缓存稳定注入 | V1 侧：摘要进 system prompt 数组；V2 侧：`memory/summary` Context Source，变更走 Mid-Conversation System Message |
| 跨进程防双写 | DB 事务内 CAS claim（读后写竞态消除）+ ownership_token 完成守卫 |
| 崩溃恢复 | 作业状态持久化 + lease 过期回收（`reclaimStaleStage1`）；硬杀只延迟不丢失 |
| 防自激振荡 | 子代理会话豁免 usage 记账 + 不注入摘要（读写两侧对称） |
| 成本控制 | 抽取小模型/整合主模型分离、每轮抽取上限、watermark 防重复抽取、citation 记账上限、diff 截断 |

---

## 三、质量过程

开发按 6 张 tracer-bullet 工单（`.scratch/builtin-memory-pipeline/issues/01-06`）实施，随后经历**三轮双轴代码审查**（报告见同目录 `review-*-round*.md`）：

- **第一轮**（29 项）：暴露工具面、配置、gating 等基础缺口 → 修复配置钳制、memory_reset、inspect warnings、路径统一等。
- **第二轮**（对抗性验证 + 深度挖掘）：推翻第一轮 13 项误报，新增 N1-N14 → 修复 CAS claim 竞态、重抽取死循环（watermark 改会话真实时间）、skills 路径穿越（安全 CRITICAL）、usage 原子递增、脱敏盲区、citation 上限等。
- **第三轮**（接线审计）：揪出真正的 CRITICAL——**读路径断开**（V1 生产会话看不到记忆，整条 usage 闭环死亡）→ 新增 MemoryPrompt 服务并接入 SystemPrompt/V1 循环；idle kick 改 fork 独立 fiber；剪枝接线；Stage1Output upsert 加 token 守卫；工作区写入原子化。

最终状态：`packages/core` 与 `packages/loongcode` typecheck 通过；core memory 套件 **56/56**、loongcode memory + SystemPrompt + AppLayer **7/7**。

## 四、已知边界与后续工作

- **双栈**：读路径已同时覆盖 V1（生产循环）与 V2（Context Source）；F4 所述 managed/plugin 配置分叉通过 MemoryPrompt 统一读 app 配置源解决，core `Config.Info` 的 `memory` 节仍保留供 V2 侧使用。
- **租约心跳**：phase-2 为 DB 租约 + 冷却，未做后台心跳续期（1h 租约内完成的现实约束下可接受，跨进程 CAS 已防双写）。
- **测试盲区**（审查 N9）：尚无多 fiber 并发 claim 压测、TestClock 用例、端到端 processor citation 集成测试。
- **未移植**：`codex_interop` / `claude_import`（跨系统互操作）、`disable_on_external_context`、embedding 检索（`specs/memory.md` 光谱的高端档）。
- 使用方式：在 `loongcode.json` 增加 `"memory": {}`（或带选项的节）即启用；删除该节即整体关闭（数据保留）；对话中说"记住 X"或调用 `memory_reset` 分别对应便签与全清。

---

## 五、常见问题

### 5.1 记忆总结调用的是哪个模型？

记忆系统有两个 LLM 调用点，各自有独立的模型解析链（只有写路径消耗 token；读路径——摘要注入与 memory 工具——是纯文本/纯 IO，零模型调用）。

**抽取（Phase 1，提炼会话转录）**，优先级从高到低（`extraction.ts`）：

1. `memorize-extract` agent 覆写的 `model`
2. `memory.extract_model`（`loongcode.json` 显式指定）
3. 全局 `small_model` 配置
4. provider 插件经 `experimental.provider.small_model` 钩子推荐的模型
5. 内置优先级列表（`claude-haiku-4-5` / `gemini-*-flash` / `gpt-5-nano`…；`tokenStore` provider 优先 `qwen3-30b-a3b` / `deepseek-v4-flash`）
6. 兜底：会话当前 provider 的默认模型

**整合（Phase 2，合并重写记忆文件）**，优先级从高到低（`consolidation.ts`）：

1. `memorize` agent 覆写的 `model`
2. `memory.consolidation_model`（显式指定）
3. 你的默认主模型（`defaultModel()`）

即：不配置时，**抽取走小模型、整合走主模型**——Codex 的 cheap-extraction / capable-consolidation 分法。

### 5.2 打包成客户端，记忆保存到哪里？

记忆落盘位置由 `Global.Path.data` 决定（`packages/core/src/global.ts`），底层经 `xdg-basedir` 解析——**与打包形态无关，只跟运行时用户主目录和环境变量有关**：

| 平台 | 数据根（`xdgData`） | 记忆完整路径 |
|---|---|---|
| Windows | `C:\Users\<你>\.local\share` | `C:\Users\<你>\.local\share\loongcode\memory\` |
| macOS | `/Users/<你>/.local/share` | `/Users/<你>/.local/share/loongcode/memory/` |
| Linux | `/home/<你>/.local/share` | `/home/<你>/.local/share/loongcode/memory/` |

目录内容：

```
<data-root>/loongcode/memory/
├── memory.db          ← stage-1 作业/产物/citation 计数/phase2 租约
└── memories/          ← Markdown 工作区（git 基线）
    ├── MEMORY.md
    ├── memory_summary.md
    ├── skills/
    ├── rollout_summaries/
    └── extensions/ad_hoc/notes/
```

两个要点：

1. **桌面客户端（Electron）不例外**：desktop 包只决定它自己的 `appData`（崩溃转储、日志等），LoongCode 服务进程（连同记忆）仍走上述 XDG 规则——记忆属于用户级数据，刻意设计为跨项目、跨入口共享（CLI 起的会话和桌面起的活动共享同一份记忆）。
2. **可重定向**：`xdg-basedir` 优先读 `XDG_DATA_HOME` 环境变量——客户端想自定义数据位置（如 portable 安装）设置该变量即可整体迁移。

因此：**记忆跟着用户走，不跟应用安装目录走**——卸载/重装客户端不会丢记忆；备份只需成对拷贝 `<data-root>/loongcode/memory/` 整个目录（DB 与 Markdown 工作区需一起）。
