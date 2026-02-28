# External Integrations

**Analysis Date:** 2025-02-28

## APIs & External Services

**Authentication & OAuth:**
- Google OAuth 2.0 - Sign-in provider (optional via `better-auth`)
  - SDK/Client: `better-auth` 1.4.18
  - Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (env vars, optional)
  - Implementation: `server/src/auth.ts` — conditionally enabled if env vars present

- GitHub OAuth 2.0 - Sign-in provider (optional via `better-auth`)
  - SDK/Client: `better-auth` 1.4.18
  - Credentials: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (env vars, optional)
  - Implementation: `server/src/auth.ts` — conditionally enabled if env vars present

**Email Delivery:**
- Resend API - Transactional email for authentication flows
  - SDK/Client: `resend` 6.9.2
  - Credentials: `RESEND_API_KEY` (required), `RESEND_FROM_EMAIL` (required)
  - Implementation: `server/src/services/email.ts` — singleton initialized with API key
  - Triggers: Email verification, password reset
  - Format: Text emails with verification/reset URLs (via Better Auth token mechanism)
  - Pattern: Fire-and-forget (void awaited to prevent timing attacks)

**Email Capture & Marketing:**
- Loops.so - Email marketing, onboarding sequences, and audience management
  - SDK/Client: `loops` 6.2.0
  - API Key: `LOOPS_API_KEY` (required)
  - Configuration: `server/src/config/loops.ts` — singleton LoopsClient
  - Implementation: `server/src/services/onboarding.service.ts` — enrollInOnboardingSequence()
  - Trigger: Fired automatically on user registration (fire-and-forget, non-blocking)
  - Event: `registered` event triggers the onboarding loop (welcome email, day-3 features, day-7 upgrade prompt)
  - Contact Properties: firstName, marketingConsent, subscriptionTier (only non-identifying data)
  - Also used by: `server/src/services/billing.service.ts` to sync Pro tier status on subscription upgrade
  - ZERO-KNOWLEDGE: No userId, no secretId sent to Loops; email is non-identifying in this context

**Payments & Billing:**
- Stripe - Payment processing, subscription management, and billing
  - SDK/Client: `stripe` 20.3.1
  - Credentials: `STRIPE_SECRET_KEY` (required, starts with `sk_`), `STRIPE_WEBHOOK_SECRET` (required, starts with `whsec_`), `STRIPE_PRO_PRICE_ID` (required)
  - Configuration: `server/src/config/stripe.ts` — singleton Stripe SDK
  - Implementation: `server/src/services/billing.service.ts` — getOrCreateStripeCustomer(), activatePro(), deactivatePro()
  - Webhook Handler: Route at `/api/stripe/webhook` (receives Stripe events)
  - Events Used: `customer.subscription.created`, `customer.subscription.deleted`, `invoice.payment_succeeded`
  - Metadata: Customer records include only `email` and `app: 'torch-secret'` (no userId in Stripe metadata per ZK invariant)
  - Lookup: Stripe operations key by `stripe_customer_id` (stored in `users.stripe_customer_id`)
  - ZERO-KNOWLEDGE: Webhook handler never touches userId directly; uses stripe_customer_id as lookup key only

**Product Analytics:**
- PostHog - Analytics, feature flags, and funnel analysis
  - SDK/Client: `posthog-js` 1.352.0
  - API Key: `VITE_POSTHOG_KEY` (build-time env var, optional)
  - API Host: `VITE_POSTHOG_HOST` (build-time, defaults to `https://us.i.posthog.com`)
  - Implementation: `client/src/analytics/posthog.ts` — module with strict zero-knowledge enforcement
  - Configuration: Auto-capture disabled, session recording disabled, manual pageview tracking
  - Events Captured:
    - `$pageview` - SPA route changes (manual via `capturePageview()`)
    - `secret_created` - After encryption upload (expiresIn, hasPassword, protectionType)
    - `secret_viewed` - After decryption (no details)
    - `user_registered` - Account signup (method: email|google|github)
    - `user_logged_in` - Authentication (method: email|google|github)
    - `conversion_prompt_shown` - Upsell prompts (promptNumber: 1|3|'rate_limit')
    - `conversion_prompt_clicked` - Upsell CTA click (promptNumber)
    - `checkout_initiated` - Stripe Checkout started (source: dashboard|pricing_page|conversion_prompt)
    - `subscription_activated` - Pro upgrade success
    - `dashboard_viewed` - Dashboard pageview
  - Privacy Guard: `before_send` hook strips URL fragments (#...) from all events before transmission
    - Prevents AES-256-GCM encryption key leakage from reveal-page URLs
  - User Identification: `identifyUser(userId, tier?, registeredAt?)` called post-login
    - Sets person properties: tier ('free'|'pro'), registered_at (ISO string)
    - ZERO-KNOWLEDGE: No secretId, no email in event payload
  - Reset: `resetAnalyticsIdentity()` called on logout

## Data Storage

**Databases:**

- PostgreSQL 17+ (primary)
  - Connection: `DATABASE_URL` (env var, required)
  - Client: `pg` 8.18.0 — Node.js PostgreSQL driver
  - ORM: `drizzle-orm` 0.45.1 with Drizzle adapter
  - Schema: `server/src/db/schema.ts` — users, sessions, accounts, verification, secrets, plus Stripe-related columns
  - Initialization: `server/src/db/connection.ts` — singleton Pool + Drizzle instance
  - Migrations: Generated by `drizzle-kit` → `drizzle/` folder, applied via `npm run db:migrate`
  - Operations: All CRUD via Drizzle query builder, no raw SQL except in schemas
  - User Schema: id, email, name, emailVerified, image, createdAt, stripeCustomerId, subscriptionTier (free|pro)

**File Storage:**
- Local filesystem only — client/dist serves static assets in production
- No S3, Cloud Storage, or CDN integration

**Caching:**
- Redis (optional, for rate limiting only)
  - Connection: `REDIS_URL` (env var, optional)
  - Client: `ioredis` 5.9.3
  - Purpose: Distributed rate limit counters (multi-instance deployments)
  - Fallback: In-memory rate limiting if `REDIS_URL` not set
  - Store: `rate-limit-redis` 4.3.1 with RedisStore adapter
  - Keys: Prefixed with `rl:create:` (POST /api/secrets) and `rl:verify:` (POST /api/secrets/:id/verify)
  - No session caching — sessions stored in PostgreSQL only

## Authentication & Identity

**Auth Provider:**
- better-auth 1.4.18 (self-hosted authentication framework)
  - Implementation: `server/src/auth.ts` — email/password + optional OAuth
  - Database Adapter: Drizzle adapter pointing to PostgreSQL
  - Database Schema: `users`, `sessions`, `accounts`, `verification` tables (Better Auth managed)
  - Email + Password: Enabled by default, email verification required (except in test env)
  - OAuth: Google and GitHub (conditionally enabled based on env vars)
  - Password Requirements: Min 8 characters
  - Password Hashing: Argon2id via `argon2` 0.44.0 (OWASP parameters)
  - Email Verification: Sends verification email via Resend on signup
  - Password Reset: Sends reset email via Resend on request
  - Sessions: Token-based, stored in PostgreSQL with `expiresAt`, `ipAddress`, `userAgent`
  - Route Handler: `/api/auth/*` splat route via `toNodeHandler(auth)` in `server/src/app.ts`
  - Additional Fields: `marketingConsent` (boolean, optional) — captured during signup, used for Loops segmentation

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, or similar)

**Logs:**
- Pino 10.3.1 (structured JSON logging)
  - Configuration: Logger middleware in `server/src/middleware/logger.ts`
  - Level: Configurable via `LOG_LEVEL` env var (default: info)
  - Output: JSON to stdout (machine-readable) or pretty-printed in dev via `pino-pretty`
  - Redaction: Secret IDs redacted from URL paths via regex pattern — prevents data leakage
  - Hostname/IP: Logged but never combined with secret IDs per zero-knowledge invariant
  - Global HTTP request logging: `pino-http` 11.0.0 middleware

## CI/CD & Deployment

**Hosting:**
- Not detected (application is build artifact — deployment platform agnostic)
- Expected: Node.js 24.x runtime with PostgreSQL connection
- Compatible with: Vercel, Render, Railway, Fly.io, self-hosted, Docker Compose, etc.

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, or Jenkins config)
- Playwright E2E tests present (`npm run test:e2e`); CI should execute with `process.env.CI=true`
- Pre-commit hooks via Husky 9.1.7 + lint-staged 16.2.7

**Secrets Management (Development):**
- Infisical - CLI-based secrets injection
  - Commands: `infisical run --env=dev -- [command]` wraps dev tasks
  - Used in: `npm run dev:server`, `npm run dev:client`, `npm run staging:up`
  - Purpose: Injects secrets from Infisical vault into process environment at runtime

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - 32+ character hex string for auth encryption
- `BETTER_AUTH_URL` - Base URL for auth redirects (usually matches APP_URL)
- `APP_URL` - Frontend origin for email links (Vite dev port or production domain)
- `BETTER_AUTH_TRUSTED_ORIGINS` - CSRF trusted origins (comma-separated)
- `RESEND_API_KEY` - Email delivery API key
- `RESEND_FROM_EMAIL` - "From" address for emails
- `STRIPE_SECRET_KEY` - Stripe API secret (test: sk_test_..., live: sk_live_...)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (whsec_...)
- `STRIPE_PRO_PRICE_ID` - Stripe price ID (price_...)
- `LOOPS_API_KEY` - Loops email marketing API key
- `RESEND_AUDIENCE_ID` - Resend audience ID for email capture
- `IP_HASH_SALT` - 16+ character salt for IP hashing

**Optional env vars:**
- `PORT` - HTTP port (default: 3000)
- `LOG_LEVEL` - Pino level (default: info)
- `NODE_ENV` - development | production | test (default: development)
- `REDIS_URL` - Redis for distributed rate limiting
- `FORCE_HTTPS` - Redirect HTTP to HTTPS (default: false)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - GitHub OAuth
- `VITE_POSTHOG_KEY` - PostHog project API key (build-time)
- `VITE_POSTHOG_HOST` - PostHog API host (build-time)

**Secrets location:**
- Infisical vault (dev/staging, via `infisical run` CLI)
- `.env` file (loaded via `dotenv` 17.3.1 at local startup)
- No `.env` committed to repo; see `.env.example` for template
- Env vars passed at runtime in production (via platform env, not files)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback routes handled by `better-auth` (`/api/auth/callback/*`)
- Stripe webhook route: `/api/stripe/webhook` (receives Stripe payment events)
- No custom webhook endpoints for other external services

**Outgoing:**
- Email via Resend API (transactional, not webhooks)
- Email marketing via Loops API (REST calls, not webhooks)
- No outgoing webhooks to third-party services

## Zero-Knowledge Invariant Enforcement

All integrations respect the zero-knowledge security model:

- **Logging:** Secret IDs redacted from logs; never combined with user IDs in same log line
- **Database:** `secrets.user_id` is nullable; `secrets.id` never stored in users/sessions rows
- **Email:** Verification/reset URLs use `better-auth` token mechanism, not secret IDs
- **OAuth:** User identity separated from secret metadata; no correlation stored
- **Redis:** Rate limit keys include action type, not sensitive identifiers
- **Stripe:** Customer metadata includes only email and app name; stripe_customer_id is lookup key, never userId in event payload
- **Loops:** Only email and non-identifying properties (firstName, subscriptionTier) sent; no userId, no secretId
- **PostHog:** Secret events contain no userId; user events contain no secretId; before_send hook strips URL fragments

See `.planning/INVARIANTS.md` for complete rule and rationale.

---

*Integration audit: 2025-02-28*
