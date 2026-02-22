---
phase: 29-v4-tech-debt-cleanup
plan: "01"
requirements-completed: []
subsystem: api
tags:
  - seo
  - robots
  - noindex
  - documentation

dependency_graph:
  requires:
    - "Phase 22: Better Auth + auth pages (login, register, forgot-password, reset-password)"
    - "Phase 23: Dashboard route"
    - "Phase 27: 27-01-SUMMARY.md with CONV-01 implementation"
    - "Phase 28: create.ts passphrase tab (getPassword/getPassphrase accessors)"
  provides:
    - "X-Robots-Tag: noindex for /login, /register, /forgot-password, /reset-password, /dashboard (server-side)"
    - "27-01-SUMMARY.md with requirements-completed: [CONV-01] field"
    - "getPassword() two-channel model comment in create.ts"
  affects:
    - "SEO crawling behavior for auth and dashboard routes"
    - "Documentation completeness for CONV-01 requirement traceability"

tech_stack:
  added: []
  patterns:
    - "NOINDEX_PREFIXES array pattern for maintainable route-based X-Robots-Tag header logic"
    - "Defense-in-depth: server-side X-Robots-Tag complements client-side <meta name='robots'>"

key_files:
  created: []
  modified:
    - "server/src/app.ts"
    - ".planning/phases/27-conversion-prompts-rate-limits-legal-pages/27-01-SUMMARY.md"
    - "client/src/pages/create.ts"

key_decisions:
  - "NOINDEX_PREFIXES array (not individual startsWith checks) chosen for maintainability — future auth routes only need a single array entry"
  - "/dashboard intentionally included in NOINDEX_PREFIXES even though auth-gated — defense-in-depth; crawlers that bypass auth should not index dashboard"
  - "requirements-completed field added to 27-01-SUMMARY.md frontmatter only — no implementation changes, purely documentation gap closure"

patterns-established:
  - "Extend NOINDEX_PREFIXES array in server/src/app.ts when adding new auth or private routes"

duration: 2min
completed: "2026-02-22"
---

# Phase 29 Plan 01: v4.0 Tech Debt Gap Closure Summary

**Server-side X-Robots-Tag noindex extended to auth and dashboard routes via NOINDEX_PREFIXES array; 27-01-SUMMARY.md patched with CONV-01 traceability; getPassword() annotated with two-channel design rationale.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T01:12:09Z
- **Completed:** 2026-02-22T01:14:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extended `NOINDEX_PREFIXES` array in `server/src/app.ts` to cover `/login`, `/register`, `/forgot-password`, `/reset-password`, and `/dashboard` — all auth and dashboard routes now return `X-Robots-Tag: noindex, nofollow` at the HTTP level without requiring JavaScript
- Added `requirements-completed: [CONV-01]` to `27-01-SUMMARY.md` frontmatter, closing the documentation gap identified in the v4.0 milestone audit
- Added 9-line design-intent comment above `getPassword()` in `create.ts` explaining the two-channel model (passphrase tab is out-of-band communication aid, not server-side Argon2id password)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server-side X-Robots-Tag: noindex for auth and dashboard routes** - `726d72b` (feat)
2. **Task 2: Add requirements-completed to 27-01-SUMMARY.md and passphrase tab comment to create.ts** - `89502ca` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `server/src/app.ts` - Replaced single `/secret/` startsWith check with NOINDEX_PREFIXES array covering 6 path prefixes; added explanatory comment
- `.planning/phases/27-conversion-prompts-rate-limits-legal-pages/27-01-SUMMARY.md` - Added `requirements-completed: [CONV-01]` field to YAML frontmatter after `plan: "01"` line
- `client/src/pages/create.ts` - Added 9-line block comment above `getPassword()` function explaining two-channel model and PROT-04 traceability

## Decisions Made

- NOINDEX_PREFIXES array pattern over individual `if` checks — one array entry to add future routes vs. adding a new `||` condition each time
- `/dashboard` included even though auth-gated — defense-in-depth; belt-and-suspenders for crawlers that bypass authentication
- No functional changes to 27-01-SUMMARY.md — requirements-completed field is documentation-only; CONV-01 was already implemented in Phase 27

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `client/tsconfig.json` does not exist (client uses root `tsconfig.json`). Plan referenced it but compile check passes via `npx tsc -p tsconfig.json --noEmit`. No impact on deliverables.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three gap-closure items from v4.0-MILESTONE-AUDIT.md addressed
- Server TypeScript compiles cleanly
- ESLint passes with no errors
- Phase 29 Plan 02 and beyond can proceed

---
*Phase: 29-v4-tech-debt-cleanup*
*Completed: 2026-02-22*

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `server/src/app.ts` | FOUND |
| `.planning/phases/27-conversion-prompts-rate-limits-legal-pages/27-01-SUMMARY.md` | FOUND |
| `client/src/pages/create.ts` | FOUND |
| `.planning/phases/29-v4-tech-debt-cleanup/29-01-SUMMARY.md` | FOUND |
| Commit 726d72b (Task 1) | FOUND |
| Commit 89502ca (Task 2) | FOUND |
