---
status: diagnosed
trigger: "Docker Compose sets NODE_ENV=production which activates HTTPS redirect, making app inaccessible at http://localhost:3000"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Docker Compose + Dockerfile both set NODE_ENV=production, httpsRedirect fires on all non-TLS requests, 301s to https://localhost which has no TLS listener
test: Traced full request path through middleware
expecting: 301 redirect on every browser request to http://localhost:3000
next_action: Return diagnosis

## Symptoms

expected: Browser navigates to http://localhost:3000 and sees the SecureShare app
actual: 301 redirect to https://localhost:3000, which fails (no TLS)
errors: Browser shows connection refused or ERR_CONNECTION_REFUSED on HTTPS
reproduction: docker compose up, open http://localhost:3000 in browser
started: Since docker-compose.yml was added (phase 16)

## Eliminated

(none needed - root cause confirmed on first hypothesis)

## Evidence

- timestamp: 2026-02-17T00:01:00Z
  checked: docker-compose.yml line 37
  found: NODE_ENV=production set in environment block
  implication: httpsRedirect will activate

- timestamp: 2026-02-17T00:01:00Z
  checked: Dockerfile line 25
  found: ENV NODE_ENV=production baked into production stage
  implication: Even without docker-compose override, Dockerfile sets production mode

- timestamp: 2026-02-17T00:01:00Z
  checked: server/src/middleware/security.ts lines 79-91
  found: httpsRedirect checks process.env.NODE_ENV !== 'production' to skip; checks req.secure to redirect
  implication: In production mode, all non-secure requests get 301 to https://

- timestamp: 2026-02-17T00:01:00Z
  checked: server/src/app.ts line 44
  found: app.set('trust proxy', 1) enables req.secure to reflect X-Forwarded-Proto
  implication: req.secure is false for plain HTTP without X-Forwarded-Proto header

- timestamp: 2026-02-17T00:01:00Z
  checked: Dockerfile lines 45-46
  found: HEALTHCHECK sends X-Forwarded-Proto:https header, bypassing the redirect
  implication: Health checks pass (masking the bug) while real browser requests fail

- timestamp: 2026-02-17T00:01:00Z
  checked: server/src/middleware/security.ts lines 56-57
  found: upgradeInsecureRequests CSP directive is unconditionally set (even in Docker)
  implication: Secondary issue - browsers may also auto-upgrade HTTP subresources to HTTPS

## Resolution

root_cause: Docker Compose sets NODE_ENV=production (line 37) with no reverse proxy providing TLS termination, so the httpsRedirect middleware (security.ts:79-91) 301-redirects every browser request from http:// to https://localhost, which has no TLS listener. The HEALTHCHECK masks this by spoofing X-Forwarded-Proto:https.
fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
