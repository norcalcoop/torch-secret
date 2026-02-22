# Project Research Summary

**Project:** Torch Secret v5.0 — Product Launch Checklist
**Domain:** SaaS product launch — Stripe billing, marketing site, programmatic SEO, email onboarding
**Researched:** 2026-02-22
**Confidence:** HIGH

## Executive Summary

Torch Secret v5.0 is the go-public milestone for an existing zero-knowledge one-time secret sharing app. The foundation is fully built: Better Auth sessions, PostHog analytics, Resend transactional email, Drizzle/PostgreSQL persistence, and a Vanilla TS SPA. What v5.0 adds is the revenue layer (Stripe Pro billing at $9/month or $7/month annual), the marketing presence (rebrand to torchsecret.com, homepage redesign, pricing page), organic acquisition infrastructure (programmatic SEO pages, schema markup), and lifecycle email (3-email onboarding sequence via Loops.so). The rebrand is the critical-path opener: every other v5.0 feature embeds the product name or domain in copy, canonical URLs, or email sender addresses. Completing the rebrand first prevents rework across all subsequent phases.

The recommended Stripe integration uses the raw `stripe` SDK (v20.3.1) with a hand-written webhook handler rather than the `@better-auth/stripe` plugin for billing. Four open bugs in the plugin (issues #2440, #4957, #5976, #4801) directly break the subscription upgrade flow, DB sync, and webhook signature handling as of February 2026. The plugin can remain installed for session compatibility but its billing webhook path is unreliable. Email onboarding sequences should use Loops.so (v6.2.0) rather than a custom cron-based approach — Loops provides the time-delay sequencing that Resend alone cannot deliver without a custom cron+DB tracking system. Only one new npm package (`loops`) is required for v5.0; everything else is already installed or uses infrastructure already present.

The most consequential architectural decision is how to serve the SEO content pages (`/vs/*`, `/alternatives/*`, `/use/*`). The Architecture researcher recommended SPA client-side routes for simplicity; the Stack and Pitfalls researchers both independently recommended Express server-side rendering. The SSR position is adopted here. AI crawlers (GPTBot, ClaudeBot, PerplexityBot) cannot execute JavaScript and will see an empty HTML shell from the SPA, making the competitor comparison pages — the highest-conversion SEO asset — invisible to the very crawlers they target. Googlebot's two-wave indexing also creates a days-to-weeks delay for JS-rendered content on a new domain where ranking speed matters at launch. Express SSR for these pages is not complex in this codebase: route handlers return fully-formed HTML strings, and the same `__CSP_NONCE__` replacement already used for `index.html` applies. SPA routes remain correct for the homepage, pricing page, and all functional app pages; SEO content pages require SSR.

## Key Findings

### Recommended Stack

The existing stack is unchanged. v5.0 requires only one new npm package: `loops@6.2.0` for the time-delayed email onboarding sequence. All other services use packages already installed in v4.0 (`stripe@20.3.1`, `resend@6.9.2`, `better-auth@1.4.18`, `posthog-js@1.351.1`, `posthog-node@5.24.17`). The zero-dependency approach for EFF diceware passphrase generation remains correct: commit the wordlist as a static JSON file, use Web Crypto `getRandomValues`, and avoid the CJS-only `eff-diceware-passphrase` npm package that conflicts with the ESM codebase.

**Core new/notable technologies:**
- `stripe@20.3.1` (server only): Raw SDK with hand-written webhook handler. Do NOT rely on `@better-auth/stripe` for billing webhook processing — 4 open bugs make the plugin non-functional for subscription lifecycle management as of Feb 2026. Stripe Hosted Checkout (full-page redirect) eliminates the need for `@stripe/stripe-js` on the client and requires no `script-src` CSP additions.
- `loops@6.2.0`: Time-delayed email onboarding sequences. Resend alone cannot deliver step-delayed sequences without custom cron infrastructure; Loops provides dashboard-configured automation with a clean SDK. Use v6.x API (`createContact()` with single object parameter — breaking change from v5).
- `resend@6.9.2` Audiences API (already installed): Email list capture via `resend.contacts.create()`. No new package required — the Audiences API is included in the already-installed SDK.
- `posthog-js@1.351.1` (already installed, bundled via Vite): Must use the npm-bundled approach, not the PostHog snippet. Dynamically injected `<script>` tags cannot receive a per-request CSP nonce.
- Express SSR template strings (no new package): SEO content pages rendered as full HTML in Express route handlers. Same pattern as the existing SPA catch-all; content stored as TypeScript data objects.

**New environment variables for v5.0:**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`
- `RESEND_AUDIENCE_ID` (for Resend Audiences email list capture)
- `LOOPS_API_KEY` (for Loops.so onboarding sequences)

### Expected Features

**Must have at launch (P1):**
- Rebrand — rename SecureShare to Torch Secret and swap domain to torchsecret.com across all user-facing strings, HTML meta, JSON-LD `@id`, email sender addresses, sitemap, canonical URLs, CI/Docker configs. Treat as an atomic change; partial rename splits brand authority.
- Marketing homepage — hero with headline/subhead/CTA, zero-knowledge proof points, How It Works section, pricing preview (not a full pricing table), email capture form. Move the create-secret form to `/create`; the homepage at `/` becomes the marketing landing page.
- Pricing page (`/pricing`) — Free vs Pro tier cards, monthly/annual billing toggle (annual default, saves 22%), FAQ section (6-8 questions), Pro card highlighted with "Recommended" badge. FAQ is not optional — 34% of pricing bounces are attributed to unclear cancellation policies.
- Stripe Pro billing — Checkout session creation, webhook handler for subscription lifecycle (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`), Pro feature unlock (30-day expiration), Stripe Customer Portal for self-service cancellation.
- Schema markup on homepage and `/pricing` — `WebApplication` JSON-LD on homepage, `FAQPage` JSON-LD on `/pricing`. Both must be in server-rendered or static HTML, not injected by JS, to be visible to AI crawlers.

**Should have within 2 weeks of launch (P2):**
- SEO comparison pages (`/vs/onetimesecret`, `/vs/pwpush`, `/vs/privnote`) — Express SSR, minimum 800 words of original content per page, factual competitor feature comparison tables, FAQPage JSON-LD in initial HTML response.
- SEO use-case pages (`/use/*` hub + 4 highest-volume slugs) — Express SSR, HowTo JSON-LD per page in initial HTML response, use-case-specific copy.
- Email onboarding sequence — 3 emails via Loops.so: welcome (immediate), key features (day 3), upgrade prompt (day 7). Upgrade email requires Stripe to be live. Emails 2-3 require a marketing consent checkbox on the registration form for GDPR compliance.
- Email capture on homepage — GDPR-compliant: unchecked opt-in checkbox, consent timestamp stored in `marketing_subscribers` table, double opt-in confirmation email, working unsubscribe endpoint (`GET /unsubscribe?token=`).

**Defer to v6+ (P3):**
- Annual billing toggle (add after verifying monthly retention)
- Live vanity secret count on homepage (add after launch when numbers are real)
- Feedback form link on confirmation/reveal pages (30-minute task, no dependencies)
- Team/Enterprise tier
- Public REST API for programmatic secret creation
- Custom domains for Pro users

### Architecture Approach

v5.0 adds five new subsystems to the shipped v4.0 architecture. No existing middleware changes position. The zero-knowledge invariant is not affected by any v5.0 feature. The key structural changes are: (1) homepage split — the create-secret form moves to `/create` so `/` becomes the marketing page, requiring removal of the hardcoded `max-w-2xl` constraint from `index.html` and per-page-module width management; (2) Stripe webhook route mounted on the Express `app` instance directly before `express.json()`, same position as the Better Auth handler (body-stream ordering requirement); (3) SEO content pages served as Express SSR routes returning complete HTML with content in the initial HTTP response, not as SPA routes in `router.ts`; (4) per-route JSON-LD injection via a `setJsonLd()` utility for SPA pages (homepage, pricing), with static JSON-LD in the HTML response for SSR SEO pages.

**Major new components:**
1. `server/src/routes/stripe-webhook.ts` — raw body handler, webhook event dispatch, idempotent DB upserts via `ON CONFLICT DO UPDATE`
2. `server/src/routes/billing.ts` — Checkout session creation and Customer Portal session URL (both behind `requireAuth`)
3. `server/src/routes/seo-pages.ts` — Express SSR handlers for `/vs/:slug`, `/alternatives/:slug`, `/use/:slug`, with TypeScript data objects for page content and static JSON-LD in `<head>`
4. `server/src/middleware/require-plan.ts` — reusable Pro feature gate using Redis cache-aside with 5-minute TTL
5. `server/src/workers/onboarding-worker.ts` — cron-triggered enrollment in Loops.so sequences on user registration
6. `client/src/pages/home.ts` — marketing homepage SPA module (hero, proof points, How It Works, pricing preview, email capture form)
7. `client/src/pages/pricing.ts` — pricing page SPA module (tier cards, billing toggle, FAQ accordion, upgrade CTA)
8. `client/src/utils/json-ld.ts` — per-route JSON-LD injection/removal singleton for SPA pages

### Critical Pitfalls

1. **Stripe webhook route mounted after `express.json()` silently breaks signature verification** — The error "No signatures found matching the expected signature" does not mention the ordering problem. Mount the webhook route directly on the `app` instance before the `express.json()` line, not via a sub-router. Update the `app.ts` middleware order comment block to document both the Better Auth handler and the Stripe webhook as pre-JSON-parser routes. (Pitfall 3)

2. **SEO content pages served as SPA routes are invisible to AI crawlers and slow to index on Google** — GPTBot, ClaudeBot, and PerplexityBot cannot execute JavaScript; they see the empty `index.html` shell. Googlebot indexes JS-rendered content in two waves with days-to-weeks delay on new domains. Serve `/vs/*`, `/alternatives/*`, and `/use/*` as Express SSR with complete HTML in the initial HTTP response. Verify with `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` — must return content, not an empty shell. (Pitfalls 4 and 5)

3. **Email 3 (upgrade prompt) is marketing email under GDPR — explicit consent required** — The welcome email is transactional (no consent needed). The upgrade prompt is promotional (consent required for EU users). Add a marketing consent checkbox (unchecked by default) to the registration form. Store the consent timestamp in the DB. Only send emails 2-3 to opted-in users. Apply one-click unsubscribe via Resend `List-Unsubscribe` header. (Pitfall 6)

4. **Pro feature gate with stale subscription status causes revenue leaks and false failures** — Mode A: cancelled users retain Pro access when the `customer.subscription.deleted` webhook is delayed. Mode B: paying users see "no subscription" for 5 seconds after checkout redirect before the webhook arrives. Mitigation: cache subscription status in Redis with 5-minute TTL; clear on webhook events; on the success page (`?session_id=` param), query Stripe API directly before rendering the success UI. (Pitfall 9)

5. **Thin programmatic SEO content triggers Google quality penalties** — Use-case pages generated from a shared template with only the slug swapped in are classified as thin content and de-indexed, especially on a new domain with low authority. Ship 3-4 comparison pages with minimum 800 words of substantive original content rather than 8 thin use-case pages at launch. Add remaining pages as content is genuinely written. (Pitfall 8)

## Implications for Roadmap

The dependency chain from combined research is clear and the ordering is largely non-negotiable. The rebrand must be first. The homepage/create split must precede the pricing page. The pricing page must exist before Stripe billing is wired. Stripe must be live before the upgrade-prompt email can send. SEO pages and email capture are independent of billing and can be built in parallel after the rebrand.

### Phase 1: Rebrand + Tech Debt
**Rationale:** Every subsequent file touch should use the new brand name. Doing the rebrand last means editing files twice across every phase. This is also the right moment to clear existing tech debt (CI env vars, `/privacy` + `/terms` noindex fix, schema.ts ZK comment) — zero functional change, fast to execute, clean slate for v5.0.
**Delivers:** Torch Secret name and torchsecret.com domain throughout all user-facing strings, HTML meta, JSON-LD `@id` and `url`, email sender addresses, sitemap, robots.txt, README, and CI/Docker configs. Tech debt items cleared.
**Addresses:** FEATURES.md Feature Area 1 (Rebrand); CI/NOINDEX/schema.ts debt items.
**Avoids:** Rework from partial rename; broken DMARC/SPF from placeholder email sender domain; mismatched JSON-LD undermining schema validity.
**Research flag:** No research phase needed. Pure string replacement work with a grep-based audit.

### Phase 2: Marketing Homepage + Create-Page Split
**Rationale:** The homepage is currently the create-secret page. The pricing page and SEO pages need the homepage to exist as a marketing landing page before they can be linked from the nav. The `max-w-2xl` container constraint in `index.html` must be removed and moved into individual page modules before any full-width marketing page can be built. The email capture form can be added as a UI widget in this phase; the backend endpoint that wires it is Phase 6.
**Delivers:** `/` serves the marketing homepage (SPA route via `client/src/pages/home.ts`); create-secret form moves to `/create`; header nav updated; `index.html` `max-w-2xl` constraint removed from `#app` and moved into per-page modules; marketing homepage with hero, zero-knowledge proof points, How It Works, pricing preview, and email capture form widget (form non-functional until Phase 6).
**Uses:** Existing SPA router pattern; `updatePageMeta()`; dynamic imports; `client/src/pages/home.ts` new module.
**Avoids:** Anti-pattern of removing `max-w-2xl` without moving it to page modules, which breaks full-width create/reveal pages (Architecture anti-pattern 4).
**Research flag:** No research phase needed. Frontend design skill invocation required per CLAUDE.md before any UI work.

### Phase 3: Pricing Page
**Rationale:** Stripe Checkout's `cancel_url` points to `/pricing`. The page must exist before the billing flow is wired. The pricing page can be built as static SPA content with placeholder CTAs (upgrade button is non-functional until Phase 4).
**Delivers:** `/pricing` SPA route via `client/src/pages/pricing.ts`; Free vs Pro tier cards; monthly/annual billing toggle with annual as default (shows 22% saving); Pro card highlighted with "Recommended" badge; feature comparison list per tier; FAQ section (6-8 questions); static upgrade CTA (wired to live Stripe in Phase 4); `FAQPage` JSON-LD via `setJsonLd()` utility (also creates `client/src/utils/json-ld.ts`); `/pricing` added to `sitemap.xml`.
**Uses:** `client/src/pages/pricing.ts` new module; `client/src/utils/json-ld.ts` new utility.
**Avoids:** Missing FAQ section (increases bounce 34%); pricing page without highlighted Pro tier (22% worse conversion); full pricing table embedded on marketing homepage (creates visual clutter before primary CTA).
**Research flag:** No research phase needed. Frontend design skill required.

### Phase 4: Stripe Pro Billing
**Rationale:** Stripe requires the pricing page to exist for the cancel URL. Must be live before the email onboarding upgrade-prompt email (Phase 7) can reference a real checkout. This is the revenue phase and the most complex integration.
**Delivers:** Stripe webhook handler mounted before `express.json()` in `app.ts`; `subscriptions` Drizzle table migration; `POST /api/billing/checkout` (Checkout session creation); `GET /api/billing/portal` (Customer Portal session URL); `server/src/middleware/require-plan.ts` (Redis cache-aside, 5-minute TTL); Pro feature unlock (30-day expiration); success-page direct Stripe API query on `?session_id=` param; INVARIANTS.md Stripe/billing row added before any webhook code is written.
**Uses:** `stripe@20.3.1` (already installed); raw `express.raw({ type: 'application/json' })` before `express.json()` in `app.ts`; Drizzle migration; Redis for subscription status cache.
**Avoids:** `@better-auth/stripe` billing webhook path (bugs #2440, #4957, #5976, #4801 as of Feb 2026 — verify status before Phase 4 begins); Stripe webhook route after `express.json()` (Pitfall 3); stale subscription status revenue leak (Pitfall 9); Stripe secret key in Vite client bundle; Pro activation on checkout redirect rather than on verified webhook event.
**Research flag:** No research phase needed. All patterns are fully documented with code examples. Verify `@better-auth/stripe` bug status at Phase 4 kickoff — if all 4 bugs are resolved, the plugin billing path may be viable.

### Phase 5: SEO Content Pages (Express SSR)
**Rationale:** Independent of billing. Can begin after Phase 1 (rebrand) is complete and can overlap with Phases 3-4. The architecture decision to use Express SSR rather than SPA routes must be made before any content is written. Content quality gate applies: each page ships only when it has substantive, original content (minimum 800 words for comparison pages). Thin pages damage domain authority for all pages on the domain.
**Delivers:** Express SSR handlers for `/vs/onetimesecret`, `/vs/pwpush`, `/vs/privnote`, `/alternatives/*`, `/use/:slug` (4 initial slugs + hub at `/use`); static JSON-LD in server-rendered HTML `<head>` (FAQPage on `/vs/*`, HowTo on `/use/*`); CSP nonce injection applied to SSR page templates; all new routes added to `sitemap.xml`; `robots.txt` verified; NOINDEX_PREFIXES audited to confirm `/vs/`, `/alternatives/`, `/use/` are not accidentally matched.
**Uses:** Express router; TypeScript data objects for page content; `JSON.stringify()` for JSON-LD; no new packages; same `__CSP_NONCE__` replacement pattern as the existing SPA catch-all.
**Avoids:** SPA routes invisible to AI crawlers (Pitfall 4); JS-injected JSON-LD invisible to AI crawlers (Pitfall 5); thin content SEO penalty (Pitfall 8); false competitor claims or copied competitor screenshots (legal risk); `noindex` accidentally applied to SEO pages.
**Research flag:** No research phase needed. Express SSR pattern is clear. Content quality review gate required before publishing any page.

### Phase 6: Email Capture
**Rationale:** The email capture form widget was built in Phase 2 as a UI element. This phase wires the backend endpoint to Resend Audiences. The GDPR consent model must be designed before the endpoint is built — the consent checkbox and storage schema are prerequisites, not implementation details.
**Delivers:** `POST /api/email-capture` Express endpoint (rate-limited: 3/IP/hour via existing `createRateLimiter` factory; Zod email validation; proxies to Resend Audiences API using `resend.contacts.create()`); `marketing_subscribers` DB table (separate from `users`; columns: `email`, `consented_at`, `consent_source`, `ip_hash`, `confirmed_at`, `unsubscribed_at`); `RESEND_AUDIENCE_ID` env var; double opt-in confirmation email sent via Resend; `GET /unsubscribe?token=` endpoint that sets `unsubscribed_at`; email capture form in `home.ts` wired to the endpoint.
**Uses:** `resend@6.9.2` Audiences API (already installed); existing `express-rate-limit` factory; Drizzle migration for `marketing_subscribers`.
**Avoids:** Resend/Beehiiv API key in browser bundle (proxy pattern keeps key server-side); email capture list stored in `users` table (different legal consent basis, must be separate table); missing GDPR consent checkbox; missing unsubscribe endpoint; double opt-in skipped.
**Research flag:** No research phase needed. Resend Audiences API is in the already-installed SDK. Note: Architecture researcher referenced Beehiiv as email list provider; Stack researcher recommends Resend Audiences instead (no new package). Adopt Resend Audiences.

### Phase 7: Email Onboarding Sequence
**Rationale:** Depends on Stripe being live (Phase 4) because Email 3 (upgrade prompt) must link to a real Checkout flow. Depends on the marketing consent model from Phase 6. Using Loops.so eliminates the need for a custom cron+DB email scheduling system.
**Delivers:** `loops@6.2.0` installed (the only new npm package in all of v5.0); `server/src/services/loops.service.ts` with `enrollInOnboarding()` and `triggerUpgradeSequence()` functions; Better Auth `hooks.after` on `/sign-up/email` to call `enrollInOnboarding()`; `user_signed_up` Loops event triggers 3-email sequence configured in Loops dashboard (Welcome immediately, Key Features day 3, Upgrade Prompt day 7); marketing consent flag checked before enrollment — only opted-in users receive emails 2-3; `LOOPS_API_KEY` env var; email copy lives in the Loops dashboard, not in code.
**Uses:** `loops@6.2.0` — use v6.x `createContact()` single-object API (breaking change from v5); Better Auth lifecycle hooks pattern.
**Avoids:** Sending upgrade prompt without GDPR marketing consent (Pitfall 6); custom cron+DB sequence tracking (eliminated by Loops); sending upgrade email to existing Pro users (check plan at enrollment time); more than 3 emails in first 10 days (drives unsubscribes per SaaS research).
**Research flag:** No research phase needed. Loops.so SDK patterns are fully documented in STACK.md with complete code examples.

### Phase 8: Feedback Form Links
**Rationale:** Fully independent of all other phases. No dependencies. Listed last because it requires no blockers and can be appended to any other phase during implementation to avoid context-switching overhead.
**Delivers:** Feedback link on confirmation page (`client/src/pages/confirmation.ts`) and reveal page (`client/src/pages/reveal.ts`); external form (Tally.so recommended — developer-friendly, no tracking cookies by default, free); opens in new tab; completely anonymous form with no required fields.
**Research flag:** No research phase needed. 30-minute task.

### Phase Ordering Rationale

- **Rebrand must be first:** Every downstream file touch should use the final brand name. Rebrand last means editing files twice across every subsequent phase. Broken DMARC/SPF from placeholder email sender domain is a silent failure mode.
- **Homepage split before pricing:** The pricing page CTA links to `/create`. If `/create` does not exist, the link is broken during development. The `max-w-2xl` refactor must precede any full-width marketing page.
- **Pricing before Stripe:** Stripe Checkout `cancel_url` and the success redirect point to `/pricing`. The page must exist before the billing flow is wired.
- **Stripe before email onboarding Email 3:** The upgrade prompt email must link to a live Checkout flow. Do not send an upgrade email if there is no checkout to convert into.
- **SEO pages are independent:** They can be built in parallel with billing phases (3-4) after the rebrand. Listed as Phase 5 for document clarity but can overlap with Phases 3-4 if teams are available.
- **Email capture (Phase 6) before email onboarding (Phase 7):** The GDPR consent model established in Phase 6 informs the marketing consent flag checked in Phase 7. The checkbox on the registration form is part of Phase 6's consent design.

### Research Flags

Phases needing deeper research during planning:
- None. All v5.0 patterns are fully researched and documented with implementation-ready code examples in the research files.

Phases with well-documented patterns (research phase not needed):
- **Phase 1 (Rebrand):** String replacement work with grep-based audit. No patterns to research.
- **Phase 2 (Marketing Homepage):** Existing SPA router pattern. Frontend design skill required per CLAUDE.md.
- **Phase 3 (Pricing Page):** Existing SPA router pattern plus JSON-LD utility (simple DOM append).
- **Phase 4 (Stripe Billing):** Official Stripe docs confirm all patterns. STACK.md has complete code examples. Architecture conflict resolved to manual webhook handler.
- **Phase 5 (SEO Pages):** Architecture conflict resolved — Express SSR. No research needed; pattern is well-understood.
- **Phase 6 (Email Capture):** Resend Audiences API is documented. GDPR consent model documented in PITFALLS.md.
- **Phase 7 (Email Onboarding):** Loops.so SDK fully documented in STACK.md with complete service file example.
- **Phase 8 (Feedback Links):** No research needed. External link to Tally.so form.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via npm registry. Integration patterns verified against official docs. Key conflict resolved: raw `stripe` SDK recommended over `@better-auth/stripe` billing webhooks due to 4 confirmed open bugs. `loops@6.2.0` v6.x API breaking change documented. `@stripe/stripe-js` confirmed unnecessary for Hosted Checkout redirect mode. |
| Features | HIGH | Stripe billing and schema markup guidance from official docs (HIGH). Pricing page UX research from multiple industry sources that agree on key patterns (MEDIUM, treated as HIGH consensus). Competitor analysis from observed live products (MEDIUM). Feature dependency graph is explicit and non-controversial. |
| Architecture | HIGH for Stripe raw-body pattern, SPA homepage/pricing pattern, per-route JSON-LD injection. MEDIUM for SEO page rendering decision (conflict resolved). | Conflict resolved: Express SSR wins over SPA routes for SEO content pages. Two of three research streams (Stack, Pitfalls) independently recommended SSR; Architecture researcher recommended SPA routes for simplicity. SSR adopted because AI crawler blindness to JS is documented and not debatable, Googlebot two-wave delay is confirmed by official Google docs, and Express SSR complexity is low in this codebase. |
| Pitfalls | HIGH for Stripe webhook ordering, subscription status staleness, JS-injected JSON-LD AI crawler invisibility, GDPR email classification. MEDIUM for programmatic SEO thin content risk. | GDPR transactional/marketing boundary is well-established law. Stripe webhook ordering is a deterministic technical failure mode. AI crawler JS blindness is confirmed by official Google documentation and corroborated by Search Engine Journal. Thin content risk is well-documented by Semrush and Google's own quality guidelines. |

**Overall confidence:** HIGH

### Gaps to Address

- **`@better-auth/stripe` bug status:** Issues #2440, #4957, #5976, #4801 were open as of Feb 2026. Before Phase 4 begins, verify whether any have been resolved in a newer `better-auth` release. If all four are resolved, the plugin's billing webhook path may be viable and would simplify the integration. If even one remains open, use the raw Stripe SDK approach.

- **Resend Audiences double opt-in pattern:** Resend's Audiences API handles contact storage, but the double opt-in confirmation email needs to be sent as a standard transactional email via `resend.emails.send()`, not through the Audiences API itself. Verify the exact flow during Phase 6 implementation.

- **Express SSR and CSP nonce for SEO pages:** The `__CSP_NONCE__` replacement pattern currently exists only in the SPA catch-all handler. SSR route handlers for SEO pages need the same nonce injection applied to their HTML templates. Verify this is wired correctly during Phase 5 implementation.

- **Loops.so free tier limit:** Loops is free up to 2,000 contacts. Unlikely to be an issue at launch, but should be checked if email list grows rapidly before Phase 7 ships.

- **NOINDEX_PREFIXES audit for SEO routes:** After Phase 5 ships, verify that `/vs/`, `/alternatives/`, and `/use/` are not accidentally matched by any prefix in `NOINDEX_PREFIXES` in `app.ts`. Run `curl -I https://torchsecret.com/vs/onetimesecret | grep X-Robots` in staging before deploying.

## Sources

### Primary (HIGH confidence)
- [Stripe Webhooks documentation](https://docs.stripe.com/webhooks) — raw body requirement, `constructEvent` pattern
- [Stripe Checkout documentation](https://docs.stripe.com/payments/checkout) — hosted Checkout flow, no client-side Stripe.js required, `redirectToCheckout` deprecated
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) — event types, timing, idempotency
- [Better Auth documentation](https://www.better-auth.com/docs) — Express 5 integration, Drizzle adapter, lifecycle hooks, Stripe plugin
- [Loops.so JavaScript SDK](https://loops.so/docs/sdks/javascript) — v6.x API patterns, v6.0 breaking change for `createContact()`
- [Resend documentation + Audiences API](https://resend.com/docs/dashboard/audiences/contacts) — `contacts.create()` with `audienceId`
- [Google Search Central: JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — two-wave indexing, JS rendering latency on new domains
- [Google Search Central: Structured Data with JavaScript](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript) — JSON-LD JS injection timing requirements
- [Google Search Central: FAQPage structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage) — FAQPage schema requirements, must match visible page content
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) — `type="application/ld+json"` is a data block, not subject to `script-src`
- [GDPR Email Compliance — Omnisend](https://www.omnisend.com/blog/gdpr-video-gdpr-ready-email-marketing-automation-consent/) — transactional vs. marketing classification, consent record requirements, double opt-in
- npm registry: `better-auth@1.4.18`, `stripe@20.3.1`, `resend@6.9.2`, `loops@6.2.0`, `posthog-js@1.351.1`, `posthog-node@5.24.17` — versions verified

### Secondary (MEDIUM confidence)
- Better Auth Stripe plugin open issues: [#2440](https://github.com/better-auth/better-auth/issues/2440), [#4957](https://github.com/better-auth/better-auth/issues/4957), [#5976](https://github.com/better-auth/better-auth/issues/5976), [#4801](https://github.com/better-auth/better-auth/issues/4801) — bugs confirmed open as of Feb 2026; status may change
- [Search Engine Journal: AI Search Optimization](https://www.searchenginejournal.com/ai-search-optimization-make-your-structured-data-accessible/537843/) — AI crawlers cannot execute JavaScript; confirmed independently by Pitfalls research
- [Semrush: Thin Content](https://www.semrush.com/blog/thin-content/) — what constitutes thin content, post-core-update de-indexing patterns
- [TermsFeed: GDPR Transactional vs Marketing Email](https://www.termsfeed.com/blog/gdpr-transactional-emails/) — legal classification guidance for onboarding email types
- Pricing page UX research (InfluenceFlow, Userpilot, Artisan Strategies) — highlighted tier conversion +22%, annual billing uplift 25-35%, FAQ impact 11.8% — multiple sources agree
- Competitor research: OneTimeSecret pricing page (~$35/month Identity Plus), PwPush documentation, Privnote site — verify specific claims against live products before authoring comparison pages

---
*Research completed: 2026-02-22*
*Ready for roadmap: yes*
