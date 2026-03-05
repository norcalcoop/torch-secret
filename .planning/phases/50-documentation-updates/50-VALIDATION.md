---
phase: 50
slug: documentation-updates
status: partial
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
audited: 2026-03-05
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
| 50-01-02 | 01 | 1 | ADOC-02 | automated | `npx vitest run client/src/pages/privacy.test.ts` | `client/src/pages/privacy.test.ts` | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers ADOC-02. ADOC-01 (static Markdown) has no applicable Vitest harness.

`client/src/pages/privacy.test.ts` was added by Nyquist audit on 2026-03-05 to cover ADOC-02.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SECURITY.md contains `security@torchsecret.com` | ADOC-01 | Static Markdown file — no application code path; no test harness applies | Open `SECURITY.md` in editor or on GitHub; confirm `security@torchsecret.com` appears in the "Reporting a Vulnerability" section |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — ADOC-01 remains manual-only (static Markdown; no Vitest harness applicable)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter — blocked by ADOC-01 manual-only

**Approval:** partial — ADOC-02 automated (green), ADOC-01 manual-only (justified)

---

## Validation Audit 2026-03-05

| Metric | Count |
|--------|-------|
| Gaps found | 2 |
| Resolved (automated) | 1 — ADOC-02 (`privacy.test.ts`) |
| Escalated to manual-only | 1 — ADOC-01 (static Markdown, no Vitest harness) |
