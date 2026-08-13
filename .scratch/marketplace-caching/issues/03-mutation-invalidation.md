# 03 — Precise cache invalidation on mutations

**What to build:** The user's own mutation actions never show stale cached data. Adding or removing a repo invalidates the tarball cache so the next marketplace open reflects the change immediately (new repo's skills appear, removed repo's skills disappear). Setting or removing the SkillHub API key invalidates the SkillHub list caches so private-skill visibility ("我的" section) updates immediately. Install and uninstall invalidate nothing — installed state is read live from config on every `list()`, never served from cache.

**Blocked by:** 01 — Repo tarball in-memory TTL cache; 02 — SkillHub catalogue TTL cache

**Status:** ready-for-agent

- [ ] After `addRepo`, the next `list()` downloads that repo's tarball (no stale empty result)
- [ ] After `removeRepo`, the next `list()` no longer includes that repo's skills
- [ ] After `setSkillHubKey`, the next `list()` refetches the SkillHub lists (including "my skills")
- [ ] After `removeSkillHubKey`, the next `list()` refetches and returns public-only SkillHub entries
- [ ] `install`/`uninstall` cause no cache invalidation, and installed state shown by `list()` stays accurate
- [ ] Tests cover each invalidation trigger via the stubbed HTTP layer, asserting request counts before/after the mutation
