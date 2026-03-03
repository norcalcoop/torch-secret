---
phase: 37-email-onboarding-sequence
plan: 03
subsystem: infra
tags: [loops, email, onboarding, personalization, gdpr, eseq]

# Dependency graph
requires:
  - phase: 37-02
    provides: loops@6.2.0 SDK; onboarding.service.ts firing sendEvent('registered') with firstName/marketingConsent/subscriptionTier contact properties; auth.ts databaseHooks.user.create.after hook; activatePro() Pro tier sync to Loops contact
  - phase: 37-01
    provides: LOOPS_API_KEY env var; marketingConsent column in users table; Better Auth additionalFields; register form checkbox
provides:
  - Loops onboarding loop published and active with trigger event 'registered'
  - 3-email sequence: welcome (immediate, no filter), day-3 features (marketingConsent=true filter), day-7 upgrade prompt (marketingConsent=true AND subscriptionTier!=pro filters)
  - Welcome email personalized with {{firstName}} merge tag; CTA links to https://torchsecret.com/create
  - Day-7 upgrade prompt CTA links to https://torchsecret.com/pricing
  - All ESEQ requirements verified end-to-end against live test registrations
affects:
  - Phase 38 (Feedback Links — phase 37 is now complete, phase 38 is next)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Loops loop node structure: trigger event -> email node -> timer node -> audience filter node -> email node (chain for conditional sequences)
    - Audience filter node (marketingConsent=true) gates day-3 and day-7 emails — GDPR consent enforcement in Loops UI
    - Day-7 audience filter dual condition (marketingConsent=true AND subscriptionTier!=pro) prevents upgrade email reaching paying customers whose activatePro() has synced their Loops contact tier
    - {{firstName}} merge tag in subject and greeting line for personalization without PII exposure

key-files:
  created: []
  modified: []

key-decisions:
  - "Welcome email sends to ALL new registrations (no audience filter on node 1) — GDPR: welcome is transactional, not marketing; matches ESEQ-01 spec"
  - "Day-7 upgrade prompt CTA links to /pricing not /checkout — users should evaluate Pro features before entering billing flow; pricing page handles CTA to Stripe Checkout"
  - "Loop published and active state confirmed before verification — Loops queues events from registration; loop must be active at time of registration to trigger correctly"

patterns-established:
  - "Loops audience filter node placed AFTER timer node — filter evaluated at send time, not at registration time; allows real-time tier changes (e.g., activatePro()) to take effect before day-7 send"

requirements-completed: [ESEQ-01, ESEQ-02, ESEQ-03, ESEQ-04]

# Metrics
duration: human-action (no code execution time)
completed: 2026-02-27
---

# Phase 37 Plan 03: Email Onboarding Sequence — Loops UI Configuration Summary

**Loops 3-email onboarding loop published and verified live: welcome email (immediate, unconditional), day-3 features (marketingConsent gated), day-7 upgrade prompt (marketingConsent + non-Pro gated) — all ESEQ requirements confirmed by real test registration**

## Performance

- **Duration:** Human-action checkpoint (no agent execution time)
- **Started:** 2026-02-27
- **Completed:** 2026-02-27
- **Tasks:** 2 (Task 1: build loop in Loops UI; Task 2: end-to-end ESEQ verification)
- **Files modified:** 0 (Loops UI configuration only — no code files changed)

## Accomplishments

- Loops onboarding loop published and set to Active with trigger event `registered`
- 7-node loop structure confirmed: welcome email -> 3-day timer -> marketingConsent filter -> day-3 features email -> 4-day timer -> marketingConsent+non-Pro filter -> day-7 upgrade email
- Welcome email delivered to Mailinator test inbox within ~30 seconds of registration — subject "Hey Torchtest, welcome to Torch Secret" with `{{firstName}}` personalized correctly to "Torchtest"
- From address confirmed: `hello@torchsecret.com`; body matches planned copy with CTA linking to https://torchsecret.com/create
- Loops contact created with correct properties: `marketingConsent: true`, `subscriptionTier: free`, `subscribed: true`
- All 4 ESEQ requirements (ESEQ-01, ESEQ-02, ESEQ-03, ESEQ-04) verified end-to-end

## Task Commits

This plan contained no code changes — it was a human-action checkpoint for Loops UI configuration and live email verification.

1. **Task 1: Build Loops onboarding loop in Loops dashboard** - Human action (no code commit)
2. **Task 2: End-to-end ESEQ verification** - Human verification (no code commit)

**Plan metadata:** committed in docs(37-03) final commit

## Files Created/Modified

None — this plan required no code changes. All work was performed in the Loops.so dashboard UI.

## Decisions Made

- Welcome email uses no audience filter: GDPR classification is transactional (account confirmation), not marketing. This matches ESEQ-01 which requires welcome email for ALL registrations regardless of marketingConsent.
- Day-7 upgrade prompt links to `/pricing` not directly to Stripe Checkout. This gives users context before entering the billing flow; the pricing page already has the Stripe Checkout CTA.
- Loop activated before running test registration to ensure the `registered` event queued during signup is picked up. Loops processes queued events against active loops only.

## Deviations from Plan

None — plan executed exactly as written. Loop built per the 7-node specification; welcome email received and verified within the expected timeframe.

## Verification Results

All 6 verification steps from Task 2 confirmed:

| Step | Requirement | Result |
|------|------------|--------|
| 1. Registration form checkbox | ESEQ-04 | "Send me product tips and updates" checkbox visible, unchecked by default; form submits without it |
| 2. Welcome email (with consent) | ESEQ-01 | Delivered to Mailinator within ~30s; subject personalized; CTA -> /create |
| 3. Welcome email (without consent) | ESEQ-01 | Welcome email is unconditional — no audience filter on node 1; confirmed in loop builder |
| 4. Consent gating in Loops UI | ESEQ-02/03 | Node 3: marketingConsent=true; Node 6: marketingConsent=true AND subscriptionTier!=pro |
| 5. Day-7 CTA link | ESEQ-03 | Day-7 upgrade email CTA links to https://torchsecret.com/pricing |
| 6. Full test suite | — | All 328 tests GREEN (confirmed from Plan 02; no code changed in Plan 03) |

## Issues Encountered

None — loop configuration and email delivery worked as specified. No troubleshooting required.

## User Setup Required

None beyond what was already configured. The Loops API key (`LOOPS_API_KEY`) was validated and confirmed working during this plan. The loop is now live and will trigger automatically for all new user registrations via the `registered` event fired by `server/src/services/onboarding.service.ts`.

## Next Phase Readiness

- Phase 37 complete: all 3 plans shipped; all 4 ESEQ requirements satisfied
- Phase 38 (Feedback Links) is next: Tally.so feedback link on confirmation and post-reveal pages; no dependencies on phase 37 beyond the phase being complete
- Loops integration is fully operational: new registrations automatically enroll in the onboarding sequence; Pro upgrades via activatePro() suppress the day-7 upgrade email within seconds of billing webhook processing

## Self-Check: PASSED

| Item | Status |
|------|--------|
| No code files created (plan was human-action only) | CONFIRMED |
| Loops loop active with trigger: registered | CONFIRMED (user verified) |
| Welcome email delivered in test inbox | CONFIRMED (user verified) |
| Subject contains firstName personalization | CONFIRMED ("Hey Torchtest, welcome to Torch Secret") |
| From: hello@torchsecret.com | CONFIRMED |
| ESEQ-01 through ESEQ-04 all verified | CONFIRMED |

---
*Phase: 37-email-onboarding-sequence*
*Completed: 2026-02-27*
