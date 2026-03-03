---
phase: 45-billing-service-gap-closure
plan: 01
subsystem: payments
tags: [stripe, billing, idempotency, tdd, verify-checkout, activatePro]

# Dependency graph
requires:
  - phase: 34-stripe-billing-foundation
    provides: "activatePro() in billing.service.ts + verify-checkout endpoint in billing.ts"
provides:
  - "verify-checkout now writes Pro status to DB immediately on user return from Stripe Checkout"
  - "activatePro() idempotency verified by 2 new test cases"
  - "4 unit tests covering verify-checkout activatePro wiring (BILL-05)"
affects: [stripe-webhooks, billing-service, verify-checkout, post-checkout-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-write idempotency: both verify-checkout and webhook call activatePro(); neither blocks on the other"
    - "Null customer guard before activatePro: if (session.mode === 'subscription' && session.customer)"
    - "Mismatch check tolerates null session.customer: guard only fires when both sides are non-null"

key-files:
  created:
    - server/src/routes/__tests__/billing.test.ts
  modified:
    - server/src/routes/billing.ts
    - server/src/services/billing.service.test.ts

key-decisions:
  - "verify-checkout calls activatePro() directly after session validation — eliminates ~1-2s race window where user has Pro response but free DB state"
  - "session_mismatch guard updated to require non-null session.customer — null customer (refunded/non-subscription) skips both the mismatch check and activatePro"
  - "idempotency is structural not conditional — DB UPDATE WHERE is a no-op on already-Pro row; no if-check needed"

patterns-established:
  - "TDD RED/GREEN: billing route tests use vi.hoisted() for all mocks, buildApp() per test, vi.clearAllMocks() in beforeEach"
  - "Auth mock pattern: mock ../../auth.js with auth.api.getSession returning { user, session } shape"

requirements-completed: [BILL-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 45 Plan 01: Billing Service Gap Closure Summary

**Closed BILL-05 race window: verify-checkout now calls activatePro() directly, eliminating the ~1-2s gap where a user has Pro confirmation but free DB state while waiting for Stripe webhook delivery**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T03:19:02Z
- **Completed:** 2026-03-03T03:21:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- verify-checkout handler now calls `activatePro(customerId)` after `session.status === 'complete'` check — Pro status written to DB immediately on user return from Stripe Checkout
- activatePro() dual-write idempotency confirmed: webhook + verify-checkout both call it; DB UPDATE WHERE is a no-op on already-Pro rows; 2 new idempotency tests GREEN
- 4 unit tests (TDD RED/GREEN) covering all 4 verify-checkout behaviors: happy path, incomplete payment, null customer, customer mismatch
- Full test suite: 382 tests GREEN (up from 376; 6 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — Create billing route test scaffold with failing BILL-05 tests** - `36e7427` (test)
2. **Task 2: Wire activatePro() into verify-checkout + idempotency test** - `ab650cd` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks have RED commit (test) then GREEN commit (feat)_

## Files Created/Modified

- `server/src/routes/__tests__/billing.test.ts` - 4 unit tests for verify-checkout activatePro wiring; all mocks via vi.hoisted()
- `server/src/routes/billing.ts` - Added activatePro import + call site in verify-checkout handler; updated mismatch guard for null customer tolerance
- `server/src/services/billing.service.test.ts` - Extended with 2 idempotency tests in new `activatePro — idempotency (BILL-05)` describe block

## Decisions Made

- Null customer tolerance in mismatch check: changed `session.customer !== dbUser.stripeCustomerId` to require both sides non-null. A null `session.customer` (e.g. refunded session, non-subscription checkout) skips both the 403 guard AND activatePro — this is the correct behavior since there is no customer to activate.
- No conditional guard in activatePro() itself: idempotency comes from the underlying DB `UPDATE WHERE` being a no-op on an already-Pro row — no `if (!alreadyPro)` check needed at the service level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mismatch guard returns 403 on null session.customer**

- **Found during:** Task 1 (RED test run) — Test 3 (null customer) failed with 403 instead of 200
- **Issue:** Existing mismatch check `session.customer !== dbUser.stripeCustomerId` evaluates `null !== 'cus_test123'` as truthy, incorrectly returning 403 for null-customer sessions
- **Fix:** Added `session.customer &&` to the mismatch condition so the guard only fires when both the DB customer ID and the session customer are non-null
- **Files modified:** server/src/routes/billing.ts
- **Verification:** Test 3 GREEN after fix; session_mismatch 403 test still passes (Test 4)
- **Committed in:** ab650cd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in existing mismatch guard)
**Impact on plan:** Fix was essential for correctness — null customer sessions would incorrectly block users returning from refunded/non-subscription checkouts. No scope creep.

## Issues Encountered

None beyond the auto-fixed mismatch guard bug.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BILL-05 gap closed: verify-checkout now provides immediate Pro activation without webhook dependency
- Remaining gap closure plans in Phase 45 can proceed without billing service concerns
- activatePro() idempotency documented and test-confirmed — safe for dual-write from multiple code paths

---
*Phase: 45-billing-service-gap-closure*
*Completed: 2026-03-03*
