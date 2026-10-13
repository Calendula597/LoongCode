# LoongCode 记忆功能方案


---

## 1. 背景：LoongCode 的现状

LoongCode 是基于 OpenCode 二次开发的 AI 编程助手（bun workspace monorepo，Effect-TS 服务架构），核心包分工：

- `packages/core` — V2 会话核心：SessionV2、SessionExecution/Runner、Context Epoch、System Context、drizzle + SQLite 持久化
- `packages/loongcode` — V1 会话循环、Tool Registry、Agent 体系（`primary`/`subagent` 模式，独立权限与模型配置）

**与记忆相关的已有机制**：

- `packages/core/src/instruction-context.ts`：已实现 AGENTS.md 的**全局（用户配置目录）+ 项目向上发现**两级注入，作为 System Context Source 在每个安全 provider-turn 边界惰性刷新
- System Context / Context Epoch：上下文源快照比对、变更时产生持久的会中更新消息、按 agent 隔离并 fencing（切 agent 强制重建 baseline，上一个 agent 的特权上下文不泄漏）

**当前没有记忆功能的具体表现**：

1. **每次会话冷启动**：用户偏好（回答风格、工具习惯）、项目惯例（构建命令、测试约束）在每个新会话都要重新交代
2. **多 agent 无共享记忆**：产品/测试/开发等角色 agent 既无隔离（防任务污染）也无交接（结论传递），子代理会话结束后其发现随之蒸发
3. **跨会话工作无连续性**：昨天做到哪、为什么这么做，今天开新会话全部丢失

---

## 2. 为什么需要记忆功能

记忆功能的本质是**把已经付过的学习成本变成可复用资产**，四类场景对应四类价值：

| 场景 | 没有记忆的代价 | 有记忆的收益 |
|---|---|---|
| 个人偏好 | 每个会话重复说明"回答要简洁""测试从包目录跑" | 偏好建模一次，永久生效 |
| 项目/团队规范 | agent 产出不符合规范的代码，评审返工 | 规范成为 agent 每轮可见的约束，从源头对齐 |
| 多 agent 协同 | 长上下文任务污染；角色间结论靠人传话 | 职能隔离防污染 + 结构化交接 |
| 跨会话连续 | 新会话从零摸索，重复踩坑 | 经验教训沉淀，后来者直接读档 |

设计约束（本方案的前提决策）：

- **个人记忆**，不自建管线——LLM-Wiki式 或 opencode-codex-memory 插件或通过opencode-mem插件集成
- **公司/项目/团队规范落盘 AGENTS.md**——文件即权威源，进版本库可共享，人可直接编辑
- **团队记忆与多 agent 角色记忆外置**——接入 TencentDB-Agent-Memory，治理由专门服务承担

---

## 3. 方案

### 3.0 总览：三层分工

```
┌─────────────────────────────────────────────────────────┐
│ 个人记忆（偏好建模）                                       │
│   LLM-Wiki（Kimi 式 markdown）或 opencode-codex-memory 插件 │
├─────────────────────────────────────────────────────────┤
│ 公司 / 项目 / 团队规范（静态约束）                          │
│   分层 AGENTS.md → 每个 agent 每轮召回（System Context）    │
├─────────────────────────────────────────────────────────┤
│ 团队记忆 + 多 agent 角色记忆（动态协同）                    │
│   TencentDB-Agent-Memory 外置服务                        │
└─────────────────────────────────────────────────────────┘
```

三层的划分依据是**治理主体不同**：个人偏好归个人（文件自己管）、规范归组织（版本库管）、团队动态记忆归平台（Memory Hub 管）。

---

### 3.1 个人记忆

**目标**：让 agent 跨会话记住"这个人是谁、喜欢怎么工作"——回答风格、技术栈偏好、工作习惯、反复给出的纠正。

**两条可选路线（二选一或渐进）**：

**路线 A：LLM-Wiki**

- 存储：`~/.config/loongcode/memory/` 下的 markdown 文件，`MEMORY.md` 索引 + 按主题分文件（preferences.md、patterns.md…），frontmatter 标类型（user/feedback/decision/reference）
- 召回：索引注入系统上下文，全文按需读取；**人可直接编辑**（透明、可改、可删）
- 写入：模型经 memory 工具显式写入，准入规则（不存代码可推导的、存 why 不存 what、旧记忆先验证）写进工具描述

**记忆机制**：

**① 存储**

```
memory/
├── transcripts/days/<日期>/conv-<id>.jsonl   # 原料层：每日会话转录（不进上下文）
└── vault/                                    # 提炼层：Obsidian 风格 wiki（OFM 语法）
    ├── about_user.md     # 组装画像——唯一注入上下文的文件（脚本生成，模型禁写）
    ├── index.md / log.md # 实体目录 / 变更日志（脚本生成，只读）
    ├── sections/         # 6 个固定分区（模型可写）：personal_context / work_context
    │                     #   / this_month / earlier_months(脚本渲染) / taste / memory_tips
    └── entities/         # 实体卡片（模型可写）：people/ projects/ places/ concepts/
```

**② 写入：Dream Agent 夜间批处理，交互 agent 完全不碰记忆**

- 编排：`dream` 编排器在共享锁下运行 `vault-memory`（扫描未处理会话逐条提炼）与 `skill-summary`（复盘维护技能）等 feature
- 五阶段循环：**Phase 0 TRIAGE**（体检 + 判断今日有无持久信号，无则 `NO_UPDATE` 退出——**NO_UPDATE 是常态不是失败**）→ **INGEST**（读转录分流信号）→ **ENTITIES**（先建/改实体页，保证 wikilink 有真实目标）→ **SECTIONS**（重写分区正文，实体一律 `[[wikilink]]` 引用）→ **RETURN**（一行变更摘要进 log.md）
- **专用语义工具替代通用写文件**：`add_entity`（纯创建，已存在报错）/ `update_entity`（**先读再整合式重写**，零追加防流水账）/ `update_section` / `edit_file`（外科手术小修）/ `find_backlinks`（建页前查重）/ `vault_status`（体检）
- **模型只写散文，永远不写格式**：frontmatter、`[^N]` 溯源脚注、`## Sources` 块、命名规范化全由工具负责；写工具自动追加会话引用
- agent 退出后**脚本装饰器接管**：`decorate_sources → 跨月归档 → assemble_about_user → refresh_index → append_log → lint`

**③ 召回：全量注入，不做检索**

- 无向量库、无相似度检索、无 recall API；每次会话启动注入 `about_user.md`（**正文约 6000 字符**），包裹为 `<meta awareness="low">` 被动背景上下文（不是指令，agent 不回应只使用）
- vault 可以无限大，但进上下文的永远是一页简报；画像每条事实带 `[^N]: chat:conv-<id> · 日期` 脚注，需要细节时**回溯原始会话**而非塞进上下文
- 另一面：正因召回是全量注入，**每一字节都占预算，信噪比必须在写入侧强制执行**——这是写入纪律苛刻的根本原因

**④ 写入纪律（可直接搬进 memory 工具描述）**

- **反流水账**：整合重写代替追加；正文禁止"追问/纠正"等会话事件动词——未来的 agent 只需要沉淀后的事实
- **反巴纳姆**：换个用户也成立的句子（"这个人注重细节"）直接删
- **证据强制**：每条事实必须能在当日会话 grep 到原文，凭感觉的推断不算数
- **敏感红线**：医疗、金融账户、政治观点等静默丢弃，不记录也不声明


**路线 B：opencode-codex-memory 插件（LLM Wiki形式）**

- Codex 两阶段记忆管线的 OpenCode 移植：Phase 1 逐会话自动提炼 → Phase 2 git 基线 diff 整合，引用闭环反哺保留
- 优势：**无需模型自觉**，行为中自动挖掘偏好；产出含 skills/（记忆沉淀为可复用技能）
- 代价：持续的小模型调用开销、管线复杂度、插件 hook 依赖宿主版本
- 接入方式：LoongCode 保留 OpenCode 插件体系，直接安装即可，零核心改动

**它的记忆机制（作为插件具体怎么做记忆）**：

**① 存储：两处分治，均不碰宿主数据**

- `~/.local/share/opencode/memory.db`——插件自有 SQLite：Phase 1 提炼产物、作业队列（租约/冷却/退避）、会话元数据；**绝不读写宿主 opencode.db**（会话发现与历史全部走官方 API）
- `~/.local/share/opencode/memories/`——文件制记忆工作区，本身是一个 **git 基线目录**：
  - `memory_summary.md`：常驻注入的高密导航摘要（首行固定 `v1`，上限 2500 tokens）
  - `MEMORY.md`：可 grep 的记忆注册表（手册条目 + 指向 rollout 的指针）
  - `rollout_summaries/`：每个会话一份回顾（经验教训 + 证据片段）
  - `skills/`：沉淀出的可复用技能（SKILL.md + scripts/ + templates/）
  - `extensions/`：外部记忆交换区（Codex 互导 / Claude 导入）
  - `.git/`：基线仓库，用于生成增量 diff

**② 写入路径：两阶段全自动管线（模型无感）**

- **Phase 1 逐会话提炼**：会话首条消息与会话空闲时触发；进程内 30s 防踩踏 + DB 租约认领作业（并发 worker 不重复、失败退避重试）。流程：经宿主 API 拉取会话记录 → 过滤系统指令 → 密钥脱敏 → 派生 `memorize-extract` 提炼子代理 → 产出 `raw_memory` + `rollout_summary` 存入 memory.db
- **Phase 2 全局整合**：单例运行（6 小时 DB 冷却 + 全局租约）。流程：对记忆工作区做 git 基线 diff → **无变化直接收工**；有变化才派生 `memorize` 整合子代理，只读 diff 更新 `MEMORY.md` / `memory_summary.md` / `skills/` → 重置基线 → 通知读路径缓存失效
- **LLM 调用的实现**：插件拿不到模型凭证，两个阶段的子代理都通过宿主 HTTP API（`session.create` + `session.prompt`）创建，复用宿主的认证/计费，插件零凭证

**③ 读取路径：常驻摘要 + 渐进披露**

- 注入：经 `experimental.chat.system.transform` hook，每轮往 system 消息追加**字节完全相同**的 summary 块——刻意保持字节一致，让 provider 的 prompt 缓存命中（opencode 给前两条 system 消息打缓存断点，记忆块独占一段）；文件 mtime 不变则不重读
- 模型侧工具：`memory_read` / `memory_search` / `memory_list` / `memory_add_note`——渐进披露：summary 常驻 → 关键词 grep `MEMORY.md` → 确有必要才打开 `rollout_summaries/` 或 `skills/` 的 1-2 个文件，检索预算 ≤ 4-6 步

**④ 引用闭环（记忆保鲜机制）**

模型回复若使用了记忆，须在末尾输出 `<memory-citation>` 块（文件:行号 + 来源 rollout id）；`experimental.text.complete` hook 在消息持久化**之前**解析该块 → 记录 `usage_count` / `last_usage` → 从展示与历史中剥离。Phase 2 按引用数据选拔输入：`usage_count` 高者优先，超过 `max_unused_days` 未被引用的记忆被剪枝——**被用的留下，没人用的消亡**。

**⑤ 写入权分离与沙箱**

- 交互中的 agent **不能直接改权威记忆**——只能在用户明确要求时往 `extensions/ad_hoc/notes/` 写一个 `<时间戳>-<slug>.md` 便签；`MEMORY.md` 等权威文件由 Phase 2 整合代理独占写入，从机制上杜绝并发写打架与模型自觉漂移
- 无进程沙箱的 workaround：提炼代理只持有 `StructuredOutput` 合成工具（无文件/shell/网络能力，被污染的转录也无法诱导副作用）；整合代理工具白名单仅 `read/edit/write/glob/grep`，且子会话 `directory` 设为记忆工作区——借宿主的项目边界机制把文件操作锁死在记忆目录内

**⑥ 跨工具记忆交换（extensions 契约）**

与 Codex CLI 双向互导 consolidated 记忆（带来源标签 `[from codex]` / `[from opencode]` 防回声循环）、从 Claude Code 单向导入；交换区只是内容文件，整合代理读到即合并——不改读路径、不开第二个记忆根。

**⑦ 设计红线：memory is global**

刻意不做项目/agent 分区（对齐 Codex 不变量）——所以它适合承担"个人记忆"这一档，团队与多角色治理交给 §3.3。

**路线 C：opencode-mem 插件（语义检索档）**

- 形态：OpenCode 插件，SQLite 分片（user/project 双 scope）+ **本地 embedding 模型**（默认 nomic-embed-text-v1，可配 OpenAI 兼容端点）+ USearch 向量索引（ExactScan 兜底）
- 召回：`memory` 工具语义搜索（按相似度排序）；会话首条消息/compaction 后经 `chat.message` hook 自动注入最近 N 条
- 写入：`memory add` 手动 + **auto-capture**（每条用户消息后调小模型做结构化提炼，需配置 AI provider）
- 附加能力：Web 管理界面、用户画像自动学习、去重服务、隐私剥离、记忆时间线

**它的记忆机制（与路线 A/B 的本质差异）**：

- **召回哲学不同**：A 是"全带在身上"（全量注入一页画像）、B 是"带目录按需取"（摘要常驻 + 模型自主深挖）、C 是"用的时候语义搜"（embedding 向量相似度匹配）
- **embedding 是硬依赖（实测结论）**：`searchMemories` 第一步就把查询向量化，失败直接返回错误，**无 LIKE/FTS 词法兜底**；`addMemory` 也必须先向量化内容——**embedding 不可用时语义搜索失效、新记忆写不进去**。README 宣称的降级（USearch→ExactScan）只是向量索引实现替换，仍需要向量；"无 provider 仍可用"指的是提炼 LLM 而非 embedding
- **embedding 挂了之后的真实状态**：存量记忆"只读可用"——自动注入走 `listMemories`（按时间取最近 N 条，不过向量）、list 浏览与 Web UI 仍工作；但系统退化为**冻结的只读记忆库**
- **embedding 的价值区间**：解决"记忆写'用 bun'、查询说'包管理工具'"的措辞漂移失效——但在几百条以内 + 摘要写得好时很少致命（B 用模型读摘要自排序覆盖了大部分）；个人偏好记忆的量级下，embedding 是"有则更好、没有不疼"
- **默认的embedding模型是英文模型，对中文的支持不友好**

**三条路线选型建议**：

| 诉求 | 选 |
|---|---|
| 轻量、透明、人可编辑、零运行成本 | 路线 A |
| 全自动、无需模型自觉、记忆沉淀为技能 | 路线 B |
| 记忆规模大、措辞漂移严重、接受模型下载与持续调用成本 | 路线 C |


---

### 3.2 公司 / 项目 / 团队规范：AGENTS.md 分层落盘 + 每轮召回

**目标**：规范类记忆（公司编码标准、安全红线、团队工作流、项目架构约束）成为**每个 agent 每一轮都可见的约束**，且分层管理、可覆盖。

**做法：分层 AGENTS.md 文件体系**（参照 Kimi 的六级层级精简为四级）：

| 层级 | 位置 | 归属 | 共享方式 |
|---|---|---|---|
| 公司规范 | 组织级配置目录（如 `/etc/loongcode/AGENTS.md` 或公司统一下发路径） | 公司 | 制度下发，只读 |
| 团队/项目规范 | 仓库内 `AGENTS.md`（及 `.loongcode/rules/*.md` 模块化拆分） | 团队 | **进版本库**，随代码分发 |
| 个人全局偏好 | `~/.config/loongcode/AGENTS.md` | 个人 | 不进版本库 |
| 项目本地私有 | `AGENTS.local.md`（加入 `.gitignore`） | 个人×项目 | 不共享 |

**召回机制（LoongCode 原生能力，这是选 AGENTS.md 路线的根本原因）**：

现有的 `instruction-context.ts` 已经是一个 System Context Source：发现文件 → 渲染进 baseline → **每个 agent 的每个 provider turn 都在场**。需要做的扩展：

1. 发现目标从 `["AGENTS.md"]` 扩展为 `["AGENTS.md", "AGENTS.local.md"]` + 组织级目录（约几十行改动）
2. 优先级：**项目本地 > 项目/团队 > 个人 > 公司**（下层覆盖上层）


---

### 3.3 团队记忆 + 多 agent 角色记忆：接入 TencentDB-Agent-Memory

**目标**：多 agent（产品/测试/开发）围绕单项目协同时，记忆**有隔离（防任务污染）、有交接（结论传递）、有治理（人工审核）**。

**为什么是TencentDB-Agent-Memory**： **team/task/agent 隔离 + shared/isolated 双召回模式**；TencentDB 额外提供 L0→L3 分层沉淀、Skill 库审核共享、`private/team/restricted` ACL 和人工治理面板等功能。

**TencentDB-Agent-Memory 架构介绍**：

整体由四个组件构成（可一键部署三件套：core + hub + proxy）：

| 组件 | 端口 | 职责 |
|---|---|---|
| **MemoryCore** | 8420 | 记忆的存储与处理核心：L0–L3 分层记忆、Skill 提炼与管理、Team/User/Agent/Task 元数据；SQLite 存储，BM25 内置、可选 OpenAI 兼容 embedding；对外是 HTTP Gateway（v2 兼容接口 + v3 强隔离数据面） |
| **MemoryKnowledge** | 8421 | 知识服务：LLM-Wiki（文档 → LLM 结构化页面 → FTS5 + 知识图谱）与 CodeGraph（git 仓库 → 符号/调用/文件树索引），通过 `/v3/tools/list` + `/v3/tools/call` 让 agent 自发现、按需调用 |
| **MemoryPanel** | 8123 | 团队记忆控制台（Web）：团队/用户/Agent/任务管理，资产的登记、审核、可见性分配与配装 |
| **MemoryProxy** | 8096 | 透明 LLM 请求代理：agent 不改一行代码，把模型端点指向它即可获得会话初始化（选 team→agent→task）、上下文注入、对话回写、鉴权限流与计费 |

核心设计有三点：

1. **记忆逐层生长，而非平铺记录**：每轮对话先存 **L0**（原始对话），异步 Pipeline 逐层提炼——**L1 Atom**（事实/偏好/约束/事件）→ **L2 Scenario**（场景化知识块）→ **L3 Persona**（长期画像）。召回也分层：平时用 L2/L3 快速进入语境，需要具体事实时经 BM25 + 向量 + RRF 回到 L1/L0；注入受条数、字符预算、超时限制，防止记忆反噬上下文。
2. **记忆是 Agent 的"装备"（Loadout），不是全局 Prompt**：Chat Memory、Skill、Wiki、CodeGraph 统一登记为 Memory Asset，Memory Hub 通过 **Fixed Binding + ACL**（Team/User/Agent 三维 + `private/team/restricted` 可见性）决定每个 Agent 能装配哪些资产——团队共享经验但不必共享隐私，换 agent 只需重新装配。
3. **注入策略区分冷热**：L2/L3 直接注入 system prompt；**L0/L1 以只读工具形式暴露**给模型主动查询——刻意避免高频内容撑爆上游 KV cache。

- **MemoryProxy 透明代理（零代码）接入**——把 LoongCode 的 provider baseURL 指向 MemoryProxy，会话初始化/注入/回写全自动。
- ****——把 LoongCode 的 provider baseURL 指向 MemoryProxy，会话初始化/注入/回写全自动。
- **TencentDB-Agent-Memory支持将AGENTS.md等文件作为团队资产进行管理与分配**

---

## 4. 落地路线

| 期 | 内容 | 依赖 | 规模 |
|---|---|---|---|
| **P1** | 个人记忆路线 A：`memory` 工具 + 记忆目录 + 索引注入（可复用 System Context 机制） | 无 | ~300 行 |
| **P2** | 规范分层：instruction-context 扩展（AGENTS.local.md + 组织级目录 + 优先级） | 无 | ~50 行 |
| **P3** | TDAI 接入：client + recall 源 + capture 钩子 | 部署 Memory Hub | ~300 行 |

---

## 5. 风险与开放问题

1. **双源一致性**：个人记忆（3.1）与规范（3.2）都注入上下文，需约定分工——规范写"必须遵守的约束"，个人记忆写"偏好与经验"，避免同一事实两处维护
2. **AGENTS.md 膨胀**：公司/团队规范全量每轮注入有 token 成本；需控制规模（大项目用 `.loongcode/rules/` 拆分 + path 条件化，后续演进）
3. **TDAI 可用性**：外置服务不可达时 recall 走 stale-while-revalidate 降级，但团队记忆完全依赖其部署质量，需纳入团队 infra SLA
4. **插件共存**：路线 B 插件与 P1 内建工具撞名时，仓内现有行为是插件静默覆盖（`session/tools.ts` 键控装配），需加检测与让位提示
