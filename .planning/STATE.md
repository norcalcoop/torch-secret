---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Product Launch Checklist
status: unknown
last_updated: "2026-02-26T00:44:06.268Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 16
  completed_plans: 16
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist — Phase 34: Stripe Pro Billing

## Current Position

Phase: 34 of 38 (Stripe Pro Billing) — COMPLETE
Plan: 4 of 4 in current phase — Plan 04 complete (dashboard Pro billing UI: Pro badge, upgrade CTA, Manage Subscription, post-checkout verification banner)
Status: Phase 34 Complete — All four plans shipped: DB foundation (01), billing routes (02), create page Pro gating (03), dashboard billing UI (04)
Last activity: 2026-02-23 — Phase 34 Plan 04 complete; full Stripe subscription flow wired end-to-end

Progress: [█░░░░░░░░░] 12% (v5.0 phases — 1/8 phases in progress)

## Performance Metrics

| Milestone | Phases | Plans | Timeline |
|-----------|--------|-------|----------|
| v1.0 MVP | 8 | 22 | 2 days |
| v2.0 UI & SEO | 6 | 14 | 3 days |
| v3.0 Production-Ready | 6 | 15 | 2 days |
| v4.0 Hybrid Anonymous + Account | 10 | 38 | 4 days |
| **Total shipped** | **30** | **89** | **~11 days** |

*v5.0 velocity tracking begins after first plan completes*
| Phase 32 P02 | 3min | 2 tasks | 1 file |
| Phase 32 P01 | 2 | 1 task | 2 files |
| Phase 31 P04 | 2 | 1 task | 1 file |
| Phase 31 P02 | 247 | 2 tasks | 7 files |
| Phase 31 P01 | 8 | 3 tasks | 32 files |
| Phase 32 P04 | ~30min | 2 tasks | 1 file |
| Phase 32 P03 | 175s | 2 tasks | 1 files |
| Phase 33 P01 | 4 | 1 tasks | 1 files |
| Phase 33 P02 | 2min | 2 tasks | 2 files |
| Phase 33 P03 | 5 | 2 tasks | 0 files |
| Phase 34 P01 | 2min | 2 tasks | 10 files |
| Phase 34 P02 | 2min | 2 tasks | 4 files |
| Phase 34 P03 | 5min | 2 tasks | 4 files |
| Phase 34 P04 | 3min | 1 task | 1 file |

## Accumulated Context

### Key Architectural Constraints (carry forward every phase)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever (see .planning/INVARIANTS.md)
- Stripe webhook route must be mounted BEFORE express.json() in app.ts — mounting after causes silent signature verification failures ("No signatures found matching the expected signature")
- Do NOT use @better-auth/stripe billing webhook path — 4 open bugs (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle; use raw stripe SDK with hand-written handler
- SEO content pages (/vs/*, /alternatives/*, /use/*) MUST be Express SSR — SPA routes are invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and delay Googlebot indexing by days-to-weeks on a new domain
- GDPR: welcome email is transactional (no consent needed); key features + upgrade prompt emails are marketing (explicit consent required; marketing consent checkbox on registration form must be unchecked by default)
- loops@6.2.0 uses v6.x createContact() single-object API — breaking change from v5; do not use v5 positional arguments
- Use resend@6.9.2 Audiences API (resend.contacts.create()) for email list capture — no new package needed
- Before writing any webhook handler code: extend INVARIANTS.md with a Stripe/billing row first (BILL-06)

### Phase 34 Execution Notes

- Stripe billing foundation (Plan 01) complete: stripe_customer_id + subscription_tier columns on users table; migration 0004 applied; billing.service.ts exports getOrCreateStripeCustomer, activatePro, deactivatePro
- ZK billing pattern established: activatePro/deactivatePro receive stripe_customer_id only — webhook handler never has userId in scope alongside secretId
- Stripe SDK singleton: import { stripe } from '../config/stripe.js' — never new Stripe() in service files
- subscriptionTierEnum exported from schema.ts at module scope (before users table) so drizzle-kit generates CREATE TYPE statement
- All three Stripe env vars required (not optional) in Zod schema: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID
- BILL-06 satisfied before any webhook handler code written
- Billing routes (Plan 02) complete: POST /api/billing/checkout, GET /api/billing/verify-checkout, POST /api/billing/portal, POST /api/webhooks/stripe
- Webhook ordering invariant confirmed: stripeWebhookHandler mounted with express.raw() at line 78 in app.ts — BEFORE express.json() at line 85
- POST /api/billing/checkout (not GET) — state-creating operation; GET in plan code sample was incorrect; must_haves spec (POST) takes precedence
- GET /api/me now returns subscriptionTier via DB lookup — Better Auth AuthUser does not include custom columns
- Frontend Pro tier gating (Plan 03) complete: MeResponse/billing types in shared/types/api.ts; getMe/initiateCheckout/verifyCheckoutSession/createPortalSession in client.ts; custom combobox in expiration-select.ts with Lock icon + tooltip on 30d for free users
- Custom combobox pattern established: native <select> cannot render icons/tooltips on individual options — use div-based ARIA combobox (role=combobox trigger + role=listbox + role=option rows)
- NodeListOf requires Array.from() in for-of loops under ES2022 lib target — tsconfig does not include downlevel iterator support for DOM NodeList
- getMe() called in auth IIFE with try/catch fallback: isPro = false on any API error (safe degradation — create page never breaks)
- Dashboard billing UI (Plan 04) complete: Pro badge + logout card vertical restructure; upgrade CTA (free) / Manage Subscription (Pro); post-checkout ?upgraded=true&session_id=... verification banner; ?checkout=cancelled toast; URL params cleaned with history.replaceState
- Post-checkout verification pattern: void IIFE with spinner banner inserted synchronously, updated async after verifyCheckoutSession() resolves — banner does not block page render
- getMe() on dashboard load: subscriptionTier fetched after session check; isPro used to gate Pro badge and billing row content

### Phase 33 Execution Notes

- pricing.ts (Plan 01) complete: 473 lines, exports renderPricingPage() and FAQ_ITEMS
- Billing toggle registration pattern: toggle creates callback slot; createTierCards registers Pro card's updatePrice fn via the returned registration function
- Pro card price refs stored (proAmountEl/proPeriodEl/proSubLabelEl) and updated via textContent — no re-render on toggle
- Annual pricing: $65/year ($5.42/mo equivalent) at 22.6% savings; matches "22% savings" badge requirement
- FAQ_ITEMS is canonical source — Plan 02 copied verbatim strings into FAQPage JSON-LD in index.html (DONE)
- FAQPage JSON-LD in index.html is static (not JS-injected) — required for SPA curl-verifiability (PRICE-05)
- Pro CTA: /register?plan=pro — Phase 34 reads query param; auth-aware CTA deferred to Phase 34
- Native <details>/<summary> accordion; group-open:rotate-180 on chevron via Tailwind CSS 4 group-open: variant
- /pricing route is live, SEO-indexable — noindex removed in Plan 02

### Phase 32 Execution Notes

- Router split complete: / → home.js (no noindex, indexable), /create → create.js (existing form), /pricing stub (noindex, not_found — Phase 33 target)
- home.ts (Plan 02) complete: 4-section marketing page (hero, trust strip, use-cases, GDPR email capture), 346 lines, no innerHTML, TypeScript clean
- Stub pattern established: create .ts with correct export signature for ESLint safety before module implementation plan runs
- Nav overhaul (Plan 03): desktop header has Pricing + Dashboard/Login + Create a Secret CTA + ThemeToggle; mobile gets iOS-style bottom tab bar with 4 tabs (Home/Create/Pricing/Dashboard)
- Mobile nav uses document.body.appendChild() outside flex column — fixed position requires this
- updateCreateLink() toggles sm:block (not hidden) to preserve desktop-only base class pattern (hidden sm:block)
- Footer needs mb-16 sm:mb-0 (Plan 04 UAT fix): page wrapper pb-16 alone is insufficient — the footer element itself must have bottom margin to clear the fixed 64px tab bar on mobile

### Phase 31 Execution Notes

- BRAND-03 gap closure: protection panel hardcoded text-white/* classes replaced with semantic tokens (text-text-primary/secondary/muted, border-border) — light theme now readable across all four protection tabs

### Phase 31 Kickoff Notes

- BRAND-01/02: grep audit recommended — search for "SecureShare" and "secureshare.example.com" across all files before and after rename to verify completeness
- TECH-01: Add placeholder env vars to ci.yml matching the docker-compose.yml pattern (BETTER_AUTH_SECRET, DATABASE_URL, etc.)
- TECH-02: Add '/privacy' and '/terms' to NOINDEX_PREFIXES array in server/src/app.ts
- TECH-03: Update schema.ts ZK comment to list all 7 enforcement points from INVARIANTS.md (DONE — 31-03)

### Roadmap Evolution

- Phase 34.1 inserted after Phase 34: Passphrase/Password Tier Enforcement (URGENT) — anonymous users blocked from all passphrase/password options; free users limited to generated passphrases; Pro users get full password/passphrase/custom control

### Blockers/Concerns

None — v4.0 clean ship, v5.0 roadmap finalized

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 34-04-PLAN.md — Phase 34 complete; dashboard Pro badge, upgrade CTA, Manage Subscription, post-checkout verification banner all live
Resume file: None — Phase 34 complete; next phase is Phase 35
