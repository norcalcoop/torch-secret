# Feature Landscape: Dark-Themed Developer UI Redesign + SEO Infrastructure

**Domain:** Developer-audience UI theming, SVG icon systems, micro-interactions, SEO for SPAs
**Researched:** 2026-02-15
**Overall Confidence:** HIGH -- verified against Tailwind CSS v4 official docs, Lucide official docs, MDN specs, and multiple cross-referenced sources

## Context

SecureShare v1.0 is functionally complete: encryption, create/reveal/confirm/error pages, password protection, expiration, WCAG 2.1 AA accessibility, and mobile responsiveness. The UI works but uses a generic light-mode design with basic Tailwind utility classes, emoji icons, and no SEO infrastructure. This milestone transforms the visual identity to match developer tool products (Vercel, Linear, Resend aesthetic) and adds the SEO foundation needed for organic discovery.

### Existing UI Inventory (v1.0)

- **Color system:** Light-only, `bg-gray-50 text-gray-900` body, oklch-based `primary-*`, `danger-500`, `success-500`, `warning-500` custom theme colors
- **Typography:** System font stack (no monospace, no custom fonts)
- **Icons:** Emoji characters (shield, lock, key, warning, magnifying glass, explosion) via `textContent`
- **Components:** 3 components (copy-button, expiration-select, loading-spinner), 4 pages (create, reveal, confirmation, error)
- **Transitions:** Only `transition-colors` on buttons and links
- **SEO:** Zero -- no meta description, no OG tags, no favicon, no robots.txt, no sitemap, no structured data
- **Theme:** Single-theme, no dark mode support, no CSS variable-based theming

---

## Table Stakes

Features that are baseline expectations for a developer-audience tool in 2026. Missing any of these makes the redesign feel incomplete.

### 1. Dark Theme as Default

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Developer tools default to dark. VSCode, GitHub, Vercel, Linear, Resend, Stripe Dashboard, Railway -- all default dark or dark-only. A security tool for sharing API keys with a white background looks like a consumer product, not a professional tool. |
| **Complexity** | MEDIUM -- refactoring all existing Tailwind classes from light-first to dark-first, defining a cohesive dark color palette with oklch values, testing contrast ratios across all pages/states |
| **Implementation** | Tailwind CSS v4 dark mode via `@custom-variant dark (&:where(.dark, .dark *))` on the `<html>` element. Define semantic color tokens as CSS custom properties in `@theme` block. Dark background should be near-black (oklch ~0.13-0.15 range), not charcoal gray. |
| **Confidence** | HIGH -- verified via [Tailwind CSS v4 dark mode docs](https://tailwindcss.com/docs/dark-mode) |

**What "done" looks like:**
- Body background: deep navy-black (not pure `#000`, which causes halation on OLED screens)
- Card/panel surfaces: slightly elevated grays (1-2 lightness steps above background)
- Text hierarchy: white for headings, `gray-400` for body, `gray-500` for secondary text
- All existing light-mode colors replaced with dark-first equivalents
- Color contrast ratios meet WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text)

### 2. System Color Scheme Toggle (Light/Dark/System)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Users with light-mode OS preferences or accessibility needs must not be locked into dark mode. Every serious developer tool (GitHub, VSCode, Linear) offers light/dark/system toggle. WCAG does not require dark mode, but forcing it without escape violates user autonomy. |
| **Complexity** | LOW -- JavaScript toggle + localStorage persistence + `prefers-color-scheme` media query detection |
| **Implementation** | Three-state toggle: Dark (default), Light, System. Store preference in `localStorage.theme`. On load, check `localStorage` first, then `window.matchMedia('(prefers-color-scheme: dark)')`. Toggle applies/removes `.dark` class on `<html>`. Update `<meta name="theme-color">` on toggle for mobile browser chrome. |
| **Confidence** | HIGH -- standard pattern documented in [Tailwind CSS dark mode docs](https://tailwindcss.com/docs/dark-mode) |

**Dependencies:**
- Requires dark theme color system (Feature 1) to be fully defined first
- Requires all components to have both `dark:` and light-mode classes
- Must persist across page navigations (SPA router already handles this)

### 3. Semantic Color Token System via CSS Custom Properties

| Aspect | Detail |
|--------|--------|
| **Why Expected** | The v1.0 CSS has hardcoded oklch values in `@theme`. For two themes to work, colors must flow through CSS custom properties that change based on theme context. This is the foundation for Features 1 and 2. |
| **Complexity** | MEDIUM -- define full token vocabulary (surface, elevated, border, text-primary, text-secondary, text-muted, accent, danger, success, warning), assign oklch values for light and dark variants |
| **Implementation** | Define variables under `:root` (light) and `.dark` (dark) selectors, then reference in `@theme` using `var()`. Tailwind v4 supports this natively. Pattern: `--color-surface: oklch(0.13 0.02 250)` in `.dark`, `--color-surface: oklch(0.98 0.01 250)` in `:root`. |
| **Confidence** | HIGH -- verified via [Tailwind CSS theme docs](https://tailwindcss.com/docs/theme) and [Tailwind v4 discussions](https://github.com/tailwindlabs/tailwindcss/discussions/15083) |

### 4. Lucide SVG Icon System (Replace Emoji Icons)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | The v1.0 UI uses emoji characters (`\u{1F6E1}`, `\u{1F512}`, etc.) for icons. Emoji render inconsistently across OS/browser, cannot be styled (no color control, no stroke-width), and look unprofessional in a developer tool. SVG icons are the standard for production apps. |
| **Complexity** | LOW -- Lucide's vanilla JS API is straightforward; replacing emoji with `createElement` calls is mechanical |
| **Implementation** | Install `lucide` (not `lucide-react`). Import individual icons via tree-shaking: `import { Shield, Lock, Key, AlertTriangle, Copy, Check, Clock, Eye, EyeOff } from 'lucide'`. Use `createElement(IconName, { class: '...', 'stroke-width': 1.5 })` to create SVG elements programmatically. This matches the existing DOM-creation pattern in all pages. |
| **Confidence** | HIGH -- verified via [Lucide vanilla JS docs](https://lucide.dev/guide/packages/lucide) |

**Key icons needed (mapped from current emoji usage):**
| Current Emoji | Replacement Icon | Context |
|---------------|-----------------|---------|
| Shield emoji | `ShieldCheck` | Confirmation page success icon, reveal interstitial |
| Lock emoji | `Lock` | Password required page, "not available" error |
| Key emoji | `KeyRound` | "Invalid link" error (missing key) |
| Warning emoji | `AlertTriangle` | Decryption failed error |
| Magnifying glass emoji | `Search` | "Page not found" error |
| Explosion emoji | `ShieldOff` or `Trash2` | "Secret destroyed" error |
| (new) | `Copy`, `Check` | Copy button default/success states |
| (new) | `Clock` | Expiration display |
| (new) | `Eye`, `EyeOff` | Reveal/hide toggle |
| (new) | `Plus` | "Create New Secret" actions |
| (new) | `Sun`, `Moon`, `Monitor` | Theme toggle |

**Bundle impact:** Each Lucide icon is ~200-500 bytes of SVG path data. Importing 15-20 icons adds ~5-8KB (before gzip), roughly ~2KB gzipped. Negligible compared to the ~140KB React bundle this project deliberately avoided.

### 5. Monospace Typography for Code-Adjacent Content

| Aspect | Detail |
|--------|--------|
| **Why Expected** | The target audience writes and reads code daily. Monospace type for secrets, URLs, and code-like content signals "this is a developer tool." The revealed secret `<pre>` already uses `font-mono`, but the overall typography stack has no intentionality. |
| **Complexity** | LOW -- add a web font, apply to specific elements |
| **Implementation** | Use **JetBrains Mono** self-hosted via `@fontsource-variable/jetbrains-mono`. Apply to: secret textarea, revealed secret display, share URL input, character counter, any code-formatted content. Pair with system sans-serif for body/UI text. Self-hosting is required for privacy (no Google Fonts CDN) and CSP compliance (current CSP allows only `'self'` for `font-src`). |
| **Confidence** | HIGH -- JetBrains Mono available on [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono) and [GitHub](https://github.com/JetBrains/JetBrainsMono) |

**CSP consideration:** The existing `fontSrc: ["'self'"]` in `security.ts` means fonts MUST be self-hosted. Google Fonts CDN would require adding `fonts.googleapis.com` and `fonts.gstatic.com` to CSP, which is unnecessary complexity when self-hosting ~100KB of WOFF2 files.

### 6. Basic Meta Tags and OG Tags

| Aspect | Detail |
|--------|--------|
| **Why Expected** | The current `index.html` has only `<title>SecureShare</title>`. No description, no OG tags, no Twitter card tags. When anyone shares the homepage URL in Slack/Discord/X, it renders as a blank card with just "SecureShare." This is a missed branding opportunity and signals amateurism. |
| **Complexity** | LOW -- static meta tags in `index.html`, dynamic `document.title` already handled by router |
| **Implementation** | Add to `<head>`: `<meta name="description">`, `og:title`, `og:description`, `og:type` (website), `og:url`, `og:image`, `og:site_name`, `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`. |
| **Confidence** | HIGH -- standard web practices, verified via [Open Graph protocol](https://ogp.me/) |

**SECURITY CRITICAL:** OG tags apply ONLY to the homepage and marketing pages. Secret reveal URLs (`/secret/:id`) must NEVER have meaningful OG content -- they should use the same generic SecureShare branding. The OG image should be a static branded image, never dynamically generated from secret content.

### 7. Favicon and Apple Touch Icon

| Aspect | Detail |
|--------|--------|
| **Why Expected** | No favicon means the browser shows a generic document icon in tabs. This is the most visible signal that a site is unfinished. Every production web app has a favicon. |
| **Complexity** | LOW -- create icon files, add `<link>` tags to HTML |
| **Implementation** | Follow the [Evil Martians minimal favicon approach](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs): (1) `favicon.svg` with embedded `prefers-color-scheme` media query for dark/light mode adaptation, (2) `favicon.ico` (32x32) for legacy browsers, (3) `apple-touch-icon.png` (180x180) for iOS, (4) `icon-192.png` and `icon-512.png` for Android/PWA. Total: 5 files. |
| **Confidence** | HIGH -- verified via [Evil Martians favicon guide](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) and [MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest) |

**SVG favicon dark mode:** The SVG favicon can embed a `<style>` block with `@media (prefers-color-scheme: dark)` to invert colors automatically. This tracks the OS preference (not the app's theme toggle), which is the expected behavior for favicons.

### 8. Web App Manifest

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Required for PWA installability, and produces a polished "Add to Home Screen" experience on mobile. Even without full PWA features, the manifest provides correct icons and theme colors. |
| **Complexity** | LOW -- single JSON file + `<link>` tag |
| **Implementation** | Create `site.webmanifest` with: `name`, `short_name`, `start_url: "/"`, `display: "standalone"`, `background_color` (dark navy to match theme), `theme_color`, `icons` array with 192x192 and 512x512 PNGs (one set maskable). Link from HTML: `<link rel="manifest" href="/site.webmanifest">`. |
| **Confidence** | HIGH -- verified via [web.dev PWA manifest guide](https://web.dev/learn/pwa/web-app-manifest) and [MDN](https://developer.mozilla.org/en-US/docs/Web/Manifest) |

### 9. robots.txt and Sitemap

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Search engines need crawl guidance. Without `robots.txt`, crawlers hit every URL including `/secret/:id` paths, which return identical "not available" error pages and waste crawl budget. |
| **Complexity** | LOW -- two static files |
| **Implementation** | `robots.txt`: Allow crawling of `/` (homepage), Disallow `/api/` (API endpoints). Do NOT disallow `/secret/` paths -- that would [expose the URL pattern to attackers](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Robots_txt). Instead, handle via `noindex` meta tags on secret pages (see Feature 11). `sitemap.xml`: List only the homepage URL. This is a single-page app with one indexable route. |
| **Confidence** | HIGH -- verified via [Google robots.txt docs](https://developers.google.com/search/docs/crawling-indexing/robots/intro) and [MDN robots.txt security guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Robots_txt) |

**SECURITY NOTE:** Never list secret paths in `robots.txt` disallow rules. The `robots.txt` file is publicly accessible, and listing paths there [acts as a map for attackers](https://www.thesmartscanner.com/blog/is-your-robots-txt-file-vulnerable-here-s-how-to-check-and-secure-it). Use `noindex` meta tags instead.

---

## Differentiators

Features that elevate SecureShare above a generic implementation. Not strictly required, but they create the "this feels like a real product" impression that builds trust.

### 10. Glassmorphism Card Surfaces

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Flat cards on a dark background look like a Bootstrap template. Glassmorphism (translucent panels with backdrop blur) creates visual depth and a premium feel, immediately signaling modern design. Vercel's dashboard, Linear's UI, and Apple's macOS/iOS all use this pattern. |
| **Complexity** | LOW -- Tailwind utility classes only, no custom CSS needed |
| **Implementation** | Apply to card/panel containers: `backdrop-blur-md bg-white/5 border border-white/10 rounded-xl shadow-lg`. On dark backgrounds, use white-tinted transparency (`bg-white/5` to `bg-white/10`). Limit to 2-3 glassmorphic elements per viewport for performance. The `backdrop-blur` filter is GPU-accelerated on modern browsers. |
| **Confidence** | HIGH -- verified via [Epic Web Dev glassmorphism guide](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) |

**Performance constraint:** `backdrop-filter: blur()` can cause jank on low-end mobile devices. Limit glassmorphic surfaces to: the main form card, the revealed secret card, and the confirmation card. Do NOT apply to scrollable content or animated elements.

**Accessibility constraint:** Glassmorphism can reduce text readability. Ensure text on glass surfaces has sufficient contrast by using adequately opaque backgrounds (`bg-white/10` minimum) and testing with WCAG contrast checkers.

### 11. noindex on Secret Routes (SPA-Specific SEO Handling)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Secret URLs (`/secret/:id`) must never appear in search results. Even though they show "not available" after viewing, a search index entry for `secureshare.com/secret/abc123` signals that secrets exist at those paths. This is a privacy concern, not a functional one. |
| **Complexity** | LOW -- dynamic meta tag injection in the SPA router |
| **Implementation** | In the SPA router's `handleRoute()`, inject `<meta name="robots" content="noindex, nofollow">` for secret routes. Remove it for the homepage. Also set `X-Robots-Tag: noindex` header on the server for `/secret/*` paths (belt-and-suspenders approach). |
| **Confidence** | HIGH -- standard practice for sensitive URL patterns in SPAs |

### 12. Structured Data (JSON-LD)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | JSON-LD structured data helps search engines understand what SecureShare is, potentially enabling rich snippets. A `WebApplication` schema with security-focused descriptions positions SecureShare accurately in search results. |
| **Complexity** | LOW -- single `<script type="application/ld+json">` block in `index.html` |
| **Implementation** | Add `WebApplication` schema: `name`, `description`, `url`, `applicationCategory` ("SecurityApplication"), `operatingSystem` ("All"), `offers` (free). This is static content in the HTML head. No dynamic generation needed. |
| **Confidence** | MEDIUM -- structured data helps with search understanding but rich snippet display is not guaranteed |

### 13. Micro-Interactions with Reduced-Motion Support

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | The v1.0 UI has zero animation beyond `transition-colors` on buttons. Adding purposeful micro-interactions (button press feedback, card entrance transitions, copy success animation, encryption progress indicator) makes the app feel responsive and premium. The encryption step ("Encrypting in your browser...") is especially powerful -- a subtle animation reinforces the zero-knowledge promise. |
| **Complexity** | MEDIUM -- requires defining a motion system, implementing CSS transitions/keyframes, and ensuring every animation respects `prefers-reduced-motion` |

**Motion inventory (what to animate):**

| Element | Animation | Purpose | Duration |
|---------|-----------|---------|----------|
| Page transitions | Fade-in with slight upward slide | Smooth route changes | 200ms |
| Card entrance | Fade + scale from 0.98 to 1.0 | Visual hierarchy establishment | 250ms |
| Button press | Scale to 0.97 on `:active` | Tactile press feedback | 100ms |
| Button hover | Background color shift | Interactivity signal | 150ms |
| Copy success | Icon swap (Copy to Check) with scale pulse | Confirmation feedback | 200ms + 2s hold |
| Loading spinner | Rotation (already exists via `animate-spin`) | Processing state | Continuous |
| Encryption progress | Pulsing glow or typing-cursor blink | "Encrypting locally" reinforcement | During encrypt |
| Error state | Subtle shake or red flash | Invalid input feedback | 300ms |
| Theme toggle | Icon rotation or morph | Theme change feedback | 250ms |

**Reduced-motion handling:** The existing `loading-spinner.ts` already uses `motion-reduce:animate-none`, which is the correct Tailwind pattern. All new animations must follow this precedent.

### 14. Terminal/Code-Block Aesthetic for Secret Display

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | The revealed secret currently uses generic text styling. Styling it like a terminal or code editor (dark background, monospace font, subtle line numbers or command prompt indicator) immediately signals "this is for developers." |
| **Complexity** | LOW -- CSS styling only, no logic changes |
| **Implementation** | Apply terminal-style classes to the secret display: deep dark background (darker than the card surface), JetBrains Mono font, green or cyan accent for the "prompt" indicator, optional header bar with copy button (like a code block header in documentation sites). |

### 15. Branded OG Image

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | When someone shares the SecureShare homepage URL in Slack/Discord/X, the preview card should show a professional branded image -- not a blank card or generic favicon. This is the primary marketing touchpoint in the viral loop. |
| **Complexity** | LOW -- static image file, referenced in OG meta tags |
| **Implementation** | Create a 1200x630px OG image with: SecureShare logo/wordmark, tagline ("Zero-knowledge secret sharing"), dark theme visual. Place in `client/public/og-image.png`. Reference in `<meta property="og:image">`. |

---

## Anti-Features

Features that seem related to this milestone but should be explicitly avoided.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Light Mode as Default | Developer tools default to dark. Since this is a full visual redesign, flip the default now. | Make dark the default. Light mode exists as a toggle option. |
| Dynamic OG Images per Secret | Could leak secret metadata (creation time, password status) in preview images. Security violation. | Single static OG image for all pages. |
| Complex Animation Library (GSAP, Framer Motion) | 15-40KB for a handful of micro-interactions. Framer Motion requires React (impossible here). GSAP has licensing complexities. | CSS transitions and `@keyframes` in Tailwind v4 `@theme`. |
| Full PWA with Service Worker | Caching secrets is a security risk. Offline mode is meaningless for a tool requiring network access. | Web manifest for theme-color and mobile icon only. No service worker. |
| SSR or Pre-Rendering for SEO | Requires architecture change. Only ONE indexable page (homepage). Near-zero ROI. | Static meta tags in index.html. |
| CSS-in-JS or Styled Components | Conflicts with Tailwind CSS v4 build pipeline. Adds runtime overhead. | Tailwind utility classes + `@theme` CSS variables. |
| Icon Font (Font Awesome, Material Icons) | 100-300KB for 15 icons. Cannot tree-shake. FOIT/FOUT issues. | Lucide SVG with per-icon imports. |
| Custom Theme Builder | Over-engineering. Nobody asked for user-selected color palettes. | Ship dark + light. Two themes total. |

---

## Feature Dependencies

```
[Semantic Color Token System (CSS Custom Properties)]
    |-- required by --> [Dark Theme as Default]
    |-- required by --> [System Color Scheme Toggle]
    |-- required by --> [Glassmorphism Card Surfaces]
    |-- required by --> [Terminal/Code-Block Aesthetic]

[Dark Theme as Default]
    |-- required by --> [System Color Scheme Toggle] (light variant needed)
    |-- enhances --> [Favicon with Dark Mode Support]
    |-- enhances --> [Web App Manifest] (background_color must match theme)

[Lucide SVG Icon System]
    |-- independent, no prerequisites
    |-- enhances --> [Copy Button Micro-Interactions] (icon swap Copy->Check)
    |-- enhances --> [Theme Toggle] (Sun/Moon/Monitor icons)
    |-- enhances --> [Error Pages] (consistent icon styling)

[Monospace Typography]
    |-- independent, no prerequisites
    |-- required by --> [Terminal/Code-Block Aesthetic]

[Meta Tags / OG Tags]
    |-- independent, no prerequisites
    |-- requires --> [OG Image] (static asset must exist before og:image tag references it)

[Favicon + Apple Touch Icon]
    |-- independent, no prerequisites
    |-- enhances --> [Web App Manifest] (manifest references same icon files)

[Web App Manifest]
    |-- requires --> [Favicon/Icon files] (manifest icons field)
    |-- requires --> [Dark Theme] (for background_color and theme_color values)

[robots.txt + Sitemap]
    |-- independent, no prerequisites
    |-- complemented by --> [noindex on Secret Routes]

[noindex on Secret Routes]
    |-- requires modification to --> [SPA Router] (dynamic meta tag injection)

[Micro-Interactions]
    |-- requires --> [Dark Theme as Default] (animations must look right on dark surfaces)
    |-- requires --> [Lucide Icons] (icon swap animations need SVG icons)
    |-- must respect --> [prefers-reduced-motion] (existing precedent in loading-spinner.ts)

[Glassmorphism Card Surfaces]
    |-- requires --> [Dark Theme as Default] (glass effects need dark background to be visible)

[Structured Data (JSON-LD)]
    |-- independent, no prerequisites
```

### Dependency Summary

Three foundational features must be built first:
1. **Semantic Color Token System** -- everything visual depends on this
2. **Dark Theme** -- glassmorphism, terminal aesthetic, and micro-interactions are designed for dark surfaces
3. **Lucide Icons** -- micro-interaction animations (copy button icon swap) require SVG icons

The SEO features (meta tags, OG, favicon, manifest, robots.txt, sitemap, structured data, noindex) are fully independent of the UI features and can be built in parallel.

---

## MVP Recommendation for This Milestone

### Must Ship (Core)

1. **Semantic Color Token System** -- foundation for everything; build first
2. **Dark Theme as Default** -- the defining visual change; highest user impact
3. **System Color Scheme Toggle** -- accessibility requirement; cannot force dark-only
4. **Lucide SVG Icons** -- replace all emoji; mechanical but essential
5. **Monospace Typography (JetBrains Mono)** -- developer identity signal
6. **Favicon + Apple Touch Icon** -- most visible "unfinished" signal
7. **Basic Meta Tags + OG Tags** -- baseline SEO; 10 minutes of work with outsized impact
8. **robots.txt + Sitemap** -- basic crawl guidance

### Should Ship (Polish)

9. **Web App Manifest** -- 5 minutes of work once icons exist; enables mobile "Add to Home Screen"
10. **Glassmorphism Card Surfaces** -- premium feel; low effort with Tailwind utilities
11. **Terminal/Code-Block Aesthetic** -- developer identity; CSS-only changes
12. **Micro-Interactions** -- button states, copy feedback, page transitions; brings the UI to life
13. **noindex on Secret Routes** -- privacy-hardening; low effort

### Defer (Nice to Have)

14. **Structured Data (JSON-LD)** -- marginal SEO value for a single-page app; add later
15. **Branded OG Image** -- requires design work; text-only social previews are acceptable temporarily

---

## Sources

### Tailwind CSS Dark Mode and Theming
- [Tailwind CSS v4 Dark Mode docs](https://tailwindcss.com/docs/dark-mode) -- HIGH confidence
- [Tailwind CSS v4 Theme docs](https://tailwindcss.com/docs/theme) -- HIGH confidence
- [Tailwind v4 dark/light CSS variables discussion](https://github.com/tailwindlabs/tailwindcss/discussions/15083) -- MEDIUM confidence

### Lucide Icons
- [Lucide vanilla JS package guide](https://lucide.dev/guide/packages/lucide) -- HIGH confidence
- [Lucide icons library](https://lucide.dev/icons) -- HIGH confidence

### Typography
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) -- HIGH confidence
- [Fontsource JetBrains Mono](https://fontsource.org/fonts/jetbrains-mono/install) -- HIGH confidence

### Glassmorphism
- [Epic Web Dev: Glassmorphism with Tailwind CSS](https://www.epicweb.dev/tips/creating-glassmorphism-effects-with-tailwind-css) -- HIGH confidence

### SEO
- [Open Graph protocol](https://ogp.me/) -- HIGH confidence
- [Google robots.txt documentation](https://developers.google.com/search/docs/crawling-indexing/robots/intro) -- HIGH confidence
- [MDN robots.txt security guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Robots_txt) -- HIGH confidence
- [Google structured data docs](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript) -- HIGH confidence

### Favicon and Manifest
- [Evil Martians: How to Favicon in 2026](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) -- HIGH confidence
- [MDN: Web Application Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) -- HIGH confidence

---
*Feature landscape research for: SecureShare dark-themed developer UI redesign + SEO infrastructure*
*Researched: 2026-02-15*
