---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Product Launch Checklist
status: unknown
last_updated: "2026-02-26T14:02:26.061Z"
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 22
  completed_plans: 20
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist — Phase 35: SEO Content Pages (Express SSR)

## Current Position

Phase: 35 of 38 (SEO Content Pages Express SSR) — IN PROGRESS
Plan: 2 of 4 in current phase — Plan 02 complete (USE_CASE_PAGES data map 8 slugs, useRouter hub + individual pages with HowTo + FAQPage JSON-LD, seoRouter /use mount)
Status: Phase 35 Plan 02 complete — 3 files; TypeScript clean; husky pre-commit passes; useRouter integrated into seoRouter
Last activity: 2026-02-26 — Phase 35 Plan 02 complete; use-case-pages.ts (8 slugs + hub), use.ts (useRouter), index.ts (/use mount)

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
| Phase 34.1 P01 | 2min | 2 tasks | 3 files |
| Phase 34.1 P02 | 7 | 2 tasks | 3 files |
| Phase 35 P01 | 19 | 2 tasks | 6 files |
| Phase 35 P02 | 9 | 2 tasks | 3 files |

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

### Phase 34.1 Execution Notes

- protection_type enum ('none'|'passphrase'|'password') added to CreateSecretSchema with `.optional().default('none')` — backwards-compatible
- Anonymous users get 403 `passphrase_not_allowed` for both passphrase and password types (no DB lookup, just !userId check)
- Free users get 403 `pro_required` for password type (DB lookup via Drizzle: select subscriptionTier from users where id = userId)
- Passphrase type for free users does NOT trigger DB lookup — avoids unnecessary round-trip
- error codes: `passphrase_not_allowed` for anonymous, `pro_required` for free attempting password
- Protection tier guard placed after expiresIn caps, before createSecret() call in POST handler
- Pro user elevation in tests: createUserAndSignIn() + direct Drizzle update to set subscriptionTier='pro'
- 271 total tests pass (6 new protection_type tier tests + 265 pre-existing)
- Plan 02: createProtectionPanel({ isAuthenticated, isPro }) — getLockLevel() helper drives per-tab lock state
- Plan 02: Locked tab popovers appended to root (OUTSIDE tablist) — tablist must only own tab-role children (aria-required-children); tab elements must not contain interactive descendants (nested-interactive axe 4.11)
- Plan 02: createProtectionPanel exported @internal for test isolation — generate-tab tests need Pro-mode panel since generate/custom are Pro-locked in anonymous mode
- Plan 02: Auth IIFE replaces protection panel after tier resolves: oldPanel.parentElement?.insertBefore(newPanel, oldPanel); oldPanel.remove()
- Plan 02: Submit handler reads protectionType = protectionPanel.getProtectionType(); passes as 6th arg to createSecret()
- Plan 02: createSecret() extended with protectionType param (default 'none'); serialized as protection_type (snake_case) in JSON body

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

### Phase 35 Execution Notes

- SSR template pattern: TypeScript string helpers (P/H1/H2/LI/STRONG/HR constants + CARD_OPEN/CARD_CLOSE) — zero new dependencies, nonce threading straightforward
- getBuiltCssHref() reads CSS hash from client/dist/index.html at module load — never hardcoded, empty string fallback in dev when client/dist does not exist
- CSS custom properties defined in inline <style> block (not Tailwind utility classes) — linked compiled CSS handles utility classes; custom props give full --ds-color-* token coverage
- Dark mode: @media (prefers-color-scheme: dark) on :root — not .dark class (SPA uses JS toggle; SSR pages use CSS-only approach)
- FAQPage JSON-LD in <head> only — NOT rendered as visible body HTML on VS pages (plan specification)
- 404 returns JSON {error: 'not_found'} — consistent with API error format
- ESLint no-useless-escape rule does not have auto-fix; required manual rewrite of string quoting in both data files (apostrophes in content broke single-quoted strings)
- seoRouter not yet mounted in app.ts — Plan 03 wires it in before SPA catch-all
- Plan 02: HowTo + FAQPage combined into single JSON.stringify([howToSchema, faqSchema]) for one <script> block — valid per schema.org spec
- Plan 02: FAQ items visible in body as <dl>/<dt>/<dd> on use-case pages (unlike VS pages where FAQ is JSON-LD only) — plan specification
- Plan 02: Quote strategy from Plan 01 applied proactively — double-quoted strings for apostrophe content; no ESLint no-useless-escape issues encountered

### Blockers/Concerns

None — v4.0 clean ship, v5.0 roadmap finalized

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 35-02-PLAN.md — USE_CASE_PAGES data map (8 slugs + hub), use.ts useRouter (hub + individual pages with HowTo + FAQPage JSON-LD), seoRouter /use mount; 3 files; TypeScript clean; husky passes
Resume file: None — Phase 35 Plan 02 complete; next plan is 35-03 (mount seoRouter into app.ts)
