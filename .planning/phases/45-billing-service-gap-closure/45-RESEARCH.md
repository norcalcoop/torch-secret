# Phase 45: Billing Service Gap Closure - Research

**Researched:** 2026-03-02
**Domain:** Stripe billing integration, Loops contact sync, TypeScript service patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-05 | Success page verifies subscription status via direct Stripe API query on `?session_id=` param (not dependent on webhook arrival timing) | The existing verify-checkout endpoint validates the Stripe session is `complete` and the customer matches, but does NOT call `activatePro()`. Making `activatePro()` idempotent and calling it from verify-checkout closes the ~1-2s race window. |
| ESEQ-03 (secondary path) | New account holder receives upgrade prompt email on day 7 (skipped if already Pro; re-fired when churned user re-subscribes) | `deactivatePro()` currently omits the `loops.updateContact({ subscriptionTier: 'free' })` call that `activatePro()` already performs correctly. Adding it mirrors the existing pattern exactly. |
</phase_requirements>

---

## Summary

Phase 45 closes two non-critical integration gaps identified in the v5.0 milestone audit. Both gaps exist in `server/src/services/billing.service.ts` and `server/src/routes/billing.ts` — neither requires new dependencies, schema changes, or architectural decisions.

**Gap 1 (BILL-05 race):** The `GET /api/billing/verify-checkout` endpoint confirms Stripe payment completion but does not call `activatePro()`. The dashboard relies on the webhook (`checkout.session.completed`) to update the DB. In practice the webhook arrives within ~1-2 seconds and UAT confirmed the flow works, but the gap represents a real race window. The fix is to call `activatePro(customerId)` from the verify-checkout handler after validating the session — making Pro activation idempotent so both the webhook and verify-checkout can safely call it.

**Gap 2 (ESEQ-03 Loops desync):** `deactivatePro()` correctly updates the DB `subscriptionTier` to `'free'` but does not call `loops.updateContact({ subscriptionTier: 'free' })`. This means churned users permanently remain tagged as `'pro'` in Loops, so the day-7 re-engagement audience filter (`subscriptionTier != pro`) never re-opens for them after resubscription. The fix exactly mirrors the pattern already present in `activatePro()`.

**Primary recommendation:** Both changes are surgical, low-risk additions to existing functions. Plan 45-01 handles BILL-05 (idempotent `activatePro()` + call from verify-checkout). Plan 45-02 handles ESEQ-03 (add `loops.updateContact` call to `deactivatePro()`).

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `loops` | 6.2.0 | Loops.so SDK — `updateContact()`, `sendEvent()`, `deleteContact()` | Already used by `activatePro()` and `onboarding.service.ts` |
| Stripe Node SDK | (project-standard) | Stripe API — `checkout.sessions.retrieve()` | Already used by verify-checkout handler |
| Drizzle ORM | (project-standard) | DB queries — `db.select()`, `db.update()` | Already used throughout billing.service.ts |

### No New Installations Required

Both changes only call methods already present in the codebase. The Loops SDK singleton (`loops` from `../config/loops.js`) and the Stripe SDK singleton (`stripe` from `../config/stripe.js`) are already imported.

## Architecture Patterns

### Pattern 1: Idempotent activatePro() (BILL-05)

**What:** `activatePro()` must be safe to call more than once for the same customer. Drizzle `db.update(...).set({ subscriptionTier: 'pro' }).where(eq(users.stripeCustomerId, ...))` is already idempotent at the DB level (UPDATE on an already-`'pro'` row is a no-op). The Loops `updateContact()` call is also idempotent (setting `subscriptionTier: 'pro'` on an already-`'pro'` contact has no side effects). Therefore `activatePro()` requires no structural change — it is already idempotent. The fix is simply calling it from verify-checkout.

**Current verify-checkout flow (lines 52-78, billing.ts):**
```typescript
// After session.status === 'complete' and customer ownership verified:
res.json({ status: 'active', tier: 'pro' });  // ← returns without activating Pro in DB
```

**Target verify-checkout flow:**
```typescript
// After session.status === 'complete' and customer ownership verified:
const customerId =
  typeof session.customer === 'string' ? session.customer : session.customer.id;
await activatePro(customerId);  // ← idempotent; safe even if webhook already fired
res.json({ status: 'active', tier: 'pro' });
```

**Import addition needed in billing.ts:** `activatePro` is already exported from `billing.service.ts`. Import it alongside `getOrCreateStripeCustomer`.

**When to use:** Any time a verified Stripe checkout session with `status === 'complete'` is confirmed. The webhook fires `activatePro` on `checkout.session.completed`; verify-checkout also fires it — both are correct.

**ZK invariant check:** `activatePro(customerId)` receives `stripe_customer_id` only. The `session.customer` field extracted from Stripe is `stripe_customer_id` — no `userId`, no `secretId` in scope. Pattern already established by webhook handler (lines 44-48, webhooks.ts).

### Pattern 2: deactivatePro() Loops Sync (ESEQ-03)

**What:** Mirror the `activatePro()` Loops sync pattern in `deactivatePro()`. The existing `activatePro()` does:
1. DB update (`subscriptionTier: 'pro'`)
2. DB select by `stripeCustomerId` to get email
3. `void loops.updateContact({ email, properties: { subscriptionTier: 'pro' } }).catch(...)`

`deactivatePro()` must do the same, substituting `'free'` for `'pro'`.

**Current deactivatePro() (lines 47-52, billing.service.ts):**
```typescript
export async function deactivatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'free' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));
}
```

**Target deactivatePro():**
```typescript
export async function deactivatePro(stripeCustomerId: string): Promise<void> {
  await db
    .update(users)
    .set({ subscriptionTier: 'free' })
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  // Sync free status to Loops so day-7 re-engagement audience re-opens for churned users.
  // ZK invariant: stripeCustomerId is the lookup key; userId is not in scope here.
  const [freedUser] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, stripeCustomerId));

  if (freedUser) {
    void loops
      .updateContact({
        email: freedUser.email,
        properties: { subscriptionTier: 'free' },
      })
      .catch((err: unknown) => {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Loops contact update failed on Pro cancellation',
        );
      });
  }
}
```

**Loops API (confirmed — already used by activatePro):** `loops@6.2.0` uses single-object API — `loops.updateContact({ email, properties })`. This is the v6.x API; do NOT use v5 positional arguments.

**Fire-and-forget pattern:** Same as `activatePro()` — billing must never be blocked by Loops outage. Use `void ...catch()`.

**Logger import:** `logger` is already imported in `billing.service.ts` (line 6).

### Recommended Project Structure (no changes needed)

The existing file layout is correct. Changes touch only:
```
server/src/
├── services/
│   └── billing.service.ts      # deactivatePro() Loops sync (Plan 45-02)
└── routes/
    └── billing.ts              # verify-checkout calls activatePro() (Plan 45-01)
```

### Anti-Patterns to Avoid

- **Blocking billing on Loops:** Never `await` the Loops call in `deactivatePro()`. Use `void ...catch()` — Loops outage must not fail a cancellation confirmation.
- **Passing userId to Loops:** The lookup is always by `stripeCustomerId` → email. The `userId` must not appear in the Loops call or log lines alongside other identifying data. ZK invariant enforced by existing `activatePro()` pattern.
- **Adding Loops sync to verify-checkout directly:** The Loops sync belongs in `activatePro()` (the service), not in the route handler. The route just calls `await activatePro(customerId)` — no direct Loops calls in billing.ts.
- **Using `await` on Loops in activatePro/deactivatePro:** Both are fire-and-forget. The billing DB state is the source of truth; Loops is a best-effort sync.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Loops contact sync | Custom HTTP call to Loops REST API | `loops.updateContact()` from existing singleton | SDK already installed, already used in activatePro() |
| Idempotent Pro activation | Conditional logic checking current tier | None needed — Drizzle UPDATE + Loops updateContact are already idempotent | Both operations are safe to call on already-activated users |
| Session customer extraction | Custom parsing | Same typeof guard already in webhooks.ts | Pattern established: `typeof session.customer === 'string' ? session.customer : session.customer.id` |

---

## Common Pitfalls

### Pitfall 1: session.customer Type Union

**What goes wrong:** Stripe `checkout.sessions.retrieve()` returns `session.customer` as `string | Stripe.Customer | Stripe.DeletedCustomer | null`. If the handler assumes it's always a string and passes it directly to `activatePro()`, TypeScript will error.

**Why it happens:** Stripe expand semantics — unexpanded fields are strings; expanded are objects.

**How to avoid:** Use the existing webhook handler pattern:
```typescript
const customerId =
  typeof session.customer === 'string' ? session.customer : session.customer.id;
```

**Warning signs:** TypeScript error on `activatePro(session.customer)` — type mismatch.

### Pitfall 2: session.customer Null Guard

**What goes wrong:** `session.customer` can be `null` if checkout was not associated with a customer. Calling `activatePro(null)` would be a no-op DB update and a spurious Loops call.

**Why it happens:** Stripe allows checkout sessions without pre-assigned customers.

**How to avoid:** Add null guard before calling `activatePro()`:
```typescript
if (session.status === 'complete' && session.customer) {
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer.id;
  await activatePro(customerId);
}
```

This mirrors the webhook handler guard (webhooks.ts line 44: `if (session.mode === 'subscription' && session.customer)`).

### Pitfall 3: Import Missing in billing.ts

**What goes wrong:** `activatePro` is not currently imported in `billing.ts` — only `getOrCreateStripeCustomer` is imported (line 5). Calling `activatePro()` without updating the import will TypeScript-error.

**Why it happens:** `activatePro` was previously only used by the webhook handler.

**How to avoid:** Update the import in billing.ts:
```typescript
import { getOrCreateStripeCustomer, activatePro } from '../services/billing.service.js';
```

### Pitfall 4: Loops v5 vs v6 API

**What goes wrong:** Using positional arguments `loops.updateContact(email, { subscriptionTier: 'free' })` (v5 style) fails silently at compile-time or throws at runtime.

**Why it happens:** Loops SDK had a breaking change in v6.x.

**How to avoid:** Use single-object API (already confirmed in `activatePro()`):
```typescript
loops.updateContact({ email: freedUser.email, properties: { subscriptionTier: 'free' } })
```

---

## Code Examples

Verified patterns from the project codebase:

### Existing activatePro() Loops Sync (Source: billing.service.ts lines 22-44)
```typescript
// ZK invariant: stripeCustomerId is the lookup key; userId is not in scope here.
const [proUser] = await db
  .select({ email: users.email })
  .from(users)
  .where(eq(users.stripeCustomerId, stripeCustomerId));

if (proUser) {
  void loops
    .updateContact({
      email: proUser.email,
      properties: { subscriptionTier: 'pro' },
    })
    .catch((err: unknown) => {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'Loops contact update failed on Pro upgrade',
      );
    });
}
```

### Existing Webhook Customer ID Extraction (Source: webhooks.ts lines 44-48)
```typescript
if (session.mode === 'subscription' && session.customer) {
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer.id;
  await activatePro(customerId);
}
```

### Existing verify-checkout Customer Ownership Check (Source: billing.ts lines 60-75)
```typescript
const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
const session = await stripe.checkout.sessions.retrieve(sessionId);

if (session.status !== 'complete') {
  res.status(402).json({ error: 'payment_incomplete' });
  return;
}

if (dbUser?.stripeCustomerId && session.customer !== dbUser.stripeCustomerId) {
  res.status(403).json({ error: 'session_mismatch' });
  return;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual Loops REST calls | `loops.updateContact()` SDK | Phase 37 (loops@6.2.0) | Single-object API, type-safe |
| Webhook-only Pro activation | Webhook + verify-checkout idempotent activation | Phase 45 (this phase) | Closes BILL-05 race window |
| DB-only deactivatePro | DB + Loops sync in deactivatePro | Phase 45 (this phase) | Re-enables ESEQ-03 re-engagement path |

---

## Open Questions

1. **verify-checkout: should activatePro() failure block the response?**
   - What we know: `activatePro()` is `async` — it awaits the DB update then fires Loops as void. The DB update succeeding is the important part. If Loops fails, it's caught and logged.
   - What's unclear: If the DB update inside `activatePro()` throws (e.g., DB timeout), should verify-checkout return an error or still return `{ status: 'active', tier: 'pro' }` since Stripe confirmed payment?
   - Recommendation: Let `activatePro()` throw propagate — the route already has an Express 5 async error handler that will catch it. If the DB update fails, we should not tell the client they're Pro. The webhook will retry anyway.

2. **Should verify-checkout check session.mode === 'subscription'?**
   - What we know: The webhook guard checks `session.mode === 'subscription'` before calling `activatePro()`. The verify-checkout endpoint only creates checkout sessions in subscription mode (billing.ts line 28: `mode: 'subscription'`), so in practice all verified sessions are subscription mode.
   - Recommendation: Add the mode check anyway for defensive parity with the webhook handler — cheap guard, prevents future drift if a one-time payment checkout is ever added.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project) |
| Config file | `vitest.config.ts` (server project: node environment, `fileParallelism: false`) |
| Quick run command | `npx vitest run server/src/services/billing.service.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-05 | verify-checkout calls activatePro() — DB Pro state set without waiting for webhook | unit (mock Stripe + DB + Loops) | `npx vitest run server/src/routes/__tests__/billing.test.ts` | ❌ Wave 0 |
| BILL-05 | activatePro() is idempotent — calling twice with same customerId is a no-op | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists (extend) |
| ESEQ-03 | deactivatePro() calls loops.updateContact with subscriptionTier: 'free' | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists (extend) |
| ESEQ-03 | deactivatePro() Loops failure is caught and does not throw | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists (extend) |
| ESEQ-03 | deactivatePro() skips Loops call when no user found for customerId | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists (extend) |

### Sampling Rate

- **Per task commit:** `npx vitest run server/src/services/billing.service.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/routes/__tests__/billing.test.ts` — covers BILL-05 verify-checkout calls activatePro() + idempotency. New file needed; existing billing route tests (billing.ts route) do not exist yet in the `__tests__` directory.

*(All other test files `billing.service.test.ts` already exist — extend with new describe blocks.)*

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `server/src/services/billing.service.ts` — current `activatePro()` and `deactivatePro()` implementations, Loops API call pattern, logger usage
- Direct inspection of `server/src/routes/billing.ts` — verify-checkout endpoint, Stripe session retrieval, customer ownership check
- Direct inspection of `server/src/routes/webhooks.ts` — webhook handler, `session.customer` type guard pattern, `activatePro()` call site
- `.planning/v5.0-MILESTONE-AUDIT.md` — exact gap descriptions (BILL-05-race, ESEQ-03-desync), severity assessments, fix recommendations
- `.planning/INVARIANTS.md` — ZK invariant enforcement table, Stripe billing row (Phase 34)
- `server/src/services/billing.service.test.ts` — existing test structure for `activatePro()`, mock patterns for `db.select`, `db.update`, `loops.updateContact`

### Secondary (MEDIUM confidence)

- `STATE.md` accumulated context — confirms `loops@6.2.0` v6 API, fire-and-forget pattern requirements, `activatePro()` extended with Loops sync (Phase 37 notes)
- `STATE.md` Phase 37 notes — confirms Loops `updateContact()` single-object API, `databaseHooks` non-async pattern

### Tertiary (LOW confidence)

- None — all findings verified from project source files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and in use
- Architecture: HIGH — patterns copied directly from existing `activatePro()` implementation in same file
- Pitfalls: HIGH — type guards and import gaps verified by direct file inspection

**Research date:** 2026-03-02
**Valid until:** Stable — changes touch only 2 functions in 2 files; no external API changes required
