# Requirements: Torch Secret

**Defined:** 2026-02-22
**Core Value:** Users can share sensitive information once, securely, without accounts or complexity

## v5.0 Requirements

Requirements for the Product Launch Checklist milestone. Each maps to roadmap phases.

### Brand (BRAND)

- [x] **BRAND-01**: App name displays as "Torch Secret" in all user-facing locations (HTML `<title>`, OG tags, header, email sender)
- [x] **BRAND-02**: All canonical URLs, sitemap entries, JSON-LD `@id`/`url`, and OG tags use `torchsecret.com` domain (replacing `secureshare.example.com`)
- [x] **BRAND-03**: README updated with "Torch Secret" name and link to `torchsecret.com` as the live hosted version
- [x] **BRAND-04**: CI workflow, Docker Compose, and `package.json` name field updated to reflect new product name

### Homepage (HOME)

- [x] **HOME-01**: User lands on marketing homepage at `/` with hero section, zero-knowledge proof points, and How It Works section
- [x] **HOME-02**: Create-secret form is accessible at `/create` (moved from `/`)
- [x] **HOME-03**: Header navigation updated to include links for `/create`, `/pricing`, and `/dashboard`
- [x] **HOME-04**: Marketing homepage includes email capture form widget (UI wired to backend in ECAP phase)
- [x] **HOME-05**: Marketing homepage includes `WebApplication` JSON-LD schema markup

### Pricing (PRICE)

- [x] **PRICE-01**: User can view Free vs. Pro tier comparison at `/pricing`
- [x] **PRICE-02**: Pricing page has monthly/annual billing toggle (annual default, shows 22% savings)
- [x] **PRICE-03**: Pro tier card is highlighted as "Recommended" with complete feature list
- [x] **PRICE-04**: Pricing page includes FAQ section (6-8 questions: cancellation, refunds, billing cycle, trial, payment methods)
- [x] **PRICE-05**: Pricing page includes `FAQPage` JSON-LD schema markup

### Billing (BILL)

- [x] **BILL-01**: Authenticated user can initiate Stripe Checkout to subscribe to Pro tier
- [x] **BILL-02**: Subscription status is updated via Stripe webhook events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`)
- [x] **BILL-03**: Pro subscriber can select 30-day expiration when creating secrets
- [x] **BILL-04**: Authenticated user can access Stripe Customer Portal to manage or cancel subscription
- [x] **BILL-05**: Success page verifies subscription status via direct Stripe API query on `?session_id=` param (not dependent on webhook arrival timing)
- [x] **BILL-06**: INVARIANTS.md extended with Stripe billing row before any webhook handler code is written

### SEO Content Pages (SEO)

- [x] **SEO-01**: Competitor comparison pages server-rendered at `/vs/onetimesecret`, `/vs/pwpush`, `/vs/privnote` (800+ words each, using pre-written copy from `.claude/competitor-pages/`)
- [x] **SEO-02**: Alternative pages server-rendered at `/alternatives/onetimesecret`, `/alternatives/pwpush`, `/alternatives/privnote`
- [x] **SEO-03**: Use case hub page server-rendered at `/use/` linking to all use case pages
- [x] **SEO-04**: All 8 use case pages server-rendered at `/use/[slug]` (copy from `.claude/use-case-pages.md`)
- [x] **SEO-05**: All SEO content pages include static JSON-LD (`FAQPage` on `/vs/*`, `HowTo` on `/use/*`) in `<head>` of server-rendered HTML
- [x] **SEO-06**: All new SEO routes added to `sitemap.xml`; `NOINDEX_PREFIXES` verified not to match SEO routes

### Email Capture (ECAP)

- [x] **ECAP-01**: User can submit email address from homepage form to join the mailing list
- [x] **ECAP-02**: Email capture form includes unchecked GDPR consent checkbox with clear consent language
- [x] **ECAP-03**: User receives double opt-in confirmation email before being added to active subscribers
- [x] **ECAP-04**: User can unsubscribe via `GET /unsubscribe?token=` endpoint
- [x] **ECAP-05**: Marketing consent timestamp, consent text, and IP hash stored in `marketing_subscribers` table

### Email Onboarding Sequence (ESEQ)

- [x] **ESEQ-01**: New account holder automatically receives welcome email immediately after registration
- [x] **ESEQ-02**: New account holder receives key features email on day 3 (marketing consent required)
- [x] **ESEQ-03**: New account holder receives upgrade prompt email on day 7 linking to live Stripe Checkout (marketing consent required; skipped if already Pro)
- [x] **ESEQ-04**: Marketing consent opt-in checkbox added to registration form (gates emails 2-3 per GDPR)

### Tech Debt (TECH)

- [x] **TECH-01**: CI workflow includes placeholder env vars (`BETTER_AUTH_SECRET`, `DATABASE_URL`, etc.) to prevent integration test failures
- [x] **TECH-02**: `/privacy` and `/terms` added to `NOINDEX_PREFIXES` in `app.ts` for server-side `X-Robots-Tag` header
- [x] **TECH-03**: `schema.ts` zero-knowledge inline comment updated to match canonical 7-point list in `INVARIANTS.md`

### Feedback Links (FBCK)

- [x] **FBCK-01**: Confirmation page includes link to Tally.so feedback form (opens in new tab)
- [x] **FBCK-02**: Post-reveal page includes link to Tally.so feedback form (opens in new tab)

## Future Requirements (v6.0+)

### Pro Advanced Features

- Webhook notifications on secret view (POST to user-configured URL)
- File uploads (up to 25MB, Cloudflare R2, client-side encrypted)
- 6-word Diceware passphrases (higher entropy: ~77 bits)
- Extended expiration beyond 30 days (90-day option)

### Team Tier

- Shared team dashboard
- Team member management
- Usage analytics across team
- Priority support

### Growth Features

- Annual billing toggle (add after verifying monthly retention)
- Live vanity secret count on homepage (add after launch when numbers are real)
- Referral/affiliate program
- Custom domains (Enterprise tier)
- Public REST API for programmatic secret creation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editing/revoking secrets after creation | One-time links are the model |
| Browser extensions | Web-first |
| Mobile apps | Responsive web covers mobile use cases |
| Session recording (PostHog) | Privacy violation: textarea contains plaintext before encryption |
| Google Analytics | Conflicts with privacy promise; requires cookie consent banners |
| Claiming anonymous secrets on account creation | Privacy risk: links browser session to user identity |
| Real-time push notifications | Email-on-view is sufficient |
| Team/Enterprise tier features | Launch Free + Pro only; add Team when organic team patterns emerge |
| Webhook notifications on secret view | v6.0+ Pro feature |
| File uploads (25MB, Cloudflare R2) | v6.0+ Pro feature |
| 6-word Diceware passphrases | v6.0+ Pro feature |
| >30-day expiration (90-day option) | v6.0+ Pro feature |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAND-01 | Phase 31 | Complete |
| BRAND-02 | Phase 31 | Complete |
| BRAND-03 | Phase 31 | Complete |
| BRAND-04 | Phase 31 | Complete |
| TECH-01 | Phase 31 | Complete |
| TECH-02 | Phase 31 | Complete |
| TECH-03 | Phase 31 | Complete |
| HOME-01 | Phase 32 | Complete |
| HOME-02 | Phase 32 | Complete |
| HOME-03 | Phase 32 | Complete |
| HOME-04 | Phase 32 | Complete |
| HOME-05 | Phase 32 | Complete |
| PRICE-01 | Phase 33 | Complete |
| PRICE-02 | Phase 33 | Complete |
| PRICE-03 | Phase 33 | Complete |
| PRICE-04 | Phase 33 | Complete |
| PRICE-05 | Phase 33 | Complete |
| BILL-01 | Phase 34 | Complete |
| BILL-02 | Phase 34 | Complete |
| BILL-03 | Phase 34 | Complete |
| BILL-04 | Phase 34 | Complete |
| BILL-05 | Phase 34 | Complete |
| BILL-06 | Phase 34 | Complete |
| SEO-01 | Phase 35 | Complete |
| SEO-02 | Phase 35 | Complete |
| SEO-03 | Phase 35 | Complete |
| SEO-04 | Phase 35 | Complete |
| SEO-05 | Phase 35 | Complete |
| SEO-06 | Phase 35 | Complete |
| ECAP-01 | Phase 36 | Complete |
| ECAP-02 | Phase 36 | Complete |
| ECAP-03 | Phase 36 | Complete |
| ECAP-04 | Phase 36 | Complete |
| ECAP-05 | Phase 36 | Complete |
| ESEQ-01 | Phase 37 | Complete |
| ESEQ-02 | Phase 37 | Complete |
| ESEQ-03 | Phase 37 | Complete |
| ESEQ-04 | Phase 37 | Complete |
| FBCK-01 | Phase 38 | Complete |
| FBCK-02 | Phase 38 | Complete |

**Coverage:**
- v5.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-22 after roadmap creation*
