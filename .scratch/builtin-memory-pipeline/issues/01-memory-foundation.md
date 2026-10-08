# 01 — 记忆地基：配置节 + 全局存储引导 + memory_inspect

**What to build:** 用户在 `loongcode.json` 写入 `memory` 节后，LoongCode 启动时在用户数据目录引导出记忆的物理地基，并且能通过 `memory_inspect` 工具看到"到底什么生效了"。具体：`memory` 配置节按 config 目录自导出模式解析（数值按 codex 区间钳制、未知 key 记 warning、`generate_memories`/`use_memories` 独立开关）；用户数据目录下自动创建全局 `memory.db`（经 core 统一迁移管线建表，但挂全局路径而非 per-Location 路径）与 `memories/` 工作区目录布局（MEMORY.md、memory_summary.md、raw_memories.md、rollout_summaries/、skills/、extensions/ad_hoc/notes/）；`memory_inspect` 控制工具回显钳制后的生效配置、配置警告与空的作业状态。无 `memory` 节时这一切都不发生（总闸关，零成本跳过）。

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `memory` 节缺省时：不创建任何文件/目录、不注册任何记忆组件、无性能损耗
- [ ] `memory` 节出现（即使为空对象）时：全局 memory.db 与 memories/ 工作区布局自动引导
- [ ] 表以 Drizzle snake_case 落 core 迁移管线（stage1_jobs 含 lease 字段、stage1_outputs、citations、phase2_job 单行租约镜像）
- [ ] 数值选项钳制：idle 1–48h、age 1–30 天等 codex 区间，越界回落默认并记 warning
- [ ] 未知 key 记 warning 不 hard-fail
- [ ] `generate_memories`/`use_memories` 独立解析，语义正确传递到后续组件挂载点（本期可仅为占位）
- [ ] `memory_inspect` 回显生效配置（钳制后）+ 警告 + 作业状态（空态）
- [ ] 集成测试：临时目录作数据根，断言目录/表引导、钳制、警告行为（只测外部可观察产物）
