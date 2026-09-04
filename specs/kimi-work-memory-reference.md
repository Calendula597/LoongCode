# Kimi Work 记忆系统实现解析（参考底稿）

> 状态：调研整理稿
> 日期：2026-08-14
> 用途：为 LoongCode 三档记忆架构（见 `specs/memory.md`）提供一套已投产产品的完整对照实现。
> 信息来源：本机 `D:\KimiData\daimon-share\daimon\`（数据侧）与 `D:\KimiData\daimon-bundle\app\daimon\dist\src\core\memory\vault\`（规范与 prompt 侧）的实地核查，含一次真实 dream 运行的 wire 日志。

---

## 一、总体形态

Kimi Work 的记忆是**本地优先**的：全部数据存在用户机器上，无任何云端记忆服务。

```
D:\KimiData\daimon-share\daimon\agents\main\memory\
├── transcripts\days\<日期>\conv-<id>.jsonl   # 原始层：每日会话转录（原料，无限大）
└── vault\                                    # 提炼层：Obsidian 风格 Markdown 知识库
    ├── about_user.md        # 脚本组装的用户画像 —— 唯一注入上下文的文件（只读）
    ├── index.md             # 脚本生成的实体目录（只读）
    ├── log.md               # 脚本维护的 dream 变更日志（只读）
    ├── sections.yaml        # 组装配置（人工可编辑）
    ├── sections\            # 6 个固定分区（模型可写）
    │   ├── personal_context.md / work_context.md / this_month.md
    │   ├── earlier_months.md  # 脚本渲染的跨月归档视图（模型禁写）
    │   └── taste.md / memory_tips.md
    ├── entities\            # 实体卡片（模型可写）
    │   └── people\ / projects\ / places\ / concepts\
    ├── avatar.png           # 1-bit 像素头像（dream agent 用 generate_image 生成）
    └── runs\<日期--时间戳--uuid>\   # 每次 dream 的独立工作目录（agent.yaml / system.md / subagents / workspace）
```

核心设计决策：**写入侧重智能（模型整合），召回侧刻意做"笨"（全量注入）**。没有向量库、没有相似度检索、没有 recall API。

---

## 二、记忆（写入）过程：Dream Agent

### 2.1 触发与编排

三个系统工具组成流水线：

| 工具 | 类型 | 职责 |
|---|---|---|
| `vault-memory` | feature | 夜间扫描待处理的会话/日期转录，逐个启动 Dream Agent 运行提炼，随后执行装饰器与 lint |
| `skill-summary` | feature | 复盘近期对话，维护可复用技能 |
| `dream` | orchestrator | 在共享锁下依次运行已启用的 feature 工具 |

一次 `vault-memory` 运行的结果形如：
`rounds=1 ok=1 failed=0 decorators=decorate_sources,migrate_earlier_months,assemble_about_user,refresh_index,append_log lint=0`

每个待处理会话启动一个**独立的 Dream Agent 会话**（模型 k2d6-agent，yolo 权限模式），工作目录在 `vault\runs\<日期--时间戳--uuid>\`。

### 2.2 专用工具面（替代通用写文件）

Dream Agent **没有** `write_file`，只能用这组语义化工具：

| 工具 | 用途 | 工具自动负责的格式 |
|---|---|---|
| `vault_status(vault_root)` | Phase 0 体检：孤儿实体 / 肥胖页 / 过期项 | — |
| `read_file(file_path)` | 读 vault 文件；**返回时附带该文件专属的 schema `<system-reminder>`** | — |
| `find_backlinks(vault_root, name)` | 建实体前查重、追踪反链 | — |
| `add_entity(...)` | **纯创建**实体页，已存在则报错 | 路径 / 命名规范化 / frontmatter / `[^1]` 首引用 |
| `update_entity(...)` | **整合式重写**实体正文（须先 read_file） | 自动追加新会话引用 / 更新 frontmatter |
| `update_section(name, body, chats, dream_date)` | 重写分区正文（须先 read_file） | 自动引用 / frontmatter |
| `edit_file(file_path, old, new)` | 外科手术式修改（错字 / 改名 / 换过期事实） | 无自动引用 |
| `generate_image(...)` | 头像 | — |

**关键分工：模型只写散文，永远不写格式。** `[^N]` 脚注、`## Sources` 块、frontmatter、文件名规范化全部由工具/脚本生成；模型输入给写工具的只能是用户母语的纯散文。

### 2.3 五阶段 dream 循环

```
Phase 0  TRIAGE    vault_status + read_file(about_user.md)
                   → 判断今天有无值得记的持久信号；无 → 回 NO_UPDATE 退出（NO_UPDATE 是常态，不是失败）
Phase 1  INGEST    读当日会话转录，分流两类信号：
                   (a) 用户层面事实 → 分区；(b) 具体命名实体 → 实体页
Phase 2  ENTITIES  先建/改实体页（保证 wikilink 有真实目标）：
                   新增 → add_entity；更新 → 先读再"整合式重写"（零追加，防流水账）
Phase 3  SECTIONS  update_section 重写分区正文，已有实体一律 [[wikilink]] 引用；
                   小修小补用 edit_file（无新引用时）
Phase 4  RETURN    无写入回 NO_UPDATE；有写入回一行变更摘要（进 log.md）
```

Agent 退出后由**脚本装饰器**接管：`decorate_sources → migrate_earlier_months → assemble_about_user → refresh_index → append_log → lint`。

跨月归档全自动：脚本检查 `this_month.md` 每条 bullet 最新会话日期，上一自然月的条目移入 `sections/archived_month/<YM>/this_month.md`，`earlier_months.md` 只是该归档的渲染视图（`earlier_months_view_count: 3` 控制展示近几个月）。

### 2.4 每次 dream 注入的运行变量

| 变量 | 含义 | 用途 |
|---|---|---|
| `{DATE}` | 本次 dream 日期（ISO） | 传给写工具的 `dream_date` |
| `{LAST_DREAM_DATE}` | 上次 dream 日期 | 跨月检测 |
| `{DREAM_COUNT}` | 累计 dream 次数 | 冷启动（1-3）只记最确定的事实；成熟期（10+）提高门槛，多数 dream 应 NO_UPDATE |
| `{CHAT_ID}` | 当前处理的会话 | 写工具的 `chats:[...]` 参数 |
| `{TOTAL_CHATS}` / `{CHAT_IDX}` | 今日会话总数 / 当前序号 | 后面还有会话要处理时，不要基于单会话激进重写 |

---

## 三、Wiki 形式如何整理出来

### 3.1 信息分流（MECE）

- **分区存"稳定的形"，实体存"细节的土"**。自检问题："一年后读这行，它仍然为真且有助于认出这个用户吗？" 是 → 分区；否（具体引语、数字、单次事件）→ 实体页，分区只留 `[[wikilink]]`。
- 每条事实只有一个家。两处都合适时，身份锚定类事实优先分区，会话细节优先实体。
- 已建实体页的人/项目/地点/概念，在分区里**必须**用 `[[wikilink]]` 引用，禁止散文复述。

### 3.2 反退化机制

- **反流水账**：`update_entity` 要求把旧正文 + 新观察合成一篇"截至今日它是什么"的整体重写；正文禁止出现"主动纠正 / 追问 / asked / pushed back"等会话事件动词——下一个 Agent 只需要沉淀后的事实，不需要会话实况。
- **反巴纳姆**：任何换个用户也成立的句子（如"这个人注重细节"）是填充物，直接删。标准是"换一个用户这句话就不成立"。
- **证据强制**：写下的每条事实必须能在当日会话中 grep 到原文；凭"语气/感觉"的推断不算证据。用户原话用 `==高亮==` 标记。
- **敏感红线**（静默丢弃，不记录也不声明）：性取向、种族、未成年身份、医疗诊断、密码、政治观点、宗教信仰、金融账户、亲密关系细节。地址只到城市粒度。
- **语气**：写"事实盒"不写"人物素描"。例：记"这周三次说'别省略'"，而不是"对碎片化零容忍"。禁用句式："X 是个 Y 样的人" / "像 Y 一样" 等。

### 3.3 命名规范（工具强制执行）

原文优先不翻译（中文保持中文）；拉丁/西里尔/希腊文全小写、空格转 snake_case；保留变音符号（ã 不写成 a）；缩写和品牌也小写；别名/昵称不另建实体，进 `tags:`。

---

## 四、三类页面的模板

模板不在静态文件里——**`read_file` 读取任意 vault 文件时会动态追加该文件专属的 schema `<system-reminder>`**，模型读到什么文件就拿到什么模板。分区文件内的 `%%隐藏注释%%` 则是常驻的撰写指南（组装时剥离，不进注入上下文）。

### 4.1 实体页 `entities/<类别>/<name>.md`

```markdown
---
type: project            # person / project / place / concept
created: 2026-08-13
last_updated: 2026-08-13
next_source: 2           # 下一个溯源脚注编号
tags: [别名, 分类标签]
---
# 实体名

散文正文（≤ ~2000 字符，超限必须先整合压缩再写新内容）。
可含 ==用户原话==、[[其他实体]] 互链、决策历史、关系弧线。

## Sources               # 工具自动维护
[^1]: chat:conv-<id> · 2026-08-13
```

### 4.2 分区页 `sections/*.md`（6 个固定分区）

| 分区 | 职责 | 形态 |
|---|---|---|
| `personal_context` | 长期身份：姓名（原文+变音符）、国籍、**主要语言与表达习惯**（最高信号事实）、城市、家庭角色 | 1-5 句散文 + `[[wikilink]]` |
| `work_context` | 职业 + 当前焦点领域 | 1-3 句散文，多 `[[wikilink]]` |
| `this_month` | 活跃项目看板 | 5-8 条 bullet，每条 ≤1 行：`- [[project]] 状态短语. [chats:: ...]` |
| `earlier_months` | 近 N 月归档视图 | **脚本渲染，模型禁写** |
| `taste` | 持久审美/偏好轴 | 3-8 条，每条一句，带 ==原话== 理由 |
| `memory_tips` | 关于"记忆本身该如何对待此用户"的元认知 | 经常正确地为空；1-3 句 |

正文句尾可带 `[updated:: 日期] [chats:: UUID]` 元数据行；`## Sources` 由工具生成。

### 4.3 脚本产物（全部只读，模型禁写）

- `about_user.md` —— 按 `sections.yaml` 顺序拼接分区，frontmatter 带 `chars` 统计，**正文硬顶 6000 字符**（超限先压缩删除再写入；这是注入预算的源头）。
- `index.md` —— 按类别分组的实体目录（`[[name]] — 摘要 _日期_`）。
- `log.md` —— 每次 dream 追加 `## [日期 conv] ingest` 摘要。

`sections.yaml` 头部注释点明：**改 sections 列表即可重塑画像结构，无需改模型行为或脚本**——格式是数据驱动的。

---

## 五、召回（读取）过程：全量注入，不做检索

### 5.1 主路径：会话启动时被动注入

每次新会话启动，运行时读取组装好的 `about_user.md`，用 `prompts/awareness.md` 模板包裹后注入上下文：

```
<meta awareness="low">
# User Knowledge Memories (Dream Agent Edition)

Inferred from past conversations with the user, periodically
consolidated by the dream agent. These represent factual and contextual
knowledge about the user and should be considered in how a response
should be constructed.

{ABOUT_USER_BODY}        ← about_user.md 正文，≤6000 字符
</meta>
```

`awareness="low"` 表示这是**被动背景上下文**，不是指令：Agent 不回应它，只在构造回答时自然使用（例如决定回复的语言和语域——spec 把"用户语言习惯"称为最高信号事实，正因为它直接决定下一次会话的回复风格）。

### 5.2 分层容量

| 层 | 容量 | 进上下文 |
|---|---|---|
| 会话转录 `transcripts/days/*.jsonl` | 无限 | ❌ |
| 实体页 `entities/**/*.md` | 每页 ~2000 字符，数量不限 | ❌ |
| 组装画像 `about_user.md` | 硬顶 6000 字符 | ✅ 全量注入 |

vault 可以无限大，但进入上下文的永远是那份 6000 字符的"一页简报"。实体细节不进上下文——spec 原话 "Profile is the abstraction; `chats:` is the backup"：画像每条事实带 `[^N]: chat:conv-<id> · 日期` 脚注，需要细节时**回溯原始会话**，而非把细节塞进每次对话。

这也解释了写入侧规则为何苛刻：因为召回是全量注入，每一字节都占上下文预算，信噪比必须在写入时强制执行。

### 5.3 另外三条召回路径

1. **Dream Agent 自我召回**：每晚运行时通过 `prompts/memory_space.md` 拿到 vault 只读快照（实体索引 + 全部分区正文），用于去重与续写。该快照对 dream 只读，可作证据但**禁止抄进画像**。
2. **对话中按需召回**：用户问"你记得我什么"，Agent 用文件工具直接读 vault。
3. **可视化召回**：「我的记忆」看板的「记忆时间线」Widget。

---

## 六、记忆与召回用到的全部 Prompt

源文件位于 `D:\KimiData\daimon-bundle\app\daimon\dist\src\core\memory\vault\` 下：

| 文件 | 角色 | 注入对象 |
|---|---|---|
| `prompts/system.md` | Dream Agent 系统提示 | 写入侧（dream 会话） |
| `prompts/trigger.md` 与 `model-context/dream_trigger.md` | dream 触发提示（内容相同，含五阶段指令） | 写入侧 |
| `model-context/values.md` | Profile Update Spec v19（判断规则全集，259 行） | 写入侧（dream 时 read_file 读入） |
| `model-context/config.yaml` | 路径与变量配置（单一真理源） | 运行时 |
| `model-context/skills/obsidian-markdown/SKILL.md` | OFM 语法参考 | 写入侧 |
| `model-context/skills/about-me-avatar/SKILL.md` | 头像生成规则 | 写入侧 |
| `prompts/awareness.md` | 画像注入模板 | **召回侧（每次聊天会话）** |
| `prompts/memory_space.md` | vault 快照模板 | 写入侧（dream 自我召回） |

### 6.1 召回侧 prompt（完整原文）—— `prompts/awareness.md`

```
<meta awareness="low">
# User Knowledge Memories (Dream Agent Edition)

Inferred from past conversations with the user, periodically consolidated
by the dream agent. These represent factual and contextual knowledge about
the user and should be considered in how a response should be constructed.

{ABOUT_USER_BODY}
</meta>
```

### 6.2 Dream 自我召回 prompt（完整原文）—— `prompts/memory_space.md`

```
<meta awareness="low">
# Vault Memory Space

Read-only snapshot of the vault as it stood when this dream started.
Use it to ground updates: avoid duplicating what's already there; reach
into existing sections/entities by their canonical names when extending.

## Index of entities

{VAULT_INDEX}

## Section bodies

{VAULT_SECTIONS}
</meta>
```

### 6.3 Dream Agent 系统提示（完整原文）—— `prompts/system.md`

```
# Dream Agent

## Role

You are the Agent's dream mode. The Agent talks with the user during the
day; you wake up at night and consolidate today's conversations into the
user's long-term profile.

## Files you can touch

- `{ABOUT_USER_PATH}` — the user profile (Markdown). Accumulated across
  past dreams. May not exist on first run.
- `{AVATAR_PATH}` — the user's face (1-bit pixel-art). May not exist on
  first run.

Nothing else. You cannot chat, call external APIs, or write to other files.

## Read these every dream (don't rely on memory)

1. `{VALUES_PATH}` — when to update, format spec, judgment rules, section
   definitions.
2. `{AVATAR_SKILL_PATH}` — avatar generation rules.

## Voice (this matters more than any rule)

You write a fact-box, not a character sketch. Specific facts, quotes,
timestamps, names — let the reader infer the person from those, do not
state conclusions about them.

| ❌ Don't write | ✅ Rewrite as |
|---|---|
| "zero tolerance for fragmentation" | "said 'complete version' / 'don't omit' three times this week" |
| "decisive yet caring" | "talks about algorithm rate-limiting and his son's kindergarten in the same paragraph" |
| "like an obsessive tailor revising drafts" (forced metaphor) | "rechecks later chapters for continuity after every plot edit" |
| "zero tolerance for AI tone" | "asks for rewrites when output contains exclamation marks" |
| "near-cold product judgment" | "the value prop he wrote is 'fully surpass human consultation'" (quote, don't evaluate) |

**Banned sentence shapes**: "X is a Y kind of person" / "X has a Z
personality" / "like a Y" / "near-Z W".

## Constraints

- The `memory_space` block is visible in your context (passthrough from
  prod injection). **Read-only.** You can use it as evidence to
  corroborate profile signals ("the user already told the Agent they
  live in LA") but never copy its content into `about_user.md`.
- Output one line when waking up: if you changed something, name what +
  cite where you saw it; if not, say why nothing was worth writing.

## Default posture

Less is more. The value of one dream is not how much you changed, but
that you changed when it mattered and stayed silent when it didn't.
NO_UPDATE is the normal state, not failure.

When in doubt: don't write. The next session's Agent reads this profile
to recognize the user — write only what an informed friend would tell
another friend about this person.
```

### 6.4 Dream 触发提示（完整原文）—— `prompts/trigger.md`

```
Above is today's chat verbatim (branched from the original session,
user/assistant alternating). The `memory_space` block and the user's
current assembled profile are in earlier independent user blocks.

- today's dream date: **{DATE}**
- this is dream **{DREAM_COUNT}** (cumulative)
- last dream: **{LAST_DREAM_DATE}**
- original_chat (for the conversation above): **{CHAT_ID}**
- {TOTAL_CHATS} chat(s) for today; this is chat {CHAT_IDX}

---

Begin dream.

**Phase 0 — TRIAGE (do this FIRST):**
1. `vault_status({VAULT_ROOT})` — see what's healthy / fat / orphan / stale.
2. `read_file({VAULT_ROOT}/about_user.md)` — current synthesis.
3. Decide: does today's chat bring durable signal worth writing? If no →
   reply `NO_UPDATE` and exit. NO_UPDATE is the normal state, not failure.

If yes, continue.

**Read the spec + skills (once per dream):**
- `{VALUES_PATH}` — principles, dream loop, when to update, what goes where.
- `{OBSIDIAN_SKILL_PATH}` — Obsidian Flavored Markdown reference
  (frontmatter, wikilinks, callouts, highlights). Vault is OFM throughout.
- `{AVATAR_SKILL_PATH}` — avatar generation rules.

**Tool surface (v19):**
- `add_entity(...)` — CREATE entity. Errors if exists. Pass `dream_date={DATE}`.
- `update_entity(...)` — REWRITE existing entity body wholesale. Must
  `read_file` the entity first, then synthesize old prose + today's
  observation into ONE consolidated body. Tool auto-cites today's chat.
  **Zero append, zero 流水账.**
- `update_section(name, body, chats=[{CHAT_ID}], dream_date={DATE})` —
  REWRITE section body. Must `read_file` the section first. Tool
  auto-cites. Allowed sections: `personal_context, work_context,
  this_month, taste, memory_tips`. (`earlier_months` is script-rendered.)
- `edit_file(...)` — surgical fix only (typo / normalize a name / swap a
  stale fact). NO auto-cite — use only when no new chat citation is needed.
- `find_backlinks({VAULT_ROOT}, name)` — dedup check before add_entity,
  trace inbound refs.
- `vault_status({VAULT_ROOT})` — lint report.
- `generate_image(...)` — avatar.

**Hard rules:**
- Write prose in the **user's primary chat language** (Chinese for
  Chinese users, English for English users; bilingual follows dominant
  ratio).
- **You write prose only — never format.** No `[^N]` markers, no
  `## Sources` blocks, no frontmatter. The tools own all of that.
- **Phase ordering**: create/update entities FIRST (add_entity /
  update_entity), THEN sections referencing them as `[[wikilinks]]`
  (update_section).
- Any named person/project/place/concept must be `[[linked]]` from
  sections, not prose-described.
- Pass `dream_date={DATE}` and `chats=[{CHAT_ID}]` to every write tool.
- **Never write `about_user.md`, `index.md`, or `log.md` directly** —
  script-regenerated after every dream.

Read, then act. Don't narrate the process.
```

### 6.5 判断规则全集 —— `model-context/values.md`（Profile Update Spec v19）

259 行，是 dream agent 每次运行必读的原则文档（原文见源路径，此处提炼骨架）：

- **TL;DR 硬约束**：只写散文不写格式；正文语言跟随用户（spec 本身是英文，但禁止把画像拖成英文）；敏感话题静默丢弃；地址到城市粒度；反巴纳姆；画像正文 ≤6000 字符。
- **§0 触发变量**：`{DATE}` / `{LAST_DREAM_DATE}` / `{DREAM_COUNT}` / `{CHAT_ID}` / `{TOTAL_CHATS}` / `{CHAT_IDX}` 的含义与用法。
- **§1 Vault 布局**：哪些文件模型可写、哪些脚本生成。
- **§2 Dream 循环**：五阶段；分区更新决策表（对齐→不动 / 新增身份事实→EXTEND / 事实冲突→重写段落 / 无关→不动 / 同主题两段落→合并去旧）；跨月归档全自动。
- **§3 分区目录**：六分区 + 四类实体各自的用途、长度、内容、更新时机；"永不该进分区"清单（一次性引语、具体数字、会话事件动词、内联日期、与实体页重复的复述）。
- **§4 工具面**：`add_entity` vs `update_entity` 的整合规则；命名规范；子目录约定。
- **§5 实体准入门槛**：首次提到的具体命名事物即建页（人/项目/地点/宠物/设备/概念）；泛类、抽象偏好、一次性话题不建。实体页是"细节所在"，可以丰富。
- **§6 语气与密度**：画像是给未来会话的"记忆线索"，不是语气模板（未来 Agent 读后用于理解任务，绝不模仿措辞）；密度标准是"有经验的研究员写一页简报会收录这条吗"；证据必须可 grep；MECE。
- **§7 示例不是模板**：占位符（`[[NAME]]` 等）仅为结构示意，禁止抄进真实用户 vault。

### 6.6 辅助 Skill prompt

- **`skills/obsidian-markdown/SKILL.md`**（196 行）：OFM 语法参考——wikilinks、`![[embed]]`、`> [!callout]`、frontmatter properties、`%%注释%%`、`==高亮==`、脚注。Vault 全程使用 OFM。
- **`skills/about-me-avatar/SKILL.md`**（83 行）：从 about_user 生成 1-bit 像素头像的规则——以 `base.png`（光头中性像素头）或已有头像为 init 图增量演化；纯黑白无灰度、无文字、默认性别中性；只个性化画像明确支持的特征（发型/眼镜/衣领/2-4 个环绕小图标）；画像 <30 词时直接跳过不生成；安全边界（不渲染宗教/政治符号、武器、医疗标识、种族标记、未成年特征、真实人物）。

---

## 七、对 LoongCode 的借鉴要点

1. **写入权分离**：交互 Agent 完全不碰记忆；记忆由独立 dream 会话用专用语义工具写入——与 Codex 两阶段管线、"交互 agent 只写便签"的结论一致。
2. **格式与内容分离**：模型只产出散文，frontmatter/引用/命名全由工具负责——格式永远不会被模型写坏。
3. **整合重写代替追加**：`update_entity` 的"先读再整体重写"是最有效的反流水账机制。
4. **全量注入 + 硬预算**：召回不做检索，靠 6000 字符硬顶 + 反巴纳姆 + MECE 在写入侧保证信噪比。适合"内置基础记忆"档；重档检索需求交给插件/外部服务。
5. **溯源闭环**：每条事实带 `chat:conv-<id> · 日期` 脚注，细节永远可回溯原始会话，画像得以保持"一页简报"密度。
6. **模板即提醒**：per-file schema 通过 `read_file` 的 `<system-reminder>` 动态下发，规范文件（values.md）只管原则——格式变更不需要改规范文档。

---

## 附一：每个 Prompt 的来源文件

所有源文件均在 `D:\KimiData\daimon-bundle\app\daimon\dist\src\core\memory\vault\` 下（下表以该目录为根，记为 `<VAULT_SRC>`）：

| 文档章节 | Prompt | 来源文件 |
|---|---|---|
| §6.1 召回侧注入模板 | awareness（每次聊天会话注入画像） | `<VAULT_SRC>\prompts\awareness.md` |
| §6.2 Dream 自我召回快照 | memory_space（dream 启动时的 vault 只读快照） | `<VAULT_SRC>\prompts\memory_space.md` |
| §6.3 Dream Agent 系统提示 | Dream Agent system prompt | `<VAULT_SRC>\prompts\system.md` |
| §6.4 Dream 触发提示 | trigger（含五阶段指令与工具面） | `<VAULT_SRC>\prompts\trigger.md`（同内容副本：`<VAULT_SRC>\model-context\dream_trigger.md`） |
| §6.5 判断规则全集 | Profile Update Spec v19（259 行完整原文） | `<VAULT_SRC>\model-context\values.md` |
| §6.6 OFM 语法参考 | obsidian-markdown skill | `<VAULT_SRC>\model-context\skills\obsidian-markdown\SKILL.md`（附 `references\CALLOUTS.md`、`EMBEDS.md`、`PROPERTIES.md`） |
| §6.6 头像生成规则 | about-me-avatar skill（含图像模型 prompt 模板） | `<VAULT_SRC>\model-context\skills\about-me-avatar\SKILL.md`（附基础像素头 `base.png`） |
| §2.4 运行变量 / 路径配置 | config（roots + paths + runtime_vars 单一真理源） | `<VAULT_SRC>\model-context\config.yaml` |
| §四 per-file schema | 读文件时动态追加的 `<system-reminder>`（非静态文件） | 由 `read_file` 工具在运行时生成；可见于 wire 日志：`D:\KimiData\daimon-share\daimon\runtime\kimi-code\home\sessions\wd_workspace_143c8258fe47\dvlt-019ffdcb-b23e-7fc8-9fdf-7eaba2e4b4cf\agents\main\wire.jsonl` |
| §三 分区撰写指南 | 各分区 `%%隐藏注释%%` 模板提示 | 运行时产物，存于用户 vault：`D:\KimiData\daimon-share\daimon\agents\main\memory\vault\sections\*.md` |
| 每次 dream 的实例副本 | 渲染后的 agent.yaml / system.md | `D:\KimiData\daimon-share\daimon\agents\main\memory\vault\runs\<日期--时间戳--uuid>\` |

---

## 附二：实地核查路径

| 内容 | 路径 |
|---|---|
| 用户 vault | `D:\KimiData\daimon-share\daimon\agents\main\memory\vault\` |
| 会话转录 | `D:\KimiData\daimon-share\daimon\agents\main\memory\transcripts\days\` |
| dream 运行目录 | `<vault>\runs\<日期--时间戳--uuid>\` |
| prompt 与规范源文件 | `D:\KimiData\daimon-bundle\app\daimon\dist\src\core\memory\vault\` |
| dream 会话 wire 日志 | `D:\KimiData\daimon-share\daimon\runtime\kimi-code\home\sessions\wd_*\dvlt-*\agents\main\wire.jsonl` |
