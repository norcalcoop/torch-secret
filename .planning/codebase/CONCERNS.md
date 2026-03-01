# Codebase Concerns

**Analysis Date:** 2026-03-01

## Tech Debt

### Auth page noindex applied only client-side (Phase 22 finding)

**Issue:** Auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`) receive noindex only via client-side `updatePageMeta({ noindex: true })` calls in `client/src/router.ts`. Server-side `X-Robots-Tag: noindex, nofollow` header in `server/src/app.ts` only applies to paths starting with `/secret/`.

**Files:**
- `server/src/app.ts` (lines 105-107)
- `client/src/router.ts` (updatePageMeta calls)

**Impact:** Crawlers that skip JavaScript execution will not see noindex on auth pages and may index them in search engines. No functional impact — pages are publicly accessible by design. Minor SEO concern only.

**Fix approach:** Extend server-side X-Robots-Tag guard in `app.ts` to also cover `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/dashboard` paths alongside existing `/secret/*` check. Provides defense-in-depth—crawlers see noindex regardless of JavaScript support.

---

### Placeholder Domain in SEO Assets (v3.0 finding, unresolved)

**Issue:** Static HTML uses placeholder domain `secureshare.example.com` in Open Graph and Twitter card metadata

**Files:** `client/index.html`

**Impact:** Social media previews show incorrect domain in production

**Fix approach:** Replace with actual production domain when deploying. Requires one-line find-replace in HTML template.

---

### Lucide Icons ESM Workaround (v1.0 finding, unresolved)

**Issue:** Vite config includes `resolve.alias` workaround to force Lucide imports to ESM entry point. ESM entry point upstream is broken.

**Files:** `vite.config.ts`, documented in `CLAUDE.md`

**Impact:** Non-standard import resolution. May break if Lucide updates package structure.

**Fix approach:** Monitor upstream Lucide package for ESM fix, remove alias when resolved.

---

### Rate Limiting MemoryStore Growth and Reset (Phase 27 finding)

**Issue:** When `REDIS_URL` is not set, rate limiter falls back to MemoryStore which:
1. Grows unbounded in memory (never expires old entries)
2. Is cleared on server restart (resets all rate limit counters)

**Files:** `server/src/middleware/rate-limit.ts` (lines 14-20), `server/src/app.ts` (lines 49-51)

**Impact:** Long-running instances accumulate memory without bound. On restart, all rate limits reset, allowing burst attacks immediately after deployment.

**Fix approach:** Either (a) require Redis in production and document as mandatory, (b) use `node-cache` library with TTL instead of MemoryStore, or (c) accept single-instance deployment model and document explicitly.

---

### console.error() Instead of Structured Logging (Phase 37 finding)

**Issue:** Fire-and-forget email and Loops errors use `console.error()` instead of Pino logger, making them invisible to log aggregation systems.

**Files:**
- `server/src/services/notification.service.ts` (line 36)
- `server/src/services/subscribers.service.ts` (lines 161, 197)

**Impact:** Production error tracking (Sentry, Datadog, etc.) misses email delivery failures and Loops sync failures. Silent data loss in subscriber sync.

**Fix approach:** Replace `console.error()` with `logger.error()`. Ensure log messages follow zero-knowledge invariant (no userId + secretId combination).

---

### Trust Proxy Single-Hop Assumption (v1.0 finding, still valid)

**Issue:** `app.set('trust proxy', 1)` assumes exactly one proxy hop (load balancer → Express). Incorrect hop count breaks rate limiting and HTTPS redirect.

**Files:** `server/src/app.ts` (line 55)

**Impact:** Multi-hop deployments (e.g., CDN → LB → Express) will use wrong IP for rate limiting, allowing bypass. Setting too high allows X-Forwarded-For spoofing.

**Fix approach:** Count exact proxy hops in production environment, update trust proxy value accordingly. Never use `true` (trusts all proxies). Current single-hop is correct for Render.com and Docker Compose deployments.

---

## Known Bugs

### Password Attempt Counter May Show Wrong State to Client (Phase 34 finding)

**Symptoms:** If client retries password verification while server is processing, `attemptsRemaining` shown to client may not match actual server count.

**Files:**
- `server/src/services/secrets.service.ts` (lines 302-306) — password attempts incremented in DB
- `server/src/routes/secrets.ts` (lines 193-196) — response returns attemptsRemaining

**Trigger:** Race condition under high concurrent load on single password-protected secret.

**Workaround:** Client respects server-sent `attemptsRemaining` in response; eventual consistency is achieved within one request.

**Fix approach:** Already mitigated by returning server-authoritative `attemptsRemaining` in all `verifyAndRetrieve()` responses. No additional action needed.

---

### Expiration Worker Bulk Zero May Not Match Original Length (Phase 37 finding)

**Symptoms:** Anonymous expired secrets are zeroed with single `'0'` character, not original ciphertext length.

**Files:** `server/src/workers/expiration-worker.ts` (lines 32, 38)

**Trigger:** When expiration worker runs, all anonymous expired secrets get `ciphertext = '0'` regardless of original length.

**Issue:** Security comment says "this still mitigates data remanence" but single `'0'` does not prevent length inference; SECR-08 mitigation is incomplete.

**Workaround:** Intentional simplification for performance; accepted trade-off documented in code.

**Fix approach:** Either (a) query original ciphertext length before bulk update and zero to matching length, or (b) update security comment to clarify length-revealing is acceptable.

---

### getSecretMeta() Does Not Clean Up Expired Secrets (Phase 34 finding)

**Symptoms:** Expired password-protected secrets checked via `/api/secrets/:id/meta` return null but are not deleted from DB until expiration worker runs.

**Files:** `server/src/services/secrets.service.ts` (lines 164-191)

**Trigger:** User repeatedly checks expired secret metadata; rows accumulate up to 5 minutes until worker cleanup.

**Issue:** Inconsistent with `retrieveAndDestroy()` and `verifyAndRetrieve()` which clean up inline. Creates stale rows in DB.

**Workaround:** Expiration worker runs every 5 minutes; cleanup is best-effort.

**Fix approach:** Either (a) add opportunistic cleanup in `getSecretMeta()` transaction, or (b) accept lazy cleanup and document it.

---

### CSP Nonce Generation Failure Not Caught in SPA Catch-All (Phase 37 finding)

**Symptoms:** If `crypto.randomBytes()` fails in `cspNonceMiddleware`, the nonce remains undefined but SPA catch-all still tries to inject it.

**Files:** `server/src/middleware/security.ts` (lines 14-23), `server/src/app.ts` (line 133)

**Trigger:** Extremely rare OS-level crypto failure; would block normal requests via error handler.

**Issue:** Type assertion `res.locals.cspNonce as string` bypasses null check; if error handler doesn't catch, injection injects `undefined` into HTML.

**Workaround:** Express error handler catches unhandled errors; CSP header is missing for that request.

**Fix approach:** Add guard: `if (!res.locals.cspNonce) return res.status(500).json({error: 'internal_error'})`

---

## Security Considerations

### Zero-Knowledge Invariant Enforcement Coverage (Phase 37.1 update)

**Area:** User-Secret Correlation Prevention

**Risk:** Any code path that logs, stores in DB, or sends to analytics both a `userId` and `secretId` in the same record violates the zero-knowledge security model.

**Files:**
- `.planning/INVARIANTS.md` — canonical enforcement rule (updated Phase 37)
- `server/src/db/schema.ts` (lines 8-30) — schema-level enforcement with block comment
- `server/src/middleware/logger.ts` (line 28) — regex redaction of secret IDs from URL paths
- `client/src/analytics/posthog.ts` (lines 1-16) — before_send hook strips URL fragments

**Current mitigation (Phase 37.1):**
- DB: `secrets.user_id` is nullable FK with `onDelete: 'set null'` — preserves already-shared links if user deletes account
- Logger: Pino redacts secret IDs via regex from `/api/secrets/` and `/api/dashboard/secrets/` paths
- Analytics: PostHog `before_send` hook strips URL fragments (`#key`) before any event transmission
- Stripe billing: Webhook handler uses `stripe_customer_id` lookup only, never joins `userId` + `secretId`
- Email notifications: Fire-and-forget; email body contains only timestamp, no secretId
- Rate limits: 429 responses contain no userId (anonymous by definition) or secretId

**Status:** ENFORCED across all systems as of Phase 37.1. No violations detected in code audit.

---

### Stripe Customer Creation Missing Idempotency Key (Phase 34 finding)

**Risk:** If network fails after Stripe customer creation but before DB update completes, retry creates duplicate customer.

**Files:** `server/src/services/billing.service.ts` (lines 63-66)

**Current mitigation:** stripe_customer_id is stored as unique constraint alternative (lookup by email); duplicate customers are harmless.

**Recommendations:** Add idempotency key to Stripe customer create call for explicit deduplication:
```typescript
const customer = await stripe.customers.create({
  email: user.email,
  idempotency_key: `torch-secret-${user.id}`,
  metadata: { app: 'torch-secret' },
});
```

---

### Rate Limit Bypass via IP Rotation (v1.0 security finding, still valid)

**Risk:** Rate limiting is per-IP. Attackers with botnets or VPN services can rotate IPs to bypass 10 req/day limit on anonymous secret creation.

**Files:** `server/src/middleware/rate-limit.ts`

**Current mitigation:** Per-secret password attempts (3 max) limit brute-force on individual secrets. Per-user rate limiting for authenticated users (keyGenerator uses userId, not IP).

**Status:** Acceptable for current phase. Anonymous limits are already tight (3/hr, 10/day); further tightening requires paywall.

---

### No WAF or DDoS Protection (v1.0 security finding, still valid)

**Risk:** Application has no Web Application Firewall or DDoS mitigation at application layer

**Files:** N/A (infrastructure concern)

**Current mitigation:** Relies on reverse proxy (Nginx, Render.com load balancer) for basic protection

**Status:** Production deployment should use Cloudflare, AWS WAF, or similar. Render.com includes DDoS protection at platform layer.

---

### Email Notification Fire-and-Forget With No Retry (Phase 26 finding, Phase 37 update)

**Risk:** Secret-viewed notification emails use best-effort delivery with no retry mechanism. If Resend is down when notification is sent, user never receives email.

**Files:** `server/src/services/notification.service.ts` (lines 17-38), `server/src/services/secrets.service.ts` (lines 144-149)

**Current mitigation:** Fire-and-forget pattern is intentional (don't block secret retrieval on email delivery). Resend has 99.9% uptime SLA.

**Recommendations:** (1) Implement background job queue (Bull, MQ) for email retry; (2) Track delivery status in DB; (3) Add email delivery retry endpoint for user to manually trigger resend; (4) Monitor Resend delivery rates and alert on failures.

---

## Performance Bottlenecks

### Dashboard Secret List Fetches All Rows, No Pagination (Phase 23 finding, Phase 37 update)

**Problem:** `getUserSecrets()` returns all secrets for the user; no limit or offset.

**Files:** `server/src/services/secrets.service.ts` (lines 318-344)

**Cause:** Frontend pagination is client-side; large secret counts load entire table into memory.

**Impact:** Users with 10K+ secrets experience slow dashboard load and high memory usage.

**Improvement path:** Implement cursor-based pagination in service: add `limit: 50` and `offset` parameters; update response to include `hasMore` flag.

---

### Expiration Worker Runs on Every Instance (Phase 37 finding)

**Problem:** If multiple instances are deployed (horizontal scaling), each runs the cleanup job independently.

**Files:** `server/src/workers/expiration-worker.ts` (line 57)

**Cause:** node-cron is instance-local; no coordination across processes.

**Impact:** N instances = N× database load; wasted CPU cycles on duplicate bulk updates.

**Improvement path:** (1) Use distributed lock (Redis SET with EX) before running cleanup, or (2) Move to async job queue (Bull, Temporal), or (3) Document that single-instance deployment only.

---

### Rate Limit MemoryStore Grows Unbounded in Memory (Phase 37 finding)

**Problem:** When REDIS_URL is not set, rate-limit-redis falls back to MemoryStore which never expires old entries.

**Files:** `server/src/middleware/rate-limit.ts` (lines 14-20)

**Cause:** express-rate-limit MemoryStore has no TTL; uses process memory for all keys.

**Impact:** Long-running instances accumulate memory over weeks; potential OOM on server with 100K+ unique IPs.

**Improvement path:** (1) Always require Redis in production (document in README), (2) Use `node-cache` library with TTL, or (3) Accept single-instance deployment model.

---

### Ciphertext Size Not Limited to Reasonable Maximum (Phase 37 finding)

**Problem:** CreateSecretSchema allows ciphertext up to 200KB (line 10 of shared/types/api.ts).

**Files:** `shared/types/api.ts` (line 10)

**Cause:** Web Crypto API has no hard limit; arbitrary size is accepted.

**Impact:** Attacker can upload 200KB × rate limit (20/day Pro) = 4MB/day/user; disk space accumulates.

**Improvement path:** (1) Reduce max to 10KB (typical text sharing), (2) Add storage quota per user (Pro gets 1GB/month), (3) Enforce quota at API layer with 413 Payload Too Large response.

---

## Fragile Areas

### Atomic Secret Retrieval Relies on 3-Step Transaction Ordering (v1.0 finding, still valid)

**Files:** `server/src/services/secrets.service.ts` (lines 80-154, 207-310)

**Why fragile:** If transaction isolation level changes, or if Drizzle ORM behavior changes, the atomic guarantee breaks.

**Safe modification:** (1) Add tests that verify isolation (phantom reads not possible), (2) Document transaction isolation level in code comments, (3) Consider using explicit SELECT FOR UPDATE to make locking visible.

**Test coverage:** `server/src/routes/__tests__/secrets.test.ts` has tests for basic cases but not race condition tests under load.

---

### Better Auth Library Dependency Risk (Phase 22 finding, Phase 37 update)

**Files:**
- `server/src/auth.ts`
- `server/src/middleware/require-auth.ts`
- `client/src/api/auth-client.ts`
- `server/src/db/schema.ts` (Better Auth table definitions)

**Why fragile:**
- Better Auth is actively developed (currently 1.x stable but still iterating)
- Session cookie must use `sameSite: 'lax'` for OAuth callbacks; any regression could break OAuth
- Email callbacks use fire-and-forget pattern (`void sendEmail()`) to satisfy TypeScript
- drizzleAdapter requires explicit schema mappings (`user: schema.users`, `verifications: schema.verification`)

**Safe modification:**
- Updates to Better Auth: review changelog for cookie handling or session schema changes
- Test all 7 auth flows (registration, login, password reset, OAuth Google, OAuth GitHub, logout, session persistence) after any Better Auth upgrade
- Document current session cookie settings in CLAUDE.md

---

### SEO Routes Mounted Before SPA Catch-All, Route Overlap Possible (Phase 37 finding)

**Files:** `server/src/app.ts` (lines 115-119), `server/src/routes/seo/index.ts`

**Why fragile:** If a new `/vs/*` or `/use/*` page is added to SPA before SEO routes are aware, the SPA route will never be reached due to ordering.

**Safe modification:** (1) Document in STRUCTURE.md that SEO routes are exhaustive, (2) Add test verifying no route pattern overlaps, (3) Consider using shared route registry to prevent additions.

**Test coverage:** `server/src/routes/__tests__/seo.test.ts` exists but doesn't verify overlap prevention.

---

### Crypto Module Has No Length Validation on Imported Key (Phase 37 finding)

**Files:** `client/src/crypto/keys.ts`

**Why fragile:** If key import validation is bypassed, decryption fails with generic error; debugging is hard.

**Safe modification:** (1) Add assertion that decoded key is exactly 32 bytes, (2) Throw with explicit "key must be 256-bit (32 bytes)" message.

**Test coverage:** `client/src/crypto/__tests__/keys.test.ts` should verify exact length requirement.

---

## Scaling Limits

### Database Connections Unbounded (Phase 37 finding)

**Current capacity:** PostgreSQL 17+ with default 100 connection limit

**Limit:** Drizzle pool is unbounded; if 200 concurrent requests hit the app, 100 will queue.

**Scaling path:** (1) Set `max: 10` on Drizzle pool to limit open connections, (2) Use connection pooling middleware (pgBouncer), (3) Monitor `pg_stat_activity` for stalled queries.

---

### Redis Memory for Rate Limiting Unbounded (Phase 37 finding)

**Current capacity:** Unknown (depends on Redis instance size)

**Limit:** Each rate limiter stores N keys for N unique IPs/users; MemoryStore is unbounded if Redis unavailable.

**Scaling path:** (1) Require Redis in production, (2) Set Redis `MAXMEMORY` policy to evict oldest entries, (3) Monitor Redis memory and alert at 80%.

---

### Email Delivery Queue Not Implemented (Phase 26 finding, Phase 37 update)

**Current capacity:** Resend API called synchronously (fire-and-forget); no queue.

**Limit:** If Resend is slow (>1s), transaction commit is blocked; requests pile up.

**Scaling path:** (1) Implement async job queue for email delivery, (2) Allow transaction to commit before email sent, (3) Add retry queue for failed sends.

---

## Dependencies at Risk

### node-cron Has No Distributed Locking (Phase 37 finding)

**Risk:** Expiration worker runs on every instance independently.

**Impact:** Horizontal scaling = wasted CPU and DB load.

**Migration plan:** (1) Switch to node-schedule with Redis-backed singleton, (2) Use Bull or Temporal for reliable job scheduling, (3) Document single-instance deployment requirement.

---

### pino-http CJS/ESM Incompatibility Workaround (Phase 37 finding)

**Risk:** Node version changes or pino-http updates could break the runtime detection hack.

**Files:** `server/src/middleware/logger.ts` (lines 9-15)

**Impact:** Logging breaks silently if interop detection fails.

**Migration plan:** (1) Upgrade to pino-http with native ESM support (if available), (2) Add runtime assertions to detect detection failure, (3) Switch to winston or pino@4 with full ESM.

---

### Better Auth Type Declarations Return `any` for Session (Phase 37 finding)

**Risk:** Type safety is lost; `@typescript-eslint/no-unsafe-member-access` requires constant reassurance.

**Impact:** Risk of runtime errors when accessing session properties.

**Migration plan:** (1) Patch Better Auth types locally, or (2) Switch to auth library with better types (Lucia, Auth.js).

---

### Stripe SDK May Have Breaking Changes (Phase 34 finding, Phase 37 update)

**Risk:** Stripe SDK is well-maintained but major versions may have breaking changes.

**Current version:** ~15.x

**Impact:** Billing integration could break on major upgrade.

**Migration plan:** Pin to major.minor versions. Test Stripe webhook signature verification and Checkout session creation after any major upgrade.

---

## Missing Critical Features

### No Database Backup Strategy Documented (Phase 37 finding)

**Problem:** PostgreSQL contains all user data; no backup/restore procedure documented.

**Blocks:** Disaster recovery, data residency compliance, GDPR right-to-erasure.

**Recommendation:** Document backup policy in deployment docs; test recovery procedure monthly.

---

### No Rate Limit Recovery Mechanism (Phase 37 finding)

**Problem:** If rate limit counter gets stuck (Redis corruption), manual reset required.

**Blocks:** Cannot unblock legitimate user without server restart or Redis intervention.

**Recommendation:** Add `/api/admin/rate-limit-reset/:userId` endpoint (admin-only) for emergency unblock.

---

### No User Data Export (GDPR Right-to-Data) (Phase 37 finding)

**Problem:** GDPR requires user to download their data; no mechanism exists.

**Blocks:** GDPR compliance; legal exposure.

**Recommendation:** Add `/api/me/export` endpoint returning JSON of all user data (metadata only, no secrets).

---

### No Audit Trail for Auth Events (Phase 37 finding)

**Problem:** User creation, password changes, OAuth sign-ins, and logouts are not logged to audit trail.

**Blocks:** Compliance with SOC2/ISO 27001. No forensic trail for account compromise investigation.

**Recommendation:** Add `audit_logs` table; log: sign_up, sign_in, password_reset, oauth_connect, logout (with timestamp + IP, no secretId).

---

## Test Coverage Gaps

### Password Attempt Auto-Destroy Edge Case Not Tested (Phase 37 finding)

**What's not tested:** Exact moment when `attemptsRemaining` transitions from 1 → 0; concurrent requests during auto-destroy.

**Files:** `server/src/routes/__tests__/secrets.test.ts` (1000 lines but may not cover race).

**Risk:** Attacker could potentially bypass auto-destroy via race condition.

**Priority:** High

---

### Expiration Worker Hard-Delete vs Soft-Delete Not Verified (Phase 37 finding)

**What's not tested:** Verify user-owned secrets get `status='expired'` (soft) while anonymous get hard-deleted.

**Files:** `server/src/workers/__tests__/expiration-worker.test.ts`

**Risk:** Dashboard history could be lost if soft-delete accidentally becomes hard-delete.

**Priority:** High

---

### Zero-Knowledge Invariant Not Tested Systematically (Phase 37 finding)

**What's not tested:** Comprehensive test that logs + analytics events never contain userId + secretId.

**Risk:** Future developer could add a log line or analytics call violating invariant without knowing.

**Priority:** Medium

---

### Stripe Webhook Signature Verification Failure Modes (Phase 37 finding)

**What's not tested:** What happens if Stripe webhook arrives unsigned or with wrong signature.

**Risk:** Attacker could trigger Pro upgrade without payment.

**Priority:** Critical

---

### Better Auth Session Type Guards (Phase 37 finding)

**What's not tested:** Full suite of session validation edge cases (expired, tampered, missing fields).

**Risk:** Route handlers could receive invalid session and crash.

**Priority:** Medium

---

### Email Notification Failure Modes (Phase 26 finding, Phase 37 update)

**What's not tested:** Resend API errors (rate limit, invalid email, server down).

**Files:** `server/src/services/notification.service.test.ts` (has mock but not real Resend errors).

**Risk:** Silent failures make notifications unreliable.

**Priority:** Medium

---

### Analytics Events Do Not Violate Invariant (Phase 37 finding)

**What's not tested:** Audit that all PostHog events never combine userId + secretId.

**Files:** `client/src/analytics/posthog.test.ts`

**Risk:** Event payload could accidentally include secret ID in URL fragment before `sanitizeEventUrls` runs.

**Priority:** Medium

---

## Recommendations Summary

### High Priority

1. **Stripe webhook signature verification edge cases** — Add tests for tampered/unsigned webhooks
2. **Password attempt auto-destroy race conditions** — Add concurrent load test with 3+ simultaneous verify attempts
3. **Zero-knowledge invariant systematic test** — Add integration test scanning all logs/analytics for userId + secretId combinations

### Medium Priority

1. **Rate limit recovery mechanism** — Add admin endpoint for emergency rate limit reset
2. **Email notification retry queue** — Implement Bull or similar for email delivery retry
3. **Expiration worker distributed locking** — Add Redis lock to prevent duplicate cleanup on multi-instance deployments
4. **Console.error → Pino migration** — Replace all `console.error()` with structured logging
5. **Database backup procedure** — Document backup policy and test recovery monthly

### Low Priority (Future Phases)

1. **Dashboard query optimization** — Implement cursor pagination in Phase 23
2. **Ciphertext size limits** — Reduce max to 10KB and add storage quota
3. **User data export** — Implement GDPR data export endpoint
4. **Audit logging** — Add auth event audit trail for compliance

---

*Concerns audit: 2026-02-28*

---

## Additional Concerns (2026-03-01 Analysis)

### Passphrase Generator Wordlist Bundle Size Bloat

**Issue:** `client/src/crypto/passphrase.ts` is 7,840 lines (100% is the EFF Large Wordlist data). Creates a massive single-file artifact dominating bundle and slowing IDE language-server.

**Files:** `client/src/crypto/passphrase.ts`

**Impact:** Large unminified bundle (~280 KB); TypeScript type inference slow on large const arrays; difficult code reviews.

**Fix approach:** Extract wordlist to separate `.json` or `.ts` file. Lazy-load wordlist only when passphrase generation is first requested (defer until needed). Consider Web Worker for entropy gathering if performance becomes critical.

---

### Rate Limiting Silent Degradation on Redis Failure

**Issue:** All rate limiters set `passOnStoreError: true`, meaning if Redis is unavailable, rate limiting is silently disabled with no visibility or logging.

**Files:** `server/src/middleware/rate-limit.ts` (lines 49, 81, 110, 142)

**Impact:** Redis outage completely disables rate limiting without alerting operations. Attackers could brute-force or spam without being rate-limited during outages.

**Fix approach:** Log `warn` level when store errors occur. Consider `passOnStoreError: false` in production (fail closed). Implement circuit-breaker pattern: once Redis is unavailable for 5 minutes, temporarily disable rate limiting and emit alerts rather than silently passing all requests through.

---

### E2E Test Rate Limit Bypass Environment Variable

**Issue:** `E2E_TEST=true` flag sets all rate limits to 1000 (max 1000 req/sec). If this variable is set in staging/production by accident (deployment script error), rate limiting is completely disabled.

**Files:** `server/src/middleware/rate-limit.ts` (lines 5-6, 40, 71, 101, 133)

**Impact:** If `E2E_TEST=true` is ever set in production, rate limiting fails silently.

**Fix approach:** Gate the bypass behind `NODE_ENV === 'test' && E2E_TEST === 'true'`, not just `E2E_TEST`. Alternatively use `VITEST_WORKER_THREADS` or `CI` environment variables which are less likely to be manually set.

---

### Expiration Worker Ciphertext Zeroing Simplified Pattern

**Issue:** `server/src/workers/expiration-worker.ts` zeros all anonymous expired secrets with single `'0'` character (line 32, 38) instead of `'0'.repeat(originalLength)`. This simplification does not match SECR-08 data remanence mitigation described in comments.

**Files:** `server/src/workers/expiration-worker.ts` (lines 32, 38)

**Impact:** Zeroed ciphertext length is always 1 byte, revealing original length of plaintext via length inference. Violates documented SECR-08 mitigation intent (though threat model acceptance is documented).

**Fix approach:** Either (a) query original ciphertext length before bulk update and zero to matching length, or (b) update security comments to clarify that length-revealing via zero pattern is an accepted trade-off for bulk-update performance. Document threat model explicitly (forensic disk recovery is out-of-scope; WAL/buffer remanence is in-scope).

---

### OAuth State Mismatch Workaround Fragile in Development

**Issue:** `server/src/app.ts` lines 76-87 implement dev-only OAuth callback bounce middleware to work around Vite proxy state cookie mismatch. Fix checks for `X-Forwarded-Host` header and bounces direct callbacks through APP_URL.

**Files:** `server/src/app.ts` (lines 76-87)

**Impact:** If Vite proxy behavior changes or X-Forwarded-Host detection logic breaks, OAuth will fail silently in dev. Fix assumes APP_URL matches the proxy domain exactly.

**Fix approach:** Move OAuth bounce logic to dedicated middleware module with explicit debug logging. Add feature flag to disable bounce if Vite behavior stabilizes in future versions. Document the assumption that `APP_URL` must match Vite proxy hostname.

---

### Stripe Singleton Initialization Fragility

**Issue:** `server/src/config/stripe.ts` exports module-level Stripe singleton. If initialization fails or env vars are missing, the entire server fails to start with non-descriptive error at module load time.

**Files:** `server/src/config/stripe.ts`

**Impact:** Env var typos or missing values cause opaque startup errors. If STRIPE_SECRET_KEY is wrong, error occurs during require/import, not at route handler.

**Fix approach:** Lazily initialize Stripe on first API call (POST /api/billing/checkout). Env vars are already validated in `config/env.ts` via Zod, so defer SDK instantiation to route handlers with explicit error boundaries.

---

### Console.error() Instead of Pino Logger

**Issue:** Fire-and-forget email and Loops errors in notification.service.ts and subscribers.service.ts use `console.error()` instead of Pino logger.

**Files:**
- `server/src/services/notification.service.ts` (line 36)
- `server/src/services/subscribers.service.ts` (lines 161, 197)

**Impact:** Production error tracking (Sentry, Datadog) cannot see email delivery failures or Loops sync failures. Silent data loss.

**Fix approach:** Replace `console.error()` with `logger.error()`. Ensure messages follow zero-knowledge invariant (no userId + secretId combinations). This is a straightforward 3-line fix.

