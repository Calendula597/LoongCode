# 02 — 身份端到端可选中且请求带头

**What to build:** 用户在 TUI 或 Desktop 的模型选择器里能像切换 LLM 一样看到并选中 TDAI agent 条目（每个 agent 一个条目，无裸条目），选择按 Session 持久化、重启/恢复后保持。选中后，该 Session 的 LLM 请求逐字注入该 agent 的身份头（与现状手配 provider 的行为完全一致），模型仍可在配置的模型列表里自由切换。Identity Switch 且模型不变时不替换 Context Epoch（不丢 provider 缓存前缀）；伴随换模型时走普通换模型规则。若发现 epoch keying 按 providerID 字符串比较，需调整为按有效 api/model 比较，使共享同一 api shape 的合成条目切换不触发 Epoch 替换。

**Blocked by:** 01 — TDAI 配置 schema + Catalog 合成身份条目

**Status:** ready-for-agent

- [ ] TUI 模型选择器与 Desktop 模型选择器均列出 agent 条目并可选中（枚举逻辑零改动即可出现则验证即可）
- [ ] 身份选择按 Session 持久化（app 的 ModelKey / TUI 的 model.json 现有机制），恢复 Session 后身份保持
- [ ] 集成断言：合成条目的 `request.headers` 逐字进入 LLMRequestPrep 产出的最终请求头（不发真实网络请求）
- [ ] 身份切换 + 模型不变 → 不发生 Context Epoch 替换；身份切换 + 换模型 → 遵循现有 model/provider-switch 规则
- [ ] 若 epoch keying 依赖 providerID，改为按有效 api/model 比较并有覆盖测试

Spec: specs/tdai-identity.md · ADR: docs/adr/0005-tdai-identity-header-overlay.md
