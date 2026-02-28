# Phase 38: Feedback Links - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a Tally.so feedback link at the two highest-intent moments: immediately after a user creates a secret (confirmation page) and immediately after a user views/reveals a secret (post-reveal state). No new routes, no backend changes, no new components — pure frontend DOM additions to two existing page render functions.

</domain>

<decisions>
## Implementation Decisions

### Tally.so form URL
- **ACTION REQUIRED before execution:** Replace the placeholder `TALLY_FORM_URL` below with the real Tally.so form URL (e.g. `https://tally.so/r/XXXXXXX`)
- Use one shared form for both pages — simpler to manage and gives unified signal in Tally
- Hardcode the URL directly in the page files (no env var needed — Tally.so URLs are public by design)

### Visual treatment
- Unobtrusive text-link style — not a card, not a banner
- Match the existing muted text-link pattern already used for "Create Another Secret" (`text-accent hover:text-accent-hover`)
- Precede the link with a short muted label (e.g. `"Got feedback?"`) in `text-text-muted` to provide context without demanding attention

### Link text
- Label: `"Got feedback?"` (text-text-muted, small)
- Link: `"Share it with us"` or `"Tell us what you think"` — Claude's discretion on exact copy
- Opens in a new tab (`target="_blank" rel="noopener noreferrer"`)

### Placement
- **Confirmation page:** Below the "Create Another Secret" button — last element in the wrapper, after the existing content stack
- **Post-reveal page (`renderRevealedSecret`):** Added to the existing `actions` div alongside the "Create a New Secret" link — same row, after the link
- Both placements are at the tail end of user flow to avoid distracting from primary actions

### Claude's Discretion
- Exact wording of feedback prompt copy
- Whether to use a separator (`·` or `|`) between the "Create a New Secret" link and feedback link on the reveal page, or put feedback on a new line
- Exact spacing/margin classes

</decisions>

<specifics>
## Specific Ideas

- The feedback link should feel like an afterthought, not a demand — similar to how Linear puts "Send feedback" in the corner, not in a modal
- `TALLY_FORM_URL` placeholder must be replaced before execution — planner should flag this as a required substitution in the plan

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No new component needed — plain `<a>` element with existing Tailwind token classes
- `navigate()` from `router.js` is NOT needed — external links use native `<a href>` with `target="_blank"`

### Established Patterns
- Text link style: `text-accent hover:text-accent-hover focus:ring-2 focus:ring-accent focus:outline-hidden rounded font-medium transition-colors`
- Muted label style: `text-sm text-text-muted`
- Both pages construct DOM programmatically via `document.createElement` — no innerHTML, no templates
- Confirmation page wrapper: `space-y-6 text-center` div, elements appended in order
- Reveal actions: `flex flex-col sm:flex-row items-center gap-4` div already exists in `renderRevealedSecret`

### Integration Points
- `confirmation.ts` → `renderConfirmationPage()` → append feedback element after `createAnotherButton`
- `reveal.ts` → `renderRevealedSecret()` → append or insert feedback into existing `actions` div

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-feedback-links*
*Context gathered: 2026-02-28*
