---
status: complete
phase: 27-conversion-prompts-rate-limits-legal-pages
source: 27-01-SUMMARY.md, 27-02-SUMMARY.md, 27-03-SUMMARY.md
started: 2026-02-21T00:00:00Z
updated: 2026-02-21T15:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Anonymous expiration locked to 1h
expected: On the create page while logged out, the expiration field shows a static "1 hour" display — not a dropdown. Below it there is a note (e.g. "Create a free account for longer expiration options").
result: pass

### 2. Authenticated expiration dropdown (1h/24h/7d, no 30d)
expected: On the create page while logged in, the expiration field is a dropdown with exactly three options: 1 hour, 24 hours, and 7 days. There is no 30-day option.
result: pass

### 3. First anonymous secret shows conversion prompt
expected: Create a secret while logged out. On the confirmation page (after the shareable URL card), a dismissible card/banner appears prompting you to sign up.
result: pass

### 4. Second anonymous secret has NO conversion prompt
expected: Without refreshing or navigating away, create a second secret while still logged out. The confirmation page shows the URL card normally — no conversion prompt appears this time.
result: pass

### 5. Third anonymous secret shows conversion prompt again
expected: Create a third secret while logged out (same session, no refresh). The confirmation page shows the conversion prompt card again, just like the first time.
result: pass

### 6. Conversion prompt is dismissible
expected: The conversion prompt card has a close/dismiss button (×). Clicking it removes the card from the page without navigating away or clearing the shareable URL.
result: pass

### 7. Rate-limit upsell appears after 3 anonymous creations
expected: After creating 3 secrets as a logged-out user, attempting to create a 4th shows an inline upsell card — not a red error message. The card shows a countdown timer, a benefit line, and a "Sign up — it's free" CTA. It should not be styled in danger/red.
result: issue
reported: "Upsell card appears with correct neutral styling and CTA, but countdown shows 'Limit resets soon.' instead of the actual time remaining (e.g. 'Limit resets in 26 minutes'). Timer never shows a real value."
severity: minor

### 8. Server rejects >1h expiration for anonymous users
expected: In the browser Network tab (or via curl), a POST to /api/secrets with expiresIn "24h" while unauthenticated returns HTTP 400. A POST with expiresIn "1h" returns 201.
result: pass

### 9. Authenticated user can create with 7d expiration
expected: While logged in, select "7 days" from the expiration dropdown and create a secret. The request succeeds and the confirmation page shows the shareable URL normally.
result: pass

### 10. Footer has Privacy Policy and Terms of Service links
expected: On any page (create, reveal, login), the footer shows "Privacy Policy" and "Terms of Service" links. Clicking either navigates via SPA (no full page reload) to /privacy or /terms.
result: pass

### 11. Privacy Policy page at /privacy
expected: Navigating to /privacy shows a full Privacy Policy page with multiple sections describing the zero-knowledge model, data collection, third-party services, and user rights. The page uses the glassmorphism card layout.
result: pass

### 12. Terms of Service page at /terms
expected: Navigating to /terms shows a full Terms of Service page with multiple sections covering acceptable use, law enforcement disclaimer, and liability limitations. Same glassmorphism styling.
result: pass

### 13. Register page consent line with links
expected: On the /register page, below the submit button, there is a line reading "By creating an account, you agree to our Terms of Service and Privacy Policy." Both "Terms of Service" and "Privacy Policy" are clickable links that navigate via SPA to /terms and /privacy.
result: pass

## Summary

total: 13
passed: 12
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Rate-limit upsell card shows actual countdown timer (e.g. 'Limit resets in 26 minutes')"
  status: failed
  reason: "User reported: Upsell card appears with correct neutral styling and CTA, but countdown shows 'Limit resets soon.' instead of the actual time remaining (e.g. 'Limit resets in 26 minutes'). Timer never shows a real value."
  severity: minor
  test: 7
  root_cause: "RateLimit-Reset header (draft-6 format) is a delta in seconds (e.g. 1570), not a Unix timestamp. showRateLimitUpsell() in create.ts treats it as a Unix timestamp: `const resetMs = resetTimestamp * 1000; const minutesUntilReset = Math.ceil((resetMs - Date.now()) / 60_000)`. With resetTimestamp=1570, resetMs=1,570,000ms which is epoch+1.57s (year 1970), so minutesUntilReset is hugely negative, causing the 'Limit resets soon.' fallback to always fire."
  artifacts:
    - path: "client/src/pages/create.ts"
      issue: "showRateLimitUpsell() line 188: treats delta-seconds as Unix timestamp. Fix: use `Math.ceil(resetTimestamp / 60)` directly, or convert in client.ts with `Math.floor(Date.now()/1000) + parseInt(resetHeader, 10)`"
    - path: "client/src/api/client.ts"
      issue: "createSecret() stores raw delta value as rateLimitReset but JSDoc says 'Unix timestamp (seconds)' — mismatch between documentation and actual header semantics"
  missing:
    - "Fix showRateLimitUpsell to treat resetTimestamp as delta-seconds: `const minutesUntilReset = Math.ceil(resetTimestamp / 60)`"
  debug_session: ""
