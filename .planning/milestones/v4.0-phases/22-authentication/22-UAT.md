---
status: diagnosed
phase: 22-authentication
source: 22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md, 22-04-SUMMARY.md, 22-05-SUMMARY.md, 22-06-SUMMARY.md
started: 2026-02-19T18:00:00Z
updated: 2026-02-19T18:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Registration form renders and verifies email
expected: Navigate to /register. You see a form with three fields: Name, Email, Password. Below the form there are Google and GitHub OAuth buttons. Fill in a name, a fresh email address, and a password of 8+ characters, then submit. The form card is replaced in-place with a "Check your email" message that shows the email address you used and a hint to check your spam folder. You are NOT redirected to /dashboard.
result: pass

### 2. Login form renders and handles wrong credentials
expected: Navigate to /login. You see an email/password form and Google/GitHub OAuth buttons. Enter an email and a wrong password, then submit. An inline error message appears (something like "Invalid email or password"). The form is not cleared — you can try again.
result: pass

### 3. Login with correct credentials redirects to dashboard
expected: On /login, enter the email and password of a verified account, then submit. You are redirected to /dashboard. The dashboard shows the user's name and email address in a card. There is a Logout button visible.
result: pass

### 4. Dashboard logout
expected: While on /dashboard and logged in, click the Logout button. You are signed out and navigated back to the home page (/). If you then navigate to /dashboard, you are redirected to /login (not shown the dashboard).
result: pass

### 5. Already-authenticated redirect
expected: While already logged in, navigate to /login or /register. Instead of seeing the auth form, you are immediately redirected to /dashboard.
result: pass

### 6. Forgot password — generic success message
expected: Navigate to /forgot-password. You see an email input form. Enter any email address (even one that doesn't have an account) and submit. You see a generic success message such as "If an account exists for [email], you'll receive a password reset link shortly." The message is the same whether the account exists or not.
result: pass

### 7. Reset password — missing token shows error
expected: Navigate to /reset-password (no ?token= query param in the URL). Instead of a password form, you see an error card indicating the reset link is invalid or missing. There is a link back to /login or /forgot-password.
result: issue
reported: "it lands on page not found and a button to create a new secret not a link back to login or forgot-password"
severity: major

### 8. All 5 auth routes are navigable
expected: Navigate to each of the following routes in the SPA and confirm they render without a 404 or blank page: /login, /register, /forgot-password, /reset-password (shows invalid-link error, which is correct), /dashboard (redirects to /login if not authenticated).
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Navigating to /reset-password without a ?token= param (while NOT logged in) shows an inline error card with a link back to /forgot-password"
  status: failed
  reason: "User reported: it lands on page not found and a button to create a new secret not a link back to login or forgot-password (when not authenticated). When logged in the page correctly shows the error card with a 'Request a new one' link to /forgot-password."
  severity: major
  test: 7
  root_cause: "router.ts handleRoute() uses exact path === '/reset-password' matching with no trailing-slash normalization. When a user types the URL directly into the browser address bar (more likely when not in an active SPA session / not logged in), a trailing slash (/reset-password/) causes the route to fall through to the 404 fallback. SPA navigate() calls always produce clean paths, so auth-state (logged in = SPA navigation; not logged in = typed URL) correlates with the symptom. The reset-password.ts page code and the !token guard are both correct."
  artifacts:
    - path: "client/src/router.ts"
      issue: "handleRoute() at line 163 reads path = window.location.pathname with no normalization. All route comparisons are exact string matches, so /reset-password/ falls through to the else branch (404)."
  missing:
    - "Strip trailing slash from path in handleRoute() before route matching: const path = window.location.pathname.replace(/\\/$/, '') || '/';"
