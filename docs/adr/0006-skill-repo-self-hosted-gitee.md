# Skill repo marketplace supports configured self-hosted Gitee hosts; branch stays URL-embedded with probe-plus-fallback resolution

Skill repos today only parse `github.com` / `gitee.com` URLs, which rejects self-hosted Gitee instances (e.g. a company-internal `lggitee.lgdg.cc`) and silently misroutes them into the legacy `index.json` discovery protocol. This ADR extends the marketplace to accept configured self-hosted Gitee hosts with optional per-host tokens, while keeping every other model decision unchanged.

Decisions:

1. **Branch stays embedded in the repo URL** (`/tree/<branch>`), as today. The skill-repo panel gains a separate branch input that composes the `/tree/<branch>` form on submit; no parallel `branch` config field is introduced. (cc-switch stores branch as a first-class repo field with a dedicated UI input; we keep the URL as the single self-describing source and only borrow the UI convenience.)
2. **Branch resolution is probe-plus-fallback**: the existing host-API `default_branch` probe stays primary; if the tarball download 404s on the resolved branch, retry once with the other of `main`/`master`. This closes the dead corner where the API is unreachable and the guessed branch is wrong, without cc-switch's full ordered-trial list.
3. **Self-hosted Gitee hosts are a config allowlist with optional tokens**: `skills.giteeHosts: [{ host, token? }]`. `parseRepoUrl(url, hosts)` only accepts non-default hosts present in the allowlist, and `SkillRepo` gains a `baseUrl` used to build API and tarball URLs. When a token is configured for the host, API and tarball requests carry it as the Gitee-standard `access_token` query parameter. Storing the token in config follows the existing `experimental.tdai.apiKey` precedent; the config file is local and user-owned.
4. **Branch/segment validation stays at `isSafeSegment`** (rejects `..`, `/`, `\`). The URL host now comes from the config allowlist and the URL template is fixed, so the traversal-hijack surface cc-switch defends against with stricter git-ref rules does not exist here; a malformed branch degrades to a 404.
5. **Storage stays config-driven**: repo list in `skills.urls`, installed skills on disk referenced by `skills.paths`. cc-switch's SQLite + SSOT + symlink projection model solves multi-tool sharing, which is not a LoongCode requirement.

## Considered Options

- Independent `branch` field next to `url` in config (cc-switch model): rejected — duplicates information already expressible in the URL, requires config migration for existing `/tree/` URLs, and adds a second source of truth for no structural gain.
- Pure ordered branch fallback (`configured → main → master`) without the API probe: rejected — trades a cheap API call for near-guaranteed extra 404s, and loses correct handling of repos whose default branch is neither `main` nor `master`.
- Token in the Auth service keyed per host: rejected for now — no UI/CLI path exists to write such keys, so the feature would be unreachable; config tokens match the TDAI precedent and can migrate to Auth later if a secrets UI appears.
- cc-switch-style strict git-ref validation for branches: rejected — `isSafeSegment` already blocks path traversal, and remaining malformed inputs fail harmlessly as 404.
- cc-switch's SQLite + SSOT + projection storage: rejected — solves multi-tool skill sharing that LoongCode does not need, at far higher implementation cost.

## Consequences

- Self-hosted Gitee users configure one `giteeHosts` entry per host (with token for private instances) and then use the repo panel exactly as with public GitHub/Gitee repos.
- The add-repo error copy must mention configured self-hosted hosts, not just GitHub/Gitee.
- `parseRepoUrl` callers (`skill/index.ts` discovery, marketplace) must pass the configured hosts; discovery's repo-URL skip logic and the legacy `index.json` fallback both depend on this.
- Tarball downloads may issue one extra 404 request per repo when the branch guess is wrong; this is bounded (one retry) and cached per TTL as before.
- Tokens in config are readable by anyone with file access, same exposure class as `experimental.tdai.apiKey`; users who object can leave the repo public-internal and omit `token`.
