---
status: resolved
trigger: "UAT Test 5 (Pro User – all tabs unlocked) fails in automated sequence after free-user tests; Pro login works in isolation"
created: 2026-02-26T04:30:00Z
updated: 2026-02-26T04:35:00Z
---

## Current Focus

hypothesis: RESOLVED — was a stale hypothesis; test actually passes in final run
test: n/a
expecting: n/a
next_action: archive

## Symptoms

expected: "Setup: Login as Pro User" completes successfully in sequence after free-user tests, allowing Test 5 (Pro User – all tabs unlocked) to verify all tabs have no aria-disabled.
actual: (at time of UAT.md writing) Pro login silently failed when run after free-user login sequence — session state from free user was believed to persist and interfere. Result recorded as [issue] in UAT.md.
errors: No explicit error message — test produced a wrong-user or wrong-tab-state result.
reproduction: Run 34.1-UAT-TESTS.yaml in sequence: free-user tests first, then "Setup: Login as Pro User".
started: During first UAT run of 34.1 (2026-02-26)

## Eliminated

- hypothesis: Pro login always fails in automated sequence (always broken)
  evidence: UAT-BROWSER.md shows 10/10 PASS including "Setup: Login as Pro User" and "Test 5: Pro User – all protection tabs unlocked and activatable"
  timestamp: 2026-02-26T04:32:00Z

- hypothesis: Implementation is broken for Pro users (aria-disabled not cleared)
  evidence: Manual verification confirmed, and UAT-BROWSER.md Test 5 passed all 6 assertions (no aria-disabled on any tab, all three tabs activate on click)
  timestamp: 2026-02-26T04:32:00Z

## Evidence

- timestamp: 2026-02-26T04:31:00Z
  checked: 34.1-UAT-BROWSER.md (final automated run)
  found: 10/10 tests PASS including "Setup: Login as Pro User" and "Test 5: Pro User – all protection tabs unlocked and activatable"
  implication: The session persistence issue that caused the UAT.md [issue] mark was FIXED by the time the TESTS.yaml was written and the browser run executed

- timestamp: 2026-02-26T04:31:30Z
  checked: 34.1-UAT-TESTS.yaml — "Setup: Login as Pro User" steps
  found: Steps are: close → open {app}/login → fill credentials → click submit → wait networkidle → state save e2e/uat-pro-session.json. Test 5 then does: close → state load e2e/uat-pro-session.json → open {app}/create
  implication: The close step before "open {app}/login" ensures a fresh browser context before Pro login. The separate state file (uat-pro-session.json vs uat-auth-session.json) ensures no cross-contamination. This is the correct pattern.

- timestamp: 2026-02-26T04:32:00Z
  checked: e2e/uat-pro-session.json
  found: Valid session cookie for better-auth.session_token scoped to torchsecret.localhost with future expiry (1772683755), indicating a successfully saved Pro session
  implication: Pro login completed successfully and session was persisted to its own file, separate from the free-user session

- timestamp: 2026-02-26T04:33:00Z
  checked: 34.1-UAT.md vs 34.1-UAT-BROWSER.md gap
  found: UAT.md was written during an EARLIER run before the TESTS.yaml had the correct `close` + separate state file pattern. The [issue] in UAT.md reflects a first-pass failure that was subsequently fixed in the YAML spec before the final automated run.
  implication: The root cause of the original failure was the absence of a `close` step before Pro login (or sharing a state file with the free-user session). The YAML spec already encodes the fix: separate state files + close before each login.

- timestamp: 2026-02-26T04:33:30Z
  checked: create.ts getLockLevel() and createProtectionPanel() implementation
  found: getLockLevel uses closure over {isAuthenticated, isPro}. For isPro=true: passphrase returns 'none', generate returns 'none', custom returns 'none'. All three return 'none' (unlocked). Auth IIFE calls getMe() to get subscriptionTier, then replaces the panel with createProtectionPanel({ isAuthenticated: true, isPro: true }).
  implication: Implementation is correct. Pro detection path is: session check → getMe() API call → subscriptionTier === 'pro' → isPro=true → panel replacement with no locked tabs.

## Resolution

root_cause: |
  The UAT.md [issue] for Test 5 was recorded during an intermediate run before the TESTS.yaml spec encoded the correct sequencing pattern. The original failure mechanism was almost certainly one of:

  (a) Missing `close` step before "Setup: Login as Pro User" — without closing the browser context, Better Auth session cookies from the free-user login persisted in the Playwright context, causing the Pro login to silently succeed but save the free-user session into uat-pro-session.json (or to redirect immediately without completing the login form), OR

  (b) A shared state file — if both setups saved to the same file, the Pro session overwrote the free session but with the wrong user if the login form was pre-populated or if Better Auth used the existing cookie instead of the submitted credentials.

  The TESTS.yaml as currently written ALREADY IMPLEMENTS THE FIX:
  - "Setup: Login as Pro User" begins with `close` (fresh context)
  - Pro session saved to `e2e/uat-pro-session.json` (separate from `e2e/uat-auth-session.json`)
  - Test 5 loads `e2e/uat-pro-session.json` (isolated from free-user state)

  This is confirmed by the final automated run: 10/10 PASS.

fix: |
  Already applied in 34.1-UAT-TESTS.yaml:
  - `close` step before each login setup clears Playwright browser context (cookies + localStorage)
  - Separate state files: uat-auth-session.json (free) vs uat-pro-session.json (Pro)
  - `close` + `state load` pattern before each test that needs auth context

verification: |
  34.1-UAT-BROWSER.md shows 10/10 PASS on 2026-02-26T04:09:28Z run.
  Test 5 assertions verified:
  - passphrase aria-disabled: not "true" ✓
  - generate aria-disabled: not "true" ✓
  - custom aria-disabled: not "true" ✓
  - passphrase click → aria-selected="true" ✓
  - generate click → aria-selected="true" ✓
  - custom click → aria-selected="true" ✓

files_changed:
  - .planning/phases/34.1-passphrase-password-tier-enforcement/34.1-UAT-TESTS.yaml
