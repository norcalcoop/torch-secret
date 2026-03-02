---
phase: 43
slug: verify-phase-37-email-onboarding-sequence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run server/src/services/onboarding.service.test.ts` |
| **Full suite command** | `npx vitest run server/src/services/onboarding.service.test.ts server/src/routes/auth.test.ts server/src/pages/register.test.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/src/services/onboarding.service.test.ts`
- **After every plan wave:** Run full suite command above
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | ESEQ-01 | static | `grep -r "onboarding" server/src/services/` | ✅ | ⬜ pending |
| 43-01-02 | 01 | 1 | ESEQ-02 | static | `grep -r "databaseHooks" server/src/` | ✅ | ⬜ pending |
| 43-01-03 | 01 | 1 | ESEQ-03 | static | `grep -r "marketing_consent" server/src/db/` | ✅ | ⬜ pending |
| 43-01-04 | 01 | 1 | ESEQ-04 | static | `grep -r "marketing" client/src/pages/register` | ✅ | ⬜ pending |
| 43-01-05 | 01 | 1 | ESEQ-01-04 | unit | `npx vitest run server/src/services/onboarding.service.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Phase 43 is a documentation/verification audit — no new test files needed. 10 existing tests cover ESEQ-01 through ESEQ-04.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Loops loop published/active status | ESEQ-01 | External platform — cannot query programmatically | Check Loops.so dashboard → Loops → confirm welcome email loop is active/published |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
