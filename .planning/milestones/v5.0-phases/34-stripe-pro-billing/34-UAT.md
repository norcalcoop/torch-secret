---
status: complete
phase: 34-stripe-pro-billing
source: 34-01-SUMMARY.md, 34-02-SUMMARY.md, 34-03-SUMMARY.md, 34-04-SUMMARY.md, 34-05-SUMMARY.md
started: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Free user — 30-day expiration locked on create page
expected: On the /create page as a free (non-Pro) user, the expiration dropdown shows four options: 1 hour, 24 hours, 7 days, and 30 days. The 30-day option has a lock icon and is not selectable. Hovering or focusing the lock wrapper shows a tooltip "Upgrade to Pro to unlock". The other three options work normally.
result: pass

### 2. Pro user — all expiration options unlocked on create page
expected: On the /create page as a Pro user, the expiration dropdown shows all four options selectable: 1 hour, 24 hours, 7 days, and 30 days. The 30-day option has no lock icon and can be selected like any other option.
result: pass

### 3. Dashboard free user — Upgrade to Pro CTA
expected: On /dashboard as a free user, the logout card shows an "Upgrade to Pro — $9/mo" button with sub-note "Unlocks 30-day secret expiration. Cancel anytime." No Pro badge is visible next to the email.
result: pass

### 4. Dashboard Pro user — Pro badge + Manage Subscription
expected: On /dashboard as a Pro user, a "Pro" badge (styled pill) appears inline next to the email address. A "Manage Subscription" button is visible instead of the upgrade CTA. No "Upgrade to Pro" button appears.
result: pass

### 5. Checkout initiation — clicking Upgrade redirects to Stripe Checkout
expected: Clicking "Upgrade to Pro — $9/mo" on the dashboard redirects the browser to Stripe's hosted Checkout page with the correct product/price loaded.
result: pass

### 6. Post-checkout success — verification banner on dashboard
expected: After completing the Stripe Checkout (using test card 4242 4242 4242 4242), the browser returns to /dashboard. A spinner banner appears immediately, then resolves to a success message "✓ You're now Pro — 30-day secrets unlocked". The URL no longer shows ?upgraded=true&session_id=... params after the page settles.
result: pass

### 7. Checkout cancellation — toast shown
expected: Cancelling out of Stripe Checkout (clicking "Back" or "Cancel") returns to /dashboard and shows a toast notification: "Checkout cancelled — you can upgrade anytime". The URL params are cleaned from the address bar.
result: pass

### 8. Webhook downgrade — Pro revoked after subscription deletion
expected: After triggering a subscription cancellation (via Stripe CLI `stripe trigger customer.subscription.deleted` or cancelling in the Customer Portal), refreshing /dashboard shows: Pro badge gone, upgrade CTA reappears, and the 30-day expiration option on /create becomes locked again.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
