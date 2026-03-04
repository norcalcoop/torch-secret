# Phase 48: Activate Custom Domain Sending - Research

**Researched:** 2026-03-04
**Domain:** Infisical env var update + end-to-end email delivery verification (Resend + Loops.so)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Zero-code scope
This is a zero-code-changes phase: only Infisical env var update and manual email delivery verification. No application files, no DNS changes, no npm packages.

#### Rollout sequencing
- Update staging Infisical environment first, verify email delivery, then update production
- Staged rollout reduces risk: if the Resend API returns unexpected errors after the env var change, it surfaces in staging before touching production traffic
- Both environments must be updated before the phase is complete (RSND-02 requires both)

#### Verification scope
- Success criteria explicitly name three email types: secret-viewed notification, subscriber confirmation, and Loops.so onboarding
- Better Auth emails (email verification on registration, password reset) also read `RESEND_FROM_EMAIL` at runtime — they are implicitly covered by the same env var change; no additional manual verification step required beyond the three named in success criteria
- Verification confirms "From" header shows `noreply@torchsecret.com` (not `onboarding@resend.dev`)

#### Loops "via" header verification
- Trigger the welcome email (fires immediately on new user registration) — if the domain is authenticated, all three sequence emails use the same Loops sending config
- Verify using Gmail "Show original" / "View raw message" to inspect `Authentication-Results` and `DKIM-Signature` headers
- Success: no `via loops.so`, no `via amazonses.com`, DKIM alignment on torchsecret.com

#### Environment update order
- Staging first → verify notification + subscriber emails arrive from noreply@torchsecret.com
- Production second → verify same email types; Loops verification can target production (fresh account registration triggers the welcome email)

### Claude's Discretion
- Which test email addresses to use (existing test accounts are acceptable; a fresh throwaway is fine for Loops)
- Whether to wait for DNS propagation (already confirmed in Phase 47 — no wait needed)
- Order in which the three email types are verified within a session
- How long to wait between staging update and verification sends (Infisical propagation is near-instant; 1–2 minutes is sufficient)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSND-02 | Admin can update RESEND_FROM_EMAIL to noreply@torchsecret.com in Infisical (staging + production) | Infisical update pattern documented: dashboard edit → server restart picks up new value. All three Resend callers (`notification.service.ts`, `subscribers.service.ts`, `auth.ts`) read `env.RESEND_FROM_EMAIL` at runtime — one env var change covers all. |
| RSND-03 | User receives transactional emails (secret-viewed notifications, subscriber confirmations) from noreply@torchsecret.com | Both email types are triggered manually (secret view event + subscriber signup). Verification is inbox inspection of From header. Phase 47 confirmed Resend API returns HTTP 200 for noreply@torchsecret.com — delivery will succeed post-env-var update. |
| LOOP-03 | User receives onboarding emails from hello@torchsecret.com without "via loops.so" header indicators | Loops domain is verified (Phase 47 LOOP-01 + LOOP-02 complete). "via" header indicators disappear automatically once the domain's DKIM aligns with the From address domain. Verification is Gmail "Show original" raw header inspection. |
</phase_requirements>

---

## Summary

Phase 48 is a pure operations phase with two parallel workstreams: (1) update `RESEND_FROM_EMAIL` in Infisical from the legacy `onboarding@resend.dev` to `noreply@torchsecret.com` for both staging and production environments, then trigger and confirm delivery of two Resend-powered email types; and (2) trigger a Loops.so welcome email and verify the raw headers show no "via" third-party indicators.

The hard prerequisites from Phase 47 are fully satisfied: Resend shows torchsecret.com as Verified (DKIM, SPF, MX all green), Loops.so domain is verified with hello@torchsecret.com active on all three sequences, and a Resend API test send from noreply@torchsecret.com already delivered to inbox (Resend ID: 5ff8d869-2ff2-4494-9900-8cdf130489d3). No code changes are needed — the application already reads `env.RESEND_FROM_EMAIL` at runtime in all four call sites (`notification.service.ts`, `subscribers.service.ts`, `auth.ts` × 2). Infisical propagation takes effect on next server restart, which is the only action required.

The Loops "via" header elimination is not gated on any env var — it is a consequence of the domain authentication completed in Phase 47. Once Loops.so sends from a DKIM-verified domain and the DKIM signature aligns with the `From: hello@torchsecret.com` header, receiving MTAs remove the "via" indicator automatically. No application change and no Loops config change is required for Phase 48.

**Primary recommendation:** Update Infisical staging env var → restart staging server → trigger two email types → verify From header → repeat for production → register a fresh account in production to trigger Loops welcome email → inspect Gmail raw headers.

---

## Standard Stack

### The Single Env Var That Drives Everything

| Env Var | Current Value | Target Value | Where Set |
|---------|---------------|--------------|-----------|
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (or similar legacy value) | `noreply@torchsecret.com` | Infisical: staging + production environments |

### Code Coverage — All Call Sites Already Use env.RESEND_FROM_EMAIL

| File | Line | Email Type | Action Needed |
|------|------|-----------|---------------|
| `server/src/services/notification.service.ts` | 23 | Secret-viewed notification | None — reads `env.RESEND_FROM_EMAIL` at runtime |
| `server/src/services/subscribers.service.ts` | 114 | Subscriber confirmation | None — reads `env.RESEND_FROM_EMAIL` at runtime |
| `server/src/auth.ts` | 79 | Password reset | None — reads `env.RESEND_FROM_EMAIL` at runtime |
| `server/src/auth.ts` | 91 | Email verification on registration | None — reads `env.RESEND_FROM_EMAIL` at runtime |

**Zero code changes needed.** All four call sites pass `env.RESEND_FROM_EMAIL` directly to `resend.emails.send({ from: ... })`. Updating the env var and restarting the server is sufficient.

### Infisical Update Pattern (Established in Prior Phases)

The pattern for Infisical env var changes is dashboard-based with server restart:

1. Log in to Infisical dashboard → Project → Environment (staging or production)
2. Find `RESEND_FROM_EMAIL` in the secrets list
3. Edit value: set to `noreply@torchsecret.com`
4. Save
5. Restart the server for that environment:
   - **Staging:** `npm run staging:up` picks up new Infisical values on each `docker-compose up` (`infisical run --env=staging -- docker-compose up`)
   - **Production:** Render.com — manual deploy or redeploy from Render dashboard triggers fresh Infisical injection

**Source:** STATE.md confirmed pattern: "RESEND_FROM_EMAIL env var is the only application-layer change — all three email callers already read it at runtime." Infisical injects env vars at process start via `infisical run --env=staging --`.

### Zod Validation — No Schema Changes Needed

`server/src/config/env.ts` already declares:
```typescript
RESEND_FROM_EMAIL: z.string().min(1),
```

The schema accepts any non-empty string. Changing the value from `onboarding@resend.dev` to `noreply@torchsecret.com` passes validation with no schema changes.

---

## Architecture Patterns

### Email Trigger Matrix — How to Trigger Each Email Type

| Email Type | Requirement | How to Trigger | Expected From Header |
|------------|-------------|----------------|----------------------|
| Secret-viewed notification | RSND-03 | 1. Create a secret with a notification email set (requires logged-in user). 2. Open the secret link from a different browser/incognito. Secret is consumed; notification fires. | `noreply@torchsecret.com` |
| Subscriber confirmation | RSND-03 | POST to `/api/subscribers` with a test email address. The double opt-in confirmation email fires immediately. | `noreply@torchsecret.com` |
| Loops welcome onboarding | LOOP-03 | Register a new user account in production. Loops sends the welcome email immediately on the `subscribed` event triggered by `confirmSubscriber()` in `subscribers.service.ts`. Alternatively: a fresh Loops `sendEvent` can be triggered by confirming a subscriber. | `hello@torchsecret.com` |

**Important distinction:** The Loops welcome email is triggered by the `subscribed` event in `subscribers.service.ts → confirmSubscriber()`, not directly by user registration in Better Auth. To reliably trigger it: subscribe a test email address via `/api/subscribers`, then confirm via the confirmation link. The `loops.sendEvent({ eventName: 'subscribed' })` call fires after confirmation.

### Verification Flow

```
STAGING ENVIRONMENT
  ↓
Infisical dashboard: update RESEND_FROM_EMAIL = noreply@torchsecret.com
  ↓
Restart staging server (staging:up)
  ↓
Trigger secret-viewed notification:
  - Create secret in staging (logged-in user with notification email)
  - Consume secret → notification fires
  - Check inbox: From = noreply@torchsecret.com ✓
  ↓
Trigger subscriber confirmation:
  - POST /api/subscribers with test email
  - Check inbox: From = noreply@torchsecret.com ✓
  ↓
PRODUCTION ENVIRONMENT
  ↓
Infisical dashboard: update RESEND_FROM_EMAIL = noreply@torchsecret.com (production)
  ↓
Redeploy production (Render.com)
  ↓
Verify same two email types in production (same trigger steps)
  ↓
LOOPS ONBOARDING VERIFICATION (targets production)
  ↓
Register a new account OR confirm a subscriber to fire the Loops 'subscribed' event
  ↓
Check inbox for Loops welcome email
  ↓
Gmail → "Show original" / "View raw message"
  ↓
Inspect Authentication-Results header:
  - DKIM: pass (d=torchsecret.com) ✓
  - No "via loops.so" ✓
  - No "via amazonses.com" ✓
```

### How "via" Headers Work — Why Phase 47 Already Fixed This

Email clients (Gmail, Apple Mail) display a "via thirdparty.com" label when the `DKIM-Signature` domain does not align with the `From:` header domain. Before Phase 47, Loops sent via `loops.so` DKIM — mismatch with `From: hello@torchsecret.com`. After Phase 47, Loops signs outbound mail with the `torchsecret.com` DKIM keys (the CNAME records now resolve to Loops/SES DKIM key endpoints under the torchsecret.com selector namespace). The "via" label disappears automatically when DKIM alignment is achieved.

**No Loops dashboard change is needed for LOOP-03.** The Loops From address was already confirmed as `hello@torchsecret.com` in Phase 47 (LOOP-02). DKIM authentication is already in place (Phase 47 LOOP-01). The welcome email simply needs to be triggered and inspected.

### Raw Email Header Inspection (Gmail)

Gmail → open the email → top-right three-dot menu → "Show original":

```
Authentication-Results: mx.google.com;
       dkim=pass header.i=@torchsecret.com header.s=<selector> header.b=<base64>;
       spf=pass (google.com: domain of bounce+...@envelope.torchsecret.com designates ... as permitted sender)
       smtp.mailfrom=bounce+...@envelope.torchsecret.com;
       dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=torchsecret.com
```

**Success indicators:**
- `dkim=pass header.i=@torchsecret.com` — DKIM signed by torchsecret.com
- No `via loops.so` in the From display (not in raw headers — the Gmail UI label)
- No `via amazonses.com` in the Gmail UI label

**Source:** Gmail "Show original" behavior — HIGH confidence based on standard email authentication UX.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email from-address configuration | Modify `notification.service.ts` to hardcode `noreply@torchsecret.com` | Update Infisical env var only | The env var pattern is exactly the design intent — hardcoding bypasses the env-var-driven configuration system |
| Delivery verification | Write a script to parse email headers | Gmail "Show original" manual inspection | This is a one-time verification step, not a recurring test — automation overhead is not justified |
| Loops From address change | Edit Loops SDK calls or add `from` parameter | Leave Loops SDK calls as-is | Loops.so uses the `hello@torchsecret.com` sender address configured in the Loops dashboard (set in Phase 47) — no code parameter controls this |

---

## Common Pitfalls

### Pitfall 1: Updating Production Before Staging is Verified

**What goes wrong:** Admin updates Infisical production env var before verifying staging delivery. If something is wrong (e.g., the domain has been de-verified, API key scope changed), production email stops working with no prior staging signal.

**Why it happens:** Staging and production look identical. It's tempting to update both at once.

**How to avoid:** Always update staging first, trigger at least one email of each type, confirm From header in inbox, then update production. The staged rollout is a locked decision in CONTEXT.md.

**Warning signs:** If Resend returns a 403 error after the env var update (`The 'noreply@torchsecret.com' from address is not allowed`), the domain is no longer verified in Resend — do not update production until resolved.

---

### Pitfall 2: Server Not Restarted After Infisical Update

**What goes wrong:** Admin updates the Infisical secret but forgets to restart the server. The running process still has the old env var value (`onboarding@resend.dev`) injected at startup time. Emails continue to come from the old address.

**Why it happens:** Infisical injects secrets at process start via `infisical run --env=...`. It does not hot-reload running processes.

**How to avoid:** After updating Infisical, restart the server before triggering verification emails. For staging: re-run `npm run staging:up`. For production: trigger a Render.com redeploy.

**Detection:** If the verification email arrives from `onboarding@resend.dev` after the Infisical update, the server was not restarted.

---

### Pitfall 3: Triggering Loops Welcome Email via New User Registration (Not Subscriber Confirm)

**What goes wrong:** To trigger the Loops welcome email, admin registers a new user account. But the Loops `subscribed` event in this codebase fires from `subscribers.service.ts → confirmSubscriber()` — not from Better Auth's `onUserCreate` hook. A fresh user registration does NOT trigger the Loops welcome sequence unless the user also subscribes and confirms via the email capture flow.

**Why it happens:** The onboarding flow in `auth.ts` uses `enrollInOnboardingSequence` from `onboarding.service.ts` — a separate Loops integration. The `subscribers.service.ts` confirmation triggers a `subscribed` event that enrolls the contact in the Loops drip sequence.

**How to avoid:** To trigger the Loops welcome sequence specifically: submit the marketing subscriber signup form (`POST /api/subscribers`), receive the confirmation email, click the confirmation link. This calls `confirmSubscriber()` which fires `loops.sendEvent({ eventName: 'subscribed' })`.

**Alternative:** If the project has a Loops test-send or preview feature in the Loops dashboard, use it to preview without triggering a real event.

---

### Pitfall 4: Inspecting Gmail UI Label Instead of Raw Headers for LOOP-03

**What goes wrong:** Admin checks whether the Gmail "via" label appears in the email list view but does not inspect raw headers. Gmail's UI "via" label is display-only and may lag behind authentication reality. Additionally, the success criterion is "no via loops.so or similar third-party service indicator in the headers" — this is specifically about raw headers, not Gmail's summarized display.

**Why it happens:** The Gmail UI is the natural first check. Raw header inspection is less intuitive.

**How to avoid:** Always use Gmail → "Show original" → inspect `Authentication-Results` and `DKIM-Signature` headers directly. The presence of `dkim=pass header.i=@torchsecret.com` in `Authentication-Results` is the authoritative success signal. The "via" UI label will not appear when DKIM passes for the From domain.

---

### Pitfall 5: Notification Email Trigger — Secret Must Have Notification Email Enabled

**What goes wrong:** Admin creates a secret in staging but does not set a notification email address on the secret. Secret is consumed but no notification email fires (notification is conditional on `userEmail` being set in the secrets table).

**Why it happens:** Secret creation without a logged-in user or without the notification option selected does not populate the notification email field.

**How to avoid:** When testing the secret-viewed notification: (1) log in as a test user in staging, (2) create a secret with "email me when viewed" enabled (or equivalent dashboard flow), (3) consume the secret from a different session. Confirm the notification email arrives at the user's email address.

**Alternative:** For subscriber confirmation verification, no logged-in user is needed — the subscriber confirmation email fires on any `POST /api/subscribers` with a valid email address.

---

## Code Examples

### Current RESEND_FROM_EMAIL Usage — Confirmed in Four Places

```typescript
// Source: server/src/services/notification.service.ts:23
const { error } = await resend.emails.send({
  from: env.RESEND_FROM_EMAIL,   // ← reads from env at call time
  to: userEmail,
  subject: 'Your Torch Secret secret was viewed',
  text: [...].join('\n'),
});

// Source: server/src/services/subscribers.service.ts:114
await resend.emails.send({
  from: env.RESEND_FROM_EMAIL,   // ← reads from env at call time
  to: email,
  subject: 'Confirm your Torch Secret subscription',
  html: buildConfirmationEmail(token),
});

// Source: server/src/auth.ts:79 (password reset)
void resend.emails.send({
  from: env.RESEND_FROM_EMAIL,   // ← reads from env at call time
  to: user.email,
  subject: 'Reset your Torch Secret password',
  text: `Click to reset your password: ...`,
});

// Source: server/src/auth.ts:91 (email verification)
void resend.emails.send({
  from: env.RESEND_FROM_EMAIL,   // ← reads from env at call time
  to: user.email,
  subject: 'Verify your Torch Secret email',
  text: `Click to verify your email: ...`,
});
```

### Loops Subscribed Event — Triggered by Subscriber Confirm

```typescript
// Source: server/src/services/subscribers.service.ts:171
// This is what triggers the Loops welcome email sequence
void loops
  .sendEvent({
    email: subscriber.email,
    eventName: 'subscribed',
    contactProperties: { source: 'email-capture' },
  })
  .catch((err: unknown) => {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'loops_subscribed_event_failed_on_confirm',
    );
  });
```

### Infisical Environment Variable Injection (from package.json)

```json
// Source: package.json
"dev:server": "infisical run --env=dev -- tsx watch server/src/server.ts",
"staging:up": "infisical run --env=staging -- docker-compose up",
```

Infisical injects `RESEND_FROM_EMAIL` and all other secrets at process start. To pick up a new value: update in Infisical dashboard → restart the process.

### Verify Current From Address Via Resend API (Staging Smoke Test)

```bash
# Smoke test before restarting — confirm staging server is serving correct env var
# (No direct endpoint exposes this, but checking Resend send logs is sufficient)

# Trigger a subscriber confirmation email to test address:
curl -X POST https://staging.torchsecret.com/api/subscribers \
  -H 'Content-Type: application/json' \
  -d '{"email": "your-test-address@example.com"}'
# Expected: {"message":"ok"} (or similar success response)
# Then: check inbox for From header
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Sending from provider default address (`onboarding@resend.dev`) | Sending from owned domain address (`noreply@torchsecret.com`) | Custom domain sending requires domain verification (Phase 47) before env var switch (Phase 48) |
| "via service.com" UI label in Gmail | No "via" label — DKIM passes for the From domain | DKIM alignment on the From domain eliminates the Gmail "via" indicator |
| Per-service hardcoded From addresses | Single `RESEND_FROM_EMAIL` env var covering all Resend email types | Centralized env var = single change to update all email types |

---

## Open Questions

1. **Current value of RESEND_FROM_EMAIL in Infisical (staging)**
   - What we know: The variable exists in Infisical (env.ts schema confirms it). The legacy value was likely `onboarding@resend.dev` or similar.
   - What's unclear: The exact current value before Phase 48 changes it.
   - Recommendation: At plan execution time, view the current Infisical staging value before updating. This gives a rollback point if needed.

2. **Whether staging has an active server to restart**
   - What we know: `npm run staging:up` uses Docker Compose with Infisical injection. The staging environment must be running to trigger email delivery.
   - What's unclear: Whether staging is currently running or needs to be started fresh.
   - Recommendation: Start staging fresh (`npm run staging:up`) after the Infisical update — this guarantees the new env var is injected.

3. **Test email address for staging verification**
   - What we know: CONTEXT.md allows existing test accounts or a fresh throwaway.
   - What's unclear: Which test accounts have notification email enabled on the staging DB.
   - Recommendation: Use the subscriber confirmation email first (no login required, most reliable trigger). For the notification email, use a staging test account that exists in the staging DB.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification only (zero-code phase — no automated test coverage applicable) |
| Config file | N/A |
| Quick run command | Check From header in received email (Gmail inbox) |
| Full suite command | Manual: trigger all 3 email types, inspect From header + Loops raw headers via Gmail "Show original" |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSND-02 | RESEND_FROM_EMAIL updated in Infisical for staging and production | manual | N/A — Infisical dashboard update, no CLI read-back command | N/A |
| RSND-03 | Secret-viewed notification arrives from noreply@torchsecret.com | manual | Trigger: create + consume secret with notification email set. Verify: inbox From header | N/A |
| RSND-03 | Subscriber confirmation arrives from noreply@torchsecret.com | manual | `curl -X POST /api/subscribers -d '{"email":"test@..."}'` then check inbox | N/A |
| LOOP-03 | Loops welcome email has no "via loops.so" raw header indicator | manual | Trigger: confirm a subscriber to fire 'subscribed' event. Verify: Gmail "Show original" → Authentication-Results | N/A |

### Sampling Rate

- **Per task:** Trigger the relevant email type and inspect inbox before marking task complete
- **Per wave:** Not applicable (single-wave phase)
- **Phase gate:** All 3 success criteria satisfied (inbox delivery confirmed from correct From address, Loops raw headers pass) before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure is not applicable to this zero-code operations phase. No test files are created or modified.

---

## Sources

### Primary (HIGH confidence)
- `server/src/services/notification.service.ts` — confirmed `env.RESEND_FROM_EMAIL` read at runtime (line 23)
- `server/src/services/subscribers.service.ts` — confirmed `env.RESEND_FROM_EMAIL` read at runtime (line 114); confirmed Loops `sendEvent('subscribed')` triggered on subscriber confirm (line 171)
- `server/src/auth.ts` — confirmed `env.RESEND_FROM_EMAIL` read at runtime (lines 79 + 91)
- `server/src/config/env.ts` — confirmed `RESEND_FROM_EMAIL: z.string().min(1)` schema (line 27)
- `package.json` — confirmed Infisical injection pattern: `infisical run --env=staging --` on staging start
- `.planning/phases/47-domain-verification-dmarc/47-02-SUMMARY.md` — confirmed Phase 47 prerequisites satisfied: Resend Verified, Loops domain verified + hello@torchsecret.com active, Resend API HTTP 200 from noreply@torchsecret.com
- `.planning/STATE.md` — confirmed: "RESEND_FROM_EMAIL env var is the only application-layer change — all three email callers (notification.service.ts, subscribers.service.ts, Better Auth) already read it at runtime"

### Secondary (MEDIUM confidence)
- CONTEXT.md locked decisions — environment update order, verification scope, Loops header inspection method

### Tertiary (LOW confidence)
- Assumption that staging Render.com / Docker Compose deployment is available for restart at plan execution time — confirm at execution

---

## Metadata

**Confidence breakdown:**
- Env var coverage (RSND-02): HIGH — all four call sites confirmed via code read; Zod schema confirmed; Infisical injection pattern confirmed
- Email delivery (RSND-03): HIGH — Phase 47 already confirmed noreply@torchsecret.com sends successfully via Resend API (HTTP 200); env var change is the only remaining step
- Loops "via" header elimination (LOOP-03): HIGH — Phase 47 domain verification (LOOP-01 + LOOP-02) is the mechanism; DKIM alignment automatically eliminates "via" label; no additional code or config change needed
- Verification procedures: HIGH — trigger methods and header inspection approach are straightforward and well-understood

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (6 months — Infisical pattern, Resend API, Loops SDK, and Gmail header behavior are all stable)
