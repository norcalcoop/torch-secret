# Phase 34: Stripe Pro Billing - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Authenticated users can subscribe to Pro via Stripe Checkout, manage their subscription via the Stripe Customer Portal, and immediately receive the 30-day expiration unlock. The subscription lifecycle (activate on checkout, deactivate on cancellation) is kept accurate by Stripe webhook events. No other features or tier differences are in scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Upgrade CTA placement
- Primary upgrade CTA lives on the dashboard AND inside the expiration dropdown (point-of-friction placement)
- The 30-day option in the expiration dropdown is greyed out for free users with a lock icon and tooltip: "Upgrade to Pro to unlock"
- Clicking any upgrade CTA redirects directly to Stripe Checkout — no intermediate pricing page or modal
- Dashboard CTA visual treatment is Claude's discretion (copy, layout, visual weight)

### Post-checkout experience
- Stripe `success_url` returns to `/dashboard?upgraded=true`
- On page load with `upgraded=true`, the server calls Stripe directly (`GET /v1/checkout/sessions/:id`) to verify the session completed — does NOT rely on webhook timing
- While verifying, show a brief spinner; on success, show a banner: "You're now Pro — 30-day secrets unlocked"
- Stripe `cancel_url` returns to `/dashboard?checkout=cancelled` with a subtle toast: "Checkout cancelled — you can upgrade anytime"

### Pro status communication
- Pro badge is shown on the dashboard only, near the user name/settings area
- For Pro users: 30-day expiration option is unlocked, Pro badge is shown, upgrade CTAs/banners are replaced by the Manage Subscription link
- Downgrade behavior: existing secrets created with 30-day expiration are grandfathered (unaffected); the 30-day option disappears from the dropdown for new secrets

### Subscription management
- "Manage Subscription" link appears on the dashboard near the Pro badge (visible to Pro users only)
- Clicking it opens the Stripe Customer Portal in a new tab

### Webhooks
- Handle only the core lifecycle: `checkout.session.completed` (activate Pro) and `customer.subscription.deleted` (deactivate Pro)
- `invoice.payment_failed` and `customer.subscription.updated` are out of scope for this phase

### Stripe data storage
- `stripe_customer_id` stored as a nullable column on the `users` table
- `subscription_tier` (enum: 'free' | 'pro') stored on the `users` table
- INVARIANTS.md must have a Stripe/billing row added before any webhook handler code is written (per success criterion #5)

### Claude's Discretion
- Exact dashboard CTA copy, visual treatment, and layout
- Loading spinner implementation details
- Banner/toast visual styling (consistent with existing design system)

</decisions>

<specifics>
## Specific Ideas

- No specific UI references given — standard Torch Secret design system applies
- Direct Stripe API query on return URL is a hard requirement (matches success criterion #1 verbatim)
- INVARIANTS.md update must precede webhook handler code (success criterion #5)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 34-stripe-pro-billing*
*Context gathered: 2026-02-23*
