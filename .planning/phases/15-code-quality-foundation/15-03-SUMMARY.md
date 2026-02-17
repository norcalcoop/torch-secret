---
phase: 15-code-quality-foundation
plan: 03
subsystem: infra
tags: [eslint, prettier, formatting, lint-fix, code-quality, pre-commit-hook]

# Dependency graph
requires:
  - phase: 15-01
    provides: "ESLint 10 flat config, Prettier config, Husky pre-commit hook, lint-staged pipeline"
  - phase: 15-02
    provides: "Zero TypeScript strict-mode errors (tsc --noEmit passes cleanly)"
provides:
  - "Zero ESLint errors/warnings across entire codebase (eslint . exits 0)"
  - "All files formatted consistently (prettier --check . exits 0)"
  - "Pre-commit hook verified to block lint violations at commit time"
  - "Phase 15 success criteria fully satisfied"
affects: [16-docker-deployment, 17-e2e-testing, 18-ci-cd-pipeline, 19-github-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["void IIFE pattern for async event handlers (no-misused-promises)", "querySelector generic type parameters for typed DOM element access", "test file ESLint relaxation for supertest any-typed response bodies"]

key-files:
  created: []
  modified:
    - eslint.config.ts
    - client/src/components/copy-button.ts
    - client/src/components/share-button.ts
    - client/src/pages/create.ts
    - client/src/pages/reveal.ts
    - client/src/router.ts
    - server/src/app.ts
    - server/src/middleware/logger.ts
    - server/src/routes/secrets.ts
    - server/src/server.ts
    - server/src/workers/expiration-worker.ts
    - server/src/workers/__tests__/expiration-worker.test.ts
    - client/src/__tests__/accessibility.test.ts

key-decisions:
  - "Relaxed no-unsafe-assignment/member-access/argument in test files via ESLint config override (60+ false positives from supertest any-typed res.body)"
  - "void IIFE pattern for async addEventListener callbacks instead of eslint-disable"
  - "argsIgnorePattern/varsIgnorePattern with ^_ for unused variable convention project-wide"
  - "querySelector<HTMLMetaElement> generic pattern for typed DOM access"

patterns-established:
  - "Async event handlers: wrap in void (async () => { ... })() to satisfy no-misused-promises"
  - "Unused function params: prefix with _ (argsIgnorePattern: '^_')"
  - "DOM queries: use querySelector<HTMLMetaElement>() generic form for typed element access"
  - "Test files: no-unsafe-* rules relaxed via ESLint config (not inline disables)"

requirements-completed: [QUAL-05]

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 15 Plan 03: Codebase-Wide Lint and Format Pass Summary

**Prettier-formatted and ESLint-fixed all 43 source files to zero violations, resolving 93 lint errors with void IIFE wrappers, typed req.body, querySelector generics, and test file rule relaxations -- pre-commit hook verified blocking**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T12:48:45Z
- **Completed:** 2026-02-17T12:55:03Z
- **Tasks:** 2
- **Files modified:** 43

## Accomplishments
- Formatted entire codebase with Prettier (consistent single quotes, trailing commas, 100-char width, Tailwind class sorting)
- Resolved all 93 ESLint errors across client, server, shared, and test files
- Verified pre-commit hook blocks commits with lint violations (tested with intentional violation)
- All Phase 15 success criteria satisfied: eslint 0 errors, prettier --check passes, tsc --noEmit passes, 163 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Run Prettier and ESLint auto-fix across entire codebase, resolve remaining violations** - `30def01` (feat)
2. **Task 2: Verify pre-commit hook blocks lint violations** - verification only, no commit

## Files Created/Modified
- `eslint.config.ts` - Added test file rule relaxations, scripts globals, underscore ignore patterns
- `client/src/components/copy-button.ts` - void IIFE wrapper for async click handler
- `client/src/components/share-button.ts` - void IIFE wrapper for async click handler
- `client/src/pages/create.ts` - Removed async from renderCreatePage (no await), void IIFE for submit handler
- `client/src/pages/reveal.ts` - Removed unused params from renderInterstitial, void IIFE for submit handler, void wrapper for handleReveal
- `client/src/router.ts` - querySelector generic types for HTMLMetaElement/HTMLLinkElement
- `server/src/app.ts` - Type assertion for res.locals.cspNonce
- `server/src/middleware/logger.ts` - Replaced any-typed CJS interop with union type and typed assertions
- `server/src/routes/secrets.ts` - Typed req.body as CreateSecretRequest/VerifySecretRequest
- `server/src/server.ts` - Replaced async callback with void+.then() for server.close
- `server/src/workers/expiration-worker.ts` - Added void prefix for task.stop() Promise
- `server/src/workers/__tests__/expiration-worker.test.ts` - Prefixed unused vars with underscore
- `client/src/__tests__/accessibility.test.ts` - Removed await from non-async renderCreatePage calls
- 30 additional files reformatted by Prettier (whitespace, quotes, commas only)

## Decisions Made
- Relaxed `no-unsafe-assignment`, `no-unsafe-member-access`, and `no-unsafe-argument` in test files via ESLint config override rather than inline disables -- 60+ errors from supertest `res.body` being typed as `any` (this is expected behavior, not a real safety issue)
- Added `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'` to `no-unused-vars` rule globally -- standard TypeScript convention for intentionally unused parameters (Express error handler requires 4 params)
- Used `void (async () => { ... })()` IIFE pattern for async event handler callbacks instead of eslint-disable comments -- maintains type safety while satisfying `no-misused-promises`
- Changed `renderCreatePage` from async to sync since it had no await expressions -- cleaner API, avoids unnecessary Promise wrapping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in router.ts querySelector calls**
- **Found during:** Task 1 (after Prettier + ESLint pass, tsc --noEmit check)
- **Issue:** `document.querySelector()` returns `Element | null`, but code accessed `.content`, `.name`, `.href`, `.rel` which only exist on `HTMLMetaElement`/`HTMLLinkElement`. Pre-existing issue that surfaced during the comprehensive tsc check.
- **Fix:** Added generic type parameters: `querySelector<HTMLMetaElement>(...)`, `querySelector<HTMLLinkElement>(...)`
- **Files modified:** `client/src/router.ts`
- **Verification:** `tsc --noEmit` exits 0
- **Committed in:** 30def01 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary fix for TypeScript correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 15 is fully complete: all 3 plans executed, all success criteria met
- Code quality gate is enforced: ESLint + Prettier via pre-commit hook on every commit
- Ready for Phase 16 (Docker deployment), Phase 17 (E2E testing), Phase 18 (CI/CD)
- All 163 tests pass, TypeScript compiles cleanly, zero lint/format violations

## Self-Check: PASSED

- All 11 key modified files verified on disk
- Task 1 commit (30def01) verified in git history
- Task 2 was verification-only (no commit expected)
- SUMMARY.md created at `.planning/phases/15-code-quality-foundation/15-03-SUMMARY.md`

---
*Phase: 15-code-quality-foundation*
*Completed: 2026-02-17*
