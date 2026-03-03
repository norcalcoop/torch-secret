# Phase 31: Rebrand + Tech Debt - Research

**Researched:** 2026-02-22
**Domain:** Brand rename (string/identifier replacement), CI env vars, HTTP headers, code comments
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rebrand scope — Full rename:**
- Scope includes: HTML `<title>`, OG tags, email sender name, header logo text, README heading,
  code comments, `package.json` name field, Docker Compose service/container names, and any
  remaining inline `SecureShare` or `secureshare` string literals throughout the codebase
- npm package name: idiomatic npm kebab-case (`torch-secret`) preferred
- Docker Compose service names: rename from `secureshare-*` pattern to match new brand
- Code comments: update any that reference SecureShare by name

**Domain in code — Env var approach:**
- Use `APP_URL` env var as the single source of truth for the base domain
- `APP_URL` validated in `server/src/config/env.ts` via Zod, with a sensible local-dev default
  (`http://localhost:3000`); production value is `https://torchsecret.com`
- All canonical URLs, OG tags, sitemap entries, and JSON-LD `@id`/`url` fields must read from
  `APP_URL` — no hardcoded `secureshare.example.com` or `torchsecret.com` strings
- `.env.example`: update to include `APP_URL=https://torchsecret.com` with a comment showing
  the local-dev override
- Old placeholder `secureshare.example.com`: simple find-and-replace, no redirect handling needed

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

**TECH-04 — Lucide upgrade + alias removal:**
- `vite.config.ts` has a hardcoded resolve alias for Lucide 0.564.0's broken ESM entry point
- Process: upgrade Lucide to latest (0.575.0+), run a production build and verify icons render,
  then remove the alias if confirmed fixed
- If the ESM bug persists in the newer version, defer the alias removal and note in CONTEXT

**TECH-05 — schema.ts enforcement point count in ROADMAP.md:**
- Rolled into TECH-03: fixing schema.ts comment also requires correcting the ROADMAP.md
  success criterion from "6" → "7" enforcement points

### Claude's Discretion
- npm package name choice (idiomatic kebab-case preferred)
- Local `APP_URL` default value for development
- Whether to add `APP_URL` to `.env.example` (recommended: yes, with clear comment)
- Zero-knowledge architecture positioning in README (headline or supporting)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BRAND-01 | App name displays as "Torch Secret" in all user-facing locations (HTML `<title>`, OG tags, header, email sender) | Grep audit identified every occurrence — 13 source files affected in user-facing paths. Pattern list in Architecture Patterns section. |
| BRAND-02 | All canonical URLs, sitemap entries, JSON-LD `@id`/`url`, and OG tags use `torchsecret.com` domain | 6 specific files contain `secureshare.example.com`; env var approach enables runtime domain injection. |
| BRAND-03 | README updated with "Torch Secret" name and link to `torchsecret.com` as the live hosted version | README.md requires full refresh per CONTEXT.md; content requirements documented below. |
| BRAND-04 | CI workflow, Docker Compose, and `package.json` name field updated to reflect new product name | Precise file locations and current values documented. CI needs placeholder env vars coordinated with TECH-01. |
| TECH-01 | CI workflow includes placeholder env vars to prevent integration test failures | Current ci.yml missing `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`. All 4 required by Zod schema. Placeholder values that pass validation documented. |
| TECH-02 | `/privacy` and `/terms` added to `NOINDEX_PREFIXES` in `app.ts` for server-side `X-Robots-Tag` header | Current `NOINDEX_PREFIXES` array documented; exact change is a 2-line array extension. |
| TECH-03 | `schema.ts` zero-knowledge inline comment updated to match canonical list in `INVARIANTS.md` | Current comment has 3 bullet points; INVARIANTS.md has 7 rows. All 7 rows extracted with their locations and rules. |
</phase_requirements>

---

## Summary

Phase 31 is a rename + cleanup phase with no new functionality. The work divides into two streams: (1) a brand rename from "SecureShare" to "Torch Secret" and from `secureshare.example.com` to the `APP_URL` env var, and (2) four targeted tech debt fixes (TECH-01 through TECH-04).

The grep audit reveals "SecureShare" appears in approximately 40+ files across the repo. However, only a subset are user-facing or actively served to end users — the rest are `.planning/` history docs that are read-only artifacts. The planner must distinguish between files that change the product experience (primary targets) and planning archive files (leave untouched). Key user-facing targets: `client/index.html`, `client/src/router.ts`, `client/src/components/layout.ts`, `server/src/auth.ts`, `server/src/services/notification.service.ts`, `client/src/pages/terms.ts`, `client/src/pages/privacy.ts`, `client/public/robots.txt`, `client/public/sitemap.xml`, `client/public/site.webmanifest`, `package.json`, `docker-compose.yml`, `render.yaml`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`.

The domain replacement strategy uses an `APP_URL` env var already present in `config/env.ts` (currently optional). Static files that must use a hardcoded URL (sitemap.xml, robots.txt, index.html canonical/OG tags) will reference `https://torchsecret.com` directly — these are static files, not server-rendered, so they cannot read a runtime env var. Only server-side rendered content (which this app does not currently have for these pages) could inject APP_URL at runtime.

**Primary recommendation:** Execute as 4 plan tasks: (1) User-facing brand rename sweep + static files, (2) Infrastructure rename (package.json, Docker, CI, render.yaml) + TECH-01 env vars coordinated, (3) TECH-02 + TECH-03 server-side fixes, (4) TECH-04 Lucide upgrade + README refresh.

---

## Standard Stack

This phase uses no new libraries. All changes are to existing files using existing tooling.

### Existing Tooling Relevant to This Phase

| Tool | Purpose in This Phase | Notes |
|------|----------------------|-------|
| `grep` / ripgrep | Pre/post audit to verify no "SecureShare" remains in user-facing output | Run before and after rename |
| `npm install lucide@latest` | TECH-04: upgrade Lucide from 0.564.0 to 0.575.0 | Latest confirmed: 0.575.0 as of 2026-02-22 |
| `npm run build:client` | TECH-04: verify Lucide icons render after upgrade | Required to confirm alias removal is safe |
| Express `res.setHeader()` | TECH-02: `X-Robots-Tag` header already used in same file | No new API needed |

---

## Architecture Patterns

### File Inventory: User-Facing "SecureShare" Occurrences

These are the files that appear in served HTML, emails, or developer-visible configs. Planning docs in `.planning/` are excluded — they are historical artifacts and should NOT be modified.

#### Primary targets (change required):

**`client/index.html`** — 10 occurrences:
- Line 19: `<link rel="canonical" href="https://secureshare.example.com/" />`
- Line 20: `<title>SecureShare - Share Secrets Securely</title>`
- Line 22: `<meta property="og:title" content="SecureShare - Zero-Knowledge Secret Sharing" />`
- Line 25: `<meta property="og:url" content="https://secureshare.example.com/" />`
- Line 26: `<meta property="og:image" content="https://secureshare.example.com/og-image.png" />`
- Line 29: `<meta property="og:image:alt" content="SecureShare - Zero-knowledge one-time secret sharing" />`
- Line 30: `<meta property="og:site_name" content="SecureShare" />`
- Line 33: `<meta name="twitter:title" content="SecureShare - Zero-Knowledge Secret Sharing" />`
- Line 45: `"name": "SecureShare"` (JSON-LD)
- Line 46: `"url": "https://secureshare.example.com/"` (JSON-LD)
- Line 84: noscript `<h1>SecureShare</h1>`
- Line 107: noscript text "JavaScript is required to use SecureShare"

**`client/src/router.ts`** — 9 occurrences of "SecureShare" in document.title and meta content strings (lines 67, 131, 134, 138, 141, 202, 212, 222, 232, 242, 252, 262, 292)

**`client/src/components/layout.ts`** — Line 65: `wordmark.textContent = 'SecureShare'`

**`client/src/pages/confirmation.ts`** — Line 181: `createShareButton(shareUrl, 'SecureShare - Your secure link')`

**`client/src/pages/terms.ts`** — 5+ occurrences of "SecureShare" in page text

**`client/src/pages/privacy.ts`** — 1+ occurrences (comment + page text)

**`server/src/auth.ts`** — Lines 76, 88: email subjects "Reset your SecureShare password", "Verify your SecureShare email"

**`server/src/services/notification.service.ts`** — Lines 24-26: email subject and body

**`server/src/server.ts`** — Line 10: `'SecureShare server started'` in logger

**`client/public/robots.txt`** — Line 6: `Sitemap: https://secureshare.example.com/sitemap.xml`

**`client/public/sitemap.xml`** — Line 4: `<loc>https://secureshare.example.com/</loc>`

**`client/public/site.webmanifest`** — Lines 2-3: `"name": "SecureShare"`, `"short_name": "SecureShare"`

**`package.json`** — Line 2: `"name": "secureshare"` (rename to `"torch-secret"`)

**`docker-compose.yml`** — Line 46: `RESEND_FROM_EMAIL: 'SecureShare <noreply@localhost>'`

**`render.yaml`** — Line 1: comment; Line 15: service name `secureshare`; Line 24: DB ref `secureshare-db`; Line 29: Redis ref `secureshare-redis`; Line 50: `RESEND_FROM_EMAIL` comment; Line 77: Redis service name `secureshare-redis`; Line 83: DB name `secureshare-db`

**`README.md`** — Full replacement required (see README refresh spec below)

**`CONTRIBUTING.md`** — 4 occurrences of "SecureShare" in prose

**`SECURITY.md`** — 3 occurrences of "SecureShare" in prose

**`.github/ISSUE_TEMPLATE/feature-request.yml`** — 1 occurrence

**`client/src/analytics/posthog.ts`** — File-level comment (line 2)

**`client/src/crypto/*.ts`** — File-level comments referencing "SecureShare" in:
  - `encrypt.ts`, `keys.ts`, `encoding.ts`, `decrypt.ts`, `index.ts`, `types.ts`, `constants.ts`

**`client/src/api/client.ts`** — File-level comment

**`client/src/app.ts`** — File-level comment

**`scripts/screenshots.ts`** — Comment and sample message string

**`.planning/INVARIANTS.md`** — Title and prose (this is a planning doc but is also referenced by CLAUDE.md and schema.ts; update title and brand references)

**`.env.example`** — Line 31: `RESEND_FROM_EMAIL=SecureShare <noreply@yourdomain.com>`

#### Static files that hardcode the domain:

Since `index.html`, `sitemap.xml`, and `robots.txt` are static files served by Express or the Vite dev server, they cannot read runtime env vars. These files must hardcode `https://torchsecret.com` directly. Only server-side rendered content could inject `APP_URL` at runtime.

**Pattern for static files:** Replace `secureshare.example.com` → `torchsecret.com` directly.

**Pattern for `RESEND_FROM_EMAIL` env var:** Set placeholder to `Torch Secret <noreply@torchsecret.com>` in docker-compose.yml and .env.example.

### TECH-01: CI Env Vars — Precise Gap Analysis

Current `ci.yml` `test` job `env` block:
```yaml
env:
  DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
  NODE_ENV: test
```

Missing required vars (all fail `EnvSchema.parse()` without them):
- `BETTER_AUTH_SECRET` — `z.string().min(32)` — placeholder: `'ci-test-secret-placeholder-32-chars-long'` (40 chars, safe)
- `BETTER_AUTH_URL` — `z.string().url()` — placeholder: `'http://localhost:3000'`
- `RESEND_API_KEY` — `z.string().min(1)` — placeholder: `'re_placeholder'`
- `RESEND_FROM_EMAIL` — `z.string().min(1)` — placeholder: `'Torch Secret <noreply@torchsecret.com>'`

`APP_URL` is `z.string().url().optional()` — not required by Zod, but set for completeness: `'http://localhost:3000'`

The `e2e` job also needs the same env vars added.

Docker build job: Tag image as `torch-secret:ci-test` (renames from `secureshare:ci-test`).

### TECH-02: NOINDEX_PREFIXES — Precise Change

Current array in `server/src/app.ts` lines 111-118:
```typescript
const NOINDEX_PREFIXES = [
  '/secret/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
];
```

Required addition:
```typescript
const NOINDEX_PREFIXES = [
  '/secret/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
  '/privacy',
  '/terms',
];
```

The existing `res.setHeader('X-Robots-Tag', 'noindex, nofollow')` call on line 120 already handles the response — only the array needs extending.

### TECH-03: schema.ts Comment — Precise 7-Point List

Current comment (3 bullet points):
```
 *   DB:        secrets.user_id is nullable; secrets.id is never stored in users or sessions rows
 *   Logger:    server/src/middleware/logger.ts redacts secret IDs from URL paths via regex
 *   Analytics: PostHog events must strip URL fragments (sanitize_properties) — Phase 25
```

Required replacement (7 bullet points matching INVARIANTS.md):
```
 *   DB — secrets table:       secrets.user_id is nullable FK; secrets.id is never stored in users, sessions, or accounts rows
 *   DB — users table:         No secret_id or last_secret_id column. User rows contain no secret identifiers.
 *   Logger:                   server/src/middleware/logger.ts redacts secret IDs from URL paths via regex
 *   Analytics:                PostHog sanitize_properties must strip URL fragments before any event fires — Phase 25
 *   Logger — dashboard route: redactUrl regex extended to cover /api/dashboard/secrets/:id paths — Phase 23
 *   Email (Resend):           notification email body contains only viewed-at timestamp; no secretId, label, or ciphertext — Phase 26
 *   Rate limits + prompts:    429 responses and conversion prompt events contain no userId or secretId — Phase 27
```

Also update `.planning/ROADMAP.md` Phase 31 success criterion #5: change "6 enforcement points" → "7 enforcement points".

Also update `.planning/INVARIANTS.md` title and brand references from "SecureShare" → "Torch Secret" (since this doc is active, not archive).

### TECH-04: Lucide Upgrade — Process

Current: `lucide: "^0.564.0"` in `package.json`
Latest confirmed: `0.575.0`
Current workaround in `vite.config.ts`:
```typescript
resolve: {
  alias: {
    lucide: 'lucide/dist/esm/lucide/src/lucide.js',
  },
},
```

Process:
1. `npm install lucide@latest` (installs 0.575.0)
2. `npm run build:client` — if build succeeds and no icon errors appear, remove the alias
3. `npm run build:client` again without alias — verify icons still render in the built output
4. If build fails without alias, keep the alias and note in research that the ESM bug persists

Confidence that 0.575.0 fixes the ESM entry point: MEDIUM (unverified; must test during implementation).

### README Refresh Spec

Per CONTEXT.md:
- H1: "Torch Secret"
- Live-site badge: shields.io badge linking to `https://torchsecret.com`
- Update project description: reflect v4.0 (auth, dashboard, anonymous + account hybrid)
- Tech stack: verify accuracy — Better Auth, Drizzle, Pino, Resend, PostHog all now present
- Setup: Docker-first (`docker compose up` as primary path, manual PostgreSQL as secondary note)
- Update CI/codecov badges from `norcalcoop/secureshare` → update if repo is renamed, otherwise leave path as-is (repo rename is not in scope)
- Screenshot alt text: update "SecureShare" → "Torch Secret"

### Anti-Patterns to Avoid

- **Renaming `.planning/` archive docs:** Historical planning docs (phase plans, summaries, verifications for phases 1-30) should NOT be updated. They are read-only historical artifacts. Exception: `.planning/INVARIANTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md` are active docs that must be updated.
- **Hardcoding `torchsecret.com` in server-rendered responses:** Server-side code must use `env.APP_URL`. Static served files (index.html, sitemap.xml, robots.txt) may hardcode the production domain since they cannot access runtime env vars.
- **Coordinating CI + Docker changes poorly:** BRAND-04 (CI, Docker, package.json) and TECH-01 (CI env vars) both touch `ci.yml`. Put them in the same plan task to avoid conflicts.
- **Skipping post-rename grep audit:** After the rename, run `grep -r "SecureShare\|secureshare\.example\.com" --include="*.{ts,html,json,yml,yaml,md}" .` excluding `.planning/milestones/` and `.git/` to verify completeness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Domain injection in static HTML | Custom build plugin or string replacement script | Direct find-and-replace in static files | Static files cannot read runtime env vars; hardcoding `torchsecret.com` is correct for sitemap.xml, robots.txt, canonical tags |
| Verifying no "SecureShare" remains | Manual review | `grep -r "SecureShare" --include="*.{ts,html,json,yml}"` | Automated check is reliable and fast |

---

## Common Pitfalls

### Pitfall 1: APP_URL Is Currently Optional — Make It Required
**What goes wrong:** `config/env.ts` currently has `APP_URL: z.string().url().optional()`. If left optional, the CI fix (TECH-01) only needs to add it for completeness, not correctness. But if the rebrand requires all domain URLs to come from `APP_URL`, it becomes functionally required for production.
**Why it happens:** The env var was added in Phase 22 for a specific email-link use case. Its optional status made sense then.
**How to avoid:** Per CONTEXT.md, `APP_URL` remains optional in the Zod schema with a `http://localhost:3000` default. Static files hardcode `torchsecret.com`. The `toAppUrl()` function in `auth.ts` already handles the optional-with-fallback case correctly.
**Warning signs:** If you add a `.default('http://localhost:3000')` to the Zod schema instead of making it optional, that's fine — but do not change the existing function signatures that guard on `env.APP_URL`.

### Pitfall 2: Missing RESEND_FROM_EMAIL in CI Causes Silent Failures
**What goes wrong:** `RESEND_FROM_EMAIL` is `z.string().min(1)` — required. Without it, `EnvSchema.parse()` throws and every server-side test fails at module import time.
**Why it happens:** Was not added to CI when Phase 26 (email notifications) introduced it.
**How to avoid:** Add `RESEND_FROM_EMAIL: 'Torch Secret <noreply@torchsecret.com>'` to both the `test` and `e2e` job env blocks in `ci.yml`.

### Pitfall 3: Partial Rename Leaves Mixed Brand
**What goes wrong:** Updating user-facing strings but missing code comments, or updating main source but missing static files, leaves a split brand. SEO crawlers and social preview scrapers see `og:site_name="SecureShare"` while the page title says "Torch Secret".
**Why it happens:** Multiple files, easy to miss the static files.
**How to avoid:** Use the file inventory above as a checklist. Run the grep audit after each task.

### Pitfall 4: router.ts Brand Updates Break OG Security Invariant
**What goes wrong:** When updating `router.ts` OG tag logic, accidentally changing the generic OG fallback on secret routes to include brand-identifiable info.
**Why it happens:** The router has a deliberate pattern: secret routes get `og:title="Torch Secret"` (generic) — not `og:title="View Your Secret"` or similar. This prevents social preview cards from revealing that a URL is a secret link.
**How to avoid:** Keep the existing `updateOgTags(true)` pattern intact. Only change the string values from "SecureShare" to "Torch Secret". Do not change the conditional logic.

### Pitfall 5: Lucide Alias Removal Breaks Icons
**What goes wrong:** Removing the Lucide alias before verifying 0.575.0 fixes the ESM entry point causes build failures or missing icons.
**Why it happens:** The Lucide ESM entry point bug affected 0.564.0; it may or may not be fixed in 0.575.0.
**How to avoid:** Test with `npm run build:client` before removing alias. If build fails, keep alias and note it.

### Pitfall 6: ROADMAP.md "6 enforcement points" vs Actual 7
**What goes wrong:** Leaving the stale "6" in ROADMAP.md success criterion creates a false verification signal — the verifier checks for 6 but the comment has 7.
**Why it happens:** ROADMAP.md was written before phases 25-27 added 4 more enforcement points to INVARIANTS.md. The success criterion was not updated as enforcement points accrued.
**How to avoid:** Update ROADMAP.md Phase 31 success criterion #5 from "6" → "7" as part of TECH-03.

---

## Code Examples

### TECH-01: CI env block (test job)
```yaml
# .github/workflows/ci.yml — test job env section
env:
  DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
  NODE_ENV: test
  BETTER_AUTH_SECRET: ci-test-secret-placeholder-must-be-at-least-32-chars
  BETTER_AUTH_URL: http://localhost:3000
  APP_URL: http://localhost:3000
  RESEND_API_KEY: re_placeholder
  RESEND_FROM_EMAIL: "Torch Secret <noreply@torchsecret.com>"
```

Note: `BETTER_AUTH_SECRET` must be at least 32 characters (Zod `.min(32)`) — the value above is 48 chars.

### TECH-02: NOINDEX_PREFIXES extension
```typescript
// server/src/app.ts — extend existing array
const NOINDEX_PREFIXES = [
  '/secret/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/dashboard',
  '/privacy',   // added: server-side noindex enforcement
  '/terms',     // added: server-side noindex enforcement
];
```

### Brand rename in index.html canonical/OG (static hardcode)
```html
<!-- client/index.html -->
<link rel="canonical" href="https://torchsecret.com/" />
<title>Torch Secret - Share Secrets Securely</title>
<meta property="og:title" content="Torch Secret - Zero-Knowledge Secret Sharing" />
<meta property="og:url" content="https://torchsecret.com/" />
<meta property="og:image" content="https://torchsecret.com/og-image.png" />
<meta property="og:image:alt" content="Torch Secret - Zero-knowledge one-time secret sharing" />
<meta property="og:site_name" content="Torch Secret" />
<meta name="twitter:title" content="Torch Secret - Zero-Knowledge Secret Sharing" />
```

JSON-LD in index.html:
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Torch Secret",
  "url": "https://torchsecret.com/",
  "description": "Zero-knowledge, one-time secret sharing. End-to-end encrypted in your browser."
}
```

### Brand rename in layout.ts header
```typescript
// client/src/components/layout.ts line 65
wordmark.textContent = 'Torch Secret';
```

### Brand rename in auth.ts email subjects
```typescript
// server/src/auth.ts
subject: 'Reset your Torch Secret password',
// ...
subject: 'Verify your Torch Secret email',
```

### Brand rename in notification.service.ts
```typescript
// server/src/services/notification.service.ts
subject: 'Your Torch Secret secret was viewed',
text: [
  'A secret you created on Torch Secret was viewed and permanently deleted.',
  // ...
]
```

### TECH-04: Lucide upgrade command
```bash
npm install lucide@latest
# Installs 0.575.0
npm run build:client
# If successful, remove alias from vite.config.ts and rebuild
```

### .env.example APP_URL addition
```bash
# Base URL for the application (used in OAuth callbacks and email links)
# Production: https://torchsecret.com
# Local dev override: http://localhost:5173 (Vite dev server)
APP_URL=https://torchsecret.com
```

---

## State of the Art

| Area | Current State | Target State | Notes |
|------|--------------|--------------|-------|
| Brand name in source | "SecureShare" | "Torch Secret" | Find-and-replace across 15+ active files |
| Domain in static files | `secureshare.example.com` | `torchsecret.com` | Direct replacement |
| CI env vars | Only `DATABASE_URL`, `NODE_ENV` | + 4 required vars | Zod parse failure without them |
| `/privacy` + `/terms` noindex | Client-side `<meta>` only | Server-side `X-Robots-Tag` + `<meta>` | 2-line change to NOINDEX_PREFIXES |
| schema.ts ZK comment | 3 enforcement points listed | 7 enforcement points listed | Matches INVARIANTS.md |
| Lucide version | 0.564.0 with alias workaround | 0.575.0, alias removed if fixed | Must test during implementation |
| package.json name | `"secureshare"` | `"torch-secret"` | Idiomatic kebab-case |

---

## Open Questions

1. **Does Lucide 0.575.0 fix the broken ESM entry point?**
   - What we know: 0.564.0 required an alias `lucide/dist/esm/lucide/src/lucide.js`. 0.575.0 is the latest. No research was performed on the Lucide changelog.
   - What's unclear: Whether the bug was patched in any version between 0.564.0 and 0.575.0.
   - Recommendation: Test during implementation. Run `npm install lucide@0.575.0` then `npm run build:client` with and without alias. If alias is still needed, note it but proceed with upgrade.

2. **GitHub repo name — update or leave?**
   - What we know: README badges reference `norcalcoop/secureshare` repo path. CONTEXT.md does not address repo renaming.
   - What's unclear: Whether the GitHub repo itself will be renamed from `secureshare` to `torch-secret`.
   - Recommendation: Leave repo path unchanged in this phase. Badge URLs can stay as `norcalcoop/secureshare` — badge rendering is independent of the repo display name. If repo rename happens, badges auto-update. Out of scope for Phase 31.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `client/index.html`, `client/src/router.ts`, `client/src/components/layout.ts`, `server/src/app.ts`, `server/src/db/schema.ts`, `server/src/auth.ts`, `server/src/config/env.ts`, `.github/workflows/ci.yml`, `docker-compose.yml`, `render.yaml`, `package.json`, `client/public/robots.txt`, `client/public/sitemap.xml`, `client/public/site.webmanifest`
- `.planning/INVARIANTS.md` — canonical 7-row enforcement table (read directly)
- `.planning/phases/31-rebrand-tech-debt/31-CONTEXT.md` — locked decisions
- `npm show lucide versions` — confirmed 0.575.0 is latest Lucide version

### Secondary (MEDIUM confidence)
- Grep audit of full codebase for "SecureShare" and "secureshare.example.com" — comprehensive but may miss binary files or generated outputs
- Zod schema inference for required vs optional env vars (read directly from `config/env.ts`)

---

## Metadata

**Confidence breakdown:**
- Brand rename targets: HIGH — direct code inspection, grep audit
- CI env var requirements: HIGH — read directly from Zod schema
- TECH-02 (NOINDEX): HIGH — simple array extension, verified existing pattern
- TECH-03 (schema comment): HIGH — both source (schema.ts) and target (INVARIANTS.md) read directly
- TECH-04 (Lucide fix): MEDIUM — latest version confirmed but ESM fix status not verified from changelog

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable; Lucide version check should be re-done if implementation is delayed >1 week)
