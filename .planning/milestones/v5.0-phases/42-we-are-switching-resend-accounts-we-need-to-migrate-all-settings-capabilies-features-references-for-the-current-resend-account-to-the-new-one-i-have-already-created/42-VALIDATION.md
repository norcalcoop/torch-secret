---
phase: 42
slug: resend-account-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-02
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (multi-project) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run server/src/routes/__tests__/subscribers.test.ts server/src/services/__tests__/notification.service.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (all Resend calls are mocked — confirms no regressions)
- **After every plan wave:** Run `npx vitest run` (full suite, no code changes expected)
- **Before `/gsd:verify-work`:** Full suite must be green + smoke test (clean server startup with new credentials)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-retrieve-credentials | 01 | 1 | Obtain new API key + Audience ID | manual | N/A (human action — Resend dashboard) | N/A | ⬜ pending |
| 42-01-update-local-env | 01 | 1 | Local `.env` updated | smoke | `infisical run --env=dev -- npm run dev:server` (Zod crash = FAIL) | ✅ | ⬜ pending |
| 42-01-update-infisical-dev | 01 | 1 | Infisical dev updated | smoke | `infisical secrets get RESEND_API_KEY --env=dev --projectId=f432290a-5b26-49f0-bde8-83825ffddd64` | ✅ | ⬜ pending |
| 42-01-update-infisical-staging | 01 | 1 | Infisical staging updated | smoke | `infisical secrets get RESEND_API_KEY --env=staging --projectId=f432290a-5b26-49f0-bde8-83825ffddd64` | ✅ | ⬜ pending |
| 42-01-update-infisical-prod | 01 | 1 | Infisical prod updated + Render auto-sync | smoke | `infisical secrets get RESEND_API_KEY --env=prod --projectId=f432290a-5b26-49f0-bde8-83825ffddd64` | ✅ | ⬜ pending |
| 42-01-smoke-test | 01 | 1 | New credentials valid — server starts clean | smoke | `infisical run --env=dev -- npm run dev:server` | ✅ | ⬜ pending |
| 42-01-revoke-old-key | 01 | 1 | Old API key revoked from old Resend dashboard | manual | N/A (human action — Resend dashboard) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — this phase adds no code.

*All Resend calls in test environments are mocked via `vi.mock('../services/email.js')` in existing test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resend API key is valid | New account credentials work | Real email delivery cannot be tested with mocked Resend in Vitest | Trigger a password reset from dev app; check inbox for delivery |
| Audience ID is valid | New Audience accepts contact sync | `resend.contacts.create()` is fire-and-forget with `.catch()` logging — no unit test captures real Resend errors | Complete double opt-in subscriber flow in dev; check new Resend Audience in dashboard |
| Old API key revocation | Old account decommissioned | External dashboard action | Open old Resend dashboard → API Keys → Revoke `re_hNmZgK...`; confirm revoke prompt |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
