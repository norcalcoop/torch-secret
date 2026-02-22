# Codebase Concerns

**Analysis Date:** 2026-02-20

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

### Rate Limiting MemoryStore Reset (v1.0 finding, unresolved)

**Issue:** Rate limiter uses in-memory storage by default (RedisStore is opt-in via `REDIS_URL`). Server restart clears all rate limit counters.

**Files:** `server/src/middleware/rate-limit.ts`, `server/src/app.ts`

**Impact:** Degrades brute-force protection in single-instance deployments. Production deployments must set `REDIS_URL` to enable persistent rate limiting.

**Fix approach:** Not a bug (documented expected behavior). For production, set `REDIS_URL` environment variable to enable persistent rate limiting across restarts and instances.

---

### Trust Proxy Single-Hop Assumption (v1.0 finding, unresolved)

**Issue:** `app.set('trust proxy', 1)` assumes exactly one proxy hop (load balancer → Express). Incorrect hop count breaks rate limiting and HTTPS redirect.

**Files:** `server/src/app.ts` (line 48)

**Impact:** Multi-hop deployments (e.g., CDN → LB → Express) will use wrong IP for rate limiting, allowing bypass. Setting too high allows X-Forwarded-For spoofing.

**Fix approach:** Count exact proxy hops in production environment, update trust proxy value accordingly. Never use `true` (trusts all proxies). Current single-hop is correct for Render.com and Docker Compose deployments.

---

### No E2E Test Coverage for Fragment Handling (v1.0 finding, resolved in v3.0)

**Issue:** E2E tests were missing. Fragment handling in reveal page relies on `window.location.hash`.

**Files:** Originally `client/src/router.ts`, `client/src/pages/reveal.ts`

**Status:** RESOLVED in Phase 17 (v3.0). Playwright E2E tests now cover create-reveal-decrypt flow.

---

## Known Bugs

**None detected in v4.0 phases 21-22.**

All tests pass (19/19 automated checks in Phase 22 auth integration tests). No TODO/FIXME/HACK comments found in new Phase 21-22 source code. Verification documents explicitly checked for anti-patterns and found none.

Earlier v1.0-v3.0 concerns (linting, deployment, health checks, graceful shutdown) have been resolved:
- ✅ ESLint 10 flat config (Phase 15)
- ✅ Dockerfile + docker-compose.yml (Phase 16)
- ✅ `/api/health` endpoint (Phase 16)
- ✅ Graceful shutdown + SIGTERM handler (Phase 16)

---

## Security Considerations

### Zero-Knowledge Invariant Enforcement Coverage (Phase 21-22 enhancement)

**Area:** User-Secret Correlation Prevention

**Risk:** Any code path that logs, stores in DB, or sends to analytics both a `userId` and `secretId` in the same record violates the zero-knowledge security model.

**Files:**
- `.planning/INVARIANTS.md` — canonical enforcement rule
- `server/src/db/schema.ts` (lines 5-21) — schema-level enforcement with block comment
- `server/src/middleware/logger.ts` (line 28) — regex redaction of secret IDs from URL paths
- `server/src/auth.ts` (lines 8-14) — cross-reference to invariant

**Current mitigation (Phase 21-22):**
- DB: `secrets.user_id` is nullable FK with `onDelete: 'set null'` — preserves already-shared links if user deletes account
- Logger: Regex `/\/api\/secrets\/[A-Za-z0-9_-]+/g` redacts all secret IDs in logged URLs before any output
- Analytics: PostHog phase (25) will enforce `sanitize_properties` stripping URL fragments

**Recommendations:**
- During Phase 25 (PostHog Analytics), add `sanitize_properties` rule to strip `#` fragment before sending any event to PostHog
- During Phase 23+ (when dashboard queries secrets by userId), audit new query paths to ensure dashboard never returns `secrets.id` in the same response object alongside `userId`

---

### Better Auth Email Verification Bypass in Test Environment (Phase 22 finding)

**Area:** Test Infrastructure

**Risk:** Email verification gate is disabled in test environment (`NODE_ENV=test`) via `requireEmailVerification: env.NODE_ENV !== 'test'` in `server/src/auth.ts` (line 42). This allows unverified users to log in during testing but creates a potential gap if this configuration leaks to production.

**Files:**
- `server/src/auth.ts` (line 42)
- `server/src/config/env.ts` (NODE_ENV validation)

**Impact:** Integration tests can validate auth flows without real email delivery infrastructure. If NODE_ENV is accidentally set to 'test' in production, email verification is silently bypassed.

**Mitigation:** Current enforcement is correct—ENV_SCHEMA ensures NODE_ENV must be one of ['development', 'production', 'test']. The bypass is intentional and properly scoped. Risk is LOW if deployment ensures NODE_ENV is never 'test' on production servers.

---

### Password Hashing on Server Side (v1.0 security finding, still valid)

**Risk:** Passwords for password-protected secrets are transmitted to server in plaintext (over HTTPS) and hashed with Argon2id server-side. Compromised TLS or server logs could expose passwords.

**Files:** `server/src/services/password.service.ts`, `client/src/pages/create.ts`

**Current mitigation:** HTTPS required in production (`httpsRedirect` middleware). Passwords never logged (redaction verified in Phase 22 integration tests).

**Status:** Acceptable trade-off per design doc. Client-side hashing would leak hash to URL fragment, defeating password purpose.

---

### No CSRF Protection (v1.0 security finding, still valid)

**Risk:** API endpoints do not implement CSRF tokens. Malicious sites could POST to `/api/secrets` from victim's browser.

**Files:** All routes in `server/src/routes/secrets.ts`

**Current mitigation:** No sensitive state changes exist (no user accounts harmed by creating throwaway encrypted blob). CSRF creates throwaway encrypted blob—low impact.

**Status:** Risk is LOW for anonymous phase. Phase 27 (when conversion prompts target account creation) should reassess CSRF risk if account creation becomes attack target.

---

### Rate Limit Bypass via IP Rotation (v1.0 security finding, still valid)

**Risk:** Rate limiting is per-IP. Attackers with botnets or VPN services can rotate IPs to bypass 10 req/hr limit on secret creation.

**Files:** `server/src/middleware/rate-limit.ts`

**Current mitigation:** Per-secret password attempts (3 max) limit brute-force on individual secrets. Redis-backed rate limiting shares state across instances.

**Status:** Acceptable for MVP. Phase 27 will tighten anonymous limits to 3 secrets/hour + 10/day with explicit upsell messaging for higher limits.

---

### No WAF or DDoS Protection (v1.0 security finding, still valid)

**Risk:** Application has no Web Application Firewall or DDoS mitigation at application layer

**Files:** N/A (infrastructure concern)

**Current mitigation:** Relies on reverse proxy (Nginx, Render.com load balancer) for basic protection

**Status:** Production deployment should use Cloudflare, AWS WAF, or similar. Render.com includes DDoS protection at platform layer.

---

## Performance Bottlenecks

### Argon2 Password Hashing Blocks Event Loop (v1.0 finding, still valid)

**Problem:** `argon2.hash()` and `argon2.verify()` are CPU-intensive synchronous operations that block Node.js event loop

**Files:** `server/src/services/password.service.ts`

**Cause:** Argon2 intentionally uses high memory and CPU to resist brute-force. Single-threaded Node.js blocks all requests during hash computation.

**Improvement path:** Use `@phc/argon2` async bindings or move password operations to worker threads. Current impact is LOW (password-protected secrets are rate-limited to 3 attempts; password reset/verification uses fire-and-forget email callbacks).

---

### Database Connection Pool Not Tuned (v1.0 finding, still valid)

**Problem:** PostgreSQL connection pool uses default `pg` settings (max 10 connections)

**Files:** `server/src/db/connection.ts`

**Cause:** No explicit pool configuration.

**Improvement path:** Add `max`, `min`, `idleTimeoutMillis` pool config based on production workload. Monitor connection usage metrics. For current deployment with single instance and moderate traffic, default is acceptable.

---

### Secrets Table Lacks Index on expiresAt (v1.0 finding, resolved in v3.0)

**Previous issue:** Expiration worker queries `SELECT id FROM secrets WHERE expires_at <= $1` without index

**Status:** RESOLVED in Phase 2. Schema includes expiration cleanup logic with proper transaction handling. Monitor performance as secret count grows.

---

### Dashboard Query Scaling (Phase 23 Ahead-of-Schedule Concern)

**Area:** Secret History Retrieval

**Issue:** Phase 23 will implement dashboard showing a user's secret history. Current schema includes partial index `secrets_user_id_created_at_idx` (lines 127-131 in schema.ts), which filters and sorts by user + creation date.

**Files:** `server/src/db/schema.ts` (lines 126-131)

**Current status:** Index exists and is correctly designed. No implementation yet (Phase 23 pending).

**Scaling path:**
- Index on `(userId, createdAt DESC) WHERE userId IS NOT NULL` is efficient for < 100M secrets per user
- If user base reaches 1M+ users, implement cursor-based pagination on dashboard (fetch 50 secrets per request, not all)
- At 10M+ users, consider read replicas for dashboard queries

**No action needed for v4.0** — Phase 23 spec already calls for pagination.

---

### Playwright E2E Test Webserver Timeout (Phase 20 finding, still valid)

**Area:** CI/CD Pipeline Stability

**Issue:** Playwright webServer in `e2e/playwright.config.ts` (line 21) has 30-second timeout before declaring startup failed. On slow CI runners, building client + starting server could exceed this.

**Files:** `e2e/playwright.config.ts` (line 21)

**Impact:** E2E tests fail if webServer startup takes > 30s. Not a code defect—a testing infrastructure constraint.

**Recommendation:** If CI times out, pre-build client in CI job BEFORE running Playwright, or increase timeout to 60s. Current 30s is appropriate for local development.

---

## Expiration Worker Coverage (v1.0-v3.0 finding, still valid)

### No Inline Cleanup on getSecretMeta()

**Area:** Expired Secret Cleanup Timing

**Issue:** `getSecretMeta()` in `server/src/services/secrets.service.ts` (lines 127-129) detects expired secrets but does not delete them — it just returns null. Inline cleanup happens in `retrieveAndDestroy()` and `verifyAndRetrieve()` (they're in transactions).

**Files:** `server/src/services/secrets.service.ts` (lines 127-129)

**Impact:** Expired secrets stick around in DB until either someone tries to retrieve them (cleanup happens in transaction), or the 5-minute expiration worker runs.

**Status:** Intentional per code comment. The worker ensures cleanup even if no one tries to access an expired secret. Design is sound—lazy deletion + periodic cleanup is a good pattern.

---

## Test Coverage Gaps

### Integration Tests Require Live PostgreSQL (Phase 22 finding)

**Area:** Test Database Setup

**Issue:** Integration tests in `server/src/tests/auth.test.ts` and `server/src/routes/__tests__/*.test.ts` use a real PostgreSQL instance — they do not use mocks or SQLite in-memory.

**Files:**
- `server/src/tests/auth.test.ts`
- `server/src/routes/__tests__/secrets.test.ts`
- `server/src/routes/__tests__/expiration.test.ts`
- `vitest.config.ts` (server project config)

**Impact:** CI must provide a PostgreSQL instance. Local development requires manual PostgreSQL setup or Docker Compose.

**Recommendation:** Document that `npm test` requires PostgreSQL running. Docker Compose in repo provides quick setup: `docker-compose up` starts PostgreSQL on localhost:5432. GitHub Actions CI includes PostgreSQL service.

---

### Frontend Accessibility Testing Limited to Static Analysis (Phase 15 finding, partially resolved)

**Area:** Runtime Accessibility Validation

**Issue:** `client/src/__tests__/accessibility.test.ts` uses vitest-axe for static ARIA violation checks. Dynamic form interactions (password field validation, focus management during async auth flows) are not covered in unit tests.

**Files:** `client/src/__tests__/accessibility.test.ts`

**Current coverage:** Phase 17 E2E tests include accessibility assertions via Playwright. E2E specs verify focus management, screen reader announcements, and keyboard navigation.

**Status:** Unit tests cover static violations. E2E tests cover dynamic interactions. Coverage is adequate for v4.0.

---

## Fragile Areas

### Better Auth Library Dependency Risk (Phase 22 finding)

**Files:**
- `server/src/auth.ts`
- `server/src/middleware/require-auth.ts`
- `client/src/api/auth-client.ts`
- `server/src/db/schema.ts` (Better Auth table definitions)

**Why fragile:**
- Better Auth is a relatively new library (0.x versions indicate active development)
- Session cookie must use `sameSite: 'lax'` for OAuth callbacks; any regression could break OAuth
- Email callbacks use non-async fire-and-forget pattern (`void Promise.resolve()`) to satisfy TypeScript—unconventional approach that could break if Better Auth changes callback type expectations
- drizzleAdapter requires explicit schema mappings (`user: schema.users`, `verifications: schema.verification`) due to Better Auth's singular naming—migration to different auth library would require substantial refactoring

**Safe modification:**
- Updates to Better Auth: review changelog for cookie handling or session schema changes
- Test all 7 auth flows (registration, login, password reset, OAuth Google, OAuth GitHub, logout, session persistence) after any Better Auth upgrade
- Document current session cookie settings in case future phases need to adjust sameSite policy

---

### Incomplete Dashboard Implementation (Phase 23 Prerequisite, Phase 22 finding)

**Files:**
- `client/src/pages/dashboard.ts` (stub only—shows user name + logout button)
- No secret history UI yet
- No label creation yet
- No secret deletion from dashboard yet

**Why fragile:**
- Phase 23 will add secret history, labels, and delete buttons—substantial feature addition
- Dashboard queries will use `secrets_user_id_created_at_idx` partial index; incorrect query construction could cause table scans instead of index usage
- Zero-knowledge requirement: dashboard must NOT expose any secret material (ciphertext, IV, encryption keys, or secret ID in metadata responses)

**Safe modification:**
- When implementing Phase 23, audit dashboard queries to ensure they filter by `userId IS NOT NULL` so the partial index is used
- Write tests verifying dashboard does NOT return ciphertext, encryption keys, or secret ID in metadata responses
- Use cursor-based pagination from the start (don't load all secrets at once)

---

### Client-Side Routing and URL Fragment Handling (v3.0 finding, still valid)

**Files:** `client/src/router.ts`, `client/src/pages/reveal.ts`

**Why fragile:** Encryption key extraction relies on `window.location.hash` and `history.replaceState`. Browser extensions, proxies, or non-standard user agents may interfere.

**Safe modification:** Always test changes with multiple browsers (Chrome, Firefox, Safari). Fragment MUST be stripped immediately before any async operations. E2E tests verify fragment handling end-to-end.

---

### Secrets Service Transaction Ordering (v1.0 finding, still valid)

**Files:** `server/src/services/secrets.service.ts` (retrieveAndDestroy, verifyAndRetrieve)

**Why fragile:** Atomic read-and-destroy relies on exact order: SELECT → expiration check → password check → zero → delete. Reordering breaks anti-enumeration guarantees (SECR-07).

**Safe modification:** NEVER move password check before expiration check. Expired password-protected secrets must return null (same as not-found). Add test case for any logic changes. Integration tests verify all edge cases.

---

## Scaling Limits

### PostgreSQL Query Performance with Large Secret Counts (Phase 23 ahead-of-schedule)

**Current capacity:** Single PostgreSQL instance, no replication or caching layer.

**Limit:** Once user base reaches 10M+ users with 1K+ secrets each, dashboard queries could become slow.

**Scaling path:**
- Phase 23: Implement cursor-based pagination on dashboard (fetch 50 secrets per request, not all)
- Phase 27: Add Redis caching for frequently accessed user secret metadata
- v5.0+: Read replicas for dashboard queries
- v6.0+: Partition secrets table by userId if single index becomes bottleneck

---

### In-Memory Rate Limiter Without Redis (v1.0 finding, still valid)

**Current capacity:** Rate limiter uses in-memory store by default. Each process instance has independent counters.

**Limit:** Multi-instance deployments without Redis allow each server instance independent rate limit counters—determined attacker could distribute requests across instances and bypass limits.

**Scaling path:** Production deployments must provide `REDIS_URL` to Redis instance shared across all server instances. Current code already supports this.

---

### node-cron Scheduler Reliability (Phase 22 finding)

**Risk:** node-cron is simple but not distributed. If server process restarts, in-flight expiration tasks are lost.

**Files:** `server/src/workers/expiration-worker.ts`

**Current approach:** Expiration worker runs every 5 minutes. Worst case: if server crashes, expired secrets could stay in DB for up to 5 minutes after restart.

**Impact:** Low — expired secrets are non-functional after their time. Next cleanup cycle removes them.

**Scaling path:** v5.0+ with multiple instances: Move to Bull + Redis queue if running multiple server instances to ensure distributed cleanup.

---

## Missing Critical Features

### No IP-Based Rate Limiting in OAuth Callback (Phase 22 finding)

**Problem:** OAuth callbacks via `/api/auth/callback/{provider}` are not rate-limited. An attacker could attempt many OAuth account creation requests without hitting rate limits.

**Files:**
- `server/src/auth.ts` (Better Auth handles OAuth internally; no custom route)
- Rate limiting is NOT applied to `/api/auth/*` routes

**Blocks:** OAuth account enumeration or spam account creation attacks.

**Recommendation:** Phase 25+ hardening concern. When PostHog analytics are added, also review OAuth callback security:
1. Rate limit OAuth state parameter validation failures (prevents CSRF brute-force)
2. Log failed OAuth attempts for monitoring
3. Consider account creation cooldown after N failed attempts

---

### No Audit Logging for Auth Events (Phase 22 finding)

**Problem:** User creation, password changes, OAuth sign-ins, and logout events are not logged to a separate audit trail. Only HTTP request logs available, and secret IDs are redacted.

**Files:** No audit table in schema.ts; no audit middleware

**Blocks:** Compliance with SOC2/ISO 27001 requirements. No forensic trail for investigating account compromise.

**Recommendation:** Phase 26+ (after email notifications). Add optional audit logging:
1. Create `audit_logs` table (timestamp, userId, event type, ip_address, user_agent)
2. Log all auth events: sign_up, sign_in, password_reset, oauth_connect, logout
3. MUST NOT log secret IDs (keep zero-knowledge invariant)
4. Add /api/me audit endpoint for users to review their login history

---

## Dependencies at Risk

### Better Auth Library (Phase 22 new dependency)

**Risk:** Better Auth is actively developed (0.x versions). Session handling and OAuth integration could change in minor versions.

**Versions:** ~0.13.x

**Impact:** Updates could introduce breaking changes to session validation or OAuth callback behavior

**Migration plan:** Pin to major.minor versions. Test all auth flows (registration, login, password reset, OAuth, logout) before upgrading. Review changelog for session schema or callback signature changes.

---

### Node.js 24.x (LTS Active)

**Risk:** Node 24 LTS support ends April 2027 (13 months from now)

**Impact:** Security updates cease after EOL

**Migration plan:** Upgrade to Node 26 LTS (release Oct 2026) before April 2027 EOL.

---

### Express 5.x (v3.0 finding, still valid)

**Risk:** Express 5 stable released Feb 2024. Ecosystem middleware may have compatibility issues.

**Status:** All current middleware (helmet, rate-limit, pino-http) support Express 5. No breaking changes encountered in v3.0-v4.0 development.

---

## Recommendations Summary

### High Priority

None — all critical paths are secure and functional.

### Medium Priority

1. **Auth page noindex** (Phase 22 tech debt) — Extend server-side X-Robots-Tag to cover /login, /register, /forgot-password, /reset-password, /dashboard
2. **OAuth rate limiting** (Phase 25+ research) — Review OAuth callback security before social login goes live at scale
3. **Audit logging** (Phase 26+ design) — Plan audit table and event logging for compliance if user base grows

### Low Priority (Future Phases)

1. **Dashboard query optimization** (Phase 23 implementation) — Use cursor pagination from the start; audit partial index usage
2. **Analytics invariant enforcement** (Phase 25 implementation) — Validate PostHog sanitize_properties config strips URL fragments
3. **Extend E2E accessibility testing** (extend Phase 17) — Add focus management and screen reader announcement tests to all auth flows

---

*Concerns audit: 2026-02-20*
