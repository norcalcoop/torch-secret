---
phase: 50
slug: documentation-updates
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (multi-project) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual browser verification at `/privacy`
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 1 | ADOC-01 | manual | N/A | N/A | ⬜ pending |
| 50-01-02 | 01 | 1 | ADOC-02 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

No new test files needed — both changes are verifiable via direct inspection (SECURITY.md on GitHub, `/privacy` in browser).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SECURITY.md contains `security@torchsecret.com` | ADOC-01 | Static Markdown file — no application code path; no test harness applies | Open `SECURITY.md` in editor or on GitHub; confirm `security@torchsecret.com` appears in the "Reporting a Vulnerability" section |
| Privacy page renders `<a href="mailto:privacy@torchsecret.com">` | ADOC-02 | DOM-rendering function; no existing Vitest coverage for `privacy.ts`; writing new tests for a 2-line DOM change adds disproportionate overhead | Open `/privacy` in browser; find "Your Rights" section; confirm `privacy@torchsecret.com` renders as a clickable mailto link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
