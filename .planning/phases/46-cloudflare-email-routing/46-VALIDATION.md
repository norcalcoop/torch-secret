---
phase: 46
slug: cloudflare-email-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification only (zero-code phase — no automated test coverage applicable) |
| **Config file** | none |
| **Quick run command** | `dig MX torchsecret.com +short` |
| **Full suite command** | Manual: send test emails to hello@ and security@ from external account, confirm delivery + all 7 rules Active |
| **Estimated runtime** | ~5 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Run `dig MX torchsecret.com +short`
- **After every plan wave:** Full manual test: send emails to hello@ and security@ from external account, confirm delivery in torch-secret@gmail.com
- **Before `/gsd:verify-work`:** All 7 rules Active + 2 test emails confirmed delivered
- **Max feedback latency:** ~5 minutes (manual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 46-01-01 | 01 | 1 | EROT-01 | manual | `dig MX torchsecret.com +short` (confirms routing DNS live) | N/A | ⬜ pending |
| 46-01-02 | 01 | 1 | EROT-01 | manual | Check Cloudflare dashboard: 7 rules show Active | N/A | ⬜ pending |
| 46-01-03 | 01 | 2 | EROT-02 | manual | Send email to hello@torchsecret.com from external account; confirm arrival | N/A | ⬜ pending |
| 46-01-04 | 01 | 2 | EROT-02 | manual | Send email to security@torchsecret.com from external account; confirm arrival | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (manual verification only; no test files needed for a zero-code DNS configuration phase).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 7 routing rules exist and show Active status | EROT-01 | Requires Cloudflare dashboard access; no public API returns rule status | Navigate to Email > Email Routing > Routing rules. Confirm hello, contact, admin, info, support, security, privacy all show Active |
| External email to hello@torchsecret.com arrives in torch-secret@gmail.com | EROT-02 | Requires live email send from external account; no automation possible | Send from non-torchsecret.com account (personal Gmail/Fastmail). Check inbox AND spam in torch-secret@gmail.com |
| External email to security@torchsecret.com arrives in torch-secret@gmail.com | EROT-02 | Requires live email send from external account | Send from non-torchsecret.com account. Check inbox AND spam in torch-secret@gmail.com |
| Cloudflare MX records live in DNS | EROT-01 | Confirms routing is enabled at DNS level | `dig MX torchsecret.com +short` — expect amir/linda/isaac.mx.cloudflare.net at priorities 13/24/86 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 minutes (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
