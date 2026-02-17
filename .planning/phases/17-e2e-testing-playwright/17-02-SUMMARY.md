---
phase: 17-e2e-testing-playwright
plan: 02
subsystem: testing
tags: [playwright, e2e, axe-core, wcag, accessibility, password-protection, error-states, color-contrast]

# Dependency graph
requires:
  - phase: 17-e2e-testing-playwright
    plan: 01
    provides: Playwright infrastructure, createTestSecret fixture, makeAxeBuilder fixture, create-reveal test
provides:
  - Password-protected secret E2E tests (correct password reveal, wrong password error with attempts)
  - Error state E2E tests (already viewed, invalid link, missing encryption key)
  - axe-core WCAG 2.1 AA accessibility scans on all 5 page states with zero violations
  - WCAG AA compliant color tokens (sRGB hex, 4.5:1+ contrast ratios)
affects: [18-ci-cd, 19-github-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [srgb-hex-for-axe-core, pseudo-element-dot-grid, e2e-rate-limit-override]

key-files:
  created:
    - e2e/specs/password-flow.spec.ts
    - e2e/specs/error-states.spec.ts
    - e2e/specs/accessibility.spec.ts
  modified:
    - server/src/middleware/rate-limit.ts
    - e2e/playwright.config.ts
    - client/src/styles.css

key-decisions:
  - "sRGB hex colors instead of OKLCH in CSS custom properties -- axe-core 4.x cannot reliably convert OKLCH to sRGB for contrast computation"
  - "Dot-grid background moved to ::before pseudo-element so axe-core resolves opaque parent background for contrast checks"
  - "E2E_TEST env var for rate limit override instead of NODE_ENV=test to avoid breaking unit test rate limit assertions"
  - "Alert role locator for wrong-password assertion to avoid strict mode violation from duplicate 'attempts remaining' text"

patterns-established:
  - "sRGB hex for axe-core: Use hex values in CSS custom properties when axe-core accessibility testing is required; OKLCH values in CSS vars produce unreliable axe contrast computations"
  - "Pseudo-element backgrounds: Use ::before pseudo-elements for decorative background-images to keep axe-core background-color resolution clean"
  - "E2E rate limit: Set E2E_TEST=true in Playwright webServer env to raise rate limits without affecting Vitest unit tests"

requirements-completed: [TEST-03, TEST-04, TEST-07]

# Metrics
duration: 28min
completed: 2026-02-17
---

# Phase 17 Plan 02: Password, Error States, and Accessibility E2E Tests Summary

**Password-protected flow, error states, and axe-core WCAG 2.1 AA accessibility E2E tests passing across Chromium, Firefox, and WebKit with zero violations after OKLCH-to-sRGB color token migration**

## Performance

- **Duration:** 28 min
- **Started:** 2026-02-17T23:13:34Z
- **Completed:** 2026-02-17T23:42:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Password-protected flow E2E tests validate correct password reveals plaintext and wrong password shows error alert with attempts remaining
- Error state E2E tests validate already-viewed secret, invalid/fabricated link, and missing encryption key all show appropriate error pages
- axe-core WCAG 2.1 AA scans pass with zero violations on all 5 page states (create, reveal interstitial, revealed secret, password entry, error)
- All 39 E2E tests (13 tests x 3 browsers) pass; existing 163 Vitest tests unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Password-protected flow and error states E2E tests** - `8b7fd92` (test)
2. **Task 2: Accessibility E2E tests with axe-core** - `f4c1ed3` (test)
3. **Fix: E2E_TEST env var for rate limit override** - `678f2b7` (fix)

## Files Created/Modified

- `e2e/specs/password-flow.spec.ts` - Password-protected secret E2E tests (correct password, wrong password)
- `e2e/specs/error-states.spec.ts` - Error state E2E tests (already viewed, invalid link, missing key)
- `e2e/specs/accessibility.spec.ts` - axe-core WCAG 2.1 AA scans on all 5 page states
- `server/src/middleware/rate-limit.ts` - E2E_TEST env var raises rate limits to 1000 for multi-browser test runs
- `e2e/playwright.config.ts` - Added E2E_TEST=true to webServer env
- `client/src/styles.css` - OKLCH-to-sRGB hex color token migration, dot-grid pseudo-element, WCAG AA contrast ratios

## Decisions Made

- **sRGB hex over OKLCH for CSS custom properties** - axe-core 4.11 cannot reliably convert OKLCH color values to sRGB for WCAG contrast computation. Colors render correctly in browsers but axe reports incorrect contrast ratios (e.g., `#154fac` rendered correctly but axe computed `#7194cd`). Converting to sRGB hex eliminated the discrepancy.
- **Dot-grid as pseudo-element** - The `dot-grid-bg` radial gradient as a direct `background-image` on `<main>` caused axe-core to compute incorrect effective background colors through compositing. Moving it to a `::before` pseudo-element with `z-index: -1` keeps the visual effect while letting axe resolve the opaque `bg-bg` body background for contrast checks.
- **E2E_TEST env var** - Using `NODE_ENV=test` to raise rate limits broke the Vitest rate limit unit test. A dedicated `E2E_TEST=true` env var in the Playwright config raises limits only for E2E runs.
- **Alert role locator** - The wrong-password assertion targets `getByRole('alert')` instead of `getByText(/attempts remaining/)` because both the attempt counter and the error alert contain the same text pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rate limit blocking WebKit E2E tests**
- **Found during:** Task 1 (password-flow and error-states tests)
- **Issue:** The production rate limit of 10 POST requests/hour was hit after Chromium and Firefox tests consumed all 10 slots, causing WebKit tests to receive 429 errors
- **Fix:** Added E2E_TEST env var to raise rate limits to 1000 during Playwright test runs; set in playwright.config.ts webServer env
- **Files modified:** server/src/middleware/rate-limit.ts, e2e/playwright.config.ts
- **Verification:** All 39 E2E tests pass across 3 browsers; 163 Vitest tests pass (rate limit unit test unaffected)
- **Committed in:** 8b7fd92 (Task 1), refined in 678f2b7 (fix)

**2. [Rule 1 - Bug] Strict mode violation on attempts remaining assertion**
- **Found during:** Task 1 (wrong password test)
- **Issue:** `getByText(/\d+ attempts? remaining/)` matched 2 elements (attempt counter `<p>` and error alert `<div role="alert">`), violating Playwright strict mode
- **Fix:** Changed to `getByRole('alert')` with `toHaveText()` assertion to target the error alert specifically
- **Files modified:** e2e/specs/password-flow.spec.ts
- **Committed in:** 8b7fd92 (Task 1)

**3. [Rule 1 - Bug] axe-core OKLCH color contrast false positives**
- **Found during:** Task 2 (accessibility tests)
- **Issue:** axe-core 4.11 incorrectly converts OKLCH colors to sRGB, reporting contrast ratios of 2.95-3.77 for colors that actually have 5.0-7.65 contrast. The `background-image` dot-grid on `<main>` further confused axe's background color resolution.
- **Fix:** (a) Converted all OKLCH CSS custom properties to sRGB hex equivalents; (b) Darkened accent/status colors to meet 4.5:1 threshold; (c) Moved dot-grid from `background-image` to `::before` pseudo-element
- **Files modified:** client/src/styles.css
- **Verification:** All 15 accessibility tests pass across 3 browsers with zero axe violations
- **Committed in:** f4c1ed3 (Task 2)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes were necessary for test correctness. The OKLCH-to-sRGB migration is a visual improvement (verified WCAG AA compliance) with no functional change. Color appearance is nearly identical.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full E2E test suite operational: 39 tests (13 x 3 browsers) covering all critical user journeys
- Test coverage: create-reveal flow, password protection, error states, and WCAG 2.1 AA accessibility
- CI/CD pipeline (Phase 18) can integrate `npm run test:e2e` directly
- All color tokens are verified WCAG AA compliant with documented contrast ratios

## Self-Check: PASSED

All 3 created files verified on disk. All 3 task commits (8b7fd92, f4c1ed3, 678f2b7) verified in git log.

---
*Phase: 17-e2e-testing-playwright*
*Completed: 2026-02-17*
