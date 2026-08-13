import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import * as TestClock from "effect/testing/TestClock"
import { gzipSync } from "node:zlib"
import { FSUtil } from "@loongcode/core/fs-util"
import { Repo } from "../../src/skill/repo"
import { SkillMarketplace } from "../../src/skill/marketplace"
import { Config } from "../../src/config/config"
import { Auth } from "../../src/auth"
import { testEffect } from "../lib/effect"

describe("parseRepoUrl", () => {
  it("parses a standard GitHub URL with default branch", () => {
    const result = Repo.parseRepoUrl("https://github.com/anthropics/skills")
    expect(result).toEqual({
      host: "github",
      url: "https://github.com/anthropics/skills",
      owner: "anthropics",
      name: "skills",
      branch: "main",
    })
  })

  it("parses a GitHub URL with explicit branch", () => {
    const result = Repo.parseRepoUrl("https://github.com/anthropics/skills/tree/dev")
    expect(result).toEqual({
      host: "github",
      url: "https://github.com/anthropics/skills/tree/dev",
      owner: "anthropics",
      name: "skills",
      branch: "dev",
    })
  })

  it("parses a Gitee URL with default branch", () => {
    const result = Repo.parseRepoUrl("https://gitee.com/some-org/some-repo")
    expect(result).toEqual({
      host: "gitee",
      url: "https://gitee.com/some-org/some-repo",
      owner: "some-org",
      name: "some-repo",
      branch: "main",
    })
  })

  it("parses a Gitee URL with explicit branch", () => {
    const result = Repo.parseRepoUrl("https://gitee.com/some-org/some-repo/tree/master")
    expect(result).toEqual({
      host: "gitee",
      url: "https://gitee.com/some-org/some-repo/tree/master",
      owner: "some-org",
      name: "some-repo",
      branch: "master",
    })
  })

  it("parses a repo URL with trailing slash", () => {
    const result = Repo.parseRepoUrl("https://gitee.com/some-org/some-repo/")
    expect(result?.name).toBe("some-repo")
    expect(result?.branch).toBe("main")
  })

  it("returns null for unsupported hosts", () => {
    expect(Repo.parseRepoUrl("https://gitlab.com/anthropics/skills")).toBeNull()
    expect(Repo.parseRepoUrl("https://example.com/skills")).toBeNull()
  })

  it("returns null for incomplete repo URLs", () => {
    expect(Repo.parseRepoUrl("https://github.com/anthropics")).toBeNull()
    expect(Repo.parseRepoUrl("https://gitee.com/")).toBeNull()
  })

  it("strips the .git suffix", () => {
    expect(Repo.parseRepoUrl("https://gitee.com/some-org/some-repo.git")?.name).toBe("some-repo")
  })

  it("accepts the www prefix", () => {
    expect(Repo.parseRepoUrl("https://www.gitee.com/some-org/some-repo")?.host).toBe("gitee")
  })
})

type SkillsConfig = { skills?: { urls?: string[]; paths?: string[] } }

function mockConfigLayer(skills?: SkillsConfig["skills"]) {
  const config: SkillsConfig = { skills }
  return Layer.mock(Config.Service, {
    get: () => Effect.succeed(config),
    invalidate: () => Effect.void,
  })
}

// In-memory Auth mock so SkillMarketplace's Auth.Service requirement resolves.
function mockAuthLayer(withApiKey?: string) {
  const store = new Map<string, Auth.Info>()
  if (withApiKey) store.set("skillhub", { type: "api", key: withApiKey })
  return Layer.mock(Auth.Service, {
    get: (providerID) => Effect.succeed(store.get(providerID)),
    all: () => Effect.succeed(Object.fromEntries(store)),
    set: (key, info) => Effect.sync(() => store.set(key, info)),
    remove: (key) => Effect.sync(() => store.delete(key)),
  })
}

// Stub HttpClient so tests never touch the real network. The default client
// dies on any request, surfacing accidental network access as a defect.
function stubHttpLayer(handler: (request: HttpClientRequest.HttpClientRequest) => HttpClientResponse.HttpClientResponse) {
  return Layer.succeed(HttpClient.HttpClient, HttpClient.make((request) => Effect.succeed(handler(request))))
}

const noHttpLayer = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make(() => Effect.die("unexpected http call")),
)

const statusHttp = (status: number) =>
  stubHttpLayer((request) => HttpClientResponse.fromWeb(request, new Response(null, { status })))

const jsonResponse = (request: HttpClientRequest.HttpClientRequest, body: unknown, status = 200) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  )

const wordDocxItem = {
  namespace: "loongcode",
  slug: "word-docx",
  displayName: "Word / DOCX",
  headlineVersion: { version: "1.0.0" },
}

const skillHubHttp = stubHttpLayer((request) => jsonResponse(request, { data: { items: [wordDocxItem], total: 1 } }))

const marketplaceLayer = (
  inner: Layer.Layer<Config.Service, never, never>,
  options?: { apiKey?: string; http?: Layer.Layer<HttpClient.HttpClient> },
): Layer.Layer<SkillMarketplace.Service, never, never> =>
  Layer.provide(
    SkillMarketplace.layer,
    Layer.mergeAll(inner, mockAuthLayer(options?.apiKey), FSUtil.defaultLayer, options?.http ?? noHttpLayer),
  )

// Stateful mock that captures updateGlobal calls
function trackingConfigLayer(skills?: SkillsConfig["skills"]) {
  const config: SkillsConfig = { skills }
  const captured: SkillsConfig[] = []
  return {
    captured,
    layer: Layer.mock(Config.Service, {
      get: () => Effect.succeed(config),
      invalidate: () => Effect.void,
      updateGlobal: (patch) =>
        Effect.gen(function* () {
          captured.push(patch)
          // Merge the patch into config.skills so subsequent reads see it
          config.skills = { ...config.skills, ...patch.skills }
          return { info: config, changed: true }
        }),
    }),
  }
}

const reposIt = testEffect(marketplaceLayer( mockConfigLayer({ urls: [
  "https://github.com/anthropics/skills",
  "https://gitee.com/some-org/some-repo/tree/master",
  "https://example.com/not-a-repo",
] })))

describe("SkillMarketplace.repos", () => {
  reposIt.effect("returns parsed repos from config skills.urls", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const repos = yield* marketplace.repos()
      expect(repos).toHaveLength(2)
      expect(repos[0]).toEqual({
        host: "github",
        url: "https://github.com/anthropics/skills",
        owner: "anthropics",
        name: "skills",
        branch: "main",
      })
      expect(repos[1]).toEqual({
        host: "gitee",
        url: "https://gitee.com/some-org/some-repo/tree/master",
        owner: "some-org",
        name: "some-repo",
        branch: "master",
      })
    }),
  )

  const emptyIt = testEffect(marketplaceLayer( mockConfigLayer()))
  emptyIt.effect("returns no repos when no skills.urls configured", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const repos = yield* marketplace.repos()
      expect(repos).toEqual([])
    }),
  )
})

describe("SkillMarketplace.uninstall", () => {
  const track = trackingConfigLayer({
    paths: ["/data/skills/my-skill", "/data/skills/other-skill"],
  })
  const uninstallIt = testEffect(marketplaceLayer(track.layer, { http: skillHubHttp }))
  uninstallIt.effect("removes matching path from config skills.paths", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.uninstall("my-skill")
      expect(track.captured).toHaveLength(1)
      expect(track.captured[0]?.skills?.paths).toEqual(["/data/skills/other-skill"])
    }),
  )
})

describe("SkillMarketplace.removeRepo", () => {
  const track = trackingConfigLayer({
    urls: [
      "https://github.com/anthropics/skills",
      "https://github.com/ComposioHQ/awesome-claude-skills/tree/dev",
    ],
  })
  const removeIt = testEffect(marketplaceLayer( track.layer))
  removeIt.effect("removes URL from config skills.urls", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.removeRepo("https://github.com/anthropics/skills")
      expect(track.captured).toHaveLength(1)
      expect(track.captured[0]?.skills?.urls).toEqual([
        "https://github.com/ComposioHQ/awesome-claude-skills/tree/dev",
      ])
    }),
  )

  const emptyTrack = trackingConfigLayer()
  const emptyRemoveIt = testEffect(marketplaceLayer( emptyTrack.layer))
  emptyRemoveIt.effect("writes empty urls when removing from empty config", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.removeRepo("https://github.com/anthropics/skills")
      expect(emptyTrack.captured).toHaveLength(1)
      expect(emptyTrack.captured[0]?.skills?.urls).toEqual([])
    }),
  )
})

describe("SkillMarketplace.addRepo", () => {
  const track = trackingConfigLayer()
  const addIt = testEffect(marketplaceLayer(track.layer, { http: statusHttp(200) }))
  addIt.effect("writes a valid Gitee URL to config skills.urls", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const result = yield* marketplace.addRepo("https://gitee.com/oschina/git-osc/tree/master")
      expect(result).toEqual({
        host: "gitee",
        url: "https://gitee.com/oschina/git-osc/tree/master",
        owner: "oschina",
        name: "git-osc",
        branch: "master",
      })
      expect(track.captured).toHaveLength(1)
      expect(track.captured[0]?.skills?.urls).toEqual(["https://gitee.com/oschina/git-osc/tree/master"])
    }),
  )

  const dupTrack = trackingConfigLayer({ urls: ["https://gitee.com/oschina/git-osc/tree/master"] })
  const dupIt = testEffect(marketplaceLayer(dupTrack.layer, { http: statusHttp(200) }))
  dupIt.effect("does not write when URL already exists", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.addRepo("https://gitee.com/oschina/git-osc/tree/master")
      expect(dupTrack.captured).toHaveLength(0)
    }),
  )

  const invalidIt = testEffect(marketplaceLayer(mockConfigLayer()))
  invalidIt.effect("fails for non-GitHub/Gitee URL", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const exit = yield* Effect.exit(marketplace.addRepo("https://gitlab.com/foo/bar"))
      expect(exit._tag).toBe("Failure")
    }),
  )

  const nonexistentIt = testEffect(marketplaceLayer(mockConfigLayer(), { http: statusHttp(404) }))
  nonexistentIt.effect("rejects a repo that does not exist", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const exit = yield*
        Effect.exit(marketplace.addRepo("https://gitee.com/loongcode/not-a-real-repo/tree/master"))
      expect(exit._tag).toBe("Failure")
    }),
  )
})

describe("SkillMarketplace skillhub slug detection", () => {
  const notInstalledIt = testEffect(marketplaceLayer(mockConfigLayer(), { http: skillHubHttp }))

  notInstalledIt.effect("reports a display-name skill as not installed when no slug dir exists", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const list = yield* marketplace.list()
      const word = list.find((s) => s.name === "Word / DOCX")
      expect(word).toBeDefined()
      expect(word?.installed).toBe(false)
    }),
  )

  const installedIt = testEffect(
    marketplaceLayer(mockConfigLayer({ paths: ["/data/skills/word-docx"] }), { http: skillHubHttp }),
  )

  installedIt.effect("marks a skill installed when its slug directory exists, even with a non-safe display name", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const list = yield* marketplace.list()
      const word = list.find((s) => s.name === "Word / DOCX")
      expect(word?.installed).toBe(true)
      expect(word?.slug).toBe("word-docx")
    }),
  )
})

describe("SkillMarketplace skillhub credentials", () => {
  const track = trackingConfigLayer()
  const credIt = testEffect(marketplaceLayer(track.layer, { http: statusHttp(401) }))

  credIt.effect("skillHubStatus reports not configured when no key is stored", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      expect(yield* marketplace.skillHubStatus()).toEqual({ configured: false })
    }),
  )

  credIt.effect("setSkillHubKey rejects an empty key", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const exit = yield* Effect.exit(marketplace.setSkillHubKey(""))
      expect(exit._tag).toBe("Failure")
    }),
  )

  credIt.effect("setSkillHubKey rejects a key rejected by the Skill Hub API", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const exit = yield* Effect.exit(marketplace.setSkillHubKey("sk_definitely_invalid_test"))
      expect(exit._tag).toBe("Failure")
    }),
  )

  // Validation goes through /api/v1/auth/me: 200 for a valid token.
  const validIt = testEffect(marketplaceLayer(mockConfigLayer(), { http: statusHttp(200) }))
  validIt.effect("setSkillHubKey accepts a key accepted by the Skill Hub API", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.setSkillHubKey("sk_valid_key")
      expect(yield* marketplace.skillHubStatus()).toEqual({ configured: true })
    }),
  )

  const configuredIt = testEffect(marketplaceLayer(trackingConfigLayer().layer, { apiKey: "sk_stored_key" }))
  configuredIt.effect("skillHubStatus reports configured when a key is stored", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      expect(yield* marketplace.skillHubStatus()).toEqual({ configured: true })
    }),
  )

  configuredIt.effect("removeSkillHubKey clears the stored key", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.removeSkillHubKey()
      expect(yield* marketplace.skillHubStatus()).toEqual({ configured: false })
    }),
  )
})

// --- TTL cache helpers ---

function countingHttp(handler: (req: HttpClientRequest.HttpClientRequest) => HttpClientResponse.HttpClientResponse) {
  const state = { count: 0 }
  return {
    count: () => state.count,
    layer: Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((req) => {
        state.count++
        return Effect.succeed(handler(req))
      }),
    ),
  }
}

// A valid minimal gzip tar archive (two 512-byte zero blocks = end-of-archive marker).
const emptyTarGzip = gzipSync(new Uint8Array(1024))

function tarballStub(request: HttpClientRequest.HttpClientRequest) {
  return HttpClientResponse.fromWeb(request, new Response(emptyTarGzip, { status: 200 }))
}

function failStub(request: HttpClientRequest.HttpClientRequest) {
  return HttpClientResponse.fromWeb(request, new Response(null, { status: 500 }))
}

// First list() makes 1 repo-info + 1 tarball + 1 SkillHub catalogue request = 3 total.
const FIRST_LIST_REQUESTS = 3

// --- Ticket 01: Repo tarball TTL cache ---

describe("SkillMarketplace tarball TTL cache", () => {
  const successHttp = countingHttp(tarballStub)
  const successIt = testEffect(
    marketplaceLayer(
      mockConfigLayer({ urls: ["https://github.com/anthropics/skills"] }),
      { http: successHttp.layer },
    ),
  )

  successIt.effect("second list() within 5 minutes issues no tarball download", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const before = successHttp.count()
      yield* marketplace.list()
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS)
      yield* marketplace.list()
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS)
    }),
  )

  successIt.effect("list() after TTL re-downloads the tarball", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const before = successHttp.count()
      yield* marketplace.list()
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS)
      yield* TestClock.adjust("6 minutes")
      yield* marketplace.list()
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS * 2)
    }),
  )

  successIt.effect("install following list() issues no tarball download for that repo", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const before = successHttp.count()
      yield* marketplace.list()
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS)
      yield* marketplace.install({ source: "github", name: "test-skill" }).pipe(Effect.catch(() => Effect.void))
      expect(successHttp.count()).toBe(before + FIRST_LIST_REQUESTS)
    }),
  )

  const failHttp = countingHttp(failStub)
  const failIt = testEffect(
    marketplaceLayer(
      mockConfigLayer({ urls: ["https://github.com/anthropics/skills"] }),
      { http: failHttp.layer },
    ),
  )

  failIt.effect("failed download is not retried within TTL", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      expect(failHttp.count()).toBe(FIRST_LIST_REQUESTS)
      yield* marketplace.list()
      expect(failHttp.count()).toBe(FIRST_LIST_REQUESTS)
    }),
  )
})

// --- Ticket 02: SkillHub catalogue TTL cache ---

describe("SkillMarketplace SkillHub catalogue TTL cache", () => {
  const skillHubHttp = countingHttp((request) => jsonResponse(request, { data: { items: [wordDocxItem], total: 1 } }))

  const skillHubIt = testEffect(
    marketplaceLayer(mockConfigLayer(), { http: skillHubHttp.layer }),
  )

  skillHubIt.effect("second list() within TTL issues no SkillHub requests", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubHttp.count()
      expect(afterFirst).toBeGreaterThan(0)
      yield* marketplace.list()
      expect(skillHubHttp.count()).toBe(afterFirst)
    }),
  )

  skillHubIt.effect("list() after TTL refetches the full paginated lists", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubHttp.count()
      yield* TestClock.adjust("6 minutes")
      yield* marketplace.list()
      expect(skillHubHttp.count()).toBeGreaterThan(afterFirst)
    }),
  )

  skillHubIt.effect("with no SkillHub key, lists are cached", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubHttp.count()
      yield* marketplace.list()
      expect(skillHubHttp.count()).toBe(afterFirst)
    }),
  )
})

// --- Ticket 03: Mutation invalidation ---

describe("SkillMarketplace mutation invalidation", () => {
  const tarballTrack = trackingConfigLayer({ urls: ["https://github.com/anthropics/skills"] })
  const tarballHttp = countingHttp(tarballStub)
  const tarballIt = testEffect(
    marketplaceLayer(tarballTrack.layer, { http: tarballHttp.layer }),
  )

  tarballIt.effect("addRepo fetches only the newly added repo", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = tarballHttp.count()
      yield* marketplace.addRepo("https://github.com/foo/bar")
      yield* marketplace.list()
      // The new repo costs 3 requests (addRepo's repo-info probe, then repo-info
      // + tarball on list); the existing repo stays fully cached.
      expect(tarballHttp.count()).toBe(afterFirst + 3)
    }),
  )

  tarballIt.effect("removeRepo leaves other cached repos untouched", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = tarballHttp.count()
      yield* marketplace.removeRepo("https://github.com/anthropics/skills")
      yield* marketplace.list()
      // Nothing to fetch: the only configured repo was removed, and its stale
      // cache entry is simply unreachable.
      expect(tarballHttp.count()).toBe(afterFirst)
    }),
  )

  const skillHubInvHttp = countingHttp((request) => jsonResponse(request, { data: { items: [wordDocxItem], total: 1 } }))

  const skillHubInvIt = testEffect(
    marketplaceLayer(
      mockConfigLayer(),
      { http: skillHubInvHttp.layer },
    ),
  )

  skillHubInvIt.effect("setSkillHubKey refetches the catalogue under the new cache key", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubInvHttp.count()
      yield* marketplace.setSkillHubKey("sk_test_key")
      yield* marketplace.list()
      expect(skillHubInvHttp.count()).toBeGreaterThan(afterFirst)
    }),
  )

  const skillHubKeyedHttp = countingHttp((request) =>
    request.url.includes("/api/v1/auth/me")
      ? HttpClientResponse.fromWeb(request, new Response(null, { status: 200 }))
      : jsonResponse(request, { data: { items: [wordDocxItem], total: 1 } }),
  )
  const skillHubKeyedIt = testEffect(
    marketplaceLayer(mockConfigLayer(), { apiKey: "sk_stored_key", http: skillHubKeyedHttp.layer }),
  )

  skillHubKeyedIt.effect("removeSkillHubKey refetches the catalogue under the anonymous cache key", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubKeyedHttp.count()
      yield* marketplace.removeSkillHubKey()
      yield* marketplace.list()
      expect(skillHubKeyedHttp.count()).toBeGreaterThan(afterFirst)
    }),
  )

  skillHubKeyedIt.effect("different API keys never share cached catalogue data", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubKeyedHttp.count()
      // Switching accounts must miss the cache keyed by the previous token.
      yield* marketplace.setSkillHubKey("sk_other_account")
      yield* marketplace.list()
      expect(skillHubKeyedHttp.count()).toBeGreaterThan(afterFirst)
    }),
  )

  skillHubInvIt.effect("install causes no cache invalidation", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      yield* marketplace.install({ source: "skillhub", name: "Word / DOCX" }).pipe(Effect.catch(() => Effect.void))
      const afterInstall = skillHubInvHttp.count()
      yield* marketplace.list()
      expect(skillHubInvHttp.count()).toBe(afterInstall)
    }),
  )

  const uninstallTrack = trackingConfigLayer({ paths: ["/data/skills/word-docx"] })
  const uninstallIt = testEffect(
    marketplaceLayer(uninstallTrack.layer, { http: skillHubInvHttp.layer }),
  )

  uninstallIt.effect("uninstall causes no cache invalidation", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* marketplace.list()
      const afterFirst = skillHubInvHttp.count()
      yield* marketplace.uninstall("word-docx")
      yield* marketplace.list()
      expect(skillHubInvHttp.count()).toBe(afterFirst)
    }),
  )
})

// --- Ticket 04: Concurrent dedup ---

describe("SkillMarketplace in-flight dedup", () => {
  const dedupHttp = countingHttp((request) =>
    request.url.includes("skillhub") ? jsonResponse(request, { data: { items: [], total: 0 } }) : tarballStub(request),
  )
  const dedupIt = testEffect(
    marketplaceLayer(mockConfigLayer({ urls: ["https://github.com/anthropics/skills"] }), {
      http: dedupHttp.layer,
    }),
  )

  dedupIt.effect("concurrent list() calls share a single round of requests", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      yield* Effect.all([marketplace.list(), marketplace.list()], { concurrency: 2 })
      expect(dedupHttp.count()).toBe(FIRST_LIST_REQUESTS)
    }),
  )
})

// --- Ticket 05: Install path safety ---

describe("SkillMarketplace install path safety", () => {
  const track = trackingConfigLayer()
  // A hostile SkillHub server answering with a traversal path in the file list.
  const evilHubHttp = stubHttpLayer((request) => {
    if (request.url.includes("/versions/1.0.0/files")) {
      return jsonResponse(request, { data: [{ filePath: "../evil.txt" }] })
    }
    if (request.url.includes("/versions/1.0.0/file")) {
      return HttpClientResponse.fromWeb(request, new Response("evil", { status: 200 }))
    }
    return jsonResponse(request, { data: { items: [wordDocxItem], total: 1 } })
  })
  const evilIt = testEffect(marketplaceLayer(track.layer, { http: evilHubHttp }))

  evilIt.effect("rejects a SkillHub skill whose file paths escape the skill directory", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const exit = yield* Effect.exit(marketplace.install({ source: "skillhub", name: "Word / DOCX" }))
      expect(exit._tag).toBe("Failure")
      expect(String(exit)).toContain("Unsafe file path")
      // The install must fail before any config write happens.
      expect(track.captured).toHaveLength(0)
    }),
  )
})

// --- Ticket 06: Compressed tarball size limit ---

describe("SkillMarketplace tarball size limit", () => {
  const oversizeHttp = countingHttp((request) =>
    request.url.includes("skillhub")
      ? jsonResponse(request, { data: { items: [], total: 0 } })
      : HttpClientResponse.fromWeb(
          request,
          // A lying or hostile server announcing an oversized compressed body.
          new Response(emptyTarGzip, { status: 200, headers: { "content-length": String(21 * 1024 * 1024) } }),
        ),
  )
  const oversizeIt = testEffect(
    marketplaceLayer(mockConfigLayer({ urls: ["https://github.com/anthropics/skills"] }), {
      http: oversizeHttp.layer,
    }),
  )

  oversizeIt.effect("refuses a tarball whose declared compressed size exceeds the limit", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const list = yield* marketplace.list()
      expect(list.find((s) => s.source === "github")).toBeUndefined()
    }),
  )
})

// --- Ticket 07: Default branch resolution ---

// Minimal tar with one SKILL.md. parseTar reads header fields only, so the
// checksum block can stay zeroed.
function skillTarGzip(): Uint8Array {
  const content = new TextEncoder().encode("---\nname: test-skill\n---\n# Test\n")
  const header = new Uint8Array(512)
  header.set(new TextEncoder().encode("repo-master/test-skill/SKILL.md"), 0)
  header.set(new TextEncoder().encode(content.length.toString(8).padStart(11, "0") + "\0"), 124)
  header[156] = 0x30
  const tar = new Uint8Array(512 + 512 * Math.ceil(content.length / 512) + 1024)
  tar.set(header, 0)
  tar.set(content, 512)
  return gzipSync(tar)
}

describe("SkillMarketplace default branch resolution", () => {
  // The repo's default branch is "master" while parseRepoUrl guesses "main";
  // only the master tarball URL serves content.
  const masterHttp = stubHttpLayer((request) => {
    if (request.url.includes("gitee.com/api/")) return jsonResponse(request, { default_branch: "master" })
    if (request.url.includes("skillhub")) return jsonResponse(request, { data: { items: [], total: 0 } })
    if (request.url.includes("/repository/archive/master.tar.gz")) {
      return HttpClientResponse.fromWeb(request, new Response(skillTarGzip() as unknown as BodyInit, { status: 200 }))
    }
    return HttpClientResponse.fromWeb(request, new Response("not found", { status: 404 }))
  })
  const masterIt = testEffect(
    marketplaceLayer(mockConfigLayer({ urls: ["https://gitee.com/acme/skills"] }), { http: masterHttp }),
  )

  masterIt.effect("downloads the tarball from the API-reported default branch", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      const skills = yield* marketplace.list()
      expect(skills.map((skill) => skill.name)).toContain("test-skill")
      expect(skills.find((skill) => skill.name === "test-skill")?.source).toBe("gitee")
    }),
  )

  const goneHttp = stubHttpLayer((request) =>
    HttpClientResponse.fromWeb(request, new Response("not found", { status: 404 })),
  )
  const goneIt = testEffect(
    marketplaceLayer(mockConfigLayer({ urls: ["https://gitee.com/acme/skills"] }), { http: goneHttp }),
  )

  goneIt.effect("treats a 404 repo as unreadable instead of failing the list", () =>
    Effect.gen(function* () {
      const marketplace = yield* SkillMarketplace.Service
      expect(yield* marketplace.list()).toEqual([])
    }),
  )
})
