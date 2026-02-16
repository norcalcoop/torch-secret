# Phase 9: Design System Foundation - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the visual identity toolkit for SecureShare v2.0: semantic color tokens (OKLCH dark palette), developer-grade typography (JetBrains Mono headings + system sans-serif body), and a reusable Lucide icon utility module. This phase creates the foundation every subsequent phase (11-14) builds on. No page-level UI changes — tokens, fonts, and icon utility only.

</domain>

<decisions>
## Implementation Decisions

### Dark palette character
- Warm charcoal base background (~#1a1a2e) — softer dark, not true black or cold navy
- Electric blue primary accent for buttons, links, and interactive elements
- Palette should feel like a professional security tool — trustworthy, modern, not harsh

### Token structure
- OKLCH color space for all token values (perceptually uniform, modern browser support)
- Semantic-only naming convention (--color-surface, --color-text-primary, --color-accent) — no primitive/hue references exposed
- 4 text color levels: primary / secondary / tertiary / muted
- Surface levels: Claude's discretion based on component needs in phases 11-14

### Typography details
- JetBrains Mono for headings at semi-bold (600) weight
- System sans-serif stack for body text
- Code block font: Claude's discretion (JetBrains Mono reuse vs system monospace)
- Standard type scale (1.25 ratio, Major Third)
- Base body text size: 16px (1rem)

### Icon sizing defaults
- Default Lucide icon size: 24px
- Default stroke width: 2px (Lucide default)
- Named size variants: sm (16px) / md (24px) / lg (32px)
- Dedicated --color-icon token (not just currentColor inheritance) — allows independent icon styling

### Claude's Discretion
- Status/semantic colors (danger, warning, success) — pick what works with blue accent on warm charcoal
- Text brightness levels — must pass WCAG AA against the warm charcoal background
- Number of surface levels (3 or 4) — based on what phases 11-14 need
- Code block font choice — JetBrains Mono reuse vs system monospace
- Exact OKLCH values for the full palette

</decisions>

<specifics>
## Specific Ideas

- "Warm charcoal" (#1a1a2e-ish) — user specifically chose softer dark over true black or cold navy
- Electric blue accent — security/trust signaling, similar to 1Password's palette direction
- Semi-bold (600) headings in JetBrains Mono — modern dev tool aesthetic without heaviness

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-design-system-foundation*
*Context gathered: 2026-02-15*
