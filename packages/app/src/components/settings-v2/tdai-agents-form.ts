// Pure form-state helpers for the TDAI identities section. Kept free of
// SolidJS so the duplicate-key guard can be unit-tested directly
// (mirrors dialog-custom-provider-form.ts).
export type HeaderRow = {
  id: string
  key: string
  value: string
}

export type AgentDraft = {
  id: string
  key: string
  name: string
  headers: HeaderRow[]
}

export type AgentErr = "duplicate" | undefined

export type ValidateResult =
  | { ok: true; err: Record<string, AgentErr>; agents: Record<string, ReturnType<typeof buildAgentConfig>> }
  | { ok: false; err: Record<string, AgentErr>; agents: undefined }

const buildAgentConfig = (agent: AgentDraft) => {
  const name = agent.name.trim() || undefined
  const headers = Object.fromEntries(
    agent.headers
      .map((row) => [row.key.trim(), row.value.trim()] as const)
      .filter(([key, value]) => key && value),
  )
  return {
    ...(name ? { name } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
  }
}

// The agents record is keyed by identity key; duplicate keys would silently
// overwrite each other through Object.fromEntries, so validation must flag
// every later duplicate and refuse to produce a record.
export function validateTDAIAgents(agents: AgentDraft[]): ValidateResult {
  const seen = new Set<string>()
  const err: Record<string, AgentErr> = {}
  for (const agent of agents) {
    const key = agent.key.trim()
    if (!key) continue
    if (seen.has(key)) err[agent.id] = "duplicate"
    else seen.add(key)
  }
  if (Object.keys(err).length) return { ok: false, err, agents: undefined }

  return {
    ok: true,
    err,
    agents: Object.fromEntries(
      agents
        .filter((agent) => agent.key.trim())
        .map((agent) => [agent.key.trim(), buildAgentConfig(agent)]),
    ),
  }
}
