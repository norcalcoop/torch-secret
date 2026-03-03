# Phase 37: Email Onboarding Sequence - Research

**Researched:** 2026-02-26
**Domain:** Loops.so email sequences, Better Auth databaseHooks, user additionalFields, marketing consent gating
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email copy and tone**
- Tone is warm and casual across all 3 emails — friendly, direct, short sentences. Feels human, not corporate.
- Personalization: first name in both the subject line and the opening greeting for all 3 emails
- Welcome email CTA: "Create your first secret" — deep link to `/create`
- Day-3 email highlights power features: password protection, expiration options, one-time view guarantee
- Day-7 email uses feature unlock angle: "With Pro you get X, Y, Z" — concrete features the free user is currently locked out of

**Consent checkbox UX**
- Label text: "Send me product tips and updates" (unchecked by default)
- Placement: below the submit button, above any fine print — clearly optional, doesn't interrupt form flow
- No explanatory text below the checkbox — label is self-explanatory
- OAuth registrations (Google/GitHub) default to opted-out — no marketing consent is assumed, no post-OAuth prompt

**Day-7 upgrade CTA**
- Link destination: in-app `/pricing` page — user sees plan details and Stripe Checkout button in context
- If the user is already Pro when day 7 arrives: suppress the email entirely (do not send)
- Unsubscribe: Loops.so handles unsubscribe footer automatically on all marketing emails

**Loops.so integration**
- Trigger: server-side Loops API call at registration time — registration handler calls Loops to create/update the contact and fire the "registered" event
- Failure handling: silent fail — if the Loops API call fails, log the error but let registration succeed. Email sequence is non-critical path.
- Marketing consent flag: passed to Loops as a contact property (e.g., `marketingConsent: true/false`). Loops sequence conditions use this property to gate day-3 and day-7 emails.
- Delay ownership: configured inside Loops — the app fires a single "registered" event and Loops handles the day 0 / day 3 / day 7 scheduling internally

### Claude's Discretion
- Exact Pro features to list in the day-7 email (based on what Phase 34 built)
- Loops contact property naming conventions
- Error logging format for Loops API failures
- How to check Pro status before suppressing the day-7 email (whether Loops supports this natively or requires a separate webhook/contact update)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ESEQ-01 | New account holder automatically receives welcome email immediately after registration | Better Auth `databaseHooks.user.create.after` fires the Loops `sendEvent` with `eventName: 'registered'` — Loops welcome email sends immediately on this trigger |
| ESEQ-02 | New account holder receives key features email on day 3 (marketing consent required) | Loops loop with timer node (3-day delay) + audience filter checking `marketingConsent equals true` gates this email — no app code needed after initial contact creation |
| ESEQ-03 | New account holder receives upgrade prompt email on day 7 linking to live Stripe Checkout (marketing consent required; skipped if already Pro) | Loops loop with timer node (7-day delay) + audience filter checking `marketingConsent equals true` AND `subscriptionTier not equals pro` — app must update contact `subscriptionTier` property when user upgrades |
| ESEQ-04 | Marketing consent opt-in checkbox added to registration form (gates emails 2-3 per GDPR) | Better Auth `additionalFields` adds `marketingConsent: boolean` to users table; registration form checkbox passes value via `authClient.signUp.email({ ..., marketingConsent: bool })`; Drizzle migration 0006 stores the column |
</phase_requirements>

---

## Summary

Phase 37 integrates Loops.so into the registration flow to deliver a 3-email onboarding sequence. The architecture is a single server-side hook: when Better Auth creates a new user, a `databaseHooks.user.create.after` callback fires synchronously (but is fire-and-forget via `.catch()`) and calls the Loops SDK to create/update a contact and send a `registered` event. All scheduling (day 0, day 3, day 7), consent gating, and Pro-user suppression happen inside the Loops loop builder — the application fires a single event with contact properties and Loops handles the rest.

Two database changes are needed. First, a `marketing_consent` boolean column added to the `users` table via Drizzle migration 0006 — declared in `schema.ts`, referenced in Better Auth `additionalFields` so the value flows through `signUp.email()` automatically. Second, no other tables need modification; the zero-knowledge invariant is respected because the Loops contact record is an external system with no userId/secretId co-location. Third, the Stripe billing layer needs a companion: when a user upgrades to Pro, the Loops contact must be updated with `subscriptionTier: 'pro'` so Loops audience filters can suppress the day-7 email for existing Pro users.

The Loops SDK is at v6.2.0 (Feb 2026) and is NOT yet in the project's `package.json` — it must be installed. The v6 SDK uses a single-object API for `createContact()` and `sendEvent()` (breaking change from v5's positional arguments). The project's `STATE.md` already notes `loops@6.2.0 uses v6.x createContact() single-object API`.

**Primary recommendation:** Install `loops@6.2.0`, add `marketingConsent` to schema.ts + Better Auth `additionalFields`, wire a `databaseHooks.user.create.after` hook to call `loops.sendEvent()`, and build the 3-step Loops loop in the Loops UI with delays + audience filters.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| loops | 6.2.0 | Official Loops.so Node.js SDK — creates contacts, sends events, sends transactional emails | Already chosen in CONTEXT.md; STATE.md confirms version and v6 API |
| better-auth | 1.4.18 (installed) | `databaseHooks.user.create.after` callback fires after user record creation | Already installed; hooks pattern is the standard BA way to run post-registration side effects |
| drizzle-orm | 0.45.1 (installed) | `marketingConsent` column on users table via Drizzle migration | Already installed; consistent with Phase 34 pattern for adding columns to users |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.x (installed) | Unit tests for the Loops service — mock `LoopsClient` and assert `sendEvent()` called with correct args | Test isolation for the onboarding service |
| zod | 4.x (installed) | `LOOPS_API_KEY` env var validation | Consistent with project env validation pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Loops.so sequences (cloud scheduler) | Cron job in-app + Resend transactional emails | Loops handles delay, branching, unsubscribe automatically; in-app cron requires a `scheduled_emails` table, complex retry logic, and manual unsubscribe handling — vastly higher complexity |
| `databaseHooks.user.create.after` | POST-registration middleware or API route | Hook fires inside Better Auth's own user creation lifecycle — no race conditions, no duplicate registration interception needed |

**Installation:**
```bash
npm install loops@6.2.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── services/
│   └── onboarding.service.ts  # Loops contact creation + event send
├── config/
│   └── loops.ts               # LoopsClient singleton (mirrors config/stripe.ts)
├── db/
│   └── schema.ts              # Add marketingConsent boolean column to users
└── auth.ts                    # Add databaseHooks.user.create.after + additionalFields

drizzle/
└── 0006_add_marketing_consent.sql  # ALTER TABLE users ADD COLUMN marketing_consent

client/src/pages/
└── register.ts  # Add marketingConsent checkbox below submit button
```

### Pattern 1: Better Auth databaseHooks After User Create

**What:** A callback registered in `betterAuth({ databaseHooks })` that runs after the user row is committed to the database. Side effects only — return value is ignored.
**When to use:** Post-registration actions that must not block the registration response (welcome email, Loops enrollment, Stripe customer pre-creation).

```typescript
// Source: https://www.better-auth.com/docs/concepts/database (verified Feb 2026)
// In server/src/auth.ts — extend the existing betterAuth() config

import { loops } from './config/loops.js';

export const auth = betterAuth({
  // ... existing config ...

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Fire-and-forget: registration must succeed even if Loops is down
          void enrollInOnboardingSequence(user).catch((err: unknown) => {
            // Pino logger — no userId or secretId in the same log line (ZK invariant)
            logger.error(
              { err: err instanceof Error ? err.message : String(err) },
              'Loops onboarding enrollment failed'
            );
          });
        },
      },
    },
  },
});
```

**Critical note:** The `after` hook returns `Promise<void>`. The `void` + `.catch()` pattern ensures the Loops call is non-blocking and errors are captured without crashing the registration flow.

### Pattern 2: Better Auth additionalFields for marketingConsent

**What:** Declares `marketingConsent` as a custom boolean field on the user model. Better Auth passes it through `signUp.email()` and stores it in the database column.
**When to use:** Any custom column on the users table that must be set during registration.

```typescript
// Source: https://www.better-auth.com/docs/concepts/database (verified Feb 2026)
// In server/src/auth.ts

export const auth = betterAuth({
  // ... existing config ...

  user: {
    additionalFields: {
      marketingConsent: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,  // Allow client to pass value during sign-up
      },
    },
  },
});
```

**Database column**: Must also be added manually to `schema.ts` (this project does not use the BA CLI for schema generation — it uses manual Drizzle schema + `drizzle-kit generate`):

```typescript
// In server/src/db/schema.ts — add to users table
marketingConsent: boolean('marketing_consent').notNull().default(false),
```

**Then generate the migration:**
```bash
npm run db:generate  # drizzle-kit generate → creates 0006_add_marketing_consent.sql
npm run db:migrate   # apply migration
```

### Pattern 3: Loops SDK Singleton (mirrors config/stripe.ts)

**What:** A module-level `LoopsClient` instance, initialized once with the API key.
**When to use:** Anywhere in the server that needs to call the Loops API.

```typescript
// Source: https://loops.so/docs/sdks/javascript (verified Feb 2026)
// In server/src/config/loops.ts

import { LoopsClient } from 'loops';
import { env } from './env.js';

export const loops = new LoopsClient(env.LOOPS_API_KEY);
```

### Pattern 4: Loops sendEvent — Create Contact + Trigger Sequence

**What:** `sendEvent()` creates the contact (if it doesn't exist), updates properties, and fires the named event that triggers the Loops loop.
**When to use:** Preferred over separate `createContact()` + `sendEvent()` calls — one API call, atomic.

```typescript
// Source: https://loops.so/docs/sdks/javascript (verified Feb 2026)
// In server/src/services/onboarding.service.ts

import { loops } from '../config/loops.js';

interface OnboardingUser {
  email: string;
  name: string;
  marketingConsent: boolean;
  subscriptionTier: 'free' | 'pro';
}

export async function enrollInOnboardingSequence(user: OnboardingUser): Promise<void> {
  await loops.sendEvent({
    email: user.email,
    eventName: 'registered',
    contactProperties: {
      firstName: user.name.split(' ')[0] ?? user.name,
      marketingConsent: user.marketingConsent,
      subscriptionTier: user.subscriptionTier,
    },
  });
}
```

**Loops loop configuration (done in Loops UI, not in code):**
```
Trigger: Event "registered" received
├── Email: Welcome email (send immediately)
│   - To all contacts
│   - Subject: "Hey {{firstName}}, welcome to Torch Secret 👋"
│   - CTA: "Create your first secret" → https://torchsecret.com/create
├── Timer: 3 days
├── Audience filter: marketingConsent equals true
│   └── Email: Key features email (day 3)
├── Timer: 4 more days (total: 7 days from registration)
├── Audience filter: marketingConsent equals true AND subscriptionTier not equals "pro"
│   └── Email: Upgrade prompt email (day 7)
│       - CTA: "See Pro plans" → https://torchsecret.com/pricing
```

### Pattern 5: Loops Contact Update on Pro Upgrade

**What:** When a user upgrades to Pro (Stripe webhook fires `activatePro()`), update the Loops contact so the day-7 audience filter suppresses the upgrade email.
**When to use:** Stripe `activatePro()` in billing.service.ts — the only place where subscription tier transitions happen.

```typescript
// In server/src/services/billing.service.ts — extend activatePro()
// Note: activatePro receives stripeCustomerId, NOT userId (ZK invariant)
// Look up user email by stripeCustomerId, then update Loops contact

await loops.updateContact({
  email: userEmail,
  properties: {
    subscriptionTier: 'pro',
  },
}).catch((err: unknown) => {
  // Non-critical: log and continue — billing is unaffected if Loops is down
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    'Loops contact update failed on Pro upgrade'
  );
});
```

### Pattern 6: Client-Side marketingConsent Checkbox

**What:** An unchecked checkbox below the submit button, passed to `authClient.signUp.email()`.
**When to use:** Registration form only. OAuth path defaults to `false` (no prompt).

```typescript
// In client/src/pages/register.ts
// Add after the submit button, before the consent line

const marketingConsentGroup = document.createElement('div');
marketingConsentGroup.className = 'flex items-start gap-2.5 pt-1';

const marketingConsentCheckbox = document.createElement('input');
marketingConsentCheckbox.type = 'checkbox';
marketingConsentCheckbox.id = 'marketing-consent';
marketingConsentCheckbox.name = 'marketing-consent';
marketingConsentCheckbox.checked = false; // unchecked by default (GDPR)
marketingConsentCheckbox.className =
  'mt-0.5 h-4 w-4 accent-accent rounded border-border cursor-pointer';

const marketingConsentLabel = document.createElement('label');
marketingConsentLabel.htmlFor = 'marketing-consent';
marketingConsentLabel.className = 'text-sm text-text-secondary leading-tight cursor-pointer';
marketingConsentLabel.textContent = 'Send me product tips and updates';

marketingConsentGroup.appendChild(marketingConsentCheckbox);
marketingConsentGroup.appendChild(marketingConsentLabel);
form.insertBefore(marketingConsentGroup, consentLine);

// In submit handler — pass to signUp
const { data, error } = await authClient.signUp.email({
  email,
  password,
  name,
  callbackURL: '/dashboard',
  marketingConsent: marketingConsentCheckbox.checked,
});
```

### Anti-Patterns to Avoid

- **Await the Loops call directly in the hook:** This blocks the auth response and makes registration fail if Loops is down. Always use `void ... .catch()`.
- **Store userId + Loops event in the same log line:** Violates the ZK invariant. Log Loops errors with only `err.message`, no user identifier.
- **Call `createContact()` then `sendEvent()` separately:** `sendEvent()` with `contactProperties` creates-or-updates the contact atomically. Two API calls waste a round trip and add failure modes.
- **Managing sequence delays in app code:** Never build a cron table for "send day-3 email to user X". Loops owns the schedule. The app fires one event.
- **Passing `userId` to Loops:** Only pass `email` and `contactProperties`. Loops is an external system — no internal IDs should be shared.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email scheduling (day 0/3/7 delays) | `scheduled_emails` DB table + cron job + retry logic | Loops loop builder with timer nodes | Loops handles retry, unsubscribe, duplicate-send prevention, timezone-correct delivery |
| Unsubscribe footer on marketing emails | Custom unsubscribe link management | Loops automatic unsubscribe footer | Loops appends compliant unsubscribe links to all loop emails automatically |
| Pro user suppression for day-7 | Time-of-send DB query to check subscription tier | Loops audience filter on `subscriptionTier` contact property | The filter runs at send time inside Loops — app just needs to update the contact property on upgrade |
| Email template HTML | Server-side HTML builder | Loops email editor | Welcome, day-3, day-7 emails are authored inside Loops UI with variable substitution (`{{firstName}}`) |

**Key insight:** Loops is purpose-built for exactly this use case (SaaS onboarding sequences). Fighting it with in-app scheduling would add 3-4x the complexity for no benefit.

---

## Common Pitfalls

### Pitfall 1: Blocking Registration on Loops Failure

**What goes wrong:** `databaseHooks.user.create.after` is async but not awaited properly — if the hook throws, Better Auth may propagate the error and make registration appear to fail.
**Why it happens:** Developer awaits the Loops call directly inside the hook body.
**How to avoid:** Pattern is `void someAsyncFn().catch(logError)` — fire-and-forget with error capture.
**Warning signs:** Integration test for registration fails when Loops mock throws.

### Pitfall 2: v5 vs v6 SDK API Mismatch

**What goes wrong:** Using positional arguments to `createContact()` or `sendEvent()` from v5 examples — v6 uses a single object parameter.
**Why it happens:** Most online examples predate the v6 breaking change (Aug 2025).
**How to avoid:** `await loops.sendEvent({ email, eventName, contactProperties })` — always object syntax. STATE.md already flags this.
**Warning signs:** TypeScript errors on the `loops.sendEvent()` call.

### Pitfall 3: marketingConsent Checkbox Unchecked Default Not Enforced Server-Side

**What goes wrong:** Browser sends `false` for the checkbox, but server defaults the field to `true` or ignores the value.
**Why it happens:** `additionalFields` defaultValue is `false` — but only applies if the field is absent from the payload, not if `false` is explicitly sent.
**How to avoid:** Better Auth passes `input: true` field values through; `false` sent from client is stored as `false`. Verify with integration test: register with `marketingConsent: false`, confirm `users.marketing_consent = false` in DB.
**Warning signs:** All registrations show `marketing_consent = true` in the database.

### Pitfall 4: Zero-Knowledge Invariant Violation in Logs

**What goes wrong:** Error log for a Loops failure includes `userId` in the same log entry.
**Why it happens:** Developer logs `{ userId, error }` to provide context for debugging.
**How to avoid:** Log only `{ err: err.message }` — no userId in the Loops error log. The ZK invariant (INVARIANTS.md) prohibits combining userId with any identifying info in logs.
**Warning signs:** Pino log line contains both `user_id` and Loops-related fields.

### Pitfall 5: Drizzle Bug #4147 — FK + Column in Same Migration

**What goes wrong:** If `drizzle-kit generate` produces a migration with both a new column AND a constraint referencing it, the migration fails.
**Why it happens:** Known Drizzle bug — CREATE TABLE + ADD CONSTRAINT in same file is problematic.
**How to avoid:** `marketingConsent` is a simple boolean with no FK — this pitfall does NOT apply. But verify the generated SQL before running `db:migrate`.
**Warning signs:** `npm run db:migrate` fails with "column does not exist" or FK constraint error.

### Pitfall 6: Day-7 Pro Suppression Race Condition

**What goes wrong:** User upgrades to Pro on day 6 but the Loops contact still has `subscriptionTier: 'free'`, so the day-7 email sends to a paying customer.
**Why it happens:** The Loops contact update on Pro upgrade was forgotten or failed silently.
**How to avoid:** Call `loops.updateContact({ email, properties: { subscriptionTier: 'pro' } })` inside `activatePro()` in `billing.service.ts`. Use `.catch()` to not block billing.
**Warning signs:** UAT or QA shows Pro users receiving upgrade emails.

### Pitfall 7: Better Auth additionalFields TypeScript Access

**What goes wrong:** TypeScript cannot narrow the `user` object in `databaseHooks.user.create.after` to include `marketingConsent` — type comes out as `User` without the additional field.
**Why it happens:** Better Auth's inferred types for `databaseHooks` may not reflect `additionalFields` without explicit type augmentation.
**How to avoid:** Use type assertion `(user as User & { marketingConsent: boolean }).marketingConsent ?? false` in the hook body. Or access `user.marketingConsent as boolean | undefined`.
**Warning signs:** TypeScript error "Property 'marketingConsent' does not exist on type 'User'".

---

## Code Examples

Verified patterns from official sources:

### Loops SDK v6 sendEvent (single-object API)
```typescript
// Source: https://loops.so/docs/sdks/javascript (verified Feb 2026)
await loops.sendEvent({
  email: 'user@example.com',
  eventName: 'registered',
  contactProperties: {
    firstName: 'Alice',
    marketingConsent: true,
    subscriptionTier: 'free',
  },
});
```

### Loops SDK v6 updateContact
```typescript
// Source: https://loops.so/docs/sdks/javascript (verified Feb 2026)
await loops.updateContact({
  email: 'user@example.com',
  properties: {
    subscriptionTier: 'pro',
  },
});
```

### Better Auth databaseHooks user create after
```typescript
// Source: https://www.better-auth.com/docs/concepts/database (verified Feb 2026)
export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Side effects only — return value is ignored by Better Auth
        },
      },
    },
  },
});
```

### Better Auth additionalFields — boolean with input
```typescript
// Source: https://www.better-auth.com/docs/concepts/database (verified Feb 2026)
export const auth = betterAuth({
  user: {
    additionalFields: {
      marketingConsent: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
});
```

### Drizzle schema column for marketingConsent
```typescript
// Manual addition to server/src/db/schema.ts users table
// (Project uses manual schema.ts + drizzle-kit generate, not BA CLI)
marketingConsent: boolean('marketing_consent').notNull().default(false),
```

### Migration SQL (expected output from drizzle-kit generate)
```sql
-- drizzle/0006_add_marketing_consent.sql
ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loops v5 positional args: `createContact(email, props)` | Loops v6 single-object: `createContact({ email, properties })` | Aug 2025 (v6.0.0) | Breaking — must use object syntax |
| Better Auth no hooks | `databaseHooks.user.create.after` | Better Auth 1.x stable | Standard way to run post-registration side effects |

**Deprecated/outdated:**
- Loops v5 positional argument API: replaced by v6 single-object API — do not follow pre-Aug-2025 examples from blogs or Stack Overflow.

---

## Open Questions

1. **LOOPS_API_KEY — Live key required for dev**
   - What we know: Loops API key is account-specific, obtained from Loops dashboard API Settings
   - What's unclear: Whether a test-mode Loops key exists (Loops docs mention `@example.com` / `@test.com` domains for safe testing without affecting deliverability)
   - Recommendation: Use `@test.com` email domains in integration tests; Loops does not send real emails to these addresses. Production key needed for UAT.

2. **Loops Loop IDs — Loops UI configuration is out-of-band**
   - What we know: The app fires `eventName: 'registered'`; the Loops loop must be created in the Loops UI with a matching event trigger
   - What's unclear: Whether the loop needs to be created before or after deploying the code; no automated way to create Loops loops via API
   - Recommendation: Plan a task for manual Loops UI configuration (loop creation, email authoring, audience filters). This is a one-time human step, not a code task.

3. **activatePro() email lookup for Loops contact update**
   - What we know: `activatePro()` in `billing.service.ts` receives `stripeCustomerId`, not email. To call `loops.updateContact({ email })`, we need the user's email.
   - What's unclear: Whether `activatePro()` should do a DB lookup to get the email, or whether the Stripe webhook handler should do it before calling `activatePro()`.
   - Recommendation: Look up user email by `stripeCustomerId` inside `activatePro()` (single DB query via `eq(users.stripeCustomerId, id)`). This is already the pattern in `billing.service.ts` which looks up `userId` by `stripeCustomerId`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run server/src/routes/__tests__/ --project server` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ESEQ-01 | Registration triggers Loops `sendEvent('registered')` with correct contact properties | unit (mocked Loops) | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | ❌ Wave 0 |
| ESEQ-01 | Welcome email fires even when `marketingConsent: false` | unit (mocked Loops) | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | ❌ Wave 0 |
| ESEQ-01 | Loops API failure does NOT fail registration (silent fail) | integration (real Better Auth sign-up, Loops throws) | `npx vitest run server/src/tests/auth.test.ts --project server` | ✅ (extend existing) |
| ESEQ-02 | Contact created with `marketingConsent: true` when checkbox checked | unit (mocked Loops) | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | ❌ Wave 0 |
| ESEQ-02 | Contact created with `marketingConsent: false` when checkbox unchecked | unit (mocked Loops) | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | ❌ Wave 0 |
| ESEQ-03 | `activatePro()` calls `loops.updateContact({ subscriptionTier: 'pro' })` | unit (mocked Loops) | `npx vitest run server/src/services/billing.service.test.ts --project server` | ❌ Wave 0 |
| ESEQ-04 | Registration form has unchecked `#marketing-consent` checkbox | unit (happy-dom) | `npx vitest run client/src/pages/register.test.ts --project client` | ❌ Wave 0 |
| ESEQ-04 | `marketing_consent` column stores `false` when unchecked, `true` when checked | integration (real DB sign-up) | `npx vitest run server/src/tests/auth.test.ts --project server` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run server/src/services/onboarding.service.test.ts --project server`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/src/services/onboarding.service.test.ts` — covers ESEQ-01, ESEQ-02 (mock `loops` singleton, assert `sendEvent()` args)
- [ ] `server/src/services/billing.service.test.ts` — covers ESEQ-03 (mock `loops`, assert `updateContact()` called on `activatePro()`)
- [ ] `client/src/pages/register.test.ts` — covers ESEQ-04 (happy-dom, assert checkbox exists, is unchecked, is of type checkbox)
- [ ] `server/src/config/loops.ts` — `LoopsClient` singleton (no test file, but needed as mock target)

---

## Sources

### Primary (HIGH confidence)
- https://loops.so/docs/sdks/javascript — Loops SDK v6.2.0 method signatures, sendEvent/updateContact API
- https://www.better-auth.com/docs/concepts/database — databaseHooks user.create.after, additionalFields with input: true
- https://www.better-auth.com/docs/reference/options — Better Auth options schema confirming databaseHooks structure
- Loops loop builder docs (https://loops.so/docs/loop-builder) — timer nodes, audience filters, contact property conditions confirmed

### Secondary (MEDIUM confidence)
- https://github.com/Loops-so/loops-js — npm version 6.2.0 confirmed; v6 breaking change (single-object API) confirmed
- STATE.md project notes — `loops@6.2.0 uses v6.x createContact() single-object API — breaking change from v5; do not use v5 positional arguments` (previously researched and documented)
- Phase 34 pattern (billing.service.ts) — established pattern for fire-and-forget external service calls with `.catch()` in auth lifecycle hooks

### Tertiary (LOW confidence)
- Better Auth GitHub issues #4614, #7260 — known edge cases where `databaseHooks.user.create.after` may be skipped under social login with DB transactions in certain versions. LOW confidence because version-specific; current BA 1.4.18 behavior needs integration test verification.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — loops@6.2.0 confirmed via official docs + STATE.md; Better Auth hooks confirmed via official docs
- Architecture: HIGH — patterns verified against official Loops and Better Auth docs; mirror of Phase 34/36 patterns already in codebase
- Pitfalls: MEDIUM — v6 API breaking change confirmed; ZK invariant and Drizzle migration patterns confirmed; day-7 suppression race condition is inferred (no direct documentation)

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (Loops SDK and Better Auth are fast-moving; re-verify if > 30 days old)
