import { SECRET } from "./secret"
import { shortDomain } from "./stage"

const storage = new sst.cloudflare.Bucket("EnterpriseStorage")

new sst.cloudflare.x.SolidStart("Teams", {
  domain: shortDomain,
  path: "packages/enterprise",
  buildCommand: "bun run build:cloudflare",
  link: [SECRET.SupportApiKey],
  environment: {
    LOONGCODE_STORAGE_ADAPTER: "r2",
    LOONGCODE_STORAGE_ACCOUNT_ID: sst.cloudflare.DEFAULT_ACCOUNT_ID,
    LOONGCODE_STORAGE_ACCESS_KEY_ID: SECRET.R2AccessKey.value,
    LOONGCODE_STORAGE_SECRET_ACCESS_KEY: SECRET.R2SecretKey.value,
    LOONGCODE_STORAGE_BUCKET: storage.name,
  },
})
