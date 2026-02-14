# Architecture

**Analysis Date:** 2026-02-14

## Pattern Overview

**Overall:** Three-tier architecture with strict security boundaries

**Key Characteristics:**
- Client-side encryption with zero-knowledge server design
- Service layer pattern on backend (routes delegate to services)
- Shared type contracts between client and server via `shared/types/`
- Database access abstracted through Drizzle ORM
- Transaction-based atomic operations for one-time secret destruction

## Layers

**Client Crypto Layer:**
- Purpose: All encryption and decryption operations for zero-knowledge design
- Location: `client/src/crypto/`
- Contains: AES-256-GCM encryption/decryption, key generation, PADME padding, encoding utilities
- Depends on: Web Crypto API (`crypto.subtle`), browser APIs only
- Used by: Client application pages (future Phase 4)
- Security: Only layer that touches plaintext; server never receives unencrypted data or keys

**Shared Types Layer:**
- Purpose: Contract definitions ensuring type safety across client/server boundary
- Location: `shared/types/`
- Contains: Zod schemas (`CreateSecretSchema`, `SecretIdParamSchema`), TypeScript interfaces for API requests/responses
- Depends on: Zod validation library
- Used by: Server routes (validation), client API calls (future)
- Security: Enforces ciphertext max size (200KB) preventing abuse

**Server Routes Layer:**
- Purpose: HTTP request handling and response formatting
- Location: `server/src/routes/`
- Contains: Express routers with thin endpoint handlers
- Depends on: Middleware (validation, logging, error handling), service layer
- Used by: Express app (`server/src/app.ts`)
- Security: Identical error responses for all "not available" cases prevent enumeration attacks (SECR-07)

**Server Middleware Layer:**
- Purpose: Cross-cutting request/response processing
- Location: `server/src/middleware/`
- Contains: Validation (`validateBody`, `validateParams`), HTTP logging (pino-http), error handling
- Depends on: Zod schemas from shared types, pino logger
- Used by: Express app and routes
- Security: Redacts secret IDs from logs using regex pattern, strips Authorization/Cookie headers from logs

**Server Service Layer:**
- Purpose: Business logic and database operations
- Location: `server/src/services/`
- Contains: `createSecret()`, `retrieveAndDestroy()` with atomic transaction pattern
- Depends on: Database connection, Drizzle ORM, schema definitions
- Used by: Route handlers
- Security: Three-step transaction (SELECT → ZERO → DELETE) mitigates data remanence in PostgreSQL WAL

**Database Layer:**
- Purpose: PostgreSQL data persistence via Drizzle ORM
- Location: `server/src/db/`
- Contains: Schema definitions (`schema.ts`), connection pool (`connection.ts`), migrations (`migrate.ts`)
- Depends on: PostgreSQL client (pg), Drizzle ORM
- Used by: Service layer
- Security: Stores only encrypted ciphertext, never plaintext; nanoid-based IDs prevent enumeration

**Configuration Layer:**
- Purpose: Environment-based runtime configuration
- Location: `server/src/config/`
- Contains: `env.ts` with Zod-validated environment variables
- Depends on: dotenv, Zod
- Used by: All server modules requiring configuration
- Security: Validates DATABASE_URL format and required env vars on startup

## Data Flow

**Secret Creation Flow:**

1. Client crypto module encrypts plaintext → generates ciphertext + key
2. Client sends POST `/api/secrets` with `{ ciphertext, expiresIn }`
3. Middleware validates request body against `CreateSecretSchema`
4. Route handler calls `createSecret(ciphertext, expiresIn)` service
5. Service calculates `expiresAt` timestamp from duration
6. Drizzle ORM inserts row into `secrets` table, generates nanoid
7. Service returns `Secret` row with `{ id, expiresAt, createdAt }`
8. Route responds 201 with `{ id, expiresAt }` JSON
9. Client constructs shareable URL: `https://host/reveal#base64key`

**Secret Retrieval Flow:**

1. Client extracts secret ID from URL path and key from fragment (`#key`)
2. Client sends GET `/api/secrets/:id`
3. Middleware validates `:id` param (21-char nanoid)
4. Route handler calls `retrieveAndDestroy(id)` service
5. Service executes transaction: SELECT secret → UPDATE ciphertext to zeros → DELETE row
6. If secret not found/expired, service returns `null`
7. Route responds 404 with identical error for all "not available" cases OR 200 with `{ ciphertext, expiresAt }`
8. Client crypto module decrypts ciphertext using key from URL fragment
9. Client displays plaintext; secret is permanently destroyed on server

**State Management:**
- Server is stateless; no session or in-memory caching
- Database is single source of truth for secret lifecycle
- URL fragment (`#key`) carries encryption key; never sent to server per HTTP spec
- One-time access enforced by atomic DELETE transaction

## Key Abstractions

**EncryptResult (Client):**
- Purpose: Encapsulates encryption output
- Examples: `client/src/crypto/types.ts`
- Pattern: Return object with `payload` (ciphertext), `key` (CryptoKey), `keyBase64Url` (exportable key)
- Usage: Returned by `encrypt()`, consumed by client application to build shareable URL

**Secret (Database Row):**
- Purpose: Represents stored encrypted secret with metadata
- Examples: `server/src/db/schema.ts` (line 35)
- Pattern: Drizzle ORM `$inferSelect` type from `secrets` table schema
- Usage: Returned by service layer, contains `id`, `ciphertext`, `expiresAt`, `createdAt`, `passwordHash`, `passwordAttempts`

**Router (Express):**
- Purpose: Groups related HTTP endpoints
- Examples: `server/src/routes/secrets.ts` (`secretsRouter`)
- Pattern: Express `Router()` with middleware chain and async handlers
- Usage: Mounted at `/api/secrets` in `app.ts`, delegates to service layer

**Middleware Factory:**
- Purpose: Configurable request processing functions
- Examples: `validateBody(schema)`, `validateParams(schema)` in `server/src/middleware/validate.ts`
- Pattern: Higher-order function returning Express middleware `(req, res, next) => void`
- Usage: Applied per-route for validation; returns 400 on schema mismatch

## Entry Points

**Server Entry Point:**
- Location: `server/src/server.ts`
- Triggers: `npm run dev:server` (tsx watch), production start
- Responsibilities: Build Express app via `buildApp()`, start HTTP server on PORT, register graceful shutdown handlers (SIGTERM/SIGINT) to close server and database pool

**App Factory:**
- Location: `server/src/app.ts`
- Triggers: Called by `server.ts` and test files
- Responsibilities: Construct Express app without starting server (enables supertest), register middleware (logger, JSON body parser, routes, error handler), return configured app instance

**Crypto Module Entry:**
- Location: `client/src/crypto/index.ts`
- Triggers: Imported by client application code
- Responsibilities: Barrel export exposing public API (`encrypt`, `decrypt`, key functions), hide internal utilities (encoding, padding)

**Database Migration:**
- Location: `server/src/db/migrate.ts`
- Triggers: `npm run db:migrate` (manual)
- Responsibilities: Apply SQL migrations from `drizzle/migrations/`, create/update tables, close pool on completion

## Error Handling

**Strategy:** Layered error handling with security-aware logging and uniform client responses

**Patterns:**
- **Validation Errors (400):** Zod schema failures in `validateBody`/`validateParams` return structured error with `error: 'validation_error'` and flattened details
- **Not Found Errors (404):** Service layer returns `null` for missing/expired/consumed secrets; route handler maps to identical response preventing enumeration: `{ error: 'not_found', message: 'This secret does not exist, has already been viewed, or has expired.' }`
- **Unhandled Errors (500):** Global error handler in `middleware/error-handler.ts` catches all exceptions, logs error with stack trace (no request details), returns generic `{ error: 'internal_error', message: 'An unexpected error occurred.' }`
- **Decryption Errors (Client):** Crypto module catches `DOMException` from `crypto.subtle.decrypt()`, throws generic `Error('Decryption failed: invalid key or corrupted data')` to prevent key enumeration

## Cross-Cutting Concerns

**Logging:** Structured JSON logging via pino/pino-http; secret IDs redacted from URLs using regex `/\/api\/secrets\/[A-Za-z0-9_-]+/g`; Authorization/Cookie headers redacted; no request/response bodies logged

**Validation:** All request inputs validated using Zod schemas from `shared/types/api.ts`; middleware short-circuits invalid requests with 400; parsed data replaces raw `req.body` for type safety

**Authentication:** Not implemented (Phase 2 complete, no user accounts); password protection planned for Phase 5 with Argon2id hashing

**Database Transactions:** Drizzle ORM transactions (`db.transaction()`) ensure atomic operations; used in `retrieveAndDestroy()` for SELECT-ZERO-DELETE sequence to prevent race conditions

**Security Headers:** Not yet implemented (planned for Phase 3 hardening with helmet.js, CSP, CORS)

**Rate Limiting:** Not yet implemented (planned for Phase 3 with express-rate-limit + Redis)

---

*Architecture analysis: 2026-02-14*
