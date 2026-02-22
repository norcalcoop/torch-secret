---
phase: 30-docker-and-render-deployment-fixes
plan: "01"
subsystem: deployment
tags: [docker, render, env-vars, better-auth, posthog]
requires: []
provides: [render-yaml-v4, docker-compose-v4, dockerfile-vite-build-args]
affects: [render.yaml, docker-compose.yml, Dockerfile]
tech-stack:
  added: []
  patterns:
    - "sync: false in render.yaml for secrets — Render prompts deployer at Blueprint creation"
    - "Docker ARG declarations in build stage for VITE_ vars baked at bundle build time"
    - "Placeholder env var values in docker-compose.yml that satisfy Zod without crashing"
key-files:
  created: []
  modified:
    - render.yaml
    - docker-compose.yml
    - Dockerfile
decisions:
  - "10 secret vars in render.yaml use sync: false — no committed values; Render prompts deployer"
  - "BETTER_AUTH_SECRET placeholder 'local-development-secret-must-be-at-least-32-chars' satisfies z.string().min(32)"
  - "RESEND_API_KEY placeholder satisfies z.string().min(1) without crashing; emails silently fail in local Docker"
  - "ARG VITE_POSTHOG_KEY placed in Stage 2 (build) only — not Stage 1 (deps) or Stage 3 (production)"
  - "APP_URL not added to render.yaml — optional var, production no-op is correct behavior"
  - "PORT not added to render.yaml — Render injects PORT=10000 automatically"
metrics:
  duration: "~2 minutes"
  completed: "2026-02-22"
  tasks: 2
  files: 3
requirements-completed: [DOCK-01]
---

# Phase 30 Plan 01: Docker and Render Deployment Fixes — Summary

**One-liner:** Fixed all three deployment config files so v4.0 auth actually starts — render.yaml gets 10 secret vars with sync:false, docker-compose.yml gets placeholder auth vars, Dockerfile gets VITE_ build ARGs.

## What Was Built

Phase 22 added four required environment variables (BETTER_AUTH_SECRET, BETTER_AUTH_URL, RESEND_API_KEY, RESEND_FROM_EMAIL) to the Zod env schema in `server/src/config/env.ts`. These were never backfilled into the deployment configuration files. Deploying the pre-Phase 30 render.yaml produced an immediate ZodError startup crash. Running `docker compose up` crashed the same way.

This plan updated all three configuration files to reflect the v4.0 requirement set.

### render.yaml

Added 10 secret env vars, all declared with `sync: false`:

- **Auth (required):** BETTER_AUTH_SECRET, BETTER_AUTH_URL
- **Email delivery (required):** RESEND_API_KEY, RESEND_FROM_EMAIL
- **OAuth (optional):** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
- **Analytics (optional):** VITE_POSTHOG_KEY, VITE_POSTHOG_HOST

Expanded the free tier notes in the header comment (PostgreSQL 30-day expiry, ephemeral Redis, 15-minute web service spin-down). Added a Blueprint sync instruction comment directing deployers to manually add secrets in the Render dashboard after initial sync.

All existing wired env vars (DATABASE_URL fromDatabase, REDIS_URL fromService, NODE_ENV, FORCE_HTTPS, LOG_LEVEL) are unchanged.

### docker-compose.yml

Added to the `app` service `environment` section, after LOG_LEVEL:

- BETTER_AUTH_SECRET with 32+ char placeholder
- BETTER_AUTH_URL pointing to localhost:3000
- RESEND_API_KEY with placeholder string (satisfies Zod min(1))
- RESEND_FROM_EMAIL with localhost address
- Commented-out OAuth and PostHog blocks (disabled by default in local dev)

The placeholder values allow `docker compose up` to pass Zod validation. Auth features (email delivery, OAuth) won't work with placeholders, but the app starts without crashing.

### Dockerfile

Added `ARG VITE_POSTHOG_KEY` and `ARG VITE_POSTHOG_HOST` to Stage 2 (the Vite build stage), immediately before `RUN npm run build:client`. These are only in Stage 2 — not Stage 1 (deps) or Stage 3 (production), where they have no purpose.

With these ARG declarations, Render automatically passes its env vars as Docker build args during builds — meaning setting VITE_POSTHOG_KEY in the Render dashboard will bake PostHog into the JS bundle without any additional configuration. If the ARGs are not provided, Vite treats them as undefined and analytics are silently disabled (correct graceful no-op).

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Update render.yaml with all v4.0 env vars | 7220a13 | render.yaml |
| 2 | Add auth vars to docker-compose.yml, VITE_ ARGs to Dockerfile | f3fa0e1 | docker-compose.yml, Dockerfile |

## Verification

All plan verification checks passed:

- `grep -c "sync: false" render.yaml` → 10 (one per secret credential)
- `grep "BETTER_AUTH_SECRET" docker-compose.yml render.yaml` → found in both
- `grep "ARG VITE_POSTHOG_KEY" Dockerfile` → found in Stage 2
- `docker compose build --no-cache` → completed successfully (exit 0)
- No PORT or APP_URL added to render.yaml (confirmed via grep on non-comment lines)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: render.yaml (10 sync: false entries, BETTER_AUTH_SECRET present, no PORT/APP_URL)
- FOUND: docker-compose.yml (BETTER_AUTH_SECRET placeholder present)
- FOUND: Dockerfile (ARG VITE_POSTHOG_KEY in Stage 2 before RUN npm run build:client)

Commits verified:
- FOUND: 7220a13 (render.yaml update)
- FOUND: f3fa0e1 (docker-compose.yml + Dockerfile update)
