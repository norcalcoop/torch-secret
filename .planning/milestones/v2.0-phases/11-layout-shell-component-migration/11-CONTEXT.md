# Phase 11: Layout Shell + Component Migration - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Every page displays within a consistent brand shell (header + footer), all emoji icons are replaced with Lucide SVGs, and a subtle dot-grid background provides visual texture. "How It Works" icon swap is Phase 12. Theme toggle is Phase 13. This phase establishes the persistent layout and completes the emoji-to-SVG migration.

</domain>

<decisions>
## Implementation Decisions

### Header design
- Compact logo-style: shield icon tight next to "SecureShare" wordmark as a single brand mark
- Sticky header: always visible at top on scroll
- Glassmorphism treatment: backdrop-blur with translucent background, modern floating feel (no solid border)
- "Create" nav link appears on non-create pages; no active route indicator needed (presence/absence is the indicator)
- Header rendered outside #app container so it persists across SPA route changes

### Footer content & layout
- Trust signals only: "Zero-knowledge encryption" / "AES-256-GCM" / "Open Source" — no GitHub link or external links
- Content-bottom positioning: footer sits below page content, not sticky to viewport
- Subtle top border using --color-border for visual separation from content
- Footer rendered outside #app container so it persists across SPA route changes

### Dot-grid background
- Wide spacing (40-48px) — sparse dots, barely-there texture
- Very faint opacity — much lower than borders, more felt than seen
- Content area only — dots appear between header and footer, not behind them
- CSS radial-gradient implementation — no SVG, no extra files
- Linear-style aesthetic reference — clean, engineering-grade background
- Static — no animation or pulse

### Emoji-to-icon migration
- Inline sizing: Lucide icons match text flow, same visual weight as the emojis they replace
- Color-coded error icons: warning = amber, error = red, info = blue — severity immediately clear
- Reveal page shield icon uses --color-accent — branded security signal at a key moment
- "How It Works" icon swap stays in Phase 12 per roadmap
- 7 emojis to replace across 2 files (reveal.ts: shield + lock; error.ts: lock, key, warning, search, explosion)

### Claude's Discretion
- Exact Lucide icon choices for each emoji replacement
- Footer trust signal arrangement (horizontal row vs icon+label badges)
- Navigation link visual treatment (active route indicator approach)
- Dot-grid fade/vignette behavior near content cards
- Dot-grid visibility in future light theme (Phase 13 concern)
- Dot animation decision (static vs subtle pulse) — user leaned static but left flexibility

</decisions>

<specifics>
## Specific Ideas

- Header should feel like a single compact brand mark, not a navigation bar with spaced-out elements
- Dot-grid should evoke Linear's background aesthetic — clean engineering texture
- Error icons should communicate severity at a glance through color, not just icon shape
- Shield icon on the reveal page is a brand moment — accent color makes it stand out

</specifics>

<deferred>
## Deferred Ideas

- "How It Works" section icon swap (numbered circles to descriptive SVG icons) — Phase 12
- GitHub repo link in footer — decided against for now, could revisit

</deferred>

---

*Phase: 11-layout-shell-component-migration*
*Context gathered: 2026-02-15*
