---
phase: 39-complete-finish-google-auth-and-github-auth
plan: "02"
subsystem: auth
tags: [github-oauth, infisical, better-auth, credentials, oauth-apps]

# Dependency graph
requires:
  - phase: 39-01
    provides: Google OAuth credentials provisioned to Infisical (pattern established)
provides:
  - GitHub OAuth credentials (dev + prod) provisioned to Infisical
  - Two GitHub OAuth Apps registered (Torch Secret Dev, Torch Secret)
affects: [39-03-uat-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GitHub OAuth requires two separate apps (one per environment) due to single-callback-URL constraint"
    - "Infisical per-environment secret isolation: dev app credentials → dev env, prod app credentials → prod env"

key-files:
  created: []
  modified: []

key-decisions:
  - "Created two separate GitHub OAuth Apps (not one) because GitHub does not support multiple callback URLs per app, unlike Google"
  - "Dev app callback: http://localhost:3000/api/auth/callback/github; prod app callback: https://torchsecret.com/api/auth/callback/github"
  - "No code changes required — server/src/auth.ts socialProviders.github was already implemented and conditionally activates from env vars"

patterns-established:
  - "GitHub OAuth multi-environment pattern: separate OAuth App per environment, separate Infisical env per app"

requirements-completed:
  - OAUTH-GITHUB

# Metrics
duration: 63min
completed: 2026-03-01
---

# Phase 39 Plan 02: GitHub OAuth Credential Provisioning Summary

**Two GitHub OAuth Apps created (dev + prod) with credentials stored in Infisical — no code changes required as server/src/auth.ts socialProviders.github was already implemented**

## Performance

- **Duration:** ~63 min (human-action checkpoint — time includes manual GitHub dashboard steps)
- **Started:** 2026-03-01T14:35:10Z
- **Completed:** 2026-03-01T15:37:45Z
- **Tasks:** 2 (both human-action checkpoints)
- **Files modified:** 0 (operational provisioning only)

## Accomplishments

- "Torch Secret Dev" GitHub OAuth App created with callback `http://localhost:3000/api/auth/callback/github`
- "Torch Secret" (prod) GitHub OAuth App created with callback `https://torchsecret.com/api/auth/callback/github`
- GITHUB_CLIENT_ID (`Ov23li5k0Yn5xDN5O9Ro`) and GITHUB_CLIENT_SECRET stored in Infisical dev environment
- GITHUB_CLIENT_ID (`Ov23liOofIzZDcPqxGrJ`) and GITHUB_CLIENT_SECRET stored in Infisical prod environment
- Dev and prod Client IDs confirmed different — separate apps verified

## Task Commits

No per-task commits — both tasks were human-action checkpoints with no code changes.

**Plan metadata:** See final docs commit.

## Files Created/Modified

None — this plan was entirely operational (credential provisioning via GitHub dashboard + Infisical CLI). The server-side implementation in `server/src/auth.ts` was already complete from a prior phase.

## Decisions Made

- Two separate GitHub OAuth Apps were required because GitHub enforces a single callback URL per app (unlike Google Cloud Console which supports multiple redirect URIs per client). Dev and prod each have their own app.
- No `disableDefaultScope: true` was set — Better Auth's GitHub provider requests `user:email` by default. This is intentional: without `user:email`, users with private email settings on GitHub would return a null email, causing silent OAuth sign-up failure.
- No code changes were made. The `socialProviders.github` block in `server/src/auth.ts` uses a conditional spread pattern that activates only when both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are present — the dev server startup will silently enable GitHub OAuth now that credentials exist.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Infisical CLI commands completed successfully and verification confirmed two distinct Client IDs across environments.

## User Setup Required

External credentials were provisioned as part of this plan:

| Service | App Name | Environment | Callback URL |
|---------|----------|-------------|--------------|
| GitHub OAuth | Torch Secret Dev | Infisical dev | http://localhost:3000/api/auth/callback/github |
| GitHub OAuth | Torch Secret | Infisical prod | https://torchsecret.com/api/auth/callback/github |

Infisical secrets set:
- `GITHUB_CLIENT_ID` (dev): `Ov23li5k0Yn5xDN5O9Ro`
- `GITHUB_CLIENT_SECRET` (dev): stored
- `GITHUB_CLIENT_ID` (prod): `Ov23liOofIzZDcPqxGrJ`
- `GITHUB_CLIENT_SECRET` (prod): stored

## Next Phase Readiness

- Phase 39-03 (UAT + integration test verification) can now proceed — both Google OAuth (39-01) and GitHub OAuth (39-02) credentials are in Infisical for dev and prod
- Dev server started with `npm run dev:server` (which injects Infisical dev env vars) will have GitHub OAuth active
- The "Continue with GitHub" button on the login/register pages should be functional for end-to-end testing

---
*Phase: 39-complete-finish-google-auth-and-github-auth*
*Completed: 2026-03-01*
