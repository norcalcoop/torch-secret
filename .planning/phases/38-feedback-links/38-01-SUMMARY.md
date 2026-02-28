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
  - "TALLY_FEEDBACK_URL = 'https://tally.so/r/TODO' — placeholder intentional; single constant for easy swap when real Tally form is published"
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

**`createFeedbackLink` shared component with TALLY_FEEDBACK_URL constant wired into confirmation and post-reveal pages via TDD (8 new tests, 361 total passing)**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T22:53:36Z
- **Completed:** 2026-02-28T22:56:32Z
- **Tasks:** 2 (+ Task 3 is checkpoint:human-verify, awaiting visual verification)
- **Files modified:** 5

## Accomplishments

- Created `client/src/components/feedback-link.ts` with `TALLY_FEEDBACK_URL` constant (`https://tally.so/r/TODO`) and `createFeedbackLink(url)` factory returning fully-configured `HTMLAnchorElement`
- Wired feedback link into `confirmation.ts` — rendered after "Create Another Secret" button as last child of wrapper
- Wired feedback link into `reveal.ts` — rendered as second child of actions row after "Create a New Secret" link; `renderRevealedSecret` exported @internal for test isolation
- 8 new unit tests (4 FBCK-01 + 4 FBCK-02) assert href contains "tally.so/r/", target="_blank", rel="noopener noreferrer", textContent="Share feedback"
- 361 total tests pass (353 pre-existing + 8 new), zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared feedback-link component and write failing tests** - `bb36a14` (test — TDD RED)
2. **Task 2: Wire createFeedbackLink into confirmation.ts and reveal.ts** - `3257bb7` (feat — TDD GREEN)
3. **Task 3: Visual verification checkpoint** - awaiting human approval

_Note: TDD tasks — RED commit (test) then GREEN commit (feat)_

## Files Created/Modified

- `client/src/components/feedback-link.ts` — exports `TALLY_FEEDBACK_URL` constant and `createFeedbackLink(url)` factory
- `client/src/pages/confirmation.ts` — imports and appends feedback link after "Create Another Secret" button
- `client/src/pages/reveal.ts` — imports and appends feedback link in actions row; exports `renderRevealedSecret` @internal
- `client/src/pages/confirmation.test.ts` — 4 assertions for FBCK-01 (href, target, rel, textContent)
- `client/src/pages/reveal.test.ts` — 4 assertions for FBCK-02 (href, target, rel, textContent)

## TALLY_FEEDBACK_URL — How to Update

When the real Tally.so feedback form is created:

1. Open the form in Tally.so dashboard
2. Click "Share" tab
3. Copy the share URL (format: `https://tally.so/r/XXXXXX`)
4. Update the single constant in `client/src/components/feedback-link.ts`:
   ```typescript
   export const TALLY_FEEDBACK_URL = 'https://tally.so/r/XXXXXX';
   ```
5. Both placements (confirmation + reveal) update automatically

## Decisions Made

- `TALLY_FEEDBACK_URL = 'https://tally.so/r/TODO'` placeholder — intentional; single constant means one file to update when real form is created
- `renderRevealedSecret` exported `@internal` to enable direct test isolation without mocking the full reveal page pipeline (avoids async `handleReveal` and API call complexity in tests)
- No icon added to feedback link — keeps the shared component minimal and avoids Lucide import coupling in a shared utility
- ZK invariant: confirmed `TALLY_FEEDBACK_URL` is static with no `?` query parameters — grep confirms no identifying data appended

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Feedback link currently points to `https://tally.so/r/TODO` (placeholder). Update `TALLY_FEEDBACK_URL` when real Tally form is created.

## Next Phase Readiness

- Task 3 (checkpoint:human-verify) awaits visual confirmation of feedback link placement on both pages
- Dev server startup and manual navigation to `/create` → confirmation page and `/s/:id` → reveal page required
- After human approval, phase 38 plan 01 is complete

---
*Phase: 38-feedback-links*
*Completed: 2026-02-28*
