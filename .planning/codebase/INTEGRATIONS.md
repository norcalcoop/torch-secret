# External Integrations

**Analysis Date:** 2026-02-14

## APIs & External Services

**None Integrated:**
- No external API services currently integrated
- No third-party SDKs in use
- Self-contained application with no external dependencies

## Data Storage

**Databases:**
- PostgreSQL 17+
  - Connection: `DATABASE_URL` environment variable
  - Client: node-postgres (`pg` 8.18.0)
  - ORM: Drizzle ORM 0.45.1
  - Schema: `server/src/db/schema.ts`
  - Connection pool: `server/src/db/connection.ts`

**Table Schema:**
- `secrets` table:
  - `id` (text, primary key) - 21-char nanoid
  - `ciphertext` (text, not null) - Base64-encoded encrypted blob
  - `expires_at` (timestamp with timezone, not null)
  - `created_at` (timestamp with timezone, not null, default now)
  - `password_hash` (text, nullable) - For Phase 5
  - `password_attempts` (integer, not null, default 0) - For Phase 5

**File Storage:**
- None - All data stored in PostgreSQL

**Caching:**
- Redis 7.x (planned for Phase 3)
  - Purpose: Rate limiting storage
  - Client: ioredis (planned, not yet installed)
  - Not yet configured

## Authentication & Identity

**Auth Provider:**
- None - No user authentication required
- No signup, no login, no sessions
- Zero-knowledge design: server never identifies users

## Monitoring & Observability

**Error Tracking:**
- None - No external error tracking service integrated

**Logs:**
- Structured JSON logging via Pino
  - Location: stdout (configurable via LOG_LEVEL env var)
  - Privacy: Secret IDs, ciphertext, and PII are redacted
  - Format: JSON in production, pretty-printed in development (pino-pretty)

## CI/CD & Deployment

**Hosting:**
- Not yet configured
- HTTPS enforcement planned for Phase 3

**CI Pipeline:**
- None - No automated CI/CD configured

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string (format: `postgresql://user:password@host:port/database`)
- `PORT` - HTTP server port (default: 3000)
- `LOG_LEVEL` - Pino log level (fatal/error/warn/info/debug/trace, default: info)
- `NODE_ENV` - Environment mode (development/production/test, default: development)

**Secrets location:**
- `.env` file (not committed, example in `.env.example`)
- No secrets management service integrated

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Security Architecture

**Zero-Knowledge Design:**
- Encryption keys never reach the server (URL fragment only, per RFC 3986)
- Server stores only encrypted ciphertext blobs
- No analytics, no tracking, no telemetry
- No external JavaScript (planned CSP in Phase 3)

**Data Flow:**
1. Client encrypts plaintext using Web Crypto API → generates base64 ciphertext
2. Client POSTs ciphertext to `/api/secrets` → server stores in PostgreSQL
3. Server returns secret ID → client constructs shareable URL with key in fragment
4. Recipient GETs `/api/secrets/:id` → server atomically deletes and returns ciphertext
5. Client decrypts ciphertext using key from URL fragment → displays plaintext

**No Third-Party Dependencies:**
- All crypto operations use browser-native Web Crypto API
- No external CDNs, no third-party scripts
- Minimal attack surface by design

---

*Integration audit: 2026-02-14*
