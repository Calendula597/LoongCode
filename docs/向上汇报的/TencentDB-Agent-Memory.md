# TencentDB-Agent-Memory 项目调研报告

> 调研日期：2026-08-14

## 一、项目概述

**TencentDB Agent Memory** 是腾讯开源的 **AI Agent 长期记忆服务**，为任意 Agent 框架提供四层渐进式记忆能力。核心卖点：

- **符号化短期记忆**：把大量工具日志压缩成轻量 Mermaid 流程图，降低 token 消耗（官方基准最高 **-61.38%**）。
- **分层长期记忆**：把碎片化对话提炼为结构化画像与场景，而非平铺的向量堆。
- **团队记忆**：通过 Memory Hub 按 Team/Agent 装配记忆资产，团队共享经验、按权限隔离隐私。

**仓库结构**：

| 目录 | 职责 |
|---|---|
| `MemoryCore/` | 核心记忆引擎（L0-L3 算法、Gateway、存储） |
| `MemoryProxy/` | LLM 透明代理（记忆注入/写回，供 coding agent 接入） |
| `MemoryPanel/` | Memory Hub 管理面板（团队/Agent/资产/记忆管理） |
| `MemoryKnowledge/` | 知识层（CodeGraph 代码图谱、Wiki） |
| `sdk/` | 官方 SDK（Python + TypeScript） |
| `deploy/` | Docker 部署 |

**设计理念**：Memory 不只是"记住对话"，而是**凡是能让下一个 Agent 少走弯路的信息，都应该被保存、组织并复用**：

```text
已有信息 → 可复用记忆资产 → 更少 Turns → 更少返工 → 更稳定的结果和更高的效率
```

## 二、核心功能

### 2.1 四大记忆资产

| 资产 | 说明 |
|---|---|
| **Chat Memory** | 保留偏好、事实、决策和交互历史；每个 Agent 创建时自动获得独立记忆，下次对话不必从自我介绍开始 |
| **Skill** | 从对话和工具调用中提炼可复用技能；有版本、资源文件、触发边界、执行步骤和验证规则；个人默认私有，审核后可分享给团队并配装给其他 Agent |
| **Wiki** | 把产品文档、设计方案、运维手册生成结构化页面与链接图谱（灵感源于 Karpathy 的 LLM 知识库） |
| **CodeGraph** | 索引代码符号、文件、调用关系和影响路径；Agent 可搜索、阅读、查 callers/callees，改代码前做 impact analysis |

### 2.2 团队记忆面板（Memory Hub）

- 创建 Team 和 Agent，审核、分享并配装记忆资产。
- 统一管理 Owner、版本、状态、可见性、使用次数与 Agent 绑定。
- **可见性分级**：

| 可见性 | 语义 |
|---|---|
| `private` | 只有 Owner 可读，团队管理员也不例外 |
| `team` | 团队成员可读，Owner / Admin 负责管理 |
| `restricted` | 通过 User / Role / Agent ACL 精确授权 |
| `agent` | 用于同团队 Agent 的定向装配 |

- **角色分层**：全局 System Admin（管理用户与团队、使用资产管理功能）；Team 内 Admin（团队管理员）与 Member（普通成员）。
- 新 Chat Memory 和 Skill 默认私有，分享是明确动作而非默认泄漏。

### 2.3 冷启动：先读档，再开工

已有资产可直接在面板导入并自动处理：
- **代码库** → CodeGraph 自动索引符号、文件、调用关系与影响路径。
- **文档与文件** → Wiki 自动生成结构化页面与链接图谱。
- **对话 Session** → Skill 与 Chat Memory 自动提取可复用资产。

### 2.4 与普通 RAG 的差异

| | 聊天历史 | 普通 RAG | TencentDB Agent Memory |
|---|---|---|---|
| 跨会话理解用户 | △ | △ | ✅ Chat Memory |
| 沉淀可执行经验 | — | — | ✅ Skill |
| 文档结构与关系 | — | △ 切片检索 | ✅ Wiki + Link Graph |
| 代码调用与影响范围 | — | △ 文本命中 | ✅ CodeGraph |
| Owner / 版本 / 状态 | — | — | ✅ |
| 团队分享与 Agent 配装 | — | — | ✅ |
| 私有 / 团队 / ACL | — | △ | ✅ |

### 2.5 安装部署

一键拉起完整三件套（`memory-core` + `memory-hub` + `proxy`）：

```bash
git clone https://github.com/Tencent/TencentDB-Agent-Memory.git
cd TencentDB-Agent-Memory/deploy/global-images
cp .env.example .env
$EDITOR .env       # 填入两组 LLM 参数（memory 组 + proxy 组）
./start-all.sh     # 一键起
```

打开 Panel：[http://localhost:8125](http://localhost:8125)。旧版本（v1.x/v0.x）数据可用 `MemoryCore/scripts/migrate-v2-to-v3` 迁移工具升级。

## 三、核心架构：四层记忆模型（L0-L3）

对话首先作为 **L0** 保存，再由异步 Pipeline 逐层提炼：

| 层级 | 保存内容 | 用途 |
|---|---|---|
| **L0 Conversation** | 原始对话与完整上下文 | 核对原话、时间、来源 |
| **L1 Atom** | 事实、偏好、约束、事件 | 精确召回可执行信息 |
| **L2 Scenario** | 围绕项目/场景组织的知识块 | 快速恢复工作场景 |
| **L3 Core/Persona** | 长期画像、稳定模式 | 让 Agent 迅速进入用户和团队语境 |

**召回策略**：平时用 L2/L3 快速进入语境；需要具体事实时通过 BM25 + 向量检索 + RRF 回到 L1/L0。结果受条数、字符预算、超时限制，避免记忆占满上下文。

## 四、接入方式（重点）

### 4.1 当前官方支持的接入路径（v2.0.0）

| 方式 | 说明 |
|---|---|
| **OpenClaw 插件** | 进程内集成，`index.ts` 注册工具和钩子 |
| **Hermes Provider** | 经 HTTP Gateway 通信 |
| **Claude Code / CodeBuddy** | 通过 **MemoryProxy 透明代理**接入 |
| **SDK** | 自研 Agent 直接调用 |

### 4.2 MemoryProxy 透明代理

**原理**：把 Agent 的 LLM 请求 baseURL 指向 MemoryProxy，代理在 LLM 调用层透明完成记忆的召回/注入/写回，**客户端无需任何插件**。

**请求处理流程**：

```
客户端请求 → auth(鉴权) → sessionInit(会话初始化: 选 team/agent/task)
→ injection(上下文注入: skill/memory/wiki/knowledge 到 system prompt)
→ 转发上游 LLM → 用量/上报 → 返回客户端
```

**关键配置项**（本地 `MemoryProxy/config.yaml` 已确认全部开启）：

| 配置 | 值 | 作用 |
|---|---|---|
| `extraction.enabled` | `true` | 每轮对话写回记忆 |
| `extraction.extractors` | `["skill","tdai-memory"]` | 写回 L0 + skill |
| `tdai.memory.writeL0` | `true` | 写 L0 短期记忆 |
| `tdai.memory.recallL1` | `true` | 召回 L1 |
| `tdai.memory.injectL2L3` | `true` | 注入 L2/L3 |
| `sessionInit.enabled` | `true` | 首次绑定 team/agent/task |
| `sessionInit.headerAutoSelect.enabled` | `true` | header 预选（`x-team-id`/`x-agent-id`/`x-task-id`） |

**记忆写回触发条件**：

1. 会话已绑定（有 `user_id + team_id + agent_id`）
2. 有 `space_id`（URL 路径中的记忆实例 ID）
3. `extraction` 配置开启
4. **每轮"真人问答"结束**（agent 给出无 tool_use 的最终回复）才写回，中间态跳过

## 五、团队协作使用要点（基于代码确认）

### 5.1 记忆隔离维度

- **记忆资产按 `team_id + agent_id` 绑定**（`chat_memory-{team_id}-{agent_id}`）。
- **协作要求**：team 和 agent 必须一致（记忆共享的钥匙）；task 建议一致（涉及权限校验，但不决定记忆归属）。
- **user 维度**：各自用自己 user key，L2/L3 和团队资产共享，L1/L0 按 user 隔离（取决于 ACL 可见性配置）。

### 5.2 团队记忆的来源

团队记忆**不会自动出现**，需要：

1. 在 Memory Hub 建 Team、建 Agent、配成员。
2. 给 Agent **绑定资产**：代码库（CodeGraph）、文档（Wiki）、历史对话（Skill + Chat Memory）。
3. 首次对话完成 team/agent/task 绑定后，每轮自动注入该 Agent 的记忆、写回新对话。

### 5.3 预置 Agent 角色

Memory Hub 预置 4 个角色型 Agent：Issue 分诊员、文档工程师、Bug-fix 工程师、PR Reviewer。**日常开发建议新建自己的开发 Agent**，修 bug/审 PR/写文档时再切对应角色。

## 六、仓库导入能力（CodeGraph）

| 场景 | 当前版本 (v2.0.0) | PR #961 合入后 |
|---|---|---|
| GitHub 公开仓库 | ✅ 支持（仅 HTTPS） | ✅ |
| 私有 Gitee（HTTPS+token） | ❌ 不支持 | ✅（GIT_ASKPASS token） |
| 私有 Gitee（SSH key） | ❌ 不支持 | ✅（SSH host 校验） |
| 内网 Gitee | ❌ SSRF 黑名单拦截 | ⚠️ 仍被拦截（除非放行） |

- 当前 `git-fetcher.ts` 仅支持 public HTTPS，面板明确不支持 SSH 格式。
- [PR #961](https://github.com/TencentCloud/TencentDB-Agent-Memory/pull/961)（Open，已 approve）实现生产级私有仓库鉴权：AES-256-GCM 加密凭据、GIT_ASKPASS token 鉴权、SSH host 校验、SSRF DNS 校验、凭据生命周期 API。作者已用 Gitee 私有仓库端到端验证通过。

## 七、记忆手动编辑能力

| 层级 | 写接口 | 面板 UI |
|---|---|---|
| L1 原子记忆 | `/atomic/update`、`/atomic/delete` | ❌ 只读 |
| L2 场景块 | `/scenario/write`、`/scenario/rm` | ❌ 只读 |
| L3 画像 | `/persona/write` | ❌ 只读 |

- 后端 API 完整支持手动读写（带版本号机制），但 **MemoryPanel 目前只调查询接口**，UI 无编辑入口。
- 手动改记忆需直接调 API。

## 八、Benchmark 与注意事项

### 8.1 Benchmark

| Benchmark | 无 TencentDB Agent Memory | 启用后 | 相对提升 |
|---|---|---|---|
| **PersonaMem** | 48% | **76%** | **+59%** |

PersonaMem 检验 Agent 能否在长期交互后正确理解和运用用户信息。

### 8.2 注意事项

- Wiki 和 CodeGraph 异步构建，需要等待一定时间处理才能 `ready`。
- CodeGraph 当前首先支持公开 HTTPS 仓库；私有仓库和 SSH 凭证接入仍在完善。
- Hub 已支持人工绑定资产；全自动记忆路由仍在迭代。
- 当前提供 OpenClaw、Hermes、Claude Code、CodeBuddy 和 SDK 接入；更广泛的跨框架迁移仍在 Roadmap 中。
- 当前的 LLM 配置只能通过配置文件设定，无法自由切换上游LLM。
- 无法通过面板修改记忆内容，只能通过SDK形式修改


## 九、关键结论与建议

1. **LoongCode 接入**：当前走 MemoryProxy（baseURL 指向 8096 代理），配置好 provider 后正常开发即可，记忆全自动。
2. **团队协作**：统一 team + agent（+task），各自用自己 user key，即可共享团队记忆。
3. **私有仓库导入**：当前版本不支持，需等 PR #961 合入或手动合入。
4. **记忆编辑**：API 支持，面板暂不支持，需直接调接口。