# Phase 40: security-remediation-and-concerns-pre-launch - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Remediate the 10 Immediate Action Items from the security posture report (2026-03-01 audit), close all 7 identified test coverage gaps, and fix the CONCERNS.md quick wins — raising the system's posture score from 77/100 (Grade C) before public launch. No new product features. The scope is bounded by the two input documents: `.planning/security/security-posture-report.md` and `.planning/codebase/CONCERNS.md`.

</domain>

<decisions>
## Implementation Decisions

### Scope
- All 10 Immediate Action Items from the security posture report are in scope
- CONCERNS.md quick wins are also included: `console.error` → Pino migration (3 files), E2E_TEST safety gate (add `NODE_ENV === 'test'` check), and `passOnStoreError` warn logging
- All 7 test coverage gaps are in scope

### Argon2id /verify defense (Items #1 + #2, D2, SR-015)
- Rate limit for POST /api/secrets/:id/verify: **5 req/min/IP** (tighter than current 15/15min, matches report recommendation)
- Add a new dedicated rate limiter in `rate-limit.ts` following the existing factory pattern (not modifying `verifySecretLimiter`)
- Apply rate limit BEFORE Argon2id computation in route handler
- Concurrency cap: **max 4 simultaneous Argon2id operations via p-limit**
- Apply concurrency cap to **verify-only** (POST /api/secrets is already tightly limited via anon hourly/daily limiters — adding cap there too would unnecessarily slow down legitimate secret creation)
- Wire p-limit in `services/password.service.ts` or `services/secrets.service.ts` at the verifyPassword call site

### PostgreSQL pool hardening (Items #3 + #4, D3, SR-016)
- Pool max: **10 connections** (explicit `max: 10` in `db/connection.ts`)
- Add `idleTimeoutMillis`, `connectionTimeoutMillis`, and `statement_timeout`
- Add **503 circuit breaker**: on pool exhaustion (connection timeout error), return HTTP 503 + `Retry-After` header instead of hanging/returning 500
- Circuit breaker implemented as middleware or pool error event handler — Claude's discretion on exact pattern

### Payload size limit (Item #6, D1, SR-014)
- Add 100KB hard cap to POST /api/secrets payload
- Apply both at `express.json()` middleware level AND in the route handler/Zod schema validation
- Return HTTP 413 Payload Too Large with `error: 'payload_too_large'`

### ZK invariant enforcement test (Item #5, I4, SR-012)
- Add automated Vitest test for `notification.service.ts` that asserts no nanoid pattern (21-char URL-safe ID) appears in email body or subject
- Pattern to detect: `/[A-Za-z0-9_-]{21}/` (nanoid default alphabet and length)
- Test should also verify no `secretId` field is passed to any Resend API call

### IDOR dashboard test (Item #7, E1, SR-017)
- Verify `GET /api/dashboard` query includes `WHERE user_id = session.user.id`
- Add **integration test**: user A creates secret → user B logs in → user B requests dashboard → asserts user A's secret is not returned

### Session deletion test (Item #8, E3, SR-003)
- Add **integration test**: user logs in → gets session cookie → calls logout endpoint → uses same cookie → asserts 401
- Verifies server-side session invalidation (not just client-side cookie deletion)

### Pro-gate re-validation test (Item #9, E4, SR-018)
- Add **integration test**: user is Pro → subscription downgraded (simulated by DB update, not webhook) → user calls Pro-gated endpoint → asserts 403
- Verifies middleware reads from DB on each request, not from session cache

### OAuth account-linking audit (Item #10, E2, SR-004)
- Audit Better Auth OAuth account-linking behavior in code — does email-match auto-grant access without re-verification?
- Document finding in a code comment; if vulnerable, add re-verification gate
- This may be a code-read-only finding if Better Auth already handles it

### Test coverage gaps — all 7 (integration tests)
All tests follow the existing Supertest + real PostgreSQL integration pattern from `server/src/routes/__tests__/secrets.test.ts`:
1. **Stripe webhook signature verification** (Critical) — test tampered/unsigned webhook returns 400, does NOT trigger Pro upgrade
2. **IDOR on dashboard** (High) — see above
3. **Session logout invalidation** (Medium) — see above
4. **Pro-gate re-validation** (Medium) — see above
5. **ZK invariant systematic test** (Medium) — see above (notification.service.ts)
6. **Password attempt auto-destroy race condition** (High) — concurrent POST /api/secrets/:id/verify requests when `attemptsRemaining=1`; verify only one request destroys the secret
7. **Expiration worker soft-delete vs hard-delete** (High) — verify user-owned expired secrets get `status='expired'` (soft), anonymous get hard-deleted

### CONCERNS.md quick wins
- `console.error` → `logger.error` in: `server/src/services/notification.service.ts` (line 36), `server/src/services/subscribers.service.ts` (lines 161, 197). ZK invariant: messages must not combine userId + secretId
- E2E_TEST bypass: gate with `const isE2E = process.env.NODE_ENV === 'test' && process.env.E2E_TEST === 'true'` (prevents accidental production bypass)
- `passOnStoreError` on all rate limiters: add `logger.warn('rate_limit_store_error')` when Redis store fails, before passing through

### Claude's Discretion
- Exact `idleTimeoutMillis` and `connectionTimeoutMillis` values (report doesn't specify; 30s idle, 5s connection are sensible starting points)
- `statement_timeout` value (10s is a reasonable default for OLTP queries)
- Whether circuit breaker is a pool `error` event listener, try/catch in a db wrapper, or middleware — whichever is cleanest given existing patterns
- Whether p-limit is applied in `password.service.ts` (closest to Argon2id) or `secrets.service.ts` (call site)
- Exact test file placement (new files vs extend existing `__tests__/` files)

</decisions>

<specifics>
## Specific Ideas

- Rate limit the /verify endpoint BEFORE Argon2id computation — this is critical: if the rate limit check itself is Argon2id-gated, it offers no protection
- The 503 circuit breaker must include a `Retry-After` header (not just 503 body) so clients and load balancers can back off gracefully
- For the race condition test (password attempt auto-destroy), use `Promise.all()` with multiple simultaneous Supertest requests — don't use sequential requests as those won't trigger the race
- The E2E_TEST change must also update all references in the file; the `isE2E` constant at line 6 of `rate-limit.ts` needs to be the single source of truth

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/middleware/rate-limit.ts`: All rate limiters already use `rateLimit()` factory pattern with `createStore()`. Add the new 5/min /verify limiter here following the same pattern
- `server/src/services/password.service.ts`: Argon2id hashPassword/verifyPassword lives here — p-limit concurrency cap wraps verifyPassword at this layer
- `db/connection.ts`: 3-line file with bare `new Pool({ connectionString })` — pool config expansion is a drop-in
- `server/src/routes/__tests__/secrets.test.ts`: 1000-line Supertest + real DB integration test file — the exact pattern for all 7 new tests

### Established Patterns
- Rate limiters: `passOnStoreError: true` + `store: createStore(redisClient, 'rl:prefix:')` + `skip` callback for auth bypass
- Integration tests: Supertest against Express app, real PostgreSQL, `beforeEach`/`afterEach` teardown
- E2E bypass: `const isE2E = process.env.E2E_TEST === 'true'` — needs `NODE_ENV === 'test' &&` guard added
- Logging: Pino logger imported as `import { logger } from '../middleware/logger.js'` (module-level singleton)

### Integration Points
- New /verify rate limiter wired in `server/src/routes/secrets.ts` (route-level middleware, same as existing limiters)
- Pool config in `server/src/db/connection.ts`
- Argon2id concurrency cap in `server/src/services/password.service.ts` at verifyPassword
- Circuit breaker: pool `error` event or try/catch around `db.execute()` calls — needs investigation
- `console.error` replacements: `notification.service.ts` line 36, `subscribers.service.ts` lines 161, 197

</code_context>

<deferred>
## Deferred Ideas

- Redis MAXMEMORY eviction policy configuration — infrastructure concern (Render.com / Redis config, not application code)
- WAF / DDoS protection at CDN layer — Cloudflare configuration, not application code
- Dashboard pagination (cursor-based) — Phase 23 finding, performance not security
- User data export (GDPR right-to-data) — new capability, own phase
- Audit logging table for auth events — new capability, own phase
- Expiration worker distributed locking (Redis SET with EX) — scaling concern, not a launch blocker
- Email delivery retry queue (Bull/MQ) — reliability improvement, not security blocker
- Stripe idempotency key for customer creation — low-risk edge case, explicit dedup already via unique constraint

</deferred>

---

*Phase: 40-security-remediation-and-concerns-pre-launch*
*Context gathered: 2026-03-01*
