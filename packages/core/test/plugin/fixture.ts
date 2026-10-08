import { Credential } from "@loongcode/core/credential"
import { EventV2 } from "@loongcode/core/event"
import { FileSystem } from "@loongcode/core/filesystem"
import { FSUtil } from "@loongcode/core/fs-util"
import { Global } from "@loongcode/core/global"
import { Npm } from "@loongcode/core/npm"
import { PluginV2 } from "@loongcode/core/plugin"
import { RepositoryCache } from "@loongcode/core/repository-cache"
import { Ripgrep } from "@loongcode/core/ripgrep"
import { SkillDiscovery } from "@loongcode/core/skill/discovery"
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { tempLocationLayer } from "../fixture/location"

export const PluginTestLayer = Layer.mergeAll(FileSystem.locationLayer, PluginV2.locationLayer).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      Credential.defaultLayer,
      EventV2.defaultLayer,
      FetchHttpClient.layer,
      FSUtil.defaultLayer,
      Global.defaultLayer,
      Layer.succeed(
        Npm.Service,
        Npm.Service.of({
          add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
          install: () => Effect.void,
          which: () => Effect.succeed(undefined),
        }),
      ),
      RepositoryCache.defaultLayer,
      SkillDiscovery.defaultLayer,
      Ripgrep.defaultLayer,
      tempLocationLayer,
    ),
  ),
)
