---
phase: 39-complete-finish-google-auth-and-github-auth
plan: 03
subsystem: auth
tags: [better-auth, oauth, google, github, integration-tests, vitest]

# Dependency graph
requires:
  - phase: 39-01
    provides: Google OAuth credentials provisioned to Infisical dev + prod
  - phase: 39-02
    provides: GitHub OAuth credentials provisioned to Infisical dev + prod
provides:
  - AUTH-06 integration test passing (Google OAuth redirect initiation verified)
  - AUTH-07 integration test passing (GitHub OAuth redirect initiation verified)
  - Google OAuth full round-trip verified in dev (button click → accounts.google.com → /dashboard)
  - GitHub OAuth full round-trip verified in dev (button click → github.com → /dashboard)
  - Phase 39 complete — Google Auth and GitHub Auth fully operational
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Better Auth 1.x OAuth initiation returns 200+JSON {url, redirect:true} (not 3xx redirect) — test assertions must check response.body.url"
    - "Dev OAuth callbacks require Vite proxy bounce: Google/GitHub redirect to localhost:3000 directly, bypassing Vite; middleware 302-redirects to APP_URL so state cookie is present"
    - "createOAuthButton awaits signIn.social() and navigates to /login?error=oauth on error — prevents silent no-op when provider not configured"

key-files:
  created:
    - .planning/debug/resolved/github-oauth-button-does-nothing.md
  modified:
    - server/src/app.ts
    - server/src/auth.ts
    - server/src/config/env.ts
    - server/src/tests/auth.test.ts
    - client/src/pages/login.ts

key-decisions:
  - "Dev OAuth callback bounce middleware: intercept direct Google/GitHub callbacks to localhost:3000 and 302-redirect through APP_URL (portless URL) so the state cookie set during initiation is present"
  - "crossSubDomainCookies removed: Vite-proxy bounce approach is cleaner and avoids Domain=localhost cookie security concerns"
  - "createOAuthButton error surfacing: void authClient.signIn.social() replaced with await + error check + manual navigation to /login?error=oauth"
  - "AUTH-06/07 test assertions use response.body.url (not 3xx status) — Better Auth 1.x initiation returns 200+JSON redirect descriptor"

patterns-established:
  - "Better Auth 1.x OAuth test pattern: POST /api/auth/sign-in/social + expect(response.status).toBe(200) + expect(response.body.url).toContain('provider-domain')"
  - "Dev OAuth state_mismatch fix: middleware in app.ts bounces direct callbacks through Vite proxy URL — no crossSubDomainCookies needed"

requirements-completed:
  - OAUTH-GOOGLE
  - OAUTH-GITHUB

# Metrics
duration: ~90min (multi-session: debug + server restart + manual UAT)
completed: 2026-03-01
---

# Phase 39 Plan 03: End-to-End OAuth Verification Summary

**Google Auth and GitHub Auth fully operational: AUTH-06 + AUTH-07 pass, both OAuth round-trips confirmed, state_mismatch bug fixed via Vite proxy bounce middleware**

## Performance

- **Duration:** ~90 min (across two sessions including debug and manual UAT)
- **Started:** 2026-03-01
- **Completed:** 2026-03-01
- **Tasks:** 2 (Task 1: integration tests auto; Task 2: manual verification checkpoint)
- **Files modified:** 5

## Accomplishments

- AUTH-06 (Google OAuth) and AUTH-07 (GitHub OAuth) integration tests both pass when run with Infisical dev credentials injected via `infisical run --env=dev --`
- Full test suite: 361/361 tests green (AUTH-06/07 skip gracefully in normal `npm run test:run` without OAuth credentials)
- Google OAuth flow manually verified: button click → accounts.google.com consent → /dashboard landing
- GitHub OAuth flow manually verified: button click → github.com/login/oauth/authorize → /dashboard landing after authorization
- Phase 39 complete: Google Auth and GitHub Auth are fully operational in the dev environment

## Task Commits

Each task was committed atomically:

1. **Task 1: Run AUTH-06 and AUTH-07 integration tests with credentials injected** - `77fa85d` (fix — correct AUTH-06/07 test assertions for Better Auth 1.x OAuth response format)
2. **Task 2: Manual end-to-end verification of Google and GitHub OAuth flows** - verified confirmed; related fix commits: `b0c2321`, `a31f659`, `28c4c80`

**Plan metadata:** (this commit — docs: complete 39-03 plan)

## Files Created/Modified

- `server/src/tests/auth.test.ts` — AUTH-06/07 assertions corrected: Better Auth 1.x returns 200+JSON {url, redirect:true}, not 3xx redirect
- `server/src/app.ts` — Dev-only OAuth callback bounce middleware added: intercepts direct localhost:3000 callbacks and 302-redirects through APP_URL so state cookie is present
- `server/src/auth.ts` — `crossSubDomainCookies` block removed (superseded by bounce approach)
- `server/src/config/env.ts` — `BETTER_AUTH_COOKIE_DOMAIN` env var removed (no longer needed)
- `client/src/pages/login.ts` — `createOAuthButton` changed from `void authClient.signIn.social()` to `await` with error check; surfaces initiation errors as `/login?error=oauth` instead of silent no-op
- `.planning/debug/resolved/github-oauth-button-does-nothing.md` — Debug session archived (commit 28c4c80)

## Decisions Made

- **Dev OAuth callback bounce instead of crossSubDomainCookies:** Google and GitHub redirect directly to `localhost:3000/api/auth/callback/*`, bypassing the Vite proxy (torchsecret.localhost:1355). The state cookie was set on the Vite proxy domain, so it was absent on the direct localhost:3000 request, causing `state_mismatch`. Fix: a dev-only Express middleware intercepts direct callbacks (identified by absence of `x-forwarded-host` header) and 302-redirects them through APP_URL. The prior `crossSubDomainCookies` approach (`Domain=localhost`) was removed as it had security implications and the bounce is cleaner.

- **Better Auth 1.x test format:** OAuth initiation no longer returns HTTP 3xx. Instead it returns HTTP 200 with a JSON body `{url: "https://accounts.google.com/...", redirect: true}`. AUTH-06 and AUTH-07 assertions were updated from `expect(response.status).toBe(302)` to `expect(response.status).toBe(200)` + `expect(response.body.url).toContain(...)`.

- **Server restart required for Infisical secrets:** `tsx watch` does not re-inject Infisical secrets on file change — requires a full process restart to pick up new env vars. Documented in Phase 39 Execution Notes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed silent OAuth initiation failure in createOAuthButton**
- **Found during:** Task 2 (manual verification) — GitHub button did nothing when clicked
- **Issue:** `void authClient.signIn.social()` discarded the Promise and any initiation errors. When the server returned an error (provider not yet recognized), the button appeared to do nothing with no user feedback.
- **Fix:** Changed to `const { error } = await authClient.signIn.social(...)` inside an async IIFE; if `error` is truthy, manually navigate to `/login?error=oauth` after removing the oauth_login_provider sessionStorage flag.
- **Files modified:** `client/src/pages/login.ts`
- **Verification:** GitHub OAuth button click now redirects to github.com authorization page; error path shows visible error message
- **Committed in:** part of the dev debug sessions (see debug archive `28c4c80`)

**2. [Rule 1 - Bug] Fixed OAuth state_mismatch: dev OAuth callbacks bypassed Vite proxy**
- **Found during:** Task 2 (manual verification) — OAuth flows redirected to providers but landed on `/login?error=oauth` instead of `/dashboard`
- **Issue:** Google/GitHub redirect directly to `localhost:3000/api/auth/callback/*`. The state cookie was set by Better Auth during initiation on `torchsecret.localhost:1355` (the Vite portless URL). When the callback arrived on the raw Express port, the cookie was absent, causing Better Auth to throw `state_mismatch`.
- **Fix:** Added dev-only Express middleware before the Better Auth handler in `app.ts` that detects direct callbacks (no `x-forwarded-host`) and 302-redirects through `APP_URL`, letting the Vite proxy mediate the callback so the state cookie is present.
- **Files modified:** `server/src/app.ts`, `server/src/auth.ts` (removed `crossSubDomainCookies`), `server/src/config/env.ts` (removed `BETTER_AUTH_COOKIE_DOMAIN`)
- **Verification:** Both Google and GitHub OAuth flows complete to /dashboard after fix
- **Committed in:** `b0c2321`, `a31f659`

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were required for OAuth to function at all in dev. No scope creep — all changes are within the OAuth verification scope defined by this plan.

## Issues Encountered

- **Better Auth 1.x response format change:** OAuth initiation returns 200+JSON instead of 3xx redirect. The existing test assertions expected 3xx and would have always failed. Corrected in commit `77fa85d`.
- **Dev server restart required:** `tsx watch` does not re-inject Infisical environment variables when the process reloads on file change. A full stop+start is required to pick up new secrets. Workaround: always restart the server after running `infisical secrets set`.
- **GitHub OAuth credentials had propagation delay:** After adding GitHub credentials to Infisical, the OAuth button appeared to do nothing until server was restarted and the bounce middleware fix was applied.

## User Setup Required

None — credentials were provisioned in Plans 39-01 and 39-02. No additional setup needed.

## Next Phase Readiness

Phase 39 is the final phase of the v5.0 Product Launch Checklist. All OAuth functionality is now operational:
- Google sign-in: fully working (new user creation + account linking)
- GitHub sign-in: fully working (new user creation)
- Integration tests AUTH-06 + AUTH-07: passing with Infisical credentials injected
- Full test suite: 361/361 green in standard test:run (OAuth tests skip gracefully without credentials)

**v5.0 Product Launch Checklist is now complete.**

## Self-Check: PASSED

- FOUND: `.planning/phases/39-complete-finish-google-auth-and-github-auth/39-03-SUMMARY.md`
- FOUND: commit `77fa85d` (AUTH-06/07 test assertion fix)
- FOUND: commit `a31f659` (Vite proxy bounce middleware)
- FOUND: commit `28c4c80` (debug session archive)

---
*Phase: 39-complete-finish-google-auth-and-github-auth*
*Completed: 2026-03-01*
