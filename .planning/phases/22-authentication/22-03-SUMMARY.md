---
phase: 22-authentication
plan: 03
subsystem: auth
tags: [better-auth, express, middleware, session, toNodeHandler]

# Dependency graph
requires:
  - phase: 22-01
    provides: auth.ts with betterAuth instance, AuthUser/AuthSessionData types, and BETTER_AUTH_URL env var
provides:
  - Express app with Better Auth handler mounted at /api/auth/{*splat} before express.json()
  - requireAuth Express middleware that validates Better Auth sessions via auth.api.getSession()
  - GET /api/me route returning authenticated user profile (id, email, name, emailVerified, image, createdAt)
affects: [22-04, 22-05, 22-06, any future plan adding protected API routes]

# Tech tracking
tech-stack:
  added: [toNodeHandler (better-auth/node), fromNodeHeaders (better-auth/node)]
  patterns:
    - Better Auth handler mounted before express.json() to prevent body-stream conflict
    - Auth middleware pattern using auth.api.getSession() + fromNodeHeaders() for session validation
    - Zero-knowledge invariant comments on all files that touch userId

key-files:
  created:
    - server/src/middleware/require-auth.ts
    - server/src/routes/me.ts
  modified:
    - server/src/app.ts

key-decisions:
  - "toNodeHandler(auth) mounted with app.all('/api/auth/{*splat}') BEFORE express.json() — body-stream conflict would cause silent hangs on all auth requests if order is reversed"
  - "/api/me mounted after secrets router but before /api catch-all — catch-all is now definitively last /api/* handler"
  - "requireAuth uses auth.api.getSession() + fromNodeHeaders() — canonical Better Auth session validation pattern for Express"

patterns-established:
  - "Protected route pattern: import requireAuth, add as first middleware arg to router.get/post handler"
  - "Zero-knowledge invariant comments mandatory on any file touching userId (requireAuth.ts, me.ts)"

requirements-completed: [AUTH-03, AUTH-05, AUTH-08]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 22 Plan 03: Express Auth Wiring Summary

**Better Auth wired into Express: handler before body parser, requireAuth session middleware, and /api/me profile endpoint**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T13:24:24Z
- **Completed:** 2026-02-19T13:26:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Mounted `toNodeHandler(auth)` at `/api/auth/{*splat}` before `express.json()` — prevents body-stream conflict that causes auth requests to hang
- Created `requireAuth` middleware using `auth.api.getSession()` + `fromNodeHeaders()` for Express-native session validation
- Created `GET /api/me` route returning user profile (id, email, name, emailVerified, image, createdAt), guarded by requireAuth
- Corrected /api handler ordering: auth handler -> json parser -> health -> secrets -> me -> /api catch-all

## Task Commits

Each task was committed atomically:

1. **Task 1: Update app.ts to mount Better Auth handler** - `764b063` (feat)
2. **Task 2: Create requireAuth middleware and /api/me route** - `700da92` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/src/app.ts` - Imports toNodeHandler/auth/meRouter; mounts auth handler before express.json(); adds /api/me route; moves /api catch-all to last position
- `server/src/middleware/require-auth.ts` - requireAuth async middleware validating Better Auth sessions via auth.api.getSession()
- `server/src/routes/me.ts` - meRouter with GET / handler guarded by requireAuth, returns user profile

## Decisions Made
- `toNodeHandler(auth)` at `/api/auth/{*splat}` must be before `express.json()` — body-stream ordering is the critical constraint; reversed order causes silent hangs on all auth requests
- `/api/me` placed after secrets router and before the `/api` catch-all — the catch-all is now definitively the last /api/* handler, preventing 404 interception of /api/me
- `requireAuth` uses `auth.api.getSession()` with `fromNodeHeaders()` — matches the canonical Better Auth pattern for Express (consistent with how 22-01 established the auth object)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly on first attempt. ESLint/Prettier from pre-commit hooks ran without issues.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server is now fully auth-capable: /api/auth/* handles sign-up/sign-in/sign-out, /api/me returns session user
- requireAuth is ready to guard any future protected routes
- Plan 04 (email verification flow) and Plan 06 (integration tests) can proceed
- No blockers

---
*Phase: 22-authentication*
*Completed: 2026-02-19*

## Self-Check: PASSED

- server/src/middleware/require-auth.ts: FOUND
- server/src/routes/me.ts: FOUND
- .planning/phases/22-authentication/22-03-SUMMARY.md: FOUND
- Commit 764b063 (app.ts): FOUND
- Commit 700da92 (require-auth.ts, me.ts): FOUND
