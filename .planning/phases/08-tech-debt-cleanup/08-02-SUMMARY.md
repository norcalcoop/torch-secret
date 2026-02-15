---
phase: 08-tech-debt-cleanup
plan: 02
subsystem: ui, api
tags: [wcag, accessibility, redis, ioredis, rate-limiting, express-rate-limit]

# Dependency graph
requires:
  - phase: 03-security-hardening
    provides: "Rate limiter middleware with MemoryStore"
  - phase: 04-frontend-create-and-reveal
    provides: "Character counter on create page"
  - phase: 07-trust-and-accessibility
    provides: "WCAG accessibility baseline"
provides:
  - "WCAG AA compliant character counter (4.84:1 contrast ratio)"
  - "Redis-backed rate limiting for multi-instance deployments"
  - "MemoryStore fallback when REDIS_URL is absent"
  - "passOnStoreError resilience for Redis outages"
affects: []

# Tech tracking
tech-stack:
  added: [ioredis, rate-limit-redis]
  patterns: [opt-in Redis store with MemoryStore fallback, passOnStoreError resilience]

key-files:
  created: []
  modified:
    - client/src/pages/create.ts
    - server/src/middleware/rate-limit.ts
    - server/src/config/env.ts
    - server/src/app.ts
    - server/src/routes/secrets.ts
    - .env.example

key-decisions:
  - "text-gray-500 for counter (4.84:1 ratio) over text-gray-600 (7.56:1) to maintain visual hierarchy distinction from body text"
  - "passOnStoreError: true to prefer availability over strict rate enforcement during Redis outages"
  - "Redis client created once in buildApp() and passed through router factory to limiter factories"

patterns-established:
  - "Opt-in Redis: feature enabled by environment variable, fallback to in-memory default"
  - "Redis client injection: created in app factory, passed to middleware via router factory parameter"

# Metrics
duration: 2min
completed: 2026-02-15
---

# Phase 8 Plan 2: WCAG Counter Contrast Fix and Redis Rate Limiting Summary

**Character counter bumped to text-gray-500 for WCAG AA compliance (4.84:1 ratio), and rate limiters upgraded with opt-in RedisStore via ioredis for multi-instance deployments**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-15T02:16:59Z
- **Completed:** 2026-02-15T02:19:11Z
- **Tasks:** 1
- **Files modified:** 8

## Accomplishments
- Character counter contrast ratio improved from 2.60:1 (gray-400) to 4.84:1 (gray-500), meeting WCAG 2.1 AA 4.5:1 threshold
- Rate limiter factories accept optional Redis client with RedisStore for distributed deployments
- MemoryStore fallback preserved for development and single-instance production
- passOnStoreError: true ensures requests pass through during Redis outages (availability over strict enforcement)
- All 152 existing tests pass without Redis running

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix character counter color contrast and add Redis rate limiting** - `33be3bb` (feat)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `client/src/pages/create.ts` - Changed counter className from text-gray-400 to text-gray-500
- `server/src/middleware/rate-limit.ts` - Added RedisStore support with createStore helper, passOnStoreError
- `server/src/config/env.ts` - Added optional REDIS_URL to Zod env schema
- `server/src/app.ts` - Conditionally creates Redis client when REDIS_URL is set, passes to router
- `server/src/routes/secrets.ts` - Accepts optional Redis client parameter, forwards to limiter factories
- `.env.example` - Documents REDIS_URL as optional for distributed rate limiting
- `package.json` - Added ioredis and rate-limit-redis dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used text-gray-500 (4.84:1 ratio) rather than text-gray-600 (7.56:1) to maintain visual hierarchy distinction between counter text and body text
- passOnStoreError: true to prefer availability over strict rate enforcement during Redis outages -- a temporary rate limit gap is acceptable, blocking all requests is not
- Redis client created once in buildApp() and injected through the router factory to both limiter factories, avoiding global state or module-level singletons

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None for development (MemoryStore fallback). For production multi-instance deployments, set `REDIS_URL` environment variable (e.g., `redis://localhost:6379`).

## Next Phase Readiness
- Phase 8 (Tech Debt Cleanup) is now complete with both plans executed
- All WCAG accessibility requirements met
- Rate limiting scales to multi-instance deployments when Redis is configured
- All 152 tests continue to pass

## Self-Check: PASSED

All 7 files verified present. Commit 33be3bb verified in git log.

---
*Phase: 08-tech-debt-cleanup*
*Completed: 2026-02-15*
