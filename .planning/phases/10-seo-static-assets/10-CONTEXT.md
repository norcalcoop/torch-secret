# Phase 10: SEO Static Assets - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Search engines and social platforms can discover, index, and display SecureShare correctly. Deliver all static SEO infrastructure: favicon, robots.txt, sitemap.xml, web manifest, and noscript fallback. No dynamic meta tags or route-specific SEO (that's Phase 14).

</domain>

<decisions>
## Implementation Decisions

### Favicon design
- Shield icon concept — pure iconographic, no text or "S" element
- Color approach: Claude's discretion based on existing design system tokens
- Fallback generation (.ico, apple-touch-icon.png): Claude's discretion on method
- Must work at 16x16, 32x32, and 180x180 sizes

### Noscript fallback content
- Content scope: Claude's discretion (balance SEO value vs. maintenance)
- Whether to include how-it-works summary: Claude's discretion
- Styling approach: Claude's discretion (styled vs. plain HTML)
- JavaScript required notice: Claude's discretion on whether/how to communicate

### App identity (web manifest)
- App name: Claude's discretion based on manifest best practices
- Short name: Claude's discretion (SecureShare fits at 11 chars)
- Display mode: Claude's discretion based on app use case
- Description: Claude writes based on zero-knowledge, one-time secret sharing positioning
- Theme/background colors: Use existing design system dark palette tokens

### Crawl policy
- robots.txt disallows: /api/ AND /secret/* paths
- robots.txt includes Sitemap directive pointing to sitemap.xml
- Sitemap lists homepage URL only
- Production domain: Use placeholder (https://secureshare.example.com) — update when finalized
- Serving approach: Claude's discretion (static files vs. Express routes)

### Claude's Discretion
- Favicon color scheme and adaptive dark mode approach
- Favicon fallback generation method (build script vs. pre-generated)
- Shield style (filled vs. outlined)
- Noscript content depth, styling, and JS notice approach
- Manifest name, short_name, display mode, and description text
- Whether to serve files from public/ directory or Express routes

</decisions>

<specifics>
## Specific Ideas

- Favicon should be a shield — consistent with the app's security/protection identity
- Shield should be purely iconographic (no text) for maximum clarity at small sizes
- Placeholder domain for now; will need updating when production domain is decided

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-seo-static-assets*
*Context gathered: 2026-02-15*
