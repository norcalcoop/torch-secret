# External Integrations

**Analysis Date:** 2025-03-01

## APIs & External Services

**Authentication & OAuth:**
- Better Auth 1.4.18 - Email/password + OAuth sign-in
  - Env vars: `BETTER_AUTH_SECRET` (32+ chars), `BETTER_AUTH_URL`, `APP_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`
  - Implementation: `/api/auth/**` handler route
  - OAuth providers (optional):
    - Google OAuth 2.0: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
    - GitHub OAuth 2.0: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - Features: Email verification, password reset, session management, automatic user creation
  - Database: Drizzle adapter managing `users`, `sessions`, `accounts`, `verification` tables
  - Cookie: `auth_token` (sameSite: lax, httpOnly, secure in prod)

**Email Delivery:**
- Resend - Transactional email service
  - SDK: `resend` 6.9.2 (singleton in `server/src/services/email.ts`)
  - Auth: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - Service: `server/src/services/email.ts` (sendEmail function)
  - Events:
    - Email verification (on signup via Better Auth)
    - Password reset (on forgot-password request via Better Auth)
    - Secret viewed notification (Phase 26, via `notification.service.ts`)
  - Pattern: Fire-and-forget (void awaited to prevent timing attacks)
  - Audience API: Also used for marketing list management (Phase 36)

**Email Automation & Onboarding:**
- Loops.so - Email marketing and drip sequences
  - SDK: `loops` 6.2.0 (singleton in `server/src/config/loops.ts`)
  - Auth: `LOOPS_API_KEY`
  - Service: `server/src/services/onboarding.service.ts` (enrollInOnboardingSequence)
  - Trigger: Automatically fires on user registration (fire-and-forget, non-blocking)
  - Sequences: Day-1 welcome, day-3 features, day-7 upgrade prompt
  - Contact properties sent: firstName, marketingConsent, subscriptionTier (non-identifying)
  - Gating: Skipped if `users.marketing_consent = false` at signup
  - Also used by: `billing.service.ts` to sync Pro tier status on subscription upgrade
  - Zero-knowledge: No userId, no secretId sent to Loops

**Payments & Billing:**
- Stripe - Payment processing, subscriptions, webhooks
  - SDK: `stripe` 20.3.1 (singleton in `server/src/config/stripe.ts`)
  - Auth: `STRIPE_SECRET_KEY` (sk_test_... or sk_live_...), `STRIPE_WEBHOOK_SECRET` (whsec_...), `STRIPE_PRO_PRICE_ID` (price_...)
  - Service: `server/src/services/billing.service.ts`
    - getOrCreateStripeCustomer() - Creates customer record if needed
    - activatePro(stripeCustomerId) - Sets subscription_tier to 'pro'
    - deactivatePro(stripeCustomerId) - Reverts to 'free'
  - Routes:
    - `POST /api/billing/checkout` - Create checkout session (requires auth)
    - `GET /api/billing/verify-checkout` - Verify post-redirect
    - `POST /api/billing/portal` - Create customer portal session
    - `POST /api/webhooks/stripe` - Webhook receiver (raw body, mounted before express.json)
  - Webhook events: customer.subscription.updated, checkout.session.completed
  - Customer ID: Stored in `users.stripe_customer_id` (nullable until checkout initiated)
  - Metadata: Only email and app name (no userId per zero-knowledge invariant)
  - Zero-knowledge: Webhook handler uses stripe_customer_id only; never joins userId + secretId

**Product Analytics:**
- PostHog - Event capture, feature flags, user cohorts
  - SDK: `posthog-js` 1.352.0 (client-side, browser)
  - Auth: `VITE_POSTHOG_KEY` (build-time env var, optional)
  - Host: `VITE_POSTHOG_HOST` (defaults to US cloud if unset)
  - Module: `client/src/analytics/posthog.ts`
  - Configuration: Auto-capture disabled, session recording disabled, manual event capture
  - Events:
    - `secret_created` - Encryption upload (expiresIn, hasPassword, protectionType)
    - `secret_viewed` - Decryption (no sensitive details)
    - `user_registered` - Signup (method: email|google|github)
    - `user_logged_in` - Authentication (method: email|google|github)
    - `checkout_initiated` - Stripe checkout start (source: dashboard|pricing_page|conversion_prompt)
    - `subscription_activated` - Pro upgrade success
    - `conversion_prompt_shown` - Upsell prompt display
    - `conversion_prompt_clicked` - Upsell CTA click
  - Security: before_send hook strips URL fragments (#...) from all events
    - Prevents AES-256-GCM key leakage from `/secret/:id#key` URLs
  - User identification: `identifyUser(userId, tier, registeredAt)` post-login
    - Person properties: tier ('free'|'pro'), registered_at (ISO timestamp)
  - Zero-knowledge: Enforced by module design — userId and secretId never coexist in same event
  - Optional REST API credentials (Phase 37.1 scripted dashboard setup):
    - `POSTHOG_PERSONAL_API_KEY` (personal access token)
    - `POSTHOG_PROJECT_ID` (numeric project ID)

## Data Storage

**Databases:**
- PostgreSQL 17+
  - Connection: `DATABASE_URL` (postgresql://user:pass@host:5432/db)
  - Client: `pg` 8.18.0 (Node.js native driver via pg.Pool)
  - ORM: Drizzle ORM 0.45.1 (query builder, schema definitions)
  - Schema: `server/src/db/schema.ts`
    - `users` - id, email, name, emailVerified, image, createdAt, stripeCustomerId, subscriptionTier, marketingConsent
    - `sessions` - Better Auth session tokens, expiration, IP, user agent
    - `accounts` - OAuth account links (Google, GitHub)
    - `verification` - Email verification and password reset tokens
    - `secrets` - Encrypted blob storage, expiration, password hash, user FK, status tracking
    - `marketing_subscribers` - GDPR email capture (separate from users, no FK)
  - Connection pool: Singleton in `server/src/db/connection.ts`
  - Migrations: Auto-generated in `drizzle/` directory, applied at startup via `npm run db:migrate`

**File Storage:**
- None - Application is stateless; frontend assets served from `client/dist/` (built bundle)

**Caching:**
- Redis 7+ (optional; required for distributed rate limiting in multi-instance deployments)
  - Connection: `REDIS_URL` (redis://localhost:6379)
  - Client: `ioredis` 5.9.3
  - Adapter: `rate-limit-redis` 4.3.1
  - Use: Rate limit counters for POST /api/secrets and POST /api/secrets/:id/verify
  - Fallback: In-memory rate limiting if `REDIS_URL` unset
  - Key format: `rl:create:` (secret creation), `rl:verify:` (password verification)

## Authentication & Identity

**Auth Provider:**
- Better Auth 1.4.18 (self-hosted, open-source)
  - Implementation: `/api/auth/**` splat route via `toNodeHandler(auth)`
  - Strategies:
    - Email/password (always enabled)
    - Google OAuth (if `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set)
    - GitHub OAuth (if `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` set)
  - Password requirements: Min 8 characters
  - Password hashing: Argon2id (OWASP parameters, handled by Better Auth)
  - Email verification: Required by default; bypassed in test env
  - Session: Token-based, stored in PostgreSQL with expiration and metadata

**Password Hashing (User-Provided Per-Secret):**
- Argon2id via `argon2` 0.44.0
  - Service: `server/src/services/password.service.ts`
  - Hash storage: `secrets.password_hash`
  - Verification: `server/src/routes/secrets.ts` POST /api/secrets/:id/verify

## Monitoring & Observability

**Error Tracking:**
- Not configured - Errors logged to stdout via Pino

**Logs:**
- Pino 10.3.1 - Structured JSON logging
  - Middleware: `server/src/middleware/logger.ts`
  - Level: Configurable via `LOG_LEVEL` env var (default: info)
  - Output: JSON to stdout (production) or pretty-printed via `pino-pretty` (development)
  - Security: Secret IDs redacted from URL paths via regex (`/secret/[a-z0-9_-]+` → /secret/[REDACTED])
  - HTTP logging: `pino-http` 11.0.0 middleware records all requests/responses
  - Zero-knowledge: Never combines userId + secretId in same log line

**Metrics & APM:**
- None - Application stateless; metrics handled by hosting platform

## CI/CD & Deployment

**Hosting:**
- Docker container (multi-stage build)
- Base image: `node:24-slim`
- Non-root user: `node` (UID 1000)
- Health check: `GET /api/health` endpoint
- Environment: `NODE_ENV=production` by default

**Deployment Platforms:**
- Compatible with: Render, Vercel, Railway, Fly.io, AWS ECS, Docker Compose, Kubernetes, etc.

**Build Process:**
1. Stage 1 (`deps`) - Install all dependencies (dev + prod, needed for build tools like Vite)
2. Stage 2 (`build`) - Frontend bundle via `npm run build:client` (VITE_POSTHOG_KEY passed as build arg)
3. Stage 3 (`production`) - Minimal image with prod deps only, tsx runtime, server code

**Database Migrations:**
- Drizzle Kit - Auto-generates SQL migrations
- Run-on-startup: `node --import tsx server/src/db/migrate.ts` (in Docker CMD)
- Development: `npm run db:generate` (detect schema changes) → `npm run db:migrate` (apply)

**Pre-Commit Hooks:**
- Husky 9.1.7 + lint-staged 16.2.7
- Runs ESLint and Prettier on staged files

## Environment Configuration

**Required env vars (production):**
- `DATABASE_URL` - PostgreSQL connection string (starts with `postgres://`)
- `BETTER_AUTH_SECRET` - 32+ character secret for session signing
- `BETTER_AUTH_URL` - Express URL reachable from browser (e.g., https://torchsecret.com)
- `APP_URL` - Frontend origin for email reset/verify links (e.g., https://torchsecret.com)
- `BETTER_AUTH_TRUSTED_ORIGINS` - Allowed CSRF origins (comma-separated)
- `RESEND_API_KEY` - Transactional email API key
- `RESEND_FROM_EMAIL` - Sender address (e.g., Torch Secret <noreply@torchsecret.com>)
- `STRIPE_SECRET_KEY` - Stripe API secret (sk_live_... for production)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (whsec_...)
- `STRIPE_PRO_PRICE_ID` - Stripe Product price ID (price_...)
- `RESEND_AUDIENCE_ID` - Resend Audiences list ID
- `IP_HASH_SALT` - 16+ character salt for SHA-256 IP hashing (GDPR)
- `LOOPS_API_KEY` - Loops email automation API key

**Optional env vars:**
- `PORT` - HTTP listen port (default: 3000)
- `LOG_LEVEL` - Pino level: fatal|error|warn|info|debug|trace (default: info)
- `NODE_ENV` - development|production|test (default: development)
- `REDIS_URL` - Redis connection (only needed for distributed rate limiting)
- `FORCE_HTTPS` - Redirect HTTP to HTTPS (set to 'true' behind TLS proxy; default: false)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Enable Google OAuth (optional)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - Enable GitHub OAuth (optional)
- `VITE_POSTHOG_KEY` - PostHog project API key (build-time; leave unset to disable analytics)
- `VITE_POSTHOG_HOST` - PostHog API host (build-time, defaults to US cloud)
- `POSTHOG_PERSONAL_API_KEY` - PostHog REST API credentials (optional, Phase 37.1)
- `POSTHOG_PROJECT_ID` - PostHog project ID (optional, Phase 37.1)

**Secrets location:**
- Local development: `.env` file (loaded via `dotenv`)
- Staging/production: Infisical CLI (`infisical run --env=prod -- npm start`)
- Docker: Environment variables via `docker run -e VAR=value` or `docker-compose.yml`

## Webhooks & Callbacks

**Incoming:**
- `POST /api/webhooks/stripe` - Stripe webhook receiver
  - Events: customer.subscription.updated, checkout.session.completed
  - Security: Signature verification via `stripe.webhooks.constructEvent()`
  - Handler: `server/src/routes/webhooks.ts` → `server/src/services/billing.service.ts`
  - Note: Must mount with `express.raw()` before `express.json()` in middleware stack

**Outgoing:**
- Email via Resend API (transactional, not webhooks)
  - Password reset, email verification, secret viewed notifications
  - Fire-and-forget delivery (no retry logic)
  - Service: `server/src/services/email.ts`
- Loops API calls (REST, not webhooks)
  - Trigger onboarding sequence on user registration
  - Service: `server/src/services/onboarding.service.ts`

## OAuth Callback URLs

**Google OAuth (if configured):**
- Redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`
- Production example: `https://torchsecret.com/api/auth/callback/google`
- Development example: `http://localhost:3000/api/auth/callback/google`

**GitHub OAuth (if configured):**
- Redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/github`
- Production example: `https://torchsecret.com/api/auth/callback/github`
- Development example: `http://localhost:3000/api/auth/callback/github`

---

*Integration audit: 2025-03-01*
