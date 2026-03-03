---
phase: 45-billing-service-gap-closure
plan: 02
subsystem: payments
tags: [loops, billing, stripe, email, subscription]

# Dependency graph
requires:
  - phase: 45-01
    provides: activatePro() with Loops contact sync pattern established
  - phase: 37
    provides: Loops onboarding service and loops config singleton
provides:
  - deactivatePro() with Loops contact sync — churned users re-tagged 'free' in Loops
  - ESEQ-03 secondary path closed — day-7 re-engagement audience re-opens after cancellation
affects: [loops-audience-filters, re-engagement-emails, billing-lifecycle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "deactivatePro mirrors activatePro Loops sync pattern: DB update → SELECT email → void loops.updateContact fire-and-forget"
    - "Loops outage resilience: billing never blocked — cancellation webhook completes regardless of Loops availability"

key-files:
  created: []
  modified:
    - server/src/services/billing.service.ts
    - server/src/services/billing.service.test.ts

key-decisions:
  - "Fire-and-forget void+.catch() for Loops sync in deactivatePro — identical pattern to activatePro; DB state is source of truth; Loops is best-effort sync"
  - "SELECT email after DB update uses stripeCustomerId as lookup key — userId never in scope alongside stripeCustomerId (ZK invariant preserved)"

patterns-established:
  - "Loops sync pattern for deactivatePro: stripeCustomerId lookup → email SELECT → void loops.updateContact({ email, properties: { subscriptionTier: 'free' } }).catch(logger.error)"

requirements-completed: [ESEQ-03]

# Metrics
duration: 1min
completed: 2026-03-03
---

# Phase 45 Plan 02: Billing Service Gap Closure Summary

**deactivatePro() extended with fire-and-forget Loops contact sync so churned Pro users are re-tagged 'free', re-opening the day-7 re-engagement audience filter on next resubscription**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-03T19:23:55Z
- **Completed:** 2026-03-03T19:24:56Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added Loops contact sync to `deactivatePro()` mirroring the `activatePro()` pattern, substituting `'free'` for `'pro'`
- Loops failure is caught and logged — billing cancellation webhook never throws due to Loops outage
- Empty-user guard: `deactivatePro()` skips Loops call when no user is found for the given `stripeCustomerId`
- 3 new unit tests cover all three behaviors; full suite at 385 tests (up from 382)
- ZK invariant preserved: `stripeCustomerId` is the only lookup key; `userId` never in scope

## Task Commits

Each task was committed atomically:

1. **RED: Add failing tests for deactivatePro Loops sync** - `163e880` (test)
2. **GREEN: Implement Loops sync in deactivatePro** - `8408019` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD task has two commits (test → feat)_

## Files Created/Modified
- `server/src/services/billing.service.ts` - Added Loops contact sync block to `deactivatePro()` (lines 53–73)
- `server/src/services/billing.service.test.ts` - Added `deactivatePro — Loops contact sync (ESEQ-03)` describe block with 3 tests

## Decisions Made
- Fire-and-forget `void loops.updateContact(...).catch(logger.error)` — identical pattern to `activatePro()`. DB state is authoritative; Loops is best-effort sync.
- `SELECT email` uses `stripeCustomerId` as lookup key (same as `activatePro()`) — no `userId` ever in scope alongside `stripeCustomerId`, preserving the ZK billing invariant.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ESEQ-03 fully closed — `deactivatePro()` now syncs Loops on both activation and deactivation paths
- Phase 45 gap closure complete: BILL-05 (plan 01) and ESEQ-03 secondary path (plan 02) both resolved
- No blockers for any subsequent work

---
*Phase: 45-billing-service-gap-closure*
*Completed: 2026-03-03*
