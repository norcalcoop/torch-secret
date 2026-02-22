# Phase 27: Conversion Prompts + Rate Limits + Legal Pages - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Tighten anonymous rate limits with server-side enforcement, surface inline conversion prompts at three natural moments without blocking the core create flow, and add Privacy Policy and Terms of Service pages at canonical URLs. This phase does not change the create flow itself — prompts appear after creation on the confirmation page, or on rate limit rejection. New capabilities (e.g., email capture, A/B testing prompt variants) belong in a future phase.

</domain>

<decisions>
## Implementation Decisions

### Conversion prompt copy — 1st secret
- Angle: pure **benefit highlight**, no limit awareness messaging
- Format: **one punchy headline** leading with the single most compelling benefit (not a list of 3 items)
- CTA label: **"Sign up — it's free"**
- The headline should lead with something emotionally resonant (e.g., "Know when your secret is read") not a feature list

### Conversion prompt copy — 3rd secret
- Angle: **Claude's discretion** — pick what converts best at this third touchpoint (user is clearly engaged)
- CTA label: **"Sign up — it's free"** (consistent with 1st prompt)
- Format: same one-punchy-headline rule applies

### Prompt visual placement & treatment
- Position: **below the share link** on the confirmation page — user has already copied the link
- Dismissibility: **dismissible with an X button** — respects user agency; dismissed state does not persist across page visits
- Style: **branded accent card** using the primary color accent — visible but non-blocking, consistent with glassmorphism design system
- The prompt must not compete visually with the share link (the primary action)

### Conversion prompt triggering
- **Claude's discretion** on tracking mechanism — pick the most reliable approach given the existing rate-limiter architecture (server-side counter vs. localStorage). Researcher should evaluate what the existing rate limit counters expose.

### Rate limit error UX
- When an anonymous user hits the limit: **Claude decides** the placement (inline on create page vs. dedicated error state) — pick the least disruptive option
- Reset time: **show when the limit resets** (e.g., "Limit resets in 45 minutes") — give users agency to wait
- Copy tone: **Claude's discretion** — pick tone consistent with the rest of the app's voice
- 429 response structure: **Claude's discretion** — pick cleanest approach given existing API contract
- The upsell in the 429 context must include: the reset time, the CTA "Sign up — it's free", and a brief mention of what they get (higher limits)

### Legal pages — content
- **Real content** now, not placeholder stubs — write actual Privacy Policy and ToS appropriate for a zero-knowledge secret sharing service
- Operator identity: use **[Company Name]** / **[Contact Email]** tokens throughout — to be filled before launch
- Content must accurately reflect zero-knowledge model: server never sees plaintext, encryption keys only in URL fragment, secrets auto-destruct after one view

### Legal pages — design & placement
- Visual style: **same glassmorphism design system** as the rest of the app — full layout shell, dark/light theme, same typography
- Both pages get **noindex** meta tags
- Canonical URLs: `/privacy` and `/terms`
- Link placement: **footer globally** + inline consent copy on the registration page ("By creating an account you agree to our [Terms]")
- Footer must also appear on the create page (as it's the first page most users land on)

### Claude's Discretion
- Exact copy for 3rd-secret prompt (angle and hook)
- Conversion prompt trigger mechanism (server vs. localStorage)
- Rate limit error placement (inline vs. error state)
- Rate limit 429 response structure (JSON fields vs. client-side handling)
- Rate limit copy tone

</decisions>

<specifics>
## Specific Ideas

- The 1st-secret prompt headline should lead with the read notification benefit — "Know when your secret is read" — it's the most emotionally compelling differentiator vs. anonymous usage
- The branded accent card should use the existing primary color token, not a new color
- Legal pages must make the zero-knowledge model clear in plain English: "We cannot read your secrets. We only store encrypted data."

### Planning directive
The researcher and planner should reference the product marketing context documents at `.claude/` when making copy decisions. Specifically:
- `.claude/product-marketing-context.md` — positioning, tone of voice, target audience
- `.claude/pricing-strategy.md` — tier benefits and limit values to reference accurately in copy
- `.claude/landing-pricing-copy.md` — existing copy patterns to stay consistent with
These files establish the copy voice and benefit hierarchy that conversion prompts must align with.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-conversion-prompts-rate-limits-legal-pages*
*Context gathered: 2026-02-21*
