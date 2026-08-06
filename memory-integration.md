# 记忆集成选型决策

> 状态:已选型,待实现
> 日期:2026-08-04
> 范围:为 LoongCode集成跨会话记忆功能

## 1. 背景与目标

LoongCode 基于 OpenCode 二次开发,需要跨会话、跨项目的持久记忆能力。本决策记录对 5 个候选记忆方案的调研、对比与选型过程,以及最终部署架构。

## 2. 约束条件(硬线)

以下约束由用户在选型过程中明确确立,是筛选候选的硬性条件:

| # | 约束 | 说明 |
|---|---|---|
| C1 | LoongCode 原生 hooks | 必须用 LoongCode 的 typed Hooks([packages/plugin/src/index.ts](../packages/plugin/src/index.ts) 的 `Hooks` 接口),不是 Claude Code 的字符串事件 |
| C2 | 不登录任何记忆云 | 不走 supermemory/mem0 的云登录,数据不上第三方云 |
| C3 | 用自己的 API key 或本地模型 | LLM/embedding 可用自有 key 或本地模型地址,不允许强制云 |
| C4 | 数据存储本地 | 记忆存储不上云 |
| C5 | 两环境都要记忆 | 本机 Windows + 远端 Linux 都要有可用记忆 |
| C6 | 两环境不同步 | 接受记忆碎片化,不造同步层 |
| C7 | CPU-only 友好 | 多台机器无独立 GPU,embedding 必须能 CPU 跑 |
| C8 | HuggingFace 不可达 | 网络拉不到 HF,modelscope 可达 |

## 3. 候选评估总表

| 候选 | C1 hooks | C7 CPU embedding | C2/C3 不登录/自有key | C5/C6 两环境不同步 | 结论 |
|---|---|---|---|---|---|
| thedotmack/claude-mem 原版 | ❌ hook 鸿沟 | ⚠️ Chroma 要 embedding | — | — | 否决 |
| sdsrss/claude-mem-lite | ❌ 无 OpenCode 路径 | ✅ FTS5 无 embedding | — | — | 否决 |
| mem0(官方 OpenCode 插件) | ✅ | ⚠️ 要本地 LLM | ❌ 硬编码 Mem0 云 | ⚠️ 4 服务栈 | 否决 |
| tonyzorin/agentmemory | ❌ 无 hook,靠提示词 | ✅ 模型烤进镜像 | ⚠️ 中心化=数据出 Windows | ❌ 中心化与"不同步"冲突 | 否决 |
| opencode-supermemory(自托管) | ✅ chat.params + compaction | ✅ Xenova 本地 | ✅ 自托管可免登录 | ⚠️ 多一个本地服务进程 | 合规但更重 |
| **opencode-mem** | ✅ tool.execute.after 等 | ✅ Xenova 本地 | ✅ 原生无云 | ✅ 每机一个 SQLite | **选定** |

## 4. 候选详解与否决理由

### 4.1 thedotmack/claude-mem 原版

- 88.7k stars,Apache-2.0。重量级:Bun + Python/uv + Chroma 向量库,常驻 worker。
- **否决理由**:
  - **Hook 鸿沟**:[Issue #2435](https://github.com/thedotmack/claude-mem/issues/2435) 实证其 OpenCode 插件 `switch(eventName)` 期望 `session.created`/`message.updated`/`session.compacted`/`file.edited`/`session.deleted` 五个字符串事件,这些在 OpenCode 系(含 LoongCode)一个都不存在。数据库里只有 `platform_source: "claude"`,OpenCode 会话零记录,静默失败。
  - **Windows 重依赖**:要 Bun + Python + Chroma,Issue #2435 即 Windows 11 上报。

### 4.2 sdsrss/claude-mem-lite

- 纯 Node.js(3 包),SQLite + FTS5 + TF-IDF,不要 embedding。
- **否决理由**:
  - **无 OpenCode 安装路径**:`--ide opencode` 是原版的 flag,lite 只有 Claude Code hooks(`SessionStart`/`PostToolUse`/`Stop`)。在 LoongCode 上**无可实跑对象**。
  - 即使重写捕获层,等于自写记忆系统,只借了它的 FTS5 设计。

### 4.3 mem0

- 通用记忆层,Apache-2.0,58.9k stars。官方有 OpenCode 插件 `@mem0/opencode-plugin`。
- **关键澄清**:mem0 引擎(OSS)能全本地(Ollama 当 LLM+embedder,本地 Qdrant,不登录)。但**官方 OpenCode 插件硬编码连 Mem0 云**(`MEM0_API_KEY`),不能指向自托管服务器。自托管要走社区 fork `opencode-mem0-selfhost`(v0.1.4,作者自标"未在活服务器验证")。
- **否决理由**:
  - 官方插件 C2/C3 不合规(强制云登录)。
  - 运营重量大:每台机器要跑 server + Qdrant + LLM + embedder 四服务。
  - LLM 抽取是**硬需求**(每次 `add()` 调 LLM),CPU-only 机器上跑本地 LLM 过重。

### 4.4 tonyzorin/agentmemory

- 中心化服务器模型:FastMCP(port 8081)+ Redis 8.6(BM25+vector+RRF)+ PostgreSQL 18 + Apache AGE。embedding `BAAI/bge-base-en-v1.5` 烤进 Docker 镜像。
- **否决理由**:
  - **无 hook**:记忆操作只靠 agent 主动调 MCP 工具或"agent rules"提示词——正是用户上次"模型不主动调 memory 工具"的同一个失败模式。
  - **中心化与 C6 冲突**:一个中心库所有客户端共享,是"不同步"的反面。
  - **Windows 不能本地跑服务端**:Linux + Docker only。Windows 客户端要把记忆发去远端 Linux 服务器,违反 C4(数据出 Windows)。
  - 默认。

### 4.5 opencode-supermemory(自托管)

- OpenCode 原生插件,用 typed Plugin API。有 `chat.params` 上下文注入 + `experimental.session.compacting` 预防性压缩 hook。自动捕获靠关键词触发 + 显式 `supermemory` 工具。
- 后端 Supermemory 可自托管(`npx supermemory local`),数据目录 `./.supermemory`,embedding 默认本地 `Xenova/bge-base-en-v1.5`(与 opencode-mem 同栈),LLM 可 Ollama 全本地。
- **架构澄清**(核实另一模型的说法):插件的 `baseUrl` 指向 Supermemory **后端服务**地址(云或自建 `http://localhost:6767`),embedding/向量/搜索逻辑在后端,不在插件。**不能在 baseUrl 填本地模型路径**——但本地模型配在后端服务器侧(`SUPERMEMORY_EMBEDDING_PROVIDER=local`、`OPENAI_BASE_URL=...Ollama`),整条链路可全本地。默认端口 6767(非 8787,8787 是 wrangler/Workers dev 端口)。
- **合规但未选**:四道关全过,是唯一同时满足 C1/C2/C3/C7 的备选。未选原因:
  - **云优先设计**:默认流程 `login` 走 app.supermemory.ai,自托管需主动 opt-out,与用户偏好方向相反。
  - **更重**:要跑独立本地服务进程 + 在服务器侧配 embedding/LLM,比 opencode-mem 进程内方案重。
  - **Windows 未验证**:Node 服务大概率可行但无确认。
- **保留为升级选项**:若日后想要更高检索质量(图+rerank+代码库索引+压缩记忆),它是唯一能"不登录、用自己 key"升级的路径。

## 5. 最终选型:opencode-mem

**选定 [tickernelz/opencode-mem](https://github.com/tickernelz/opencode-mem)**,v2.20.1,373 commits,Apache-2.0。

### 选定理由

1. **原生本地,从来无云**:无登录、无云,设计中心就是本地。auto-capture 用自有 LLM provider key(可选),embedding 本地,存储本地 SQLite。与 C2/C3/C4 最干净对齐。
2. **LoongCode 原生 hooks**:用 `tool.execute.after`(每次工具调用捕获,最全面)、`chat.message`、`experimental.session.compacting` 等 typed hooks,确定性自动捕获,不依赖 LLM 自觉。
3. **进程内,最轻**:插件 + 1 个 SQLite 文件,无独立服务进程。每机一份天然契合 C6(不同步)。
4. **CPU embedding 友好 + 中文可用**:`Xenova/multilingual-e5-small`(384 维,~130MB q8,CPU 毫秒级),不要 GPU。multilingual 覆盖中英+代码混合(LoongCode 典型场景),比默认英文 `all-MiniLM-L6-v2` 更适合中文内容。纯中文场景可换 `Xenova/bge-base-zh-v1.5`(768d,更大,中文专精)。
5. **auto-capture 可关**:关掉即零 LLM 调用、零外发,数据真不出机器(最严格 C4 形态)。

### 关键事实

- embedding **强制**(检索必需),无关键词降级模式。当前架构 Turso/libSQL 原生向量搜索(DiskANN `vector_top_k`)。
- embedding 两种模式:本地(`@huggingface/transformers` 从 HF 下,缓存到 `{storagePath}/.cache`)或远端 OpenAI 兼容 API(`embeddingApiUrl`+`embeddingApiKey`)。
- 存储路径 `storagePath`(默认 `~/.opencode-mem/data`),本地嵌入式 libSQL,**不要多实例同时写同一路径**(迁移锁/操作锁)。
- **无内置同步**:跨环境共享需自建,Turso 云 replica 或同步脚本,本项目不采用。
- embedding 模型一旦选定不要换(换触发全量 re-embedding)。

## 6. 部署架构

```
本机 Windows                              远端 Linux
┌──────────────────────────┐              ┌──────────────────────────┐
│ LoongCode                │              │ LoongCode                │
│  └─ opencode-mem 插件    │              │  └─ opencode-mem 插件    │
│  └─ libSQL(本地)        │              │  └─ libSQL(本地)        │
│  └─ multilingual-e5      │              │  └─ multilingual-e5      │
│     -small(384d,~130MB)│              │     -small(384d,~130MB)│
│     中文+英文,CPU        │              │     中文+英文,CPU        │
│     ← modelscope 预缓存  │              │     ← modelscope 预缓存  │
│     (绕开 HF)            │              │     (绕开 HF)            │
└──────────────────────────┘              └──────────────────────────┘
        │                                          │
        └──────── 不同步,各存各的 ────────────────┘
```

- 两环境独立 libSQL,互不同步(C6)。
- embedding 模型统一 `Xenova/multilingual-e5-small`(384d,multilingual 含中文,CPU 友好,弱机器带得动)。
- 模型下载:HF 不可达(C8),用 modelscope 预下载,塞进 `{storagePath}/.cache`(transformers.js 缓存结构)。
- auto-capture:可选开(复用各环境自有 LLM provider key)。

## 7. 实现计划(待执行)

1. **清理残留**:两环境删掉上次中断的 `{storagePath}/.cache` 损坏半截模型。
2. **查 modelscope 镜像**:确认 `Xenova/multilingual-e5-small` 的 **ONNX(Xenova)版** 在 modelscope 上有镜像(注意:PyTorch 版 `intfloat/multilingual-e5-small` 在 modelscope 有,但 transformers.js 要 ONNX 权重)。无 ONNX 镜像则改走 `embeddingApiUrl`→本地 Ollama `bge-m3`。
3. **确认 opencode-mem 的 E5 前缀处理**:E5/BGE 模型需 `query:`/`passage:` 前缀才达全质量。确认 opencode-mem 是否自动加前缀——不加不报错但检索质量下降。无前缀支持则改用无需前缀的中文模型,或接受降级。
4. **写 modelscope 预缓存脚本**:下载 ONNX 模型文件,按 `@huggingface/transformers` 期望的 HF cache layout 摆进 `{storagePath}/.cache`。
5. **起草 `opencode-mem.jsonc` 配置**:两环境各一份,`embeddingModel` 指定 `Xenova/multilingual-e5-small`,按需配 auto-capture LLM provider。
6. **验证**:小范围试一次 `memory({mode:"search"})`,能返回结果才算通。
7. **(可选)auto-capture LLM provider 配置**:不配则自动捕获停,手动 `memory` 工具的 add/search/list 仍可用。

## 8. 关键风险与待验证项

| 风险 | 状态 | 应对 |
|---|---|---|
| transformers.js 缓存目录结构:modelscope 文件命名/层次必须与 HF cache layout 对齐,否则离线加载失败 | 待验证(实现第一步) | 先在弱机实测一次编码延迟+加载 |
| modelscope 上是否有 `Xenova/multilingual-e5-small` 的 **ONNX(Xenova)版** 镜像 | 待查 | PyTorch 版有但 transformers.js 用不了;无 ONNX 镜像则走 `embeddingApiUrl`→本地 Ollama `bge-m3` |
| opencode-mem 是否为 E5/BGE 模型自动加 `query:`/`passage:` 前缀 | 待验证 | 不加则检索质量降(不报错);无前缀支持则换无需前缀的中文模型或接受降级 |
| LoongCode 分叉的 `Event` 类型载荷是否与 opencode-mem 期望一致 | 待验证 | 装好后看 hook 是否触发、DB 是否写入 |
| 远端"已部署模型"是 embedding 服务还是仅 LLM | 待用户确认 | 决定远端走 `embeddingApiUrl` 还是 modelscope 预缓存 |

## 9. 附录:选型过程中被纠正的认知

- **"无独立 GPU 跑不起 embedding"**:错。embedding 模型是 20-130MB 的 CPU 句子编码器(all-MiniLM-L6-v2 量化后 ~25MB,CPU 毫秒级),不是 GPU LLM。opencode-mem 用 `onnxruntime-node` 跑 CPU,CI 在 Intel Mac/Windows/Linux 均测过。能跑 LoongCode 的机器就能跑 embedding。
- **"opencode-mem 的 ExactScan fallback 是关键词降级"**:错。ExactScan 是老版本 USearch 时代的精确向量回退(暴力最近邻,仍要 embedding),不是关键词搜索。当前架构 Turso/libSQL DiskANN `vector_top_k`,无关键词降级模式。
- **"supermemory 自托管端口 8787"**:错。官方 `supermemory local` 默认 6767。8787 是 Cloudflare Workers `wrangler dev` 端口。
- **"supermemory 的 baseUrl 能填本地模型路径"**:错。baseUrl 是 Supermemory 后端服务 URL,模型配在后端服务器侧 env。
- **"claude-mem 的 `--ide opencode` = 有 hook"**:半对。该 flag 存在,但历史 Issue #2435 实证 OpenCode 插件静默失败(事件名对不上)。PR #2701 修复后用 typed hooks,但 LoongCode 是分叉,需独立验证。

## 10. 参考来源

- [thedotmack/claude-mem Issue #2435](https://github.com/thedotmack/claude-mem/issues/2435)
- [tickernelz/opencode-mem README](https://github.com/tickernelz/opencode-mem/blob/main/README.md)
- [supermemory OpenCode 集成文档](https://supermemory.ai/docs/integrations/opencode)
- [supermemory 自托管配置](https://supermemory.ai/docs/self-hosting/configuration)
- [mem0 自托管配置](https://docs.mem0.ai/open-source/configuration)
- [tonyzorin/agentmemory](https://github.com/tonyzorin/agentmemory)
- [LoongCode Hooks 接口](../packages/plugin/src/index.ts)
