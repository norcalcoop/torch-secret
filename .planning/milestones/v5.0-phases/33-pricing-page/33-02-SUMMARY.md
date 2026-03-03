---
phase: 33-pricing-page
plan: "02"
subsystem: ui
tags: [router, seo, json-ld, structured-data, csp]

# Dependency graph
requires:
  - phase: 33-01
    provides: pricing.ts page module with renderPricingPage() export and FAQ_ITEMS array
provides:
  - /pricing route is live — imports pricing.js, calls renderPricingPage, no noindex
  - FAQPage JSON-LD statically embedded in index.html — curl-verifiable per PRICE-05
affects: [phase-34, phase-33-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static JSON-LD in HTML shell pattern: place structured data in index.html for SPA curl-verifiability (not JS injection)"
    - "CSP nonce pattern: all <script> tags require nonce=\"__CSP_NONCE__\" regardless of type attribute"

key-files:
  created: []
  modified:
    - client/src/router.ts
    - client/index.html

key-decisions:
  - "FAQPage JSON-LD placed statically in index.html (not injected by renderPricingPage) because curl does not execute JavaScript — static placement is the only curl-verifiable approach for an SPA"
  - "noindex removed from /pricing route — pricing page is SEO-valuable and must be indexable"
  - "FAQ strings in JSON-LD are verbatim copies of FAQ_ITEMS in pricing.ts — single source of truth in pricing.ts, JSON-LD in index.html is a copy"

patterns-established:
  - "Static JSON-LD in SPA: place in index.html <head> alongside WebApplication block for curl/crawler verifiability"
  - "CSP nonce applies to all <script type='application/ld+json'> tags — include nonce attribute even for non-executable scripts"

requirements-completed: [PRICE-01, PRICE-05]

# Metrics
duration: 2min
completed: 2026-02-23
---

# Phase 33 Plan 02: Router Wiring + FAQPage JSON-LD Summary

**Activated /pricing route from 404 stub to renderPricingPage, and embedded static FAQPage JSON-LD in index.html for curl-verifiable schema markup (PRICE-05)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T03:17:33Z
- **Completed:** 2026-02-23T03:19:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Swapped /pricing router stub from `error.js` + noindex to `pricing.js` + `renderPricingPage(container)` — pricing page is now live and SEO-indexable
- Inserted FAQPage JSON-LD block in `client/index.html` with verbatim Q&A strings matching `FAQ_ITEMS` in pricing.ts and `nonce="__CSP_NONCE__"` for CSP compliance
- PRICE-05 requirement satisfied: FAQPage schema is present in the initial HTTP response, curl-verifiable without JavaScript execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap /pricing router stub to renderPricingPage** - `29d87c2` (feat)
2. **Task 2: Add static FAQPage JSON-LD to index.html** - `b98453c` (feat)

**Plan metadata:** (committed with state updates)

## Files Created/Modified
- `client/src/router.ts` - Removed noindex from /pricing route; replaced error.js import+renderErrorPage with pricing.js import+renderPricingPage
- `client/index.html` - Added FAQPage JSON-LD block after WebApplication block, before </head>; two JSON-LD blocks total, two CSP nonce placeholders

## Decisions Made
- FAQPage JSON-LD placed statically in index.html (not dynamically injected by renderPricingPage) because PRICE-05 requires curl-verifiability and curl does not execute JavaScript. A SPA serving from a single HTML shell can only satisfy this by embedding the markup in the shell.
- Verbatim string copy from FAQ_ITEMS: pricing.ts is the canonical source of truth; index.html JSON-LD is a copy. Any future FAQ content changes require updating both files.
- No change to `server/src/app.ts` needed — Express's `replaceAll('__CSP_NONCE__', ...)` pattern already processes all `__CSP_NONCE__` occurrences in the HTML shell automatically.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 PRICE requirements (PRICE-01 through PRICE-05) satisfied by Plan 01 + Plan 02 combined
- Plan 03 (auth-aware CTA) can now update the Pro CTA from `/register?plan=pro` to context-aware behavior for logged-in users
- /pricing is live, indexed, and schema-marked — ready for Phase 34 Stripe integration

---
*Phase: 33-pricing-page*
*Completed: 2026-02-23*
