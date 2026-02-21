# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18 after v4.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v4.0 — Phase 25: PostHog Analytics

## Current Position

Phase: 25 of 27 (PostHog Analytics) — In Progress
Plan: 1 of 3 complete (25-01 PostHog analytics foundation — module created, CSP updated)
Status: Phase 25 in progress — PostHog analytics module with before_send sanitizer + CSP connect-src shipped; Plans 02-03 remaining (wiring into app.ts/router.ts + page-level events)
Last activity: 2026-02-21 — Phase 25 Plan 01 complete

Progress: [████░░░░░░] ~37% (v4.0 — 33/35 requirements complete: AUTH-01 through AUTH-08 + DASH-01 through DASH-05 + PASS-01 through PASS-04 + ANLT-01 through ANLT-03)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| **Total shipped** | **20** | **51** | **~7 days** |
| v4.0 in progress | 7 planned | TBD | — |
| Phase 21 P03 | 1 | 2 tasks | 2 files |
| Phase 21 P02 | 6 | 1 tasks | 4 files |
| Phase 22 P01 | 4 min | 2 tasks | 6 files |
| Phase 22 P02 | 2 min | 2 tasks | 2 files |
| Phase 22 P04 | 5 | 2 tasks | 2 files |
| Phase 22 P05 | 2 | 2 tasks | 3 files |
| Phase 22 P06 | ~50 min | 2 tasks | 2 files |
| Phase 22 P07 | 1 | 2 tasks | 1 files |
| Phase 23 P01 | 2 min | 3 tasks | 4 files |
| Phase 23 P02 | 4 min | 3 tasks | 8 files |
| Phase 23 P03 | 8 min | 2 tasks | 3 files |
| Phase 23 P05 | 8 | 1 tasks | 2 files |
| Phase 24-eff-diceware-passphrase-generator P01 | 3 | 2 tasks | 4 files |
| Phase 24-eff-diceware-passphrase-generator P02 | 3 | 2 tasks | 1 files |
| Phase 24-eff-diceware-passphrase-generator P03 | 3 | 1 tasks | 1 files |
| Phase 25-posthog-analytics P01 | 2 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Key v4.0 architectural constraints (carry forward to every phase):
- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever
- Stripe webhook route must mount before express.json() in app.ts (not applicable v4.0, noted for v5.0 Pro tier)
- PostHog before_send hook stripping URL fragments is mandatory — before_send is the current API (sanitize_properties is legacy/nonexistent); misconfiguration leaks AES-256-GCM keys permanently
- Drizzle bug #4147: inspect generated SQL after db:generate; split FK + column additions into two migration steps if needed
- Better Auth requires sameSite: 'lax' on session cookie (not 'strict') for OAuth callback redirects to work
- [Phase 21]: INVARIANTS.md placed in .planning/ as canonical source for zero-knowledge invariant with three-way cross-reference lock (schema.ts + INVARIANTS.md + CLAUDE.md)
- [Phase 21-01]: onDelete: 'set null' on secrets.userId — preserves already-shared links if user deletes account; cascade would be a data-loss bug
- [Phase 21-01]: onDelete: 'cascade' on sessions.userId and accounts.userId — Better Auth requirement for session cleanup
- [Phase 21-01]: sql template tag must be imported from drizzle-orm (not drizzle-orm/pg-core)
- [Phase 21]: [Phase 21-02]: Drizzle bug #4147 workaround: drizzle-kit CASE B (single combined file) — split into 0001_add_auth_tables.sql and 0002_add_secrets_user_id.sql with ADD COLUMN before ADD CONSTRAINT
- [Phase 21]: [Phase 21-02]: Descriptive migration tag names (0001_add_auth_tables, 0002_add_secrets_user_id) chosen over drizzle-kit auto-slugs for operational clarity
- [Phase 22-01]: RESEND_API_KEY uses z.string().min(1) not startsWith('re_') — test env can use placeholder values
- [Phase 22-01]: Email callbacks use non-async fire-and-forget (void + Promise.resolve()) to satisfy @typescript-eslint/require-await while maintaining better-auth Promise<void> type contract
- [Phase 22-01]: drizzleAdapter uses both usePlural: true AND explicit user: schema.users mapping — belt-and-suspenders safety against Better Auth table name mismatch
- [Phase 22-01]: requireEmailVerification: env.NODE_ENV !== 'test' — bypasses email gate in test environment
- [Phase 22-02]: baseURL omitted from createAuthClient() — Better Auth infers from window.location; works for both Vite dev proxy and same-origin production
- [Phase 22-02]: isSession() type guard to safely narrow better-auth any-typed getSession return — avoids @typescript-eslint/no-unsafe-member-access throughout dashboard
- [Phase 22-02]: result.data cast to unknown before narrowing — satisfies no-unsafe-assignment without disabling the rule
- [Phase 22-03]: toNodeHandler(auth) mounted at /api/auth/{*splat} BEFORE express.json() — reversed order causes silent hangs on all auth requests (body-stream consumed before auth can read it)
- [Phase 22-03]: requireAuth uses auth.api.getSession() + fromNodeHeaders() — canonical Better Auth session validation pattern for Express
- [Phase 22-03]: /api catch-all moved to after /api/me to prevent 404 interception of GET /api/me requests
- [Phase 22]: [Phase 22-04]: Google icon built via createElementNS + individual path elements (no innerHTML) — security hook enforces XSS-safe DOM construction
- [Phase 22]: [Phase 22-04]: Register success shows email verification card in-place (no navigate) — requireEmailVerification: true means unverified users cannot log in
- [Phase 22]: [Phase 22-04]: OAuth error callback pattern: errorCallbackURL sets ?error=oauth, login/register pages check URLSearchParams on mount
- [Phase 22]: [Phase 22-05]: renderForgotPasswordPage/renderResetPasswordPage are non-async (void return) — no top-level await; async triggers require-await lint error
- [Phase 22]: [Phase 22-05]: forgot-password success state is generic (prevents email enumeration) — same message whether account exists or not
- [Phase 22]: [Phase 22-05]: reset-password extracts token via URLSearchParams(?token=) — Better Auth appends token because requestPasswordReset used redirectTo: '/reset-password'
- [Phase 22-06]: Better Auth requestPasswordReset endpoint path is /api/auth/request-password-reset (not /api/auth/forget-password as documented elsewhere)
- [Phase 22-06]: drizzleAdapter with usePlural: true requires explicit verifications: schema.verification mapping — Better Auth looks for 'verifications' key but schema exports 'verification' (singular)
- [Phase 22-06]: NODE_ENV=test in .env silently disables requireEmailVerification in dev — dev environments must use NODE_ENV=development; test runner sets its own NODE_ENV=test
- [Phase 22-06]: Better Auth client normalizes EMAIL_NOT_VERIFIED to INVALID_EMAIL_OR_PASSWORD — intentional (prevents email enumeration); UI shows generic message for unverified sign-in attempts
- [Phase 22]: Trailing slash normalization uses pathname.replace(/\/$/, '') || '/' — the || '/' guard is essential: ''.replace() returns '' not '/', preserving root path match
- [Phase 23-01]: status column is text (not PostgreSQL enum) — avoids ALTER TYPE migrations when adding new states; values constrained at application layer
- [Phase 23-01]: Drizzle bug #4147 confirmed not applicable for 0003 — four new columns have no FK constraints, single-file migration is safe
- [Phase 23-01]: notify defaults to false at DB level — explicit opt-in; actual email wired in Phase 26
- [Phase 23-01]: label max 100 chars enforced at Zod layer only (no DB constraint) — reduces migration complexity
- [Phase 23-02]: optionalAuth never returns 401 — session check failure is non-fatal; anonymous users proceed unchanged
- [Phase 23-02]: deleteUserSecret() owner verification and status check happen inside transaction — prevents TOCTOU race
- [Phase 23-02]: auto-destroy on password brute-force always hard-deletes even user-owned secrets — brute-force targets do not get dashboard history
- [Phase 23-02]: getUserSecrets() explicit column list is the sole enforcement preventing ciphertext/passwordHash from appearing in dashboard responses
- [Phase 23-03]: renderCreatePage stays synchronous (void return) not async — fire-and-forget IIFE for auth check avoids @typescript-eslint/require-await; PageRenderer accepts void | Promise<void> so both work
- [Phase 23-03]: Progressive enhancement order: form appended to container before auth check fires — anonymous users see zero delay; authenticated users see label field appear after brief async pause
- [Phase 23-03]: labelInput captured as mutable closure variable initialized to null — auth IIFE sets it after mount; submit handler reads labelInput?.value safely
- [Phase 23]: [Phase 23-04]: Used authClient singleton from api/auth-client.js in layout.ts — prevents duplicate Better Auth client instances; consistent with project convention
- [Phase 23]: Session creation in dashboard tests uses Better Auth sign-up/sign-in API (not direct DB session insert) — correct session token format is opaque; direct insert would require matching Better Auth internal token encoding
- [Phase 23]: INVARIANTS.md verification included as explicit tests so future changes that remove the dashboard logger entry would cause test failures, providing documentation enforcement
- [Phase 24-eff-diceware-passphrase-generator]: EFF_WORDS typed as string[] not as const — prevents TS language-server slowdown on 7,776-element literal array
- [Phase 24-eff-diceware-passphrase-generator]: EFF_WORDS exported from passphrase.ts for test membership verification — private would require weaker tests
- [Phase 24-eff-diceware-passphrase-generator]: Rejection sampling cutoff 4294964736 for n=7776 eliminates modulo bias; rejection probability ~0.0000006 per word
- [Phase 24-eff-diceware-passphrase-generator]: Added no-unsafe-call: off to ESLint test file override — importing unresolved modules during TDD RED phase causes false positives
- [Phase 24-02]: Two separate if (passphrase) blocks in confirmation.ts — matches existing if (label) pattern; separate blocks improve readability over merging
- [Phase 24-02]: Passphrase card uses same glassmorphism styling (bg-surface/80 backdrop-blur-md) as urlCard — visual parity signals equal importance of link and passphrase
- [Phase 24-03]: Hidden passwordInput placed after passphraseGroup in DOM — always synced with currentPassphrase; no visible UI needed (Phase 24-03)
- [Phase 24-03]: Progressive label enhancement insertBefore(labelField, errorArea) — errorArea is stable anchor after Advanced options removal (Phase 24-03)
- [Phase 25-posthog-analytics]: posthog-js npm import (not CDN snippet) — bundled via Vite; no script-src CSP changes needed, only connect-src
- [Phase 25-posthog-analytics]: before_send (not sanitize_properties) — sanitize_properties is legacy name, before_send is current posthog-js API; wrong name silently fails
- [Phase 25-posthog-analytics]: capture_pageview: false + manual capturePageview() — prevents race with reveal-page fragment stripping; before_send is belt-and-suspenders
- [Phase 25-posthog-analytics]: autocapture: false — passive DOM capture would record plaintext from create-page textarea before encryption

### Known Tech Debt

- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Lucide ESM workaround via Vite resolve.alias (upstream bug)
- Playwright webServer 30s timeout risk on slow CI runners (pre-build client in CI e2e job)
- Codecov badge shows "unknown" until CODECOV_TOKEN added to GitHub repo secrets

### Blockers/Concerns

(None — v3.0 clean ship, v4.0 roadmap complete)

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 25-posthog-analytics 25-01-PLAN.md — PostHog analytics foundation (module + CSP) shipped
Resume: Phase 25 Plan 02 — wire initAnalytics() into app.ts and capturePageview() into router.ts
