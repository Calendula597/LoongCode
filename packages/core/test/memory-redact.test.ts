import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { MemoryRedact } from "@loongcode/core/memory/redact"
import { test } from "bun:test"

describe("MemoryRedact", () => {
  test("redacts API keys and bearer tokens", () => {
    const text = 'auth = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz1234567890abcdef"\nBearer sk-proj-abcdefghijklmnopqrstuvwxyz1234567890'
    const out = MemoryRedact.redact(text)
    expect(out).not.toContain("sk-ant-api03")
    expect(out).not.toContain("sk-proj")
    expect(out).toContain("[REDACTED")
  })

  test("redacts private keys", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----"
    const out = MemoryRedact.redact(`key:\n${key}`)
    expect(out).not.toContain("MIIEowIBAAKCAQEA")
    expect(out).toContain("[REDACTED:private-key]")
  })

  test("redacts secret assignments", () => {
    const out = MemoryRedact.redact('password = "hunter2"\napi_key = "abc123"')
    expect(out).not.toContain("hunter2")
    expect(out).not.toContain("abc123")
    expect(out).toContain("[REDACTED]")
  })

  test("leaves normal text intact", () => {
    const text = "The user prefers bun over npm and runs tests from package directories."
    expect(MemoryRedact.redact(text)).toBe(text)
  })

  test("does not redact lookalike keys like token_count", () => {
    const text = "token_count = 5000\nkeyspaces = 12"
    expect(MemoryRedact.redact(text)).toBe(text)
  })

  test("redacts JWTs and URL basic-auth credentials", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    const out = MemoryRedact.redact(`the token is ${jwt}`)
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
    expect(out).toContain("[REDACTED")

    const url = "https://user:hunter2@example.com/api"
    const urlOut = MemoryRedact.redact(`endpoint = ${url}`)
    expect(urlOut).not.toContain("hunter2")
    expect(urlOut).toContain("[REDACTED:basic-auth]")
  })
})
