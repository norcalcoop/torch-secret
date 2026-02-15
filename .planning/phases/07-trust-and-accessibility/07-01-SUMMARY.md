---
phase: 07-trust-and-accessibility
plan: 01
subsystem: ui
tags: [accessibility, aria, wcag, spa, screen-reader, focus-management, tailwind]

# Dependency graph
requires:
  - phase: 04-frontend-create-and-reveal
    provides: "SPA router, all page modules, components, styles"
provides:
  - "SPA route announcements via aria-live region"
  - "Skip-to-content link and main landmark"
  - "Focus management (h1 focus after navigation)"
  - "document.title updates on every route change"
  - "ARIA attributes on loading spinner, copy button, emoji icons"
  - "focus:outline-hidden migration for forced-colors accessibility"
  - "Password autocomplete attributes"
  - "warning-500 color token"
affects: [07-trust-and-accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "aria-live polite region for SPA route announcements"
    - "Clear-then-set pattern with requestAnimationFrame for repeated announcements"
    - "Programmatic focus to h1 with tabindex=-1 after SPA navigation"
    - "focus:outline-hidden instead of focus:outline-none for forced-colors mode"
    - "aria-hidden=true on decorative emoji icons"
    - "role=status + aria-live=polite on loading spinner wrapper"

key-files:
  created: []
  modified:
    - "client/index.html"
    - "client/src/router.ts"
    - "client/src/components/loading-spinner.ts"
    - "client/src/components/copy-button.ts"
    - "client/src/components/expiration-select.ts"
    - "client/src/pages/create.ts"
    - "client/src/pages/confirmation.ts"
    - "client/src/pages/reveal.ts"
    - "client/src/pages/error.ts"
    - "client/src/styles.css"

key-decisions:
  - "outline-hidden over outline-none: outline-hidden sets outline-color:transparent which forced-colors overrides to visible, while outline-none sets outline-style:none which cannot be overridden"
  - "Clear-then-set pattern for route announcer ensures repeated title announcements work"
  - "aria-live added/removed dynamically on copy button (not permanent) to avoid stale region"
  - "warning-500 at oklch(0.75 0.15 85) for amber/orange attempt counter text"

patterns-established:
  - "SPA route change pattern: updatePageMeta() before render, focusPageHeading() after render"
  - "Decorative icon pattern: aria-hidden=true on all emoji/SVG icons where heading conveys meaning"
  - "Password autocomplete: new-password for creation, current-password for entry"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 7 Plan 1: SPA Accessibility Infrastructure Summary

**Skip link, route announcer, focus management, ARIA attributes, and outline-hidden migration across all client pages and components**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T00:46:19Z
- **Completed:** 2026-02-15T00:49:39Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Skip link, main landmark, and aria-live route announcer added to index.html
- Router updates document.title and announces route changes on every SPA navigation, with h1 focus after render
- Loading spinner announces status via role=status, copy button announces feedback via aria-live
- All decorative emoji/SVG icons hidden from screen readers with aria-hidden=true
- All focus:outline-none replaced with focus:outline-hidden across client codebase (forced-colors accessibility)
- Password fields have correct autocomplete attributes (new-password / current-password)
- Confirmation page now properly announces via updatePageMeta and focuses heading

## Task Commits

Each task was committed atomically:

1. **Task 1: SPA accessibility infrastructure in index.html and router.ts** - `822a910` (feat)
2. **Task 2: Component and page ARIA fixes with outline-hidden migration** - `5c58f29` (feat)

## Files Created/Modified
- `client/index.html` - Skip link, route announcer live region, main landmark
- `client/src/router.ts` - updatePageMeta(), focusPageHeading(), document.title on all routes
- `client/src/components/loading-spinner.ts` - role=status, aria-live=polite, motion-reduce:animate-none
- `client/src/components/copy-button.ts` - aria-live on Copied!/Failed feedback, outline-hidden
- `client/src/components/expiration-select.ts` - outline-hidden migration
- `client/src/pages/create.ts` - outline-hidden, passwordInput.autocomplete=new-password
- `client/src/pages/confirmation.ts` - updatePageMeta/focusPageHeading calls, SVG aria-hidden, outline-hidden
- `client/src/pages/reveal.ts` - Emoji aria-hidden, passwordInput.autocomplete=current-password, outline-hidden
- `client/src/pages/error.ts` - Emoji aria-hidden, outline-hidden
- `client/src/styles.css` - warning-500 color token

## Decisions Made
- Used focus:outline-hidden instead of focus:outline-none because outline-hidden sets outline-color:transparent (overridable by forced-colors) while outline-none sets outline-style:none (not overridable)
- Clear-then-set pattern with requestAnimationFrame for route announcer to handle repeated same-title navigations
- Dynamic aria-live attribute on copy button (add before change, remove after reset) rather than permanent to avoid stale region announcements
- warning-500 color at oklch(0.75 0.15 85) for amber/orange attempt counter (manual contrast verification deferred to Plan 02)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All SPA accessibility infrastructure in place for Plan 02 (how-it-works content and remaining WCAG checks)
- Route announcements, focus management, and ARIA attributes ready for manual screen reader testing
- Pre-existing TypeScript errors in crypto module (Uint8Array/BufferSource compatibility) are unrelated to this plan
- Pre-existing flaky database-dependent test failures are unrelated to client-side changes

---
*Phase: 07-trust-and-accessibility*
*Completed: 2026-02-15*
