---
phase: 49
slug: gmail-send-mail-as
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification only (zero-code configuration phase) |
| **Config file** | N/A |
| **Quick run command** | `dig resend._domainkey.torchsecret.com TXT +short` (confirms DKIM DNS live from Phase 47) |
| **Full suite command** | Manual: all 7 aliases show "verified" in Gmail Settings + DKIM spot-check via Gmail "Show original" |
| **Estimated runtime** | ~5 minutes (manual checks) |

---

## Sampling Rate

- **After every task commit:** Check Gmail Settings to confirm expected state after each alias added
- **After every plan wave:** Full manual check — all 7 verified + DKIM spot check + default address confirmed
- **Before `/gsd:verify-work`:** All 4 GMAI requirements satisfied and spot-check email sent
- **Max feedback latency:** ~5 minutes (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 49-??-01 | 01 | 1 | GMAI-01 | manual | N/A — Resend dashboard confirmation | N/A | ⬜ pending |
| 49-??-02 | 01 | 1 | GMAI-02 | manual | N/A — Gmail UI verification | N/A | ⬜ pending |
| 49-??-03 | 01 | 1 | GMAI-03 | manual | `dig resend._domainkey.torchsecret.com TXT +short` | N/A | ⬜ pending |
| 49-??-04 | 01 | 1 | GMAI-04 | manual | N/A — Gmail UI verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — zero-code configuration phase. No test files needed. Existing infrastructure (Phase 47 DKIM DNS) covers the one automatable check.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dedicated Resend API key exists, restricted to torchsecret.com | GMAI-01 | Resend dashboard only — no API to query key existence | Log in to Resend → API Keys → confirm key scoped to torchsecret.com domain |
| All 7 aliases in Gmail Settings "Send mail as" with smtp.resend.com SMTP | GMAI-02 | Gmail Settings UI — no API for alias enumeration | Gmail → Settings → Accounts and Import → "Send mail as" section — count 7 entries |
| All 7 aliases show "verified" status | GMAI-03 | Gmail Settings UI verification status | Gmail → Settings → Accounts and Import → each alias must show no "Unverified" warning |
| hello@torchsecret.com shows "Signed by: torchsecret.com", no "via gappssmtp.com" | GMAI-03 | Requires live email send and header inspection | Send test email from hello@torchsecret.com via Gmail → View original → check Authentication-Results and DKIM-Signature headers |
| hello@torchsecret.com is set as default outbound address | GMAI-04 | Gmail Settings UI only | Gmail → Compose new email → confirm From field defaults to hello@torchsecret.com |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
