---
phase: 27-conversion-prompts-rate-limits-legal-pages
plan: "01"
subsystem: rate-limiting
tags:
  - rate-limits
  - auth-aware
  - expiresIn-enforcement
  - conversion
  - api
dependency_graph:
  requires:
    - "Phase 22: Better Auth + optionalAuth middleware"
    - "Phase 23: optionalAuth in secrets route"
  provides:
    - "Three auth-aware rate limiter factories (anon 3/hr, anon 10/day, authed 20/day)"
    - "expiresIn tier enforcement in POST /api/secrets (anon max 1h, authed max 7d)"
    - "ApiError.rateLimitReset field for client countdown display on upsell prompts"
  affects:
    - "POST /api/secrets middleware chain and handler"
    - "client/src/api/client.ts createSecret() error handling"
    - "All server integration tests using POST /api/secrets"
tech_stack:
  added: []
  patterns:
    - "Auth-aware rate limiter: skip callback reads res.locals.user (set by optionalAuth)"
    - "Per-user rate limiter keyGenerator: uses userId not IP (avoids NAT false positives)"
    - "standardHeaders: 'draft-6' for standalone RateLimit-Reset header (not draft-7 combined)"
    - "standardHeaders: false on daily limiter to prevent overwriting hourly headers"
key_files:
  created: []
  modified:
    - "server/src/middleware/rate-limit.ts"
    - "server/src/routes/secrets.ts"
    - "client/src/api/client.ts"
    - "server/src/routes/__tests__/secrets.test.ts"
    - "server/src/routes/__tests__/security.test.ts"
    - "server/src/routes/__tests__/expiration.test.ts"
decisions:
  - "standardHeaders: 'draft-6' (not 'draft-7') on createAnonHourlyLimiter — draft-7 embeds reset in combined RateLimit header; draft-6 emits standalone RateLimit-Reset the client reads directly for countdown display"
  - "standardHeaders: false on createAnonDailyLimiter — prevents daily window headers from overwriting hourly RateLimit-Reset that client uses for CONV-06 countdown"
  - "createAuthedDailyLimiter keyGenerator uses userId not req.ip — avoids shared-IP false positives for authenticated users on NAT/corporate networks"
  - "optionalAuth must precede all rate limiters in POST / middleware chain — skip callbacks read res.locals.user which optionalAuth populates"
  - "expiresIn caps enforced in handler (not Zod schema) — Zod enum allows all values; server-side tier guard added after rate limiters pass"
metrics:
  duration_minutes: 7
  completed_date: "2026-02-21"
  tasks_completed: 3
  files_modified: 6
---

# Phase 27 Plan 01: Auth-Aware Rate Limits + expiresIn Caps Summary

**One-liner:** Auth-aware rate limiters (anon 3/hr + 10/day, authed 20/day) with expiresIn tier caps (anon max 1h, authed max 7d) and ApiError.rateLimitReset for client countdown display.

## What Was Built

Replaced the single `createSecretLimiter` (10 req/hr, no auth awareness) with three auth-aware factories and added server-side expiresIn tier enforcement to POST /api/secrets.

### Rate Limiter Factories (rate-limit.ts)

**`createAnonHourlyLimiter`** — 3 creations/hr, anonymous only
- `skip: (_, res) => !!(res.locals.user)` — skips authenticated users
- `standardHeaders: 'draft-6'` — emits standalone `RateLimit-Reset` header (not draft-7 combined `RateLimit` header) so client can read it directly for countdown display
- keyGenerator: default req.ip (via trust proxy)

**`createAnonDailyLimiter`** — 10 creations/day, anonymous only
- `skip: (_, res) => !!(res.locals.user)` — skips authenticated users
- `standardHeaders: false` — CRITICAL: prevents overwriting hourly `RateLimit-Reset` header

**`createAuthedDailyLimiter`** — 20 creations/day, authenticated only
- `skip: (_, res) => !(res.locals.user)` — skips anonymous users
- `keyGenerator: (_, res) => res.locals.user.id` — per-user counter (not per-IP)
- `standardHeaders: 'draft-6'`

### POST /api/secrets Middleware Chain (secrets.ts)

New order (critical — optionalAuth sets res.locals.user before limiter skip callbacks fire):
```
optionalAuth → anonHourly → anonDaily → authedDaily → validateBody → handler
```

Handler adds expiresIn tier enforcement immediately after reading userId:
- Anonymous users (`!userId`): only `'1h'` allowed → 400 for `'24h'`, `'7d'`, `'30d'`
- Authenticated users (`userId`): max `'7d'` → 400 for `'30d'`

### ApiError Extension (client.ts)

`ApiError` extended with `readonly rateLimitReset?: number` (Unix timestamp in seconds).

`createSecret()` extracts `RateLimit-Reset` header from 429 responses:
```typescript
const resetHeader = res.headers.get('RateLimit-Reset');
const rateLimitReset = resetHeader ? parseInt(resetHeader, 10) : undefined;
throw new ApiError(res.status, body, rateLimitReset);
```

### Integration Tests (secrets.test.ts)

**Suite A — anonymous rate limits:**
- Anonymous user limited to 3/hr; 4th request → 429 with `RateLimit-Reset` header
- Authenticated user bypasses anon 3/hr limit (sends 4 requests, all 201)

**Suite B — expiresIn tier enforcement:**
- Anonymous rejects `24h`, `7d`, `30d` → 400 validation_error
- Anonymous allows `1h` → 201
- Authenticated allows `7d` → 201
- Authenticated rejects `30d` → 400 validation_error

**Existing test fixes:**
- All anonymous POST tests in secrets.test.ts, security.test.ts, expiration.test.ts updated to use `expiresIn: '1h'` (were `'24h'` which now correctly returns 400 for anon users)
- security.test.ts: rate limit test updated from "10 before 429" to "3 before 429"
- security.test.ts: header check updated from draft-7 `ratelimit` to draft-6 `ratelimit-reset`
- security.test.ts: switched from shared `app` in beforeAll to fresh `app` in beforeEach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] standardHeaders: 'draft-7' does not emit standalone RateLimit-Reset**
- **Found during:** Task 3 (test execution)
- **Issue:** The plan specified `standardHeaders: 'draft-7'` for `createAnonHourlyLimiter` and client reads `res.headers.get('RateLimit-Reset')`. But express-rate-limit draft-7 emits a COMBINED `RateLimit` header (`limit=N, remaining=N, reset=N`) with no standalone `RateLimit-Reset`. Client would always get `null`.
- **Fix:** Switched to `standardHeaders: 'draft-6'` which emits separate `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Draft-6 is IETF-standardized and supported by all major browsers.
- **Files modified:** `server/src/middleware/rate-limit.ts`
- **Commit:** 0c4abe6

**2. [Rule 2 - Missing] Existing integration tests used expiresIn '24h' for anonymous users**
- **Found during:** Task 3 (full test suite run)
- **Issue:** security.test.ts, expiration.test.ts, and most of secrets.test.ts used `expiresIn: '24h'` for anonymous POSTs. After implementing the server-side tier enforcement, all these tests began returning 400 instead of 201.
- **Fix:** Updated all anonymous POST tests to use `expiresIn: '1h'`. Updated security.test.ts to use fresh `buildApp()` per test (not shared instance) to prevent rate limit counter bleed. Updated rate limit test expectations from "10 before 429" to "3 before 429". Updated header assertion from draft-7 `ratelimit` to draft-6 `ratelimit-reset`.
- **Files modified:** `server/src/routes/__tests__/secrets.test.ts`, `server/src/routes/__tests__/security.test.ts`, `server/src/routes/__tests__/expiration.test.ts`
- **Commit:** 0c4abe6

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `server/src/middleware/rate-limit.ts` | FOUND |
| `server/src/routes/secrets.ts` | FOUND |
| `client/src/api/client.ts` | FOUND |
| `server/src/routes/__tests__/secrets.test.ts` | FOUND |
| `.planning/phases/27-conversion-prompts-rate-limits-legal-pages/27-01-SUMMARY.md` | FOUND |
| Commit eb8a8a4 (Task 1) | FOUND |
| Commit 658d2c8 (Task 2) | FOUND |
| Commit 0c4abe6 (Task 3) | FOUND |
| All 126 server tests passing | VERIFIED |
| TypeScript clean (server + client) | VERIFIED |
