---
phase: 31-rebrand-tech-debt
plan: "01"
subsystem: ui
tags: [rebrand, seo, branding, html, typescript, email]

# Dependency graph
requires: []
provides:
  - "Torch Secret brand applied to all user-facing HTML titles, OG tags, and JSON-LD"
  - "torchsecret.com domain in all static SEO files (sitemap.xml, robots.txt, index.html)"
  - "Torch Secret brand in email subjects (password reset, email verify, secret viewed)"
  - "Torch Secret brand in header wordmark and all in-app text strings"
  - "Torch Secret brand in file-level comments across crypto/, analytics/, and app entrypoints"
  - "Active planning docs (INVARIANTS.md, PROJECT.md) updated to Torch Secret"
  - "CLAUDE.md project overview updated to Torch Secret"
  - "Developer-facing files (CONTRIBUTING.md, SECURITY.md, .env.example) updated"
affects:
  - 31-02-rebrand-infra
  - 31-03-tech-debt
  - all future phases using brand strings

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - client/index.html
    - client/src/router.ts
    - client/src/components/layout.ts
    - client/src/pages/confirmation.ts
    - client/src/pages/terms.ts
    - client/src/pages/privacy.ts
    - client/public/robots.txt
    - client/public/sitemap.xml
    - client/public/site.webmanifest
    - client/src/analytics/posthog.ts
    - client/src/api/client.ts
    - client/src/app.ts
    - client/src/crypto/encrypt.ts
    - client/src/crypto/keys.ts
    - client/src/crypto/encoding.ts
    - client/src/crypto/decrypt.ts
    - client/src/crypto/index.ts
    - client/src/crypto/types.ts
    - client/src/crypto/constants.ts
    - server/src/auth.ts
    - server/src/services/notification.service.ts
    - server/src/services/notification.service.test.ts
    - server/src/server.ts
    - scripts/screenshots.ts
    - .github/ISSUE_TEMPLATE/feature-request.yml
    - .planning/INVARIANTS.md
    - .planning/PROJECT.md
    - .env.example
    - CONTRIBUTING.md
    - SECURITY.md
    - CLAUDE.md
    - e2e/fixtures/test.ts

key-decisions:
  - "Static files (index.html, sitemap.xml, robots.txt) hardcode torchsecret.com directly — correct because they are served as-is and cannot read runtime env vars"
  - "TypeScript interface names (e.g. SecureShareFixtures) are code identifiers, not brand strings — left unchanged"
  - ".planning/milestones/ archive files excluded from rebrand per plan specification"
  - "PROJECT.md checklist lines describing the rebrand task left as-is (task descriptions, not brand strings)"

patterns-established: []

requirements-completed:
  - BRAND-01
  - BRAND-02

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 31 Plan 01: Brand Rename (SecureShare -> Torch Secret) Summary

**Global find-and-replace of "SecureShare" and "secureshare.example.com" with "Torch Secret" and "torchsecret.com" across 32 active source files — HTML, TypeScript, static assets, email subjects, and planning docs**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T19:59:01Z
- **Completed:** 2026-02-22T20:07:00Z
- **Tasks:** 3
- **Files modified:** 32

## Accomplishments
- All user-facing HTML titles, OG tags, Twitter tags, JSON-LD, and noscript text updated to "Torch Secret"
- All static SEO files (sitemap.xml, robots.txt) and index.html canonical/OG URLs updated to torchsecret.com
- Email subjects for password reset, email verification, and secret-viewed notification updated
- Header wordmark in layout shell, share button title, and in-app page text updated
- All file-level JSDoc comments in crypto/, analytics/, and app entrypoints updated
- Active planning docs (INVARIANTS.md, PROJECT.md product description, CLAUDE.md overview) updated
- Developer-facing docs (CONTRIBUTING.md, SECURITY.md, .env.example) updated
- APP_URL comment block in .env.example updated to reference torchsecret.com production URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename brand strings in user-facing HTML, TypeScript pages, and static files** - `8509e4c` (feat)
2. **Task 2: Rename brand in comment-only client source files (crypto, analytics, app entrypoints)** - `7312e57` (feat)
3. **Task 3: Rename brand in server sources, CONTRIBUTING.md, SECURITY.md, issue template, scripts, INVARIANTS.md, PROJECT.md, and .env.example** - `875f878` (feat)

## Files Created/Modified
- `client/index.html` - 12 occurrences updated: title, canonical, OG tags, JSON-LD, noscript
- `client/src/router.ts` - document.title template and all OG/Twitter tag content strings
- `client/src/components/layout.ts` - header wordmark textContent and comment
- `client/src/pages/confirmation.ts` - share button title parameter
- `client/src/pages/terms.ts` - 4 SecureShare prose references in terms body
- `client/src/pages/privacy.ts` - 2 SecureShare references (JSDoc comment + "Who We Are" section)
- `client/public/robots.txt` - sitemap URL updated to torchsecret.com
- `client/public/sitemap.xml` - loc entry updated to torchsecret.com
- `client/public/site.webmanifest` - name and short_name fields
- `client/src/analytics/posthog.ts` - module header comment
- `client/src/api/client.ts` - fetch wrapper description comment
- `client/src/app.ts` - entry point description comment
- `client/src/crypto/*.ts` (7 files) - file-level JSDoc comments only
- `server/src/auth.ts` - two email subject strings
- `server/src/services/notification.service.ts` - email subject and body text
- `server/src/services/notification.service.test.ts` - test expectation updated to match new subject
- `server/src/server.ts` - startup log message
- `scripts/screenshots.ts` - file comment and sample message string
- `.github/ISSUE_TEMPLATE/feature-request.yml` - feature request description
- `.planning/INVARIANTS.md` - document title and core promise prose
- `.planning/PROJECT.md` - product description (line 20)
- `.env.example` - RESEND_FROM_EMAIL sender name and APP_URL comment block
- `CONTRIBUTING.md` - 3 prose references (title, testing section, license clause)
- `SECURITY.md` - 3 prose references
- `CLAUDE.md` - project overview description
- `e2e/fixtures/test.ts` - file-level comment

## Decisions Made
- Static files (index.html, sitemap.xml, robots.txt) hardcode `torchsecret.com` directly — these are served as-is and cannot access runtime env vars; this is intentional per RESEARCH.md guidance
- The `SecureShareFixtures` TypeScript interface name in e2e/fixtures/test.ts was left as-is — it is a code identifier, not a user-facing brand string
- `.planning/milestones/` archive files were not modified — they are read-only historical records per plan specification
- PROJECT.md checklist lines (77-78, 121) documenting the rebrand task were not changed — they accurately describe the work being done and are not brand strings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed failing test assertion in notification.service.test.ts**
- **Found during:** Task 3 (server sources rename)
- **Issue:** `notification.service.test.ts` line 42 expected the old email subject `'Your SecureShare secret was viewed'` after the notification service was renamed to use `'Your Torch Secret secret was viewed'`
- **Fix:** Updated test expectation to match new subject string
- **Files modified:** `server/src/services/notification.service.test.ts`
- **Verification:** Test assertion now matches actual email subject produced by the service
- **Committed in:** `875f878` (Task 3 commit)

**2. [Rule 2 - Scope Extension] Updated CLAUDE.md and e2e/fixtures/test.ts**
- **Found during:** Final audit verification
- **Issue:** These files were not in the plan's explicit file list, but contain "SecureShare" text that would violate the must_have truth "No occurrence of 'SecureShare' remains in any active source file"
- **Fix:** Updated project overview in CLAUDE.md and file-level comment in e2e/fixtures/test.ts
- **Files modified:** `CLAUDE.md`, `e2e/fixtures/test.ts`
- **Committed in:** `875f878` (Task 3 commit, included with minimal additional scope)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 scope extension)
**Impact on plan:** Both fixes ensure complete rebrand coverage. No functional behavior changed.

## Issues Encountered
None — all replacements were straightforward string substitutions. No TypeScript errors introduced. Pre-commit hooks (ESLint + Prettier) passed for all three task commits.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Torch Secret brand is fully applied across all active source files
- All email subjects, HTML metadata, static SEO files, and planning docs consistent
- Ready for 31-02 (infrastructure rebrand) and 31-03 (tech debt) — though those were executed concurrently in the same session
- Post-rebrand grep audit is clean for all served/compiled output files

---
*Phase: 31-rebrand-tech-debt*
*Completed: 2026-02-22*
