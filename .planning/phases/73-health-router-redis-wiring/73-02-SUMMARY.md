---
phase: 73-health-router-redis-wiring
plan: "02"
subsystem: api

tags: [express, ioredis, rate-limiting, health-router, tdd, redis]

requires:
  - phase: 73-health-router-redis-wiring
    provides: RED test stubs (4 failing tests) for createHealthRouter factory

provides:
  - createHealthRouter(redisClient?: Redis) factory in server/src/routes/health.ts
  - Health endpoint rate limiter uses RedisStore in production via factory wiring
  - FINDING-01 from v5.3 audit closed (health limiter no longer uses per-instance MemoryStore)

affects:
  - Any future phase touching health.ts or app.ts middleware order

tech-stack:
  added: []
  patterns:
    - "createHealthRouter(redisClient?) factory pattern — mirrors createSecretsRouter; redisClient flows from buildApp() parameter to rate limiter"
    - "env coupling removed from health.ts — redis field derived from injected redisClient param, not env.REDIS_URL"

key-files:
  created: []
  modified:
    - server/src/routes/health.ts
    - server/src/app.ts

key-decisions:
  - "Remove env.REDIS_URL check from health.ts entirely — factory receives redisClient directly; no indirect env access needed"
  - "Follow createSecretsRouter pattern exactly — factory function, no singleton export, redisClient threads through"

patterns-established:
  - "Router factory pattern: export function createXRouter(redisClient?: Redis): Router — all rate-limited routers follow this signature"

requirements-completed:
  - GH-02

duration: 2min
completed: 2026-03-12
---

# Phase 73 Plan 02: Health Router Redis Wiring Summary

**healthRouter singleton replaced with createHealthRouter(redisClient?) factory; health limiter now uses RedisStore in production via shared Redis client from buildApp()**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T15:24:51Z
- **Completed:** 2026-03-12T15:27:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Converted `healthRouter` singleton to `createHealthRouter(redisClient?: Redis): Router` factory in `health.ts`
- Removed `import { env }` from health.ts — redis field now derived from the injected `redisClient` parameter
- Updated `app.ts` to import and call `createHealthRouter(redisClient)` with the shared Redis client
- All 4 tests in health.test.ts turned GREEN; full 660-test suite passes with no regressions
- FINDING-01 closed: health limiter uses RedisStore in production when Redis is configured

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert health.ts singleton to createHealthRouter factory** - `af27a6e` (feat)
2. **Task 2: Update app.ts import and mount call** - `be85b76` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `server/src/routes/health.ts` — Replaced `healthRouter` singleton with `createHealthRouter(redisClient?: Redis): Router` factory; removed `env` import; `createHealthLimiter(redisClient)` passes client through
- `server/src/app.ts` — Updated import `healthRouter` → `createHealthRouter`; updated mount to `app.use('/api/health', createHealthRouter(redisClient))`

## Decisions Made

- Removed `env.REDIS_URL` check from health.ts entirely — factory receives the redisClient object directly, so the redis field (`'configured'` vs `'not configured'`) is determined by `redisClient ? 'configured' : 'not configured'`. No indirect env access needed.
- Followed `createSecretsRouter` pattern exactly as specified — factory function signature, no singleton export, redisClient threads all the way through to `createHealthLimiter`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The `mockRedis = { call: vi.fn() }` stub (established in plan 73-01) generates unhandled rejections from `rate-limit-redis` when its Lua scripts try to execute against the stub after test assertions complete. These are post-assertion background errors — all 4 tests pass GREEN and the full suite is 60 files / 660 tests passing. This is pre-existing behavior from the test stub design and does not affect correctness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 73 complete: health router now uses the same factory + RedisStore wiring pattern as secrets router
- GH-02 requirement closed
- No blockers

## Self-Check: PASSED

All files exist. Both task commits verified (af27a6e, be85b76).

---
*Phase: 73-health-router-redis-wiring*
*Completed: 2026-03-12*
