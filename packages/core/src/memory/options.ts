export * as MemoryOptions from "./options"

import type { ConfigMemoryV1 } from "../v1/config/memory"

export interface MemoryOptions {
  readonly generateMemories: boolean
  readonly useMemories: boolean
  readonly extractModel?: string
  readonly consolidationModel?: string
  readonly minRolloutIdleHours: number
  readonly maxRolloutAgeDays: number
  readonly maxRolloutsPerStartup: number
  readonly maxUnusedDays: number
  readonly maxRawMemoriesForConsolidation: number
}

export const DEFAULTS = {
  minRolloutIdleHours: 6,
  maxRolloutAgeDays: 10,
  maxRolloutsPerStartup: 2,
  maxUnusedDays: 30,
  maxRawMemoriesForConsolidation: 256,
}

const clamp = (value: number | undefined, min: number, max: number, fallback: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export const fromConfig = (raw: ConfigMemoryV1.Info | undefined): MemoryOptions => {
  if (!raw) return { generateMemories: false, useMemories: false, ...DEFAULTS }
  return {
    generateMemories: raw.generate_memories ?? true,
    useMemories: raw.use_memories ?? true,
    ...(raw.extract_model ? { extractModel: raw.extract_model } : {}),
    ...(raw.consolidation_model ? { consolidationModel: raw.consolidation_model } : {}),
    minRolloutIdleHours: clamp(raw.min_rollout_idle_hours, 1, 48, DEFAULTS.minRolloutIdleHours),
    maxRolloutAgeDays: clamp(raw.max_rollout_age_days, 0, 90, DEFAULTS.maxRolloutAgeDays),
    maxRolloutsPerStartup: clamp(raw.max_rollouts_per_startup, 1, 128, DEFAULTS.maxRolloutsPerStartup),
    maxUnusedDays: clamp(raw.max_unused_days, 0, 365, DEFAULTS.maxUnusedDays),
    maxRawMemoriesForConsolidation: clamp(
      raw.max_raw_memories_for_consolidation,
      1,
      4096,
      DEFAULTS.maxRawMemoriesForConsolidation,
    ),
  }
}
