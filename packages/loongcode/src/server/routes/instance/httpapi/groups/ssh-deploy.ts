import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { described } from "./metadata"

const root = "/ssh-deploy"

export const SSHDeploySession = Schema.Struct({
  sessionId: Schema.String,
})

// Register SSH deploy endpoints as a separate HttpApi
export const SshDeployApi = HttpApi.make("ssh-deploy").add(
  HttpApiGroup.make("ssh-deploy")
    .add(
      HttpApiEndpoint.post("connect", `${root}/connect`, {
        payload: Schema.Struct({
          host: Schema.String,
          port: Schema.optional(Schema.Number),
          username: Schema.String,
          password: Schema.optional(Schema.String),
          privateKey: Schema.optional(Schema.String),
        }),
        success: described(SSHDeploySession, "SSH session created"),
        error: HttpApiError.BadRequest,
      }),
      HttpApiEndpoint.post("install", `${root}/install`, {
        payload: Schema.Struct({
          sessionId: Schema.String,
        }),
        success: described(Schema.Boolean, "Installation started"),
        error: HttpApiError.BadRequest,
      }),
      HttpApiEndpoint.post("start", `${root}/start`, {
        payload: Schema.Struct({
          sessionId: Schema.String,
        }),
        success: described(Schema.Boolean, "Service started"),
        error: HttpApiError.BadRequest,
      }),
      HttpApiEndpoint.post("disconnect", `${root}/disconnect`, {
        payload: Schema.Struct({
          sessionId: Schema.String,
        }),
        success: described(Schema.Boolean, "Disconnected"),
        error: HttpApiError.BadRequest,
      }),
      // SSE logs endpoint - returns text/event-stream
      HttpApiEndpoint.get("logs", `${root}/logs`, {
        query: Schema.Struct({
          sessionId: Schema.String,
        }),
        success: Schema.String.pipe(HttpApiSchema.asText({ contentType: "text/event-stream" })),
      }),
    )
    .middleware(Authorization)
    .annotateMerge(OpenApi.annotations({ title: "ssh-deploy", description: "SSH deployment routes." })),
)