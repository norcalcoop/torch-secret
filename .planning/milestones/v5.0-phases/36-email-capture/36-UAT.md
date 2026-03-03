---
status: complete
phase: 36-email-capture
source: 36-01-SUMMARY.md, 36-02-SUMMARY.md, 36-03-SUMMARY.md, 36-04-SUMMARY.md
started: 2026-02-26T20:00:00Z
updated: 2026-02-26T20:44:07Z
---

## Current Test

[testing complete]

## Tests

### 1. Email form in-flight state
expected: Navigate to the homepage. Enter a valid email address and check the consent checkbox. Click the submit button. While the request is in-flight, the button label changes to "Joining..." and the button is disabled (cannot be clicked again).
result: pass

### 2. Form success message
expected: After submitting with a valid email + consent checked, the form section is replaced with a success message that echoes the submitted email address: "Check your inbox — we sent a confirmation link to [your@email.com]. Click it to join the list. Check spam if you don't see it."
result: pass

### 3. Consent enforcement
expected: Enter a valid email but leave the consent checkbox unchecked. Click submit. The form does NOT submit — instead an inline error message appears: "Please check the consent box to continue." The button is not disabled and you can try again.
result: pass

### 4. Confirm page — success state
expected: Navigate to /confirm?token= with a valid (unused, unexpired) token. A loading state appears briefly, then transitions to a success state showing "You're on the list!" with a "Try Torch Secret" call-to-action button.
result: pass

### 5. Confirm page — expired state
expected: Navigate to /confirm?token=fake-or-expired-token. The page shows an expired/error state: something like "Confirmation link expired" with a "Back to homepage" link. It does NOT show a blank page or a JS error.
result: pass

### 6. Unsubscribe page
expected: Navigate to /unsubscribe?token= (valid or fake token). The page immediately shows an unsubscribed confirmation message with a "Back to homepage" link. No "are you sure?" prompt — it's immediate and idempotent.
result: pass

### 7. NOINDEX on /confirm and /unsubscribe
expected: The /confirm and /unsubscribe pages should not be indexed by search engines. The HTML <head> on these pages contains <meta name="robots" content="noindex"> (or similar). You can check via View Source on either page.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
