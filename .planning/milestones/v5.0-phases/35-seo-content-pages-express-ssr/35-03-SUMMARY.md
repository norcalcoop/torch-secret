---
phase: 35-seo-content-pages-express-ssr
plan: 03
subsystem: api
tags: [express, ssr, seo, supertest, vitest, sitemap, integration-tests]

# Dependency graph
requires:
  - phase: 35-seo-content-pages-express-ssr
    plan: 01
    provides: seoRouter, vsRouter, alternativesRouter with FAQPage JSON-LD
  - phase: 35-seo-content-pages-express-ssr
    plan: 02
    provides: useRouter (hub + 8 individual pages with HowTo + FAQPage JSON-LD)
provides:
  - seoRouter mounted in app.ts before express.static — SSR routes take precedence over SPA catch-all
  - sitemap.xml with 17 <url> entries (root + pricing + 14 new SEO pages)
  - server/src/routes/__tests__/seo.test.ts — 31 integration tests covering SEO-01 through SEO-06
affects:
  - 35-04 (UAT verifies SSR content is in HTTP response — seoRouter now live)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - seoRouter mount position: AFTER /api catch-all, BEFORE express.static block — SSR routes intercept before SPA catch-all
    - Integration test pattern for SSR routes: buildApp() + supertest, no DB setup needed for SSR pages
    - test.each() for multi-slug tests (onetimesecret/pwpush/privnote, all 8 use-case slugs)
    - NOINDEX_PREFIXES remains unchanged — /vs, /alternatives, /use are intentionally indexable

key-files:
  created:
    - server/src/routes/__tests__/seo.test.ts
  modified:
    - server/src/app.ts
    - client/public/sitemap.xml

key-decisions:
  - "seoRouter mounted without a path prefix (app.use(seoRouter)) — routes inside seoRouter already have /vs, /alternatives, /use prefixes from seoRouter's internal mounts"
  - "NOINDEX_PREFIXES verified unchanged — /vs, /alternatives, /use not added; these SSR pages are intentionally crawlable"
  - "sitemap.xml extended to 17 entries: original root + pricing (pre-existing from Phase 33) + 14 new SEO page URLs"

patterns-established:
  - "SSR integration test pattern: no DB setup block needed when routes have no DB dependency — simplifies test boilerplate vs security.test.ts"

requirements-completed: [SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 35 Plan 03: SEO Content Pages Wire-up Summary

**seoRouter mounted in app.ts before SPA catch-all, sitemap.xml extended to 17 entries, 31 integration tests covering all 6 SEO requirements — all routes now live and indexed**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-26T14:04:20Z
- **Completed:** 2026-02-26T14:06:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Wired `seoRouter` into `app.ts` with import at top and `app.use(seoRouter)` after the `/api` catch-all and before `express.static` — SSR routes now intercept `/vs/*`, `/alternatives/*`, and `/use/*` before the SPA catch-all can serve `index.html`
- Updated middleware order comment to document step 9 as "SEO SSR routes" and pushed static/SPA to step 10, errorHandler to step 11
- Extended `client/public/sitemap.xml` from 1 to 17 `<url>` entries: original root, pricing (pre-existing from Phase 33), plus all 14 new SEO pages
- Created `seo.test.ts` with 31 integration tests across 6 describe blocks covering SEO-01 through SEO-06; all pass; full test suite at 302 tests with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire seoRouter into app.ts + extend sitemap.xml** - `5a19232` (feat)
2. **Task 2: Integration tests for SEO-01 through SEO-06** - `24a3781` (test)

## Files Created/Modified

- `server/src/app.ts` - Added `seoRouter` import, `app.use(seoRouter)` mount after `/api` catch-all, updated middleware order comment (steps 9/10/11)
- `client/public/sitemap.xml` - Extended from 1 to 17 `<url>` entries: root, pricing, 3 VS pages, 3 alternatives pages, 1 hub, 8 use-case pages
- `server/src/routes/__tests__/seo.test.ts` - 31 tests: SEO-01 (VS pages), SEO-02 (alternatives pages), SEO-03 (hub), SEO-04 (8 use-case slugs), SEO-05 (JSON-LD types), SEO-06 (no noindex header)

## Decisions Made

- `app.use(seoRouter)` without a path prefix — seoRouter already internally mounts `/vs`, `/alternatives`, `/use` sub-routers, so no double-prefix needed
- NOINDEX_PREFIXES list left untouched — confirmed it does not contain `/vs`, `/alternatives`, or `/use`; these are intentionally indexable SEO pages
- sitemap.xml extended rather than replaced — pricing entry from Phase 33 preserved

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. seoRouter was ready from Plans 01 and 02; the mount was straightforward. TypeScript compiled clean on first attempt. All 31 tests passed on first run.

## User Setup Required

None — no external service configuration required. All routes are now live when the server starts.

## Next Phase Readiness

- All 14 SEO routes are now live at `/vs/*`, `/alternatives/*`, and `/use/*` — SSR content is present in initial HTTP response
- Plan 04 (UAT) can now verify SSR content is in the HTTP response via curl or browser inspection
- `NOINDEX_PREFIXES` confirmed clean — no SEO page prefixes added; these pages will be indexed by Googlebot and AI crawlers

## Self-Check: PASSED

All files verified to exist on disk:
- FOUND: server/src/routes/__tests__/seo.test.ts
- FOUND: server/src/app.ts (modified)
- FOUND: client/public/sitemap.xml (modified)

All commits verified:
- FOUND: 5a19232 (feat: seoRouter wiring + sitemap)
- FOUND: 24a3781 (test: SEO integration tests)

---
*Phase: 35-seo-content-pages-express-ssr*
*Completed: 2026-02-26*
