import { describe, expect, test } from "bun:test"
import { nextIdentityKey } from "./tdai-identity-key"

describe("nextIdentityKey", () => {
  test("generates identity-1 for an empty identity list", () => {
    expect(nextIdentityKey([])).toBe("identity-1")
  })

  test("increments past occupied keys", () => {
    expect(nextIdentityKey(["identity-1", "identity-2"])).toBe("identity-3")
  })

  test("fills gaps and ignores unrelated hand-written keys", () => {
    expect(nextIdentityKey(["identity-1", "identity-3", "team-a"])).toBe("identity-2")
  })

  test("never collides with a fully packed prefix range", () => {
    expect(nextIdentityKey(["identity-1", "identity-2", "identity-3"])).toBe("identity-4")
  })
})
