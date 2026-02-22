---
phase: 22-authentication
plan: 01
subsystem: auth
tags: [better-auth, resend, drizzle, email, oauth, google, github, env-validation, zod]

# Dependency graph
requires:
  - phase: 21-schema-foundation
    provides: "users, sessions, accounts, verification tables created via Drizzle migrations"
provides:
  - "better-auth and resend packages installed"
  - "8 auth-related env vars validated by Zod schema"
  - "server/src/services/email.ts — Resend SDK wrapper"
  - "server/src/auth.ts — single-source-of-truth Better Auth instance with Drizzle adapter, email/password, email verification, password reset, optional Google and GitHub OAuth"
  - "AuthSession, AuthUser, AuthSessionData TypeScript types exported from auth.ts"
affects: [22-02-PLAN, 22-03-PLAN, 22-04-PLAN, 22-05-PLAN, 22-06-PLAN, 23-dashboard]

# Tech tracking
tech-stack:
  added: [better-auth@1.4.18, resend@6.9.2]
  patterns:
    - "Single auth.ts export — all server files import the Better Auth instance from one file"
    - "Fire-and-forget email pattern — void resend.emails.send() with Promise.resolve() return to satisfy Promise<void> type without awaiting"
    - "Conditional social providers — only include Google/GitHub in config when env vars present"
    - "Test env bypass — requireEmailVerification: env.NODE_ENV !== 'test'"

key-files:
  created:
    - server/src/auth.ts
    - server/src/services/email.ts
  modified:
    - server/src/config/env.ts
    - .env.example
    - package.json
    - package-lock.json

key-decisions:
  - "RESEND_API_KEY uses z.string().min(1) not z.string().startsWith('re_') — accepts any non-empty string so test env can use placeholder values"
  - "Email callbacks use non-async fire-and-forget (void + Promise.resolve()) to satisfy both better-auth Promise<void> type and @typescript-eslint/require-await ESLint rule"
  - "drizzleAdapter uses both usePlural: true AND explicit user: schema.users mapping for clarity and safety"
  - "requireEmailVerification disabled in test env (NODE_ENV !== 'test') to allow integration tests to bypass email gate"
  - "OAuth social providers conditionally included — missing env vars silently skip provider rather than fail startup"

patterns-established:
  - "Pattern: All Better Auth consumers import from server/src/auth.ts — never configure betterAuth() directly in other files"
  - "Pattern: Fire-and-forget email — void resend.emails.send(...) without await, return Promise.resolve() for type compatibility"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 22 Plan 01: Authentication Foundation Summary

**Better Auth 1.4.18 server instance configured with Drizzle adapter, email/password + verification/reset via Resend, optional Google and GitHub OAuth, and 8 new Zod-validated env vars**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T13:12:21Z
- **Completed:** 2026-02-19T13:16:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed better-auth@1.4.18 and resend@6.9.2 with full TypeScript types
- Extended Zod EnvSchema with 8 new auth env vars (BETTER_AUTH_SECRET, BETTER_AUTH_URL, 4 optional OAuth vars, RESEND_API_KEY, RESEND_FROM_EMAIL)
- Created Resend email service wrapper and central Better Auth instance ready for all Phase 22 plans to import

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and add env vars** - `8d37ec5` (feat)
2. **Task 2: Create email service and Better Auth instance** - `2f1c381` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `server/src/auth.ts` - Central Better Auth instance: Drizzle adapter, email/password auth, email verification, password reset, optional Google+GitHub OAuth, type exports
- `server/src/services/email.ts` - Resend SDK wrapper (`export const resend = new Resend(env.RESEND_API_KEY)`)
- `server/src/config/env.ts` - Added 8 auth-related env var validations to EnvSchema
- `.env.example` - Added authentication section with all 8 new env vars documented
- `package.json` - better-auth@1.4.18 and resend@6.9.2 added to dependencies
- `package-lock.json` - Lock file updated (21 new packages)

## Decisions Made
- RESEND_API_KEY accepts any non-empty string (not `re_` prefix) to allow test env placeholders — Resend only rejects invalid keys at API call time, not at SDK initialization
- Non-async email callbacks: removed `async` keyword from `sendResetPassword` and `sendVerificationEmail` to satisfy `@typescript-eslint/require-await`; callbacks now use `void resend.emails.send(...)` + `return Promise.resolve()` to maintain fire-and-forget semantics while satisfying Better Auth's `Promise<void>` return type
- Both `usePlural: true` AND explicit `user: schema.users` mapping in drizzleAdapter for belt-and-suspenders safety against Better Auth's singular-vs-plural internal naming mismatch (Pitfall 3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed async from email callbacks to fix ESLint require-await error**
- **Found during:** Task 2 (create email service and Better Auth instance) — pre-commit hook failure
- **Issue:** The plan specified `async ({ user, url }) => { void resend.emails.send(...); }` callbacks. ESLint `@typescript-eslint/require-await` rejects async functions with no await expression.
- **Fix:** Removed `async` keyword from both `sendResetPassword` and `sendVerificationEmail` callbacks. Added `return Promise.resolve()` to satisfy Better Auth's `(data, request?) => Promise<void>` type signature. Fire-and-forget semantics preserved via `void`.
- **Files modified:** server/src/auth.ts
- **Verification:** `npx eslint server/src/auth.ts` exits 0; `npx tsc --project server/tsconfig.json --noEmit` exits 0
- **Committed in:** 2f1c381 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's suggested code pattern)
**Impact on plan:** Fix is a code-pattern refinement only. Functional behavior is identical — emails fire without blocking Better Auth's callback resolution. No scope creep.

## Issues Encountered
- None beyond the ESLint auto-fix above.

## User Setup Required

External services require manual configuration before Phase 22 plans 03-06 can be tested end-to-end:

**Resend (required for email verification and password reset):**
- Create account at https://resend.com
- Generate API key: Resend Dashboard -> API Keys -> Create API Key
- Add `RESEND_API_KEY=re_...` to `.env`
- Set `RESEND_FROM_EMAIL=SecureShare <noreply@yourdomain.com>` (or use `onboarding@resend.dev` for dev testing)
- Verify sending domain OR use Resend's test address

**Google OAuth (optional — skip to disable Google sign-in):**
- Google Cloud Console -> APIs & Services -> Credentials -> Create OAuth 2.0 Client ID
- Add Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
- Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`

**GitHub OAuth (optional — skip to disable GitHub sign-in):**
- GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
- Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`

**Required env vars in `.env`** (minimum for email auth to work):
```
BETTER_AUTH_SECRET=<32+ character random string>
BETTER_AUTH_URL=http://localhost:3000
RESEND_API_KEY=re_your_key
RESEND_FROM_EMAIL=SecureShare <noreply@yourdomain.com>
```

## Next Phase Readiness
- auth.ts is ready to be imported by Plan 02 (Express handler mounting and session middleware)
- Plan 02 imports: `import { auth } from './auth.js'` and `import { toNodeHandler } from 'better-auth/node'`
- TypeScript compiles cleanly; no blocking issues

---
*Phase: 22-authentication*
*Completed: 2026-02-19*

## Self-Check: PASSED

- FOUND: server/src/auth.ts
- FOUND: server/src/services/email.ts
- FOUND: .planning/phases/22-authentication/22-01-SUMMARY.md
- FOUND commit: 8d37ec5 (Task 1)
- FOUND commit: 2f1c381 (Task 2)
