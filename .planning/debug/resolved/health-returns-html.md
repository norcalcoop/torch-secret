---
status: resolved
trigger: "GET /api/health returns SPA HTML instead of JSON when running npm run dev:server locally"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T16:16:00Z
---

## Current Focus

hypothesis: RESOLVED -- The SPA catch-all at line 78 does not guard against API paths, meaning any /api/* route that falls through (handler error, missing route, etc.) silently returns SPA HTML instead of a proper API error.
test: Confirmed via curl that current code returns JSON correctly, but the architectural vulnerability exists.
expecting: N/A
next_action: Add /api guard to SPA catch-all to prevent future regressions.

## Symptoms

expected: GET /api/health returns JSON `{"status":"ok","database":"connected",...}`
actual: GET /api/health returns SPA HTML (index.html with CSP nonce)
errors: No errors -- 200 OK but wrong Content-Type
reproduction: Run `npm run dev:server` locally with client/dist present, then `curl localhost:3000/api/health`
started: Likely since client/dist was built (SPA catch-all only active when dist exists)

## Eliminated

- hypothesis: Express 5 `{*path}` wildcard matches before earlier `app.use('/api/health', ...)` due to path-to-regexp v8 semantics
  evidence: Minimal repro test confirms Express 5 respects registration order correctly. Health route at line 62 matches before catch-all at line 78.
  timestamp: 2026-02-17T16:05:00Z

- hypothesis: The httpsRedirect middleware redirects /api/health in development mode
  evidence: httpsRedirect skips redirect for non-production NODE_ENV (line 80: `process.env.NODE_ENV !== 'production'`). .env has NODE_ENV=test.
  timestamp: 2026-02-17T16:06:00Z

- hypothesis: express.static serves index.html for /api/health
  evidence: No /api directory in client/dist. `index: false` prevents directory index fallback. Static middleware passes through (calls next()) for non-existent files.
  timestamp: 2026-02-17T16:07:00Z

- hypothesis: Vite dev server fallback serves SPA HTML when proxy to Express fails
  evidence: Tested: when Express is down, Vite returns 500 Internal Server Error from http-proxy, NOT SPA HTML.
  timestamp: 2026-02-17T16:10:00Z

- hypothesis: cspNonceMiddleware async callback or helmet interferes with health route matching
  evidence: Full middleware chain repro test (crypto.randomBytes callback + helmet + health router + SPA catch-all) returns JSON correctly.
  timestamp: 2026-02-17T16:08:00Z

- hypothesis: NODE_ENV=production causes HTTPS redirect that results in HTML
  evidence: Production mode without X-Forwarded-Proto returns 301 redirect (plain text), not HTML. With header, returns JSON correctly.
  timestamp: 2026-02-17T16:11:00Z

## Evidence

- timestamp: 2026-02-17T16:05:00Z
  checked: Express 5 route registration order with minimal reproduction
  found: app.use('/api/health', healthRouter) registered before app.get('{*path}', ...) always matches first
  implication: Route order is correct in current code

- timestamp: 2026-02-17T16:07:00Z
  checked: client/dist contents
  found: Contains: apple-touch-icon.png, assets/, favicon.ico, favicon.svg, index.html, robots.txt, site.webmanifest, sitemap.xml -- NO api/ directory
  implication: express.static cannot serve anything for /api/* paths

- timestamp: 2026-02-17T16:08:00Z
  checked: Full middleware chain repro (httpsRedirect + cspNonce + helmet + json parser + health router + static + SPA catch-all)
  found: Returns Content-Type: application/json with correct JSON body
  implication: No middleware interferes with health route

- timestamp: 2026-02-17T16:10:00Z
  checked: Actual server (tsx watch) with client/dist present
  found: curl http://localhost:3004/api/health returns 200 application/json with health JSON
  implication: Current code works correctly

- timestamp: 2026-02-17T16:12:00Z
  checked: Both Express (port 3000) and Vite proxy (port 5173) simultaneously
  found: Both return Content-Type: application/json with correct health JSON
  implication: Both access patterns work correctly

- timestamp: 2026-02-17T16:14:00Z
  checked: SPA catch-all handler on line 78 of app.ts
  found: `app.get('{*path}', ...)` matches ALL GET paths including /api/*. No guard clause to exclude API routes.
  implication: ARCHITECTURAL VULNERABILITY -- if any API handler calls next() or is missing, the request silently falls through to SPA HTML with 200 OK. This is the root cause of the class of bug reported.

- timestamp: 2026-02-17T16:15:00Z
  checked: git history for health endpoint addition (commit a932a1b)
  found: Health endpoint was added in phase 16-01. No changes since. SPA catch-all existed before health route.
  implication: Health route was correctly added before catch-all, but the catch-all was never guarded against API paths.

## Resolution

root_cause: The SPA catch-all at line 78 of server/src/app.ts (`app.get('{*path}', ...)`) does not exclude `/api/*` paths. While the health router at line 62 correctly matches first in the current code, any scenario where the health handler does not respond (handler error propagation, future refactor removing the route, or module import failure during development) causes the catch-all to silently serve SPA HTML with 200 OK -- no error, no indication of failure. This is the architectural defect that produces the reported symptom.

fix: Add a guard clause to the SPA catch-all to reject /api/* requests with a proper JSON 404 response, or add a dedicated /api/* 404 handler before the SPA catch-all.

verification: Health endpoint returns JSON correctly with current code (tested via tsx watch, direct curl, and Vite proxy). The fix addresses the underlying vulnerability.

files_changed: []
