# Phase 10: SEO Static Assets - Research

**Researched:** 2026-02-15
**Domain:** SEO infrastructure (favicon, robots.txt, sitemap.xml, web manifest, noscript fallback)
**Confidence:** HIGH

## Summary

Phase 10 delivers five independent static SEO artifacts: an adaptive SVG favicon with ICO and Apple Touch Icon fallbacks, a robots.txt file, a sitemap.xml file, a web manifest, and noscript fallback content. All artifacts are static files that require no runtime dependencies or new npm packages.

The project already has a Vite configuration with `root: 'client'`, which means the public directory is `client/public/`. Files placed there are served at `/` during development and copied as-is to `client/dist/` during production builds. The Express app already serves `client/dist/` with `express.static()` in production, so all static files placed in `client/public/` will be available at their root paths (`/robots.txt`, `/sitemap.xml`, etc.) in both dev and prod environments -- no Express route changes are needed.

**Primary recommendation:** Place all static SEO files in `client/public/`. Pre-generate the favicon.ico and apple-touch-icon.png rather than using a build script (no new dependencies). Hand-author the SVG favicon using the Lucide Shield path data already available in the project. Add noscript content directly in `client/index.html`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Favicon design: Shield icon concept, pure iconographic (no text or "S" element), must work at 16x16, 32x32, and 180x180 sizes
- Crawl policy: robots.txt disallows /api/ AND /secret/* paths, includes Sitemap directive, sitemap lists homepage URL only
- Production domain: Use placeholder (https://secureshare.example.com) until finalized
- Manifest theme/background colors: Use existing design system dark palette tokens
- Favicon color: Based on existing design system tokens (Claude's discretion)

### Claude's Discretion
- Favicon color scheme and adaptive dark mode approach
- Favicon fallback generation method (build script vs. pre-generated)
- Shield style (filled vs. outlined)
- Noscript content depth, styling, and JS notice approach
- Manifest name, short_name, display mode, and description text
- Whether to serve files from public/ directory or Express routes

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Vite publicDir | 7.x (installed) | Serve static files at root path | Already configured; files in `client/public/` auto-serve at `/` in dev and copy to `dist/` in build |
| Express static | 5.x (installed) | Serve built static files in production | Already configured in `server/src/app.ts` -- `express.static(clientDistPath)` |

### Supporting
No new dependencies needed. All artifacts are hand-authored static files (SVG, XML, JSON, HTML).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Static files in public/ | Express routes for robots.txt/sitemap.xml | Unnecessary complexity; static files work identically in dev and prod with zero code changes |
| Pre-generated favicon.ico | Build-time generation via sharp-ico or favicons npm package | Adds dev dependency for a one-time operation; a pre-generated 32x32 ICO is simpler and smaller |
| SVG favicon from scratch | Export from Lucide's shield icon | Lucide's Shield path is available but its 24x24 viewBox with stroke-based design is optimized for inline icons, not favicons; a custom SVG with fill-based design works better at small sizes |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### File Placement
```
client/
├── index.html              # Add favicon <link> tags + <noscript> content
├── public/
│   ├── favicon.svg          # Adaptive SVG with prefers-color-scheme
│   ├── favicon.ico          # 32x32 ICO fallback (pre-generated)
│   ├── apple-touch-icon.png # 180x180 PNG for iOS (pre-generated)
│   ├── robots.txt           # Crawl directives
│   ├── sitemap.xml          # Homepage-only sitemap
│   └── site.webmanifest     # Web app manifest
```

### Pattern 1: Vite Public Directory for SEO Files
**What:** All SEO static files go in `client/public/` and are served at root path without processing.
**When to use:** Always for files that need stable, unhashed URLs (robots.txt, favicon.ico, sitemap.xml, manifests).
**Why it works here:** Vite config has `root: 'client'`, so `publicDir` defaults to `client/public/`. Files are served at `/` in dev via Vite's dev server, and copied as-is to `client/dist/` for production where Express's `express.static(clientDistPath, { index: false })` serves them. The SPA catch-all (`{*path}`) only fires for requests not matched by `express.static()`, so static files take priority automatically.

### Pattern 2: Adaptive SVG Favicon with CSS Media Queries
**What:** Embed `@media (prefers-color-scheme: dark)` inside the SVG `<style>` element to swap fill colors.
**When to use:** When you want a single SVG file that adapts to the user's system theme.
**Example:**
```xml
<!-- Source: https://web.dev/building-an-adaptive-favicon/ -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .shield { fill: #2563eb; }
    @media (prefers-color-scheme: dark) {
      .shield { fill: #60a5fa; }
    }
  </style>
  <path class="shield" d="..." />
</svg>
```

### Pattern 3: Modern Favicon HTML Tags (Evil Martians Three-File Approach)
**What:** Three link tags in HTML head covering all browsers.
**When to use:** Standard for all modern web projects.
**Example:**
```html
<!-- Source: https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```
The `sizes="32x32"` on the ICO link is needed to work around a Chrome bug where it prefers ICO over SVG without this hint.

### Anti-Patterns to Avoid
- **Multiple PNG favicon sizes in HTML:** Outdated practice. SVG + ICO + apple-touch-icon covers all browsers. Don't generate 16x16, 32x32, 48x48, 64x64 PNGs.
- **Serving robots.txt/sitemap.xml via Express routes:** Adds unnecessary code when Vite's publicDir handles it automatically in both dev and prod.
- **Inline SVG for favicon:** Must be a file reference, not inline. Browsers fetch favicons by URL.
- **Forgetting `sizes="32x32"` on ICO link:** Chrome will ignore the SVG and use the blurry ICO without this attribute.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| SVG favicon design | Complex multi-path shield artwork | Simple filled shield path inspired by Lucide's Shield geometry | Favicons render at 16x16; complex designs become unreadable mud |
| ICO file format | Custom ICO encoder | Pre-generate using an online converter or sharp-ico one-time script | ICO is a binary container format with specific header structures; not worth implementing |
| Sitemap XML | Dynamic sitemap generator | Hand-authored 8-line XML file | Only one URL (homepage); dynamic generation is overkill |
| robots.txt | Express middleware (express-robots-txt) | Static text file in public/ | 5 lines of text; a middleware for this is over-engineering |

**Key insight:** This phase is entirely about static files. Every artifact is a small, hand-authored file. There is no runtime logic, no database interaction, and no new dependencies. The complexity is in getting the specifications right, not in the code.

## Common Pitfalls

### Pitfall 1: Chrome Favicon Preference Bug
**What goes wrong:** Chrome selects the ICO file over the SVG favicon, losing dark mode adaptation.
**Why it happens:** Chrome's favicon resolution algorithm prefers ICO format unless the ICO link tag includes a `sizes` attribute.
**How to avoid:** Always include `sizes="32x32"` on the `<link rel="icon" href="/favicon.ico">` tag. This signals Chrome that the ICO is only 32x32, making the scalable SVG the preferred choice.
**Warning signs:** Favicon appears correct in Firefox but not in Chrome; dark mode changes don't reflect in Chrome's tab.

### Pitfall 2: SVG Favicon Dark Mode Not Working in Some Browsers
**What goes wrong:** The favicon doesn't adapt to dark mode in certain browsers.
**Why it happens:** SVG favicons with embedded CSS media queries are supported in Chromium and Firefox, but Safari may not support `prefers-color-scheme` in SVG favicons. The ICO fallback won't adapt either.
**How to avoid:** Accept this as a progressive enhancement. The SVG with media queries works in Chromium + Firefox (~75%+ of users). Safari and older browsers get the static ICO/PNG fallback. Don't try to solve this with JavaScript favicon-swapping hacks.
**Warning signs:** Testing only in Chrome and assuming universal support.

### Pitfall 3: SPA Catch-All Intercepting Static Files
**What goes wrong:** Requests for `/robots.txt` or `/sitemap.xml` return the SPA's `index.html` instead of the actual file.
**Why it happens:** If the SPA catch-all route is registered before or in place of static file serving.
**How to avoid:** In this project, `express.static()` is already registered BEFORE the SPA catch-all in `app.ts` (line 63 vs line 73). Files in `client/dist/` (which includes everything from `client/public/`) will be served by `express.static()` before the catch-all fires. No changes to `app.ts` are needed.
**Warning signs:** `curl http://localhost:3000/robots.txt` returns HTML instead of plain text.

### Pitfall 4: Manifest Icons Referencing Non-Existent Files
**What goes wrong:** Browser console shows 404 errors for manifest icon paths.
**Why it happens:** The manifest references icon files that don't exist or are at wrong paths.
**How to avoid:** Only reference icons that actually exist in `client/public/`. For a non-PWA web app, referencing the favicon.svg and apple-touch-icon.png (which already exist for the favicon) is sufficient. Don't promise 192x192 or 512x512 icons in the manifest unless you create them.
**Warning signs:** DevTools Application tab shows icon loading failures.

### Pitfall 5: Noscript Content Inside `<head>`
**What goes wrong:** Noscript block in `<head>` can only contain `<link>`, `<style>`, and `<meta>` elements. Visible text content placed there is invalid HTML.
**Why it happens:** Different HTML parsing rules for `<noscript>` in `<head>` vs `<body>`.
**How to avoid:** Place the `<noscript>` block inside `<body>`, specifically inside or adjacent to the `#app` container. The current `index.html` has `<div id="app">` inside `<main id="main-content">`, so the noscript content should go inside `#app` (JS will clear/replace it on load).
**Warning signs:** HTML validator errors; noscript content not visible when JS is disabled.

### Pitfall 6: Sitemap URL Without Protocol
**What goes wrong:** Search engines reject the sitemap or treat URLs as relative.
**Why it happens:** Using relative URLs in sitemap.xml `<loc>` tags.
**How to avoid:** Always use fully qualified absolute URLs with protocol in `<loc>` tags. The sitemaps.org spec requires this. Use the placeholder `https://secureshare.example.com/` for now.
**Warning signs:** Google Search Console reports sitemap errors.

## Code Examples

Verified patterns from official sources:

### robots.txt
```text
# Source: RFC 9309, Google robots.txt spec
User-agent: *
Allow: /
Disallow: /api/
Disallow: /secret/

Sitemap: https://secureshare.example.com/sitemap.xml
```

### sitemap.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- Source: https://www.sitemaps.org/protocol.html -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://secureshare.example.com/</loc>
  </url>
</urlset>
```

### site.webmanifest
```json
{
  "name": "SecureShare",
  "short_name": "SecureShare",
  "description": "Share secrets securely with zero-knowledge, one-time encrypted links",
  "start_url": "/",
  "display": "browser",
  "background_color": "#1a1625",
  "theme_color": "#1a1625",
  "icons": [
    {
      "src": "/favicon.svg",
      "type": "image/svg+xml",
      "sizes": "any"
    },
    {
      "src": "/apple-touch-icon.png",
      "type": "image/png",
      "sizes": "180x180"
    }
  ]
}
```

**Display mode rationale:** `"browser"` is correct here, not `"standalone"`. SecureShare is a web tool, not a PWA. Users share URLs and use browser navigation. `standalone` would hide the URL bar, which is counterproductive for a link-sharing app. The manifest is for SEO metadata (search engines read it), not for PWA installation.

**Color values:** The background/theme colors should map to the design system's `--ds-color-bg` token. The OKLCH value `oklch(0.23 0.038 283)` converts to approximately `#1a1625` in hex (deep navy-black from the existing dark palette).

### Adaptive SVG Favicon
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .shield { fill: #4d8bf5; }
    @media (prefers-color-scheme: dark) {
      .shield { fill: #7fb3ff; }
    }
  </style>
  <!-- Shield path scaled to 32x32 viewBox -->
  <path class="shield" d="..." />
</svg>
```

**Color rationale:** Use the accent color from the design system (`--ds-color-accent: oklch(0.71 0.143 255)`, which is an electric blue) for the shield. In light mode, use a slightly darker variant for contrast on white tab backgrounds. In dark mode, use a lighter variant for visibility on dark tab backgrounds. The exact hex values need to be derived from the OKLCH accent color -- approximate conversions: light mode fill ~`#4d8bf5`, dark mode fill ~`#7fb3ff`.

### Favicon HTML Link Tags
```html
<!-- Source: Evil Martians three-file approach -->
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```

### Noscript Fallback Content
```html
<!-- Inside <div id="app"> in index.html -->
<noscript>
  <div style="max-width: 36rem; margin: 2rem auto; padding: 1rem; font-family: system-ui, sans-serif; color: #e8e4f0;">
    <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">SecureShare</h1>
    <p style="margin-bottom: 0.75rem;">
      Share secrets securely with zero-knowledge, one-time encrypted links.
      Your secret is encrypted in your browser before it ever reaches our server.
    </p>
    <p style="margin-bottom: 0.75rem;">
      <strong>How it works:</strong> Paste your secret, get an encrypted link, share it.
      The recipient views it once, then it's permanently destroyed.
    </p>
    <p style="color: #a89ec4;">
      JavaScript is required to use SecureShare. Encryption and decryption
      happen entirely in your browser using the Web Crypto API.
    </p>
  </div>
</noscript>
```

**Noscript styling rationale:** Use inline styles (not Tailwind classes) because Tailwind CSS is loaded via JavaScript (Vite). When JS is disabled, Tailwind classes have no effect. Inline styles ensure the noscript content is readable on the dark background. Colors are chosen to match the dark theme approximately.

### Lucide Shield Path Data (Available in Project)
```
// From lucide npm package (already installed)
Shield path: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
// ViewBox: 0 0 24 24 (Lucide standard)
```
This path can be adapted for the favicon SVG by scaling it to a 32x32 viewBox. The Lucide Shield is stroke-based at 24x24, so for a favicon, convert to a filled shape and rescale. Alternatively, design a custom filled shield optimized for small sizes.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| 20+ PNG favicons at every size | SVG + ICO + apple-touch-icon (3 files) | ~2023 (Evil Martians updated guide) | Drastically simpler favicon setup |
| `<link rel="shortcut icon">` | `<link rel="icon">` | Years ago | `shortcut` is non-standard and unnecessary |
| manifest.json | site.webmanifest | W3C spec recommendation | `.webmanifest` is the spec-recommended extension |
| Multiple apple-touch-icon sizes | Single 180x180 apple-touch-icon.png | iOS device convergence | iOS scales down from 180x180; no need for 152, 120, 76 variants |
| robots.txt via middleware | Static file in public/ | Always (for static directives) | Middleware only needed for dynamic robots.txt based on environment |

**Deprecated/outdated:**
- `<link rel="shortcut icon">`: Drop `shortcut`, use `rel="icon"` only
- Multiple apple-touch-icon sizes: Only 180x180 is needed
- `manifest.json` filename: Use `site.webmanifest` per W3C spec
- `changefreq` and `priority` in sitemap.xml: Google ignores these; only `loc` and optionally `lastmod` matter

## Discretion Recommendations

### Favicon Fallback Generation: Pre-generated (Recommended)
**Recommendation:** Pre-generate `favicon.ico` (32x32) and `apple-touch-icon.png` (180x180) files and commit them to the repo, rather than adding a build-time generation script.

**Rationale:**
- These are one-time artifacts that change only when the brand identity changes
- Adding sharp-ico or favicons as devDependencies for a single use is over-engineering
- Pre-generated files are simpler to verify (just open them) and don't depend on native compilation (sharp requires node-gyp)
- A build script that runs on every `npm install` or `npm run build` adds CI time for no recurring benefit

**Practical approach:** Create the SVG first, then use a one-time conversion (an online tool like favicon.io, or a one-off Node script that runs once and outputs the files to commit).

### Shield Style: Filled (Recommended)
**Recommendation:** Use a filled/solid shield shape rather than an outlined stroke-based shield.

**Rationale:**
- At 16x16 pixels, stroke-based icons lose definition and appear as blurry outlines
- A solid filled shield reads clearly at all favicon sizes
- The Lucide Shield path is designed as a stroke icon at 24px; for favicon use, filling the interior creates a bolder, more recognizable silhouette

### Manifest Display Mode: "browser" (Recommended)
**Recommendation:** Use `"display": "browser"` rather than `"standalone"`.

**Rationale:**
- SecureShare is a URL-sharing tool; hiding the browser URL bar (standalone) would confuse users who need to see/copy the current URL
- The app is not a PWA and should not prompt installation
- `"browser"` is honest about the app's nature as a web page
- The manifest exists for SEO metadata (Google reads it for structured data), not for PWA functionality

### Noscript Content: Moderate Depth with JS Notice (Recommended)
**Recommendation:** Include a brief app description, how-it-works summary (2-3 sentences), and a note that JavaScript is required for encryption functionality.

**Rationale:**
- Provides SEO value: crawlers that don't execute JS still get meaningful content about the app
- The how-it-works summary explains the value proposition without requiring JS rendering
- The JavaScript notice is honest and helpful for the rare user with JS disabled
- Keep it short to minimize maintenance burden -- if the app description changes, this also needs updating
- Use inline styles (not Tailwind) since CSS is loaded via JS/Vite

### Favicon Color: Accent Blue (Recommended)
**Recommendation:** Use the accent color from the design system (`--ds-color-accent: oklch(0.71 0.143 255)`) for the shield fill.

**Rationale:**
- Blue shield is universally associated with security/protection
- Matches the app's accent color for brand consistency
- High contrast on both light and dark tab bar backgrounds
- For the SVG dark mode variant, use a lighter blue for visibility on dark backgrounds

## Open Questions

1. **Exact hex conversion of OKLCH accent colors**
   - What we know: `--ds-color-accent: oklch(0.71 0.143 255)` is the design token
   - What's unclear: The precise sRGB hex equivalent for embedding in SVG (which doesn't support OKLCH)
   - Recommendation: Convert during implementation using a CSS color tool or browser DevTools computed styles. Approximate values: `#4d8bf5` (light mode) and a lighter variant for dark mode.

2. **Favicon.ico and apple-touch-icon.png generation method**
   - What we know: Files need to be pre-generated and committed
   - What's unclear: Whether to use an online tool, a one-time script, or programmatic generation
   - Recommendation: Write a simple one-time Node.js script using sharp (already available in the ecosystem) or use favicon.io online tool. The script runs once, outputs the files, and is deleted or moved to a `scripts/` directory.

## Sources

### Primary (HIGH confidence)
- Vite documentation: Static Asset Handling -- publicDir defaults to `<root>/public`, files served at `/` during dev and copied to dist/ on build (https://vite.dev/guide/assets, https://vite.dev/config/shared-options)
- Sitemaps.org protocol specification -- XML structure, required `<urlset>` namespace, `<loc>` tag requirements (https://www.sitemaps.org/protocol.html)
- RFC 9309: Robots Exclusion Protocol -- formal specification for robots.txt (https://www.rfc-editor.org/rfc/rfc9309.html)
- W3C Web App Manifest spec -- display modes, icon requirements, field definitions (https://www.w3.org/TR/appmanifest/)
- MDN Web Docs: Web App Manifest reference (https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- Lucide Shield icon path data -- verified from installed `lucide` npm package

### Secondary (MEDIUM confidence)
- Evil Martians "How to Favicon" guide (updated 2026) -- three-file approach, Chrome ICO/SVG bug workaround (https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs)
- web.dev: Building an Adaptive Favicon -- `prefers-color-scheme` in SVG `<style>` element (https://web.dev/building-an-adaptive-favicon/)
- web.dev: Add a Web App Manifest -- field guidance, icon size requirements (https://web.dev/articles/add-manifest)
- Google robots.txt spec interpretation (https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)

### Tertiary (LOW confidence)
- Exact OKLCH to hex color conversions -- approximate values provided, verify during implementation
- Safari SVG favicon media query support -- reported as limited but not independently verified against current Safari version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Vite publicDir and Express static serving are well-documented and already configured in the project
- Architecture: HIGH -- file placement in `client/public/` is standard Vite pattern; no code changes to server needed
- Pitfalls: HIGH -- Chrome ICO bug, noscript placement rules, and SPA catch-all ordering are well-documented issues
- Favicon design: MEDIUM -- SVG dark mode approach is well-documented but exact color values need runtime conversion from OKLCH
- Noscript content: MEDIUM -- content strategy is a recommendation; exact wording is discretionary

**Research date:** 2026-02-15
**Valid until:** 2026-06-15 (stable domain; favicon/SEO standards change slowly)
