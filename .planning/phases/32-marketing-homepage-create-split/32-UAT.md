---
status: testing
phase: 32-marketing-homepage-create-split
source: [32-01-SUMMARY.md, 32-02-SUMMARY.md, 32-03-SUMMARY.md, 32-04-SUMMARY.md]
started: 2026-02-25T00:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Homepage Route
expected: |
  Navigate to /. The marketing homepage loads — NOT the create-secret form.
  You should see a hero section with a headline and CTA button, not a textarea/form for pasting secrets.
awaiting: user response

## Tests

### 1. Homepage Route
expected: Navigate to /. The marketing homepage loads — NOT the create-secret form. You should see a hero section with a headline and CTA button, not a textarea/form for pasting secrets.
result: [pending]

### 2. Create Route
expected: Navigate to /create. The secret creation form loads — the textarea for pasting sensitive text, expiration selector, and "Create Secret" button appear (same as the old / behavior).
result: [pending]

### 3. Pricing Route
expected: Navigate to /pricing. A not-found/error page appears (the pricing page is not implemented yet in this phase — it's a stub).
result: [pending]

### 4. Hero Section
expected: On the homepage (/), the hero section shows the H1 headline "Share sensitive info in seconds", a subheading paragraph, and a CTA button/link that says something like "Create a Secret" and navigates to /create when clicked.
result: [pending]

### 5. Trust Strip
expected: Below the hero, a horizontal band of 3 proof points is visible: one about AES-256-GCM encryption, one about Zero-Knowledge, and one about self-destructing secrets. Each has an icon and a label.
result: [pending]

### 6. Use-Case Cards
expected: Below the trust strip, 3 glassmorphism cards appear with titles for Passwords, API Keys, and Sensitive Notes — each with an icon, title, and description.
result: [pending]

### 7. Email Form — Consent Validation
expected: Scroll to the email capture section at the bottom of the homepage. Enter an email address but leave the consent checkbox unchecked. Click submit. An inline error message appears — form is NOT submitted.
result: [pending]

### 8. Email Form — Valid Submission
expected: Enter an email address and check the consent checkbox. Click submit. A toast notification appears confirming the submission. The form resets (email field clears, checkbox unchecked).
result: [pending]

### 9. Desktop Navigation
expected: On a desktop viewport (≥640px), the header nav shows (left to right): the app logo/name, then on the right: a "Pricing" link, a "Login" or "Dashboard" link, a "Create a Secret" accent-colored button, and the theme toggle.
result: [pending]

### 10. Create CTA Hides on /create
expected: Navigate to /create. The "Create a Secret" CTA button in the desktop header is hidden (it would be redundant on the create page itself). On other pages it is visible.
result: [pending]

### 11. Mobile Tab Bar
expected: On a mobile viewport (<640px), a fixed bottom navigation bar appears with 4 tabs: Home, Create, Pricing, Dashboard — each with an icon and label. The active tab (matching the current route) is highlighted in a different color (accent) vs the others (muted).
result: [pending]

### 12. Footer Visibility on Mobile
expected: On a mobile viewport, scroll to the bottom of the homepage. The footer content (links, copyright text) is fully visible and NOT obscured behind the fixed tab bar.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
