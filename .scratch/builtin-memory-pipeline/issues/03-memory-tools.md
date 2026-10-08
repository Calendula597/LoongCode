# 03 — Memory 工具面（read / search / list / add_note）

**What to build:** 模型在会话中能主动查询与补充记忆。四个工具经 Tool Registry 注册（与 read/edit 同级公民）：`memory_read` 读 MEMORY.md 全文；`memory_search` 按查询检索记忆（v0 LIKE/子串匹配，接口留演进空间）；`memory_list` 列出记忆清单（含 usage 元数据）；`memory_add_note` 把用户显式说"记住 X"的内容落成 `extensions/ad_hoc/notes/` 下的便签文件。工具直读工作区与 memory.db（纯 IO，无 LLM 调用、不经任何子会话）。`use_memories: false` 时四个工具全部不进 Tool Registry（读侧整体 gating）。

**Blocked by:** 01 — 记忆地基（工作区布局与 memory.db 是工具的数据面）

**Status:** ready-for-agent

- [ ] 四个工具经 Tool Registry 注册，参数 Schema 校验、错误信息模型友好
- [ ] `memory_read` 返回 MEMORY.md 内容（含不存在时的空态文案）
- [ ] `memory_search` 子串匹配返回相关记忆条目
- [ ] `memory_list` 返回清单（含来源 session 与 usage 元数据）
- [ ] `memory_add_note` 写便签文件，重复主题可辨识
- [ ] `use_memories: false` 时四工具不注册
- [ ] 工具行为测试沿用 core tool-* 测试范式（SessionV2.prompt + fake LLM）
- [ ] 工具描述文本教模型"何时该查记忆"（召回动机引导）
