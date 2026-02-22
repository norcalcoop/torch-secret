---
phase: 25-posthog-analytics
plan: 01
subsystem: analytics
tags: [posthog, analytics, csp, privacy, zero-knowledge, before_send, url-sanitization]

# Dependency graph
requires:
  - phase: 22-better-auth
    provides: userId for identifyUser() calls
  - phase: 21-schema-foundation
    provides: zero-knowledge invariant (INVARIANTS.md) that governs event design
provides:
  - PostHog analytics module with privacy-safe init and mandatory before_send sanitizer
  - Named capture helpers for all funnel events (secret_created, secret_viewed, user_registered, user_logged_in)
  - identifyUser(userId) and resetAnalyticsIdentity() for auth integration
  - CSP connect-src updated to allow PostHog API hosts
  - Vite ImportMetaEnv type declarations for VITE_POSTHOG_KEY and VITE_POSTHOG_HOST
affects:
  - 25-02 (pageview wiring in router.ts)
  - 25-03 (secret funnel event wiring in create/reveal pages)
  - 25-04 (auth event wiring in login/register pages)

# Tech tracking
tech-stack:
  added: [posthog-js@^1.352.0]
  patterns:
    - Analytics module as single named-export file — all PostHog interaction encapsulated in analytics/posthog.ts
    - before_send hook for mandatory URL fragment stripping on every event
    - Guard pattern — isInitialized() check at top of every capture function (no-op when key unset)
    - Zero-knowledge event scoping — secret events have no userId; user events have no secretId

key-files:
  created:
    - client/src/analytics/posthog.ts
    - client/src/vite-env.d.ts
  modified:
    - server/src/middleware/security.ts
    - .env.example
    - package.json

key-decisions:
  - "posthog-js npm import (not CDN snippet) — bundled via Vite; no script-src CSP changes needed, only connect-src"
  - "before_send (not sanitize_properties) — sanitize_properties is legacy name, before_send is current posthog-js API"
  - "capture_pageview: false — manual SPA pageview tracking; prevents race with reveal-page fragment stripping"
  - "autocapture: false — prevents plaintext textarea capture on create page (critical privacy requirement)"
  - "initAnalytics() no-op when VITE_POSTHOG_KEY unset — dev/test environments skip analytics silently"
  - "stripFragment uses new URL() with try/catch fallback to regex — handles absolute URLs, relative URLs, and non-URL strings"

patterns-established:
  - "Pattern: Analytics guard — every capture function returns early if !isInitialized()"
  - "Pattern: Zero-knowledge event design — secret events contain only non-identifying metadata; user events contain only method"

requirements-completed: [ANLT-01, ANLT-02, ANLT-03]

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 25 Plan 01: PostHog Analytics Foundation Summary

**PostHog analytics module with mandatory before_send URL fragment stripping (AES-256-GCM key guard), zero-knowledge-compliant event helpers, and CSP connect-src updated for posthog-js npm bundle approach**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T01:13:27Z
- **Completed:** 2026-02-21T01:16:12Z
- **Tasks:** 2
- **Files modified:** 4 (+ package.json + package-lock.json)

## Accomplishments

- Created `client/src/analytics/posthog.ts` exporting all 8 required named functions: initAnalytics, capturePageview, captureSecretCreated, captureSecretViewed, captureUserRegistered, captureUserLoggedIn, identifyUser, resetAnalyticsIdentity
- Implemented mandatory before_send hook that strips URL fragments (#...) from $current_url, $referrer, and $initial_referrer on every PostHog event — preventing AES-256-GCM encryption keys from leaking to PostHog servers
- Updated Helmet CSP connect-src to allow `https://us.i.posthog.com` and `https://us-assets.i.posthog.com` for the npm bundle approach (no script-src changes needed)
- Created `client/src/vite-env.d.ts` with ImportMetaEnv augmentation for VITE_POSTHOG_KEY and VITE_POSTHOG_HOST type safety
- Documented analytics env vars in .env.example with safe-default comments (unset = no-op)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install posthog-js and create analytics module** - `d57912d` (feat)
2. **Task 2: Update CSP connect-src and .env.example** - `ff3e7c7` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `client/src/analytics/posthog.ts` - PostHog init with before_send sanitizer, all 8 named capture helpers, zero-knowledge invariant enforced by module design
- `client/src/vite-env.d.ts` - Vite ImportMetaEnv augmentation for VITE_POSTHOG_KEY and VITE_POSTHOG_HOST
- `server/src/middleware/security.ts` - CSP connect-src updated with PostHog US cloud hosts
- `.env.example` - Analytics section documenting VITE_POSTHOG_KEY and VITE_POSTHOG_HOST with safe defaults

## Decisions Made

- **posthog-js npm import (not CDN snippet):** Vite bundles posthog into output JS chunk — no dynamic script injection, no script-src CSP change needed, only connect-src update required
- **before_send over sanitize_properties:** `sanitize_properties` is legacy naming; the current posthog-js API uses `before_send`. Using the wrong name would silently fail with fragments reaching PostHog
- **capture_pageview: false + manual:** Prevents race condition on reveal page where automatic pageview could fire before history.replaceState strips the fragment. before_send is belt-and-suspenders
- **autocapture: false:** Passive DOM capture would record plaintext from the create-page textarea before encryption — critical privacy/security requirement
- **initAnalytics() no-op guard:** `if (!key) return` ensures dev/test environments with no VITE_POSTHOG_KEY skip analytics initialization entirely (safe default)
- **stripFragment URL handling:** `new URL()` with try/catch fallback to regex handles absolute URLs, relative URLs, and non-URL strings safely

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. VITE_POSTHOG_KEY must be obtained from posthog.com before analytics events will flow in production — documented in .env.example.

## Next Phase Readiness

- Analytics module is complete and ready for wiring into app.ts (initAnalytics call), router.ts (capturePageview), create/reveal pages, and auth pages
- All capture functions are no-ops until VITE_POSTHOG_KEY is configured — safe to wire without a live PostHog account
- Phase 25-02 can proceed immediately: wire initAnalytics() into app.ts DOMContentLoaded handler and capturePageview() into router.ts handleRoute()

---
*Phase: 25-posthog-analytics*
*Completed: 2026-02-21*
