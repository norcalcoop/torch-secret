---
phase: 47-domain-verification-dmarc
plan: 01
subsystem: infra
tags: [dns, cloudflare, dkim, spf, dmarc, resend, loops, email-auth]

# Dependency graph
requires:
  - phase: 46-cloudflare-email-routing
    provides: Cloudflare zone ownership and apex @ SPF record managed by Cloudflare Email Routing
provides:
  - 9 DNS records at torchsecret.com enabling Resend + Loops.so sending and DMARC policy
  - Resend DKIM TXT at resend._domainkey.torchsecret.com
  - Resend SPF TXT + MX at send.torchsecret.com
  - Loops.so 3x DKIM CNAMEs (DNS Only) + SPF TXT + MX at envelope.torchsecret.com
  - DMARC TXT at _dmarc.torchsecret.com (p=none, rua=admin@torchsecret.com)
affects: [47-02-resend-loops-dashboard-verification, 48-resend-from-email-update, 49-gmail-smtp-relay]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SPF subdomain isolation: Resend owns send.torchsecret.com, Loops owns envelope.torchsecret.com — avoids RFC 7208 one-SPF-TXT-per-FQDN collision; apex @ remains Cloudflare Email Routing only"
    - "DKIM CNAME DNS Only: Cloudflare CNAME proxy (orange cloud) must be disabled for all DKIM CNAMEs — proxied CNAMEs return Cloudflare IPs instead of the expected amazonaws.com targets, breaking DKIM verification permanently"
    - "DMARC p=none start: never p=reject at launch — Cloudflare Email Routing SRS envelope rewriting breaks SPF alignment under p=reject for forwarded mail"

key-files:
  created: []
  modified: []

key-decisions:
  - "DMARC record was an edit of an existing _dmarc TXT (not a fresh add) — value updated to v=DMARC1; p=none; rua=mailto:admin@torchsecret.com"
  - "Loops.so DKIM selector names are account-generated 32-char hex-like strings — must be copied exactly from Loops dashboard, never inferred"
  - "All 3 Loops DKIM CNAMEs set to DNS Only (grey cloud) before saving — Cloudflare defaults new CNAMEs to proxied"
  - "Apex @ SPF record (v=spf1 include:_spf.mx.cloudflare.net ~all) left untouched — owned by Cloudflare Email Routing; no amazonses.com added at apex"

patterns-established:
  - "SPF subdomain isolation pattern: each email vendor gets its own subdomain (send, envelope) for SPF rather than merging at apex"
  - "DNS Only enforcement for DKIM CNAMEs: always toggle Cloudflare proxy off before saving CNAME records used for DKIM"

requirements-completed: [RSND-01, LOOP-01, LOOP-02]

# Metrics
duration: ~84min
completed: 2026-03-04
---

# Phase 47 Plan 01: DNS Records for Resend, Loops.so, and DMARC Summary

**9 DNS records added to Cloudflare DNS — Resend DKIM/SPF/MX, Loops.so 3x DKIM CNAMEs (DNS Only) + SPF/MX, and DMARC p=none — all propagated and verified via dig**

## Performance

- **Duration:** ~84 min (includes Loops.so dashboard retrieval, Cloudflare entry, propagation wait)
- **Started:** 2026-03-04T14:27:38Z
- **Completed:** 2026-03-04T15:51:44Z
- **Tasks:** 2 of 2
- **Files modified:** 0 (DNS-only changes)

## Accomplishments

- Retrieved all 5 Loops.so DNS record values from dashboard (3 account-generated DKIM CNAME selectors + SPF TXT + MX)
- Added all 9 DNS records to Cloudflare in a single session with correct proxy settings on every record
- Confirmed propagation via dig: all 10 verification checks pass including apex @ SPF integrity check (no amazonses.com at apex)

## Task Commits

This plan made no code changes — all work was DNS configuration in external dashboards. No per-task commits applicable.

**Plan metadata:** *(see final metadata commit below)*

## Files Created/Modified

None — this plan consists entirely of DNS record additions in Cloudflare's dashboard. No files in the repository were created or modified.

## DNS Records Added

| # | Type | Name | Value / Target | Proxy |
|---|------|------|----------------|-------|
| 1 | TXT | `resend._domainkey.torchsecret.com` | `v=DKIM1; p=MIGfMA0GCSqGSIb3...` (Resend public key) | DNS Only |
| 2 | TXT | `send.torchsecret.com` | `v=spf1 include:amazonses.com ~all` | DNS Only |
| 3 | MX | `send.torchsecret.com` | `feedback-smtp.us-east-1.amazonses.com` priority 10 | DNS Only |
| 4 | CNAME | `q7mguvozai5tzbj6srsxe3icdagai4mq._domainkey.torchsecret.com` | `q7mguvozai5tzbj6srsxe3icdagai4mq.dkim.amazonses.com` | DNS Only |
| 5 | CNAME | `sopwye74r77qwsiit7mf6zayk6roaac7._domainkey.torchsecret.com` | `sopwye74r77qwsiit7mf6zayk6roaac7.dkim.amazonses.com` | DNS Only |
| 6 | CNAME | `xgxyufekgpq7teguhr325qlysxcr2lif._domainkey.torchsecret.com` | `xgxyufekgpq7teguhr325qlysxcr2lif.dkim.amazonses.com` | DNS Only |
| 7 | TXT | `envelope.torchsecret.com` | `v=spf1 include:amazonses.com ~all` | DNS Only |
| 8 | MX | `envelope.torchsecret.com` | `feedback-smtp.us-east-1.amazonses.com` priority 10 | DNS Only |
| 9 | TXT | `_dmarc.torchsecret.com` | `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com` | DNS Only |

## Dig Verification Results

All 10 checks passed after propagation:

```
dig resend._domainkey.torchsecret.com TXT +short
→ "v=DKIM1; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCtAwGse8FjRGhtsx2QrlhH4MqFgT+vDql9YxJTVIRwVzmERt7cOyhbcbN5eTTxWhB3EsV4MESigy9rI/NGQQlW5pLJ3Dx2zmaihFOAWnVvcXMi2iOjwh4dv2aWVE+RNXryWqwJYYA89Hsf7EcUreUy5t3c7eyE4PYwrtjljcMVfwIDAQAB"

dig send.torchsecret.com TXT +short
→ "v=spf1 include:amazonses.com ~all"

dig send.torchsecret.com MX +short
→ 10 feedback-smtp.us-east-1.amazonses.com.

dig envelope.torchsecret.com TXT +short
→ "v=spf1 include:amazonses.com ~all"

dig envelope.torchsecret.com MX +short
→ 10 feedback-smtp.us-east-1.amazonses.com.

dig _dmarc.torchsecret.com TXT +short
→ "v=DMARC1; p=none; rua=mailto:admin@torchsecret.com"

dig torchsecret.com TXT +short
→ "v=spf1 include:_spf.mx.cloudflare.net ~all"  (no amazonses.com — PASS)

dig q7mguvozai5tzbj6srsxe3icdagai4mq._domainkey.torchsecret.com CNAME +short
→ q7mguvozai5tzbj6srsxe3icdagai4mq.dkim.amazonses.com.

dig sopwye74r77qwsiit7mf6zayk6roaac7._domainkey.torchsecret.com CNAME +short
→ sopwye74r77qwsiit7mf6zayk6roaac7.dkim.amazonses.com.

dig xgxyufekgpq7teguhr325qlysxcr2lif._domainkey.torchsecret.com CNAME +short
→ xgxyufekgpq7teguhr325qlysxcr2lif.dkim.amazonses.com.
```

## Decisions Made

- **DMARC was an edit, not a fresh add:** The `_dmarc` TXT record already existed in Cloudflare (likely from a prior Cloudflare DMARC wizard run). The value was updated to `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com` — no duplicate record issues.
- **Loops DKIM selector names:** Account-generated 32-character hex-like strings. Copied exactly from Loops.so Settings → Domain dashboard. These are not guessable and must always be sourced from the dashboard.
- **Both Loops and Resend use identical SPF include and MX hostname:** `include:amazonses.com` and `feedback-smtp.us-east-1.amazonses.com` respectively — both services are SES-backed. Subdomain isolation (send vs envelope) is still required to satisfy RFC 7208 one-TXT-per-FQDN rule.

## Deviations from Plan

None — plan executed exactly as written. All records added in the order specified. All proxy settings applied correctly.

## Issues Encountered

None. Records propagated quickly (within the 5-minute window suggested by the plan). All dig checks returned expected values on first run.

## Next Phase Readiness

- All 9 DNS records are live and independently resolvable
- Resend and Loops.so dashboards can now be triggered to verify domain ownership (Plan 02)
- DMARC monitoring is active at p=none — reports will begin accumulating to admin@torchsecret.com once sending starts
- No blockers for Plan 02

---
*Phase: 47-domain-verification-dmarc*
*Completed: 2026-03-04*
