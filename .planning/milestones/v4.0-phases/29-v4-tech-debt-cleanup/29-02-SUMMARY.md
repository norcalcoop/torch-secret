---
phase: 29-v4-tech-debt-cleanup
plan: "02"
subsystem: analytics
tags: [posthog, oauth, sessionstorage, analytics, better-auth]

# Dependency graph
requires:
  - phase: 25-posthog-analytics
    provides: captureUserLoggedIn, captureUserRegistered, identifyUser functions in posthog.ts
  - phase: 22-better-auth
    provides: OAuth flow via authClient.signIn.social() with callbackURL='/dashboard'
provides:
  - OAuth analytics events fire for Google/GitHub login and registration via sessionStorage handoff pattern
  - captureUserLoggedIn('google'|'github') fires on first dashboard render after OAuth login
  - captureUserRegistered('google'|'github') fires on first dashboard render after OAuth registration
affects: [posthog-analytics, dashboard, oauth-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sessionStorage handoff for pre-redirect analytics flags across full-page OAuth redirects"
    - "Read-remove-fire atomic pattern: getItem -> removeItem -> capture to prevent duplicate events"

key-files:
  created: []
  modified:
    - client/src/pages/login.ts
    - client/src/pages/register.ts
    - client/src/pages/dashboard.ts

key-decisions:
  - "sessionStorage chosen over localStorage — sessionStorage is tab-scoped and cleared when the tab is closed, which is the correct lifetime for a one-time post-redirect flag"
  - "Flag removed before firing event (not after) — ensures the flag is gone even if captureUserLoggedIn throws, preventing retry loops"
  - "Type cast (as 'google' | 'github' | null) guarded by strict equality checks — safe narrowing without @ts-expect-error or any"

patterns-established:
  - "Pre-redirect sessionStorage flag pattern: setItem before authClient.signIn.social(); read-remove-capture in dashboard.ts on first render after redirect"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 29 Plan 02: OAuth Analytics Events via sessionStorage Handoff Summary

**sessionStorage handoff pattern closes ANLT-01 gap: Google/GitHub OAuth login and registration now fire captureUserLoggedIn/captureUserRegistered with provider string in PostHog**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T01:12:13Z
- **Completed:** 2026-02-22T01:13:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- login.ts sets `oauth_login_provider` in sessionStorage immediately before OAuth redirect, enabling post-redirect analytics
- register.ts sets `oauth_register_provider` in sessionStorage immediately before OAuth redirect, enabling post-redirect analytics
- dashboard.ts reads and immediately removes both flags after `identifyUser()`, fires the matching analytics event only when the provider value is 'google' or 'github'
- No duplicate events on dashboard refresh (flag removed on first read before event fires)
- Email auth events (`captureUserLoggedIn('email')` in login.ts, `captureUserRegistered('email')` in register.ts) unaffected

## Task Commits

Each task was committed atomically:

1. **Task 1: Set sessionStorage flags before OAuth redirect in login.ts and register.ts** - `fb73572` (feat)
2. **Task 2: Read sessionStorage flags in dashboard.ts and fire OAuth analytics events** - `1e084e9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `client/src/pages/login.ts` - Added `sessionStorage.setItem('oauth_login_provider', provider)` before `authClient.signIn.social()` in `createOAuthButton` click handler
- `client/src/pages/register.ts` - Added `sessionStorage.setItem('oauth_register_provider', provider)` before `authClient.signIn.social()` in `createOAuthButton` click handler
- `client/src/pages/dashboard.ts` - Imported `captureUserLoggedIn` and `captureUserRegistered`; added OAuth flag read-remove-capture block immediately after `identifyUser(session.user.id)`

## Decisions Made
- sessionStorage chosen over localStorage — sessionStorage is tab-scoped and cleared when the tab is closed, which is the correct lifetime for a one-time post-redirect flag; localStorage would persist across browser sessions unnecessarily
- Flag removed before firing event (not after) — ensures the flag is gone even if captureUserLoggedIn throws, preventing potential retry loops
- Type cast (`as 'google' | 'github' | null`) guarded by strict equality checks before passing to capture functions — safe narrowing without `@ts-expect-error` or `any`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OAuth analytics gap (ANLT-01) fully closed — PostHog funnels can now distinguish email vs. OAuth login/registration paths
- sessionStorage pattern is clean and handles the edge cases (no stale flags, no duplicates on refresh)

---
*Phase: 29-v4-tech-debt-cleanup*
*Completed: 2026-02-22*

## Self-Check: PASSED

- FOUND: .planning/phases/29-v4-tech-debt-cleanup/29-02-SUMMARY.md
- FOUND: client/src/pages/login.ts
- FOUND: client/src/pages/register.ts
- FOUND: client/src/pages/dashboard.ts
- FOUND commit: fb73572 (Task 1 - sessionStorage flags in login/register)
- FOUND commit: 1e084e9 (Task 2 - dashboard.ts OAuth analytics)
