---
phase: 34-stripe-pro-billing
plan: 03
subsystem: ui
tags: [stripe, typescript, lucide, tailwind, accessibility, combobox]

# Dependency graph
requires:
  - phase: 34-stripe-pro-billing
    provides: Plan 01 billing foundation (subscriptionTier DB column, billing.service.ts); Plan 02 billing routes (/api/me subscriptionTier, /api/billing/*)

provides:
  - MeResponse, BillingCheckoutResponse, VerifyCheckoutResponse, BillingPortalResponse interfaces in shared/types/api.ts
  - getMe, initiateCheckout, verifyCheckoutSession, createPortalSession API client functions
  - createExpirationSelect(isAuthenticated, isPro) — custom div-based combobox: Pro users get all four options; free users get 30d locked with Lucide Lock icon + tooltip
  - create.ts calls getMe() in auth IIFE and passes isPro to createExpirationSelect

affects:
  - 34-04 (subscription management page — uses initiateCheckout, createPortalSession)
  - 35+ phases that display billing-aware UI

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Custom combobox pattern — div-based ARIA combobox (role=combobox trigger + role=listbox + role=option rows) replaces native <select> when icon/tooltip rendering on individual options is required
    - Pro tier gating via isPro parameter — single boolean gates which option rows are selectable; safe degradation to free on API error
    - Lock icon + tooltip via Tailwind group utility — group-hover:opacity-100 / group-focus-within:opacity-100 for keyboard accessibility

key-files:
  created: []
  modified:
    - shared/types/api.ts
    - client/src/api/client.ts
    - client/src/components/expiration-select.ts
    - client/src/pages/create.ts

key-decisions:
  - "Custom combobox replaces native <select> for authenticated path — native <select> cannot render icons or tooltips on individual options; required for the Lock icon + tooltip on 30d row"
  - "initiateCheckout uses POST not GET — state-creating operation per REST convention (consistent with Plan 02 billing route)"
  - "getMe() called inside existing auth IIFE with try/catch fallback — second API call is non-blocking relative to page render; safe degradation to isPro=false on error ensures create page never breaks"
  - "NodeListOf requires Array.from() in for-of loop — tsconfig lib: ES2022 does not include downlevel iterator support for DOM NodeList; auto-fixed during Task 2"

patterns-established:
  - "Combobox outside-click closes via document.addEventListener('click', ..., {capture: true}) — capture phase catches clicks before they bubble inside the container"
  - "Lock wrapper uses tabIndex=0 with aria-label for keyboard users to access tooltip via :focus-within — pure CSS, no JS event handlers"

requirements-completed: [BILL-03]

# Metrics
duration: 5min
completed: 2026-02-23
---

# Phase 34 Plan 03: Frontend Pro Tier Gating Summary

**MeResponse/billing interfaces in shared/types/api.ts, four billing API client functions, and a custom ARIA combobox in expiration-select.ts that shows a Lock icon + tooltip on the 30d option for free users while letting Pro users select it**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-23T14:10:58Z
- **Completed:** 2026-02-23T14:16:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Shared types extended with `MeResponse`, `BillingCheckoutResponse`, `VerifyCheckoutResponse`, `BillingPortalResponse` for type-safe billing API contracts
- Four API client functions exported from `client/src/api/client.ts`: `getMe`, `initiateCheckout`, `verifyCheckoutSession`, `createPortalSession`
- `createExpirationSelect` upgraded from a `<select>` to a fully custom div-based ARIA combobox: Pro users see all four options; free users see 30d locked with a Lucide Lock icon and tooltip "Upgrade to Pro to unlock"
- Full keyboard navigation in combobox: ArrowDown/Up, Enter, Space, Escape, Tab — all handled
- `create.ts` calls `getMe()` in the auth IIFE to determine `isPro`; safe fallback to `false` on any API error

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend shared/types/api.ts and client/src/api/client.ts with billing contracts** - `31fa2f1` (feat)
2. **Task 2: Replace expiration-select.ts with custom dropdown + update create.ts call site** - `316567a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `shared/types/api.ts` - Added Phase 34 section: MeResponse, BillingCheckoutResponse, VerifyCheckoutResponse, BillingPortalResponse interfaces
- `client/src/api/client.ts` - Added four billing API functions (getMe, initiateCheckout, verifyCheckoutSession, createPortalSession); updated import block with four new types
- `client/src/components/expiration-select.ts` - Full replacement: custom div-based combobox replacing native `<select>` for authenticated users; Lock icon + tooltip on 30d row for free users; all ARIA attributes per combobox pattern
- `client/src/pages/create.ts` - Added `getMe` import; auth IIFE now calls `getMe()` to determine `isPro` and passes it to `createExpirationSelect(true, isPro)`

## Decisions Made

- **Custom combobox over native `<select>`:** Native `<select>` cannot render icons or tooltips on individual options. The plan explicitly required a Lock icon + tooltip on the 30d row for free users — only achievable with a fully custom component.
- **`initiateCheckout` uses POST:** State-creating operation. The plan comment noted "GET" in one code sample but the plan's must_haves spec said POST; kept consistent with Plan 02 billing route (`POST /api/billing/checkout`).
- **Safe degradation for `getMe()` failure:** If `/api/me` returns an error (network issue, temporary outage), `isPro` falls back to `false` — the user sees the free-tier expiration options rather than a broken page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `NodeListOf` iterator type error in expiration-select.ts**
- **Found during:** Task 2 (TypeScript check after writing expiration-select.ts)
- **Issue:** `for...of` loop over `listbox.querySelectorAll<HTMLLIElement>(...)` produced TS2488 — `NodeListOf` lacks `[Symbol.iterator]()` under the project's `ES2022` lib target
- **Fix:** Wrapped with `Array.from(...)` before iterating: `for (const li of Array.from(listbox.querySelectorAll(...)))`
- **Files modified:** `client/src/components/expiration-select.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `316567a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type correctness)
**Impact on plan:** Fix required for TypeScript to compile. No scope change.

## Issues Encountered

None beyond the `NodeListOf` iterator issue documented above.

## User Setup Required

None - no external service configuration required. The billing API functions target endpoints shipped in Plan 02.

## Next Phase Readiness

- `getMe`, `initiateCheckout`, `verifyCheckoutSession`, `createPortalSession` are ready for Plan 04 (subscription management page / success/cancel flow)
- Free users on `/create` see the locked 30d option with upgrade prompt; Pro users see all four options
- TypeScript compiles clean across all files

---
*Phase: 34-stripe-pro-billing*
*Completed: 2026-02-23*

## Self-Check: PASSED

- FOUND: shared/types/api.ts
- FOUND: client/src/api/client.ts
- FOUND: client/src/components/expiration-select.ts
- FOUND: client/src/pages/create.ts
- FOUND: .planning/phases/34-stripe-pro-billing/34-03-SUMMARY.md
- FOUND commit: 31fa2f1 (Task 1)
- FOUND commit: 316567a (Task 2)
