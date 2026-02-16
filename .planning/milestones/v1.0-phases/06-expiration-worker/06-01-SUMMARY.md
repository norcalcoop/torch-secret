---
phase: 06-expiration-worker
plan: 01
subsystem: api, database
tags: [node-cron, expiration, worker, cron, drizzle, security]

# Dependency graph
requires:
  - phase: 02-database-and-api
    provides: "Drizzle schema with secrets table and expiresAt column"
  - phase: 05-password-protection
    provides: "verifyAndRetrieve and getSecretMeta service functions"
provides:
  - "Expiration worker with 5-minute cron schedule (start/stop lifecycle)"
  - "API-level expiration enforcement in all three retrieval paths"
  - "Opportunistic expired-secret cleanup inside existing transactions"
affects: [06-02-PLAN, 07-trust-and-accessibility]

# Tech tracking
tech-stack:
  added: [node-cron 4.2.1]
  patterns: [cron worker lifecycle, expiration guard pattern, opportunistic cleanup]

key-files:
  created:
    - server/src/workers/expiration-worker.ts
  modified:
    - server/src/services/secrets.service.ts
    - server/src/server.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Worker uses single-character '0' for batch ciphertext zeroing (not length-matched) per Research Pitfall 6"
  - "Expiration guards placed BEFORE password checks to prevent expired password-protected secrets from entering password flow"
  - "getSecretMeta has no inline cleanup (no transaction context) -- relies on worker or next retrieval"
  - "Worker uses result.rowCount from pg driver passthrough for deletion count"

patterns-established:
  - "Expiration guard pattern: check expiresAt <= new Date() after null check, before business logic"
  - "Worker lifecycle: start in app.listen callback, stop at top of shutdown handler"
  - "Opportunistic cleanup: zero + delete expired rows inside existing transactions"

# Metrics
duration: 8min
completed: 2026-02-14
---

# Phase 6 Plan 1: Expiration Worker Summary

**node-cron 5-minute worker with ciphertext zeroing, plus API-level expiration guards in all three retrieval paths (retrieveAndDestroy, getSecretMeta, verifyAndRetrieve)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-14T22:44:22Z
- **Completed:** 2026-02-14T22:52:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created expiration worker module with 5-minute cron schedule performing two-step bulk cleanup (zero ciphertext then delete)
- Added expiration guards to all three service retrieval functions, ensuring expired secrets return null (same as not-found) even between worker runs
- Integrated worker lifecycle into server.ts (start after listen, stop on shutdown)
- Worker does NOT start during integration tests (started in server.ts, not buildApp)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install node-cron and create expiration worker module** - `f67a548` (feat)
2. **Task 2: Add expiration guards to service layer and integrate worker into server.ts** - `28bf17b` (feat)

## Files Created/Modified
- `server/src/workers/expiration-worker.ts` - Cron-based expiration cleanup worker with start/stop exports
- `server/src/services/secrets.service.ts` - Added expiresAt guards to retrieveAndDestroy, getSecretMeta, and verifyAndRetrieve
- `server/src/server.ts` - Worker lifecycle: start after listen, stop on shutdown
- `package.json` - Added node-cron 4.2.1 dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- Worker uses single-character '0' for batch ciphertext zeroing (not length-matched per individual secret) as specified by Research Pitfall 6 -- bulk UPDATE cannot know each row's length
- Expiration guards positioned BEFORE password checks in both retrieveAndDestroy and verifyAndRetrieve -- an expired password-protected secret should return null, not enter the password verification flow
- getSecretMeta does not perform inline cleanup because it has no transaction context; the worker or a future retrieval call will handle cleanup
- Worker only logs deletion count when deletedCount > 0 to avoid noisy logs every 5 minutes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing flaky test ("returns 404 on second retrieval") caused by cross-file race condition: security.test.ts and secrets.test.ts share a PostgreSQL pool and both have afterEach that deletes all secrets. When running in parallel, afterEach in one file can delete secrets created by the other. This flakiness exists with and without our changes (verified by running 10 iterations both ways). Not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Expiration worker and guards are complete and ready for integration testing (Plan 2)
- All three retrieval paths enforce expiration at the service layer
- Worker lifecycle is integrated into the server startup/shutdown flow

## Self-Check: PASSED

- [x] server/src/workers/expiration-worker.ts exists
- [x] server/src/services/secrets.service.ts exists with 3 expiration guards
- [x] server/src/server.ts exists with worker lifecycle
- [x] 06-01-SUMMARY.md exists
- [x] Commit f67a548 exists (Task 1)
- [x] Commit 28bf17b exists (Task 2)
- [x] startExpirationWorker and stopExpirationWorker exports verified
- [x] node-cron ^4.2.1 in dependencies

---
*Phase: 06-expiration-worker*
*Completed: 2026-02-14*
