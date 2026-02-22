---
phase: 27-conversion-prompts-rate-limits-legal-pages
plan: "02"
subsystem: ui
tags:
  - conversion-prompts
  - expiration-select
  - auth-aware
  - rate-limit-upsell
  - posthog

dependency_graph:
  requires:
    - "Phase 27-01: Auth-aware rate limiters and ApiError.rateLimitReset field"
    - "Phase 22: Better Auth session + authClient.getSession()"
    - "Phase 23: Progressive enhancement pattern (auth IIFE)"
    - "Phase 25: PostHog analytics module with captureXxx pattern"
  provides:
    - "Auth-aware expiration select: anonymous locked '1h', authenticated 1h/24h/7d"
    - "Session-scoped anonymousSecretCount with promptNumber derivation (1|3|null)"
    - "renderConfirmationPage accepts 6th promptNumber param; renders dismissible branded prompt cards"
    - "showRateLimitUpsell replaces generic 429 error with countdown upsell inline card"
    - "captureConversionPromptShown and captureConversionPromptClicked PostHog events"
  affects:
    - "client/src/pages/create.ts (submit handler, auth IIFE, error handler)"
    - "client/src/pages/confirmation.ts (signature and prompt card rendering)"
    - "client/src/components/expiration-select.ts (API changed)"

tech_stack:
  added: []
  patterns:
    - "ExpirationSelectResult interface: { element: HTMLElement; getValue: () => string } — accessor pattern enables anonymous/authenticated element swap without DOM selector gymnastics"
    - "Module-level mutable state (anonymousSecretCount, isAuthenticated) persists across SPA re-renders within same page session without localStorage"
    - "Progressive upgrade: auth IIFE removes anon element and appends authenticated element to same DOM parent after session resolves"
    - "Error area reuse: showRateLimitUpsell replaces danger-styled div with neutral informational card, reset with danger class on next submit"

key_files:
  created: []
  modified:
    - "client/src/components/expiration-select.ts"
    - "client/src/analytics/posthog.ts"
    - "client/src/pages/create.ts"
    - "client/src/pages/confirmation.ts"

key-decisions:
  - "ExpirationSelectResult returned from createExpirationSelect(isAuthenticated) — caller uses element/getValue accessor instead of HTMLSelectElement directly; anonymous mode returns getValue: () => '1h' constant, authenticated returns live select.value"
  - "30d option removed from authenticated select — Pro-tier feature deferred to v5.0; authed users see 1h/24h/7d matching server-side cap enforced in Phase 27-01"
  - "Module-level anonymousSecretCount and isAuthenticated — module scope persists across SPA navigate('/') re-renders; resets only on full browser refresh (same lifecycle as dismissed prompt state)"
  - "isAuthenticated module flag set in auth IIFE — avoids passing auth state through multiple layers; single source of truth for prompt suppression in submit handler"
  - "Error area className reset on each submit before validation — showRateLimitUpsell mutates errorArea className; reset ensures danger styling is restored if user tries again after a 429"
  - "captureSecretCreated fires before promptNumber derivation and renderConfirmationPage — analytics fires in create context before page transitions; promptNumber computation is independent"
  - "Conversion prompt cards use textContent + Unicode escapes only — no innerHTML anywhere; XSS-safe DOM construction convention maintained throughout"

patterns-established:
  - "Accessor pattern for swappable UI components: { element, getValue } interface lets submit handlers read live state without tracking which element variant is in the DOM"
  - "Upsell-aware error handler: check instanceof ApiError && err.status === 429 before generic error fallback; avoids branching in catch by returning early"

requirements-completed:
  - CONV-02
  - CONV-03
  - CONV-04
  - CONV-05
  - CONV-06

duration: 8min
completed: "2026-02-21"
---

# Phase 27 Plan 02: Conversion-Aware Create + Confirmation Pages Summary

**Auth-aware expiration select (locked 1h for anon, 1h/24h/7d for authed), session-scoped conversion prompts on the confirmation page at creations 1 and 3, inline rate-limit upsell card on 429, and two PostHog conversion events.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-21T14:10:42Z
- **Completed:** 2026-02-21T14:18:38Z
- **Tasks:** 2 (committed as 1 atomic commit — Task 1 changes break project until Task 2 fixes usages)
- **Files modified:** 4

## Accomplishments

- `createExpirationSelect(isAuthenticated)` replaces the no-arg version: anonymous users see a static "1 hour" display with "Create a free account for longer expiration." note; authenticated users see a `<select>` with 1h/24h/7d (no 30d)
- `renderConfirmationPage` now accepts a 6th optional `promptNumber: 1 | 3 | null` arg; dismissible branded accent cards appear after the URL card for anonymous first and third creations
- `showRateLimitUpsell` replaces generic red error text when POST /api/secrets returns 429: shows headline, countdown (from `rateLimitReset` timestamp), benefit line, and 'Sign up — it's free' CTA
- `captureConversionPromptShown` and `captureConversionPromptClicked` added to posthog.ts with zero-knowledge invariant enforcement

## Task Commits

Both tasks committed atomically in a single commit (required — Task 1 changes break TS until Task 2 updates callers):

1. **Tasks 1+2: Auth-aware expiration select + PostHog events + conversion-aware pages** - `513c817` (feat)

## Files Created/Modified

- `client/src/components/expiration-select.ts` — Rewrote to export `ExpirationSelectResult` interface and `createExpirationSelect(isAuthenticated: boolean)` factory with two rendering modes
- `client/src/analytics/posthog.ts` — Added `captureConversionPromptShown` and `captureConversionPromptClicked` exported functions
- `client/src/pages/create.ts` — Module-level `anonymousSecretCount` and `isAuthenticated`; expiration select upgrades in auth IIFE; 429 catch uses `showRateLimitUpsell`; `renderConfirmationPage` called with 6th `promptNumber` arg; added `navigate` import
- `client/src/pages/confirmation.ts` — Updated `renderConfirmationPage` signature; added `createConversionPromptCard` helper; imports `captureConversionPromptShown` and `captureConversionPromptClicked` from posthog

## Decisions Made

- `ExpirationSelectResult` accessor interface enables progressive upgrade pattern: auth IIFE calls `.element.remove()` then reassigns `expirationSelectResult = createExpirationSelect(true)` without needing to know where the element is in the DOM hierarchy
- 30d option intentionally absent from authenticated select — matches server-side cap from Phase 27-01; Pro-tier deferred to v5.0
- Module-level `isAuthenticated` flag set in auth IIFE for prompt suppression — simpler than threading auth state through function parameters across multiple call sites
- Error area className reset on each submit handles the case where a previous 429 replaced danger styling with neutral informational styling; ensures correct visual treatment on retry

## Deviations from Plan

None - plan executed exactly as written. TypeScript compiled clean on first attempt after implementing both tasks.

## Issues Encountered

- `client/tsconfig.json` referenced in plan verify command does not exist — project uses root `tsconfig.json`. Used `npx tsc --noEmit` (without project flag) instead. All 111 client tests and TypeScript compilation verified clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All CONV requirements (02-06) complete
- Phase 27 all 3 plans complete (LEGAL-01, LEGAL-02 from Plan 03 also done)
- v4.0 phase complete — 42/44 requirements met (CONV-04, CONV-05 now satisfied by this plan; LEGAL-03, LEGAL-04 remain pending per STATE.md)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `client/src/components/expiration-select.ts` | FOUND |
| `client/src/analytics/posthog.ts` | FOUND |
| `client/src/pages/create.ts` | FOUND |
| `client/src/pages/confirmation.ts` | FOUND |
| `27-02-SUMMARY.md` | FOUND |
| Commit 513c817 | FOUND |
| `isAuthenticated` param in `createExpirationSelect` | VERIFIED |
| `anonymousSecretCount` module-level var in `create.ts` | VERIFIED |
| `promptNumber` param in `renderConfirmationPage` | VERIFIED |
| `conversion_prompt_shown` in `posthog.ts` | VERIFIED |
| TypeScript compiles clean | VERIFIED |
| 111 client tests passing | VERIFIED |

---
*Phase: 27-conversion-prompts-rate-limits-legal-pages*
*Completed: 2026-02-21*
