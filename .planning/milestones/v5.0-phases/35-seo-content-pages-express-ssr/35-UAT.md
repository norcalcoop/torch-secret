---
status: complete
phase: 35-seo-content-pages-express-ssr
source: 35-01-SUMMARY.md, 35-02-SUMMARY.md, 35-03-SUMMARY.md, 35-04-SUMMARY.md
started: 2026-02-26T15:00:00Z
updated: 2026-02-26T16:56:05Z
---

## Current Test

[testing complete]

## Tests

### 1. VS Competitor Pages — SSR Content
expected: Visit /vs/onetimesecret (or /vs/pwpush or /vs/privnote) in the browser. The page loads with visible content: a styled H1 heading with the competitor name, a feature comparison section, and a CTA. Content is present on initial page load (no JavaScript required to see it — it's server-rendered HTML).
result: pass

### 2. Alternatives Pages — SSR Content
expected: Visit /alternatives/onetimesecret (or /alternatives/pwpush or /alternatives/privnote). Page loads with visible H1 and persuasive prose content about why Torch Secret is a better alternative. Server-rendered — content visible immediately without JS.
result: pass

### 3. Use-Case Hub Page
expected: Visit /use/ in the browser. Page shows an H1 heading and a card grid with 8 use-case cards. Each card links to a specific use-case URL (e.g. /use/share-api-keys, /use/send-passwords, etc.).
result: pass

### 4. Individual Use-Case Page — Content + FAQ
expected: Click a use-case card from the hub (e.g. /use/share-api-keys). Page loads with an H1, substantive body content, and a visible FAQ section rendered as a definition list (questions and answers visible in the page body).
result: pass

### 5. Visual Design — Dark Theme, Nav, Styling
expected: All SSR pages (/vs/*, /alternatives/*, /use/*) are visually styled — not plain HTML. Pages show a navigation bar, dark background (matches site theme), styled headings and prose, and a footer. No unstyled/broken layout.
result: pass

### 6. Mobile Responsiveness
expected: Resize browser to mobile width (~375px) on any SSR page. Content reflows — no horizontal scroll, no text overflow. Navigation adapts for mobile. A bottom tab bar is present on mobile view.
result: pass

### 7. Pro Pricing — $7/month
expected: On any SSR page that mentions Pro pricing (e.g. a VS or alternatives page), the price shown is $7/month — not $9/month.
result: pass

### 8. Sitemap.xml — 17 URLs
expected: Visit /sitemap.xml. File contains 17 <url> entries: the root URL, /pricing, 3 VS pages, 3 alternatives pages, 1 use-case hub, and 8 individual use-case slugs.
result: pass

### 9. SEO Pages Are Indexable — No noindex
expected: Open browser DevTools → Network tab. Load any SEO page (/vs/*, /alternatives/*, /use/*). Check response headers. There should be NO X-Robots-Tag: noindex header on these pages. (Secret and auth pages do have noindex; SEO pages must not.)
result: pass

### 10. Unknown Slug Returns 404 JSON
expected: Visit /vs/unknowncompetitor or /use/nonexistent-slug in the browser (or curl it). The response should be a 404 with JSON body {"error":"not_found"} — not an HTML page or a crash.
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
