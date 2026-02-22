# Phase 32: Marketing Homepage + /create Split - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the existing create-secret form to `/create` (no functional changes). Build a marketing landing page at `/` that communicates Torch Secret's zero-knowledge model and drives conversions. Update the header navigation to appear across all SPA routes with links to `/create`, `/pricing`, and `/dashboard`. The form's encryption logic, validation, and behavior are untouched — this phase is the homepage and route split only.

</domain>

<decisions>
## Implementation Decisions

### Homepage structure
- Three sections: **Hero → Use Cases → Email Capture**
- No "How it works" section — keep it tight
- Claude has discretion on whether to add any trust/credibility elements (zero-knowledge callout, security badges, etc.)

### Hero section
- Primary message angle: **simplicity and speed** — "Share sensitive info in seconds, no account needed"
- Visual element alongside the text: **Claude's discretion** (can use a terminal-block decoration, subtle animation, or keep it purely text+CTA)
- CTA button copy and target: **Claude's discretion** (should route to `/create`; pick copy that matches the simplicity/speed angle)

### Features / Use Cases section
- Content: **job-aware use cases** — relatable scenarios like passwords, API keys, sensitive notes
- Visual treatment: **Claude's discretion** — pick the most appropriate format (cards, scenarios with examples, etc.)

### Visual style
- Use the **same glassmorphism aesthetic** as the rest of the app — consistent brand experience
- Marketing page is not visually distinct from the app shell — it extends the existing design system
- Section backgrounds, spacing, and typography follow existing Tailwind CSS 4 design tokens

### Email capture form
- Placement: **Claude's discretion** — place where it flows naturally after the use cases section
- Hook / headline copy: **Claude's discretion** — write copy appropriate to an early-stage product going global
- **Include all applicable consent checkboxes** from the start — GDPR checkbox minimum; design for eventual global compliance (not just North America)
- Submit behavior (Phase 36 wires the backend): show a **toast or inline success message** — no actual submission, but form appears to work. Data is silently dropped until Phase 36.
- Consent checkbox is unchecked by default with clear consent language (Phase 36 success criteria)

### Navigation
- Links: **Logo + "Create a Secret" + Pricing + Dashboard** (dashboard link shows Login when unauthenticated)
- Desktop: standard horizontal header nav
- **Mobile: iOS-style bottom tab bar** with icon buttons — not a hamburger menu
- "Create a Secret" button treatment: **Claude's discretion** (consider a visually distinct CTA)
- Nav consistency across routes: **Claude's discretion** — decide whether to use transparent/hero overlay on homepage vs. solid on app pages

### JSON-LD
- `WebApplication` JSON-LD block must be injected into `<head>` at `/` (success criteria requirement)
- The SPA router's meta management system handles this per-route

### Claude's Discretion
- Trust/credibility elements on homepage (zero-knowledge callout, badges, "how it works" strip) — include or omit as appropriate
- Hero visual element (terminal block decoration, animation, purely text)
- CTA button copy
- Email capture placement within the page flow
- Email capture headline/hook copy
- "Create a Secret" nav button visual treatment
- Nav transparency behavior (homepage hero overlay vs. uniform across all routes)
- Use case card/scenario visual format

</decisions>

<specifics>
## Specific Ideas

- User is based in North America but targeting a global audience — email consent UI should be designed to satisfy GDPR from day one, not retrofitted
- The zero-knowledge angle is real and differentiating, but lead with **simplicity first** in the hero (don't bury the lead in crypto jargon)
- Mobile nav: **iPhone-style bottom tab bar with icon buttons** — this is an explicit preference, not a fallback

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-marketing-homepage-create-split*
*Context gathered: 2026-02-22*
