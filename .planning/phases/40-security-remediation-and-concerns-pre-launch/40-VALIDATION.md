---
phase: 40
slug: security-remediation-and-concerns-pre-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-01
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (root) — multi-project: `client` (happy-dom) + `server` (node) |
| **Quick run command** | `npx vitest run server/src/routes/__tests__/secrets.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~60 seconds (integration tests hit real PostgreSQL) |

---

## Sampling Rate

- **After every task commit:** Run quick command for the affected test file
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Rate limiter (5/min /verify) | 01 | 1 | D2, SR-015 | Integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ extend | ⬜ pending |
| p-limit Argon2id concurrency | 01 | 1 | D2, SR-015 | Integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ extend | ⬜ pending |
| Pool hardening + circuit breaker | 01 | 1 | D3, SR-016 | Integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ extend | ⬜ pending |
| 100KB payload limit | 01 | 1 | D1, SR-014 | Integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ extend | ⬜ pending |
| console.error → logger.error | 02 | 1 | CONCERNS | Unit | `npx vitest run server/src/services/__tests__/notification.service.test.ts` | ❌ W0 | ⬜ pending |
| E2E_TEST NODE_ENV gate | 02 | 1 | CONCERNS | Unit | `npm run test:run` | ✅ rate-limit.test | ⬜ pending |
| passOnStoreError warn logging | 02 | 1 | CONCERNS | Unit | `npm run test:run` | ✅ rate-limit.test | ⬜ pending |
| ZK invariant test | 02 | 1 | I4, SR-012, Gap 5 | Unit | `npx vitest run server/src/services/__tests__/notification.service.test.ts` | ❌ W0 | ⬜ pending |
| IDOR dashboard test | 03 | 2 | E1, SR-017, Gap 2 | Integration | `npx vitest run server/src/routes/__tests__/dashboard.test.ts` | ✅ extend | ⬜ pending |
| Session logout invalidation | 03 | 2 | E3, SR-003, Gap 3 | Integration | `npx vitest run server/src/routes/__tests__/auth.test.ts` | ❌ W0 | ⬜ pending |
| Pro-gate re-validation | 03 | 2 | E4, SR-018, Gap 4 | Integration | `npx vitest run server/src/routes/__tests__/auth.test.ts` | ❌ W0 | ⬜ pending |
| OAuth account-linking audit | 03 | 2 | E2, SR-004 | Code review | Manual review of auth.ts + comment | ✅ code only | ⬜ pending |
| Stripe webhook signature | 04 | 2 | Gap 1 | Integration | `npx vitest run server/src/routes/__tests__/webhooks.test.ts` | ❌ W0 | ⬜ pending |
| Race condition auto-destroy | 04 | 2 | Gap 6 | Integration | `npx vitest run server/src/routes/__tests__/secrets.test.ts` | ✅ extend | ⬜ pending |
| Expiration soft/hard delete | 04 | 2 | Gap 7 | Unit | `npx vitest run server/src/workers/__tests__/expiration-worker.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/services/__tests__/notification.service.test.ts` — stubs for ZK invariant + console.error replacement (Gap 5, Item #5)
- [ ] `server/src/routes/__tests__/auth.test.ts` — stubs for session logout + Pro-gate re-validation (Gap 3, Gap 4, Item #8, Item #9)
- [ ] `server/src/routes/__tests__/webhooks.test.ts` — stubs for Stripe webhook signature verification (Gap 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth account-linking email-match | E2, SR-004 | Better Auth internal behavior; no public API to trigger linking directly | Read `server/src/auth.ts`; verify no `account.accountLinking.trustedProviders` or unsafe defaults; add code comment documenting finding |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
