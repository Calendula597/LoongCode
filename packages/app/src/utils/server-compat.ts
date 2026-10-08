import type { ServerApi } from "./server"
import type { ServerProtocol } from "./server-protocol"
import type {
  AgentPartInput,
  FilePartInput,
  OpencodeClient,
  Project,
  Session,
  SnapshotFileDiff,
  TextPartInput,
  VcsFileStatus,
} from "@loongcode/sdk/v2/client"
import type {
  FilesFindOutput,
  FilesListOutput,
  IntegrationsConnectOauthOutput,
  IntegrationsGetOutput,
  PermissionsReplyInput,
  PermissionsReplyOutput,
  PtysCreateOutput,
  PtysGetOutput,
  PtysListOutput,
  PtysUpdateOutput,
  QuestionsReplyInput,
  QuestionsReplyOutput,
  QuestionsRejectInput,
  QuestionsRejectOutput,
  SessionsActiveOutput,
  SessionsCommitInput,
  SessionsCommitOutput,
  SessionsCompactInput,
  SessionsCompactOutput,
  SessionsCreateInput,
  SessionsGetInput,
  SessionsInterruptInput,
  SessionsListInput,
  SessionsListOutput,
  SessionsPromptInput,
} from "@loongcode/client"
import type { SessionInfo } from "./client-types"

// The V1 SDK client is the only client that still speaks the singular accessor names (`session`,
// `file`, `vcs`, ...) the app calls, so every shim below translates a V2 contract into V1 wire
// calls on it. The V2 client stays the base for everything the shims do not translate.
type LegacyClient = OpencodeClient
type LegacyFor = (directory?: string) => LegacyClient
// `RequestOptions` is not re-exported from the client entrypoint; only `signal` is ever passed.
type RequestOptions = { signal?: AbortSignal }
type LegacyLocation = { directory?: string }
type LegacyResponseLocation = {
  directory: string
  project: { id: string; directory: string }
}
type LegacyResponseTime = { created: number; expires: number }

// The app calls the singular accessor names, which the V2 client does not have (it renamed them to
// plural and dropped `vcs`/`project` outright), so each namespace is declared here and layered over
// `ServerApi`, which keeps serving the rest of the V2 surface unchanged.
export type CompatibleApi = ServerApi & {
  readonly session: CompatibleSessionApi
  readonly permission: CompatiblePermissionApi
  readonly project: CompatibleProjectApi
  readonly vcs: CompatibleVcsApi
  readonly file: CompatibleFileApi
  readonly integration: CompatibleIntegrationApi
  readonly pty: CompatiblePtyApi
  readonly question: CompatibleQuestionApi
}

// The base is the V2 `sessions` namespace: it is a plain object, so spreading it forwards every
// route the shim does not translate (`switchAgent`, `context`, `history`, ...) to the V2 client.
type CompatibleSessionApi = Omit<
  ServerApi["sessions"],
  "list" | "create" | "get" | "active" | "prompt" | "compact" | "interrupt"
> & {
  list: (
    input?: SessionsListInput & { parentID?: string | null },
    options?: RequestOptions,
  ) => Promise<SessionsListOutput>
  create: (input?: SessionsCreateInput) => Promise<SessionInfo>
  get: (input: SessionsGetInput) => Promise<SessionInfo>
  active: () => Promise<SessionsActiveOutput>
  interrupt: (input: SessionsInterruptInput) => Promise<void>
  compact: (input: SessionsCompactInput & { model?: LegacyPrompt["model"] }) => Promise<SessionsCompactOutput>
  prompt: (input: SessionsPromptInput & LegacyPrompt) => Promise<LegacyUserMessage>
  rename: (input: { sessionID: string; title: string } & LegacyLocation) => Promise<void>
  remove: (input: { sessionID: string } & LegacyLocation) => Promise<void>
  // V1-only actions: V2 has no `fork`, `command`, `shell` or nested `revert` routes.
  fork: (input: { sessionID: string; messageID?: string }) => Promise<SessionInfo>
  command: (input: LegacySessionCommandInput) => Promise<LegacyUserMessage>
  shell: (input: LegacySessionShellInput & LegacyPrompt) => Promise<void>
  revert: {
    stage: (input: { sessionID: string; messageID: string }) => Promise<{ messageID: string }>
    clear: (input: { sessionID: string }) => Promise<void>
    // V1 exposes no revert-commit route, so this stays on the V2 client, which does.
    commit: (input: SessionsCommitInput, options?: RequestOptions) => Promise<SessionsCommitOutput>
  }
}
type CompatiblePermissionApi = Omit<ServerApi["permissions"], "reply"> & {
  reply: (
    input: PermissionsReplyInput & { location?: LegacyLocation },
    options?: RequestOptions,
  ) => Promise<PermissionsReplyOutput>
}
type CompatibleFileApi = Omit<ServerApi["files"], "list" | "find"> & {
  list: (input?: { location?: LegacyLocation; path?: string }) => Promise<FilesListOutput>
  find: (
    input: { location?: LegacyLocation; query: string; type?: "file" | "directory"; limit?: number },
    options?: RequestOptions,
  ) => Promise<FilesFindOutput>
}
type CompatiblePtyApi = Omit<ServerApi["ptys"], "list" | "create" | "get" | "update" | "remove"> & {
  list: (input?: { location?: LegacyLocation }) => Promise<PtysListOutput>
  create: (input?: {
    location?: LegacyLocation
    command?: string
    args?: string[]
    cwd?: string
    title?: string
    env?: Record<string, string>
  }) => Promise<PtysCreateOutput>
  get: (input: { ptyID: string; location?: LegacyLocation }) => Promise<PtysGetOutput>
  update: (input: {
    ptyID: string
    title?: string
    size?: { cols: number; rows: number }
    location?: LegacyLocation
  }) => Promise<PtysUpdateOutput>
  remove: (input: { ptyID: string; location?: LegacyLocation }) => Promise<void>
}
type CompatibleQuestionApi = Omit<ServerApi["questions"], "reply" | "reject"> & {
  reply: (input: QuestionsReplyInput) => Promise<QuestionsReplyOutput>
  reject: (input: QuestionsRejectInput) => Promise<QuestionsRejectOutput>
}
// The V2 client has no `project` namespace at all, so these two are backed purely by the V1 SDK.
type CompatibleProjectApi = {
  list: () => Promise<Project[]>
  current: (input?: { location?: LegacyLocation }) => Promise<{ id: string; directory: string }>
  directories: (input: { projectID: string; location?: LegacyLocation }) => Promise<{ directory: string }[]>
}
type CompatibleVcsApi = {
  status: (input?: {
    location?: LegacyLocation
  }) => Promise<{ location: LegacyResponseLocation; data: VcsFileStatus[] }>
  diff: (input: {
    location?: LegacyLocation
    mode: "working" | "branch"
    context?: number
  }) => Promise<{ location: LegacyResponseLocation; data: SnapshotFileDiff[] }>
}
// The V2 client exposes integrations as a flat group with different action names, so there is no
// base namespace to spread and the whole surface is V1-backed.
type CompatibleIntegrationApi = {
  get: (input: { integrationID: string; location?: LegacyLocation }) => Promise<IntegrationsGetOutput>
  connect: { key: (input: { integrationID: string; key: string; location?: LegacyLocation }) => Promise<void> }
  oauth: {
    connect: (input: {
      integrationID: string
      methodID: string
      inputs: Record<string, string>
      location?: LegacyLocation
    }) => Promise<IntegrationsConnectOauthOutput>
    complete: (input: {
      integrationID: string
      attemptID: string
      code: string
      location?: LegacyLocation
    }) => Promise<void>
    status: (input: {
      integrationID: string
      attemptID: string
      location?: LegacyLocation
    }) => Promise<{ location: LegacyResponseLocation; data: { status: "complete"; time: LegacyResponseTime } }>
  }
}

// V1 `session.command` / `session.shell` carry V1-only fields the V2 contract dropped, and both
// echo back the V1 user-message shape rather than the V2 prompt output.
type LegacySessionCommandInput = {
  sessionID: string
  id?: string
  command: string
  arguments?: string
  agent?: string
  model?: { id: string; providerID: string; variant?: string }
  files?: { uri: string; name?: string }[]
  delivery?: "steer" | "queue"
}
type LegacyUserMessage = {
  admittedSeq: number
  id: string
  sessionID: string
  timeCreated: number
  type: "user"
  data: { text: string }
  delivery: "steer" | "queue"
}
type LegacySessionShellInput = { sessionID: string; id?: string; command: string }
type LegacyPrompt = {
  agent?: string
  model?: { providerID: string; modelID: string }
  variant?: string
  legacyParts?: (TextPartInput | FilePartInput | AgentPartInput)[]
}
type CompatibleInput = {
  protocol: Promise<ServerProtocol>
  current: ServerApi
  legacy: LegacyFor
  directory?: string
}

function mime(uri: string) {
  const match = /^data:([^;,]+)/.exec(uri)
  return match?.[1] ?? "application/octet-stream"
}

function sessionInfo(session: Session): SessionInfo {
  return {
    id: session.id,
    parentID: session.parentID,
    projectID: session.projectID,
    agent: session.agent,
    model: session.model && {
      id: session.model.id,
      providerID: session.model.providerID,
      variant: session.model.variant,
    },
    cost: session.cost ?? 0,
    tokens: session.tokens ?? { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: session.time,
    title: session.title,
    location: { directory: session.directory, workspaceID: session.workspaceID },
    subpath: session.path,
    revert: session.revert && {
      messageID: session.revert.messageID,
      partID: session.revert.partID,
      snapshot: session.revert.snapshot,
    },
  }
}

export function createCompatibleApi(input: CompatibleInput): CompatibleApi {
  const v1 = createV1Api(input)
  // `lazyApi` samples accessor names off its `shape` argument, so the shape has to be the
  // singular-named surface the app calls; `input.current` only answers to the V2 plural names.
  return lazyApi<CompatibleApi>(
    input.protocol.then((protocol) => (protocol === "v1" ? v1 : (input.current as CompatibleApi))),
    v1,
  )
}

function lazyApi<T extends object>(implementation: Promise<T>, shape: T): T {
  const cache = new Map<PropertyKey, unknown>()
  return new Proxy(shape, {
    get(target, property, receiver) {
      const sample = Reflect.get(target, property, receiver)
      if (typeof sample === "function") {
        return (...args: unknown[]) =>
          implementation.then((value) => {
            const method = Reflect.get(value, property)
            if (typeof method !== "function") throw new Error(`API method unavailable: ${String(property)}`)
            return Reflect.apply(method, value, args)
          })
      }
      if (sample === null || typeof sample !== "object") return sample
      if (cache.has(property)) return cache.get(property)
      const nested = lazyApi(
        implementation.then((value) => {
          const result = Reflect.get(value, property)
          if (result === null || typeof result !== "object") {
            throw new Error(`API namespace unavailable: ${String(property)}`)
          }
          return result
        }),
        sample,
      )
      cache.set(property, nested)
      return nested
    },
  })
}

function createV1Api(input: CompatibleInput): CompatibleApi {
  // Accepts both the V1 `{ directory }` wrapper and the V2 `{ location: { directory } }` one.
  const directory = (location?: LegacyLocation | null) => location?.directory ?? input.directory
  const legacy = (location?: LegacyLocation | null) => input.legacy(directory(location))
  const located = <T>(data: T, value?: LegacyLocation) => ({
    location: {
      directory: directory(value) ?? "",
      project: { id: "", directory: directory(value) ?? "" },
    },
    data,
  })

  return {
    ...input.current,
    session: {
      ...input.current.sessions,
      async list(value?: SessionsListInput & { parentID?: string | null }, options?: RequestOptions) {
        if (!value?.directory && value?.search !== undefined) {
          const result = await legacy().experimental.session.list(
            {
              roots: value.parentID === null ? true : undefined,
              search: value.search,
              limit: value.limit,
            },
            options,
          )
          return { data: (result.data ?? []).map(sessionInfo), cursor: {} }
        }
        const result = await legacy({ directory: value?.directory }).session.list({
          directory: value?.directory,
          roots: value?.parentID === null ? true : undefined,
          search: value?.search,
          limit: value?.limit,
        })
        return { data: (result.data ?? []).map(sessionInfo), cursor: {} }
      },
      async create(value?: SessionsCreateInput) {
        const result = await legacy(value?.location).session.create({
          directory: directory(value?.location),
        })
        if (!result.data) throw new Error("Failed to create session")
        return sessionInfo(result.data)
      },
      async get(value: SessionsGetInput) {
        const result = await legacy().session.get(value)
        if (!result.data) throw new Error(`Session not found: ${value.sessionID}`)
        return sessionInfo(result.data)
      },
      async active() {
        const result = await legacy().session.status()
        return Object.fromEntries(
          Object.entries(result.data ?? {}).flatMap(([sessionID, status]) =>
            status.type === "idle" ? [] : [[sessionID, { type: "running" as const }]],
          ),
        )
      },
      async rename(value: { sessionID: string; title: string } & LegacyLocation) {
        await legacy(value).session.update({ sessionID: value.sessionID, title: value.title })
      },
      // async rename(value: { sessionID: string } & LegacyLocation) {
      //   await legacy(value).session.update({ sessionID: value.sessionID, time: { archived: Date.now() } })
      // },
      async remove(value: { sessionID: string } & LegacyLocation) {
        await legacy(value).session.delete(value)
      },
      async fork(value: { sessionID: string; messageID?: string }) {
        const result = await legacy().session.fork(value)
        if (!result.data) throw new Error("Failed to fork session")
        return sessionInfo(result.data)
      },
      async interrupt(value: SessionsInterruptInput) {
        await legacy().session.abort(value)
      },
      async prompt(value: SessionsPromptInput & LegacyPrompt) {
        await legacy().session.promptAsync({
          sessionID: value.sessionID,
          messageID: value.id ?? undefined,
          agent: value.agent,
          model: value.model,
          variant: value.variant,
          parts: value.legacyParts ?? [
            { type: "text", text: value.prompt.text },
            ...(value.prompt.files ?? []).map((file) => ({
              type: "file" as const,
              mime: file.source ? "text/plain" : mime(file.uri),
              url: file.uri,
              filename: file.name,
              source: file.source
                ? {
                    type: "file" as const,
                    text: { value: file.source.text, start: file.source.start, end: file.source.end },
                    path: file.uri,
                  }
                : undefined,
            })),
            ...(value.prompt.agents ?? []).map((agent) => ({
              type: "agent" as const,
              name: agent.name,
              source: agent.source
                ? { value: agent.source.text, start: agent.source.start, end: agent.source.end }
                : undefined,
            })),
          ],
        })
        return {
          admittedSeq: 0,
          id: value.id ?? "",
          sessionID: value.sessionID,
          timeCreated: Date.now(),
          type: "user",
          data: { text: value.prompt.text },
          delivery: value.delivery ?? "steer",
        }
      },
      async command(value: LegacySessionCommandInput) {
        await legacy().session.command({
          sessionID: value.sessionID,
          messageID: value.id ?? undefined,
          command: value.command,
          arguments: value.arguments ?? "",
          agent: value.agent ?? undefined,
          model: value.model ? `${value.model.providerID}/${value.model.id}` : undefined,
          variant: value.model?.variant,
          parts: value.files?.map((file) => ({
            type: "file" as const,
            mime: mime(file.uri),
            url: file.uri,
            filename: file.name,
          })),
        })
        return {
          admittedSeq: 0,
          id: value.id ?? "",
          sessionID: value.sessionID,
          timeCreated: Date.now(),
          type: "user",
          data: { text: `/${value.command} ${value.arguments ?? ""}`.trim() },
          delivery: value.delivery ?? "steer",
        }
      },
      async shell(value: LegacySessionShellInput & LegacyPrompt) {
        await legacy().session.shell({
          sessionID: value.sessionID,
          command: value.command,
          agent: value.agent,
          model: value.model,
        })
      },
      compact: async (value: SessionsCompactInput & { model?: LegacyPrompt["model"] }) => {
        if (!value.model) throw new Error("A model is required to compact a V1 session")
        await legacy().session.summarize({
          sessionID: value.sessionID,
          providerID: value.model.providerID,
          modelID: value.model.modelID,
        })
      },
      revert: {
        stage: async (value: { sessionID: string; messageID: string }) => {
          await legacy().session.revert(value)
          return { messageID: value.messageID }
        },
        clear: async (value: { sessionID: string }) => {
          await legacy().session.unrevert(value)
        },
        // V1 has no revert-commit endpoint, so this stays on the V2 client, which does.
        commit: input.current.sessions.commit,
      },
    },
    // path: {
    //   ...input.current.path,
    //   async get(value?: { location?: LegacyLocation }) {
    //     const result = await legacy(value?.location).path.get()
    //     if (!result.data) throw new Error("Path unavailable")
    //     return result.data
    //   },
    // },
    project: {
      async list() {
        return ((await legacy().project.list()).data ?? []) as Project[]
      },
      async current(value?: { location?: LegacyLocation }) {
        const result = await legacy(value?.location).project.current()
        if (!result.data) throw new Error("Project not found")
        return { id: result.data.id, directory: result.data.worktree }
      },
      // async update(value: { projectID: string; name: string } & LegacyLocation) {
      //   const project = (await legacy().project.list()).data?.find((item) => item.id === value.projectID)
      //   const result = await legacy({ directory: project?.worktree }).project.update({
      //     ...value,
      //     directory: project?.worktree,
      //   })
      //   if (!result.data) throw new Error(`Project not found: ${value.projectID}`)
      //   return result.data as Project
      // },
      async directories(value: { projectID: string; location?: LegacyLocation }) {
        const result = await legacy(value.location).worktree.list()
        return (result.data ?? []).map((item) => ({ directory: item }))
      },
    },
    vcs: {
      // async get(value?: { location?: LegacyLocation }) {
      //   const result = await legacy(value?.location).vcs.get()
      //   return located({ branch: result.data?.branch, defaultBranch: result.data?.default_branch }, value?.location)
      // },
      async status(value?: { location?: LegacyLocation }) {
        const result = await legacy(value?.location).vcs.status()
        return located(result.data ?? [], value?.location)
      },
      async diff(value: { location?: LegacyLocation; mode: "working" | "branch"; context?: number }) {
        const result = await legacy(value.location).vcs.diff({
          mode: value.mode === "working" ? "git" : value.mode,
          context: value.context,
        })
        return located(
          (result.data ?? []).map((file) => ({
            file: file.file,
            patch: file.patch ?? "",
            additions: file.additions,
            deletions: file.deletions,
            status: file.status ?? "modified",
          })),
          value.location,
        )
      },
    },
    file: {
      ...input.current.files,
      async list(value?: { location?: LegacyLocation; path?: string }) {
        const result = await legacy(value?.location).file.list({ path: value?.path ?? "" })
        return located(result.data ?? [], value?.location)
      },
      async find(value: {
        location?: LegacyLocation
        query: string
        type?: "file" | "directory"
        limit?: number
      }) {
        const result = await legacy(value.location).find.files({
          query: value.query,
          dirs: value.type === undefined ? undefined : value.type === "directory" ? "true" : "false",
          limit: value.limit,
        })
        return located(
          (result.data ?? []).map((path) => ({ path, type: value.type ?? "file" })),
          value.location,
        )
      },
    },
    integration: {
      async get(value: { integrationID: string; location?: LegacyLocation }) {
        const methods = ((await legacy(value.location).provider.auth()).data?.[value.integrationID] ?? []).map(
          (method, index) =>
            method.type === "api"
              ? { type: "key" as const, label: method.label }
              : { type: "oauth" as const, id: String(index), label: method.label, prompts: method.prompts },
        )
        return located(
          {
            id: value.integrationID,
            name: value.integrationID,
            methods,
            connections: [],
          },
          value.location,
        )
      },
      connect: {
        key: async (value: { integrationID: string; key: string; location?: LegacyLocation }) => {
          await legacy(value.location).auth.set({
            providerID: value.integrationID,
            auth: { type: "api", key: value.key },
          })
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
        },
      },
      oauth: {
        connect: async (value: {
          integrationID: string
          methodID: string
          inputs: Record<string, string>
          location?: LegacyLocation
        }) => {
          const method = Number(value.methodID)
          const result = await legacy(value.location).provider.oauth.authorize(
            { providerID: value.integrationID, method, inputs: value.inputs },
            { throwOnError: true },
          )
          if (!result.data) throw new Error("Failed to start OAuth authorization")
          return located(
            {
              attemptID: `${value.integrationID}:${method}`,
              url: result.data.url,
              instructions: result.data.instructions,
              mode: result.data.method,
              time: { created: Date.now(), expires: Date.now() + 10 * 60 * 1000 },
            },
            value.location,
          )
        },
        complete: async (value: {
          integrationID: string
          attemptID: string
          code: string
          location?: LegacyLocation
        }) => {
          const method = Number(value.attemptID.split(":").at(-1))
          await legacy(value.location).provider.oauth.callback(
            { providerID: value.integrationID, method, code: value.code },
            { throwOnError: true },
          )
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
        },
        status: async (value: { integrationID: string; attemptID: string; location?: LegacyLocation }) => {
          const method = Number(value.attemptID.split(":").at(-1))
          await legacy(value.location).provider.oauth.callback(
            { providerID: value.integrationID, method },
            { throwOnError: true },
          )
          await legacy(value.location).instance.dispose()
          await input.legacy().instance.dispose()
          return located(
            { status: "complete" as const, time: { created: Date.now(), expires: Date.now() } },
            value.location,
          )
        },
      },
    },
    pty: {
      ...input.current.ptys,
      // async shells(value?: { location?: LegacyLocation }) {
      //   return located((await legacy(value?.location).pty.shells()).data ?? [], value?.location)
      // },
      async list(value?: { location?: LegacyLocation }) {
        return located((await legacy(value?.location).pty.list()).data ?? [], value?.location)
      },
      async create(value?: {
        location?: LegacyLocation
        command?: string
        args?: string[]
        cwd?: string
        title?: string
        env?: Record<string, string>
      }) {
        const result = await legacy(value?.location).pty.create({
          command: value?.command,
          args: value?.args ? [...value.args] : undefined,
          cwd: value?.cwd,
          title: value?.title,
          env: value?.env,
        })
        if (!result.data) throw new Error("Failed to create terminal")
        return located(result.data, value?.location)
      },
      async get(value: { ptyID: string; location?: LegacyLocation }) {
        const result = await legacy(value.location).pty.get({ ptyID: value.ptyID })
        if (!result.data) throw new Error(`Terminal not found: ${value.ptyID}`)
        return located(result.data, value.location)
      },
      async update(value: {
        ptyID: string
        title?: string
        size?: { cols: number; rows: number }
        location?: LegacyLocation
      }) {
        const result = await legacy(value.location).pty.update({
          ptyID: value.ptyID,
          title: value.title,
          size: value.size,
        })
        if (!result.data) throw new Error(`Terminal not found: ${value.ptyID}`)
        return located(result.data, value.location)
      },
      async remove(value: { ptyID: string; location?: LegacyLocation }) {
        await legacy(value.location).pty.remove({ ptyID: value.ptyID })
      },
      // async connectToken(value: { ptyID: string; location?: LegacyLocation }) {
      //   const result = await legacy(value.location).pty.connectToken({ ptyID: value.ptyID })
      //   if (!result.data) throw new Error(`Failed to connect terminal: ${value.ptyID}`)
      //   return located(result.data, value.location)
      // },
    },
    permission: {
      ...input.current.permissions,
      async reply(value: PermissionsReplyInput & { location?: LegacyLocation }, options?: RequestOptions) {
        await legacy(value.location).permission.respond(
          {
            sessionID: value.sessionID,
            permissionID: value.requestID,
            response: value.reply,
            directory: directory(value.location),
          },
          options,
        )
      },
    },
    question: {
      ...input.current.questions,
      async reply(value: QuestionsReplyInput) {
        await legacy().question.reply({
          requestID: value.requestID,
          answers: value.answers.map((answer) => [...answer]),
        })
      },
      async reject(value: QuestionsRejectInput) {
        await legacy().question.reject({ requestID: value.requestID })
      },
    },
  }
}
