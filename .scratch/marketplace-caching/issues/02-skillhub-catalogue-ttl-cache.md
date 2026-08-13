# 02 — SkillHub catalogue TTL cache

**What to build:** The SkillHub public catalogue and the "my skills" list are cached in memory with the same 5-minute TTL, reusing the cache mechanism from ticket 01. Reopening the marketplace within the TTL issues no SkillHub API requests at all; after expiry the lists are refetched (including the full pagination walk). Each list is cached as a complete fetched result, not per page.

**Blocked by:** 01 — Repo tarball in-memory TTL cache (reuses its TTL-cache mechanism)

**Status:** ready-for-agent

- [ ] A second `list()` within the TTL issues no SkillHub requests (public or "my skills")
- [ ] A `list()` after the TTL refetches the full paginated lists
- [ ] With no SkillHub key configured, only the public catalogue is fetched and cached
- [ ] Tests assert upstream request counts via the stubbed HTTP layer with a controllable clock
