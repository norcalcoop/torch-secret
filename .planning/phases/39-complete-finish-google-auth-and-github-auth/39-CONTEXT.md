# Phase 39: complete-finish-google-auth-and-github-auth - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing Google and GitHub OAuth buttons to working provider apps: create OAuth apps in Google Cloud Console and GitHub Developer Settings, provision credentials in Infisical for each environment, configure correct redirect URIs, handle edge cases (same-email account collision, marketing consent, profile data), and verify the full flow end-to-end.

The UI (buttons, error handling, analytics flags) is already built. This phase is about making it real.

</domain>

<decisions>
## Implementation Decisions

### Marketing consent for OAuth users
- `marketingConsent` stays `false` by default for OAuth users — no post-OAuth consent interstitial
- The `databaseHooks.user.create.after` hook already fires for OAuth users and enrolls them in Loops with `marketingConsent: false`; this is correct and consistent
- Rationale: adding a consent interstitial after OAuth is unusual friction and breaks the "one click" expectation. Opt-in consent can be surfaced later in account settings.

### Account linking behavior
- If a user who registered via email/password tries to OAuth with the same email, Better Auth's default is to reject with an error (no auto-linking)
- Leave Better Auth's default behavior; the `?error=oauth` error handling on `/login` already catches this
- Do NOT enable account auto-linking — it introduces security risk (an attacker who can verify an email via OAuth could hijack an email/password account)

### Redirect URIs and environments
- Create **separate OAuth apps** for dev/staging/prod (not one app with multiple URIs)
- Dev callback: `http://localhost:3000/api/auth/callback/{provider}` (Better Auth's standard path)
- Staging callback: `https://{staging-domain}/api/auth/callback/{provider}`
- Production callback: `https://torchsecret.com/api/auth/callback/{provider}`
- Provision credentials in Infisical under the matching environment (dev, staging, prod)

### Post-OAuth landing destination
- After OAuth completes, users land on `/dashboard` (current behavior via `callbackURL: '/dashboard'`)
- No separate welcome/onboarding screen for first-time OAuth users — consistent with existing email/password flow
- The sessionStorage flag mechanism in `dashboard.ts` already fires `captureUserRegistered` vs `captureUserLoggedIn` correctly

### Profile data from OAuth
- Better Auth automatically populates `users.name` and `users.image` from the provider's profile data
- Do NOT display the avatar image in the dashboard (it's not shown yet and adding it is out of scope)
- Do NOT request additional OAuth scopes — email + name + profile picture is the default and sufficient

### Claude's Discretion
- Exact steps and ordering for Infisical credential injection setup
- Whether to add an integration test covering OAuth callback URLs (likely out of scope — E2E testing OAuth requires real provider credentials)
- Error message copy for account-already-exists-via-different-provider error (existing `?error=oauth` copy is acceptable)

</decisions>

<specifics>
## Specific Ideas

- The `toAppUrl()` function in `auth.ts` already handles dev/prod URL rewriting for OAuth callbacks — no changes needed there
- Better Auth's route for OAuth callbacks is `/api/auth/callback/google` and `/api/auth/callback/github` — these are the exact URIs to register in the provider consoles

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/auth.ts` — `socialProviders` block is already configured, conditional on env vars; no server-side changes needed once credentials are injected
- `client/src/pages/login.ts` + `register.ts` — OAuth buttons with `createOAuthButton()`, Google SVG icon, sessionStorage flags, `authClient.signIn.social()` — all complete
- `client/src/pages/dashboard.ts` — reads `oauth_login_provider` + `oauth_register_provider` from sessionStorage and fires analytics — complete
- `server/src/config/env.ts` — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` are already typed as optional `z.string()` — no schema changes needed

### Established Patterns
- Infisical is the secrets manager (replaces .env files); dev/staging/prod environments are separate
- OAuth env vars are optional — if absent, the provider is excluded from `socialProviders` in `auth.ts`; this is the existing conditional spread pattern

### Integration Points
- Infisical: add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET to each environment
- Google Cloud Console: new OAuth 2.0 client per environment, authorized redirect URIs using `/api/auth/callback/google`
- GitHub Developer Settings → OAuth Apps: one app per environment, callback URL using `/api/auth/callback/github`

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope (no new capabilities suggested)

</deferred>

---

*Phase: 39-complete-finish-google-auth-and-github-auth*
*Context gathered: 2026-03-01*
