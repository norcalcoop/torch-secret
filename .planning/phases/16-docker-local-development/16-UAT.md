---
status: resolved
phase: 16-docker-local-development
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md
started: 2026-02-17T15:30:00Z
updated: 2026-02-17T16:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Health Check Endpoint
expected: Run `curl http://localhost:3000/api/health` (with dev server running). Response is JSON with fields: status, database, redis, uptime, timestamp. Status code is 200 when database is connected.
result: issue
reported: "Health endpoint returns SPA HTML instead of JSON when running npm run dev:server locally. The SPA catch-all route in Express 5 matches /api/health before the health router."
severity: major

### 2. Docker Compose Full Stack Startup
expected: Running `docker compose up` starts three services (postgres, redis, app). All containers reach healthy status. App is accessible at http://localhost:3000.
result: issue
reported: "All 3 containers start and reach healthy status, but NODE_ENV=production in docker-compose.yml causes HTTPS redirect. http://localhost:3000 returns 301 to https://localhost which doesn't work without TLS. App is inaccessible in browser for local development."
severity: major

### 3. Create-Share-Reveal Flow via Docker
expected: With Docker Compose stack running, create a secret at localhost:3000, get a share link, open the link, see the secret content. Secret is destroyed after viewing (revisiting the link shows an error).
result: skipped
reason: Cannot test — HTTPS redirect from Test 2 blocks browser access

### 4. Production Docker Image Security
expected: Running `docker compose exec app whoami` returns "node" (not root). Production image contains no dev dependencies (vitest, eslint, vite).
result: pass

### 5. Render.com Blueprint
expected: A `render.yaml` file exists at the project root. It defines a web service (runtime: docker), a PostgreSQL 17 database, and a Redis keyvalue store. Environment variables DATABASE_URL and REDIS_URL are wired from the managed services.
result: pass

## Summary

total: 5
passed: 2
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Health endpoint returns JSON at /api/health"
  status: failed
  reason: "User reported: Health endpoint returns SPA HTML instead of JSON when running npm run dev:server locally. The SPA catch-all route in Express 5 matches /api/health before the health router."
  severity: major
  test: 1
  root_cause: "No /api/* 404 handler between API routes and SPA catch-all. The catch-all app.get('{*path}') matches all GET paths including /api/* without guard. When health handler doesn't respond (e.g., tsx watch hot-reload), requests fall through to SPA catch-all silently returning HTML 200."
  artifacts:
    - path: "server/src/app.ts"
      issue: "SPA catch-all at line 78 has no exclusion for /api/* paths"
  missing:
    - "Add API 404 handler (app.use('/api', ...)) between API routes and SPA catch-all that returns JSON 404"
  debug_session: ".planning/debug/health-returns-html.md"

- truth: "Docker Compose app is accessible at http://localhost:3000 in browser"
  status: failed
  reason: "User reported: All 3 containers start and reach healthy status, but NODE_ENV=production in docker-compose.yml causes HTTPS redirect. http://localhost:3000 returns 301 to https://localhost which doesn't work without TLS. App is inaccessible in browser for local development."
  severity: major
  test: 2
  root_cause: "docker-compose.yml sets NODE_ENV=production which activates httpsRedirect middleware. No reverse proxy provides TLS termination locally, so 301 redirect to https://localhost leads nowhere. Docker HEALTHCHECK masks this by spoofing X-Forwarded-Proto header."
  artifacts:
    - path: "docker-compose.yml"
      issue: "NODE_ENV=production on line 37 triggers HTTPS redirect without TLS"
    - path: "server/src/middleware/security.ts"
      issue: "httpsRedirect uses NODE_ENV as proxy for TLS availability (lines 79-91)"
    - path: "Dockerfile"
      issue: "ENV NODE_ENV=production on line 25 also bakes it in"
  missing:
    - "Introduce FORCE_HTTPS env var to decouple HTTPS redirect from NODE_ENV"
    - "Set FORCE_HTTPS=false in docker-compose.yml for local development"
    - "Make upgradeInsecureRequests CSP directive conditional on FORCE_HTTPS"
  debug_session: ".planning/debug/docker-https-redirect.md"
