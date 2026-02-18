# Project Research Summary

**Project:** SecureShare v4.0 — Hybrid Anonymous + Account Model
**Domain:** Zero-knowledge one-time secret sharing SaaS with optional accounts and paid Pro tier
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

SecureShare v4.0 adds a hybrid anonymous + account model to an already production-ready zero-knowledge secret sharing app (v3.0). The core challenge is architectural: user accounts naturally create associations between people and their actions, which directly conflicts with the zero-knowledge guarantee that the server never knows who created what. Every feature in v4.0 — accounts, dashboards, email notifications, analytics, payments — must be designed to respect this invariant. Violating it is not a recoverable UX mistake; it is a permanent privacy breach that destroys the product's core value proposition.

The recommended approach is Better Auth 1.4.18 for authentication (100% ESM, Drizzle adapter, built-in OAuth, database-backed sessions), Stripe + `@better-auth/stripe` plugin for billing, Resend for transactional email, and PostHog for analytics (bundled via Vite, not injected via snippet). The accounts backbone must be built first; dashboard, billing, notifications, and analytics all depend on it. The build order in ARCHITECTURE.md is a reliable dependency chain: schema first, auth second, then dashboard, Diceware, Stripe, OAuth, analytics, email, and finally conversion prompts. File uploads (Pro tier) are deferred to v4.2 — they require Cloudflare R2 presigned URL architecture and client-side binary encryption, making them a standalone milestone.

The top risks are: (1) PostHog accidentally capturing the AES-256-GCM encryption key from the `#fragment` of reveal page URLs — prevented by `sanitize_properties` configuration at initialization; (2) adding logic that creates a user-secret association in logs, analytics events, or database records — prevented by establishing the invariant as a hard rule before any auth code is written; and (3) the Stripe webhook body-parser ordering trap — prevented by mounting the Stripe route before `express.json()` in `app.ts`. These three pitfalls have irreversible or high-cost recoveries and must be treated as hard blockers in every auth and payments phase.

## Key Findings

### Recommended Stack

The existing stack (Node.js 24, Express 5, Vite 7, Vanilla TS, Tailwind CSS 4, Drizzle ORM 0.45.1, PostgreSQL 17, Redis, Argon2id, Helmet nonces, Vitest 4, Zod 4, nanoid 5, ESLint 10, Playwright, GitHub Actions) is unchanged. v4.0 adds five targeted packages, all ESM-native and verified against the existing codebase constraints.

**Core technologies (new in v4.0):**
- `better-auth@1.4.18`: Authentication — 100% ESM since v1.4, built-in Drizzle adapter (`drizzle-orm >=0.41.0` satisfied by installed `0.45.1`), Google + GitHub OAuth, database-backed cookie sessions, CLI schema generation. Replaces Lucia (deprecated March 2025) and Passport.js (too manual for greenfield, not TypeScript-first).
- `@better-auth/stripe@1.4.18`: Stripe subscription plugin — synchronized version with better-auth; handles Stripe Customer creation, subscription lifecycle webhooks, Customer Portal, and trial abuse prevention automatically.
- `stripe@20.3.1`: Stripe server SDK — ESM `import Stripe from 'stripe'`, required for webhook signature verification. No client-side Stripe SDK needed (hosted Checkout redirect means no `script-src https://js.stripe.com` CSP additions).
- `resend@6.9.2`: Transactional email — ESM-native, REST API (no SMTP relay required on Render.com), free tier 3,000 emails/month. Replaces SendGrid (free tier eliminated July 2025) and Nodemailer (requires SMTP infrastructure).
- `posthog-js@1.351.1` + `posthog-node@5.24.17`: Analytics — bundled via Vite (not snippet injection, which is incompatible with per-request nonce CSP). No `unsafe-eval` required since v1.236. `connect-src` additions needed in Helmet config.
- EFF Diceware wordlist: Committed as static JSON (`client/src/assets/eff-wordlist.json`), not as npm package (`eff-diceware-passphrase` is CJS-only, incompatible with ESM codebase). ~25 KB gzipped bundle impact, cached after first load.

**New environment variables required:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `POSTHOG_API_KEY`, `POSTHOG_HOST`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`.

### Expected Features

The feature dependency chain is clear: user accounts are the backbone. Dashboard, email notifications, Pro tier, conversion prompts, and rate-limit upsell all require accounts. Diceware and PostHog are independent and can ship in any order.

**Must have (table stakes for v4.0 launch):**
- User accounts (email + Google + GitHub OAuth) — backbone of all other v4.0 features
- Secret dashboard with metadata-only view (Active / Viewed / Expired / Deleted states) — primary reason users create accounts; zero-knowledge constraint: never shows secret content or the `#key` URL fragment
- Email "secret viewed" notification (per-secret opt-in toggle at creation) — single highest-value conversion driver; users create accounts specifically for this
- EFF Diceware passphrase generator (4-word free tier, 6-word Pro) — no account dependency for free version; low complexity, high UX value, genuine competitive differentiator (no major competitor offers it)
- Anonymous rate limit tightening (3/hour, 10/day) with upsell copy in the 429 error response — drives account creation; must ship with staged rollout to avoid breaking existing users
- Progressive conversion prompts (inline, non-blocking: post-creation prompt, rate-limit upsell, feature-gate prompt for Pro features) — inline only, no blocking modals on core flow
- PostHog analytics (anonymous events until account creation, then identified) — needed from day one to measure funnel conversion
- Pro tier: Stripe billing with extended expiration (90 days) as the lowest-complexity Pro feature to validate payment infrastructure

**Should have (add after accounts are stable, v4.1):**
- Pro: Webhook notifications on secret view (POST to user-configured URL)
- Pro: API key access for programmatic creation from CI/CD
- Pro: 6-word Diceware option (trivial extension)
- "Notify if expires unviewed" email (useful, secondary to viewed notification)

**Defer (v4.2+):**
- Pro: File uploads (25MB) — highest complexity, requires Cloudflare R2 presigned URL architecture, client-side binary encryption module, and storage quota management; standalone milestone
- Bulk secret delete — nice-to-have
- Annual billing — add after monthly retention proven
- Custom domains — enterprise tier, different price point

### Architecture Approach

v4.0 grafts four subsystems (auth, payments, analytics, file uploads) onto the existing Express 5 + Vanilla TS SPA. The zero-knowledge core (`secrets.service.ts`, the crypto module, and the atomic SELECT→zero→DELETE pattern) is entirely unchanged. The key architectural constraint is middleware ordering in `app.ts`: trust proxy → HTTPS redirect → CSP nonce → Helmet → logger → session middleware → Stripe raw body route → `express.json()` → routes → error handler. This order is non-negotiable: Stripe signature verification requires raw body before JSON parsing, and session middleware must precede any route that reads `req.user`.

**Major components:**
1. Session middleware (`server/src/middleware/session.ts`) — `express-session` + `connect-redis` v9, reusing the existing `ioredis` client; `sameSite: 'lax'` required (not `'strict'`) to support OAuth callback redirects
2. Better Auth config (`server/src/config/auth.ts`) — single source of truth for auth: Drizzle adapter, email/password, Google + GitHub OAuth, Resend email hook
3. Database schema additions (`server/src/db/schema.ts`) — `users` table, `subscriptions` table, nullable `user_id` FK on `secrets` table with partial index; migration review required before applying (Drizzle bug #4147)
4. Stripe webhook route (mounted directly on app instance before `express.json()`) — idempotent via `ON CONFLICT DO UPDATE`; handles full subscription lifecycle
5. Dashboard API (`/api/users/me/secrets`) — metadata-only query using partial index on `secrets.user_id`; never returns ciphertext
6. PostHog integration — `posthog-js` bundled by Vite (no dynamic injection); `sanitize_properties` strips URL fragment on every event; `autocapture: false` required

### Critical Pitfalls

1. **PostHog captures the AES-256-GCM key from URL fragments** — `posthog.init()` must always include `sanitize_properties` that strips `#fragment` from `$current_url` and `$referrer`. Also set `autocapture: false`. Misconfiguration sends encryption keys to PostHog servers permanently and cannot be undone. Test by inspecting `$current_url` in PostHog event properties on the reveal page.

2. **Stripe webhook body-parser ordering** — Register the Stripe webhook route directly on the Express app instance (`app.post('/api/webhooks/stripe', express.raw(...), handler)`) BEFORE the global `app.use(express.json())` call. Any other ordering causes `constructEvent()` signature verification to fail in production. The error ("No signatures found") does not explain the root cause.

3. **User-secret association via logging or schema** — No log line, analytics event, or database record may contain both `userId` and `secretId` in the same record. No `secrets.created_by_user_id` FK column. The zero-knowledge model is permanently broken by any co-occurrence. Establish this as a hard design rule before any auth code is written.

4. **Drizzle ORM bug #4147 on nullable FK migration** — Adding a new column with a FK constraint in the same schema change generates invalid SQL (FK references column before it exists). After `npm run db:generate`, always inspect the generated SQL. Split into two migrations if needed: (1) add nullable column, (2) add FK constraint.

5. **OAuth state parameter and session fixation** — OAuth callback must validate `req.query.state` against `req.session.oauthState` (one-time use, server-side only). Call `req.session.regenerate()` before setting authenticated user data on the session after login. Both are absent by default and must be implemented explicitly; omitting either creates account hijacking or session fixation vulnerabilities.

## Implications for Roadmap

Based on the combined research, a 9-phase structure is recommended for v4.0, matching the dependency chain documented in ARCHITECTURE.md.

### Phase 1: Schema Foundation
**Rationale:** Every other v4.0 phase requires the database tables. The `users`, `subscriptions`, and modified `secrets` table migrations must exist before auth, dashboard, or billing can be built. The nullable `user_id` FK on `secrets` is a non-breaking additive migration — existing anonymous rows become `userId = NULL`, and the anonymous create flow requires zero code changes.
**Delivers:** Drizzle schema for `users`, `subscriptions`, `secrets` (with `user_id`, `viewed_at`, file metadata columns, partial index on `user_id`). Migrations applied.
**Addresses:** Schema prerequisites for all features; metadata storage required by dashboard
**Avoids:** Drizzle bug #4147 — inspect generated SQL before applying; manually split column addition and FK constraint if generated together
**Research flag:** Standard Drizzle patterns. No research-phase needed.

### Phase 2: Authentication Foundation
**Rationale:** All account-dependent features (dashboard, billing, notifications, conversion prompts) require `req.user` to be set by auth middleware. Better Auth must be wired into the Express pipeline before any of those features can be built or tested. This phase also establishes the zero-knowledge invariants as hard rules before any code references user IDs and secret IDs together.
**Delivers:** Better Auth config, session middleware (`express-session` + `connect-redis`), email/password registration + login + logout, email verification via Resend, `requireAuth` middleware, auth SPA pages (`/auth/login`, `/auth/register`), Zod schemas for auth API contracts
**Uses:** `better-auth@1.4.18`, `resend@6.9.2` (verification email only)
**Avoids:** OAuth state parameter validation (must be present here even before OAuth strategies are added), session fixation (`req.session.regenerate()` on login), localStorage token storage, timing attack on login (dummy hash comparison for non-existent users), user-secret association established as design invariant
**Research flag:** Better Auth Express 5 integration is officially documented. No research-phase needed. Verify `/*splat` wildcard syntax matches Express 5 docs.

### Phase 3: Secret Dashboard
**Rationale:** The dashboard is the primary reason users create accounts. Building it immediately after auth lets real user testing begin on the core account value proposition before Stripe billing complicates testing. Requires schema metadata columns from Phase 1 and auth from Phase 2.
**Delivers:** `GET /api/users/me`, `GET /api/users/me/secrets` (pagination, metadata-only), `DELETE /api/users/me/secrets/:id`, dashboard SPA page, modification to secrets POST to attach `req.user?.id`, status display (Active / Viewed / Expired / Deleted), optional secret labels
**Avoids:** Never returning ciphertext in dashboard API; never showing secret IDs to users; no "re-share" or "duplicate" feature (plaintext was never stored); no IP address of viewer; no IP address in any field
**Research flag:** Standard CRUD + pagination patterns. No research-phase needed.

### Phase 4: EFF Diceware Passphrase Generator
**Rationale:** Independent of accounts — the 4-word version works for anonymous users. Low complexity, no dependencies on billing. Best placed before billing to give free users a meaningful quality-of-life improvement before the Pro tier is introduced.
**Delivers:** EFF large wordlist as `client/src/assets/eff-wordlist.json`, `client/src/crypto/passphrase.ts` using `crypto.getRandomValues()`, "Generate Passphrase" button adjacent to password field, regenerate button, copy-to-clipboard, entropy readout (~52 bits), two-channel security note ("Share passphrase separately")
**Avoids:** Server-side generation (would log passphrase candidates); strength meter color bar (meaningless for diceware — all outputs are identical entropy); storing the generated passphrase
**Research flag:** No research-phase needed. EFF wordlist is a static asset; crypto pattern extends existing Web Crypto module.

### Phase 5: Stripe Billing and Pro Tier
**Rationale:** Billing requires the `users` table (Phase 1) and Better Auth for customer identity (Phase 2). The Stripe webhook handler must be integrated into `app.ts` before any subscription lifecycle can be tested. Email/password accounts are sufficient for billing testing — OAuth can be added after.
**Delivers:** `@better-auth/stripe` plugin config, Stripe raw webhook route in `app.ts` (before `express.json()`), handlers for `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `GET/POST /api/users/me/subscription`, Stripe Customer Portal session, `requirePlan` middleware, Pro tier feature gates (90-day expiry, 6-word Diceware), upgrade CTA on dashboard, checkout success race condition handling (query Stripe API directly on `session_id` return URL)
**Uses:** `stripe@20.3.1`, `@better-auth/stripe@1.4.18`
**Avoids:** Stripe webhook without idempotency (insert event ID before processing, `ON CONFLICT DO UPDATE` for subscription upserts); missing `invoice.payment_failed` handler; Stripe webhook registered after `express.json()`; checkout/webhook race condition; immediate access revocation on cancellation (use `cancel_at_period_end`)
**Research flag:** Stripe webhook ordering and idempotency are officially documented. Verify `@better-auth/stripe` plugin event coverage against the full subscription lifecycle at planning time.

### Phase 6: Google + GitHub OAuth
**Rationale:** OAuth requires session infrastructure from Phase 2 (state parameter storage, session middleware). Building OAuth after billing means the core conversion path (account → Pro) is proven before OAuth is added as an alternative login method. Reduces complexity in the critical auth phase.
**Delivers:** Google OAuth strategy via Better Auth `socialProviders`, GitHub OAuth strategy, OAuth buttons on auth pages, `sameSite: 'lax'` session cookie verification (required for OAuth redirect), redirect URI validation (exact match, no query params), post-login destination stored in session (not in redirect URI)
**Avoids:** OAuth state validation omission (CSRF attack); `sameSite: 'strict'` on session cookie (breaks OAuth callbacks); query parameters in registered redirect URI; open redirect via unvalidated `next` parameter
**Research flag:** Standard patterns. No research-phase needed. Verify Better Auth `socialProviders` config generates correct redirect URIs at implementation time.

### Phase 7: PostHog Analytics
**Rationale:** Analytics is most valuable when it captures the full funnel from day one of accounts. Phase 7 placement means user events will be identified (tied to user IDs from Phase 2) rather than entirely anonymous. CSP must be updated before PostHog can fire events in production.
**Delivers:** `posthog-js` bundled in Vite, PostHog init in `client/index.html` with `__CSP_NONCE__` placeholder, `sanitize_properties` stripping URL fragments on every event, `autocapture: false`, `capture_pageview: 'history_change'` for SPA router, `posthog-node` server-side singleton, event capture: `secret_created`, `secret_viewed`, `user_registered`, `user_upgraded`, `user_churned`, conversion funnel events (`prompt_shown`, `prompt_dismissed`, `prompt_clicked`, `account_created`, `subscription_started`), CSP `connectSrc` additions for PostHog domains, anonymous `distinctId` via session-scoped nanoid (never IP)
**Avoids:** PostHog capturing `#AES-KEY` from URL fragments; PostHog snippet injection (incompatible with nonce CSP); `unsafe-eval` in CSP; session recording on create form; events on reveal page that include secret metadata; Google Analytics (conflicts with privacy promise, requires cookie consent banners)
**Research flag:** Verify PostHog CSP domain list at integration time against the PostHog dashboard for the chosen region (US: `us.i.posthog.com` / EU: `eu.i.posthog.com`). Consider EU region for GDPR compliance.

### Phase 8: Email Notifications
**Rationale:** Email notifications require accounts (Phase 2), the dashboard metadata schema (Phase 1 and 3), and a stable billing system (Phase 5) since the most critical transactional emails are billing-related. Registration verification email is already delivered in Phase 2 via the Better Auth hook — this phase extends Resend to viewed notifications and billing lifecycle emails.
**Delivers:** "Notify me when viewed" per-secret toggle (logged-in users only, off by default), viewed notification triggered after atomic secret destroy, "notify if expires unviewed" toggle + expiration worker integration, billing lifecycle emails (welcome to Pro, payment failed, subscription cancelled), unsubscribe and notification preference management in account settings, one-click unsubscribe link in all notification emails
**Avoids:** Secret content in notification emails; recipient IP or location in emails; secret label included in email by default (opt-in only — sensitive label content should not appear in inbox without consent)
**Research flag:** Standard Resend integration. No research-phase needed. Email content template for zero-knowledge compliance is documented in FEATURES.md.

### Phase 9: Progressive Conversion Prompts + Rate Limit Update
**Rationale:** Rate limit tightening (3/hour, 10/day anonymous) requires the full account system to be stable before anonymous users are redirected toward it under pressure. Conversion prompts require Pro feature gates (Phase 5) to link to. Both must ship together: tightening limits without upsell copy creates a dead end.
**Delivers:** Anonymous rate limit update to 3/hour, 10/day (Redis key prefix versioned as `rl:create:v2:` to avoid counting against old limits); rate-limit 429 error with upsell copy ("Sign in for higher limits"); inline post-creation prompt on confirmation page; feature-gate prompts for Pro features; staged rollout plan (30-day grace period with UI announcement recommended); PostHog funnel events for prompt effectiveness measurement
**Avoids:** Blocking modals on secret creation flow; same prompt shown more than once per session; pricing shown before value demonstration; rate limit deployed without UI announcement or staged rollout; Redis key collision with old limit counters (use versioned prefix)
**Research flag:** No research-phase needed. Inline prompt patterns documented in FEATURES.md with competitor examples.

### Phase Ordering Rationale

- **Schema first:** Every phase requires database tables. Non-breaking nullable FK migration is safe in production.
- **Auth second:** Dashboard, billing, rate-limit differentiation, and session-scoped analytics IDs all require `req.user`. Zero-knowledge invariants must be established here before any user-ID-aware code is written.
- **Dashboard before billing:** Validates the account value proposition before asking users to pay. Provides real user testing of the core account experience.
- **Diceware before billing:** Gives free users a genuine improvement before the Pro tier is introduced. The 4-word version is independent of accounts and can be shipped standalone.
- **Billing before OAuth:** Validates the conversion path (email account → Pro) before adding OAuth login complexity. Billing infrastructure is needed for the most critical transactional emails (payment failed).
- **OAuth after billing:** OAuth is an additional login method, not a prerequisite for paying customers. Building it after billing means the core revenue path is proven first.
- **Analytics after auth:** Server-side events tied to user IDs are far more valuable than purely anonymous events. Post-auth placement means conversion events are identified.
- **Email after billing:** Billing lifecycle emails are the highest-priority transactional emails. Viewed notifications are secondary.
- **Conversion prompts last:** Requires a stable account system, Pro tier feature gates, and PostHog to measure effectiveness. Tightening rate limits before the upgrade path is solid creates a broken experience.
- **File uploads deferred to v4.2:** Highest complexity feature. Requires Cloudflare R2, presigned PUT URL flow, client-side binary encryption (new crypto module work), file size enforcement at R2 level, and extensive security review. Not worth the risk alongside accounts launch.

### Research Flags

Phases needing deeper research during planning:
- **Phase 7 (PostHog):** PostHog CSP domain list should be verified at integration time for the chosen region. The `sanitize_properties` approach is confirmed but the exact PostHog API endpoint hostnames may change. EU data residency decision needed before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Schema):** Standard Drizzle migrations. Bug #4147 workaround documented.
- **Phase 2 (Auth):** Better Auth Express 5 integration officially documented.
- **Phase 3 (Dashboard):** Standard CRUD API + metadata query patterns.
- **Phase 4 (Diceware):** Static JSON asset + Web Crypto. No external dependencies.
- **Phase 5 (Stripe):** Webhook ordering and idempotency officially documented. Plugin reduces boilerplate.
- **Phase 6 (OAuth):** Better Auth `socialProviders` officially documented.
- **Phase 8 (Email):** Resend REST API officially documented.
- **Phase 9 (Prompts + Rate Limits):** UI patterns and Redis key versioning are straightforward.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via `npm info`. ESM compatibility confirmed via official docs and GitHub issue tracking. Drizzle peer dep compatibility verified (`>=0.41.0` satisfied by `0.45.1`). Better Auth v1.4 ESM-only confirmed via GitHub issue #3568. |
| Features | HIGH | Verified against EFF official docs (Diceware entropy calculations), live competitor products (OneTimeSecret, password.link, scrt.link), and SaaS conversion research (Appcues, Userpilot). Feature dependency graph modeled explicitly. |
| Architecture | HIGH | Middleware ordering verified against Stripe docs (raw body), express-session docs (session before passport), and connect-redis v9 npm docs. Schema FK patterns verified via Drizzle docs and GitHub discussions. PostHog CSP domains verified via GitHub issue #20461 (MEDIUM — verify at integration time). |
| Pitfalls | HIGH | OAuth state and session fixation: RFC 9700, OWASP, HackerOne Slack disclosure. Stripe webhook pitfalls: official Stripe docs. PostHog URL fragment capture: PostHog GitHub issue #7118. Drizzle FK migration bug: official Drizzle issue #4147. CVE-2025-22234 confirms timing attack risk on login endpoints. |

**Overall confidence:** HIGH

### Gaps to Address

- **PostHog CSP domain list:** Hostnames (`us.i.posthog.com`, `us-assets.i.posthog.com`) confirmed from research but should be re-verified at Phase 7 implementation time against the PostHog dashboard for the chosen region. EU data residency decision needed before Phase 7.
- **`@better-auth/stripe` plugin event coverage:** The plugin handles the standard subscription lifecycle. Custom webhook logic for edge cases (proration, trial conversion) may require extending it. Verify plugin capabilities against the exact Stripe events needed at Phase 5 planning time.
- **Rate limit staged rollout mechanics:** The 30-day grace period recommendation is based on UX research. The exact Redis key versioning approach (`rl:create:v2:`) must be confirmed against the existing `middleware/rate-limit.ts` implementation at Phase 9 planning time.
- **File upload storage quota enforcement (v4.2):** The Cloudflare R2 presigned URL architecture is documented in ARCHITECTURE.md but the per-user storage quota tracking (500MB/month for Pro) was not fully researched. Needs dedicated research before the file uploads milestone.

## Sources

### Primary (HIGH confidence)
- https://www.better-auth.com/docs/integrations/express — Express 5 `/*splat` pattern, `toNodeHandler` usage
- https://www.better-auth.com/blog/1-4 — ESM-only confirmation for v1.4+, breaking changes, Stripe plugin
- https://www.better-auth.com/docs/plugins/stripe — `@better-auth/stripe` capabilities, API version pinned at `2025-11-17.clover`
- https://docs.stripe.com/webhooks — Raw body requirement, `constructEvent` pattern
- https://docs.stripe.com/billing/subscriptions/webhooks — Subscription lifecycle events, dunning behavior
- https://www.npmjs.com/package/connect-redis — v9 ESM import, ioredis compatibility
- https://github.com/PostHog/posthog-js/issues/1918 — `unsafe-eval` issue confirmed fixed post v1.236
- https://github.com/PostHog/posthog.com/issues/7118 — `sanitize_properties` URL masking approach for fragments
- https://developers.cloudflare.com/r2/api/s3/presigned-urls/ — R2 presigned URL pattern with AWS SDK v3
- https://render.com/docs/disks — Ephemeral filesystem constraint, single-instance persistent disk limitation
- https://github.com/drizzle-team/drizzle-orm/issues/4147 — FK + column migration bug in drizzle-kit
- https://datatracker.ietf.org/doc/rfc9700/ — OAuth 2.0 Security Best Current Practice (January 2025)
- https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html — localStorage token storage warning
- https://hackerone.com/reports/2688 — Slack OAuth missing state parameter disclosure
- https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases — EFF Diceware wordlist, entropy calculations
- https://onetimesecret.com/en/pricing/ — Competitor pricing and features (observed live)
- https://password.link/en — Competitor features: notifications, webhooks, attachments (observed live)
- https://www.cve.news/cve-2025-22234/ — Timing attack regression in authentication frameworks

### Secondary (MEDIUM confidence)
- https://github.com/PostHog/posthog/issues/20461 — PostHog `connect-src` domain list
- https://www.appcues.com/blog/best-freemium-upgrade-prompts — Freemium conversion prompt patterns (Spotify, Dropbox, Grammarly examples)
- https://github.com/drizzle-team/drizzle-orm/discussions/2531 — Nullable FK syntax in Drizzle
- https://github.com/better-auth/better-auth/issues/3568 — ESM/jose conflict confirmed fixed in v1.4+
- https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks — Stripe webhook best practices
- https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/ — Checkout/webhook race condition pattern
- https://github.com/oauth2-proxy/oauth2-proxy/issues/1663 — `sameSite: 'strict'` breaking OAuth callbacks
- `npm info better-auth`, `npm info @better-auth/stripe`, `npm info stripe`, `npm info resend`, `npm info posthog-js`, `npm info posthog-node`, `npm info eff-diceware-passphrase` — versions and peer deps verified

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
