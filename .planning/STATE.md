# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18 after v4.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v4.0 — Phase 22: Authentication

## Current Position

Phase: 22 of 27 (Authentication) — COMPLETE
Plan: All 7 plans complete (including gap-closure 07)
Status: Phase 22 fully complete — all auth requirements verified + trailing-slash router fix; Phase 23 (Secret Dashboard) is next
Last activity: 2026-02-20 — Phase 22 Plan 07 complete (trailing-slash normalization gap closure)

Progress: [███░░░░░░░] ~21% (v4.0 — 22/31 requirements complete: AUTH-01 through AUTH-08 verified by integration tests + human verification)

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

## Accumulated Context

### Decisions

All decisions logged in PROJECT.md Key Decisions table.

Key v4.0 architectural constraints (carry forward to every phase):
- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever
- Stripe webhook route must mount before express.json() in app.ts (not applicable v4.0, noted for v5.0 Pro tier)
- PostHog sanitize_properties stripping URL fragments is mandatory — misconfiguration leaks AES-256-GCM keys permanently
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

### Known Tech Debt

- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Lucide ESM workaround via Vite resolve.alias (upstream bug)
- Playwright webServer 30s timeout risk on slow CI runners (pre-build client in CI e2e job)
- Codecov badge shows "unknown" until CODECOV_TOKEN added to GitHub repo secrets

### Blockers/Concerns

(None — v3.0 clean ship, v4.0 roadmap complete)

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 22-07-PLAN.md — Phase 22 Authentication gap closure (trailing-slash normalization)
Resume: Begin Phase 23 (Secret Dashboard) — depends on Phase 22
