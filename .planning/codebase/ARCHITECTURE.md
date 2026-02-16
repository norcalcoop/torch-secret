# Architecture

**Analysis Date:** 2026-02-16

## Pattern Overview

**Overall:** Zero-trust client-server with end-to-end encryption

**Key Characteristics:**
- Server is untrusted storage that handles only encrypted ciphertext blobs and metadata
- All encryption/decryption occurs in the browser using Web Crypto API (AES-256-GCM)
- Two trust boundaries: Browser vs. Server, Server vs. Database
- Atomic read-and-destroy operations ensure one-time secret access
- Secrets are destroyed via zero-then-delete pattern to mitigate data remanence
- Password hashing (Argon2id) happens server-side with constant-time verification

## Layers

**Client Crypto Layer:**
- Purpose: Browser-side encryption/decryption with Web Crypto API (AES-256-GCM)
- Location: `client/src/crypto/`
- Contains: Key generation, encryption, decryption, PADME padding, base64 encoding
- Depends on: Web Crypto API only (no third-party crypto libraries)
- Used by: Client pages (`client/src/pages/`)
- Critical Invariants: Fresh 256-bit key + fresh 96-bit IV per encryption, PADME padding prevents length leakage, no Math.random

**Client Presentation Layer:**
- Purpose: Vanilla TypeScript UI with client-side routing (no React)
- Location: `client/src/pages/`, `client/src/components/`, `client/src/router.ts`
- Contains: SPA router, page modules (create, reveal, confirmation, error), reusable components
- Depends on: Crypto layer, API client, Lucide icons
- Used by: End users
- Pattern: History API routing with dynamic imports for code splitting, state-based transitions within pages

**Client API Layer:**
- Purpose: Typed fetch wrapper for server communication
- Location: `client/src/api/client.ts`
- Contains: API functions that send encrypted ciphertext to server, receive encrypted responses
- Depends on: Shared types (`shared/types/api.ts`)
- Used by: Client pages
- Critical: Never caches GET responses (secrets are destroyed atomically)

**Server HTTP Layer:**
- Purpose: Express 5 REST API with security middleware
- Location: `server/src/app.ts`, `server/src/server.ts`, `server/src/routes/`
- Contains: Route handlers, middleware (security, validation, rate limiting, error handling)
- Depends on: Services layer, shared types
- Used by: Client API layer
- Pattern: Factory function (`buildApp()`) creates Express app for testability

**Server Middleware Pipeline:**
- Purpose: Cross-cutting concerns (security headers, logging, validation, error handling)
- Location: `server/src/middleware/`
- Contains: `security.ts` (helmet, CSP, HTTPS redirect), `logger.ts` (pino with secret ID redaction), `validate.ts` (Zod), `rate-limit.ts` (express-rate-limit + Redis), `error-handler.ts`
- Order: trust proxy → HTTPS redirect → CSP nonce → helmet → logger → JSON parser → routes → error handler

**Server Service Layer:**
- Purpose: Business logic for secret lifecycle and password verification
- Location: `server/src/services/`
- Contains: `secrets.service.ts` (CRUD with atomic transactions), `password.service.ts` (Argon2id hashing)
- Depends on: Database layer, Argon2
- Used by: Route handlers
- Critical: All secret retrievals use database transactions to ensure atomicity

**Server Database Layer:**
- Purpose: PostgreSQL connection and schema definition via Drizzle ORM
- Location: `server/src/db/`
- Contains: `connection.ts` (pg Pool + Drizzle), `schema.ts` (secrets table definition)
- Depends on: PostgreSQL 17+
- Used by: Service layer
- Pattern: Drizzle ORM with explicit pg Pool (not Drizzle's built-in connection)

**Server Background Workers:**
- Purpose: Scheduled cleanup of expired secrets
- Location: `server/src/workers/expiration-worker.ts`
- Contains: node-cron job that runs cleanup queries
- Depends on: Database layer
- Used by: Server startup (`server.ts`)
- Pattern: Started on server boot, stopped on graceful shutdown

**Shared Types Layer:**
- Purpose: API contracts shared between client and server
- Location: `shared/types/api.ts`
- Contains: Zod schemas for request/response validation, TypeScript interfaces
- Used by: Both client and server
- Pattern: Zod 4.x schemas with TypeScript types inferred via `z.infer`

## Data Flow

**Secret Creation Flow:**

1. User enters plaintext in `client/src/pages/create.ts`
2. Page calls `encrypt()` from `client/src/crypto/encrypt.ts`
   - Generates fresh 256-bit AES-GCM key
   - Generates fresh 96-bit IV
   - PADME-pads plaintext
   - Encrypts and returns ciphertext + key (base64url)
3. Page calls `createSecret()` from `client/src/api/client.ts`
   - POSTs ciphertext to `/api/secrets` (server never sees plaintext or key)
4. Server route `POST /api/secrets` in `server/src/routes/secrets.ts`
   - Validates body with Zod schema
   - Calls `createSecret()` in `server/src/services/secrets.service.ts`
5. Service inserts ciphertext + metadata into PostgreSQL via Drizzle
6. Server responds with secret ID and expiration timestamp
7. Page navigates to `client/src/pages/confirmation.ts`
   - Displays shareable URL with secret ID and key fragment: `/secret/{id}#key`

**Secret Retrieval Flow:**

1. User navigates to `/secret/{id}#key`
2. Router (`client/src/router.ts`) matches path and loads `client/src/pages/reveal.ts`
3. Page extracts secret ID from URL path and key from URL fragment (never sent to server)
4. Page calls `getSecretMeta()` to check if password required (non-destructive)
5. If no password: page calls `getSecret(id)` from `client/src/api/client.ts`
   - GETs `/api/secrets/{id}`
6. Server route `GET /api/secrets/:id` in `server/src/routes/secrets.ts`
   - Calls `retrieveAndDestroy(id)` in `server/src/services/secrets.service.ts`
7. Service executes atomic transaction: SELECT → zero ciphertext → DELETE
   - Returns null if expired, already viewed, password-protected, or nonexistent
8. Server responds with ciphertext (or 404 for all failure cases)
9. Page calls `decrypt()` from `client/src/crypto/decrypt.ts`
   - Imports key from URL fragment
   - Decrypts ciphertext
   - Strips PADME padding
10. Page displays plaintext to user (secret is now destroyed server-side)

**Password-Protected Flow:**

1. After step 4 above, if password required: page displays password input
2. User enters password
3. Page calls `verifySecretPassword(id, password)` from `client/src/api/client.ts`
   - POSTs password to `/api/secrets/{id}/verify`
4. Server route `POST /api/secrets/:id/verify` in `server/src/routes/secrets.ts`
   - Calls `verifyAndRetrieve(id, password)` in `server/src/services/secrets.service.ts`
5. Service executes atomic transaction:
   - SELECTs secret
   - Verifies password with Argon2 (constant-time) via `password.service.ts`
   - On success: zero ciphertext → DELETE → return ciphertext
   - On failure: increment attempt counter OR auto-destroy if max attempts reached
6. Server responds with ciphertext (success) or 403 with attempts remaining (wrong password)
7. Page decrypts and displays plaintext (or shows error with retry count)

**State Management:**
- No global state management library (React/Redux/Zustand not used)
- State is ephemeral within page modules (function-scoped)
- URL is the source of truth (secret ID in path, key in fragment)
- Confirmation page uses in-memory state transition (no URL change)

## Key Abstractions

**EncryptResult:**
- Purpose: Return type from encrypt() containing ciphertext, key object, and base64url key string
- Examples: `client/src/crypto/types.ts`
- Pattern: Typed object with Web Crypto CryptoKey (non-extractable, encrypt-only for defense-in-depth)

**EncryptedPayload:**
- Purpose: Wire format for encrypted data (ciphertext as base64 string)
- Examples: `client/src/crypto/types.ts`
- Pattern: Plain object for JSON serialization

**Secret (database row):**
- Purpose: Drizzle-inferred type from secrets table schema
- Examples: `server/src/db/schema.ts`
- Pattern: `typeof secrets.$inferSelect` (Drizzle ORM inference)

**API Request/Response Types:**
- Purpose: Contract between client and server with Zod validation
- Examples: `shared/types/api.ts` (CreateSecretSchema, SecretResponse, etc.)
- Pattern: Zod schemas with TypeScript interfaces via `z.infer`

**Atomic Transaction Pattern:**
- Purpose: Ensure secret retrieval is one-time-only (read + destroy in single transaction)
- Examples: `retrieveAndDestroy()`, `verifyAndRetrieve()` in `server/src/services/secrets.service.ts`
- Pattern: SELECT → UPDATE (zero ciphertext) → DELETE within `db.transaction()`

**ApiError:**
- Purpose: Custom error class for API failures with HTTP status and body
- Examples: `client/src/api/client.ts`
- Pattern: Extends Error, includes status code and response body for client error handling

## Entry Points

**Client Entry Point:**
- Location: `client/src/app.ts`
- Triggers: DOMContentLoaded event
- Responsibilities: Initialize theme listener, create layout shell (header/footer), initialize SPA router
- Pattern: Imports CSS (Tailwind), then calls init functions

**Server Entry Point:**
- Location: `server/src/server.ts`
- Triggers: Node.js process start
- Responsibilities: Build Express app, start HTTP server, start expiration worker, register graceful shutdown handlers
- Pattern: Factory pattern for app creation, signal handlers for SIGTERM/SIGINT

**Router:**
- Location: `client/src/router.ts`
- Triggers: DOMContentLoaded (initial), popstate (browser back/forward), `navigate()` calls (programmatic)
- Responsibilities: Match URL path to page module, dynamic import page chunk, render into `#app` container, update document.title and meta tags
- Pattern: History API with dynamic imports for code splitting

**App Factory:**
- Location: `server/src/app.ts` (`buildApp()` function)
- Triggers: Called by `server.ts` and test files
- Responsibilities: Construct Express app with full middleware pipeline, mount routes, serve static assets (production)
- Pattern: Factory returns configured app instance (enables testing without port conflicts)

## Error Handling

**Strategy:** Defensive error handling with anti-enumeration guards

**Patterns:**
- Client: ApiError with status + body, try-catch in async functions, user-facing error messages in UI
- Server: Global error handler middleware (always last), identical 404 responses for all "secret unavailable" cases (nonexistent, expired, already viewed, password-protected)
- Crypto: No error handling (operations are infallible given valid inputs, Zod validates inputs upstream)
- Validation: Zod parse errors caught by validate middleware, returns 400 with validation details
- Rate limiting: 429 response with Retry-After header
- Database: Transaction rollback on failure, service layer returns null (not exceptions)
- Logging: pino logger with secret ID redaction via regex, never logs PII/IP addresses

## Cross-Cutting Concerns

**Logging:** pino + pino-http with secret ID redaction (`/[a-zA-Z0-9_-]{21}/g → [redacted]`), structured JSON logs, log level from `LOG_LEVEL` env var

**Validation:** Zod schemas validated via `validateBody()` and `validateParams()` middleware, returns 400 on failure

**Authentication:** Not applicable (no user accounts, secrets are accessed via unguessable 21-char nanoid)

**Authorization:** Implicit via secret ID + URL fragment (key never reaches server)

**Security Headers:** helmet middleware with custom CSP (nonce-based scripts, strict defaults), HSTS, X-Frame-Options, Referrer-Policy

**Rate Limiting:** express-rate-limit with optional Redis store (distributed), separate limits for create (10/hour) and verify (3/10min)

**HTTPS Enforcement:** Middleware redirects HTTP → HTTPS in production (checks `req.secure` which respects trust proxy setting)

**CSP Nonce:** Per-request nonce generated before helmet, injected into HTML template at runtime

**Graceful Shutdown:** SIGTERM/SIGINT handlers close HTTP server, stop expiration worker, drain database pool

**SEO:** SPA router updates document.title, meta description, canonical link, and robots directive on every route change; secret routes set noindex and swap OG tags to generic branding

---

*Architecture analysis: 2026-02-16*
