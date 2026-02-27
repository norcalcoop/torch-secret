---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Product Launch Checklist
status: unknown
last_updated: "2026-02-27T00:51:04.186Z"
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 29
  completed_plans: 27
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-22 after v5.0 milestone started)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity
**Current focus:** v5.0 Product Launch Checklist — Phase 37: Email Onboarding Sequence (Loops integration)

## Current Position

Phase: 37 of 38 (Email Onboarding Sequence) — IN PROGRESS
Plan: 2 of TBD — Plan 02 complete; Plan 03 is next (if any)
Status: Phase 37 Plan 02 complete — Loops SDK installed, onboarding service wired, activatePro syncs Loops contact; all 7 RED test scaffolds now GREEN
Last activity: 2026-02-27 — Phase 37 Plan 02 complete; loops@6.2.0 installed; config/loops.ts singleton; onboarding.service.ts; auth.ts databaseHooks hook; billing.service.ts extended with Loops contact sync

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
| Phase 35 P03 | 2min | 2 tasks | 3 files |
| Phase 36 P01 | 7min | 2 tasks | 9 files |
| Phase 36 P02 | 2min | 2 tasks | 3 files |
| Phase 36 P03 | 3min | 2 tasks | 5 files |
| Phase 36 P04 | ~1min | 1 task (checkpoint) | 0 files |
| Phase 37 P01 | 5 | 2 tasks | 10 files |
| Phase 37 P02 | 3min | 2 tasks | 7 files |

## Accumulated Context

### Key Architectural Constraints (carry forward every phase)

- Zero-knowledge invariant: no log, DB record, or analytics event may contain both userId and secretId in the same record — ever (see .planning/INVARIANTS.md)
- Stripe webhook route must be mounted BEFORE express.json() in app.ts — mounting after causes silent signature verification failures ("No signatures found matching the expected signature")
- Do NOT use @better-auth/stripe billing webhook path — 4 open bugs (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle; use raw stripe SDK with hand-written handler
- SEO content pages (/vs/*, /alternatives/*, /use/*) MUST be Express SSR — SPA routes are invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and delay Googlebot indexing by days-to-weeks on a new domain
- GDPR: welcome email is transactional (no consent needed); key features + upgrade prompt emails are marketing (explicit consent required; marketing consent checkbox on registration form must be unchecked by default)
- loops@6.2.0 uses v6.x sendEvent()/updateContact() single-object API — breaking change from v5; do not use v5 positional arguments
- Loops databaseHooks.after hook must be non-async when using void+.catch() fire-and-forget — async without await triggers @typescript-eslint/require-await
- activatePro() extended with DB select by stripeCustomerId to get email, then loops.updateContact({ subscriptionTier: 'pro' }) fire-and-forget — billing never blocked by Loops outage
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
- Plan 03: seoRouter mounted with app.use(seoRouter) (no path prefix) — routes internally mount /vs, /alternatives, /use; no double-prefix needed
- Plan 03: NOINDEX_PREFIXES verified unchanged — /vs, /alternatives, /use not added; these SSR pages are intentionally crawlable by Googlebot and AI bots
- Plan 03: sitemap.xml extended from 1 to 17 entries (root + pricing pre-existing + 14 new SEO pages)
- Plan 03: SSR integration test pattern uses buildApp() + supertest with no DB setup block — SSR routes have no DB dependency
- Plan 03: 302 total tests passing (31 new SEO tests + 271 pre-existing)

### Phase 37 Execution Notes

- marketingConsent boolean column added to users table via migration 0006 (ALTER TABLE "users" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL)
- Better Auth additionalFields.marketingConsent with input:true — client signUp.email() passes consent value directly into users table without custom middleware or endpoints
- Migration renamed from drizzle-kit auto-name (0006_deep_joystick.sql) to 0006_add_marketing_consent.sql per project convention; _journal.json updated
- LOOPS_API_KEY added as required env var (not optional); CI placeholder loops_placeholder added to test job
- register.ts: #marketing-consent checkbox unchecked by default, inserted before consentLine via form.insertBefore(); setFormLoading() extended to disable/enable checkbox
- 321 total tests pass after Plan 01 (3 new GREEN from register.test.ts + 318 pre-existing)
- onboarding.service.test.ts (6 cases) and billing.service.test.ts (1 case) are intentional RED — Plan 02 creates the onboarding service and extends billing service

### Phase 36 Execution Notes

- marketing_subscribers has NO FK to users or secrets — standalone GDPR table, ZK invariant enforced at schema level
- INVARIANTS.md must be updated BEFORE any schema/code changes — per CLAUDE.md mandate (Phase 36 row added first)
- vi.mocked() wrapper functions (emailSend()/contactsCreate()) for mock assertions — avoids @typescript-eslint/unbound-method on object property methods
- @typescript-eslint/unbound-method: off added to test file ESLint config — vi.mocked() objects are not real class instances; this-binding concern inapplicable
- Stripe env vars (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET/STRIPE_PRO_PRICE_ID) backfilled into ci.yml — pre-existing gap fixed alongside Phase 36 vars
- vi.mock() factory hoisting: variables defined before vi.mock() are not accessible in the factory — use vi.fn() inline; access via vi.mocked() in test body
- Plan 01 delivers: INVARIANTS.md row, marketingSubscribers schema, migration 0005 (applied), env vars, 16 RED test cases
- Plan 02 complete: POST /api/subscribers, GET /api/subscribers/confirm, GET /api/subscribers/unsubscribe — all 16 tests GREEN (318 total)
- onConflictDoUpdate WHERE status='pending': only pending rows get token refresh; confirmed rows preserved silently
- createSubscriber returns void with no state indication — prevents subscriber status enumeration across all three states
- Resend contacts.create is fire-and-forget (.catch()) — local DB is source of truth; Resend Audience is best-effort sync
- Plan 03 complete: void handleSubmit() pattern for async addEventListener — avoids @typescript-eslint/no-misused-promises; replaceFormWithSuccess() clears section in-place; unsubscribe always shows success (idempotent — no token validity leakage)
- /confirm and /unsubscribe registered in router.ts with noindex: true; both added to NOINDEX_PREFIXES in server/src/app.ts for X-Robots-Tag
- Build verified: confirm and unsubscribe emit as separate chunks (confirm-*.js, unsubscribe-*.js)
- Plan 04 complete: human verification approved 2026-02-26; all 5 ECAP requirements confirmed by tester (form submission, consent enforcement, confirmation email, /confirm + /unsubscribe pages, NOINDEX headers, ip_hash integrity)

### Blockers/Concerns

None — v4.0 clean ship, v5.0 roadmap finalized

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 37-02-PLAN.md — Loops SDK installed, onboarding service created, auth.ts databaseHooks wired, activatePro extended with Loops contact sync; 328 tests GREEN
Resume file: None — Phase 37 Plan 02 complete; check ROADMAP.md for next plan in phase 37
