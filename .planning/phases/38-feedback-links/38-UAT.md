---
status: diagnosed
phase: 38-feedback-links
source: 38-01-SUMMARY.md
started: 2026-03-01T00:00:00Z
updated: 2026-03-01T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. "Share feedback" link on confirmation page
expected: After creating a secret, confirmation page shows a "Share feedback" link below the "Create Another Secret" button. Clicking it opens https://tally.so/r/Y5ZV56 in a new tab.
result: issue
reported: "Create another secret isnt a button it looks like text with a hyperlink. Share feedback is not underneath create another secret button it is side-by-side."
severity: minor

### 2. "Share feedback" link on post-reveal page
expected: After a recipient views a secret (post-reveal state, secret consumed), the reveal page shows a "Share feedback" link in the actions row alongside "Create a New Secret". Clicking it opens https://tally.so/r/Y5ZV56 in a new tab.
result: issue
reported: "same display issue as before"
severity: minor

## Summary

total: 2
passed: 0
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Share feedback link appears below the Create Another Secret button on the confirmation page"
  status: failed
  reason: "User reported: Create another secret isnt a button it looks like text with a hyperlink. Share feedback is not underneath create another secret button it is side-by-side."
  severity: minor
  test: 1
  root_cause: "Wrapper div uses space-y-6 (block margin stacking) but feedback link is inline-block — browser places it beside the adjacent inline-block button on the same line. Needs a flex-col wrapper around both actions."
  artifacts:
    - path: "client/src/pages/confirmation.ts"
      issue: "Lines 296-297: feedbackLink appended directly to wrapper after createAnotherButton with no flex-col container forcing a new line"
    - path: "client/src/components/feedback-link.ts"
      issue: "Lines 29-32: createFeedbackLink() returns inline-block anchor — sits beside siblings without a block-level wrapper"
  missing:
    - "Wrap createAnotherButton and feedbackLink in a new div with class 'flex flex-col items-center gap-2' before appending to wrapper"
  debug_session: "feedback-link-layout"

- truth: "Share feedback link appears in the actions row on the post-reveal page alongside Create a New Secret"
  status: failed
  reason: "User reported: same display issue as before — feedback link appears side-by-side rather than expected layout"
  severity: minor
  test: 2
  root_cause: "Actions container uses 'flex flex-col sm:flex-row' — at sm+ breakpoints it switches to a horizontal row, placing feedback link beside 'Create a New Secret' on the same line."
  artifacts:
    - path: "client/src/pages/reveal.ts"
      issue: "Line 405: actions div has 'flex flex-col sm:flex-row items-center gap-4' — sm:flex-row causes horizontal layout at tablet/desktop widths"
    - path: "client/src/pages/reveal.ts"
      issue: "Lines 420-421: feedbackLink appended as direct sibling of newSecretLink inside that flex-row container"
  missing:
    - "Remove 'sm:flex-row' from actions container class at reveal.ts line 405 — keep 'flex flex-col items-center gap-4' only"
  debug_session: "reveal-feedback-link-layout"
