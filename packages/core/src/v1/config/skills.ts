export * as ConfigSkillsV1 from "./skills"

import { Schema } from "effect"

export const GiteeHost = Schema.Struct({
  host: Schema.String.annotate({
    description: "Self-hosted Gitee hostname allowed as a skill repo source (e.g., gitee.internal.example)",
  }),
  token: Schema.optional(Schema.String).annotate({
    description: "Private token sent as access_token on Gitee API and tarball requests to this host",
  }),
})
export type GiteeHost = Schema.Schema.Type<typeof GiteeHost>

export const Info = Schema.Struct({
  paths: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Additional paths to skill folders",
  }),
  urls: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)",
  }),
  giteeHosts: Schema.optional(Schema.Array(GiteeHost)).annotate({
    description: "Self-hosted Gitee instances allowed as skill repo sources (ADR 0006)",
  }),
})
export type Info = Schema.Schema.Type<typeof Info>
