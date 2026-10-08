# Commit 总结：Skill Marketplace 集成

- **Commit**: `acd4259ad8924d0764ddfd366c6e999e945507e4`
- **标题**: `feat(skill): add skill marketplace integration`
- **作者**: Calendula
- **日期**: 2026-08-13 09:50:58 +0800
- **规模**: 63 个文件，+9605 / -3459 行

## 概述

本次提交将 CC-Switch 的 Skill 仓库管理与市场（Marketplace）能力集成进 LoongCode。核心变化是引入独立的 `SkillMarketplace` 服务层，把原来 SkillHub「启动时全量拉取」的模式改为「元数据浏览 + 按需安装」，并新增 GitHub/Gitee 仓库作为可选的 Skill 来源。

已安装的 Skill 持久化到 `loongcode.jsonc` 的 `skills.paths`，并以 `DirectorySource` 身份重新进入既有的 `SkillV2` 消费链，因此运行时 Skill 管线本身无需改动。

## 架构设计

```
前端（Web App + TUI）
    │  Marketplace 对话框、Skill 卡片、仓库管理面板
    ▼  SDK（自动生成）
HTTP API（/api/skill/ 下共 9 个端点，action 风格 POST）
    ▼
SkillMarketplace.Service
    ├── SkillHub 适配器（仅元数据，浏览时不下载 SKILL.md）
    ├── GitHub/Gitee 仓库适配器（tarball 下载 + 扫描）
    └── Config 回写（写入 skills.paths / skills.urls）
    ▼
既有 Skill 管线（discoverSkills → Skill.Service → SkillTool）
```

关键决策（详见 `docs/adr/0001-skill-marketplace-layer.md`）：

- **新增独立 `SkillMarketplace` 层**，而非改造 SkillHub 或扩展 `SkillV2.Source` 联合类型——避免把市场逻辑混入运行时上下文层。
- **复用现有 `config.updateGlobal` 做配置回写**，不新增 `ConfigWriter` 服务。
- **仓库来源严格 opt-in**：不预置任何默认 GitHub/Gitee 仓库。
- `parseRepoUrl`/`SkillRepo` 放在纯模块 `skill/repo.ts`（无 HTTP 依赖），保证启动敏感的 `skill/index.ts` 不引入 HttpClient 栈。

## 主要变更

### 后端（`packages/loongcode`）

- 新增 `src/skill/marketplace.ts`（534 行）：`SkillMarketplace` 服务，负责列表、安装、卸载、仓库管理。
- 新增 `src/skill/tarball.ts`：tarball 下载与解压，使用 `node:zlib` 的 `gunzipSync`（兼容 Bun 与 Node 运行时）。
- 新增 `src/skill/repo.ts`：仓库 URL 解析与扫描（纯模块）。
- 删除旧的 `src/skill/skillhub.ts`（176 行），SkillHub 逻辑重构进 marketplace 模块；`skill/index.ts` 中的 SkillHub 启动期 `pullAll()` 接线被移除。
- 新增 HTTP API：`src/server/routes/instance/httpapi/groups/skill-marketplace.ts` 及对应 handlers，提供市场列表、安装/卸载、仓库增删、SkillHub key 管理等 9 个端点。

### 前端

- **Web App**（`packages/app`）：新增 `components/skill-marketplace/` 组件目录（对话框、Skill 卡片、仓库管理器、样式），并在设置面板与布局中接入入口。
- **TUI**（`packages/tui`）：新增 `dialog-skill-marketplace.tsx`，接入快捷键配置与首页提示。
- **i18n**：全部 20 种语言各新增约 44 条 marketplace 相关文案，并更新 parity 测试。
- 市场 UI 中的「配置 API Key」入口被注释掉——已验证配置 key 无法让私有 Skill 出现在目录中，入口会产生误导；底层 HTTP 端点保留供 API 直接调用。

### SDK 与规格

- `packages/sdk/openapi.json` 与 JS SDK（`sdk.gen.ts`、`types.gen.ts`）重新生成，纳入 `/api/skill/` 新端点。

### 测试

- 新增 `test/skill/marketplace.test.ts`（759 行）与 `test/skill/tarball.test.ts`（222 行）。
- 清理旧 SkillHub 相关测试；调整 `test/session/system.test.ts` 与 `test/skill/skill.test.ts`。

### 文档与杂项

- 新增 ADR `docs/adr/0001-skill-marketplace-layer.md` 与完整设计文档 `docs/superpowers/plans/2026-08-07-skill-marketplace-integration.md`。
- 新增 3 个后续 issue 记录（repo tarball TTL 缓存、SkillHub 目录 TTL 缓存、变更缓存失效）。
- 移除 `.loongcode/tool/` 下两个 GitHub 相关工具脚本及少量配置。

## 安全与健壮性要点

- 所有安装文件写入收敛到单一收口点 `writeSkillFiles`，拒绝任何不安全的相对路径（`..`、绝对路径、反斜杠、空路径），以 `InstallError` 显式失败。
- tarball 下载上限 20MB（压缩后体积，Content-Length 预检 + 实际缓冲长度双重校验），解压后另有 `MAX_EXTRACTED_BYTES` 防御 zip bomb。
- 仓库 tarball 与 SkillHub 目录采用 5 分钟内存 TTL 缓存（`Effect.cachedWithTTL`），并发请求去重；缓存键分别为仓库 URL 与 API key，避免跨账号串数据。
- 新增仓库前先向宿主分支 API 校验 URL：404（仓库不存在）直接拒绝，超时/网络错误放行，避免瞬断误伤。
- SkillHub 凭据复用现有 `Auth.Service`（providerID `skillhub`），移除了旧代码中硬编码的 bearer token；key 保存前经 `GET /api/v1/auth/me` 验证。
- 私有 Skill 不会出现在任何列表端点；`findSkillHubItem` 在公开目录未命中时回退为直接 slug 查询。
- 安装完成后会使一次性 `Skill.Service` 发现状态失效，避免「看似已安装但重启前不可用」的问题。

## 行为变化

- 启动时不再从 SkillHub 全量拉取 Skill，`discoverSkills` 只扫描本地（已安装）Skill，启动更轻。
- 旧 `skillhub.ts` 被移除，对外接口改由 marketplace 模块与 `/api/skill/` 端点承载。
