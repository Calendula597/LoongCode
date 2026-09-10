import { describe, expect, test } from "bun:test"
import { validateTDAIAgents, type AgentDraft } from "./tdai-agents-form"

const agent = (id: string, key: string, name = ""): AgentDraft => ({
  id,
  key,
  name,
  headers: [
    { id: `${id}-h0`, key: "x-team-id", value: `team-${key}` },
    { id: `${id}-h1`, key: "x-agent-id", value: "" },
    { id: `${id}-h2`, key: "x-task-id", value: "" },
    { id: `${id}-h3`, key: "x-conversation-id", value: "" },
  ],
})

describe("validateTDAIAgents", () => {
  test("flags duplicate keys and blocks the record", () => {
    const result = validateTDAIAgents([agent("a", "team-a"), agent("b", "team-a"), agent("c", "team-c")])

    expect(result.ok).toBe(false)
    // the first occurrence is fine; only the later duplicates are flagged
    expect(result.err).toEqual({ a: undefined, b: "duplicate", c: undefined })
    expect(result.agents).toBeUndefined()
  })

  test("trims keys before comparing", () => {
    const result = validateTDAIAgents([agent("a", "team-a"), agent("b", " team-a ")])

    expect(result.ok).toBe(false)
    expect(result.err.b).toBe("duplicate")
  })

  test("builds the trimmed agents record when keys are unique", () => {
    const result = validateTDAIAgents([agent("a", "team-a", "Team A"), agent("b", "team-b")])

    expect(result.ok).toBe(true)
    expect(result.agents).toEqual({
      "team-a": { name: "Team A", headers: { "x-team-id": "team-team-a" } },
      "team-b": { headers: { "x-team-id": "team-team-b" } },
    })
  })
})
