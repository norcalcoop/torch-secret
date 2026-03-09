---
phase: 63
slug: nyquist-compliance-phase-57-58-6
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (multi-project: server project, node environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command (Phase 57)** | `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts` |
| **Quick run command (Phase 58.6)** | `npx vitest run server/src/routes/seo/templates/layout.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~30 seconds (Phase 57 quick), ~10 seconds (Phase 58.6 quick) |

---

## Sampling Rate

- **After Phase 57 task:** Run `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts`
- **After Phase 58.6 task:** Run `npx vitest run server/src/routes/seo/templates/layout.test.ts`
- **Before phase complete:** Both test runs must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | Phase 57 tests green | integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts server/src/routes/__tests__/zk-invariant.test.ts` | ✅ | ✅ green |
| 63-01-02 | 01 | 1 | Phase 58.6 tests green | unit | `npx vitest run server/src/routes/seo/templates/layout.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no new test files needed. All test files pre-exist on disk.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification. Documentation edits are verified by test runs.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-09

## Validation Audit 2026-03-09
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
