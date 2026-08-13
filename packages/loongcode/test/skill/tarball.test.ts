import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { scanTarballForSkills, extractSkillFiles, parseFrontmatter } from "../../src/skill/tarball"
import { testEffect } from "../lib/effect"

const effectIt = testEffect(Layer.empty)

// Helper: create a tar entry header (512 bytes)
function tarHeader(name: string, size: number): Uint8Array {
  const header = new Uint8Array(512)
  // Name (offset 0, 100 bytes)
  const nameBytes = new TextEncoder().encode(name)
  header.set(nameBytes, 0)
  // Mode (offset 100, 8 bytes) — "0000644\0"
  header.set(new TextEncoder().encode("0000644\0"), 100)
  // UID (offset 108, 8 bytes)
  header.set(new TextEncoder().encode("0000000\0"), 108)
  // GID (offset 116, 8 bytes)
  header.set(new TextEncoder().encode("0000000\0"), 116)
  // Size (offset 124, 12 bytes, octal)
  header.set(new TextEncoder().encode(size.toString(8).padStart(11, "0") + "\0"), 124)
  // Mtime (offset 136, 12 bytes)
  header.set(new TextEncoder().encode("00000000000\0"), 136)
  // Checksum placeholder (offset 148, 8 bytes) — spaces
  header.set(new TextEncoder().encode("        "), 148)
  // Type flag (offset 156, 1 byte) — '0' for regular file
  header[156] = 0x30 // '0'
  // USTAR magic (offset 257, 6 bytes)
  header.set(new TextEncoder().encode("ustar\0"), 257)
  // Version (offset 263, 2 bytes)
  header.set(new TextEncoder().encode("00"), 263)

  // Calculate and set checksum
  let checksum = 0
  for (let i = 0; i < 512; i++) checksum += header[i]
  // Write checksum as octal (offset 148, 6 digits + null + space)
  const checksumStr = checksum.toString(8).padStart(6, "0")
  header.set(new TextEncoder().encode(checksumStr + "\0 "), 148)

  return header
}

// Helper: create a gzipped tarball from files
function createTarball(files: { name: string; content: string }[]): Uint8Array {
  const chunks: Uint8Array[] = []
  for (const file of files) {
    const contentBytes = new TextEncoder().encode(file.content)
    chunks.push(tarHeader(file.name, contentBytes.length))
    chunks.push(contentBytes)
    // Pad to 512-byte boundary
    const padding = (512 - (contentBytes.length % 512)) % 512
    if (padding > 0) chunks.push(new Uint8Array(padding))
  }
  // End-of-archive: two zero blocks
  chunks.push(new Uint8Array(512))
  chunks.push(new Uint8Array(512))

  // Concatenate
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
  const tarBuffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    tarBuffer.set(chunk, offset)
    offset += chunk.length
  }

  // Gzip
  return Bun.gzipSync(tarBuffer)
}

describe("scanTarballForSkills", () => {
  effectIt.effect("finds SKILL.md files and returns their content", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/my-skill/SKILL.md",
          content: "---\nname: my-skill\ndescription: A test skill\n---\n# My Skill\n",
        },
        {
          name: "repo-main/other-file.txt",
          content: "not a skill",
        },
      ])

      const results = yield* scanTarballForSkills(tarball)
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe("my-skill")
      expect(results[0].description).toBe("A test skill")
      expect(results[0].path).toBe("repo-main/my-skill")
    }),
  )

  effectIt.effect("finds multiple SKILL.md files in different directories", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/skill-a/SKILL.md",
          content: "---\nname: skill-a\ndescription: First skill\n---\n",
        },
        {
          name: "repo-main/skill-b/SKILL.md",
          content: "---\nname: skill-b\ndescription: Second skill\n---\n",
        },
      ])

      const results = yield* scanTarballForSkills(tarball)
      expect(results).toHaveLength(2)
      expect(results[0].name).toBe("skill-a")
      expect(results[1].name).toBe("skill-b")
    }),
  )

  effectIt.effect("handles SKILL.md without frontmatter", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/no-meta/SKILL.md",
          content: "# Skill without frontmatter\nJust text\n",
        },
      ])

      const results = yield* scanTarballForSkills(tarball)
      expect(results).toHaveLength(1)
      // Should use directory name as fallback
      expect(results[0].name).toBe("no-meta")
      expect(results[0].description).toBeUndefined()
    }),
  )

  effectIt.effect("returns empty array for tarball without SKILL.md", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/README.md",
          content: "# README\n",
        },
      ])

      const results = yield* scanTarballForSkills(tarball)
      expect(results).toEqual([])
    }),
  )
})

describe("extractSkillFiles", () => {
  effectIt.effect("extracts all files from a skill directory", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/my-skill/SKILL.md",
          content: "---\nname: my-skill\n---\n# My Skill\n",
        },
        {
          name: "repo-main/my-skill/lib/helper.ts",
          content: "export const x = 1\n",
        },
        {
          name: "repo-main/other-skill/SKILL.md",
          content: "---\nname: other-skill\n---\n",
        },
      ])

      const files = yield* extractSkillFiles(tarball, "repo-main/my-skill")
      expect(files).toHaveLength(2)
      expect(files.find((f) => f.relativePath === "SKILL.md")).toBeDefined()
      expect(files.find((f) => f.relativePath === "lib/helper.ts")).toBeDefined()
      expect(files.find((f) => f.relativePath === "lib/helper.ts")?.content).toBe("export const x = 1\n")
    }),
  )

  effectIt.effect("returns empty array for non-existent skill directory", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/my-skill/SKILL.md",
          content: "# My Skill\n",
        },
      ])

      const files = yield* extractSkillFiles(tarball, "repo-main/nonexistent")
      expect(files).toEqual([])
    }),
  )

  effectIt.effect("filters out path traversal entries (../)", () =>
    Effect.gen(function* () {
      const tarball = createTarball([
        {
          name: "repo-main/my-skill/SKILL.md",
          content: "# My Skill\n",
        },
        {
          name: "repo-main/my-skill/../escape.txt",
          content: "should be filtered",
        },
      ])

      const files = yield* extractSkillFiles(tarball, "repo-main/my-skill")
      expect(files).toHaveLength(1)
      expect(files[0].relativePath).toBe("SKILL.md")
    }),
  )
})

describe("parseFrontmatter", () => {
  it("extracts name and description from YAML frontmatter", () => {
    const result = parseFrontmatter("---\nname: test-skill\ndescription: A test\n---\n# Content")
    expect(result.name).toBe("test-skill")
    expect(result.description).toBe("A test")
  })

  it("returns empty object for content without frontmatter", () => {
    const result = parseFrontmatter("# Just content\nNo frontmatter")
    expect(result).toEqual({})
  })

  it("handles quoted values", () => {
    const result = parseFrontmatter('---\nname: "quoted-name"\ndescription: \'quoted desc\'\n---\n')
    expect(result.name).toBe("quoted-name")
    expect(result.description).toBe("quoted desc")
  })
})
