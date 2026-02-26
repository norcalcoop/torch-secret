---
phase: 35-seo-content-pages-express-ssr
plan: 01
subsystem: api
tags: [express, ssr, seo, typescript, csp, html-templates]

# Dependency graph
requires:
  - phase: 31-product-launch-brand
    provides: design tokens (--ds-color-* CSS custom properties) used in SSR style block
  - phase: 33-pricing
    provides: nav link targets (/pricing) referenced in renderNav()
provides:
  - server/src/routes/seo/ — full SSR route infrastructure (layout + data + routers)
  - renderLayout() shared HTML shell with CSP-nonce support and CSS-only dark mode
  - VS_PAGES data map for /vs/:competitor (onetimesecret, pwpush, privnote)
  - ALTERNATIVES_PAGES data map for /alternatives/:competitor (onetimesecret, pwpush, privnote)
  - vsRouter and alternativesRouter ready for Plan 03 to mount into app.ts
affects:
  - 35-02 (use-case pages extend seoRouter)
  - 35-03 (mounts seoRouter into app.ts, adds /vs/* and /alternatives/* to NOINDEX exclusion)
  - 35-04 (UAT verifies SSR content is in HTTP response)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSR template pattern via TypeScript string template helpers (H1/H2/P/LI/STRONG/HR constants)
    - getBuiltCssHref() reads CSS hash from client/dist/index.html at module load time
    - FAQPage JSON-LD injected into <head> via renderLayout(jsonLd:) — not in body
    - CSS-only dark mode via @media (prefers-color-scheme: dark) overriding :root custom properties
    - All inline resources (link, style, script[type=ld+json]) carry CSP nonce from res.locals.cspNonce

key-files:
  created:
    - server/src/routes/seo/templates/layout.ts
    - server/src/routes/seo/templates/vs-pages.ts
    - server/src/routes/seo/templates/alternatives-pages.ts
    - server/src/routes/seo/vs.ts
    - server/src/routes/seo/alternatives.ts
    - server/src/routes/seo/index.ts
  modified: []

key-decisions:
  - "SSR template approach: TypeScript string helpers (P/H1/H2/etc.) rather than EJS or Handlebars — zero new dependencies, same ESM module system, easier CSP nonce threading"
  - "CSS custom properties in inline <style> block (not Tailwind utility classes) — SSR pages can't use Tailwind JIT since we serve pre-compiled CSS; custom props give full design token support without build-time dependency"
  - "Dark mode via @media (prefers-color-scheme: dark) on :root — SPA uses .dark class toggle; SSR pages use CSS-only media query because there is no JS toggle available before first paint"
  - "FAQPage JSON-LD in <head> only — not rendered as visible body content. Plan explicitly says no FAQ block in visible HTML of VS pages."
  - "404 returns JSON {error: 'not_found'} not HTML — consistent with API error format"

patterns-established:
  - "SSR layout pattern: renderLayout(opts) builds full HTML document from LayoutOptions; all per-request state (nonce, body, meta) passed as argument"
  - "CSS hash isolation: getBuiltCssHref() reads from client/dist/index.html at module load — never hardcoded, graceful fallback to '' in dev"
  - "Nonce threading: cspNonce flows from res.locals through renderLayout opts to every inline resource — link nonce, style nonce, script[ld+json] nonce all populated"

requirements-completed: [SEO-01, SEO-02, SEO-05]

# Metrics
duration: 19min
completed: 2026-02-26
---

# Phase 35 Plan 01: SEO Content Pages SSR Infrastructure Summary

**Express SSR infrastructure for 6 competitor pages: shared layout template with CSS-only dark mode and CSP nonce threading, VS_PAGES and ALTERNATIVES_PAGES data maps, vsRouter and alternativesRouter each returning 200 SSR HTML or 404 for unknown slugs, FAQPage JSON-LD in head**

## Performance

- **Duration:** ~19 min
- **Started:** 2026-02-26T12:33:27Z
- **Completed:** 2026-02-26T12:52:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created shared `renderLayout()` template that handles CSS hash parsing, dark mode media query, nonce attributes on all inline resources (link/style/script), and shared nav + footer
- Built VS_PAGES data map with full competitor copy for onetimesecret, pwpush, privnote — feature comparison tables, section prose, CTAs, and FAQPage JSON-LD items
- Built ALTERNATIVES_PAGES data map with alternatives narrative copy for all 3 competitors — persuasive prose, recommendation tables, and FAQPage JSON-LD items
- vsRouter and alternativesRouter handle GET /:competitor with 200 SSR HTML or 404 JSON for unknown slugs
- seoRouter exports /vs and /alternatives mounts — ready for Plan 03 to wire into app.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared SSR layout template** - `20f8441` (feat)
2. **Task 2: VS pages + Alternatives pages + routers + seoRouter index** - `e1a4605` (feat)

## Files Created/Modified

- `server/src/routes/seo/templates/layout.ts` - renderLayout(), escHtml(), getBuiltCssHref(), LayoutOptions interface, renderNav(), renderFooter()
- `server/src/routes/seo/templates/vs-pages.ts` - VS_PAGES Record with onetimesecret/pwpush/privnote full copy + faqItems
- `server/src/routes/seo/templates/alternatives-pages.ts` - ALTERNATIVES_PAGES Record with onetimesecret/pwpush/privnote full copy + faqItems
- `server/src/routes/seo/vs.ts` - vsRouter with GET /:competitor handler
- `server/src/routes/seo/alternatives.ts` - alternativesRouter with GET /:competitor handler
- `server/src/routes/seo/index.ts` - seoRouter mounting /vs and /alternatives

## Decisions Made

- String template helpers (P/H1/H2/etc.) instead of EJS/Handlebars — zero new dependencies, nonce threading is straightforward, same ESM module system
- CSS custom properties in inline `<style>` block instead of Tailwind utility classes — the compiled Tailwind CSS is linked via `<link>` but custom props give full design token coverage without needing JIT in SSR context
- Dark mode via `@media (prefers-color-scheme: dark)` on `:root` — SPA uses `.dark` class toggle; SSR pages use CSS-only approach since there's no JS toggle available before first paint
- FAQPage JSON-LD goes into `<head>` only, not rendered as visible body HTML on VS pages — plan specification
- 404 returns JSON `{error: 'not_found'}` — consistent with API error format used throughout the codebase

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `no-useless-escape` lint errors in template string content**
- **Found during:** Task 2 (VS pages + Alternatives pages)
- **Issue:** Initial draft used `\'` escape sequences inside template literals and single-quoted strings. ESLint `no-useless-escape` rule correctly flagged these as unnecessary. Some single-quoted strings with content containing apostrophes (`'It's`, `'can't'`) became broken strings when escapes were removed.
- **Fix:** Rewrote both data files using deliberate quote strategy: single-quoted strings for apostrophe-free content, double-quoted strings for content containing apostrophes (like `"Here's what..."`, `"Torch Secret's servers..."`), and template literals for strings with mixed content including template expressions.
- **Files modified:** `server/src/routes/seo/templates/vs-pages.ts`, `server/src/routes/seo/templates/alternatives-pages.ts`
- **Verification:** `npx eslint` returns no errors; `npx tsc --noEmit` returns no errors; husky pre-commit hook passes.
- **Committed in:** `e1a4605` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - lint/parsing bug)
**Impact on plan:** Required rewriting both data files to use correct string quoting. Content is functionally identical to source `.md` files. No scope creep.

## Issues Encountered

- ESLint `no-useless-escape` does not have an auto-fix rule — the `--fix` flag does not resolve it. Required manual rewrite of string quoting throughout the data files. Total resolution time: ~8 min.

## User Setup Required

None — no external service configuration required. seoRouter is created but not yet mounted into app.ts (that happens in Plan 03).

## Next Phase Readiness

- `seoRouter` exported from `server/src/routes/seo/index.ts` — ready for Plan 03 to import and mount before the SPA catch-all in `app.ts`
- Plan 02 adds `/use/*` use-case pages to `seoRouter` (currently commented as "added in Plan 02")
- Plan 03 mounts seoRouter and adds `/vs/` + `/alternatives/` to NOINDEX_PREFIXES exemption (these SSR pages should be indexed, unlike secret/ and auth/ routes)
- TypeScript compiles clean with no errors (`npx tsc --noEmit -p server/tsconfig.json` exits 0)

## Self-Check: PASSED

All files verified to exist on disk:
- FOUND: server/src/routes/seo/templates/layout.ts
- FOUND: server/src/routes/seo/templates/vs-pages.ts
- FOUND: server/src/routes/seo/templates/alternatives-pages.ts
- FOUND: server/src/routes/seo/vs.ts
- FOUND: server/src/routes/seo/alternatives.ts
- FOUND: server/src/routes/seo/index.ts

All commits verified:
- FOUND: 20f8441 (feat: layout.ts)
- FOUND: e1a4605 (feat: VS pages + alternatives + routers + index)

---
*Phase: 35-seo-content-pages-express-ssr*
*Completed: 2026-02-26*
