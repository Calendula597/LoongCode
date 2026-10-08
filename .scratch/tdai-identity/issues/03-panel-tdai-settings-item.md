# 03 — 设置面板 TDAI (beta) 专属设置项

**What to build:** 用户在 Desktop/app 设置里看到一个独立的 **TDAI (beta)** 设置项，内含：proxy URL、API Key、模型列表（增删行），以及 agents 列表——每个 agent 编辑项包含显示名称和 header 行编辑（key/value 行，预填常用的 x-team-id / x-agent-id / x-task-id / x-conversation-id）。保存通过现有 `global.config.update` 深合并通路写入全局 JSONC 配置的 `experimental.tdai`，实例热重载后新 agent 即出现在模型选择器中。用户全程无需手改 JSON、无需创建普通 provider 条目。表单复用 custom-provider-form 的行式编辑模式；UI 文案称 "agents"，代码与文档保持术语 TDAI Identity。

**Blocked by:** 01 — TDAI 配置 schema + Catalog 合成身份条目（依赖配置 schema；可与 02 并行）

**Status:** ready-for-agent

- [ ] 设置界面新增独立 TDAI (beta) item：URL、API Key 字段 + 模型列表行编辑 + agents 列表编辑（名称 + header 行，四个常用 header key 预填）
- [ ] 保存走 `global.config.update` mutation 写入 `experimental.tdai`，触发实例重载后模型选择器可见新 agent
- [ ] 删除 agent 后配置与模型选择器同步移除；清空 agents 或连接字段后特性按 fail-soft 禁用
- [ ] API Key 字段按敏感信息处理（不明文回显，沿用现有密钥输入范式）
- [ ] v1 不做 UI 自动化测试，人工验证（与 custom-provider-form 演进方式一致）

Spec: specs/tdai-identity.md · ADR: docs/adr/0005-tdai-identity-header-overlay.md
