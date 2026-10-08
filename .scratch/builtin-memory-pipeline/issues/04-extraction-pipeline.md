# 04 — Extraction 管线（发现 → 脱敏转录 → 小模型提炼 → stage-1 落库）

**What to build:** 用户正常使用 LoongCode，已结束且闲置达标的会话被后台自动提炼成记忆笔记，全程零交互、崩溃可恢复。具体：发现扫描（host 启动最老优先 + `session.idle` 事件 + 6h 周期重扫 fiber + 会话首条消息 stamp memory_mode）以 durable `time_updated` 判定闲置（默认 6h）与年龄窗口（默认 10 天），每轮 claim 上限默认 2；转录直查各 Location 的 Session 表拼装，秘密（API key/token/密码/私钥）在进入模型前脱敏；`memorize-extract` 受限子代理（无 shell/网络/文件工具，仅结构化捕获工具）经 `llm.stream` 完成提炼，模型回退链为显式配置 → agent 定义 model → `getSmallModel`；产物（raw memory + rollout summary）落 memory.db 的 stage-1 表；claim 带 lease（硬杀后下个发现轮次安全 reclaim）、失败有界重试后转失败态、`memory.deleted` 事件清除对应记忆与作业、超龄 stage-1 产物剪枝；`memory_mode` 控制工具（单会话记忆开关）；`memory_inspect` 扩展回显作业状态与近期错误。

**Blocked by:** 01 — 记忆地基（配置决定门槛值、memory.db 承载 claim/产物、stamp 依赖配置态）

**Status:** ready-for-agent

- [ ] 种子一个 `time_updated` 闲置 ≥6h 的会话 → 发现扫描选中并抽取，笔记落 DB
- [ ] 闲置不足的会话不被选中；超 10 天未抽取的会话被跳过
- [ ] 每轮抽取条数受上限约束，多余会话留下轮
- [ ] 转录中的秘密模式在投喂前被脱敏
- [ ] 抽取走小模型回退链，structured output 解析失败按失败重试
- [ ] claim 带 lease：模拟持有人死亡（过期 lease），下轮发现安全 reclaim 重抽
- [ ] 失败重试有界，转失败态后 inspect 可见错误
- [ ] `session.deleted` → 对应 stage-1 产物与作业清除
- [ ] `generate_memories: false` → 发现扫描与抽取完全不跑（stamp 仍记录 disabled）
- [ ] 抽取作业在 BackgroundJob 注册表可见（后台透明度）
- [ ] 集成测试用 fake LLMClient + 可控时间戳，断言全部为 DB/日志可观察产物
- [ ] 记忆子代理会话豁免：管线自己的会话永不被发现扫描选中
