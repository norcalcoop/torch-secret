# Stack Research: Dark Theme UI Redesign + SEO Infrastructure

**Domain:** Dark developer-themed UI redesign and SEO infrastructure for existing vanilla TS web app
**Researched:** 2026-02-15
**Confidence:** HIGH

## Scope

This document covers ONLY the new stack additions needed for the v2.0 milestone. The existing validated stack (Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17, Vitest 4, vanilla TypeScript) is unchanged and not re-researched.

## Recommended Stack Additions

### Icons: Lucide (vanilla JS package)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| lucide | ^0.564.0 | SVG icon library for vanilla JS | Tree-shakable ES modules. Each icon is ~200-300 bytes gzipped. The `createElement()` API returns DOM SVG elements directly -- perfect match for the project's existing `document.createElement` / `createElementNS` pattern. No framework dependency. 1,500+ icons. |

**Integration approach:** Use `createElement` from lucide, not `createIcons`.

The project already creates SVGs manually via `createElementNS` (see `confirmation.ts` lines 48-74). Lucide's `createElement(IconName, { class: '...', 'stroke-width': 2 })` replaces 15-20 lines of manual SVG construction with a single function call, while outputting identical SVG DOM nodes.

```typescript
import { createElement, ShieldCheck } from 'lucide';

// Before: 20 lines of createElementNS, setAttribute, appendChild
// After:
const icon = createElement(ShieldCheck, {
  class: 'w-8 h-8 text-success-500',
  'stroke-width': 2,
});
container.appendChild(icon);
```

**Why NOT `createIcons`:** The `createIcons` approach scans the DOM for `data-lucide` attributes, which requires HTML templates to exist first. The project renders pages programmatically via TypeScript -- `createElement` fits this pattern. `createIcons` would fight the architecture.

**Why NOT inline SVG path data (current approach):** The project already has manual SVG paths in `confirmation.ts`. For 3-4 icons this was fine. The redesign will need 15-20+ icons across all pages and components (shield, lock, key, copy, check, alert, clock, eye, eye-off, terminal, external-link, etc.). Maintaining raw SVG path data for 20 icons is error-prone and harder to update. Lucide's tree-shaking means only imported icons ship.

**Vite dev mode caveat:** Vite does not tree-shake in dev mode. With lucide's 1,500+ icons, importing from the barrel export can cause slow HMR during development. Mitigate by importing from the package directly (Vite 7 handles this well with optimizeDeps), or if needed, add an alias in vite.config.ts:

```typescript
resolve: {
  alias: {
    'lucide/icons': fileURLToPath(
      new URL('./node_modules/lucide/dist/esm/icons', import.meta.url)
    ),
  },
},
```

### Font: JetBrains Mono Variable via Fontsource

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @fontsource-variable/jetbrains-mono | ^5.2.8 | Self-hosted monospace font for headings and code | Self-hosted fonts are 200-300ms faster than Google Fonts. Variable font covers weights 100-800 in a single file (~100kb woff2), eliminating multiple font file requests. No external requests = better privacy (critical for a security-focused app) and no GDPR concerns with Google Fonts tracking. |

**Why variable font over static:** The redesign needs multiple weights (bold headings, regular body text within monospace sections). A variable font serves all weights from one file. Static @fontsource/jetbrains-mono would require separate files per weight.

**Why self-hosted over Google Fonts:**
1. Privacy: Google Fonts sends user IP and browser info to Google servers. For a zero-knowledge secret sharing app, making requests to Google undermines the trust model.
2. Performance: Self-hosted fonts avoid the extra DNS lookup + connection to fonts.googleapis.com + fonts.gstatic.com (two additional origins).
3. Reliability: No dependency on external CDN availability.

**CSS import strategy:** Do NOT use `import '@fontsource-variable/jetbrains-mono'` in TypeScript. This creates a separate CSS request that delays font discovery. Instead, copy the `@font-face` declaration into `styles.css` directly so it bundles with the main CSS file and the browser discovers the font on first paint.

```css
/* In styles.css, alongside @import "tailwindcss" */
@font-face {
  font-family: 'JetBrains Mono Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 800;
  src: url(@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2) format('woff2-variations');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

Then register in Tailwind via @theme:

```css
@theme {
  --font-mono: 'JetBrains Mono Variable', ui-monospace, SFMono-Regular, monospace;
}
```

### Dark Theme: Tailwind CSS 4 @theme + @custom-variant (no new packages)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS 4 (existing) | ^4.1.18 | Dark mode via semantic color tokens | Already installed. Tailwind v4's `@theme` directive and `@custom-variant` provide everything needed for a dark theme. Zero additional dependencies. |

**Dark mode architecture -- semantic tokens, not scattered `dark:` prefixes:**

The project currently uses hardcoded colors like `text-gray-900`, `bg-gray-50`, `border-gray-200` throughout 7+ TypeScript files. A dark theme with `dark:` variants on every element would double the class strings and make maintenance painful.

Instead, define semantic color tokens in `styles.css` that switch values based on theme:

```css
@import "tailwindcss";

/* Class-based dark mode toggle (not media query) */
@custom-variant dark (&:where(.dark, .dark *));

/* Light theme values (default) */
:root {
  --color-surface: oklch(0.985 0.002 250);
  --color-surface-raised: oklch(1 0 0);
  --color-text-primary: oklch(0.15 0.01 250);
  --color-text-secondary: oklch(0.45 0.02 250);
  --color-border: oklch(0.88 0.01 250);
}

/* Dark theme values */
.dark {
  --color-surface: oklch(0.13 0.02 260);
  --color-surface-raised: oklch(0.18 0.02 260);
  --color-text-primary: oklch(0.93 0.01 250);
  --color-text-secondary: oklch(0.65 0.02 250);
  --color-border: oklch(0.30 0.02 260);
}

@theme {
  --color-surface: var(--color-surface);
  --color-surface-raised: var(--color-surface-raised);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-border: var(--color-border);
}
```

Then use `bg-surface`, `text-text-primary`, `border-border` in components -- no `dark:` prefix needed. Theme switches by toggling `.dark` class on `<html>`.

**Theme toggle persistence:**

```typescript
// On page load
document.documentElement.classList.toggle(
  'dark',
  localStorage.theme === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
);
```

No external library needed. Store preference in `localStorage`, default to system preference.

### Animations: Tailwind CSS 4 @theme keyframes (no new packages)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Tailwind CSS 4 (existing) | ^4.1.18 | Custom animations via @theme @keyframes | Tailwind v4 supports defining `@keyframes` directly inside `@theme` blocks, generating `animate-*` utility classes. No animation library needed. |
| CSS `@starting-style` | Native CSS | Enter/exit transitions from display:none | Baseline available since Firefox 129 (mid-2025). Enables transitions when elements appear in the DOM without JavaScript animation orchestration. |

**Why NOT Framer Motion / GSAP / anime.js:** The project is vanilla TypeScript with no framework. Framer Motion requires React. GSAP and anime.js add 10-30kb for effects achievable with CSS. The redesign needs simple micro-interactions: fade-in on page load, slide-up on card reveal, pulse on copy feedback, glow on hover. All achievable with CSS transitions and @keyframes.

**Custom animation definitions in styles.css:**

```css
@theme {
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.4s ease-out;
  --animate-glow-pulse: glow-pulse 2s ease-in-out infinite;

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 4px oklch(0.58 0.19 250 / 0.3); }
    50% { box-shadow: 0 0 16px oklch(0.58 0.19 250 / 0.6); }
  }
}
```

Usage: `class="animate-fade-in"`, `class="animate-slide-up"`. Respect `motion-reduce:` for accessibility (already used in the loading spinner).

### Glassmorphism: CSS backdrop-filter (no new packages)

Native CSS. No libraries needed. Tailwind provides `backdrop-blur-*` utilities out of the box.

```html
<div class="bg-surface-raised/80 backdrop-blur-md border border-border rounded-xl">
```

Key considerations:
- `backdrop-filter: blur()` is Baseline widely available (all modern browsers).
- On dark backgrounds, use lower opacity (`/60` to `/80`) for the frosted effect.
- Always provide a solid fallback for `@supports not (backdrop-filter: blur(1px))`.

### Favicon: Manual creation (no build-time package)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| RealFaviconGenerator (web tool) | N/A | One-time favicon generation | Generates all 3 required files from a single SVG source. No build dependency. Run once, commit output. |

**The minimal favicon set (2026 consensus):**

1. `favicon.ico` -- 32x32 ICO, for legacy browsers and bots that request `/favicon.ico` directly
2. `favicon.svg` -- Scalable SVG with `prefers-color-scheme` media query for light/dark adaptation
3. `apple-touch-icon.png` -- 180x180 PNG for iOS home screen bookmarks

**HTML tags:**

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

**Why NOT vite-plugin-favicon or @vite-pwa/assets-generator:** These add build-time dependencies for what is fundamentally a one-time operation. Generate favicons once from the brand SVG, commit the files, done. Adding a Vite plugin for this adds complexity to every build for zero ongoing benefit.

### Web Manifest: Manual JSON file (no package)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| site.webmanifest (hand-written) | N/A | PWA metadata, app name, theme color | A 15-line JSON file. No generator needed. |

```json
{
  "name": "SecureShare",
  "short_name": "SecureShare",
  "description": "Zero-knowledge, one-time secret sharing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d1117",
  "theme_color": "#0d1117",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Link in HTML: `<link rel="manifest" href="/site.webmanifest">`

### OG Image: Static file, not generated (no package)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Static og-image.png (hand-crafted) | N/A | Open Graph social sharing preview | SecureShare has exactly ONE page that gets shared publicly (the homepage). A single static 1200x630 PNG is simpler and more reliable than Satori/resvg runtime generation. |

**Why NOT Satori (`satori` ^0.19.2):** Satori converts JSX to SVG, then needs `@resvg/resvg-js` to convert SVG to PNG. This adds two dependencies (~5MB native binary for resvg), a build step, and JSX syntax to a project that deliberately avoids JSX. For a single static OG image, this is massive over-engineering.

**Why NOT `@vercel/og`:** Requires Vercel's edge runtime or Next.js. Not applicable.

**OG image approach:** Design the 1200x630 image once (matching the dark terminal aesthetic), export as PNG, place in `client/public/og-image.png`. Add meta tags:

```html
<meta property="og:image" content="https://secureshare.example/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="SecureShare - Zero-knowledge one-time secret sharing">
```

### JSON-LD Structured Data: Inline script tag (no package)

No package needed. JSON-LD is a `<script type="application/ld+json">` block in `index.html`. Google recommends this format. It does not interact with visible page content.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "SecureShare",
  "url": "https://secureshare.example",
  "description": "Zero-knowledge, one-time secret sharing. End-to-end encrypted in your browser.",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "All",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

**Why `WebApplication` over `WebSite`:** SecureShare is an interactive tool, not a content site. `WebApplication` with `applicationCategory: SecurityApplication` gives search engines the most accurate classification.

### SEO Meta Tags: Hand-written in index.html (no package)

No package needed. Add standard meta tags to `index.html`:

```html
<meta name="description" content="Share secrets securely with zero-knowledge encryption. One-time view, no accounts, end-to-end encrypted in your browser.">
<meta property="og:title" content="SecureShare - Zero-Knowledge Secret Sharing">
<meta property="og:description" content="End-to-end encrypted. One-time view. No accounts.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://secureshare.example">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="SecureShare - Zero-Knowledge Secret Sharing">
<meta name="twitter:description" content="End-to-end encrypted. One-time view. No accounts.">
<meta name="theme-color" content="#0d1117" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

The SPA router already updates `document.title` per page. For SEO, the critical content is in `index.html` since search engines may not execute JS.

## Installation

```bash
# New production dependencies (2 packages)
npm install lucide @fontsource-variable/jetbrains-mono

# No new dev dependencies needed
```

Total new dependency footprint:
- `lucide`: Tree-shaken to only imported icons (~3-5kb gzipped for ~20 icons)
- `@fontsource-variable/jetbrains-mono`: One woff2 file (~100kb, cached after first load)

Everything else (dark theme, animations, glassmorphism, favicon, manifest, OG image, JSON-LD, meta tags) uses existing Tailwind CSS 4 features, native CSS, or static files.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `lucide` (npm createElement) | Manual SVG path data (current approach) | Only if using 3-4 icons total. At 15-20+ icons, Lucide's tree-shaking and single-line API beats maintaining raw SVG paths. |
| `lucide` (npm createElement) | `lucide-static` (raw SVG files) | If you need SVGs as standalone .svg files for server-side rendering. Not relevant for client-side DOM creation. |
| `lucide` (npm createElement) | Heroicons / Phosphor / Tabler | If you prefer a different icon aesthetic. Lucide has the largest set (1,500+), excellent tree-shaking, and a vanilla JS package. Heroicons lacks a vanilla JS package (React/Vue only). |
| `@fontsource-variable/jetbrains-mono` | Google Fonts CDN | If you do not care about privacy or have no GDPR concerns. For a zero-knowledge security app, self-hosting is non-negotiable. |
| `@fontsource-variable/jetbrains-mono` | Self-hosting from JetBrains GitHub release | If you want to manually download woff2 files. Fontsource wraps this in an npm package with proper CSS, reducing manual work. |
| Semantic CSS tokens (`:root` + `.dark`) | Scattered `dark:` Tailwind prefixes | If you have very few elements (under 10) to theme. Once you have 50+ elements across 7+ files, semantic tokens save massive duplication. |
| CSS @keyframes in @theme | Framer Motion | Only if using React. Not applicable here. |
| CSS @keyframes in @theme | GSAP / anime.js | Only if you need complex sequenced animations (timeline, physics). Simple fade/slide/glow does not justify 10-30kb of animation library. |
| Static OG image | Satori + resvg | Only if you have many unique pages that each need distinct OG images. SecureShare has one shareable page. |
| RealFaviconGenerator (web tool) | vite-plugin-favicon | Only if favicon source changes frequently (e.g., white-label product with per-tenant branding). For a single brand, generate once and commit. |
| Manual site.webmanifest | vite-plugin-pwa | Only if building a full PWA with service worker, offline support, and installability. SecureShare is a web app, not a PWA. Secrets require network to fetch. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@iconify/iconify` or `unplugin-icons` | Massive icon meta-library (150+ icon sets). Adds runtime for icon loading. Overkill for one icon set. | `lucide` (single package, tree-shaken) |
| `tailwindcss-animate` plugin | Third-party Tailwind plugin for animations. Tailwind v4's native `@theme` @keyframes makes this unnecessary. Adds a dependency for zero benefit. | `@theme { @keyframes ... }` in styles.css |
| Google Fonts API | External request to Google servers. Privacy violation for a zero-knowledge app. Adds latency (DNS + connection to two Google domains). | Self-hosted via @fontsource-variable |
| `next-seo` / `react-helmet` | React-specific SEO packages. Not applicable to vanilla TS. | Hand-written meta tags in index.html |
| `schema-dts` (TypeScript types for Schema.org) | Adds a dependency for type-checking a 15-line JSON-LD block. Overkill. | Hand-written JSON-LD in index.html |
| `css-loader` / `style-loader` | Webpack-era CSS tooling. Vite + Tailwind CSS 4 handles all CSS processing natively. | Vite + @tailwindcss/vite plugin (already installed) |
| `@tailwindcss/typography` plugin | Prose styling for long-form content. SecureShare has no articles or blog posts. | Custom Tailwind classes |
| `sharp` (for favicon/OG generation) | 50MB+ native dependency. Use a web tool (RealFaviconGenerator) for one-time generation instead of a build-time dependency. | RealFaviconGenerator (web tool) |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| lucide ^0.564.0 | Vite 7.x | ES modules, tree-shakable. May need `optimizeDeps.include: ['lucide']` in Vite config if dev HMR is slow. |
| lucide ^0.564.0 | TypeScript 5.9.x | Full type definitions included. Icons are typed, createElement returns SVGSVGElement. |
| @fontsource-variable/jetbrains-mono ^5.2.8 | Vite 7.x | Vite resolves the woff2 file from node_modules. Use CSS @font-face import, not JS import, for optimal loading. |
| @fontsource-variable/jetbrains-mono ^5.2.8 | Tailwind CSS 4.x | Register in @theme as `--font-mono`. Tailwind generates `font-mono` utility. |
| Tailwind CSS 4.x @custom-variant | All modern browsers | `@custom-variant dark` is processed at build time by Tailwind. Output CSS uses standard selectors. No browser compatibility concern. |
| CSS @starting-style | Chrome 117+, Safari 17.5+, Firefox 129+ | Baseline Newly available mid-2025. Provide fallback for older browsers (elements appear without animation). |
| CSS backdrop-filter: blur() | Chrome 76+, Safari 9+, Firefox 103+ | Baseline widely available. Use `@supports` for graceful degradation. |

## Vite Configuration Changes

The only vite.config.ts change potentially needed:

```typescript
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  html: {
    cspNonce: '__CSP_NONCE__',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Add only if Lucide dev HMR is slow:
  // optimizeDeps: {
  //   include: ['lucide'],
  // },
});
```

## Sources

- [Lucide vanilla JS docs](https://lucide.dev/guide/packages/lucide) -- createElement API, tree-shaking architecture, HIGH confidence
- [Lucide npm](https://www.npmjs.com/package/lucide) -- v0.564.0, last published February 2026, HIGH confidence
- [Tailwind CSS dark mode docs](https://tailwindcss.com/docs/dark-mode) -- @custom-variant syntax for class-based toggle, HIGH confidence
- [Tailwind CSS theme docs](https://tailwindcss.com/docs/theme) -- @theme directive for CSS variables and utility generation, HIGH confidence
- [Tailwind CSS animation docs](https://tailwindcss.com/docs/animation) -- @keyframes inside @theme blocks, HIGH confidence
- [Fontsource JetBrains Mono install](https://fontsource.org/fonts/jetbrains-mono/install) -- v5.2.8, variable font, latin subset, HIGH confidence
- [Fontsource performance with Vite](https://aaronjbecker.com/posts/fontsource-fontaine-tailwind-vite/) -- CSS import vs JS import performance, MEDIUM confidence
- [Evil Martians favicon guide (2026 update)](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) -- Three-file minimal favicon set, HIGH confidence
- [Tailwind CSS v4 theming patterns](https://medium.com/@sir.raminyavari/theming-in-tailwind-css-v4-support-multiple-color-schemes-and-dark-mode-ba97aead5c14) -- Semantic token approach with CSS variables, MEDIUM confidence
- [Vite Lucide tree-shaking optimization](https://christopher.engineering/en/blog/lucide-icons-with-vite-dev-server) -- Alias pattern for dev performance, MEDIUM confidence
- [Google structured data docs](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript) -- JSON-LD with JavaScript, HIGH confidence
- [MDN @starting-style](https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style) -- Browser support baseline, HIGH confidence
- [web.dev entry animations](https://web.dev/blog/baseline-entry-animations) -- @starting-style + transition-behavior baseline status, HIGH confidence

---
*Stack research for: SecureShare v2.0 -- Dark Theme UI Redesign + SEO Infrastructure*
*Researched: 2026-02-15*
