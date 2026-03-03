---
phase: 36-email-capture
verified: 2026-02-26T12:15:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 36: Email Capture Verification Report

**Phase Goal:** Implement GDPR-compliant email capture with double opt-in, Resend integration, and all required UX states
**Verified:** 2026-02-26T12:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | INVARIANTS.md documents the marketing_subscribers system before any service code was written | VERIFIED | File contains Phase 36 row; commit `3344247` predates service code in `84a0fec` |
| 2 | The marketing_subscribers table exists in PostgreSQL with all GDPR-required columns | VERIFIED | `drizzle/0005_add_marketing_subscribers.sql` — CREATE TABLE with email, status, confirmation_token, token_expires_at, unsubscribe_token, consent_text, consent_at, ip_hash, timestamps; no userId/secretId FK |
| 3 | env.ts accepts RESEND_AUDIENCE_ID and IP_HASH_SALT as validated env vars | VERIFIED | `server/src/config/env.ts` lines 35–37: `RESEND_AUDIENCE_ID: z.string().min(1)` and `IP_HASH_SALT: z.string().min(16)` |
| 4 | subscribers.test.ts provides a scaffold covering ECAP-01 through ECAP-05 (mock Resend, real DB) | VERIFIED | 16 tests; `vi.mock('../../services/email.js', ...)` pattern present; all 16 PASS in live run |
| 5 | POST /api/subscribers with valid email + consent=true returns 200 {ok: true} | VERIFIED | `subscribers.ts` POST handler; test ECAP-01 PASSES; `z.literal(true)` enforces consent at Zod layer |
| 6 | POST /api/subscribers with consent=false returns 400 | VERIFIED | `z.literal(true)` in SubscribeSchema rejects false/undefined; test ECAP-02 PASSES |
| 7 | GET /api/subscribers/confirm?token= with valid token confirms subscriber and adds to Resend Audience | VERIFIED | `confirmSubscriber()` in service: status → 'confirmed', token cleared, `resend.contacts.create()` called with `audienceId`; test ECAP-03 PASSES |
| 8 | GET /api/subscribers/confirm?token= with expired token returns 410 | VERIFIED | Route handler returns 410 when `confirmSubscriber` returns 'expired'; expiry test PASSES |
| 9 | GET /api/subscribers/unsubscribe?token= always returns 200 (idempotent) | VERIFIED | Route always returns 200 regardless of token validity; ECAP-04 idempotent tests PASS |
| 10 | ip_hash is SHA-256(salt+IP) hex string — never plain IP; consent_text and consent_at stored | VERIFIED | `hashIp()` uses `createHash('sha256').update(env.IP_HASH_SALT + ip).digest('hex')`; ECAP-05 test asserts 64-char hex pattern |
| 11 | Homepage email capture form submits to POST /api/subscribers and replaces form with success message on 200 | VERIFIED | `handleSubmit()` in `home.ts`: `fetch('/api/subscribers', { method: 'POST', body: JSON.stringify({email, consent: true}) })`; on `res.ok` calls `replaceFormWithSuccess(section, email)` |
| 12 | In-flight state shows disabled 'Joining...' button | VERIFIED | `submitBtn.disabled = true; submitBtn.textContent = 'Joining...'` before fetch call |
| 13 | Unchecked consent blocks submission and shows inline error | VERIFIED | `if (!consentCheckbox.checked)` guard with `errorEl.textContent = 'Please check the consent box to continue.'` |
| 14 | Success message echoes submitted email | VERIFIED | `replaceFormWithSuccess()` renders: `"Check your inbox — we sent a confirmation link to ${email}. Click it to join the list..."` |
| 15 | /confirm SPA page shows loading/success/expired states | VERIFIED | `confirm.ts` exports `renderConfirmPage`; calls `GET /api/subscribers/confirm?token=`; three state renderers: `renderLoadingState`, `renderSuccessState` ("You're on the list!"), `renderExpiredState` ("Confirmation link expired") |
| 16 | /unsubscribe SPA page shows immediate unsubscribed confirmation | VERIFIED | `unsubscribe.ts` exports `renderUnsubscribePage`; always shows "You've been unsubscribed"; `You won't receive any more emails` |
| 17 | /confirm and /unsubscribe are noindex at both server (X-Robots-Tag) and client (meta robots) levels | VERIFIED | `app.ts` NOINDEX_PREFIXES includes `'/confirm'` and `'/unsubscribe'`; `router.ts` registers both routes with `noindex: true` |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/INVARIANTS.md` | ZK invariant row for marketing_subscribers | VERIFIED | Row present; "Phase 36" and "marketing_subscribers" confirmed; "Last updated: Phase 36" |
| `server/src/db/schema.ts` | `marketingSubscribers` Drizzle table + type exports | VERIFIED | Table defined lines 187–218; exports `MarketingSubscriber` and `NewMarketingSubscriber`; ZK comment updated |
| `server/src/config/env.ts` | RESEND_AUDIENCE_ID + IP_HASH_SALT in EnvSchema | VERIFIED | Both vars present; `z.string().min(1)` and `z.string().min(16)` respectively |
| `drizzle/0005_add_marketing_subscribers.sql` | CREATE TABLE marketing_subscribers migration | VERIFIED | Contains full DDL; no FK constraints (correct per ZK invariant); two indexes present |
| `server/src/routes/__tests__/subscribers.test.ts` | Integration test scaffold with vi.mock | VERIFIED | 16 tests; `vi.mock('../../services/email.js', ...)` pattern; live run: 16/16 PASS |
| `server/src/services/subscribers.service.ts` | createSubscriber, confirmSubscriber, unsubscribeByToken, hashIp, CONSENT_TEXT | VERIFIED | All five exports present; full business logic implemented (202 lines) |
| `server/src/routes/subscribers.ts` | subscribersRouter with POST /, GET /confirm, GET /unsubscribe | VERIFIED | All three routes defined; `validateBody(SubscribeSchema)` on POST; `z.literal(true)` consent enforcement |
| `client/src/pages/confirm.ts` | SPA page with loading/success/expired states | VERIFIED | Exports `renderConfirmPage`; three state functions; calls `GET /api/subscribers/confirm` |
| `client/src/pages/unsubscribe.ts` | SPA page with idempotent unsubscribed confirmation | VERIFIED | Exports `renderUnsubscribePage`; always shows success; calls `GET /api/subscribers/unsubscribe` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/routes/subscribers.ts` | `server/src/services/subscribers.service.ts` | `import { createSubscriber, confirmSubscriber, unsubscribeByToken }` | WIRED | Import present line 13–16; all three functions called in handlers |
| `server/src/app.ts` | `server/src/routes/subscribers.ts` | `app.use('/api/subscribers', subscribersRouter)` | WIRED | Import line 19; mount line 106; positioned before `/api` catch-all |
| `server/src/services/subscribers.service.ts` | `server/src/services/email.ts` | `import { resend }` + `resend.emails.send(...)` | WIRED | Import line 15; `resend.emails.send()` called in `createSubscriber`; `resend.contacts.create()` in both `confirmSubscriber` and `unsubscribeByToken` |
| `client/src/pages/home.ts` | `/api/subscribers` | `fetch('/api/subscribers', { method: 'POST' })` in `handleSubmit()` | WIRED | `fetch` call confirmed; response handling: `replaceFormWithSuccess` on `res.ok`, error state on failure |
| `client/src/pages/confirm.ts` | `/api/subscribers/confirm` | `fetch(\`/api/subscribers/confirm?token=\${token}\`)` on page load | WIRED | Fetch call in `renderConfirmPage`; result drives state rendering |
| `client/src/pages/unsubscribe.ts` | `/api/subscribers/unsubscribe` | `fetch(\`/api/subscribers/unsubscribe?token=\${token}\`)` on page load | WIRED | Fetch call in `renderUnsubscribePage`; always shows success (idempotent) |
| `client/src/router.ts` | `client/src/pages/confirm.ts` | `import('./pages/confirm.js').then(mod => mod.renderConfirmPage(container))` | WIRED | Route branch for `/confirm` at line 288; `noindex: true` present |
| `client/src/router.ts` | `client/src/pages/unsubscribe.ts` | `import('./pages/unsubscribe.js').then(mod => mod.renderUnsubscribePage(container))` | WIRED | Route branch for `/unsubscribe` at line 298; `noindex: true` present |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ECAP-01 | 36-01, 36-02, 36-03 | User can submit email address from homepage form to join the mailing list | SATISFIED | `home.ts` calls `POST /api/subscribers`; `createSubscriber` service stores pending subscriber; 16 integration tests pass including ECAP-01 test |
| ECAP-02 | 36-01, 36-02, 36-03 | Email capture form includes unchecked GDPR consent checkbox with clear consent language | SATISFIED | Consent checkbox `checked = false` by default; `z.literal(true)` Zod schema; client-side guard `if (!consentCheckbox.checked)` with inline error; ECAP-02 tests pass |
| ECAP-03 | 36-01, 36-02 | User receives double opt-in confirmation email before being added to active subscribers | SATISFIED | `createSubscriber` sends email via `resend.emails.send()`; `confirmSubscriber` transitions to 'confirmed' + calls `resend.contacts.create(audienceId)`; ECAP-03 tests pass |
| ECAP-04 | 36-01, 36-02, 36-03 | User can unsubscribe via GET /unsubscribe?token= endpoint | SATISFIED | `GET /api/subscribers/unsubscribe` always returns 200; `unsubscribeByToken` service function idempotent; `/unsubscribe` SPA page confirmed; ECAP-04 tests pass |
| ECAP-05 | 36-01, 36-02 | Marketing consent timestamp, consent text, and IP hash stored in marketing_subscribers table | SATISFIED | `ipHash = hashIp(ip)` uses SHA-256; `CONSENT_TEXT` constant stored; `consentAt` defaults to `new Date()`; ECAP-05 test asserts 64-char hex pattern and non-IP format |

**No orphaned requirements.** REQUIREMENTS.md marks all five ECAP requirements as `[x]` Complete under Phase 36. No ECAP requirements map to Phase 36 without a corresponding plan.

---

### Anti-Patterns Found

No anti-patterns found in phase 36 files.

| File | Pattern | Severity | Verdict |
|------|---------|----------|---------|
| `subscribers.service.ts` | No TODOs, stubs, or empty handlers | — | Clean |
| `subscribers.ts` | No TODOs, stubs, or empty handlers | — | Clean |
| `confirm.ts` | No TODOs, stubs, or empty returns | — | Clean |
| `unsubscribe.ts` | No TODOs, stubs, or empty returns | — | Clean |
| `home.ts` | No showToast stub remaining; real API call wired | — | Clean |

---

### Human Verification (Previously Completed)

Plan 04 was a human-verify checkpoint (blocking gate). Per the 36-04-SUMMARY.md, a human tester approved all checks on 2026-02-26:

- ECAP-01: Form submission in-flight state and success message confirmed
- ECAP-02: Consent checkbox enforcement confirmed
- ECAP-03: Confirmation email delivered via Resend; /confirm page shows "You're on the list!"
- ECAP-04: /unsubscribe page shows immediate confirmation; expired token shows correct state
- ECAP-05: DB ip_hash confirmed as 64-char hex; consent_text and consent_at present
- NOINDEX: `X-Robots-Tag: noindex, nofollow` confirmed on both /confirm and /unsubscribe HTTP responses

---

### Commit Verification

All commits documented in summaries confirmed present in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `3344247` | 36-01 Task 1 | feat(36-01): add marketingSubscribers schema + env vars + INVARIANTS.md row |
| `105db4f` | 36-01 Task 2 | feat(36-01): migration 0005 applied + subscribers.test.ts scaffold (16 RED tests) |
| `84a0fec` | 36-02 Task 1 | feat(36-02): create subscribers.service.ts with GDPR double opt-in logic |
| `a60a91d` | 36-02 Task 2 | feat(36-02): add subscribersRouter + wire into app.ts — all 16 subscriber tests green |
| `01e43c7` | 36-03 Task 1 | feat(36-03): wire home.ts API call + create confirm/unsubscribe pages |
| `5517add` | 36-03 Task 2 | feat(36-03): add /confirm and /unsubscribe routes + NOINDEX_PREFIXES |

---

## Zero-Knowledge Invariant Compliance

The marketing_subscribers table has no FK columns referencing users.id or secrets.id. The schema.ts ZK comment block was updated to include the Phase 36 enforcement point. INVARIANTS.md was updated before any service code was written (per CLAUDE.md mandate). The `hashIp()` function ensures no plain IP address is persisted. All ECAP-05 requirements are enforced at the service layer.

---

## Test Results

Live test run at verification time:

```
RUN v4.0.18

✓ server/src/routes/__tests__/subscribers.test.ts (16 tests) 137ms

Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  1.08s
```

---

_Verified: 2026-02-26T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
