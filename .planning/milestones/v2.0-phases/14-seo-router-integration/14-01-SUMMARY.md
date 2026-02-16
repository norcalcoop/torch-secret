---
phase: 14-seo-router-integration
plan: 01
subsystem: ui
tags: [seo, open-graph, twitter-card, json-ld, meta-tags, structured-data]

# Dependency graph
requires:
  - phase: 10-static-assets
    provides: "favicon/manifest assets, Vite publicDir serving, index.html template"
  - phase: 09-client-spa
    provides: "SPA router with updatePageMeta(string) and handleRoute()"
provides:
  - "PageMeta interface for typed route-specific SEO metadata"
  - "Static OG/Twitter/JSON-LD tags in index.html for social media crawlers"
  - "Dynamic meta tag management per route (description, canonical, robots, OG swap)"
  - "1200x630 OG image asset for social sharing previews"
affects: [14-02-server-x-robots-tag, future-seo-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns: [PageMeta-object-pattern, updateOgTags-helper, create-or-update-meta-dom-pattern]

key-files:
  created:
    - client/public/og-image.png
  modified:
    - client/index.html
    - client/src/router.ts
    - client/src/pages/confirmation.ts

key-decisions:
  - "Static OG tags in index.html because social crawlers do not execute JS"
  - "Noindex pages remove canonical link per SEO best practice (Pitfall 4)"
  - "Confirmation page preserves homepage description since URL stays /"
  - "OG tags replaced not removed on noindex routes to avoid empty metadata"

patterns-established:
  - "PageMeta interface: all route meta via typed object, not string"
  - "updateOgTags(): swap OG/Twitter content between homepage and generic branding"
  - "JSON-LD nonce: application/ld+json script tags include CSP nonce for safety"

# Metrics
duration: 3min
completed: 2026-02-16
---

# Phase 14 Plan 01: SEO Meta Infrastructure Summary

**Static OG/Twitter/JSON-LD tags in index.html with PageMeta-based dynamic meta management per route, noindex protection for secret URLs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-16T17:44:20Z
- **Completed:** 2026-02-16T17:48:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Homepage fully discoverable with meta description, 9 OG tags, 3 Twitter Card tags, and JSON-LD WebApplication structured data
- updatePageMeta() refactored from string to PageMeta object managing title, description, canonical, robots, and OG tags as single source of truth
- Secret and error routes protected with noindex/nofollow robots directive, canonical removal, and generic OG branding
- No stale meta tags persist across SPA navigation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add static SEO tags to index.html and create OG image** - `4582a1e` (feat)
2. **Task 2: Refactor updatePageMeta() to PageMeta object and update all call sites** - `605d1c0` (feat)

## Files Created/Modified
- `client/index.html` - Added meta description, canonical, 9 OG tags, 3 Twitter Card tags, JSON-LD WebApplication block, updated title
- `client/src/router.ts` - Added PageMeta interface, rewrote updatePageMeta() for full meta management, added updateOgTags() helper, updated 3 handleRoute call sites
- `client/src/pages/confirmation.ts` - Updated updatePageMeta call from string to PageMeta object
- `client/public/og-image.png` - 1200x630 branded OG image (dark background with shield icon and branding)

## Decisions Made
- Static OG tags in index.html because social media crawlers (Facebook, Slack, Discord, X) do not execute JavaScript -- static HTML is the only reliable solution for rich preview cards
- Noindex pages remove the canonical link element entirely rather than pointing it elsewhere, per research Pitfall 4 (avoids confusing crawler signals)
- Confirmation page preserves homepage description and does not set noindex since the URL remains `/` and the page is transient
- OG tags are replaced with generic branding on noindex routes rather than removed, to avoid platforms showing empty/broken metadata
- JSON-LD script tag includes CSP nonce as belt-and-suspenders precaution

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- ImageMagick font rendering unavailable (no Freetype/Ghostscript delegates) - used pure Node.js PNG generator as fallback to create OG image programmatically

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Client-side SEO meta infrastructure complete
- Ready for 14-02: server-side X-Robots-Tag header injection for secret routes
- All 163 existing tests pass

## Self-Check: PASSED

All created/modified files verified on disk. All commit hashes found in git log.

---
*Phase: 14-seo-router-integration*
*Completed: 2026-02-16*
