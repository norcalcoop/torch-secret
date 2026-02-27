# Roadmap: Torch Secret

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-15)
- ✅ **v2.0 Developer-Grade UI & SEO** — Phases 9-14 (shipped 2026-02-16)
- ✅ **v3.0 Production-Ready Delivery** — Phases 15-20 (shipped 2026-02-18)
- ✅ **v4.0 Hybrid Anonymous + Account Model** — Phases 21-30 (shipped 2026-02-22)
- 🚧 **v5.0 Product Launch Checklist** — Phases 31-38 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-8) — SHIPPED 2026-02-15</summary>

- [x] Phase 1: Encryption Foundation (4/4 plans) — completed 2026-02-13
- [x] Phase 2: Database and API (3/3 plans) — completed 2026-02-14
- [x] Phase 3: Security Hardening (2/2 plans) — completed 2026-02-14
- [x] Phase 4: Frontend Create and Reveal (4/4 plans) — completed 2026-02-14
- [x] Phase 5: Password Protection (3/3 plans) — completed 2026-02-14
- [x] Phase 6: Expiration Worker (2/2 plans) — completed 2026-02-14
- [x] Phase 7: Trust and Accessibility (2/2 plans) — completed 2026-02-15
- [x] Phase 8: Tech Debt Cleanup (2/2 plans) — completed 2026-02-14

See [v1.0 Roadmap Archive](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v2.0 Developer-Grade UI & SEO (Phases 9-14) — SHIPPED 2026-02-16</summary>

- [x] Phase 9: Design System Foundation (3/3 plans) — completed 2026-02-15
- [x] Phase 10: SEO Static Assets (2/2 plans) — completed 2026-02-15
- [x] Phase 11: Layout Shell + Component Migration (2/2 plans) — completed 2026-02-16
- [x] Phase 12: Page-Level UI Enhancements (3/3 plans) — completed 2026-02-16
- [x] Phase 13: Theme Toggle + Visual Polish (2/2 plans) — completed 2026-02-16
- [x] Phase 14: SEO Router Integration (2/2 plans) — completed 2026-02-16

See [v2.0 Roadmap Archive](milestones/v2.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v3.0 Production-Ready Delivery (Phases 15-20) — SHIPPED 2026-02-18</summary>

- [x] Phase 15: Code Quality Foundation (3/3 plans) — completed 2026-02-17
- [x] Phase 16: Docker & Local Development (4/4 plans) — completed 2026-02-17
- [x] Phase 17: E2E Testing with Playwright (2/2 plans) — completed 2026-02-17
- [x] Phase 18: CI/CD Pipeline (2/2 plans) — completed 2026-02-18
- [x] Phase 19: GitHub Repository Polish (3/3 plans) — completed 2026-02-18
- [x] Phase 20: Fix Multi-Browser CI (1/1 plan) — completed 2026-02-18

See [v3.0 Roadmap Archive](milestones/v3.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v4.0 Hybrid Anonymous + Account Model (Phases 21-30) — SHIPPED 2026-02-22</summary>

- [x] Phase 21: Schema Foundation (3/3 plans) — completed 2026-02-19
- [x] Phase 22: Authentication (7/7 plans) — completed 2026-02-19
- [x] Phase 23: Secret Dashboard (5/5 plans) — completed 2026-02-20
- [x] Phase 24: EFF Diceware Passphrase Generator (3/3 plans) — completed 2026-02-21
- [x] Phase 25: PostHog Analytics (3/3 plans) — completed 2026-02-21
- [x] Phase 26: Email Notifications (3/3 plans) — completed 2026-02-21
- [x] Phase 27: Conversion Prompts + Rate Limits + Legal Pages (4/4 plans) — completed 2026-02-21
- [x] Phase 28: Optional Password or Passphrase Protection (3/3 plans) — completed 2026-02-21
- [x] Phase 29: v4.0 Tech Debt Cleanup (5/5 plans) — completed 2026-02-22
- [x] Phase 30: Docker & Render Deployment Fixes (2/2 plans) — completed 2026-02-22

See [v4.0 Roadmap Archive](milestones/v4.0-ROADMAP.md) for full phase details.

</details>

### 🚧 v5.0 Product Launch Checklist (In Progress)

**Milestone Goal:** Ship everything needed to publicly launch Torch Secret — rebrand, marketing homepage, pricing + Pro billing, SEO content pages, email onboarding, and pre-launch infrastructure.

- [x] **Phase 31: Rebrand + Tech Debt** — Rename SecureShare to Torch Secret and torchsecret.com throughout all code; clear four known tech debt items (completed 2026-02-22)
- [x] **Phase 32: Marketing Homepage + /create Split** — Move create-secret form to /create; build marketing landing page at / (completed 2026-02-23)
- [x] **Phase 33: Pricing Page** — Static /pricing page with Free vs Pro tier cards, billing toggle, FAQ, and FAQPage JSON-LD (completed 2026-02-23)
- [x] **Phase 34: Stripe Pro Billing** — Checkout, webhook lifecycle handler, Pro feature unlock (30-day expiration), Customer Portal (completed 2026-02-26)
- [x] **Phase 35: SEO Content Pages (Express SSR)** — Server-rendered /vs/*, /alternatives/*, /use/* pages with JSON-LD visible to AI crawlers (completed 2026-02-26)
- [x] **Phase 36: Email Capture** — GDPR-compliant homepage email list capture backed by Resend Audiences, with double opt-in (completed 2026-02-26)
- [x] **Phase 37: Email Onboarding Sequence** — 3-email Loops.so sequence triggered on registration (welcome, key features, upgrade prompt) (completed 2026-02-27)
- [ ] **Phase 38: Feedback Links** — Tally.so feedback link on confirmation and post-reveal pages

## Phase Details

### Phase 31: Rebrand + Tech Debt
**Goal**: The product is publicly named Torch Secret with torchsecret.com throughout every user-facing surface, and four known tech debt items are cleared before any new feature code is written
**Depends on**: Phase 30 (v4.0 complete)
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, TECH-01, TECH-02, TECH-03
**Success Criteria** (what must be TRUE):
  1. Every HTML `<title>`, OG tag, email sender name, header logo text, and README heading reads "Torch Secret" — no occurrence of "SecureShare" remains in user-facing output
  2. All canonical URLs, sitemap entries, JSON-LD `@id`/`url` fields, and OG image URLs use the `torchsecret.com` domain — `secureshare.example.com` does not appear in any served HTML or sitemap
  3. CI workflow passes with placeholder env vars (`BETTER_AUTH_SECRET`, `DATABASE_URL`, etc.) included so integration tests do not fail in CI due to missing secrets
  4. GET requests to `/privacy` and `/terms` return an `X-Robots-Tag: noindex` response header (server-side enforcement, not just client-side meta)
  5. The zero-knowledge inline comment in `schema.ts` lists all 7 enforcement points matching the canonical list in `INVARIANTS.md`
**Plans**: 4 plans
Plans:
- [x] 31-01-PLAN.md — User-facing brand rename (client src, server src, static files, planning docs)
- [x] 31-02-PLAN.md — Infrastructure rename + CI env vars + Lucide upgrade + README refresh
- [x] 31-03-PLAN.md — Server-side tech debt (NOINDEX headers, schema.ts comment, planning doc fixes)
- [x] 31-04-PLAN.md — Gap closure: fix light-theme invisible text in protection panel (create.ts semantic tokens)

### Phase 32: Marketing Homepage + /create Split
**Goal**: Users arrive at `/` and see a marketing landing page that explains Torch Secret's zero-knowledge model; the create-secret form lives at `/create` and is unaffected in functionality
**Depends on**: Phase 31
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05
**Success Criteria** (what must be TRUE):
  1. Navigating to `/` shows a hero section with headline, subhead, and CTA button — no secret creation textarea is present on the homepage
  2. Navigating to `/create` shows the fully functional secret creation form (same behavior as the former `/` page)
  3. The header navigation includes links to `/create`, `/pricing`, and `/dashboard` and these links work from every SPA route
  4. The homepage includes an email capture form widget (UI visible; submission wired in Phase 36)
  5. Viewing page source or curl output for `/` includes a `WebApplication` JSON-LD script block in the `<head>`
**Plans**: 4 plans
Plans:
- [x] 32-01-PLAN.md — Router split: / → home.js, /create → create.js, /pricing stub
- [x] 32-02-PLAN.md — Homepage page module: hero, use-cases, GDPR email capture
- [x] 32-03-PLAN.md — Nav overhaul: desktop links + iOS-style mobile bottom tab bar
- [x] 32-04-PLAN.md — Human verification checkpoint

### Phase 33: Pricing Page
**Goal**: Users can evaluate Free vs Pro tiers, understand pricing, and get answers to common billing questions — all from a single static page at `/pricing`
**Depends on**: Phase 32
**Requirements**: PRICE-01, PRICE-02, PRICE-03, PRICE-04, PRICE-05
**Success Criteria** (what must be TRUE):
  1. Navigating to `/pricing` shows side-by-side Free and Pro tier cards with a complete feature list for each tier
  2. A monthly/annual billing toggle is visible with annual selected by default and displays a "22% savings" label when toggled
  3. The Pro tier card is visually distinct with a "Recommended" badge
  4. A FAQ accordion section with 6-8 questions (covering cancellation, refunds, billing cycle, trial, and payment methods) is visible below the pricing cards
  5. Viewing page source or curl output for `/pricing` includes a `FAQPage` JSON-LD script block in the `<head>`
**Plans**: 3 plans
Plans:
- [x] 33-01-PLAN.md — pricing.ts page module: page header, billing toggle, Free + Pro cards, FAQ accordion
- [x] 33-02-PLAN.md — Static FAQPage JSON-LD in index.html + router stub swap
- [x] 33-03-PLAN.md — Human UAT checkpoint: verify all PRICE requirements

### Phase 34: Stripe Pro Billing
**Goal**: Authenticated users can subscribe to Pro, manage their subscription, and immediately receive the 30-day expiration unlock; the subscription lifecycle is kept accurate by webhook events
**Depends on**: Phase 33
**Requirements**: BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06
**Success Criteria** (what must be TRUE):
  1. An authenticated user clicking the Pro upgrade CTA is redirected to Stripe Checkout and, on completing payment, is returned to a success page that confirms their active subscription (verified via direct Stripe API query, not reliant on webhook timing)
  2. A Pro subscriber sees a "30 days" option in the expiration dropdown when creating secrets; a Free user does not see this option
  3. An authenticated Pro user clicking "Manage Subscription" is redirected to the Stripe Customer Portal where they can cancel or update payment
  4. Cancelling a subscription (simulated via webhook `customer.subscription.deleted` event) removes Pro access within one billing cycle — the 30-day expiration option disappears for the now-Free user
  5. INVARIANTS.md contains a Stripe/billing row documenting that no webhook handler payload logs both `customerId` and `userId` together, added before any webhook handler code is written
**Plans**: 5 plans
Plans:
- [x] 34-01-PLAN.md — INVARIANTS.md update + DB schema migration + Stripe SDK + billing service foundation
- [x] 34-02-PLAN.md — Server billing routes (checkout, verify-checkout, portal) + webhook handler + me.ts extension
- [x] 34-03-PLAN.md — Frontend shared types + billing API client + Pro-aware expiration select + create.ts wiring
- [x] 34-04-PLAN.md — Dashboard Pro badge, upgrade CTA, Manage Subscription, post-checkout banner/toast
- [x] 34-05-PLAN.md — Human UAT checkpoint: verify all BILL requirements end-to-end

### Phase 34.1: Passphrase/Password Tier Enforcement (INSERTED)

**Goal:** Anonymous users cannot set any passphrase/password. Free users can only generate passphrases (no custom passwords). Pro users can set passwords, generate passphrases, and set custom passwords. Gate the secret creation UI and API by account tier.
**Requirements**: TIER-01, TIER-02, TIER-03, TIER-04, TIER-05
**Depends on:** Phase 34
**Plans:** 2/2 plans complete

Plans:
- [x] 34.1-01-PLAN.md — Shared type + API tier enforcement + integration tests (protection_type in CreateSecretSchema, 403 guards in secrets.ts)
- [x] 34.1-02-PLAN.md — Frontend protection panel refactor (tier-aware locked tabs, popovers, submit handler wiring)

### Phase 35: SEO Content Pages (Express SSR)
**Goal**: Competitor comparison, alternative, and use-case pages are fully server-rendered so their content is visible to AI crawlers and indexes on Google without a JavaScript rendering delay
**Depends on**: Phase 31
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06
**Success Criteria** (what must be TRUE):
  1. Running `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` (and equivalents for `/vs/pwpush`, `/vs/privnote`) returns the page's H1 heading — content is present in the initial HTTP response, not injected by JavaScript
  2. Running `curl https://torchsecret.com/alternatives/onetimesecret | grep '<h1>'` (and equivalents for pwpush, privnote) returns the page H1 in the initial response
  3. Navigating to `/use/` shows a hub page linking to all published use-case pages
  4. Navigating to any published `/use/[slug]` page shows substantive content with a visible H1 and a HowTo JSON-LD block in `<head>`
  5. Running `curl -I https://torchsecret.com/vs/onetimesecret | grep X-Robots` returns no `noindex` header — SEO pages are indexable
  6. All new SEO routes (`/vs/*`, `/alternatives/*`, `/use/*`) appear in `sitemap.xml`
**Plans**: 4 plans
Plans:
- [x] 35-01-PLAN.md — VS + alternatives SSR templates: layout helpers, /vs/* and /alternatives/* routes with FAQPage JSON-LD
- [x] 35-02-PLAN.md — Use-case SSR templates: /use/* hub + slug pages with HowTo + FAQPage JSON-LD
- [x] 35-03-PLAN.md — seoRouter wiring in app.ts + sitemap.xml extended to 17 entries + integration tests
- [x] 35-04-PLAN.md — Human UAT checkpoint: verify all SEO requirements end-to-end

### Phase 36: Email Capture
**Goal**: Users can join the Torch Secret mailing list from the homepage with informed GDPR consent, receive a confirmation email, and unsubscribe at any time via a link
**Depends on**: Phase 32
**Requirements**: ECAP-01, ECAP-02, ECAP-03, ECAP-04, ECAP-05
**Success Criteria** (what must be TRUE):
  1. Submitting the homepage email capture form with a valid email address and the consent checkbox checked returns a success message — no error is shown
  2. The consent checkbox is unchecked by default and displays clear consent language; form submission is blocked if the checkbox is unchecked
  3. After submitting, the user receives a confirmation email with a link to complete double opt-in before being added to the active subscriber list
  4. Clicking the unsubscribe link in any marketing email (or navigating to `GET /unsubscribe?token=`) shows a confirmation that the user has been unsubscribed
  5. The `marketing_subscribers` table stores consent timestamp, consent text snapshot, and IP hash for each subscriber — no plain-text IP addresses are stored
**Plans**: 4 plans
Plans:
- [x] 36-01-PLAN.md — INVARIANTS.md extension + marketingSubscribers schema + env vars + migration + test scaffold
- [x] 36-02-PLAN.md — Subscriber service + subscribersRouter (POST, GET /confirm, GET /unsubscribe) + app.ts wiring
- [x] 36-03-PLAN.md — home.ts form wiring + /confirm and /unsubscribe SPA pages + router + NOINDEX
- [x] 36-04-PLAN.md — Human UAT checkpoint: verify all ECAP requirements end-to-end

### Phase 37: Email Onboarding Sequence
**Goal**: Every new account holder automatically receives a timed 3-email sequence that introduces Torch Secret, highlights key features, and (with marketing consent) prompts upgrade to Pro
**Depends on**: Phase 34, Phase 36
**Requirements**: ESEQ-01, ESEQ-02, ESEQ-03, ESEQ-04
**Success Criteria** (what must be TRUE):
  1. A user who registers a new account receives a welcome email within minutes of signing up — no manual trigger required
  2. A user who opted in to marketing during registration receives a key features email on day 3 and an upgrade prompt email on day 7 — users who did not opt in receive only the welcome email
  3. The upgrade prompt email (day 7) links to a live Stripe Checkout session that correctly initiates a Pro subscription
  4. The registration form includes a marketing consent opt-in checkbox (unchecked by default) with clear language, and checking it is stored in the database before any marketing email is sent
**Plans**: 3 plans
Plans:
- [x] 37-01-PLAN.md — Schema foundation: marketing_consent column + migration + Better Auth additionalFields + register form checkbox + RED test scaffolds
- [x] 37-02-PLAN.md — Loops.so integration: SDK install + singleton + onboarding service + auth hook + billing Pro sync + GREEN tests
- [x] 37-03-PLAN.md — Loops UI configuration checkpoint + end-to-end ESEQ verification

### Phase 38: Feedback Links
**Goal**: Users who have just created or just viewed a secret can reach a feedback form with one click, giving the team a direct signal channel at the highest-intent moments
**Depends on**: Phase 31
**Requirements**: FBCK-01, FBCK-02
**Success Criteria** (what must be TRUE):
  1. After creating a secret, the confirmation page shows a visible feedback link that opens the Tally.so form in a new tab
  2. After viewing (revealing) a secret, the post-reveal page shows a visible feedback link that opens the Tally.so form in a new tab
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Encryption Foundation | v1.0 | 4/4 | Complete | 2026-02-13 |
| 2. Database and API | v1.0 | 3/3 | Complete | 2026-02-14 |
| 3. Security Hardening | v1.0 | 2/2 | Complete | 2026-02-14 |
| 4. Frontend Create and Reveal | v1.0 | 4/4 | Complete | 2026-02-14 |
| 5. Password Protection | v1.0 | 3/3 | Complete | 2026-02-14 |
| 6. Expiration Worker | v1.0 | 2/2 | Complete | 2026-02-14 |
| 7. Trust and Accessibility | v1.0 | 2/2 | Complete | 2026-02-15 |
| 8. Tech Debt Cleanup | v1.0 | 2/2 | Complete | 2026-02-14 |
| 9. Design System Foundation | v2.0 | 3/3 | Complete | 2026-02-15 |
| 10. SEO Static Assets | v2.0 | 2/2 | Complete | 2026-02-15 |
| 11. Layout Shell + Component Migration | v2.0 | 2/2 | Complete | 2026-02-16 |
| 12. Page-Level UI Enhancements | v2.0 | 3/3 | Complete | 2026-02-16 |
| 13. Theme Toggle + Visual Polish | v2.0 | 2/2 | Complete | 2026-02-16 |
| 14. SEO Router Integration | v2.0 | 2/2 | Complete | 2026-02-16 |
| 15. Code Quality Foundation | v3.0 | 3/3 | Complete | 2026-02-17 |
| 16. Docker & Local Development | v3.0 | 4/4 | Complete | 2026-02-17 |
| 17. E2E Testing with Playwright | v3.0 | 2/2 | Complete | 2026-02-17 |
| 18. CI/CD Pipeline | v3.0 | 2/2 | Complete | 2026-02-18 |
| 19. GitHub Repository Polish | v3.0 | 3/3 | Complete | 2026-02-18 |
| 20. Fix Multi-Browser CI | v3.0 | 1/1 | Complete | 2026-02-18 |
| 21. Schema Foundation | v4.0 | 3/3 | Complete | 2026-02-19 |
| 22. Authentication | v4.0 | 7/7 | Complete | 2026-02-19 |
| 23. Secret Dashboard | v4.0 | 5/5 | Complete | 2026-02-20 |
| 24. EFF Diceware Passphrase Generator | v4.0 | 3/3 | Complete | 2026-02-21 |
| 25. PostHog Analytics | v4.0 | 3/3 | Complete | 2026-02-21 |
| 26. Email Notifications | v4.0 | 3/3 | Complete | 2026-02-21 |
| 27. Conversion Prompts + Rate Limits + Legal Pages | v4.0 | 4/4 | Complete | 2026-02-21 |
| 28. Optional Password or Passphrase Protection | v4.0 | 3/3 | Complete | 2026-02-21 |
| 29. v4.0 Tech Debt Cleanup | v4.0 | 5/5 | Complete | 2026-02-22 |
| 30. Docker & Render Deployment Fixes | v4.0 | 2/2 | Complete | 2026-02-22 |
| 31. Rebrand + Tech Debt | v5.0 | 4/4 | Complete | 2026-02-22 |
| 32. Marketing Homepage + /create Split | v5.0 | 4/4 | Complete | 2026-02-23 |
| 33. Pricing Page | v5.0 | 3/3 | Complete | 2026-02-23 |
| 34. Stripe Pro Billing | v5.0 | 5/5 | Complete | 2026-02-26 |
| 34.1. Passphrase/Password Tier Enforcement | v5.0 | 2/2 | Complete | 2026-02-26 |
| 35. SEO Content Pages (Express SSR) | v5.0 | 4/4 | Complete | 2026-02-26 |
| 36. Email Capture | v5.0 | 4/4 | Complete | 2026-02-26 |
| 37. Email Onboarding Sequence | v5.0 | 3/3 | Complete | 2026-02-27 |
| 38. Feedback Links | v5.0 | 0/TBD | Not started | - |
