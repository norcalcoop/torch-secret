---
status: complete
phase: 16-docker-local-development
source: 16-01-SUMMARY.md, 16-02-SUMMARY.md, 16-03-SUMMARY.md, 16-04-SUMMARY.md
started: 2026-02-17T18:00:00Z
updated: 2026-02-17T19:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Health Check Endpoint
expected: Run `curl http://localhost:3000/api/health` (with dev server running). Response is JSON with fields: status, database, redis, uptime, timestamp. Status code is 200 when database is connected.
result: pass

### 2. Docker Compose Full Stack Startup
expected: Running `docker compose up` starts three services (postgres, redis, app). All containers reach healthy status. App is accessible at http://localhost:3000 (no HTTPS redirect).
result: pass

### 3. Create-Share-Reveal Flow via Docker
expected: With Docker Compose stack running, create a secret at localhost:3000, get a share link, open the link, see the secret content. Secret is destroyed after viewing (revisiting the link shows an error).
result: pass

### 4. API 404 Catch-All
expected: Run `curl http://localhost:3000/api/nonexistent`. Response is JSON `{"error":"Not found"}` with status 404 (not SPA HTML).
result: pass

### 5. FORCE_HTTPS Decoupling
expected: In docker-compose.yml, FORCE_HTTPS is set to false. In render.yaml, FORCE_HTTPS is set to true. The HTTPS redirect middleware is gated on FORCE_HTTPS, not NODE_ENV.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
