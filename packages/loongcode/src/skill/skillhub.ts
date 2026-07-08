import nodePath from "path"
import { LayerNode } from "@loongcode/core/effect/layer-node"
import { httpClient, path } from "@loongcode/core/effect/layer-node-platform"
import { NodePath } from "@effect/platform-node"
import { Effect, Layer, Path, Schema, Context } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { withTransientReadRetry } from "@/util/effect-http-client"
import { FSUtil } from "@loongcode/core/fs-util"
import { Global } from "@loongcode/core/global"

// SkillHub (https://skillhub.lgdg.cc) 默认 skill 源。
// 所有 loongcode 用户（含二进制用户）启动时自动拉取公开 skill，零配置开箱即用。
// 协议不同于内置 discovery（三段式 REST + Bearer token），故单独实现。
//
// 公开 skill 匿名可读；token 兜底 + 用于私有 skill。
const SKILLHUB_BASE = "https://skillhub.lgdg.cc"
const SKILLHUB_TOKEN = "sk_tdoZ8UMqt8Tr85hfq6Q5P_L0MeqE5RrbEMT-MIBGs-g"

const skillConcurrency = 4
const fileConcurrency = 8

// GET /api/web/skills → data.items[].{namespace, slug, headlineVersion.version}
class SkillListItem extends Schema.Class<SkillListItem>("SkillListItem")({
  namespace: Schema.String,
  slug: Schema.String,
  headlineVersion: Schema.Struct({
    version: Schema.String,
  }),
}) {}

class SkillListResponse extends Schema.Class<SkillListResponse>("SkillListResponse")({
  code: Schema.Number,
  data: Schema.Struct({
    items: Schema.Array(SkillListItem),
  }),
}) {}

// GET .../versions/{ver}/files → data[].{filePath}
class SkillFile extends Schema.Class<SkillFile>("SkillFile")({
  filePath: Schema.String,
}) {}

class SkillFilesResponse extends Schema.Class<SkillFilesResponse>("SkillFilesResponse")({
  code: Schema.Number,
  data: Schema.Array(SkillFile),
}) {}

export interface Interface {
  readonly pullAll: () => Effect.Effect<string[], never, never>
}

export class Service extends Context.Service<Service, Interface>()("@loongcode/SkillHub") {}

// 防止 SkillHub 返回的 filePath 含 ../ 逃逸缓存根目录（filePath 是外部输入）
function isSafeRelativePath(filePath: string): boolean {
  if (!filePath) return false
  if (nodePath.isAbsolute(filePath)) return false
  const normalized = nodePath.normalize(filePath)
  return normalized !== ".." && !normalized.startsWith(`..${nodePath.sep}`) && !normalized.includes(`..${nodePath.sep}`)
}

export const layer: Layer.Layer<Service, never, FSUtil.Service | Path.Path | HttpClient.HttpClient> = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const path = yield* Path.Path
    const http = HttpClient.filterStatusOk(withTransientReadRetry(yield* HttpClient.HttpClient))
    const cache = path.join(Global.Path.cache, "skills", "skillhub")

    // 给请求加 Bearer token（公开 skill 匿名也能读，token 是兜底 + 私有 skill 用）
    const authedGet = (url: string) =>
      HttpClientRequest.get(url).pipe(HttpClientRequest.bearerToken(SKILLHUB_TOKEN), HttpClientRequest.acceptJson)

    const downloadFile = Effect.fn("SkillHub.downloadFile")(function* (
      namespace: string,
      slug: string,
      version: string,
      filePath: string,
      root: string,
    ) {
      if (!isSafeRelativePath(filePath)) {
        yield* Effect.logWarning("skillhub file path rejected (unsafe)", { file: filePath, skill: `${namespace}/${slug}` })
        return false
      }
      const dest = path.join(root, filePath)
      if (yield* fs.exists(dest).pipe(Effect.orDie)) return true

      const url = `${SKILLHUB_BASE}/api/web/skills/${namespace}/${slug}/versions/${version}/file?path=${encodeURIComponent(filePath)}`
      return yield* authedGet(url).pipe(
        http.execute,
        Effect.flatMap((res) =>
          res.status >= 200 && res.status < 300
            ? Effect.succeed(res)
            : Effect.fail(new Error(`HTTP ${res.status} for ${filePath}`)),
        ),
        Effect.flatMap((res) => res.text),
        Effect.flatMap((text) => fs.writeWithDirs(dest, new TextEncoder().encode(text))),
        Effect.as(true),
        Effect.catch((err) =>
          Effect.logError("failed to download skillhub file", { url, file: filePath, error: err }).pipe(Effect.as(false)),
        ),
      )
    })

    const pullAll = Effect.fn("SkillHub.pullAll")(function* () {
      yield* Effect.logInfo("fetching skillhub public skills", { base: SKILLHUB_BASE })

      const listUrl = `${SKILLHUB_BASE}/api/web/skills?page=0&size=100`
      const resp = yield* authedGet(listUrl).pipe(
        http.execute,
        Effect.flatMap(HttpClientResponse.schemaBodyJson(SkillListResponse)),
        Effect.catch((err) =>
          Effect.logError("failed to fetch skillhub skill list", { url: listUrl, error: err }).pipe(Effect.as(null)),
        ),
      )

      if (!resp) return []
      const items = resp.data.items.filter((s) => s.namespace && s.slug && s.headlineVersion?.version)
      yield* Effect.logInfo("skillhub skills found", { count: items.length })

      const dirs = yield* Effect.forEach(
        items,
        (item) =>
          Effect.gen(function* () {
            const { namespace, slug, headlineVersion } = item
            const version = headlineVersion.version
            const root = path.join(cache, `${namespace}-${slug}`)

            // 1. 文件清单
            const filesUrl = `${SKILLHUB_BASE}/api/web/skills/${namespace}/${slug}/versions/${version}/files`
            const filesResp = yield* authedGet(filesUrl).pipe(
              http.execute,
              Effect.flatMap(HttpClientResponse.schemaBodyJson(SkillFilesResponse)),
              Effect.catch((err) =>
                Effect.logError("failed to fetch skillhub file list", { url: filesUrl, skill: `${namespace}/${slug}`, error: err }).pipe(
                  Effect.as(null),
                ),
              ),
            )
            if (!filesResp) return null

            const filePaths = filesResp.data.map((f) => f.filePath)
            if (!filePaths.includes("SKILL.md")) {
              yield* Effect.logWarning("skillhub skill missing SKILL.md", { skill: `${namespace}/${slug}` })
              return null
            }

            // 2. 逐文件下载（纯文本响应）
            yield* Effect.forEach(
              filePaths,
              (filePath) => downloadFile(namespace, slug, version, filePath, root),
              { concurrency: fileConcurrency },
            )

            const md = path.join(root, "SKILL.md")
            return (yield* fs.exists(md).pipe(Effect.orDie)) ? root : null
          }),
        { concurrency: skillConcurrency },
      )

      return dirs.filter((dir): dir is string => dir !== null)
    })

    return Service.of({ pullAll })
  }),
)

export const defaultLayer: Layer.Layer<Service> = layer.pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(NodePath.layer),
)

export const node = LayerNode.make(layer, [FSUtil.node, path, httpClient])

export * as SkillHub from "./skillhub"
