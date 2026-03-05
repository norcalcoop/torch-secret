---
gsd_state_version: 1.0
milestone: v5.1
milestone_name: Email Infrastructure
status: completed
stopped_at: Completed 52-02-PLAN.md
last_updated: "2026-03-05T23:55:00.000Z"
last_activity: "2026-03-05 — Phase 52 Plan 02 complete: Stripe live-mode verified, launch-checklist.md is authoritative pre-launch status doc"
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 14
  completed_plans: 13
  percent: 100
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03 after v5.1 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.1 Email Infrastructure — Phase 49: Gmail Send Mail As

## Current Position

Phase: 52 of 52 (Audit the Product Launch Checklist Items) — COMPLETE
Plan: 02 of 2 — COMPLETE
Status: Phase 52 complete — launch-checklist.md fully audited (26 [x] items), Stripe live-mode verified (sk_live_ key, production webhook, live price ID), all open items documented with v6.0 disposition
Last activity: 2026-03-05 — Phase 52 Plan 02 complete: Stripe live-mode verification confirmed, launch-checklist.md is authoritative pre-launch status doc

Progress: [██████████] 100%

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| v5.0 Product Launch Checklist | 19 | 63 | 9 days |
| **Total shipped** | **49** | **152** | **~20 days** |

*v5.1 velocity tracking begins after first plan completes*
| Phase 46-cloudflare-email-routing P01 | 30 | 2 tasks | 0 files |
| Phase 46-cloudflare-email-routing P02 | 5 | 1 tasks | 0 files |
| Phase 47-domain-verification-dmarc P01 | 84 | 2 tasks | 0 files |
| Phase 47-domain-verification-dmarc P02 | 130 | 2 tasks | 0 files |
| Phase 48 P01 | 20 | 2 tasks | 0 files |
| Phase 48-activate-custom-domain-sending P02 | 40 | 2 tasks | 0 files |
| Phase 49-gmail-send-mail-as P01 | 15 | 2 tasks | 0 files |
| Phase 49-gmail-send-mail-as P02 | 10 | 2 tasks | 0 files |
| Phase 50-documentation-updates P01 | 10 | 3 tasks | 2 files |
| Phase 51 P01 | 1 | 2 tasks | 1 files |
| Phase 51 P02 | 1 | 2 tasks | 2 files |
| Phase 51 P03 | 30 | 2 tasks (1 auto + 1 human) | 2 files |
| Phase 52-audit-the-product-launch-checklist-items P01 | 0 | 2 tasks | 4 files |

## Accumulated Context

### Key Architectural Constraints (carry forward every phase)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId — ever (see .planning/INVARIANTS.md)
- v5.1 is zero code changes: only DNS records, Infisical env var update, Gmail settings, and doc edits
- Hard dependency chain: Phase 46 (inbound routing) must be live before Phase 49 (Gmail aliases) — Gmail sends a verification email to the custom address during alias setup
- Resend domain must show "Verified" in dashboard before RESEND_FROM_EMAIL is updated in Infisical (Phase 48) — updating before verification causes silent 403 failures on all transactional email
- All DKIM CNAME records in Cloudflare must be set to DNS Only (grey cloud, not proxied orange cloud) — proxied CNAMEs break DKIM verification permanently
- Never enter full FQDN in Cloudflare DNS record name fields — Cloudflare appends the zone domain automatically; enter only the subdomain prefix (e.g. resend._domainkey, not resend._domainkey.torchsecret.com)
- SPF subdomain isolation: Resend uses send.torchsecret.com, Loops uses envelope.torchsecret.com — avoids RFC 7208 one-SPF-TXT-per-FQDN rule; Cloudflare Email Routing owns the apex @ SPF record
- Gmail SMTP relay must use smtp.resend.com (port 465) with a dedicated restricted Resend API key — NOT smtp.gmail.com and NOT the production RESEND_API_KEY
- DMARC must start at p=none (never p=reject immediately) — Cloudflare Email Routing's SRS envelope rewriting breaks SPF alignment under p=reject for forwarded mail
- RESEND_FROM_EMAIL env var is the only application-layer change — all three email callers (notification.service.ts, subscribers.service.ts, Better Auth) already read it at runtime

### Decisions Made (Phase 46, Plan 01)

- Cloudflare MX hostnames: route1/route2/route3.mx.cloudflare.net (not amir/linda/isaac as documented in plan — Cloudflare periodically rotates MX pool; both are valid; no corrective action needed)
- Gmail spam filter uses deliveredto: operator — Cloudflare SRS rewrites envelope sender to bounces+...@cloudflare.net, making from: unreliable; deliveredto: preserves the original recipient and is stable
- All 7 routing rules created as individual rules (not catch-all) for explicit control over active addresses

### Decisions Made (Phase 46, Plan 02)

- Delivery verification used 2 representative addresses (hello + security) with live test emails; remaining 5 (contact, admin, info, support, privacy) confirmed by Active status — sufficient proof that the routing pipeline is functional for all 7 addresses

### Decisions Made (Phase 47, Plan 01)

- DMARC record was an edit of an existing _dmarc TXT (not a fresh add) — value updated to v=DMARC1; p=none; rua=mailto:admin@torchsecret.com
- Loops DKIM selector names are account-generated 32-char hex-like strings — must be copied exactly from Loops dashboard, never inferred
- All 3 Loops DKIM CNAMEs set to DNS Only (grey cloud) before saving — Cloudflare defaults new CNAMEs to proxied
- Apex @ SPF record (v=spf1 include:_spf.mx.cloudflare.net ~all) left untouched — owned by Cloudflare Email Routing; no amazonses.com added at apex
- Both Loops and Resend use identical SPF include and MX hostname (amazonses.com / feedback-smtp.us-east-1.amazonses.com) — both services are SES-backed; subdomain isolation still required for RFC 7208 compliance

### Decisions Made (Phase 47, Plan 02)

- Planning docs had incorrect Gmail address (torch.secrets@gmail.com with dash) — correct address is torch.secrets@gmail.com (with dot); test email sent to correct address; doc correction deferred to separate commit
- Loops From address verified per-sequence (welcome, day-3, day-7 all show hello@torchsecret.com) rather than just checking top-level settings page — provides stronger confirmation
- Resend API returned HTTP 200 on first send attempt (no 403) — confirms Verified status was fully propagated to SES backend before the send

### Roadmap Evolution

- Phase 51 added: prepare codebase, repository, documentation to transition the github repository from private to public
- Phase 52 added: audit the product launch checklist items

### Decisions Made (Phase 48, Plan 01)

- Staged rollout confirmed sufficient: updating Infisical staging first and verifying two representative email types provides adequate confidence before the production Infisical update in Plan 02
- No code changes required: all three Resend email callers (notification.service.ts, subscribers.service.ts, Better Auth) already read env.RESEND_FROM_EMAIL at call time
- Zero Resend 403 errors in staging — confirms noreply@torchsecret.com is fully authorized on Resend backend; production update is safe to proceed

### Decisions Made (Phase 48, Plan 02)

- Infisical render-sync "Disable Secret Deletion" flag: sync was deleting Render-native fromDatabase DB linkage, causing DATABASE_URL undefined on deploy. Re-linked DB in Render dashboard + enabled flag to prevent recurrence.
- Production email verification confirmed in single session: subscriber confirmation flow triggers both Resend confirmation email and Loops welcome email as a side effect — efficient single-pass test of full email chain.
- Loops DKIM alignment confirmed via Gmail "Show original" — Authentication-Results shows dkim=pass header.i=@torchsecret.com; no via loops.so or via amazonses.com relay indicator present. LOOP-03 complete.

### Decisions Made (Phase 49, Plan 01)

- smtp.resend.com:465 (implicit SSL) required — port 465 not 587 (STARTTLS); Gmail must select "SSL" not "TLS"; wrong mode causes silent "Failed to connect"
- SMTP username is literal string "resend" for all aliases — not the email address, not the API key; Resend's fixed auth scheme
- Single dedicated API key "Gmail SMTP Relay" scoped to torchsecret.com covers all 7 aliases — simpler credential management vs per-alias keys; domain restriction limits blast radius if key leaked
- All 7 aliases added in single session before verifying any — batching avoids session re-auth; Gmail queues all 7 verification emails correctly

### Decisions Made (Phase 49, Plan 02)

- DKIM spot-check via Gmail "Show original" confirmed: DKIM-Signature d=torchsecret.com; s=resend, dkim=pass header.i=@torchsecret.com — smtp.resend.com relay is active, not Gmail servers; no via gappssmtp.com
- hello@torchsecret.com set as Gmail default — all new compose windows show Torch Secret brand identity as sender
- "Reply from the same address the message was sent to" enabled — support@ replies come from support@, not hello@; preserves per-alias context

### Decisions Made (Phase 50, Plan 01)

- Your Rights section intercepted in render loop via `heading === 'Your Rights'` guard + `continue` — preserves section order without restructuring the sections data model
- security@ used only in SECURITY.md (vulnerability disclosure); privacy@ used only in privacy.ts Your Rights — each alias routed to its correct channel
- Email alternative in SECURITY.md labeled explicitly as fallback — GitHub advisory link remains primary for CVE assignment

### Decisions Made (Phase 51, Plan 03)

- PostHog phc_ keys are intentionally public (client-side analytics keys, embedded in browser JS) — finding in .planning/ debug docs is not a credential leak; all six history scans returned clean
- e2e/uat-pro-session.json was tracked but not gitignored (siblings uat-auth-session.json and uat-auth-session-pro.json were already gitignored — omission was oversight); file contained expired dev session token; auto-fixed by adding to .gitignore and running git rm --cached
- Branch protection ruleset configured before going public: Restrict deletions, Block force pushes, Require PR, Require Lint (Test/E2E excluded — they skip on fork PRs, which would permanently block fork PRs if listed as required)
- Repository publicly visible at https://github.com/norcalcoop/torch-secret — verified incognito, CI green on main (two post-launch runs)

### Decisions Made (Phase 52, Plan 01)

- Only the three post-action CTA navigate('/') calls were changed — other navigate('/') calls in dashboard.ts (logout line 236, account delete line 678) remain pointing to / (marketing home); those are correct

### Decisions Made (Phase 52, Plan 02)

- All 4 Stripe live-mode checks passed: sk_live_ key in Infisical prod, whsec_ webhook secret confirmed, production webhook endpoint at https://torchsecret.com/api/webhooks/stripe in Live mode, STRIPE_PRICE_ID_PRO is a live price_ ID — billing pipeline is launch-ready
- launch-checklist.md is gitignored by design (Phase 51) — no git commit for checklist changes; only planning docs committed

### Blockers/Concerns

None — Phase 52 complete. v5.1 milestone fully shipped. Ready for /gsd:new-milestone to kick off v6.0 Launch Execution.

## Session Continuity

Last session: 2026-03-05T23:55:00.000Z
Stopped at: Completed 52-02-PLAN.md
Resume file: None
