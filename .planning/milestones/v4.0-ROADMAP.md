# Roadmap: SecureShare

## Milestones

- ✅ **v1.0 MVP** — Phases 1-8 (shipped 2026-02-15)
- ✅ **v2.0 Developer-Grade UI & SEO** — Phases 9-14 (shipped 2026-02-16)
- ✅ **v3.0 Production-Ready Delivery** — Phases 15-20 (shipped 2026-02-18)
- 🚧 **v4.0 Hybrid Anonymous + Account Model** — Phases 21-29 (in progress)

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

### 🚧 v4.0 Hybrid Anonymous + Account Model (In Progress)

**Milestone Goal:** Evolve SecureShare into a hybrid model — anonymous users get instant secret creation with auto-generated passphrases, while optional accounts unlock a secret dashboard, email notifications, and a progressive conversion funnel. Every feature preserves the zero-knowledge invariant: no log, DB record, or analytics event may contain both a user ID and a secret ID together.

- [x] **Phase 21: Schema Foundation** - Add users table and nullable user_id FK on secrets; apply migration safely (completed 2026-02-19)
- [x] **Phase 22: Authentication** - Better Auth with email/password, OAuth (Google + GitHub), sessions, email verification (completed 2026-02-19)
- [x] **Phase 23: Secret Dashboard** - Authenticated user's secret history, labels, status display, pre-view deletion (completed 2026-02-20)
- [x] **Phase 24: EFF Diceware Passphrase Generator** - Client-side 4-word passphrase generation with two-channel UI (completed 2026-02-21)
- [x] **Phase 25: PostHog Analytics** - Privacy-safe funnel tracking with mandatory URL fragment sanitization (completed 2026-02-21)
- [x] **Phase 26: Email Notifications** - Per-secret opt-in viewed notifications via Resend (completed 2026-02-21)
- [x] **Phase 27: Conversion Prompts + Rate Limits + Legal Pages** - Tightened anonymous limits, inline prompts, Privacy Policy, ToS (completed 2026-02-21)
- [x] **Phase 28: Optional Password or Passphrase Protection** - 4-tab protection panel, password generator, masked inputs, eye toggles (completed 2026-02-21)
- [x] **Phase 29: v4.0 Tech Debt Cleanup** - Close audit gaps: OAuth analytics events, server-side noindex, missing E2E and accessibility tests, documentation fixes (completed 2026-02-22)

## Phase Details

### Phase 21: Schema Foundation
**Goal**: The database schema is extended to support user accounts and secret ownership metadata, with all migrations applied safely and the zero-knowledge invariant formally documented as a hard design constraint before any auth code is written
**Depends on**: Phase 20 (v3.0 complete)
**Requirements**: None directly (infrastructure enabling Phases 22-27)
**Success Criteria** (what must be TRUE):
  1. `users` table exists in production schema with Better Auth-compatible columns
  2. `secrets` table has a nullable `user_id` foreign key column — existing anonymous rows remain valid with `user_id = NULL`
  3. Migration applies without downtime to existing data (additive-only change)
  4. Drizzle bug #4147 workaround applied: column addition and FK constraint are in separate migration steps if generated together
  5. Zero-knowledge invariant is documented: no code path may create a log line, analytics event, or DB record containing both `userId` and `secretId` in the same record
**Plans**: 3 plans

Plans:
- [ ] 21-01-PLAN.md — Extend schema.ts with Better Auth tables + nullable user_id FK on secrets
- [ ] 21-02-PLAN.md — Generate migrations, apply bug #4147 workaround, run db:migrate
- [ ] 21-03-PLAN.md — Create .planning/INVARIANTS.md + add zero-knowledge convention to CLAUDE.md

### Phase 22: Authentication
**Goal**: Users can create accounts, verify their email, log in with email/password or OAuth (Google and GitHub), maintain sessions across browser refreshes, reset forgotten passwords, and log out — with all security invariants correctly implemented
**Depends on**: Phase 21
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. User can register with email and password and receives a verification email before account features unlock
  2. User can log in with email/password and remain logged in across browser refreshes and new tabs
  3. User can sign in with Google or GitHub and land on their dashboard without creating a separate password
  4. User can request a password reset and set a new password via the emailed link
  5. User can log out from any page and the session is fully destroyed (cannot re-access dashboard without logging in again)
**Plans**: 6 plans

Plans:
- [x] 22-01-PLAN.md — Install better-auth + resend, add env vars, create email service and auth.ts
- [x] 22-02-PLAN.md — Create frontend auth-client.ts and minimal dashboard stub page
- [x] 22-03-PLAN.md — Wire Better Auth into Express (app.ts), requireAuth middleware, /api/me route
- [x] 22-04-PLAN.md — Create login and register pages with OAuth buttons
- [x] 22-05-PLAN.md — Create forgot-password and reset-password pages, update SPA router
- [x] 22-06-PLAN.md — Auth integration tests + human verify checkpoint

### Phase 23: Secret Dashboard
**Goal**: Authenticated users can view their secret history with metadata only, add labels to new secrets, and delete unviewed secrets before they are accessed — while the dashboard never exposes secret content, ciphertext, or encryption keys
**Depends on**: Phase 22
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05
**Success Criteria** (what must be TRUE):
  1. Authenticated user can navigate to their dashboard and see a list of secrets they created (label, created_at, expires_at, status, notification setting)
  2. Each secret displays one of four correct statuses: Active (unviewed, not expired), Viewed, Expired, or Deleted
  3. Authenticated user can add an optional label when creating a secret and that label appears in the dashboard list
  4. Authenticated user can delete an Active secret from the dashboard before it has been viewed — the deletion is permanent and immediate
  5. Dashboard API never returns ciphertext, the encryption key fragment, or the recipient's IP address in any response
**Plans**: 5 plans

Plans:
- [ ] 23-01-PLAN.md — Schema migration: add label, notify, status, viewedAt columns to secrets table
- [ ] 23-02-PLAN.md — Backend API: dashboard routes, optionalAuth, soft-delete service extensions, expiration worker update, logger fix
- [ ] 23-03-PLAN.md — Shared types + API client + auth-gated label field on create page
- [ ] 23-04-PLAN.md — Dashboard page rebuild: tab filter, status table, deletion modal, empty state, header nav link
- [ ] 23-05-PLAN.md — Integration tests (dashboard routes + expiration worker) + INVARIANTS.md update

### Phase 24: EFF Diceware Passphrase Generator
**Goal**: All users (anonymous and authenticated) can generate a secure 4-word EFF Diceware passphrase client-side when creating a secret, with one-click regeneration and separate copy, plus two-channel security guidance on the confirmation page
**Depends on**: Phase 21 (no auth dependency — works for anonymous users too)
**Requirements**: PASS-01, PASS-02, PASS-03, PASS-04
**Success Criteria** (what must be TRUE):
  1. When creating a secret, a 4-word EFF Diceware passphrase is generated automatically using `crypto.getRandomValues` — no server call required
  2. User can click a regenerate button to get a fresh passphrase without losing their typed secret content
  3. On the confirmation page, user can copy the passphrase independently from the share link with a single click
  4. Confirmation page displays two-channel security guidance explaining that the link and passphrase should be sent via separate channels
**Plans**: 3 plans

Plans:
- [ ] 24-01-PLAN.md — TDD: EFF Diceware passphrase module (crypto/passphrase.ts + tests + barrel export)
- [ ] 24-02-PLAN.md — Confirmation page: passphrase card, copy button, two-channel guidance
- [ ] 24-03-PLAN.md — Create page: passphrase section, regenerate button, remove Advanced options, thread to confirmation

### Phase 25: PostHog Analytics
**Goal**: The application tracks funnel events via PostHog without collecting any PII, secret content, or encryption keys — with URL fragment sanitization enforced at initialization so encryption keys on reveal-page URLs are never transmitted to PostHog servers
**Depends on**: Phase 22 (identified user events require req.user from auth)
**Requirements**: ANLT-01, ANLT-02, ANLT-03
**Success Criteria** (what must be TRUE):
  1. Funnel events (secret created, secret viewed, user registered, prompt shown, account created) are captured in PostHog and visible in the project dashboard
  2. The `$current_url` and `$referrer` properties in every PostHog event have the URL fragment (`#...`) stripped — verified by inspecting a reveal-page event in the PostHog event explorer showing no key material in any property
  3. Authenticated users are identified in PostHog by their internal user ID (not email, name, or any other PII) after login, enabling funnel analysis across anonymous and authenticated sessions
**Plans**: 3 plans

Plans:
- [ ] 25-01-PLAN.md — Analytics module foundation: posthog.ts, vite-env.d.ts, CSP update, .env.example
- [ ] 25-02-PLAN.md — Wire funnel events: initAnalytics in app.ts, capturePageview in router.ts, captureSecretCreated in create.ts, captureSecretViewed in reveal.ts
- [ ] 25-03-PLAN.md — Wire identity events: identifyUser + captureUserLoggedIn in login.ts, captureUserRegistered in register.ts, identifyUser + resetAnalyticsIdentity in dashboard.ts

### Phase 26: Email Notifications
**Goal**: Authenticated users can opt in to receive a transactional email via Resend when a specific secret is viewed and destroyed — the notification confirms permanent deletion without including secret content, the recipient's IP address, or the encryption key
**Depends on**: Phase 23 (dashboard metadata schema and user context), Phase 22 (auth)
**Requirements**: NOTF-01, NOTF-02, NOTF-03
**Success Criteria** (what must be TRUE):
  1. Authenticated user sees a per-secret notification toggle when creating a secret — it is off by default and only available to logged-in users
  2. When an opted-in secret is viewed and destroyed, the account owner receives a transactional email via Resend within a reasonable time
  3. The notification email confirms the secret was viewed and permanently deleted without including the secret text, the encryption key, the viewer's IP address, or the secret label (unless the user explicitly opted in to label inclusion)
**Plans**: 3 plans

Plans:
- [x] 26-01-PLAN.md — Backend: notification service, createSecret notify param, retrieveAndDestroy/verifyAndRetrieve JOIN + dispatch, route guard
- [x] 26-02-PLAN.md — Frontend: notify toggle on create page (progressive enhancement, authenticated users only)
- [x] 26-03-PLAN.md — Tests: notification unit tests, secrets integration tests, INVARIANTS.md update, UAT checkpoint

### Phase 27: Conversion Prompts + Rate Limits + Legal Pages
**Goal**: Anonymous users face tightened rate limits with clear upsell copy directing them toward free accounts, authenticated users get higher limits and extended expiration, inline conversion prompts appear at three natural moments without blocking the core create flow, and Privacy Policy and Terms of Service pages are accessible at canonical URLs
**Depends on**: Phase 22 (account upgrade path must be solid before limits tighten), Phase 25 (PostHog for prompt effectiveness measurement)
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, LEGAL-01, LEGAL-02
**Success Criteria** (what must be TRUE):
  1. Anonymous users are limited to 3 secrets/hour and 10 secrets/day, and can only set expiration up to 1 hour — these limits are enforced server-side with versioned Redis keys so existing counters are not inherited
  2. Authenticated users can create up to 20 secrets/day and set expiration up to 7 days
  3. After their first secret creation, anonymous users see a non-blocking inline prompt on the confirmation page mentioning the account benefit (not a modal, does not interrupt the create flow)
  4. After their third secret creation, anonymous users see a benefit-focused upsell prompt on the confirmation page highlighting dashboard, notifications, and higher limits
  5. When an anonymous user hits the rate limit, the 429 response includes inline upsell copy and a link to create a free account — not just a generic error message
  6. Privacy Policy is accessible at `/privacy` and Terms of Service is accessible at `/terms`, both with correct noindex meta tags
**Plans**: 3 plans

Plans:
- [ ] 27-01-PLAN.md — Server rate limits: three auth-aware limiter factories, expiresIn tier enforcement, ApiError rateLimitReset, integration tests
- [ ] 27-02-PLAN.md — Client conversion prompts: auth-aware expiration select, session counter, confirmation page prompt cards, 429 inline upsell, PostHog events
- [ ] 27-03-PLAN.md — Legal pages + footer + register consent + INVARIANTS.md update, human UAT

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
| 21. Schema Foundation | 3/3 | Complete    | 2026-02-19 | - |
| 22. Authentication | 7/7 | Complete    | 2026-02-20 | - |
| 23. Secret Dashboard | 5/5 | Complete    | 2026-02-20 | - |
| 24. EFF Diceware Passphrase Generator | 3/3 | Complete    | 2026-02-21 | - |
| 25. PostHog Analytics | 3/3 | Complete    | 2026-02-21 | - |
| 26. Email Notifications | 3/3 | Complete    | 2026-02-21 | - |
| 27. Conversion Prompts + Rate Limits + Legal Pages | 4/4 | Complete    | 2026-02-21 | - |
| 28. Optional Password or Passphrase Protection | v4.0 | 3/3 | Complete | 2026-02-21 |
| 29. v4.0 Tech Debt Cleanup | 5/5 | Complete    | 2026-02-22 | - |

### Phase 28: Optional password or passphrase protection with password generator and masked inputs

**Goal:** All users can choose between no protection, password generation (with tier selector, charset/filter controls, entropy display, brute force estimate, preview, and masked applied field), or EFF diceware passphrase mode when creating a secret — with the protection panel collapsed by default (opt-in), and every password/passphrase input field across the app gaining a show/hide eye-icon toggle that defaults to masked
**Depends on:** Phase 27
**Requirements:** PROT-01, PROT-02, PROT-03, PROT-04
**Plans:** 3/3 plans complete

Plans:
- [x] 28-01-PLAN.md — TDD: password-generator.ts pure module (tiers, charset flags, filters, entropy, brute force, rejection-sampling, empty-charset guard) + barrel export
- [x] 28-02-PLAN.md — create.ts: replace Phase 24 passphrase section with collapsible protection panel (segmented Password|Passphrase control, full generator UI, masked inputs with eye toggles, submit handler update)
- [x] 28-03-PLAN.md — reveal.ts eye toggle + accessibility tests + REQUIREMENTS.md PROT requirements + human UAT

### Phase 29: v4.0 Tech Debt Cleanup

**Goal:** All technical debt items from the v4.0 milestone audit are resolved — OAuth analytics events fire correctly for login and registration, auth pages receive a server-side `X-Robots-Tag: noindex` header, missing Playwright E2E tests cover rate-limit countdown and expiration enforcement, accessibility tests cover the protection panel's incompatible filter error state, and all documentation gaps are patched
**Depends on:** Phase 28
**Requirements:** (none — gap closure only)
**Success Criteria** (what must be TRUE):
  1. `captureUserLoggedIn` and `captureUserRegistered` analytics events fire for users who authenticate via Google or GitHub OAuth
  2. Auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`) return `X-Robots-Tag: noindex` as an HTTP response header (server-side, not client-side only)
  3. Playwright E2E tests verify the anonymous rate-limit countdown displays correctly and the 1-hour expiration cap is enforced
  4. Axe accessibility test covers the incompatible filter error state in the protection panel; unit/integration test covers PROT-02 brute-force label output
  5. Documentation gaps closed: `27-01-SUMMARY.md` has `requirements-completed: [CONV-01]`; passphrase tab `getPassword() → undefined` behavior has an explanatory code comment
**Plans:** 5/5 plans complete

Plans:
- [ ] 29-01-PLAN.md — Server-side noindex for auth routes + 27-01-SUMMARY.md CONV-01 fix + create.ts passphrase tab design comment
- [ ] 29-02-PLAN.md — OAuth analytics: sessionStorage flags in login.ts/register.ts, fire captureUserLoggedIn/Registered in dashboard.ts
- [ ] 29-03-PLAN.md — Accessibility + integration tests: incompatible filter error state axe test, PROT-02 brute-force label tests
- [ ] 29-04-PLAN.md — E2E tests: anonymous rate-limit countdown display and 1-hour expiration cap enforcement
- [ ] 29-05-PLAN.md — Vitest unit tests for showRateLimitUpsell() countdown rendering (SC-3 gap closure)

### Phase 30: Docker & Render Deployment Fixes

**Goal:** All deployment configuration files are updated to reflect the v4.0 feature set — render.yaml declares all required auth env vars with sync: false, docker-compose.yml has placeholder values that prevent startup crashes, the Dockerfile build stage accepts VITE_ build args for PostHog, the CI pipeline validates Docker builds, and package.json reflects the completed v4.0 milestone version
**Depends on:** Phase 29
**Plans:** 2/2 plans complete

Plans:
- [x] 30-01-PLAN.md — Update render.yaml (all v4.0 env vars + sync: false), docker-compose.yml (auth placeholders), and Dockerfile (VITE_ ARG declarations)
- [ ] 30-02-PLAN.md — Bump package.json to 4.0.0 and add docker-build CI job
