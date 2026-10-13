export * as MemoryRedact from "./redact"

const REDACTIONS: { re: RegExp; replacement: string }[] = [
  { re: /\bBearer[ \t]+[A-Za-z0-9._~+/-]{16,}=*/gi, replacement: "Bearer [REDACTED]" },
  { re: /sk-ant-[A-Za-z0-9_-]{20,}/g, replacement: "[REDACTED:anthropic-key]" },
  { re: /sk-[A-Za-z0-9]{20,}/g, replacement: "[REDACTED:openai-key]" },
  { re: /AKIA[0-9A-Z]{16}/g, replacement: "[REDACTED:aws-key]" },
  { re: /gh[pousr]_[A-Za-z0-9]{36,}/g, replacement: "[REDACTED:github-token]" },
  { re: /xox[baprs]-[A-Za-z0-9-]{10,}/g, replacement: "[REDACTED:slack-token]" },
  { re: /AIza[0-9A-Za-z_-]{35}/g, replacement: "[REDACTED:google-key]" },
  // JWTs: three base64url segments with the characteristic header signature.
  {
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replacement: "[REDACTED:jwt]",
  },
  // Basic-auth credentials embedded in URLs (scheme://user:pass@host).
  { re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/gi, replacement: "[REDACTED:basic-auth]@" },
  {
    re: /-----BEGIN [A-Z]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z]+ PRIVATE KEY-----/g,
    replacement: "[REDACTED:private-key]",
  },
]

// Word boundaries keep lookalike keys (token_count, keyspaces) out of the
// assignment redaction — only exact secret key names trigger it.
const SECRET_ASSIGNMENT_START =
  /\b(["']?)(password|passwd|pwd|secret|api[_-]?key|apikey|token|access[_-]?token|auth[_-]?token|refresh[_-]?token|aws_secret_access_key|aws_access_key_id|private[_-]?key)\1([ \t]*[:=][ \t]*)/gi

function redactAssignments(text: string): string {
  const out: string[] = []
  let cursor = 0
  SECRET_ASSIGNMENT_START.lastIndex = 0
  for (let match = SECRET_ASSIGNMENT_START.exec(text); match; match = SECRET_ASSIGNMENT_START.exec(text)) {
    const valueStart = SECRET_ASSIGNMENT_START.lastIndex
    const valueEnd = scanValue(text, valueStart, match[1])
    if (valueEnd === undefined) continue
    out.push(text.slice(cursor, valueStart))
    out.push("[REDACTED]")
    cursor = valueEnd
    SECRET_ASSIGNMENT_START.lastIndex = valueEnd
  }
  return out.join("") + text.slice(cursor)
}

function scanValue(text: string, start: number, quote: string): number | undefined {
  const end = text.indexOf("\n", start)
  const line = end === -1 ? text.slice(start) : text.slice(start, end)
  const trimmed = line.trim()
  if (trimmed.length === 0) return undefined
  if (quote && trimmed.startsWith(quote) && trimmed.endsWith(quote)) return end === -1 ? text.length : end
  return end === -1 ? text.length : end
}

export function redact(text: string): string {
  let out = text
  for (const { re, replacement } of REDACTIONS) {
    out = out.replace(re, replacement)
  }
  return redactAssignments(out)
}
