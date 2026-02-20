---
phase: 23-secret-dashboard
plan: 02
subsystem: api
tags: [express, drizzle, postgresql, better-auth, pino, secrets, dashboard, soft-delete]

# Dependency graph
requires:
  - phase: 23-01
    provides: secrets table with label, notify, status, viewedAt columns; DashboardSecretItem/List/Delete types
  - phase: 22-authentication
    provides: Better Auth session infrastructure; requireAuth middleware; AuthUser type
  - phase: 21-schema-foundation
    provides: secrets.user_id nullable FK; zero-knowledge invariant documented

provides:
  - GET /api/dashboard/secrets endpoint (metadata-only, auth-gated)
  - DELETE /api/dashboard/secrets/:id endpoint (soft-delete, auth-gated, owner-verified)
  - optionalAuth middleware for POST /api/secrets
  - getUserSecrets() and deleteUserSecret() service functions
  - Soft-delete lifecycle in retrieveAndDestroy() and verifyAndRetrieve()
  - Split expiration worker: user-owned soft-expire, anonymous hard-delete
  - Logger redaction extended to /api/dashboard/secrets/:id paths
  - INVARIANTS.md Phase 23 enforcement row added

affects:
  - 23-03 (dashboard UI — calls GET /api/dashboard/secrets, DELETE /api/dashboard/secrets/:id)
  - 23-04 (tests — tests these new service functions and routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - optionalAuth middleware pattern: sets res.locals.user if session present, always calls next()
    - Soft-delete lifecycle branching in service layer (user-owned vs anonymous)
    - Dashboard route factory pattern matching createSecretsRouter() pattern
    - Transactional owner verification in deleteUserSecret() prevents TOCTOU

key-files:
  created:
    - server/src/middleware/optional-auth.ts
    - server/src/routes/dashboard.ts
  modified:
    - server/src/services/secrets.service.ts
    - server/src/workers/expiration-worker.ts
    - server/src/middleware/logger.ts
    - server/src/routes/secrets.ts
    - server/src/app.ts
    - .planning/INVARIANTS.md

key-decisions:
  - "optionalAuth never returns 401 — failure is non-fatal; anonymous users proceed without session"
  - "deleteUserSecret() owner+status check inside transaction — prevents TOCTOU race between check and update"
  - "Auto-destroy on password failure always hard-deletes (even user-owned) — no dashboard history for brute-force targets"
  - "Expiration worker return count = hard-deleted anonymous rows only (user-owned updates don't produce row count)"
  - "getUserSecrets() explicit column list (no SELECT *) is the only enforcement mechanism preventing ciphertext/passwordHash leakage at API layer"

patterns-established:
  - "Dashboard router factory: createDashboardRouter() follows createSecretsRouter() factory pattern"
  - "Soft-delete branching: all service functions check secret.userId !== null before choosing soft vs hard path"

requirements-completed: [DASH-01, DASH-02, DASH-04, DASH-05]

# Metrics
duration: 4min
completed: 2026-02-20
---

# Phase 23 Plan 02: Dashboard Backend API Summary

**Dashboard API routes with soft-delete lifecycle: GET/DELETE /api/dashboard/secrets behind requireAuth, optionalAuth wired to POST /api/secrets, user-owned secrets soft-delete on view/expire/delete while anonymous secrets continue hard-deleting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-20T19:24:21Z
- **Completed:** 2026-02-20T19:28:41Z
- **Tasks:** 3 (Task 0 + Task 1 + Task 2)
- **Files modified:** 8

## Accomplishments

- Created optionalAuth middleware: links authenticated users' secrets to their account on POST /api/secrets without blocking anonymous access
- Extended secrets.service.ts with four new capabilities: getUserSecrets() (metadata-only SELECT), deleteUserSecret() (transactional owner-verified soft-delete), and soft-delete branching in retrieveAndDestroy() + verifyAndRetrieve()
- Created dashboard.ts router with GET /api/dashboard/secrets and DELETE /api/dashboard/secrets/:id, both behind requireAuth, registered in app.ts
- Split expiration worker: user-owned expired rows set to status='expired' (row preserved), anonymous expired rows hard-deleted (unchanged behavior)
- Extended logger redactUrl to cover /api/dashboard/secrets/:id paths, closing the zero-knowledge invariant logging gap
- Updated INVARIANTS.md enforcement table with Phase 23 entry per CLAUDE.md mandatory protocol
- All 37 existing tests pass (32 secrets route + 5 expiration worker)

## Task Commits

Each task was committed atomically:

1. **Task 0: Update INVARIANTS.md enforcement table** - `d5eab12` (chore)
2. **Task 1: optionalAuth + extended service + worker + logger** - `80cc4e8` (feat)
3. **Task 2: Dashboard route, app.ts registration, optional auth wiring** - `b4c3726` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `server/src/middleware/optional-auth.ts` - New: optionalAuth middleware; sets res.locals.user if session exists, always calls next()
- `server/src/routes/dashboard.ts` - New: GET /api/dashboard/secrets and DELETE /api/dashboard/secrets/:id behind requireAuth
- `server/src/services/secrets.service.ts` - Extended: createSecret() with userId+label; retrieveAndDestroy()/verifyAndRetrieve() soft-delete branching; getUserSecrets() and deleteUserSecret() new functions
- `server/src/workers/expiration-worker.ts` - Updated: split logic — user-owned soft-expire (status=expired), anonymous hard-delete
- `server/src/middleware/logger.ts` - Updated: redactUrl extended with /api/dashboard/secrets/:id regex
- `server/src/routes/secrets.ts` - Updated: optionalAuth added to POST /, userId+label passed to createSecret()
- `server/src/app.ts` - Updated: createDashboardRouter imported and registered at /api/dashboard
- `.planning/INVARIANTS.md` - Updated: Phase 23 enforcement row for dashboard logger redaction

## Decisions Made

- optionalAuth never returns 401 — session check failure is non-fatal; anonymous users proceed unchanged
- deleteUserSecret() owner verification and status check happen inside the transaction to prevent TOCTOU
- Auto-destroy on password brute-force (MAX_PASSWORD_ATTEMPTS exceeded) always hard-deletes even for user-owned secrets — brute-force targets do not get dashboard history
- Expiration worker return count reflects only hard-deleted anonymous rows; user-owned soft-expires produce no row count change (acceptable — cron log is best-effort)
- getUserSecrets() uses explicit column list in SELECT (not SELECT *) as the sole enforcement mechanism preventing ciphertext/passwordHash from appearing in dashboard API responses

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 23-03 (dashboard UI) can now call GET /api/dashboard/secrets and DELETE /api/dashboard/secrets/:id
- Plan 23-04 (backend tests) can now write integration tests for getUserSecrets(), deleteUserSecret(), and the new dashboard routes
- POST /api/secrets now captures userId when authenticated — authenticated user secrets will appear in the dashboard after plan 23-03 ships

## Self-Check: PASSED

All files present and all commits verified:
- `server/src/middleware/optional-auth.ts` — FOUND
- `server/src/routes/dashboard.ts` — FOUND
- `server/src/services/secrets.service.ts` — FOUND
- `server/src/workers/expiration-worker.ts` — FOUND
- `server/src/middleware/logger.ts` — FOUND
- `server/src/routes/secrets.ts` — FOUND
- `server/src/app.ts` — FOUND
- `.planning/INVARIANTS.md` — FOUND
- commit d5eab12 (Task 0) — FOUND
- commit 80cc4e8 (Task 1) — FOUND
- commit b4c3726 (Task 2) — FOUND

---
*Phase: 23-secret-dashboard*
*Completed: 2026-02-20*
