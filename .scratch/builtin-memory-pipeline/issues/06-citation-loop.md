# 06 — Citation 闭环（持久化前剥离 + usage 记账）

**What to build:** 模型在回答中引用它用到的记忆，宿主记账"哪条记忆被用了"并保证用户在屏幕和历史记录里永远看不到机器暗号——反馈信号驱动整合期的保留/淘汰，且模型不配合时系统静默降级。具体：V1 会话 assistant text part 持久化管线上的**单一剥离点**（对插件版三重冗余钩子的收敛）：解析回复尾部的 `<memory-citation session_ids="[...]">` 块 → 记账（对应来源 session 的 usage_count +1、last_usage 更新）→ 从文本中剥离后才入库与显示；同一 part 的流式更新按 `session:part` 键去重，只有首次出现的 id 组合才记账；`memorize`/`memorize-extract` 记忆子代理会话在 citation 管线中显式豁免（防整合器给自己刷使用量的自激振荡）；模型忘记发 citation 时不记账、不惩罚、不补发。注入侧的引用格式教学由工单 02 的 Memory Summary 渲染尾部承担，本工单只做接收端。

**Blocked by:** 02 — Memory Summary Context Source（注入指导教模型发 citation，是闭环的信号源）

**Status:** ready-for-agent

- [ ] 模型回复尾部带合法 citation 块 → 对应来源 session 的 usage 记账（count+1、last_usage 更新）
- [ ] 剥离发生在持久化之前：入库文本、UI 显示均无 citation 痕迹
- [ ] 同一 part 多次流式更新只记账一次（按 part 去重）
- [ ] 同一回复引用多个 session id 全部记账
- [ ] 记忆子代理会话的输出不参与 citation 计数
- [ ] 模型回复无 citation 块 → 无记账、无错误、无行为变化（静默降级）
- [ ] 非法/畸形 citation 块 → 不记账、不剥离合法文本、不抛错（容错解析）
- [ ] 下轮模型重读历史时看到的是剥离后文本（历史自洽，不诱发模仿）
- [ ] usage 数据可供整合选取消费（与工单 05 的加权选取接口对齐，DB 行即可）
- [ ] 测试断言：记账数字、入库文本干净度、豁免与降级路径（全为可观察产物）
