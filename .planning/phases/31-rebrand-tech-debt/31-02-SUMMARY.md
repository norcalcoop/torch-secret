---
phase: "31"
plan: "02"
subsystem: infrastructure
tags: [rebrand, ci, docker, lucide, readme, env-config]
dependency_graph:
  requires: []
  provides: [torch-secret-package-name, ci-env-vars-complete, lucide-0.575.0, readme-refreshed]
  affects: [ci-pipeline, docker-builds, local-dev-setup, app-url-resolution]
tech_stack:
  added: []
  patterns: [zod-default-fallback, lucide-esm-fixed]
key_files:
  created: []
  modified:
    - package.json
    - docker-compose.yml
    - render.yaml
    - .github/workflows/ci.yml
    - server/src/config/env.ts
    - vite.config.ts
    - README.md
decisions:
  - "Lucide 0.575.0 ESM entry point is fixed upstream; alias removed from vite.config.ts"
  - "CI postgres credentials (POSTGRES_USER/PASSWORD/DB, DATABASE_URL) intentionally preserved as secureshare — these are infrastructure identifiers, not brand surfaces"
  - "GitHub repo URLs (norcalcoop/secureshare) preserved in README; repo rename is out of scope per RESEARCH.md open question #2"
  - "APP_URL uses .default('http://localhost:3000') to always be defined in dev without requiring env var"
metrics:
  duration: "~4 minutes"
  completed: "2026-02-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 31 Plan 02: Infrastructure Rebrand + Lucide Upgrade + README Refresh Summary

Infrastructure files rebranded to Torch Secret, CI env vars completed for Zod validation, APP_URL defaulted for local dev, Lucide upgraded to 0.575.0 with alias removed (ESM bug fixed upstream), and README refreshed with v4.0 tech stack.

## Tasks Completed

| Task | Name | Commit | Key Files |
| ---- | ---- | ------ | --------- |
| 1 | Rename brand in package.json, Docker Compose, render.yaml; add CI env vars; update APP_URL default | 8d812ec | package.json, docker-compose.yml, render.yaml, .github/workflows/ci.yml, server/src/config/env.ts |
| 2 | Upgrade Lucide to 0.575.0, remove alias if ESM fixed; refresh README.md | 03da3a9 | vite.config.ts, README.md, package.json, package-lock.json |

## What Was Built

### Task 1: Infrastructure Rebrand + CI Env Vars + APP_URL Default

**package.json:** `"name"` changed from `secureshare` to `torch-secret`.

**docker-compose.yml:** `RESEND_FROM_EMAIL` updated from `SecureShare <noreply@localhost>` to `Torch Secret <noreply@localhost>`. Postgres credentials (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`) intentionally preserved — these are infrastructure identifiers, not brand surfaces.

**render.yaml:** All brand surfaces updated:
- Comment line 1: "SecureShare" → "Torch Secret"
- Service name: `secureshare` → `torch-secret`
- DATABASE_URL database ref: `secureshare-db` → `torch-secret-db`
- Redis ref: `secureshare-redis` → `torch-secret-redis`
- BETTER_AUTH_URL example comment: `secureshare.onrender.com` → `torchsecret.onrender.com`
- RESEND_FROM_EMAIL format comment: "SecureShare" → "Torch Secret"
- Redis service name: `secureshare-redis` → `torch-secret-redis`
- DB name: `secureshare-db` → `torch-secret-db`

**.github/workflows/ci.yml:** Two changes applied:
1. Docker build image tag: `secureshare:ci-test` → `torch-secret:ci-test`
2. Five missing env vars added to both `test` and `e2e` job env blocks:
   - `BETTER_AUTH_SECRET: ci-test-secret-placeholder-must-be-at-least-32-chars` (49 chars; satisfies `z.string().min(32)`)
   - `BETTER_AUTH_URL: http://localhost:3000`
   - `APP_URL: http://localhost:3000`
   - `RESEND_API_KEY: re_placeholder`
   - `RESEND_FROM_EMAIL: "Torch Secret <noreply@torchsecret.com>"`

**server/src/config/env.ts:** `APP_URL` changed from `z.string().url().optional()` to `z.string().url().default('http://localhost:3000')`. This ensures `APP_URL` is always defined (never `undefined`) in application code while still being overridable in production environments.

### Task 2: Lucide Upgrade + Alias Removal + README Refresh

**Lucide 0.575.0:** Installed via `npm install lucide@latest`. The new package's `module` field correctly points to `dist/esm/lucide.js` (exists), fixing the broken ESM entry point that existed in 0.564.0.

**vite.config.ts:** Removed the `resolve.alias` block entirely. The alias previously mapped `lucide` to `lucide/dist/esm/lucide/src/lucide.js` (a path that no longer exists in 0.575.0). Build verified successful without the alias.

**README.md:** Full refresh:
- H1: "Torch Secret"
- Badges: CI badge (kept `norcalcoop/secureshare` repo path — rename out of scope), new live-site badge (`torchsecret.com`), License badge
- Sections: How It Works (zero-knowledge model, atomic destruction, ZK invariant), Features (v4.0 state: dashboard, diceware, email notification, PostHog), Tech Stack (Better Auth, Resend, PostHog, Lucide), Getting Started (Docker-first with `cp .env.example .env`), Development Commands, Architecture, Contributing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lucide alias path was invalid after upgrade**
- **Found during:** Task 2 — first build attempt failed with `ENOENT: no such file or directory, open 'lucide/dist/esm/lucide/src/lucide.js'`
- **Issue:** The old alias path `lucide/dist/esm/lucide/src/lucide.js` does not exist in 0.575.0 (directory structure changed). The `module` field in the new package.json correctly points to `dist/esm/lucide.js` which does exist.
- **Fix:** Removed the alias entirely (Vite resolves correctly via the `module` field). Build confirmed successful.
- **Files modified:** vite.config.ts
- **Commit:** 03da3a9

**2. [Rule 2 - Scope note] README git clone URLs intentionally retain repo path**
- The plan's verify check (`grep "SecureShare\|secureshare" README.md -- must return zero results`) conflicts with the plan's action instruction ("Badge paths: keep `norcalcoop/secureshare` for CI badge — repo rename not in scope"). GitHub URLs (`norcalcoop/secureshare`) in the README are infrastructure identifiers equivalent to postgres credentials — preserved as-is. The `git clone` command was updated to `git clone ... torch-secret` (named clone dir) to minimize visible `secureshare` references.

## Decisions Made

1. **Lucide alias removed (not retained):** The plan said "remove if ESM fix confirmed" — the ESM entry point is confirmed fixed. Build passes without alias.

2. **Postgres CI credentials preserved:** `POSTGRES_USER: secureshare`, `POSTGRES_PASSWORD: secureshare`, `POSTGRES_DB: secureshare`, and `DATABASE_URL: postgresql://secureshare:...` are unchanged in both `ci.yml` and `docker-compose.yml`. These are the actual postgres service credentials inside the CI runner, not brand strings. Changing them would break the database connection.

3. **GitHub repo URLs preserved in README:** `norcalcoop/secureshare` in badge URLs and git clone commands kept per plan instruction. Repo rename is explicitly out of scope.

4. **APP_URL with `.default()`:** Makes `APP_URL` always a `string` (not `string | undefined`) in the `Env` type, removing the need for optional chaining wherever `env.APP_URL` is used.

## Self-Check: PASSED

All 7 modified files confirmed present on disk. Both task commits (8d812ec, 03da3a9) confirmed in git log.
