---
phase: 48
slug: activate-custom-domain-sending
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification only (zero-code operations phase) |
| **Config file** | none |
| **Quick run command** | Check inbox From header after each email trigger |
| **Full suite command** | Trigger all 3 email types + inspect Loops raw headers via Gmail "Show original" |
| **Estimated runtime** | ~10 minutes per environment (manual) |

---

## Sampling Rate

- **After every task commit:** Trigger the relevant email type and confirm From header before marking complete
- **After every plan wave:** Not applicable — single-wave phase
- **Before `/gsd:verify-work`:** All 3 success criteria satisfied in inbox (correct From address + Loops raw header pass)
- **Max feedback latency:** ~5 minutes (email delivery time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 48-01-01 | 01 | 1 | RSND-02 | manual | Update RESEND_FROM_EMAIL in Infisical staging dashboard | N/A | ⬜ pending |
| 48-01-02 | 01 | 1 | RSND-03 | manual | Trigger subscriber confirmation email → check inbox From = noreply@torchsecret.com | N/A | ⬜ pending |
| 48-01-03 | 01 | 1 | RSND-03 | manual | Trigger secret-viewed notification → check inbox From = noreply@torchsecret.com | N/A | ⬜ pending |
| 48-01-04 | 01 | 1 | RSND-02 | manual | Update RESEND_FROM_EMAIL in Infisical production dashboard + redeploy | N/A | ⬜ pending |
| 48-01-05 | 01 | 1 | RSND-03 | manual | Verify production emails arrive from noreply@torchsecret.com | N/A | ⬜ pending |
| 48-01-06 | 01 | 1 | LOOP-03 | manual | Confirm subscriber to fire 'subscribed' event → Gmail "Show original" → inspect Authentication-Results | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*This is a zero-code operations phase. No test files are created or modified. No new test infrastructure is needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RESEND_FROM_EMAIL updated to noreply@torchsecret.com in Infisical staging | RSND-02 | Infisical dashboard update — no CLI read-back available; no API endpoint exposes current env var value | Log in to Infisical → Project → staging environment → find RESEND_FROM_EMAIL → confirm new value is noreply@torchsecret.com |
| Secret-viewed notification arrives from noreply@torchsecret.com | RSND-03 | Email delivery requires live inbox inspection | Log in to staging, create secret with notification email enabled, consume secret from incognito session, check inbox From header |
| Subscriber confirmation arrives from noreply@torchsecret.com | RSND-03 | Email delivery requires live inbox inspection | `curl -X POST {staging-url}/api/subscribers -H 'Content-Type: application/json' -d '{"email":"test@example.com"}'` → check inbox From header |
| RESEND_FROM_EMAIL updated to noreply@torchsecret.com in Infisical production | RSND-02 | Infisical dashboard update — same as staging | Log in to Infisical → Project → production environment → update + confirm value |
| Loops welcome email has no "via loops.so" raw header indicator | LOOP-03 | Raw header inspection requires Gmail "Show original" — not machine-readable without email API access | POST /api/subscribers with fresh email → click confirmation link → open welcome email in Gmail → three-dot menu → "Show original" → verify `dkim=pass header.i=@torchsecret.com` in Authentication-Results; confirm no "via loops.so" in From display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10 minutes
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
