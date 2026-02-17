---
phase: 16-docker-local-development
plan: 04
subsystem: infra
tags: [docker, express, csp, https, env-vars, render]

# Dependency graph
requires:
  - phase: 16-docker-local-development
    provides: Dockerfile, docker-compose.yml, render.yaml from plans 01-03
provides:
  - FORCE_HTTPS env var decoupling HTTPS redirect from NODE_ENV
  - API 404 catch-all preventing /api/* routes from returning SPA HTML
  - Docker Compose serving HTTP without redirect in production mode
  - Render.com deployment still HTTPS-redirecting with FORCE_HTTPS=true
affects: [17-e2e-testing, 18-ci-cd-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [env-var-gated middleware, API catch-all before SPA catch-all]

key-files:
  created: []
  modified:
    - server/src/config/env.ts
    - server/src/middleware/security.ts
    - server/src/app.ts
    - docker-compose.yml
    - render.yaml
    - .env.example

key-decisions:
  - "FORCE_HTTPS as opt-in boolean (default false) decouples HTTPS redirect from NODE_ENV"
  - "CSP upgrade-insecure-requests conditionally emitted only when FORCE_HTTPS=true"
  - "API 404 catch-all mounted after all API routes but before SPA catch-all"

patterns-established:
  - "Env-var gating: middleware behavior controlled by explicit env vars, not NODE_ENV inference"
  - "API isolation: all /api/* requests handled before SPA catch-all to guarantee JSON responses"

requirements-completed: [DOCK-02, DOCK-03]

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 16 Plan 04: UAT Gap Fixes Summary

**FORCE_HTTPS env var decoupling HTTPS from NODE_ENV, plus API 404 catch-all preventing /api/* HTML fallthrough**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T17:51:46Z
- **Completed:** 2026-02-17T17:53:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Decoupled HTTPS redirect from NODE_ENV via explicit FORCE_HTTPS env var, enabling Docker Compose to run production mode without redirect
- Added API 404 catch-all in server/src/app.ts that returns JSON for any unmatched /api/* path, preventing SPA HTML fallthrough
- Made CSP upgrade-insecure-requests directive conditional on FORCE_HTTPS to prevent browsers auto-upgrading HTTP in local Docker
- Configured FORCE_HTTPS=false in docker-compose.yml and FORCE_HTTPS=true in render.yaml

## Task Commits

Each task was committed atomically:

1. **Task 1: Add FORCE_HTTPS env var and decouple HTTPS redirect from NODE_ENV** - `3e09c98` (feat)
2. **Task 2: Add API 404 catch-all before SPA catch-all** - `391234e` (fix)

## Files Created/Modified
- `server/src/config/env.ts` - Added FORCE_HTTPS to Zod schema as coerced boolean defaulting to false
- `server/src/middleware/security.ts` - Gated httpsRedirect on env.FORCE_HTTPS; made upgradeInsecureRequests conditional
- `server/src/app.ts` - Added /api catch-all returning JSON 404 between API routes and SPA catch-all
- `docker-compose.yml` - Added FORCE_HTTPS=false to app service environment
- `render.yaml` - Added FORCE_HTTPS=true to web service envVars
- `.env.example` - Documented FORCE_HTTPS variable with usage comment

## Decisions Made
- FORCE_HTTPS defaults to false (safe for development), must be explicitly opted in for production
- CSP upgrade-insecure-requests only emitted when FORCE_HTTPS=true to prevent browser-level HTTP-to-HTTPS upgrades in local Docker
- API 404 catch-all uses app.use('/api') to catch all HTTP methods, not just GET

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 16 (Docker & Local Development) is fully complete including UAT gap fixes
- Docker Compose serves the app at localhost:3000 without HTTPS redirect
- API routes correctly return JSON (not SPA HTML) for all /api/* paths
- Ready to proceed to Phase 17 (E2E Testing)

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 16-docker-local-development*
*Completed: 2026-02-17*
