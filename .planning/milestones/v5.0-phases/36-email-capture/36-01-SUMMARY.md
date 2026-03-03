---
phase: 36-email-capture
plan: 01
subsystem: database
tags: [drizzle, postgres, gdpr, resend, vitest, email-capture]

requires:
  - phase: 34-billing
    provides: "env.ts pattern with Zod schema extensions; Stripe env vars committed"

provides:
  - "marketing_subscribers Drizzle table with full GDPR column set (email, status, consent tokens, ip_hash)"
  - "RESEND_AUDIENCE_ID and IP_HASH_SALT env vars in EnvSchema"
  - "Migration 0005 applied — marketing_subscribers table in PostgreSQL"
  - "subscribers.test.ts scaffold with 16 RED integration tests (ECAP-01 through ECAP-05)"
  - "INVARIANTS.md Phase 36 row documenting email capture ZK compliance"

affects: [36-02-subscribers-api, 36-03-confirmation-flow, 36-04-frontend-widget]

tech-stack:
  added: []
  patterns:
    - "vi.mocked() helper pattern for testing mocked object properties (avoids @typescript-eslint/unbound-method)"
    - "emailSend()/contactsCreate() getter functions that call vi.mocked() on mock properties"
    - "@typescript-eslint/unbound-method: off added to test file config"

key-files:
  created:
    - "drizzle/0005_add_marketing_subscribers.sql"
    - "drizzle/meta/0005_snapshot.json"
    - "server/src/routes/__tests__/subscribers.test.ts"
  modified:
    - ".planning/INVARIANTS.md"
    - "server/src/db/schema.ts"
    - "server/src/config/env.ts"
    - ".env.example"
    - ".github/workflows/ci.yml"
    - "eslint.config.ts"

key-decisions:
  - "marketing_subscribers has NO FK to users or secrets — standalone GDPR table, invariant enforced at schema level"
  - "vi.mocked() wrapper functions (emailSend()/contactsCreate()) used instead of direct mock references to satisfy @typescript-eslint/unbound-method"
  - "@typescript-eslint/unbound-method: off added globally for test files — vi.mocked() objects are not real class instances, this-binding concern does not apply"
  - "Stripe env vars (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/STRIPE_PRO_PRICE_ID) backfilled into ci.yml alongside Phase 36 vars — pre-existing gap fixed as Rule 2 (missing critical)"

patterns-established:
  - "Test mock pattern: vi.fn() inline in vi.mock() factory; getter functions () => vi.mocked(obj.method) for assertions"
  - "INVARIANTS.md updated BEFORE schema/code — required per CLAUDE.md mandate"

requirements-completed: [ECAP-05, ECAP-01, ECAP-02, ECAP-03, ECAP-04]

duration: 7min
completed: 2026-02-26
---

# Phase 36 Plan 01: Email Capture Foundation Summary

**GDPR-compliant marketing_subscribers Drizzle table (no userId/secretId FKs) with migration 0005 applied, RESEND_AUDIENCE_ID + IP_HASH_SALT env vars, and 16 RED integration tests covering all ECAP requirements**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-26T19:21:39Z
- **Completed:** 2026-02-26T19:28:12Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- INVARIANTS.md updated with Phase 36 row before any code was written (per CLAUDE.md mandate)
- `marketingSubscribers` Drizzle table defined with all GDPR columns: email, status, confirmationToken, tokenExpiresAt, unsubscribeToken, consentText, consentAt, ipHash, timestamps — no userId or secretId columns (ZK invariant enforced)
- Migration 0005 generated and applied; `marketing_subscribers` table confirmed in PostgreSQL with correct schema
- 16 integration tests created in RED state covering ECAP-01 (subscribe), ECAP-02 (consent enforcement), ECAP-03 (confirmation email + confirm flow), ECAP-04 (unsubscribe idempotent), ECAP-05 (GDPR storage)
- RESEND_AUDIENCE_ID and IP_HASH_SALT env vars added to EnvSchema, .env.example, and CI workflow

## Task Commits

1. **Task 1: INVARIANTS.md + marketingSubscribers schema + env vars** - `3344247` (feat)
2. **Task 2: Migration 0005 + subscribers.test.ts scaffold** - `105db4f` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `.planning/INVARIANTS.md` - Added Phase 36 row for marketing_subscribers; updated Last updated to Phase 36
- `server/src/db/schema.ts` - Added marketingSubscribers pgTable export + MarketingSubscriber/NewMarketingSubscriber types; updated ZK comment block
- `server/src/config/env.ts` - Added RESEND_AUDIENCE_ID and IP_HASH_SALT to EnvSchema
- `.env.example` - Added Email Capture section with placeholder values
- `.github/workflows/ci.yml` - Added Stripe + Phase 36 env vars to test and e2e jobs
- `drizzle/0005_add_marketing_subscribers.sql` - CREATE TABLE migration (no FK constraints, Drizzle bug #4147 N/A)
- `drizzle/meta/_journal.json` - Updated tag from 0005_supreme_dazzler to 0005_add_marketing_subscribers
- `drizzle/meta/0005_snapshot.json` - Generated schema snapshot
- `server/src/routes/__tests__/subscribers.test.ts` - 16 RED tests (ECAP-01 through ECAP-05)
- `eslint.config.ts` - Added @typescript-eslint/unbound-method: off for test files

## Decisions Made

- `marketing_subscribers` has no FK to `users` or `secrets` — it's a standalone GDPR record. This was the primary invariant requirement, enforced at the schema definition level.
- vi.mocked() wrapper functions (`emailSend()` / `contactsCreate()`) used for mock assertions instead of direct property access — satisfies `@typescript-eslint/unbound-method` without inline eslint-disable comments.
- `@typescript-eslint/unbound-method: off` added to test file config globally — appropriate because vi.mocked() objects are not real class instances; this-binding concern is semantically inapplicable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Backfilled Stripe env vars into CI workflow**
- **Found during:** Task 1 (env.ts additions)
- **Issue:** CI `test` and `e2e` jobs had no STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID — pre-existing gap that would cause CI failures since env.ts requires these vars
- **Fix:** Added placeholder Stripe vars alongside Phase 36 vars to both CI jobs
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** All required vars now present in both test and e2e jobs
- **Committed in:** `3344247` (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed ESLint unbound-method errors in subscribers.test.ts**
- **Found during:** Task 2 (commit attempt)
- **Issue:** `expect(resend.emails.send).toHaveBeenCalledOnce()` triggers `@typescript-eslint/unbound-method` — method property access from mock object
- **Fix:** Added `@typescript-eslint/unbound-method: off` to test file ESLint config; used `() => vi.mocked(resend.emails.send)` getter pattern
- **Files modified:** `eslint.config.ts`, `server/src/routes/__tests__/subscribers.test.ts`
- **Verification:** ESLint passes clean; all 16 tests run (fail with 404 as expected)
- **Committed in:** `105db4f` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for CI correctness and ESLint compliance. No scope creep.

## Issues Encountered

- `vi.mock()` factory hoisting: initially defined `mockEmailSend = vi.fn()` as outer variables and referenced them in the factory — fails because `vi.mock()` is hoisted above variable initializations. Fixed by using `vi.fn()` inline in the factory and `vi.mocked()` accessor pattern in tests.

## User Setup Required

None — no external service configuration required for this foundation plan. Plan 02 will implement the actual routes.

## Next Phase Readiness

- Plan 02 (subscribers API): `marketing_subscribers` table exists in DB; 16 RED tests define exact API contract; env vars in place for RESEND_AUDIENCE_ID and IP_HASH_SALT
- All ECAP requirement test cases are present and failing with 404 — Plan 02 implements routes to turn them GREEN
- ESLint config updated to allow vi.mocked() patterns — no further config changes needed for future subscriber tests

## Self-Check: PASSED

All files exist and contain expected content:
- .planning/INVARIANTS.md: Phase 36 row present
- server/src/db/schema.ts: marketingSubscribers export present
- server/src/config/env.ts: RESEND_AUDIENCE_ID and IP_HASH_SALT present
- drizzle/0005_add_marketing_subscribers.sql: marketing_subscribers table present
- server/src/routes/__tests__/subscribers.test.ts: vi.mock pattern present

Commits verified: 3344247 (Task 1), 105db4f (Task 2)

---
*Phase: 36-email-capture*
*Completed: 2026-02-26*
