# External Integrations

**Analysis Date:** 2026-02-16

## APIs & External Services

**None.**

SecureShare has zero external API integrations. All functionality is self-contained:
- No third-party SDKs (Stripe, SendGrid, Twilio, etc.)
- No external authentication providers (Auth0, Firebase, etc.)
- No cloud storage (S3, Cloudflare R2, etc.)
- No analytics or tracking (Google Analytics, Mixpanel, etc.)
- No error monitoring SaaS (Sentry, Rollbar, etc.)

**Client-server communication:**
- Internal REST API only: `/api/secrets` endpoints
- Client: `client/src/api/client.ts` (typed fetch wrapper)
- Server: `server/src/routes/secrets.ts` (Express router)

## Data Storage

**Databases:**
- PostgreSQL 17+
  - Connection: `DATABASE_URL` env var (format: `postgresql://user:password@localhost:5432/secureshare`)
  - Client: `pg` 8.18.0 with connection pooling (`server/src/db/connection.ts`)
  - ORM: Drizzle ORM 0.45.1 (`drizzle-orm/node-postgres`)
  - Schema: `server/src/db/schema.ts` (single table: `secrets`)
  - Migrations: `drizzle/` directory (generated via `drizzle-kit generate`)

**File Storage:**
- Local filesystem only (built frontend assets in `client/dist/`)
- No uploads, no user-generated files
- Static assets served via `express.static` in production

**Caching:**
- Optional: Redis (ioredis 5.9.3)
  - Connection: `REDIS_URL` env var (format: `redis://localhost:6379`)
  - Purpose: Distributed rate limiting state across multiple server instances
  - Not required for single-instance deployments (falls back to in-memory store)
  - Implementation: `server/src/middleware/rate-limit.ts` (RedisStore adapter)

## Authentication & Identity

**Auth Provider:**
- None (no user accounts, no authentication)

**Implementation:**
- Zero-knowledge architecture: secrets identified by random nanoid (21-char URL-safe)
- Optional password protection: Argon2id hash stored in `secrets.passwordHash` column
- Password verification in `server/src/services/password.service.ts` (no external auth service)

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Rollbar, or similar SaaS)

**Logs:**
- Structured JSON logging via Pino 10.3.1
- HTTP request logs via `pino-http` 11.0.0 (`server/src/middleware/logger.ts`)
- Custom redaction: secret IDs stripped from logs (SECR-09 security requirement)
- Output: stdout (formatted with `pino-pretty` in dev, JSON in production)
- No external log aggregation (Datadog, LogDNA, etc.)

## CI/CD & Deployment

**Hosting:**
- Not yet configured (local development only)
- Target: Platform with Node.js 24.x LTS, PostgreSQL 17+, and HTTPS support
- Expected: Reverse proxy with `X-Forwarded-Proto` header (Express trust proxy enabled)

**CI Pipeline:**
- None (no GitHub Actions, CircleCI, etc. configured)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:password@host:port/db`)
- `PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Pino log level (enum: fatal, error, warn, info, debug, trace; default: info)
- `NODE_ENV` - Environment mode (enum: development, production, test; default: development)

**Optional env vars:**
- `REDIS_URL` - Redis connection string (format: `redis://host:port`; enables distributed rate limiting)

**Secrets location:**
- Local development: `.env` file (gitignored, loaded via `dotenv/config`)
- Production: Platform-specific secrets manager (not yet configured)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Browser APIs

**Required (client-side):**
- Web Crypto API (`crypto.subtle`) - AES-256-GCM encryption/decryption
  - Implementation: `client/src/crypto/` module
  - Operations: `generateKey`, `encrypt`, `decrypt`, `importKey`, `exportKey`
  - Used by: `client/src/crypto/keys.ts`, `encrypt.ts`, `decrypt.ts`
- `crypto.getRandomValues` - Cryptographically secure random number generation
  - Used for: IV generation, padding (PADME algorithm)
  - Implementation: `client/src/crypto/encrypt.ts`, `padding.ts`
- Fetch API - HTTP requests to internal `/api/secrets` endpoints
  - Implementation: `client/src/api/client.ts`
- Local Storage - Theme preference persistence (`localStorage.getItem('theme')`)
  - Implementation: `client/src/theme.ts`, FOWT prevention script in `client/index.html`

**Feature detection:**
- No polyfills included
- Noscript fallback in `client/index.html` (explains JS requirement)

---

*Integration audit: 2026-02-16*
