---
phase: 03-security-hardening
plan: 02
subsystem: testing
tags: [integration-tests, security-tests, csp, rate-limiting, hsts, cors, referrer-policy, vitest, supertest]

# Dependency graph
requires:
  - phase: 03-security-hardening
    plan: 01
    provides: Security middleware (CSP nonce, helmet, rate limiter, HTTPS redirect) wired into Express app
provides:
  - Integration tests proving all 5 Phase 3 success criteria
  - Regression safety net for CSP, rate limiting, HSTS, Referrer-Policy, and CORS
affects: [04-frontend-create-and-reveal, 05-password-protection]

# Tech tracking
tech-stack:
  added: []
  patterns: [fresh-app-per-rate-limit-test, environment-conditional-assertions, supertest-header-assertions]

key-files:
  created:
    - server/src/routes/__tests__/security.test.ts
  modified: []

key-decisions:
  - "draft-7 rate limit header is combined 'RateLimit' (not 'RateLimit-Limit') -- assertion adjusted accordingly"
  - "HSTS test uses environment-conditional assertion: verify disabled in test/dev, document production behavior"
  - "Rate limit tests use isolated buildApp() instances to prevent counter bleed from shared app"

patterns-established:
  - "Security test isolation: each rate-limit describe block creates its own app instance via buildApp()"
  - "Environment-conditional test assertions: branch on NODE_ENV to verify correct behavior in each environment"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 3 Plan 2: Security Integration Tests Summary

**14 integration tests verifying CSP nonce uniqueness, rate limiting at 10-request boundary, HSTS/HTTPS conditionals, Referrer-Policy, and same-origin CORS enforcement**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T15:24:05Z
- **Completed:** 2026-02-14T15:26:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- 14 new tests covering all 5 Phase 3 success criteria
- CSP nonce-based script-src and style-src verified, with uniqueness across requests
- Rate limiter boundary tested at exactly 10 POST requests (11th returns 429)
- GET requests confirmed exempt from rate limiting (15 consecutive GETs, none 429)
- Referrer-Policy verified as 'no-referrer' on both POST and GET responses
- Cross-origin and preflight CORS requests confirmed to receive no CORS headers
- Full suite: 115 tests pass (101 existing + 14 new), zero failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create security integration tests** - `62368cc` (test)

## Files Created/Modified
- `server/src/routes/__tests__/security.test.ts` - 14 integration tests for all 5 Phase 3 success criteria (CSP, rate limiting, HSTS, Referrer-Policy, CORS)

## Decisions Made
- **draft-7 RateLimit header:** express-rate-limit with `standardHeaders: 'draft-7'` sends a combined `RateLimit` header (not `RateLimit-Limit` or `RateLimit-*`). Test assertion adjusted from `ratelimit-limit` to `ratelimit`.
- **HSTS environment-conditional assertion:** Since HSTS is disabled in non-production by design (03-01 decision), the test branches on `NODE_ENV` -- verifying HSTS is absent in test/dev and documenting that production would enable it.
- **Rate limit test isolation:** Each rate-limit test creates its own `buildApp()` instance, ensuring a fresh MemoryStore and zero counter bleed from other test blocks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed rate limit header name assertion**
- **Found during:** Task 1 (create security integration tests)
- **Issue:** Plan specified `ratelimit-limit` header for draft-7 standard headers. However, express-rate-limit 8.x with `standardHeaders: 'draft-7'` sends a single combined `RateLimit` header (lowercase `ratelimit` in supertest), not separate `RateLimit-Limit` / `RateLimit-Remaining` headers.
- **Fix:** Changed assertion from `res.headers['ratelimit-limit']` to `res.headers['ratelimit']`
- **Files modified:** `server/src/routes/__tests__/security.test.ts`
- **Verification:** All 115 tests pass
- **Committed in:** `62368cc` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor header name correction. No scope change.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 3 is now fully complete (Plan 1: middleware, Plan 2: tests)
- All 5 success criteria verified with integration tests
- Ready to proceed to Phase 4: Frontend Create and Reveal
- CSP nonce available in `res.locals.cspNonce` for frontend HTML templates
- Rate limiter, CORS, and security headers will protect the frontend endpoints

## Self-Check: PASSED

- FOUND: `server/src/routes/__tests__/security.test.ts` (252 lines, exceeds 80 minimum)
- FOUND: `.planning/phases/03-security-hardening/03-02-SUMMARY.md`
- FOUND: commit `62368cc` (Task 1) verified in git log
- All 115 tests pass (101 existing + 14 new)

---
*Phase: 03-security-hardening*
*Completed: 2026-02-14*
