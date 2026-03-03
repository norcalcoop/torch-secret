# Phase 40 — Deferred Items

## ESLint errors in auth.test.ts (discovered during Plan 40-02)

**File:** `server/src/routes/__tests__/auth.test.ts`
**Lines:** 9 (`expect` imported but unused), 18 (`app` declared but unused)
**Status:** Pre-existing; scaffolded by an earlier Phase 40 commit (65eda08). Out of scope for Plan 40-02.
**Owner:** Plan 40-01 or whichever plan fully implements the auth security tests.
**Action needed:** Remove unused `expect` import; either initialize `app` in `beforeAll` or prefix with `_app` if intentionally deferred.
