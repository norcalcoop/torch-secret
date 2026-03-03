---
phase: 37-email-onboarding-sequence
plan: 02
subsystem: auth
tags: [loops, better-auth, onboarding, billing, drizzle, gdpr, email]

# Dependency graph
requires:
  - phase: 37-01
    provides: marketingConsent column; Better Auth additionalFields; LOOPS_API_KEY env var; RED test scaffolds for onboarding service and billing service
  - phase: 34-stripe-billing
    provides: activatePro function signature; billing.service.ts structure; stripe singleton pattern
provides:
  - loops@6.2.0 installed; server/src/config/loops.ts LoopsClient singleton
  - server/src/services/onboarding.service.ts with enrollInOnboardingSequence using sendEvent('registered')
  - auth.ts databaseHooks.user.create.after fires enrollInOnboardingSequence via void + .catch()
  - activatePro() extended with loops.updateContact({ subscriptionTier: 'pro' }) to suppress day-7 upgrade email
  - All 7 RED scaffolds from Plan 01 now GREEN (6 onboarding service + 1 billing)
affects:
  - 37-03 (Loops loop configuration in the Loops.so dashboard — external setup, no code needed)

# Tech tracking
tech-stack:
  added: [loops@6.2.0]
  patterns:
    - LoopsClient singleton mirroring stripe.ts pattern (import once, export const, never new LoopsClient() in services)
    - Fire-and-forget Loops calls via void + .catch() — external service failures never block core operations
    - ZK-compliant Loops error logging: only err.message in log, no userId or email in same log line
    - databaseHooks.user.create.after in Better Auth for post-registration side effects
    - DB select by stripeCustomerId to get email before Loops updateContact (same pattern as getOrCreateStripeCustomer)

key-files:
  created:
    - server/src/config/loops.ts
    - server/src/services/onboarding.service.ts
  modified:
    - server/src/auth.ts
    - server/src/services/billing.service.ts
    - server/src/services/billing.service.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "databaseHooks.after hook is non-async — void + .catch() makes it fire-and-forget without needing async. Removing async avoids @typescript-eslint/require-await lint error."
  - "billing.service.test.ts mock updated from single mockDbUpdate to mockSelect + mockUpdate — activatePro now performs both SELECT (email lookup) and UPDATE (tier change), requiring both mock functions."
  - "ZK invariant preserved in Loops error handler: logger.error({ err: err.message }, ...) — no userId or email in the same structured log object."

patterns-established:
  - "Loops singleton: import { loops } from '../config/loops.js' — never create new LoopsClient() in service files"
  - "Fire-and-forget external service calls: void service().catch(err => logger.error({ err: err.message }, 'msg')) — registration/billing never blocked by external service outage"
  - "Better Auth databaseHooks.user.create.after for post-registration enrollment — fires after user row is persisted, safe to fail silently"

requirements-completed: [ESEQ-01, ESEQ-02, ESEQ-03]

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 37 Plan 02: Email Onboarding Sequence — Loops Integration Summary

**Loops.so onboarding wired end-to-end: SDK installed, singleton created, enrollInOnboardingSequence fires registered event on every new user, activatePro syncs Pro tier to Loops contact to suppress day-7 upgrade email**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-27T00:53:25Z
- **Completed:** 2026-02-27T00:56:29Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- loops@6.2.0 installed; `server/src/config/loops.ts` LoopsClient singleton created (mirrors stripe.ts pattern)
- `server/src/services/onboarding.service.ts` delivers `enrollInOnboardingSequence()` — fires `sendEvent('registered')` with firstName, marketingConsent, subscriptionTier contactProperties; welcome email fires for ALL new users regardless of consent
- `server/src/auth.ts` databaseHooks.user.create.after wired via fire-and-forget — Loops failure never blocks registration
- `server/src/services/billing.service.ts` activatePro() extended: DB select by stripeCustomerId to get email, then `loops.updateContact({ subscriptionTier: 'pro' })` fire-and-forget — prevents day-7 upgrade email reaching paying customers
- All 7 RED scaffolds from Plan 01 now GREEN; full suite 328/328 passes; ESLint clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Install loops SDK, create singleton, implement onboarding service** - `814ee1d` (feat)
2. **Task 2: Wire auth hook + extend activatePro + full suite GREEN** - `9b2b25d` (feat)

## Files Created/Modified

- `server/src/config/loops.ts` - LoopsClient singleton using env.LOOPS_API_KEY (created)
- `server/src/services/onboarding.service.ts` - enrollInOnboardingSequence function with sendEvent('registered') + contactProperties (created)
- `server/src/auth.ts` - Added databaseHooks.user.create.after firing enrollInOnboardingSequence; added imports for onboarding service and logger
- `server/src/services/billing.service.ts` - Extended activatePro() with loops/logger imports + DB select for email + loops.updateContact call
- `server/src/services/billing.service.test.ts` - Updated mock to support both db.select and db.update (activatePro now calls both)
- `package.json` + `package-lock.json` - loops@6.2.0 added to dependencies

## Decisions Made

- **Non-async databaseHooks.after:** The hook uses `void + .catch()` (fire-and-forget) so `async` is unnecessary and triggers `@typescript-eslint/require-await`. Removing `async` from the hook signature is the correct fix — Better Auth doesn't require the hook to be async.
- **billing.service.test.ts mock update:** The Plan 01 scaffold only mocked `db.update`. The updated `activatePro()` calls both `db.select` (email lookup) and `db.update` (tier change). Updated the mock to `{ db: { select: mockSelect, update: mockUpdate } }` using the pattern from the plan's Task 2 fallback instructions.
- **ZK-compliant Loops error logs:** Error handlers in both auth.ts and billing.service.ts log `{ err: err.message }` only — no userId, no email in the same structured log object. This is the pattern mandated by INVARIANTS.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unnecessary async from databaseHooks.after hook**
- **Found during:** Task 2 (verification — `npm run lint`)
- **Issue:** ESLint `@typescript-eslint/require-await` — the `after` hook was declared `async` but contained no `await` expression (fire-and-forget pattern uses `void + .catch()`)
- **Fix:** Removed `async` keyword from the hook function declaration — behavior unchanged
- **Files modified:** `server/src/auth.ts`
- **Verification:** `npm run lint` passes; 328 tests still GREEN
- **Committed in:** `9b2b25d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Trivial lint fix required for correctness. No scope creep.

## Issues Encountered

The Loops `registered` event fires in auth integration tests (auth.test.ts) using the real `loops_placeholder` API key, which causes "401 - Invalid API key" error log output during the test run. This is expected and correct behavior — the fire-and-forget pattern ensures registration still succeeds (auth.test.ts passes 12/12), and the error log confirms the `.catch()` handler is working as designed. No test failures result.

## User Setup Required

None - all code changes are complete. External Loops dashboard configuration (creating the loop triggered by `registered` event) is a manual step outside this plan — see Phase 37 Plan 03 or the user-setup documentation from Plan 01.

## Next Phase Readiness

- All ESEQ-01 through ESEQ-03 requirements fulfilled at the code level: welcome email (immediate, unconditional), day-3 features email (marketingConsent gate in Loops audience filter), and day-7 upgrade email (marketingConsent + subscriptionTier !== 'pro' gates via Loops audience) all flow from the single `registered` event + contact properties
- The Loops loop itself must be configured in the Loops.so dashboard to activate the sequence — this is an external operational step, not a code task
- activatePro() Pro tier sync is live; new Pro subscribers will have subscriptionTier: 'pro' in their Loops contact within seconds of webhook processing

## Self-Check: PASSED

| Item | Status |
|------|--------|
| server/src/config/loops.ts | FOUND |
| server/src/services/onboarding.service.ts | FOUND |
| server/src/auth.ts (databaseHooks) | FOUND |
| server/src/services/billing.service.ts (updateContact) | FOUND |
| commit 814ee1d | FOUND |
| commit 9b2b25d | FOUND |

---
*Phase: 37-email-onboarding-sequence*
*Completed: 2026-02-27*
