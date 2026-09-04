export * as MemoryPaths from "./paths"

import { join } from "path"
import { Global } from "../global"

export interface WorkspacePaths {
  readonly dir: () => string
  readonly memory: () => string
  readonly summary: () => string
  readonly rawMemories: () => string
  readonly rolloutSummaries: () => string
  readonly skills: () => string
  readonly extensions: () => string
  readonly adHocNotes: () => string
  readonly git: () => string
}

/** The user-level data directory where memory lives (global, never per-project). */
export function root(): string {
  return join(Global.Path.data, "memory")
}

export function fromRoot(rootDir: string): { readonly root: () => string; readonly workspace: WorkspacePaths } {
  return {
    root: () => rootDir,
    workspace: {
      dir: () => join(rootDir, "memories"),
      memory: () => join(rootDir, "memories", "MEMORY.md"),
      summary: () => join(rootDir, "memories", "memory_summary.md"),
      rawMemories: () => join(rootDir, "memories", "raw_memories.md"),
      rolloutSummaries: () => join(rootDir, "memories", "rollout_summaries"),
      skills: () => join(rootDir, "memories", "skills"),
      extensions: () => join(rootDir, "memories", "extensions"),
      adHocNotes: () => join(rootDir, "memories", "extensions", "ad_hoc", "notes"),
      git: () => join(rootDir, "memories", ".git"),
    },
  }
}

export const workspace: WorkspacePaths = fromRoot(root()).workspace
