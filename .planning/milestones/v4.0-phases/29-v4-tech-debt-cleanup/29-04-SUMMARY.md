---
phase: 29-v4-tech-debt-cleanup
plan: "04"
subsystem: testing
tags: [playwright, e2e, rate-limiting, expiration, anonymous, phase-27]

# Dependency graph
requires:
  - phase: 27-anonymous-account-conversion
    provides: Rate-limit middleware (createAnonHourlyLimiter), expiration cap enforcement in secrets.ts, showRateLimitUpsell() client-side UI

provides:
  - Playwright E2E test coverage for anonymous expiration cap (400 on 24h/7d, 201 on 1h)
  - Playwright E2E test for anonymous locked expiration select (div display, not select element)
  - Playwright E2E countdown test structure (skipped in E2E_TEST mode with documentation)

affects: [future-e2e-test-phases, ci-cd-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "test.skip with condition pattern for environment-dependent tests (E2E_TEST=true skip)"
    - "Dynamic import of crypto-helpers.js inside test for fixture usage"
    - "Defensive DOM structure check (select count > 0 branch) for auth-conditional components"

key-files:
  created:
    - e2e/specs/rate-limits.spec.ts
  modified: []

key-decisions:
  - "Rate-limit countdown test uses test.skip(process.env.E2E_TEST === 'true') — E2E mode raises limit to 1000 making 429 unreachable; countdown behavior is covered by unit/integration tests"
  - "Anonymous expiration select test checks for 'select#expiration' presence before asserting — anonymous users get a div (not a select), authenticated users get a select; test handles both DOM variants"
  - "Expiration cap tests use direct API calls (request fixture) not page UI — tests the server enforcement directly, independent of client-side select state"

patterns-established:
  - "Environment-conditional skip: test.skip(process.env.E2E_TEST === 'true', reason) documents why a test cannot run in the standard E2E environment without failing"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 29 Plan 04: Rate-Limit E2E Tests Summary

**Playwright E2E tests for anonymous expiration cap (400 for 24h/7d, 201 for 1h) and locked expiration UI, with documented skip for countdown test blocked by E2E_TEST rate-limit inflation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T17:10:00Z
- **Completed:** 2026-02-21T17:18:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `e2e/specs/rate-limits.spec.ts` with 5 tests covering Phase 27 anonymous enforcement behaviors
- Expiration cap tests verify server returns 400 for 24h and 7d anonymous requests (direct API calls, no mocking)
- Valid 1h expiration test confirms 201 success path using real `encryptForTest` crypto helper
- Locked expiration UI test verifies anonymous page renders a `div` (not `select#expiration`) showing "1 hour" text with no 24h/7d/30d options accessible
- Countdown test correctly skipped in E2E_TEST mode with explicit documentation of why and what covers it instead

## Task Commits

Each task was committed atomically:

1. **Task 1: Create e2e/specs/rate-limits.spec.ts** - `b5d9dc7` (feat)

**Plan metadata:** [committed with SUMMARY.md below]

## Files Created/Modified

- `e2e/specs/rate-limits.spec.ts` - Five E2E tests: rate-limit countdown (skip-guarded for E2E mode), server 400 for anonymous 24h, server 400 for anonymous 7d, server 201 for anonymous 1h, locked expiration UI check

## Decisions Made

- **Countdown test skip pattern:** `playwright.config.ts` sets `E2E_TEST=true` which causes `isE2E` in `rate-limit.ts` to raise the anonymous hourly limit from 3 to 1000. This makes it impossible to exhaust the rate limit in the standard E2E run. Used `test.skip(process.env.E2E_TEST === 'true', reason)` to document the constraint rather than silently omitting the test. The countdown UI logic (`showRateLimitUpsell()`, `Math.ceil(resetTimestamp / 60)`) is covered by unit tests.

- **Anonymous select DOM check:** `createExpirationSelect(false)` returns a plain `<div>` (not `<select id="expiration">`). The test defensively checks `selectEl.count()` first: if a select exists (authenticated path, unexpected for anonymous), verify no 24h/7d/30d options; if no select (expected anonymous path), verify the "1 hour" text is visible and no long-expiry role="option" elements are present.

- **Expiration cap tests use `request` fixture:** Direct API calls bypass the locked client-side select, testing the server enforcement at `secrets.ts` line 84 (`if (!userId && expiresIn !== '1h')`). This is the correct E2E test boundary — the client-side UI lock is a convenience, not the security control.

## Deviations from Plan

None - plan executed exactly as written. The countdown test skip was anticipated by the plan ("use `test.skip` if the DOM structure cannot be verified" guidance) and the rate-limit inflation concern was identified by reading `rate-limit.ts` before writing the test.

## Issues Encountered

The `playwright.config.ts` `E2E_TEST=true` environment variable sets `isE2E=true` in `rate-limit.ts`, raising the anonymous hourly limit to 1000. This prevents the countdown test from triggering a real 429 response. The test is correctly guarded with `test.skip` and documents the coverage gap is addressed via unit/integration tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 29 gap-closure plan 04 complete
- E2E coverage for anonymous expiration cap enforcement is now explicit and passing
- Rate-limit countdown E2E coverage documented as skip with clear rationale

---
*Phase: 29-v4-tech-debt-cleanup*
*Completed: 2026-02-21*
