# Phase 26: Email Notifications - Research

**Researched:** 2026-02-20
**Domain:** Transactional email (Resend SDK), server-side notification dispatch, frontend opt-in toggle
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | Authenticated user can opt in to email notification when a specific secret is viewed (per-secret toggle at creation, off by default) | Frontend toggle added to create page's progressive-enhancement auth block; `notify` field already wired through CreateSecretSchema and api/client.ts; createSecret service + secrets route must be updated to persist it |
| NOTF-02 | User receives a transactional email (via Resend) when an opted-in secret is viewed and destroyed | Resend SDK already installed (v6.9.2); email.ts singleton already exists; notification must fire inside retrieveAndDestroy / verifyAndRetrieve after successful atomic destroy; requires JOIN to users table to get owner email |
| NOTF-03 | Notification email confirms permanent deletion without including secret content, recipient IP, or encryption key | Email body uses only: timestamp, human-readable "your secret was viewed" message — no secretId, no ciphertext, no label, no IP; zero-knowledge invariant governs what can appear in email payload |
</phase_requirements>

---

## Summary

Phase 26 wires up the email notification feature end-to-end. The schema foundation was fully established in Phase 23: the `notify` boolean column exists in the `secrets` table (migration 0003), the `CreateSecretSchema` Zod schema already includes `notify?: boolean`, and the frontend API client `createSecret()` already conditionally sends `notify`. What is **missing** is: (1) the backend `createSecret` service function does not yet accept or persist the `notify` parameter, (2) the secrets route does not pass `body.notify` to the service, (3) no notification email is dispatched in `retrieveAndDestroy` or `verifyAndRetrieve`, and (4) the create page's progressive-enhancement block has no UI toggle for authenticated users.

The Resend SDK (v6.9.2, already installed) is the sole email delivery mechanism. The existing `resend` singleton in `server/src/services/email.ts` and the `RESEND_FROM_EMAIL` env var are already in place and used by Better Auth for verification and password-reset emails. Phase 26 reuses this exact pattern: call `resend.emails.send()` as a fire-and-forget inside the secrets service. The email must be sent after the atomic transaction commits, not inside it, to avoid holding the transaction open during a network call.

The critical security constraint for this phase is the **zero-knowledge invariant**: the notification email must not contain a `secretId`. It can confirm that "a secret you created was viewed and destroyed" with a timestamp, but must never identify *which* secret. The lookup path is: `secrets.userId` (already on the row) → JOIN `users.email` inside the service. This JOIN happens in the same query that retrieves the secret for destruction — no second round-trip needed.

**Primary recommendation:** Add `notify` and `userId` to the column projection in `retrieveAndDestroy` and `verifyAndRetrieve`, look up the user's email via a JOIN on `users` inside those queries (select only `users.email`, no `users.id`), then dispatch the Resend email fire-and-forget after the transaction returns.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `^6.9.2` (installed) | Transactional email delivery | Already installed, used for auth emails; project convention |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `drizzle-orm` (existing) | Already in project | JOIN query to look up user email from `users` table | Needed to resolve userId → email without a second query |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fire-and-forget Resend call | Queue-based worker (Bull/BullMQ) | Queue adds Redis dependency and significant complexity; fire-and-forget matches existing auth email pattern and is acceptable for a non-critical notification |
| JOIN in destroy function | Separate `getUserEmail(userId)` helper | Two round-trips vs. one; JOIN is cleaner and atomic with the secret SELECT |

**Installation:** No new packages needed. Resend v6.9.2 is already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

No new files are strictly required. The implementation touches:

```
server/src/
├── services/
│   ├── secrets.service.ts   # Add notify param to createSecret(); add email dispatch to retrieveAndDestroy + verifyAndRetrieve
│   └── email.ts             # Existing singleton — no changes needed
├── routes/
│   └── secrets.ts           # Pass body.notify to createSecret()
client/src/
├── pages/
│   └── create.ts            # Add notify toggle to progressive-enhancement auth block
```

A new `server/src/services/notification.service.ts` file is optional but recommended for testability — it can export a single `sendSecretViewedNotification(userEmail: string, viewedAt: Date): Promise<void>` function that wraps the Resend call. This keeps the email logic isolated and easy to mock in tests.

### Pattern 1: Fire-and-Forget Email Dispatch (established project convention)

**What:** Call `resend.emails.send()` with `void` and no `await` inside the service function, after the transaction resolves. Return `Promise.resolve()` if the caller needs a `Promise<void>` signature.

**When to use:** Any non-critical transactional email that must not block the HTTP response or hold a DB transaction open.

**Example (from existing auth.ts):**
```typescript
// Source: server/src/auth.ts (existing pattern)
sendResetPassword: ({ user, url }) => {
  void resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: user.email,
    subject: 'Reset your SecureShare password',
    text: `Click to reset your password: ${toAppUrl(url)}\n\nIf you did not request this, you can ignore this email.`,
  });
  return Promise.resolve();
},
```

Phase 26 follows the identical pattern in `retrieveAndDestroy` / `verifyAndRetrieve`:
```typescript
// After transaction resolves and secret.notify && secret.userId are confirmed:
void resend.emails.send({
  from: env.RESEND_FROM_EMAIL,
  to: userEmail,   // looked up via JOIN, NOT via secretId in email body
  subject: 'Your SecureShare secret was viewed',
  text: `Your secret was viewed and permanently deleted at ${viewedAt.toISOString()}.\n\nNo further action is needed.`,
});
```

### Pattern 2: JOIN to resolve userId → email inside the destroy query

**What:** Extend the SELECT in `retrieveAndDestroy` to LEFT JOIN `users` on `secrets.userId`, projecting only `users.email`. This avoids a second DB round-trip.

**When to use:** When a service function already does a SELECT and needs a related field from another table.

**Example:**
```typescript
// Source: Drizzle ORM leftJoin pattern
const [row] = await tx
  .select({
    // ... existing secret columns ...
    notify: secrets.notify,
    userEmail: users.email,  // only email, never users.id (zero-knowledge)
  })
  .from(secrets)
  .leftJoin(users, eq(secrets.userId, users.id))
  .where(eq(secrets.id, id));
```

### Pattern 3: Frontend notify toggle (progressive enhancement)

**What:** The notify toggle is added inside the existing `void (async () => { ... })()` progressive-enhancement IIFE in `create.ts` — the same block that adds the label field. It is only injected after the auth check confirms the user is logged in.

**When to use:** Auth-only UI that must not delay the form render for anonymous users.

**Structure:**
- A `<details>` / `<summary>` collapsible block (matching the existing label field pattern), or a simple checkbox row
- A hidden `<input type="checkbox">` or a `let notifyEnabled = false` closure variable
- Submit handler reads `notifyEnabled` and passes it to `createSecret(..., label, notifyEnabled)`

### Anti-Patterns to Avoid

- **Sending email inside the DB transaction:** Holding a Postgres transaction open while awaiting a Resend HTTP call risks transaction timeouts and connection exhaustion. Always fire after the transaction resolves.
- **Including secretId in the notification email:** Violates the zero-knowledge invariant. The email must not allow the recipient to correlate the notification with a specific secret ID. Timestamp only.
- **Including label in the notification email:** Unless the user explicitly opted in to label disclosure (which NOTF-03 says is required for inclusion), the label must not appear in the email. Current requirements say "without including the secret label" — treat label as excluded.
- **Awaiting the Resend call before responding to the HTTP client:** The HTTP 200/404 response should be sent (or the ciphertext returned) without waiting for email delivery.
- **Logging userId + secretId in the same log line:** The notification dispatch code must not log both. Log only that a notification was dispatched, without any identifying fields.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery | Custom SMTP client, nodemailer | `resend` SDK (already installed) | Delivery tracking, SPF/DKIM, rate limiting, error types are handled by Resend |
| Email template rendering | String concatenation with HTML | Plain `text:` field for this notification | Notification is one sentence; no need for HTML templating at this scope |
| Retry logic | Custom exponential backoff | None needed (fire-and-forget) | Notification emails are best-effort; retry complexity not warranted for v4.0 |

**Key insight:** The Resend SDK's `emails.send()` returns `{ data, error }` — the fire-and-forget pattern with `void` means delivery failures are silently dropped. This is intentional and matches existing Better Auth email behavior in the project.

---

## Common Pitfalls

### Pitfall 1: Sending Email Inside the Database Transaction

**What goes wrong:** If `resend.emails.send()` is `await`ed inside the `db.transaction()` callback, the Postgres connection is held open for the duration of the HTTP round-trip to Resend. Under load this exhausts the connection pool and causes timeouts for all other queries.

**Why it happens:** The transaction callback is async and awaiting inside it is syntactically valid, but semantically wrong for external I/O.

**How to avoid:** Return the secret from the transaction, then dispatch the email outside the transaction block using `void`.

**Warning signs:** Transaction callback contains `await resend.emails.send()`.

### Pitfall 2: Zero-Knowledge Violation in Email Body

**What goes wrong:** Including the `secretId`, the label, or the ciphertext in the email body creates a deanonymization vector — someone with inbox access can correlate which secret was viewed.

**Why it happens:** Developers naturally want to give the user context ("your secret 'AWS keys for staging' was viewed"), but this violates NOTF-03 and the invariant.

**How to avoid:** Email body contains only: timestamp, generic "your secret was viewed and permanently deleted" message, and optionally the creation time (which is already scoped to the user's own secrets). No secretId, no label, no ciphertext.

**Warning signs:** Any interpolation of `secret.id`, `secret.label`, or `secret.ciphertext` into the email body.

### Pitfall 3: notify Persisted for Anonymous Secrets

**What goes wrong:** If `body.notify` is passed through even when `userId` is null, an anonymous secret row can have `notify: true` but no user to notify — the lookup returns null and the code must handle this gracefully.

**Why it happens:** The route doesn't enforce that `notify` can only be set when authenticated.

**How to avoid:** Two options: (a) in the route handler, only pass `body.notify` to `createSecret` when `userId` is defined; or (b) in the service, only attempt email dispatch when `secret.notify && secret.userId !== null && userEmail !== null`. Option (b) is safer (defense in depth).

**Warning signs:** `notify: true` rows with `userId: null` in the secrets table (can be verified with a DB query during testing).

### Pitfall 4: createSecret Does Not Persist notify

**What goes wrong:** The `notify` boolean is accepted by Zod schema and the API client but the `createSecret` service function signature does not include it, so it silently defaults to `false` for all secrets.

**Why it happens:** Phase 23 added the DB column and schema stubs but deferred actual wiring to Phase 26.

**How to avoid:** Phase 26 must add `notify?: boolean` to `createSecret()`'s parameter list and include it in the `.values()` insert call.

**Verification:** After implementation, create a secret with `notify: true` and query the DB to confirm `notify = true` on the row.

### Pitfall 5: Toggle Visible to Anonymous Users

**What goes wrong:** If the notify toggle is rendered before the auth check resolves, anonymous users briefly see it before it's hidden — or it remains visible due to a timing bug.

**Why it happens:** Auth check is async; DOM injection must happen only inside the `if (isSession(data))` branch.

**How to avoid:** The toggle must be created and injected only inside the existing progressive-enhancement IIFE's `isSession` guard, mirroring the label field pattern exactly.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Resend send() with error handling (Context7 verified)

```typescript
// Source: https://context7.com/resend/resend-node/llms.txt
const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: ['user@gmail.com'],
  subject: 'Welcome to Acme',
  text: 'Hello! Thanks for signing up.',
});

if (error) {
  console.error('Failed to send:', error.message);
} else {
  console.log('Email sent with ID:', data.id);
}
```

### Fire-and-forget pattern (project convention — from server/src/auth.ts)

```typescript
// Source: server/src/auth.ts (existing project pattern)
void resend.emails.send({
  from: env.RESEND_FROM_EMAIL,
  to: user.email,
  subject: 'Reset your SecureShare password',
  text: `Click to reset your password: ${toAppUrl(url)}\n\nIf you did not request this, you can ignore this email.`,
});
return Promise.resolve();
```

### Notification service function (recommended isolated helper)

```typescript
// server/src/services/notification.service.ts
import { resend } from './email.js';
import { env } from '../config/env.js';

/**
 * Sends a "secret viewed" notification email.
 * Called fire-and-forget (void) from secrets.service.ts after atomic destroy.
 *
 * ZERO-KNOWLEDGE: userEmail is the only identifier — no secretId, no label.
 * Email body confirms destruction timestamp only.
 */
export async function sendSecretViewedNotification(
  userEmail: string,
  viewedAt: Date,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: userEmail,
    subject: 'Your SecureShare secret was viewed',
    text: [
      'A secret you created on SecureShare was viewed and permanently deleted.',
      '',
      `Viewed at: ${viewedAt.toUTCString()}`,
      '',
      'No further action is needed. The encrypted data has been destroyed and cannot be recovered.',
    ].join('\n'),
  });

  if (error) {
    // Log failure but do not throw — notification is best-effort
    // Do NOT log userEmail or any secret identifier
    console.error('Failed to send secret-viewed notification:', error.message);
  }
}
```

### Extending retrieveAndDestroy to JOIN users email

```typescript
// In retrieveAndDestroy, replace the current SELECT with:
const [row] = await tx
  .select({
    id: secrets.id,
    ciphertext: secrets.ciphertext,
    expiresAt: secrets.expiresAt,
    passwordHash: secrets.passwordHash,
    passwordAttempts: secrets.passwordAttempts,
    userId: secrets.userId,
    notify: secrets.notify,
    status: secrets.status,
    label: secrets.label,
    viewedAt: secrets.viewedAt,
    createdAt: secrets.createdAt,
    userEmail: users.email,   // only email — never users.id (zero-knowledge)
  })
  .from(secrets)
  .leftJoin(users, eq(secrets.userId, users.id))
  .where(eq(secrets.id, id));

// ... after transaction resolves and secret is returned:
if (secret.notify && secret.userEmail) {
  void sendSecretViewedNotification(secret.userEmail, new Date());
}
```

### Frontend notify toggle (progressive enhancement, create.ts pattern)

```typescript
// Inside the existing void (async () => { ... })() IIFE, after isSession guard:
// (mirrors createLabelField() pattern)
function createNotifyToggle(): { element: HTMLElement; getValue: () => boolean } {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-3 border border-border rounded-lg bg-surface/80 backdrop-blur-md px-4 py-3';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = 'notify-on-view';
  checkbox.className = 'w-4 h-4 accent-accent cursor-pointer';

  const label = document.createElement('label');
  label.htmlFor = 'notify-on-view';
  label.className = 'text-sm text-text-secondary cursor-pointer select-none';
  label.textContent = 'Email me when this secret is viewed';

  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  return { element: wrapper, getValue: () => checkbox.checked };
}
```

### createSecret service signature update

```typescript
// server/src/services/secrets.service.ts
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
  password?: string,
  userId?: string,
  label?: string,
  notify?: boolean,   // ADD THIS
): Promise<Secret> {
  const expiresAt = new Date(Date.now() + DURATION_MS[expiresIn]);
  const passwordHash = password ? await hashPassword(password) : null;

  const [inserted] = await db
    .insert(secrets)
    .values({
      ciphertext,
      expiresAt,
      passwordHash,
      userId: userId ?? null,
      label: label ?? null,
      notify: notify ?? false,  // ADD THIS
    })
    .returning();

  return inserted;
}
```

### Route handler update (secrets.ts)

```typescript
// server/src/routes/secrets.ts — POST / handler
const secret = await createSecret(
  body.ciphertext,
  body.expiresIn,
  body.password,
  userId,
  body.label,
  userId ? (body.notify ?? false) : false,  // only honor notify for authenticated users
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nodemailer / custom SMTP | Resend SDK (managed delivery) | Phase 22 (auth emails) | No SMTP config, built-in bounce/complaint handling |
| `sanitize_properties` | `before_send` (PostHog) | Phase 25 | `sanitize_properties` is legacy; `before_send` is current API |

**Deprecated/outdated:**
- None for Resend SDK v6.x — the `resend.emails.send()` API is stable and matches what is already used in the project.

---

## Open Questions

1. **Should label be included in the notification email if the user set one?**
   - What we know: NOTF-03 says "without including the secret label (unless the user explicitly opted in to label inclusion)." There is no separate "opt in to label inclusion" toggle in NOTF-01.
   - What's unclear: Whether the label toggle is in scope for Phase 26 or deferred.
   - Recommendation: **Exclude label from the email in Phase 26** — treat "explicitly opted in" as a future opt-in separate from the notification toggle itself. Keeps the implementation simpler and strictly correct per NOTF-03.

2. **How should Resend be mocked in integration tests?**
   - What we know: The existing auth tests do not mock Resend — they rely on `NODE_ENV=test` which disables `requireEmailVerification`, meaning real email calls are triggered but silently dropped (no verification step is required in tests). The actual Resend API call is made with a placeholder key (`RESEND_API_KEY=re_your_api_key_here`) which will return an API error.
   - What's unclear: Whether `resend.emails.send()` with a test/invalid API key throws or returns `{ data: null, error: ... }`. Resend SDK returns `{ error }` without throwing for API-level errors (confirmed by Context7 examples), so the fire-and-forget pattern with `void` means test execution is not affected.
   - Recommendation: Use `vi.mock('../services/email.js', ...)` in notification tests to avoid real HTTP calls. For integration tests that exercise the full route (secrets.test.ts), use `vi.spyOn` on the notification service to verify it is called with the correct arguments without making a real API call.

3. **Zero-knowledge invariant — does notifying the user via email violate it?**
   - What we know: The invariant says "no DB record, log line, or analytics event may contain BOTH userId AND secretId." An email is not a DB record, log line, or analytics event.
   - What's unclear: Whether the email delivery record at Resend (their dashboard) creates a deanonymization risk.
   - Recommendation: The email body must contain no secretId. Resend's delivery record logs the recipient email and subject — neither contains a secretId. The invariant is satisfied. Update INVARIANTS.md to add an "Email (Resend)" row describing this enforcement.

---

## Sources

### Primary (HIGH confidence)

- Context7 `/resend/resend-node` — `emails.send()` API, error shape `{ data, error }`, fire-and-forget pattern
- Context7 `/llmstxt/resend_llms_txt` — idempotency keys, batch send, error handling
- `server/src/auth.ts` (existing codebase) — fire-and-forget Resend pattern with `void` + `return Promise.resolve()`
- `server/src/services/email.ts` (existing codebase) — Resend singleton export
- `server/src/db/schema.ts` (existing codebase) — `notify` column confirmed present (boolean, default false)
- `shared/types/api.ts` (existing codebase) — `notify?: boolean` already in `CreateSecretSchema`
- `client/src/api/client.ts` (existing codebase) — `createSecret()` already conditionally sends `notify`
- `drizzle/0003_add_dashboard_columns.sql` (existing codebase) — `notify` column migration confirmed applied

### Secondary (MEDIUM confidence)

- `package.json` — confirmed `"resend": "^6.9.2"` installed
- `server/src/services/secrets.service.ts` — confirmed `notify` NOT yet persisted by `createSecret()`, NOT yet read by `retrieveAndDestroy` / `verifyAndRetrieve`

### Tertiary (LOW confidence)

- None — all claims verified against codebase or Context7.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Resend already installed and in use; no new packages needed
- Architecture: HIGH — integration points fully mapped against existing code; gaps confirmed (createSecret doesn't persist notify, routes don't pass it, no email dispatch exists)
- Pitfalls: HIGH — zero-knowledge invariant well-documented; fire-and-forget pattern confirmed from existing code; transaction-boundary risk is standard and well-understood

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (Resend SDK is stable; no breaking changes expected in this window)
