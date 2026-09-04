export * as MemoryTable from "./sql"

import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../database/schema.sql"

export const Stage1JobTable = sqliteTable(
  "memory_stage1_jobs",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    status: text().notNull().default("pending"),
    worker_id: text(),
    ownership_token: text(),
    lease_until: integer(),
    retry_remaining: integer().notNull().default(3),
    retry_at: integer(),
    input_watermark: integer().notNull().default(0),
    source_updated_at: integer().notNull().default(0),
    started_at: integer(),
    finished_at: integer(),
    last_error: text(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("memory_stage1_jobs_session_idx").on(table.session_id)],
)

export const Stage1OutputTable = sqliteTable(
  "memory_stage1_outputs",
  {
    id: text().primaryKey(),
    session_id: text().notNull(),
    raw_memory: text({ mode: "json" }),
    rollout_summary: text(),
    source_updated_at: integer().notNull().default(0),
    usage_count: integer().notNull().default(0),
    last_usage: integer(),
    time_created: integer().notNull(),
    time_updated: integer().notNull(),
  },
  (table) => [uniqueIndex("memory_stage1_outputs_session_idx").on(table.session_id)],
)

export const CitationTable = sqliteTable("memory_citations", {
  session_id: text().primaryKey(),
  usage_count: integer().notNull().default(0),
  last_usage: integer(),
  time_created: integer().notNull(),
  time_updated: integer().notNull(),
})

export const Phase2JobTable = sqliteTable(
  "memory_phase2_job",
  {
    job_key: text().primaryKey(),
    status: text().notNull().default("pending"),
    worker_id: text(),
    ownership_token: text(),
    lease_until: integer(),
    retry_at: integer(),
    retry_remaining: integer().notNull().default(3),
    started_at: integer(),
    finished_at: integer(),
    last_error: text(),
    ...Timestamps,
  },
  (table) => [uniqueIndex("memory_phase2_job_key_idx").on(table.job_key)],
)
