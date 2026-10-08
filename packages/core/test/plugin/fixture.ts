import { AgentV2 } from "@loongcode/core/agent"
import { AISDK } from "@loongcode/core/aisdk"
import { Catalog } from "@loongcode/core/catalog"
import { CommandV2 } from "@loongcode/core/command"
import { Credential } from "@loongcode/core/credential"
import { AppNodeBuilder } from "@loongcode/core/effect/app-node-builder"
import { LayerNodePlatform } from "@loongcode/core/effect/app-node-platform"
import { LayerNode } from "@loongcode/core/effect/layer-node"
import { EventV2 } from "@loongcode/core/event"
import { FileSystem } from "@loongcode/core/filesystem"
import { FSUtil } from "@loongcode/core/fs-util"
import { Integration } from "@loongcode/core/integration"
import { Location } from "@loongcode/core/location"
import { Npm } from "@loongcode/core/npm"
import { PluginV2 } from "@loongcode/core/plugin"
import { Reference } from "@loongcode/core/reference"
import { SkillV2 } from "@loongcode/core/skill"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: () => Effect.succeed({ directory: "", entrypoint: undefined }),
    install: () => Effect.void,
    which: () => Effect.succeed(undefined),
  }),
)

export const PluginTestLayer = AppNodeBuilder.build(
  LayerNode.group([
    FileSystem.node,
    FSUtil.node,
    Location.node,
    Npm.node,
    Credential.node,
    EventV2.node,
    LayerNodePlatform.httpClient,
    PluginV2.node,
    AgentV2.node,
    AISDK.node,
    Catalog.node,
    CommandV2.node,
    Integration.node,
    Reference.node,
    SkillV2.node,
  ]),
  [
    [Location.node, tempLocationLayer],
    [Npm.node, npmLayer],
  ],
)
