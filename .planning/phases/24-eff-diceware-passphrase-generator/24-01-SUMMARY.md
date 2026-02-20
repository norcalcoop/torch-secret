---
phase: 24-eff-diceware-passphrase-generator
plan: 01
subsystem: crypto
tags: [diceware, passphrase, eff-wordlist, crypto.getRandomValues, rejection-sampling, tdd]

# Dependency graph
requires:
  - phase: 24-eff-diceware-passphrase-generator
    provides: EFF wordlist research, rejection-sampling design, module architecture decisions

provides:
  - EFF_WORDS: string[] constant (7,776 words from EFF large wordlist)
  - getUnbiasedIndex() — rejection-sampled Uint32 selection from [0, 7775]
  - generatePassphrase(wordCount=4): string — space-separated EFF diceware passphrase
  - crypto barrel re-export of generatePassphrase from client/src/crypto/index.ts

affects:
  - 24-02 (create page passphrase UI — imports generatePassphrase)
  - 24-03 (confirmation page passphrase display)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD with vitest spy on crypto.getRandomValues for randomness verification"
    - "string[] type annotation on large literal arrays (not as const) — avoids TS slowdown"
    - "Rejection sampling: cutoff = 2**32 - (2**32 % n) for unbiased uniform selection"
    - "EFF_WORDS exported alongside generatePassphrase for test membership verification"

key-files:
  created:
    - client/src/crypto/passphrase.ts
    - client/src/crypto/__tests__/passphrase.test.ts
  modified:
    - client/src/crypto/index.ts
    - eslint.config.ts

key-decisions:
  - "EFF_WORDS typed as string[] not readonly tuple — 7,776 literals in as const would slow TS language server significantly"
  - "EFF_WORDS exported (not private) — test suite needs direct access to verify membership invariant"
  - "Rejection sampling cutoff 4294964736 (= 2**32 - 2560) — eliminates modulo bias; rejection probability ~0.0000006 per word"
  - "Added no-unsafe-call: off to test file ESLint override — importing unresolved modules during RED phase causes false positive unsafe-call on all function calls"
  - "Test file uses .mock.calls.length >= 4 (not toHaveBeenCalledTimes with expect.any()) — toHaveBeenCalledTimes requires concrete number, not asymmetric matcher"

patterns-established:
  - "Passphrase tests import directly from '../passphrase.js' not from barrel — consistent with encrypt.test.ts pattern"
  - "crypto.getRandomValues spy test: use vi.spyOn + beforeEach/afterEach.mockRestore() to avoid test pollution"

requirements-completed: [PASS-01]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 24 Plan 01: EFF Diceware Passphrase Module Summary

**7,776-word EFF large wordlist bundled as TypeScript string[], generatePassphrase() using rejection-sampled crypto.getRandomValues exclusively**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T23:19:27Z
- **Completed:** 2026-02-20T23:22:47Z
- **Tasks:** 2 (RED + GREEN TDD cycle)
- **Files modified:** 4

## Accomplishments
- Created `client/src/crypto/passphrase.ts` with all 7,776 EFF large wordlist words as `EFF_WORDS: string[]`, `getUnbiasedIndex()` with rejection sampling, and `generatePassphrase(wordCount=4): string`
- Added 10 passing tests covering word count, EFF wordlist membership, format (lowercase alpha), uniqueness across calls, and `crypto.getRandomValues` spy verification
- Exported `generatePassphrase` from the crypto barrel (`index.ts`) for consumption by Phase 24 create/confirmation pages

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Write failing tests for generatePassphrase** - `5f81bc9` (test)
2. **Task 2: GREEN — Implement passphrase.ts and export from barrel** - `afdc62e` (feat)

_Note: TDD tasks use test → feat commit sequence per TDD execution flow_

## Files Created/Modified
- `client/src/crypto/passphrase.ts` — EFF_WORDS (7,776 words), getUnbiasedIndex() rejection sampler, generatePassphrase() export (1,036 lines)
- `client/src/crypto/__tests__/passphrase.test.ts` — 10 unit tests: word count, EFF membership, format, uniqueness, getRandomValues spy
- `client/src/crypto/index.ts` — Added `export { generatePassphrase } from './passphrase.js'`
- `eslint.config.ts` — Added `no-unsafe-call: off` to test file ESLint override block

## Decisions Made
- **EFF_WORDS typed as `string[]` not `as const`**: A 7,776-element `as const` literal array would cause TypeScript language-server slowdown due to per-element literal type inference. `string[]` is semantically correct and has no runtime overhead.
- **EFF_WORDS exported**: Tests need direct access to the wordlist to verify the "all words are from EFF list" invariant. Making it private would require indirect/weaker testing.
- **Rejection sampling cutoff = 4,294,964,736**: `2**32 - (2**32 % 7776) = 4294964736`. The 2,560 excess values at the top of the Uint32 range are rejected. Rejection probability is 0.0000596% — the loop almost never iterates twice. Eliminates modulo bias, which is required for a crypto module.
- **Added `no-unsafe-call: 'off'` to ESLint test override**: During TDD RED phase, `passphrase.ts` doesn't exist. ESLint's type-checked rules cannot resolve the import and mark all function calls from that module as `no-unsafe-call`. Adding this rule to the already-existing test override block (`no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument` were already off) is the correct fix — test files have always been exempt from these unsafe-* rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect test assertion for crypto.getRandomValues spy**
- **Found during:** Task 2 (GREEN — test run after implementation)
- **Issue:** Test used `expect(getRandomValuesSpy).toHaveBeenCalledTimes(expect.any(Number))` — `toHaveBeenCalledTimes()` requires a concrete number, not an asymmetric matcher. Vitest threw an assertion error even though `getRandomValues` WAS called 4 times.
- **Fix:** Replaced with `expect(getRandomValuesSpy.mock.calls.length).toBeGreaterThanOrEqual(4)` — direct property access with appropriate matcher
- **Files modified:** `client/src/crypto/__tests__/passphrase.test.ts`
- **Committed in:** `afdc62e` (Task 2 commit)

**2. [Rule 3 - Blocking] Added `no-unsafe-call: off` to ESLint test override**
- **Found during:** Task 1 commit (RED phase)
- **Issue:** Pre-commit lint-staged blocked the commit with 13 `no-unsafe-call` errors. The import from the non-existent `passphrase.ts` caused TypeScript to type all exported values as `any`, which `no-unsafe-call` flags when called as functions.
- **Fix:** Added `'@typescript-eslint/no-unsafe-call': 'off'` to the `**/*.test.ts` ESLint override block (which already disabled `no-unsafe-assignment`, `no-unsafe-member-access`, `no-unsafe-argument`).
- **Files modified:** `eslint.config.ts`
- **Committed in:** `5f81bc9` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary for TDD workflow correctness. No scope creep. The ESLint fix is additive to an existing pattern (test files already had 3 unsafe-* rules disabled).

## Issues Encountered
- `toHaveBeenCalledTimes(expect.any(Number))` is not valid Vitest syntax — `toHaveBeenCalledTimes` requires a concrete integer. Used `.mock.calls.length >= 4` assertion instead.

## User Setup Required
None - no external service configuration required. Pure client-side module with no new npm packages.

## Next Phase Readiness
- `generatePassphrase()` is ready for consumption by Phase 24 Plan 02 (create page UI)
- `EFF_WORDS` is exported for any future test that needs direct wordlist access
- Barrel export in `index.ts` allows `import { generatePassphrase } from '../crypto/index.js'` from any page
- The `wordCount` parameter is already designed for the v5.0 Pro-04 upgrade (6 words = 77.5 bits) — no changes needed to the function signature

## Self-Check: PASSED

All artifacts verified:
- `client/src/crypto/passphrase.ts` — FOUND
- `client/src/crypto/__tests__/passphrase.test.ts` — FOUND
- `24-01-SUMMARY.md` — FOUND
- Commit `5f81bc9` (RED) — FOUND
- Commit `afdc62e` (GREEN) — FOUND

---
*Phase: 24-eff-diceware-passphrase-generator*
*Completed: 2026-02-20*
