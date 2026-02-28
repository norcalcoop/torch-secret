# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** Hybrid distributed system with strong security boundaries: client-side encryption (zero-knowledge), Express HTTP API with atomic transactions, PostgreSQL storage, and optional user accounts with Stripe billing.

**Key Characteristics:**
- Zero-knowledge security model: encryption keys live only in URL fragments (`#key`), never reach the server
- Atomic read-and-destroy pattern for secrets: 3-step transaction prevents data remanence and race conditions
- Layered middleware architecture: middleware order is critical and explicitly documented in comments
- Hybrid authentication: anonymous users for baseline secret sharing, authenticated users for accounts/dashboards/billing
- SPA routing with dynamic imports for code splitting; vanilla TypeScript (no framework)
- Strict zero-knowledge invariant: no code path combines `userId` + `secretId` in same payload (enforced in schema and logging)
- Stripe integration for Pro tier billing (Phase 34+), Resend for email notifications (Phase 26+)
- Loops integration for onboarding sequences (Phase 37+)

## Layers

**Presentation Layer (Client):**
- Purpose: SPA interface for creating/revealing/managing secrets; encryption/decryption entirely client-side
- Location: `client/src/`
- Contains: Pages (create, reveal, confirmation, dashboard, login, register, forgot-password, reset-password, error, home, pricing, privacy, terms, unsubscribe), components (layout, copy-button, share-button, toast, theme-toggle, loading-spinner, expiration-select, terminal-block, icons), router (History API with dynamic imports), theme system (light/dark/system with localStorage persistence)
- Depends on: Web Crypto API, Fetch API, Better Auth client, PostHog analytics
- Used by: End users via browser

**Encryption Module (Client):**
- Purpose: AES-256-GCM encryption/decryption with Web Crypto API; PADME padding for length leakage prevention
- Location: `client/src/crypto/`
- Contains: encrypt.ts, decrypt.ts, keys.ts, padding.ts, encoding.ts, constants.ts, passphrase.ts (passphrase generator), password-generator.ts (strong password generator), types.ts, index.ts (barrel export)
- Depends on: Web Crypto API only (no third-party crypto libraries)
- Used by: Pages (create.ts, reveal.ts), isolated within crypto module only

**API Client Layer (Client):**
- Purpose: Typed fetch wrapper for all HTTP calls; handles error mapping and rate-limit headers
- Location: `client/src/api/client.ts`
- Contains: createSecret(), getSecret(), getSecretMeta(), verifySecretPassword(), fetchDashboardSecrets(), deleteDashboardSecret(), getMe(), initiateCheckout(), verifyCheckoutSession(), createPortalSession() + ApiError class with rateLimitReset support
- Depends on: Fetch API, shared/types/api.ts for type contracts
- Used by: Pages (create, reveal, dashboard, login, register, billing)

**Router/Navigation Layer (Client):**
- Purpose: History API-based SPA router with per-request SEO metadata management and accessibility
- Location: `client/src/router.ts`
- Contains: navigate(), initRouter(), handleRoute(), updatePageMeta() (manages title, description, canonical, robots, noindex/follow directives, OG/Twitter tags), route-to-page-renderer mapping with dynamic imports
- Depends on: Native History API, DOM APIs, analytics capture
- Used by: app.ts (initialization), all pages (navigation), browser back/forward (popstate event)

**Security Middleware (Server):**
- Purpose: Enforce cryptographic and HTTP-level security guarantees
- Location: `server/src/middleware/`
- Contains:
  - `security.ts`: CSP nonce generation (per-request 32-byte hex), Helmet (HSTS, referrer-policy, cross-origin isolation, X-Content-Type-Options), HTTPS redirect (checks req.secure with trust proxy)
  - `rate-limit.ts`: Redis-backed rate limiters (with in-memory fallback) for anonymous/authenticated users: anon 3/hour + 10/day for POST /api/secrets, anon 5 attempts for POST /api/secrets/:id/verify, authenticated 20/day for POST /api/secrets, includes RateLimit-Reset header (draft-6 delta format)
  - `logger.ts`: Pino HTTP logger with secret ID redaction (regex: `/\/api\/secrets\/[A-Za-z0-9_-]+/g` → `[REDACTED]`, also covers `/api/dashboard/secrets/:id`)
  - `validate.ts`: Zod body/param validation middleware factories (validateBody, validateParams)
  - `error-handler.ts`: Global error handler (must be last middleware in chain)
  - `require-auth.ts`: Validates Better Auth session token, populates res.locals.user
  - `optional-auth.ts`: Populates res.locals.user if valid session exists, does not reject unauthenticated
- Depends on: Express, Helmet, ioredis, Pino, Better Auth
- Used by: Express app middleware chain in app.ts

**API Routes Layer (Server):**
- Purpose: HTTP endpoint handlers for secret CRUD, authentication, dashboards, billing, webhooks
- Location: `server/src/routes/`
- Contains:
  - `secrets.ts`: Factory creates fresh router + rate limiter instance per app. Routes: POST / (create), GET /:id/meta (metadata), POST /:id/verify (password verify+atomic destroy), GET /:id (atomic destroy)
  - `dashboard.ts`: GET /secrets (user's secret metadata list), DELETE /secrets/:id (soft-delete owned secret)
  - `billing.ts`: POST /checkout (Stripe session), GET /verify-checkout (session verification), POST /portal (customer portal)
  - `health.ts`: GET /api/health (liveness probe)
  - `me.ts`: GET /api/me (authenticated user profile)
  - `subscribers.ts`: POST / (email list opt-in), GET /subscribers/:token (unsubscribe verification)
  - `webhooks.ts`: POST /stripe (Stripe webhook handler for subscription updates)
  - `seo/index.ts`: SSR routes for /vs/*, /alternatives/*, /use/* (comparison/marketing content pages)
- Route order critical: secrets router matches top-down: POST / → GET /:id/meta → POST /:id/verify → GET /:id (catch-all)
- Depends on: Express, services layer, shared types, Better Auth, Stripe SDK
- Used by: Express app (app.ts), browser client, Stripe webhooks

**Service Layer (Server):**
- Purpose: Business logic isolated from HTTP concerns; reusable across routes and workers
- Location: `server/src/services/`
- Contains:
  - `secrets.service.ts`: createSecret(), retrieveAndDestroy() [3-step atomic transaction], getSecretMeta(), verifyAndRetrieve(), getUserSecrets(), deleteUserSecret()
  - `password.service.ts`: hashPassword() (Argon2id with OWASP-recommended params), verifyPassword()
  - `notification.service.ts`: sendSecretViewedNotification() (Resend email after secret destroyed)
  - `billing.service.ts`: getOrCreateStripeCustomer(), activatePro(), deactivatePro()
  - (Future) `email.service.ts`: Resend client for verification/password reset (Better Auth managed)
- Depends on: Drizzle ORM, db/schema.ts, argon2, resend, stripe
- Used by: Routes, background workers, auth callbacks

**Database Layer (Server):**
- Purpose: PostgreSQL schema definition, connection pooling, and migration management
- Location: `server/src/db/`
- Contains:
  - `schema.ts`: Tables (secrets, users, sessions, accounts, verification, marketing_subscribers) with indices, types, and inline zero-knowledge-invariant documentation
  - `connection.ts`: PostgreSQL pool + Drizzle ORM instance (singleton pattern)
  - `migrate.ts`: Migration runner script
- Secrets table structure:
  - `id` (text PK): 21-char nanoid, URL-safe
  - `ciphertext` (text): Base64-encoded blob (IV 12 bytes + encrypted payload + auth tag 16 bytes)
  - `expiresAt` (timestamp): Expiration deadline
  - `createdAt` (timestamp): Creation timestamp
  - `passwordHash` (text, nullable): Argon2id hash (never plaintext)
  - `passwordAttempts` (int): Counter for auto-destroy after 3 failures
  - `userId` (text FK, nullable): Reference to users.id; NULL means anonymous; onDelete: 'set null' preserves shared links
  - `label` (text, nullable): User-provided label (max 100 chars, authenticated only)
  - `notify` (boolean): Email notification opt-in on view (Phase 26)
  - `status` (enum): 'active' (unviewed), 'viewed' (consumed by owner), 'expired', 'deleted' (soft-delete by owner). Anonymous secrets hard-delete; user-owned soft-delete.
  - Index: `secrets_user_id_created_at_idx` (WHERE userId IS NOT NULL) for dashboard queries
- Users table: Better Auth schema + stripe_customer_id (nullable), subscription_tier (free/pro, default free), marketingConsent (Phase 37)
- Sessions/Accounts/Verification: Better Auth schema (email/password signup, OAuth2 Google/GitHub, email verification, password reset)
- Marketing_subscribers table: email, gdprConsent (Phase 36 — email capture, no userId/secretId link)
- Depends on: PostgreSQL 17+, node-postgres, drizzle-orm
- Used by: Service layer, routes, expiration worker, authentication

**Authentication Layer (Server):**
- Purpose: Session-based auth with email/password and OAuth2 providers
- Location: `server/src/auth.ts`
- Contains: Better Auth instance with Drizzle adapter, email handlers (Resend), session management
- Features:
  - Email/password signup and signin
  - OAuth2 providers (Google, GitHub)
  - Email verification (required in production, skipped in test via `requireEmailVerification: env.NODE_ENV !== 'test'`)
  - Password reset via email link
  - Session tokens stored in HTTPOnly cookies with sameSite: 'lax' (not strict — breaks OAuth redirects)
- Depends on: better-auth, resend, db schema (users, sessions, accounts, verification), bun:smtp (email provider)
- Used by: Routes (/api/auth/*), me.ts endpoint, Better Auth middleware in app.ts, billing.ts for tier upgrade

**Background Workers (Server):**
- Purpose: Scheduled background jobs for data cleanup and lifecycle management
- Location: `server/src/workers/`
- Contains:
  - `expiration-worker.ts`: Cleanup of expired secrets (node-cron every 5 minutes). Atomically zeroes ciphertext then deletes anonymous rows; updates status='expired' for user-owned rows. Uses transaction for consistency.
- Depends on: node-cron, Drizzle ORM, db connection, logger
- Used by: server.ts (startup/shutdown via startExpirationWorker(), stopExpirationWorker())

**Configuration (Server):**
- Purpose: Environment variable validation and secrets management
- Location: `server/src/config/`
- Contains:
  - `env.ts`: Zod schema for all env vars (DATABASE_URL, PORT, NODE_ENV, REDIS_URL, LOG_LEVEL, Better Auth secrets, Stripe keys, Resend API key, Loops API key, PostHog token, Infisical integration)
  - `stripe.ts`: Stripe SDK initialization with API key
  - `loops.ts`: Loops API client initialization for onboarding sequences
- Depends on: Zod, stripe, loops SDKs
- Used by: Routes, services, middleware, app factory

**Application Factory (Server):**
- Purpose: Express app assembly with middleware ordered for correctness
- Location: `server/src/app.ts`
- Middleware order (CRITICAL — each step required for subsequent steps):
  1. trust proxy (enables req.ip correction behind reverse proxy, req.secure for HTTPS detection)
  2. httpsRedirect (HTTP→HTTPS 301 when NODE_ENV=production)
  3. cspNonceMiddleware (generates per-request 32-byte hex nonce, stores in res.locals.cspNonce)
  4. helmet (CSP with nonce injection, HSTS, referrer-policy, cross-origin isolation)
  5. httpLogger (Pino with secret ID redaction)
  6. auth handler (Better Auth — MUST be before express.json() to avoid body-stream conflict)
  7. Stripe webhook raw handler (express.raw() for /api/webhooks/stripe — signature verification requires raw bytes)
  8. express.json (100kb size limit)
  9. routes (health, secrets, me, dashboard, billing, subscribers, catch-all /api 404)
  10. SEO SSR routes (seoRouter for /vs/*, /alternatives/*, /use/*)
  11. static assets + SPA catch-all (when client/dist exists — injects per-request CSP nonce into HTML template via replaceAll)
  12. errorHandler (must be last middleware)
- SPA catch-all route (Express 5 syntax: `{*path}`) with noindex defense-in-depth: sets X-Robots-Tag header for /secret/*, /login, /register, /forgot-password, /reset-password, /dashboard, /confirm, /unsubscribe routes
- Depends on: Express 5, all middleware + routes, Better Auth, Stripe
- Used by: server.ts, test suites (supertest)

**HTTP Server (Server):**
- Purpose: Startup, signal handling, graceful shutdown
- Location: `server/src/server.ts`
- Contains: buildApp() call, HTTP listener on PORT, expiration worker start, signal handlers (SIGTERM/SIGINT), pool.end() on shutdown
- Depends on: app.ts, logger, db pool, workers
- Used by: `npm run dev:server` script

## Data Flow

**Create Anonymous Secret:**
1. User enters plaintext in `/create` textarea (no login required)
2. Client calls `encrypt(plaintext)` from crypto module:
   - UTF-8 encode plaintext
   - PADME-pad to max 12% overhead (prevents length leakage)
   - Generate fresh 256-bit AES-GCM key
   - Generate fresh 96-bit IV
   - Encrypt with crypto.subtle.encrypt
   - Prepend IV to ciphertext: [IV 12 bytes][encrypted payload][auth tag 16 bytes]
   - Base64 encode result
   - Return { payload: { ciphertext }, key, keyBase64Url }
3. Client calls `createSecret(ciphertext, expiresIn, password?, label?, notify?, protectionType?)`:
   - POST /api/secrets with JSON body
   - Server middleware chain: rate limit (anon: 3/hour, 10/day) → validate Zod schema → handler
   - Handler enforces tier caps: anonymous max 1h expiration, free users max 7d
   - Service hashes password (if provided) via Argon2id (never stored plaintext)
   - Drizzle INSERT with nanoid-generated ID, userId=NULL (anonymous)
   - Returns { id, expiresAt }
4. Client receives ID, constructs shareable URL: `https://torchsecret.app/secret/{id}#{base64key}`
   - Key remains in URL fragment only (never sent to server per HTTP RFC 3986)
5. Client renders confirmation page with copy button, native share button, expiration countdown

**Create Authenticated Secret:**
1. User logs in via `/login` (Better Auth email/password or OAuth2 Google/GitHub)
2. Session token stored in HTTPOnly cookie (sameSite: lax)
3. User accesses `/create` page (same UI as anonymous)
4. When posting to /api/secrets, optionalAuth middleware populates res.locals.user from session
5. Service captures userId, label, notify flag
6. Secret linked to user account; queryable on `/dashboard` with metadata history
7. If subscriptionTier='pro': expiresIn can be '30d' (higher cap than free tier)

**Retrieve Secret (No Password):**
1. Recipient opens shareable URL `/secret/{id}#{key}`
2. Client extracts key from fragment immediately, strips fragment via history.replaceState() — key in memory only
3. Client calls `getSecretMeta(id)`:
   - GET /api/secrets/{id}/meta (non-destructive)
   - Service queries DB: returns { requiresPassword, passwordAttemptsRemaining }
4. If no password required:
   - Client calls `getSecret(id)`:
   - GET /api/secrets/{id}
   - Service executes 3-step atomic transaction:
     - SELECT secret by id (transaction isolation level: read committed)
     - UPDATE ciphertext = '' (zero the bytes for data remanence mitigation)
     - DELETE row (for anonymous) OR UPDATE status='viewed' (for user-owned)
     - Return original secret object with real ciphertext
   - Client decrypts ciphertext locally with key from URL fragment
   - Plaintext displayed in terminal-block component
5. Secret destroyed on server; subsequent requests return 404 (identical to expired/nonexistent)

**Retrieve Secret (With Password):**
1. Client calls `getSecretMeta(id)`: returns { requiresPassword: true, passwordAttemptsRemaining: 3 }
2. Client renders password entry form
3. User enters password, client calls `verifySecretPassword(id, password)`:
   - POST /api/secrets/{id}/verify with { password }
   - Service queries secret, compares Argon2id hash
   - On mismatch: increments passwordAttempts counter, throws ApiError 403 with attemptsRemaining
   - On 3 failed attempts: returns null (triggers 404 response, prevents further attempts)
   - On success: executes atomic destroy (same as passwordless flow) and returns ciphertext
4. Client decrypts and displays plaintext

**Dashboard View (Authenticated):**
1. User accesses `/dashboard` (requires valid session)
2. Client calls `fetchDashboardSecrets()`:
   - GET /api/dashboard/secrets
   - Server validates requireAuth middleware
   - Service queries all secrets WHERE userId = {user.id}
   - Returns array with metadata only: id, label, expiresAt, status, createdAt, viewedAt (no ciphertext/passwordHash)
3. Client renders list with status badges (Active/Viewed/Expired/Deleted), delete buttons for Active secrets
4. On delete: calls `deleteDashboardSecret(id)`:
   - DELETE /api/dashboard/secrets/{id}
   - Service validates ownership and status='active'
   - Updates status='deleted' (soft-delete, row preserved for history)
   - Returns { success: true } or 404

**Stripe Billing Flow:**
1. Free user initiates checkout on `/pricing` page
2. Client calls `initiateCheckout()`:
   - POST /api/billing/checkout (requires auth)
   - Service calls `getOrCreateStripeCustomer(user)` (idempotent: creates customer if not exists)
   - Stripe SDK creates checkout session with mode='subscription', line_items=[{ price: env.STRIPE_PRO_PRICE_ID }]
   - success_url includes {CHECKOUT_SESSION_ID} placeholder; Stripe replaces with actual session ID
   - Returns { url: stripe_checkout_url }
3. Browser redirects to Stripe-hosted Checkout
4. User completes payment, Stripe redirects back to `success_url` with session_id query param
5. Client calls `verifyCheckoutSession(sessionId)`:
   - GET /api/billing/verify-checkout?session_id={id}
   - Service validates sessionId format (cs_...)
   - Stripe API retrieves session, validates session.customer matches user's stripe_customer_id
   - Upgrades user.subscriptionTier to 'pro'
   - Returns { status: 'active', tier: 'pro' }
6. Stripe webhook (separate flow) also triggers subscription update via webhooks.ts handler

**Expiration Worker (Background):**
1. Runs every 5 minutes via node-cron
2. Calls `cleanExpiredSecrets()`:
   - Query secrets WHERE expiresAt <= NOW() AND status NOT IN ('viewed', 'deleted', 'expired')
   - For each batch: atomic transaction with UPDATE ciphertext='', then DELETE (anonymous) or UPDATE status='expired' (user-owned)
   - Returns count of cleaned secrets
   - Logs only count (never logs secret IDs per zero-knowledge invariant)

**Authentication Flow:**
1. Anonymous users access `/` (home) or `/create` without login
2. Users click `/login` to sign in with email/password or OAuth2
3. Better Auth handles /api/auth/sign-up, /api/auth/sign-in, /api/auth/oauth/google, /api/auth/oauth/github
4. Email verification gate (skipped in test, required in production)
5. Password reset via `/api/auth/forgot-password` and `/api/auth/reset-password`
6. Session token stored in HTTPOnly cookie
7. Authenticated requests auto-include session via middleware (require-auth or optional-auth)
8. GET /api/me returns { user: { id, email, name, subscriptionTier, ... } } or 401 if unauthenticated
9. Zero-knowledge invariant: res.locals.user (userId) never combined with secretId in logs/events/DB records

**State Management:**

Client-side:
- Routing state: SPA router maintains current route + params in memory + History API; no persistent state except localStorage for theme
- Theme state: localStorage key 'theme' (light/dark/system); FOWT prevention script in index.html applies before DOM renders
- Auth state: Better Auth session cookie is source of truth; client may cache user profile in memory
- Form state: Local component state only (no global state manager)

Server-side:
- Session state: PostgreSQL `sessions` table; session token in HTTPOnly cookie
- User state: PostgreSQL `users` table with subscription_tier, stripe_customer_id, marketingConsent
- Secret lifecycle: PostgreSQL `secrets` table with status field (active/viewed/expired/deleted)
- Rate limit state: Redis (if REDIS_URL set) or in-memory (testing/single-process)

## Key Abstractions

**Crypto Module:**
- Purpose: Encapsulate Web Crypto API calls for AES-256-GCM encryption/decryption
- Examples: `client/src/crypto/encrypt.ts`, `client/src/crypto/decrypt.ts`, `client/src/crypto/keys.ts`, `client/src/crypto/padding.ts`
- Pattern: Each function pure, returns typed results, no side effects. Key import/export uses base64url encoding. Imported keys are non-extractable, decrypt-only (defense-in-depth).

**Service Layer:**
- Purpose: Business logic reusable across routes and workers
- Examples: `server/src/services/secrets.service.ts`, `password.service.ts`, `notification.service.ts`, `billing.service.ts`
- Pattern: Stateless async functions taking primitives and returning typed objects. Database connection passed or imported. No HTTP concerns.

**Middleware Stack:**
- Purpose: Cross-cutting concerns applied uniformly
- Examples: `security.ts` (CSP nonce, Helmet), `rate-limit.ts` (anon/authed limiters), `logger.ts` (HTTP logging with redaction)
- Pattern: Each independently testable; order enforced in app.ts comments

**Router Factory:**
- Purpose: Fresh router + rate limiter instance per app for test isolation
- Examples: `createSecretsRouter(redisClient?)` in `secrets.ts`, `createDashboardRouter()` in `dashboard.ts`
- Pattern: Factory receives Redis client as optional param; each test app gets independent rate limit counters

**Type Contracts (Shared):**
- Purpose: Single source of truth for API request/response validation and typing
- Examples: `shared/types/api.ts` (Zod schemas: CreateSecretSchema, SecretIdParamSchema, VerifySecretSchema, etc.)
- Pattern: Zod for runtime validation + TypeScript for compile-time safety; used by both client (type-safe fetch) and server (middleware validation)

**Page Renderers:**
- Purpose: Dynamically render SPA pages via History API
- Examples: `client/src/pages/create.ts`, `client/src/pages/reveal.ts`, `client/src/pages/dashboard.ts`
- Pattern: Module exports PageRenderer function; router dynamically imports and calls them

## Entry Points

**Server Entry Point:**
- Location: `server/src/server.ts`
- Triggers: `npm run dev:server` (infisical run -- tsx watch) or production startup
- Responsibilities: Builds Express app, starts HTTP server on PORT, starts expiration worker, handles SIGTERM/SIGINT gracefully (closes pool + server)

**Client Entry Point:**
- Location: `client/src/app.ts` (imported by `client/index.html` via script defer)
- Triggers: DOMContentLoaded event
- Responsibilities: Initializes analytics (PostHog), theme listener, layout shell, and router. Router matches current URL and renders appropriate page.

**App Builder (Server):**
- Location: `server/src/app.ts` (`buildApp()` factory)
- Triggers: Called by server.ts at startup and by test suites
- Responsibilities: Constructs Express app with all middleware and routes in critical order. Returns app without starting HTTP server (enables supertest).

**Request Handling Flow:**
1. HTTP request arrives at Express listener
2. Middleware chain processes (trust proxy → HTTPS redirect → CSP nonce → Helmet → logger → auth handler → JSON parser)
3. Route handler matches and executes (validates params/body, calls service)
4. Service performs business logic and database operations
5. Response sent to client via res.json() or error handler

## Error Handling

**Strategy:** Centralized error handler middleware at end of stack. All errors (sync and async) bubble to handler. Handler logs error server-side and responds with appropriate HTTP status + JSON body.

**Patterns:**

Validation errors (Zod):
- HTTP Status: 400
- Response: `{ error: 'validation_error', message: '...', details: { ... } }`

Unauthorized (no session):
- HTTP Status: 401
- Response: Better Auth or custom `{ error: 'unauthorized' }`

Forbidden (resource ownership):
- HTTP Status: 403
- Response: `{ error: 'forbidden' }` or `{ error: 'invalid_password', attemptsRemaining: N }`

Not Found (secret expired/viewed/never existed):
- HTTP Status: 404
- Response: Unified `{ error: 'not_found', message: 'This secret does not exist, has already been viewed, or has expired.' }` (prevents enumeration per SECR-07)

Rate Limited:
- HTTP Status: 429
- Response: `{ error: 'rate_limited' }` with RateLimit-Reset header (delta in seconds for countdown display on upsell prompts)

Server Error:
- HTTP Status: 500
- Response: `{ error: 'internal_error' }` (logs full error server-side, never exposes stack trace)

Anti-enumeration:
- Secret not found, expired, viewed, and wrong password return identical 404 to prevent timing/enumeration attacks

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino (structured JSON logging)
- Location: `server/src/middleware/logger.ts`
- Redaction: Secret IDs redacted from URL paths via regex; also redacts /api/dashboard/secrets/:id paths
- Pattern: Logs each HTTP request/response with method, path, status, duration; logs errors with error type (never secret contents or IDs)
- Zero-knowledge: Never logs userId + secretId together; app logs secrets.user_id as nullable FK

**Validation:**
- Framework: Zod 4.x
- Locations: `shared/types/api.ts` (API schemas), `server/src/config/env.ts` (env vars), `server/src/middleware/validate.ts` (middleware factories)
- Pattern: Zod safeParse → respond 400 with error details if validation fails

**Authentication:**
- Framework: Better Auth 1.x
- Features: Email/password signup/signin, OAuth2 (Google, GitHub), email verification, password reset
- Session: HTTPOnly cookie with sameSite: 'lax', token stored in PostgreSQL `sessions` table
- Server reads: `req.user` (or `res.locals.user`) populated by Better Auth middleware

**Authorization:**
- Pattern: Resource ownership checks in route handlers. Secrets with null userId are owned by no one (anonymous; not retrievable from dashboard). Dashboard routes use requireAuth middleware to ensure session exists.

**Rate Limiting:**
- Framework: express-rate-limit with optional Redis backend
- Limiters: Separate for anon/authed users; skip logic checks session to route to correct limiter
- Response: 429 with RateLimit-Reset header (draft-6 delta format, time remaining in seconds)

**Security Headers:**
- Framework: Helmet 8.x
- CSP: Per-request nonce generated in early middleware, injected into script-src and style-src directives
- HSTS: 1 year max-age with includeSubDomains
- HTTPS Redirect: Middleware checks req.secure and redirects HTTP → HTTPS in production

**Encryption:**
- Framework: Web Crypto API (native, no third-party crypto)
- Algorithm: AES-256-GCM
- Key generation: crypto.subtle.generateKey (256-bit)
- IV generation: crypto.getRandomValues (96-bit, fresh per encryption)
- Transport: Base64-encoded; IV prepended to ciphertext as single blob
- Decryption: Fails generically if key wrong or ciphertext tampered (no internal details exposed)

**Data Privacy:**
- Zero-knowledge invariant: No code path stores/logs both userId + secretId together (enforced by schema + logging regex)
- Ciphertext zeroing: Anonymous secrets overwrite ciphertext before deletion (mitigates WAL remanence)
- Session isolation: Sessions per-user; no cross-user data leakage
- Email notifications: Send only viewed-at timestamp; no secretId, label, or ciphertext in email body

---

*Architecture analysis: 2026-02-28*
