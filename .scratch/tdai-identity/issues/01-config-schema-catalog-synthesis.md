# 01 — TDAI 配置 schema + Catalog 合成身份条目

**What to build:** 用户在全局配置写入 `experimental.tdai`（URL、API key、手配模型列表、agents 各自身份头集）后，providers 列表（Catalog）中每个 agent 都作为一个合成 provider 条目出现：共享同一份 openai-compatible 连接（url/apiKey）与配置模型列表，并在 `request.headers` 上携带自己的身份头集（task scoping + Proxy Session Key）。合成条目 id 以 `tdai/<agentKey>` 命名空间隔离；不注册任何无身份头的裸条目。连接配置不完整（缺 url/apiKey/models）时整个特性静默禁用并记录 warning；`experimental.tdai` 缺失时系统行为与现状完全一致（master off switch）。配置热重载后条目随之增删改。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `experimental.tdai` 配置节（`url` / `apiKey` / `models: string[]` / `agents`: key → `{ name?, headers: Record<string,string> }`）可按现有 v1 config 模块模式 decode/round-trip，缺失时完全无行为变化
- [ ] 配置有效时，catalog.transform 通路为每个 agent 注册合成 provider：模型列表来自 `models`，`request.headers` 为身份头集逐字拷贝，条目不携带除该 agent 头集外的其他头
- [ ] 不出现无身份头的裸 TDAI 条目
- [ ] 连接配置不完整（任一 url/apiKey/models 缺失且定义了 agents）→ 特性禁用 + warning，不影响其他 provider
- [ ] 配置重载（invalidate）后合成条目随之增删改
- [ ] catalog 接缝测试覆盖：注册与继承、不完整配置禁用、无配置 no-op、重载更新；schema round-trip 测试；测试从 package 目录运行（非 repo root）

Spec: specs/tdai-identity.md · ADR: docs/adr/0005-tdai-identity-header-overlay.md
