# Roadmap: SecureShare

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-15)
- 🚧 **v2.0 Developer-Grade UI & SEO** — Phases 9-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) — SHIPPED 2026-02-15</summary>

- [x] Phase 1: Encryption Foundation (4/4 plans) — completed 2026-02-13
- [x] Phase 2: Database and API (3/3 plans) — completed 2026-02-14
- [x] Phase 3: Security Hardening (2/2 plans) — completed 2026-02-14
- [x] Phase 4: Frontend Create and Reveal (4/4 plans) — completed 2026-02-14
- [x] Phase 5: Password Protection (3/3 plans) — completed 2026-02-14
- [x] Phase 6: Expiration Worker (2/2 plans) — completed 2026-02-14
- [x] Phase 7: Trust and Accessibility (2/2 plans) — completed 2026-02-15
- [x] Phase 8: Tech Debt Cleanup (2/2 plans) — completed 2026-02-14

See [v1.0 Roadmap Archive](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

### 🚧 v2.0 Developer-Grade UI & SEO (In Progress)

**Milestone Goal:** Transform SecureShare from a functional prototype into a polished, dark-themed developer tool with full SEO infrastructure — same zero-knowledge functionality, professional presentation.

**Phase Numbering:**
- Integer phases (9, 10, 11...): Planned milestone work
- Decimal phases (9.1, 10.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 9: Design System Foundation** — Semantic color tokens, dark palette, typography, and icon utility module ✓
- [x] **Phase 10: SEO Static Assets** — Favicon, robots.txt, sitemap, web manifest, and noscript fallback (completed 2026-02-15)
- [ ] **Phase 11: Layout Shell + Component Migration** — Persistent header/footer, dot-grid background, and emoji-to-Lucide icon swap
- [ ] **Phase 12: Page-Level UI Enhancements** — Per-page feature upgrades: URL display, textarea indicator, trust section, code-block secrets
- [ ] **Phase 13: Theme Toggle + Visual Polish** — Dark/light/system toggle, glassmorphism, and micro-interaction animations
- [ ] **Phase 14: SEO Router Integration** — Dynamic meta tags, noindex on secret routes, JSON-LD structured data

## Phase Details

### Phase 9: Design System Foundation
**Goal**: The app has a complete dark visual identity with semantic design tokens, developer-grade typography, and a reusable icon system — the foundation every subsequent phase builds on
**Depends on**: Nothing (first phase of v2.0; v1.0 complete)
**Requirements**: THEME-01, THEME-04, THEME-07, TYPO-01, TYPO-02, ICON-02
**Success Criteria** (what must be TRUE):
  1. App renders with dark terminal-inspired color scheme (deep navy-black backgrounds, light text) as the default appearance
  2. All color references in CSS use semantic custom property tokens (--color-surface, --color-border, --color-text-*, etc.) — no hardcoded gray-* or color values remain in component styles
  3. Headings render in JetBrains Mono (self-hosted from node_modules, no external CDN requests); body text renders in system sans-serif
  4. Browser scrollbars and native form controls adapt to dark appearance via CSS color-scheme property
  5. A Lucide icon utility module exists that provides consistent defaults (size, stroke-width, aria-hidden) and can be imported by any component
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md — Install packages, define OKLCH token system and typography in styles.css, update index.html
- [x] 09-02-PLAN.md — Migrate all page/component hardcoded classes to semantic tokens, clean up legacy tokens, visual verification
- [x] 09-03-PLAN.md — Create Lucide icon utility module with consistent defaults and unit tests

### Phase 10: SEO Static Assets
**Goal**: Search engines and social platforms can discover, index, and display SecureShare correctly — all static SEO infrastructure is in place before any UI refactoring begins
**Depends on**: Nothing (independent of UI work; can run in parallel with Phase 9)
**Requirements**: SEO-02, SEO-03, SEO-04, SEO-08, SEO-09
**Success Criteria** (what must be TRUE):
  1. Browser tab displays a custom favicon (favicon.svg with dark mode adaptive colors, plus favicon.ico and apple-touch-icon.png fallbacks)
  2. /robots.txt responds with directives that allow crawling of / and disallow /api/ paths
  3. /sitemap.xml responds with a valid sitemap listing only the homepage URL
  4. /site.webmanifest responds with app name, icon references, and dark theme background color
  5. When JavaScript is disabled, the #app container displays meaningful fallback content (not a blank page) for crawlers
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md — Create all static SEO files: adaptive SVG favicon, ICO/PNG fallbacks, robots.txt, sitemap.xml, web manifest
- [ ] 10-02-PLAN.md — Wire SEO assets into index.html: favicon link tags, manifest reference, noscript fallback content

### Phase 11: Layout Shell + Component Migration
**Goal**: Every page displays within a consistent brand shell (header + footer), all emoji icons are replaced with Lucide SVGs, and the dark theme applies uniformly across every component — no visual inconsistencies from half-migrated styles
**Depends on**: Phase 9 (requires semantic tokens and icon utility)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, ICON-01, THEME-06
**Success Criteria** (what must be TRUE):
  1. Every page displays a persistent header with shield icon and "SecureShare" wordmark; non-create pages also show a "Create" navigation link
  2. Every page displays a persistent footer with trust signals ("Zero-knowledge encryption" / "AES-256-GCM" / "Open Source")
  3. Header and footer persist across SPA route changes without re-rendering (rendered outside #app container)
  4. All emoji icons throughout the app are replaced with Lucide SVG icons (no emoji characters remain in the UI)
  5. Page background displays a subtle dot-grid pattern that provides visual texture without distracting from content
**Plans**: TBD

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Page-Level UI Enhancements
**Goal**: Each page delivers purpose-built UI improvements — the create page guides users with trust signals, the confirmation page presents the share URL prominently, and the reveal page displays secrets in a professional terminal-style code block
**Depends on**: Phase 11 (requires layout shell and Lucide icons in place)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, TYPO-03
**Success Criteria** (what must be TRUE):
  1. Confirmation page displays the share URL in a single prominent block combining the URL text and a copy button inline
  2. Create page textarea shows an "Encrypted in your browser" indicator with a lock icon when the user has entered content
  3. "How It Works" section uses descriptive SVG icons (browser/shield, server/lock, flame/destroy) instead of numbered circles
  4. After a secret is revealed, a prominent green success badge with checkmark icon confirms the secret has been permanently destroyed
  5. Create page includes a "Why Trust Us?" section highlighting zero-knowledge encryption, open source, no accounts, and AES-256-GCM
  6. Revealed secret content displays in a terminal code-block style (dark background, green-tinted monospace text, header bar with copy button)
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

### Phase 13: Theme Toggle + Visual Polish
**Goal**: Users can switch between dark, light, and system themes with their preference remembered, and the entire app feels alive with glassmorphism surfaces, smooth transitions, and tasteful micro-interactions
**Depends on**: Phase 12 (requires all pages migrated to semantic tokens and UI enhancements complete, so toggle applies cleanly)
**Requirements**: THEME-02, THEME-03, THEME-05, ICON-03, UI-06, UI-07, UI-08, UI-09
**Success Criteria** (what must be TRUE):
  1. User can toggle between dark, light, and system color scheme preferences via a control that displays Sun/Moon/Monitor icons for the respective states
  2. Selected theme preference persists across page refreshes and navigation (stored in localStorage); no flash of wrong theme on page load
  3. Primary content areas (cards, panels) use glassmorphism surfaces (backdrop-blur, translucent backgrounds) that look correct in both dark and light themes
  4. Pages animate in with a fade-in-up transition (200ms ease-out); buttons have hover/active micro-interactions (scale, color shift); copy buttons show icon swap animation on success
  5. All animations respect prefers-reduced-motion — users who prefer reduced motion see no transitions, transforms, or animated icon swaps
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD

### Phase 14: SEO Router Integration
**Goal**: Every page serves correct, route-specific meta tags for search engines and social sharing — the homepage is fully discoverable while secret routes are invisible to search engines and leak no metadata
**Depends on**: Phase 12 (requires page-level UI changes complete to avoid merge conflicts with updatePageMeta refactor that touches every page file)
**Requirements**: SEO-01, SEO-05, SEO-06, SEO-07, SEO-10
**Success Criteria** (what must be TRUE):
  1. Homepage includes meta description, og:title, og:description, og:image, and twitter:card tags in the document head
  2. Secret routes (/secret/*) have noindex/nofollow via both a dynamic meta tag and X-Robots-Tag HTTP header; their OG tags are minimal and generic (no indication a secret exists at that URL)
  3. Homepage includes a JSON-LD structured data block with WebApplication schema
  4. SPA router updatePageMeta() sets title, description, canonical URL, and noindex flag per route on every navigation — stale meta tags from previous routes do not persist
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

## Progress

**Execution Order:**
Phases 9 and 10 can execute in parallel (no dependency). Phases 11-14 execute sequentially.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Encryption Foundation | v1.0 | 4/4 | Complete | 2026-02-13 |
| 2. Database and API | v1.0 | 3/3 | Complete | 2026-02-14 |
| 3. Security Hardening | v1.0 | 2/2 | Complete | 2026-02-14 |
| 4. Frontend Create and Reveal | v1.0 | 4/4 | Complete | 2026-02-14 |
| 5. Password Protection | v1.0 | 3/3 | Complete | 2026-02-14 |
| 6. Expiration Worker | v1.0 | 2/2 | Complete | 2026-02-14 |
| 7. Trust and Accessibility | v1.0 | 2/2 | Complete | 2026-02-15 |
| 8. Tech Debt Cleanup | v1.0 | 2/2 | Complete | 2026-02-14 |
| 9. Design System Foundation | v2.0 | 3/3 | Complete | 2026-02-15 |
| 10. SEO Static Assets | v2.0 | Complete    | 2026-02-15 | - |
| 11. Layout Shell + Component Migration | v2.0 | 0/? | Not started | - |
| 12. Page-Level UI Enhancements | v2.0 | 0/? | Not started | - |
| 13. Theme Toggle + Visual Polish | v2.0 | 0/? | Not started | - |
| 14. SEO Router Integration | v2.0 | 0/? | Not started | - |
