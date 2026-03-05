---
phase: 49-gmail-send-mail-as
plan: 02
subsystem: infra
tags: [resend, gmail, smtp, email, send-mail-as, dkim]

# Dependency graph
requires:
  - phase: 49-01
    provides: 7 Gmail Send mail as aliases registered with smtp.resend.com SMTP, pending verification
  - phase: 47-domain-verification-dmarc
    provides: Resend DKIM DNS key (resend._domainkey.torchsecret.com) live — required for DKIM-pass on outbound sends
  - phase: 46-cloudflare-email-routing
    provides: Inbound routing for all 7 @torchsecret.com aliases — required to receive verification emails
provides:
  - All 7 Gmail Send mail as aliases verified (no "Unverified" warnings) (GMAI-03)
  - DKIM alignment confirmed: "Signed by: torchsecret.com", dkim=pass, no "via gappssmtp.com" (GMAI-03)
  - hello@torchsecret.com set as default Gmail outbound address (GMAI-04)
  - "Reply from the same address the message was sent to" enabled in Gmail Settings (GMAI-04)
affects:
  - 50-documentation-updates (contact addresses now functional and DKIM-verified; safe to document in SECURITY.md + Privacy Policy)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DKIM alignment via Resend SMTP: d=torchsecret.com; s=resend — no via gappssmtp.com because alias uses smtp.resend.com relay, not Gmail servers"
    - "Gmail default address: hello@ is set as default; 'Reply from same address' ensures context-correct replies from any of the 7 aliases"

key-files:
  created: []
  modified: []

key-decisions:
  - "DKIM spot-check via Gmail 'Show original' on test email confirmed: DKIM-Signature d=torchsecret.com, dkim=pass header.i=@torchsecret.com, no via gappssmtp.com"
  - "hello@torchsecret.com set as default — all new Gmail compose windows default to Torch Secret brand identity"
  - "'Reply from the same address' enabled — support@ replies come from support@, not hello@; preserves per-alias context"

patterns-established:
  - "Gmail alias DKIM verification: send test from alias via Gmail, inspect 'Show original', confirm d=torchsecret.com and no gappssmtp.com relay indicator"

requirements-completed: [GMAI-03, GMAI-04]

# Metrics
duration: ~10min (human-action tasks)
completed: 2026-03-05
---

# Phase 49 Plan 02: Gmail Send Mail As — Alias Verification + Default + DKIM Summary

**All 7 Gmail Send mail as aliases verified, hello@torchsecret.com set as default outbound address, DKIM alignment confirmed with no "via gappssmtp.com" — GMAI-01 through GMAI-04 complete**

## Performance

- **Duration:** ~10 min (human-action tasks)
- **Started:** 2026-03-05
- **Completed:** 2026-03-05
- **Tasks:** 2 (both human-action)
- **Files modified:** 0 (no code changes — Gmail/DNS configuration only)

## Accomplishments

- Verified all 7 @torchsecret.com aliases in Gmail Settings (hello, contact, admin, info, support, security, privacy) — no "Unverified" labels (GMAI-03)
- DKIM alignment spot-check passed: test email from hello@torchsecret.com shows DKIM-Signature d=torchsecret.com, dkim=pass, "Signed by: torchsecret.com" in Gmail UI, no "via gappssmtp.com" (GMAI-03)
- hello@torchsecret.com set as the default Gmail outbound address; new compose window defaults to "Torch Secret <hello@torchsecret.com>" (GMAI-04)
- "Reply from the same address the message was sent to" enabled — support@ replies from support@, hello@ replies from hello@ (GMAI-04)

## Task Commits

This plan was human-action only — no code commits. All work was manual configuration in Gmail Settings.

1. **Task 1: Verify all 7 Gmail Send mail as aliases** — human-action (Gmail Settings + verification codes)
2. **Task 2: Set hello@ as default, enable reply-from-same-address, confirm DKIM alignment** — human-action (Gmail Settings + Show original inspection)

**Plan metadata:** see docs commit below

## Files Created/Modified

None — this plan involved only external service configuration:
- Gmail Settings > Accounts and Import > Send mail as: all 7 aliases status changed from pending to verified
- Gmail Settings > Accounts and Import > Send mail as: hello@torchsecret.com marked as default
- Gmail Settings > Accounts and Import: "Reply from the same address the message was sent to" enabled

## Decisions Made

- DKIM spot-check performed via Gmail "Show original" on live test email — Authentication-Results confirms dkim=pass header.i=@torchsecret.com; DKIM-Signature header shows d=torchsecret.com; s=resend
- No "via gappssmtp.com" in sender tooltip or headers — confirms smtp.resend.com relay is active (not Gmail servers), satisfying the zero-relay-banner requirement
- hello@ chosen as default (not torch.secrets@gmail.com) — brand-facing default ensures all outbound Gmail composes present as Torch Secret identity

## Deviations from Plan

None — plan executed exactly as written. Both human-action tasks completed as specified.

## Issues Encountered

None.

## User Setup Required

Both tasks in this plan were the user setup. The following was configured externally:

**Task 1 — Alias Verification (7 total):**
- Opened torch.secrets@gmail.com and found 7 Gmail Confirmation emails (or checked Spam)
- Used code entry method: copied 9-digit code from each email, clicked "Verify" in Gmail Settings, entered code
- Confirmed all 7 aliases show verified status (no "verify" link or "Unverified" label)

**Task 2 — Default + Reply Setting + DKIM:**
- Gmail Settings > Accounts and Import > Send mail as > clicked "make default" next to hello@torchsecret.com
- Set "When replying to a message" to "Reply from the same address the message was sent to"
- Composed test email from hello@torchsecret.com to external Gmail; confirmed From field showed "Torch Secret <hello@torchsecret.com>"
- Opened received email > 3-dot menu > "Show original" > inspected headers: DKIM-Signature d=torchsecret.com s=resend, dkim=pass, no gappssmtp.com

## Next Phase Readiness

Phase 49 complete. All GMAI requirements satisfied (GMAI-01 through GMAI-04):
- GMAI-01: Dedicated Resend API key "Gmail SMTP Relay" exists (scoped to torchsecret.com)
- GMAI-02: All 7 aliases registered in Gmail Send mail as via smtp.resend.com
- GMAI-03: All 7 aliases verified; DKIM alignment confirmed (Signed by: torchsecret.com, no via banner)
- GMAI-04: hello@torchsecret.com is the default; reply-from-same-address enabled

Phase 50 (Documentation Updates) can proceed:
- security@torchsecret.com and privacy@torchsecret.com are now fully functional and DKIM-verified
- Safe to document both addresses in SECURITY.md and Privacy Policy

## Self-Check: PASSED

- SUMMARY.md: FOUND at .planning/phases/49-gmail-send-mail-as/49-02-SUMMARY.md
- STATE.md: Updated (position, decisions, metrics, session)
- ROADMAP.md: Updated (Phase 49 progress 2/2 Complete)
- Requirements: GMAI-03, GMAI-04 marked complete

---
*Phase: 49-gmail-send-mail-as*
*Completed: 2026-03-05*
