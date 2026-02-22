---
status: complete
phase: 31-rebrand-tech-debt
source: 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md
started: 2026-02-22T20:30:00Z
updated: 2026-02-22T20:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

## Current Test

[testing complete]

## Tests

### 1. Header Wordmark Shows "Torch Secret"
expected: Open the app in your browser. The header at the top of the page should display "Torch Secret" as the wordmark/logo text — not "SecureShare".
result: pass

### 2. Browser Tab Title Shows "Torch Secret"
expected: The browser tab title should contain "Torch Secret". For example, on the home/create page it should read something like "Torch Secret" or "Create — Torch Secret" — not "SecureShare".
result: pass

### 3. Lucide Icons Still Render
expected: Icons in the UI (copy button icon, theme toggle icon, any share/link icons) should display correctly — no broken icons, missing glyphs, or blank squares after the Lucide upgrade from 0.564.0 to 0.575.0.
result: issue
reported: "when I switch to light theme a lot of the text is no longer visible"
severity: major

### 4. /privacy Page Has Noindex Header
expected: Open DevTools (F12) → Network tab → navigate to /privacy. In the response headers for the HTML document, you should see "x-robots-tag: noindex, nofollow". This header was added server-side to complement the existing meta tag.
result: skipped
reason: Local dev uses Vite dev server for HTML — Express middleware (which sets the header) is bypassed. Only verifiable via Docker build.

### 5. /terms Page Has Noindex Header
expected: Same as above but for /terms. The response headers for /terms should include "x-robots-tag: noindex, nofollow".
result: skipped
reason: Same as test 4 — Vite dev server bypasses Express middleware in local dev.

### 6. Secret Creation Flow Still Works
expected: Create a new secret on the home page — type some text, set any expiration, and submit. You should receive a shareable link (the confirmation page should load and show a copyable link). This verifies the core flow still works after the brand rename and dependency changes.
result: issue
reported: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
severity: blocker

## Summary

total: 6
passed: 2
issues: 2
pending: 0
skipped: 2

## Gaps

- truth: "All UI text is visible when switching to light theme"
  status: failed
  reason: "User reported: when I switch to light theme a lot of the text is no longer visible"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Secret creation completes successfully and returns a shareable link"
  status: failed
  reason: "User reported: Failed to execute 'json' on 'Response': Unexpected end of JSON input"
  severity: blocker
  test: 6
  artifacts: []
  missing: []
