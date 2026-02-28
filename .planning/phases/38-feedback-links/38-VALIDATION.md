---
phase: 38
slug: feedback-links
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-02-28
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (client=happy-dom, server=node) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run client/src/pages/` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run client/src/pages/`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | FBCK-01 | unit | `npx vitest run client/src/pages/confirmation` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | FBCK-02 | unit | `npx vitest run client/src/pages/reveal` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/src/pages/confirmation.test.ts` — stubs for FBCK-01 (feedback link present on confirmation page)
- [ ] `client/src/pages/reveal.test.ts` — stubs for FBCK-02 (feedback link present on reveal page)

*Existing infrastructure covers the test framework; only the test stubs are new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Link opens Tally.so form in new tab | FBCK-01, FBCK-02 | `target="_blank"` behavior not testable in happy-dom | Open confirmation/reveal page in browser; click feedback link; verify new tab opens to correct Tally URL |
| Feedback link is visually distinct and accessible | FBCK-01, FBCK-02 | Visual inspection required | Verify link has ExternalLink icon and sufficient contrast in both light and dark themes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
