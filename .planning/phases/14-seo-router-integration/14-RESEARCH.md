# Phase 14: SEO Router Integration - Research

**Researched:** 2026-02-16
**Domain:** SPA SEO meta tags, Open Graph protocol, JSON-LD structured data, X-Robots-Tag headers
**Confidence:** HIGH

## Summary

Phase 14 delivers route-aware SEO for the SecureShare SPA. The work divides into two distinct domains: (1) client-side dynamic meta tag management via an expanded `updatePageMeta()` function, and (2) server-side `X-Robots-Tag` header injection in the Express SPA catch-all. No new npm packages are required. All changes are to existing files plus one new static OG image asset.

The existing `updatePageMeta()` in `router.ts` currently accepts a single `title: string` parameter. It must be refactored to accept a `PageMeta` object with `title`, `description`, `canonical`, and `noindex` fields. This is a breaking change that touches every call site (5 total: 3 in `router.ts` handleRoute, 1 in `confirmation.ts`, plus a new error page call pattern). The architecture research document (`.planning/research/ARCHITECTURE.md` lines 318-407) already contains a fully specified design for this refactor.

The server-side work is minimal: add a path check in the existing SPA catch-all (`server/src/app.ts` line 73) to set `X-Robots-Tag: noindex, nofollow` for requests matching `/secret/*`. This provides a defense-in-depth signal to crawlers that operates at the HTTP level, before any HTML parsing or JavaScript execution.

**Primary recommendation:** Implement in two plans: (1) `updatePageMeta()` refactor + all call site updates + OG/Twitter/JSON-LD tags in index.html, (2) server-side X-Robots-Tag header + OG tag management for secret routes. This separation keeps the client-only changes testable independently from the server changes.

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Vanilla DOM API | N/A | Dynamic meta tag creation/update via `document.createElement`, `document.querySelector` | No library needed for 5-6 meta tag updates per route change |
| Express 5.x (installed) | 5.x | X-Robots-Tag header injection in SPA catch-all | Already serves HTML responses; one `res.setHeader()` call |
| Vite publicDir (installed) | 7.x | Serve OG image as static file | Existing pattern from Phase 10 (favicon, robots.txt) |

### Supporting
No new packages needed. All work uses existing DOM APIs, Express APIs, and static files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| Manual DOM meta tag management | `unhead` or `@vueuse/head` | 10KB+ library for managing 6 meta tags on 4 routes; massive overkill |
| Inline JSON-LD in index.html | Dynamic JSON-LD injection via JS | Search engines read initial HTML for structured data; dynamic injection adds complexity with no benefit since only homepage needs it |
| Static OG tags in index.html | Per-route dynamic OG tags via JS | Social media crawlers (Facebook, Slack, Discord, X) do NOT execute JavaScript; they read the initial HTML. Dynamic OG only helps Google (which renders JS), but Google already crawls single-page apps. Static OG tags are the pragmatic choice. |

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### File Changes
```
client/
  index.html              # Add: meta description, OG tags, twitter card, JSON-LD, canonical
  public/
    og-image.png           # NEW: 1200x630 branded social sharing preview image
  src/
    router.ts              # MODIFY: updatePageMeta() refactored to PageMeta object
    pages/create.ts        # MODIFY: updatePageMeta call updated
    pages/reveal.ts        # MODIFY: updatePageMeta call site (inside router.ts, not page)
    pages/confirmation.ts  # MODIFY: updatePageMeta call updated
    pages/error.ts         # MODIFY: updatePageMeta call site (inside router.ts, not page)
server/
  src/
    app.ts                 # MODIFY: X-Robots-Tag header + dynamic OG swap in SPA catch-all
```

### Pattern 1: PageMeta Interface for Route-Specific SEO
**What:** Replace the `string` parameter in `updatePageMeta()` with a structured `PageMeta` object that manages title, description, canonical URL, robots directive, and OG tags per route change.
**When to use:** Every SPA route navigation (initial load, pushState, popstate).
**Source:** Architecture research (`.planning/research/ARCHITECTURE.md` lines 331-384)
**Example:**
```typescript
interface PageMeta {
  title: string;
  description: string;
  canonical?: string;   // defaults to window.location.origin + window.location.pathname
  noindex?: boolean;    // when true, adds <meta name="robots" content="noindex, nofollow">
}

export function updatePageMeta(meta: PageMeta): void {
  // 1. Document title (existing behavior)
  document.title = `${meta.title} - SecureShare`;

  // 2. Meta description (create or update)
  let descEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.name = 'description';
    document.head.appendChild(descEl);
  }
  descEl.content = meta.description;

  // 3. Canonical URL (create or update)
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.rel = 'canonical';
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.href = meta.canonical ?? `${window.location.origin}${window.location.pathname}`;

  // 4. Robots meta (create, update, or remove)
  let robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (meta.noindex) {
    if (!robotsEl) {
      robotsEl = document.createElement('meta');
      robotsEl.name = 'robots';
      document.head.appendChild(robotsEl);
    }
    robotsEl.content = 'noindex, nofollow';
  } else if (robotsEl) {
    robotsEl.remove();
  }

  // 5. OG tags -- update for noindex pages to be generic
  updateOgTags(meta.noindex ?? false);

  // 6. Aria-live announcer (existing behavior preserved)
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = meta.title;
    });
  }
}
```

### Pattern 2: Static OG Tags in index.html with Dynamic Override for Secret Routes
**What:** Place homepage-targeted OG/Twitter meta tags in `index.html` statically (for social media crawlers that don't execute JS), then dynamically swap them to generic/empty values when navigating to secret routes.
**When to use:** This is a two-layer approach -- static HTML for crawlers + dynamic JS for SPA navigation.
**Why:** Social media crawlers (Facebook, Slack, Discord, X) do NOT execute JavaScript. They parse the raw HTML. For the homepage (the only shareable page), static OG tags ensure rich previews. For secret routes, the server-side `X-Robots-Tag: noindex, nofollow` header prevents crawling, and the dynamic JS swap handles the edge case of Google's JS-rendering crawler.

**Static in index.html:**
```html
<meta name="description" content="Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.">
<meta property="og:title" content="SecureShare - Zero-Knowledge Secret Sharing">
<meta property="og:description" content="End-to-end encrypted. One-time view. No accounts.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://secureshare.example.com/">
<meta property="og:image" content="https://secureshare.example.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SecureShare - Zero-knowledge one-time secret sharing">
<meta property="og:site_name" content="SecureShare">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="SecureShare - Zero-Knowledge Secret Sharing">
<meta name="twitter:description" content="End-to-end encrypted. One-time view. No accounts.">
<link rel="canonical" href="https://secureshare.example.com/">
```

**Dynamic override for secret/error/noindex routes:**
```typescript
function updateOgTags(isNoindex: boolean): void {
  // For noindex pages, replace OG content with generic branding
  // This prevents any secret-specific metadata from leaking
  const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
  const ogDesc = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
  const ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
  const twTitle = document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement | null;
  const twDesc = document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement | null;

  if (isNoindex) {
    // Generic branding -- no indication a secret exists at this URL
    if (ogTitle) ogTitle.content = 'SecureShare';
    if (ogDesc) ogDesc.content = 'Zero-knowledge secret sharing';
    if (ogUrl) ogUrl.content = window.location.origin + '/';
    if (twTitle) twTitle.content = 'SecureShare';
    if (twDesc) twDesc.content = 'Zero-knowledge secret sharing';
  } else {
    // Restore homepage OG values
    if (ogTitle) ogTitle.content = 'SecureShare - Zero-Knowledge Secret Sharing';
    if (ogDesc) ogDesc.content = 'End-to-end encrypted. One-time view. No accounts.';
    if (ogUrl) ogUrl.content = window.location.origin + '/';
    if (twTitle) twTitle.content = 'SecureShare - Zero-Knowledge Secret Sharing';
    if (twDesc) twDesc.content = 'End-to-end encrypted. One-time view. No accounts.';
  }
}
```

### Pattern 3: X-Robots-Tag in Express SPA Catch-All
**What:** Add `X-Robots-Tag: noindex, nofollow` HTTP header to responses for `/secret/*` paths in the SPA catch-all.
**When to use:** Always for secret routes. This is the primary crawler defense since it works before HTML parsing.
**Source:** MDN X-Robots-Tag documentation, project PITFALLS.md
**Example:**
```typescript
// In server/src/app.ts, inside the SPA catch-all
app.get('{*path}', (req, res) => {
  const html = htmlTemplate.replaceAll(
    '__CSP_NONCE__',
    res.locals.cspNonce,
  );
  res.setHeader('Content-Type', 'text/html');

  // Defense-in-depth: HTTP-level noindex for secret routes
  if (req.path.startsWith('/secret/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  res.send(html);
});
```

### Pattern 4: JSON-LD Structured Data Block
**What:** Static `<script type="application/ld+json">` block in `index.html` with WebApplication schema.
**When to use:** Once, in the HTML template. Search engines read this from the initial HTML.
**Source:** schema.org WebApplication type, Google structured data docs
**Example:**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SecureShare",
  "url": "https://secureshare.example.com/",
  "description": "Zero-knowledge, one-time secret sharing. End-to-end encrypted in your browser.",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "All",
  "browserRequirements": "Requires JavaScript and Web Crypto API",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

**CSP consideration:** `<script type="application/ld+json">` blocks are NOT executed by the browser. They are data blocks, not scripts. The nonce-based CSP `script-src` directive does NOT apply to `type="application/ld+json"` tags. However, some strict CSP implementations may still flag them. To be safe, include the nonce on this script tag as well: `<script type="application/ld+json" nonce="__CSP_NONCE__">`. This is a belt-and-suspenders approach that works regardless of CSP strictness. The existing HTML template already replaces `__CSP_NONCE__` placeholders.

### Anti-Patterns to Avoid
- **Dynamic OG tags via JavaScript for social sharing:** Social media crawlers (Facebook, Slack, Discord, X) do NOT execute JavaScript. Only Google's crawler renders JS. Static OG tags in `index.html` are the only reliable solution for social preview cards.
- **Secret-specific OG content on /secret/* routes:** OG tags like `og:title="View Your Secret"` or `og:description="Someone sent you a secret"` leak metadata about the existence of a secret at that URL. Use completely generic branding: `og:title="SecureShare"`.
- **Including secret IDs in canonical URLs:** The `canonical` link for secret routes should point to the homepage (`/`), not to `/secret/:id`. Never put ephemeral secret IDs in structured metadata.
- **Removing OG tags instead of replacing them:** When navigating from homepage to a secret route, don't remove OG tags entirely. Replace them with generic values. Removing them leaves no OG tags, which some crawlers handle poorly.
- **SEO meta tags only in index.html (never updated):** Without dynamic updates, all routes inherit the homepage's meta description. Google sees the same description across different pages, which is a duplicate content signal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Meta tag management library | Custom DOM query/update system with caching | Direct `document.querySelector` + create/update pattern | Only 6-8 meta elements across 4 routes; a library abstraction adds complexity for trivial DOM operations |
| OG image generation | Satori/resvg build pipeline or Canvas-based generator | Static 1200x630 PNG file in `client/public/` | Only one page (homepage) needs an OG image; generating it dynamically is massive overkill |
| Server-side rendering for meta tags | Express SSR or pre-rendering pipeline | Static OG tags in HTML + dynamic client-side updates | Only 1 indexable page; SSR architecture change for near-zero ROI (explicitly out of scope per REQUIREMENTS.md) |
| Structured data validator | Custom JSON-LD validation | Google Rich Results Test (https://search.google.com/test/rich-results) | One-time validation during development; no runtime validation needed |

**Key insight:** This phase adds SEO markup to an already-complete SPA. The complexity is in getting the meta tag values right for each route and ensuring stale values don't persist across navigation -- not in the implementation mechanism itself. The DOM operations are trivial.

## Common Pitfalls

### Pitfall 1: Stale Meta Tags After SPA Navigation
**What goes wrong:** User navigates from homepage to `/secret/:id` to error page. The error page still has the homepage's `og:description` and `meta description` because the previous route's tags were not cleaned up.
**Why it happens:** `updatePageMeta()` creates meta elements but the next call only updates `document.title`, not the other tags.
**How to avoid:** Every call to `updatePageMeta()` must update ALL managed meta elements (title, description, canonical, robots, OG tags). The function must be the single source of truth for all SEO meta state. Never create tags elsewhere.
**Warning signs:** Inspect `document.head` after several navigations; meta elements accumulate instead of being updated.

### Pitfall 2: JSON-LD Script Blocked by CSP
**What goes wrong:** The `<script type="application/ld+json">` block is stripped or blocked by the Content Security Policy.
**Why it happens:** The existing CSP uses nonce-based `script-src`. While `type="application/ld+json"` is technically a data block (not executed), some CSP implementations and browser behaviors vary.
**How to avoid:** Add the `nonce="__CSP_NONCE__"` attribute to the JSON-LD script tag. The existing nonce replacement in `app.ts` will inject the correct nonce at serve time. This is safe because JSON-LD is never executed as JavaScript.
**Warning signs:** Google Search Console reports "no structured data found" despite the tag being present in source HTML.

### Pitfall 3: OG Image URL Must Be Absolute
**What goes wrong:** Social media crawlers show a broken image or no image in the preview card.
**Why it happens:** Using a relative path like `/og-image.png` instead of a fully qualified URL `https://secureshare.example.com/og-image.png`. The OG protocol specification requires absolute URLs.
**How to avoid:** Always use the full URL with protocol and domain in `og:image`, `og:url`, and `canonical` meta tag values. Use the placeholder domain `https://secureshare.example.com` per project convention.
**Warning signs:** Link previews in Slack/Discord show the app name but no image.

### Pitfall 4: Secret Route Canonical Points to Secret URL
**What goes wrong:** Google indexes the secret URL pattern even with `noindex` because the canonical URL signals it's a distinct page.
**Why it happens:** Setting `canonical` to the current path (`/secret/abc123`) on secret routes.
**How to avoid:** Secret routes should either (a) not have a canonical link at all, or (b) canonicalize to the homepage. Option (a) is cleaner -- remove the canonical element for noindex pages since noindex already tells crawlers to ignore the page.
**Warning signs:** Google Search Console shows `/secret/` URLs as "excluded by noindex" but still crawled frequently.

### Pitfall 5: Twitter Card Falls Back Poorly Without twitter:image
**What goes wrong:** Twitter/X shows a small "summary" card instead of a large image card.
**Why it happens:** `twitter:card` is set to `summary_large_image` but no `twitter:image` is specified. X falls back to `og:image`, but if that also fails, it downgrades to a basic summary card.
**How to avoid:** Always include both `og:image` and either `twitter:image` or ensure the `og:image` URL is accessible. X/Twitter shares the og:image fallback, so having a valid `og:image` with an absolute URL is sufficient. Explicitly set `twitter:card` to `summary_large_image`.
**Warning signs:** Paste the homepage URL into the X/Twitter card validator; preview shows small card instead of large image.

### Pitfall 6: updatePageMeta Called with Old String Signature
**What goes wrong:** TypeScript compiles fine but meta tags stop updating because the refactored function receives a string instead of a PageMeta object.
**Why it happens:** A call site was missed during the refactor.
**How to avoid:** Change the parameter type to `PageMeta` (an interface, not a union with string). TypeScript will error on every call site that passes a string. Fix all 5 call sites mechanically. Run `npx tsc --noEmit` to verify zero type errors.
**Warning signs:** TypeScript compile errors on `updatePageMeta('Some Title')` calls -- this is the desired behavior that catches all missed call sites.

## Code Examples

Verified patterns from official sources:

### Route-Specific Meta Values Table

| Route | Title | Description | noindex | Canonical |
|---|---|---|---|---|
| `/` (homepage) | Share a Secret | Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser. | No | `{origin}/` |
| `/secret/:id` (reveal) | You've Received a Secret | (generic) Zero-knowledge secret sharing | Yes | Remove element |
| `/secret/:id` (confirmation, state-based) | Your Secure Link is Ready | (generic) Zero-knowledge secret sharing | Yes (user is on `/` but shouldn't affect homepage SEO) | `{origin}/` |
| 404 / errors | Page Not Found | (generic) Zero-knowledge secret sharing | Yes | Remove element |

**Note on confirmation page:** The confirmation page is state-based (rendered by `renderConfirmationPage` in `create.ts`), not URL-based. The URL stays as `/` but the page content changes. Since the user already has the secret link and this page is transient, setting `noindex` is appropriate to avoid confusion. However, the canonical should stay as `{origin}/` since the URL is `/`. Alternatively, the confirmation page could simply not override the homepage meta at all -- only updating the title and leaving OG/description unchanged. This is the simpler approach.

### Complete index.html Head Section (After Phase 14)
```html
<head>
  <script>
    (function() {
      var t = localStorage.getItem('theme');
      var d = t === 'dark' || (!t && matchMedia('(prefers-color-scheme:dark)').matches);
      document.documentElement.classList.toggle('dark', d);
      document.documentElement.style.colorScheme = d ? 'dark' : 'light';
    })();
  </script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />

  <title>SecureShare - Share Secrets Securely</title>
  <meta name="description" content="Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.">
  <link rel="canonical" href="https://secureshare.example.com/">

  <!-- Open Graph -->
  <meta property="og:title" content="SecureShare - Zero-Knowledge Secret Sharing">
  <meta property="og:description" content="End-to-end encrypted. One-time view. No accounts.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://secureshare.example.com/">
  <meta property="og:image" content="https://secureshare.example.com/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="SecureShare - Zero-knowledge one-time secret sharing">
  <meta property="og:site_name" content="SecureShare">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="SecureShare - Zero-Knowledge Secret Sharing">
  <meta name="twitter:description" content="End-to-end encrypted. One-time view. No accounts.">

  <!-- Favicon (existing from Phase 10) -->
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <link rel="stylesheet" href="/src/styles.css" />

  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json" nonce="__CSP_NONCE__">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "SecureShare",
    "url": "https://secureshare.example.com/",
    "description": "Zero-knowledge, one-time secret sharing. End-to-end encrypted in your browser.",
    "applicationCategory": "SecurityApplication",
    "operatingSystem": "All",
    "browserRequirements": "Requires JavaScript and Web Crypto API",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  }
  </script>
</head>
```

### OG Image Specification
**File:** `client/public/og-image.png`
**Dimensions:** 1200x630 pixels (standard OG image size)
**Content:** SecureShare branded image with:
- Dark background matching the app's dark theme
- Shield icon / brand mark
- "SecureShare" wordmark
- Tagline: "Zero-knowledge secret sharing"
- Clean, minimal design that reads well at small preview sizes

**Important:** The ASEO-01 requirement ("Branded OG image designed to match dark theme aesthetic") is listed as a future requirement beyond v2.0. However, SEO-01 explicitly requires `og:image`. The pragmatic approach is to create a simple, clean OG image now. It does not need to be a full branded design -- a minimal image with the shield icon and text on a dark background is sufficient to prevent broken preview cards.

### Express X-Robots-Tag Implementation
```typescript
// server/src/app.ts - Modified SPA catch-all
app.get('{*path}', (req, res) => {
  const html = htmlTemplate.replaceAll(
    '__CSP_NONCE__',
    res.locals.cspNonce,
  );
  res.setHeader('Content-Type', 'text/html');

  // Secret routes: noindex HTTP header (defense-in-depth, works before HTML parsing)
  if (req.path.startsWith('/secret/')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  res.send(html);
});
```

### handleRoute() Call Site Updates
```typescript
// router.ts - Updated handleRoute() function
function handleRoute(): void {
  const path = window.location.pathname;
  const container = document.getElementById('app')!;

  // Clear existing content
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Page transition animation (existing)
  container.classList.remove('motion-safe:animate-fade-in-up');
  void container.offsetWidth;
  container.classList.add('motion-safe:animate-fade-in-up');

  if (path === '/') {
    updatePageMeta({
      title: 'Share a Secret',
      description: 'Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.',
    });
    import('./pages/create.js')
      .then((mod) => mod.renderCreatePage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else if (path.startsWith('/secret/')) {
    updatePageMeta({
      title: "You've Received a Secret",
      description: 'Zero-knowledge secret sharing',
      noindex: true,
    });
    import('./pages/reveal.js')
      .then((mod) => mod.renderRevealPage(container))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  } else {
    updatePageMeta({
      title: 'Page Not Found',
      description: 'Zero-knowledge secret sharing',
      noindex: true,
    });
    import('./pages/error.js')
      .then((mod) => mod.renderErrorPage(container, 'not_found'))
      .then(() => focusPageHeading())
      .catch(() => showLoadError(container));
  }

  window.dispatchEvent(
    new CustomEvent('routechange', { detail: { path } }),
  );
}
```

### confirmation.ts Call Site Update
```typescript
// In renderConfirmationPage()
// Update the existing updatePageMeta call:
updatePageMeta({
  title: 'Your Secure Link is Ready',
  description: 'Zero-knowledge secret sharing',
  // No noindex needed here -- URL is still '/' and this is transient
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| React Helmet for meta management | Direct DOM manipulation (vanilla JS) | Always (for non-React SPAs) | No library dependency; simpler, faster |
| `<meta name="robots">` only | `<meta name="robots">` + `X-Robots-Tag` HTTP header | Ongoing best practice | HTTP header is more reliable; crawlers see it before HTML parsing |
| Twitter-specific `twitter:*` tags for everything | Use OG tags with `twitter:card` type only | X/Twitter falls back to OG tags | Reduces duplication; `twitter:title` and `twitter:description` fall back to `og:title` and `og:description` |
| Multiple OG image sizes | Single 1200x630 OG image | Current standard | All platforms accept 1200x630; no need for multiple sizes |
| `schema.org/WebSite` for all sites | `schema.org/WebApplication` for interactive tools | Ongoing | More accurate classification for tools vs content sites |

**Deprecated/outdated:**
- `twitter:site` and `twitter:creator` tags: Only needed if you have a Twitter/X handle to associate. SecureShare doesn't; omit these.
- `og:image:secure_url`: Redundant when `og:image` already uses HTTPS. Omit.
- `twitter:image:src`: Not a valid tag. Use `twitter:image` or let it fall back to `og:image`.

## Open Questions

1. **OG Image Creation Method**
   - What we know: SEO-01 requires `og:image`. ASEO-01 (branded OG image) is a future requirement. No `og-image.png` currently exists.
   - What's unclear: Whether to create a simple placeholder image now or defer `og:image` entirely.
   - Recommendation: Create a minimal OG image during implementation. A dark background with the shield icon and "SecureShare" text is sufficient. Can be upgraded later for ASEO-01. The alternative (no og:image) means broken preview cards on social media, which defeats the purpose of adding OG tags. Use an SVG-to-PNG conversion or simple canvas-based generation as a one-time operation.

2. **Confirmation Page Meta Behavior**
   - What we know: Confirmation page is state-based (URL stays `/`). It calls `updatePageMeta()` directly.
   - What's unclear: Should confirmation update meta description to something generic, or leave homepage meta intact since the URL is still `/`?
   - Recommendation: Update title only (existing behavior), keep description and OG as homepage values. The confirmation page is transient and the URL is `/`, so homepage meta is appropriate. Avoid setting `noindex` since the URL is the indexable homepage.

3. **CSP Behavior with JSON-LD Script Tags**
   - What we know: The existing CSP uses nonce-based `script-src`. JSON-LD `<script type="application/ld+json">` is technically a data block.
   - What's unclear: Whether the current CSP configuration blocks non-JS script types without a nonce.
   - Recommendation: Add `nonce="__CSP_NONCE__"` to the JSON-LD script tag as a precaution. Zero downside, prevents potential CSP blocking. Test by inspecting browser console for CSP violations after implementation.

## Sources

### Primary (HIGH confidence)
- Open Graph Protocol specification (https://ogp.me/) -- required properties, meta tag format, absolute URL requirement
- MDN X-Robots-Tag documentation (https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Robots-Tag) -- header syntax, valid directives (noindex, nofollow), examples
- schema.org WebApplication type (https://schema.org/WebApplication) -- properties: name, url, description, applicationCategory, browserRequirements, offers
- Google Structured Data documentation (https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) -- JSON-LD as preferred format
- Project architecture research (`.planning/research/ARCHITECTURE.md` lines 318-407) -- PageMeta interface design, updatePageMeta refactor specification
- Project pitfalls research (`.planning/research/PITFALLS.md` lines 75-94) -- X-Robots-Tag pattern, OG tag security for secret routes
- Project stack research (`.planning/research/STACK.md` lines 261-301) -- JSON-LD WebApplication example, OG tag examples, twitter card tags
- Existing codebase: `client/src/router.ts`, `server/src/app.ts`, `client/index.html`

### Secondary (MEDIUM confidence)
- X Developer Platform Cards Markup (https://developer.x.com/en/docs/x-for-websites/cards/overview/markup) -- twitter:card types, OG fallback behavior
- Darren Lester blog: JSON-LD for Web Applications (https://www.darrenlester.com/blog/json-ld-structured-data-for-web-applications) -- practical WebApplication schema example
- Evil Martians favicon guide (https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) -- three-file approach (already implemented in Phase 10)

### Tertiary (LOW confidence)
- CSP interaction with `type="application/ld+json"` script tags -- multiple sources suggest it's safe without nonce, but behavior may vary by browser. Adding nonce is the safe approach.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries; all DOM APIs and Express patterns are well-documented
- Architecture: HIGH -- the updatePageMeta refactor is already fully designed in project architecture docs; server-side X-Robots-Tag is a single line
- Pitfalls: HIGH -- stale meta tags and OG security for secret routes are well-documented patterns with clear prevention strategies
- OG image creation: MEDIUM -- the requirement exists but no image asset has been created yet; method TBD during implementation
- CSP + JSON-LD interaction: MEDIUM -- nonce approach is safe regardless, but exact browser behavior is not independently verified

**Research date:** 2026-02-16
**Valid until:** 2026-06-16 (stable domain; OG/SEO standards change slowly)
