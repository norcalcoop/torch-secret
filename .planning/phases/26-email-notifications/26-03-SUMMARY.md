---
phase: 26-email-notifications
plan: 03
subsystem: testing
tags: [vitest, resend, notification, zero-knowledge, integration-tests, unit-tests]

# Dependency graph
requires:
  - phase: 26-01
    provides: notification.service.ts and secrets.service.ts notify dispatch
  - phase: 26-02
    provides: frontend notify toggle on create page

provides:
  - notification.service.test.ts unit tests (4 tests: recipient, timestamp, zero-knowledge body, no-throw on error)
  - secrets.test.ts Phase 26 integration tests (5 tests: notify persistence and dispatch)
  - INVARIANTS.md Email (Resend) enforcement row
affects:
  - future phases that add email systems or notification features

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.hoisted + vi.mock pattern for ESM modules with top-level variable references
    - vi.mock at test-file module level to intercept named ESM exports (notification service dispatch)
    - fire-and-forget dispatch tested via setImmediate flush after HTTP response

key-files:
  created:
    - server/src/services/notification.service.test.ts
  modified:
    - server/src/routes/__tests__/secrets.test.ts
    - .planning/INVARIANTS.md

key-decisions:
  - "vi.hoisted() required for mock functions referenced inside vi.mock factory — vi.mock is hoisted before variable initialization"
  - "vi.mock at file level for notification.service.js ensures secrets.service.ts dispatch is intercepted (ESM named import binding)"
  - "setImmediate flush after GET /api/secrets/:id allows fire-and-forget notification dispatch to resolve before spy assertions"
  - "Phase 26 tests use dedicated buildApp() instance (notifyTestApp) to avoid rate limiter state cross-contamination"
  - "Email (Resend) enforcement row added to INVARIANTS.md per extension protocol before plan close"

patterns-established:
  - "vi.hoisted pattern: always use vi.hoisted() for mock variables referenced in vi.mock factory"
  - "Integration test user cleanup: delete by email in afterAll, never call pool.end() in nested describe blocks"

requirements-completed:
  - NOTF-01
  - NOTF-02
  - NOTF-03

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 26 Plan 03: Tests and Invariants Summary

**Vitest unit tests for zero-knowledge email body compliance and integration tests for notify persistence and dispatch via vi.mock ESM interception**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-21T04:05:51Z
- **Completed:** 2026-02-21T04:13:00Z
- **Tasks:** 2 of 3 complete (Task 3 is checkpoint:human-verify, awaiting user)
- **Files modified:** 3

## Accomplishments

- Created `notification.service.test.ts` with 4 unit tests verifying zero-knowledge email body invariant: correct recipient, timestamp present, no secretId/nanoid-shaped string in body, no-throw on Resend error
- Extended `secrets.test.ts` with Phase 26 describe block: 5 integration tests covering notify=true persistence for authenticated users, anonymous safety guard (notify always false), dispatch called on retrieval, and dispatch NOT called when notify=false or userId=null
- Updated `INVARIANTS.md` with Email (Resend) enforcement row per the extension protocol; last-updated bumped from Phase 23 to Phase 26

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification service unit tests + Phase 26 integration tests** - `2aa9b0f` (test)
2. **Task 2: INVARIANTS.md Email (Resend) row** - `407c54a` (docs)
3. **Task 3: Human UAT checkpoint** - awaiting user verification

## Files Created/Modified

- `server/src/services/notification.service.test.ts` - 4 unit tests for sendSecretViewedNotification; uses vi.hoisted + vi.mock to intercept Resend without real HTTP calls
- `server/src/routes/__tests__/secrets.test.ts` - Extended with Phase 26 describe block (5 new integration tests) + vi.mock for notification service at module level
- `.planning/INVARIANTS.md` - Added Email (Resend) enforcement row; last-updated updated to Phase 26

## Decisions Made

- `vi.hoisted()` required for mock function variable referenced inside `vi.mock()` factory — Vitest hoists `vi.mock` calls before variable initializations, so any variable referenced in the factory must also be hoisted via `vi.hoisted()`
- `vi.mock` at file level (not `vi.spyOn`) to intercept `sendSecretViewedNotification` in `secrets.service.ts` — ESM named imports are live bindings; `vi.mock` replaces the module binding in the module registry, ensuring the service under test uses the mock
- `await new Promise((resolve) => setImmediate(resolve))` after the HTTP request allows fire-and-forget `void sendSecretViewedNotification(...)` to resolve before asserting on the spy
- Dedicated `notifyTestApp = buildApp()` instance for Phase 26 tests to avoid rate limiter counter contamination with other test suites in the same file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.hoisted() required — variable initialization order**
- **Found during:** Task 1 (notification.service.test.ts creation)
- **Issue:** Initial test used `const mockSend = vi.fn()` at module level then referenced it inside `vi.mock()` factory. Vitest hoists `vi.mock` before variable initialization, causing `ReferenceError: Cannot access 'mockSend' before initialization`
- **Fix:** Wrapped `mockSend` creation in `vi.hoisted(() => ({ mockSend: vi.fn() }))` so it is available at hoist time
- **Files modified:** `server/src/services/notification.service.test.ts`
- **Verification:** All 4 unit tests pass after fix
- **Committed in:** `2aa9b0f` (Task 1 commit)

**2. [Rule 1 - Bug] @typescript-eslint/unbound-method lint errors on vi.mocked() pattern**
- **Found during:** Task 1 lint check after initial test writing
- **Issue:** Using `vi.mocked(resend.emails.send)` in `expect()` triggered `unbound-method` lint errors (6 errors)
- **Fix:** Replaced `import { resend }` + `vi.mocked(resend.emails.send)` pattern with `mockSend` local variable (same `vi.hoisted` variable), eliminating all bound-method references
- **Files modified:** `server/src/services/notification.service.test.ts`
- **Verification:** `npm run lint -- --max-warnings=0` passes with zero errors
- **Committed in:** `2aa9b0f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 x Rule 1 - Bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Next Phase Readiness

- Phase 26 testing complete pending human UAT (Task 3 checkpoint:human-verify)
- After UAT approval, Phase 27 is ready to begin
- All NOTF requirements (NOTF-01, NOTF-02, NOTF-03) satisfied

---
*Phase: 26-email-notifications*
*Completed: 2026-02-21*
