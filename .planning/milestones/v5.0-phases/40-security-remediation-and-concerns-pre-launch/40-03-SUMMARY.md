---
phase: 40-security-remediation-and-concerns-pre-launch
plan: 03
subsystem: testing
tags: [vitest, supertest, stripe, notification, auth, zk-invariant, scaffold]

# Dependency graph
requires:
  - phase: 40-security-remediation-and-concerns-pre-launch
    provides: VALIDATION.md with gap analysis identifying 5 missing test files (Wave 0 setup)
provides:
  - server/src/services/__tests__/notification.service.test.ts with 3 passing ZK invariant tests + 1 todo
  - server/src/routes/__tests__/auth.test.ts with 2 test.todo stubs (session logout + Pro-gate)
  - server/src/routes/__tests__/webhooks.test.ts with 3 test.todo stubs (Stripe sig verification)
  - Plan 04 (Wave 2) unblocked — all scaffold files exist with correct paths and imports
affects:
  - 40-04 (Plan 04 fills in all test.todo implementations)
  - 40-05 (Plan 05 implements console.error → logger.error; notification.service.test.ts todo becomes green)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ZK invariant automated test: nanoid-pattern regex check on email subject/body/payload"
    - "Scaffold scaffold pattern: eslint-disable-next-line @typescript-eslint/no-unused-vars for Plan N+1 imports"
    - "Integration test scaffold: pool.end() in afterAll is mandatory — prevents vitest hang on DB-connected tests"
    - "vi.mock() with mockResolvedValue for Resend email transport — enables unit testing without real API calls"

key-files:
  created:
    - server/src/services/__tests__/notification.service.test.ts
    - server/src/routes/__tests__/auth.test.ts
    - server/src/routes/__tests__/webhooks.test.ts
  modified: []

key-decisions:
  - "ZK invariant tests (3) in notification.service.test.ts run GREEN immediately in Plan 03 — they confirm existing sendSecretViewedNotification already satisfies the invariant without waiting for Plan 05"
  - "test.todo used for tests that depend on Plan 04/05 implementation changes — no false-green stubs"
  - "ESLint disable directives added per-import for scaffold-only unused symbols (Plan 04 will activate them)"
  - "nanoid pattern regex /[A-Za-z0-9_-]{21}/ used for ZK invariant check — matches nanoid default alphabet and length"

patterns-established:
  - "Scaffold test files: define imports/helpers/describe structure with test.todo; Plan N+1 fills in implementations"
  - "ZK invariant test: mock resend transport, call service, assert subject/text/JSON do not match nanoid pattern"

requirements-completed: [I4, SR-012, E2, SR-004, E3, SR-003, E4, SR-018]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 40 Plan 03: Test Scaffold Files for Security Gaps Summary

**Three Vitest scaffold files created: ZK invariant passing tests for notification emails plus test.todo stubs for Stripe webhook sig verification, session logout invalidation, and Pro-gate re-validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T00:13:06Z
- **Completed:** 2026-03-02T00:16:48Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created `notification.service.test.ts` with 3 immediately-green ZK invariant tests (nanoid pattern absent from email subject, body, and payload) confirming existing notification service satisfies Gap 5/SR-012/I4
- Created `auth.test.ts` scaffold with `createUserAndSignIn` helper, afterEach/afterAll cleanup, and 2 test.todo stubs for Gap 3/SR-003 (logout) and Gap 4/SR-018 (Pro-gate)
- Created `webhooks.test.ts` scaffold with 3 test.todo stubs for Gap 1 Critical (Stripe HMAC sig verification)
- All three files pass ESLint and `npx tsc --noEmit`; pool.end() in each afterAll prevents vitest hang

## Task Commits

Each task was committed atomically:

1. **Task 1: notification.service.test.ts scaffold (ZK invariant + console.error stubs)** - `65eda08` (test)
2. **Task 2: auth.test.ts scaffold (session logout + Pro-gate re-validation stubs)** - `0e88452` (test)
3. **Task 3: webhooks.test.ts scaffold (Stripe signature verification stub)** - `9d828ce` (test)

## Files Created/Modified
- `server/src/services/__tests__/notification.service.test.ts` - ZK invariant tests for sendSecretViewedNotification: 3 pass + 1 todo (console.error replacement, Plan 05 dep)
- `server/src/routes/__tests__/auth.test.ts` - Integration test scaffold for auth security: createUserAndSignIn helper + 2 test.todo (Plan 04 fills in)
- `server/src/routes/__tests__/webhooks.test.ts` - Integration test scaffold for Stripe webhook handler: 3 test.todo (Plan 04 fills in)

## Decisions Made
- ZK invariant tests in notification.service.test.ts are real tests (not todo) because the existing service already satisfies them — confirmed immediately without waiting for Plan 05
- ESLint `@typescript-eslint/no-unused-vars` disable directives used per-import for symbols that are scaffold-only; Plan 04 will use them in actual test bodies and the directives can be removed
- `void expect` pattern rejected (ESLint warns on unused directive); per-import eslint-disable is the correct approach
- nanoid pattern `/[A-Za-z0-9_-]{21}/` regex chosen as the ZK invariant detector — matches nanoid's default URL-safe alphabet and 21-character length

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added eslint-disable directives for scaffold-only unused imports**
- **Found during:** Task 2 (auth.test.ts) and Task 3 (webhooks.test.ts)
- **Issue:** `expect`, `request`, `app`, and `createUserAndSignIn` are unused while all tests are `test.todo`; ESLint `@typescript-eslint/no-unused-vars` blocks commit via lint-staged
- **Fix:** Added per-import `// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Plan 04 test bodies use this` comments; Plan 04 can remove them when it adds real test code
- **Files modified:** `server/src/routes/__tests__/auth.test.ts`, `server/src/routes/__tests__/webhooks.test.ts`
- **Verification:** `npx eslint` exits 0 on both files
- **Committed in:** `0e88452` (Task 2), `9d828ce` (Task 3)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical lint compliance)
**Impact on plan:** Necessary for lint-staged to allow commits. No scope creep.

## Issues Encountered
- `void createUserAndSignIn` pattern (initial attempt) was removed by ESLint as `no-unused-expressions`. Replaced with explicit `// eslint-disable-next-line` comment on the function declaration.
- `void expect` pattern failed because ESLint detected unused eslint-disable directive (the `void` expression doesn't actually silence the unused-vars error for the import). Switched to per-import disable.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 04 (Wave 2) is fully unblocked: all three scaffold files exist with correct import paths, describe names, and test names matching what Plan 04 will implement
- Plan 04 can remove ESLint disable directives as it adds real test body code
- Plan 05 (console.error → logger.error migration) will turn the 1 remaining test.todo in notification.service.test.ts green

## Self-Check: PASSED

All created files confirmed on disk. All task commits confirmed in git log.

| Check | Result |
|-------|--------|
| server/src/services/__tests__/notification.service.test.ts | FOUND |
| server/src/routes/__tests__/auth.test.ts | FOUND |
| server/src/routes/__tests__/webhooks.test.ts | FOUND |
| Commit 65eda08 (Task 1) | FOUND |
| Commit 0e88452 (Task 2) | FOUND |
| Commit 9d828ce (Task 3) | FOUND |

---
*Phase: 40-security-remediation-and-concerns-pre-launch*
*Completed: 2026-03-02*
