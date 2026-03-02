---
phase: 40-security-remediation-and-concerns-pre-launch
plan: 01
subsystem: api
tags: [rate-limit, argon2, express-rate-limit, p-limit, security, dos-protection]

# Dependency graph
requires:
  - phase: 34.1-passphrase-password-tier-enforcement
    provides: POST /api/secrets/:id/verify endpoint with Argon2id password verification

provides:
  - createVerifyTightLimiter exported from rate-limit.ts (5 req/min/IP burst guard)
  - wrapStoreWithWarnOnError applied to all 5 rate limiter stores (Redis observability)
  - isE2E dual-condition gate (NODE_ENV=test AND E2E_TEST=true)
  - Argon2id concurrency cap (max 4 simultaneous operations via p-limit)
  - 100KB ciphertext Zod max in CreateSecretSchema
  - 413 payload_too_large handler in error-handler.ts
  - 503 service_unavailable handler with Retry-After header

affects:
  - 40-02, 40-03, 40-04, 40-05 (all phase 40 plans build on this security foundation)

# Tech tracking
tech-stack:
  added: [p-limit@6.x]
  patterns:
    - wrapStoreWithWarnOnError pattern: wrap Store.increment to log+rethrow on Redis error
    - Dual-condition E2E gate: isE2E requires both NODE_ENV=test AND E2E_TEST=true
    - Layered rate limiting: tight burst guard (5/1min) before sustained limiter (15/15min)
    - p-limit concurrency cap on CPU-intensive operations (verifyPassword only)
    - 413/503 specific error handlers before generic 500 in error-handler.ts

key-files:
  created: []
  modified:
    - server/src/middleware/rate-limit.ts
    - server/src/services/password.service.ts
    - server/src/routes/secrets.ts
    - shared/types/api.ts
    - server/src/middleware/error-handler.ts
    - package.json

key-decisions:
  - "wrapStoreWithWarnOnError wraps Store.increment (not the store itself) — cleanest intercept point for passOnStoreError + observability without replacing the whole store"
  - "p-limit cap on verifyPassword only — hashPassword is already protected by creation rate limiters per CONTEXT.md"
  - "createVerifyTightLimiter fires BEFORE verifySecretLimiter in middleware chain — rate limiting must precede expensive Argon2id computation"
  - "413/503 handlers placed BEFORE logger.error call — avoids polluting error logs with expected client and infrastructure events"
  - "isE2E dual-condition gate: single E2E_TEST=true alone is insufficient; NODE_ENV=test must also be set to prevent accidental production bypass"

patterns-established:
  - "Layered rate limiting pattern: tight burst guard + sustained window limiter applied in order on same route"
  - "wrapStoreWithWarnOnError: intercept increment() to add Pino warn observability before re-throwing for passOnStoreError handling"
  - "p-limit for CPU-bounded concurrency: wrap only the expensive operation, not the whole handler"

requirements-completed: [D1, D2, SR-014, SR-015]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 40 Plan 01: Security Hardening — Rate Limit, Argon2 Cap, Payload Limit

**Layered DoS protection: 5 req/min burst limiter + pLimit(4) Argon2id cap on POST /verify, 100KB payload ceiling with 413/503 error handlers, and Redis observability via wrapStoreWithWarnOnError**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-02T00:12:56Z
- **Completed:** 2026-03-02T00:16:17Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added `createVerifyTightLimiter` (5 req/min/IP) as first middleware on POST /:id/verify, layered before existing 15/15min limiter — ensures rate limiting fires before Argon2id computation
- Wrapped `verifyPassword` with `pLimit(4)` concurrency cap — prevents CPU exhaustion DoS from distributed IPs that slip through rate limiting (passes SR-015)
- Tightened ciphertext Zod max from 200K to 100K chars and added 413 `payload_too_large` handler to match existing `express.json({ limit: '100kb' })` enforcement (SR-014)
- Added `wrapStoreWithWarnOnError` to all 5 rate limiter stores — Pino warn fires on Redis error before passOnStoreError allows request through
- Hardened isE2E gate: now requires both `NODE_ENV=test` AND `E2E_TEST=true` (single variable alone no longer bypasses production limits)
- Added 503 `service_unavailable` handler with `Retry-After: 30` for PostgreSQL pool exhaustion

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createVerifyTightLimiter, harden isE2E gate, add passOnStoreError warn logging** - `546986e` (feat)
2. **Task 2: p-limit Argon2id concurrency cap + payload limit + error handler hardening** - `f4576cd` (feat)

**Plan metadata:** [see final commit below]

## Files Created/Modified

- `server/src/middleware/rate-limit.ts` - Added wrapStoreWithWarnOnError helper, applied to all 5 limiters, hardened isE2E dual-condition, exported createVerifyTightLimiter
- `server/src/services/password.service.ts` - Added p-limit import and argon2Limit = pLimit(4), wrapped verifyPassword
- `server/src/routes/secrets.ts` - Imported createVerifyTightLimiter, wired as first middleware on POST /:id/verify
- `shared/types/api.ts` - ciphertext max 200_000 -> 100_000 (SR-014)
- `server/src/middleware/error-handler.ts` - Added 413 entity.too.large handler and 503 pool timeout handler before generic 500
- `package.json` / `package-lock.json` - Added p-limit dependency

## Decisions Made

- **wrapStoreWithWarnOnError intercepts `store.increment`** — cleanest hook point; re-throwing after logging allows express-rate-limit's `passOnStoreError` to handle the error normally while giving Pino visibility
- **p-limit cap on verifyPassword only** — hashPassword is already protected by creation rate limiters per CONTEXT.md; capping hash would break legitimate registrations
- **Layered limiter order** — tight (5/1min) fires first before sustained (15/15min) and before Argon2id; ensures burst attacks hit rate limit before touching CPU
- **413/503 before logger.error** — avoids polluting error logs with expected infrastructure events (payload too large = client error; pool timeout = transient infra)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing ESLint errors in `server/src/routes/__tests__/auth.test.ts` (2 unused variable warnings). These pre-existed before this plan and are out-of-scope. Logged to deferred-items.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 40 Plan 02 can proceed: rate-limit.ts exports are stable, password.service.ts concurrency cap is active
- All 51 existing secrets tests pass with the new middleware chain and reduced payload limit
- Pre-existing auth.test.ts lint warnings (unrelated to this plan) should be addressed in a future cleanup task

---
*Phase: 40-security-remediation-and-concerns-pre-launch*
*Completed: 2026-03-02*
