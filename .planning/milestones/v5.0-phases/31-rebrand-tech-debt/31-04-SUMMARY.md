---
phase: 31-rebrand-tech-debt
plan: "04"
subsystem: ui
tags: [tailwind, design-tokens, theme, light-mode, accessibility]

# Dependency graph
requires:
  - phase: 28-visual-design
    provides: Tailwind CSS 4 design-token system (--ds-color-text-* custom properties)
provides:
  - Protection panel with fully semantic color tokens — readable in both light and dark themes
affects: [create-page, theme-toggle, uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use text-text-primary/secondary/muted and border-border instead of hardcoded text-white/* and border-white/* in all UI components"

key-files:
  created: []
  modified:
    - client/src/pages/create.ts

key-decisions:
  - "Replaced all nine hardcoded Tailwind opacity classes in createProtectionPanel with semantic design-token classes — ensures correct contrast in both light and dark themes without conditional logic"
  - "Pre-existing Prettier formatting issues in .claude/competitors/*.yaml and .github/workflows/ci.yml are out of scope — create.ts itself passes format:check"

patterns-established:
  - "Semantic color token convention: text-text-muted (was text-white/40), text-text-secondary (was text-white/60), text-text-primary (was text-white), border-border (was border-white/10)"

requirements-completed: [BRAND-03]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 31 Plan 04: Light-Theme Invisible Text Fix Summary

**Nine hardcoded `text-white/*` and `border-white/*` Tailwind classes in the protection panel replaced with semantic design-token classes (`text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`), fixing invisible white-on-white text in light mode**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T21:27:02Z
- **Completed:** 2026-02-22T21:28:33Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- All nine hardcoded opacity-based white classes removed from `createProtectionPanel` in `create.ts`
- Tab strip border, inactive/active tab labels, checkbox label, panel note, strength tier label, entropy line, and gen state label (both initial and reset branch) now use semantic tokens
- Production build succeeds; all 139 client unit tests pass; ESLint clean
- Light theme: all protection panel text is now legible (dark text on light surface)
- Dark theme: unchanged (semantic tokens resolve to near-white equivalents via CSS custom properties)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace hardcoded white color classes with semantic tokens in createProtectionPanel** - `a5dd681` (fix)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `client/src/pages/create.ts` - Replaced nine hardcoded Tailwind opacity classes with semantic design-token classes in `createProtectionPanel`

## Decisions Made
- Used semantic tokens matching the existing design system (`text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`) rather than any custom values — stays consistent with Phase 28 design token convention
- Pre-existing Prettier formatting issues in `.claude/competitors/*.yaml` and `.github/workflows/ci.yml` left out of scope (not introduced by this change; `create.ts` itself passes `prettier --check`)

## Deviations from Plan

None — plan executed exactly as written. All nine class string substitutions applied as specified.

## Issues Encountered
- `npm run format:check` exits non-zero due to pre-existing formatting issues in `.claude/competitors/*.yaml` and `.github/workflows/ci.yml`. These files are unrelated to this task and were not touched. `client/src/pages/create.ts` itself passes `prettier --check` individually.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Protection panel is now theme-safe; light-theme UAT issues for BRAND-03 are resolved
- Phase 31 gap closure plan is complete (Plans 01-04 all done)
- No blockers for remaining Phase 31 work

---
*Phase: 31-rebrand-tech-debt*
*Completed: 2026-02-22*
