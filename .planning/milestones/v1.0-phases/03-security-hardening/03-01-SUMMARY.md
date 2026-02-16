---
phase: 03-security-hardening
plan: 01
subsystem: api
tags: [helmet, csp, hsts, rate-limiting, express-rate-limit, security-headers, https-redirect]

# Dependency graph
requires:
  - phase: 02-database-and-api
    provides: Express app factory (buildApp), secrets router, middleware infrastructure
provides:
  - CSP nonce generation middleware (cspNonceMiddleware)
  - Helmet security headers middleware (createHelmetMiddleware)
  - HTTPS redirect middleware (httpsRedirect)
  - Route-scoped rate limiter factory (createSecretLimiter)
  - Trust proxy configuration for reverse proxy deployments
affects: [04-frontend-create-and-reveal, 05-password-protection]

# Tech tracking
tech-stack:
  added: [helmet 8.x, express-rate-limit 8.x]
  patterns: [per-request CSP nonce generation, route-scoped rate limiting, middleware ordering for security, factory-pattern routers for test isolation]

key-files:
  created:
    - server/src/middleware/security.ts
    - server/src/middleware/rate-limit.ts
  modified:
    - server/src/app.ts
    - server/src/routes/secrets.ts
    - server/src/routes/__tests__/secrets.test.ts
    - package.json

key-decisions:
  - "Helmet directive functions use IncomingMessage/ServerResponse types (not Express types) to match helmet's ContentSecurityPolicyDirectiveValueFunction signature"
  - "HSTS conditionally disabled in non-production to prevent browser lockout during development"
  - "secretsRouter refactored to factory function (createSecretsRouter) so each buildApp() creates fresh rate limiter MemoryStore for test isolation"
  - "createSecretLimiter is a factory function returning fresh rateLimit instances (not a singleton middleware)"
  - "No cors package installed -- Express without cors middleware enforces same-origin by default"

patterns-established:
  - "Factory-pattern routers: createSecretsRouter() returns fresh Router with fresh middleware instances per app"
  - "Security middleware ordering: trust proxy -> HTTPS redirect -> CSP nonce -> helmet -> logger -> json -> routes -> error handler"
  - "Route-scoped rate limiting: apply rate limiter as route-level middleware, not global app.use()"
  - "Fresh app per test (beforeEach) to prevent rate limiter state bleed across integration tests"

# Metrics
duration: 4min
completed: 2026-02-14
---

# Phase 3 Plan 1: Security Middleware Summary

**Helmet security headers with nonce-based CSP, route-scoped rate limiting (10 req/hr), and HTTPS redirect middleware**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-14T15:16:40Z
- **Completed:** 2026-02-14T15:20:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CSP with per-request cryptographic nonce (no unsafe-inline, no unsafe-eval) via helmet 8.x
- Rate limiter scoped to POST /api/secrets only (10 per IP per hour), GET unrestricted
- HSTS (1-year max-age) in production, conditionally disabled in development
- Referrer-Policy: no-referrer to prevent URL fragment leakage
- Same-origin CORS enforcement by design (no cors package)
- HTTPS redirect in production with trust proxy for reverse proxy compatibility
- All 101 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create security middleware** - `6871ca9` (feat)
2. **Task 2: Wire security middleware into Express app** - `e715c2e` (feat)

## Files Created/Modified
- `server/src/middleware/security.ts` - CSP nonce generation, helmet config, HTTPS redirect (3 exports)
- `server/src/middleware/rate-limit.ts` - Route-scoped rate limiter factory for POST /api/secrets
- `server/src/app.ts` - Security middleware wired in correct order with trust proxy
- `server/src/routes/secrets.ts` - Refactored to factory function, rate limiter on POST route
- `server/src/routes/__tests__/secrets.test.ts` - Fresh app per test for rate limiter isolation
- `package.json` - Added helmet, express-rate-limit dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made
- **Helmet type compatibility:** CSP directive functions typed as `(IncomingMessage, ServerResponse)` to match helmet's `ContentSecurityPolicyDirectiveValueFunction`, with `res as unknown as Response` cast to access `res.locals.cspNonce`
- **HSTS in dev:** Disabled entirely when `NODE_ENV !== 'production'` (not just short max-age) to prevent any browser HSTS lockout during local development
- **No cors package:** Intentionally omitted. Express without cors middleware sends no CORS headers, and browsers enforce same-origin by default. This is the correct behavior for a same-origin-only app.
- **Factory-pattern routers:** Refactored `secretsRouter` from a singleton export to `createSecretsRouter()` factory to ensure each `buildApp()` call gets a fresh rate limiter MemoryStore. This prevents rate limit counter bleed in tests.
- **Rate limiter as factory:** `createSecretLimiter()` returns a fresh `rateLimit()` instance each time, giving each router its own MemoryStore.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed helmet CSP directive function type mismatch**
- **Found during:** Task 1 (create security middleware)
- **Issue:** Plan specified `(_req: Request, res: Response)` for CSP directive functions, but helmet 8.x types expect `(req: IncomingMessage, res: ServerResponse)`. TypeScript error TS2322.
- **Fix:** Changed function signatures to `(_req: IncomingMessage, res: ServerResponse)` and cast `res as unknown as Response` to access `res.locals.cspNonce`
- **Files modified:** `server/src/middleware/security.ts`
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** `6871ca9` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed rate limiter state bleed across integration tests**
- **Found during:** Task 2 (wire middleware into app)
- **Issue:** All 14 integration tests shared a single app instance with one rate limiter MemoryStore. The 11th POST request (in "anti-enumeration" test) hit the 10-request rate limit, causing 2 test failures.
- **Fix:** Refactored `secretsRouter` to factory function `createSecretsRouter()` and `createSecretLimiter` to factory function. Updated test file to create fresh app via `beforeEach(() => { app = buildApp(); })` so each test gets an independent rate limiter.
- **Files modified:** `server/src/middleware/rate-limit.ts`, `server/src/routes/secrets.ts`, `server/src/routes/__tests__/secrets.test.ts`
- **Verification:** All 101 tests pass including rate-limit-heavy test scenarios
- **Committed in:** `e715c2e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for type correctness and test reliability. Factory-pattern routers are a minor architectural improvement that benefits testability. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All security headers in place for Phase 4 frontend integration
- CSP nonce available via `res.locals.cspNonce` for Phase 4 HTML template injection
- Rate limiter ready for production; can swap to Redis store later without API changes
- Phase 3 Plan 2 (security integration tests) can verify all headers end-to-end

## Self-Check: PASSED

- All 5 claimed files exist on disk
- Commit `6871ca9` (Task 1) verified in git log
- Commit `e715c2e` (Task 2) verified in git log
- TypeScript compiles without errors
- All 101 tests pass

---
*Phase: 03-security-hardening*
*Completed: 2026-02-14*
