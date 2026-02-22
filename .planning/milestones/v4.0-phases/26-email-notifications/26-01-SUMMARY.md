---
phase: 26-email-notifications
plan: 01
subsystem: api
tags: [resend, email, notifications, drizzle, secrets, fire-and-forget]

# Dependency graph
requires:
  - phase: 23-secret-dashboard
    provides: secrets schema with notify column and userId FK; createSecret/retrieveAndDestroy/verifyAndRetrieve service functions
  - phase: 22-better-auth
    provides: users table with email column; Better Auth session management
  - phase: 26-email-notifications research
    provides: Resend email.ts singleton; RESEND_FROM_EMAIL env var in config/env.ts

provides:
  - notification.service.ts with sendSecretViewedNotification(userEmail, viewedAt) fire-and-forget Resend call
  - createSecret() persists notify param (anonymous secrets always get notify=false)
  - retrieveAndDestroy() and verifyAndRetrieve() JOIN users table to get email in single round-trip
  - Fire-and-forget notification dispatch after transaction commits when notify=true and userId non-null and email non-null
  - secrets.ts route passes userId ? (body.notify ?? false) : false to createSecret

affects: [26-email-notifications, 27-any-future-notification-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget notification: void asyncFn() called after Drizzle transaction callback returns"
    - "Single JOIN round-trip: leftJoin(users) in secrets SELECT resolves userId->email without second query"
    - "Spread destructure: const { userEmail, ...secretRow } = secret separates extra JOIN field from Secret return type"

key-files:
  created:
    - server/src/services/notification.service.ts
  modified:
    - server/src/services/secrets.service.ts
    - server/src/routes/secrets.ts

key-decisions:
  - "Fire-and-forget notification called AFTER transaction callback returns — Drizzle transaction commits before the outer void dispatch runs, eliminating risk of Resend HTTP round-trip holding open a PostgreSQL connection"
  - "leftJoin(users) added to retrieveAndDestroy and verifyAndRetrieve Step 1 SELECT — resolves userId->email in a single DB round-trip; null coalesces safely when userId is null (LEFT JOIN returns null userEmail)"
  - "Spread destructure pattern const { userEmail, ...secretRow } separates JOIN-injected field from Secret return type — secretRow satisfies Secret interface without adding userEmail to the type"
  - "Non-null assertion secretRow.passwordHash! in verifyPassword call — TypeScript cannot narrow through spread destructure; !secret.passwordHash guard above guarantees non-null before destructure"
  - "Anonymous safety enforced at two layers: route enforces userId ? notify : false; service checks userId !== null before dispatch — defense-in-depth"

patterns-established:
  - "Notification dispatch pattern: if (secretRow.notify && secretRow.userId !== null && userEmail) { void sendSecretViewedNotification(userEmail, new Date()); }"

requirements-completed: [NOTF-02, NOTF-03]

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 26 Plan 01: Email Notifications Backend Summary

**Resend notification service wired into secrets service via fire-and-forget dispatch after atomic transaction, with single leftJoin round-trip to resolve userId->email**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-21T03:54:39Z
- **Completed:** 2026-02-21T03:57:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created notification.service.ts with sendSecretViewedNotification() that sends timestamp-only email body via Resend, zero-knowledge compliant
- Extended createSecret() to persist the notify param; anonymous secrets always stored with notify=false regardless of client input
- Updated retrieveAndDestroy() and verifyAndRetrieve() to JOIN users table in Step 1 SELECT, dispatch fire-and-forget email after transaction resolves
- Updated POST /api/secrets route to pass notify with anonymous-safety guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create notification service and update createSecret to persist notify** - `8d60b30` (feat)
2. **Task 2: Update secrets route to pass notify through to createSecret** - `22a542b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/src/services/notification.service.ts` - sendSecretViewedNotification fire-and-forget Resend call (new)
- `server/src/services/secrets.service.ts` - createSecret notify param; retrieveAndDestroy/verifyAndRetrieve with leftJoin + notification dispatch
- `server/src/routes/secrets.ts` - POST / passes userId ? (body.notify ?? false) : false to createSecret

## Decisions Made
- Fire-and-forget void dispatch called after Drizzle transaction callback returns — transaction commits before Resend HTTP call, no PostgreSQL connection held open during network I/O
- leftJoin(users) in secrets retrieval SELECT resolves userId->email without a second DB query — null userEmail from LEFT JOIN is safe: the dispatch condition guards on userEmail truthiness
- Non-null assertion `secretRow.passwordHash!` in verifyPassword call is correct — TypeScript cannot track narrowing through spread destructure; the `!secret.passwordHash` early-return guard above guarantees non-null before the spread
- Removed unnecessary `// eslint-disable-next-line no-console` directive — ESLint config does not enable the no-console rule, so the directive triggered an "unused directive" warning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused eslint-disable directive**
- **Found during:** Task 1 (notification service creation)
- **Issue:** Plan code snippet included `// eslint-disable-next-line no-console` but the project's ESLint config does not enable the no-console rule, causing an "unused disable directive" warning
- **Fix:** Removed the directive; the console.error call is clean with no lint issues
- **Files modified:** server/src/services/notification.service.ts
- **Verification:** npm run lint passes with zero errors and zero warnings
- **Committed in:** 8d60b30 (Task 1 commit)

**2. [Rule 1 - Bug] Added non-null assertion on secretRow.passwordHash**
- **Found during:** Task 1 (verifyAndRetrieve update)
- **Issue:** After `const { userEmail, ...secretRow } = secret`, TypeScript cannot track narrowing from the `!secret.passwordHash` guard through the spread destructure, so `secretRow.passwordHash` remains `string | null` — passing it to `verifyPassword(hash: string)` would be a type error
- **Fix:** Added `secretRow.passwordHash!` non-null assertion with a comment explaining the invariant
- **Files modified:** server/src/services/secrets.service.ts
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** 8d60b30 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes necessary for clean lint and correct TypeScript. No scope creep.

## Issues Encountered
None — both deviations were minor and resolved inline.

## User Setup Required
None - no additional external service configuration required beyond what was set up in Phase 22 (RESEND_API_KEY and RESEND_FROM_EMAIL already in env schema).

## Next Phase Readiness
- Backend notification dispatch fully wired; createSecret persists notify; retrieval functions dispatch fire-and-forget email when notify=true and owner email is resolved
- Ready for Phase 26 Plan 02: frontend notification toggle UI on the create page
- Zero-knowledge invariant maintained throughout: no secretId appears in notification email body or dispatch log lines

---
*Phase: 26-email-notifications*
*Completed: 2026-02-21*

## Self-Check: PASSED
- notification.service.ts: FOUND
- secrets.service.ts: FOUND
- secrets.ts route: FOUND
- 26-01-SUMMARY.md: FOUND
- Commit 8d60b30: FOUND
- Commit 22a542b: FOUND
