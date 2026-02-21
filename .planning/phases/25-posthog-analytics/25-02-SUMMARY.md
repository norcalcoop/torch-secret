---
phase: 25-posthog-analytics
plan: 02
subsystem: analytics
tags: [posthog, analytics, wiring, app-init, router, create-page, reveal-page, funnel]

# Dependency graph
requires:
  - phase: 25-posthog-analytics
    plan: 01
    provides: initAnalytics, capturePageview, captureSecretCreated, captureSecretViewed from analytics/posthog.ts
provides:
  - initAnalytics() called at DOMContentLoaded startup in app.ts
  - capturePageview() called on every SPA route change in router.ts
  - captureSecretCreated(expiresIn, hasPassword) called after renderConfirmationPage() in create.ts
  - captureSecretViewed() called after terminal block renders in reveal.ts
affects:
  - 25-03 (auth event wiring in login/register pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Analytics wiring at DOMContentLoaded before router init — PostHog initialized before any route event fires
    - capturePageview() placed before routechange dispatch — URL settled, before_send strips fragments
    - captureSecretCreated called after renderConfirmationPage() — fires only on successful creation, not on errors
    - captureSecretViewed called at end of renderRevealedSecret() — fires only after plaintext renders in DOM

key-files:
  created: []
  modified:
    - client/src/app.ts
    - client/src/router.ts
    - client/src/pages/create.ts
    - client/src/pages/reveal.ts

key-decisions:
  - "initAnalytics() placed before initThemeListener() in DOMContentLoaded — ensures PostHog ready before router fires any route events"
  - "capturePageview() placed before routechange dispatch (not inside each route branch) — single unconditional call covers all routes; before_send handles fragment stripping"
  - "captureSecretCreated receives expiresIn and !!password only — zero-knowledge invariant: no secretId, no shareUrl, no label, no userId"
  - "captureSecretViewed fires after container.appendChild(wrapper) — event fires only after plaintext confirmed in DOM"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 25 Plan 02: Analytics Wiring Summary

**Wire initAnalytics() into DOMContentLoaded, capturePageview() into SPA router, captureSecretCreated() into create form submit, and captureSecretViewed() into reveal page — completing the funnel-tracking integration with zero-knowledge invariant preserved throughout**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T01:19:25Z
- **Completed:** 2026-02-21T01:21:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Wired `initAnalytics()` into `client/src/app.ts` DOMContentLoaded callback — executes before `initThemeListener()`, `createLayoutShell()`, and `initRouter()` so PostHog is initialized before any route events fire
- Wired `capturePageview()` into `client/src/router.ts` `handleRoute()` function — called once unconditionally before `window.dispatchEvent(routechange)`, covering all routes including initial load, back/forward, and programmatic navigation
- Wired `captureSecretCreated(expiresIn, !!password)` into `client/src/pages/create.ts` submit handler — called immediately after `renderConfirmationPage()` so it fires only on confirmed successful secret creation; zero-knowledge invariant preserved (no secretId, no shareUrl, no label, no userId)
- Wired `captureSecretViewed()` into `client/src/pages/reveal.ts` `renderRevealedSecret()` function — called after `container.appendChild(wrapper)` so it fires only after plaintext is confirmed in the DOM; no userId or secretId passed

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire initAnalytics into app.ts and capturePageview into router.ts** - `9586d83` (feat)
2. **Task 2: Wire captureSecretCreated into create.ts and captureSecretViewed into reveal.ts** - `3b275d1` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `client/src/app.ts` - Added `import { initAnalytics }` and `initAnalytics()` call before initThemeListener()
- `client/src/router.ts` - Added `import { capturePageview }` and `capturePageview()` call before routechange dispatch
- `client/src/pages/create.ts` - Added `import { captureSecretCreated }` and call after renderConfirmationPage()
- `client/src/pages/reveal.ts` - Added `import { captureSecretViewed }` and call at end of renderRevealedSecret()

## Decisions Made

- **initAnalytics() first in DOMContentLoaded:** PostHog must be initialized before any router activity. Placing it first ensures no route events are missed.
- **Single capturePageview() call location:** Rather than inserting inside each route branch (7+ branches), one call before the routechange dispatch at the bottom of handleRoute() handles all cases unconditionally. The before_send hook in the analytics module strips any URL fragments regardless of which route was navigated to.
- **captureSecretCreated args: expiresIn + !!password only:** Zero-knowledge invariant requires no secretId or user identity. The `expiresIn` string and `hasPassword` boolean are the only safe non-identifying properties.
- **captureSecretViewed at end of renderRevealedSecret:** This placement means the event fires only when the decrypted plaintext is confirmed rendered — after the password flow (renderPasswordEntry calls renderRevealedSecret too), after handleReveal, and after both auth paths. No userId or secretId passed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check: PASSED

- `client/src/app.ts` — FOUND, contains initAnalytics import and call
- `client/src/router.ts` — FOUND, contains capturePageview import and call
- `client/src/pages/create.ts` — FOUND, contains captureSecretCreated import and call
- `client/src/pages/reveal.ts` — FOUND, contains captureSecretViewed import and call
- Commit `9586d83` — FOUND
- Commit `3b275d1` — FOUND
- `npm run lint` — PASSED (0 errors)
- `npx tsc --noEmit` — PASSED (0 errors)
- `npm run test:run` — PASSED (220 tests)

---
*Phase: 25-posthog-analytics*
*Completed: 2026-02-21*
