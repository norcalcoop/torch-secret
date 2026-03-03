---
phase: 45
slug: billing-service-gap-closure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (multi-project) |
| **Config file** | `vitest.config.ts` (server project: node environment, `fileParallelism: false`) |
| **Quick run command** | `npx vitest run server/src/services/billing.service.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/src/services/billing.service.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 0 | BILL-05 | unit | `npx vitest run server/src/routes/__tests__/billing.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-02 | 01 | 1 | BILL-05 | unit | `npx vitest run server/src/routes/__tests__/billing.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-03 | 01 | 1 | BILL-05 | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists | ⬜ pending |
| 45-02-01 | 02 | 1 | ESEQ-03 | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists | ⬜ pending |
| 45-02-02 | 02 | 1 | ESEQ-03 | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists | ⬜ pending |
| 45-02-03 | 02 | 1 | ESEQ-03 | unit | `npx vitest run server/src/services/billing.service.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/routes/__tests__/billing.test.ts` — new file: stubs for BILL-05 (verify-checkout calls activatePro, idempotency guard)

*All other test files (`billing.service.test.ts`) already exist — plans extend with new describe blocks.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
