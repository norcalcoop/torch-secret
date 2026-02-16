---
phase: 14-seo-router-integration
plan: 02
subsystem: api
tags: [express, x-robots-tag, seo, crawler-blocking, security-headers]

# Dependency graph
requires:
  - phase: 03-security-hardening
    provides: Express app factory with SPA catch-all and security headers
provides:
  - X-Robots-Tag HTTP header injection for /secret/* routes
  - Integration tests proving header presence/absence per route type
affects: [seo, security-headers, crawler-blocking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional HTTP header injection in SPA catch-all based on req.path"
    - "Self-contained SPA catch-all tests with temp client/dist setup/teardown"

key-files:
  created: []
  modified:
    - server/src/app.ts
    - server/src/routes/__tests__/security.test.ts

key-decisions:
  - "X-Robots-Tag set via req.path (not req.url) to avoid query string matching issues"
  - "Test suite creates temp client/dist/index.html in beforeAll for CI portability"

patterns-established:
  - "Conditional security headers in SPA catch-all: check req.path before res.send"
  - "SPA catch-all test pattern: create temp dist, build fresh app, cleanup in afterAll"

# Metrics
duration: 2min
completed: 2026-02-16
---

# Phase 14 Plan 02: Server-Side X-Robots-Tag Summary

**X-Robots-Tag: noindex, nofollow HTTP header for /secret/* routes as defense-in-depth crawler blocking**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-16T17:44:25Z
- **Completed:** 2026-02-16T17:46:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Secret routes (/secret/*) now return X-Robots-Tag: noindex, nofollow HTTP header
- Non-secret routes (homepage, /about, etc.) are unaffected -- no X-Robots-Tag header
- Three integration tests verify positive and negative header behavior
- Tests are self-contained: create temp client/dist if missing for CI environments

## Task Commits

Each task was committed atomically:

1. **Task 1: Add X-Robots-Tag header to SPA catch-all for secret routes** - `9c6f912` (feat)
2. **Task 2: Add integration tests for X-Robots-Tag header behavior** - `31a7420` (test)

## Files Created/Modified
- `server/src/app.ts` - Added conditional X-Robots-Tag header in SPA catch-all for /secret/* paths
- `server/src/routes/__tests__/security.test.ts` - Added 3 integration tests for X-Robots-Tag presence/absence

## Decisions Made
- Used `req.path` instead of `req.url` for the secret route check to avoid query string false positives
- Tests create a temporary `client/dist/index.html` in `beforeAll` and clean up in `afterAll` to ensure the SPA catch-all is active regardless of whether the client has been built

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side X-Robots-Tag complements Plan 01's client-side noindex meta tag for defense-in-depth
- Combined with robots.txt Disallow for /secret/ (Phase 10), secret routes now have three layers of crawler protection
- Phase 14 complete: both client-side and server-side SEO measures in place

## Self-Check: PASSED

- FOUND: 14-02-SUMMARY.md
- FOUND: 9c6f912 (Task 1 commit)
- FOUND: 31a7420 (Task 2 commit)

---
*Phase: 14-seo-router-integration*
*Completed: 2026-02-16*
