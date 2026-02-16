---
phase: 05-password-protection
plan: 01
subsystem: auth
tags: [argon2id, password-hashing, owasp, rate-limiting, express, drizzle]

# Dependency graph
requires:
  - phase: 02-database-and-api
    provides: secrets table with passwordHash/passwordAttempts columns, secrets.service.ts, routes/secrets.ts
  - phase: 03-security-hardening
    provides: rate-limit.ts factory pattern, route-level rate limiting
provides:
  - Argon2id password hashing service (hashPassword, verifyPassword)
  - Password-aware secret creation (optional password on POST /api/secrets)
  - Non-destructive metadata endpoint (GET /api/secrets/:id/meta)
  - Password verification with atomic retrieve-and-destroy (POST /api/secrets/:id/verify)
  - 3-attempt auto-destroy on wrong passwords
  - GET /api/secrets/:id blocks password-protected secrets
affects: [05-02, 05-03, frontend-reveal-page, api-client]

# Tech tracking
tech-stack:
  added: [argon2 ^0.44.0]
  patterns: [password-service-wrapper, atomic-attempt-tracking, route-order-guards]

key-files:
  created:
    - server/src/services/password.service.ts
  modified:
    - shared/types/api.ts
    - server/src/services/secrets.service.ts
    - server/src/routes/secrets.ts
    - server/src/middleware/rate-limit.ts
    - package.json

key-decisions:
  - "Argon2id with OWASP minimum params (m=19456, t=2, p=1) via argon2 npm package"
  - "Password service is a thin wrapper around argon2 for testability and swappability"
  - "retrieveAndDestroy rejects password-protected secrets to prevent bypass via GET /:id"
  - "verifySecretLimiter: 15 attempts per 15 minutes per IP (defense-in-depth on top of per-secret 3-attempt limit)"
  - "Route order: POST /, GET /:id/meta, POST /:id/verify, GET /:id to prevent Express matching meta/verify as :id"

patterns-established:
  - "Password service wrapper: isolate argon2 behind hashPassword/verifyPassword for swappability"
  - "Atomic attempt tracking: SELECT + verify + increment/destroy in single DB transaction"
  - "Auto-destroy pattern: zero ciphertext then delete after MAX_PASSWORD_ATTEMPTS failures"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 5 Plan 1: Backend Password Protection Summary

**Argon2id password hashing service with password-aware CRUD, atomic 3-attempt verification, and auto-destroy via meta/verify endpoints**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T19:18:18Z
- **Completed:** 2026-02-14T19:21:59Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created password.service.ts with Argon2id hashPassword/verifyPassword using OWASP-recommended parameters
- Extended API types with password field on CreateSecretSchema, plus VerifySecretSchema, MetaResponse, VerifySecretResponse, VerifyErrorResponse
- Updated secrets.service.ts with password-aware createSecret, getSecretMeta, verifyAndRetrieve (atomic attempt tracking + auto-destroy), and guarded retrieveAndDestroy
- Added GET /:id/meta for non-destructive metadata check and POST /:id/verify with dedicated rate limiter
- All 115 existing tests pass unchanged -- non-password flows are fully backward compatible

## Task Commits

Each task was committed atomically:

1. **Task 1: Password hashing service, API types, and secrets service updates** - `ba65fec` (feat)
2. **Task 2: Route handlers and rate limiter for meta and verify endpoints** - `7ca6adb` (feat)

## Files Created/Modified
- `server/src/services/password.service.ts` - Argon2id hashPassword/verifyPassword with OWASP params
- `shared/types/api.ts` - Added password to CreateSecretSchema, VerifySecretSchema, MetaResponse, VerifySecretResponse, VerifyErrorResponse
- `server/src/services/secrets.service.ts` - Password-aware createSecret, getSecretMeta, verifyAndRetrieve, guarded retrieveAndDestroy
- `server/src/routes/secrets.ts` - GET /:id/meta, POST /:id/verify endpoints with proper route ordering
- `server/src/middleware/rate-limit.ts` - verifySecretLimiter factory (15 req/15min)
- `package.json` / `package-lock.json` - Added argon2 ^0.44.0

## Decisions Made
- Used argon2 npm package (^0.44.0) with OWASP minimum Argon2id parameters (memoryCost: 19456, timeCost: 2, parallelism: 1) -- industry standard, native worker threads for non-blocking hashing
- Password service is a thin wrapper for testability and library swappability
- retrieveAndDestroy rejects password-protected secrets (returns null) to prevent bypassing password via direct GET /:id API call
- verifySecretLimiter set to 15 attempts per 15 minutes per IP -- defense-in-depth on top of per-secret 3-attempt auto-destroy
- Route order explicitly documented and enforced: POST /, GET /:id/meta, POST /:id/verify, GET /:id

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend password protection endpoints are operational
- Ready for 05-02 (integration tests for password protection flows)
- Ready for 05-03 (frontend password entry UI on reveal page)
- Existing non-password flows are fully backward compatible

## Self-Check: PASSED

- All 6 key files verified present on disk
- Commit ba65fec (Task 1) verified in git log
- Commit 7ca6adb (Task 2) verified in git log
- 115/115 tests passing
- No type errors in server/shared files

---
*Phase: 05-password-protection*
*Completed: 2026-02-14*
