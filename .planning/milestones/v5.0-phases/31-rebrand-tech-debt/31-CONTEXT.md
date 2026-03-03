# Phase 31: Rebrand + Tech Debt - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename SecureShare → Torch Secret and torchsecret.com across every user-facing surface and code
identifier in the repository, then clear five known tech debt items (original three from
REQUIREMENTS.md plus two surfaced during context discussion) before any new feature code is written.

</domain>

<decisions>
## Implementation Decisions

### Rebrand scope
- **Full rename** — not limited to user-facing strings
- Scope includes: HTML `<title>`, OG tags, email sender name, header logo text, README heading,
  code comments, `package.json` name field, Docker Compose service/container names, and any
  remaining inline `SecureShare` or `secureshare` string literals throughout the codebase
- npm package name: Claude's discretion — idiomatic npm kebab-case (`torch-secret`) preferred
- Docker Compose service names: rename from `secureshare-*` pattern to match new brand
- Code comments: update any that reference SecureShare by name

### Domain in code
- **Env var approach** — use `APP_URL` env var as the single source of truth for the base domain
- `APP_URL` validated in `server/src/config/env.ts` via Zod, with a sensible local-dev default
  (`http://localhost:3000`); production value is `https://torchsecret.com`
- All canonical URLs, OG tags, sitemap entries, and JSON-LD `@id`/`url` fields must read from
  `APP_URL` — no hardcoded `secureshare.example.com` or `torchsecret.com` strings
- `.env.example`: Claude's discretion — update to include `APP_URL=https://torchsecret.com`
  with a comment showing the local-dev override
- Old placeholder `secureshare.example.com`: simple find-and-replace, no redirect handling needed

### Tech debt items (5 total)
**TECH-01 — CI placeholder env vars:**
- Add the full set of required env vars as placeholder values in `.github/workflows/ci.yml`
- "Comprehensive" scope: all vars that `config/env.ts` marks as required
  (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `RESEND_API_KEY`, and any others that
  fail Zod validation during integration tests)
- Placeholder values should pass Zod validation (e.g., 32-char dummy secret, valid URL format)

**TECH-02 — `/privacy` and `/terms` X-Robots-Tag:**
- Add `/privacy` and `/terms` to `NOINDEX_PREFIXES` array in `server/src/app.ts`
- Server returns `X-Robots-Tag: noindex, nofollow` for those routes — client-side meta alone
  is insufficient

**TECH-03 — schema.ts zero-knowledge comment:**
- Update the inline enforcement-points comment in `server/src/db/schema.ts` to list all 7
  enforcement points matching the canonical table in `.planning/INVARIANTS.md`
- Currently the comment lists only 3 (DB, Logger, Analytics); it is missing: DB — users table,
  Logger — dashboard route, Email (Resend), Rate limits + conversion prompts (Phase 27)
- ROADMAP.md Phase 31 success criterion says "6 enforcement points" — this is stale; the correct
  count is 7. Update the success criterion text in ROADMAP.md to match reality.

**TECH-04 — Lucide upgrade + alias removal (surfaced during context):**
- `vite.config.ts` has a hardcoded resolve alias for Lucide 0.564.0's broken ESM entry point
- Process: upgrade Lucide to latest (0.575.0+), run a production build and verify icons render,
  then remove the alias if confirmed fixed
- If the ESM bug persists in the newer version, defer the alias removal and note in CONTEXT

**TECH-05 — schema.ts enforcement point count in ROADMAP.md (surfaced during context):**
- Rolled into TECH-03: fixing schema.ts comment also requires correcting the ROADMAP.md
  success criterion from "6" → "7" enforcement points

### Claude's Discretion
- npm package name choice (idiomatic kebab-case preferred)
- Local `APP_URL` default value for development
- Whether to add `APP_URL` to `.env.example` (recommended: yes, with clear comment)
- Zero-knowledge architecture positioning in README (headline or supporting — whatever reads
  most compellingly for developers visiting the repo)

</decisions>

<specifics>
## Specific Ideas

- BRAND-04 (CI, Docker Compose, package.json) is tightly coupled to the TECH-01 CI env var work
  — both touch `.github/workflows/ci.yml`; coordinate these in the same plan task to avoid
  merge conflicts
- The "Workaround" comment in `server/src/auth.ts` (Better Auth `verifications` key mapping)
  is a legitimate workaround comment but is NOT a rebrand item — leave it
- Lucide upgrade (TECH-04) touches build tooling and may interact with vite.config alias for
  other packages; isolate it in its own plan task

</specifics>

<specifics>
## README Update Depth

Full README refresh:
- H1: "Torch Secret" (zero-knowledge framing at Claude's discretion for structure)
- Add a live-site badge (shields.io or equivalent) linking to torchsecret.com
- Update project description to reflect current product state (v4.0: auth, dashboard, anonymous
  + account hybrid model)
- Tech stack section: verify accuracy against current deps (Better Auth, Drizzle, Pino, etc.)
- Setup instructions: **Docker-first** — `docker compose up` as the primary path, manual
  PostgreSQL as a secondary note
- Update any badges (CI, license) if they reference SecureShare or old repo paths

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-rebrand-tech-debt*
*Context gathered: 2026-02-22*
