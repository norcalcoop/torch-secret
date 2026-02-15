# Architecture Patterns: Dark Theme UI Redesign + SEO Infrastructure

**Domain:** Dark terminal-inspired UI theme, icon system, layout components, animations, and SEO for existing vanilla TypeScript SPA
**Researched:** 2026-02-15
**Overall Confidence:** HIGH

---

## Recommended Architecture

The redesign adds five distinct layers to the existing vanilla TS SPA architecture. Each integrates at a specific point in the existing code without requiring structural rewrites.

```
index.html                    <-- Add <header>, <footer>, dark body classes, SEO meta
  |
  +-- styles.css              <-- Extend @theme with dark palette, glassmorphism, animations
  |
  +-- app.ts                  <-- Initialize theme, render header/footer (one-time)
  |     |
  |     +-- router.ts         <-- Extend updatePageMeta() for SEO meta tags
  |     |
  |     +-- components/
  |     |     +-- header.ts   <-- NEW: persistent site header with nav + branding
  |     |     +-- footer.ts   <-- NEW: persistent site footer with links
  |     |     +-- icons.ts    <-- NEW: icon utility wrapping Lucide createElement
  |     |
  |     +-- pages/*.ts        <-- Update class names for dark theme tokens
  |
  +-- public/
  |     +-- robots.txt        <-- NEW: crawl directives
  |     +-- sitemap.xml       <-- NEW: indexable URL map
  |
  +-- server/src/app.ts       <-- NO CHANGES: express.static already serves before catch-all
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `styles.css` (@theme) | Dark palette, glassmorphism utilities, animation keyframes | All components via Tailwind classes |
| `components/icons.ts` | Lucide icon creation utility, tree-shakable icon exports | All pages and components |
| `components/header.ts` | Persistent branding, navigation, theme identity | `router.ts` (navigate), `icons.ts` |
| `components/footer.ts` | Site links, trust signals, copyright | `icons.ts` |
| `router.ts` (extended) | SEO meta tag management on route change | `index.html` meta elements |
| `public/robots.txt` | Search engine crawl directives | Served by express.static |
| `public/sitemap.xml` | Indexable URL map for search engines | Referenced by robots.txt |

### Data Flow

**Theme application:** `styles.css` defines CSS custom properties via `@theme` with dark surface color tokens using OKLCH. The body element uses these tokens directly (`bg-surface-900 text-gray-100`). This is a dark-only design -- no light/dark toggle, no `@custom-variant dark` needed. The color tokens defined in `@theme` are inherently dark values.

**Icon flow:** Page/component code imports named icons from `icons.ts` utility. The utility calls Lucide's `createElement()` which returns an `SVGSVGElement`. The caller appends it to the DOM. Tree-shaking ensures only used icons ship in the bundle.

**SEO meta flow:** On each route change, `router.ts` calls `updatePageMeta()` which sets `document.title`, updates `<meta name="description">`, and updates `<link rel="canonical">` in the document head. Static robots.txt and sitemap.xml are served from Vite's `client/public/` directory, which Express serves via `express.static()` before the SPA catch-all.

**Header/footer lifecycle:** `app.ts` renders the header and footer once at startup, outside the `#app` container. The router swaps only the `#app` content on navigation. Header and footer persist across route changes.

---

## Integration Points: Detailed Analysis

### 1. Icon Module: Utility, Not Component

**Decision:** Create `client/src/components/icons.ts` as a utility module that re-exports Lucide's `createElement` with project defaults.

**Rationale:** The existing codebase has an inline SVG pattern in `confirmation.ts` (lines 48-74) using `document.createElementNS`. This works but is verbose (26 lines for one icon). Lucide's `createElement` produces the same output (an `SVGSVGElement` with `aria-hidden="true"`) in 1-2 lines.

**Why utility, not component:** A "component" in this codebase means a function returning an `HTMLElement` (like `createCopyButton`, `createExpirationSelect`). Icons are sub-element building blocks, not standalone components. They get appended inside other components. An icon utility that returns SVG elements fits the existing pattern better.

**Implementation pattern:**

```typescript
// client/src/components/icons.ts
import { createElement, Shield, Lock, Copy, Clock, Eye,
         EyeOff, AlertTriangle, Check, ExternalLink, Github } from 'lucide';

// Project defaults: match existing SVG style from confirmation.ts
const DEFAULTS = {
  'stroke-width': 2,
  'aria-hidden': 'true',
} as const;

/**
 * Create a Lucide SVG icon element with project defaults.
 * Returns an SVGSVGElement ready to append to the DOM.
 */
export function icon(
  IconNode: Parameters<typeof createElement>[0],
  attrs?: Record<string, string | number>,
): SVGSVGElement {
  return createElement(IconNode, { ...DEFAULTS, ...attrs }) as SVGSVGElement;
}

// Re-export named icons for tree-shaking
export { Shield, Lock, Copy, Clock, Eye, EyeOff,
         AlertTriangle, Check, ExternalLink, Github };
```

**Usage in pages:**

```typescript
import { icon, Shield } from '../components/icons.js';

const shieldIcon = icon(Shield, { class: 'w-8 h-8 text-success-500' });
wrapper.appendChild(shieldIcon);
```

**CSP implication:** NONE. Lucide's `createElement` uses `document.createElementNS('http://www.w3.org/2000/svg', 'svg')` -- identical to the existing pattern in `confirmation.ts`. No inline styles, no data URIs, no external requests. The current CSP (`img-src 'self'`) is unaffected because inline SVG elements are DOM nodes, not image resources.

**Confidence:** HIGH -- verified Lucide's vanilla JS API via official docs at lucide.dev/guide/packages/lucide. The `createElement` function returns standard DOM elements.

### 2. Header/Footer Integration with router.ts

**Decision:** Render header and footer in `app.ts` at startup, outside the `#app` div. The router continues to swap only `#app` content.

**Current index.html structure:**

```html
<body class="min-h-screen bg-gray-50 text-gray-900">
  <a href="#main-content" class="sr-only ...">Skip to main content</a>
  <div id="route-announcer" ...></div>
  <main id="main-content">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8"></div>
  </main>
  <script type="module" src="/src/app.ts"></script>
</body>
```

**Proposed structure:**

```html
<body class="min-h-screen bg-surface-900 text-gray-100 flex flex-col font-mono">
  <a href="#main-content" class="sr-only ...">Skip to main content</a>
  <div id="route-announcer" ...></div>
  <header id="site-header"></header>
  <main id="main-content" class="flex-1">
    <div id="app" class="max-w-2xl mx-auto px-4 py-8"></div>
  </main>
  <footer id="site-footer"></footer>
  <script type="module" src="/src/app.ts"></script>
</body>
```

**Why render in app.ts, not hardcode in HTML:** The header and footer use Lucide icons (via the icon utility) and SPA navigation links (via `navigate()`). These require JavaScript. Hardcoding HTML would mean either duplicating icon SVGs or loading them differently. Rendering in `app.ts` keeps the pattern consistent: JavaScript creates DOM, Tailwind styles it.

**app.ts changes:**

```typescript
import './styles.css';
import { initRouter } from './router.js';
import { renderHeader } from './components/header.js';
import { renderFooter } from './components/footer.js';

document.addEventListener('DOMContentLoaded', () => {
  // Render persistent layout elements (once, not per route)
  renderHeader(document.getElementById('site-header')!);
  renderFooter(document.getElementById('site-footer')!);

  // Initialize SPA router (swaps #app content per route)
  initRouter();
});
```

**Router remains unchanged for layout.** The `handleRoute()` function targets `document.getElementById('app')` and clears/fills only that container. Header and footer live outside it. No router modifications needed for layout persistence.

**Skip link remains correct.** The existing `<a href="#main-content">` skip link points to the `<main>` element, which wraps `#app`. The header renders before `<main>`, so the skip link correctly jumps past it.

**Confidence:** HIGH -- this is a standard SPA layout pattern. The existing architecture already separates the router target (`#app`) from the page structure.

### 3. Tailwind CSS 4 @theme Extension for Dark Palette

**Decision:** Extend the existing `styles.css` `@theme` block with dark surface colors, glassmorphism tokens, monospace font, and animation keyframes. This is a dark-by-design app, not a toggled theme.

**Current styles.css:**

```css
@import "tailwindcss";

@theme {
  --color-primary-50: oklch(0.97 0.02 250);
  /* ... primary and status colors ... */
}
```

**Extended styles.css pattern:**

```css
@import "tailwindcss";

@theme {
  /* Existing primary palette (keep as-is) */
  --color-primary-50: oklch(0.97 0.02 250);
  --color-primary-100: oklch(0.93 0.04 250);
  --color-primary-200: oklch(0.87 0.08 250);
  --color-primary-300: oklch(0.78 0.12 250);
  --color-primary-400: oklch(0.68 0.16 250);
  --color-primary-500: oklch(0.58 0.19 250);
  --color-primary-600: oklch(0.50 0.19 250);
  --color-primary-700: oklch(0.42 0.17 250);

  /* Status colors (keep as-is) */
  --color-danger-500: oklch(0.60 0.18 25);
  --color-success-500: oklch(0.65 0.15 145);
  --color-warning-500: oklch(0.75 0.15 85);

  /* NEW: Dark surface palette -- terminal-inspired */
  --color-surface-950: oklch(0.13 0.01 250);  /* deepest background */
  --color-surface-900: oklch(0.16 0.01 250);  /* body background */
  --color-surface-800: oklch(0.20 0.02 250);  /* card background */
  --color-surface-700: oklch(0.25 0.02 250);  /* elevated elements */
  --color-surface-600: oklch(0.30 0.02 250);  /* borders, dividers */

  /* NEW: Glass effect colors */
  --color-glass-bg: oklch(0.20 0.02 250 / 0.6);    /* glass panel fill */
  --color-glass-border: oklch(0.40 0.02 250 / 0.3); /* glass border */

  /* NEW: Monospace font stack for terminal aesthetic */
  --font-mono: ui-monospace, 'Cascadia Code', 'Source Code Pro',
               Menlo, Consolas, 'DejaVu Sans Mono', monospace;

  /* NEW: Animation keyframes */
  --animate-fade-in: fade-in 0.3s ease-out;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-glow-pulse: glow-pulse 3s ease-in-out infinite;

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slide-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 20px oklch(0.58 0.19 250 / 0.1); }
    50% { box-shadow: 0 0 30px oklch(0.58 0.19 250 / 0.2); }
  }
}
```

**Why dark-only, not light/dark toggle:** SecureShare is a security tool. The dark terminal aesthetic communicates "developer tool" and "security." Adding a light/dark toggle doubles the CSS surface area and testing matrix for no user benefit. The PRD does not mention theme switching. Ship dark-only.

**Why OKLCH for surface colors:** The existing palette already uses OKLCH. Maintaining the same color space ensures perceptual consistency. The surface grays use the same hue angle (250) as the primary palette for a cohesive monochromatic feel.

**Body class change in index.html:** Replace `bg-gray-50 text-gray-900` with `bg-surface-900 text-gray-100`. All existing page modules hardcode `text-gray-900`, `text-gray-500`, etc., which need updating to dark-appropriate values (`text-gray-100`, `text-gray-400`).

**Confidence:** HIGH -- verified Tailwind CSS 4 `@theme` with `@keyframes` via official docs at tailwindcss.com/docs/animation.

### 4. Glassmorphism Card Pattern

**Decision:** Use a Tailwind `@layer components` utility class for glassmorphism cards. Compose from Tailwind utilities plus the custom glass tokens.

**Pattern:**

```css
/* In styles.css, after @theme */
@layer components {
  .glass-card {
    @apply bg-glass-bg backdrop-blur-md border border-glass-border
           rounded-xl shadow-lg;
  }
}
```

**Usage in pages:**

```typescript
const card = document.createElement('div');
card.className = 'glass-card p-6';
```

**CSP implication:** NONE. `backdrop-filter` is a CSS property, not a script. The existing CSP allows `'self'` for `style-src` (via nonce). Tailwind's generated CSS is loaded as a stylesheet file from `'self'`, so `backdrop-filter` works without CSP changes.

**Performance consideration:** Limit to 2-3 glassmorphism elements per viewport. `backdrop-filter: blur()` triggers compositing layers. The main card container and the how-it-works section are the two candidates. Do not apply to every list item or small element.

**Accessibility:** Glass backgrounds reduce text contrast. Use `text-gray-100` (not `text-gray-400`) on glass cards. Test with WCAG contrast checker against the effective blurred background. Add a subtle `text-shadow` if contrast is borderline.

**Browser support:** `backdrop-filter` has approximately 95% global browser support as of 2025. Provide a solid fallback via `bg-surface-800` for older browsers -- this is automatic since `bg-glass-bg` includes a solid alpha channel.

**Confidence:** HIGH -- glassmorphism is pure CSS, well-supported.

### 5. Animation Approach Without a Framework

**Decision:** CSS-only animations via Tailwind's `@keyframes` in `@theme`, with `motion-safe:` / `motion-reduce:` variants for accessibility. No JavaScript animation libraries.

**Three animation categories:**

| Category | Technique | Example |
|----------|-----------|---------|
| Page transitions | CSS `animate-fade-in` on route render | Page wrapper fades in on mount |
| Micro-interactions | CSS `transition-*` utilities | Button hover, focus ring, copy feedback |
| Ambient effects | CSS `animate-glow-pulse` | Subtle glow on primary card |

**Page transition pattern:**

```typescript
// In page render functions, add animation class to wrapper
const wrapper = document.createElement('div');
wrapper.className = 'space-y-6 motion-safe:animate-fade-in';
```

**Micro-interaction pattern (existing):** The codebase already uses `transition-colors` on buttons (e.g., `create.ts` line 146). Extend with `transition-all` for subtle scale effects:

```typescript
button.className = '... transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';
```

**Reduced motion:** Tailwind's `motion-safe:` and `motion-reduce:` variants handle `prefers-reduced-motion` automatically. Prefix all animations with `motion-safe:` so they are disabled for users who prefer reduced motion. The existing `loading-spinner.ts` already uses `motion-reduce:animate-none` (line 23) -- follow this established pattern.

**Why no JS animation library:** The animations are simple (fade, slide, glow). CSS handles these with better performance (GPU-composited). Adding a library like GSAP or Framer Motion would increase bundle size for no benefit. The NFR-2 performance target is <1s load on 3G -- every KB counts.

**CSP implication:** NONE. CSS animations and transitions are pure CSS. No inline styles, no `style` attribute manipulation. The nonce-based CSP is unaffected.

**Confidence:** HIGH -- CSS animations are the standard approach for simple transitions. Tailwind 4 `@keyframes` in `@theme` is documented.

### 6. SEO Meta Tag Management in SPA Routing

**Decision:** Extend the existing `updatePageMeta()` function in `router.ts` to manage `<meta name="description">`, `<link rel="canonical">`, and robots directives per route.

**Current `updatePageMeta()` signature:**

```typescript
export function updatePageMeta(title: string): void {
  document.title = `${title} - SecureShare`;
  // ... aria-live announcer
}
```

**Extended signature:**

```typescript
interface PageMeta {
  title: string;
  description: string;
  canonical?: string;  // defaults to current path
  noindex?: boolean;   // for error/reveal pages
}

export function updatePageMeta(meta: PageMeta): void {
  document.title = `${meta.title} - SecureShare`;

  // Update or create <meta name="description">
  let descEl = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!descEl) {
    descEl = document.createElement('meta');
    descEl.name = 'description';
    document.head.appendChild(descEl);
  }
  descEl.content = meta.description;

  // Update or create <link rel="canonical">
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.rel = 'canonical';
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.href = meta.canonical
    ?? `${window.location.origin}${window.location.pathname}`;

  // Robots noindex for non-indexable pages
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

  // Aria-live announcer (existing behavior, preserved)
  const announcer = document.getElementById('route-announcer');
  if (announcer) {
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = meta.title;
    });
  }
}
```

**Route-specific meta values:**

| Route | Title | Description | noindex |
|-------|-------|-------------|---------|
| `/` | Share a Secret | Share passwords and sensitive text securely. End-to-end encrypted, one-time view, no accounts required. | No |
| `/secret/:id` | You've Received a Secret | View your encrypted secret. This link works once and self-destructs after viewing. | Yes |
| 404 / errors | Page Not Found | (generic) | Yes |

**Why noindex on `/secret/:id`:** These are ephemeral one-time URLs. They should never appear in search results. Each secret page is unique and immediately destroyed. Indexing them would produce dead links and waste crawl budget.

**Open Graph tags in index.html (static):** Add OG tags to the HTML template for social sharing previews. These are static because the homepage is the only page worth sharing on social media:

```html
<meta property="og:title" content="SecureShare - Share Secrets Securely">
<meta property="og:description" content="End-to-end encrypted, one-time secret sharing. No accounts required.">
<meta property="og:type" content="website">
```

**Breaking change note:** `updatePageMeta()` currently accepts a `string`. Changing to a `PageMeta` object breaks all 7+ call sites across pages. This is a mechanical refactor -- update each `updatePageMeta('Title')` call to `updatePageMeta({ title: 'Title', description: '...' })`.

**Confidence:** HIGH -- standard SPA SEO patterns. Google renders JavaScript SPAs and reads dynamically set meta tags.

### 7. robots.txt and sitemap.xml: Vite Public Directory

**Decision:** Serve robots.txt and sitemap.xml as static files from `client/public/`. Vite copies them to `client/dist/` at build time. Express's `express.static(clientDistPath)` serves them before the SPA catch-all.

**Why Vite public, not Express routes:** The existing `server/src/app.ts` (lines 63-81) already has `express.static(clientDistPath, { index: false })` before the catch-all `app.get('{*path}', ...)`. Static files in `client/dist/` are served automatically. No Express code changes needed. Adding dedicated routes for robots.txt/sitemap.xml is unnecessary complexity.

**File: `client/public/robots.txt`:**

```
User-agent: *
Allow: /
Disallow: /secret/

Sitemap: https://secureshare.app/sitemap.xml
```

**Rationale for `Disallow: /secret/`:** Secret URLs are ephemeral one-time links. Crawling them would either consume the secret (destroying it for the intended recipient) or hit 404s. Block the entire `/secret/` path prefix.

**File: `client/public/sitemap.xml`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://secureshare.app/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

**Why only one URL in sitemap:** SecureShare has one indexable page: the homepage. Secret URLs are ephemeral and blocked in robots.txt. There is no blog, no about page, no docs page in the MVP. The sitemap exists for completeness and to signal to search engines that the homepage is the canonical entry point.

**Express middleware order verification:** The current `server/src/app.ts` (lines 63-81) already serves static before catch-all:

```typescript
app.use(express.static(clientDistPath, { index: false })); // serves robots.txt
app.get('{*path}', (req, res) => { /* SPA catch-all */ }); // after static
```

A request for `/robots.txt` hits `express.static` first, finds the file, and returns it. The catch-all never fires. No code changes needed on the server.

**Confidence:** HIGH -- verified against existing Express middleware order in `server/src/app.ts` and Vite's public directory documentation.

### 8. CSP Implications Summary

| Feature | CSP Directive | Impact | Action Required |
|---------|--------------|--------|-----------------|
| Inline SVGs (Lucide createElement) | None | DOM createElement, not img-src | None |
| CSS animations (@keyframes) | style-src | Compiled into stylesheet (self) | None |
| backdrop-filter (glassmorphism) | style-src | CSS property, not inline style | None |
| Monospace system fonts | font-src | System fonts, no external loading | None |
| Open Graph meta tags | None | Meta tags, not resources | None |
| robots.txt / sitemap.xml | None | Static text/XML files | None |
| Button scale transitions | style-src | CSS transitions in stylesheet | None |

**Summary:** No CSP changes required. All new features use DOM APIs (`createElement` / `createElementNS`), compiled CSS (Tailwind output), and static files. The existing nonce-based CSP with `'self'` for all resource types covers everything.

**One caveat:** If a future phase adds an external font (e.g., Google Fonts for a custom monospace), `font-src` and `style-src` would need allowlisting of external domains. The current recommendation (system monospace stack) avoids this entirely.

---

## Patterns to Follow

### Pattern 1: Component Factory Functions

**What:** Every UI element is a function that returns an `HTMLElement`. No classes, no JSX, no template strings.

**When:** Always. This is the established codebase pattern.

**Example (existing, from copy-button.ts):**

```typescript
export function createCopyButton(
  getText: () => string,
  label?: string,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = '...tailwind classes...';
  // ... event listeners, children ...
  return button;
}
```

**Apply to:** `renderHeader()`, `renderFooter()`, `icon()` utility. All new UI code follows this pattern.

### Pattern 2: Semantic Color Tokens Over Raw Colors

**What:** Use semantic token names (`surface-900`, `glass-bg`) not raw values (`oklch(0.16 0.01 250)`) or default Tailwind grays. Define once in `@theme`, reference everywhere via Tailwind classes.

**When:** Any color usage in dark-themed elements.

**Why:** Changing the palette means updating `@theme` only. Pages never hardcode color values.

**Example:**

```typescript
// Good: semantic token
card.className = 'bg-surface-800 border-surface-600';

// Bad: hardcoded or Tailwind default gray
card.className = 'bg-gray-900 border-gray-700';
```

### Pattern 3: Motion-Safe Animation Guard

**What:** Prefix all animations with `motion-safe:` so they respect `prefers-reduced-motion`.

**When:** Every `animate-*` class usage.

**Example:**

```typescript
wrapper.className = 'motion-safe:animate-fade-in';
// NOT: wrapper.className = 'animate-fade-in';
```

**Existing precedent:** `loading-spinner.ts` line 23: `motion-reduce:animate-none`.

### Pattern 4: Icon Utility for Consistency

**What:** Always use the `icon()` utility function, never raw `document.createElementNS` for icons.

**When:** Any icon usage, including replacing existing inline SVGs (confirmation.ts shield icon) and emoji icons (error.ts, reveal.ts).

**Why:** Consistent attributes (`aria-hidden`, `stroke-width`), tree-shakable imports, significantly less code per icon (2 lines vs 26 lines).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Theme Toggle State Management

**What:** Adding localStorage-based light/dark toggle with JavaScript state management.

**Why bad:** Doubles CSS testing surface, introduces flash-of-wrong-theme (FOWT) on page load, adds complexity for a feature nobody requested. SecureShare is dark-by-design.

**Instead:** Hard-code the dark surface palette. Use the surface tokens everywhere. If a toggle is ever needed later, the token architecture supports it without refactoring pages.

### Anti-Pattern 2: Inline Style Attributes for Animation

**What:** Using `element.style.transform = ...` or `element.style.opacity = ...` for animations.

**Why bad:** May conflict with CSP if `style-src` enforcement becomes stricter (some browsers treat `element.style.*` assignments as inline styles under certain CSP configurations). More importantly, it bypasses Tailwind's design system and the `prefers-reduced-motion` guards.

**Instead:** Use Tailwind animation classes (`motion-safe:animate-fade-in`) or CSS transition utilities (`transition-all duration-200`). Add custom keyframes to `@theme`.

**Exception:** The existing `fallbackCopy()` in `copy-button.ts` uses `textarea.style.position = 'fixed'` for the clipboard fallback. This is acceptable because it is a hidden utility element, not a visual animation, and the textarea is immediately removed from the DOM.

### Anti-Pattern 3: Heavy Icon Bundles

**What:** Importing all Lucide icons or using the `data-lucide` attribute scan pattern (`createIcons()` with no icon whitelist).

**Why bad:** Bundles 1600+ icons (~200KB+). The `createIcons()` function without explicit icon set pulls everything in. Vite does NOT tree-shake in dev mode for Lucide, causing slow dev startup.

**Instead:** Import only named icons: `import { Shield, Lock } from 'lucide'`. Pass them to `createElement()` directly. This tree-shakes to only the used icons in production builds.

### Anti-Pattern 4: SEO Meta Tags Only in index.html

**What:** Setting meta description and canonical in the static HTML template and never updating them dynamically.

**Why bad:** All routes serve the same meta description. Google sees duplicate content signals. The canonical URL never changes from `/`, making secret pages canonicalize to the homepage unnecessarily.

**Instead:** Dynamically update meta tags on each route change via the extended `updatePageMeta()`. Set `noindex` on ephemeral pages (secrets, errors).

### Anti-Pattern 5: Glassmorphism on Everything

**What:** Applying `backdrop-filter: blur()` to every card, button, and container.

**Why bad:** Each blur element creates a GPU compositing layer. More than 3-4 per viewport causes jank on mobile, especially older devices. Defeats the <1s 3G performance target from NFR-2.

**Instead:** Apply glassmorphism to 1-2 hero elements per page (the main form card, the how-it-works section). Use solid `bg-surface-800` for secondary elements.

---

## Build Order: What Depends on What

The dependency graph determines implementation sequence. Each step must complete before dependent steps begin.

```
Phase 1: Foundation (no dependencies, can be parallel)
  |
  +-- 1a. @theme dark palette extension (styles.css)
  |       All subsequent UI work depends on having the color tokens.
  |
  +-- 1b. Icon utility module (icons.ts) + npm install lucide
  |       Header, footer, and page updates depend on the icon system.
  |
  +-- 1c. SEO static files (robots.txt, sitemap.xml in client/public/)
  |       No code dependencies. Can ship independently.

Phase 2: Layout Shell (depends on 1a + 1b)
  |
  +-- 2a. Header component (header.ts)
  |       Uses icon utility + dark palette tokens.
  |
  +-- 2b. Footer component (footer.ts)
  |       Uses icon utility + dark palette tokens.
  |
  +-- 2c. index.html structure update
  |       Add <header id="site-header"> and <footer id="site-footer">
  |       containers, update body classes, add OG meta tags.
  |
  +-- 2d. app.ts initialization update
  |       Import and render header/footer at startup.

Phase 3: Theme Migration (depends on 1a, can parallel with Phase 2)
  |
  +-- 3a. Page class updates (create.ts, confirmation.ts, reveal.ts, error.ts)
  |       Replace text-gray-900/bg-gray-50 with surface-*/text-gray-100 tokens.
  |       Replace emoji icons with Lucide icons via icon utility (depends on 1b).
  |
  +-- 3b. Component class updates (copy-button.ts, expiration-select.ts,
  |       loading-spinner.ts)
  |       Update to dark palette tokens.
  |
  +-- 3c. Glassmorphism card styling
  |       Apply glass-card class to main form containers.

Phase 4: Animations (depends on 1a + 3a)
  |
  +-- 4a. Page transition animations
  |       Add motion-safe:animate-fade-in to page wrappers.
  |
  +-- 4b. Micro-interactions
  |       Button hover/active scale, enhanced focus ring transitions.
  |
  +-- 4c. Ambient glow effects
  |       Subtle glow-pulse on primary CTA card.

Phase 5: SEO Router (can start after Phase 2c)
  |
  +-- 5a. updatePageMeta() signature refactor
  |       Change from string param to PageMeta object.
  |
  +-- 5b. Update all call sites across pages
  |       Each page passes title, description, and noindex flag.
  |
  +-- 5c. Static OG tags in index.html
  |       Add Open Graph meta tags to HTML template.
```

**Why this order:**

1. **Palette first** because every other change references the color tokens. Without `surface-800`, `glass-bg`, etc., nothing can be styled correctly.

2. **Icons in parallel with palette** because header/footer and page updates both need icons. Building icons after layout would require placeholder SVGs that get replaced later.

3. **Layout shell before page theme migration** because the header/footer establish the visual frame. Migrating page styles without the surrounding frame makes it impossible to judge overall visual coherence during development.

4. **Animations last** because they are enhancement, not structure. The app must look correct with the dark theme before adding motion. Animations also need the final color tokens (e.g., glow colors matching `primary-500`).

5. **SEO router after layout update** because the `updatePageMeta()` signature refactor touches every page file. Doing it during the theme migration (Phase 3) risks merge conflicts and makes diffs harder to review. Separating it keeps each phase focused.

---

## New Files to Create

| File | Type | Purpose |
|------|------|---------|
| `client/src/components/icons.ts` | Utility | Lucide icon creation with project defaults |
| `client/src/components/header.ts` | Component | Persistent site header with branding + nav |
| `client/src/components/footer.ts` | Component | Persistent site footer with links |
| `client/public/robots.txt` | Static | Search engine crawl directives |
| `client/public/sitemap.xml` | Static | Sitemap for search engine indexing |

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/styles.css` | Extend @theme with surface palette, glass tokens, font-mono, animations, glass-card component class |
| `client/index.html` | Add header/footer containers, update body classes to dark theme, add OG meta tags, add initial meta description |
| `client/src/app.ts` | Import and render header/footer at startup |
| `client/src/router.ts` | Extend `updatePageMeta()` to `PageMeta` object with description, canonical, noindex |
| `client/src/pages/create.ts` | Dark theme classes, Lucide icons, glass card wrapper |
| `client/src/pages/confirmation.ts` | Dark theme classes, replace 26-line inline SVG with icon utility |
| `client/src/pages/reveal.ts` | Dark theme classes, replace emoji icons with Lucide SVGs |
| `client/src/pages/error.ts` | Dark theme classes, replace emoji icons with Lucide SVGs |
| `client/src/components/copy-button.ts` | Dark theme classes (button colors, focus ring) |
| `client/src/components/expiration-select.ts` | Dark theme classes (select background, border, text) |
| `client/src/components/loading-spinner.ts` | Dark theme classes (spinner border colors) |

## Files NOT Modified

| File | Why |
|------|-----|
| `server/src/app.ts` | express.static already serves from client/dist before SPA catch-all |
| `server/src/middleware/security.ts` | CSP is unchanged -- no new resource types introduced |
| `vite.config.ts` | Public directory is the Vite default (`client/public`), no config needed |
| `client/src/crypto/*` | Crypto module is pure logic, no UI concerns |
| `client/src/api/*` | API client is pure logic, no UI concerns |
| `server/src/routes/*` | API routes are unaffected by UI changes |
| `server/src/services/*` | Business logic is unaffected |

---

## Scalability Considerations

| Concern | Current (MVP) | At Scale |
|---------|--------------|----------|
| Icon bundle size | ~5-10 icons, ~2-3KB gzipped | If 50+ icons needed, consider icon sprites or lazy SVG loading |
| Glassmorphism performance | 2-3 elements, fine on mobile | Audit with Chrome Performance panel. Consider dropping blur on low-end devices via `@supports` fallback |
| SEO meta updates | 3-4 routes, manual per-page | If routes grow, create a route config map for meta data |
| Animation count | 3 keyframes, lightweight | Keep under 5 active animations per viewport. Profile paint/composite costs |
| Font loading | System monospace, zero network requests | If custom font added later, use `font-display: swap` and update CSP font-src |

---

## Sources

- [Tailwind CSS 4 Dark Mode Documentation](https://tailwindcss.com/docs/dark-mode) -- @custom-variant dark, class-based dark mode, prefers-color-scheme default
- [Tailwind CSS 4 Animation Documentation](https://tailwindcss.com/docs/animation) -- @keyframes in @theme, motion-safe/motion-reduce variants, custom animate-* utilities
- [Tailwind CSS v4 Dark Mode CSS Variables Discussion](https://github.com/tailwindlabs/tailwindcss/discussions/15083) -- @variant dark pattern with @layer theme, light-dark() CSS function
- [Lucide Vanilla JS Package Documentation](https://lucide.dev/guide/packages/lucide) -- createElement API, tree-shaking imports, custom attributes
- [Vite Static Asset Handling](https://vite.dev/guide/assets) -- public directory behavior, robots.txt serving pattern
- [Glassmorphism Implementation Guide 2025](https://playground.halfaccessible.com/blog/glassmorphism-design-trend-implementation-guide) -- backdrop-filter patterns, performance limits, accessibility
- [Modern Monospace Font Stacks](https://modernfontstacks.com/) -- system monospace font-family recommendations
- [SPA SEO Best Practices](https://www.mindk.com/blog/optimizing-single-page-applications/) -- meta tag management, robots.txt, sitemap for SPAs
- [CSP and Inline SVG](https://grayduck.mn/2016/04/09/black-icons-with-svg-and-csp/) -- createElement SVGs are DOM nodes, not img-src resources
