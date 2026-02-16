# Phase 12: Page-Level UI Enhancements - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-page feature upgrades across three pages: the create page gets trust signals (How It Works icons, Why Trust Us section) and an encrypted-in-browser textarea indicator; the confirmation page gets a prominent share URL block with copy and native share; the reveal page gets a terminal-style code block for secret display and a destroyed confirmation badge. No new capabilities — just visual/UX improvements to existing pages.

</domain>

<decisions>
## Implementation Decisions

### Share URL block (Confirmation page)
- Copy feedback via toast notification (small snackbar slides in confirming "Link copied to clipboard")
- Include both copy-to-clipboard AND native Web Share API button (on supported devices, fallback gracefully)

### Trust sections (Create page)
- "How It Works" uses 4 steps: Paste → Encrypt → Share → Destroy — each with a descriptive Lucide icon
- "Why Trust Us?" displays as a 4-card icon grid (zero-knowledge, open source, no accounts, AES-256-GCM) — each card with icon + short label + brief description

### Terminal code block (Reveal page)
- Vertical scroll with max height (~300px) for long secrets — keeps page compact
- Muted green-gray text (soft sage/green-gray, not bright phosphor green) — modern, easier on the eyes
- Terminal header bar with copy button

### Destruction feedback (Reveal page)
- Destroyed badge appears ABOVE the secret terminal block — first thing the user sees
- Reassuring tone: "This secret has been permanently deleted from our servers" — professional, trust-building
- Revisiting a consumed URL shows a distinct expired state: "This secret has already been viewed and destroyed" — different from generic not-found

### Claude's Discretion
- Share URL display approach (full URL visible, truncated, wrapping behavior)
- Share URL block visual prominence and page hierarchy on confirmation page
- Trust sections placement relative to form (below vs alongside)
- Textarea "Encrypted in your browser" indicator visual weight (subtle vs prominent)
- Terminal header bar style (minimal vs macOS dots aesthetic)
- Terminal line wrapping vs horizontal scroll behavior
- Whether secret text stays visible or fades after destruction
- Destroyed badge placement relative to secret

</decisions>

<specifics>
## Specific Ideas

- Toast notification for copy feedback (not inline icon swap)
- Web Share API for native sharing on mobile — progressive enhancement pattern
- 4-step How It Works (Paste → Encrypt → Share → Destroy) rather than 3-step
- Muted green-gray terminal text — modern developer aesthetic, not retro hacker green
- Reassuring destruction message tone over terse/decisive tone
- Distinct "already viewed and destroyed" page state rather than generic 404

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-page-level-ui-enhancements*
*Context gathered: 2026-02-16*
