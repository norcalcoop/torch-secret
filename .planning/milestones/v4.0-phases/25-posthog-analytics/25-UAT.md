---
status: complete
phase: 25-posthog-analytics
source: 25-01-SUMMARY.md, 25-02-SUMMARY.md, 25-03-SUMMARY.md
started: 2026-02-21T01:41:15Z
updated: 2026-02-21T02:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. App loads without errors
expected: Open the app (or refresh the page). There should be no JavaScript errors in the browser console related to analytics or PostHog. The app loads and renders normally. If VITE_POSTHOG_KEY is not set in your .env, analytics silently no-ops — this is expected and correct.
result: pass

### 2. SPA navigation works normally
expected: Navigate between pages (e.g., go to /login, then back to /, then to /dashboard or another route). All pages load correctly. No console errors. The SPA router still handles transitions smoothly with the analytics pageview wiring added.
result: pass

### 3. Secret creation still works
expected: Create a secret (fill in text, optionally set expiration/password, submit). You should land on the confirmation page with a share link. No errors or broken behavior from the analytics captureSecretCreated() call added to the submit handler.
result: pass

### 4. Secret reveal still works
expected: Open a share link from a created secret. The secret should decrypt and display correctly. No errors from the captureSecretViewed() call added to the reveal page.
result: pass

### 5. Email login still works
expected: Log in with an email+password account. Login succeeds and you land on /dashboard. No errors or behavior changes from the identifyUser() + captureUserLoggedIn() calls added to the login flow.
result: pass

### 6. Email registration still works
expected: Register a new email+password account. Registration succeeds and shows the email verification state. No errors from the captureUserRegistered() call added to the register flow.
result: pass

### 7. Dashboard load and logout work
expected: Visit /dashboard while logged in — page loads with your secrets. Click logout — you are redirected out of the dashboard. No errors from the identifyUser() on load or resetAnalyticsIdentity() + signOut() on logout.
result: pass

### 8. URL fragments never sent to PostHog (if PostHog configured)
expected: If VITE_POSTHOG_KEY is set and PostHog is active: open browser DevTools → Network tab → filter by "posthog" or "i.posthog.com". Navigate to a secret reveal URL (which has #key in the fragment). In the PostHog network request payload, the $current_url field should NOT contain the # fragment — it should be stripped to just the path+query. This is the before_send hook protecting encryption keys.
result: pass
reported: "Verified via code inspection: sanitizeEventUrls() strips $current_url, $referrer, and $initial_referrer via stripFragment() (new URL() + regex fallback) on every event before transmission. VITE_POSTHOG_KEY requires Vite restart to activate; analytics module correctly no-ops without it."

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none]

## Notes

Pre-existing bug discovered and fixed during testing (not a Phase 25 regression):
- `server/src/auth.ts` — `trustedOrigins` only included `BETTER_AUTH_URL` (:3000), not `APP_URL` (:5173). This blocked registration and login from the Vite dev server. Fixed: `trustedOrigins: [env.BETTER_AUTH_URL, ...(env.APP_URL ? [env.APP_URL] : [])]`

VITE_POSTHOG_KEY added to .env during this session. Vite restart required to activate PostHog in the browser bundle.
