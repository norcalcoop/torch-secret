---
gsd_state_version: 1.0
milestone: v5.1
milestone_name: Email Infrastructure
status: planning
stopped_at: Phase 46 context gathered
last_updated: "2026-03-04T11:48:47.071Z"
last_activity: 2026-03-03 — Roadmap created; 5 phases defined across 14 requirements
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03 after v5.1 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.1 Email Infrastructure — Phase 46: Cloudflare Email Routing

## Current Position

Phase: 46 of 50 (Cloudflare Email Routing)
Plan: —
Status: Ready to plan
Last activity: 2026-03-03 — Roadmap created; 5 phases defined across 14 requirements

Progress: ░░░░░░░░░░ 0%

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

### Blockers/Concerns

None — ready to begin Phase 46

## Session Continuity

Last session: 2026-03-04T11:48:47.069Z
Stopped at: Phase 46 context gathered
Resume file: .planning/phases/46-cloudflare-email-routing/46-CONTEXT.md
