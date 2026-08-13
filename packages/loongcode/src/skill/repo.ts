export type RepoHost = "github" | "gitee"

export interface SkillRepo {
  host: RepoHost
  url: string
  owner: string
  name: string
  branch: string
}

/** A path segment is safe if it contains no traversal or separator characters. */
export function isSafeSegment(segment: string): boolean {
  return segment.length > 0 && !segment.includes("..") && !segment.includes("/") && !segment.includes("\\")
}

/** Parse a GitHub or Gitee repo URL into host/owner/name/branch. Returns null for other hosts or unsafe URLs. */
export function parseRepoUrl(url: string): SkillRepo | null {
  const match = url.match(/^https:\/\/(?:www\.)?(github\.com|gitee\.com)\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+?))?\/?$/)
  if (!match) return null
  const [, domain, owner, name, branch] = match
  if (!isSafeSegment(owner) || !isSafeSegment(name)) return null
  if (branch && !isSafeSegment(branch)) return null
  const host: RepoHost = domain === "gitee.com" ? "gitee" : "github"
  return { host, url, owner, name, branch: branch ?? "main" }
}

export * as Repo from "./repo"
