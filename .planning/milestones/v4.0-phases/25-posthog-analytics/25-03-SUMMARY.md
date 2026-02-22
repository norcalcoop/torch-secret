---
phase: 25-posthog-analytics
plan: "03"
subsystem: analytics
tags: [posthog, analytics, auth, identity, better-auth]

# Dependency graph
requires:
  - phase: 25-01
    provides: posthog.ts analytics module with identifyUser, captureUserLoggedIn, captureUserRegistered, resetAnalyticsIdentity
  - phase: 22-better-auth
    provides: authClient.signIn.email, authClient.signUp.email, authClient.signOut, authClient.getSession with userId
  - phase: 23-dashboard
    provides: dashboard.ts with session guard, logout button, renderDashboardPage

provides:
  - identifyUser wired to email login success path in login.ts (userId from getSession, not signIn response)
  - captureUserLoggedIn('email') fires before navigate('/dashboard') on successful email login
  - captureUserRegistered('email') fires before showEmailVerificationState() on successful email sign-up
  - identifyUser wired to dashboard page load after session confirmed — covers OAuth callback returns
  - resetAnalyticsIdentity() fires after authClient.signOut() resolves in dashboard.ts logout handler
  - SessionUser interface extended with id field for type-safe userId access

affects:
  - Phase 26 (email notifications) — analytics identity established, logout resets cleanly
  - Any future auth flow changes to login.ts, register.ts, dashboard.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - identifyUser via getSession() not signIn response — avoids typing signIn return's any-typed user field
    - identifyUser on every dashboard load (not just first login) — covers OAuth callbacks, deduplicates via PostHog
    - resetAnalyticsIdentity() after signOut() — ensures post-logout anonymous sessions get fresh distinct ID

key-files:
  created: []
  modified:
    - client/src/pages/login.ts
    - client/src/pages/register.ts
    - client/src/pages/dashboard.ts

key-decisions:
  - "identifyUser sourced from getSession() after signIn.email succeeds, not from signIn response — getSession() returns typed userId; signIn response user field is any-typed and less reliable"
  - "identifyUser called on every dashboard page load, not only first login — handles OAuth callback (callbackURL: '/dashboard'), PostHog deduplicates on unchanged distinct ID"
  - "captureUserRegistered fires before showEmailVerificationState() but no identifyUser — user has no session until email verified; identify deferred to first login via login.ts"
  - "SessionUser interface extended with id: string field; isSession() type guard updated to check both id and email — enables session.user.id access without unsafe member access lint errors"
  - "resetAnalyticsIdentity() placed after signOut() resolves (not before) — ensures the identified session ends before PostHog reset generates new anonymous distinct ID"

patterns-established:
  - "ANLT-03 pattern: identifyUser receives internal DB user ID (Better Auth's UUID) — never email, name, or secretId"
  - "OAuth identify via dashboard load, not login.ts — full page redirect means login.ts code never executes after OAuth completes"

requirements-completed: [ANLT-01, ANLT-03]

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 25 Plan 03: Auth Identity Analytics Summary

**PostHog user identity wired across login, register, and dashboard — identifyUser/captureUserLoggedIn on email sign-in, captureUserRegistered on sign-up, and resetAnalyticsIdentity on logout**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-21T01:24:16Z
- **Completed:** 2026-02-21T01:32:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Email login success path in login.ts now calls `identifyUser(userId)` (sourced from `getSession()`) then `captureUserLoggedIn('email')` before navigating to dashboard — satisfies ANLT-03
- Email registration success path in register.ts now calls `captureUserRegistered('email')` before showing email verification UI; `identifyUser` correctly withheld (no session until verified)
- Dashboard page load now calls `identifyUser(session.user.id)` after session confirmed — covers both returning email users and OAuth callbacks landing on `/dashboard`; PostHog deduplicates unchanged distinct IDs
- Logout handler now calls `resetAnalyticsIdentity()` after `signOut()` resolves — post-logout anonymous sessions get a fresh PostHog distinct ID
- `SessionUser` interface extended with `id: string` field; `isSession()` type guard updated to validate both `id` and `email` — type-safe userId access throughout dashboard.ts without any lint suppression

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire identity events into login.ts** - `ae3e1b9` (feat)
2. **Task 2: Wire analytics into register.ts and dashboard.ts** - `86e1c27` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/src/pages/login.ts` - Added `identifyUser` + `captureUserLoggedIn` imports; wired to email sign-in success path using `getSession()` for userId retrieval
- `client/src/pages/register.ts` - Added `captureUserRegistered` import; wired to email sign-up success path before email verification UI display
- `client/src/pages/dashboard.ts` - Added `identifyUser` + `resetAnalyticsIdentity` imports; extended `SessionUser` with `id` field; updated `isSession()` guard; wired `identifyUser` after session confirmed; wired `resetAnalyticsIdentity` after `signOut()` resolves

## Decisions Made

- **identifyUser from getSession(), not signIn response:** After `signIn.email()` succeeds, called `authClient.getSession()` to retrieve userId. The `signIn` response user field is any-typed by Better Auth's generic client; `getSession()` returns typed data that is safely narrowable via the existing `isSessionData` guard.
- **identifyUser on every dashboard load:** Covers both cases (email login redirect + OAuth callback) with one call. OAuth flows use full page redirect so login.ts code never runs post-OAuth; dashboard is the guaranteed landing page. PostHog deduplicates calls with unchanged distinct ID.
- **No identifyUser on email registration:** User cannot log in until email verified. No session exists at registration time. Identify happens on first login via login.ts.
- **SessionUser.id extension:** Added `id: string` to `SessionUser` interface and validated it in `isSession()` — clean typed access to `session.user.id` throughout dashboard without unsafe member access.
- **resetAnalyticsIdentity() after signOut() resolves:** Sequencing ensures the identified session ends before PostHog generates a new anonymous distinct ID for subsequent activity.

## Deviations from Plan

None - plan executed exactly as written.

The one implicit extension: updating `isSession()` to check `typeof user['id'] === 'string'` alongside the existing `email` check. This was necessary to correctly type `session.user.id` in TypeScript — without it, accessing `.id` on the typed `Session` object would require a type assertion. This is a supporting correctness fix, not a scope deviation.

## Issues Encountered

None. TypeScript and ESLint passed cleanly on first attempt. All 220 existing tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 25 complete — all three analytics plans shipped (Plan 01: PostHog module, Plan 02: funnel events, Plan 03: identity events)
- Full analytics funnel operational: anonymous pageviews → secret creation → secret viewing → user registration → user login → dashboard sessions → logout
- Zero-knowledge invariant maintained: no event contains both userId and secretId
- URL fragment stripping active on all events via before_send hook
- Phase 26 (email notifications) can proceed without analytics concerns

---
*Phase: 25-posthog-analytics*
*Completed: 2026-02-21*
