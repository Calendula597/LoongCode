import { gunzipSync } from "node:zlib"
import { Effect, Schema } from "effect"

export interface TarEntry {
  name: string
  content: string
}

export interface SkillMetadata {
  name: string
  description?: string
  path: string
}

export interface SkillFile {
  /** Path relative to the skill directory, e.g. "SKILL.md" or "lib/helper.ts" */
  relativePath: string
  content: string
}

/** Zip bomb protection: reject tarballs whose declared file contents exceed this many bytes in total. */
export const MAX_EXTRACTED_BYTES = 100 * 1024 * 1024

/** Download protection: reject tarballs whose compressed payload exceeds this many bytes. */
export const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024

export class TarballSizeError extends Schema.TaggedErrorClass<TarballSizeError>()("SkillMarketplace.TarballSizeError", {
  limit: Schema.Number,
}) {
  override get message() {
    return `Tarball exceeds the extraction size limit of ${this.limit} bytes`
  }
}

/** Parse YAML frontmatter from SKILL.md content. */
export function parseFrontmatter(text: string): { name?: string; description?: string } {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const yaml = match[1]
  const nameMatch = yaml.match(/^name:\s*(.+)$/m)
  const descriptionMatch = yaml.match(/^description:\s*(.+)$/m)
  return {
    name: nameMatch?.[1]?.trim().replaceAll(/^["']|["']$/g, ""),
    description: descriptionMatch?.[1]?.trim().replaceAll(/^["']|["']$/g, ""),
  }
}

/** Read a null-terminated string from a Uint8Array at given offset. */
function readString(buf: Uint8Array, offset: number, maxLen: number): string {
  const bytes = buf.subarray(offset, offset + maxLen)
  const end = bytes.indexOf(0)
  return new TextDecoder().decode(end >= 0 ? bytes.subarray(0, end) : bytes)
}

/** Parse tar buffer and return regular file entries. Throws TarballSizeError on oversized archives. */
function parseTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let offset = 0
  let total = 0
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break

    const name = readString(header, 0, 100)
    const sizeStr = readString(header, 124, 12).trim()
    const size = parseInt(sizeStr || "0", 8) || 0
    const typeFlag = header[156]

    offset += 512

    if ((typeFlag === 0x30 || typeFlag === 0x00) && size > 0) {
      total += size
      if (total > MAX_EXTRACTED_BYTES) throw new TarballSizeError({ limit: MAX_EXTRACTED_BYTES })
      const contentBytes = buf.subarray(offset, offset + size)
      entries.push({ name, content: new TextDecoder().decode(contentBytes) })
    }

    offset += Math.ceil(size / 512) * 512
  }
  return entries
}

/** Check if a relative path is safe (no traversal attempts). */
export function isSafePath(relativePath: string): boolean {
  return relativePath.length > 0 && !relativePath.includes("..") && !relativePath.startsWith("/") && !relativePath.includes("\\")
}

/** Gunzip and parse a tarball. Throws TarballSizeError on oversized archives. */
function parseEntries(gzipBuffer: Uint8Array): TarEntry[] {
  // node:zlib works under both the Bun CLI runtime and the desktop's Node server.
  return parseTar(gunzipSync(gzipBuffer))
}

// Lift a sync parser that declares its size limit via thrown TarballSizeError into
// an Effect typed failure, re-dying any other defect (e.g. corrupt input).
function liftTarballParse(parse: () => TarEntry[]): Effect.Effect<TarEntry[], TarballSizeError> {
  return Effect.sync(parse).pipe(
    Effect.catchDefect((defect: unknown) => {
      if (defect instanceof TarballSizeError) return Effect.fail(defect)
      return Effect.die(defect)
    }),
  )
}

/** Gunzip and parse a tarball into entries, as a typed Effect. Callers that both scan
 * and extract from the same archive should cache these entries to avoid double gunzip. */
export const readEntries = (gzipBuffer: Uint8Array): Effect.Effect<TarEntry[], TarballSizeError> =>
  liftTarballParse(() => parseEntries(gzipBuffer))

/** Scan parsed entries for SKILL.md files and extract metadata. */
export const scanEntriesForSkills = (entries: ReadonlyArray<TarEntry>): SkillMetadata[] =>
  entries
    .filter((e) => e.name.endsWith("/SKILL.md") || e.name === "SKILL.md")
    .map((e) => {
      const dir = e.name.includes("/") ? e.name.slice(0, e.name.lastIndexOf("/")) : ""
      const frontmatter = parseFrontmatter(e.content)
      const dirName = dir.includes("/") ? dir.slice(dir.lastIndexOf("/") + 1) : dir
      return {
        name: frontmatter.name ?? dirName,
        description: frontmatter.description,
        path: dir,
      }
    })

/** Extract all files under a specific skill directory from parsed entries. */
export const extractEntriesFiles = (entries: ReadonlyArray<TarEntry>, skillPath: string): SkillFile[] => {
  const prefix = skillPath.endsWith("/") ? skillPath : `${skillPath}/`
  return entries
    .filter((e) => e.name.startsWith(prefix))
    .map((e) => {
      const relativePath = e.name.slice(prefix.length)
      if (!isSafePath(relativePath)) return null
      return { relativePath, content: e.content }
    })
    .filter((e): e is SkillFile => e !== null)
}

/** Scan a gzipped tarball for SKILL.md files and extract metadata. */
export const scanTarballForSkills = (gzipBuffer: Uint8Array): Effect.Effect<SkillMetadata[], TarballSizeError> =>
  readEntries(gzipBuffer).pipe(Effect.map(scanEntriesForSkills))

/** Extract all files from a specific skill directory in a gzipped tarball. */
export const extractSkillFiles = (
  gzipBuffer: Uint8Array,
  skillPath: string,
): Effect.Effect<SkillFile[], TarballSizeError> =>
  readEntries(gzipBuffer).pipe(Effect.map((entries) => extractEntriesFiles(entries, skillPath)))

export * as Tarball from "./tarball"
