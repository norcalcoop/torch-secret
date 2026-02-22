---
phase: 29-v4-tech-debt-cleanup
plan: "05"
subsystem: testing
tags: [vitest, happy-dom, unit-test, rate-limit, dom, mocking]

# Dependency graph
requires:
  - phase: 27-v4-conversion-rate-optimization
    provides: showRateLimitUpsell() function in create.ts with Math.ceil countdown logic
  - phase: 29-v4-tech-debt-cleanup
    provides: 29-VERIFICATION.md identifying SC-3 gap (no unit tests for showRateLimitUpsell)
provides:
  - Vitest unit tests for showRateLimitUpsell() in client/src/__tests__/create-rate-limit.test.ts
  - Coverage for Math.ceil(resetTimestamp / 60) countdown rendering path
  - Coverage for undefined/0 rateLimitReset rendering no countdown paragraph
  - Coverage for plural/singular minute logic
  - Coverage for Sign up CTA link href=/register
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "form > [role='alert'] scoped selector to disambiguate nested role=alert elements (protection panel #gen-error vs form errorArea)"
    - "importOriginal factory pattern in vi.mock to preserve real ApiError class while replacing createSecret"
    - "eslint-disable-next-line for no-unsafe-return on mock factory return (vi.fn() returns any)"

key-files:
  created:
    - client/src/__tests__/create-rate-limit.test.ts
  modified: []

key-decisions:
  - "form > :scope > [role='alert'] selector required because protection panel contains its own nested #gen-error role=alert element that precedes errorArea in DOM order — querySelector would return the wrong element"
  - "importOriginal factory form in vi.mock preserves real ApiError class for instanceof check in create.ts line 1165 while replacing only createSecret"
  - "ApiError constructor is (status: number, body: unknown, rateLimitReset?: number) — not (message, status) as suggested in plan template; corrected to match actual implementation"
  - "eslint-disable-next-line @typescript-eslint/no-unsafe-return added for mock factory return — vi.fn() is any-typed, test override disables no-unsafe-call but not no-unsafe-return"

patterns-established:
  - "submitCreateForm() helper returns the errorArea DOM reference captured before submit — avoids re-querying after mutation and ensures correct element is asserted"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 29 Plan 05: showRateLimitUpsell() Unit Tests Summary

**Vitest DOM unit tests for showRateLimitUpsell() countdown rendering, closing SC-3 gap identified in 29-VERIFICATION.md and fulfilling the alternative coverage referenced in the e2e/specs/rate-limits.spec.ts skip comment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T01:45:08Z
- **Completed:** 2026-02-22T01:48:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `client/src/__tests__/create-rate-limit.test.ts` with 5 passing unit tests
- Tests exercise `showRateLimitUpsell()` indirectly by mocking `createSecret` to throw a 429 ApiError and submitting the form
- Covers all countdown branches: 3600s→60 min (plural), 45s→1 min (singular via Math.ceil), 1800s→30 min, undefined→no countdown paragraph
- Verifies CTA link href="/register" with "Sign up" text
- Discovered and fixed DOM selector ambiguity: `form > [role="alert"]` required to avoid selecting protection panel's nested `#gen-error` element

## Task Commits

1. **Task 1: Create client/src/__tests__/create-rate-limit.test.ts with showRateLimitUpsell() unit tests** - `6ef0f6c` (test)

## Files Created/Modified

- `client/src/__tests__/create-rate-limit.test.ts` — 5 unit tests for showRateLimitUpsell() countdown rendering, mocking createSecret via importOriginal factory pattern

## Decisions Made

- `ApiError` constructor is `(status: number, body: unknown, rateLimitReset?: number)` — the plan template incorrectly showed `(message: string, status: number)`. Corrected to match the actual implementation in `client/src/api/client.ts`.
- `form > [role="alert"]` scoped selector used instead of `container.querySelector('[role="alert"]')` because the protection panel renders its own `#gen-error` element with `role="alert"` that appears before `errorArea` in DOM order.
- `submitCreateForm()` returns the `errorArea` DOM reference captured before form submission so tests hold a direct reference to the mutated element (no re-querying needed after `showRateLimitUpsell` runs).
- `eslint-disable-next-line @typescript-eslint/no-unsafe-return` added on the mock factory return — the test file ESLint override disables `no-unsafe-call` but not `no-unsafe-return`, and `vi.fn()` returns `any`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected ApiError constructor call to match actual implementation**
- **Found during:** Task 1 (reviewing client/src/api/client.ts)
- **Issue:** Plan template showed `new ApiError('Rate limit exceeded', 429)` but actual constructor is `new ApiError(status: number, body: unknown, rateLimitReset?: number)`
- **Fix:** Changed to `new ApiError(429, { error: 'Rate limit exceeded' }, resetTimestamp)` throughout the test file
- **Files modified:** client/src/__tests__/create-rate-limit.test.ts
- **Verification:** All 5 tests pass; TypeScript compilation succeeds
- **Committed in:** 6ef0f6c (Task 1 commit)

**2. [Rule 1 - Bug] Fixed DOM selector ambiguity for errorArea vs protection panel alert**
- **Found during:** Task 1 (first test run — 3 of 5 tests failed)
- **Issue:** `container.querySelector('[role="alert"]')` returned the protection panel's `#gen-error` element (first in DOM order) instead of the form's `errorArea` div
- **Fix:** Changed `submitCreateForm()` to capture `form.querySelector(':scope > [role="alert"]')` before submit — direct child selector excludes nested protection panel elements
- **Files modified:** client/src/__tests__/create-rate-limit.test.ts
- **Verification:** All 5 tests pass after fix
- **Committed in:** 6ef0f6c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — implementation discovery corrections)
**Impact on plan:** Both fixes required for correct test behavior. No scope creep.

## Issues Encountered

- ESLint pre-commit hook caught `@typescript-eslint/no-unsafe-return` on the `vi.mock` factory return — added targeted `eslint-disable-next-line` comment since the test file ESLint override only disables `no-unsafe-call`, not `no-unsafe-return`. All 10 client test files (139 tests) pass after fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC-3 gap closed: `showRateLimitUpsell()` countdown rendering now has full unit test coverage
- Phase 29 all 5 plans complete (01 through 05)
- v4.0 tech debt cleanup complete; no active blockers

---
*Phase: 29-v4-tech-debt-cleanup*
*Completed: 2026-02-22*
