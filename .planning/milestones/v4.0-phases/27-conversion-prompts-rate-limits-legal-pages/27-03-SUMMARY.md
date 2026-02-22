---
phase: 27-conversion-prompts-rate-limits-legal-pages
plan: "03"
subsystem: ui
tags: [legal, privacy, terms, spa-routing, glassmorphism, accessibility, zero-knowledge]

# Dependency graph
requires:
  - phase: 27-conversion-prompts-rate-limits-legal-pages
    provides: Phase context, INVARIANTS.md schema, router pattern, layout.ts footer, register.ts form structure
  - phase: 22-better-auth
    provides: register.ts base page module, SPA router with updatePageMeta and noindex support
  - phase: 15-visual-design-glassmorphism
    provides: glassmorphism card pattern (bg-surface/80 backdrop-blur-md), OKLCH design tokens, text-text-primary/secondary/muted classes

provides:
  - Privacy Policy page at /privacy with full zero-knowledge model description (renderPrivacyPage)
  - Terms of Service page at /terms with acceptable use policy and law enforcement disclaimer (renderTermsPage)
  - SPA routes /privacy and /terms with noindex meta, dynamic import, focusPageHeading()
  - Footer legal links (Privacy Policy + Terms of Service) on every page via navigate() SPA navigation
  - Register page consent line: "By creating an account, you agree to our Terms of Service and Privacy Policy."
  - INVARIANTS.md Phase 27 enforcement row confirming legal pages contain no userId+secretId

affects:
  - Future phases modifying layout.ts footer
  - Future phases adding new pages to the SPA router (pattern reference)
  - v5.0 Pro tier (billing/legal pages may build on this pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legal page module pattern: renderXxxPage(container) using only createElement/textContent (no innerHTML), glassmorphism card wrapper, max-w-2xl prose layout"
    - "SPA footer legal links: anchor + e.preventDefault() + navigate(path) — same pattern as consent links in register.ts"
    - "consent line pattern: createTextNode + createElement anchors composed without innerHTML for XSS safety"

key-files:
  created:
    - client/src/pages/privacy.ts
    - client/src/pages/terms.ts
  modified:
    - client/src/router.ts
    - client/src/components/layout.ts
    - client/src/pages/register.ts
    - .planning/INVARIANTS.md

key-decisions:
  - "Legal page content uses [Company Name] and [Contact Email] placeholder tokens — production deployment will substitute real values"
  - "Footer legal links appended after the three trust-signal spans in the existing flex row — no layout restructuring needed"
  - "Consent line uses createTextNode + separate anchor elements (no innerHTML) — consistent with project XSS-safe DOM construction convention"
  - "Both /privacy and /terms use noindex: true — legal pages should not appear in search results, same as error/secret routes"

patterns-established:
  - "Legal page module: renderXxxPage(container): void — synchronous, no async, no innerHTML, glassmorphism card with max-w-2xl prose"
  - "SPA-safe anchor: a.href = path + e.preventDefault() + navigate(path) — used in footer and consent line"

requirements-completed:
  - LEGAL-01
  - LEGAL-02

# Metrics
duration: ~35min (including human UAT)
completed: 2026-02-21
---

# Phase 27 Plan 03: Legal Pages (Privacy + Terms) Summary

**Privacy Policy and Terms of Service SPA pages at /privacy and /terms with glassmorphism styling, real zero-knowledge content, footer links on every page, and register consent line**

## Performance

- **Duration:** ~35 min (including human UAT checkpoint)
- **Started:** 2026-02-21
- **Completed:** 2026-02-21
- **Tasks:** 3 (2 auto + 1 human UAT)
- **Files modified:** 6

## Accomplishments

- Created `client/src/pages/privacy.ts` (renderPrivacyPage) and `client/src/pages/terms.ts` (renderTermsPage) — both 120+ lines, full real content accurately describing the zero-knowledge model, built using only createElement/textContent, wrapped in glassmorphism cards
- Added /privacy and /terms routes to the SPA router with noindex meta, dynamic import code-splitting, and focusPageHeading() accessibility hook
- Updated `createFooter()` in layout.ts to append Privacy Policy and Terms of Service links with SPA navigate() handlers — renders on every page globally
- Added consent line to register.ts: "By creating an account, you agree to our Terms of Service and Privacy Policy." with SPA-navigating anchor links
- Updated INVARIANTS.md with Phase 27 enforcement row confirming legal pages and conversion prompts contain no userId+secretId combination

## Task Commits

Each task was committed atomically:

1. **Task 1: Privacy and Terms page modules + router routes** - `86a4d82` (feat)
2. **Task 2: Footer legal links + register consent + INVARIANTS.md update** - `a99b291` (feat)
3. **Task 3: Human UAT** - checkpoint approved (no commit)

## Files Created/Modified

- `client/src/pages/privacy.ts` - renderPrivacyPage(container): void — full Privacy Policy, 10 sections covering data collection, zero-knowledge model, third-party services, user rights
- `client/src/pages/terms.ts` - renderTermsPage(container): void — full Terms of Service, 12 sections covering acceptable use, law enforcement disclaimer, liability limitations
- `client/src/router.ts` - Added /privacy and /terms route branches with noindex: true, dynamic import, focusPageHeading()
- `client/src/components/layout.ts` - createFooter() appends Privacy Policy and Terms of Service anchor links with navigate() handlers
- `client/src/pages/register.ts` - Consent line below submit button with SPA-navigating Terms/Privacy links
- `.planning/INVARIANTS.md` - Phase 27 enforcement row added; last-updated line updated to Phase 27

## Decisions Made

- Legal page content uses `[Company Name]` and `[Contact Email]` placeholder tokens — real values to be substituted at production deployment, avoids hardcoding before domain is finalized
- Footer legal links appended after the three trust-signal spans in the existing `flex flex-wrap` row — minimal layout impact, no restructuring needed
- Consent line composed using `createTextNode` + separate anchor elements without `innerHTML` — consistent with project XSS-safe DOM construction convention established in Phase 22
- Both /privacy and /terms marked `noindex: true` in updatePageMeta — legal pages should not appear in search results (same treatment as error/secret routes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Root-level `tsconfig.json` was used for TypeScript verification (the plan referenced `client/tsconfig.json` which does not exist as a separate file in this project) — root tsconfig compiles clean, which is the correct check. No code changes needed.

## User Setup Required

None - no external service configuration required. Legal page placeholder tokens (`[Company Name]`, `[Contact Email]`, `[Jurisdiction]`) require substitution before production launch, but this is content editing, not code configuration.

## Next Phase Readiness

- LEGAL-01 (Privacy Policy page) and LEGAL-02 (Terms of Service page) requirements fulfilled
- Remaining Phase 27 requirements: CONV-04 (anonymous-to-account conversion prompt UI) and CONV-05 (conversion prompt analytics events) — Plan 02 work
- LEGAL-03 and LEGAL-04 (cookie banner, GDPR compliance) remain pending if in scope
- Footer legal navigation pattern established and ready for reuse

---
*Phase: 27-conversion-prompts-rate-limits-legal-pages*
*Completed: 2026-02-21*

## Self-Check: PASSED

- FOUND: .planning/phases/27-conversion-prompts-rate-limits-legal-pages/27-03-SUMMARY.md
- FOUND: commit 86a4d82 (feat(27-03): add /privacy and /terms pages with noindex routes)
- FOUND: commit a99b291 (feat(27-03): add footer legal links, register consent line, and INVARIANTS.md Phase 27 row)
- TypeScript: npx tsc --noEmit -p tsconfig.json — PASSED (clean)
- Accessibility tests: npx vitest run client/src/__tests__/accessibility.test.ts — PASSED (7/7)
- Requirements: LEGAL-01 and LEGAL-02 marked complete in REQUIREMENTS.md
