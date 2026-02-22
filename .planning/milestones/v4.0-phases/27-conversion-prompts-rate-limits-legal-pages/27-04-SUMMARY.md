---
phase: 27-conversion-prompts-rate-limits-legal-pages
plan: "04"
subsystem: ui
tags: [rate-limit, countdown, upsell, conversion, express-rate-limit, draft-6]

# Dependency graph
requires:
  - phase: 27-conversion-prompts-rate-limits-legal-pages/27-01
    provides: createAnonHourlyLimiter with standardHeaders draft-6 emitting delta-seconds RateLimit-Reset
  - phase: 27-conversion-prompts-rate-limits-legal-pages/27-02
    provides: showRateLimitUpsell() with broken Unix-timestamp arithmetic (bug being fixed)
provides:
  - showRateLimitUpsell() with corrected delta-seconds countdown arithmetic
  - ApiError.rateLimitReset accurately documented as delta in seconds (time remaining)
affects: [UAT, CONV-06 verification, rate-limit countdown display]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RateLimit-Reset draft-6 header delivers delta-seconds (not Unix timestamp) — divide by 60 directly for minutes remaining"

key-files:
  created: []
  modified:
    - client/src/pages/create.ts
    - client/src/api/client.ts

key-decisions:
  - "Math.ceil(resetTimestamp / 60) is the correct formula when RateLimit-Reset draft-6 emits delta-seconds; no epoch subtraction needed"
  - "minutesUntilReset > 0 belt-and-suspenders guard in ternary retained — valid for resetTimestamp values of 1-59 seconds which still round up to 1 minute"

patterns-established:
  - "express-rate-limit draft-6 standardHeaders: RateLimit-Reset is seconds-remaining, not Unix epoch — document this in JSDoc at the consumption site"

requirements-completed:
  - CONV-06

# Metrics
duration: 1min
completed: 2026-02-21
---

# Phase 27 Plan 04: Rate-Limit Countdown Arithmetic Fix Summary

**Fixed showRateLimitUpsell() to display actual time remaining (e.g. "Limit resets in 27 minutes") by correcting delta-seconds arithmetic — removes broken Unix-timestamp epoch subtraction**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-02-21T00:16:52Z
- **Completed:** 2026-02-21T00:17:03Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Corrected `showRateLimitUpsell()` countdown arithmetic: removed three-line Unix-timestamp calculation (`resetMs = resetTimestamp * 1000; minutesUntilReset = Math.ceil((resetMs - Date.now()) / 60_000)`) and replaced with single correct line `Math.ceil(resetTimestamp / 60)` — `express-rate-limit` with `standardHeaders: 'draft-6'` emits delta-seconds, not a Unix timestamp
- Fixed `ApiError.rateLimitReset` inline JSDoc from "Unix timestamp (seconds)" to "Delta in seconds (time remaining) from RateLimit-Reset draft-6 header"
- Fixed `ApiError` class-level JSDoc block and `createSecret()` JSDoc to consistently describe the field as delta-seconds

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix rate-limit countdown arithmetic and JSDoc mismatch** - `6aa5069` (fix)

**Plan metadata:** committed with SUMMARY + STATE below

## Files Created/Modified

- `client/src/pages/create.ts` — Removed `resetMs` variable; `minutesUntilReset` now computed as `Math.ceil(resetTimestamp / 60)`; updated `@param resetTimestamp` JSDoc to "delta in seconds"
- `client/src/api/client.ts` — Updated `ApiError.rateLimitReset` inline comment and two JSDoc blocks from "Unix timestamp (seconds)" to "delta in seconds (time remaining)"

## Decisions Made

- `Math.ceil(resetTimestamp / 60)` is the correct and complete formula for converting draft-6 `RateLimit-Reset` to minutes remaining — the header value is already seconds-remaining, so no epoch arithmetic is needed
- The existing `minutesUntilReset > 0` guard in the ternary is retained as a belt-and-suspenders check for edge cases (e.g. `resetTimestamp` of 30 seconds rounds up to 1 minute, which is correct behavior)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan specified verification with `npx tsc --noEmit --project client/tsconfig.json`, but the project has no `client/tsconfig.json` (client TypeScript is compiled via the root `tsconfig.json`). Used `npx tsc --noEmit --project tsconfig.json` instead — exits 0 cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT Test 7 should now pass: rate-limit upsell card shows actual time remaining (e.g. "Limit resets in 27 minutes") instead of always showing "Limit resets soon."
- Phase 27 complete (4/4 plans + 1 gap-closure plan executed). v4.0 requirements CONV-06 now fully satisfied.
- No blockers.

---
*Phase: 27-conversion-prompts-rate-limits-legal-pages*
*Completed: 2026-02-21*
