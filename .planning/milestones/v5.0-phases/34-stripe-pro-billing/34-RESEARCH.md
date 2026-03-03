# Phase 34: Stripe Pro Billing - Research

**Researched:** 2026-02-23
**Domain:** Stripe Checkout, webhooks, Customer Portal, DB schema migration, frontend Pro gating
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Upgrade CTA placement**
- Primary upgrade CTA lives on the dashboard AND inside the expiration dropdown (point-of-friction placement)
- The 30-day option in the expiration dropdown is greyed out for free users with a lock icon and tooltip: "Upgrade to Pro to unlock"
- Clicking any upgrade CTA redirects directly to Stripe Checkout — no intermediate pricing page or modal
- Dashboard CTA visual treatment is Claude's discretion (copy, layout, visual weight)

**Post-checkout experience**
- Stripe `success_url` returns to `/dashboard?upgraded=true`
- On page load with `upgraded=true`, the server calls Stripe directly (`GET /v1/checkout/sessions/:id`) to verify the session completed — does NOT rely on webhook timing
- While verifying, show a brief spinner; on success, show a banner: "You're now Pro — 30-day secrets unlocked"
- Stripe `cancel_url` returns to `/dashboard?checkout=cancelled` with a subtle toast: "Checkout cancelled — you can upgrade anytime"

**Pro status communication**
- Pro badge is shown on the dashboard only, near the user name/settings area
- For Pro users: 30-day expiration option is unlocked, Pro badge is shown, upgrade CTAs/banners are replaced by the Manage Subscription link
- Downgrade behavior: existing secrets created with 30-day expiration are grandfathered (unaffected); the 30-day option disappears from the dropdown for new secrets

**Subscription management**
- "Manage Subscription" link appears on the dashboard near the Pro badge (visible to Pro users only)
- Clicking it opens the Stripe Customer Portal in a new tab

**Webhooks**
- Handle only the core lifecycle: `checkout.session.completed` (activate Pro) and `customer.subscription.deleted` (deactivate Pro)
- `invoice.payment_failed` and `customer.subscription.updated` are out of scope for this phase

**Stripe data storage**
- `stripe_customer_id` stored as a nullable column on the `users` table
- `subscription_tier` (enum: 'free' | 'pro') stored on the `users` table
- INVARIANTS.md must have a Stripe/billing row added before any webhook handler code is written (per success criterion #5)

### Claude's Discretion
- Exact dashboard CTA copy, visual treatment, and layout
- Loading spinner implementation details
- Banner/toast visual styling (consistent with existing design system)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-01 | Authenticated user can initiate Stripe Checkout to subscribe to Pro tier | Stripe Checkout session creation API, customer creation pattern, redirect flow |
| BILL-02 | Subscription status is updated via Stripe webhook events (`checkout.session.completed`, `customer.subscription.deleted`) | Webhook signature verification with `express.raw()`, event handler patterns; note: CONTEXT.md scopes to only these two events |
| BILL-03 | Pro subscriber can select 30-day expiration when creating secrets | `createExpirationSelect()` component upgrade: add '30d' option for Pro users, greyed-out locked option for free users |
| BILL-04 | Authenticated user can access Stripe Customer Portal to manage or cancel subscription | `stripe.billingPortal.sessions.create()` server route, redirect to `session.url` in new tab |
| BILL-05 | Success page verifies subscription status via direct Stripe API query on `?session_id=` param | `{CHECKOUT_SESSION_ID}` in `success_url`, server endpoint retrieves session and checks `session.status === 'complete'` |
| BILL-06 | INVARIANTS.md extended with Stripe billing row before any webhook handler code is written | Must add table row to `.planning/INVARIANTS.md` and update schema.ts comment block as first task |
</phase_requirements>

---

## Summary

Phase 34 introduces Stripe-based subscription billing. The implementation has three primary areas: (1) a DB schema migration adding `stripe_customer_id` (nullable text) and `subscription_tier` (enum 'free'|'pro') to the `users` table; (2) four new server-side routes — Stripe Checkout session creation, post-checkout session verification, Customer Portal session creation, and the Stripe webhook handler; (3) frontend changes to the dashboard and expiration select that gate the 30-day option behind Pro status.

The most critical architectural constraint — confirmed by the STATE.md accumulated context — is that the Stripe webhook route **must be mounted before `express.json()` in `app.ts`**. This is because Stripe's signature verification requires the raw request body; once Express parses it to JSON, the stream is consumed and all signature checks fail with "No signatures found matching the expected signature". The existing `app.ts` already mounts Better Auth before `express.json()` for the same reason, so this is a well-understood pattern in this codebase.

The second critical constraint from STATE.md: do NOT use `@better-auth/stripe` — it has 4 open bugs as of Feb 2026 that break subscription lifecycle. Use the raw `stripe` SDK with a hand-written handler. The current Stripe Node SDK version is `20.3.1` (verified via `npm show stripe version`).

**Primary recommendation:** Install `stripe@^20.3.1`, add two nullable columns to `users` (text + pgEnum), mount the webhook route before `express.json()`, build four new API routes, and update the expiration select + dashboard components. No additional npm packages are required.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 20.3.1 (latest) | Stripe Node.js SDK — Checkout, billing portal, webhooks, customer management | Official Stripe SDK; only correct choice |
| `drizzle-orm` + `drizzle-kit` | already installed (0.45.1 / 0.31.9) | Schema migration for new columns on `users` table | Already in project |
| `express` | already installed (5.x) | New routes for billing API | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Stripe CLI | latest (dev tool) | Local webhook forwarding + event triggering for manual testing | During development; `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `stripe` SDK | `@better-auth/stripe` plugin | Better Auth plugin has 4 open lifecycle bugs (#2440, #4957, #5976, #4801) as of Feb 2026 — do NOT use |
| `pgEnum` for `subscription_tier` | plain `text` column | pgEnum provides DB-level constraint; preferred for known finite sets |

**Installation:**
```bash
npm install stripe@^20.3.1
```

---

## Architecture Patterns

### Recommended Project Structure

New files needed:
```
server/src/
├── routes/
│   └── billing.ts          # Stripe billing routes (checkout, portal, verify)
├── routes/
│   └── webhooks.ts         # Stripe webhook handler (separate file — mounted before express.json)
├── services/
│   └── billing.service.ts  # getOrCreateStripeCustomer, activatePro, deactivatePro
└── config/
    └── stripe.ts           # Stripe SDK singleton instance

client/src/
└── components/
    └── expiration-select.ts  # MODIFY — add Pro-aware 30d option
└── pages/
    └── dashboard.ts         # MODIFY — Pro badge, upgrade CTA, Manage Subscription, banner
```

Drizzle schema and migrations:
```
server/src/db/schema.ts      # ADD stripe_customer_id + subscription_tier to users table
drizzle/                     # Two new migration files (see Drizzle bug #4147 note below)
```

Shared types:
```
shared/types/api.ts          # ADD billing API response interfaces
```

### Pattern 1: Stripe Singleton

Initialize once and import everywhere. Use lazy instantiation so the secret key is not read at module parse time (avoids build-step failures when `STRIPE_SECRET_KEY` is absent):

```typescript
// server/src/config/stripe.ts
// Source: stripe/stripe-node README
import Stripe from 'stripe';
import { env } from './env.js';

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
```

```typescript
// Import in routes:
import { stripe } from '../config/stripe.js';
```

### Pattern 2: Webhook Route — MUST Mount Before express.json()

**This is the single most critical ordering constraint in the entire phase.**

```typescript
// Source: stripe/stripe-node Context7 + STATE.md accumulated context
// In server/src/app.ts — add BEFORE the express.json() line

// Stripe webhook handler — express.raw() is mandatory.
// express.json() consumes the body stream; Stripe's constructEvent()
// needs the raw bytes to verify the HMAC-SHA256 signature.
// Order: auth handler → Stripe webhook → express.json() → all other routes
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);
```

Note: the Stripe webhook route is a standalone handler function, NOT a router mounted with `app.use()`. The raw body middleware must be applied directly to the specific route.

### Pattern 3: Checkout Session Creation

```typescript
// Source: stripe/stripe-node Context7 — verified
// server/src/routes/billing.ts

// GET /api/billing/checkout — creates Stripe Checkout session and returns redirect URL
router.get('/checkout', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;

  // Get or create Stripe customer (idempotent — checks stripe_customer_id on user row first)
  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    // {CHECKOUT_SESSION_ID} is replaced by Stripe after payment — used for verification
    success_url: `${env.APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/dashboard?checkout=cancelled`,
  });

  res.json({ url: session.url });
});
```

### Pattern 4: Post-Checkout Verification (BILL-05)

The user lands on `/dashboard?upgraded=true&session_id=cs_test_...`. The dashboard page makes a server-side request to verify completion. This is the approach required by success criterion #1 — it does NOT rely on webhook timing.

```typescript
// Source: Stripe official docs — verified
// server/src/routes/billing.ts

// GET /api/billing/verify-checkout?session_id=cs_...
router.get('/verify-checkout', requireAuth, async (req, res) => {
  const sessionId = req.query.session_id as string;
  if (!sessionId?.startsWith('cs_')) {
    res.status(400).json({ error: 'invalid_session_id' });
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // session.status === 'complete' confirms payment succeeded
  // session.customer must match the authenticated user's stripe_customer_id (CSRF protection)
  if (session.status !== 'complete') {
    res.status(402).json({ error: 'payment_incomplete' });
    return;
  }

  res.json({ status: 'active', tier: 'pro' });
});
```

**Security note:** Always verify `session.customer === user.stripe_customer_id` to prevent a user from passing another user's session ID and gaining Pro access. This prevents a session ID spoofing attack.

### Pattern 5: Customer Portal Session

```typescript
// Source: Stripe official docs (docs.stripe.com/api/customer_portal/sessions/create) — verified
// server/src/routes/billing.ts

// POST /api/billing/portal — creates Customer Portal session and returns URL
router.post('/portal', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;
  const dbUser = await getUserById(user.id); // fetch stripe_customer_id

  if (!dbUser?.stripeCustomerId) {
    res.status(404).json({ error: 'no_subscription' });
    return;
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard`,
  });

  res.json({ url: portalSession.url });
});
```

The frontend opens `url` in a new tab (`window.open(url, '_blank')`).

### Pattern 6: Webhook Handler

```typescript
// Source: stripe/stripe-node Context7 — verified
// server/src/routes/webhooks.ts (or a handler function imported into app.ts)

import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import { activatePro, deactivatePro } from '../services/billing.service.js';

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature verification failed — reject immediately
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.customer) {
        await activatePro(session.customer as string);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await deactivatePro(subscription.customer as string);
      break;
    }
    default:
      // Unhandled events — return 200 to acknowledge receipt (Stripe retries on non-2xx)
      break;
  }

  res.json({ received: true });
}
```

### Pattern 7: DB Schema Changes (users table)

```typescript
// server/src/db/schema.ts — additions to users table
import { pgEnum } from 'drizzle-orm/pg-core';

// Define the enum at module scope (must be exported for drizzle-kit)
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);

export const users = pgTable('users', {
  // ... existing columns ...
  stripeCustomerId: text('stripe_customer_id'),        // nullable by default
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
});
```

**Drizzle bug #4147 caution:** After running `npm run db:generate`, inspect the generated SQL. If the migration adds both the new `subscription_tier` enum type AND the column in one file, it may fail. The pattern from CLAUDE.md: split into two migration files if needed (CREATE TYPE first, then ALTER TABLE ADD COLUMN).

More specifically: `pgEnum` creates a PostgreSQL `CREATE TYPE` statement. Drizzle-kit may bundle the `CREATE TYPE subscription_tier` and `ALTER TABLE users ADD COLUMN subscription_tier subscription_tier` in the same migration. In PostgreSQL, you CAN reference a new type in the same transaction, so this typically works — but inspect the generated migration before running it to be sure.

### Pattern 8: Billing Service (activatePro / deactivatePro)

These functions use `stripe_customer_id` as the lookup key — never `userId`. This is intentional: the webhook payload contains `customer` (Stripe customer ID), not a user ID. Looking up by `stripe_customer_id` means the handler never receives a `userId` in the same code path as a `secretId`, satisfying the zero-knowledge invariant.

```typescript
// server/src/services/billing.service.ts

export async function activatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'pro' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));
}

export async function deactivatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'free' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));
}

export async function getOrCreateStripeCustomer(user: AuthUser): Promise<string> {
  // Fetch current user row to check existing stripeCustomerId
  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
  if (dbUser?.stripeCustomerId) return dbUser.stripeCustomerId;

  // Create new Stripe customer (idempotent: only runs once per user)
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { app: 'torch-secret' },
    // Do NOT include userId in metadata — would pair userId with Stripe data
    // (Stripe is a third-party system with its own data model)
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(eq(users.id, user.id));

  return customer.id;
}
```

**Zero-knowledge note:** The `getOrCreateStripeCustomer` function stores `stripe_customer_id` on the user row. The `activatePro`/`deactivatePro` functions look up by `stripe_customer_id`. The webhook handler receives a Stripe customer ID and never touches `users.id` directly. This separation means no code path joins `userId` + `secretId` — the invariant is preserved.

**However:** The `stripe.customers.create()` call includes `email`. This is acceptable — email is already stored in the `users` table and Stripe is a trusted processor. The concern is `userId`+`secretId` pairing, not email in Stripe.

### Pattern 9: Frontend — Expiration Select Upgrade

The existing `createExpirationSelect(isAuthenticated: boolean)` in `client/src/components/expiration-select.ts` needs a third mode: `isPro`. The function signature must change:

```typescript
// BEFORE (existing):
export function createExpirationSelect(isAuthenticated: boolean): ExpirationSelectResult

// AFTER (Phase 34):
export function createExpirationSelect(
  isAuthenticated: boolean,
  isPro: boolean,
): ExpirationSelectResult
```

For Pro users (`isAuthenticated && isPro`): add `{ value: '30d', label: '30 days' }` to the select options.

For authenticated free users (`isAuthenticated && !isPro`): add a visually disabled option with a lock icon and tooltip. Since native `<select>` options cannot display icons, the design calls for a custom element — either a visually styled `<option disabled>` with a descriptive label, or a full custom dropdown. Given the project's vanilla TS philosophy and the CONTEXT.md decision to show "a lock icon and tooltip: 'Upgrade to Pro to unlock'", a custom dropdown is likely needed for the 30-day row. Alternatively, adding a disabled `<option>` with text "30 days (Pro)" is simpler and accessible, but won't support the lock icon + tooltip. This is Claude's discretion per CONTEXT.md.

The create.ts progressive enhancement IIFE already calls `createExpirationSelect(true)` on auth resolution. It needs to pass `isPro` as well, which requires fetching Pro status from `/api/me` (or a new field on `/api/me`).

### Pattern 10: /api/me Response Extension

The `GET /api/me` endpoint currently returns `{ id, email, name, emailVerified, image, createdAt }`. Phase 34 needs `subscriptionTier` in this response so the frontend can gate the 30-day option and Pro badge:

```typescript
// server/src/routes/me.ts — add subscriptionTier to response
res.json({
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    image: user.image,
    createdAt: user.createdAt,
    subscriptionTier: user.subscriptionTier, // 'free' | 'pro'
  },
});
```

**Important:** Better Auth's `auth.$Infer.Session.user` type is generated from the base schema. Since `subscription_tier` and `stripe_customer_id` are custom columns not known to Better Auth, they will NOT appear in `res.locals.user`. The `me.ts` handler must do a DB lookup to get the current `subscriptionTier`, or the Better Auth `user` plugin must be extended to include these columns.

**Recommended approach:** Fetch the user row from Drizzle in `me.ts` using `user.id` from the session, then include `subscriptionTier` in the response. This adds one DB query per `/api/me` call but keeps the architecture simple and avoids Better Auth complexity.

### Pattern 11: Dashboard Frontend Changes

The dashboard page (`client/src/pages/dashboard.ts`) needs:

1. **`subscriptionTier` from `/api/me`** — already called via `authClient.getSession()`. But `getSession()` does not return `subscriptionTier`. The dashboard must call `GET /api/me` to get Pro status.

2. **Pro badge** — rendered near the user email line in the logout card area.

3. **Upgrade CTA** — shown only for free users. Clicking it calls `GET /api/billing/checkout`, then `window.location.href = url` to redirect to Stripe.

4. **Manage Subscription link** — shown only for Pro users. Clicking it calls `POST /api/billing/portal`, then `window.open(url, '_blank')`.

5. **`?upgraded=true` banner** — on dashboard load, if `URLSearchParams` contains `upgraded=true` AND `session_id` is present, call `GET /api/billing/verify-checkout?session_id=...`, show spinner, then show "You're now Pro — 30-day secrets unlocked" banner on success.

6. **`?checkout=cancelled` toast** — on dashboard load, if `URLSearchParams` contains `checkout=cancelled`, call `showToast('Checkout cancelled — you can upgrade anytime')`.

### Anti-Patterns to Avoid

- **Mounting webhook after express.json():** Silent failure — Stripe signature verification always fails with "No signatures found." Mount the raw webhook handler BEFORE `express.json()`.
- **Using @better-auth/stripe plugin:** 4 open bugs as of Feb 2026 break subscription lifecycle. Use raw stripe SDK.
- **Relying solely on webhook for post-checkout UI state:** Webhooks can arrive before or after the redirect. The user decision mandates a direct Stripe API query on return. Always do both: webhook for durable state, direct API query for immediate UI confirmation.
- **Using `session.status !== 'complete'` without checking customer:** A user could pass another user's session ID. Always validate `session.customer === dbUser.stripeCustomerId`.
- **Storing `userId` in Stripe customer metadata:** Creates a `userId`↔`customerId`↔`subscriptionId` chain that, if Stripe were breached, could leak user identity. Only store non-identifying metadata (e.g., `app: 'torch-secret'`).
- **Logging both `stripe_customer_id` and `userId` in the same log line:** The zero-knowledge invariant covers analytics and logs, not just DB records. The webhook handler must not log both.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe webhook signature verification | Custom HMAC validation | `stripe.webhooks.constructEvent()` | Timing-safe comparison, replay protection (5-min timestamp window), handles scheme negotiation |
| Checkout session redirect URL | Custom payment form | `stripe.checkout.sessions.create()` with `mode: 'subscription'` | PCI compliance, 3DS handling, saved cards, localization |
| Customer portal | Custom subscription management UI | `stripe.billingPortal.sessions.create()` | Cancel flows, invoice history, payment method updates — all pre-built |
| Subscription status polling | Custom polling loop on the client | Webhook + direct session verify on redirect | Webhooks are push; polling is unreliable and wasteful |

**Key insight:** Stripe's hosted surfaces (Checkout, Customer Portal) eliminate entire categories of PCI-DSS compliance scope. Never collect card data directly.

---

## Common Pitfalls

### Pitfall 1: Webhook Route Order in app.ts
**What goes wrong:** Webhook route registered after `express.json()` causes silent signature verification failure. Every webhook returns 400 "No signatures found matching the expected signature".
**Why it happens:** `express.json()` consumes and replaces `req.body` with a parsed object. Stripe's `constructEvent()` needs the original raw bytes to compute the HMAC-SHA256 hash.
**How to avoid:** Mount the webhook handler with `express.raw({ type: 'application/json' })` BEFORE the `express.json()` line in `app.ts`. Follow the same pattern as the Better Auth handler that's already mounted before `express.json()`.
**Warning signs:** 400 responses on all webhook events; "No signatures found" in error message; `stripe listen` CLI shows events forwarded but none processed.

### Pitfall 2: session.customer Type Ambiguity
**What goes wrong:** TypeScript may type `session.customer` as `string | Stripe.Customer | null` because checkout sessions can expand the customer object.
**Why it happens:** Stripe SDK uses union types for expandable fields.
**How to avoid:** Cast explicitly: `const customerId = session.customer as string` (only safe when you did not pass `expand: ['customer']` in the session create call). If you do expand, use `typeof session.customer === 'string' ? session.customer : session.customer?.id`.

### Pitfall 3: Drizzle Bug #4147 — pgEnum + Column in Same Migration
**What goes wrong:** When adding a new `pgEnum` type AND a column using that type in the same generated migration, the migration may fail.
**Why it happens:** Known drizzle-kit issue (#4147). Drizzle may generate the `CREATE TYPE` and `ALTER TABLE ADD COLUMN` in sequence within the same file — which PostgreSQL handles, but drizzle-kit's runner may fail.
**How to avoid:** After running `npm run db:generate`, inspect the generated SQL. If both `CREATE TYPE subscription_tier` and `ALTER TABLE users ADD COLUMN subscription_tier subscription_tier` appear together, split into two migration files: one for `CREATE TYPE`, one for `ALTER TABLE`. This is documented in CLAUDE.md.

### Pitfall 4: Better Auth User Object Missing Stripe Fields
**What goes wrong:** `res.locals.user.subscriptionTier` is `undefined` because Better Auth's session user type doesn't include custom schema columns.
**Why it happens:** Better Auth infers its `AuthUser` type from the base auth schema, not custom columns added to `users`.
**How to avoid:** Do NOT try to read `subscriptionTier` from `res.locals.user`. Instead, query the DB directly with `user.id` when you need it. The `me.ts` endpoint should do a `db.select().from(users).where(eq(users.id, user.id))` to get `subscriptionTier`.

### Pitfall 5: INVARIANTS.md Update Must Precede Webhook Code
**What goes wrong:** Writing webhook handler code before updating INVARIANTS.md fails success criterion #5 and BILL-06.
**Why it happens:** The invariant protocol requires documentation-first for any system that handles both `userId` and potential secret-adjacent data.
**How to avoid:** The very first task in Wave 0 of this phase must be updating INVARIANTS.md with the Stripe/billing row. The webhook handler file must not be created until that task is committed.

### Pitfall 6: Customer Portal Requires Stripe Dashboard Configuration
**What goes wrong:** `stripe.billingPortal.sessions.create()` returns 500 if the Customer Portal is not configured in the Stripe Dashboard.
**Why it happens:** The Stripe Customer Portal requires at least one configuration (which features to show) before it can generate session URLs. In test mode this may silently fail or return a confusing error.
**How to avoid:** Before testing the portal route, verify the Customer Portal is configured at `https://dashboard.stripe.com/test/settings/billing/portal`. Enable "Cancel subscription" at minimum.

### Pitfall 7: Stripe CLI Signing Secret is Different from Dashboard Signing Secret
**What goes wrong:** Webhook signature verification fails in development when using the Stripe CLI even though `STRIPE_WEBHOOK_SECRET` is set correctly.
**Why it happens:** `stripe listen` generates its own ephemeral signing secret, which is printed on startup. The Dashboard webhook endpoint has a separate permanent secret.
**How to avoid:** When using `stripe listen` locally, use the signing secret printed by the CLI (`whsec_...`) in your `.env` as `STRIPE_WEBHOOK_SECRET`, NOT the Dashboard webhook secret. In production, use the Dashboard webhook secret.

---

## Code Examples

Verified patterns from official sources:

### Create Stripe Checkout Session (Subscription Mode)
```typescript
// Source: stripe/stripe-node Context7 — HIGH confidence
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: customerId,
  line_items: [{ price: env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
  success_url: `${env.APP_URL}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${env.APP_URL}/dashboard?checkout=cancelled`,
});
// session.url is the Stripe-hosted checkout URL to redirect the user to
```

### Retrieve Checkout Session After Redirect
```typescript
// Source: Stripe official docs (docs.stripe.com/payments/checkout/custom-success-page) — HIGH confidence
const session = await stripe.checkout.sessions.retrieve(sessionId);
// session.status === 'complete' means payment succeeded
// session.payment_status is also available: 'paid' | 'unpaid' | 'no_payment_required'
```

### Verify Webhook Signature
```typescript
// Source: stripe/stripe-node Context7 — HIGH confidence
// req.body is the raw Buffer (from express.raw middleware)
// sig is req.headers['stripe-signature']
const event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
```

### Create Billing Portal Session
```typescript
// Source: Stripe official docs (docs.stripe.com/api/customer_portal/sessions/create) — HIGH confidence
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${env.APP_URL}/dashboard`,
});
// portalSession.url is the Customer Portal URL (short-lived)
```

### TypeScript ESM Import for stripe-node
```typescript
// Source: stripe/stripe-node README — HIGH confidence
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

### pgEnum in Drizzle Schema
```typescript
// Source: Drizzle ORM docs — HIGH confidence
import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);

export const users = pgTable('users', {
  // ... existing columns
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
});
```

### Expiration Select — Pro-Aware Signature
```typescript
// Source: existing codebase (client/src/components/expiration-select.ts) — adapted for Phase 34
export function createExpirationSelect(
  isAuthenticated: boolean,
  isPro: boolean,
): ExpirationSelectResult {
  if (!isAuthenticated) {
    // Anonymous: locked to 1 hour (unchanged)
  }
  // Authenticated free: options 1h/24h/7d + disabled 30d with lock indicator
  // Authenticated Pro: options 1h/24h/7d/30d (all enabled)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe `plans` API | Stripe `prices` API | 2020 | Use `price_id` not `plan_id` in checkout sessions |
| Stripe `sources` | Stripe `payment_methods` | 2019 | Sources are deprecated; Checkout handles this automatically |
| `stripe.customers.createPortalSession()` | `stripe.billingPortal.sessions.create()` | ~2021 | New API namespace; old method still works in some SDK versions but billingPortal is canonical |
| `@better-auth/stripe` plugin | Raw `stripe` SDK | N/A | Plugin has active bugs; raw SDK is more reliable |

**Deprecated/outdated:**
- `stripe-node v17` API version `2024-06-20`: Current v20 uses `2025-03-31.basil`. Breaking change: Checkout Sessions for subscriptions now postpone subscription creation until after payment (fixes a race condition). The `session.subscription` field may be null on initial session creation — only populated after `checkout.session.completed` fires.

---

## Open Questions

1. **Stripe Price ID source**
   - What we know: The checkout session needs a `STRIPE_PRO_PRICE_ID` env var pointing to the Stripe price created in the Stripe Dashboard.
   - What's unclear: Whether the price has been created in the Stripe Dashboard (test mode) yet, and whether it uses monthly-only billing (annual toggle from Phase 33 is a v6.0+ feature per REQUIREMENTS.md).
   - Recommendation: Create the price in Stripe Dashboard (test mode) before implementation begins. Monthly only for now. Price should match what Phase 33 shows ($9/month).

2. **INVARIANTS.md Stripe Row Design**
   - What we know: Must add a row before writing any webhook handler code (BILL-06). The row must document that webhook payloads do not log both `customerId` and `userId` together.
   - What's unclear: Exact wording of the new invariant row.
   - Recommendation: The row should state: webhook handler receives `stripe_customer_id` (from Stripe payload) and looks up user by `stripe_customer_id`. No code path joins `userId` and `secretId`. Pino logger must not log `stripe_customer_id` alongside `userId`. See existing rows for format.

3. **`/api/me` response change — type contract**
   - What we know: The `me.ts` route currently returns a narrow user shape. Adding `subscriptionTier` requires a DB lookup.
   - What's unclear: Whether the Better Auth `AuthUser` type can be extended cleanly or whether a separate query is always needed.
   - Recommendation: Add a separate DB query in `me.ts` for `subscriptionTier`. Update `shared/types/api.ts` with a `MeResponse` interface that includes `subscriptionTier: 'free' | 'pro'`. Add corresponding update to `client/src/api/client.ts`.

---

## New Environment Variables Required

The following must be added to `server/src/config/env.ts` (Zod schema) and `.env.example`:

| Variable | Purpose | Example |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | Stripe API key (test: `sk_test_...`, prod: `sk_live_...`) | `sk_test_4eC39HqLyjWDarjtT1zdp7dc` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe CLI (dev) or Dashboard (prod) | `whsec_...` |
| `STRIPE_PRO_PRICE_ID` | Price ID for Pro monthly subscription | `price_1...` |

---

## Sources

### Primary (HIGH confidence)
- `/stripe/stripe-node` (Context7, v19.1.0 docs) — Checkout session create, retrieve, webhook constructEvent, billing portal sessions, customer create
- `docs.stripe.com/api/customer_portal/sessions/create` (official docs, WebFetch verified) — billing portal session params and response
- `docs.stripe.com/payments/checkout/custom-success-page` (official docs, WebFetch verified) — `{CHECKOUT_SESSION_ID}` template, session retrieval pattern
- `/drizzle-team/drizzle-orm-docs` (Context7) — pgEnum, nullable columns, ALTER TABLE patterns
- `npm show stripe version` (live npm query) — confirmed current version is 20.3.1

### Secondary (MEDIUM confidence)
- `docs.stripe.com/billing/subscriptions/webhooks` (WebFetch) — subscription lifecycle event list, `customer.subscription.deleted` meaning
- `docs.stripe.com/api/customers/create?lang=node` (WebFetch) — customer create parameters
- STATE.md accumulated context — `@better-auth/stripe` bug warning, webhook-before-JSON ordering, stripe CLI signing secret behavior

### Tertiary (LOW confidence)
- WebSearch results on `customer.subscription.deleted` handling — corroborates switch-case pattern; not independently verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stripe@20.3.1 confirmed via npm; patterns verified in Context7 and official docs
- Architecture: HIGH — webhook ordering, billing portal, session verification all verified against official sources; DB schema uses established Drizzle patterns from existing codebase
- Pitfalls: HIGH — pitfalls #1 (webhook order), #4 (Better Auth user type), #5 (INVARIANTS.md first) confirmed by STATE.md accumulated context; #2/#3/#6/#7 confirmed by official docs/codebase analysis

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (Stripe API is stable; stripe-node major versions are rare)
