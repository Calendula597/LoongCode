# 02 — Memory Summary Context Source（epoch 注入 + 手动编辑感知）

**What to build:** 用户的记忆摘要作为 **Context Source** 进入每个新会话的 Baseline System Context，且缓存稳定、变更不打扰。具体：`memory/summary` stable key 注册进 System Context Registry（loader 读 `memory_summary.md`、codec 取文件文本、纯 baseline/update 渲染器、~2500 token 截断 chars/4 估算）；渲染尾部附 citation 引用格式教学（占注入预算）；`use_memories: false` 时该 source 不注册（读侧整体 gating 的一部分——工具隐藏在工单 03）；用户手动编辑 `memory_summary.md` 后，下一个安全 provider-turn 边界的 reconcile 感知变更并产生一条 Mid-Conversation System Message（"记忆已更新"），不打断流式输出、不唤醒空闲会话。本工单同时关闭 CONTEXT.md 中"V1 transform 动态用途是否用 Context Source 替代"的 flagged ambiguity。

**Blocked by:** 01 — 记忆地基（配置节决定 gating、工作区布局决定 loader 读什么）

**Status:** ready-for-agent

- [ ] `memory/summary` 注册进 System Context Registry，stable key 无碰撞（DuplicateKey 语义下正确失败）
- [ ] 新 epoch 初始化：摘要文本进入 Baseline System Context，Context Snapshot 记录当前值
- [ ] 摘要文件无变化：reconcile 返回 Unchanged，无消息
- [ ] 摘要文件变化：下一安全边界产生恰好一条 Mid-Conversation System Message（durable、原样重放）
- [ ] 会话空闲时不被记忆变更唤醒（惰性 reconcile）
- [ ] 摘要超长被截断到 ~2500 token 等价
- [ ] `use_memories: false`：source 不注册，baseline 无记忆段
- [ ] 手动编辑→会中更新消息在人类界面可隐藏但 durable 历史存在
- [ ] 测试沿用 system-context 的 testEffect harness 范式，断言 initialize/reconcile/update 文本
