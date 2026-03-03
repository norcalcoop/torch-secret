---
phase: 35-seo-content-pages-express-ssr
plan: 02
subsystem: api
tags: [express, ssr, seo, typescript, schema-org, howto, faqpage, json-ld]

# Dependency graph
requires:
  - phase: 35-seo-content-pages-express-ssr
    plan: 01
    provides: renderLayout(), escHtml(), LayoutOptions interface, seoRouter with /vs and /alternatives mounts
provides:
  - server/src/routes/seo/templates/use-case-pages.ts — USE_CASE_PAGES (8 slugs) and USE_CASE_HUB data
  - server/src/routes/seo/use.ts — useRouter handling GET / (hub) and GET /:slug (individual pages)
  - server/src/routes/seo/index.ts — seoRouter now mounts /use via useRouter
affects:
  - 35-03 (mounts seoRouter into app.ts — /use/* now included alongside /vs/* and /alternatives/*)
  - 35-04 (UAT verifies /use/* SSR content in initial HTTP response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HowTo JSON-LD combined with FAQPage JSON-LD as single JSON array in one <script type="application/ld+json"> block
    - Visible FAQ section rendered as <dl>/<dt>/<dd> with escHtml sanitization (use-case pages show FAQ in body; VS pages do not)
    - renderRelated() helper produces 2-3 contextual cross-links between use-case pages
    - Hub page grid using CSS grid auto-fill with min 18rem column width (no Tailwind — SSR inline styles)

key-files:
  created:
    - server/src/routes/seo/templates/use-case-pages.ts
    - server/src/routes/seo/use.ts
  modified:
    - server/src/routes/seo/index.ts

key-decisions:
  - "HowTo + FAQPage combined into single JSON array JSON.stringify([howToSchema, faqSchema]) — one <script> block instead of two; valid per schema.org spec"
  - "FAQ visible in use-case page body (as <dl>) unlike VS pages — plan specified this distinction; use-case pages benefit from visible Q&A for user reading"
  - "Hub page uses inline CSS grid (auto-fill, minmax 18rem, 1fr) rather than Tailwind classes — consistent with SSR pattern established in Plan 01"

patterns-established:
  - "Combined JSON-LD array pattern: JSON.stringify([schemaA, schemaB]) for pages with multiple schema types — avoids double <script> blocks while remaining valid"
  - "Visible FAQ pattern: use-case pages render faqItems as <dl>/<dt>/<dd> via renderFaq() helper; FAQ is BOTH in body HTML AND in FAQPage JSON-LD"

requirements-completed: [SEO-03, SEO-04, SEO-05]

# Metrics
duration: 9min
completed: 2026-02-26
---

# Phase 35 Plan 02: Use-Case SSR Pages Summary

**USE_CASE_PAGES data map (8 slugs) + useRouter (hub + individual pages with combined HowTo + FAQPage JSON-LD) + seoRouter /use mount**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-02-26T13:52:40Z
- **Completed:** 2026-02-26T14:01:16Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created USE_CASE_PAGES data map with full copy, HTML, steps, and FAQ items for all 8 use-case slugs sourced from `.claude/use-case-pages.md`
- Created USE_CASE_HUB with 8 card entries for the /use/ hub page
- useRouter handles GET / (hub card grid) and GET /:slug (individual pages with combined HowTo + FAQPage JSON-LD)
- seoRouter index updated to import and mount useRouter at /use
- All 8 slugs return 200 with H1 in initial HTTP response; unknown slugs return 404 JSON
- Hub page contains links to all 8 use-case slug URLs
- TypeScript compiles clean, husky pre-commit passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Use-case page data map (8 slugs + hub)** - `6d9d2d2` (feat)
2. **Task 2: Use-case router + update seoRouter index** - `c3ed3e9` (feat)

## Files Created/Modified

- `server/src/routes/seo/templates/use-case-pages.ts` - USE_CASE_PAGES (8 slug entries with meta/h1/description/bodyHtml/steps/faqItems) + USE_CASE_HUB (meta + 8 cards) + renderFaq()/renderRelated() helpers
- `server/src/routes/seo/use.ts` - useRouter: GET / returns hub grid, GET /:slug returns page with HowTo+FAQPage JSON-LD or 404
- `server/src/routes/seo/index.ts` - Added useRouter import and seoRouter.use('/use', useRouter) mount

## Decisions Made

- Combined HowTo and FAQPage schemas into a single `JSON.stringify([howToSchema, faqSchema])` for one `<script type="application/ld+json">` block — valid per schema.org spec, avoids double nonce attributes
- FAQ items rendered visibly in body as `<dl>`/`<dt>`/`<dd>` on use-case pages (unlike VS pages where FAQ is JSON-LD only) — plan specification; use-case pages benefit from visible Q&A
- Hub card grid uses CSS `auto-fill minmax(18rem, 1fr)` inline style — consistent with SSR inline CSS pattern from Plan 01

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The quote-strategy lesson from Plan 01 (use double-quoted strings for content containing apostrophes) was applied proactively throughout use-case-pages.ts, preventing any ESLint `no-useless-escape` issues.

## User Setup Required

None — no external service configuration required. useRouter is now part of seoRouter but seoRouter is not yet mounted into app.ts (that happens in Plan 03).

## Next Phase Readiness

- `useRouter` exported from `server/src/routes/seo/use.ts` — integrated into seoRouter
- `seoRouter` exported from `server/src/routes/seo/index.ts` — ready for Plan 03 to import and mount before the SPA catch-all in `app.ts`
- Plan 03 mounts seoRouter and adds `/vs/`, `/alternatives/`, and `/use/` to any NOINDEX exclusion exemptions (these SSR pages should be indexed)
- TypeScript compiles clean with no errors

## Self-Check: PASSED

All files verified to exist on disk:
- FOUND: server/src/routes/seo/templates/use-case-pages.ts
- FOUND: server/src/routes/seo/use.ts
- FOUND: server/src/routes/seo/index.ts

All commits verified:
- FOUND: 6d9d2d2 (feat: use-case page data map)
- FOUND: c3ed3e9 (feat: useRouter + seoRouter /use mount)

---
*Phase: 35-seo-content-pages-express-ssr*
*Completed: 2026-02-26*
