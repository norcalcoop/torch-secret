---
phase: 47
slug: domain-verification-dmarc
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-04
audited: 2026-03-04
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification only — zero-code DNS configuration phase |
| **Config file** | none |
| **Quick run command** | `dig resend._domainkey.torchsecret.com TXT +short` |
| **Full suite command** | Manual: Resend dashboard Verified + Loops dashboard Records present + curl test send + Gmail inbox confirm |
| **Estimated runtime** | ~5–15 min per verification pass (DNS propagation dependent) |

---

## Sampling Rate

- **After every task commit:** Run `dig` check for the specific record type just added
- **After every plan wave:** Run full manual check — Resend dashboard status + Loops dashboard status
- **Before `/gsd:verify-work`:** All success criteria must be satisfied (dashboards green + email in inbox)
- **Max feedback latency:** ~15 minutes (DNS propagation + provider polling delay)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | RSND-01 | manual | `dig resend._domainkey.torchsecret.com TXT +short` | N/A | ✅ green |
| 47-01-02 | 01 | 1 | RSND-01 | manual | `dig send.torchsecret.com TXT +short` | N/A | ✅ green |
| 47-01-03 | 01 | 1 | RSND-01 | manual | `dig send.torchsecret.com MX +short` | N/A | ✅ green |
| 47-01-04 | 01 | 1 | RSND-01 | manual | Resend dashboard → Domains → torchsecret.com → Verify | N/A | ✅ green |
| 47-02-01 | 01 | 1 | LOOP-01 | manual | `dig envelope.torchsecret.com TXT +short` | N/A | ✅ green |
| 47-02-02 | 01 | 1 | LOOP-01 | manual | `dig envelope.torchsecret.com MX +short` | N/A | ✅ green |
| 47-02-03 | 01 | 1 | LOOP-01 | manual | `dig [selector]._domainkey.torchsecret.com CNAME +short` (×3) | N/A | ✅ green |
| 47-02-04 | 02 | 2 | LOOP-01, LOOP-02 | manual | Loops dashboard → Settings → Domain → Verify Records | N/A | ✅ green |
| 47-03-01 | 01 | 1 | RSND-01 | manual | `dig _dmarc.torchsecret.com TXT +short` | N/A | ✅ green |
| 47-03-02 | 02 | 2 | RSND-01 | manual | `curl -X POST https://api.resend.com/emails ...` (see RESEARCH.md) | N/A | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*This is a zero-code DNS configuration phase. No test files, no test stubs, and no framework installation is needed. All verification is manual (dig commands + dashboard checks + API test send).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resend dashboard shows torchsecret.com Verified (DKIM + SPF + MX all green) | RSND-01 | External dashboard state — no API to query Resend verification status | Resend dashboard → Domains → torchsecret.com → confirm all three record rows show "Verified" |
| noreply@torchsecret.com delivers to Gmail inbox without spam | RSND-01 | Inbox delivery is a human-observable outcome | `curl` test send per RESEARCH.md; check torch.secrets@gmail.com inbox (not spam folder) |
| Loops.so dashboard shows torchsecret.com domain records present (green) | LOOP-01 | External dashboard state — no API to query Loops verification status | Loops Settings → Domain → View Records → all rows show green checkmarks |
| hello@torchsecret.com confirmed as sender address in Loops.so settings | LOOP-02 | Loops sender configuration is dashboard-only, no API check | Loops Settings → Domain → confirm From address is hello@torchsecret.com |
| DMARC TXT record published correctly | RSND-01 | DNS record validation | `dig _dmarc.torchsecret.com TXT +short` returns `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com` |
| Apex @ SPF unchanged (Cloudflare Email Routing only) | RSND-01 | Confirm no SPF records added at wrong location | `dig torchsecret.com TXT +short` must NOT show `include:amazonses.com` — only Cloudflare Email Routing SPF |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15 min per pass
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** complete — 2026-03-04

---

## Validation Audit 2026-03-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual-only (by design) | 10 |

All 10 tasks verified via dig commands (live DNS confirmed) + SUMMARY files (dashboard states + Resend API test email ID 5ff8d869-2ff2-4494-9900-8cdf130489d3). Zero-code DNS phase — no automated test files applicable. All statuses updated from ⬜ pending to ✅ green.
