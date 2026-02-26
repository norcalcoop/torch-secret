---
status: testing
phase: 31-rebrand-tech-debt
source: 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md
started: 2026-02-24T00:00:00Z
updated: 2026-02-24T00:00:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Site Title and Header Wordmark
expected: |
  Visit the homepage. The browser tab title should say "Torch Secret" (not "SecureShare").
  The header at the top of the page should show "Torch Secret" as the wordmark/logo text.
awaiting: user response

## Tests

### 1. Site Title and Header Wordmark
expected: Visit the homepage. The browser tab title should say "Torch Secret" (not "SecureShare"). The header at the top of the page should show "Torch Secret" as the wordmark/logo text.
result: [pending]

### 2. Terms Page Text
expected: Navigate to /terms. The page content body text should reference "Torch Secret" (not "SecureShare") wherever the service name appears.
result: [pending]

### 3. Privacy Page Text
expected: Navigate to /privacy. The page content body text should reference "Torch Secret" (not "SecureShare") wherever the service name appears.
result: [pending]

### 4. Protection Panel in Light Mode
expected: On the create page (/), switch to light theme using the theme toggle (top-right). Then open the protection section on the create form. All text labels inside — tab names, checkbox labels, strength indicators, notes — should be clearly readable with dark text on a light background. Nothing should appear invisible or white-on-white.
result: [passed]

### 5. Noindex Response Headers on /privacy and /terms
expected: Open browser DevTools (F12) → Network tab. Navigate to /privacy, then click on the /privacy request in the Network panel and inspect Response Headers. There should be an X-Robots-Tag header with value "noindex, nofollow". Do the same for /terms.
result: [passed]

## Summary

total: 5
passed: 2
issues: 0
pending: 3
skipped: 0

## Gaps

[none yet]
