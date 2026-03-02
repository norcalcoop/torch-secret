# Phase 43: Verify Phase 37 Email Onboarding Sequence — Research

**Researched:** 2026-03-02
**Domain:** GSD verification — Phase 37 Email Onboarding Sequence (ESEQ-01 through ESEQ-04)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ESEQ-01 | New account holder automatically receives welcome email immediately after registration | Implementation confirmed in onboarding.service.ts + auth.ts databaseHooks; human-verified in 37-03-SUMMARY.md |
| ESEQ-02 | New account holder receives key features email on day 3 (marketing consent required) | Loops loop node 3 audience filter (marketingConsent=true) confirmed in 37-03-SUMMARY.md |
| ESEQ-03 | New account holder receives upgrade prompt email on day 7 linking to live Stripe Checkout (marketing consent required; skipped if already Pro) | Loops loop node 6 dual filter + activatePro() Loops sync confirmed in 37-02-SUMMARY.md and 37-03-SUMMARY.md |
| ESEQ-04 | Marketing consent opt-in checkbox added to registration form (gates emails 2-3 per GDPR) | #marketing-consent checkbox in register.ts confirmed; register.test.ts 3/3 GREEN |
</phase_requirements>

---

## Summary

Phase 43 is a pure verification phase. Its entire job is to run gsd-verifier against Phase 37 and produce a `37-VERIFICATION.md` file. The implementation work is already complete and confirmed by three SUMMARY files (37-01, 37-02, 37-03). This phase exists because the Phase 37 VERIFICATION.md was never created when Phase 37 was executed in February 2026, causing ESEQ-01 through ESEQ-04 to be classified as "orphaned" by the v5.0 milestone audit (v5.0-MILESTONE-AUDIT.md).

The gap is documentation-only. Every artifact specified in the Phase 37 plans has been verified to exist on disk. All 10 tests added by Phase 37 (6 onboarding service + 1 billing + 3 register) are currently GREEN. The Loops loop was live-tested and confirmed by a human checkpoint (37-03-PLAN.md Task 2) on 2026-02-27. The plan for Phase 43 (43-01-PLAN.md) is a single verification task: read the Phase 37 plans and summaries, verify each artifact against the codebase, and write a `37-VERIFICATION.md` in the Phase 37 directory.

**Primary recommendation:** Plan 43-01 should use the standard VERIFICATION.md format observed in Phases 36 and 38. The verifier must inspect the codebase directly using grep/read to confirm each artifact — not just trust SUMMARY claims. The human-action item (Loops loop published status) was confirmed in 37-03-SUMMARY.md and should be documented as a previously-completed human verification checkpoint rather than re-triggered.

---

## Standard Stack

This phase uses no new libraries. The verification tooling is gsd-verifier (built-in GSD workflow).

### Core Verification Approach

| Tool | Purpose | Why Standard |
|------|---------|--------------|
| Read tool | Inspect source files directly | Verification requires direct file evidence, not inferred from summaries |
| Grep tool | Pattern-match for key identifiers | Confirms presence of specific strings (marketingConsent, databaseHooks, sendEvent, etc.) |
| Bash (vitest) | Run Phase 37 tests live | Validates 10 tests are still GREEN at verification time |
| Git log | Confirm commit hashes from summaries exist | Cross-references SUMMARY commit references with actual history |

---

## Architecture Patterns

### Standard VERIFICATION.md Structure

Based on Phases 36 and 38 VERIFICATION.md files, the expected format is:

```
---
phase: 37-email-onboarding-sequence
verified: [timestamp]
status: passed
score: N/N must-haves verified
re_verification: false
---

# Phase 37: Email Onboarding Sequence Verification Report

## Goal Achievement
### Observable Truths (table)
### Required Artifacts (table)
### Key Link Verification (table)
### Requirements Coverage (table)
### Anti-Patterns Found
### Test Results (live run output)
### Human Verification (previously completed)

## ZK Invariant Verification
```

**Output location:** `.planning/phases/37-email-onboarding-sequence/37-VERIFICATION.md`

### Human Verification Status

The Loops dashboard items (loop published, welcome email delivered) were verified by a human on 2026-02-27 per 37-03-SUMMARY.md. The VERIFICATION.md should document these as "previously completed human verification" following the same pattern as Phase 38's human verification section — the verifier acknowledges the human checkpoint but does not re-trigger it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Verifying Loops loop status | Custom Loops API call | Document as previously-completed human verification | Loops has no programmatic loop-status API; re-registering another test user is out of scope and disruptive |
| Verifying welcome email delivery | Send a real email | Cite 37-03-SUMMARY.md human checkpoint evidence | Live email delivery requires external inbox access; already verified on 2026-02-27 |

---

## Common Pitfalls

### Pitfall 1: Treating SUMMARY Claims as Sufficient Evidence

**What goes wrong:** The verifier accepts SUMMARY file statements as proof without independently confirming the artifacts exist on disk.

**Why it happens:** The SUMMARY files are very detailed and include commit hashes, making them feel authoritative.

**How to avoid:** For every artifact in the Phase 37 plan's `must_haves.artifacts` list, use the Read tool to open the file and use Grep to confirm the expected `contains` patterns are present. The VERIFICATION.md format (as seen in Phase 36) documents "VERIFIED" or "NOT FOUND" with file line numbers as evidence.

**Warning signs:** VERIFICATION.md rows that say "VERIFIED — per SUMMARY.md" with no file evidence.

### Pitfall 2: Confusing register.ts with login.ts

**What goes wrong:** The marketing consent checkbox is in `client/src/pages/register.ts` but there are also `login.ts` references in recent git state (login.ts is modified per current branch status).

**How to avoid:** Always read `register.ts` specifically; the checkbox ID is `#marketing-consent` and must be `checked = false` by default.

### Pitfall 3: Missing the databaseHooks Non-Async Pattern

**What goes wrong:** The verifier checks for `databaseHooks` in auth.ts but flags the hook as incorrect because it is not `async`.

**Why it happens:** Plan 37-02 specified `async (user) =>` but the implementation deliberately uses a non-async function with `void + .catch()` to satisfy `@typescript-eslint/require-await`.

**How to avoid:** The correct pattern is non-async: `after: (user) => { void enrollInOnboardingSequence({...}).catch(...) }`. This is documented in 37-02-SUMMARY.md under "Decisions Made" and "Deviations from Plan."

### Pitfall 4: Wrong Test Count

**What goes wrong:** The VERIFICATION.md reports "328 tests GREEN" but the current test count is 376+ after later phases.

**How to avoid:** Run `npm run test:run` at verification time and report the actual current count, not the historical count from SUMMARY files.

---

## Code Examples

### What the Verifier Must Confirm in auth.ts

Evidence from current codebase (confirmed via grep):

```typescript
// server/src/auth.ts lines 10, 172, 180
import { enrollInOnboardingSequence } from './services/onboarding.service.js';
// ...
databaseHooks: {
  user: {
    create: {
      after: (user) => {
        // fire-and-forget — non-async to satisfy @typescript-eslint/require-await
        void enrollInOnboardingSequence({...}).catch(...)
      }
    }
  }
}
```

### What the Verifier Must Confirm in onboarding.service.ts

```typescript
// server/src/services/onboarding.service.ts (35 lines)
export async function enrollInOnboardingSequence(user: OnboardingUser): Promise<void> {
  const firstName = user.name.split(' ')[0] ?? user.name;
  await loops.sendEvent({
    email: user.email,
    eventName: 'registered',
    contactProperties: { firstName, marketingConsent, subscriptionTier },
  });
}
```

### What the Verifier Must Confirm in billing.service.ts

```typescript
// server/src/services/billing.service.ts
import { loops } from '../config/loops.js';
// In activatePro():
void loops.updateContact({
  email: proUser.email,
  properties: { subscriptionTier: 'pro' },
}).catch(...)
```

### What the Verifier Must Confirm in register.ts

```typescript
// client/src/pages/register.ts lines ~155-162
marketingConsentCheckbox.id = 'marketing-consent';
marketingConsentCheckbox.checked = false; // unchecked by default — GDPR (ESEQ-04)
```

---

## State of the Art

### Phase 37 Implementation Status (As of 2026-03-02)

| Component | Expected | Actual Status | Confidence |
|-----------|----------|---------------|------------|
| `server/src/services/onboarding.service.ts` | Exists with `enrollInOnboardingSequence` | CONFIRMED EXISTS (read on disk) | HIGH |
| `server/src/config/loops.ts` | LoopsClient singleton | CONFIRMED EXISTS (in `ls server/src/config/`) | HIGH |
| `server/src/auth.ts` databaseHooks | `databaseHooks.user.create.after` fires enrollment | CONFIRMED (grep: lines 172, 180) | HIGH |
| `server/src/db/schema.ts` | `marketingConsent` boolean column | CONFIRMED (grep: line 48) | HIGH |
| `drizzle/0006_add_marketing_consent.sql` | ALTER TABLE migration | CONFIRMED EXISTS | HIGH |
| `client/src/pages/register.ts` | `#marketing-consent` checkbox unchecked by default | CONFIRMED (grep: lines 160, 162) | HIGH |
| `server/src/services/billing.service.ts` | `loops.updateContact()` in `activatePro()` | CONFIRMED (grep: lines 5, 31-32) | HIGH |
| 10 Phase 37 tests | All GREEN | CONFIRMED (live test run: 10/10 GREEN) | HIGH |
| Loops loop published | 3-email sequence active with `registered` trigger | Human-verified 2026-02-27 (37-03-SUMMARY.md) | MEDIUM (external platform) |

---

## Open Questions

1. **Loops loop current status**
   - What we know: Loop was published and verified live on 2026-02-27 per human checkpoint in 37-03-SUMMARY.md; welcome email "Hey Torchtest, welcome to Torch Secret" delivered to Mailinator inbox
   - What's unclear: Whether the loop remains active today (external platform state can change)
   - Recommendation: Document as previously-completed human verification in VERIFICATION.md. The VERIFICATION.md status should be `passed` since all code artifacts are confirmed and the external platform confirmation was completed. Flag Loops loop as "human-needed" in frontmatter only if the planner explicitly calls for re-verification.

2. **Resend account migration impact on Loops**
   - What we know: Phase 42 migrated to a new Resend account; the `from: hello@torchsecret.com` sender domain is unchanged; Loops uses its own email delivery (not Resend)
   - What's unclear: Whether Phase 42's Resend migration affects any Loops email delivery
   - Recommendation: Loops sends email independently of Resend — they are separate email services. The Loops loop sends via Loops's own infrastructure. Phase 42 is irrelevant to Loops deliverability. No impact on ESEQ verification.

---

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (multi-project: server=node, client=happy-dom) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run server/src/services/onboarding.service.test.ts server/src/services/billing.service.test.ts client/src/pages/register.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ESEQ-01 | `enrollInOnboardingSequence` fires `sendEvent('registered')` for all users regardless of consent | unit | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | Yes |
| ESEQ-02 | `enrollInOnboardingSequence` passes `marketingConsent: true/false` in contactProperties | unit | `npx vitest run server/src/services/onboarding.service.test.ts --project server` | Yes |
| ESEQ-03 | `activatePro()` calls `loops.updateContact({ subscriptionTier: 'pro' })` | unit | `npx vitest run server/src/services/billing.service.test.ts --project server` | Yes |
| ESEQ-04 | `#marketing-consent` checkbox exists, unchecked by default, label text correct | unit (happy-dom) | `npx vitest run client/src/pages/register.test.ts --project client` | Yes |
| ESEQ-02/03 (Loops UI) | Audience filter nodes in published loop | manual-only | N/A — Loops dashboard, external | N/A |

**Note:** ESEQ-02 and ESEQ-03 email delivery behavior (audience filtering, timer delays) is enforced in the Loops.so dashboard, not in application code. The application code only fires the event with the correct contact properties; the filtering logic is in the Loops loop configuration. This portion is manual-only per its nature as external platform behavior.

### Sampling Rate

- **Per task commit (verification-only phase):** `npx vitest run server/src/services/onboarding.service.test.ts server/src/services/billing.service.test.ts client/src/pages/register.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

None — all 10 Phase 37 tests exist and are GREEN. No new test files needed. This is a verification-only phase that produces a VERIFICATION.md document, not new code.

---

## Checklist: What the Planner Must Produce

The single plan (43-01-PLAN.md) must direct the executor to:

1. Read all Phase 37 PLAN and SUMMARY files (already done in research)
2. Directly inspect each artifact file listed in Phase 37 `must_haves.artifacts`
3. Run the 10 Phase 37 tests live and capture output
4. Verify git commits from SUMMARY files exist in history
5. Document the Loops human-verification as previously completed
6. Write `37-VERIFICATION.md` to `.planning/phases/37-email-onboarding-sequence/37-VERIFICATION.md`
7. Update REQUIREMENTS.md to mark ESEQ-01 through ESEQ-04 as `[x]` (currently `[ ]`)

The VERIFICATION.md must follow the standard format (phase frontmatter + Observable Truths table + Required Artifacts table + Key Links table + Requirements Coverage table + Test Results + Human Verification section).

---

## Sources

### Primary (HIGH confidence)

- `.planning/phases/37-email-onboarding-sequence/37-01-PLAN.md` — Source plans with `must_haves.artifacts` and `must_haves.truths`
- `.planning/phases/37-email-onboarding-sequence/37-02-PLAN.md` — Loops integration plan
- `.planning/phases/37-email-onboarding-sequence/37-03-PLAN.md` — Human verification checkpoint plan
- `.planning/phases/37-email-onboarding-sequence/37-01-SUMMARY.md` — Execution summary, commit hashes
- `.planning/phases/37-email-onboarding-sequence/37-02-SUMMARY.md` — Implementation decisions, deviations
- `.planning/phases/37-email-onboarding-sequence/37-03-SUMMARY.md` — Human verification results
- `.planning/v5.0-MILESTONE-AUDIT.md` — Gap analysis, gap resolution path (Section 6)
- `.planning/phases/36-email-capture/36-VERIFICATION.md` — VERIFICATION.md format reference
- `.planning/phases/38-feedback-links/38-VERIFICATION.md` — VERIFICATION.md format reference (with human-verification section)
- Direct file inspection: `server/src/services/onboarding.service.ts`, `server/src/auth.ts`, `server/src/db/schema.ts`, `server/src/services/billing.service.ts`, `client/src/pages/register.ts`, `server/src/config/loops.ts`
- Live test run: 10/10 GREEN (onboarding.service.test.ts × 6, billing.service.test.ts × 1, register.test.ts × 3)

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` Phase 37 execution notes — confirms non-async databaseHooks hook pattern, loops@6.2.0 API, INVARIANTS compliance

---

## Metadata

**Confidence breakdown:**
- Artifact existence: HIGH — directly verified on disk
- Test status: HIGH — live test run confirmed 10/10 GREEN
- Loops loop current published status: MEDIUM — confirmed human-verified 2026-02-27; external platform state cannot be re-confirmed without browser access to Loops dashboard

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable — implementation is frozen; no active development on Phase 37 artifacts)
