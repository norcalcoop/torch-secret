---
status: resolved
trigger: "Clicking 'Continue with GitHub' on /login does nothing — no redirect to GitHub, no error shown. Google OAuth works. AUTH-07 integration test passes server-side."
created: 2026-03-01T00:00:00Z
updated: 2026-03-01T00:01:00Z
---

## Current Focus

hypothesis: The Better Auth client redirectPlugin fires `window.location.href = context.data.url` but the URL points to `http://localhost:3000/api/auth/sign-in/social` (the BETTER_AUTH_URL origin) instead of the GitHub authorization URL. The `signIn.social` call for GitHub receives `{data: null, error: {...}}` because the server-side GitHub provider is NOT registered — the dev server started before GitHub credentials were added to Infisical, and `tsx watch` does NOT reload env vars without a file change.

CORRECTION after reading fetch-plugins.mjs: The redirectPlugin only fires `window.location.href` when `context.data?.url && context.data?.redirect` are BOTH truthy. If the server returns an error (e.g., provider not registered → 400/404 response), `context.data` will be null/undefined and the redirect never fires. The button click silently does nothing because `void` swallows the Promise.

CONFIRMED ROOT CAUSE: The server returned an error response for the GitHub social sign-in initiation — either because the GitHub provider is not registered in the running server instance (stale process without creds) OR the server returns `{url, redirect: false}` for some reason. Need to confirm which.

test: curl http://localhost:3000/api/auth/sign-in/social -X POST -H 'Content-Type: application/json' -d '{"provider":"github","callbackURL":"/dashboard"}'
expecting: If stale server → error response (provider not found). If creds loaded but something else → 200 with url+redirect.
next_action: Fix is applied — see Resolution section.

## Symptoms

expected: Clicking "Continue with GitHub" on /login redirects the browser to github.com/login/oauth/authorize (same as "Continue with Google" redirects to accounts.google.com)
actual: Button click produces no visible effect — browser stays on /login, no navigation, no error message, no ?error=oauth in URL
errors: None visible. The click handler uses `void authClient.signIn.social(...)` — any error from the Promise is silently swallowed.
reproduction: Start dev server with `npm run dev:server` and `npm run dev:client`. Navigate to http://torchsecret.localhost:1355/login. Click "Continue with GitHub". Nothing happens.
started: GitHub credentials (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET) were just provisioned to Infisical dev as part of Phase 39. Google OAuth worked (same session). AUTH-07 integration test (server-side, run with `infisical run --env=dev --`) passes — server returns 200+JSON with github.com/login/oauth URL.

## Eliminated

- hypothesis: User is already logged in — renderLoginPage detects session and redirects to /dashboard before buttons even render
  evidence: Google OAuth button works (same code path, same buttons rendered); if the user was redirected, neither button would work
  timestamp: 2026-03-01T00:00:00Z

- hypothesis: CSP or browser-level block on navigation
  evidence: Google OAuth button causes successful navigation; CSP cannot block top-level navigation triggered by window.location.href assignment
  timestamp: 2026-03-01T00:00:00Z

- hypothesis: Better Auth 1.x client-specific behavior differs for GitHub vs Google on the client side
  evidence: Reading fetch-plugins.mjs shows `redirectPlugin` is generic — it fires on ANY provider's response where `data.url && data.redirect` are truthy. No provider-specific branching in the client.
  timestamp: 2026-03-01T00:00:00Z

## Evidence

- timestamp: 2026-03-01T00:00:00Z
  checked: client/src/pages/login.ts createOAuthButton()
  found: Both Google and GitHub use identical code path — `void authClient.signIn.social({ provider, callbackURL: '/dashboard', errorCallbackURL: '/login?error=oauth' })`. No difference between providers in click handler.
  implication: Client-side code is not the discriminating factor between Google working and GitHub not working.

- timestamp: 2026-03-01T00:00:00Z
  checked: node_modules/better-auth/dist/client/fetch-plugins.mjs — redirectPlugin
  found: `window.location.href = context.data.url` fires ONLY when `context.data?.url && context.data?.redirect` are BOTH truthy. If server returns an error or `redirect: false`, no navigation occurs. No error surfacing to UI — Promise result is void'd.
  implication: The silent no-op on GitHub click means the server returned either an error OR a response with `redirect: false` / missing `url`. The `errorCallbackURL` parameter does NOT navigate to /login?error=oauth — that URL is embedded in the auth state and only used when the OAuth callback itself fails, not when the initiation endpoint fails.

- timestamp: 2026-03-01T00:00:00Z
  checked: server/src/auth.ts socialProviders block
  found: GitHub provider registration is conditional: `...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? { github: { ... } } : {})`. If the server process started without these env vars (before Infisical injection), the GitHub provider is simply absent from the Better Auth instance.
  implication: A stale server process (started before creds added to Infisical) would have no GitHub provider. Requests to `/api/auth/sign-in/social` with `provider: "github"` would return an error (likely 400 "provider not found"). The `tsx watch` process does NOT re-read env vars when they change externally — only restarts when TypeScript source files change.

- timestamp: 2026-03-01T00:00:00Z
  checked: AUTH-07 integration test (passes)
  found: Test is run with `infisical run --env=dev -- npx vitest run` — a FRESH process that gets the credentials injected. The running dev server is a separate process that may have started earlier.
  implication: Test passing does NOT prove the running dev server has the credentials. Separate processes, separate env injection.

- timestamp: 2026-03-01T00:00:00Z
  checked: node_modules/better-auth/dist/client/fetch-plugins.mjs, error callback behavior
  found: `errorCallbackURL` is passed as a body field to the POST /api/auth/sign-in/social endpoint. Better Auth embeds it in the OAuth state parameter. It is only used when GitHub redirects back to the callback URL with an error (e.g., user denied access). It is NOT used when the sign-in initiation itself fails.
  implication: Even with `errorCallbackURL: '/login?error=oauth'`, if the initiation call fails, the browser stays silently on /login. This explains why no error is shown and no navigation occurs.

- timestamp: 2026-03-01T00:00:00Z
  checked: client/src/pages/login.ts — error handling in OAuth button click
  found: `void authClient.signIn.social(...)` — the Promise is explicitly voided. If the call returns `{data: null, error: {message: "provider not found"}}`, the error is permanently discarded. No try/catch, no `.then()` chain, no error display.
  implication: There are TWO bugs: (1) stale server process = provider not registered, (2) client silently swallows the error instead of showing an error message. Bug #1 is a developer workflow issue (restart server). Bug #2 is a code bug that will hide future failures.

## Resolution

root_cause: TWO-PART ROOT CAUSE:

  PRIMARY (operational): The dev server process started before GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET were added to Infisical. The `tsx watch` process does not re-read environment variables when external secrets change — only when TypeScript source files are modified. The running Better Auth instance therefore has no GitHub provider registered. POST /api/auth/sign-in/social with provider=github returns an error response. The `redirectPlugin` only fires `window.location.href` when `response.data.url && response.data.redirect` are truthy — an error response produces neither, so no navigation occurs.

  SECONDARY (code bug): `void authClient.signIn.social(...)` permanently discards the Promise result. When the server returns an error, there is no UI feedback whatsoever — no error message, no redirect to `errorCallbackURL`. The user sees nothing. This affects any future server-side failure (provider misconfigured, rate limited, etc.).

fix: TWO FIXES REQUIRED:

  Fix #1 (operational — immediate): Restart the dev server (`npm run dev:server`) so it picks up GitHub credentials via Infisical injection on process start. This is user-facing workaround for the stale server.

  Fix #2 (code — permanent): Await the `signIn.social()` call and check the result. If `error` is present, navigate to `errorCallbackURL` manually (or show an inline error). This ensures any future initiation failure surfaces to the user instead of silently failing.

verification: CONFIRMED BY USER (2026-03-01). After restarting the dev server and applying the error-handling fix to createOAuthButton, clicking "Continue with GitHub" correctly redirects to github.com/login/oauth/authorize. The silent error swallowing bug in createOAuthButton has been fixed.

files_changed:
  - client/src/pages/login.ts (createOAuthButton — add error handling for signIn.social)
