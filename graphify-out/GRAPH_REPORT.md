# Graph Report - d:\workplace\local\LoongCode\packages\loongcode\src  (2026-08-13)

## Corpus Check
- 407 files · ~289,059 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4070 nodes · 9226 edges · 179 communities (163 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 313 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Tool System & Registry
- AI Provider Integrations
- CLI Runtime Boot
- Server HTTP API & Effect Runtime
- Configuration System
- CLI Run Footer UI
- Command System
- Agent System
- Permission & Footer UI
- CLI Entry & Message Body
- Permission & Shell Tool
- Patch System
- Provider Transforms
- Skill Marketplace
- Session Data Management
- Session Core
- Run Footer State Machine
- Subagent Data Bootstrap
- TUI Plugin System
- Permission Evaluation
- CLI Debug Commands
- LSP Server Definitions
- Prompt Display & Mention
- Server Events & HTTP API
- CLI Tool Permissions
- Server Routes
- Util Process
- Cli Cmd
- Cli Cmd
- Cli Cmd
- Acp Service
- Cli Cmd
- Cli Cmd
- Server Routes
- Account Account
- Project Instance
- Control Plane
- Mcp Index
- Plugin Install
- Cli Cmd
- Control Plane
- Session Compaction
- Util Repository
- Format Formatter
- Question Index
- Bus Global
- Server Routes
- Plugin Xai
- Server Server
- Worktree Index
- Project Vcs
- Server Routes
- Server Routes
- Acp Tool
- Cli Cmd
- Cli Cmd
- Util Filesystem
- Plugin Loader
- Server Routes
- Provider Error
- Server Routes
- Acp Usage
- Plugin Openai
- Skill Index
- Plugin Shared
- Plugin Meta
- Provider Auth
- Session Message
- Installation Index
- Plugin Openai
- Cli Cmd
- Cli Cmd
- Cli Cmd
- Effect Bridge
- Lsp Client
- Plugin Index
- Storage Storage
- Config Tui
- Mcp Oauth
- Session Message
- Acp Agent
- Cli Cmd
- Git Index
- Packages Loongcode
- Plugin Snowflake
- Project Project
- Session Retry
- Acp Tool
- Acp Permission
- Cli Cmd
- Plugin Github
- Server Routes
- Session Llm
- Account Repo
- Acp Directory
- Cli Cmd
- Cli Cmd
- Image Image
- Acp Session
- Cli Cmd
- Config Parse
- Server Auth
- Acp Config
- Cli Cmd
- Tool Task
- Server Shared
- Server Routes
- Session Llm
- Acp Content
- Auth Index
- Tool Websearch
- Id Id
- Mcp Oauth
- Tool Json
- Acp Error
- Cli Cmd
- Util Media
- Mcp Auth
- Packages Loongcode
- Packages Loongcode
- Plugin Digitalocean
- Server Proxy
- Acp Event
- Mcp Catalog
- Server Routes
- Session Llm
- Tool Mcp
- Account Account
- Config Plugin
- Cli Cmd
- Cli Cmd
- Cli Cmd
- Config Tui
- Cli Effect
- Config Markdown
- Server Routes
- Skill Discovery
- Env Index
- Server Shared
- Effect Runner
- Tool Tool
- Plugin Tui
- Server Routes
- Session Message
- Acp Profile
- Cli Cmd
- Config Variable
- Project Vcs
- Acp Event
- Packages Loongcode
- Server Routes
- Util Wildcard
- Config Paths
- Lsp Server
- Server Routes
- Session Compaction
- Audio D
- Lsp Diagnostic
- Tool Question
- Lsp Launch
- Packages Loongcode
- Packages Loongcode
- Server Projectors
- Util Archive
- Markdown D
- Packages Loongcode
- Packages Loongcode
- Packages Loongcode
- Packages Loongcode
- Sql D
- Packages Loongcode
- Packages Loongcode
- Packages Loongcode
- Packages Loongcode
- Packages Loongcode

## God Nodes (most connected - your core abstractions)
1. `RunFooter` - 66 edges
2. `SessionID` - 44 edges
3. `InstanceState` - 43 edges
4. `Config` - 41 edges
5. `reduceSessionData()` - 39 edges
6. `createLayer()` - 34 edges
7. `Session` - 33 edges
8. `EventV2Bridge` - 31 edges
9. `Provider` - 29 edges
10. `effectCmd()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `layer` --indirect_call--> `files()`  [INFERRED]
  session/prompt.ts → config/markdown.ts
- `layer` --indirect_call--> `work()`  [INFERRED]
  session/run-state.ts → util/queue.ts
- `make()` --indirect_call--> `loaded()`  [INFERRED]
  acp/service.ts → session/instruction.ts
- `make()` --indirect_call--> `messages()`  [INFERRED]
  acp/service.ts → session/llm/native-request.ts
- `make()` --indirect_call--> `model()`  [INFERRED]
  acp/service.ts → session/llm/native-request.ts

## Import Cycles
- 3-file cycle: `plugin/index.ts -> session/session.ts -> provider/provider.ts -> plugin/index.ts`
- 3-file cycle: `effect/instance-state.ts -> project/instance-context.ts -> project/project.ts -> effect/instance-state.ts`
- 3-file cycle: `command/index.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 4-file cycle: `plugin/github-copilot/copilot.ts -> session/message-v2.ts -> provider/provider.ts -> plugin/index.ts -> plugin/github-copilot/copilot.ts`
- 4-file cycle: `plugin/index.ts -> session/session.ts -> session/message-v2.ts -> provider/provider.ts -> plugin/index.ts`
- 4-file cycle: `effect/instance-ref.ts -> project/instance-context.ts -> project/project.ts -> effect/instance-state.ts -> effect/instance-ref.ts`
- 4-file cycle: `command/index.ts -> effect/instance-state.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 4-file cycle: `command/index.ts -> config/config.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 4-file cycle: `effect/instance-ref.ts -> project/instance-context.ts -> project/project.ts -> event-v2-bridge.ts -> effect/instance-ref.ts`
- 5-file cycle: `command/index.ts -> effect/instance-state.ts -> effect/instance-ref.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> config/config.ts -> effect/instance-state.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> mcp/index.ts -> effect/instance-state.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> skill/index.ts -> effect/instance-state.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> mcp/index.ts -> config/config.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> effect/bridge.ts -> effect/instance-ref.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> effect/bridge.ts -> effect/run-service.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`
- 5-file cycle: `command/index.ts -> skill/index.ts -> config/config.ts -> project/instance-context.ts -> project/project.ts -> command/index.ts`

## Hyperedges (group relationships)
- **Loongcode System Prompt Variants** — packages_loongcode_src_session_prompt_anthropic_system_prompt, packages_loongcode_src_session_prompt_default_system_prompt, packages_loongcode_src_session_prompt_gemini_system_prompt, packages_loongcode_src_session_prompt_gpt_system_prompt, packages_loongcode_src_session_prompt_codex_system_prompt, packages_loongcode_src_session_prompt_kimi_system_prompt, packages_loongcode_src_session_prompt_copilot_gpt_5_system_prompt, packages_loongcode_src_session_prompt_beast_autonomous_mode [INFERRED 0.95]
- **Agent Sub-Agent Prompt Templates** — packages_loongcode_src_agent_generate_agent_generation, packages_loongcode_src_agent_prompt_compaction_context_summarization, packages_loongcode_src_agent_prompt_explore_file_search, packages_loongcode_src_agent_prompt_summary_pr_description, packages_loongcode_src_agent_prompt_title_title_generator, packages_loongcode_src_command_template_review_code_review, packages_loongcode_src_command_template_initialize_agents_md_creation [INFERRED 0.95]
- **LLM Runtime Architecture Components** — packages_loongcode_src_session_llm_session_llm_service, packages_loongcode_src_session_llm_ai_sdk_adapter, packages_loongcode_src_session_llm_native_runtime, packages_loongcode_src_session_llm_native_request, packages_loongcode_src_session_llm_llmevent_stream, packages_loongcode_src_session_llm_llmclient, packages_loongcode_src_session_llm_runtime_selection_gate [EXTRACTED 1.00]
- **Plan Mode Multi-Phase Workflow** — packages_loongcode_src_session_prompt_plan_mode_plan_mode, packages_loongcode_src_tool_plan_enter_plan_agent, packages_loongcode_src_tool_plan_exit_build_agent, packages_loongcode_src_session_prompt_plan_mode_explore_subagent, packages_loongcode_src_session_prompt_plan_mode_plan_subagent, packages_loongcode_src_tool_question_question, packages_loongcode_src_tool_plan_exit_plan_exit [INFERRED 0.95]
- **SyncEvent Event Sourcing with Bus Backwards Compatibility** — packages_loongcode_src_sync_readme_syncevent, packages_loongcode_src_sync_readme_bus, packages_loongcode_src_sync_readme_event_sourcing, packages_loongcode_src_sync_readme_projectors, packages_loongcode_src_sync_readme_busschema, packages_loongcode_src_sync_readme_convertevent [INFERRED 0.95]
- **File Editing Tool Chain** — packages_loongcode_src_tool_read_read, packages_loongcode_src_tool_edit_edit, packages_loongcode_src_tool_write_write, packages_loongcode_src_tool_apply_patch_apply_patch [INFERRED 0.85]

## Communities (179 total, 16 thin omitted)

### Community 0 - "Tool System & Registry"
Cohesion: 0.03
Nodes (94): BackgroundJob, defaultLayer, layer, node, InstanceState, defaultLayer, EventV2Bridge, layer (+86 more)

### Community 1 - "AI Provider Integrations"
Cohesion: 0.03
Nodes (51): EffectPromise, ModelStatus, ProviderModelStatus, BUNDLED_PROVIDERS, BundledSDK, ConfigProvidersResult, cost(), custom() (+43 more)

### Community 2 - "CLI Runtime Boot"
Cohesion: 0.05
Nodes (74): BootService, Config, configTask, defaultRunTuiConfig(), emptyModelInfo(), emptySessionInfo(), layer, loadConfig() (+66 more)

### Community 3 - "Server HTTP API & Effect Runtime"
Cohesion: 0.05
Nodes (72): AppLayer, rt, Runtime, McpAuth, Question, PermissionNotFoundError, CommandPayload, DiffQuery (+64 more)

### Community 4 - "Configuration System"
Cohesion: 0.04
Nodes (70): layer, Config, defaultLayer, globalConfigFile(), Info, Interface, layer, mergeConfig() (+62 more)

### Community 5 - "CLI Run Footer UI"
Cohesion: 0.06
Nodes (59): RUN_SUBAGENT_PANEL_ROWS, CycleResult, eventPatch(), PROMPT_MAX_ROWS, RunPromptBody(), RunFooterOptions, RunFooterSubagentBody(), statusColor() (+51 more)

### Community 6 - "Command System"
Cohesion: 0.05
Nodes (54): Command, Default, defaultLayer, Event, Info, Interface, node, Service (+46 more)

### Community 7 - "Agent System"
Cohesion: 0.04
Nodes (52): Agent, defaultLayer, GeneratedAgent, Info, Interface, locationServiceMapNode, node, TODO: clean this up so provider specific logic doesnt bleed over (+44 more)

### Community 8 - "Permission & Footer UI"
Cohesion: 0.09
Nodes (57): buttons(), RunPermissionBody(), RunQuestionBody(), FOOTER_WIDTH_BREAKPOINTS, footerWidthPolicy(), createPermissionBodyState(), data(), Dict (+49 more)

### Community 9 - "CLI Entry & Message Body"
Cohesion: 0.09
Nodes (40): cleanRunText(), codeBody(), entryBody(), entryCanStream(), entryDone(), entryFlags, markdownBody(), reasoningBody() (+32 more)

### Community 10 - "Permission & Shell Tool"
Cohesion: 0.05
Nodes (54): hints(), layer, ARITY, BashArity, ask, auto(), Chunk, cmd() (+46 more)

### Community 11 - "Patch System"
Cohesion: 0.06
Nodes (56): AffectedPaths, applyHunksToFiles, applyPatch, ApplyPatchAction, ApplyPatchArgs, ApplyPatchError, ApplyPatchFileChange, ApplyPatchFileUpdate (+48 more)

### Community 12 - "Provider Transforms"
Cohesion: 0.06
Nodes (49): anthropicAdaptiveEfforts(), anthropicEffort(), anthropicOmitsThinking(), anthropicOpus47OrLater(), applyCaching(), budgetVariants(), effortVariants(), googleThinkingBudgetMax() (+41 more)

### Community 13 - "Skill Marketplace"
Cohesion: 0.06
Nodes (48): authedRequest(), defaultLayer, DiscoverableSkill, downloadTarball(), fetchSkillHubFile(), fetchSkillHubList(), fetchSkillHubSkillBySlug(), fetchSkillHubSkills() (+40 more)

### Community 14 - "Session Data Management"
Cohesion: 0.08
Nodes (51): bashCommand(), blockerStatus(), bootstrapSessionData(), claimShell(), Dict, doneShell(), doneTool(), drop() (+43 more)

### Community 15 - "Session Core"
Cohesion: 0.04
Nodes (48): ArchivedTimestamp, BusyError, cancelBackgroundJobs, ChildrenInput, CreatedEventSchema, CreateInput, defaultLayer, EmptyTokens (+40 more)

### Community 16 - "Run Footer State Machine"
Cohesion: 0.09
Nodes (3): createEmptySubagentState(), RunFooter, FooterView

### Community 17 - "Subagent Data Bootstrap"
Cohesion: 0.10
Nodes (47): formatError(), appendCommits(), applyChildEvent(), bootstrapChildEvent(), BootstrapChildMessage, bootstrapChildMessages(), bootstrapSubagentCalls(), bootstrapSubagentData() (+39 more)

### Community 18 - "TUI Plugin System"
Cohesion: 0.09
Nodes (45): resolveHostAttentionSoundPaths(), InternalTuiPlugin, internalTuiPlugins(), activatePlugin(), activatePluginById(), activatePluginEntry(), addExternalPluginEntries(), addPlugin() (+37 more)

### Community 19 - "Permission Evaluation"
Cohesion: 0.06
Nodes (38): defaultLayer, evaluate(), Event, expand(), fromConfig(), Interface, layer, node (+30 more)

### Community 20 - "CLI Debug Commands"
Cohesion: 0.09
Nodes (31): cmd(), WithDoubleDash, AgentCommand, ConfigCommand, FileCommand, FileListCommand, FileReadCommand, FileSearchCommand (+23 more)

### Community 21 - "LSP Server Definitions"
Cohesion: 0.04
Nodes (40): Astro, BashLS, Biome, Clangd, Clojure, CSharp, Dart, Deno (+32 more)

### Community 22 - "Prompt Display & Mention"
Cohesion: 0.09
Nodes (40): Auto, clamp(), clonePrompt(), createPromptState(), emptyPrompt(), extractLineRange(), Mention, MenuMode (+32 more)

### Community 23 - "Server Events & HTTP API"
Cohesion: 0.07
Nodes (33): Event, InstanceDisposed, EventSchema, InstanceHttpApiType, RootHttpApi, RootHttpApiType, InvalidRequestError, AuthParams (+25 more)

### Community 24 - "CLI Tool Permissions"
Cohesion: 0.05
Nodes (18): AnyToolRule, PatchFile, patchTitle(), snapPatch(), TOOL_RULES, ToolDefs, ToolDict, ToolInline (+10 more)

### Community 25 - "Server Routes"
Cohesion: 0.09
Nodes (41): LoongcodeHttpApi, QueryBoolean, QueryBooleanOpenApi, addLegacyErrorSchemas(), applyLegacySchemaOverrides(), canonicalizeSchema(), canonicalRef(), collapseDuplicateComponents() (+33 more)

### Community 26 - "Util Process"
Cohesion: 0.07
Nodes (35): cause(), createPlugTask(), defaultPlugDeps, PlugCtx, PlugDeps, PluginCommand, PlugInput, Spin (+27 more)

### Community 27 - "Cli Cmd"
Cohesion: 0.12
Nodes (41): Ask, askPermission(), clearSubagent(), createRunDemo(), doneTool(), emitBash(), emitEdit(), emitError() (+33 more)

### Community 28 - "Cli Cmd"
Cohesion: 0.08
Nodes (40): active(), blockerOrder(), composeFooter(), createLayer(), createSessionTransport(), firstByOrder(), formatUnknownError(), globalPayloadEvent() (+32 more)

### Community 29 - "Cli Cmd"
Cohesion: 0.09
Nodes (39): alpha(), ansiToRgba(), blend(), chroma(), ColorValue, fade(), fallbackSplashIndexed, fallbackSplashLeft (+31 more)

### Community 30 - "Acp Service"
Cohesion: 0.10
Nodes (37): parseModelSelection(), AssistantInfo, AuthMethodID, configOptions(), ConfigState, defaultModelFromConfig(), detectSlashCommand(), Error (+29 more)

### Community 31 - "Cli Cmd"
Cohesion: 0.08
Nodes (24): AgentCommand, AgentCreateCommand, AgentListCommand, AgentMode, AVAILABLE_PERMISSIONS, DbCommand, PathCommand, QueryCommand (+16 more)

### Community 32 - "Cli Cmd"
Cohesion: 0.10
Nodes (35): categoryRank(), CommandEntry, countLabel(), HALF_BLOCK_BORDER, handleKey(), match(), MenuState, ModelEntry (+27 more)

### Community 33 - "Server Routes"
Cohesion: 0.09
Nodes (33): registerDisposer(), make(), PtyForbiddenError, PtyNotFoundError, CursorQuery, Params, PtyApi, PtyConnectApi (+25 more)

### Community 34 - "Account Account"
Cohesion: 0.09
Nodes (33): Account, AccountOrgs, ActiveOrg, ClientId, defaultLayer, DeviceAuth, DeviceToken, DeviceTokenRequest (+25 more)

### Community 35 - "Project Instance"
Cohesion: 0.08
Nodes (22): bootstrap(), disposeInstance(), disposers, Info, layer, PluginPtyEnvironment, InstanceBootstrap, Interface (+14 more)

### Community 36 - "Control Plane"
Cohesion: 0.07
Nodes (32): error(), waitEvent(), ConnectionStatus, CreateError, CreateInput, defaultLayer, Event, fromRow() (+24 more)

### Community 37 - "Mcp Index"
Cohesion: 0.07
Nodes (31): AuthResult, AuthStatus, BrowserOpenFailed, CLIENT_OPTIONS, createClient(), CreateResult, defaultLayer, Failed (+23 more)

### Community 38 - "Plugin Install"
Cohesion: 0.09
Nodes (31): defaultInstallDeps, defaultPatchDeps, Err, exportOptions(), exportTarget(), exportValue(), hasMainTarget(), InstallDeps (+23 more)

### Community 39 - "Cli Cmd"
Cohesion: 0.14
Nodes (20): AcpCommand, AttachCommand, ServeCommand, createEventSource(), createWorkerFetch(), input(), resolveThreadDirectory(), RpcClient (+12 more)

### Community 40 - "Control Plane"
Cohesion: 0.10
Nodes (24): BUILTIN, getAdapter(), listAdapters(), registerAdapter(), registeredAdapters(), state, decodeWorktreeConfig, loadWorktree() (+16 more)

### Community 41 - "Session Compaction"
Cohesion: 0.08
Nodes (27): Image, ProviderTransform, CompletedCompaction, defaultLayer, Event, node, preserveRecentBudget(), PRUNE_MINIMUM (+19 more)

### Community 42 - "Util Repository"
Cohesion: 0.11
Nodes (26): githubInstall, BaseReference, buildFileReference(), buildRemoteReference(), FileReference, githubRemote(), hostLike(), InvalidRepositoryBranchError (+18 more)

### Community 43 - "Format Formatter"
Cohesion: 0.07
Nodes (28): biome, clang, cljfmt, Context, dart, dfmt, gleam, gofmt (+20 more)

### Community 44 - "Question Index"
Cohesion: 0.09
Nodes (24): Answer, base, defaultLayer, Event, Info, Interface, layer, node (+16 more)

### Community 45 - "Bus Global"
Cohesion: 0.12
Nodes (17): GlobalBus, GlobalBusEmitter, GlobalEvent, Heap, rpc, upgrade(), AppRuntime, upgrade() (+9 more)

### Community 46 - "Server Routes"
Cohesion: 0.10
Nodes (20): ApiNotFoundError, CommandPayload, EventTuiCommandExecute, EventTuiPromptAppend, EventTuiSessionSelect, EventTuiToastShow, TuiApi, TuiPaths (+12 more)

### Community 47 - "Plugin Xai"
Cohesion: 0.12
Nodes (25): authHeaders(), base64UrlEncode(), buildAuthorizeUrl(), CORS_ALLOWED_ORIGINS, DeviceCodeResponse, DeviceTokenErrorBody, exchangeCodeForTokens(), generatePKCE() (+17 more)

### Community 48 - "Server Server"
Cohesion: 0.11
Nodes (24): MDNS, publish(), unpublish(), HttpApiApp, Default, EffectListener, forceClose(), listen() (+16 more)

### Community 49 - "Worktree Index"
Cohesion: 0.08
Nodes (24): InstanceLayer, layer, appLayer, CreateFailedError, CreateInput, defaultLayer, Error, Event (+16 more)

### Community 50 - "Project Vcs"
Cohesion: 0.12
Nodes (26): ApplyInput, ApplyResult, defaultLayer, diffAgainstRef, DiffOptions, emptyBatch(), emptyPatch(), Event (+18 more)

### Community 51 - "Server Routes"
Cohesion: 0.11
Nodes (22): Workspace, notFound(), ApiVcsApplyError, InstancePaths, PathInfo, VcsDiffQuery, InstallRequest, OkResponse (+14 more)

### Community 52 - "Server Routes"
Cohesion: 0.13
Nodes (19): ProjectNotFoundError, ConfigApi, EventApi, EventPaths, PermissionApi, ReplyPayload, GenerateNamePayload, ProjectCopyApi (+11 more)

### Community 53 - "Acp Tool"
Cohesion: 0.11
Nodes (24): buildCompletedRawOutput, buildCompletedToolContent, buildCompletedToolUpdate, buildDuplicateRunningToolUpdate, buildErrorToolUpdate, buildPendingToolCall, buildRunningToolUpdate, completedToolContent() (+16 more)

### Community 54 - "Cli Cmd"
Cohesion: 0.11
Nodes (22): GithubCommand, GithubInstallCommand, GithubRunCommand, GitHubAuthor, GitHubComment, GitHubCommit, GitHubFile, GitHubIssue (+14 more)

### Community 55 - "Cli Cmd"
Cohesion: 0.14
Nodes (21): block(), FilePart, formatRunError(), Inline, ModelInput, pick(), resolveRunInput(), RunCommand (+13 more)

### Community 56 - "Util Filesystem"
Cohesion: 0.12
Nodes (13): exists(), findUp(), isEnoent(), normalizePath(), normalizePathPattern(), resolve(), size(), stat() (+5 more)

### Community 57 - "Plugin Loader"
Cohesion: 0.11
Nodes (24): layer, attempt(), AttemptResult, Candidate, errorMessage(), Input, isRetryableResolveError(), load() (+16 more)

### Community 58 - "Server Routes"
Cohesion: 0.10
Nodes (22): ConflictError, ForbiddenError, InvalidCursorError, McpServerNotFoundError, MessageNotFoundError, ModelNotFoundError, ProviderNotFoundError, ServiceUnavailableError (+14 more)

### Community 59 - "Provider Error"
Cohesion: 0.12
Nodes (20): connectionLimitError(), createWebSocketFetch(), CreateWebSocketFetchOptions, failedResponse(), invalidate(), OpenAIWebSocketPool, PoolEntry, socket() (+12 more)

### Community 60 - "Server Routes"
Cohesion: 0.15
Nodes (22): configuredWorkspaceID(), defaultDirectory(), InvalidWorkspaceID, missingWorkspaceResponse(), planRequest(), proxyRemote(), RemoteTarget, RequestPlan (+14 more)

### Community 61 - "Acp Usage"
Cohesion: 0.11
Nodes (22): AssistantMessage, AssistantTokenCost, buildUsage(), ContextLimitLoader, ContextLimitLoaderInterface, contextLimitLoaderLayer, defaultLayer, findContextLimit() (+14 more)

### Community 62 - "Plugin Openai"
Cohesion: 0.14
Nodes (17): abortError(), cancelError(), closeMessage(), connectResponsesWebSocket(), ConnectResponsesWebSocketOptions, isAbortError(), OpenAIWebSocket, parseWrappedError() (+9 more)

### Community 63 - "Skill Index"
Cohesion: 0.11
Nodes (20): ConfigMarkdown, Discovery, add, defaultLayer, discoverSkills, DiscoveryState, Info, Interface (+12 more)

### Community 64 - "Plugin Shared"
Cohesion: 0.16
Nodes (22): resolve(), checkPluginCompatibility(), createPluginEntry(), DEPRECATED_PLUGIN_PACKAGES, extractExportValue(), INDEX_FILES, packageMain(), parse() (+14 more)

### Community 65 - "Plugin Meta"
Cohesion: 0.15
Nodes (22): Core, Entry, entryCore(), fileTarget(), fingerprint(), list(), lock(), modifiedAt() (+14 more)

### Community 66 - "Provider Auth"
Cohesion: 0.09
Nodes (22): Authorization, AuthorizeInput, CallbackInput, defaultLayer, Error, Hook, Interface, Method (+14 more)

### Community 67 - "Session Message"
Cohesion: 0.11
Nodes (19): defaultLayer, extract(), Interface, layer, loaded(), node, Service, Cursor (+11 more)

### Community 68 - "Installation Index"
Cohesion: 0.09
Nodes (17): BrewFormula, BrewInfoV2, ChocoPackage, defaultLayer, Event, GitHubRelease, Info, Interface (+9 more)

### Community 69 - "Plugin Openai"
Cohesion: 0.15
Nodes (19): ALLOWED_MODELS, base64UrlEncode(), buildAuthorizeUrl(), CodexAuthPlugin(), CodexAuthPluginOptions, exchangeCodeForTokens(), extractAccountId(), extractAccountIdFromClaims() (+11 more)

### Community 70 - "Cli Cmd"
Cohesion: 0.20
Nodes (20): activeSuffix(), ConsoleCommand, defaultConsoleUrl, dim(), formatAccountLabel(), formatOrgChoiceLabel(), formatOrgLine(), isActiveOrgChoice() (+12 more)

### Community 71 - "Cli Cmd"
Cohesion: 0.20
Nodes (20): addMcpToConfig(), authState(), configuredServers(), getAuthStatusIcon(), getAuthStatusText(), isMcpConfigured(), isMcpRemote(), listState() (+12 more)

### Community 72 - "Cli Cmd"
Cohesion: 0.11
Nodes (21): count(), fallbackStart(), info(), lspTitle(), permEdit(), permLsp(), permRead(), runEdit() (+13 more)

### Community 73 - "Effect Bridge"
Cohesion: 0.16
Nodes (15): context, WorkspaceContext, wrap(), bind(), captureSync(), fromPromise(), make(), restoreWorkspace() (+7 more)

### Community 74 - "Lsp Client"
Cohesion: 0.13
Nodes (17): CapabilityRegistration, configurationValue(), create(), dedupeDiagnostics(), Diagnostic, DiagnosticRequestResult, DocumentDiagnosticReport, getFilePath() (+9 more)

### Community 75 - "Plugin Index"
Cohesion: 0.15
Nodes (18): AzureAuthPlugin(), CloudflareAIGatewayAuthPlugin(), CloudflareWorkersAuthPlugin(), DigitalOceanAuthPlugin(), CopilotAuthPlugin(), defaultLayer, experimentalWebSocketsEnabled(), getLegacyPlugins() (+10 more)

### Community 76 - "Storage Storage"
Cohesion: 0.11
Nodes (20): decodeMessage, decodeRoot, decodeSession, decodeSummary, defaultLayer, DiffFile, Error, file() (+12 more)

### Community 77 - "Config Tui"
Cohesion: 0.13
Nodes (15): load(), Acc, CurrentWorkingDirectory, defaultLayer, dropUnknownKeybinds(), HostMetadata, Info, Interface (+7 more)

### Community 78 - "Mcp Oauth"
Cohesion: 0.15
Nodes (16): cancelPending(), cleanupStateIndex(), ensureRunning(), handleRequest(), HTML_ERROR(), isPortInUse(), mcpNameToState, McpOAuthCallback (+8 more)

### Community 79 - "Session Message"
Cohesion: 0.12
Nodes (18): AuthError, MessageError, OutputLengthError, Shared, SharedSchema, FilePart, Info, Message (+10 more)

### Community 80 - "Acp Agent"
Cohesion: 0.18
Nodes (3): ACP, Agent, run()

### Community 81 - "Cli Cmd"
Cohesion: 0.22
Nodes (17): createToolContext, debugAgent, getAvailableTools, parseToolParams(), resolveTools(), run, cliTry(), handlePluginAuth (+9 more)

### Community 82 - "Git Index"
Cohesion: 0.12
Nodes (18): Base, cfg, defaultLayer, fail(), Git, Interface, Item, Kind (+10 more)

### Community 83 - "Packages Loongcode"
Cohesion: 0.14
Nodes (19): Explore Subagent, Plan Mode Workflow, Plan Subagent, Plan Mode Read-Only Constraint, Anthropic Plan Mode Reminder, LoongCode Trinity System Prompt, Apply Patch Tool, Edit Tool (+11 more)

### Community 84 - "Plugin Snowflake"
Cohesion: 0.18
Nodes (17): authBasicHeader(), authHeaders(), base64UrlEncode(), buildAuthorizeUrl(), callbackUrl(), exchangeCodeForToken(), generatePKCE(), generateRandomString() (+9 more)

### Community 85 - "Project Project"
Cohesion: 0.11
Nodes (18): defaultLayer, Event, fromRow(), GitResult, Info, Interface, layer, node (+10 more)

### Community 86 - "Session Retry"
Cohesion: 0.15
Nodes (16): cap(), delay(), Err, GO_UPSELL_MESSAGE, GO_UPSELL_URL, num(), parseJSON(), policy() (+8 more)

### Community 87 - "Acp Tool"
Cohesion: 0.22
Nodes (14): completedToolRawOutput(), completedToolUpdate(), duplicateRunningToolUpdate(), errorToolUpdate(), isShell(), locationFrom(), pendingToolCall(), rawInput() (+6 more)

### Community 88 - "Acp Permission"
Cohesion: 0.16
Nodes (12): ACPPermission, Connection, Handler, PermissionEvent, permissionOptions, Reply, selectedReply(), stringValue() (+4 more)

### Community 89 - "Cli Cmd"
Cohesion: 0.17
Nodes (17): createSessionData(), SessionData, active(), apply(), isShellSyntheticAssistant(), isShellSyntheticUser(), mergePatch(), replayActiveText() (+9 more)

### Community 90 - "Plugin Github"
Cohesion: 0.15
Nodes (13): base(), normalizeDomain(), RFC-8628, UTILITY_MODELS, build(), CopilotModels, decodeItem, decodeModels (+5 more)

### Community 91 - "Server Routes"
Cohesion: 0.19
Nodes (17): badRequest(), checkDirectRemote(), connectSSH(), establishTunnel(), execSSH(), expandTilde(), logEmitters, LogEvent (+9 more)

### Community 92 - "Session Llm"
Cohesion: 0.22
Nodes (17): baseURL(), content(), contentPart(), generation(), mediaPart(), messages(), model(), partProviderMetadata() (+9 more)

### Community 93 - "Account Repo"
Cohesion: 0.18
Nodes (15): AccountRepo, AccountRow, defaultLayer, Interface, layer, node, Service, use (+7 more)

### Community 94 - "Acp Directory"
Cohesion: 0.15
Nodes (16): build(), defaultLayer, DefaultModel, Directory, Interface, layer, Loader, LoaderInterface (+8 more)

### Community 95 - "Cli Cmd"
Cohesion: 0.18
Nodes (15): build(), Cell, cells(), draw(), entrySplash(), exitSplash(), push(), SPLASH_TITLE_FALLBACK (+7 more)

### Community 96 - "Cli Cmd"
Cohesion: 0.17
Nodes (14): formatSessionJSON(), formatSessionTable(), pagerCmd(), SessionCommand, SessionDeleteCommand, SessionListCommand, aggregateSessionStats, displayStats() (+6 more)

### Community 97 - "Image Image"
Cohesion: 0.12
Nodes (11): DecodeError, defaultLayer, Error, Interface, InvalidDataUrlError, JPEG_QUALITIES, layer, node (+3 more)

### Community 98 - "Acp Session"
Cohesion: 0.15
Nodes (15): defaultLayer, Info, Interface, KnownMessagePartMetadata, layer, makeSession(), partMetadataKey(), PartMetadataLookupInput (+7 more)

### Community 99 - "Cli Cmd"
Cohesion: 0.15
Nodes (16): fallbackFinal(), fallbackInline(), frame(), key(), markdownBody(), props(), rule(), shellOutput() (+8 more)

### Community 100 - "Config Parse"
Cohesion: 0.20
Nodes (11): ConfigAgent, load(), loadMode(), ConfigCommand, decodeInfo, load(), configEntryNameFromPath(), stripPrefix() (+3 more)

### Community 101 - "Server Auth"
Cohesion: 0.14
Nodes (11): ConfigMap, ConfigService, ServiceClass, Shape, Config, Credentials, DecodedCredentials, header() (+3 more)

### Community 102 - "Acp Config"
Cohesion: 0.24
Nodes (14): buildConfigOptions(), buildEffortSelectOption(), buildModelSelectOption(), buildModelSelectOptions(), buildModeSelectOption(), ConfigOptionMode, ConfigOptionModel, ConfigOptionProvider (+6 more)

### Community 103 - "Cli Cmd"
Cohesion: 0.15
Nodes (15): fail(), permList(), runBash(), runBatch(), runInvalid(), runList(), runPlanExit(), runWrite() (+7 more)

### Community 104 - "Tool Task"
Cohesion: 0.19
Nodes (12): userAgent(), part(), parts(), createStructuredOutputTool(), decodeMessageInfo, decodeMessagePart, isOrphanedInterruptedTool(), layer (+4 more)

### Community 105 - "Server Shared"
Cohesion: 0.25
Nodes (13): csp(), cspForHtml(), DEFAULT_CSP, embeddedUI(), embeddedUIResponse(), notFound(), proxyResponseHeaders(), requestBody() (+5 more)

### Community 106 - "Server Routes"
Cohesion: 0.13
Nodes (14): ConsoleOrgList, ConsoleOrgOption, ConsoleStateResponse, ConsoleSwitchPayload, ExperimentalApi, ExperimentalPaths, SessionListQuery, ToolIDs (+6 more)

### Community 107 - "Session Llm"
Cohesion: 0.20
Nodes (14): mcpHandlers, LLMNative, LLMNativeRuntime, nativeSchema(), nativeTools(), providerFetch(), providerHeaders(), RuntimeStatus (+6 more)

### Community 108 - "Acp Content"
Cohesion: 0.25
Nodes (12): audienceFlags(), contentBlockToParts(), decodeDataUrl(), filenameFromUri(), filePartToContentChunks(), partAudience(), partsToContentChunks(), partToContentChunks() (+4 more)

### Community 109 - "Auth Index"
Cohesion: 0.15
Nodes (13): Api, AuthError, defaultLayer, fail(), file, Info, Interface, layer (+5 more)

### Community 110 - "Tool Websearch"
Cohesion: 0.20
Nodes (13): permWebSearch(), runWebSearch(), scrollWebSearchStart(), provider(), callProvider(), parallelAuthHeaders(), Parameters, selectWebSearchProvider() (+5 more)

### Community 111 - "Id Id"
Cohesion: 0.21
Nodes (10): ascending(), create(), descending(), generateID(), Identifier, prefixes, randomBase62(), EventID (+2 more)

### Community 113 - "Tool Json"
Cohesion: 0.31
Nodes (13): cache, canFlattenAllOf(), dropDefinitionsIfResolved(), fromSchema(), fromTool(), hasLocalReference(), inlineLocalReferences(), isEmptyStructUnion() (+5 more)

### Community 114 - "Acp Error"
Cohesion: 0.15
Nodes (10): AuthRequiredError, Error, InvalidConfigOptionError, InvalidEffortError, InvalidModeError, InvalidModelError, ServiceFailureError, SessionNotFoundError (+2 more)

### Community 115 - "Cli Cmd"
Cohesion: 0.22
Nodes (12): cleanShellConfig(), collectRemovalTargets(), executeUninstall(), formatSize(), getDirectorySize(), getShellConfigFile(), RemovalTargets, shortenPath() (+4 more)

### Community 116 - "Util Media"
Cohesion: 0.27
Nodes (11): markdown(), ReadTool, convertHTMLToMarkdown(), extractTextFromHTML(), Parameters, WebFetchTool, isImageAttachment(), isMedia() (+3 more)

### Community 117 - "Mcp Auth"
Cohesion: 0.17
Nodes (12): AuthData, ClientInfo, decodeAuthData, defaultLayer, Entry, filepath, Interface, layer (+4 more)

### Community 118 - "Packages Loongcode"
Cohesion: 0.18
Nodes (13): Loongcode Agent Identity, AGENTS.md Convention, AGENTS.md Initialization Template, Anthropic System Prompt, Beast Autonomous Mode Prompt, Build Switch Mode Transition, Codex System Prompt, Copilot GPT-5 System Prompt (+5 more)

### Community 119 - "Packages Loongcode"
Cohesion: 0.17
Nodes (13): WebSocket HTTP Fallback, WebSocket Session Affinity, OpenAI Responses WebSocket Transport, SSE Streaming Endpoints, AI SDK Adapter, Dual Runtime Architecture (AI SDK + Native), LLMClient / RequestExecutor, LLMEvent Stream (+5 more)

### Community 120 - "Plugin Digitalocean"
Cohesion: 0.17
Nodes (5): buildAuthorizeUrl(), ImplicitTokenPayload, PendingOAuth, redirectUri(), RouterEntry

### Community 121 - "Server Proxy"
Cohesion: 0.22
Nodes (8): headers(), hop, ProxyUtil, sanitize(), http(), HttpApiProxy, requestBody(), statusText()

### Community 123 - "Mcp Catalog"
Cohesion: 0.26
Nodes (10): defs(), fetch(), isOutputSchemaValidationError(), listTools(), McpCatalog, paginate(), prompts(), resources() (+2 more)

### Community 124 - "Server Routes"
Cohesion: 0.17
Nodes (11): FileApi, FilePaths, FileQuery, FindFileQuery, FindSymbolQuery, FindTextQuery, LegacyContent, LegacyEntry (+3 more)

### Community 125 - "Session Llm"
Cohesion: 0.27
Nodes (11): adapterState(), AISDKEvent, copilotTotalNanoAiu(), currentReasoningID(), currentTextID(), finishReason(), LLMAISDK, providerMetadata() (+3 more)

### Community 126 - "Tool Mcp"
Cohesion: 0.23
Nodes (11): layer, call(), decode, EXA_URL, McpRequest(), McpResult, PARALLEL_URL, ParallelSearchArgs (+3 more)

### Community 127 - "Account Account"
Cohesion: 0.18
Nodes (8): accountErrorFromCause(), DeviceTokenError, isTokenFresh(), layer, mapAccountServiceError(), use, AccountTransportError, PollResult

### Community 128 - "Config Plugin"
Cohesion: 0.24
Nodes (9): InfoCommand, ConfigPlugin, deduplicatePluginOrigins(), Origin, pluginSpecifier(), resolvePluginSpec(), Scope, isAbsolutePath() (+1 more)

### Community 129 - "Cli Cmd"
Cohesion: 0.42
Nodes (10): data(), diff(), ExportCommand, filepart(), part(), redact(), run, sanitize() (+2 more)

### Community 130 - "Cli Cmd"
Cohesion: 0.29
Nodes (10): decodeMessageInfo, decodePart, ExportData, ImportCommand, parseShareUrl(), runImport, ShareData, shouldAttachShareAuthHeaders() (+2 more)

### Community 131 - "Cli Cmd"
Cohesion: 0.29
Nodes (10): OutputInput, patch(), StreamOutput, summarize(), Trace, traceCommit(), traceFooterOutput(), traceSubagentState() (+2 more)

### Community 132 - "Config Tui"
Cohesion: 0.33
Nodes (10): backupAndStripLegacy(), decodeDiffStyle, decodeRecord, decodeScrollAcceleration, decodeScrollSpeed, decodeTheme, MigrateInput, migrateTuiConfig() (+2 more)

### Community 133 - "Cli Effect"
Cohesion: 0.29
Nodes (6): autocomplete(), log, optional(), password(), select(), text()

### Community 134 - "Config Markdown"
Cohesion: 0.20
Nodes (8): fallbackSanitization, FILE_REGEX, files(), shell(), SHELL_REGEX, make(), latest(), layer

### Community 135 - "Server Routes"
Cohesion: 0.27
Nodes (8): HistoryEvent, HistoryPayload, ReplayEvent, ReplayPayload, ReplayResponse, SessionPayload, SyncApi, SyncPaths

### Community 136 - "Skill Discovery"
Cohesion: 0.24
Nodes (8): defaultLayer, Index, IndexSkill, Interface, layer, node, Service, withTransientReadRetry()

### Community 137 - "Env Index"
Cohesion: 0.22
Nodes (8): defaultLayer, Env, Interface, layer, node, Service, State, use

### Community 138 - "Server Shared"
Cohesion: 0.22
Nodes (5): sessionHandlers, tryParseJson(), diff(), HEADER, State

### Community 139 - "Effect Runner"
Cohesion: 0.25
Nodes (7): Busy, Cancelled, PendingHandle, RunHandle, Runner, ShellHandle, State

### Community 140 - "Tool Tool"
Cohesion: 0.29
Nodes (6): output(), resolve, Def, define(), init, wrap()

### Community 141 - "Plugin Tui"
Cohesion: 0.32
Nodes (8): applyPlugin(), readPluginId(), readV1Plugin(), resolvePluginId(), readThemeFiles(), resolveExternalPlugins(), resolveRoot(), warn()

### Community 142 - "Server Routes"
Cohesion: 0.25
Nodes (5): Close, Interface, layer, Service, WebSocketTracker

### Community 143 - "Session Message"
Cohesion: 0.32
Nodes (8): live, get, hydrate(), info(), older(), page, key(), layer

### Community 144 - "Acp Profile"
Cohesion: 0.43
Nodes (6): ACPProfile, duration(), mark(), measure(), started, write()

### Community 145 - "Cli Cmd"
Cohesion: 0.33
Nodes (7): num(), patchLine(), scrollBashFinal(), scrollPatchFinal(), scrollQuestionFinal(), scrollTodoFinal(), span()

### Community 146 - "Config Variable"
Cohesion: 0.33
Nodes (5): ConfigVariable, ParseSource, source(), substitute(), SubstituteInput

### Community 147 - "Project Vcs"
Cohesion: 0.38
Nodes (7): batchPatches, fileFromDiffPath(), fileFromGitHeader(), fileFromPatchChunk(), parsePathToken(), parseQuotedPath(), splitGitPatch()

### Community 148 - "Acp Event"
Cohesion: 0.33
Nodes (5): ReplayPart, ACPEvent, Connection, GlobalEventEnvelope, GlobalEventStream

### Community 149 - "Packages Loongcode"
Cohesion: 0.53
Nodes (6): Bus, busSchema, convertEvent, Event Sourcing, Projectors, SyncEvent

### Community 150 - "Server Routes"
Cohesion: 0.33
Nodes (3): compressionLayer, Encoding, STREAMING_PATHS

### Community 151 - "Util Wildcard"
Cohesion: 0.60
Nodes (5): all(), allStructured(), match(), matchSequence(), Wildcard

### Community 152 - "Config Paths"
Cohesion: 0.40
Nodes (3): ConfigPaths, directories, files

### Community 153 - "Lsp Server"
Cohesion: 0.50
Nodes (5): findVscodeRazorExtension(), getRoslynLanguageServer(), installRoslynLanguageServer(), pathExists(), roslynLanguageServerGlobalPath()

### Community 154 - "Server Routes"
Cohesion: 0.70
Nodes (4): eventData(), eventHandlers, eventID(), eventResponse()

### Community 155 - "Session Compaction"
Cohesion: 0.50
Nodes (5): completedCompactions(), layer, splitTurn(), summaryText(), turns()

### Community 156 - "Audio D"
Cohesion: 0.50
Nodes (3): *.mp3, *.wasm, *.wav

### Community 158 - "Lsp Diagnostic"
Cohesion: 0.67
Nodes (3): Diagnostic, pretty(), report()

### Community 159 - "Tool Question"
Cohesion: 0.50
Nodes (3): Metadata, Parameters, QuestionTool

### Community 161 - "Packages Loongcode"
Cohesion: 1.00
Nodes (3): Context Compaction Agent, Conversation Summary Agent, Thread Title Generator Agent

### Community 162 - "Packages Loongcode"
Cohesion: 0.67
Nodes (3): Error Schema Contracts, HttpApiBuilder, HttpApi Route Patterns

## Knowledge Gaps
- **1372 isolated node(s):** `AccountOrgs`, `ActiveOrg`, `RemoteConfig`, `DurationFromSeconds`, `TokenRefresh` (+1367 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RuntimeFlags` connect `Agent System` to `Tool System & Registry`, `AI Provider Integrations`, `Server HTTP API & Effect Runtime`, `Control Plane`, `Configuration System`, `Command System`, `Session Message`, `Session Compaction`, `Permission & Shell Tool`, `Plugin Index`, `Tool Websearch`, `Session Core`, `TUI Plugin System`, `Permission Evaluation`, `LSP Server Definitions`, `Project Project`, `Skill Index`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `Session` connect `Server HTTP API & Effect Runtime` to `Tool System & Registry`, `Cli Cmd`, `Cli Cmd`, `Configuration System`, `CLI Run Footer UI`, `Command System`, `Server Routes`, `Agent System`, `Session Core`, `Permission Evaluation`, `Control Plane`, `Server Routes`, `Session Compaction`, `Server Routes`, `Cli Cmd`, `Server Routes`, `Plugin Index`, `Cli Cmd`, `Cli Cmd`, `Server Routes`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Provider` connect `Configuration System` to `Tool System & Registry`, `AI Provider Integrations`, `Server HTTP API & Effect Runtime`, `Session Message`, `Command System`, `Agent System`, `Session Compaction`, `Session Llm`, `Session Core`, `Cli Cmd`, `Permission Evaluation`, `Server Routes`, `Cli Cmd`, `Acp Service`, `Session Llm`, `Acp Usage`, `Acp Directory`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `AccountOrgs`, `ActiveOrg`, `RemoteConfig` to the rest of the system?**
  _1372 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Tool System & Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.031777231777231775 - nodes in this community are weakly interconnected._
- **Should `AI Provider Integrations` be split into smaller, more focused modules?**
  _Cohesion score 0.02690700104493208 - nodes in this community are weakly interconnected._
- **Should `CLI Runtime Boot` be split into smaller, more focused modules?**
  _Cohesion score 0.04607046070460705 - nodes in this community are weakly interconnected._