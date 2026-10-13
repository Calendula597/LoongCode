// TDAI identity keys are generated once when the identity is added and never
// change afterwards: renaming must not break the `tdai/<key>` provider ID that
// default-model configs reference. Keys loaded from loongcode.json are kept
// verbatim; the generator only skips them to avoid collisions.
export function nextIdentityKey(occupied: Iterable<string>): string {
  const used = new Set(occupied)
  for (let i = 1; ; i++) {
    const candidate = `identity-${i}`
    if (!used.has(candidate)) return candidate
  }
}
