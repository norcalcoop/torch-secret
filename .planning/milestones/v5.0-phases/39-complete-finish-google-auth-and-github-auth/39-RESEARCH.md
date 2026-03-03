# Phase 39: Complete, Finish Google Auth and GitHub Auth - Research

**Researched:** 2026-03-01
**Domain:** OAuth 2.0 social authentication (Google + GitHub), Better Auth social providers, credential provisioning
**Confidence:** HIGH

---

## Summary

The OAuth infrastructure for Google and GitHub is more complete than the phase name might suggest. The server-side Better Auth `socialProviders` configuration is fully implemented and conditionally registers each provider when the corresponding env vars are present. The frontend login and register pages both render Google and GitHub buttons that call `authClient.signIn.social()` with correct `callbackURL` and `errorCallbackURL` parameters. The post-OAuth analytics event chain (sessionStorage flag → dashboard.ts read + clear) is also fully wired.

**What is missing is operational, not architectural.** The Google Cloud Console OAuth 2.0 client and the GitHub OAuth App have not been created (or have not had their credentials loaded into Infisical). Without the four env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`), the `socialProviders` block in `auth.ts` evaluates to an empty object and both OAuth buttons trigger a redirect to a 400-error provider endpoint.

Additionally, there are three secondary gaps worth closing: (1) no end-to-end manual verification has been run for either OAuth flow; (2) OAuth users never see the `marketingConsent` checkbox — they always arrive with `marketingConsent: false` (correct by design but should be confirmed intentional); (3) the Loops onboarding `databaseHooks.user.create.after` hook fires for OAuth users too, which is correct but should be confirmed working in the live environment.

**Primary recommendation:** Create Google and GitHub OAuth apps, add the four credentials to Infisical (dev + prod environments), and run a manual end-to-end verification of both OAuth sign-in and sign-up flows. No code changes to `auth.ts`, `login.ts`, or `register.ts` are expected.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | ^1.4.18 (already installed) | OAuth provider integration | Already used for email/password auth; `socialProviders` config is additive |
| better-auth/client | same | `authClient.signIn.social()` in browser | Same client, no new install |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Infisical CLI | already installed | Inject `GOOGLE_CLIENT_ID` etc. into dev + CI | All credential management goes through Infisical per Phase 37.2 decision |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Better Auth socialProviders | Passport.js | Would require full middleware rewrite — not applicable, Better Auth is already installed |
| Infisical for credential storage | .env file | Project decision in Phase 37.2: Infisical is sole secrets source, no .env files |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Existing Implementation (already correct)

```
server/src/auth.ts           # socialProviders block — conditional on env vars
server/src/config/env.ts     # GOOGLE_CLIENT_ID/SECRET, GITHUB_CLIENT_ID/SECRET — optional z.string()
client/src/pages/login.ts    # createOAuthButton('google'/'github') → authClient.signIn.social()
client/src/pages/register.ts # same pattern
client/src/pages/dashboard.ts # sessionStorage flag read → captureUserLoggedIn/captureUserRegistered
```

### Better Auth OAuth Callback URL Pattern

Better Auth auto-generates callback URLs at:
- `{BETTER_AUTH_URL}/api/auth/callback/google`
- `{BETTER_AUTH_URL}/api/auth/callback/github`

These MUST be registered as authorized redirect URIs in each provider's developer console.

**Dev environment:**
- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/github`

**Production (torchsecret.com):**
- `https://torchsecret.com/api/auth/callback/google`
- `https://torchsecret.com/api/auth/callback/github`

**Important:** `BETTER_AUTH_URL` controls what Better Auth uses to construct the callback URL. In dev this is `http://localhost:3000` (Express port). The Vite proxy forwards `/api/auth/*` to Express, so the callback lands on Express correctly. This is already working for email auth — OAuth follows the same path.

### Pattern 1: Conditional Provider Registration (already implemented)

```typescript
// Source: server/src/auth.ts (existing code)
socialProviders: {
  ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } }
    : {}),
},
```

This conditional spread means the providers silently disappear when credentials are absent. Adding credentials to Infisical is the only code-adjacent change needed.

### Pattern 2: OAuth Button Click → Social Sign-In (already implemented)

```typescript
// Source: client/src/pages/login.ts (existing code)
button.addEventListener('click', () => {
  sessionStorage.setItem('oauth_login_provider', provider);
  void authClient.signIn.social({
    provider,
    callbackURL: '/dashboard',
    errorCallbackURL: '/login?error=oauth',
  });
});
```

### Pattern 3: Post-OAuth Analytics (already implemented)

```typescript
// Source: client/src/pages/dashboard.ts (existing code)
// After OAuth redirect, dashboard reads sessionStorage flag and fires analytics event
const oauthLoginProvider = sessionStorage.getItem('oauth_login_provider');
if (oauthLoginProvider === 'google' || oauthLoginProvider === 'github') {
  sessionStorage.removeItem('oauth_login_provider');
  captureUserLoggedIn(oauthLoginProvider);
}
```

### Pattern 4: OAuth New User → Loops Onboarding (already implemented)

When a user signs up via OAuth for the first time, Better Auth creates a new user row. The `databaseHooks.user.create.after` hook fires and calls `enrollInOnboardingSequence()`. OAuth users get `marketingConsent: false` (default) — they see no consent checkbox. This is correct: GDPR requires explicit consent; since OAuth users did not see a checkbox, they get no marketing emails. The welcome email (transactional) still fires for all new users regardless of consent.

### Anti-Patterns to Avoid

- **Hardcoding callback URIs in auth.ts:** Better Auth derives the callback URL from `baseURL` automatically. Do not add explicit `redirectURI` to the provider config unless the project requires a non-standard path.
- **Storing OAuth credentials in .env files:** Phase 37.2 established Infisical as sole secrets source. Add credentials only to Infisical, not to .env files or CI job-level env blocks.
- **Adding GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID to Zod EnvSchema as required:** They must remain `z.string().optional()` so the app boots cleanly without OAuth configured.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth state parameter (CSRF) | Custom state token generation | Better Auth handles this internally | State param is generated and verified by Better Auth's OAuth flow |
| PKCE | Custom code verifier/challenge | Better Auth handles this | Required by some providers; Better Auth implements it |
| Token refresh | Custom refresh loop | Better Auth stores and refreshes tokens via `accounts` table | `accounts.refresh_token` + `accounts.access_token_expires_at` are managed automatically |
| Account linking (same email via two providers) | Custom email-match logic | Better Auth `account.accountLinking` config option | Handles merging Google + GitHub + email/password accounts on the same email |

**Key insight:** The existing `accounts` table schema already has `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, and `scope` columns — Better Auth will populate these on OAuth sign-in with no schema changes needed.

---

## Common Pitfalls

### Pitfall 1: `redirect_uri_mismatch` (Most Common OAuth Error)

**What goes wrong:** Google/GitHub rejects the OAuth callback with "redirect_uri_mismatch" — the URL Better Auth sends in the authorization request doesn't match any registered URI in the developer console.
**Why it happens:** `BETTER_AUTH_URL` is set incorrectly (e.g., Vite port instead of Express port), or the developer console was set up with the wrong URI, or a trailing slash mismatch.
**How to avoid:** Set `BETTER_AUTH_URL=http://localhost:3000` in dev (Express port, not Vite). Register exactly `http://localhost:3000/api/auth/callback/google` in Google Cloud Console. No trailing slash.
**Warning signs:** OAuth redirect lands on a Google/GitHub error page instead of `/dashboard` or `/login?error=oauth`.

### Pitfall 2: Google OAuth Requires Authorized JavaScript Origins

**What goes wrong:** Google sign-in fails even with correct redirect URI.
**Why it happens:** Google also requires "Authorized JavaScript origins" in the OAuth client config. For local dev this must include `http://localhost:3000` (and optionally `http://torchsecret.localhost:1355` for portless dev).
**How to avoid:** In Google Cloud Console → Credentials → OAuth 2.0 Client ID → add both redirect URIs AND authorized JavaScript origins.
**Warning signs:** Google error page mentions "origin" or "JavaScript origins".

### Pitfall 3: GitHub OAuth Requires `user:email` Scope

**What goes wrong:** GitHub OAuth succeeds but Better Auth cannot create the user because email is missing from the profile.
**Why it happens:** GitHub's default OAuth scope does not include email. Without `user:email`, the GitHub API returns a null email for users with private email settings.
**How to avoid:** Better Auth's GitHub provider requests `user:email` by default (HIGH confidence, confirmed via Context7 docs). Do NOT set `disableDefaultScope: true` on the GitHub provider. No manual scope config needed.
**Warning signs:** OAuth callback redirects to `/login?error=oauth` with a silent "missing email" error in server logs.

### Pitfall 4: OAuth Sign-Up vs. Sign-In Distinction

**What goes wrong:** A user who previously registered with email/password tries OAuth with the same email and gets a "user already exists" error or a new duplicate account.
**Why it happens:** Better Auth's default account linking behavior.
**How to avoid:** Better Auth auto-links accounts when the email matches an existing user — OAuth with the same email as an existing email/password account will link to that account, not create a new one. This is the correct behavior and requires no config. Confirm `account.accountLinking` defaults are acceptable (they are, per Context7 docs showing it enabled by default in many configs).
**Warning signs:** Duplicate users appearing in the DB with the same email.

### Pitfall 5: Infisical Dev Environment Already Has Keys (or Doesn't)

**What goes wrong:** Credentials are added to Infisical prod but not dev (or vice versa), causing OAuth to work in one environment but not another.
**How to avoid:** Add credentials to BOTH `dev` and `prod` Infisical environments. Use the same Google/GitHub app for dev (with localhost redirect URIs added) and a separate app or additional redirect URIs for prod.
**Warning signs:** OAuth works locally but not on Render, or vice versa.

### Pitfall 6: Cookie SameSite on OAuth Callback

**What goes wrong:** After the OAuth redirect back from Google/GitHub, the Better Auth session cookie is not set.
**Why it happens:** If `sameSite: 'strict'`, the browser blocks the cookie on the cross-site OAuth callback redirect. The existing `auth.ts` uses `sameSite: 'lax'` (noted in CLAUDE.md as intentional) which allows the cookie to be sent on top-level navigations — exactly the OAuth callback redirect pattern.
**How to avoid:** This is already correct in the codebase. Do not change `sameSite` to `'strict'`.

### Pitfall 7: BETTER_AUTH_TRUSTED_ORIGINS and Portless Dev

**What goes wrong:** OAuth works on `http://localhost:3000` but fails when accessed via `http://torchsecret.localhost:1355` (portless).
**Why it happens:** CSRF protection checks the `Origin` header. In portless dev, the browser sends `Origin: http://torchsecret.localhost:1355` which must be in `BETTER_AUTH_TRUSTED_ORIGINS`.
**How to avoid:** `BETTER_AUTH_TRUSTED_ORIGINS=http://torchsecret.localhost:1355` is already set in Infisical dev per Phase 37.2 execution notes. Confirm it's present.

---

## Code Examples

### Google Cloud Console Setup (Reference)

```
Source: https://www.better-auth.com/llms.txt/docs/authentication/google

Steps to create credentials:
1. Open Google Cloud Console → APIs & Services → Credentials
2. Click Create Credentials → OAuth client ID
3. Choose Web application
4. Authorized JavaScript origins:
   - http://localhost:3000 (dev)
   - https://torchsecret.com (prod)
5. Authorized redirect URIs:
   - http://localhost:3000/api/auth/callback/google (dev)
   - https://torchsecret.com/api/auth/callback/google (prod)
6. Copy Client ID and Client Secret → add to Infisical
```

### GitHub OAuth App Setup (Reference)

```
Source: https://www.better-auth.com/llms.txt/docs/authentication/github

Steps:
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: Torch Secret (dev) / Torch Secret
3. Homepage URL: http://localhost:3000 (dev) / https://torchsecret.com (prod)
4. Authorization callback URL: http://localhost:3000/api/auth/callback/github (dev)
                               https://torchsecret.com/api/auth/callback/github (prod)
5. Copy Client ID and Client Secret → add to Infisical

Important: GitHub requires separate OAuth Apps per environment (callback URLs are
per-app, not a list). Create a "Torch Secret Dev" app and a "Torch Secret" prod app.
```

### Adding Credentials to Infisical (Reference)

```bash
# Add to dev environment
infisical secrets set GOOGLE_CLIENT_ID="..." --env=dev
infisical secrets set GOOGLE_CLIENT_SECRET="..." --env=dev
infisical secrets set GITHUB_CLIENT_ID="..." --env=dev
infisical secrets set GITHUB_CLIENT_SECRET="..." --env=dev

# Add to prod environment
infisical secrets set GOOGLE_CLIENT_ID="..." --env=prod
infisical secrets set GOOGLE_CLIENT_SECRET="..." --env=prod
infisical secrets set GITHUB_CLIENT_ID="..." --env=prod
infisical secrets set GITHUB_CLIENT_SECRET="..." --env=prod
```

### Verifying OAuth Redirect Initiation (existing test pattern)

```typescript
// Source: server/src/tests/auth.test.ts (existing code — already skips gracefully without env vars)
test('POST /api/auth/sign-in/social with provider=google returns 3xx redirect', async () => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn('Skipping Google OAuth test — GOOGLE_CLIENT_ID not set');
    return;
  }
  const res = await request(app)
    .post('/api/auth/sign-in/social')
    .send({ provider: 'google', callbackURL: '/dashboard' })
    .redirects(0);
  expect(res.status).toBeGreaterThanOrEqual(300);
  expect(res.headers['location']).toMatch(/accounts\.google\.com/);
});
```

Once credentials are in Infisical dev, `npm run dev:server` will inject them and these tests will run (not skip) automatically.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual passport.js middleware | Better Auth socialProviders | Phase 22 | OAuth is additive config, no route plumbing needed |
| .env files for secrets | Infisical CLI injection | Phase 37.2 | All four OAuth env vars must go into Infisical, not .env |
| Separate sign-in/sign-up for OAuth | Single `signIn.social()` call | Phase 22 | Better Auth handles both new and returning users via the same endpoint |

**Deprecated/outdated:**
- `.env` file for `GOOGLE_CLIENT_ID` etc.: Phase 37.2 stripped .env.example to keys-only with commented-out OAuth vars. Do not add actual values to .env.

---

## Open Questions

1. **Does the project want separate Google/GitHub OAuth apps for dev vs prod, or a single app with multiple redirect URIs?**
   - What we know: Google supports multiple redirect URIs per OAuth client. GitHub does NOT — GitHub OAuth Apps have a single callback URL field.
   - What's unclear: Whether user wants a single Google app (with both localhost and production URIs) or separate apps.
   - Recommendation: Single Google Cloud project with one OAuth client listing both URIs (simpler). Two GitHub OAuth Apps (required by GitHub's model): "Torch Secret Dev" and "Torch Secret".

2. **Should the OAuth buttons on login/register be hidden when provider credentials are not configured?**
   - What we know: Currently, buttons always render regardless of whether credentials are set. If the user clicks them without credentials, the `authClient.signIn.social()` call triggers a redirect to `/api/auth/sign-in/social` which Better Auth handles by redirecting to `/login?error=oauth` (because the provider is not registered).
   - What's unclear: Whether this is an acceptable UX during the setup period.
   - Recommendation: This is a non-issue after credentials are provisioned. The errorCallbackURL handles the failure case gracefully. No frontend code change needed.

3. **OAuth users and marketingConsent: intentionally false?**
   - What we know: OAuth users bypass the registration form entirely, so `marketingConsent` is never set to `true`. The Loops onboarding still fires the welcome email (transactional, no consent required). Day-3 and Day-7 emails are skipped for OAuth users (correct — no consent).
   - What's unclear: Whether the team wants to add a post-OAuth consent prompt (e.g., a modal on first dashboard visit) to collect marketing consent.
   - Recommendation: Out of scope for Phase 39. The current behavior (OAuth → welcome email only) is GDPR-correct. If a post-OAuth consent prompt is desired, create a Phase 40.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (multi-project: client=happy-dom, server=node) |
| Quick run command | `npx vitest run server/src/tests/auth.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

Phase 39 has no formal requirement IDs (TBD per ROADMAP.md). The implicit requirements are:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| Google OAuth initiation → 3xx redirect to accounts.google.com | integration | `npx vitest run server/src/tests/auth.test.ts` (skips without GOOGLE_CLIENT_ID) | Yes — auth.test.ts:AUTH-06 |
| GitHub OAuth initiation → 3xx redirect to github.com/login/oauth | integration | `npx vitest run server/src/tests/auth.test.ts` (skips without GITHUB_CLIENT_ID) | Yes — auth.test.ts:AUTH-07 |
| Complete OAuth round-trip (authorize → callback → session) | manual / E2E | Manual browser verification | No E2E spec exists |
| Post-OAuth analytics event fires on dashboard | manual | Manual browser + PostHog Live Events | No automated test |
| OAuth new-user → Loops onboarding fires welcome email | manual | Manual test registration + Loops activity log | No automated test |

### Wave 0 Gaps

- No new test files needed for automated assertions — existing `auth.test.ts` tests AUTH-06/07 become non-skipping once credentials are present in the dev environment.
- One Wave 0 item: create an E2E spec (or UAT document) for the full OAuth round-trip. Given the external redirect nature of OAuth (browser leaves the app domain), Playwright cannot intercept the Google/GitHub login UI directly. A manual UAT checkpoint plan is the appropriate validation vehicle.

---

## Sources

### Primary (HIGH confidence)

- `/llmstxt/better-auth_llms_txt` (Context7) — Google OAuth setup, GitHub OAuth setup, socialProviders config, callback URL construction, scope requirements
- `server/src/auth.ts` — existing socialProviders implementation (codebase read)
- `server/src/config/env.ts` — optional env var definitions (codebase read)
- `client/src/pages/login.ts`, `register.ts` — existing OAuth button implementation (codebase read)
- `server/src/tests/auth.test.ts` — existing skip-guarded OAuth tests (codebase read)

### Secondary (MEDIUM confidence)

- Better Auth official docs via Context7: `https://www.better-auth.com/llms.txt/docs/authentication/google` — redirect URI setup steps, authorized JavaScript origins requirement
- Better Auth official docs via Context7: `https://www.better-auth.com/llms.txt/docs/authentication/github` — `user:email` scope requirement

### Tertiary (LOW confidence)

- None. All critical claims verified via Context7 or direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, Better Auth is already installed and configured
- Architecture: HIGH — implementation is complete; only credentials are missing
- Pitfalls: HIGH — redirect_uri_mismatch and GitHub email scope are well-documented; verified via Context7
- OAuth round-trip behavior: MEDIUM — cannot be automated without live credentials; manual verification is the source of truth

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Better Auth is stable; Google/GitHub OAuth APIs are stable)
