interface ImportMetaEnv {
  readonly LOONGCODE_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:loongcode-server" {
  export namespace Server {
    export const listen: typeof import("../../../loongcode/dist/types/src/node").Server.listen
    export type Listener = import("../../../loongcode/dist/types/src/node").Server.Listener
  }
  export namespace Config {
    export const get: typeof import("../../../loongcode/dist/types/src/node").Config.get
    export type Info = import("../../../loongcode/dist/types/src/node").Config.Info
  }
  export const bootstrap: typeof import("../../../loongcode/dist/types/src/node").bootstrap
}

declare module "virtual:loongcode-builtin-env" {
  export const BUILT_IN_PLUGIN_ENV: Record<string, string>
  export function applyBuiltInPluginEnv(): void
}
