# 01 — Repo tarball in-memory TTL cache

**What to build:** Opening the skill marketplace no longer re-downloads every configured repo's tarball on each open. The marketplace service keeps repo tarballs (raw bytes, keyed by `host/owner/name/branch`) in an in-memory cache with a 5-minute TTL; repeat opens within the TTL are served with zero tarball downloads. Installing a repo skill right after browsing reuses the cached bytes instead of downloading the same archive again. A failed download (network error, non-200, timeout) is also cached for the TTL, so one dead repo no longer adds its timeout to every marketplace open. This ticket also establishes the reusable TTL-cache mechanism that ticket 02 builds on.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A second `list()` within 5 minutes issues no tarball download requests
- [ ] A `list()` after the TTL re-downloads the tarball
- [ ] `install` following a `list()` issues no tarball download for that repo
- [ ] A failed download is not retried within the TTL
- [ ] Cache is in-memory only, keyed by repo identity (`host/owner/name/branch`); no new dependencies
- [ ] Tests assert upstream request counts via a stubbed HTTP layer with a controllable clock, following the existing hermetic marketplace test pattern
