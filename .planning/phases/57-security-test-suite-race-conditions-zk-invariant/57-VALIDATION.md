---
phase: 57
slug: security-test-suite-race-conditions-zk-invariant
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-06
---

# Phase 57 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (multi-project: server project) |
| **Quick run command** | `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 57-01-01 | 01 | 1 | TEST-03 | integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ W0 | ✅ green |
| 57-02-01 | 02 | 1 | TEST-04 | integration | `npx vitest run server/src/routes/__tests__/zk-invariant.test.ts` | ✅ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `server/src/routes/__tests__/secrets.test.ts` — extend existing file with concurrent race test for TEST-03
- [x] `server/src/routes/__tests__/zk-invariant.test.ts` — new file for ZK invariant DB schema test (TEST-04)

*Existing infrastructure (vitest, supertest, drizzle) covers all phase requirements — no new packages.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-09
