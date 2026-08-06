#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const PLUGIN = "opencode-mem"
const FILE = join(import.meta.dirname, "..", "packages/loongcode/src/config/builtin/memory.ts")

async function latestVersion(): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${PLUGIN}/latest`)
  if (!res.ok) throw new Error(`Failed to fetch latest version: ${res.status} ${res.statusText}`)
  const json = await res.json()
  return json.version
}

async function main() {
  const latest = await latestVersion()
  const current = readFileSync(FILE, "utf-8")
  const match = current.match(/SPECIFIER\s*=\s*"opencode-mem@([^"]+)"/)
  if (!match) throw new Error("Could not find SPECIFIER in config/builtin/memory.ts")
  const currentVersion = match[1]

  if (currentVersion === latest) {
    console.log(`Already at latest version: ${latest}`)
    process.exit(0)
  }

  const updated = current.replace(/SPECIFIER\s*=\s*"opencode-mem@[^"]+"/, `SPECIFIER = "opencode-mem@${latest}"`)
  writeFileSync(FILE, updated)
  console.log(`Bumped opencode-mem from ${currentVersion} to ${latest}`)
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile) {
    const { appendFileSync } = await import("fs")
    appendFileSync(outputFile, `version=${latest}\n`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
