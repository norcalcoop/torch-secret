---
phase: 37-email-onboarding-sequence
plan: 01
subsystem: auth
tags: [better-auth, loops, drizzle, marketing-consent, registration, gdpr]

# Dependency graph
requires:
  - phase: 36-email-capture
    provides: marketing_subscribers table pattern; GDPR consent infrastructure; Resend email setup
  - phase: 22-better-auth
    provides: Better Auth setup; user.additionalFields pattern; registration flow
provides:
  - users.marketing_consent boolean column with migration 0006
  - Better Auth additionalFields.marketingConsent with input:true for client-side signUp.email()
  - #marketing-consent checkbox on register form (unchecked by default, ESEQ-04)
  - LOOPS_API_KEY env var in Zod schema and CI placeholder
  - RED test scaffolds: onboarding.service.test.ts (6 cases) and billing.service.test.ts (1 case)
  - GREEN register.test.ts (3 cases verifying checkbox structure)
affects:
  - 37-02 (Plan 02 creates onboarding.service.ts to turn RED tests GREEN)
  - 37-02 (Plan 02 extends activatePro() with Loops contact update)

# Tech tracking
tech-stack:
  added: [loops (LOOPS_API_KEY placeholder — SDK not yet installed; Plan 02 installs it)]
  patterns:
    - Better Auth additionalFields with input:true for custom fields passed at signUp
    - RED test scaffolds: write tests against future modules before the module exists
    - vi.hoisted + vi.mock pattern for singleton mocks (established in Phase 36, extended here)

key-files:
  created:
    - drizzle/0006_add_marketing_consent.sql
    - drizzle/meta/0006_snapshot.json
    - server/src/services/onboarding.service.test.ts
    - server/src/services/billing.service.test.ts
    - client/src/pages/register.test.ts
  modified:
    - server/src/db/schema.ts
    - server/src/auth.ts
    - server/src/config/env.ts
    - client/src/pages/register.ts
    - .github/workflows/ci.yml
    - drizzle/meta/_journal.json

key-decisions:
  - "Better Auth additionalFields with input:true passes marketingConsent from client signUp.email() call directly into the users table column without custom middleware"
  - "Migration renamed from drizzle-kit auto-name (0006_deep_joystick.sql) to 0006_add_marketing_consent.sql for consistency with project naming convention"
  - "LOOPS_API_KEY added as required (not optional) env var — Plan 02 will use it unconditionally in the onboarding hook"

patterns-established:
  - "RED scaffold pattern: test file imports from non-existent module — module error is intentional and documented"
  - "Better Auth additionalFields: type, required, defaultValue, input fields follow exact Better Auth API for custom user columns"

requirements-completed: [ESEQ-04]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 37 Plan 01: Email Onboarding Sequence — Marketing Consent Infrastructure Summary

**Marketing consent boolean column on users table via migration 0006, Better Auth additionalFields, registration form checkbox (unchecked by default), and RED test scaffolds for Plan 02's Loops onboarding service**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-27T00:44:44Z
- **Completed:** 2026-02-27T00:49:37Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Migration 0006 applied: `users.marketing_consent boolean NOT NULL DEFAULT false` live in PostgreSQL
- Better Auth `user.additionalFields.marketingConsent` with `input: true` — client `signUp.email()` can now pass consent value directly into the users table
- Register form has `#marketing-consent` checkbox (unchecked by default, label "Send me product tips and updates") inserted before consentLine, with `setFormLoading()` extended to disable it during submission
- LOOPS_API_KEY added to env.ts Zod schema and CI test job env block (placeholder value) — prevents CI failure when Plan 02 activates the loops config singleton
- RED test scaffolds: 6 cases for `enrollInOnboardingSequence` + 1 case for `activatePro` Loops sync — turn GREEN when Plan 02 creates the onboarding service and extends billing service
- 321 pre-existing tests continue to pass (3 additional from new register.test.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema column + migration + env var + Better Auth additionalFields** - `97c9e10` (feat)
2. **Task 2: Register form checkbox + RED test scaffolds** - `50739cd` (feat)

## Files Created/Modified

- `server/src/db/schema.ts` - Added `marketingConsent` boolean column; updated ZK invariant comment with Loops onboarding row
- `drizzle/0006_add_marketing_consent.sql` - Migration: `ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL`
- `drizzle/meta/_journal.json` - Updated journal tag from auto-generated name to `0006_add_marketing_consent`
- `drizzle/meta/0006_snapshot.json` - Drizzle schema snapshot for migration 0006
- `server/src/auth.ts` - Added `user.additionalFields.marketingConsent` with `input: true` to Better Auth config
- `server/src/config/env.ts` - Added `LOOPS_API_KEY: z.string().min(1)` under Phase 37 block
- `client/src/pages/register.ts` - Added `#marketing-consent` checkbox before consentLine; updated `signUp.email()` call; extended `setFormLoading()` signature
- `client/src/pages/register.test.ts` - 3 GREEN tests verifying checkbox existence, unchecked default, label text
- `server/src/services/onboarding.service.test.ts` - 6 RED tests for `enrollInOnboardingSequence` (Plan 02 creates the module)
- `server/src/services/billing.service.test.ts` - 1 RED test for `activatePro` Loops contact update (Plan 02 extends billing service)
- `.github/workflows/ci.yml` - Added `LOOPS_API_KEY: loops_placeholder` to test job env block

## Decisions Made

- **Better Auth additionalFields vs. custom middleware:** Used Better Auth's built-in `user.additionalFields` with `input: true` — this is the canonical way to pass custom fields through `signUp.email()` without custom endpoints or middleware.
- **Migration rename:** Drizzle-kit auto-generated `0006_deep_joystick.sql`; renamed to `0006_add_marketing_consent.sql` (consistent with project convention — previous migrations follow descriptive naming). Journal entry updated accordingly.
- **LOOPS_API_KEY required not optional:** Added as `z.string().min(1)` (required). Plan 02 uses it unconditionally; making it optional would create a false sense that the feature can be disabled at runtime.

## Deviations from Plan

None - plan executed exactly as written. Migration was renamed from auto-generated name to canonical name per convention (not a deviation — plan specified the rename explicitly).

## Issues Encountered

None — all steps proceeded cleanly. `db:generate` produced a single-statement migration (no Drizzle bug #4147 concern since this column has no FK constraint).

## User Setup Required

**External service requires manual configuration before Plan 02 can activate the Loops onboarding sequence.**

See `user_setup` block in 37-01-PLAN.md:
- **LOOPS_API_KEY** — Obtain from: Loops Dashboard -> Settings -> API
- Note: The API key is shown only once at creation time
- Add to `.env` as `LOOPS_API_KEY=<your-real-key>`

CI uses `LOOPS_API_KEY: loops_placeholder` (sufficient since the loops SDK is not yet invoked — Plan 02 activates it).

## Next Phase Readiness

- Plan 02 can read `user.marketingConsent` from the Better Auth session user object (it flows through `additionalFields`)
- 6 RED onboarding service tests and 1 RED billing test define exact acceptance criteria for Plan 02
- LOOPS_API_KEY env var infrastructure in place — Plan 02 installs the `loops` npm package and creates `server/src/config/loops.ts` singleton

## Self-Check: PASSED

All files verified present on disk. All commits verified in git history.

| Item | Status |
|------|--------|
| drizzle/0006_add_marketing_consent.sql | FOUND |
| server/src/db/schema.ts | FOUND |
| server/src/auth.ts | FOUND |
| server/src/config/env.ts | FOUND |
| client/src/pages/register.ts | FOUND |
| server/src/services/onboarding.service.test.ts | FOUND |
| server/src/services/billing.service.test.ts | FOUND |
| client/src/pages/register.test.ts | FOUND |
| commit 97c9e10 | FOUND |
| commit 50739cd | FOUND |

---
*Phase: 37-email-onboarding-sequence*
*Completed: 2026-02-27*
