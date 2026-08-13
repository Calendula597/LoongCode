import path from "path"
import { Context, Duration, Effect, Layer, Schema } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { Global } from "@loongcode/core/global"
import { FSUtil } from "@loongcode/core/fs-util"
import { Tarball } from "./tarball"
import { Repo } from "./repo"

const SKILLHUB_BASE = "https://skillhub.lgdg.cc"
const SKILLHUB_PROVIDER_ID = "skillhub"

const TTL = Duration.minutes(5)

// Zip-bomb guard: refuse archives that are oversized even in compressed form.
// Skill repos are KB-scale, so 20MB is generous. MAX_EXTRACTED_BYTES in
// tarball.ts remains the post-decompression second line of defense.
const MAX_TARBALL_BYTES = 20 * 1024 * 1024

// Per-key memoization over Effect.cachedWithTTL: concurrent callers of the same
// key share one in-flight computation, and the result is reused until the TTL
// expires. A cold-start race may build two wrappers for one key; the discarded
// loser only costs a single duplicate fetch on the first concurrent access.
function keyedCache<A>() {
  const store = new Map<string, Effect.Effect<A>>()
  return Effect.fnUntraced(function* (key: string, load: Effect.Effect<A>) {
    const existing = store.get(key)
    if (existing) return yield* existing
    const created = yield* Effect.cachedWithTTL(load, TTL)
    store.set(key, created)
    return yield* created
  })
}

export type RepoHost = Repo.RepoHost
export type SkillRepo = Repo.SkillRepo

export const DiscoverableSkill = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  source: Schema.Literals(["skillhub", "github", "gitee"]),
  namespace: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  repo: Schema.optional(Schema.String),
  installed: Schema.Boolean,
})
export type DiscoverableSkill = Schema.Schema.Type<typeof DiscoverableSkill>

export interface Interface {
  readonly repos: () => Effect.Effect<SkillRepo[]>
  readonly addRepo: (url: string) => Effect.Effect<SkillRepo, InvalidRepoUrlError>
  readonly removeRepo: (url: string) => Effect.Effect<void>
  readonly list: () => Effect.Effect<DiscoverableSkill[]>
  readonly install: (input: { source: "skillhub" | RepoHost; name: string }) => Effect.Effect<void, InstallError>
  readonly uninstall: (name: string) => Effect.Effect<void>
  readonly skillHubStatus: () => Effect.Effect<{ configured: boolean }>
  readonly setSkillHubKey: (key: string) => Effect.Effect<void, InvalidSkillHubKeyError>
  readonly removeSkillHubKey: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/SkillMarketplace") {}

export class InvalidRepoUrlError extends Schema.TaggedErrorClass<InvalidRepoUrlError>()("SkillMarketplace.InvalidRepoUrlError", {
  url: Schema.String,
}) {
  override get message() {
    return `Invalid repo URL (expected a GitHub or Gitee repository): ${this.url}`
  }
}

export class InstallError extends Schema.TaggedErrorClass<InstallError>()("SkillMarketplace.InstallError", {
  message: Schema.String,
}) {}

export class InvalidSkillHubKeyError extends Schema.TaggedErrorClass<InvalidSkillHubKeyError>()(
  "SkillMarketplace.InvalidSkillHubKeyError",
  {
    message: Schema.String,
  },
) {}

// SkillHub API wraps every response in a `{ code, data }` envelope.
const SkillHubItem = Schema.Struct({
  namespace: Schema.String,
  slug: Schema.String,
  displayName: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  headlineVersion: Schema.optional(Schema.Struct({ version: Schema.String })),
})
type SkillHubItem = Schema.Schema.Type<typeof SkillHubItem>

const SkillHubListResponse = Schema.Struct({
  data: Schema.Struct({
    items: Schema.optional(Schema.Array(SkillHubItem)),
    total: Schema.optional(Schema.Number),
  }),
})

const SkillHubFilesResponse = Schema.Struct({
  data: Schema.Array(Schema.Struct({ filePath: Schema.String })),
})

type SkillsConfig = { skills?: { urls?: string[]; paths?: string[] } }

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const http = yield* HttpClient.HttpClient
    const auth = yield* Auth.Service

    // Repo tarballs are keyed by their configured URL; SkillHub catalogue
    // responses are keyed by API key so a key change can never serve another
    // account's data.
    const repoEntries = keyedCache<ReadonlyArray<Tarball.TarEntry>>()
    const skillHubItems = keyedCache<ReadonlyArray<SkillHubItem>>()

    const skillhubKey = Effect.fn("SkillMarketplace.skillhubKey")(function* () {
      const info = yield* auth.get(SKILLHUB_PROVIDER_ID).pipe(Effect.option)
      return info._tag === "Some" && info.value?.type === "api" ? info.value.key : undefined
    })

    const installedNames = (cfg: SkillsConfig) =>
      new Set(
        (cfg.skills?.paths ?? []).flatMap((p) => {
          const normalized = p.replaceAll("\\", "/")
          const name = normalized.split("/").pop() ?? ""
          return name ? [name] : []
        }),
      )

    const normalizedPath = (p: string) => p.replaceAll("\\", "/")

    // Repo sources are opt-in: the user adds GitHub/Gitee repos explicitly; none are bundled.
    const effectiveRepoUrls = (cfg: SkillsConfig) => cfg.skills?.urls ?? []

    const writeSkillFiles = Effect.fn("SkillMarketplace.writeSkillFiles")(
      function* (skillDir: string, files: ReadonlyArray<Tarball.SkillFile>) {
        // Single choke point for archive path safety: every producer (tarball,
        // SkillHub, future sources) passes through here, and an unsafe relative
        // path fails the install rather than being silently skipped.
        const unsafe = files.find((file) => !Tarball.isSafePath(file.relativePath))
        if (unsafe) return yield* new InstallError({ message: `Unsafe file path in skill archive: "${unsafe.relativePath}"` })
        yield* fs.ensureDir(skillDir)
        yield* Effect.forEach(files, (file) => fs.writeWithDirs(path.join(skillDir, file.relativePath), file.content))
      },
    )

    const loadRepoEntries = (url: string): Effect.Effect<ReadonlyArray<Tarball.TarEntry>> => {
      const parsed = Repo.parseRepoUrl(url)
      if (!parsed) return Effect.succeed([])
      return resolveRepo(http, parsed).pipe(
        Effect.flatMap((repo) => (repo === null ? Effect.succeed(null) : downloadTarball(http, repo))),
        Effect.flatMap((buffer) => (buffer === null ? Effect.succeed([]) : Tarball.readEntries(buffer))),
        Effect.catch(() => Effect.succeed([])),
        // A corrupt archive dies inside readEntries; without this the defect (and
        // its cached replay) would 500 every list/install until a server restart.
        Effect.catchDefect(() => Effect.succeed([])),
      )
    }

    const repos = Effect.fn("SkillMarketplace.repos")(function* () {
      const cfg = yield* config.get()
      return effectiveRepoUrls(cfg).flatMap((url) => {
        const parsed = Repo.parseRepoUrl(url)
        return parsed ? [parsed] : []
      })
    })

    const addRepo = Effect.fn("SkillMarketplace.addRepo")(function* (url: string) {
      const parsed = Repo.parseRepoUrl(url)
      if (!parsed) return yield* new InvalidRepoUrlError({ url })

      const exists = yield* resolveRepo(http, parsed)
      if (!exists) return yield* new InvalidRepoUrlError({ url })

      const cfg = yield* config.get()
      const urls = effectiveRepoUrls(cfg)
      if (urls.includes(url)) return parsed

      yield* config.updateGlobal({ skills: { urls: [...urls, url] } })
      yield* config.invalidate()
      return parsed
    })

    const removeRepo = Effect.fn("SkillMarketplace.removeRepo")(function* (url: string) {
      const cfg = yield* config.get()
      const urls = effectiveRepoUrls(cfg)
      yield* config.updateGlobal({ skills: { urls: urls.filter((u) => u !== url) } })
      yield* config.invalidate()
    })

    const list = Effect.fn("SkillMarketplace.list")(function* () {
      const cfg = yield* config.get()
      const names = installedNames(cfg)

      const repoSkills = yield* Effect.forEach(
        [...effectiveRepoUrls(cfg)].reverse(),
        (url) =>
          Effect.gen(function* () {
            const repo = Repo.parseRepoUrl(url)
            if (!repo) return []
            const entries = yield* repoEntries(url, loadRepoEntries(url))
            return Tarball.scanEntriesForSkills(entries).map(
              (skill): DiscoverableSkill => ({
                name: skill.name,
                description: skill.description,
                source: repo.host,
                repo: `${repo.owner}/${repo.name}`,
                installed: names.has(skill.name),
              }),
            )
          }),
      ).pipe(Effect.map((nested) => nested.flat()))

      const hubKey = yield* skillhubKey()
      const items = yield* skillHubItems(hubKey ?? "", fetchSkillHubSkills(http, hubKey))
      const hubSkills = items.flatMap((item): DiscoverableSkill[] => {
        if (!item.headlineVersion?.version) return []
        const name = item.displayName ?? item.slug
        return [
          {
            name,
            description: item.summary,
            source: "skillhub",
            namespace: item.namespace,
            slug: item.slug,
            // SkillHub skills are installed under their filesystem-safe slug.
            installed: names.has(item.slug),
          },
        ]
      })

      // SkillHub catalogue first in public API order; repos last in reverse array order.
      return [...hubSkills, ...repoSkills]
    })

    const repoSkillFiles = Effect.fnUntraced(function* (cfg: SkillsConfig, host: RepoHost, name: string) {
      for (const url of effectiveRepoUrls(cfg)) {
        const repo = Repo.parseRepoUrl(url)
        if (!repo || repo.host !== host) continue
        const entries = yield* repoEntries(url, loadRepoEntries(url))
        const skill = Tarball.scanEntriesForSkills(entries).find((s) => s.name === name)
        if (!skill) continue
        return Tarball.extractEntriesFiles(entries, skill.path)
      }
      return null
    })

    const findSkillHubItem = Effect.fnUntraced(function* (apiKey: string | undefined, name: string) {
      const items = yield* skillHubItems(apiKey ?? "", fetchSkillHubSkills(http, apiKey))
      const listed = items.find(
        (item) => item.headlineVersion !== undefined && (item.slug === name || (item.displayName ?? item.slug) === name),
      )
      if (listed) return listed
      // Private skills never appear in list endpoints, but the owner's token
      // can read them by direct slug lookup (verified: detail/files/download
      // all return 200 for an owner's PRIVATE skill).
      if (!apiKey) return null
      return yield* fetchSkillHubSkillBySlug(http, apiKey, name)
    })

    const skillHubSkillFiles = Effect.fnUntraced(function* (apiKey: string | undefined, name: string) {
      const item = yield* findSkillHubItem(apiKey, name)
      if (!item?.headlineVersion) return null
      const version = item.headlineVersion.version

      const filesResponse = yield* authedRequest(
        http,
        `${SKILLHUB_BASE}/api/web/skills/${item.namespace}/${item.slug}/versions/${version}/files`,
        apiKey,
      ).pipe(http.execute, Effect.flatMap(HttpClientResponse.schemaBodyJson(SkillHubFilesResponse)))

      const files = yield* Effect.forEach(
        filesResponse.data,
        (fileItem) =>
          Effect.map(
            fetchSkillHubFile(http, item.namespace, item.slug, version, fileItem.filePath, apiKey),
            (content) => (content === null ? null : { relativePath: fileItem.filePath, content }),
          ),
        { concurrency: 8 },
      )
      return { slug: item.slug, files: files.filter((file): file is Tarball.SkillFile => file !== null) }
    })

    const persistSkill = Effect.fn("SkillMarketplace.persistSkill")(function* (
      cfg: SkillsConfig,
      skillDir: string,
      files: ReadonlyArray<Tarball.SkillFile>,
    ) {
      yield* writeSkillFiles(skillDir, files)
      const paths = cfg.skills?.paths ?? []
      if (paths.includes(skillDir)) return
      yield* config.updateGlobal({ skills: { paths: [...paths, skillDir] } })
      yield* config.invalidate()
    })

    const install = Effect.fn("SkillMarketplace.install")(
      function* ({ source, name }: { source: "skillhub" | RepoHost; name: string }) {
        const cfg = yield* config.get()

        if (source === "skillhub") {
          // SkillHub skills install under their filesystem-safe slug, not their
          // display name, which may contain spaces and slashes ("Word / DOCX").
          const resolved = yield* skillHubSkillFiles(yield* skillhubKey(), name)
          if (!resolved) return yield* new InstallError({ message: `Skill "${name}" not found in any source` })
          if (!Repo.isSafeSegment(resolved.slug)) return yield* new InstallError({ message: `Invalid skill name: "${resolved.slug}"` })
          return yield* persistSkill(cfg, path.join(Global.Path.data, "skills", resolved.slug), resolved.files)
        }

        const files = yield* repoSkillFiles(cfg, source, name)
        if (!files) return yield* new InstallError({ message: `Skill "${name}" not found in any source` })
        if (!Repo.isSafeSegment(name)) return yield* new InstallError({ message: `Invalid skill name: "${name}"` })
        return yield* persistSkill(cfg, path.join(Global.Path.data, "skills", name), files)
      },
      Effect.catch((error) =>
        Effect.fail(new InstallError({ message: error instanceof Error ? error.message : "Install failed" })),
      ),
    )

    const uninstall = Effect.fn("SkillMarketplace.uninstall")(function* (name: string) {
      const cfg = yield* config.get()
      // SkillHub skills are stored under their slug, so resolve it from the
      // display name the UI sends. Falls back to the given name.
      const slug = (yield* findSkillHubItem(yield* skillhubKey(), name).pipe(Effect.catch(() => Effect.succeed(null))))?.slug
      const leafNames = new Set([name, slug].filter((candidate): candidate is string => candidate !== undefined))
      const filtered = (cfg.skills?.paths ?? []).filter(
        (p) => !leafNames.has(normalizedPath(p).split("/").pop() ?? ""),
      )
      yield* config.updateGlobal({ skills: { paths: filtered } })
      yield* config.invalidate()
    })

    // The marketplace UI entry for configuring a SkillHub key is currently
    // disabled: SkillHub's "my skills" list endpoint is cookie-session-only
    // (API tokens get 403), so a configured key cannot surface private skills
    // in the catalogue. These methods remain for direct API use — a valid
    // token can still install a private skill by name via direct slug lookup.
    const skillHubStatus = Effect.fn("SkillMarketplace.skillHubStatus")(function* () {
      const info = yield* auth.get(SKILLHUB_PROVIDER_ID).pipe(Effect.option)
      return { configured: info._tag === "Some" && info.value !== undefined }
    })

    const setSkillHubKey = Effect.fn("SkillMarketplace.setSkillHubKey")(
      function* (key: string) {
        const trimmed = key.trim()
        if (!trimmed) return yield* new InvalidSkillHubKeyError({ message: "API key is required" })
        // Network failures must not masquerade as a rejected key: only an HTTP
        // response from the server can condemn the key itself.
        // Validate against the token-scoped identity endpoint: /api/web/me/*
        // is cookie-session-only and 403s every API token, while
        // /api/v1/auth/me returns 200 for a valid token and 401 otherwise.
        const status = yield* authedRequest(http, `${SKILLHUB_BASE}/api/v1/auth/me`, trimmed).pipe(
          http.execute,
          Effect.map((res) => res.status),
          Effect.catch((error) =>
            Effect.fail(
              new InvalidSkillHubKeyError({
                message: `Could not reach Skill Hub to validate the key: ${error instanceof Error ? error.message : String(error)}`,
              }),
            ),
          ),
        )
        if (status === 401) return yield* new InvalidSkillHubKeyError({ message: "Skill Hub API key was rejected" })
        if (status !== 200)
          return yield* new InvalidSkillHubKeyError({ message: `Skill Hub returned an unexpected status (HTTP ${status})` })
        yield* auth.set(SKILLHUB_PROVIDER_ID, { type: "api", key: trimmed }).pipe(
          Effect.catch(() => Effect.fail(new InvalidSkillHubKeyError({ message: "Failed to save API key" }))),
        )
      },
    )

    const removeSkillHubKey = Effect.fn("SkillMarketplace.removeSkillHubKey")(function* () {
      yield* auth.remove(SKILLHUB_PROVIDER_ID).pipe(Effect.catch(() => Effect.void))
    })

    return Service.of({
      repos,
      addRepo,
      removeRepo,
      list,
      install,
      uninstall,
      skillHubStatus,
      setSkillHubKey,
      removeSkillHubKey,
    })
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(FSUtil.defaultLayer))

// --- HTTP helpers ---

const RepoInfoResponse = Schema.Struct({ default_branch: Schema.optional(Schema.String) })

// Resolve the repo's default branch via the host API — GitHub repos usually
// default to "main" while Gitee repos often still use "master", so guessing
// breaks branch probes and tarball downloads. Returns null only when the host
// says the repo does not exist (404); transient errors keep the branch parsed
// from the URL so an outage neither blocks adding a repo nor breaks listing.
function resolveRepo(http: HttpClient.HttpClient, repo: SkillRepo): Effect.Effect<SkillRepo | null> {
  const url =
    repo.host === "gitee"
      ? `https://gitee.com/api/v5/repos/${repo.owner}/${repo.name}`
      : `https://api.github.com/repos/${repo.owner}/${repo.name}`
  const request = HttpClientRequest.get(url).pipe(
    repo.host === "github" ? HttpClientRequest.setHeader("User-Agent", "loongcode") : HttpClientRequest.acceptJson,
  )
  return request.pipe(
    http.execute,
    Effect.timeoutOption("10 seconds"),
    Effect.flatMap((maybe) => {
      if (maybe._tag === "None") return Effect.succeed(repo)
      const response = maybe.value
      if (response.status === 404) return Effect.succeed(null)
      if (response.status !== 200) return Effect.succeed(repo)
      return HttpClientResponse.schemaBodyJson(RepoInfoResponse)(response).pipe(
        Effect.map((info) => (info.default_branch ? { ...repo, branch: info.default_branch } : repo)),
        Effect.catch(() => Effect.succeed(repo)),
      )
    }),
    Effect.catch(() => Effect.succeed(repo)),
  )
}

function downloadTarball(http: HttpClient.HttpClient, repo: SkillRepo): Effect.Effect<Uint8Array | null> {
  const url =
    repo.host === "gitee"
      ? `https://gitee.com/${repo.owner}/${repo.name}/repository/archive/${repo.branch}.tar.gz`
      : `https://github.com/${repo.owner}/${repo.name}/archive/refs/heads/${repo.branch}.tar.gz`
  return HttpClientRequest.get(url).pipe(
    http.execute,
    Effect.flatMap((res) => (res.status === 200 ? Effect.succeed(res) : Effect.fail(null))),
    Effect.flatMap((res) => {
      const declared = Number(res.headers["content-length"] ?? 0)
      if (declared > MAX_TARBALL_BYTES) return Effect.succeed(null)
      return Effect.map(res.arrayBuffer, (buf) =>
        buf.byteLength > MAX_TARBALL_BYTES ? null : new Uint8Array(buf),
      )
    }),
    Effect.catch(() => Effect.succeed(null)),
  )
}

const SKILLHUB_PAGE_SIZE = 100

function fetchSkillHubSkills(http: HttpClient.HttpClient, apiKey?: string): Effect.Effect<ReadonlyArray<SkillHubItem>> {
  return fetchSkillHubList(http, `${SKILLHUB_BASE}/api/web/skills`, apiKey)
}

// The Skill Hub list API paginates by `page`/`size` and reports the full count
// in `data.total`. Fetch every page so catalogues larger than one page are
// fully returned instead of silently truncated.
function fetchSkillHubList(
  http: HttpClient.HttpClient,
  base: string,
  apiKey?: string,
): Effect.Effect<ReadonlyArray<SkillHubItem>> {
  const fetchPage = (page: number): Effect.Effect<{ items: SkillHubItem[]; total: number }> =>
    authedRequest(http, `${base}?page=${page}&size=${SKILLHUB_PAGE_SIZE}`, apiKey).pipe(
      http.execute,
      Effect.flatMap(HttpClientResponse.schemaBodyJson(SkillHubListResponse)),
      Effect.map((data) => ({ items: [...(data.data.items ?? [])], total: data.data.total ?? 0 })),
      Effect.catch(() => Effect.succeed({ items: [], total: 0 })),
    )

  return Effect.gen(function* () {
    const first = yield* fetchPage(0)
    if (first.items.length === 0 || first.total <= first.items.length) return first.items

    const remainingPages = Math.ceil(first.total / SKILLHUB_PAGE_SIZE) - 1
    const rest = yield* Effect.forEach(
      Array.from({ length: remainingPages }, (_, i) => i + 1),
      (page) => fetchPage(page).pipe(Effect.map((result) => result.items)),
      { concurrency: 4 },
    )
    return [...first.items, ...rest.flat()]
  })
}

function fetchSkillHubFile(
  http: HttpClient.HttpClient,
  namespace: string,
  slug: string,
  version: string,
  filePath: string,
  apiKey?: string,
): Effect.Effect<string | null> {
  const url = `${SKILLHUB_BASE}/api/web/skills/${namespace}/${slug}/versions/${version}/file?path=${encodeURIComponent(filePath)}`
  return authedRequest(http, url, apiKey).pipe(
    http.execute,
    Effect.flatMap((res) => (res.status === 200 ? res.text : Effect.succeed(null))),
    Effect.catch(() => Effect.succeed(null)),
  )
}

const SkillHubDetailResponse = Schema.Struct({
  data: Schema.Struct({
    namespace: Schema.String,
    slug: Schema.String,
    displayName: Schema.optional(Schema.String),
    summary: Schema.optional(Schema.String),
    headlineVersion: Schema.optional(Schema.Struct({ version: Schema.String })),
  }),
})

// Direct detail lookup by slug. This is the only token-accessible way to
// resolve a private skill: list endpoints never include PRIVATE entries and
// /api/web/me/skills is cookie-session-only (403 for API tokens). The
// marketplace only serves the "global" namespace today.
function fetchSkillHubSkillBySlug(
  http: HttpClient.HttpClient,
  apiKey: string,
  slug: string,
): Effect.Effect<SkillHubItem | null> {
  if (!Repo.isSafeSegment(slug)) return Effect.succeed(null)
  return authedRequest(http, `${SKILLHUB_BASE}/api/v1/skills/global/${encodeURIComponent(slug)}`, apiKey).pipe(
    http.execute,
    Effect.flatMap((res) => (res.status === 200 ? Effect.succeed(res) : Effect.fail(res.status))),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(SkillHubDetailResponse)),
    Effect.map((res): SkillHubItem => res.data),
    Effect.catch(() => Effect.succeed(null)),
  )
}

function authedRequest(http: HttpClient.HttpClient, url: string, apiKey?: string): HttpClientRequest.HttpClientRequest {
  const req = HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson)
  return apiKey ? HttpClientRequest.bearerToken(apiKey)(req) : req
}

export * as SkillMarketplace from "./marketplace"
