---
gsd_state_version: 1.0
milestone: v5.1
milestone_name: Email Infrastructure
status: verifying
stopped_at: Phase 47 context gathered
last_updated: "2026-03-04T14:27:38.153Z"
last_activity: "2026-03-04 — Phase 46 complete: test emails to hello@torchsecret.com and security@torchsecret.com delivered to torch-secret@gmail.com inbox; all 7 routing rules Active"
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03 after v5.1 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.1 Email Infrastructure — Phase 47: Domain Verification + DMARC (next phase)

## Current Position

Phase: 46 of 50 (Cloudflare Email Routing) — COMPLETE
Plan: 02 of 2 — COMPLETE
Status: Phase 46 complete — both plans done; inbound routing live and delivery verified
Last activity: 2026-03-04 — Phase 46 complete: test emails to hello@torchsecret.com and security@torchsecret.com delivered to torch-secret@gmail.com inbox; all 7 routing rules Active

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

### Roadmap Evolution

- Phase 51 added: prepare codebase, repository, documentation to transition the github repository from private to public
- Phase 52 added: audit the product launch checklist items

### Blockers/Concerns

None — Phase 46 fully complete. Phase 49 hard dependency satisfied: inbound routing live and delivery verified.

## Session Continuity

Last session: 2026-03-04T14:27:38.151Z
Stopped at: Phase 47 context gathered
Resume file: .planning/phases/47-domain-verification-dmarc/47-CONTEXT.md
