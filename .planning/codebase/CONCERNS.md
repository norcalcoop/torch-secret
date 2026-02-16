# Codebase Concerns

**Analysis Date:** 2026-02-16

## Tech Debt

**Rate Limiting MemoryStore Reset:**
- Issue: Rate limiter uses in-memory storage by default (RedisStore is opt-in via `REDIS_URL`). Server restart clears all rate limit counters, allowing attackers to bypass limits by triggering restarts.
- Files: `server/src/middleware/rate-limit.ts`, `server/src/app.ts`
- Impact: Degrades brute-force protection in single-instance deployments. Production multi-instance deployments require Redis.
- Fix approach: Not a bug (documented as expected behavior). For production, set `REDIS_URL` environment variable to enable persistent rate limiting across restarts and instances.

**Placeholder Domain in SEO Assets:**
- Issue: Static HTML uses placeholder domain `secureshare.example.com` in Open Graph and Twitter card metadata
- Files: `client/index.html` (likely)
- Impact: Social media previews show incorrect domain in production
- Fix approach: Replace with actual production domain when deploying. Requires one-line find-replace in HTML template.

**Lucide Icons ESM Workaround:**
- Issue: Vite config includes `resolve.alias` workaround to force Lucide imports to ESM entry point
- Files: `vite.config.ts` (if exists), documented in `.planning/STATE.md`
- Impact: Non-standard import resolution. May break if Lucide updates package structure.
- Fix approach: Monitor upstream Lucide package for ESM fix, remove alias when resolved.

**Trust Proxy Single-Hop Assumption:**
- Issue: `app.set('trust proxy', 1)` assumes exactly one proxy hop (load balancer → Express). Incorrect hop count breaks rate limiting and HTTPS redirect.
- Files: `server/src/app.ts` (line 39)
- Impact: Multi-hop deployments (e.g., CDN → LB → Express) will use wrong IP for rate limiting, allowing bypass. Setting too high allows X-Forwarded-For spoofing.
- Fix approach: Count exact proxy hops in production environment, update trust proxy value accordingly. Never use `true` (trusts all proxies).

**No E2E Test Coverage:**
- Issue: Only unit and integration tests exist. No browser-based end-to-end tests for full create-share-reveal flow.
- Files: Missing `tests/e2e/` directory
- Impact: Regressions in client-side crypto, DOM manipulation, or API integration may not be caught until manual testing.
- Fix approach: Addressed in Phase 17 (Playwright E2E tests). Will cover full user journeys, password flow, error states, and accessibility.

**No Linting or Formatting Configuration:**
- Issue: No ESLint, Prettier, or formatting config files exist. No pre-commit hooks to enforce code style.
- Files: Missing `.eslintrc.*`, `.prettierrc`, `.husky/`
- Impact: Inconsistent code style, potential bugs from missing linter rules (unused vars, unsafe any, etc.)
- Fix approach: Addressed in Phase 15 (ESLint 10 flat config + Prettier + Husky hooks). Will enforce TypeScript strict mode and format on commit.

**No Deployment Configuration:**
- Issue: No Dockerfile, docker-compose.yml, or Render.com Blueprint exists
- Files: Missing deployment configs
- Impact: Cannot deploy to production without manual setup. New contributors cannot run full stack with one command.
- Fix approach: Addressed in Phase 16 (Docker + docker-compose + render.yaml + health check endpoint).

## Known Bugs

**None detected.**

All tests pass (163/163). No TODO/FIXME/HACK comments found in source code. Verification documents from v1.0 and v2.0 phases explicitly checked for anti-patterns and found none.

## Security Considerations

**Ciphertext Zeroing Limited to PostgreSQL:**
- Risk: Secrets use "zero ciphertext → delete row" pattern to mitigate data remanence in PostgreSQL WAL/buffers. However, zeroing does not extend to OS page cache, disk controller cache, or SSD wear leveling.
- Files: `server/src/services/secrets.service.ts` (lines 77-99, 197-214)
- Current mitigation: Database-level zeroing reduces attack surface. Physical access to storage media still poses risk.
- Recommendations: Document threat model limitation. For ultra-sensitive deployments, consider encrypted PostgreSQL tablespaces or full-disk encryption.

**Password Hashing on Server Side:**
- Risk: Passwords for password-protected secrets are transmitted to server in plaintext (over HTTPS) and hashed with Argon2id server-side. Compromised TLS or server logs could expose passwords.
- Files: `server/src/services/password.service.ts`, `client/src/pages/create.ts` (line 195)
- Current mitigation: HTTPS required in production (`httpsRedirect` middleware). Passwords never logged (verified in Phase 7).
- Recommendations: Acceptable trade-off per design doc. Client-side hashing would leak hash to URL fragment, defeating password purpose.

**No CSRF Protection:**
- Risk: API endpoints do not implement CSRF tokens. Malicious sites could POST to `/api/secrets` from victim's browser.
- Files: All routes in `server/src/routes/secrets.ts`
- Current mitigation: No sensitive state changes exist (no accounts, no stored credentials). Creating a secret does not harm the "victim."
- Recommendations: Current risk is LOW (CSRF creates throwaway encrypted blob). Monitor if user accounts are added in future.

**Rate Limit Bypass via IP Rotation:**
- Risk: Rate limiting is per-IP. Attackers with botnets or VPN services can rotate IPs to bypass 10 req/hr limit on secret creation.
- Files: `server/src/middleware/rate-limit.ts`
- Current mitigation: Per-secret password attempts (3 max) limit brute-force on individual secrets. Redis-backed rate limiting shares state across instances.
- Recommendations: Acceptable for MVP. For stricter abuse prevention, consider CAPTCHA on secret creation (out of current scope).

**No WAF or DDoS Protection:**
- Risk: Application has no Web Application Firewall or DDoS mitigation at application layer
- Files: N/A (infrastructure concern)
- Current mitigation: Relies on reverse proxy (Nginx, Render.com load balancer) for basic protection
- Recommendations: Production deployment should use Cloudflare, AWS WAF, or similar. Document in deployment guide (Phase 19).

## Performance Bottlenecks

**Argon2 Password Hashing Blocks Event Loop:**
- Problem: `argon2.hash()` and `argon2.verify()` are CPU-intensive synchronous operations that block Node.js event loop
- Files: `server/src/services/password.service.ts`
- Cause: Argon2 intentionally uses high memory and CPU to resist brute-force. Single-threaded Node.js blocks all requests during hash computation.
- Improvement path: Use `@phc/argon2` async bindings or move password operations to worker threads. Current impact is LOW (password-protected secrets are rare in expected usage).

**Database Connection Pool Not Tuned:**
- Problem: PostgreSQL connection pool uses default `pg` settings (max 10 connections)
- Files: `server/src/db/connection.ts`
- Cause: No explicit pool configuration. May exhaust connections under high load.
- Improvement path: Add `max`, `min`, `idleTimeoutMillis` pool config based on production workload. Monitor connection usage metrics.

**No Response Caching:**
- Problem: Static assets (JS, CSS) served with no cache headers
- Files: `server/src/app.ts` (line 63, `express.static` with default options)
- Cause: No explicit `maxAge` or `immutable` cache directives
- Improvement path: Add `maxAge: '1y', immutable: true` to `express.static` options for hashed assets. Requires Vite build to generate hashed filenames.

**Secrets Table Lacks Index on expiresAt:**
- Problem: Expiration worker queries `SELECT id FROM secrets WHERE expires_at <= $1` without index
- Files: `server/src/workers/expiration-worker.ts`, `drizzle/0000_*_schema.sql`
- Cause: Initial schema omitted index. Full table scan on every worker run (every 5 minutes).
- Improvement path: Add `CREATE INDEX idx_secrets_expires_at ON secrets(expires_at)` via Drizzle migration. Critical for scaling beyond 10k secrets.

## Fragile Areas

**Client-Side Routing and URL Fragment Handling:**
- Files: `client/src/router.ts`, `client/src/pages/reveal.ts` (lines 48-55)
- Why fragile: Encryption key extraction relies on `window.location.hash` and `history.replaceState`. Browser extensions, proxies, or non-standard user agents may interfere with fragment handling.
- Safe modification: Always test changes with multiple browsers (Chrome, Firefox, Safari). Fragment MUST be stripped immediately (lines 51-55) before any async operations.
- Test coverage: No E2E tests for fragment handling. Phase 17 will add Playwright coverage.

**CSP Nonce Injection in HTML Template:**
- Files: `server/src/app.ts` (lines 66-78), `server/src/middleware/security.ts`
- Why fragile: SPA catch-all route replaces `__CSP_NONCE__` placeholder in HTML template with per-request nonce. Typo in placeholder or missing `cspNonceMiddleware` breaks inline scripts.
- Safe modification: Middleware order is CRITICAL (line 20 comment). Nonce middleware MUST run before helmet. Test with browser DevTools → Network → Response Headers to verify CSP header matches inline script nonce.
- Test coverage: Security tests verify middleware order (line 302 in `security.test.ts`).

**Secrets Service Transaction Ordering:**
- Files: `server/src/services/secrets.service.ts` (retrieveAndDestroy, verifyAndRetrieve)
- Why fragile: Atomic read-and-destroy relies on exact order: SELECT → expiration check → password check → zero → delete. Reordering breaks anti-enumeration guarantees (SECR-07).
- Safe modification: NEVER move password check before expiration check. Expired password-protected secrets must return null (same as not-found). Add test case for any logic changes.
- Test coverage: 32 integration tests in `secrets.test.ts`, including edge cases for expired password-protected secrets.

**Theme Toggle localStorage Synchronization:**
- Files: `client/src/components/theme-toggle.ts`
- Why fragile: Theme state lives in localStorage and is synced across tabs via `storage` event. Race conditions possible if multiple tabs toggle theme simultaneously.
- Safe modification: Current implementation uses last-write-wins. Safe for intended use case (single user). Avoid complex conflict resolution.
- Test coverage: Component tests verify localStorage write/read. No multi-tab tests.

## Scaling Limits

**Single PostgreSQL Instance:**
- Current capacity: Depends on hosting provider. Render.com free tier: 100MB storage, shared CPU.
- Limit: Vertical scaling only. Single point of failure.
- Scaling path: Add read replicas for GET queries, keep writes on primary. Or shard by secret ID prefix (first char of nanoid).

**Expiration Worker Single-Instance:**
- Current capacity: One cron job runs every 5 minutes per server instance
- Limit: Multiple instances run duplicate cleanup (inefficient but not incorrect). Very large expired secret backlog may time out.
- Scaling path: Use distributed locking (Redis SETNX) or job queue (BullMQ) to ensure only one worker runs across all instances.

**In-Memory Rate Limiting (Default):**
- Current capacity: Rate limit state lost on server restart. Not shared across instances.
- Limit: Multi-instance deployments require Redis (opt-in via `REDIS_URL`).
- Scaling path: Already implemented. Set `REDIS_URL` in production environment.

**No CDN for Static Assets:**
- Current capacity: Express serves static files from local filesystem
- Limit: High traffic = high origin server load
- Scaling path: Upload build artifacts to S3/Cloudflare R2, serve via CDN. Update `express.static` to proxy origin for cache misses.

## Dependencies at Risk

**Express 5.x (Recently Released):**
- Risk: Express 5 stable released Feb 2024. Ecosystem middleware may have compatibility issues.
- Impact: Middleware updates could introduce breaking changes
- Migration plan: Monitor Express 5 adoption. Current middleware (helmet, rate-limit, pino-http) all support Express 5.

**Zod 4.x (Recently Released):**
- Risk: Zod 4 stable released recently. Migration from v3 required `ZodType` → `ZodSchema` refactor.
- Impact: Type inference breakage, schema validation behavior changes
- Migration plan: Pin to `^4.3.6`. Monitor Zod releases for security patches.

**ESLint 10.x (Not Yet Installed):**
- Risk: ESLint 10 released Feb 2026 (10 days ago). Ecosystem plugins may lag flat config support.
- Impact: Phase 15 will adopt ESLint 10. May encounter plugin compatibility issues.
- Migration plan: Test with `typescript-eslint` v9 (supports flat config). Have fallback to ESLint 9 if ecosystem not ready.

**Node.js 24.x (LTS Active):**
- Risk: Node 24 LTS support ends April 2027 (13 months from now)
- Impact: Security updates cease after EOL
- Migration plan: Upgrade to Node 26 LTS (release Oct 2026) before April 2027 EOL.

## Missing Critical Features

**No Health Check Endpoint:**
- Problem: No `/api/health` endpoint for load balancer probes or monitoring
- Blocks: Production deployment to Render.com, Kubernetes, or any platform requiring health checks
- Priority: HIGH (blocks Phase 16 Docker deployment)

**No Graceful Shutdown Handling:**
- Problem: Server shutdown does not drain active requests or close database connections cleanly
- Blocks: Zero-downtime deployments
- Priority: MEDIUM (current `server.ts` has SIGTERM handler but no connection draining)

**No Monitoring or Observability:**
- Problem: No error tracking (Sentry), no metrics (Prometheus), no distributed tracing
- Blocks: Production debugging and performance analysis
- Priority: MEDIUM (can deploy without, but blind to issues)

**No Automated Backups:**
- Problem: No database backup strategy documented or automated
- Blocks: Disaster recovery
- Priority: HIGH for production (Render.com provides automated backups, but not tested)

## Test Coverage Gaps

**Client-Side Crypto Integration:**
- What's not tested: End-to-end flow of encrypt → POST → GET → decrypt in real browser
- Files: `client/src/crypto/`, `client/src/pages/create.ts`, `client/src/pages/reveal.ts`
- Risk: Integration bugs between crypto module and API client may not surface until manual testing
- Priority: HIGH (covered by Phase 17 Playwright tests)

**Rate Limit Redis Fallback:**
- What's not tested: Behavior when Redis is unavailable (should fall back to MemoryStore per `passOnStoreError: true`)
- Files: `server/src/middleware/rate-limit.ts`
- Risk: Redis outage could block all requests if fallback is broken
- Priority: MEDIUM (low probability, high impact)

**Expiration Worker Error Handling:**
- What's not tested: Worker behavior when database connection fails mid-cleanup
- Files: `server/src/workers/expiration-worker.ts`
- Risk: Unhandled database errors could crash worker or leak secrets
- Priority: MEDIUM (worker tests mock database, not real failure scenarios)

**Theme Toggle Cross-Tab Sync:**
- What's not tested: Theme synchronization when multiple tabs are open
- Files: `client/src/components/theme-toggle.ts`
- Risk: Race conditions or localStorage conflicts could break theme persistence
- Priority: LOW (edge case, cosmetic impact)

**CSP Nonce Injection Under Load:**
- What's not tested: Nonce generation and injection under concurrent requests
- Files: `server/src/middleware/security.ts`, `server/src/app.ts`
- Risk: Race condition could reuse nonce or inject wrong nonce into HTML
- Priority: LOW (middleware uses `res.locals`, which is request-scoped)

**HTTPS Redirect Behind Multiple Proxies:**
- What's not tested: `httpsRedirect` behavior with `trust proxy: 2` or higher
- Files: `server/src/middleware/security.ts` (lines 78-91)
- Risk: Incorrect proxy count breaks HTTPS detection, causing redirect loop or mixed content
- Priority: LOW (current deployment is single-hop, tested in integration tests)

---

*Concerns audit: 2026-02-16*
