---
phase: 02-database-and-api
plan: 02
subsystem: api
tags: [express, zod, drizzle-orm, validation, error-handling, atomic-delete, zero-knowledge]

# Dependency graph
requires:
  - phase: 02-database-and-api
    plan: 01
    provides: Drizzle secrets schema, db connection pool, env config, pino logger, shared API types
provides:
  - Zod validation middleware factory (validateBody, validateParams) for Express routes
  - Global error handler that logs without leaking internals
  - Secrets service with createSecret and atomic retrieveAndDestroy (SELECT -> ZERO -> DELETE)
  - Express router with POST /api/secrets and GET /api/secrets/:id
  - App factory (buildApp) for testing and production
  - HTTP server entry point with graceful shutdown
affects: [02-03-PLAN, 03-security-hardening, 04-frontend, 05-password-protection]

# Tech tracking
tech-stack:
  added: []
  patterns: [Zod middleware factory pattern, atomic zero-then-delete transaction, anti-enumeration identical error responses, app factory for supertest, Express 5 async handlers]

key-files:
  created:
    - server/src/middleware/validate.ts
    - server/src/middleware/error-handler.ts
    - server/src/services/secrets.service.ts
    - server/src/routes/secrets.ts
    - server/src/app.ts
    - server/src/server.ts
  modified:
    - server/tsconfig.json

key-decisions:
  - "ZodType used for generic schema constraint (zod 4.x removed ZodSchema)"
  - "Express 5 req.params.id typed as string via assertion after Zod validation"
  - "Server tsconfig rootDir expanded to project root to include shared types"
  - "Ciphertext zeroing uses null byte repeat matching original length before deletion"

patterns-established:
  - "Validation middleware: validateBody(Schema) / validateParams(Schema) as route middleware"
  - "Anti-enumeration: SECRET_NOT_AVAILABLE constant used for all not-found/expired/viewed cases"
  - "Zero-then-delete: SELECT -> UPDATE(zero ciphertext) -> DELETE in single transaction"
  - "App factory: buildApp() returns configured Express app without starting HTTP server"

# Metrics
duration: 2min
completed: 2026-02-14
---

# Phase 2 Plan 02: Core API Summary

**Express 5 API with Zod validation middleware, atomic zero-then-delete secrets service, anti-enumeration error responses, and app factory for testing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-14T13:09:37Z
- **Completed:** 2026-02-14T13:12:22Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Zod validation middleware factory rejects invalid input with structured 400 error details
- Secrets service implements atomic retrieve-and-destroy with ciphertext zeroing (SECR-08 data remanence mitigation)
- Anti-enumeration constant ensures identical 404 responses for nonexistent, expired, and already-viewed secrets (SECR-07)
- App factory pattern enables supertest integration testing without port conflicts
- Server entry point handles graceful SIGTERM/SIGINT shutdown with pool cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validation middleware, error handler, and secrets service** - `4cc0757` (feat)
2. **Task 2: Create route handlers, app factory, and server entry point** - `2a3aa3c` (feat)

## Files Created/Modified
- `server/src/middleware/validate.ts` - Zod validation middleware factory for body and params
- `server/src/middleware/error-handler.ts` - Global Express error handler with safe logging
- `server/src/services/secrets.service.ts` - createSecret and atomic retrieveAndDestroy with zero-then-delete
- `server/src/routes/secrets.ts` - POST /api/secrets and GET /api/secrets/:id with anti-enumeration
- `server/src/app.ts` - Express app factory (buildApp) with middleware stack
- `server/src/server.ts` - HTTP server startup with graceful shutdown
- `server/tsconfig.json` - Expanded rootDir and include to encompass shared types

## Decisions Made
- **ZodType over ZodSchema:** Zod 4.x removed `ZodSchema` -- used `ZodType<T>` for the generic constraint in validation middleware.
- **Express 5 params assertion:** Express 5 types `req.params` values as `string | string[]`. Since Zod validates the param is a string, a safe `as string` assertion avoids unnecessary runtime checks.
- **Server tsconfig rootDir expansion:** Changed rootDir from `src` to `..` and added `../shared/**/*.ts` to include, so server code can import shared types with proper NodeNext module resolution.
- **Null byte repeat for zeroing:** Ciphertext overwritten with `'\x00'.repeat(ciphertext.length)` to match the original length exactly, maximizing data remanence mitigation in PostgreSQL WAL.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed server tsconfig to include shared types**
- **Found during:** Task 2 (route handlers importing shared/types/api.ts)
- **Issue:** Server tsconfig had `rootDir: "src"` and `include: ["src/**/*.ts"]` which excluded `shared/types/api.ts`. Import `../../shared/types/api.js` could not be resolved under NodeNext module resolution.
- **Fix:** Changed rootDir to `..` (project root) and added `../shared/**/*.ts` to include array. Updated import path to `../../../shared/types/api.js`.
- **Files modified:** server/tsconfig.json, server/src/routes/secrets.ts
- **Verification:** `npx tsc --project server/tsconfig.json --noEmit` passes cleanly
- **Committed in:** 2a3aa3c (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed Express 5 req.params type for retrieveAndDestroy**
- **Found during:** Task 2 (GET /:id route handler)
- **Issue:** Express 5 types `req.params` values as `string | string[]`, causing TS2345 when passing `req.params.id` to `retrieveAndDestroy(id: string)`.
- **Fix:** Added `as string` type assertion after Zod validation ensures the param is a valid string.
- **Files modified:** server/src/routes/secrets.ts
- **Verification:** `npx tsc --project server/tsconfig.json --noEmit` passes cleanly
- **Committed in:** 2a3aa3c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete API implementation ready for integration testing in Plan 02-03
- buildApp() factory enables supertest testing without database or port dependencies (with mocking)
- All exports match the must_haves artifacts specification from the plan
- Routes, services, middleware, and app factory form the complete request pipeline

## Self-Check: PASSED

All 7 files verified present. Both task commits (4cc0757, 2a3aa3c) verified in git log.

---
*Phase: 02-database-and-api*
*Completed: 2026-02-14*
