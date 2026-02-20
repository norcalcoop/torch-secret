# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Zero-Knowledge Encryption SPA with Untrusted Server Storage + Optional User Accounts (Phase 22)

**Key Characteristics:**
- **Trust Boundary 1:** Browser vs. Server — Server never touches plaintext; only stores encrypted blobs
- **Trust Boundary 2:** Server vs. Database — PostgreSQL stores only ciphertext + metadata; encryption keys exist only in URL fragments (`#base64key`)
- **Atomic Destruction:** Secrets self-destruct on first retrieval (three-step transaction: SELECT → ZERO → DELETE)
- **No Key Reuse:** Every encryption generates fresh 256-bit key + fresh 96-bit IV
- **Zero-Knowledge Invariant:** No database record, log line, or analytics event may contain BOTH `userId` AND `secretId` together (enforced across DB, logger, and analytics)
- **Authentication Optional:** Users can create/share secrets anonymously (userId NULL); optional accounts for dashboard history (Phase 22)

## Layers

**Presentation Layer (Client):**
- Purpose: User interface rendered in browser via SPA router; handles encryption/decryption entirely client-side
- Location: `client/src/`
- Contains: Pages (create, reveal, confirmation, error, login, register, dashboard, reset-password, forgot-password), components (layout, copy-button, share-button, toast, theme-toggle, loading-spinner, expiration-select, terminal-block, icons), router (History API with dynamic imports), theme system (light/dark/system)
- Depends on: Web Crypto API (native), Lucide icons, Tailwind CSS, BetterAuth client
- Used by: End users via browser

**Encryption Module (Client):**
- Purpose: Performs all AES-256-GCM encryption/decryption with crypto.subtle; NEVER exported to pages except through `crypto/index.ts` barrel
- Location: `client/src/crypto/` (encrypt.ts, decrypt.ts, keys.ts, padding.ts, encoding.ts, constants.ts)
- Contains: Key generation, PADME padding, base64 encoding, AES-GCM cipher operations
- Depends on: Web Crypto API only (no third-party crypto)
- Used by: Pages (create.ts, reveal.ts)

**API Client Layer (Client):**
- Purpose: Typed fetch wrapper for HTTP calls; never caches GET requests (one-shot operations)
- Location: `client/src/api/client.ts`
- Contains: createSecret(), getSecret(), getSecretMeta(), verifySecretPassword(), ApiError class
- Depends on: Fetch API, shared/types/api.ts for type contracts
- Used by: Pages (create.ts, reveal.ts, login.ts, register.ts, dashboard.ts, etc.)

**Routing Layer (Client):**
- Purpose: History API router with per-request SEO metadata management
- Location: `client/src/router.ts`
- Contains: navigate(), initRouter(), updatePageMeta() (manages title, description, canonical, robots, OG/Twitter tags), handleRoute(), focusPageHeading()
- Depends on: Native History API, DOM APIs
- Used by: app.ts (initialization), all pages (navigation)

**Security Middleware (Server):**
- Purpose: Enforce cryptographic and HTTP-level security guarantees
- Location: `server/src/middleware/`
- Contains:
  - `security.ts`: CSP nonce generation, Helmet (HSTS, referrer-policy, cross-origin isolation), HTTPS redirect
  - `rate-limit.ts`: Redis-backed (with MemoryStore fallback) rate limiters for POST /api/secrets and POST /api/secrets/:id/verify
  - `logger.ts`: Pino HTTP logger with secret ID redaction (regex: `/\/api\/secrets\/[A-Za-z0-9_-]+/g` → `[REDACTED]`)
  - `validate.ts`: Zod body/param validation factories
  - `error-handler.ts`: Global error handler (must be last middleware)
- Depends on: Express, Helmet, ioredis, Pino
- Used by: Express app (app.ts middleware chain)

**API Routes Layer (Server):**
- Purpose: HTTP endpoint handlers for secret CRUD, metadata checks, password verification, authentication, user info
- Location: `server/src/routes/`
- Contains:
  - `secrets.ts`: POST / (create), GET /:id (retrieve+destroy), GET /:id/meta (non-destructive metadata), POST /:id/verify (password verify+retrieve)
  - `health.ts`: GET /api/health (liveness probe)
  - `me.ts`: GET /api/me (returns authenticated user info, requires auth session)
- Route Order Critical: secrets router matches routes top-down: POST / → GET /:id/meta → POST /:id/verify → GET /:id
- Depends on: Express, services layer, shared types
- Used by: Express app (app.ts), browser client

**Service Layer (Server):**
- Purpose: Business logic isolated from HTTP concerns
- Location: `server/src/services/`
- Contains:
  - `secrets.service.ts`: createSecret(), retrieveAndDestroy() [3-step atomic transaction], getSecretMeta(), verifyAndRetrieve()
  - `password.service.ts`: hashPassword() (Argon2id with OWASP params), verifyPassword()
  - `email.service.ts`: Resend email client for verification and password reset
- Depends on: Drizzle ORM, db/schema.ts, argon2, resend
- Used by: Routes (secrets.ts), auth (auth.ts), background workers

**Database Layer (Server):**
- Purpose: PostgreSQL schema definition and connection management
- Location: `server/src/db/`
- Contains:
  - `schema.ts`: 5 tables (secrets, users, sessions, accounts, verification) with indices and type definitions
  - `connection.ts`: PostgreSQL pool + Drizzle ORM instance
  - `migrate.ts`: Migration runner
- Secrets Table Structure:
  - `id` (text PK): 21-char nanoid
  - `ciphertext` (text): Base64-encoded blob (IV 12 bytes + encrypted payload + auth tag 16 bytes)
  - `expiresAt` (timestamp): Expiration deadline
  - `createdAt` (timestamp): Creation timestamp
  - `passwordHash` (text, nullable): Argon2id hash for optional password protection
  - `passwordAttempts` (int): Counter for auto-destroy after 3 failures
  - `userId` (text FK, nullable): Reference to users.id; NULL means anonymous secret; Drizzle uses `onDelete: 'set null'` to preserve links when user deleted
  - Index: `secrets_user_id_created_at_idx` (partial, WHERE userId IS NOT NULL) for dashboard queries
- Users/Sessions/Accounts/Verification Tables: BetterAuth schema for authentication (Phase 22)
- Depends on: PostgreSQL 17+, node-postgres, drizzle-orm
- Used by: Service layer, expiration worker, authentication layer

**Authentication Layer (Server):**
- Purpose: Session-based authentication with email/password, OAuth2 (Google/GitHub), email verification, password reset
- Location: `server/src/auth.ts`
- Contains: BetterAuth instance with Drizzle adapter, email handlers (Resend), session management
- Features:
  - Email/password signup and signin
  - OAuth2 providers (Google, GitHub)
  - Email verification (required in production, bypassed in test)
  - Password reset via email link
  - Session tokens stored in HTTPOnly cookies
- Depends on: better-auth, resend, db schema (users, sessions, accounts, verification)
- Used by: Routes (/api/auth/*), me.ts endpoint, BetterAuth middleware in app.ts

**Background Worker (Server):**
- Purpose: Periodic cleanup of expired secrets
- Location: `server/src/workers/expiration-worker.ts`
- Contains: cleanExpiredSecrets() (bulk zero-then-delete), cron schedule (every 5 minutes), start/stop control
- Depends on: node-cron, Drizzle ORM, db connection, logger
- Used by: server.ts (startup/shutdown)

**Application Factory (Server):**
- Purpose: Express app assembly with middleware ordered for correctness
- Location: `server/src/app.ts`
- Middleware Order (CRITICAL):
  1. trust proxy (enables req.ip correction behind reverse proxy)
  2. httpsRedirect (HTTP→HTTPS 301 when FORCE_HTTPS=true)
  3. cspNonceMiddleware (generates per-request 32-byte hex nonce)
  4. helmet (CSP with nonce, HSTS, referrer-policy, cross-origin isolation)
  5. httpLogger (Pino with secret ID redaction)
  6. auth handler (Better Auth — must be before express.json() to avoid body-stream conflict)
  7. express.json (100kb size limit)
  8. routes (health, secrets, me, catch-all /api 404)
  9. static assets + SPA catch-all (when client/dist exists — injects CSP nonce into HTML template)
  10. errorHandler (must be last)
- Depends on: Express, all middleware + routes
- Used by: server.ts

**HTTP Server (Server):**
- Purpose: Startup, graceful shutdown, logging
- Location: `server/src/server.ts`
- Contains: buildApp() call, HTTP listener, signal handlers (SIGTERM/SIGINT), pool.end()
- Depends on: app.ts, logger, db pool
- Used by: npm scripts (dev:server)

## Data Flow

**Create Anonymous Secret (Browser → Server → DB):**

1. User enters plaintext into `create.ts` textarea (no login required)
2. `create.ts` calls `encrypt(plaintext)` from `crypto/encrypt.ts`:
   - UTF-8 encode plaintext
   - PADME-pad to prevent length leakage
   - Generate fresh 256-bit AES-GCM key
   - Generate fresh 96-bit IV
   - Encrypt with crypto.subtle.encrypt
   - Prepend IV to ciphertext: [IV 12 bytes][encrypted payload][auth tag 16 bytes]
   - Base64 encode result
   - Return: { payload: { ciphertext }, key, keyBase64Url }
3. `create.ts` calls `createSecret(ciphertext, expiresIn, password?)` from `api/client.ts`:
   - POST /api/secrets with JSON: { ciphertext, expiresIn, password? }
   - Server receives request through middleware chain:
     - Rate limiter checks IP limit (10 req/hour, or 1000 in E2E tests)
     - validateBody ensures Zod schema match
   - `secrets.ts` route calls `secrets.service.createSecret(ciphertext, expiresIn, password)`
   - Service hashes password (if provided) via `password.service.hashPassword()`
   - Service DOES NOT capture userId; anonymous secrets have userId=NULL
   - Drizzle INSERT with nanoid-generated ID
   - Returns: { id, expiresAt }
4. API response contains ID only; key remains in browser memory + URL fragment
5. `create.ts` calls `renderConfirmationPage(container, shareUrl, expiresAt)` from `confirmation.ts`:
   - `shareUrl` = `${window.location.origin}/secret/${id}#${keyBase64Url}`
   - Key in fragment never sent to server per HTTP spec
6. Confirmation page displays shareable URL, copy button, native share button, expiration info

**Create Authenticated Secret (With User Account):**

1. User logs in via `/login` page (BetterAuth email/password or OAuth2)
2. Session token stored in HTTPOnly cookie
3. User accesses `/create` page (same UI as anonymous)
4. When posting to /api/secrets, Express middleware automatically populates `req.user` from BetterAuth session
5. Service layer can optionally capture userId in secrets table (for dashboard history in Phase 24)
6. Secret remains queryable on user's /dashboard for account holders

**Retrieve Secret (Browser → Server → Browser → DB delete):**

1. Recipient opens shareable URL `/secret/{id}#key`
2. `reveal.ts` extracts key from `window.location.hash.slice(1)` IMMEDIATELY
3. `reveal.ts` strips fragment via `history.replaceState()` — key exists only in memory
4. `reveal.ts` shows loading spinner and calls `getSecretMeta(id)` from `api/client.ts`:
   - GET /api/secrets/{id}/meta (non-destructive)
   - Service queries database: returns { requiresPassword, passwordAttemptsRemaining }
5. If password required: `reveal.ts` renders password entry form
   - On submit: calls `verifySecretPassword(id, password)` from `api/client.ts`
   - POST /api/secrets/{id}/verify with { password }
   - Service queries secret, compares hash, increments passwordAttempts, returns ciphertext if valid
   - If invalid: throws ApiError, decrements attempts, shows "N attempts remaining"
   - If 3 attempts exceeded: Service returns null (triggers 404 response)
6. If no password or password verified: User clicks "Reveal Secret" button
   - `reveal.ts` calls `getSecret(id)` from `api/client.ts`
   - GET /api/secrets/{id}
   - Service executes 3-step atomic transaction:
     - SELECT secret by id
     - ZERO ciphertext (replace with '0' repeated) for data remanence mitigation
     - DELETE the row
     - Return original secret object (with real ciphertext from step 1)
7. `reveal.ts` receives ciphertext and calls `decrypt(ciphertext, keyBase64Url)` from `crypto/decrypt.ts`:
   - Base64 decode ciphertext
   - Split: IV (first 12 bytes) + encrypted payload + auth tag (remaining)
   - Import key from keyBase64Url
   - Decrypt with crypto.subtle.decrypt
   - Unpad plaintext via PADME unpad logic
   - Return plaintext string
8. `reveal.ts` displays plaintext in terminal-block component
9. Secret is now destroyed on server; re-accessing URL returns 404 (identical response for expired/viewed/nonexistent)

**Expiration Worker (Background):**

1. Runs every 5 minutes via node-cron
2. Calls `cleanExpiredSecrets()` from `expiration-worker.ts`
3. Two-step bulk operation:
   - UPDATE secrets SET ciphertext = '0' WHERE expiresAt <= NOW
   - DELETE FROM secrets WHERE expiresAt <= NOW
4. Returns deletedCount; logs only count (never logs secret IDs per SECR-09)

**Authentication Flow (Phase 22):**

1. Anonymous users access `/` (create page) without login
2. Authenticated users can access `/dashboard` (shows their shared secrets)
3. Login/Register pages route through `/api/auth/sign-up` and `/api/auth/sign-in` (Better Auth)
4. Email verification via link in verification email
5. Password reset via `/api/auth/forgot-password` and `/api/auth/reset-password`
6. Session token stored in HTTPOnly cookie; BetterAuth middleware populates `req.user`
7. GET /api/me returns authenticated user profile
8. Zero-Knowledge Invariant: req.user.id and secretId NEVER combined in logs/events/DB records

**State Management:**

- **Client-side routing state:** SPA router maintains page state in memory + History API; no persistent state except localStorage for theme preference
- **Authentication state:** BetterAuth session cookies + server-side session table; authenticated requests include session token
- **Theme state:** localStorage key 'theme' (light/dark/system); FOWT prevention script in `client/index.html` applies theme before DOM renders
- **Secret state:** Immutable; deleted on first retrieval (no edit operations)

## Key Abstractions

**Encryption Abstraction:**
- Purpose: Encapsulate all Web Crypto operations into a clean public API
- Examples: `client/src/crypto/index.ts`, `encrypt.ts`, `decrypt.ts`, `keys.ts`
- Pattern: Barrel export (index.ts) exposes only public functions; internal utilities (padding.ts, encoding.ts) are implementation details
- Security Invariant: The crypto module is the ONLY code that imports crypto.subtle or crypto.getRandomValues

**Service Abstraction:**
- Purpose: Isolate business logic from HTTP routing and middleware concerns
- Examples: `server/src/services/secrets.service.ts`, `password.service.ts`, `email.service.ts`
- Pattern: Pure async functions that take primitive types (strings, dates) and return typed objects; no req/res handling
- Benefit: Enables reuse across routes and background workers (e.g., cleanExpiredSecrets used by both route and expiration-worker)

**Type Contracts (Shared):**
- Purpose: Single source of truth for API request/response shapes and validation
- Examples: `shared/types/api.ts` (Zod schemas: CreateSecretSchema, SecretIdParamSchema, VerifySecretSchema)
- Pattern: Zod objects → exported to both client (for typesafe fetch wrapper) and server (for middleware validation)
- Benefit: Client type-checks API calls; server enforces requests match schema before business logic runs

**Rate Limiter Abstraction:**
- Purpose: Factory functions that return fresh middleware instances per app, with optional Redis backing
- Examples: `createSecretLimiter(redisClient?)`, `verifySecretLimiter(redisClient?)`
- Pattern: RedisStore when REDIS_URL provided; MemoryStore fallback; passOnStoreError=true for availability
- Benefit: Multi-instance deployments share limits via Redis; single-instance development uses in-memory store

**Router Abstraction:**
- Purpose: Decouple page rendering from URL state; provide programmatic navigation with SEO metadata
- Examples: `navigate(path)`, `updatePageMeta(meta)`, `handleRoute()`
- Pattern: History API with dynamic imports; routes map to page renderer functions that build DOM
- Benefit: Code-splitting via Vite; SEO meta tags updated per-navigation; no framework dependency

## Entry Points

**Browser Entry:**
- Location: `client/index.html`
- Triggers: User opens https://secureshare.app
- Responsibilities:
  - Render initial HTML shell with SEO meta tags (JSON-LD, OG, Twitter)
  - Include FOWT prevention script that applies theme from localStorage before DOM renders
  - Include `__CSP_NONCE__` placeholder for per-request nonce injection by server
  - Reference app.ts via script tag

**Client App Entry:**
- Location: `client/src/app.ts`
- Triggers: DOMContentLoaded event
- Responsibilities:
  1. Import CSS (Tailwind)
  2. Initialize theme listener via `initThemeListener()`
  3. Create layout shell (header, footer, dot-grid) via `createLayoutShell()`
  4. Initialize SPA router via `initRouter()`

**Server App Entry:**
- Location: `server/src/server.ts`
- Triggers: `npm run dev:server` or container startup
- Responsibilities:
  1. Import and build Express app via `buildApp()`
  2. Start HTTP listener on PORT env var
  3. Start expiration worker via `startExpirationWorker()`
  4. Install signal handlers (SIGTERM/SIGINT) to gracefully shutdown

**API Entry Points:**
- POST /api/secrets → `createSecretsRouter` → creates route instance with rate limiter → `secrets.ts` route handler
- GET /api/secrets/:id → `retrieveAndDestroy()` service
- GET /api/secrets/:id/meta → `getSecretMeta()` service
- POST /api/secrets/:id/verify → `verifyAndRetrieve()` service
- GET /api/health → health check (no auth required)
- /api/auth/{*splat} → Better Auth handler (email/password, OAuth2)
- GET /api/me → authenticated user info (requires auth session)
- GET {*path} → SPA catch-all (serves index.html with CSP nonce injected)

## Error Handling

**Strategy:** Defense-in-depth with consistent error responses to prevent enumeration

**Patterns:**

1. **Secret Unavailability (SECR-07 anti-enumeration):**
   - Nonexistent ID, expired secret, already-viewed secret, wrong password, password attempts exceeded
   - All return identical response: `{ error: 'not_found', message: 'This secret does not exist, has already been viewed, or has expired.' }`
   - HTTP Status: 404
   - Prevents attacker from distinguishing between scenarios

2. **Validation Errors:**
   - Zod schema mismatch (body or params)
   - HTTP Status: 400
   - Response: `{ error: 'validation_error', details: { ... } }` with flattened Zod errors

3. **Rate Limiting:**
   - POST /api/secrets: 10 per hour per IP (1000 in E2E tests)
   - POST /api/secrets/:id/verify: 5 attempts per secret before auto-destroy
   - HTTP Status: 429
   - Response: `{ error: 'rate_limited', message: '...' }`

4. **Crypto Errors:**
   - Wrong key or tampered ciphertext in decrypt()
   - Error message: `'Decryption failed: invalid key or corrupted data'` (generic, no internals exposed)
   - No stack trace leaked to browser

5. **Authentication Errors:**
   - Missing/invalid session token
   - HTTP Status: 401 (Unauthorized)
   - Better Auth handles response shape

6. **Password Wrong (POST /api/secrets/:id/verify):**
   - HTTP Status: 401 (Unauthorized)
   - Response: `{ error: 'wrong_password', attemptsRemaining: N }`
   - Increments passwordAttempts counter; returns null (404 response) if >= 3

7. **Global Error Handler:**
   - Location: `server/src/middleware/error-handler.ts`
   - Catches all middleware/route errors
   - Never exposes stack traces to client
   - Logs error with Pino (secret IDs redacted)
   - Returns appropriate HTTP status + generic error message

## Cross-Cutting Concerns

**Logging:**
- Framework: Pino (structured JSON logging)
- Location: `server/src/middleware/logger.ts`
- Redaction: Secret IDs redacted via regex `/\/api\/secrets\/[A-Za-z0-9_-]+/g` → `[REDACTED]`
- Level: Configurable via LOG_LEVEL env var (default: info)
- Serializers: Custom serializers for req (method, redacted URL) to prevent sensitive header/body logging
- Zero-Knowledge: Never logs userId + secretId together; app logs secrets.user_id as nullable FK

**Validation:**
- Framework: Zod
- Locations:
  - API schemas: `shared/types/api.ts` (CreateSecretSchema, SecretIdParamSchema, VerifySecretSchema)
  - Environment: `server/src/config/env.ts` (EnvSchema for DATABASE_URL, REDIS_URL, auth secrets, etc.)
  - Middleware: `server/src/middleware/validate.ts` (validateBody, validateParams factories)
- Pattern: safeParse → respond 400 with flattened errors if validation fails

**Authentication:**
- Framework: BetterAuth
- Features: Email/password, OAuth2 (Google, GitHub), email verification, password reset
- Session Storage: PostgreSQL `sessions` table; session token in HTTPOnly cookie
- Server Reads: `req.user` populated by Better Auth middleware for protected routes
- Zero-Knowledge: Session.userId and secret.id NEVER combined in logs/events/DB records (enforced in schema.ts block comment)

**Encryption:**
- Framework: Web Crypto API (native, no third-party libraries)
- Algorithm: AES-256-GCM
- Key Gen: crypto.subtle.generateKey (256-bit)
- IV Gen: crypto.getRandomValues (96-bit, fresh per encryption)
- Transport: Base64-encoded; IV prepended to ciphertext
- Decryption: Fails generically if key wrong or ciphertext tampered

**CSP (Content Security Policy):**
- Per-request nonce generation: `server/src/middleware/security.ts` → cspNonceMiddleware
- Nonce insertion: `app.ts` injects res.locals.cspNonce into HTML template via replaceAll
- Directives: script-src/style-src require nonce; no unsafe-inline or unsafe-eval; img/font/connect restricted
- Vite Build: Tailwind CSS + Lucide icons loaded via nonce (no external CDN)

---

*Architecture analysis: 2026-02-20*
