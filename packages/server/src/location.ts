import { Location } from "@loongcode/core/location"
import { LocationServiceMap } from "@loongcode/core/location-services"
import { AbsolutePath } from "@loongcode/core/schema"
import { WorkspaceV2 } from "@loongcode/core/workspace"
import { Effect, Layer } from "effect"
import { HttpServerRequest } from "effect/unstable/http"
import { HttpApiMiddleware } from "effect/unstable/httpapi"

export type LocationServices = Layer.Success<ReturnType<(typeof LocationServiceMap.Service)["get"]>>

export class LocationMiddleware extends HttpApiMiddleware.Service<LocationMiddleware, { provides: LocationServices }>()(
  "@opencode/HttpApiLocation",
) {}

export function response<A, E, R>(data: Effect.Effect<A, E, R>) {
  return Effect.gen(function* () {
    const location = yield* Location.Service
    return {
      location: new Location.Info({
        directory: location.directory,
        workspaceID: location.workspaceID,
        project: location.project,
      }),
      data: yield* data,
    }
  })
}

function ref(request: HttpServerRequest.HttpServerRequest): Location.Ref {
  const query = new URL(request.url, "http://localhost").searchParams
  // accept both header spellings: fork SDKs send x-loongcode-*, upstream SDKs send x-opencode-*
  const workspaceID =
    query.get("location[workspace]") ||
    request.headers["x-loongcode-workspace"] ||
    request.headers["x-opencode-workspace"]
  const directory =
    query.get("location[directory]") ||
    (header(request, "x-loongcode-directory") ?? header(request, "x-opencode-directory") ?? process.cwd())
  return Location.Ref.make({
    directory: AbsolutePath.make(directory),
    workspaceID: workspaceID ? WorkspaceV2.ID.make(workspaceID) : undefined,
  })
}

function header(request: HttpServerRequest.HttpServerRequest, name: string) {
  const value = request.headers[name]
  return value ? decode(value) : undefined
}

function decode(input: string) {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

export const layer = Layer.effect(
  LocationMiddleware,
  Effect.gen(function* () {
    const locations = yield* LocationServiceMap.Service
    return LocationMiddleware.of((effect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        return yield* effect.pipe(Effect.provide(locations.get(ref(request))))
      }),
    )
  }),
)
