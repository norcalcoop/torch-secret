---
phase: 36-email-capture
plan: 03
subsystem: ui
tags: [email-capture, spa-router, noindex, fetch, gdpr]

# Dependency graph
requires:
  - phase: 36-01
    provides: marketingSubscribers schema + migration for email capture backend
provides:
  - POST /api/subscribers wired in home.ts with in-flight state and success/error handling
  - confirm.ts SPA page for /confirm?token= (loading/success/expired states)
  - unsubscribe.ts SPA page for /unsubscribe?token= (idempotent success)
  - /confirm and /unsubscribe router routes with noindex meta
  - /confirm and /unsubscribe in server NOINDEX_PREFIXES for X-Robots-Tag
affects: [36-02, 36-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "void handleSubmit() pattern for async addEventListener — avoids no-misused-promises"
    - "replaceFormWithSuccess() helper clears and replaces section DOM in-place (no re-render)"
    - "Idempotent unsubscribe: always show success regardless of token validity (no state leakage)"

key-files:
  created:
    - client/src/pages/confirm.ts
    - client/src/pages/unsubscribe.ts
  modified:
    - client/src/pages/home.ts
    - client/src/router.ts
    - server/src/app.ts

key-decisions:
  - "Extracted async submit logic to named handleSubmit() function — void handleSubmit() in event handler satisfies no-misused-promises without suppressing the rule"
  - "replaceFormWithSuccess() defined as module-level function, called with section captured in closure"
  - "Unsubscribe page always shows success regardless of token validity — no state leakage for attackers probing token validity"

patterns-established:
  - "void wrapper pattern: form.addEventListener('submit', (e) => { e.preventDefault(); void handleSubmit(); }) — use when async fetch is needed in DOM event handlers"

requirements-completed: [ECAP-01, ECAP-02, ECAP-04]

# Metrics
duration: 3min
completed: 2026-02-26
---

# Phase 36 Plan 03: Email Capture Client-Side Summary

**Real POST /api/subscribers call in home.ts with in-flight state; /confirm and /unsubscribe SPA pages with noindex at both server and client layers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-26T15:51:28Z
- **Completed:** 2026-02-26T15:54:48Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Replace Phase 32 showToast stub in home.ts with real fetch to POST /api/subscribers; shows in-flight 'Joining...' state; on 200 replaces form with success message echoing the email; on error restores button with inline message
- Create confirm.ts (loading spinner while fetching, 'You're on the list!' success with Try Torch Secret CTA, 'Confirmation link expired' error with Back to homepage)
- Create unsubscribe.ts (calls GET /api/subscribers/unsubscribe on load, always shows success — idempotent)
- Register /confirm and /unsubscribe routes in router.ts with noindex: true
- Add '/confirm' and '/unsubscribe' to NOINDEX_PREFIXES in server/src/app.ts for X-Robots-Tag header

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace home.ts stub + create confirm.ts + create unsubscribe.ts** - `01e43c7` (feat)
2. **Task 2: Add /confirm and /unsubscribe to router and NOINDEX_PREFIXES** - `5517add` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/src/pages/home.ts` - Removed showToast import; replaced stub submit handler with real API call; added replaceFormWithSuccess() helper
- `client/src/pages/confirm.ts` - New: /confirm?token= page with loading/success/expired states
- `client/src/pages/unsubscribe.ts` - New: /unsubscribe?token= page, always shows success
- `client/src/router.ts` - Added /confirm and /unsubscribe route branches before else-not_found
- `server/src/app.ts` - Added '/confirm' and '/unsubscribe' to NOINDEX_PREFIXES array

## Decisions Made

- Extracted async submit logic to named `handleSubmit()` function and called it with `void handleSubmit()` in the sync event handler. This satisfies `@typescript-eslint/no-misused-promises` without suppressing the rule or losing the async pattern.
- `replaceFormWithSuccess()` defined as a module-level function. `section` is captured in the closure inside `createEmailCaptureSection()` and passed as the first argument — avoids coupling the helper to the function's internals.
- Unsubscribe page always shows success regardless of token validity. Per CONTEXT.md: no state leakage for attackers probing token validity. The API call fires but the UI never reflects failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed no-misused-promises ESLint error on async submit handler**

- **Found during:** Task 1 commit (pre-commit hook)
- **Issue:** `form.addEventListener('submit', async (e) => {...})` returns Promise where void is expected — ESLint `@typescript-eslint/no-misused-promises` error
- **Fix:** Extracted async body to `handleSubmit()` named function; event handler calls `void handleSubmit()`
- **Files modified:** client/src/pages/home.ts
- **Verification:** `npx eslint client/src/pages/home.ts` — zero errors; commit succeeded on second attempt
- **Committed in:** 01e43c7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was required for ESLint compliance (pre-commit hook blocked first commit attempt). No scope creep. Functional behavior identical to plan spec.

## Issues Encountered

- Pre-commit ESLint hook rejected async event listener pattern on first commit attempt. Fixed by extracting async logic to named function + `void` call pattern. Second commit succeeded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client-side email capture flow is complete and verified (build passes, dynamic imports resolve to separate chunks: confirm-*.js, unsubscribe-*.js, home-*.js)
- Plan 02 (subscribers API implementation) can land independently — this plan's frontend will call the live endpoints once Plan 02 is merged
- Plan 04 (rate limiting / final wiring) can proceed

## Self-Check: PASSED

- FOUND: client/src/pages/confirm.ts
- FOUND: client/src/pages/unsubscribe.ts
- FOUND: .planning/phases/36-email-capture/36-03-SUMMARY.md
- FOUND: commit 01e43c7
- FOUND: commit 5517add

---
*Phase: 36-email-capture*
*Completed: 2026-02-26*
