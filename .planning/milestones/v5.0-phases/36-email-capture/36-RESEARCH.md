# Phase 36: Email Capture - Research

**Researched:** 2026-02-26
**Domain:** GDPR-compliant double opt-in email list capture with Resend Audiences API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary**
GDPR-compliant homepage email list capture: wire up the email capture form widget (scaffolded in Phase 32), add a `marketing_subscribers` table, integrate with Resend Audiences for double opt-in, handle token confirmation and unsubscribe flows, and build the SPA pages for /confirm and /unsubscribe. Sending newsletters or triggered sequences is out of scope (Phase 37).

**Success state UX**
- After successful form submission, replace the form with an inline confirmation message — no toast, no button state
- The message echoes the submitted email address: "Check your inbox — we sent a confirmation link to [email]. Click it to join the list. Check spam if you don't see it."
- While the API request is in-flight: spinner + disabled button with "Joining..." label
- Submit button label: Claude's discretion (pick what fits the page tone)

**Opt-in confirmation email**
- Format: minimal responsive HTML with Torch Secret wordmark and brand colors
- Subject line: Claude's discretion (optimize for clarity and deliverability)
- CTA button text: "Confirm my email"
- Token expiry: 24 hours from submission

**Edge case handling**
- Already-confirmed email: return 200, show the same "Check your inbox" success UI — no signal that the address is already on the list
- Pending-confirmation email (token not yet clicked): resend a fresh token (replace the old one), show the same "Check your inbox" success UI
- Expired or already-used confirmation token: show an error page — "This confirmation link has expired. Go back and enter your email again." with a "Back to homepage" link
- Successful confirmation (`GET /confirm?token=valid`): show a "You're on the list!" page with a "Try Torch Secret" CTA button that links to `/create`

**Unsubscribe experience**
- Rendered as an SPA route at `/unsubscribe` — client reads `?token` param, calls the unsubscribe API, shows result
- Processing is instant on page load — no "Are you sure?" confirm step
- Success message: "✓ You've been unsubscribed. You won't receive any more emails from Torch Secret." with a "Back to homepage" link
- Invalid or already-used token: show the same success message (idempotent — no state leakage)
- Layout: minimal centered card only — no nav, no footer (matches the error page pattern)

### Claude's Discretion
- Submit button label (e.g., "Join the list", "Subscribe", "Get updates")
- Subject line for confirmation email
- Exact animation/transition for the form-to-success-message swap
- HTML email template design details beyond: Torch Secret wordmark + brand colors + "Confirm my email" CTA button + 24h expiry note

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ECAP-01 | User can submit email address from homepage form to join the mailing list | POST /api/subscribers endpoint; home.ts form wiring replaces stub handler |
| ECAP-02 | Email capture form includes unchecked GDPR consent checkbox with clear consent language | Form scaffold exists in home.ts (Phase 32); backend stores consent snapshot |
| ECAP-03 | User receives double opt-in confirmation email before being added to active subscribers | nanoid token in `marketing_subscribers` table; resend.emails.send() for confirmation; GET /api/subscribers/confirm?token= promotes to confirmed |
| ECAP-04 | User can unsubscribe via `GET /unsubscribe?token=` endpoint | GET /api/subscribers/unsubscribe?token= endpoint; SPA /unsubscribe route reads query param and calls API |
| ECAP-05 | Marketing consent timestamp, consent text, and IP hash stored in `marketing_subscribers` table | Drizzle schema with `marketing_subscribers` table; SHA-256 hash of req.ip server-side |
</phase_requirements>

---

## Summary

Phase 36 wires up the email capture form scaffolded in Phase 32. The core work is: (1) a new `marketing_subscribers` Drizzle table storing GDPR-required fields, (2) a `POST /api/subscribers` endpoint that validates email + consent, stores the subscriber record with a nanoid confirmation token, and sends a Resend confirmation email, (3) a `GET /api/subscribers/confirm` endpoint that validates the token and marks the subscriber as confirmed, (4) a `GET /api/subscribers/unsubscribe` endpoint that marks the subscriber as unsubscribed, and (5) two new SPA pages (`/confirm` and `/unsubscribe`) matching the minimal centered-card pattern from the error page.

The project already has `resend@6.9.2` installed and the `resend` singleton is exported from `server/src/services/email.ts`. The Resend SDK v6.9 `contacts.create()` call requires an `audienceId` parameter — this means a `RESEND_AUDIENCE_ID` env var must be added. However, the double opt-in flow also needs a `marketing_subscribers` table in PostgreSQL (separate from Resend) to store GDPR consent evidence (timestamp, consent text snapshot, IP hash) — Resend alone cannot satisfy ECAP-05. The design choice in STATE.md notes "Use resend@6.9.2 Audiences API (resend.contacts.create()) for email list capture."

IP hashing uses Node.js built-in `crypto.createHash('sha256')` — no new dependency needed. SHA-256 of an IP address is pseudonymous under GDPR (not fully anonymous, but meets the requirement as stated in ECAP-05). For security, prepend a per-installation salt (a new env var) before hashing to prevent rainbow-table reversal of the small IPv4 space.

**Primary recommendation:** Use the existing `resend` singleton + `nanoid` token pattern for double opt-in. Add one Drizzle migration for `marketing_subscribers`. Add two routes to a new `subscribersRouter`. Add two SPA pages in the router. No new npm packages required.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | 6.9.2 (installed) | Send confirmation email; add confirmed contact to Resend Audience | Already installed; project already uses it for notifications |
| drizzle-orm | 0.45.x (installed) | `marketing_subscribers` table schema + queries | Project ORM; consistent with all other tables |
| nanoid | 5.1.6 (installed) | Generate 21-char confirmation and unsubscribe tokens | Already installed; used for secret IDs |
| node:crypto | built-in | SHA-256 IP hash for GDPR consent record | No new dep; `createHash('sha256')` is standard |
| zod | 4.3.x (installed) | Validate `POST /api/subscribers` request body | Consistent with all other API validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | 8.2.x (installed) | Rate limit POST /api/subscribers | Prevent email bombing; same pattern as secrets routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `marketing_subscribers` table | Resend Audiences only | Resend cannot store consent_text snapshot or IP hash — ECAP-05 requires our own table |
| nanoid tokens | UUID | nanoid already in project; shorter URLs |
| SHA-256 with salt | bcrypt/argon2 | IP hashing needs to be fast (sync operation); bcrypt is slow by design; SHA-256 is appropriate for pseudonymization |

**Installation:** No new packages required — all dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
server/src/
├── routes/
│   └── subscribers.ts          # POST /api/subscribers, GET /api/subscribers/confirm, GET /api/subscribers/unsubscribe
├── services/
│   └── subscribers.service.ts  # createSubscriber(), confirmSubscriber(), unsubscribeByToken()
├── db/
│   └── schema.ts               # + marketing_subscribers table
└── config/
    └── env.ts                  # + RESEND_AUDIENCE_ID, IP_HASH_SALT

drizzle/
└── 0005_add_marketing_subscribers.sql

client/src/
├── pages/
│   ├── confirm.ts              # SPA page for /confirm?token=
│   └── unsubscribe.ts          # SPA page for /unsubscribe?token=
└── router.ts                   # + /confirm and /unsubscribe routes
```

### Pattern 1: Double Opt-In with Token Lifecycle

**What:** Store subscriber as `status='pending'` with a `nanoid()` confirmation token on signup. On token click, transition to `status='confirmed'` and add to Resend Audience. Token is single-use and expires in 24 hours.

**When to use:** Any email list that requires GDPR double opt-in.

**Example:**

```typescript
// POST /api/subscribers — create pending subscriber
// Source: project pattern (nanoid for IDs, Resend for email, Drizzle for DB)

const token = nanoid(); // 21-char URL-safe token
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

await db.insert(marketingSubscribers).values({
  email,
  status: 'pending',
  confirmationToken: token,
  tokenExpiresAt: expiresAt,
  consentText: CONSENT_TEXT_SNAPSHOT,
  consentAt: new Date(),
  ipHash: hashIp(req.ip ?? ''),
}).onConflictDoUpdate({
  target: marketingSubscribers.email,
  set: {
    status: 'pending',
    confirmationToken: token,
    tokenExpiresAt: expiresAt,
    consentAt: new Date(),
    ipHash: hashIp(req.ip ?? ''),
  },
  // Only update pending rows — do not downgrade confirmed subscribers
  where: eq(marketingSubscribers.status, 'pending'),
});

await resend.emails.send({
  from: env.RESEND_FROM_EMAIL,
  to: email,
  subject: 'Confirm your Torch Secret subscription',
  html: buildConfirmationEmail(token),
});

res.json({ ok: true });
```

### Pattern 2: Idempotent Subscribe (Edge Case Handling)

**What:** The `onConflictDoUpdate` with a `where` clause handles the three email states without leaking state to the caller.

**When to use:** All three edge cases must return 200 with the same response body.

```typescript
// Already-confirmed: onConflictDoUpdate fires but WHERE clause (status='pending')
// prevents overwriting confirmed row — row unchanged, email NOT resent
// Pending-confirmation: WHERE clause matches — token replaced, new email sent
// Fresh email: INSERT succeeds — new row created, email sent

// Return 200 in all three cases:
res.json({ ok: true });
```

### Pattern 3: Token Confirm Endpoint

**What:** `GET /api/subscribers/confirm?token=` validates token, checks expiry, transitions `status` to `'confirmed'`, clears the token columns, then adds to Resend Audience.

```typescript
// GET /api/subscribers/confirm?token=xxx
const [subscriber] = await db
  .select()
  .from(marketingSubscribers)
  .where(eq(marketingSubscribers.confirmationToken, token));

if (!subscriber || subscriber.tokenExpiresAt < new Date()) {
  res.status(410).json({ error: 'token_expired' }); // 410 Gone
  return;
}

if (subscriber.status === 'confirmed') {
  res.json({ ok: true }); // Idempotent — already confirmed
  return;
}

await db.update(marketingSubscribers)
  .set({ status: 'confirmed', confirmationToken: null, tokenExpiresAt: null })
  .where(eq(marketingSubscribers.confirmationToken, token));

// Add to Resend Audience (fire-and-forget — Resend is best-effort)
void resend.contacts.create({
  email: subscriber.email,
  unsubscribed: false,
  audienceId: env.RESEND_AUDIENCE_ID,
}).catch(console.error);

res.json({ ok: true });
```

### Pattern 4: Unsubscribe Endpoint

**What:** `GET /api/subscribers/unsubscribe?token=` is idempotent — always returns success, even for expired/unknown tokens (no state leakage per CONTEXT.md).

```typescript
// GET /api/subscribers/unsubscribe?token=xxx
const [subscriber] = await db
  .select()
  .from(marketingSubscribers)
  .where(eq(marketingSubscribers.unsubscribeToken, token));

if (subscriber) {
  await db.update(marketingSubscribers)
    .set({ status: 'unsubscribed' })
    .where(eq(marketingSubscribers.unsubscribeToken, token));

  // Update Resend Audience (fire-and-forget)
  void resend.contacts.create({
    email: subscriber.email,
    unsubscribed: true,
    audienceId: env.RESEND_AUDIENCE_ID,
  }).catch(console.error);
}

// Always 200 — idempotent
res.json({ ok: true });
```

### Pattern 5: IP Hashing (GDPR — ECAP-05)

**What:** SHA-256 hash of salted IP address. Salt prevents rainbow-table reversal of the small IPv4 space.

```typescript
// server/src/services/subscribers.service.ts
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(env.IP_HASH_SALT + ip)
    .digest('hex');
}
```

### Pattern 6: SPA Pages (/confirm and /unsubscribe)

**What:** Both pages follow the error page pattern — minimal centered card, no nav, no footer. They read `?token` from `window.location.search`, call the API on page load, and render state based on response.

```typescript
// client/src/pages/confirm.ts — skeleton
export async function renderConfirmPage(container: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    renderExpiredState(container);
    return;
  }

  // Show spinner while API call is in flight
  renderLoadingState(container);

  try {
    const res = await fetch(`/api/subscribers/confirm?token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      renderExpiredState(container); // token_expired or any error
      return;
    }
    renderSuccessState(container); // "You're on the list!"
  } catch {
    renderExpiredState(container);
  }
}
```

### Pattern 7: Home.ts Form Wiring

**What:** Replace the Phase 32 stub `showToast()` handler with a real API call. Swap form for success message on API response.

```typescript
// In createEmailCaptureSection() — replace stub submit handler
form.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  if (!email) { /* ... existing validation */ return; }
  if (!consentCheckbox.checked) { /* ... existing validation */ return; }

  // In-flight state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Joining...';

  try {
    const res = await fetch('/api/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, consent: true }),
    });
    // Always replace form with success message (200 = all edge cases)
    if (res.ok) {
      replaceFormWithSuccess(section, email);
    } else {
      // Show inline error for network-level failures
      submitBtn.disabled = false;
      submitBtn.textContent = 'Join the list';
      errorEl.textContent = 'Something went wrong. Please try again.';
      errorEl.classList.remove('hidden');
    }
  } catch {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Join the list';
    errorEl.textContent = 'Something went wrong. Please try again.';
    errorEl.classList.remove('hidden');
  }
});
```

### Anti-Patterns to Avoid

- **Sending to unconfirmed subscribers:** Never call `resend.contacts.create({ unsubscribed: false })` until the confirmation token is clicked. Resend does not enforce double opt-in itself.
- **Leaking subscriber status in API responses:** POST /api/subscribers must return 200 for all three states (fresh, pending, confirmed). Never return a 409 Conflict — this reveals whether an email is already on the list.
- **Storing unsubscribe tokens that also function as confirmation tokens:** Use separate `confirmationToken` and `unsubscribeToken` columns. Unsubscribe token should be generated at confirmation time (persists permanently), not at signup.
- **Using crypto.getRandomValues in Node:** Use `nanoid` (already imported) or `crypto.randomBytes` for server-side token generation. Not Web Crypto API — that's browser-only.
- **Drizzle bug #4147:** After `db:generate`, inspect the migration SQL. If both a new column and its FK are in the same file, split them. The `marketing_subscribers` table has no FK constraints (email is standalone), so this is not a risk here, but confirm after generation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP client | `resend` (already installed) | Deliverability, retries, rate limits already handled |
| Cryptographic token generation | `Math.random()` based IDs | `nanoid` (already installed) | Cryptographically secure, URL-safe, already in project |
| IP hashing | Third-party hash library | `node:crypto` `createHash('sha256')` | Built-in, no dep, sufficient for pseudonymization |
| Email HTML template | External template engine | Plain TypeScript string (same pattern as SSR pages in Phase 35) | Zero new deps; project already has this pattern |
| Resend Audience sync | Complex queue system | Fire-and-forget `void resend.contacts.create(...).catch()` | Resend is not the source of truth; local DB is |

**Key insight:** The `marketing_subscribers` table is the authoritative GDPR record. Resend Audiences is a best-effort sync layer for sending broadcasts. The two must remain in sync but the local DB always wins.

---

## Common Pitfalls

### Pitfall 1: Resend Contacts API — audience_id requirement discrepancy

**What goes wrong:** The official Resend docs page suggests `audienceId` is not required (contacts are "global entities"), but the Node SDK `contacts.create()` signature in the SDK source code requires `audienceId`. Calling without it will cause a runtime error or API rejection.

**Why it happens:** Resend has been migrating contacts to a "global" model, but the v6.9.2 SDK still expects `audienceId` for the `create` method.

**How to avoid:** Always pass `audienceId: env.RESEND_AUDIENCE_ID` in every `resend.contacts.create()` call. Add `RESEND_AUDIENCE_ID` to the Zod env schema as a required string.

**Warning signs:** TypeScript type error if `audienceId` is missing; Resend API 422 error at runtime.

### Pitfall 2: Resend `contacts.create()` Is Upsert Behavior

**What goes wrong:** If a contact already exists in the Resend Audience, `contacts.create()` upserts (updates) the existing record. Calling it with `unsubscribed: true` for a confirmed subscriber will un-confirm them in Resend.

**Why it happens:** Resend treats email as the unique identifier per audience.

**How to avoid:** Only call `contacts.create({ unsubscribed: false })` on confirmed token click. Never call it on initial form submission. On unsubscribe, call `contacts.create({ unsubscribed: true })`.

**Warning signs:** Subscribers appear unsubscribed in Resend dashboard immediately after signing up.

### Pitfall 3: Token Timing Attack — Constant-Time Comparison

**What goes wrong:** Using `===` for token comparison allows timing attacks — an attacker can measure response time to enumerate valid token prefixes.

**Why it happens:** String comparison short-circuits on first mismatch.

**How to avoid:** For security-sensitive tokens, use `crypto.timingSafeEqual`. However, for a 21-char nanoid email subscription token (not a password or session), the practical risk is minimal. Use a database lookup by exact token value — the DB index lookup is not timing-sensitive in this context.

**Warning signs:** Not applicable here since the token lives in a DB `WHERE` clause.

### Pitfall 4: NOINDEX for /confirm and /unsubscribe

**What goes wrong:** SPA routes `/confirm` and `/unsubscribe` get indexed by search engines, exposing token query parameters in search results.

**Why it happens:** The SPA catch-all serves index.html for all paths. The `NOINDEX_PREFIXES` array in `app.ts` controls `X-Robots-Tag` for server-rendered HTML.

**How to avoid:** Add `/confirm` and `/unsubscribe` to the `NOINDEX_PREFIXES` array in `server/src/app.ts`. Also set `noindex: true` in `updatePageMeta()` calls in the router for both new routes.

**Warning signs:** Google Search Console shows `/confirm?token=...` URLs being crawled.

### Pitfall 5: ZK Invariant — Marketing Subscribers Must Never Join userId + secretId

**What goes wrong:** If a future phase links a `marketing_subscribers` row to a user account (e.g., setting an email as both a subscriber and a user), the ZK invariant could be violated if the same record also contains a `secretId`.

**Why it happens:** `marketing_subscribers` stores email; `users` stores email — they could be joined to resolve identity.

**How to avoid:** The `marketing_subscribers` table must NEVER store a `userId`, `secretId`, or any column that joins to the secrets table. It is a standalone GDPR record. Update `INVARIANTS.md` before implementing to document this system.

**Warning signs:** Any query that joins `marketing_subscribers` with `secrets` or `users` in the same result set.

### Pitfall 6: Already-Confirmed Edge Case With onConflictDoUpdate

**What goes wrong:** Using `onConflictDoUpdate` without a `where` clause overwrites a confirmed subscriber's row (resetting status to `pending`, replacing tokens) when they re-submit the form.

**Why it happens:** Drizzle's `onConflictDoUpdate` without `where` updates unconditionally.

**How to avoid:** Add `.where(eq(marketingSubscribers.status, 'pending'))` to the conflict clause. This means only pending rows get updated; confirmed rows remain unchanged and no new email is sent.

**Warning signs:** Confirmed subscribers receive a second confirmation email when they re-submit the form.

---

## Code Examples

### marketing_subscribers Drizzle Schema

```typescript
// server/src/db/schema.ts — add after existing tables
// Source: project Drizzle patterns from Phase 34 (schema.ts)

export const marketingSubscribers = pgTable(
  'marketing_subscribers',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    email: text('email').notNull().unique(),
    status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'unsubscribed'
    /** 21-char nanoid — cleared after confirmation; NULL if confirmed */
    confirmationToken: text('confirmation_token'),
    /** Expiry for confirmationToken (24h from creation) */
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    /** 21-char nanoid — generated at confirmation time; used in unsubscribe links */
    unsubscribeToken: text('unsubscribe_token').unique(),
    /** Snapshot of the consent text shown at signup — GDPR evidence */
    consentText: text('consent_text').notNull(),
    /** UTC timestamp when consent was given */
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
    /** SHA-256(salt + IP) — pseudonymous IP for GDPR record; never plain IP */
    ipHash: text('ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('marketing_subscribers_confirmation_token_idx').on(table.confirmationToken),
    index('marketing_subscribers_unsubscribe_token_idx').on(table.unsubscribeToken),
  ],
);
```

### Env Schema Addition

```typescript
// server/src/config/env.ts — add to EnvSchema
// Source: existing env.ts pattern

// === Email Capture (Phase 36) ===
RESEND_AUDIENCE_ID: z.string().min(1),
/** Salt for SHA-256 IP hashing — prevents rainbow-table reversal of IPv4 space */
IP_HASH_SALT: z.string().min(16),
```

### Consent Text Snapshot (GDPR ECAP-05)

```typescript
// server/src/routes/subscribers.ts
// The exact text must be snapshotted at submit time — if the UI copy changes later,
// the DB record reflects what the user actually consented to.

export const CONSENT_TEXT =
  'I agree to receive product updates and marketing emails from Torch Secret. ' +
  'You can unsubscribe at any time. See our Privacy Policy.';
```

### Route Handler Shape

```typescript
// server/src/routes/subscribers.ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate.js';
import { z } from 'zod';

export const subscribersRouter = Router();

const SubscribeSchema = z.object({
  email: z.string().email().max(254),
  consent: z.literal(true), // Must be explicitly true; false is rejected by Zod
});

subscribersRouter.post('/', validateBody(SubscribeSchema), async (req, res) => {
  // ... createSubscriber service call
});

subscribersRouter.get('/confirm', async (req, res) => {
  const token = req.query['token'];
  if (typeof token !== 'string' || !token) {
    res.status(400).json({ error: 'missing_token' });
    return;
  }
  // ... confirmSubscriber service call
});

subscribersRouter.get('/unsubscribe', async (req, res) => {
  const token = req.query['token'];
  if (typeof token !== 'string' || !token) {
    res.json({ ok: true }); // Idempotent — missing token still shows success
    return;
  }
  // ... unsubscribeByToken service call
});
```

### Router Additions (client/src/router.ts)

```typescript
// Add to handleRoute() in router.ts — before the else branch
} else if (path === '/confirm') {
  updatePageMeta({
    title: 'Confirm Your Email',
    description: 'Confirm your email to join the Torch Secret mailing list.',
    noindex: true,
  });
  import('./pages/confirm.js')
    .then((mod) => mod.renderConfirmPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
} else if (path === '/unsubscribe') {
  updatePageMeta({
    title: 'Unsubscribed',
    description: 'You have been unsubscribed from Torch Secret emails.',
    noindex: true,
  });
  import('./pages/unsubscribe.js')
    .then((mod) => mod.renderUnsubscribePage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
```

### HTML Email Template Pattern (Resend)

```typescript
// server/src/services/subscribers.service.ts
// Source: Resend docs + Phase 35 SSR string-template pattern

function buildConfirmationEmail(token: string, appUrl: string): string {
  const confirmUrl = `${appUrl}/confirm?token=${encodeURIComponent(token)}`;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:32px 16px">
      <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:12px;padding:32px;border:1px solid #334155">
        <h1 style="font-size:20px;font-weight:600;margin:0 0 8px;color:#f1f5f9">Torch Secret</h1>
        <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">Confirm your subscription</p>
        <p style="margin:0 0 24px;color:#e2e8f0">Click below to confirm your email and join the Torch Secret list. This link expires in 24 hours.</p>
        <a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;font-weight:600;text-decoration:none">Confirm my email</a>
        <p style="margin:24px 0 0;font-size:12px;color:#64748b">If you did not sign up, you can ignore this email.</p>
      </div>
    </body>
    </html>
  `;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Resend contacts require `audienceId` always | Resend is migrating contacts to be global (no audienceId needed) | Mid-2024 | SDK v6.9.2 still requires audienceId in TypeScript types; pass it to be safe |
| Storing plain IP for GDPR consent | Store SHA-256(salt+IP) hash | GDPR 2018+ | Pseudonymous; satisfies "no plain-text IPs" in ECAP-05 |
| Single opt-in (direct subscribe) | Double opt-in (confirmation email required) | GDPR enforcement ~2020+ | Required for EU marketing compliance |

**Deprecated/outdated:**
- `resend.contacts.create()` without `audienceId`: was valid in an earlier API version; v6.9.2 SDK type requires it.
- Storing raw `req.ip` in marketing tables: non-compliant with GDPR Article 5(1)(c) data minimization principle.

---

## Open Questions

1. **RESEND_AUDIENCE_ID value for development/CI**
   - What we know: The env var is required by the SDK but the Resend API is not called in tests (mocked)
   - What's unclear: Does CI already have a placeholder RESEND_AUDIENCE_ID? (TECH-01 added placeholder env vars for CI)
   - Recommendation: Add `RESEND_AUDIENCE_ID=aud_test_placeholder` and `IP_HASH_SALT=test-salt-min-16-chars` to `.env.example` and any CI placeholder env var block. Mark both as optional with `.optional()` in the Zod schema only if tests mock Resend completely.

2. **Drizzle bug #4147 risk for migration**
   - What we know: Bug only manifests when a migration adds a column AND a FK constraint referencing it in the same file. `marketing_subscribers` has no FK constraints.
   - What's unclear: Nothing — this risk does not apply here.
   - Recommendation: Standard `db:generate` + `db:migrate` workflow; inspect generated SQL but no split needed.

3. **INVARIANTS.md extension before coding**
   - What we know: CLAUDE.md mandates extending INVARIANTS.md before adding any new table or system.
   - What's unclear: Nothing — this is a required first step.
   - Recommendation: Wave 0 Plan 01 must start with extending `INVARIANTS.md` to document the `marketing_subscribers` table invariant: the table stores email but no `userId` or `secretId`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ECAP-01 | POST /api/subscribers with valid email + consent returns 200 | integration | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` | ❌ Wave 0 |
| ECAP-02 | POST /api/subscribers with unchecked consent (consent: false) returns 400 | integration | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` | ❌ Wave 0 |
| ECAP-03 | POST /api/subscribers triggers mock resend.emails.send; GET /api/subscribers/confirm?token= valid → 200 | integration | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` | ❌ Wave 0 |
| ECAP-04 | GET /api/subscribers/unsubscribe?token= valid → 200; invalid token → still 200 | integration | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` | ❌ Wave 0 |
| ECAP-05 | Confirmed: `marketing_subscribers` row has non-null `ip_hash`, `consent_text`, `consent_at`; `ip_hash` is hex string not raw IP | integration | `npx vitest run server/src/routes/__tests__/subscribers.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run server/src/routes/__tests__/subscribers.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/routes/__tests__/subscribers.test.ts` — covers ECAP-01 through ECAP-05
  - Must mock `resend.emails.send` and `resend.contacts.create` (same `vi.mock` pattern as `notification.service.ts` in secrets.test.ts)
  - Requires real DB (`marketing_subscribers` table must exist from migration)
  - `beforeEach`: `await db.delete(marketingSubscribers)`
  - `afterAll`: `await pool.end()`

---

## Sources

### Primary (HIGH confidence)

- Resend official docs — https://resend.com/docs/api-reference/contacts/create-contact — contacts.create() parameters and response
- Resend GitHub double opt-in example — https://github.com/resend/resend-double-opt-in-example — confirmed double opt-in flow pattern (add as unsubscribed, update on confirm)
- Project source: `server/src/services/email.ts` — `resend` singleton already exported
- Project source: `server/src/services/notification.service.ts` — fire-and-forget Resend pattern + vi.mock test pattern
- Project source: `server/src/db/schema.ts` — Drizzle table definition patterns (nanoid, timestamps, indexes)
- Project source: `client/src/pages/home.ts` — Phase 32 email capture form scaffold (exact DOM structure to wire)
- Project source: `client/src/pages/error.ts` — minimal centered card pattern for /confirm and /unsubscribe pages
- Project source: `client/src/router.ts` — how to add new SPA routes
- Project source: `server/src/app.ts` — NOINDEX_PREFIXES, middleware ordering
- Project source: `package.json` — `resend@6.9.2` confirmed installed

### Secondary (MEDIUM confidence)

- DeepWiki Resend Node SDK — https://deepwiki.com/resend/resend-node/6-audience-management — confirms `audienceId` is required in SDK contacts.create()
- GDPR SHA-256 IP hash guidance — multiple sources confirm: hashed IPs are pseudonymous (not anonymous); salting prevents rainbow-table reversal of IPv4 space

### Tertiary (LOW confidence)

- Resend blog "New Contacts Experience" — suggests contacts becoming global (no audienceId), but SDK 6.9.2 types still require it — flag for validation when running

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed in project; Resend singleton already exported
- Architecture: HIGH — confirmed patterns from existing routes (billing.ts, secrets.ts, error.ts, home.ts)
- Pitfalls: HIGH — ECAP-05 and ZK invariant requirements are well-defined; Resend behavior confirmed from official docs

**Research date:** 2026-02-26
**Valid until:** 2026-03-28 (30 days — Resend SDK is stable; GDPR requirements are stable)
