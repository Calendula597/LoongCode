# 05 — Consolidation 管线（Flock 租约 + git 基线 → 工作区重写）

**What to build:** 零散的 stage-1 记忆笔记被周期性整合成一份连贯、去重、带淘汰的用户记忆——两个 LoongCode 窗口不会互相覆盖，崩溃不死锁。具体：`memorize` 受限子代理（文件工具 only、子会话 directory 绑定记忆工作区根，项目路径自然越界拒绝）经 `llm.stream` 主模型路径完成整合；整合作业经 Flock 心跳租约跨进程串行（DB `phase2_job` 单行租约镜像 + 6h 冷却，持有人崩溃后心跳停跳被安全回收）；git baseline diff 流驱动（初始化基线 → 捕获上次成功以来的工作区 diff → 整合 → 重置基线），用户在两次整合间的手动编辑因此被保留并参与整合；产出重写 MEMORY.md（全量索引）/ memory_summary.md（短摘要）/ skills/（可复用程序）/ raw_memories.md / rollout_summaries/；记忆选取按 usage 加权（空 citation 表时正确退化为时间排序）；30 天未用记忆淘汰；`memory_reset` 控制工具拒绝 symlink 记忆根后执行整体清除（DB + 工作区 + 基线）。整合成功后使 `memory/summary` Context Source 的文件值变化，由工单 02 的既有 reconcile 机制在下一安全边界自然感知——无需本工单做任何注入侧工作。

**Blocked by:** 04 — Extraction（整合的输入是 stage-1 产物；抽取不落地则整合无可演示输入）

**Status:** ready-for-agent

- [ ] stage-1 笔记足够时触发整合：MEMORY.md / memory_summary.md 被重写，十条相似观察合并为一条
- [ ] git baseline 流完整：首次初始化、成功后重置、失败保留 diff 供下轮
- [ ] 整合前用户手动编辑工作区 → 该编辑体现在下次整合结果中（不被覆盖）
- [ ] Flock 租约：第二个进程在租约有效期内跳过整合（skipped_running）
- [ ] 租约心跳停跳（模拟持有人崩溃）→ 陈旧后被另一进程安全回收接管
- [ ] 冷却期内（默认 6h）不重复整合
- [ ] usage 加权：被引用记忆保留强化，30 天未用记忆淘汰
- [ ] 空 citation 表正确退化为时间排序
- [ ] `memorize` 子代理无 shell/网络工具，文件访问越出记忆根被拒绝
- [ ] `memory_reset` 拒绝 symlink 记忆根；成功后 DB 与工作区整体清空、下轮重新引导
- [ ] 整合失败：租约释放、错误记录、retry_at 退避，inspect 可见
- [ ] 跨进程测试沿用 flock worker fixture 范式；进程内测试断言文件产物与 DB 状态
