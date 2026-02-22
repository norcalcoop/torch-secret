---
phase: 29-v4-tech-debt-cleanup
plan: "03"
subsystem: testing
tags: [vitest, axe, accessibility, password-generator, brute-force, vitest-axe]

# Dependency graph
requires:
  - phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs
    provides: createProtectionPanel() with tablist/tab/tabpanel ARIA pattern, #gen-error element, generatePassword() with bruteForceEstimate
  - phase: 29-v4-tech-debt-cleanup-01
    provides: Phase 28 audit gap list identifying incompatible filter error state and brute-force label coverage gaps
provides:
  - "incompatible filter error state axe test: #gen-error visible when easyToSay+omitSimilar conflict, passes axe"
  - "PROT-02 brute-force label integration describe block: 4 tests covering high/max/low tier label output and DOM entropy line visibility"
affects: [future-protection-panel-refactors, password-generator-changes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic import pattern for page modules in accessibility tests: await import('../pages/create.js')"
    - "Event dispatch pattern for triggering protection panel state changes: dispatchEvent(new Event('change', { bubbles: true }))"
    - "Direct generatePassword() import for integration-level tier-to-label mapping tests (not mocked)"

key-files:
  created: []
  modified:
    - client/src/__tests__/accessibility.test.ts

key-decisions:
  - "Tests dispatch native change events with bubbles:true to trigger protection panel's change listeners — same pattern as real user interaction"
  - "Low tier bruteForceEstimate regex allows seconds|minutes — 8-char lowercase-only at 10B/sec falls in the seconds range (~38 bits), but the regex is defensive against boundary conditions"
  - "generatePassword() tested with direct import (not mock) — the plan explicitly requires wiring through the actual module for PROT-02 integration coverage"

patterns-established:
  - "Error state axe testing pattern: trigger UI error state via event dispatch, verify hidden class removed, then run axe scan"
  - "Tier label integration test pattern: call generatePassword() directly, assert length + entropyBits range + bruteForceEstimate regex"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 29 Plan 03: v4 Tech Debt Cleanup — Accessibility and PROT-02 Integration Tests Summary

**Five new tests closing Phase 28 coverage gaps: axe scan for easyToSay+omitSimilar error state, and PROT-02 brute-force label tier mapping verified through actual generatePassword() module**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T01:12:20Z
- **Completed:** 2026-02-22T01:13:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `incompatible filter error state has no accessibility violations` test inside the `Protection panel accessibility` describe block — verifies `#gen-error` is visible (hidden class removed) when easyToSay + omitSimilar are both active, and the resulting DOM passes axe
- Added `PROT-02 brute-force label integration` describe block with 4 tests covering: high tier (>=100 bits → centuries/eons), max tier (>150 bits → eons exactly), low tier (<50 bits → seconds/minutes), and DOM visibility of the entropy line after clicking the generate tab
- All 15 tests pass (10 existing + 5 new), full suite 260 tests 0 failures

## Task Commits

1. **Task 1: Add incompatible filter error state axe test and brute-force label integration test** - `3c095ac` (test)

**Plan metadata:** (combined with task commit — single-task plan)

## Files Created/Modified

- `client/src/__tests__/accessibility.test.ts` - Added 5 new test cases (1 inside Protection panel describe, 4 in new PROT-02 brute-force label integration describe block)

## Decisions Made

- Tests dispatch native change events with `bubbles: true` to trigger the protection panel's change listeners, matching real user interaction
- Low tier `bruteForceEstimate` regex uses `seconds|minutes` pattern — 8-char lowercase-only at 10B/s falls in the seconds range (~37.6 bits), but the OR handles boundary cases
- `generatePassword()` tested via direct dynamic import (not mocked) — plan explicitly requires wiring through the actual module for PROT-02 integration coverage

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `ECONNREFUSED` errors in test output are expected — they come from the auth client's `getSession()` async IIFE in `renderCreatePage()` which fires after DOM render and tries to contact the dev server (not running in test). These errors are pre-existing and do not affect any test assertions.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 29 tech debt cleanup complete for plan 03
- accessibility.test.ts now covers the incompatible filter error state and tier-to-label mapping for PROT-02
- No blockers

---
*Phase: 29-v4-tech-debt-cleanup*
*Completed: 2026-02-22*
