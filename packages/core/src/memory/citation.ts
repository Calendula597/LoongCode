export * as MemoryCitation from "./citation"

export interface ParsedCitation {
  readonly sessionIds: string[]
  readonly raw: string
}

const CITATION_BLOCK_RE = /<memory-citation[^>]*>[\s\S]*?<\/memory-citation>|<memory-citation\s+[^>]*\/>/gi
const SESSION_IDS_ATTR_RE = /session_ids\s*=\s*\[([^\]]*)\]/i

export function parseCitations(text: string): ParsedCitation[] {
  const results: ParsedCitation[] = []
  const re = new RegExp(CITATION_BLOCK_RE.source, "gi")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const raw = m[0]
    const sessionIds: string[] = []
    const seen = new Set<string>()
    const attrMatch = raw.match(SESSION_IDS_ATTR_RE)
    const ids = attrMatch ? attrMatch[1] : ""
    for (const rawId of ids.split(",")) {
      const id = rawId.trim().replace(/^["']|["']$/g, "")
      if (id && !seen.has(id)) {
        seen.add(id)
        sessionIds.push(id)
      }
    }
    if (sessionIds.length > 0) results.push({ sessionIds, raw })
  }
  return results
}

export function extractCitedSessionIds(text: string): string[] {
  const seen = new Set<string>()
  for (const citation of parseCitations(text)) {
    for (const id of citation.sessionIds) seen.add(id)
  }
  return Array.from(seen)
}

/** Removes every citation block, returning the clean text. */
export function stripCitations(text: string): string {
  return text
    .replace(new RegExp(CITATION_BLOCK_RE.source, "gi"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
