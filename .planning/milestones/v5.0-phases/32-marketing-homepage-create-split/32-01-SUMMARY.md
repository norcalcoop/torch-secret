---
phase: 32-marketing-homepage-create-split
plan: 01
subsystem: ui
tags: [router, spa, seo, routes]

# Dependency graph
requires: []
provides:
  - "/ route maps to home.js (renderHomePage), indexable, no noindex"
  - "/create route maps to create.js (renderCreatePage), existing form behavior preserved"
  - "/pricing stub route maps to error not_found with noindex (Phase 33 replacement target)"
  - "home.ts stub module with renderHomePage export (typed for router import resolution)"
affects:
  - "32-02 (home page implementation — must export renderHomePage from home.ts)"
  - "32-03+ (any plan using /create or /pricing URLs)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Router dynamic import requires corresponding .ts file for ESLint type safety — stub pattern for pre-Plan 02 route"

key-files:
  created:
    - "client/src/pages/home.ts (stub — Plan 02 replaces with full implementation)"
  modified:
    - "client/src/router.ts (/ → home.js, new /create → create.js, new /pricing stub)"

key-decisions:
  - "Created home.ts stub so router.ts dynamic import resolves to typed module — avoids @typescript-eslint/no-unsafe-* lint errors before Plan 02 ships full home page"
  - "/ branch omits noindex entirely — homepage must be indexable for HOME-05 (WebApplication JSON-LD)"
  - "/pricing stub uses error not_found with noindex: true — Phase 33 replaces with real pricing page"

patterns-established:
  - "Stub pattern: create minimal .ts with correct export signature to satisfy ESLint when implementing route for a module that doesn't exist yet"

requirements-completed: [HOME-02, HOME-05]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 32 Plan 01: Router Split Summary

**SPA router updated so / maps to home.js (indexable, no noindex) and /create maps to the existing create form, with a /pricing not-found stub for Phase 33**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T01:13:47Z
- **Completed:** 2026-02-23T01:15:26Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Replaced the `/` route (previously `create.js`) with `home.js` import calling `renderHomePage`, no noindex flag — homepage is fully indexable
- Added `/create` route importing `create.js` calling `renderCreatePage` with create-specific meta title/description
- Added `/pricing` stub route rendering error not_found with noindex (placeholder for Phase 33)
- Created `home.ts` stub with correct `renderHomePage` export signature to satisfy ESLint no-unsafe-* rules before Plan 02 ships

## Task Commits

Each task was committed atomically:

1. **Task 1: Split router — / → home.js, /create → create.js, /pricing stub** - `472291b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/src/router.ts` - Rewrote / branch, added /create and /pricing branches
- `client/src/pages/home.ts` - Stub module exporting renderHomePage for type resolution

## Decisions Made

- Created `home.ts` stub to fix lint errors: dynamic imports of non-existent modules are typed `any`, triggering three `@typescript-eslint/no-unsafe-*` errors. Stub with correct function signature resolves typing without any functional change.
- No noindex on `/` branch: HOME-05 requires the homepage WebApplication JSON-LD to be indexable by search engines.
- `/pricing` stub uses `noindex: true` — pricing page is not ready yet; we don't want bots indexing a not-found error as "Pricing".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created home.ts stub to resolve ESLint type errors on dynamic import**

- **Found during:** Task 1 (router split implementation)
- **Issue:** Dynamic `import('./pages/home.js')` with no corresponding `home.ts` module causes TypeScript to type the resolved module as `any`, triggering `@typescript-eslint/no-unsafe-return`, `@typescript-eslint/no-unsafe-call`, and `@typescript-eslint/no-unsafe-member-access` errors — blocking the `npm run lint` verification requirement
- **Fix:** Created `client/src/pages/home.ts` with a stub `renderHomePage(_container: HTMLElement): void` export; Plan 02 replaces this stub with the full marketing homepage implementation
- **Files modified:** `client/src/pages/home.ts` (new)
- **Verification:** `npm run lint` passes with zero errors; `npm run build:client` succeeds producing `home-*.js` chunk
- **Committed in:** `472291b` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Stub creation is the minimum fix to satisfy the lint verification requirement. No scope creep — Plan 02 owns the full home page implementation.

## Issues Encountered

None — fix was straightforward.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Route infrastructure is in place: / → home.js, /create → create.js, /pricing stub
- Plan 02 must implement `renderHomePage` in `client/src/pages/home.ts` (replacing the stub)
- All downstream plans that link to `/create` (e.g., nav, CTAs) can do so safely
- No blockers

---
*Phase: 32-marketing-homepage-create-split*
*Completed: 2026-02-23*
