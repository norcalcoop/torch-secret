# Architecture

**Analysis Date:** 2026-03-01

## Pattern Overview

**Overall:** Layered architecture with zero-knowledge client-server trust boundary. The application implements strict separation between encryption logic (client-only), storage (server-only), and shared contracts (Zod schemas).

**Key Characteristics:**
- **Zero-knowledge encryption model:** The server never touches plaintext. Encryption keys live exclusively in the URL fragment (`#base64key`) and never reach the server per HTTP spec (RFC 3986).
- **Atomic three-step transactions:** Secret retrieval uses SELECT → zero ciphertext → DELETE transactions to prevent data remanence and ensure one-time consumption.
- **Defensive error responses:** All secret-unavailable cases (not found, expired, viewed, wrong password) return identical error messages to prevent enumeration attacks.
- **Explicit separation of concerns:** Crypto module (`client/src/crypto/`) is the sole importer of Web Crypto API. Services (`server/src/services/`) handle business logic independent of routes.

## Layers

**Presentation Layer (Client):**
- Purpose: User-facing SPA with zero-knowledge frontend. Handles encryption/decryption locally in the browser. Never sends plaintext or keys to the server.
- Location: `client/src/`
- Contains: Page renderers (`pages/`), UI components (`components/`), crypto module (`crypto/`), analytics (`analytics/`), API client (`api/`), theme system (`theme.ts`), router (`router.ts`)
- Depends on: Shared API types (`shared/types/api.ts`), Web Crypto API (native), PostHog SDK (analytics)
- Used by: End users via HTTP(S)

**Application Layer (Client):**
- Purpose: SPA routing, page lifecycle, theme management, and analytics event capture.
- Location: `client/src/router.ts`, `client/src/app.ts`, `client/src/theme.ts`, `client/src/analytics/`
- Contains: History API router, SEO meta management, route-to-page-renderer mapping, localStorage-persisted theme state
- Depends on: Page modules (lazy-loaded), crypto module (for encryption/decryption), API client (for remote calls)
- Used by: Pages at render time

**API Contract Layer (Shared):**
- Purpose: Zod schemas + TypeScript interfaces that enforce request/response shapes across client and server.
- Location: `shared/types/api.ts`
- Contains: CreateSecretSchema, VerifySecretSchema, MetaResponse, DashboardSecretItem, MeResponse, BillingCheckoutResponse, etc.
- Depends on: Zod 4.x
- Used by: Routes (server validation), API client (TypeScript typing)

**API Layer (Server):**
- Purpose: HTTP endpoint definitions. Each route file maps HTTP verbs + paths to handlers. Validates input, calls services, returns JSON.
- Location: `server/src/routes/`
- Contains: `secrets.ts` (create, retrieve, verify, metadata), `dashboard.ts` (user secret list), `billing.ts` (Stripe checkout/portal), `subscribers.ts` (GDPR email capture), `me.ts` (current user), `health.ts` (liveness), `seo/` (server-rendered comparison pages)
- Depends on: Middleware (validation, auth, rate-limit), services (business logic), Zod schemas (validation)
- Used by: Express app routing

**Middleware Layer (Server):**
- Purpose: Cross-cutting concerns applied to all or filtered routes.
- Location: `server/src/middleware/`
- Contains: Security (CSP nonce, Helmet, HTTPS redirect), rate-limit (Redis-backed or in-memory per-route limiters), validation (Zod request body/params), logger (Pino with secret ID redaction), optional/required auth (Better Auth session), error-handler (global error catching)
- Depends on: Express, Helmet, Pino, Redis/ioredis, Zod, Better Auth
- Used by: `app.ts` middleware chain

**Business Logic Layer (Server):**
- Purpose: Core operations independent of HTTP. Handles secret lifecycle, password hashing, email sending, billing, onboarding.
- Location: `server/src/services/`
- Contains: `secrets.service.ts` (createSecret, retrieveAndDestroy, verifyAndRetrieve, getSecretMeta), `password.service.ts` (Argon2id hashing), `billing.service.ts` (Stripe customer setup, tier activation), `notification.service.ts` (secret-viewed emails), `onboarding.service.ts` (Loops email sequences), `subscribers.service.ts` (GDPR marketing list), `email.ts` (Resend transactional sender)
- Depends on: Database layer, external SDKs (Stripe, Resend, Loops), logger
- Used by: Routes, workers

**Data Access Layer (Server):**
- Purpose: Database abstraction. Schema definition + connection pooling. No raw SQL; all queries via Drizzle ORM.
- Location: `server/src/db/`
- Contains: `schema.ts` (table definitions: users, sessions, accounts, verification, secrets, marketing_subscribers), `connection.ts` (PostgreSQL pool + Drizzle instance), `migrate.ts` (migration runner)
- Depends on: Drizzle ORM, PostgreSQL driver (pg), nanoid (ID generation)
- Used by: Services (for all data access)

**Background Job Layer (Server):**
- Purpose: Scheduled tasks run outside the HTTP request/response cycle.
- Location: `server/src/workers/`
- Contains: `expiration-worker.ts` (node-cron job that hard-deletes expired anonymous secrets every 5 minutes)
- Depends on: Database layer, logger, node-cron
- Used by: Server startup (started by `server.ts`)

**Configuration Layer (Server):**
- Purpose: Environment validation and SDK singletons.
- Location: `server/src/config/`
- Contains: `env.ts` (Zod-validated environment variables), `stripe.ts` (Stripe SDK singleton), `loops.ts` (Loops email SDK singleton)
- Depends on: Zod, environment variables
- Used by: All layers that need config or external SDKs

**Authentication Layer (Server):**
- Purpose: User identity and session management via Better Auth 1.x.
- Location: `server/src/auth.ts`
- Contains: Better Auth config with email/password, Google OAuth, GitHub OAuth, email verification, session management
- Depends on: Better Auth SDK, database layer
- Used by: Middleware (session validation), routes (user context)

## Data Flow

**Anonymous Secret Creation Flow:**

1. User enters plaintext on `/create` page
2. Client crypto module (`client/src/crypto/encrypt.ts`) generates random 256-bit key and 96-bit IV
3. Web Crypto API (AES-256-GCM) encrypts plaintext with key + IV → ciphertext
4. IV + ciphertext + auth tag are base64-encoded together → `payload.ciphertext`
5. API client (`client/src/api/client.ts`) POSTs ciphertext + expiresIn to `/api/secrets`
6. Server route (`server/src/routes/secrets.ts`) validates body (Zod CreateSecretSchema)
7. Rate limiter middleware checks anonymous hourly/daily quotas (3/hr, 10/day)
8. Route handler calls `createSecret()` service
9. Service inserts row into `secrets` table with encrypted ciphertext, null userId, expiresAt
10. Database returns nanoid ID
11. Route responds with { id, expiresAt }
12. Client constructs shareable URL: `https://torchsecret.app/secret/{id}#base64urlkey`
13. Key stays in fragment; URL is shared
14. **Key never reaches server** (fragment not sent per RFC 3986)

**Secret Retrieval Flow (No Password):**

1. Recipient visits URL `/secret/{id}#base64urlkey`
2. Client `reveal.ts` page extracts ID from path, key from fragment
3. Client calls `/api/secrets/{id}` GET endpoint
4. Server route enters transaction: SELECT secret WHERE id = {id}
5. If not found, expired, already viewed, or has password → return standard 404/403 (SECR-07 anti-enumeration)
6. If found and active: UPDATE secret SET ciphertext = '' (zero with spaces), then DELETE row (anonymous) or UPDATE status='viewed' (user-owned)
7. Route returns { ciphertext, expiresAt }
8. **Ciphertext is already zeroed on server; client never processes it again**
9. Client receives ciphertext, imports key from fragment, calls `decrypt(ciphertext, key)` in crypto module
10. Web Crypto API decrypts → plaintext
11. Page displays plaintext in terminal-like block

**Password-Protected Secret Flow:**

1. Same as anonymous creation, but with password parameter in POST body
2. `createSecret()` service calls `hashPassword(password)` (Argon2id, OWASP params)
3. Hash stored in `passwordHash` column
4. Recipient visits URL, client checks `/api/secrets/{id}/meta` endpoint first
5. Meta route returns { requiresPassword: true, passwordAttemptsRemaining: 3 } without consuming secret
6. Client shows password prompt
7. User submits password via POST `/api/secrets/{id}/verify`
8. Route calls `verifyAndRetrieve()` service
9. Service calls `verifyPassword(submitted, hash)` (timing-constant comparison)
10. If wrong: increment `passwordAttempts`, respond 403 with { error: 'wrong_password', attemptsRemaining }
11. If 3 attempts exceeded: call `hardDeleteSecret()` (hard-delete user-owned rows too)
12. If correct: transaction reads → zeros → deletes (same as non-password flow)
13. Route returns { ciphertext, expiresAt }
14. Client decrypts with key from fragment

**Authenticated User Dashboard Flow:**

1. User navigates to `/dashboard`
2. Client `pages/dashboard.ts` calls `getMe()` API
3. `require-auth` middleware validates Better Auth session cookie
4. `/api/me` route queries `users` table, returns current user + subscriptionTier
5. If authenticated, client calls `/api/dashboard/secrets`
6. `dashboard.ts` route queries `secrets` where userId = current_user_id
7. **Returns metadata only** (id, label, createdAt, expiresAt, status, notify, viewedAt) — **never ciphertext**
8. Page renders list of user's secrets with status badges (active/viewed/expired)
9. User can soft-delete (UPDATE status='deleted') or click to view ciphertext counts
10. Dashboard queries use partial index `secrets_user_id_created_at_idx` for fast filtering

**Billing Flow (Stripe Webhook):**

1. Authenticated user clicks "Upgrade to Pro"
2. Client calls `initiateCheckout()` → POST `/api/billing/checkout`
3. Route creates Stripe Checkout session, stores session ID in memory (stateless per request), returns { url }
4. Browser redirects to Stripe Checkout
5. User completes payment
6. Stripe redirects browser to `/api/billing/verify-checkout?session_id=...`
7. Route queries Stripe SDK for session status (calls `stripe.checkout.sessions.retrieve()`)
8. If status='complete': calls `activatePro(stripeCustomerId)` service
9. Service updates `users` set subscriptionTier='pro' where stripeCustomerId matches
10. Route returns { status: 'active', tier: 'pro' }
11. **Separate webhook handler** at POST `/api/webhooks/stripe` (mounted before express.json()) listens for Stripe events
12. On `customer.subscription.updated` or `customer.subscription.deleted`: calls `deactivatePro()` to downgrade tier
13. No userId + secretId co-location in webhook (uses stripe_customer_id only per INVARIANTS.md)

**Email Notification Flow (Secret Viewed):**

1. Authenticated user creates secret with notify=true
2. Secret row stored with notify column = true
3. Recipient retrieves secret → route calls `retrieveAndDestroy()`
4. Service executes transaction, then calls `sendSecretViewedNotification(userEmail, viewedAt)` **outside transaction**
5. `notification.service.ts` calls `sendEmail()` with Resend SDK
6. **Email body contains ONLY viewed-at timestamp** — no secretId, ciphertext, or label (SECR-04 + INVARIANTS.md Phase 26)
7. Background job / async handler sends Resend request
8. Email arrives at user

**Rate Limiting Flow:**

1. Anonymous user makes first POST `/api/secrets` request
2. `createAnonHourlyLimiter` middleware (created by factory in `rate-limit.ts`) fires
3. Redis client (if REDIS_URL set) or in-memory store increments IP-based counter
4. If count < 3 in the last 1 hour: pass to next middleware
5. If count ≥ 3: respond 429 with RateLimit-Reset header (delta in seconds)
6. Client receives 429, reads header to show countdown timer on upsell prompt

## Key Abstractions

**Crypto Module (`client/src/crypto/`):**
- Purpose: Self-contained encryption/decryption via Web Crypto API. No third-party crypto libraries. Defense in depth: imported keys are non-extractable.
- Examples: `encrypt.ts` (AES-256-GCM), `decrypt.ts`, `keys.ts` (key import/export), `padding.ts` (PADME padding), `password-generator.ts` (secure random passwords), `passphrase.ts` (BIP-39 word lists)
- Pattern: Pure async functions that accept plaintext/ciphertext strings, return Promise<result>. All randomness via `crypto.getRandomValues()`.

**Service Classes (`server/src/services/`):**
- Purpose: Stateless functions that encapsulate business logic. No HTTP context. Testable in isolation.
- Examples: `createSecret()`, `retrieveAndDestroy()`, `hashPassword()`, `activatePro()`, `sendSecretViewedNotification()`
- Pattern: Async functions with clear inputs/outputs. Database access via Drizzle ORM. External SDK calls (Stripe, Resend) via config singletons, never instantiated inline.

**Route Handlers (`server/src/routes/`):**
- Purpose: Map HTTP verbs + paths to middleware chains + handlers. Validation + service orchestration + response formatting.
- Examples: POST `/api/secrets` (create), GET `/api/secrets/:id` (retrieve), POST `/api/billing/checkout` (initiate Stripe)
- Pattern: Router factories (e.g., `createSecretsRouter(redisClient?)`) that return Express Router instances. Each route has explicit middleware order. Handlers call services, catch errors, respond.

**Better Auth Adapter (`server/src/auth.ts`):**
- Purpose: Unified authentication with session management. Email/password signup/login, Google + GitHub OAuth, email verification.
- Examples: User registration with email verification, OAuth callback handling, session refresh
- Pattern: Single Better Auth config object. Session stored in `sessions` table. OAuth accounts stored in `accounts` table. Each login creates a session token.

**Zod Schemas (`shared/types/api.ts`):**
- Purpose: Single source of truth for request/response shapes. Shared between client (TypeScript) and server (validation).
- Examples: `CreateSecretSchema`, `VerifySecretSchema`, `MetaResponse`, `DashboardSecretItem`
- Pattern: Each endpoint has a Schema for input (POST body or GET params) and an interface for output. Server validates, client types.

## Entry Points

**Browser Entry Point (`client/index.html`):**
- Location: `client/index.html`
- Triggers: Page load (HTTP GET /)
- Responsibilities: Serves SPA shell with FOWT prevention script (applies theme before first paint), JSON-LD structured data, Open Graph tags, CSP meta. Loads Vite-bundled app.ts.

**Client Application Init (`client/src/app.ts`):**
- Location: `client/src/app.ts`
- Triggers: DOMContentLoaded event
- Responsibilities: Initializes PostHog analytics, theme listener, layout shell (header/footer/dot-grid), then SPA router. Order matters: router must fire last so listeners are registered.

**SPA Router (`client/src/router.ts`):**
- Location: `client/src/router.ts`
- Triggers: Page load (handleRoute() called immediately by initRouter()), popstate events (browser back/forward), programmatic navigate() calls
- Responsibilities: Matches pathname to page module, dynamically imports page renderer, lazy-loads chunks, updates SEO meta tags, announces route change via aria-live, focuses h1 heading.

**Express App Factory (`server/src/app.ts`):**
- Location: `server/src/app.ts`
- Triggers: Called once at startup by `server.ts` buildApp()
- Responsibilities: Constructs Express app with middleware chain in critical order: proxy trust → HTTPS redirect → CSP nonce → Helmet → logger → auth handler → Stripe webhook → JSON parser → routes → static/SPA → error handler. Returns app (server.ts calls app.listen()).

**HTTP Server Startup (`server/src/server.ts`):**
- Location: `server/src/server.ts`
- Triggers: Node.js process startup
- Responsibilities: Builds Express app, listens on PORT, starts expiration worker, registers SIGTERM/SIGINT handlers for graceful shutdown (closes HTTP server, database pool, stops worker).

**Expiration Worker (`server/src/workers/expiration-worker.ts`):**
- Location: `server/src/workers/expiration-worker.ts`
- Triggers: Every 5 minutes (node-cron schedule '*/5 * * * *')
- Responsibilities: Queries `secrets` table WHERE expiresAt < NOW, hard-deletes anonymous rows, soft-deletes (UPDATE status='expired') user-owned rows. Logs errors, never crashes the server.

## Error Handling

**Strategy:** Defensive default responses. All errors that leak information (secret exists, was viewed, has wrong password) collapse into identical "not found" responses.

**Patterns:**

- **Secret Retrieval Errors:** GET `/api/secrets/:id` returns identical error for not-found, expired, already-viewed, and password-protected cases. Response: `{ error: 'not_found', message: 'This secret does not exist, has already been viewed, or has expired.' }` (SECR-07).

- **Password Verification Errors:** Wrong password increments attempt counter. After 3 attempts, secret is hard-deleted. Response includes `attemptsRemaining` to show user countdown (e.g., "2 attempts left"). Timing-constant comparison prevents timing attacks.

- **Global Error Handler:** `middleware/error-handler.ts` catches unhandled async errors. Returns `{ error: 'internal_error', message: 'Something went wrong.' }`. Logs full error with Pino (secret IDs redacted). Never leaks stack traces to client.

- **Rate Limit Errors:** 429 response with `RateLimit-Reset` header (delta in seconds). Client reads header to show countdown timer before retry. Used to drive upsell prompts on free tier.

- **Authentication Errors:** Unauthenticated requests to protected routes (e.g., `/api/dashboard`, `/api/me`) get 401. No 403 (Forbidden) — just redirect to login.

- **Validation Errors:** Zod schema failures (invalid expiresIn enum, ciphertext too long) respond 400 with error message. Example: "Anonymous sharing is limited to 1-hour expiration."

## Cross-Cutting Concerns

**Logging:** Pino logger (`middleware/logger.ts`) with pinoHttp integration. Secret IDs redacted from URL paths via regex. IP addresses logged for rate-limit context. No plaintext ciphertext, user passwords, or PII in logs. Every request/response duration tracked.

**Validation:** Zod schemas at `shared/types/api.ts` define all request/response contracts. Server middleware (`middleware/validate.ts`) validates POST bodies and URL params before handlers execute. Catches validation errors early, returns 400.

**Authentication:** Better Auth 1.x manages sessions via httpOnly cookies. Each login creates session token in `sessions` table. Middleware (`optional-auth.ts`, `require-auth.ts`) extracts session, validates expiry, populates `res.locals.user`. OAuth callbacks (Google, GitHub) create users + accounts rows automatically.

**Authorization:** Routes explicitly check `res.locals.user` presence. Protected routes (dashboard, billing, me) fail 401 if `res.locals.user` is undefined. No role-based access control (RBAC) yet — only authenticated vs. anonymous.

---

*Architecture analysis: 2026-03-01*
