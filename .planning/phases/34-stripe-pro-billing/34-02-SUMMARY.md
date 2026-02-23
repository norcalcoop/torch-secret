---
phase: 34-stripe-pro-billing
plan: 02
subsystem: payments
tags: [stripe, express, typescript, webhooks, billing]

# Dependency graph
requires:
  - phase: 34-stripe-pro-billing
    provides: billing.service.ts (getOrCreateStripeCustomer/activatePro/deactivatePro), Stripe SDK singleton, INVARIANTS.md Stripe row, DB columns

provides:
  - POST /api/billing/checkout — creates Stripe Checkout session, returns { url }
  - GET /api/billing/verify-checkout — verifies completed session with customer spoofing guard
  - POST /api/billing/portal — creates Customer Portal session, returns { url }
  - POST /api/webhooks/stripe — handles checkout.session.completed and customer.subscription.deleted with HMAC verification
  - Webhook route mounted with express.raw() BEFORE express.json() in app.ts
  - GET /api/me returns subscriptionTier ('free' | 'pro') via DB lookup

affects:
  - 34-03 (frontend billing UI — calls these endpoints)
  - 34-04 (Customer Portal UI — POST /api/billing/portal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Express webhook ordering pattern — express.raw() on single route before express.json() globally; prevents silent HMAC verification failure
    - POST /api/billing/checkout (not GET) — state-creating Stripe session is a POST per REST convention and plan must_haves spec
    - me.ts async DB pattern — subscriptionTier not on Better Auth AuthUser; requires db.select() on every /api/me call
    - Checkout spoofing guard — verify session.customer matches dbUser.stripeCustomerId before returning pro status

key-files:
  created:
    - server/src/routes/billing.ts
    - server/src/routes/webhooks.ts
  modified:
    - server/src/app.ts
    - server/src/routes/me.ts

key-decisions:
  - "POST /api/billing/checkout (not GET): must_haves spec says POST; Checkout session creation is state-mutating (creates Stripe object), so POST is correct per REST semantics"
  - "eslint-disable-next-line for stripeWebhookHandler in app.ts: async handler passed as express middleware requires suppressing @typescript-eslint/no-misused-promises — consistent with Better Auth handler pattern in same file"
  - "subscriptionTier fetched per-request in me.ts (DB lookup on each call): Better Auth session does not include custom columns; DB read is the correct source of truth for current tier"
  - "Checkout spoofing guard only checks when dbUser.stripeCustomerId exists: new customers won't have a stored ID yet (getOrCreateStripeCustomer runs in /checkout handler before session creation)"

patterns-established:
  - "Stripe webhook ordering invariant: app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), stripeWebhookHandler) — mounted between Better Auth handler and express.json()"
  - "Billing route pattern: all three billing routes use requireAuth; portal checks stripeCustomerId existence before calling Stripe API"

requirements-completed: [BILL-01, BILL-02, BILL-04, BILL-05]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 34 Plan 02: Stripe Billing Routes Summary

**Four Stripe billing endpoints (Checkout, verify-checkout, portal, webhook) and subscriptionTier in GET /api/me — webhook mounted with express.raw() before express.json() to preserve HMAC signature verification**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-23T14:06:00Z
- **Completed:** 2026-02-23T14:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `server/src/routes/billing.ts` implements three authenticated endpoints: POST /api/billing/checkout (creates Stripe Checkout session), GET /api/billing/verify-checkout (verifies completed session with customer spoofing guard), POST /api/billing/portal (creates Customer Portal session)
- `server/src/routes/webhooks.ts` implements `stripeWebhookHandler` — handles `checkout.session.completed` (activatePro) and `customer.subscription.deleted` (deactivatePro) with HMAC-SHA256 signature verification via `stripe.webhooks.constructEvent()`
- `app.ts` mounts webhook handler with `express.raw()` BEFORE `express.json()` — the critical ordering invariant that prevents silent signature verification failure; billing router mounted at `/api/billing`
- `me.ts` updated to async with DB lookup: `subscriptionTier` is not on Better Auth's `AuthUser` type, so a `db.select()` fetches the current tier on every `/api/me` call

## Task Commits

Each task was committed atomically:

1. **Task 1: Create billing router (checkout, verify-checkout, portal)** - `c97bc42` (feat)
2. **Task 2: Create webhook handler + mount in app.ts + extend me.ts** - `e12db75` (feat)

## Files Created/Modified

- `server/src/routes/billing.ts` - New: billingRouter with POST /checkout, GET /verify-checkout, POST /portal; all require auth
- `server/src/routes/webhooks.ts` - New: stripeWebhookHandler; handles checkout.session.completed and customer.subscription.deleted; ZK-safe (stripe_customer_id only)
- `server/src/app.ts` - Added: stripeWebhookHandler + billingRouter imports; webhook mounted before express.json(); billing router mounted after /api/dashboard
- `server/src/routes/me.ts` - Updated: async handler with DB lookup; subscriptionTier added to response

## Decisions Made

- **POST /api/billing/checkout (not GET):** The plan's `must_haves.truths` specifies POST; the code sample showed GET. POST is correct — Checkout session creation is state-mutating (creates a Stripe object). Implemented as POST per the authoritative spec.
- **Checkout spoofing guard conditional:** The customer ID comparison (`session.customer !== dbUser.stripeCustomerId`) is gated on `dbUser?.stripeCustomerId` being present. New users won't have one stored yet at verify-checkout time (the `/checkout` handler calls `getOrCreateStripeCustomer` which saves it, but the Stripe webhook may race). Safe fallback: no mismatch check if no stored customer ID yet.
- **subscriptionTier per-request DB lookup:** Better Auth's `AuthUser` type doesn't include custom Drizzle schema columns. The session user is the session-time snapshot; subscriptionTier can change via webhook after session creation. DB is the correct source of truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed /checkout from GET to POST**
- **Found during:** Task 1 (billing router creation)
- **Issue:** Plan code sample used `billingRouter.get('/checkout', ...)` but `must_haves.truths` specifies "POST /api/billing/checkout". GET is incorrect for a state-creating operation (Stripe Checkout session creation).
- **Fix:** Implemented as `billingRouter.post('/checkout', ...)` per the authoritative must_haves spec.
- **Files modified:** server/src/routes/billing.ts
- **Verification:** TypeScript compiles clean; behavior matches must_haves truth.
- **Committed in:** c97bc42 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug: GET vs POST method mismatch between code sample and spec)
**Impact on plan:** Corrects a method inconsistency in the plan — POST is semantically correct for session creation and matches the must_haves spec. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no new external service configuration required beyond what Plan 01 documented.

The billing endpoints will function once the Stripe env vars from Plan 01 are populated with real values (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`).

## Next Phase Readiness

- All four server-side Stripe billing endpoints are live (BILL-01, BILL-02, BILL-04, BILL-05)
- Webhook handler correctly mounted with express.raw() before express.json() — ordering invariant verified
- `GET /api/me` returns `subscriptionTier` — frontend can gate Pro UI on this field
- Plan 03 (frontend billing UI) can call POST /api/billing/checkout and GET /api/billing/verify-checkout
- Plan 04 (Customer Portal UI) can call POST /api/billing/portal

---
*Phase: 34-stripe-pro-billing*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: server/src/routes/billing.ts
- FOUND: server/src/routes/webhooks.ts
- FOUND: server/src/app.ts (modified)
- FOUND: server/src/routes/me.ts (modified)
- FOUND: .planning/phases/34-stripe-pro-billing/34-02-SUMMARY.md
- FOUND commit: c97bc42 (Task 1)
- FOUND commit: e12db75 (Task 2)
