---
phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs
plan: 03
subsystem: ui
tags: [typescript, tailwind, lucide, accessibility, vitest, axe, requirements]

requires:
  - phase: 28-02
    provides: createProtectionPanel() factory with segmented Password|Passphrase tab design, masked inputs with eye toggles, full password generator UI

provides:
  - Eye/EyeOff toggle on reveal.ts password entry (masked by default, show/hide on click)
  - Reveal page label language updated to "Passphrase or password" / "Protection Required"
  - Protection panel axe accessibility tests (2 new tests: aria-pressed states + axe violations when open)
  - REQUIREMENTS.md PROT-01 through PROT-04 requirement IDs with Phase 28 traceability
  - Human UAT sign-off on full 6-scenario Phase 28 UX flow

affects:
  - Future phases referencing reveal.ts password entry pattern
  - Future accessibility test additions (follow established protection panel test pattern)

tech-stack:
  added: []
  patterns:
    - "Eye/EyeOff toggle on reveal page matches login.ts pattern exactly: passwordVisible flag + classList.toggle('hidden') on both icon elements"
    - "Protection panel accessibility tests use details/toggle event dispatch to open panel before axe scan"
    - "axe() invoked with { rules: { 'color-contrast': { enabled: false } } } to skip contrast checks in happy-dom (no real CSS rendering)"

key-files:
  created: []
  modified:
    - client/src/pages/reveal.ts
    - client/src/__tests__/accessibility.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Protection panel refactored to horizontal 4-tab design (tablist/tab/tabpanel ARIA) with combined password field per second UAT iteration — replaces earlier radio-button and segmented control designs"
  - "previewField div requires role=status with aria-label — bare div with aria-label violates axe rule (prohibited for divs without a semantic role)"
  - "no-useless-assignment lint fix: const nextIndex via ternary replaces let nextIndex = currentIndex pattern for arrow key navigation"
  - "Reveal page heading updated to 'Protection Required' (from 'Password Required') to cover both passphrase and password modes without naming a specific mode"
  - "pr-10 added to passwordInput.className on reveal page — prevents password text from running under the eye toggle button"

patterns-established:
  - "Reveal page eye toggle: identical pattern to login.ts — wrapper div.relative, button.absolute positioned right, Eye/EyeOff icon pair with hidden class toggling"

requirements-completed: [PROT-03]

duration: ~15min (including two design iteration cycles)
completed: 2026-02-21
---

# Phase 28 Plan 03: Reveal Eye Toggle, Accessibility Tests, Requirements, and UAT Summary

**Eye/EyeOff toggle on reveal.ts password entry, protection panel axe/aria tests, PROT requirements in REQUIREMENTS.md, and full 6-scenario human UAT approval — completing Phase 28**

## Performance

- **Duration:** ~15 min (including two protection panel design iteration cycles before UAT approval)
- **Started:** 2026-02-21
- **Completed:** 2026-02-21
- **Tasks:** 3 (Task 1: reveal toggle, Task 2: a11y tests + requirements, Task 2b: protection panel 4-tab refactor design iterations, Task 3: human UAT)
- **Files modified:** 3

## Accomplishments

- `reveal.ts` `renderPasswordEntry` gains Eye/EyeOff toggle using the exact login.ts pattern — masked by default, show/hide on click, pr-10 padding so text does not run under the button; label updated to "Passphrase or password", heading to "Protection Required", subtext and placeholder updated to cover both protection modes
- `accessibility.test.ts` gains 2 new tests in a `Protection panel accessibility` describe block: one verifying aria-pressed states on the segmented control buttons, one running axe on the open protection panel
- `.planning/REQUIREMENTS.md` updated with PROT-01 through PROT-04 requirement IDs, traceability rows to Phase 28, and coverage count updated to 35 v4.0 requirements
- Protection panel additionally iterated from its Plan 28-02 collapsible details+segmented control design through a radio-button layout (first UAT cycle) to the final horizontal 4-tab design (tablist/tab/tabpanel ARIA, arrow key navigation, combined password field) — approved in second UAT cycle

## Task Commits

Each task committed atomically:

1. **Task 1: Eye/EyeOff toggle on reveal.ts + label update** - `d3a79fa` (feat)
2. **Task 2: Update accessibility tests and REQUIREMENTS.md** - `c6751d9` (feat)
3. **Task 2b: Refactor protection panel to 4-tab design** - `38677d8` (feat)
4. **Task 3: Human UAT** - checkpoint approved (no code commit)

**Plan metadata:** final docs commit (docs(28-03))

## Files Created/Modified

- `client/src/pages/reveal.ts` - Added Eye/EyeOff import, wrapped passwordInput in div.relative, added absolutely-positioned toggle button with Eye/EyeOff icon pair and passwordVisible state; updated label to "Passphrase or password", heading to "Protection Required", subtext and placeholder; added pr-10 to passwordInput
- `client/src/__tests__/accessibility.test.ts` - Added `Protection panel accessibility` describe block with 2 tests: aria-pressed state verification on segmented control, axe scan of open protection panel
- `.planning/REQUIREMENTS.md` - Added PROT-01 through PROT-04 requirements under new PROT section, added Phase 28 traceability rows, updated v4.0 coverage count to 35

## Decisions Made

- Protection panel refactored twice after UAT feedback: first iteration moved from collapsible details+segmented control to radio fieldset layout; second iteration moved to horizontal 4-tab design (tablist/tab/tabpanel ARIA) with combined password field — the tab design resolves the visual separation and keyboard navigation issues from both prior iterations
- `role=status` required on the preview field div — axe rejects bare `div[aria-label]`; `role=status` is semantically correct for live password preview output and satisfies the axe rule
- `no-useless-assignment` lint fix required in arrow key nav: `const nextIndex` via ternary replaces `let nextIndex = currentIndex` followed by reassignment
- "Protection Required" chosen as heading (not "Password Required" or "Passphrase Required") — mode-agnostic wording covers both protection types without revealing which was used

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Protection panel radio design caused axe violation — previewField div lacked a role**
- **Found during:** Task 2 (accessibility tests)
- **Issue:** `div[aria-label]` is a prohibited ARIA pattern; axe rule requires a semantic role when aria-label is applied to a div
- **Fix:** Added `role="status"` to the preview field div
- **Files modified:** `client/src/pages/create.ts`
- **Verification:** axe scan passes with no violations
- **Committed in:** `38677d8` (protection panel 4-tab refactor commit)

**2. [Rule 1 - Bug] ESLint no-useless-assignment in arrow key navigation**
- **Found during:** Task 2b (4-tab refactor)
- **Issue:** `let nextIndex = currentIndex; ... nextIndex = ...` pattern triggers no-useless-assignment
- **Fix:** Replaced with `const nextIndex = currentIndex === 0 ? 1 : 0` ternary
- **Files modified:** `client/src/pages/create.ts`
- **Verification:** ESLint clean, 0 errors
- **Committed in:** `38677d8`

---

**Total deviations:** 2 auto-fixed (both Rule 1 bug fixes from ESLint/axe feedback during design iteration)
**Impact on plan:** Both fixes necessary for accessibility correctness and lint compliance. Protection panel design iterations (radio → 4-tab) were UAT-driven scope adjustments, not plan deviations.

## Issues Encountered

- Two protection panel design iterations were required before UAT approval: the initial collapsible details+segmented control design and the radio-button layout both received UAT feedback requesting changes. The horizontal 4-tab design was approved on the second iteration. This added implementation cycles but was fully resolved within the plan scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 28 is complete. All 4 PROT requirements satisfied (PROT-01 via 28-02, PROT-02 via 28-01, PROT-03 via 28-03, PROT-04 via 28-02)
- All 255 tests pass; 0 regressions
- ESLint and Prettier clean on all modified files
- v4.0 milestone Phase 28 is the final planned phase — all AUTH, DASH, PASS, ANLT, NOTF, CONV, LEGAL, and PROT requirements complete

## Self-Check: PASSED

- FOUND: `client/src/pages/reveal.ts` (modified, eye toggle present)
- FOUND: `client/src/__tests__/accessibility.test.ts` (modified, protection panel describe block present)
- FOUND: `.planning/REQUIREMENTS.md` (modified, PROT-01 through PROT-04 present)
- FOUND: commit `d3a79fa` (Task 1: reveal eye toggle)
- FOUND: commit `c6751d9` (Task 2: accessibility tests + REQUIREMENTS.md)
- FOUND: commit `38677d8` (Task 2b: 4-tab refactor)

---
*Phase: 28-optional-password-or-passphrase-protection-with-password-generator-and-masked-inputs*
*Completed: 2026-02-21*
