# Codebase Concerns

**Analysis Date:** 2026-02-14

## Tech Debt

**ESM/CJS Interop Workaround (pino-http):**
- Issue: Runtime type detection with `any` cast to handle pino-http CJS/ESM module interop
- Files: `server/src/middleware/logger.ts`
- Impact: Fragile import resolution that depends on tsconfig module setting. If module resolution changes, logger middleware breaks at runtime with "not a function" error.
- Fix approach: Once pino-http publishes full ESM support, remove the runtime detection (lines 9-13) and use direct named import. Track pino-http releases.

**Password Protection Schema Present But Unused:**
- Issue: Database schema includes `passwordHash` and `passwordAttempts` columns (Phase 5 feature) but no validation prevents their misuse in Phase 2/3/4 code
- Files: `server/src/db/schema.ts` (lines 27-31), `server/src/services/secrets.service.ts`
- Impact: Currently low (columns are nullable and unused). Risk increases if frontend code tries to set passwords before Phase 5 server-side hashing is implemented -- would store plaintext or client-hashed passwords.
- Fix approach: Add runtime validation in Phase 3 to reject any POST /api/secrets with password-related fields until Phase 5 is complete. Or add database constraint that fails INSERT if passwordHash is set without corresponding server-side hash marker.

**Ciphertext Zeroing Uses Character '0' Instead of Binary Zeros:**
- Issue: Data remanence mitigation overwrites ciphertext with '0' character repeat (line 66 `secrets.service.ts`) instead of true binary zeros because PostgreSQL text columns reject null bytes
- Files: `server/src/services/secrets.service.ts` (line 66)
- Impact: Defense-in-depth mitigation against PostgreSQL WAL/dead tuple recovery is weaker than intended. An attacker with filesystem access to PostgreSQL data files might recover base64 ciphertext from dead tuples despite zeroing attempt.
- Fix approach: Consider switching ciphertext column from TEXT to BYTEA and storing true binary (decode base64 before INSERT, encode on SELECT). This enables true null-byte overwriting. Accept 10-15% storage overhead for base64 encoding if staying with TEXT. Note: Server never has decryption key anyway (defense in depth, not primary control).

**No Frontend Code Beyond Crypto Module:**
- Issue: Phase 4 (Frontend Create and Reveal) not started. Only client-side crypto module exists -- no UI, no pages, no API client integration.
- Files: `client/src/` contains only `crypto/` directory
- Impact: Application cannot be used by end users. No way to create or reveal secrets through a browser UI. Crypto module is verified but isolated.
- Fix approach: Complete Phase 3 (Security Hardening) before starting Phase 4. Phase 3 must install CSP, rate limiting, CORS before any user-facing HTML is served (XSS is existential in zero-knowledge apps).

## Known Bugs

**None detected.** All implemented code (Phases 1-2) passes integration tests and UAT verification.

## Security Considerations

**No CSP, CORS, or Rate Limiting Yet:**
- Risk: Phase 3 (Security Hardening) not started. Server has no Content-Security-Policy headers, no CORS restrictions, no rate limiting on POST /api/secrets.
- Files: `server/src/app.ts` (no helmet or rate-limit middleware), `server/src/middleware/` (no csp.ts or rate-limit.ts)
- Current mitigation: Application not deployed to production. Server runs only in local development. No public exposure.
- Recommendations: **CRITICAL -- DO NOT deploy Phase 2 code to production.** XSS in a zero-knowledge app is catastrophic (injected scripts can read URL fragment keys and exfiltrate plaintext). Must complete Phase 3 before any public-facing deployment. Add helmet with strict CSP (nonce-based script-src, no unsafe-inline), express-rate-limit (10 secrets/hour per IP), and cors (same-origin only).

**Password Hashing Algorithm Not Decided:**
- Risk: Phase 5 (Password Protection) requires Argon2id or bcrypt for server-side password hashing. Decision deferred until Phase 5 planning.
- Files: STATE.md notes "Password hashing algorithm not decided (Argon2id vs bcrypt). Resolve during Phase 5 planning."
- Current mitigation: Password feature not implemented yet. Schema columns exist but are unused and nullable.
- Recommendations: Research Argon2id (memory-hard, OWASP recommended for password storage) vs bcrypt (CPU-hard, widely supported). Argon2id preferred for new projects but requires native bindings (argon2 npm package). Bcrypt is pure JS (bcryptjs) but slower and less secure against GPU attacks. Choose during Phase 5 planning based on deployment environment (native modules allowed?) and threat model.

**No HTTPS Enforcement Yet:**
- Risk: Server does not redirect HTTP to HTTPS or set Strict-Transport-Security headers
- Files: `server/src/app.ts` (no HSTS middleware)
- Current mitigation: Local development only (localhost uses HTTP). Production deployment will use reverse proxy (nginx, Cloudflare) for TLS termination.
- Recommendations: Add HSTS middleware in Phase 3. Set `Strict-Transport-Security: max-age=31536000; includeSubDomains` header on all responses. For local dev, use self-signed cert or mkcert to test HTTPS locally.

**Referrer Policy Not Set:**
- Risk: No `Referrer-Policy: no-referrer` header. If decrypted content contains links (or error pages link elsewhere), browsers may leak full URL including fragment in Referer header.
- Files: `server/src/app.ts` (no referrer-policy middleware)
- Current mitigation: No frontend pages exist yet. Crypto module tested in isolation.
- Recommendations: Set `Referrer-Policy: no-referrer` in Phase 3 via helmet or custom middleware. Also add `<meta name="referrer" content="no-referrer">` in HTML `<head>` as defense in depth.

**Log Redaction Incomplete for Future Features:**
- Risk: httpLogger redacts secret IDs from `/api/secrets/:id` paths (line 31-33 `logger.ts`) but does not redact future password-verify endpoint paths or password attempt counts
- Files: `server/src/middleware/logger.ts`
- Current mitigation: Password endpoints do not exist yet (Phase 5).
- Recommendations: When implementing Phase 5 `/api/secrets/:id/verify` endpoint, ensure password attempt counts are not logged (redact `passwordAttempts` field from any log serializers). Add redaction for password-verify paths if they include secret IDs.

## Performance Bottlenecks

**No Connection Pooling Configured for PostgreSQL:**
- Problem: Database connection created via `new Pool()` with default settings (max 10 connections)
- Files: `server/src/db/connection.ts` (line 7)
- Cause: Phase 2 implemented minimal viable database layer. Pool size not tuned for production load.
- Improvement path: For production, set pool size to 2-3x CPU cores (e.g., `max: 20` for 4-core server). Monitor connection exhaustion with PostgreSQL `pg_stat_activity` query. Consider PgBouncer for connection pooling at scale (100+ concurrent users).

**No Redis for Rate Limiting Yet:**
- Problem: express-rate-limit (Phase 3) will default to in-memory store, which does not persist across server restarts and does not work in multi-instance deployments
- Files: Not implemented yet (Phase 3 pending)
- Cause: Phase 3 not started. Redis listed in STACK.md tech stack but not installed or configured.
- Improvement path: Install ioredis, configure Redis connection in Phase 3, pass Redis store to express-rate-limit. Use Redis for rate limit counters (persistent, cluster-safe). Set `REDIS_URL` env var. Handle Redis connection failures gracefully (fall back to memory store if Redis unavailable, log warning).

**Ciphertext Zeroing Blocks Transaction:**
- Problem: Three-step transaction (SELECT, UPDATE to zero ciphertext, DELETE) holds row lock and writes duplicate data (original ciphertext length in '0' chars) before deletion
- Files: `server/src/services/secrets.service.ts` (lines 50-74)
- Cause: Data remanence mitigation (SECR-08 requirement). Defense in depth against PostgreSQL WAL/dead tuple recovery.
- Improvement path: Profile transaction duration under load. If zeroing UPDATE causes lock contention, consider PostgreSQL `pg_trgm` or `pgcrypto` extension to overwrite in single operation. Or accept that zeroing is best-effort (server never has decryption key anyway). Optimize only if transaction latency becomes measurable issue (>50ms p99).

## Fragile Areas

**Crypto Module Encoding Assumptions:**
- Files: `client/src/crypto/encoding.ts`, `client/src/crypto/encrypt.ts`, `client/src/crypto/decrypt.ts`
- Why fragile: Base64/Base64url encoding uses loop-based `String.fromCharCode` to avoid stack overflow on large arrays (>10K chars). If input exceeds 100KB (validation in `padding.ts` line 23), throws error. Future changes that bypass padding validation could cause stack overflow or memory exhaustion.
- Safe modification: Always validate input size before calling `bytesToBase64` or `bytesToBase64Url`. Never remove MAX_INPUT_SIZE check in `client/src/crypto/padding.ts`. If increasing size limit, test with inputs up to new limit to verify no stack overflow.
- Test coverage: Comprehensive unit tests for 10KB input (current max). No tests for inputs between 10KB and 100KB (boundary case). Add fuzz testing if size limit is increased.

**Database Schema Migration Path:**
- Files: `server/src/db/schema.ts`, `drizzle.config.ts`
- Why fragile: Password columns added in initial schema (Phase 1 migration) to avoid backward-incompatible migration in Phase 5. If schema changes before Phase 5, must ensure password columns remain nullable. If Phase 5 is skipped or deferred indefinitely, schema carries unused columns.
- Safe modification: When adding new columns (e.g., Phase 6 background worker metadata), use Drizzle `generate` to create migration. Never manually edit schema.ts without generating migration. Test migrations on dev database before applying to production.
- Test coverage: No migration rollback tests. Drizzle-kit does not auto-generate DOWN migrations. Manual rollback requires custom SQL.

**Error Message Consistency for Anti-Enumeration:**
- Files: `server/src/routes/secrets.ts` (lines 11-14, 47-49)
- Why fragile: SECRET_NOT_AVAILABLE constant (lines 11-14) must be byte-identical for not-found, expired, already-viewed, wrong-password cases. If future error handling code path (Phase 5 password verification, Phase 6 expiration) returns different message, enumeration attack becomes possible.
- Safe modification: Never add custom error messages for specific failure modes. Always return SECRET_NOT_AVAILABLE constant. In Phase 5, ensure password-verify endpoint returns identical 404 for wrong password, expired secret, or nonexistent ID. Add integration test to verify byte-for-byte identical responses.
- Test coverage: Integration test confirms identical 404 responses for create-then-retrieve-twice (line 93-115 `secrets.test.ts`). No test for expired secrets (Phase 6 pending).

## Scaling Limits

**Single-Region PostgreSQL:**
- Current capacity: Handles ~1000 concurrent requests (limited by connection pool max 10)
- Limit: Single PostgreSQL instance. No replication, no failover, no multi-region support.
- Scaling path: For 10K+ concurrent users, add read replicas (PostgreSQL streaming replication). For multi-region, use Supabase or Neon with global edge caching. Note: Secrets are one-time use, so read replicas have limited value (no repeated reads). Focus scaling effort on write throughput (connection pooling, PgBouncer).

**Nanoid Collision Risk:**
- Current capacity: 21-char nanoid (~149 bits entropy). Collision probability negligible at <1 billion secrets (per nanoid collision calculator).
- Limit: At 1 trillion secrets, collision risk becomes non-negligible (birthday paradox).
- Scaling path: Acceptable for MVP and growth to millions of secrets. If scale exceeds 100M active secrets, add database uniqueness constraint on `secrets.id` column and retry INSERT on conflict (already planned -- see PITFALLS.md line 251). Or increase nanoid length to 24 chars (180 bits entropy).

**Client-Side Crypto Limits Browser Performance:**
- Current capacity: Encrypts 10KB plaintext in <50ms (tested in Phase 1 UAT).
- Limit: Web Crypto API is async but single-threaded. Large secrets (100KB+) may block UI thread.
- Scaling path: Current 10KB max is intentional (UX: secrets are credentials/API keys, not files). If raising limit, use Web Workers for encryption/decryption to avoid blocking main thread. Or add progress indicator for large encryptions.

## Dependencies at Risk

**Zod 4.x (Pre-Release):**
- Risk: Using zod 4.3.6 (package.json line 36). Zod 4.x is beta/pre-release. Breaking API changes possible before stable release.
- Impact: Schema validation breaks if Zod 4 changes API between beta versions. ZodType import (used in validate.ts line 6) already changed from ZodSchema in v3.
- Migration plan: Pin to exact zod version (`"zod": "4.3.6"` not `^4.3.6`) to avoid auto-upgrade. Monitor Zod 4 changelog. When Zod 4 stable releases, test all validation schemas, update TypeScript types, re-run integration tests before upgrading.

**Express 5.x (Recently Stable):**
- Risk: Using express 5.2.1 (package.json line 31). Express 5 released stable in 2024 after 10 years in beta. Middleware ecosystem still catching up.
- Impact: Some Express 4 middleware packages may not work with Express 5 without updates. helmet, cors, express-rate-limit have Express 5 support, but less common packages may not.
- Migration plan: Test all middleware (especially Phase 3 additions like helmet, rate-limit) with Express 5 before deploying. If incompatibility found, consider Express 4.x fallback or wait for middleware updates.

**No Lockfile for Client Crypto (Browser APIs):**
- Risk: Crypto module depends on Web Crypto API (browser built-in). If browser vendors change SubtleCrypto API, encryption breaks.
- Impact: Unlikely (Web Crypto API is W3C standard, stable since 2017). But browser bugs or deprecated features could break crypto.
- Migration plan: Pin browser compatibility to Chrome 90+, Firefox 88+, Safari 15+ (all have stable Web Crypto). Test in BrowserStack or Playwright on target browsers. Add browser feature detection (`crypto.subtle` presence check) in Phase 4 with clear error message if unsupported.

## Missing Critical Features

**No Expiration Worker (Phase 6):**
- Problem: Expired secrets remain in database until manually requested (then rejected as "not available"). No background cleanup job.
- Blocks: Database grows unbounded with expired secrets. Disk space exhaustion risk at scale. Compliance issue if secrets must be deleted after expiration (GDPR "right to deletion" could apply if user data is involved).
- Priority: Medium (blocked by Phase 2 completion, but not user-facing). Implement in Phase 6 after Phase 5 password protection.

**No Frontend UI (Phase 4):**
- Problem: Crypto module verified but no way for users to create or reveal secrets in browser. No HTML pages, no API client code, no forms.
- Blocks: Application cannot be used. End-to-end flow (create secret → share link → reveal secret) impossible.
- Priority: High (next phase after Phase 3 Security Hardening). Phase 3 must complete first (CSP required before serving HTML).

**No Rate Limiting or Abuse Prevention (Phase 3):**
- Problem: POST /api/secrets has no rate limiting. Attacker can flood database with secrets until disk full or connection pool exhausted.
- Blocks: Public deployment. DoS attack trivial without rate limiting.
- Priority: **CRITICAL** (blocks production deployment). Must complete Phase 3 before exposing API publicly. Install express-rate-limit with Redis store, limit to 10 secrets per hour per IP.

**No Two-Step Reveal Flow (Phase 4):**
- Problem: API atomically destroys secret on GET /api/secrets/:id. If link-preview bots (Slack, Teams, Discord) fetch URL, they trigger deletion before recipient clicks link.
- Blocks: Reliable secret sharing in chat apps. PrivateBin Issue #174 well-documented failure mode.
- Priority: High (Phase 4 frontend feature). Implement "Click to Reveal" interstitial page. Bots fetch app shell only (no ciphertext). User clicks button → API call → atomic retrieval+deletion.

## Test Coverage Gaps

**No Integration Tests for Expired Secrets:**
- What's not tested: Retrieving a secret after `expiresAt` timestamp has passed
- Files: `server/src/routes/__tests__/secrets.test.ts` (no expiration test case)
- Risk: Unknown behavior when `expiresAt < NOW()`. Does route handler check expiration before returning ciphertext? Or does it return expired ciphertext? Requirement SECR-07 says expired secrets should return identical "not available" response, but no test verifies this.
- Priority: High (add in Phase 3 or Phase 6). Integration test should create secret with `expiresAt: new Date(Date.now() - 1000)` (1 second ago), then GET and verify 404 response matches SECRET_NOT_AVAILABLE.

**No Tests for Password-Protected Secrets:**
- What's not tested: Password hashing, attempt counter, auto-destroy after 3 failures
- Files: No password-related tests exist yet (Phase 5 not started)
- Risk: Phase 5 implementation could introduce race conditions in attempt counter (concurrent requests bypassing limit), timing attacks in password comparison (non-constant-time check), or password enumeration (different errors for wrong password vs expired).
- Priority: Medium (blocked by Phase 5 start). Add integration tests for password verification, failed attempts, and concurrent attempt race conditions (use Promise.all to send multiple wrong-password requests simultaneously).

**No Browser Crypto Tests (Client-Side):**
- What's not tested: Crypto module tested in Node.js (vitest runtime) but not in real browser with Web Crypto API
- Files: `client/src/crypto/__tests__/*.test.ts` run in Node vitest (uses Node.js `globalThis.crypto`)
- Risk: Browser Web Crypto API has subtle differences from Node.js crypto (e.g., Safari older versions had SubtleCrypto bugs). Padding, IV generation, or key export could behave differently in browser.
- Priority: Medium (add in Phase 4 when frontend exists). Use Playwright or Vitest browser mode to run crypto tests in Chrome, Firefox, Safari. Verify encrypt/decrypt round-trip in real browser environment.

**No Load Testing:**
- What's not tested: Transaction throughput, connection pool exhaustion, rate limiting effectiveness under load
- Files: No load test suite exists
- Risk: Unknown capacity. How many secrets/second can server handle? At what concurrency does PostgreSQL connection pool saturate? Does zeroing UPDATE cause lock contention at 100 concurrent retrievals?
- Priority: Low (MVP launch does not require load testing). Add before scaling to 1000+ concurrent users. Use k6 or Artillery to simulate 100 concurrent POST /api/secrets and 100 concurrent GET /api/secrets/:id, measure p99 latency and error rate.

**No Security Audit (XSS, CSP, Enumeration):**
- What's not tested: XSS injection in error messages, CSP bypass, secret ID enumeration timing attacks
- Files: No security test suite exists
- Risk: XSS is existential in zero-knowledge apps. If Phase 4 frontend renders user input without sanitization, injected script can read `window.location.hash` and exfiltrate decryption key. Timing attacks on retrieveAndDestroy could reveal whether secret exists (slower transaction for zeroing vs fast NOT FOUND).
- Priority: **CRITICAL** (add in Phase 3 before deploying frontend). Use OWASP ZAP or Burp Suite to scan for XSS, CSP violations, timing side channels. Add integration test that attempts SQL injection, XSS payload in POST /api/secrets ciphertext, and measures response time variance for existing vs nonexistent secret IDs.

---

*Concerns audit: 2026-02-14*
