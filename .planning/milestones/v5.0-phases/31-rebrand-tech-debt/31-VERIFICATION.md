---
phase: 31-rebrand-tech-debt
verified: 2026-02-22T22:30:00Z
status: passed
score: 15/15 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 14/14
  gaps_closed:
    - "All text in the protection panel is visible when light theme is active (Plan 04 gap closure)"
  gaps_remaining: []
  regressions: []
---

# Phase 31: Rebrand + Tech Debt Verification Report

**Phase Goal:** The product is publicly named Torch Secret with torchsecret.com throughout every user-facing surface, and four known tech debt items are cleared before any new feature code is written
**Verified:** 2026-02-22
**Status:** passed
**Re-verification:** Yes — after UAT gap closure (Plan 04: light-theme protection panel fix)

---

## Re-Verification Context

The initial VERIFICATION.md (2026-02-22T21:00:00Z) passed 14/14 truths. UAT subsequently identified one issue: white-on-white invisible text in the protection panel when light theme is active. Plan 04 executed commit `a5dd681` to fix it. This re-verification adds the Plan 04 gap closure as truth #15 and runs regression checks on all 14 previously-passing truths.

---

## Goal Achievement

### Observable Truths

All truths are drawn from the four plan `must_haves` blocks (Plans 01, 02, 03, and 04).

#### Plan 01 Truths (BRAND-01, BRAND-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every HTML `<title>`, OG tag, header logo text, and email sender string reads "Torch Secret", not "SecureShare" | VERIFIED | `client/index.html` line 20: `Torch Secret - Share Secrets Securely`; `layout.ts` line 65: `'Torch Secret'`; `auth.ts` lines 76, 88: `'Reset/Verify your Torch Secret ...'`; `notification.service.ts` line 24: `'Your Torch Secret secret was viewed'` |
| 2 | All canonical URLs, OG image URLs, sitemap entries, and JSON-LD url fields use torchsecret.com domain | VERIFIED | `index.html` lines 19, 25, 26, 46 all show `torchsecret.com`; `sitemap.xml`: `<loc>https://torchsecret.com/</loc>`; `robots.txt`: `Sitemap: https://torchsecret.com/sitemap.xml` |
| 3 | No occurrence of "SecureShare" or "secureshare.example.com" remains in any active source file (outside .planning/milestones/ archive) | VERIFIED | Comprehensive grep across `client/` and `server/` returned zero results for `SecureShare\|secureshare\.example\.com` |
| 4 | Static files (index.html, sitemap.xml, robots.txt, site.webmanifest) hardcode torchsecret.com directly | VERIFIED | All four files confirmed: `index.html` canonical/OG/JSON-LD; `sitemap.xml` `<loc>`; `robots.txt` `Sitemap:`; `site.webmanifest` `"name": "Torch Secret"`, `"short_name": "Torch Secret"` |
| 5 | INVARIANTS.md and PROJECT.md title and brand references reflect Torch Secret | VERIFIED | `INVARIANTS.md` line 1: `# Torch Secret Invariants`; `PROJECT.md` line 1: `# Torch Secret`, line 20: `Torch Secret is a production-ready...` |

#### Plan 02 Truths (BRAND-03, BRAND-04, TECH-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | package.json name field reads "torch-secret" | VERIFIED | `package.json` line 2: `"name": "torch-secret"` |
| 7 | docker-compose.yml service names, container names, and env vars reflect Torch Secret brand | VERIFIED | `RESEND_FROM_EMAIL: 'Torch Secret <noreply@localhost>'`. Service names (`app`, `db`, `redis`) have no brand prefix to update. Postgres credentials intentionally preserved as infrastructure identifiers. |
| 8 | render.yaml service names, DB/Redis refs, and inline comments use torch-secret naming | VERIFIED | Service: `torch-secret`; DB: `torch-secret-db`; Redis: `torch-secret-redis`; `BETTER_AUTH_URL` comment: `torchsecret.onrender.com`; `RESEND_FROM_EMAIL` comment: "Torch Secret" |
| 9 | CI workflow test and e2e jobs include all required env vars with placeholder values that pass Zod validation | VERIFIED | Both `test` (lines 52-56) and `e2e` (lines 117-121) job blocks contain all five required vars: `BETTER_AUTH_SECRET` (49 chars, satisfies min(32)), `BETTER_AUTH_URL`, `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| 10 | Docker build in CI tags image as torch-secret:ci-test | VERIFIED | `ci.yml` line 178: `-t torch-secret:ci-test` |
| 11 | README H1 reads "Torch Secret" with live-site badge linking to torchsecret.com | VERIFIED | `README.md` line 1: `# Torch Secret`; line 4: live-site badge present |
| 12 | Lucide upgraded to 0.575.0; alias removed if ESM entry point is fixed | VERIFIED | `package.json`: `"lucide": "^0.575.0"`; `vite.config.ts` has no `resolve.alias` block — alias removed successfully |
| 13 | server/src/config/env.ts APP_URL has a `.default('http://localhost:3000')` fallback | VERIFIED | `env.ts` line 21: `APP_URL: z.string().url().default('http://localhost:3000')` |

#### Plan 03 Truths (TECH-02, TECH-03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 14a | GET /privacy and GET /terms return X-Robots-Tag: noindex, nofollow response header | VERIFIED (code path) | `app.ts` NOINDEX_PREFIXES array includes `'/privacy'` (line 118) and `'/terms'` (line 119); `res.setHeader('X-Robots-Tag', 'noindex, nofollow')` at line 122 fires when `req.path.startsWith(prefix)` — wiring complete |
| 14b | schema.ts zero-knowledge comment lists all 7 enforcement points matching INVARIANTS.md | VERIFIED | All 7 bullet points confirmed: DB-secrets, DB-users, Logger, Analytics/PostHog, Logger-dashboard-route, Email/Resend, Rate-limits+prompts. Count verified with grep: returns 7. |
| 14c | ROADMAP.md Phase 31 success criterion #5 reads "7 enforcement points", not "6" | VERIFIED | `ROADMAP.md` line 99: `"lists all 7 enforcement points matching the canonical list in INVARIANTS.md"` |
| 14d | REQUIREMENTS.md TECH-03 description updated to reflect 7 (not 6) enforcement points | VERIFIED | `REQUIREMENTS.md` line 70: `canonical 7-point list`; no `"6 enforcement"` or `"6-point"` in either file |

#### Plan 04 Truth (BRAND-03 — gap closure)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 15 | All text in the protection panel is visible when light theme is active; semantic color tokens used throughout | VERIFIED | Commit `a5dd681` landed in `client/src/pages/create.ts`: zero `text-white/` or `border-white/` occurrences remain in file. Lines 275, 290, 301, 303, 356, 371, 436, 559, 779 all now use semantic tokens. Confirmed: `text-text-secondary` (lines 275, 301, 303, 371), `text-text-muted` (lines 301, 356, 436, 559, 779), `text-text-primary` (line 303), `border-border` (line 290). |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/index.html` | HTML title, OG tags, JSON-LD, canonical with Torch Secret / torchsecret.com | VERIFIED | 8+ occurrences confirmed: title, canonical, OG/Twitter tags, JSON-LD name+url, noscript text |
| `client/src/components/layout.ts` | Header wordmark "Torch Secret" | VERIFIED | Line 65: `wordmark.textContent = 'Torch Secret'` |
| `client/public/sitemap.xml` | Updated sitemap domain | VERIFIED | `<loc>https://torchsecret.com/</loc>` |
| `client/public/robots.txt` | Updated sitemap URL | VERIFIED | `Sitemap: https://torchsecret.com/sitemap.xml` |
| `client/public/site.webmanifest` | Updated name/short_name | VERIFIED | `"name": "Torch Secret"`, `"short_name": "Torch Secret"` |
| `server/src/auth.ts` | Updated email subjects | VERIFIED | "Reset your Torch Secret password", "Verify your Torch Secret email" |
| `.planning/INVARIANTS.md` | Updated active planning doc | VERIFIED | Title: "# Torch Secret Invariants", prose updated throughout |
| `.planning/PROJECT.md` | Updated active planning doc | VERIFIED | H1 and line 20 product description both read "Torch Secret" |
| `package.json` | Updated package name | VERIFIED | `"name": "torch-secret"` |
| `.github/workflows/ci.yml` | CI env vars for integration tests | VERIFIED | All 5 required env vars in both test and e2e job blocks |
| `README.md` | Updated project README | VERIFIED | H1 "Torch Secret", live-site badge |
| `server/src/config/env.ts` | APP_URL with local-dev default | VERIFIED | `.default('http://localhost:3000')` |
| `server/src/app.ts` | Extended NOINDEX_PREFIXES array | VERIFIED | Contains `'/privacy'` and `'/terms'` |
| `server/src/db/schema.ts` | Updated ZK enforcement comment | VERIFIED | 7-point list present, matches INVARIANTS.md canonical table |
| `.planning/ROADMAP.md` | Corrected success criterion count | VERIFIED | "7 enforcement points" in criterion #5 |
| `client/src/pages/create.ts` | Semantic color tokens in protection panel | VERIFIED | Zero `text-white/` or `border-white/` remain; all 9 class strings replaced with semantic tokens |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/router.ts` | `document.title` and OG meta tags | `updateMeta()` calls with brand strings | WIRED | 13 occurrences of "Torch Secret" in router.ts across document.title and OG/Twitter tag content updates |
| `server/src/auth.ts` | Resend email subjects | `sendEmail()` calls | WIRED | Lines 76 and 88 contain "Torch Secret" in email subject strings |
| `.github/workflows/ci.yml` | `server/src/config/env.ts` | env vars matching Zod EnvSchema required fields | WIRED | All Zod-required fields present in both test and e2e job env blocks |
| `server/src/config/env.ts` | APP_URL default | Zod `.default()` fallback | WIRED | `z.string().url().default('http://localhost:3000')` — APP_URL is always `string` (never `undefined`) |
| `server/src/app.ts` | NOINDEX_PREFIXES middleware | `res.setHeader('X-Robots-Tag', 'noindex, nofollow')` | WIRED | Array extended with `'/privacy'` and `'/terms'`; existing `if (NOINDEX_PREFIXES.some(...))` block fires on match |
| `server/src/db/schema.ts` | `.planning/INVARIANTS.md` | Inline comment listing enforcement points | WIRED | 7-point list in schema.ts comment matches the canonical INVARIANTS.md table exactly |
| `client/src/pages/create.ts` | `client/src/styles.css` | Tailwind utility classes referencing `--ds-color-text-*` CSS custom properties | WIRED | `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border` all reference design-token custom properties defined in styles.css |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRAND-01 | Plan 01 | App name "Torch Secret" in all user-facing locations | SATISFIED | HTML title, OG tags, header wordmark, email subjects all verified |
| BRAND-02 | Plan 01 | All canonical URLs use torchsecret.com domain | SATISFIED | index.html, sitemap.xml, robots.txt, JSON-LD all verified |
| BRAND-03 | Plans 02 + 04 | README updated with "Torch Secret" and torchsecret.com live site link; protection panel readable in light theme | SATISFIED | README.md H1 + live-site badge verified; semantic token fix in create.ts verified |
| BRAND-04 | Plan 02 | CI workflow, Docker Compose, package.json updated | SATISFIED | All three artifacts verified |
| TECH-01 | Plan 02 | CI workflow has placeholder env vars for integration tests | SATISFIED | All 5 required vars in both job blocks verified |
| TECH-02 | Plan 03 | /privacy and /terms in NOINDEX_PREFIXES for X-Robots-Tag header | SATISFIED | app.ts array and setHeader wiring verified |
| TECH-03 | Plan 03 | schema.ts ZK comment updated to canonical 7-point list | SATISFIED | 7 enforcement points confirmed; REQUIREMENTS.md and ROADMAP.md counts corrected |

No orphaned requirements found. All 7 requirement IDs are claimed by a plan and verified in the codebase.

---

### Anti-Patterns Found

None blocking. All examined files are substantive and wired.

One harmless dead branch noted: `server/src/auth.ts` line 16 contains `if (!env.APP_URL) return url;` — this guard is now permanently false because `APP_URL` always has a `.default()` in env.ts. This is a stale defensive check, not a blocker.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/src/auth.ts` | 16 | `if (!env.APP_URL)` dead branch | Info | None — guard is unreachable but harmless; `toAppUrl()` always evaluates the URL rewrite path |

---

### Human Verification Required

The following item cannot be verified programmatically because it requires a running server:

**1. X-Robots-Tag header on /privacy and /terms**

**Test:** Start the server (`npm run dev:server`) and run: `curl -s -I http://localhost:3000/privacy | grep -i x-robots` and `curl -s -I http://localhost:3000/terms | grep -i x-robots`
**Expected:** Both responses include `X-Robots-Tag: noindex, nofollow`
**Why human:** The server-side middleware path requires a running Express instance. The code path is correct (array + header call both verified), but end-to-end confirmation needs a live server.

**2. Light-theme protection panel text legibility**

**Test:** Start the app, switch to light theme via the theme toggle, navigate to the create page, and click through all four protection tabs (No protection, Generate password, Custom password, Passphrase).
**Expected:** All tab labels, note text, strength labels, entropy lines, and helper text are legible (dark text on light background — not invisible white-on-white).
**Why human:** Visual contrast requires a running browser. The code change (semantic tokens replacing hardcoded white opacity classes) is verified, but pixel-level legibility confirmation requires human review. UAT test 3 that originally flagged this issue was closed as `resolved` after Plan 04 executed.

---

### Commit Verification

All commits documented in SUMMARY files confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `8509e4c` | 01-T1 | Rename brand in user-facing HTML, pages, and static files |
| `7312e57` | 01-T2 | Rename brand in comment-only client source files |
| `875f878` | 01-T3 | Rename brand in server sources and developer-facing files |
| `8d812ec` | 02-T1 | Rebrand infrastructure files; add CI env vars; APP_URL default |
| `03da3a9` | 02-T2 | Upgrade Lucide 0.575.0, remove alias, refresh README |
| `bfa2b57` | 03-T1 | Add /privacy and /terms to NOINDEX_PREFIXES |
| `8db4f05` | 03-T2 | Update ZK comment to 7 enforcement points; fix REQUIREMENTS.md |
| `a5dd681` | 04-T1 | Replace hardcoded white opacity classes with semantic tokens in protection panel |

---

### Summary

Phase 31 goal is fully achieved. The product is publicly named Torch Secret with torchsecret.com throughout every user-facing surface: HTML metadata, OG tags, JSON-LD, header wordmark, email subjects, static SEO files, web manifest, README, and all developer-facing configuration files.

All four tech debt items are cleared: CI env vars no longer cause Zod validation failures; /privacy and /terms receive the X-Robots-Tag noindex header from server middleware; the schema.ts zero-knowledge comment now lists all 7 enforcement points matching the canonical INVARIANTS.md table; and Lucide is upgraded to 0.575.0 with the stale vite.config.ts alias removed.

The UAT gap (invisible white-on-white text in the protection panel under light theme) was fixed in Plan 04 (commit `a5dd681`). All nine hardcoded `text-white/*` and `border-white/*` Tailwind classes in `createProtectionPanel` were replaced with semantic design-token classes (`text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`). Zero hardcoded white opacity classes remain in `create.ts`.

The only remaining `secureshare` strings in the codebase are: (a) postgres credentials (`POSTGRES_USER`, `POSTGRES_DB`, `DATABASE_URL`) intentionally preserved as infrastructure identifiers in docker-compose.yml and ci.yml; and (b) `norcalcoop/secureshare` GitHub URLs in README.md, intentionally preserved because repository rename is explicitly out of scope. Both are documented decisions, not gaps.

---

_Verified: 2026-02-22_
_Verifier: Claude (gsd-verifier)_
