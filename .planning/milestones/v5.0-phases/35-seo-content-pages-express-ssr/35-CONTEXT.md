# Phase 35: SEO Content Pages (Express SSR) - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-render competitor comparison pages (`/vs/*`), alternative framing pages (`/alternatives/*`), and use-case guide pages (`/use/*` + hub) so their content is present in the initial HTTP response — visible to AI crawlers and Google without a JavaScript rendering delay. The existing Vite SPA and its routes are untouched. These are new Express route handlers that bypass the SPA entirely.

Competitors covered: onetimesecret, pwpush, privnote (3 total — additions are a future phase).

</domain>

<decisions>
## Implementation Decisions

### Content depth and tone
- Genuinely useful pages — not thin SEO placeholders. ~600–900 words per comparison page.
- Tone toward competitors: honest and fair. Acknowledge competitor strengths. Torch Secret wins on zero-knowledge model and open-source trust. Reads like a genuine comparison, not pure marketing copy.

### /vs/* page structure
- Sections: H1 intro paragraph → feature comparison table → verdict paragraph with CTA to create a secret
- No FAQ block on /vs/ pages
- Comparison table rows (fixed across all /vs/ pages): zero-knowledge encryption, open source, one-time self-destruct, optional password protection, configurable expiration, no account required

### /vs/* vs /alternatives/* distinction
- Different search intents, different content angles:
  - `/vs/[competitor]` — targets "Torch Secret vs [Competitor]" queries. Head-to-head feature comparison with the table structure above.
  - `/alternatives/[competitor]` — targets "[Competitor] alternatives" queries. Alternatives narrative: "why people look for [Competitor] alternatives," then position Torch Secret as the best option. Lead with zero-knowledge and open-source angles. Persuasive prose, lighter table or no table.
- These are distinct pages with distinct content, not canonical redirects to each other.

### Use-case pages
- 3–5 pages; Claude picks the highest-traffic use cases (e.g., share-passwords, send-api-keys, share-credentials, one-time-links, developer-secrets)
- Page structure: H1 use-case title → short problem paragraph → numbered HowTo steps (maps to HowTo JSON-LD) → CTA to create a secret
- Hub at `/use/`: card grid layout — each card has an icon, title, and 1-sentence description linking to the individual `/use/[slug]` page

### Visual design integration
- Full visual match with the SPA: same Tailwind v4 design tokens, glassmorphism surfaces, same color system
- Shared HTML partial for header and footer (EJS or string template) — same nav links as the SPA (Home, Create, Pricing, Dashboard). One place to maintain across all SSR pages.
- Dark/light mode: CSS-only via `prefers-color-scheme` media query. No JS theme toggle on SSR pages. Works before any script loads and avoids FOWT.

### Claude's Discretion
- Specific templating approach (EJS vs string templates vs another Express-compatible option)
- Exact glassmorphism CSS approach for SSR context (inline styles vs linking compiled Tailwind output vs other)
- HowTo JSON-LD step wording
- Exact use-case slug selection and content within the 3–5 page count

</decisions>

<specifics>
## Specific Ideas

- The `/vs/*` comparison table should have consistent rows across all 3 competitor pages — same feature set evaluated for each
- `/alternatives/*` pages should feel more like "here's why you might leave [Competitor]" narratives, not re-skinned comparison tables
- The `/use/` hub grid mirrors the card pattern used elsewhere in the SPA (consistent with design system)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-seo-content-pages-express-ssr*
*Context gathered: 2026-02-25*
