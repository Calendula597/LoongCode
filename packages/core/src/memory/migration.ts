export * as MemoryMigration from "./migration"

import { Effect } from "effect"
import type { DatabaseMigration } from "../database/migration"

const up: DatabaseMigration.Migration["up"] = (tx) =>
  Effect.gen(function* () {
    yield* tx.run(`
      CREATE TABLE IF NOT EXISTS \`memory_stage1_jobs\` (
        \`id\` text PRIMARY KEY,
        \`session_id\` text NOT NULL,
        \`status\` text NOT NULL DEFAULT 'pending',
        \`worker_id\` text,
        \`ownership_token\` text,
        \`lease_until\` integer,
        \`retry_remaining\` integer NOT NULL DEFAULT 3,
        \`retry_at\` integer,
        \`input_watermark\` integer NOT NULL DEFAULT 0,
        \`source_updated_at\` integer NOT NULL DEFAULT 0,
        \`started_at\` integer,
        \`finished_at\` integer,
        \`last_error\` text,
        \`time_created\` integer NOT NULL,
        \`time_updated\` integer NOT NULL
      );
    `)
    yield* tx.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS \`memory_stage1_jobs_session_idx\` ON \`memory_stage1_jobs\` (\`session_id\`);`,
    )
    yield* tx.run(`
      CREATE TABLE IF NOT EXISTS \`memory_stage1_outputs\` (
        \`id\` text PRIMARY KEY,
        \`session_id\` text NOT NULL,
        \`raw_memory\` text,
        \`rollout_summary\` text,
        \`source_updated_at\` integer NOT NULL DEFAULT 0,
        \`usage_count\` integer NOT NULL DEFAULT 0,
        \`last_usage\` integer,
        \`time_created\` integer NOT NULL,
        \`time_updated\` integer NOT NULL
      );
    `)
    yield* tx.run(
      `CREATE UNIQUE INDEX IF NOT EXISTS \`memory_stage1_outputs_session_idx\` ON \`memory_stage1_outputs\` (\`session_id\`);`,
    )
    yield* tx.run(`
      CREATE TABLE IF NOT EXISTS \`memory_citations\` (
        \`session_id\` text PRIMARY KEY,
        \`usage_count\` integer NOT NULL DEFAULT 0,
        \`last_usage\` integer,
        \`time_created\` integer NOT NULL,
        \`time_updated\` integer NOT NULL
      );
    `)
    yield* tx.run(`
      CREATE TABLE IF NOT EXISTS \`memory_phase2_job\` (
        \`job_key\` text PRIMARY KEY,
        \`status\` text NOT NULL DEFAULT 'pending',
        \`worker_id\` text,
        \`ownership_token\` text,
        \`lease_until\` integer,
        \`retry_at\` integer,
        \`retry_remaining\` integer NOT NULL DEFAULT 3,
        \`started_at\` integer,
        \`finished_at\` integer,
        \`last_error\` text,
        \`time_created\` integer NOT NULL,
        \`time_updated\` integer NOT NULL
      );
    `)
    yield* tx.run(`CREATE UNIQUE INDEX IF NOT EXISTS \`memory_phase2_job_key_idx\` ON \`memory_phase2_job\` (\`job_key\`);`)
  })

export const migrations: DatabaseMigration.Migration[] = [
  {
    id: "20260903000000_memory",
    up,
  },
]
