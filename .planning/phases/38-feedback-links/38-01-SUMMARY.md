---
phase: 38-feedback-links
plan: 01
subsystem: ui
tags: [feedback, tally, anchor, component, tdd]

# Dependency graph
requires:
  - phase: 34.1-passphrase-protection
    provides: confirmation.ts renderConfirmationPage
  - phase: 34.1-passphrase-protection
    provides: reveal.ts renderRevealedSecret
provides:
  - createFeedbackLink() shared component with TALLY_FEEDBACK_URL constant
  - "Share feedback" anchor on confirmation page (FBCK-01)
  - "Share feedback" anchor on reveal post-reveal page (FBCK-02)
  - 8 new unit tests asserting href/target/rel/textContent for both pages
affects: [future-phases-using-confirmation, future-phases-using-reveal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared anchor component pattern: createFeedbackLink(url) factory in components/ — returns fully-configured HTMLAnchorElement"
    - "Named constant TALLY_FEEDBACK_URL for easy single-point update when real Tally form is created"
    - "@internal export pattern for test isolation: export renderRevealedSecret with JSDoc @internal tag"

key-files:
  created:
    - client/src/components/feedback-link.ts
    - client/src/pages/confirmation.test.ts
    - client/src/pages/reveal.test.ts
  modified:
    - client/src/pages/confirmation.ts
    - client/src/pages/reveal.ts

key-decisions:
  - "TALLY_FEEDBACK_URL updated from placeholder 'https://tally.so/r/TODO' to real form 'https://tally.so/r/Y5ZV56' (Tally form ID Y5ZV56, created via API)"
  - "renderRevealedSecret exported @internal for test isolation — avoids full render pipeline mock complexity"
  - "No icon added to feedback link — keeps component minimal; avoids Lucide import complexity in shared component"
  - "ZK invariant enforced: TALLY_FEEDBACK_URL is static string with no query parameters — no userId/secretId appended"

patterns-established:
  - "createXxx() factory pattern for shared DOM components (matches copy-button, share-button, terminal-block)"
  - "Named URL constants for external links — easy grep + single-point update"

requirements-completed: [FBCK-01, FBCK-02]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 38 Plan 01: Feedback Links Summary

**`createFeedbackLink` shared component wired into confirmation and post-reveal pages via TDD (8 new tests, 361 total passing) with real Tally form https://tally.so/r/Y5ZV56 live**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T22:53:36Z
- **Completed:** 2026-02-28T23:02:00Z
- **Tasks:** 3/3 complete
- **Files modified:** 6

## Accomplishments

- Created `client/src/components/feedback-link.ts` with `TALLY_FEEDBACK_URL` constant (updated to real form `https://tally.so/r/Y5ZV56`) and `createFeedbackLink(url)` factory returning fully-configured `HTMLAnchorElement`
- Wired feedback link into `confirmation.ts` — rendered after "Create Another Secret" button as last child of wrapper
- Wired feedback link into `reveal.ts` — rendered as second child of actions row after "Create a New Secret" link; `renderRevealedSecret` exported @internal for test isolation
- 8 new unit tests (4 FBCK-01 + 4 FBCK-02) assert href contains "tally.so/r/", target="_blank", rel="noopener noreferrer", textContent="Share feedback"
- 361 total tests pass (353 pre-existing + 8 new), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared feedback-link component and write failing tests** - `bb36a14` (test — TDD RED)
2. **Task 2: Wire createFeedbackLink into confirmation.ts and reveal.ts** - `3257bb7` (feat — TDD GREEN)
3. **Task 3: Visual verification — approved; real Tally form URL committed** - `cec26a8` (feat — TALLY_FEEDBACK_URL updated to https://tally.so/r/Y5ZV56)

**Plan metadata:** `2662d33` (docs: complete plan)

_Note: TDD tasks — RED commit (test) then GREEN commit (feat)_

## Files Created/Modified

- `client/src/components/feedback-link.ts` — exports `TALLY_FEEDBACK_URL` constant and `createFeedbackLink(url)` factory
- `client/src/pages/confirmation.ts` — imports and appends feedback link after "Create Another Secret" button
- `client/src/pages/reveal.ts` — imports and appends feedback link in actions row; exports `renderRevealedSecret` @internal
- `client/src/pages/confirmation.test.ts` — 4 assertions for FBCK-01 (href, target, rel, textContent)
- `client/src/pages/reveal.test.ts` — 4 assertions for FBCK-02 (href, target, rel, textContent)

## TALLY_FEEDBACK_URL — Current Value

Real Tally.so form is live: `https://tally.so/r/Y5ZV56` (Tally form ID Y5ZV56, created via API 2026-02-28).

The constant in `client/src/components/feedback-link.ts` is already set to the live URL. Both placements (confirmation page + post-reveal page) link to the real form.

To update in future: change `TALLY_FEEDBACK_URL` in `client/src/components/feedback-link.ts` — both pages update automatically.

## Decisions Made

- `TALLY_FEEDBACK_URL` started as placeholder `'https://tally.so/r/TODO'`; updated to live form `'https://tally.so/r/Y5ZV56'` after Tally form was created via API — single constant made the swap a one-line change
- `renderRevealedSecret` exported `@internal` to enable direct test isolation without mocking the full reveal page pipeline (avoids async `handleReveal` and API call complexity in tests)
- No icon added to feedback link — keeps the shared component minimal and avoids Lucide import coupling in a shared utility
- ZK invariant: confirmed `TALLY_FEEDBACK_URL` is static with no `?` query parameters — no identifying data appended

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — real Tally form `https://tally.so/r/Y5ZV56` is live. No configuration needed.

## Next Phase Readiness

- Phase 38 Plan 01 complete — all 3 tasks done, visual verification approved
- FBCK-01 and FBCK-02 requirements satisfied
- Feedback links are live on confirmation page and post-reveal page pointing to real Tally form
- No blockers

---
*Phase: 38-feedback-links*
*Completed: 2026-02-28*
