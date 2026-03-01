---
phase: 39
slug: complete-finish-google-auth-and-github-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-01
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (server project) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run server/src/tests/auth.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds (auth suite alone) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/src/tests/auth.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | Google OAuth app creation | manual | N/A — external dashboard | ✅ | ⬜ pending |
| 39-01-02 | 01 | 1 | Google credentials in Infisical dev | manual | N/A — Infisical dashboard | ✅ | ⬜ pending |
| 39-01-03 | 01 | 1 | Google credentials in Infisical prod | manual | N/A — Infisical dashboard | ✅ | ⬜ pending |
| 39-02-01 | 02 | 1 | GitHub OAuth App (dev) creation | manual | N/A — GitHub settings | ✅ | ⬜ pending |
| 39-02-02 | 02 | 1 | GitHub OAuth App (prod) creation | manual | N/A — GitHub settings | ✅ | ⬜ pending |
| 39-02-03 | 02 | 1 | GitHub credentials in Infisical | manual | N/A — Infisical dashboard | ✅ | ⬜ pending |
| 39-03-01 | 03 | 2 | Google sign-in round-trip (dev) | manual UAT | UAT checkpoint | ✅ | ⬜ pending |
| 39-03-02 | 03 | 2 | GitHub sign-in round-trip (dev) | manual UAT | UAT checkpoint | ✅ | ⬜ pending |
| 39-03-03 | 03 | 2 | AUTH-06 / AUTH-07 unskipped | unit | `npx vitest run server/src/tests/auth.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test files needed — `auth.test.ts` already has AUTH-06 and AUTH-07 which become active once credentials are injected.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Google OAuth round-trip (login + dashboard redirect) | Phase 39 goal | Browser leaves app domain to Google consent UI — cannot be automated | 1. Start dev server with Infisical. 2. Go to `/login`. 3. Click "Continue with Google". 4. Complete Google sign-in. 5. Verify redirect to `/dashboard`. 6. Verify user row in DB with `provider: "google"`. |
| GitHub OAuth round-trip (login + dashboard redirect) | Phase 39 goal | Browser leaves app domain to GitHub authorization UI | 1. Start dev server with Infisical. 2. Go to `/login`. 3. Click "Continue with GitHub". 4. Complete GitHub authorization. 5. Verify redirect to `/dashboard`. 6. Verify user row in DB with `provider: "github"`. |
| OAuth button error path (no credentials) | Regression guard | Must verify graceful fallback still works | Remove one env var, attempt OAuth, verify redirect to `/login?error=oauth`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
