---
phase: 49-gmail-send-mail-as
plan: 01
subsystem: infra
tags: [resend, gmail, smtp, email, send-mail-as]

# Dependency graph
requires:
  - phase: 46-cloudflare-email-routing
    provides: Inbound email routing for all 7 @torchsecret.com addresses to torch.secrets@gmail.com — required so Gmail can receive the alias verification emails
  - phase: 47-domain-verification-dmarc
    provides: torchsecret.com verified as authenticated sending domain in Resend — required so smtp.resend.com relay works
provides:
  - Dedicated Resend API key "Gmail SMTP Relay" restricted to torchsecret.com domain (GMAI-01)
  - All 7 Gmail Send mail as aliases registered with smtp.resend.com SMTP, pending verification (GMAI-02)
  - 7 verification emails dispatched to torch.secrets@gmail.com, ready for Plan 02
affects:
  - 49-02 (verify aliases, set hello@ default, confirm DKIM alignment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gmail SMTP relay via Resend: smtp.resend.com:465 (SSL), username=resend (literal), password=API key — identical credentials for all aliases"
    - "Dedicated restricted API key per use case: Gmail relay key scoped to torchsecret.com only, separate from production RESEND_API_KEY"

key-files:
  created: []
  modified: []

key-decisions:
  - "Used port 465 (implicit SSL) not 587 (STARTTLS) — matches Resend SMTP relay requirement; wrong port or TLS mode causes silent auth failures"
  - "Username is literal string 'resend' not the email address and not the API key — counterintuitive but required by Resend SMTP auth protocol"
  - "One dedicated API key for all 7 aliases — simpler credential management vs per-alias keys; restriction to torchsecret.com domain limits blast radius"
  - "All 7 aliases added before verifying any — batch approach prevents session timeouts; verification emails queue correctly"

patterns-established:
  - "Resend SMTP relay pattern: smtp.resend.com:465, user=resend, pass=[restricted API key scoped to sending domain]"

requirements-completed: [GMAI-01, GMAI-02]

# Metrics
duration: ~15min (human-action tasks)
completed: 2026-03-05
---

# Phase 49 Plan 01: Gmail Send Mail As — SMTP Key + Alias Registration Summary

**Dedicated Resend SMTP API key created and all 7 torchsecret.com aliases registered in Gmail Send mail as via smtp.resend.com:465 relay, verification emails dispatched**

## Performance

- **Duration:** ~15 min (human-action tasks)
- **Started:** 2026-03-05
- **Completed:** 2026-03-05T11:34:27Z
- **Tasks:** 2 (both human-action)
- **Files modified:** 0 (no code changes — infrastructure configuration only)

## Accomplishments

- Created dedicated Resend API key "Gmail SMTP Relay" restricted to torchsecret.com domain, value saved in password manager (GMAI-01)
- Added all 7 @torchsecret.com aliases to Gmail Settings > Accounts and Import > Send mail as using smtp.resend.com:465 with SSL (GMAI-02)
- 7 verification emails dispatched to torch.secrets@gmail.com, ready for confirmation in Plan 02

## Task Commits

This plan was human-action only — no code commits. All work was manual configuration in Resend dashboard and Gmail Settings.

1. **Task 1: Create dedicated Resend API key for Gmail SMTP relay** — human-action (Resend dashboard)
2. **Task 2: Add all 7 Gmail Send mail as aliases** — human-action (Gmail Settings)

**Plan metadata:** see docs commit below

## Files Created/Modified

None — this plan involved only external service configuration:
- Resend dashboard: new API key "Gmail SMTP Relay" (restricted to torchsecret.com, Sending access only)
- Gmail Settings > Accounts and Import > Send mail as: 7 new alias entries pending verification

## Decisions Made

- Port 465 (implicit SSL) used for all aliases — Resend SMTP relay requires SSL on port 465, not STARTTLS on 587; selecting wrong security mode causes "Failed to connect"
- SMTP username is literal string "resend" for all aliases — not the email address, not the API key; this is Resend's fixed auth scheme
- Single dedicated API key covers all 7 aliases — one restricted key simplifies credential management while domain restriction (torchsecret.com only) limits exposure if leaked
- All 7 aliases added in a single session before verifying any — avoids session re-auth overhead; Gmail queues all 7 verification emails correctly

## Deviations from Plan

None — plan executed exactly as written. Both human-action tasks completed as specified.

## Issues Encountered

None.

## User Setup Required

Both tasks in this plan were the user setup. The following was configured externally:

**Task 1 — Resend API Key:**
- resend.com > API Keys > "Gmail SMTP Relay"
- Permission: Sending access (not Full access)
- Domain: torchsecret.com (restricted)
- Key value saved in password manager

**Task 2 — Gmail Aliases (7 total):**
All configured with:
- SMTP Server: smtp.resend.com
- Port: 465
- Username: resend
- Password: [API key from Task 1]
- Security: SSL

Aliases added:
1. hello@torchsecret.com
2. contact@torchsecret.com
3. admin@torchsecret.com
4. info@torchsecret.com
5. support@torchsecret.com
6. security@torchsecret.com
7. privacy@torchsecret.com

## Next Phase Readiness

Plan 02 (49-02) can proceed immediately:
- 7 verification emails are in torch.secrets@gmail.com inbox (or Spam)
- Each email contains a confirmation link to activate the alias
- After all 7 are verified, hello@torchsecret.com should be set as the default Send mail as address
- DKIM alignment check via Gmail "Show original" should confirm Signed by: torchsecret.com with no "via gappssmtp.com" indicator

## Self-Check: PASSED

- SUMMARY.md: FOUND at .planning/phases/49-gmail-send-mail-as/49-01-SUMMARY.md
- STATE.md: Updated (position, decisions, metrics, session)
- ROADMAP.md: Updated (Phase 49 progress 1/2 In Progress)
- Requirements: GMAI-01, GMAI-02 marked complete

---
*Phase: 49-gmail-send-mail-as*
*Completed: 2026-03-05*
