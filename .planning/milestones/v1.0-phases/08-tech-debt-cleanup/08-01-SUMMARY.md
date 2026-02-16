---
phase: 08-tech-debt-cleanup
plan: 01
subsystem: testing
tags: [vitest, projects, test-isolation, fileParallelism, flaky-tests]

# Dependency graph
requires:
  - phase: 02-database-and-api
    provides: "Server test suite with shared PostgreSQL pool"
  - phase: 07-trust-and-accessibility
    provides: "Client accessibility tests with happy-dom"
provides:
  - "Projects-based vitest configuration with server sequential execution"
  - "Reliable test suite with 0 flaky failures across consecutive runs"
affects: [08-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: ["vitest projects array for environment-specific test isolation"]

key-files:
  created: []
  modified:
    - vitest.config.ts

key-decisions:
  - "Projects-based config over workspace split for single-file simplicity"
  - "fileParallelism: false for server project only (client retains parallel for speed)"

patterns-established:
  - "Vitest projects pattern: separate client/server configs within single defineConfig"
  - "Server tests always sequential to prevent shared pool race conditions"

# Metrics
duration: 1min
completed: 2026-02-15
---

# Phase 8 Plan 1: Test Flakiness Fix Summary

**Vitest projects-based config with server sequential execution (fileParallelism: false) eliminates shared pool race condition**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-15T02:16:52Z
- **Completed:** 2026-02-15T02:17:56Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Migrated vitest.config.ts from flat test block to projects array with client and server entries
- Server tests run sequentially (fileParallelism: false), eliminating the shared PostgreSQL pool race condition that caused flaky expiration worker test failures
- Client tests retain parallel execution with happy-dom environment for speed
- All 152 tests pass reliably across 3 consecutive runs with 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate vitest.config.ts to projects-based configuration** - `4f3295f` (chore)

## Files Created/Modified
- `vitest.config.ts` - Projects-based config: client (parallel, happy-dom) + server (sequential, node)

## Decisions Made
- Used projects array within single defineConfig (not vitest workspace file) for simplicity
- Set fileParallelism: false only on server project to prevent shared pool race condition while keeping client tests fast
- Removed environmentMatchGlobs in favor of per-project environment setting (more reliable in vitest 4.x)
- Kept pool.end() calls in test files as defensive cleanup (harmless when sequential)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Test infrastructure is now reliable for 08-02 (remaining tech debt items)
- All 152 tests pass consistently, providing a stable baseline

## Self-Check: PASSED

- FOUND: vitest.config.ts
- FOUND: commit 4f3295f
- FOUND: fileParallelism: false in config
- FOUND: projects array in config
- REMOVED: environmentMatchGlobs from config

---
*Phase: 08-tech-debt-cleanup*
*Completed: 2026-02-15*
