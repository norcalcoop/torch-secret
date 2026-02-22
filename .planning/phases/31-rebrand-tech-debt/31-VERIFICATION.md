---
phase: 31-rebrand-tech-debt
verified: 2026-02-22T21:00:00Z
status: passed
score: 14/14 must-haves verified
---

# Phase 31: Rebrand + Tech Debt Verification Report

**Phase Goal:** The product is publicly named Torch Secret with torchsecret.com throughout every user-facing surface, and four known tech debt items are cleared before any new feature code is written
**Verified:** 2026-02-22
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the three plan `must_haves` blocks (Plans 01, 02, and 03).

#### Plan 01 Truths (BRAND-01, BRAND-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every HTML `<title>`, OG tag, header logo text, and email sender string reads "Torch Secret", not "SecureShare" | VERIFIED | `client/index.html` line 20: `Torch Secret - Share Secrets Securely`; layout.ts line 65: `'Torch Secret'`; auth.ts lines 76, 88: `'Reset/Verify your Torch Secret ...'`; notification.service.ts line 24: `'Your Torch Secret secret was viewed'` |
| 2 | All canonical URLs, OG image URLs, sitemap entries, and JSON-LD url fields use torchsecret.com domain | VERIFIED | index.html lines 19, 25, 26, 46 all show `torchsecret.com`; sitemap.xml: `<loc>https://torchsecret.com/</loc>`; robots.txt: `Sitemap: https://torchsecret.com/sitemap.xml` |
| 3 | No occurrence of "SecureShare" or "secureshare.example.com" remains in any active source file (outside .planning/milestones/ archive) | VERIFIED | Comprehensive grep across all non-archive source files returned zero results. README retains `norcalcoop/secureshare` only in GitHub infrastructure URLs (intentional — repo rename out of scope per RESEARCH.md) |
| 4 | Static files (index.html, sitemap.xml, robots.txt, site.webmanifest) hardcode torchsecret.com directly | VERIFIED | All four files verified: index.html canonical/OG/JSON-LD; sitemap.xml `<loc>`; robots.txt `Sitemap:`; site.webmanifest `"name": "Torch Secret"`, `"short_name": "Torch Secret"` |
| 5 | INVARIANTS.md and PROJECT.md title and brand references reflect Torch Secret | VERIFIED | INVARIANTS.md line 1: `# Torch Secret Invariants`; PROJECT.md line 1: `# Torch Secret`, line 20: `Torch Secret is a production-ready...` |

#### Plan 02 Truths (BRAND-03, BRAND-04, TECH-01)

| # | Truth | Status | Evidence |
|---|--------|--------|----------|
| 6 | package.json name field reads "torch-secret" | VERIFIED | `package.json` line 2: `"name": "torch-secret"` |
| 7 | docker-compose.yml service names, container names, and env vars reflect Torch Secret brand | VERIFIED | `RESEND_FROM_EMAIL: 'Torch Secret <noreply@localhost>'`. Service names (`app`, `db`, `redis`) have no brand prefix to update. Postgres credentials intentionally preserved as infrastructure identifiers. |
| 8 | render.yaml service names, DB/Redis refs, and inline comments use torch-secret naming | VERIFIED | Service: `torch-secret`; DB: `torch-secret-db`; Redis: `torch-secret-redis`; BETTER_AUTH_URL comment: `torchsecret.onrender.com`; RESEND_FROM_EMAIL comment: "Torch Secret" |
| 9 | CI workflow test and e2e jobs include all required env vars with placeholder values that pass Zod validation | VERIFIED | Both `test` (line 52-56) and `e2e` (line 117-121) job blocks contain all five required vars: `BETTER_AUTH_SECRET` (49 chars, satisfies min(32)), `BETTER_AUTH_URL`, `APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| 10 | Docker build in CI tags image as torch-secret:ci-test | VERIFIED | ci.yml line 178: `-t torch-secret:ci-test` |
| 11 | README H1 reads "Torch Secret" with live-site badge linking to torchsecret.com | VERIFIED | README.md line 1: `# Torch Secret`; line 4: `[![Live](https://img.shields.io/badge/live-torchsecret.com-orange)](https://torchsecret.com)` |
| 12 | Lucide upgraded to 0.575.0; alias removed if ESM entry point is fixed | VERIFIED | package.json: `"lucide": "^0.575.0"`; vite.config.ts has no `resolve.alias` block — alias removed successfully |
| 13 | server/src/config/env.ts APP_URL has a `.default('http://localhost:3000')` fallback | VERIFIED | env.ts line 21: `APP_URL: z.string().url().default('http://localhost:3000')` |

#### Plan 03 Truths (TECH-02, TECH-03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 14 (a) | GET /privacy and GET /terms return X-Robots-Tag: noindex, nofollow response header | VERIFIED (automated) | app.ts NOINDEX_PREFIXES array includes `'/privacy'` (line 118) and `'/terms'` (line 119); `res.setHeader('X-Robots-Tag', 'noindex, nofollow')` at line 122 fires when `req.path.startsWith(prefix)` — wiring is complete |
| 14 (b) | schema.ts zero-knowledge comment lists all 7 enforcement points matching INVARIANTS.md | VERIFIED | All 7 bullet points confirmed present in schema.ts lines 16-22. Count verified with grep: returns 7. |
| 14 (c) | ROADMAP.md Phase 31 success criterion #5 reads "7 enforcement points", not "6" | VERIFIED | ROADMAP.md line 99: `"lists all 7 enforcement points matching the canonical list in INVARIANTS.md"` |
| 14 (d) | REQUIREMENTS.md TECH-03 description updated to reflect 7 (not 6) enforcement points | VERIFIED | REQUIREMENTS.md line 70: `canonical 7-point list`; grep for "6 enforcement\|6-point" returns zero results in both files |

**Score:** 14/14 truths verified (Plan 01: 5/5, Plan 02: 8/8, Plan 03: 4/4 sub-items counting as truth 14)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/index.html` | HTML title, OG tags, JSON-LD, canonical with Torch Secret / torchsecret.com | VERIFIED | 12 occurrences updated: title, canonical, all OG/Twitter tags, JSON-LD name+url, noscript text |
| `client/src/components/layout.ts` | Header wordmark "Torch Secret" | VERIFIED | Line 65: `wordmark.textContent = 'Torch Secret'` |
| `client/public/sitemap.xml` | Updated sitemap domain | VERIFIED | `<loc>https://torchsecret.com/</loc>` |
| `client/public/robots.txt` | Updated sitemap URL | VERIFIED | `Sitemap: https://torchsecret.com/sitemap.xml` |
| `server/src/auth.ts` | Updated email subjects | VERIFIED | "Reset your Torch Secret password", "Verify your Torch Secret email" |
| `.planning/INVARIANTS.md` | Updated active planning doc | VERIFIED | Title: "# Torch Secret Invariants", prose updated throughout |
| `.planning/PROJECT.md` | Updated active planning doc | VERIFIED | H1 and line 20 product description both read "Torch Secret" |
| `package.json` | Updated package name | VERIFIED | `"name": "torch-secret"` |
| `.github/workflows/ci.yml` | CI env vars for integration tests | VERIFIED | All 5 required env vars in both test and e2e job blocks |
| `README.md` | Updated project README | VERIFIED | H1 "Torch Secret", live-site badge, v4.0 tech stack sections |
| `docker-compose.yml` | Updated service names / env vars | VERIFIED | `RESEND_FROM_EMAIL` updated; no brand-prefixed service names existed to rename |
| `server/src/config/env.ts` | APP_URL with local-dev default | VERIFIED | `.default('http://localhost:3000')` |
| `server/src/app.ts` | Extended NOINDEX_PREFIXES array | VERIFIED | Contains `'/privacy'` and `'/terms'` |
| `server/src/db/schema.ts` | Updated ZK enforcement comment | VERIFIED | 7-point list present, matches INVARIANTS.md canonical table |
| `.planning/ROADMAP.md` | Corrected success criterion count | VERIFIED | "7 enforcement points" in criterion #5 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/src/router.ts` | `document.title` and OG meta tags | `updateMeta()` calls with brand strings | WIRED | 14 occurrences of "Torch Secret" found in router.ts across document.title assignments and OG/Twitter tag content updates |
| `server/src/auth.ts` | Resend email subjects | `sendEmail()` calls | WIRED | Lines 76 and 88 contain "Torch Secret" in email subject strings passed to email delivery |
| `.github/workflows/ci.yml` | `server/src/config/env.ts` | env vars matching Zod EnvSchema required fields | WIRED | All Zod-required fields (`BETTER_AUTH_SECRET` min(32), `BETTER_AUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`) present in both test and e2e job env blocks |
| `server/src/config/env.ts` | APP_URL default | Zod `.default()` fallback | WIRED | `z.string().url().default('http://localhost:3000')` — APP_URL is always a `string` (never `undefined`) in the `Env` type |
| `server/src/app.ts` | NOINDEX_PREFIXES middleware | `res.setHeader('X-Robots-Tag', 'noindex, nofollow')` | WIRED | Array extended with `'/privacy'` and `'/terms'`; existing `if (NOINDEX_PREFIXES.some(...))` block fires the header on match |
| `server/src/db/schema.ts` | `.planning/INVARIANTS.md` | Inline comment listing enforcement points | WIRED | 7-point list in schema.ts comment matches the canonical INVARIANTS.md table exactly |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRAND-01 | Plan 01 | App name "Torch Secret" in all user-facing locations | SATISFIED | HTML title, OG tags, header wordmark, email subjects all verified |
| BRAND-02 | Plan 01 | All canonical URLs use torchsecret.com domain | SATISFIED | index.html, sitemap.xml, robots.txt, JSON-LD all verified |
| BRAND-03 | Plan 02 | README updated with "Torch Secret" and torchsecret.com live site link | SATISFIED | README.md H1 + live-site badge verified |
| BRAND-04 | Plan 02 | CI workflow, Docker Compose, package.json updated | SATISFIED | All three artifacts verified |
| TECH-01 | Plan 02 | CI workflow has placeholder env vars for integration tests | SATISFIED | All 5 required vars in both job blocks verified |
| TECH-02 | Plan 03 | /privacy and /terms in NOINDEX_PREFIXES for X-Robots-Tag header | SATISFIED | app.ts array and setHeader wiring verified |
| TECH-03 | Plan 03 | schema.ts ZK comment updated to canonical 7-point list | SATISFIED | 7 enforcement points confirmed; REQUIREMENTS.md and ROADMAP.md counts corrected |

No orphaned requirements found. All 7 requirement IDs are claimed by a plan and verified in the codebase.

---

### Anti-Patterns Found

None blocking. All examined files are substantive and wired.

One harmless dead branch noted: `server/src/auth.ts` line 16 contains `if (!env.APP_URL) return url;` — this guard is now permanently false because `APP_URL` always has a `.default()` in env.ts. This is a stale defensive check, not a blocker. No user-facing behavior is affected.

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

---

### Commit Verification

All 7 commits documented in SUMMARY files confirmed present in git log:

| Commit | Plan | Description |
|--------|------|-------------|
| `8509e4c` | 01-T1 | Rename brand in user-facing HTML, pages, and static files |
| `7312e57` | 01-T2 | Rename brand in comment-only client source files |
| `875f878` | 01-T3 | Rename brand in server sources and developer-facing files |
| `8d812ec` | 02-T1 | Rebrand infrastructure files; add CI env vars; APP_URL default |
| `03da3a9` | 02-T2 | Upgrade Lucide 0.575.0, remove alias, refresh README |
| `bfa2b57` | 03-T1 | Add /privacy and /terms to NOINDEX_PREFIXES |
| `8db4f05` | 03-T2 | Update ZK comment to 7 enforcement points; fix REQUIREMENTS.md |

---

### Summary

Phase 31 goal is fully achieved. The product is publicly named Torch Secret with torchsecret.com throughout every user-facing surface: HTML metadata, OG tags, JSON-LD, header wordmark, email subjects, static SEO files, web manifest, README, and all developer-facing configuration files. All four tech debt items are cleared: CI env vars no longer cause Zod validation failures, /privacy and /terms receive the X-Robots-Tag noindex header from server middleware, the schema.ts zero-knowledge comment now lists all 7 enforcement points matching the canonical INVARIANTS.md table, and Lucide is upgraded to 0.575.0 with the stale vite.config.ts alias removed.

The only remaining `secureshare` strings in the codebase are: (a) postgres credentials (`POSTGRES_USER`, `POSTGRES_DB`, `DATABASE_URL`) intentionally preserved as infrastructure identifiers in docker-compose.yml and ci.yml; and (b) `norcalcoop/secureshare` GitHub URLs in README.md, intentionally preserved because repository rename is explicitly out of scope. Both are documented decisions, not gaps.

---

_Verified: 2026-02-22_
_Verifier: Claude (gsd-verifier)_
