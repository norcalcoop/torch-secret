# Requirements: SecureShare

**Defined:** 2026-02-15
**Core Value:** Users can share sensitive information once, securely, without accounts or complexity -- the secret is encrypted in the browser, viewable only once, then permanently destroyed.

## v2.0 Requirements

Requirements for the Developer-Grade UI & SEO milestone. Each maps to roadmap phases.

### Theme & Design System

- [ ] **THEME-01**: App displays with dark terminal-inspired color scheme as default (deep navy-black backgrounds, light text)
- [ ] **THEME-02**: User can toggle between dark, light, and system color scheme preferences
- [ ] **THEME-03**: Theme preference persists across page refreshes and navigation via localStorage
- [ ] **THEME-04**: All colors use semantic CSS custom property tokens (surface, border, text) switchable by theme
- [ ] **THEME-05**: Primary content areas use glassmorphism card surfaces (backdrop-blur, translucent backgrounds)
- [ ] **THEME-06**: Page background displays subtle dot-grid pattern for visual texture
- [ ] **THEME-07**: Browser chrome (scrollbars, form controls) adapts to dark theme via color-scheme

### Typography

- [ ] **TYPO-01**: Headings and code contexts display in JetBrains Mono (self-hosted, no external CDN)
- [ ] **TYPO-02**: Body text uses system sans-serif for readability
- [ ] **TYPO-03**: Revealed secret displays in terminal code-block style (dark bg, green-tinted monospace, header bar with copy button)

### Icons

- [ ] **ICON-01**: All emoji icons replaced with Lucide SVG icons using CSP-safe presentation attributes
- [ ] **ICON-02**: Icon utility module provides consistent defaults (stroke-width, aria-hidden) via tree-shakable imports
- [ ] **ICON-03**: Theme toggle uses Sun/Moon/Monitor icons for dark/light/system states

### Layout

- [ ] **LAYOUT-01**: Persistent header displays shield icon + "SecureShare" wordmark on all pages
- [ ] **LAYOUT-02**: Non-create pages show a subtle "Create" navigation link in header
- [ ] **LAYOUT-03**: Persistent footer displays trust signals ("Zero-knowledge encryption" / "AES-256-GCM" / "Open Source")
- [ ] **LAYOUT-04**: Header and footer persist across SPA route changes (rendered outside #app)

### UI Enhancements

- [ ] **UI-01**: Confirmation page URL display combines input + copy button inline (single prominent block)
- [ ] **UI-02**: Textarea shows "Encrypted in your browser" indicator with lock icon when content is present
- [ ] **UI-03**: "How It Works" section uses SVG icons (browser/shield, server/lock, flame/destroy) instead of numbered circles
- [ ] **UI-04**: Revealed secret destruction confirmation displays as prominent green success badge with checkmark icon
- [ ] **UI-05**: Create page includes "Why Trust Us?" section with zero-knowledge, open source, no accounts, AES-256 points
- [ ] **UI-06**: Page transitions use fade-in-up animation (200ms ease-out)
- [ ] **UI-07**: Buttons have hover/active micro-interactions (scale, color shift)
- [ ] **UI-08**: Copy button shows icon swap animation (Copy to Check) on success
- [ ] **UI-09**: All animations respect prefers-reduced-motion via motion-safe / motion-reduce variants

### SEO

- [ ] **SEO-01**: Homepage has meta description, og:title, og:description, og:image, twitter:card tags
- [ ] **SEO-02**: Favicon suite serves favicon.svg (dark mode adaptive), favicon.ico, and apple-touch-icon.png
- [ ] **SEO-03**: robots.txt serves from client/public/ with proper directives (allow /, disallow /api/)
- [ ] **SEO-04**: sitemap.xml lists only the homepage URL
- [ ] **SEO-05**: Secret routes (/secret/*) get noindex, nofollow via dynamic meta tag and X-Robots-Tag header
- [ ] **SEO-06**: Secret routes serve minimal/generic OG tags (no indication that a secret exists at that URL)
- [ ] **SEO-07**: JSON-LD structured data block with WebApplication schema on homepage
- [ ] **SEO-08**: Web manifest (site.webmanifest) with app name, icons, and dark theme colors
- [ ] **SEO-09**: Noscript fallback content inside #app for crawlers that don't execute JS
- [ ] **SEO-10**: SPA router updatePageMeta() refactored to set title, description, canonical, and noindex per route

## Future Requirements

Deferred beyond v2.0. Tracked but not in current roadmap.

### Performance

- **PERF-01**: Lighthouse Performance score >= 95 on mobile
- **PERF-02**: Core Web Vitals pass (LCP < 2.5s, FID < 100ms, CLS < 0.1)

### Advanced SEO

- **ASEO-01**: Branded OG image (1200x630) designed to match dark theme aesthetic
- **ASEO-02**: Hreflang tags for future multi-language support

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full PWA with service worker | Caching secrets is a security risk; offline mode meaningless for network-dependent tool |
| SSR/pre-rendering for SEO | Only 1 indexable page; architecture change for near-zero ROI |
| CSS-in-JS or styled-components | Conflicts with Tailwind CSS 4 build pipeline |
| Custom theme builder | Over-engineering; dark + light + system is sufficient |
| Icon font (Font Awesome) | 100-300KB for 15 icons; cannot tree-shake; FOIT/FOUT issues |
| Dynamic OG images per secret | Could leak secret metadata; security violation |
| Google Fonts CDN | Privacy violation for zero-knowledge app; self-host only |
| Analytics/tracking scripts | No third-party scripts; XSS risk and privacy violation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 9 | Pending |
| THEME-02 | Phase 13 | Pending |
| THEME-03 | Phase 13 | Pending |
| THEME-04 | Phase 9 | Pending |
| THEME-05 | Phase 13 | Pending |
| THEME-06 | Phase 11 | Pending |
| THEME-07 | Phase 9 | Pending |
| TYPO-01 | Phase 9 | Pending |
| TYPO-02 | Phase 9 | Pending |
| TYPO-03 | Phase 12 | Pending |
| ICON-01 | Phase 11 | Pending |
| ICON-02 | Phase 9 | Pending |
| ICON-03 | Phase 13 | Pending |
| LAYOUT-01 | Phase 11 | Pending |
| LAYOUT-02 | Phase 11 | Pending |
| LAYOUT-03 | Phase 11 | Pending |
| LAYOUT-04 | Phase 11 | Pending |
| UI-01 | Phase 12 | Pending |
| UI-02 | Phase 12 | Pending |
| UI-03 | Phase 12 | Pending |
| UI-04 | Phase 12 | Pending |
| UI-05 | Phase 12 | Pending |
| UI-06 | Phase 13 | Pending |
| UI-07 | Phase 13 | Pending |
| UI-08 | Phase 13 | Pending |
| UI-09 | Phase 13 | Pending |
| SEO-01 | Phase 14 | Pending |
| SEO-02 | Phase 10 | Pending |
| SEO-03 | Phase 10 | Pending |
| SEO-04 | Phase 10 | Pending |
| SEO-05 | Phase 14 | Pending |
| SEO-06 | Phase 14 | Pending |
| SEO-07 | Phase 14 | Pending |
| SEO-08 | Phase 10 | Pending |
| SEO-09 | Phase 10 | Pending |
| SEO-10 | Phase 14 | Pending |

**Coverage:**
- v2.0 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-02-15*
*Last updated: 2026-02-15 after roadmap creation*
