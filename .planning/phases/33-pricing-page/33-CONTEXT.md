# Phase 33: Pricing Page - Context

**Gathered:** 2026-02-22
**Status:** Ready for planning

<domain>
## Phase Boundary

A static `/pricing` page at which users compare Free vs Pro tiers, toggle between monthly and annual billing, and get answers to billing questions. No payment processing in this phase — that is Phase 34 (Stripe). The page must include a `FAQPage` JSON-LD block in `<head>` for SEO.

</domain>

<decisions>
## Implementation Decisions

### Pricing & billing toggle
- Free tier: $0 forever
- Pro tier: $7/month (monthly billing)
- Annual pricing display: Claude's Discretion — pick the clearest format (e.g. "$5.40/mo billed annually" or "$65/year")
- Annual billing is selected by default; toggle shows a "22% savings" label when annual is active
- Toggle placement and mechanics: Claude's Discretion — standard SaaS pattern (centered above cards, controls both simultaneously)

### Tier feature cards
- Feature list only — no usage counts or quotas
- Core Pro differentiator: 30-day secret expiration (vs. shorter max on Free); other Pro features at Claude's Discretion based on what the codebase already supports
- Free card CTA: "Start for free" → links to `/create`
- Pro card CTA: Claude's Discretion — choose the pattern that best sets up Phase 34 (e.g. `/register?plan=pro` to capture intent, or similar); must be clearly actionable and not disabled/greyed out
- Pro card carries a "Recommended" badge (per success criteria)
- Auth-aware CTA changes: Claude's Discretion — decide whether Phase 33 needs to vary CTA text/destination based on login state, or defer that to Phase 34

### Page structure & visual design
- Page header copy (headline + subheading): Claude's Discretion — consistent with Torch Secret brand voice
- Billing toggle sits above the tier cards
- Content between cards and FAQ: Claude's Discretion — keep lean or add a subtle trust element; no big hero testimonial section
- Visual style: Claude's Discretion — decide between matching the existing glassmorphism surface treatment or using cleaner flat cards for pricing legibility

### FAQ section
- 6–8 questions per success criteria; topics must cover: cancellation, refunds, billing cycle, trial, payment methods
- No free trial — the Free tier is the evaluation experience
- Refund policy: Claude's Discretion — pick a standard SaaS-fair policy and document it clearly in the FAQ answer
- Tone: Claude's Discretion — consistent with the rest of the Torch Secret site voice
- Whether to include a zero-knowledge/privacy FAQ entry: Claude's Discretion — include if it naturally reinforces the value prop without bloating the billing-focused section
- FAQPage JSON-LD in `<head>` must mirror the visible Q&A content exactly

### Claude's Discretion
- Annual Pro price display format
- Toggle placement details
- Pro feature list beyond 30-day expiration
- Pro CTA destination/behavior before Stripe is live
- Auth-aware CTA handling (or deferral to Phase 34)
- Page header copy
- Content between cards and FAQ
- Visual surface treatment (glassmorphism vs flat)
- Refund policy wording
- FAQ tone and whether to include a security/privacy entry

</decisions>

<specifics>
## Specific Ideas

- Success criteria requires the Pro card to be "visually distinct" — badge + distinct border/background treatment
- "22% savings" label must appear on the toggle when annual is selected (exact wording from success criteria)
- `FAQPage` JSON-LD must be present in `<head>` (verifiable via curl), not just inline on the page

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-pricing-page*
*Context gathered: 2026-02-22*
