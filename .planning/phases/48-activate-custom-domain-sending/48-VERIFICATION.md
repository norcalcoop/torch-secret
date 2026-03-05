---
phase: 48-activate-custom-domain-sending
verified: 2026-03-05T00:00:00Z
status: human_needed
score: 4/8 must-haves verified (all 4 code-verifiable truths pass; 4 live-system truths require human confirmation)
human_verification:
  - test: "Confirm RESEND_FROM_EMAIL = noreply@torchsecret.com in Infisical staging environment"
    expected: "Infisical dashboard — staging environment — RESEND_FROM_EMAIL shows value noreply@torchsecret.com"
    why_human: "Infisical secrets are not stored in the codebase. There is no API, CLI read-back, or file that exposes the current Infisical secret value. Must be read from the Infisical dashboard."
  - test: "Confirm RESEND_FROM_EMAIL = noreply@torchsecret.com in Infisical production environment"
    expected: "Infisical dashboard — production environment — RESEND_FROM_EMAIL shows value noreply@torchsecret.com"
    why_human: "Same as staging — Infisical secret values are not accessible from the codebase."
  - test: "Trigger subscriber confirmation and secret-viewed notification emails and verify From header in inbox"
    expected: "Both emails arrive in inbox with From: noreply@torchsecret.com (not onboarding@resend.dev)"
    why_human: "Email delivery and From header inspection require a live Resend-connected server and inbox access. Not machine-verifiable from codebase."
  - test: "Trigger Loops.so welcome email and inspect Gmail raw headers"
    expected: "Gmail 'Show original' Authentication-Results shows dkim=pass header.i=@torchsecret.com with no 'via loops.so' or 'via amazonses.com' relay indicator in the From display"
    why_human: "DKIM pass/fail and relay indicators appear only in raw email headers delivered to an inbox. Cannot be verified from codebase or DNS queries alone."
---

# Phase 48: Activate Custom Domain Sending — Verification Report

**Phase Goal:** All outbound application email sends from noreply@torchsecret.com instead of onboarding@resend.dev, and Loops.so onboarding emails send from hello@torchsecret.com without third-party header indicators.
**Verified:** 2026-03-05
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status      | Evidence                                                                                                          |
|----|-----------------------------------------------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------|
| 1  | RESEND_FROM_EMAIL env var is wired at call time in notification.service.ts                    | VERIFIED    | Line 23: `from: env.RESEND_FROM_EMAIL` — runtime read confirmed in codebase                                     |
| 2  | RESEND_FROM_EMAIL env var is wired at call time in subscribers.service.ts                     | VERIFIED    | Line 114: `from: env.RESEND_FROM_EMAIL` — runtime read confirmed in codebase                                    |
| 3  | Loops subscribed event fires from confirmSubscriber() after confirmation link click            | VERIFIED    | Lines 171-182: `loops.sendEvent({ eventName: 'subscribed' })` inside confirmSubscriber — substantive wiring     |
| 4  | env.ts Zod schema declares RESEND_FROM_EMAIL as a required validated env var                  | VERIFIED    | env.ts line 27: `RESEND_FROM_EMAIL: z.string().min(1)` — injected by Infisical at process start                |
| 5  | RESEND_FROM_EMAIL = noreply@torchsecret.com in Infisical staging environment                  | HUMAN NEEDED | Cannot verify Infisical secret values from codebase — requires dashboard inspection                              |
| 6  | RESEND_FROM_EMAIL = noreply@torchsecret.com in Infisical production environment               | HUMAN NEEDED | Cannot verify Infisical secret values from codebase — requires dashboard inspection                              |
| 7  | Subscriber confirmation and secret-viewed notification emails deliver from noreply@torchsecret.com | HUMAN NEEDED | Email delivery outcomes require live system + inbox access                                                      |
| 8  | Loops welcome email passes DKIM on torchsecret.com with no "via loops.so" relay indicator      | HUMAN NEEDED | Raw email header inspection (Gmail "Show original") required — not verifiable from codebase                     |

**Score:** 4/8 truths verified programmatically. Truths 5-8 are not verifiable from the codebase — they require live system state or inbox access.

---

### Required Artifacts

This is a zero-code-changes phase. No files were created or modified. The relevant codebase artifacts are pre-existing infrastructure that the env var update relies on.

| Artifact                                        | Expected                                                      | Status   | Details                                                                                             |
|-------------------------------------------------|---------------------------------------------------------------|----------|-----------------------------------------------------------------------------------------------------|
| `server/src/config/env.ts` (RESEND_FROM_EMAIL)  | Zod-validated env var, required, drives all From addresses    | VERIFIED | Line 27: `RESEND_FROM_EMAIL: z.string().min(1)` — present, required, non-empty enforced            |
| `server/src/services/notification.service.ts`   | Reads env.RESEND_FROM_EMAIL at call time for secret-viewed emails | VERIFIED | Line 23: `from: env.RESEND_FROM_EMAIL` — substantive implementation, not a stub                    |
| `server/src/services/subscribers.service.ts`    | Reads env.RESEND_FROM_EMAIL at call time for confirmation emails; fires loops.sendEvent on confirm | VERIFIED | Line 114: `from: env.RESEND_FROM_EMAIL`; Lines 171-182: loops.sendEvent — both substantive         |
| `server/src/config/loops.ts`                    | Loops SDK singleton initialized with LOOPS_API_KEY            | VERIFIED | `export const loops = new LoopsClient(env.LOOPS_API_KEY)` — singleton imported in subscribers.service.ts |
| Infisical staging: RESEND_FROM_EMAIL secret     | Value = noreply@torchsecret.com                               | HUMAN NEEDED | Not readable from codebase — Infisical dashboard only                                              |
| Infisical production: RESEND_FROM_EMAIL secret  | Value = noreply@torchsecret.com                               | HUMAN NEEDED | Not readable from codebase — Infisical dashboard only                                              |

---

### Key Link Verification

| From                                         | To                                                    | Via                                       | Status       | Details                                                                                   |
|----------------------------------------------|-------------------------------------------------------|-------------------------------------------|--------------|-------------------------------------------------------------------------------------------|
| Infisical RESEND_FROM_EMAIL (staging)        | notification.service.ts `from:` field                 | `env.RESEND_FROM_EMAIL` at runtime        | CODE WIRED   | Code path confirmed; Infisical value unverifiable from codebase                           |
| Infisical RESEND_FROM_EMAIL (staging)        | subscribers.service.ts `from:` field (line 114)       | `env.RESEND_FROM_EMAIL` at runtime        | CODE WIRED   | Code path confirmed; Infisical value unverifiable from codebase                           |
| Infisical RESEND_FROM_EMAIL (production)     | notification.service.ts `from:` field                 | env injected by `infisical run --env=production` at Render deploy | CODE WIRED | Code path confirmed; Render/Infisical state unverifiable                                  |
| Loops domain authentication (Phase 47)       | Gmail Authentication-Results header                    | DKIM torchsecret.com selectors (DNS)      | HUMAN NEEDED | DNS propagation from Phase 47 cannot be re-verified here; Gmail header requires inbox    |
| subscribers.service.ts confirmSubscriber()   | loops.sendEvent({ eventName: 'subscribed' })           | subscriber confirmation link click        | VERIFIED     | Lines 171-182: loop.sendEvent called with correct eventName — substantive, not a stub    |

---

### Requirements Coverage

| Requirement | Source Plan   | Description                                                                                                    | Status       | Evidence                                                                                                              |
|-------------|---------------|----------------------------------------------------------------------------------------------------------------|--------------|-----------------------------------------------------------------------------------------------------------------------|
| RSND-02     | 48-01, 48-02  | Admin can update RESEND_FROM_EMAIL to noreply@torchsecret.com in Infisical (staging + production)              | HUMAN NEEDED | Code wiring confirmed. Actual Infisical secret value is unverifiable from codebase. SUMMARY docs claim completion.    |
| RSND-03     | 48-01, 48-02  | User receives transactional emails (secret-viewed notifications, subscriber confirmations) from noreply@torchsecret.com | HUMAN NEEDED | Code uses env.RESEND_FROM_EMAIL at send time (confirmed). Actual email delivery From header requires inbox inspection. |
| LOOP-03     | 48-02         | User receives onboarding emails from hello@torchsecret.com without "via loops.so" header indicators             | HUMAN NEEDED | loops.sendEvent wiring confirmed. DKIM pass/relay indicator requires raw email header inspection.                     |

All three requirement IDs declared in plan frontmatter are present in REQUIREMENTS.md and marked `[x]` complete. No orphaned requirement IDs found.

**ROADMAP plan checkboxes note:** ROADMAP.md lines 154-155 still show `- [ ]` for both 48-01-PLAN.md and 48-02-PLAN.md. The phase-level entry at line 109 is correctly marked `[x]` complete. The plan-level checkboxes were not updated. This is a documentation gap, not a goal-achievement gap.

---

### Anti-Patterns Found

No modified files to scan. This was a zero-code-changes phase — no application files were created or modified in Phase 48. All tasks were infrastructure configuration (Infisical dashboard + Render dashboard).

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No code anti-patterns to report |

---

### Human Verification Required

#### 1. Infisical Staging — RESEND_FROM_EMAIL value

**Test:** Log in to Infisical dashboard. Navigate to the secureshare/torchsecret project. Select the staging environment. Find the RESEND_FROM_EMAIL secret and read its current value.
**Expected:** Value is exactly `noreply@torchsecret.com`
**Why human:** Infisical does not write secret values to the codebase. There is no CLI read-back, no .env file, and no API endpoint that exposes current Infisical secret values. The only way to verify is the dashboard.

#### 2. Infisical Production — RESEND_FROM_EMAIL value

**Test:** Same as above, in the production environment.
**Expected:** Value is exactly `noreply@torchsecret.com`
**Why human:** Same reason — Infisical secrets not in codebase.

#### 3. Resend email From header — staging and production

**Test:** Trigger a subscriber confirmation email:
```bash
curl -X POST https://torchsecret.com/api/subscribers \
  -H 'Content-Type: application/json' \
  -d '{"email": "YOUR_TEST_EMAIL@example.com"}'
```
Open the received email in inbox. Check the From field.

Then trigger a secret-viewed notification: log in, create a secret with notification enabled, consume it from incognito.
**Expected:** Both emails arrive with From: `noreply@torchsecret.com` — NOT `onboarding@resend.dev`
**Why human:** Email delivery and From headers require a live Resend-connected server and inbox access. Cannot be verified from codebase.

#### 4. Loops.so welcome email — DKIM header inspection

**Test:** After clicking the subscriber confirmation link (which fires the Loops `subscribed` event), check inbox for the Loops welcome email. Open the email in Gmail. Click the three-dot menu (top right) and select "Show original." Find the `Authentication-Results` line.
**Expected:**
- `dkim=pass header.i=@torchsecret.com` present in Authentication-Results
- Gmail From display shows `hello@torchsecret.com` — no `via loops.so` or `via amazonses.com` banner
**Why human:** Raw email headers and relay indicators are only visible in delivered emails. No programmatic check from the codebase can verify DKIM pass status for Loops.so sends.

---

### Gaps Summary

No code gaps were identified. Phase 48 is a zero-code-changes operations phase. All codebase-verifiable truths pass — the code correctly reads `env.RESEND_FROM_EMAIL` at runtime for all Resend email sends, and `loops.sendEvent` is properly wired in `confirmSubscriber()`.

The 4 human-needed items are not gaps — they are inherently unverifiable from the codebase for this phase type. Infisical secret values, Render deployment state, email delivery From headers, and raw DKIM authentication headers all require live system access.

The SUMMARY files for both plans document successful completion with specific outcomes:
- 48-01-SUMMARY.md: staging verified, both email types confirmed from noreply@torchsecret.com, zero 403 errors
- 48-02-SUMMARY.md: production verified, all three email types confirmed, Loops DKIM confirmed via Gmail "Show original" — `dkim=pass header.i=@torchsecret.com`, no relay indicators, Render DATABASE_URL issue resolved via re-link + "Disable Secret Deletion" flag

The SUMMARY evidence is consistent and detailed (including the unplanned Render/Infisical deviation and its resolution). No contradictions found between plans and summaries.

**ROADMAP plan checkbox gap (non-blocking):** Both plan-level checkboxes in ROADMAP.md remain `[ ]` unchecked despite both summaries documenting completion. The phase-level `[x]` at line 109 is correct. The plan checkboxes should be updated to `[x]` in a future state sync.

---

_Verified: 2026-03-05_
_Verifier: Claude (gsd-verifier)_
