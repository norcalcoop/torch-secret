---
phase: 48-activate-custom-domain-sending
plan: "02"
subsystem: infra
tags: [resend, loops, email, infisical, render, dkim, production]

# Dependency graph
requires:
  - phase: 48-activate-custom-domain-sending
    provides: "48-01: RESEND_FROM_EMAIL updated in Infisical staging; both email types verified in staging environment"
  - phase: 47-domain-verification-dmarc
    provides: "Resend and Loops.so DKIM/SPF DNS records verified; hello@torchsecret.com confirmed as Loops sender"
provides:
  - "RESEND_FROM_EMAIL=noreply@torchsecret.com active in Infisical production"
  - "Both Resend email types (subscriber confirmation + secret-viewed notification) confirmed in production from noreply@torchsecret.com"
  - "Loops welcome email confirmed DKIM-aligned on torchsecret.com — no via loops.so indicators"
  - "Phase 48 complete — all three requirements RSND-02, RSND-03, LOOP-03 satisfied"
affects: [phase-49-gmail-send-mail-as]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Infisical 'Disable Secret Deletion' flag prevents render-sync from deleting Render-native fromDatabase DB linkage during env sync"

key-files:
  created: []
  modified: []

key-decisions:
  - "Render deployment failed with ZodError on DATABASE_URL (undefined) — root cause was Infisical render-sync deleting Render-native fromDatabase database linkage during a prior sync. Resolution: re-linked torch-secret-db to the service via Render dashboard, then enabled 'Disable Secret Deletion' on the Infisical render-sync integration to prevent recurrence."
  - "All three email types (subscriber confirmation, secret-viewed notification, Loops welcome) confirmed in production in a single human-verify session — efficient approach that tests the full chain."
  - "Loops DKIM alignment confirmed via Gmail 'Show original' Authentication-Results showing dkim=pass header.i=@torchsecret.com — no via loops.so relay indicator present."

patterns-established:
  - "Infisical render-sync: always enable 'Disable Secret Deletion' when Render service uses fromDatabase DB linkage — prevents env sync from removing Render-native secrets."

requirements-completed: [RSND-02, RSND-03, LOOP-03]

# Metrics
duration: ~40min
completed: "2026-03-05"
---

# Phase 48 Plan 02: Activate Custom Domain Sending — Production Cutover Summary

**RESEND_FROM_EMAIL=noreply@torchsecret.com activated in Infisical production; all three email types confirmed from correct From addresses; Loops welcome email DKIM-aligned on torchsecret.com with no relay indicators**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-03-04 (continuation from Plan 01 staging verification)
- **Completed:** 2026-03-05
- **Tasks:** 2 of 2
- **Files modified:** 0 (configuration-only plan — no code changes)

## Accomplishments

- Updated RESEND_FROM_EMAIL to noreply@torchsecret.com in Infisical production environment and redeployed production on Render.com
- Confirmed subscriber confirmation email delivered from noreply@torchsecret.com in production
- Confirmed secret-viewed notification email delivered from noreply@torchsecret.com in production
- Confirmed Loops welcome email (From: hello@torchsecret.com) passes DKIM on torchsecret.com — Gmail "Show original" shows dkim=pass header.i=@torchsecret.com with no "via loops.so" or "via amazonses.com" relay indicators
- Satisfied all three requirements for Phase 48: RSND-02, RSND-03, LOOP-03

## Task Commits

This was a configuration-only plan — no code was committed per task. All changes were applied in Infisical and Render dashboards.

1. **Task 1: Update RESEND_FROM_EMAIL in Infisical production and redeploy on Render** — human action (Infisical dashboard + Render manual deploy)
2. **Task 2: Verify Resend emails in production and inspect Loops welcome email headers** — human verify (three email types confirmed in production)

## Files Created/Modified

None — zero code changes. This plan was purely operational:
- Infisical production environment: RESEND_FROM_EMAIL updated to noreply@torchsecret.com
- Render.com: service redeployed after Infisical update + fromDatabase linkage re-established

## Decisions Made

- **Infisical render-sync "Disable Secret Deletion" flag:** After the Render deployment failed with ZodError on DATABASE_URL (undefined), root cause was traced to Infisical render-sync having deleted the Render-native fromDatabase database linkage during a prior sync pass. Re-linked torch-secret-db to the service via Render dashboard, then enabled "Disable Secret Deletion" on the Infisical render-sync integration to prevent recurrence. Service came up successfully.
- **Single-session verification:** All three email types confirmed in one human-verify session by triggering the subscriber confirmation flow (which fires Resend confirmation email + Loops welcome email as a side effect), then separately triggering a secret-viewed notification. Efficient — tests the full production email chain in one pass.

## Deviations from Plan

### Unplanned Issue: Render deploy failed — DATABASE_URL undefined (ZodError)

- **Found during:** Task 1 (production Infisical update and Render redeploy)
- **Issue:** After updating RESEND_FROM_EMAIL in Infisical production and triggering a Render redeploy, the service failed to start with a ZodError indicating DATABASE_URL was undefined. Root cause: Infisical render-sync had deleted the Render-native `fromDatabase` database linkage (which injects DATABASE_URL from the attached Render database) during a prior sync operation.
- **Fix:** Re-linked torch-secret-db to the service via Render dashboard (restoring the fromDatabase reference). Enabled "Disable Secret Deletion" on the Infisical render-sync integration to prevent the render-sync from deleting Render-native secrets in future syncs. Triggered another deploy — service came up healthy.
- **Files modified:** None (Render + Infisical dashboard configuration only)
- **Verification:** Render service showed "Live" after the re-link and redeploy; DATABASE_URL available at startup; all three email types subsequently confirmed working.

---

**Total deviations:** 1 unplanned infrastructure issue — resolved via Render dashboard + Infisical integration config
**Impact on plan:** Issue required a second redeploy cycle but did not change any application code or planned configuration. Root cause was a known Infisical render-sync edge case with fromDatabase linkages. Mitigation (Disable Secret Deletion) applied to prevent recurrence.

## Issues Encountered

- Render deploy failure (DATABASE_URL undefined / ZodError) caused by Infisical render-sync deleting the Render-native fromDatabase DB linkage. Resolved by re-linking the database in Render dashboard and enabling "Disable Secret Deletion" in Infisical render-sync integration settings.

## User Setup Required

None — all configuration applied in Infisical and Render dashboards during plan execution.

## Next Phase Readiness

Phase 48 is complete. All v5.1 email infrastructure requirements through Phase 48 are satisfied:
- RSND-02: RESEND_FROM_EMAIL=noreply@torchsecret.com in both staging and production Infisical
- RSND-03: Subscriber confirmation and secret-viewed notification delivered from noreply@torchsecret.com in production
- LOOP-03: Loops welcome email confirmed DKIM-aligned on torchsecret.com — no via relay indicators

Ready for Phase 49 (Gmail Send Mail As) — Cloudflare Email Routing (Phase 46) is live, which is the prerequisite for Gmail alias setup (Gmail sends a verification email to the custom address during alias setup).

---
*Phase: 48-activate-custom-domain-sending*
*Completed: 2026-03-05*
