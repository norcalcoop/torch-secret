---
status: diagnosed
trigger: "Creating a secret fails with: Failed to execute 'json' on 'Response': Unexpected end of JSON input"
created: 2026-02-22T00:00:00Z
updated: 2026-02-22T20:41:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Two-part root cause: (1) backend not running → Vite proxy returns 500 with empty body; (2) client.ts unconditionally calls res.json() on error responses without handling empty/non-JSON bodies
test: Verified by running Express + Vite together (works) vs. Vite alone without Express (Vite returns 500 + 0-byte body → client throws SyntaxError)
expecting: N/A - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: POST /api/secrets returns JSON response {id: "...", expiresAt: "..."}
actual: Client throws "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
errors: "Failed to execute 'json' on 'Response': Unexpected end of JSON input"
reproduction: Create a secret via the UI when the backend Express server is NOT running (only Vite dev server is up)
started: After Phase 31 UAT (may have pre-existed Phase 31)

## Eliminated

- hypothesis: APP_URL .default() change broke route handling
  evidence: Vite proxy uses changeOrigin:true, Better Auth origin check only applies to /api/auth/* routes (GET skips origin check), POST /api/secrets works correctly when both servers are running
  timestamp: 2026-02-22T20:35:00Z

- hypothesis: Lucide upgrade broke server-side imports
  evidence: Lucide is frontend-only; server never imports Lucide; all 265 tests pass
  timestamp: 2026-02-22T20:20:00Z

- hypothesis: DB schema mismatch (missing columns from migration 0003)
  evidence: psql confirmed secrets table has label, notify, status, viewed_at columns; all migrations applied
  timestamp: 2026-02-22T20:30:00Z

- hypothesis: Better Auth CSRF check blocking POST /api/secrets
  evidence: origin-check middleware skips GET requests; getSession endpoint is GET; even if it threw, optionalAuth catches all exceptions silently; POST /api/secrets is not under /api/auth/* path
  timestamp: 2026-02-22T20:25:00Z

- hypothesis: Express error handler returning empty body
  evidence: error-handler.ts always calls res.status(500).json({...}); confirmed by reading code
  timestamp: 2026-02-22T20:15:00Z

- hypothesis: Rate limiter returning empty body
  evidence: All rate limiters have message: {...} objects; express-rate-limit serializes these as JSON; confirmed by reading rate-limit.ts
  timestamp: 2026-02-22T20:15:00Z

- hypothesis: Server startup crash due to env.ts changes
  evidence: Local .env has all required vars; starting npm run dev:server succeeds; health endpoint returns 200 JSON; POST /api/secrets returns 201 JSON when server is running
  timestamp: 2026-02-22T20:38:00Z

## Evidence

- timestamp: 2026-02-22T20:10:00Z
  checked: client/src/api/client.ts lines 67-75
  found: createSecret() calls res.json() unconditionally on non-ok responses (line 68), before checking res.status; same pattern in getSecret, getSecretMeta, verifySecretPassword, fetchDashboardSecrets, deleteDashboardSecret
  implication: If any error response has empty/non-JSON body, res.json() throws SyntaxError which propagates to the user as the raw error message

- timestamp: 2026-02-22T20:38:00Z
  checked: Vite proxy behavior when backend is down (curl test with backend stopped)
  found: Vite returns HTTP 500 with Content-Type: text/plain and EMPTY BODY (0 bytes) on ECONNREFUSED
  implication: When backend is not running, client tries res.json() on empty body → throws "Unexpected end of JSON input"

- timestamp: 2026-02-22T20:40:00Z
  checked: Full stack test (Express + Vite both running)
  found: POST /api/secrets returns 201 JSON correctly; no error
  implication: Server-side code is correct; issue only manifests when backend is not running

- timestamp: 2026-02-22T20:35:00Z
  checked: Path matching for /api/auth/{*splat} via path-to-regexp
  found: Match /api/secrets: false — auth wildcard cannot intercept secrets route
  implication: Better Auth handler does not intercept /api/secrets requests

- timestamp: 2026-02-22T20:30:00Z
  checked: Local PostgreSQL secrets table schema
  found: All columns present including label, notify, status, viewed_at from migration 0003
  implication: DB schema is fully up-to-date; insert should work

- timestamp: 2026-02-22T20:20:00Z
  checked: All 265 automated tests
  found: All pass (npm run test:run → 17 test files, 265 tests, 0 failures)
  implication: Server-side logic is correct in isolation; issue is environment-specific

## Resolution

root_cause: Two-part root cause:

PART 1 (TRIGGER): The backend Express server was not running when the UAT was performed. When the user tried to create a secret, Vite's dev proxy (port 5173) could not connect to Express (port 3000) and returned HTTP 500 with Content-Type: text/plain and an EMPTY body (0 bytes) — confirmed by live test.

PART 2 (CODE DEFECT): client/src/api/client.ts line 68 unconditionally calls `await res.json()` on any non-ok response without first checking whether the body is non-empty and JSON. When the Vite proxy returns 500 with an empty body, JSON.parse("") throws SyntaxError: "Unexpected end of JSON input". This raw browser error propagates up and is displayed to the user instead of a useful message.

The Phase 31 changes did NOT directly cause this. However, Phase 31's UAT triggered this pre-existing latent defect by being the moment the user happened to test with the backend not running (or crashed).

fix: TWO fixes needed:
  1. Run both dev:server AND dev:client when developing (process/environment fix, not code)
  2. Fix client/src/api/client.ts to safely handle non-JSON error responses in ALL fetch wrapper functions — use res.text() first, then attempt JSON.parse(), and fall back to a generic error on failure

verification: N/A — diagnose-only mode
files_changed:
  - client/src/api/client.ts (code defect location)
