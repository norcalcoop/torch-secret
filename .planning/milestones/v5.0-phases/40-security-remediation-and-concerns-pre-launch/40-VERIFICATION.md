---
phase: 40-security-remediation-and-concerns-pre-launch
verified: 2026-03-02T18:00:00Z
status: passed
score: 16/16 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "Trigger POST /api/secrets/:id/verify six times in one minute from a single IP in a staging environment (E2E_TEST unset)"
    expected: "The 6th request returns HTTP 429 with body { error: 'rate_limited', message: 'Too many password attempts...' }"
    why_human: "isE2E guard sets limit=1000 in Vitest (NODE_ENV=test), making 429 structurally untriggerable at the unit test level. Full integration requires staging with E2E_TEST unset."
  - test: "Deploy to staging and exhaust the PostgreSQL connection pool (all 10 connections held by long-running transactions), then issue a new request"
    expected: "Returns HTTP 503 with Retry-After: 30 header and body { error: 'service_unavailable' }"
    why_human: "Structural pool exhaustion test cannot be done reliably in Vitest against a shared DB. The unit path (error message contains 'timeout exceeded when trying to connect') is verified in error-handler.ts code but live triggering requires staging."
---

# Phase 40: Security Remediation Pre-Launch — Verification Report

**Phase Goal:** Remediate all critical and high-priority security concerns identified in the pre-launch security audit before v5.0 ships to production.
**Verified:** 2026-03-02
**Status:** PASSED (with 2 staging-only validations noted)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/secrets/:id/verify returns 429 after the 6th request within the same 1-minute window from the same IP | VERIFIED (unit shape; staging for live 429) | `createVerifyTightLimiter` in rate-limit.ts exports with `limit: isE2E ? 1000 : 5`, `windowMs: 60*1000`; wired as FIRST middleware on POST /:id/verify before `verifySecretLimiter` (secrets.ts line 180); unit test confirms shape and isE2E dual-condition |
| 2 | At most 4 Argon2id verifyPassword operations execute simultaneously under concurrent load | VERIFIED | `password.service.ts`: `const argon2Limit = pLimit(4)` at module level; `verifyPassword` returns `argon2Limit(() => argon2.verify(hash, password))` (line 55); `hashPassword` is NOT wrapped |
| 3 | POST /api/secrets with a 101KB+ ciphertext returns 413 with body { error: 'payload_too_large' } | VERIFIED | Three-layer enforcement: (1) `express.json({ limit: '100kb' })` in app.ts line 108; (2) Zod `ciphertext: z.string().min(1).max(100_000)` in shared/types/api.ts line 10; (3) `entity.too.large` handler in error-handler.ts lines 15-21. Integration test in secrets.test.ts lines 1003-1014 passes with 101KB payload |
| 4 | Zod CreateSecretSchema enforces ciphertext max 100_000 characters | VERIFIED | `shared/types/api.ts` line 10: `ciphertext: z.string().min(1).max(100_000), // 100KB max (SR-014)` |
| 5 | All rate limiters log a Pino warn when the Redis store fails (passOnStoreError path) | VERIFIED | `wrapStoreWithWarnOnError` helper (rate-limit.ts lines 35-47) wraps Store.increment; applied to all 5 limiter factories: `rl:anon:h:` (line 74), `rl:anon:d:` (line 106), `rl:authed:d:` (line 135), `rl:verify:` (line 167), `rl:verify:tight:` (line 196) |
| 6 | The E2E bypass is only active when both NODE_ENV=test AND E2E_TEST=true | VERIFIED | `rate-limit.ts` line 11: `const isE2E = process.env.NODE_ENV === 'test' && process.env.E2E_TEST === 'true'`; rate-limit.test.ts tests the dual-condition guard |
| 7 | The PostgreSQL pool is bounded to a maximum of 10 connections | VERIFIED | `db/connection.ts` line 21: `max: 10` |
| 8 | Idle connections are released after 30 seconds | VERIFIED | `db/connection.ts` line 22: `idleTimeoutMillis: 30_000` |
| 9 | Pool checkout times out after 5 seconds when all 10 connections are in use | VERIFIED | `db/connection.ts` line 23: `connectionTimeoutMillis: 5_000` |
| 10 | Each connection has a statement_timeout of 10 seconds | VERIFIED | `db/connection.ts` line 24: `options: '-c statement_timeout=10000'` |
| 11 | Idle client errors on the pool are logged as Pino warn | VERIFIED | `db/connection.ts` lines 34-36: `pool.on('error', (err: Error) => { logger.warn({ err: err.message }, 'pg_pool_idle_client_error'); })` |
| 12 | ZK invariant: no nanoid-pattern secret ID appears in notification email subject or body | VERIFIED | notification.service.test.ts: 3 passing tests asserting `/[A-Za-z0-9_-]{21}/` does NOT match email subject, body text, or full JSON payload; notification.service.ts confirmed clean |
| 13 | Session cookie is rejected with 401 after logout (server-side session deleted) | VERIFIED | auth.test.ts lines 78-97: creates user, signs in, gets 200 on /api/me, signs out, asserts same cookie returns 401 |
| 14 | User downgraded from Pro to Free via DB update cannot access Pro-gated features on next request | VERIFIED | auth.test.ts lines 103-131: upgrades user in DB, asserts subscriptionTier=pro, downgrades in DB, asserts subscriptionTier=free — all without re-login |
| 15 | POST /api/webhooks/stripe with missing or invalid stripe-signature returns 400; tampered event does not upgrade user to Pro | VERIFIED | webhooks.test.ts: 3 tests — missing sig (400), invalid sig (400 + "Webhook Error"), tampered checkout does not change subscriptionTier from 'free' |
| 16 | notification.service.ts and subscribers.service.ts have zero console.error calls; OAuth account-linking behavior documented | VERIFIED | grep confirms no console.error in either file; auth.ts contains 18-line JSDoc audit comment above socialProviders (lines 102-118) |

**Score:** 16/16 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/middleware/rate-limit.ts` | Exports `createVerifyTightLimiter`; isE2E dual-condition; all 5 limiters wrapped with `wrapStoreWithWarnOnError` | VERIFIED | All 5 factories confirmed; wrapStoreWithWarnOnError applied to every store call; isE2E = NODE_ENV=test AND E2E_TEST=true |
| `server/src/services/password.service.ts` | Imports p-limit; argon2Limit = pLimit(4); verifyPassword wrapped; hashPassword NOT wrapped | VERIFIED | Lines 2, 14, 55 confirmed; hashPassword at line 41-43 is unwrapped |
| `server/src/routes/secrets.ts` | `createVerifyTightLimiter` wired as FIRST middleware on POST /:id/verify | VERIFIED | Line 180: `createVerifyTightLimiter(redisClient),` precedes `verifySecretLimiter(redisClient)` at line 181 |
| `shared/types/api.ts` | ciphertext max is 100_000 | VERIFIED | Line 10: `.max(100_000)` with comment `// 100KB max (SR-014)` |
| `server/src/middleware/error-handler.ts` | 413 entity.too.large handler; 503 pool timeout handler | VERIFIED | Lines 13-21 (413), lines 23-31 (503); both placed BEFORE logger.error call |
| `server/src/db/connection.ts` | Pool: max 10, idleTimeout 30s, connTimeout 5s, statement_timeout 10s, pool.on('error') warn | VERIFIED | All 4 config values confirmed; pool.on('error') listener confirmed |
| `server/src/services/notification.service.ts` | Uses logger.error not console.error; ZK invariant: no userId/secretId in error log | VERIFIED | logger import at line 3; logger.error at line 37; no console.error found |
| `server/src/services/subscribers.service.ts` | 3 console.error calls replaced with logger.error | VERIFIED | logger import at line 18; logger.error at lines 163-166, 177-181, 213-216 |
| `server/src/auth.ts` | OAuth account-linking audit comment above socialProviders block | VERIFIED | 18-line JSDoc comment at lines 102-118 documenting SR-004 finding |
| `server/src/services/__tests__/notification.service.test.ts` | 3 passing ZK invariant tests; 1 test.todo for console.error migration | VERIFIED | 3 assertions confirmed in file; 1 test.todo at line 58 (intentional — verifiable only after Plan 05 implementation) |
| `server/src/routes/__tests__/auth.test.ts` | 2 passing integration tests: logout invalidation + Pro-gate re-validation | VERIFIED | Both describe blocks fully implemented (no test.todo remaining); deferred ESLint issue resolved by Plan 04 |
| `server/src/routes/__tests__/webhooks.test.ts` | 3 passing Stripe webhook tests | VERIFIED | All 3 test.todo replaced with full implementations |
| `server/src/routes/__tests__/secrets.test.ts` | 2 new tests: 413 payload limit + race condition concurrent verify | VERIFIED | Lines 1003-1014 (413 test), lines 1018-onwards (race condition) |
| `server/src/routes/__tests__/dashboard.test.ts` | IDOR describe block: user B cannot see user A secrets | VERIFIED | Lines 505-520 confirmed via grep |
| `server/src/middleware/__tests__/rate-limit.test.ts` | Rate limiter shape tests; isE2E dual-condition guard documented | VERIFIED | 4 tests confirmed |
| `server/src/workers/__tests__/expiration-worker.test.ts` | Soft-delete (user-owned) and hard-delete (anonymous) covered | VERIFIED | Existing tests at lines 162-224 explicitly cover status=expired, ciphertext='0' (user-owned) and row removal (anonymous) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `createVerifyTightLimiter` | POST /:id/verify route | First position in middleware chain | WIRED | secrets.ts line 180: `createVerifyTightLimiter(redisClient),` is first middleware, before `verifySecretLimiter` and before `validateParams`/`validateBody`/handler |
| `wrapStoreWithWarnOnError` | All 5 rateLimit() factories | Wraps return value of createStore() | WIRED | Applied on lines 74, 106, 135, 167, 196 of rate-limit.ts |
| `argon2Limit` (pLimit(4)) | `verifyPassword` only | `return argon2Limit(() => argon2.verify(...))` | WIRED | `hashPassword` is NOT wrapped — confirmed intentional |
| `entity.too.large` handler | 413 response before 500 fallthrough | `err.type === 'entity.too.large'` check | WIRED | error-handler.ts lines 15-21; placed BEFORE logger.error call |
| Pool connectionTimeoutMillis | 503 circuit breaker | `err.message.includes('timeout exceeded when trying to connect')` | WIRED | error-handler.ts lines 23-31; Retry-After: 30 header set |
| `pool.on('error')` | Pino warn | `logger.warn({ err: err.message }, 'pg_pool_idle_client_error')` | WIRED | connection.ts lines 34-36 |
| `logger.error` in notification.service.ts | Pino logger singleton | `import { logger } from '../middleware/logger.js'` | WIRED | logger import at line 3 |
| `logger.error` (×3) in subscribers.service.ts | Pino logger singleton | `import { logger } from '../middleware/logger.js'` | WIRED | logger import at line 18 |
| OAuth audit comment | `socialProviders` block | JSDoc directly above | WIRED | auth.ts line 102 comment directly precedes line 119 `socialProviders:` |

---

### Requirements Coverage

The requirement IDs used in Phase 40 plans (D1, D2, D3, SR-014 through SR-018, I4, E1-E4) are defined in the Phase 40 security audit document (40-RESEARCH.md), NOT in the main REQUIREMENTS.md file. REQUIREMENTS.md covers v5.0 product requirements (BRAND-*, HOME-*, PRICE-*, etc.) and has no security audit requirement entries. This is expected: Phase 40 requirements are audit-derived, not product requirements.

Cross-reference of all 16 requirement IDs from plan frontmatter against audit definitions in RESEARCH.md:

| Req ID | Audit Item | Plan | Implementation | Status |
|--------|-----------|------|----------------|--------|
| D1 | Payload size limit 100KB (Item #6) | 40-01 | ciphertext max 100_000 in Zod; entity.too.large 413 handler | SATISFIED |
| D2 | Argon2id concurrency cap (Items #1+#2) | 40-01 | pLimit(4) wrapping verifyPassword | SATISFIED |
| D3 | PostgreSQL pool hardening (Items #3+#4) | 40-02 | max:10, timeouts, statement_timeout | SATISFIED |
| SR-014 | 100KB payload enforcement | 40-01 | Zod max + 413 handler + express.json limit | SATISFIED |
| SR-015 | 5 req/min verify rate limit + 4-concurrent Argon2id cap | 40-01 | createVerifyTightLimiter + argon2Limit | SATISFIED |
| SR-016 | Pool bounded with timeouts | 40-02 | max:10, idleTimeout, connTimeout, statement_timeout | SATISFIED |
| I4 | ZK invariant systematic test | 40-03 | 3 passing tests in notification.service.test.ts | SATISFIED |
| SR-012 | No secretId in notification emails | 40-03/04 | nanoid-pattern regex tests; notification.service.ts confirmed ZK-clean | SATISFIED |
| E1 | IDOR dashboard test | 40-04 | user B cannot see user A secrets test in dashboard.test.ts | SATISFIED |
| SR-017 | IDOR protection verified | 40-04 | Passing integration test | SATISFIED |
| E2 | OAuth account-linking audit | 40-05 | JSDoc audit comment in auth.ts | SATISFIED |
| SR-004 | OAuth auto-linking behavior documented | 40-05 | 18-line audit comment in auth.ts above socialProviders | SATISFIED |
| E3 | Session logout invalidation test | 40-04 | Passing integration test in auth.test.ts | SATISFIED |
| SR-003 | Server-side session deletion confirmed | 40-04 | 401 after logout with same cookie | SATISFIED |
| E4 | Pro-gate re-validation test | 40-04 | Passing integration test in auth.test.ts | SATISFIED |
| SR-018 | subscriptionTier read from DB per request | 40-04 | Tier change without re-login reflected immediately | SATISFIED |

**Orphaned requirements from REQUIREMENTS.md:** None. Phase 40 security requirements (SR-*, D*, I*, E*) originate from the internal security audit (40-RESEARCH.md), not REQUIREMENTS.md. No v5.0 product requirements are assigned to Phase 40 in REQUIREMENTS.md.

**ROADMAP.md plan checkboxes:** The ROADMAP.md still shows all Phase 40 plans as `[ ]` (unchecked) despite all 5 plans being executed with verified commits. This is a documentation gap — the ROADMAP was not updated to mark plans complete. This does not affect the code deliverables but should be remediated.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `notification.service.test.ts` | 58 | `test.todo(...)` | Info | Intentional: the "logs via logger.error" test cannot be meaningfully green until Plan 05 implementation is verified. Plan 05 IS complete; this todo could now be implemented, but its presence does not block the ZK invariant guarantee (3 other tests cover that). |
| `ROADMAP.md` | 332-336 | Phase 40 plan checkboxes show `[ ]` instead of `[x]` | Warning | ROADMAP.md was not updated to mark Phase 40 plans complete. All 9 commits confirming plan execution exist. Documentation inconsistency only — no code impact. |

No blocker anti-patterns found. No placeholder returns, empty handlers, or stub implementations in any modified production file.

---

### Human Verification Required

#### 1. Live 429 Rate Limit on POST /:id/verify

**Test:** In a staging environment (where E2E_TEST is NOT set), send 6 POST requests to `/api/secrets/:id/verify` within a 60-second window from the same IP address.
**Expected:** The 6th request returns HTTP 429 with `{ "error": "rate_limited", "message": "Too many password attempts. Please wait before trying again." }` and `RateLimit-*` headers.
**Why human:** The `isE2E` guard (`NODE_ENV=test && E2E_TEST=true`) raises the Vitest limit to 1000, making 429 structurally untriggerable in the unit test suite. The code path (limit: 5) is verified to exist, but live enforcement requires a staging run without the guard.

#### 2. PostgreSQL Pool Exhaustion 503 Circuit Breaker

**Test:** In staging, hold all 10 pool connections open with long-running transactions, then issue a new request to any DB-backed endpoint. Wait up to 6 seconds.
**Expected:** Response is HTTP 503 with `Retry-After: 30` header and `{ "error": "service_unavailable", "message": "Database temporarily unavailable. Please retry in 30 seconds." }`.
**Why human:** Reliable pool exhaustion in a shared test database would interfere with other tests. The error-handler code path (`err.message.includes('timeout exceeded when trying to connect')`) is verified, but live triggering requires staging.

---

### Gaps Summary

No gaps found. All 16 must-have truths are VERIFIED against the actual codebase. All 5 plans produced substantive, wired implementations with verified commits. The two staging-only validations (429 rate limit and 503 circuit breaker) are expected per the plan design — both are documented in Plan 04's notes as requiring E2E/staging verification.

The single remaining `test.todo` in notification.service.test.ts (`logs via logger.error when Resend send fails`) is intentional scaffolding from Plan 03 that was designed to become green after Plan 05. Since Plan 05 is complete, this todo could be fully implemented, but its presence does not represent a functional gap — the ZK invariant is confirmed by the 3 other passing tests in the same file, and logger.error usage in notification.service.ts is directly verified.

---

_Verified: 2026-03-02_
_Verifier: Claude (gsd-verifier)_
