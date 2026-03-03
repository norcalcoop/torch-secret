---
phase: 34-stripe-pro-billing
plan: 01
subsystem: payments
tags: [stripe, postgresql, drizzle, zod, typescript]

# Dependency graph
requires:
  - phase: 34-stripe-pro-billing
    provides: Phase 34 planning context and ROADMAP targets

provides:
  - INVARIANTS.md updated with Stripe billing enforcement row (BILL-06 pre-condition)
  - users table: stripe_customer_id (text, nullable) and subscription_tier (pgEnum free|pro, default free)
  - Migration 0004_add_stripe_columns.sql applied to PostgreSQL
  - Stripe SDK singleton (server/src/config/stripe.ts)
  - billing.service.ts: getOrCreateStripeCustomer, activatePro, deactivatePro (ZK-safe)
  - Three Stripe env vars in Zod schema: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID

affects:
  - 34-02 (webhook handler — depends on billing.service.ts and INVARIANTS.md row)
  - 34-03 (Checkout session route — uses getOrCreateStripeCustomer)
  - 34-04 (Customer Portal route — uses billing.service.ts)

# Tech tracking
tech-stack:
  added: [stripe@^20.3.1]
  patterns:
    - ZK-safe billing lookup — activatePro/deactivatePro receive stripe_customer_id only, never userId; webhook handler never has both userId and secretId in scope
    - Stripe SDK singleton pattern — one Stripe() instance in config/stripe.ts, imported everywhere else
    - pgEnum for subscription tiers — type-safe at DB and TypeScript layers

key-files:
  created:
    - server/src/config/stripe.ts
    - server/src/services/billing.service.ts
    - drizzle/0004_add_stripe_columns.sql
    - drizzle/meta/0004_snapshot.json
  modified:
    - .planning/INVARIANTS.md
    - server/src/db/schema.ts
    - server/src/config/env.ts
    - .env.example
    - package.json

key-decisions:
  - "billing.service.ts activatePro/deactivatePro take stripe_customer_id string, not userId — preserves ZK invariant; webhook handler only has customerId in scope, never userId+secretId together"
  - "subscriptionTierEnum exported from schema.ts so drizzle-kit can detect it as a separate DB type (pgEnum must be at module scope)"
  - "Migration file renamed from drizzle-kit auto-name to 0004_add_stripe_columns.sql for clarity; _journal.json updated to match"
  - "Stripe env vars added as required (not optional) in Zod schema — server must not start without valid Stripe config"
  - ".env placeholder values (sk_test_placeholder_...) added so local dev validates Zod schema format without real keys"

patterns-established:
  - "Stripe singleton pattern: import { stripe } from '../config/stripe.js' — never new Stripe() in service files"
  - "ZK billing pattern: webhook fires activatePro(stripeCustomerId) — no userId ever passed into activation functions"

requirements-completed: [BILL-06, BILL-01, BILL-02]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 34 Plan 01: Stripe Billing Foundation Summary

**Stripe billing foundation: subscriptionTierEnum + stripe_customer_id DB columns, migration 0004 applied, stripe SDK singleton, ZK-safe billing.service.ts (getOrCreateStripeCustomer/activatePro/deactivatePro), and INVARIANTS.md updated before any webhook handler code**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-23T14:00:12Z
- **Completed:** 2026-02-23T14:02:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- INVARIANTS.md updated with Stripe billing enforcement row (8th row) and last-updated bumped to Phase 34 — BILL-06 pre-condition satisfied before any webhook code is written
- users table extended with nullable `stripe_customer_id` text column and non-null `subscription_tier` enum column (default: 'free'), migration 0004 applied successfully
- billing.service.ts implements three ZK-safe functions: `getOrCreateStripeCustomer` links userId+customerId (no secretId involved), `activatePro`/`deactivatePro` look up users by stripeCustomerId only

## Task Commits

Each task was committed atomically:

1. **Task 1: Update INVARIANTS.md with Stripe billing row + update schema.ts ZK comment** - `b760c61` (feat)
2. **Task 2: DB schema columns + env vars + Stripe singleton + billing service** - `fb96c18` (feat)

## Files Created/Modified

- `.planning/INVARIANTS.md` - Added Stripe billing enforcement row (8th); bumped last-updated to Phase 34
- `server/src/db/schema.ts` - Added pgEnum import, subscriptionTierEnum export, stripeCustomerId + subscriptionTier columns to users table; added 8th point to ZK block comment
- `server/src/config/env.ts` - Added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID Zod validators
- `server/src/config/stripe.ts` - New: Stripe SDK singleton exported as `stripe`
- `server/src/services/billing.service.ts` - New: getOrCreateStripeCustomer, activatePro, deactivatePro
- `drizzle/0004_add_stripe_columns.sql` - New: CREATE TYPE subscription_tier + ALTER TABLE ADD COLUMNs
- `drizzle/meta/_journal.json` - Added idx 4 entry for 0004_add_stripe_columns
- `drizzle/meta/0004_snapshot.json` - New: drizzle-kit schema snapshot
- `.env.example` - Added Stripe billing section with three env vars
- `package.json` / `package-lock.json` - stripe@^20.3.1 dependency added

## Decisions Made

- **billing.service.ts ZK pattern:** `activatePro` and `deactivatePro` receive only `stripeCustomerId` — the webhook handler never passes `userId` into activation functions. This structurally enforces the zero-knowledge invariant at the service boundary.
- **pgEnum at module scope:** `subscriptionTierEnum` exported before the `users` table definition so drizzle-kit detects it as a separate `CREATE TYPE` statement in migrations.
- **Migration rename:** drizzle-kit auto-generated `0004_loving_the_liberteens.sql`; renamed to `0004_add_stripe_columns.sql` and updated `_journal.json` tag to match.
- **Required env vars (not optional):** All three Stripe vars are required in Zod schema — server must not start without them. Placeholder values added to `.env` for local dev that satisfy `startsWith('sk_')` / `startsWith('whsec_')` / `startsWith('price_')` format validation.

## Deviations from Plan

None - plan executed exactly as written. The `.env` placeholder values addition was complementary to the `.env.example` update (dev ergonomics, not a scope change).

## Issues Encountered

- drizzle-kit auto-generated migration filename `0004_loving_the_liberteens.sql` — renamed to canonical `0004_add_stripe_columns.sql` per plan spec. The `_journal.json` tag entry was updated to match. No functional impact.

## User Setup Required

**External services require manual configuration before running the server with real Stripe traffic.**

The following Stripe environment variables must be replaced in `.env` with real values:

| Variable | Source |
|----------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard > Developers > API keys > Secret key (`sk_test_...` for local dev) |
| `STRIPE_WEBHOOK_SECRET` | Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`; CLI prints `whsec_...` on startup |
| `STRIPE_PRO_PRICE_ID` | Stripe Dashboard > Products > Create product (Torch Secret Pro, $9/month recurring) > copy price ID |

**Dashboard configuration:**
- Stripe Dashboard > Settings > Billing > Customer portal — enable "Cancel subscription" so portal sessions can be created (required for Plan 04)

## Next Phase Readiness

- BILL-06 satisfied: INVARIANTS.md has Stripe billing row before any webhook handler code
- billing.service.ts exports `activatePro`, `deactivatePro`, `getOrCreateStripeCustomer` — ready for Plan 02 (webhook handler) and Plan 03 (Checkout session route)
- TypeScript compiles clean across server (`tsc --noEmit` exits 0)
- Migration applied; DB columns live

---
*Phase: 34-stripe-pro-billing*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: server/src/config/stripe.ts
- FOUND: server/src/services/billing.service.ts
- FOUND: drizzle/0004_add_stripe_columns.sql
- FOUND: .planning/phases/34-stripe-pro-billing/34-01-SUMMARY.md
- FOUND commit: b760c61 (Task 1)
- FOUND commit: fb96c18 (Task 2)
