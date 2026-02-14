---
phase: 06-expiration-worker
plan: 02
subsystem: testing
tags: [vitest, integration-tests, expiration, anti-enumeration, worker, supertest]

# Dependency graph
requires:
  - phase: 06-expiration-worker
    plan: 01
    provides: "Expiration worker with cron schedule, API-level expiration guards in all retrieval paths"
  - phase: 02-database-and-api
    provides: "Drizzle schema with secrets table, atomic retrieve-and-destroy service"
  - phase: 05-password-protection
    provides: "verifyAndRetrieve, getSecretMeta, and password.service.ts"
provides:
  - "13 integration tests proving expiration enforcement across all API endpoints"
  - "Exported cleanExpiredSecrets() function for testable worker cleanup"
  - "Anti-enumeration verification: expired responses identical to nonexistent across GET, meta, verify"
affects: [07-trust-and-accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns: [direct DB insert with past timestamps for expiration testing, extracted cron callback for unit testability]

key-files:
  created:
    - server/src/routes/__tests__/expiration.test.ts
    - server/src/workers/__tests__/expiration-worker.test.ts
  modified:
    - server/src/workers/expiration-worker.ts

key-decisions:
  - "cleanExpiredSecrets extracted as exported function for testability (cron scheduling separate from business logic)"
  - "Expiration tests use direct DB inserts with past timestamps instead of setTimeout/timing (immediate, deterministic)"
  - "Ciphertext zeroing verified by code review rather than runtime intermediate state inspection (impractical to observe UPDATE before DELETE)"

patterns-established:
  - "Direct DB insert pattern: bypass API validation to test edge cases (expired timestamps, specific hash values)"
  - "Extracted cron callback pattern: export business logic separately from scheduler for testability"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 6 Plan 2: Expiration Integration Tests Summary

**13 integration tests proving API-level expiration enforcement, anti-enumeration, inline cleanup, and bulk worker deletion across all three retrieval paths**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T22:55:26Z
- **Completed:** 2026-02-14T22:57:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- 8 API-level expiration tests: GET /:id, GET /:id/meta, POST /:id/verify all return 404 for expired secrets with identical anti-enumeration responses
- 5 worker cleanup tests: bulk delete expired, leave non-expired intact, handle empty table, handle mixed password types
- Extracted cleanExpiredSecrets() as testable export from expiration-worker.ts (no behavior change to cron scheduling)
- Inline cleanup verified: expired rows are removed from database on API retrieval attempt

## Task Commits

Each task was committed atomically:

1. **Task 1: Integration tests for API-level expiration enforcement** - `c717edb` (test)
2. **Task 2: Integration tests for the expiration worker bulk cleanup** - `7481af8` (test)

## Files Created/Modified
- `server/src/routes/__tests__/expiration.test.ts` - 8 tests for API expiration enforcement and anti-enumeration (234 lines)
- `server/src/workers/__tests__/expiration-worker.test.ts` - 5 tests for worker bulk cleanup logic (131 lines)
- `server/src/workers/expiration-worker.ts` - Extracted cleanExpiredSecrets() as exported function

## Decisions Made
- Extracted cleanExpiredSecrets() from cron callback into a standalone exported async function. The cron callback now delegates to this function. This separates scheduling concerns from testable business logic without changing runtime behavior.
- Used direct DB inserts with past expiresAt timestamps to test expiration immediately, avoiding brittle setTimeout-based tests.
- Ciphertext zeroing is verified by code inspection rather than runtime intermediate state testing. The two-step UPDATE (zero) then DELETE pattern is visible in the source and impractical to observe at runtime without breaking the function apart.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted cleanExpiredSecrets as exported function**
- **Found during:** Task 2 (Worker integration tests)
- **Issue:** Worker cleanup logic was inline in the cron callback, not importable for testing
- **Fix:** Extracted the UPDATE+DELETE logic into `export async function cleanExpiredSecrets(): Promise<number>`, called by the cron callback
- **Files modified:** server/src/workers/expiration-worker.ts
- **Verification:** All existing tests pass, new worker tests import and call the function directly
- **Committed in:** 7481af8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Planned extraction per task description. No scope creep.

## Issues Encountered
- Pre-existing flaky test ("returns ciphertext on first retrieval with 200") in secrets.test.ts intermittently fails when running full suite due to cross-file afterEach race condition. Passes in isolation. Documented in 06-01-SUMMARY.md. Not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 6 (Expiration Worker) is fully complete: worker + guards (Plan 1) and integration tests (Plan 2)
- Total test count: 146 (133 existing + 13 new)
- Ready to proceed to Phase 7 (Trust and Accessibility)

## Self-Check: PASSED

- [x] server/src/routes/__tests__/expiration.test.ts exists (234 lines, min 80)
- [x] server/src/workers/__tests__/expiration-worker.test.ts exists (145 lines, min 40)
- [x] server/src/workers/expiration-worker.ts exists with cleanExpiredSecrets export
- [x] 06-02-SUMMARY.md exists
- [x] Commit c717edb exists (Task 1)
- [x] Commit 7481af8 exists (Task 2)
- [x] 8 API tests + 5 worker tests = 13 new tests
- [x] Full suite: 146 total tests

---
*Phase: 06-expiration-worker*
*Completed: 2026-02-14*
