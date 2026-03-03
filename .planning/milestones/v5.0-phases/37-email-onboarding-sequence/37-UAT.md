---
status: complete
phase: 37-email-onboarding-sequence
source: [37-01-SUMMARY.md, 37-02-SUMMARY.md, 37-03-SUMMARY.md]
started: 2026-02-27T13:05:01Z
updated: 2026-02-27T13:17:59Z
---

## Current Test

[testing complete]

## Tests

### 1. Marketing Consent Checkbox on Register Form
expected: Visit the register page (/register). The form shows a checkbox with label "Send me product tips and updates". The checkbox is unchecked by default. The form can be submitted without checking it.
result: pass

### 2. Register Without Consent Succeeds
expected: Fill in the register form without checking the marketing consent checkbox. Submit the form. Registration completes successfully — account is created, you are redirected/logged in normally. No error or validation message blocking submission due to the unchecked box.
result: pass

### 3. Welcome Email Received After Registration
expected: Register a new account (with or without the marketing consent checkbox checked). Within ~60 seconds, a welcome email arrives in the inbox from hello@torchsecret.com. The subject line is personalized with your first name (e.g., "Hey [FirstName], welcome to Torch Secret"). The email body contains a CTA link to torchsecret.com/create.
result: pass

### 4. Loops Contact Properties
expected: In the Loops dashboard (loops.so), find the contact created by the test registration. The contact shows: marketingConsent = true (if checkbox was checked) or false (if unchecked), subscriptionTier = free, and subscribed = true.
result: pass

### 5. Loops Loop Structure — Audience Filters
expected: In the Loops dashboard, open the onboarding loop (triggered by "registered" event). Confirm the 7-node structure: welcome email node → 3-day timer → audience filter (marketingConsent=true) → day-3 features email → 4-day timer → audience filter (marketingConsent=true AND subscriptionTier!=pro) → day-7 upgrade email. The loop status shows Active.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
