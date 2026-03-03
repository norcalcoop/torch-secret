---
phase: 40-security-remediation-and-concerns-pre-launch
plan: 04
subsystem: testing
tags: [vitest, supertest, security, integration-tests, stripe, rate-limiting, race-condition]

requires:
  - phase: 40-03
    provides: Scaffold test files with test.todo stubs and pool.end() cleanup patterns

provides:
  - Passing integration tests for all 7 security coverage gaps identified in Phase 40 research
  - IDOR protection verified: User B cannot see User A secrets on dashboard
  - Session logout invalidation verified: server-side session deletion confirmed via 401 on reuse
  - Pro-gate re-validation verified: subscriptionTier read from DB per request (no session caching)
  - Stripe webhook signature verification: missing/invalid sig → 400; tampered event → no DB upgrade
  - Payload size limit verified: 101KB ciphertext → 413 payload_too_large
  - Race condition verified: concurrent verify requests when 1 attempt remaining → secret destroyed exactly once
  - Expiration worker soft/hard delete verified: existing 11 tests cover both behaviors
  - Rate-limit config unit tests: createVerifyTightLimiter shape + isE2E dual-condition guard

affects:
  - Phase 40 Plan 05 (security logging audit)
  - Future: Any changes to dashboard.ts, auth routes, webhook handler, secrets.ts must not break these tests

tech-stack:
  added: []
  patterns:
    - "GET /api/me wraps subscriptionTier under { user: { subscriptionTier } } — tests access proRes.body.user.subscriptionTier"
    - "Race condition test uses Promise.all() — sequential requests cannot test atomicity"
    - "Webhook tests send raw JSON string body + Content-Type: application/json (express.raw() route)"
    - "Rate limiter shape tests use dynamic import after vi.stubEnv to re-evaluate module-level isE2E constant"

key-files:
  created:
    - server/src/middleware/__tests__/rate-limit.test.ts
  modified:
    - server/src/routes/__tests__/dashboard.test.ts
    - server/src/routes/__tests__/auth.test.ts
    - server/src/routes/__tests__/webhooks.test.ts
    - server/src/routes/__tests__/secrets.test.ts

key-decisions:
  - "GET /api/me response shape is { user: { subscriptionTier } } not flat { subscriptionTier } — fixed test assertion after first run failure"
  - "Race condition test allows both 403 and 404 in results (not just 404) — first concurrent hit destroys secret; others may see wrong_password before or after depending on timing"
  - "Rate limiter 429 integration test deferred to staging/E2E — isE2E guard (limit=1000 in Vitest) makes 429 structurally untriggerable in unit test env"
  - "expiration-worker.test.ts already had comprehensive soft/hard delete coverage (11 tests) from Phase 6 era; no changes needed"

patterns-established:
  - "Pro-gate test pattern: createUserAndSignIn() then db.update(users).set({ subscriptionTier: 'pro' }).where(eq(users.id, userId))"
  - "Webhook test pattern: .send(JSON.stringify({...})) with .set('Content-Type', 'application/json') for express.raw() routes"

requirements-completed:
  - E1
  - SR-017
  - E3
  - SR-003
  - E4
  - SR-018
  - I4
  - SR-012

duration: 3min
completed: 2026-03-02
---

# Phase 40 Plan 04: Security Test Coverage Implementation Summary

**11 new integration tests across 5 files covering all 7 security coverage gaps (IDOR, session invalidation, Pro-gate re-validation, Stripe signature verification, payload size, race condition, expiration soft/hard delete)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-02T16:20:24Z
- **Completed:** 2026-03-02T16:24:12Z
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- Replaced all `test.todo` stubs from Plan 03 scaffold files with full passing implementations
- All 7 coverage gaps from Phase 40 research now have green tests (106 tests total across 7 files)
- Race condition test correctly uses `Promise.all()` to fire 3 concurrent verify requests, confirming the atomic DB transaction destroys the secret exactly once
- Stripe webhook tests verify that invalid/tampered signatures are rejected (400) and no Pro upgrade occurs

## Task Commits

1. **Task 1: IDOR + session logout + Pro-gate re-validation tests** - `92dc16c` (test)
2. **Task 2: Stripe webhook + payload size + race condition + rate-limit tests** - `1b42f04` (test)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `server/src/routes/__tests__/dashboard.test.ts` - Added IDOR describe block (Gap 2, E1, SR-017): User B cannot see User A secrets
- `server/src/routes/__tests__/auth.test.ts` - Replaced 2 test.todo stubs: session logout invalidation (Gap 3, SR-003) + Pro-gate re-validation (Gap 4, SR-018)
- `server/src/routes/__tests__/webhooks.test.ts` - Replaced 3 test.todo stubs: missing sig → 400, invalid sig → 400, tampered checkout → no Pro upgrade (Gap 1)
- `server/src/routes/__tests__/secrets.test.ts` - Added 2 new describe blocks: 413 payload limit (SR-014) + race condition concurrent verify (Gap 6)
- `server/src/middleware/__tests__/rate-limit.test.ts` - New file: rate limiter shape tests and isE2E dual-condition guard documentation

## Decisions Made

- GET /api/me returns `{ user: { subscriptionTier } }` not flat `{ subscriptionTier }` — test initially wrote flat assertion and failed; fixed on first iteration
- Race condition test allows [403, 404] as valid response codes (not just 404) — concurrent requests may return wrong_password before or after the destroy depending on DB transaction commit timing; the invariant that matters is the DB has 0 rows after all requests settle
- Rate limiter 429 integration test deferred to staging/E2E: `isE2E` guard sets limit=1000 in Vitest (NODE_ENV=test), making 429 structurally untriggerable at unit level without bypassing the guard itself
- expiration-worker.test.ts required no changes — existing 11 tests from Phase 6 already cover soft-delete (user-owned → status=expired, ciphertext='0', row preserved) and hard-delete (anonymous → row removed) with explicit assertions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Pro-gate test response shape assertion**
- **Found during:** Task 1 (Pro-gate re-validation test)
- **Issue:** Plan code sample used `proRes.body.subscriptionTier` but GET /api/me wraps response in `{ user: { ... } }`, so actual path is `proRes.body.user.subscriptionTier`
- **Fix:** Updated assertion to access `proRes.body.user?.subscriptionTier`
- **Files modified:** server/src/routes/__tests__/auth.test.ts
- **Verification:** Test passes green after fix
- **Committed in:** 92dc16c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, wrong response shape assumption in plan's code sample)
**Impact on plan:** Minor fix only; no behavioral change to the code under test. Confirmed the actual API contract is correct.

## Issues Encountered

None beyond the response shape mismatch documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 security coverage gaps have green tests
- Phase 40 Plan 05 (security logging + OAuth audit) can proceed without blockers
- All 106 tests pass; 1 todo remains in notification.service.test.ts (pre-existing from Plan 03, documents a known gap in email content assertion for the todo item)

---
*Phase: 40-security-remediation-and-concerns-pre-launch*
*Completed: 2026-03-02*

## Self-Check: PASSED

- server/src/middleware/__tests__/rate-limit.test.ts: FOUND
- server/src/routes/__tests__/dashboard.test.ts: FOUND
- server/src/routes/__tests__/auth.test.ts: FOUND
- server/src/routes/__tests__/webhooks.test.ts: FOUND
- server/src/routes/__tests__/secrets.test.ts: FOUND
- .planning/phases/40-security-remediation-and-concerns-pre-launch/40-04-SUMMARY.md: FOUND
- Task 1 commit 92dc16c: FOUND
- Task 2 commit 1b42f04: FOUND
