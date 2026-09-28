export type RepoHost = "github" | "gitee"

export interface SkillRepo {
  host: RepoHost
  /** Scheme + host the repo lives on, e.g. "https://gitee.com" or a configured self-hosted instance. */
  baseUrl: string
  url: string
  owner: string
  name: string
  branch: string
}

/** A path segment is safe if it contains no traversal or separator characters. */
export function isSafeSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes("..") && !segment.includes("/") && !segment.includes("\\")
}

/**
 * Parse a GitHub or Gitee repo URL into host/owner/name/branch. Self-hosted
 * Gitee instances are accepted only when their host appears in the configured
 * `giteeHosts` allowlist (ADR 0006). Returns null for other hosts or unsafe URLs.
 */
export function parseRepoUrl(url: string, giteeHosts: string[] = []): SkillRepo | null {
  const match = url.match(/^https:\/\/(?:www\.)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+?))?\/?$/)
  if (!match) return null
  const [, domain, owner, name, branch] = match
  if (!isSafeSegment(owner) || !isSafeSegment(name)) return null
  if (branch && !isSafeSegment(branch)) return null
  const repo = { url, owner, name, branch: branch ?? "main" }
  if (domain === "github.com") return { host: "github", baseUrl: "https://github.com", ...repo }
  if (domain === "gitee.com" || giteeHosts.includes(domain)) {
    return { host: "gitee", baseUrl: `https://${domain}`, ...repo }
  }
  return null
}

export * as Repo from "./repo"
