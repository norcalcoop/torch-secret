---
status: complete
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
  artifacts: []
  missing: []

- truth: "Share feedback link appears in the actions row on the post-reveal page alongside Create a New Secret"
  status: failed
  reason: "User reported: same display issue as before — feedback link appears side-by-side rather than expected layout"
  severity: minor
  test: 2
  artifacts: []
  missing: []
