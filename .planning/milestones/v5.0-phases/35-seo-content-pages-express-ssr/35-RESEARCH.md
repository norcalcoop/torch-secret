# Phase 35: SEO Content Pages (Express SSR) - Research

**Researched:** 2026-02-26
**Domain:** Express SSR / HTML generation / SEO structured data
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase boundary:**
- These are new Express route handlers that bypass the SPA entirely. The existing Vite SPA and its routes are untouched.
- Competitors covered: onetimesecret, pwpush, privnote (3 total).

**Content depth and tone:**
- Genuinely useful pages — not thin SEO placeholders. ~600–900 words per comparison page.
- Tone toward competitors: honest and fair. Acknowledge competitor strengths. Wins on zero-knowledge model and open-source trust.

**/vs/* page structure:**
- Sections: H1 intro paragraph → feature comparison table → verdict paragraph with CTA to create a secret
- No FAQ block on /vs/ pages
- Comparison table rows (fixed across all /vs/ pages): zero-knowledge encryption, open source, one-time self-destruct, optional password protection, configurable expiration, no account required

**/vs/* vs /alternatives/* distinction:**
- `/vs/[competitor]` — targets "Torch Secret vs [Competitor]" queries. Head-to-head feature comparison with the table structure above.
- `/alternatives/[competitor]` — targets "[Competitor] alternatives" queries. Persuasive prose, lighter table or no table. Distinct pages with distinct content, not canonical redirects.

**Use-case pages:**
- 3–5 pages; Claude picks the highest-traffic use cases
- Page structure: H1 use-case title → short problem paragraph → numbered HowTo steps (maps to HowTo JSON-LD) → CTA to create a secret
- Hub at `/use/`: card grid layout — each card has an icon, title, and 1-sentence description linking to the individual `/use/[slug]` page

**Visual design integration:**
- Full visual match with the SPA: same Tailwind v4 design tokens, glassmorphism surfaces, same color system
- Shared HTML partial for header and footer — same nav links as the SPA (Home, Create, Pricing, Dashboard). One place to maintain across all SSR pages.
- Dark/light mode: CSS-only via `prefers-color-scheme` media query. No JS theme toggle on SSR pages. Works before any script loads and avoids FOWT.

### Claude's Discretion

- Specific templating approach (EJS vs string templates vs another Express-compatible option)
- Exact glassmorphism CSS approach for SSR context (inline styles vs linking compiled Tailwind output vs other)
- HowTo JSON-LD step wording
- Exact use-case slug selection and content within the 3–5 page count

### Deferred Ideas (OUT OF SCOPE)

- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEO-01 | Competitor comparison pages server-rendered at `/vs/onetimesecret`, `/vs/pwpush`, `/vs/privnote` (800+ words each, using pre-written copy from `.claude/competitor-pages/`) | Express Router mounted before SPA catch-all; template function generates full HTML; copy files already exist |
| SEO-02 | Alternative pages server-rendered at `/alternatives/onetimesecret`, `/alternatives/pwpush`, `/alternatives/privnote` | Same Router pattern as SEO-01; distinct content files already exist |
| SEO-03 | Use case hub page server-rendered at `/use/` linking to all use case pages | Hub renders card grid; copy in `.claude/use-case-pages.md` |
| SEO-04 | All 8 use case pages server-rendered at `/use/[slug]` (copy from `.claude/use-case-pages.md`) | Slug-keyed data map in router; full copy exists in `.claude/use-case-pages.md` |
| SEO-05 | All SEO content pages include static JSON-LD (`FAQPage` on `/vs/*`, `HowTo` on `/use/*`) in `<head>` of server-rendered HTML | JSON-LD emitted directly inside template `<head>`; nonce applied; no JS injection |
| SEO-06 | All new SEO routes added to `sitemap.xml`; `NOINDEX_PREFIXES` verified not to match SEO routes | `sitemap.xml` lives in `client/` root (served as static); must be updated; NOINDEX_PREFIXES in `app.ts` must not include `/vs`, `/alternatives`, `/use` prefixes |
</phase_requirements>

---

## Summary

This phase adds server-rendered HTML pages to the Express app for SEO purposes. The goal is that `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` returns the H1 from the first HTTP response — no JavaScript execution required. The existing SPA continues to serve all other routes unchanged.

The implementation approach is straightforward: new Express routers (`/vs/*`, `/alternatives/*`, `/use/*`) are mounted **before** the SPA catch-all in `app.ts`. Each handler generates a complete HTML document — `<!doctype html>` through `</html>` — using TypeScript string template literals. No third-party template engine is needed; the project has no EJS dependency and the HTML output is not dynamic enough to justify one. The generated HTML links to the compiled Tailwind CSS bundle at `/assets/index-YTUnvmeP.css` (served by the existing `express.static` middleware) so all design tokens are available without duplication.

Dark/light mode is CSS-only via `@media (prefers-color-scheme: dark)` — the SPA's `.dark` class system requires JS, but the SSR pages can use native media queries targeting the same `--ds-color-*` CSS custom properties that are baked into the Tailwind bundle. CSP nonces must be injected into `<script>` and `<link>` elements (both the Tailwind stylesheet and any JSON-LD `<script type="application/ld+json">` blocks). The sitemap at `client/sitemap.xml` must be extended to list all new routes; it is a static XML file served by `express.static`.

**Primary recommendation:** Pure TypeScript string templates — no new npm package needed. Mount SSR routers before the SPA catch-all. Link to the compiled Tailwind CSS bundle. Inject CSP nonces using `res.locals.cspNonce`. Extend `client/sitemap.xml` statically.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express Router | already installed (express ^5.2.1) | Mount `/vs/*`, `/alternatives/*`, `/use/*` handlers | Already in the project — no new dependency |
| Node.js string templates | built-in | Generate HTML documents | No runtime overhead; TypeScript gives type safety; simpler than a template engine for static pages |
| Tailwind CSS compiled bundle | already built at `client/dist/assets/index-YTUnvmeP.css` | Design tokens, utility classes on SSR pages | Reusing the same stylesheet the SPA uses — zero duplication; consistent design tokens |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| EJS | ^3.1.x (NOT installed) | Alternative template engine | Only if the HTML generation grows complex enough to need partials/loops — current pages don't need it |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String templates | EJS | EJS adds a runtime dependency and `app.set('view engine', 'ejs')` setup; not worth it for ~15 static-content pages. EJS is the idiomatic Express choice but overkill here. |
| String templates | Handlebars / Nunjucks | Same tradeoff — extra dependency, more setup, no real benefit for this use case. |
| Linking compiled CSS | Extracting Tailwind tokens to inline `<style>` | Inline styles bypass the CDN-friendly CSS bundle and would duplicate ~40KB of minified CSS per response. Avoid. |
| Linking compiled CSS | Running Tailwind at server startup | Too complex; Tailwind v4 compiles at build time. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
server/src/
├── routes/
│   ├── seo/
│   │   ├── index.ts          # exports seoRouter (mounts /vs, /alternatives, /use sub-routers)
│   │   ├── vs.ts             # GET /vs/:competitor → renderVsPage(competitor)
│   │   ├── alternatives.ts   # GET /alternatives/:competitor → renderAlternativesPage(competitor)
│   │   └── use.ts            # GET /use/ + GET /use/:slug → renderUseCaseHub() / renderUseCasePage(slug)
│   └── seo/
│       └── templates/
│           ├── layout.ts     # shared HTML shell: <head>, header nav, footer, CSP nonce injection
│           ├── vs-pages.ts   # page data map: competitor → { title, metaDesc, canonical, h1, bodyHtml, faqItems }
│           ├── alternatives-pages.ts  # same pattern
│           └── use-case-pages.ts      # slug → { title, metaDesc, canonical, h1, steps, faqItems, ... }
```

Or alternatively (flatter, equally valid):

```
server/src/routes/
├── seo.ts          # all three routers (vs, alternatives, use) in one file if preferred
```

The key structural decision is that **page data (copy) lives in TypeScript data objects** in the templates file — pulled from the `.claude/competitor-pages/*.md` and `.claude/use-case-pages.md` source files at planning time, then inlined as string constants. The route handlers call a shared `renderLayout(options)` function.

### Pattern 1: Shared Layout Function

**What:** A `renderLayout({ title, canonical, metaDesc, ogTitle, ogDesc, bodyHtml, jsonLd, cspNonce })` function returns a complete HTML document string.

**When to use:** Every SSR route. The layout function is the "single place to maintain" for header nav and footer.

**Example:**

```typescript
// server/src/routes/seo/templates/layout.ts

interface LayoutOptions {
  title: string;
  canonical: string;
  metaDesc: string;
  ogTitle: string;
  ogDesc: string;
  bodyHtml: string;
  jsonLd: string;       // pre-serialized JSON string, or '' if none
  cspNonce: string;     // from res.locals.cspNonce
}

export function renderLayout(opts: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <meta name="description" content="${escHtml(opts.metaDesc)}" />
  <link rel="canonical" href="${escHtml(opts.canonical)}" />
  <title>${escHtml(opts.title)}</title>
  <meta property="og:title" content="${escHtml(opts.ogTitle)}" />
  <meta property="og:description" content="${escHtml(opts.ogDesc)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escHtml(opts.canonical)}" />
  <meta property="og:site_name" content="Torch Secret" />
  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="stylesheet" href="/assets/index-YTUnvmeP.css" nonce="${opts.cspNonce}" />
  ${opts.jsonLd ? `<script type="application/ld+json" nonce="${opts.cspNonce}">${opts.jsonLd}</script>` : ''}
</head>
<body class="flex min-h-screen flex-col bg-bg font-body text-text-primary">
  ${renderNav()}
  <main id="main-content" class="...">
    ${opts.bodyHtml}
  </main>
  ${renderFooter()}
</body>
</html>`;
}

// Must escape user-controlled data interpolated into HTML attributes
function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
```

### Pattern 2: Route Handler → Template

**What:** The route handler calls a page-specific render function, then calls `res.send(html)` with `Content-Type: text/html`.

**Example:**

```typescript
// server/src/routes/seo/vs.ts
import { Router } from 'express';
import { renderLayout } from './templates/layout.js';
import { VS_PAGES } from './templates/vs-pages.js';

export const vsRouter = Router();

vsRouter.get('/:competitor', (req, res) => {
  const page = VS_PAGES[req.params.competitor];
  if (!page) {
    res.status(404).send('Not found');
    return;
  }
  const html = renderLayout({
    ...page.meta,
    bodyHtml: page.bodyHtml,
    jsonLd: JSON.stringify(page.faqSchema),
    cspNonce: res.locals.cspNonce as string,
  });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
```

### Pattern 3: Mounting SSR Routers Before SPA Catch-All

**What:** SSR routes are registered in `app.ts` **before** the `express.static` / SPA catch-all block.

**Why critical:** The SPA catch-all `app.get('{*path}', ...)` is inside the `if (existsSync(clientDistPath))` block. Any route mounted before that block takes precedence. SSR routes must be there.

**Example (in `app.ts`):**

```typescript
// After billingRouter, before the API catch-all — OR after API catch-all, before static/SPA block
import { seoRouter } from './routes/seo/index.js';

// Mount SEO SSR routes — BEFORE express.static and SPA catch-all
app.use(seoRouter);  // seoRouter mounts /vs, /alternatives, /use internally
```

The exact position: **after all `/api` routes and the API catch-all `app.use('/api', ...)`, but before `express.static` and the SPA catch-all**. This ensures:
- API routes are not affected
- SSR pages bypass `express.static` (which doesn't serve them) and reach their handlers
- SSR pages never fall through to the SPA catch-all (which would return `index.html`)

### Pattern 4: CSS-Only Dark Mode for SSR Pages

**What:** The compiled Tailwind bundle at `/assets/index-YTUnvmeP.css` includes the `:root` and `.dark {}` custom property blocks from `styles.css`. The `.dark` class approach the SPA uses requires JS. For SSR pages, use `@media (prefers-color-scheme: dark)` with the same `--ds-color-*` CSS variables.

**How:** Add a `<style nonce="...">` block in the SSR layout that overrides the CSS custom properties for dark mode:

```html
<style nonce="${cspNonce}">
  @media (prefers-color-scheme: dark) {
    :root {
      --ds-color-bg: #1a1a2e;
      --ds-color-surface: #222240;
      /* ... remaining dark token overrides ... */
    }
  }
</style>
```

This small inline style block (linked to the nonce) ensures dark mode works without any JS. The Tailwind utilities on SSR pages (`bg-bg`, `text-text-primary`, etc.) still use the CSS variables — they just get overridden by the media query.

**IMPORTANT:** The `<style>` tag requires `nonce="${cspNonce}"` because the Helmet CSP is `style-src 'self' 'nonce-...'` — inline styles without a nonce will be blocked.

### Pattern 5: CSS Filename is Build-Artifact Specific

**What:** The compiled CSS filename (`index-YTUnvmeP.css`) is a content-hash that changes on every `npm run build:client`. SSR pages hardcoding this filename will break after any client rebuild.

**How to handle:** Read the filename dynamically at server startup from the built `index.html`:

```typescript
// In layout.ts or app.ts initialization
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function getBuiltAssets(): { cssHref: string; jsHref: string } {
  const indexPath = resolve(import.meta.dirname, '../../../client/dist/index.html');
  if (!existsSync(indexPath)) {
    return { cssHref: '', jsHref: '' };
  }
  const html = readFileSync(indexPath, 'utf-8');
  const cssMatch = html.match(/href="(\/assets\/index-[^"]+\.css)"/);
  const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  return {
    cssHref: cssMatch?.[1] ?? '',
    jsHref: jsMatch?.[1] ?? '',
  };
}
```

This is the same strategy used by the existing SPA catch-all (`readFileSync(resolve(clientDistPath, 'index.html'), 'utf-8')` at startup). Extract it once at module load time — not per-request.

### Anti-Patterns to Avoid

- **Serving SSR pages from within the SPA:** Don't add `/vs/*`, `/alternatives/*`, `/use/*` to the SPA router. The SPA's JS execution is what crawlers skip. The whole point is Express handles these routes, not the browser.
- **Hardcoding the hashed CSS filename:** `index-YTUnvmeP.css` changes on every client build. Always parse it from `index.html` at startup.
- **Omitting CSP nonces from SSR `<link>` and `<script>` tags:** The Helmet CSP requires nonces on both. Missing a nonce will cause the stylesheet to be blocked by the browser.
- **Using `innerHTML` with competitor copy:** Page copy contains characters like `<`, `>`, `"`, `&`. Sanitize all interpolated data with `escHtml()`. The copy itself is trusted (pre-written, version-controlled), but any dynamic data (like `req.params.competitor`) must be escaped.
- **Adding `/vs`, `/alternatives`, or `/use` to `NOINDEX_PREFIXES` in `app.ts`:** The X-Robots-Tag middleware only runs inside the SPA catch-all block, which SSR routes never reach. But verify the prefixes list doesn't accidentally match these paths. SEO-06 requires confirming they do NOT appear in `NOINDEX_PREFIXES`.
- **FAQPage JSON-LD on /vs/* pages:** The CONTEXT.md says "No FAQ block on /vs/ pages" — but the `.claude/competitor-pages/vs-onetimesecret.md` content file includes a FAQ section and `Schema: FAQ schema`. REQUIREMENTS.md SEO-05 says `FAQPage` on `/vs/*`. The content file is authoritative — include FAQPage JSON-LD in `<head>` but do not render a visible FAQ section in the HTML body for `/vs/*` pages. Actually: re-reading CONTEXT.md more carefully — "No FAQ block" likely refers to the visible content section; the FAQ schema in `<head>` is separate from a visible FAQ section. Resolve in planning: include JSON-LD in head, omit visible FAQ accordion from `/vs/*` body.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS for dark mode on SSR | Custom CSS variables system | Reuse `--ds-color-*` vars from compiled Tailwind bundle + small `@media` override | CSS custom properties cascade; Tailwind utilities already reference `var(--ds-color-*)` |
| Sitemap generation | Dynamic sitemap builder | Edit `client/sitemap.xml` statically | The sitemap is already a static XML file with 1 URL; just add the new URLs |
| Template partials | EJS / Handlebars | TypeScript function calls: `renderNav()`, `renderFooter()` | Functions are type-checked; no extra runtime; the number of partials (2: nav, footer) doesn't justify a template engine |

**Key insight:** This is a static-content SSR problem, not a dynamic templating problem. The page copy is version-controlled markdown converted to HTML strings at planning time. TypeScript functions outputting string literals are simpler and more maintainable than a template engine for this use case.

---

## Common Pitfalls

### Pitfall 1: CSS Filename Hash Changes After Client Rebuild

**What goes wrong:** SSR pages stop loading styles after `npm run build:client` regenerates `index-YTUnvmeP.css` with a new content hash.

**Why it happens:** Vite appends a content-hash to CSS/JS filenames for cache-busting. The hash changes whenever the CSS changes.

**How to avoid:** Parse the CSS href from `client/dist/index.html` at server startup (see Pattern 5 above). Do not hardcode the filename.

**Warning signs:** SSR pages render unstyled after a Vite rebuild.

### Pitfall 2: CSP Nonce Missing on `<link rel="stylesheet">`

**What goes wrong:** The compiled Tailwind CSS is blocked by the browser — page renders with no styles.

**Why it happens:** Helmet's CSP is `style-src 'self' 'nonce-...'`. Even same-origin `<link>` elements need the nonce attribute when this directive is active.

**How to avoid:** Always pass `nonce="${cspNonce}"` on every `<link rel="stylesheet">` and `<style>` tag in the SSR layout. Confirm with `curl -I` that the CSP header includes `nonce-` in `style-src`.

**Warning signs:** Browser console shows `Refused to apply style from '...' because its MIME type ('text/css') is not a supported stylesheet MIME type, or strict MIME checking is enabled` — actually this is a different error. The CSP error will be: `Refused to load the stylesheet '...' because it violates the following Content Security Policy directive: "style-src 'self' 'nonce-...'".`

### Pitfall 3: SPA Catch-All Intercepting SSR Routes

**What goes wrong:** `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` returns no H1 — because Express is serving `index.html` instead of the SSR route handler.

**Why it happens:** SSR routers mounted after `express.static` / the SPA catch-all are shadowed by the catch-all `app.get('{*path}', ...)`.

**How to avoid:** Mount `seoRouter` after the API routes and API catch-all, but **before** the `if (existsSync(clientDistPath))` block in `app.ts`. Verify with `curl` (not a browser) — browsers load JS which would execute the SPA.

**Warning signs:** `curl` returns `<!doctype html>` with `__CSP_NONCE__` placeholder but no visible H1 in the static response.

### Pitfall 4: `/vs/*` JSON-LD vs Visible FAQ Ambiguity

**What goes wrong:** Either (a) FAQPage JSON-LD is omitted from `/vs/*` pages losing structured data benefit, or (b) a visible FAQ accordion is added to `/vs/*` body contradicting CONTEXT.md's "no FAQ block on /vs/ pages" decision.

**Why it happens:** The content files (`.claude/competitor-pages/vs-*.md`) include FAQ sections. The CONTEXT.md says "no FAQ block." The requirements say `FAQPage` on `/vs/*`.

**How to avoid:** Include FAQPage JSON-LD in `<head>` (invisible to the user, visible to crawlers) but do NOT render a visible FAQ section in the HTML body of `/vs/*` pages. The "no FAQ block" decision refers to visible page content; the JSON-LD schema is metadata only.

### Pitfall 5: X-Robots-Tag Incorrectly Applied to SEO Pages

**What goes wrong:** SEO pages return `X-Robots-Tag: noindex, nofollow` — they don't get indexed.

**Why it happens:** The `NOINDEX_PREFIXES` check in `app.ts` is inside the SPA catch-all handler. SSR pages never reach that handler, so they cannot be accidentally noindexed by that mechanism. However, if a developer adds `/vs`, `/alternatives`, or `/use` to that list, the SPA catch-all would noindex any request that fell through (which won't happen for SSR routes, but belt-and-suspenders).

**How to avoid:** SEO-06 requires verifying `NOINDEX_PREFIXES` does not contain `/vs`, `/alternatives`, or `/use`. Run `curl -I https://torchsecret.com/vs/onetimesecret | grep X-Robots` and expect no output.

### Pitfall 6: `client/sitemap.xml` Is Stale After Phase Deploys

**What goes wrong:** Sitemap doesn't include the new SEO routes — crawlers discover pages slowly via links instead of directly.

**Why it happens:** `client/sitemap.xml` is a hand-maintained static file. It currently has only one URL (`/`). The new routes need to be added manually.

**How to avoid:** Edit `client/sitemap.xml` as part of the phase. Add all `/vs/*`, `/alternatives/*`, `/use/*`, and `/use/` URLs with appropriate `<lastmod>` and `<changefreq>` entries. The file lives in the client root (`client/sitemap.xml`) and is served by `express.static` through the existing static middleware. No server-side sitemap generation is needed.

---

## Code Examples

Verified patterns from codebase exploration:

### CSP Nonce Pattern (from existing `app.ts`)

```typescript
// The nonce is already generated per-request by cspNonceMiddleware
// and stored in res.locals.cspNonce (string).
// SSR route handlers read it like this:
vsRouter.get('/:competitor', (req, res) => {
  const nonce = res.locals.cspNonce as string;
  const html = renderLayout({ ..., cspNonce: nonce });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
```

### Static Asset Serving (from existing `app.ts`)

```typescript
// The existing static middleware already serves client/dist/*
// including CSS, JS, fonts, sitemap.xml, robots.txt
app.use(express.static(clientDistPath, { index: false }));

// SSR routes don't need special static handling —
// their HTML responses reference /assets/... which the
// existing express.static serves automatically.
```

### Correct Mount Position in `app.ts`

```typescript
// (existing) API catch-all
app.use('/api', (_req, res) => { res.status(404).json({ error: 'not_found' }); });

// (NEW) SSR routes — BEFORE express.static and SPA catch-all
app.use(seoRouter);   // handles /vs/*, /alternatives/*, /use/*

// (existing) static assets + SPA catch-all
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, { index: false }));
  // ...SPA catch-all...
}
```

### Sitemap XML Pattern (extending existing `client/sitemap.xml`)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://torchsecret.com/</loc></url>
  <!-- Phase 33 -->
  <url><loc>https://torchsecret.com/pricing</loc></url>
  <!-- Phase 35 SEO pages -->
  <url><loc>https://torchsecret.com/vs/onetimesecret</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/vs/pwpush</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/vs/privnote</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/alternatives/onetimesecret</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/alternatives/pwpush</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/alternatives/privnote</loc><changefreq>monthly</changefreq></url>
  <url><loc>https://torchsecret.com/use/</loc><changefreq>monthly</changefreq></url>
  <!-- use case slug URLs here -->
</urlset>
```

### FAQPage JSON-LD (schema pattern — from existing pricing JSON-LD in `index.html`)

```typescript
// Source: existing index.html FAQPage schema + schema.org spec
function buildFaqSchema(faqs: Array<{ question: string; answer: string }>): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  });
}
```

### HowTo JSON-LD (use-case pages — schema.org pattern)

```typescript
function buildHowToSchema(opts: {
  name: string;
  description: string;
  steps: Array<{ name: string; text: string }>;
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  });
}
```

### CSS-Only Dark Mode Override for SSR Pages

```html
<!-- In renderLayout() — inline style block with nonce -->
<style nonce="${cspNonce}">
  @media (prefers-color-scheme: dark) {
    :root {
      --ds-color-bg: #1a1a2e;
      --ds-color-surface: #222240;
      --ds-color-surface-raised: #292a4a;
      --ds-color-surface-overlay: #343456;
      --ds-color-text-primary: #f0f0ff;
      --ds-color-text-secondary: #c8c8e0;
      --ds-color-text-tertiary: #9292b2;
      --ds-color-text-muted: #8b8baf;
      --ds-color-accent: #60a4f9;
      --ds-color-accent-hover: #3b81f5;
      --ds-color-border: #39395b;
      --ds-color-danger: #f04546;
      --ds-color-success: #1bc45e;
      --ds-color-warning: #f69e0b;
      --ds-color-icon: #9292b2;
    }
  }
</style>
```

These values are copied verbatim from `client/src/styles.css` `.dark {}` block.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serving all pages as SPA (JS-rendered) | SSR for SEO-critical content-marketing pages only | Phase 35 | Initial HTTP response contains H1 and body copy — no JS execution needed for crawlers |
| FAQPage JSON-LD injected by SPA JS | FAQPage JSON-LD in `<head>` of server-rendered HTML | Phase 35 | Structured data visible to crawlers without JS execution |
| Single-URL sitemap | Multi-URL sitemap with all SEO content pages | Phase 35 | Crawlers discover pages via sitemap, not just link discovery |

**Deprecated/outdated:**
- Relying on Googlebot's JS rendering for competitor pages: Googlebot can render JS but does so with delays of days-to-weeks on a new domain. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) often don't execute JS at all. SSR eliminates both risks.

---

## Open Questions

1. **CSS filename hash stability**
   - What we know: `index-YTUnvmeP.css` is build-artifact specific and will change on every Vite rebuild.
   - What's unclear: Whether `npm run build:client` is run after every server deploy — if it is, the hash changes and any hardcoded filename breaks.
   - Recommendation: Parse from `index.html` at startup (Pattern 5). Flag in implementation that hardcoding is a trap.

2. **Nav links on SSR pages vs SPA nav**
   - What we know: The SPA nav uses JS event handlers (click → `navigate('/create')` etc.). SSR pages can't reuse those components.
   - What's unclear: Whether a simplified `<a href="/create">` nav is acceptable, or if the nav needs to visually match pixel-perfectly including the mobile tab bar.
   - Recommendation: Use plain `<a href="...">` links in the SSR nav and footer. The mobile tab bar is JS-driven and cannot be replicated without JS. A simplified nav (same links, same visual design, standard `<a>` elements) is correct for SSR pages — these are content-marketing pages, not app pages. Full JS nav is not needed.

3. **`/use/*` page count: 3–5 vs 8**
   - What we know: CONTEXT.md says "3–5 pages; Claude picks the highest-traffic use cases." REQUIREMENTS.md SEO-04 says "All 8 use case pages server-rendered." The `.claude/use-case-pages.md` file has copy for all 8.
   - What's unclear: Whether REQUIREMENTS.md SEO-04 takes precedence (all 8) or CONTEXT.md's 3–5 count is the binding decision.
   - Recommendation: SEO-04 is the authoritative requirement. CONTEXT.md "3–5" may have been written before the 8-page copy document was finalized. Use all 8 — the copy exists, the schema is defined, there is no cost to doing all 8.

4. **Internal links between SSR pages and SPA pages**
   - What we know: SSR pages should link to `/create` (SPA route) via CTA buttons. The SPA will handle those as normal page navigations.
   - What's unclear: Whether the SPA router needs to handle `/vs/*`, `/alternatives/*`, `/use/*` for in-app navigation (e.g., if a user navigates from within the SPA to `/vs/onetimesecret`).
   - Recommendation: No SPA router changes needed. If a user is already in the SPA and clicks a link to `/vs/onetimesecret`, the browser will do a full page load (not a SPA navigation) to the Express SSR route. This is correct and expected behavior for these pages. The SPA's `{*path}` catch-all would only activate if the SSR routes weren't mounted — they are.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (server project, Node environment) |
| Config file | `vitest.config.ts` (root) — `server` project: `server/src/**/*.test.ts` |
| Quick run command | `npx vitest run server/src/routes/__tests__/seo.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEO-01 | `GET /vs/onetimesecret` returns 200 with `<h1>` in body (not from JS) | integration (supertest) | `npx vitest run server/src/routes/__tests__/seo.test.ts` | ❌ Wave 0 |
| SEO-01 | `GET /vs/pwpush` returns 200 with `<h1>` in body | integration (supertest) | same | ❌ Wave 0 |
| SEO-01 | `GET /vs/privnote` returns 200 with `<h1>` in body | integration (supertest) | same | ❌ Wave 0 |
| SEO-01 | `GET /vs/unknown` returns 404 | integration (supertest) | same | ❌ Wave 0 |
| SEO-02 | `GET /alternatives/onetimesecret` returns 200 with `<h1>` | integration (supertest) | same | ❌ Wave 0 |
| SEO-02 | `GET /alternatives/pwpush` returns 200 with `<h1>` | integration (supertest) | same | ❌ Wave 0 |
| SEO-02 | `GET /alternatives/privnote` returns 200 with `<h1>` | integration (supertest) | same | ❌ Wave 0 |
| SEO-03 | `GET /use/` returns 200 with `<h1>` and links to all use-case slugs | integration (supertest) | same | ❌ Wave 0 |
| SEO-04 | `GET /use/share-api-keys` (and each other slug) returns 200 with `<h1>` | integration (supertest) | same | ❌ Wave 0 |
| SEO-04 | `GET /use/unknown-slug` returns 404 | integration (supertest) | same | ❌ Wave 0 |
| SEO-05 | `GET /vs/onetimesecret` response body contains `"@type":"FAQPage"` | integration (supertest) | same | ❌ Wave 0 |
| SEO-05 | `GET /use/share-api-keys` response body contains `"@type":"HowTo"` | integration (supertest) | same | ❌ Wave 0 |
| SEO-06 | `GET /vs/onetimesecret` has no `X-Robots-Tag` header | integration (supertest) | same | ❌ Wave 0 |
| SEO-06 | `GET /alternatives/onetimesecret` has no `X-Robots-Tag` header | integration (supertest) | same | ❌ Wave 0 |
| SEO-06 | `GET /use/share-api-keys` has no `X-Robots-Tag` header | integration (supertest) | same | ❌ Wave 0 |
| SEO-06 | `sitemap.xml` contains `/vs/onetimesecret`, `/alternatives/onetimesecret`, `/use/` URLs | manual (file inspect) | `grep` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run server/src/routes/__tests__/seo.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `server/src/routes/__tests__/seo.test.ts` — covers SEO-01 through SEO-06 (all integration tests using supertest + buildApp())

*(Existing test infrastructure — supertest, buildApp(), Vitest server project — covers all needs. Only the test file itself is new.)*

---

## Sources

### Primary (HIGH confidence)

- Codebase: `server/src/app.ts` — SPA catch-all position, NOINDEX_PREFIXES, CSP nonce pattern, express.static usage
- Codebase: `server/src/middleware/security.ts` — Helmet CSP directives, `style-src 'nonce-...'` enforcement
- Codebase: `client/src/styles.css` — CSS custom property names and dark theme values (verbatim source for dark mode override)
- Codebase: `client/dist/index.html` — CSP nonce injection pattern (`nonce="__CSP_NONCE__"` on `<link>` and `<script>`)
- Codebase: `client/dist/sitemap.xml` — current sitemap structure (1 URL, static file)
- Codebase: `.claude/competitor-pages/*.md` — all 6 competitor page copy files exist, fully written
- Codebase: `.claude/use-case-pages.md` — all 8 use-case pages with copy, HowTo steps, FAQ blocks
- Codebase: `server/src/routes/__tests__/security.test.ts` — Supertest + buildApp() test pattern, X-Robots-Tag test pattern

### Secondary (MEDIUM confidence)

- schema.org HowTo spec — `HowToStep` with `position`, `name`, `text` properties (standard spec, not verified via Context7 for this session)
- schema.org FAQPage spec — `mainEntity` array of `Question` with `acceptedAnswer` (confirmed by existing `index.html` usage in codebase)

### Tertiary (LOW confidence)

- WebSearch: "Express SSR without template engine TypeScript ESM 2025" — confirms string template approach is current community pattern; not verified against official Express docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies needed; all patterns exist in the codebase already
- Architecture: HIGH — mount position, CSP nonce flow, CSS strategy all verified against existing code
- Pitfalls: HIGH — CSS hash pitfall and CSP nonce pitfall are concrete, observable failure modes verified by reading actual production config
- Content: HIGH — all copy files exist in `.claude/` directory, pre-written

**Research date:** 2026-02-26
**Valid until:** 2026-04-26 (stable — Express 5, Tailwind v4, Vite 7 are stable releases; no fast-moving risk)
