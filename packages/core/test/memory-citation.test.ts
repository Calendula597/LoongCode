import { describe, expect, test } from "bun:test"
import { MemoryCitation } from "@loongcode/core/memory/citation"

describe("MemoryCitation", () => {
  test("parses session ids from a citation block", () => {
    const text = 'The user prefers bun. <memory-citation session_ids=["ses_abc", "ses_def"]></memory-citation>'
    expect(MemoryCitation.extractCitedSessionIds(text)).toEqual(["ses_abc", "ses_def"])
  })

  test("strips citation blocks from text", () => {
    const text =
      'I used the memory. <memory-citation session_ids=["ses_abc"]></memory-citation>\n\nMore text.'
    expect(MemoryCitation.stripCitations(text)).toBe("I used the memory.\n\nMore text.")
  })

  test("handles multiple citation blocks", () => {
    const text =
      '<memory-citation session_ids=["ses_1"]></memory-citation> a <memory-citation session_ids=["ses_2"]></memory-citation>'
    expect(MemoryCitation.extractCitedSessionIds(text)).toEqual(["ses_1", "ses_2"])
  })

  test("deduplicates session ids", () => {
    const text = '<memory-citation session_ids=["ses_1", "ses_1"]></memory-citation>'
    expect(MemoryCitation.extractCitedSessionIds(text)).toEqual(["ses_1"])
  })

  test("returns empty for text without citations", () => {
    expect(MemoryCitation.extractCitedSessionIds("plain text")).toEqual([])
    expect(MemoryCitation.stripCitations("plain text")).toBe("plain text")
  })
})
