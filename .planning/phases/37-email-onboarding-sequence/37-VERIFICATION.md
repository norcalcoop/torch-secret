---
phase: 37-email-onboarding-sequence
verified: 2026-03-02T21:48:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Loops loop published and active with 'registered' trigger"
    expected: "3-email sequence (welcome, day-3, day-7) active in Loops.so dashboard; welcome email personalized with {{firstName}}; CTA links correct"
    why_human: "External platform state — Loops.so has no programmatic loop-status API. Verified live by user on 2026-02-27 per 37-03-SUMMARY.md. Re-verification requires browser access to Loops dashboard."
---

# Phase 37: Email Onboarding Sequence Verification Report

**Phase Goal:** Every new account holder automatically receives a timed 3-email onboarding sequence (welcome, key features, upgrade prompt) triggered by a single Loops.so 'registered' event fired after registration.
**Verified:** 2026-03-02T21:48:00Z
**Status:** passed
**Re-verification:** No — initial verification (Phase 37 was executed 2026-02-27; VERIFICATION.md was not produced at that time; produced retroactively by Phase 43 gap-closure plan)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | New registration fires Loops `sendEvent('registered')` with email, firstName, marketingConsent, subscriptionTier | VERIFIED | `onboarding.service.ts` lines 26-34: `loops.sendEvent({ email, eventName: 'registered', contactProperties: { firstName, marketingConsent, subscriptionTier } })`. Called unconditionally for all registrations. |
| 2 | Welcome email fires for ALL registrations regardless of marketingConsent value (unconditional) | VERIFIED | `onboarding.service.ts` line 23: `enrollInOnboardingSequence` has no audience filter — `sendEvent` fires for all users. `onboarding.service.test.ts` line 81-84: explicit test "fires even when marketingConsent is false (welcome email is unconditional — ESEQ-01)" — GREEN. |
| 3 | If Loops API fails, registration still succeeds (fire-and-forget via void + .catch() pattern) | VERIFIED | `auth.ts` line 175-192: `after: (user) => { ... void enrollInOnboardingSequence(...).catch(...); return Promise.resolve(); }` — non-async hook, fire-and-forget pattern, registration never blocked by Loops failure. |
| 4 | activatePro() syncs subscriptionTier: 'pro' to Loops contact to suppress day-7 upgrade email for paying users | VERIFIED | `billing.service.ts` lines 31-46: DB select by stripeCustomerId to get email, then `void loops.updateContact({ email: proUser.email, properties: { subscriptionTier: 'pro' } }).catch(...)` — fire-and-forget. |
| 5 | Registration form has marketing consent checkbox (id='marketing-consent', unchecked by default) | VERIFIED | `register.ts` lines 158-162: `marketingConsentCheckbox.id = 'marketing-consent'`, `marketingConsentCheckbox.checked = false`. Passed to `authClient.signUp.email()` at line 254: `marketingConsent: marketingConsentCheckbox.checked`. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `drizzle/0006_add_marketing_consent.sql` | Contains "marketing_consent" column migration | VERIFIED | Line 1: `ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;` — exact pattern confirmed. |
| `server/src/db/schema.ts` | Contains "marketingConsent" field definition | VERIFIED | Line 48: `marketingConsent: boolean('marketing_consent').notNull().default(false)` — with Phase 37 comment noting ESEQ-04. |
| `server/src/auth.ts` | Contains "additionalFields" AND "databaseHooks" | VERIFIED | Line 143: `additionalFields: { marketingConsent: { type: 'boolean', required: false } }`. Line 172: `databaseHooks: { user: { create: { after: (user) => { ... } } } }` — both patterns present. |
| `client/src/pages/register.ts` | Contains "marketing-consent" checkbox, checked=false by default | VERIFIED | Line 160: `marketingConsentCheckbox.id = 'marketing-consent'`. Line 162: `marketingConsentCheckbox.checked = false // unchecked by default — GDPR (ESEQ-04)`. Passed to signUp at line 254. |
| `server/src/config/loops.ts` | Contains "LoopsClient" singleton | VERIFIED | Line 1: `import { LoopsClient } from 'loops'`. Line 10: `export const loops = new LoopsClient(env.LOOPS_API_KEY)` — singleton export. |
| `server/src/services/onboarding.service.ts` | Contains "enrollInOnboardingSequence" exported function calling loops.sendEvent | VERIFIED | Line 23: `export async function enrollInOnboardingSequence(user: OnboardingUser): Promise<void>`. Line 26: `await loops.sendEvent({ ... eventName: 'registered' ... })`. |
| `server/src/services/billing.service.ts` | Contains "updateContact" called in activatePro() | VERIFIED | Lines 31-46: `void loops.updateContact({ email: proUser.email, properties: { subscriptionTier: 'pro' } }).catch(...)` — inside `activatePro()` function. |
| `server/src/services/onboarding.service.test.ts` | Contains "enrollInOnboardingSequence" tests | VERIFIED | Line 11: `import { enrollInOnboardingSequence }`. Line 13: `describe('enrollInOnboardingSequence', ...)` — 6 test cases covering ESEQ-01/02/04. |
| `server/src/services/billing.service.test.ts` | Contains "activatePro" test | VERIFIED | Line 28: `import { activatePro }`. Line 30: `describe('activatePro — Loops contact update (ESEQ-03)', ...)` — 1 test case confirming updateContact call. |
| `client/src/pages/register.test.ts` | Contains "marketing-consent" tests | VERIFIED | Lines 29-46: 3 test cases — renders checkbox with id="marketing-consent", checkbox is unchecked by default, label text is "Send me product tips and updates". |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/src/auth.ts` | `server/src/services/onboarding.service.ts` | `enrollInOnboardingSequence` import + call | WIRED | Line 10: `import { enrollInOnboardingSequence } from './services/onboarding.service.js'`. Line 180: `void enrollInOnboardingSequence({ email, name, marketingConsent, subscriptionTier: 'free' })` — wired in `databaseHooks.user.create.after`. |
| `auth.ts` databaseHooks hook (non-async pattern) | fire-and-forget: `void + .catch()` | Non-async arrow function returning `Promise.resolve()` | WIRED | Line 175: `after: (user) => {` — NOT `async (user) =>`. Line 192: `return Promise.resolve()`. Fire-and-forget via `void` prefix on line 180 + `.catch()` on line 185. Correct pattern per CLAUDE.md note (non-async avoids @typescript-eslint/require-await). |
| `server/src/services/onboarding.service.ts` | `server/src/config/loops.ts` | `loops.sendEvent` | WIRED | Line 1: `import { loops } from '../config/loops.js'`. Line 26: `await loops.sendEvent({ email, eventName: 'registered', contactProperties: {...} })`. |
| `server/src/services/billing.service.ts` activatePro | `server/src/config/loops.ts` | `loops.updateContact` | WIRED | Lines 2 (import loops from config/loops.js inferred from billing.service.ts). Lines 31-35: `void loops.updateContact({ email: proUser.email, properties: { subscriptionTier: 'pro' } })` — confirmed in activatePro() scope. |
| `client/src/pages/register.ts` | `authClient.signUp.email()` | `marketingConsent: marketingConsentCheckbox.checked` | WIRED | Line 254: `marketingConsent: marketingConsentCheckbox.checked` — passed as named argument to signUp call. Better Auth additionalFields picks up value and stores to users.marketing_consent column. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ESEQ-01 | 37-01-PLAN.md, 37-02-PLAN.md | New account holder automatically receives welcome email immediately after registration | SATISFIED | `enrollInOnboardingSequence` fires `sendEvent('registered')` unconditionally for all users (no consent filter). `databaseHooks.user.create.after` wired in `auth.ts` line 172-194. Test "fires even when marketingConsent is false" GREEN at `onboarding.service.test.ts` line 81. |
| ESEQ-02 | 37-02-PLAN.md | New account holder receives key features email on day 3 (marketing consent required) | SATISFIED | `marketingConsent` contact property passed to Loops on every registration (`onboarding.service.ts` line 31). Day-3 audience filter (`marketingConsent=true`) enforced in Loops dashboard UI — human-verified 2026-02-27 per 37-03-SUMMARY.md. Filter evaluated at send time (not at registration), enabling real-time consent changes to take effect. |
| ESEQ-03 | 37-02-PLAN.md | New account holder receives upgrade prompt email on day 7 linking to live Stripe Checkout (marketing consent required; skipped if already Pro) | SATISFIED | `activatePro()` syncs `subscriptionTier: 'pro'` to Loops contact via `loops.updateContact()` (`billing.service.ts` lines 31-46). Day-7 dual filter (`marketingConsent=true AND subscriptionTier!=pro`) enforced in Loops dashboard UI — human-verified 2026-02-27. `billing.service.test.ts` line 46-54 confirms `updateContact` called with correct properties. |
| ESEQ-04 | 37-01-PLAN.md | Marketing consent opt-in checkbox added to registration form (gates emails 2-3 per GDPR) | SATISFIED | `register.ts` lines 158-162: `id='marketing-consent'`, `checked=false` by default. `authClient.signUp.email()` receives `marketingConsent: marketingConsentCheckbox.checked` at line 254. 3 register.test.ts tests assert checkbox presence, unchecked default, and label text — all GREEN. |

---

### Anti-Patterns Found

```
grep -n "TODO\|FIXME\|placeholder\|stub" server/src/services/onboarding.service.ts server/src/config/loops.ts
```

**Result:** No matches. No TODO, FIXME, placeholder, or stub patterns found in either file.

---

### Test Results

**Phase 37 tests — all 10 GREEN (live run 2026-03-02T21:47:52Z):**

```
 ✓ client > client/src/pages/register.test.ts > register page — marketing consent checkbox (ESEQ-04) > renders a checkbox with id="marketing-consent"  5ms
 ✓ client > client/src/pages/register.test.ts > register page — marketing consent checkbox (ESEQ-04) > checkbox is unchecked by default  1ms
 ✓ client > client/src/pages/register.test.ts > register page — marketing consent checkbox (ESEQ-04) > label text is "Send me product tips and updates"  1ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > calls loops.sendEvent with eventName "registered"  1ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > passes email as contact identifier  0ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > passes marketingConsent: true in contactProperties when opted in  0ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > passes marketingConsent: false in contactProperties when not opted in  0ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > passes firstName derived from name in contactProperties  0ms
 ✓ server > server/src/services/onboarding.service.test.ts > enrollInOnboardingSequence > fires even when marketingConsent is false (welcome email is unconditional — ESEQ-01)  0ms
 ✓ server > server/src/services/billing.service.test.ts > activatePro — Loops contact update (ESEQ-03) > calls loops.updateContact with subscriptionTier: "pro"  1ms

Test Files: 3 passed (3)
Tests:      10 passed (10)
Duration    997ms
```

**Full test suite — 376 passing, 1 todo (live run 2026-03-02T21:47:59Z):**

```
Test Files  30 passed (30)
Tests:      376 passed | 1 todo (377)
Duration    14.06s
```

Current total (376) is higher than the historical "328" from Phase 37 SUMMARY due to tests added in subsequent phases (37.1, 37.2, 37.3, 38, 39, 40, 41, 42).

---

### Human Verification (Previously Completed)

Per 37-03-SUMMARY.md, a human completed the Loops dashboard configuration and end-to-end verification on 2026-02-27:

| Item | Result |
|------|--------|
| Loops loop Active with trigger: 'registered' | CONFIRMED |
| 7-node structure (welcome → timer → filter → day-3 → timer → filter → day-7) | CONFIRMED |
| Welcome email delivered to Mailinator within ~30s | CONFIRMED |
| Subject "Hey Torchtest, welcome to Torch Secret" with firstName personalization | CONFIRMED |
| From address: hello@torchsecret.com | CONFIRMED |
| Day-7 CTA links to https://torchsecret.com/pricing | CONFIRMED |
| Day-3 node: marketingConsent=true audience filter | CONFIRMED |
| Day-7 node: marketingConsent=true AND subscriptionTier!=pro dual filter | CONFIRMED |

These items cannot be re-verified programmatically (external platform state). The code evidence (correct contact properties sent on every registration, correct Pro tier sync on upgrade) is confirmed above. Loops UI configuration was a one-time setup step.

---

## ZK Invariant Verification

**grep for "userId" OR "user_id" in onboarding.service.ts:**

```
grep -n "userId\|user_id" server/src/services/onboarding.service.ts
→ Line 21 (comment only): "ZERO-KNOWLEDGE: only email and non-identifying properties passed to Loops. No userId, no secretId."
```

**Result:** Zero code references to `userId` or `user_id` in `onboarding.service.ts`. The single match is a comment explicitly documenting the absence of userId — this confirms the invariant.

`enrollInOnboardingSequence()` accepts only:
- `email` — contact identifier for Loops (not an internal DB ID)
- `name` — display property, non-identifying for ZK purposes
- `marketingConsent` — boolean preference flag
- `subscriptionTier` — tier flag ('free' | 'pro')

No `userId`, no `secretId`, no session identifiers passed to Loops in any path.

`activatePro()` in `billing.service.ts` uses `stripeCustomerId` as the lookup key to retrieve `email` from the DB, then calls `loops.updateContact({ email })` — `userId` is never in scope in the same payload. Pattern mirrors `getOrCreateStripeCustomer()` — same ZK-safe billing isolation.

ZK invariant satisfied for all Phase 37 onboarding paths.

---

_Verified: 2026-03-02T21:48:00Z_
_Verifier: Claude (gsd-verifier, Phase 43 gap-closure)_
