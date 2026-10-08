# 代码审查报告 — TDAI Identity（未提交工作树 vs HEAD）

审查对象：`git diff HEAD` + 未跟踪新文件（`tdai.tsx`、`v1/config/tdai.ts`、`provider/tdai.ts` 及测试）。
规范来源：`specs/tdai-identity.md`、ADR 0005、ticket 01–03、AGENTS.md。

## Standards

### 硬性违规（违反文档化标准）

1. **`packages/app/src/components/settings-v2/tdai.tsx:6`** — `import { Icon as IconV2 } from "@loongcode/ui/v2/icon"` 违反 AGENTS.md「Never alias imports」。
2. **`tdai.tsx:35-43, 105-112, 139-145`** — 三处 `for` 循环（`textToHeaders`、`save`、`canSave` 中构建 Record）违反「Prefer functional array methods over for loops」。
3. **`tdai.tsx:60-64`** — 连续 5 个 `createSignal`（url/apiKey/modelsText/agents/saving）违反 `packages/app/AGENTS.md`「Always prefer `createStore` over multiple `createSignal` calls」。
4. **`tdai.tsx:126-130`** — `try { await ... } finally` 违反「Avoid try/catch where possible」（判断空间较小）。

### 基线坏味道（判断性）

5. **Duplicated Code — `tdai.tsx:104-112` vs `137-145`**：`save()` 与 `canSave()` 中逐字段构建 `agentsRecord` 的逻辑形状完全重复，应提取共享 shape。
6. **Duplicated Code — `packages/loongcode/src/provider/provider.ts:1680, 2283`**：`TDAI.expand(...)` 被调用两次，数组拼接形状重复；可一次性展开复用。
7. **Divergent Change / 无关变更 — `packages/sdk/js/script/build.ts:53-59`**：把「补丁未生效时 throw」反转为静默跳过写入，与本特性无关，且掩盖 gen 输出漂移的真实失败，建议移出本变更或恢复原语义。
8. **命名一致性（Primitive Obsession 边缘）— `packages/core/src/v1/config/tdai.ts:28`**：v1 config 现有键多为 snake_case（`disabled_providers`、`mcp_timeout`），新增 `apiKey` 为 camelCase，与同层配置词汇不一致。
9. **模块形状细节 — `packages/loongcode/src/provider/tdai.ts:1`**：自导出 `export * as TDAI` 置于文件顶部；`packages/loongcode/AGENTS.md` 示例将非 config 模块的自导出置于文件底部。
10. **测试断言 — `packages/core/test/session-projector.test.ts:651, 697`**：`as SystemContext.Snapshot` 与 `identitySwitch.seq!` 属类型断言边缘判断项，可用 schema 构造或显式守卫替代。

## Spec

### (a) 缺失或部分实现的需求

1. **四个常用 header key 预填 — 缺失**。工单 03：「agents 列表编辑（名称 + header 行，**四个常用 header key 预填**）」。`tdai.tsx:47-52` 的 `emptyAgent()` 将 `headersText` 置空，无任何预填，placeholder 也只出现两个 key。
2. **模型列表"增删行"编辑 — 偏离**。Spec L64：「model list (**add/remove rows**)…reusing the custom-provider-form row-editing pattern」；实现改为单个 textarea 逗号/换行分隔（`tdai.tsx:21-26, 201-208`）。
3. **LLMRequestPrep 集成断言 — 缺失**。Spec L73 / 工单 02：「集成断言：`request.headers` 逐字进入 LLMRequestPrep 产出的最终请求头」。`packages/loongcode/test/provider/tdai.test.ts` 只断言 catalog 层的 `options.headers`，未覆盖最终请求头。
4. **配置重载测试 — 缺失**。工单 01：「配置重载（invalidate）后合成条目随之增删改」及对应测试要求；无相关测试。
5. **TUI 选择器验证 — 无证据**。Spec 用户故事 16 / 工单 02：「TUI 模型选择器…均列出 agent 条目并可选中」。diff 无任何 TUI 相关验证或说明。

### (b) 未被要求的行为（scope creep）

1. **agent `disabled`/tombstone 机制**。Spec 与工单 03 只要求「edit or delete identities」（故事 13）；`disabled` 字段（`v1/config/tdai.ts:12-14`）、UI 开关（`tdai.tsx:252-263`）、expand 过滤（`loongcode tdai.ts:24`）均为新增概念。
2. **`packages/sdk/js/script/build.ts` 改动**：SSE patch 失败时 throw 改为静默跳过写文件，与 TDAI 特性无关，且削弱了保护性检查。
3. **projector epoch 改动影响全体用户**：Spec 故事 15「behave exactly as before」，但 `packages/core/src/session/projector.ts:360-368` 使所有用户同 model id 的 ModelSwitched 不再替换 epoch（原先无条件替换）。

### (c) 看似实现但实现有误

1. **合成接缝偏离 spec 决定**。Spec L61 / 工单 01 要求「**core plugin hooking `catalog.transform`**」、头走「`ProviderV2.Info.request.headers` → LLMRequestPrep」管线。实现却在 `provider.ts:1680-1685` 直接拼进 `cfg.provider`，头放在 `options.headers`（`loongcode tdai.ts:57-61`），verbatim 注入依赖 openai-compatible SDK 行为，未经指定管线验证。
2. **epoch 比较未按"有效 api/model"**。工单 02：「需调整为按**有效 api/model** 比较」。`projector.ts:363-365` 只比较 `model.id` + `variant`，不比较 api shape/baseURL——不同 api 的 provider 若有同名模型 id，切换会错误地跳过 epoch 替换。
3. **面板可能不回显已有配置**。`tdai.tsx:66-84` 使用 `on(…, { defer: true })`：首次运行被跳过，若打开面板时 config 已加载（`tdai()` 不再变化），URL/Key/agents 字段将保持空白。

## 总结

- Standards 轴：10 项（4 项硬性违规）。最严重：`tdai.tsx` 的 import 别名与多 `createSignal` 违反明确文档化标准。
- Spec 轴：11 项（5 缺失、3 scope creep、3 实现有误）。最严重：合成接缝未走 spec 指定的 `catalog.transform` + `request.headers` 管线，且 epoch 比较未按工单要求的"有效 api/model"。

---

# Round 2（作者修复后复审）

## Standards

### Round-1 发现核验

已修复（5）：import 别名；for 循环（改 `Object.fromEntries`）；多 `createSignal`（改单个 `createStore<FormState>`，L103）；`try/finally`（改 `.finally()`）；`save()`/`canSave()` 重复（共用 `buildTDAIConfig()`，L153-158）；loongcode tdai.ts self-export 移至底部。

仍存在（4）：
1. `provider.ts:1680, 2284` — `TDAI.expand` 仍调用两次（判断性，重复计算）。
2. `packages/sdk/js/script/build.ts:57` — 无关改动仍在，错误信息丢了文件路径，可诊断性下降。
3. `core/src/v1/config/tdai.ts:23` — `apiKey` camelCase；但 `ConfigProviderV1` options 已有 `apiKey` 先例，可辩护。
4. `session-projector.test.ts:649, 690` — `as SystemContext.Snapshot` 与 `seq!` 断言仍在。

### 新发现

硬违规：
- `core/src/v1/config/tdai.ts:35` — self-export 置于**底部**，而其余 17 个 v1 config 兄弟模块均在**第 1 行**；违反 AGENTS.md「In src/config, follow the existing self-export pattern at the top of the file」。应移回顶部。
- `loongcode/test/provider/tdai.test.ts:176,179,189,190,193` — 多处 `as any` 及 `as Record<string,string>`，违反「Avoid `any`」。
- `session-projector.test.ts:658` — `identitySwitch` 赋值后未使用。

判断性：
- `"tdai/"` 前缀魔术字符串在 `projector.ts:28` 与 `loongcode tdai.ts:10` 重复，core Session projector 硬编码感知 TDAI 命名（跨包隐式耦合）。
- `projector.ts:377-386` 嵌套三元 + 可选链，建议拆早返回。

## Spec

### Round-1 发现核验

已修复（6）：四个 header key 预填（`DEFAULT_HEADER_KEYS`）；模型列表行式增删；LLMRequestPrep 集成断言（tdai.test.ts:162-200）；配置重载测试（tdai.test.ts:117-160）；disabled/tombstone 机制已移除。

仍存在 / 部分（5）：
1. **TUI 选择器验证 — 仍无证据**（issue 02 勾选框未闭环）。
2. **build.ts 无关改动 — 仍在**（错误信息被删减），应移出 changeset。
3. **projector epoch 改动影响全体用户 — 仍在**：`projector.ts:374-390` 同 providerID+同 model.id/variant 不再替换 epoch，HEAD 版无条件替换；违反 story 15「behave exactly as before」。
4. **catalog.transform 接缝 — 仍未走**：仍在 loongcode 侧拼 `cfg.provider`（provider.ts:1680-1686），非 spec L61 指定的 core plugin `catalog.transform`。
5. **headers 位置 / epoch 比较 / 面板回显 — 部分**：headers 改为逐模型 `headers`（功能等价但非 `request.headers` 接缝）；epoch 比较加了 `tdai/` 前缀特判但仍非"有效 api/model"；`defer:true` 已移除但 `loaded` 守卫 + `server-sync.tsx:132-134` 未就绪返回 `{}` 的竞态仍可能挡住已有配置回显。

### 新发现

6. **删除 agent / 清空字段无法生效（implemented-but-wrong）**：`updateGlobal` 走 `mergeDeep`/`patchJsonc`（`loongcode/src/config/config.ts:651,657`），深合并不删除补丁中缺席的键；tdai.tsx:160-165 保存仅发送现存 agents，被删 key 残留配置文件。违反 issue 03「删除 agent 后配置与模型选择器同步移除」「清空后 fail-soft 禁用」。

## Round 2 总结

- Standards：R1 十项修复 6 项；新硬违规 3 项（v1 config self-export 位置、测试 `as any`、未用变量）。最严重：self-export 位置放反（core config 应在顶部、loongcode 应在底部，目前 core 那个放错了）。
 - Spec：R1 十一项修复 6 项；遗留 5 项 + 新发现 1 项。最严重：**删除 agent 无法生效**（mergeDeep 不删 key，直接违反 issue 03 验收标准），其次 catalog.transform 接缝与 epoch 语义仍未对齐 spec。

---

# Round 3（第三轮复审）

## Standards

### Round-2 遗留项状态

已修复（7）：build.ts 错误信息恢复文件路径（但无关改动仍在 changeset）；session-projector.test.ts 类型断言/未用变量消除；core v1 config self-export 回到第 1 行；loongcode 测试 `as any` 消除；`"tdai/"` 前缀收敛为 `ConfigTDAIV1.PROVIDER_PREFIX` 常量（主代码）；projector 嵌套三元改早返回。

仍存在（2）：`provider.ts:1680, 2284` `TDAI.expand` 调用两次（判断性）；`apiKey` camelCase（可辩护，未改动）。

### 新发现（R3 修复引入）

硬违规：
- `packages/loongcode/src/config/config.ts:654-656` — `withTDAIDeletions` 内 `for (const key of Object.keys(...))` 违反「prefer functional array methods」。

判断性：
- `loongcode/test/provider/tdai.test.ts:2` — `import * as fs from "fs/promises"` 违反 no-star-imports；但 repo 另有 4 个测试同用法，有先例。
- `tdai.test.ts:31-44, 98-107, 151-165` — `tdaiConfig` 字面量重复 3 次（Duplicated Code）。
- `config.ts:648-667` — 连续 `as` 断言 + 突变 `next.experimental`；空字符串作删除哨兵语义隐晦（Primitive Obsession）。

## Spec

### Round-2 遗留项状态

已修复（3）：
- **projector epoch 影响全体用户** — `projector.ts:373-386` 现仅 tdai→tdai 同模型跳过替换，非 TDAI 用户行为复原，有回归测试。
- **删除 agent / 清空字段** — `withTDAIDeletions`（`config.ts:643-667`）注入 undefined 墓碑，.jsonc 经 `modify(…, undefined)` 真删键、.json 经 stringify 丢弃；满足 issue 03 验收（有保留，见新发现）。
- **面板回显竞态** — `tdai.tsx:115-135` loaded + isPristine 守卫 + config undefined 早退。

仍存在（4）：
1. **TUI 选择器验证** — 仍无证据（结构上 `dialog-model.tsx:62-81` 枚举 `sync.data.provider`，理论零改动可见，未验证）。
2. **build.ts 无关改动** — 仍在 changeset。
3. **catalog.transform 接缝** — 仍 loongcode 侧 concat（`provider.ts:1680-1686`），非 spec L61 指定的 core plugin。
4. **headers 位置 / epoch 比较** — 仍部分：headers 逐模型放置（功能等价，集成测试通过）；epoch 仍是 `tdai/` 前缀启发式，非 spec L63「effective api/model」。

### 新发现（R3 修复引入）

- **`withTDAIDeletions` 无测试覆盖** — 删除/清空的 updateGlobal 回路（issue 03 核心验收）未被测试触达；tdai.test.ts:128-146 重载测试直接写文件绕开了修复路径。
- .json 路径内存态 `next` 短暂保留被删键（值为 undefined），invalidate 后恢复一致，危害低。
- 次要：.jsonc 路径现先 schema 解析整个既有文件，文件他处既存 decode 错误会使整个 update 失败。
- 次要：`provider.ts:2284-2287` fallback 处重复 `TDAI.expand` 且丢弃 warnings。

验证：`packages/loongcode` 下 `bun test test/provider/tdai.test.ts` 10/10 通过。

## Round 3 总结

- Standards：R2 遗留基本清零，新增 1 项硬违规（`withTDAIDeletions` 的 for 循环）+ 3 项判断性。
- Spec：核心功能问题（删除不生效、epoch 影响全体用户、面板回显）均已修复；剩余分歧集中在 **spec 接缝决策**（catalog.transform / request.headers / effective api-model）——建议作者明确选择：改代码对齐 spec，或修订 spec L61/L63 记录实际接缝。另需为 `withTDAIDeletions` 补一条 updateGlobal 回路测试。
