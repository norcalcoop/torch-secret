# Architecture Research

**Domain:** Zero-knowledge, client-side encrypted, one-time secret sharing web application
**Researched:** 2026-02-13
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
TRUST BOUNDARY: Browser (trusted with plaintext)
=================================================
 User enters               User receives link
 plaintext secret          with #fragment key
       |                          ^
       v                          |
 +-----------+             +-----------+
 | Crypto    |             | URL       |
 | Module    |             | Builder   |
 | (encrypt) |             |           |
 +-----+-----+             +-----+-----+
       |                          ^
       | encrypted blob           | secret_id
       | + IV                     |
       v                          |
=================================================
TRUST BOUNDARY: Network (HTTPS, fragment never sent)
=================================================
       |                          ^
       v                          |
 +----------------------------------+
 |         API Server               |
 |  - Receives encrypted blobs      |
 |  - Stores/retrieves by ID        |
 |  - Verifies passwords (bcrypt)   |
 |  - Enforces rate limits          |
 |  - Marks viewed / deletes        |
 |  - NEVER sees plaintext or key   |
 +--------+----------+--------------+
          |          |
          v          v
 +------------+  +----------+
 | PostgreSQL |  |  Redis   |
 | (secrets)  |  | (rates)  |
 +------------+  +----------+
          |
          v
 +-------------------+
 | Background Worker |
 | (expiration cron) |
 +-------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Crypto Module (browser)** | Key generation, AES-256-GCM encrypt/decrypt, base64 encoding | Web Crypto API (`SubtleCrypto`) -- native, no library needed |
| **URL Builder (browser)** | Construct `/s/[id]#[base64key]` links, parse fragments on retrieval | Vanilla JS, runs entirely client-side |
| **Frontend UI** | Create form, reveal page, password prompt, copy-to-clipboard, error states | Single-page app or server-rendered with client-side JS for crypto |
| **API Server** | REST endpoints for create/retrieve secrets, password verification, rate limiting middleware | Node.js/Express with JSON API |
| **PostgreSQL** | Persist encrypted blobs, IVs, metadata, password hashes, expiration timestamps | Single `secrets` table with indexes on `expires_at` |
| **Redis** | Rate limiting counters (sliding window per IP), optional session data | Standalone Redis, used only for ephemeral counters |
| **Background Worker** | Periodic deletion of expired secrets from PostgreSQL | Node.js cron job (node-cron or pg-boss) running `DELETE WHERE expires_at < NOW()` |

## Security Boundaries (Critical)

There are exactly **two trust boundaries** in this system. Getting these wrong breaks the entire security model.

### Boundary 1: Browser vs. Server

**Principle:** The server is untrusted storage. It handles encrypted blobs and metadata but NEVER touches plaintext or encryption keys.

| Crosses to Server | Never Crosses to Server |
|--------------------|--------------------------|
| Encrypted ciphertext blob | Plaintext secret |
| Initialization vector (IV) | AES-256-GCM encryption key |
| Secret ID (UUID) | URL fragment (`#base64key`) |
| Expiration timestamp | Any derivative of the key |
| Password hash (bcrypt, for password-protected secrets) | Raw password (hashed client-side or via PBKDF2) |
| View status metadata | |

**Why the URL fragment is central:** Per RFC 3986 Section 3.5, the fragment identifier (everything after `#`) is processed exclusively by the client and is never sent to the server in HTTP requests. This is the architectural foundation that makes zero-knowledge possible. The encryption key lives only in the URL fragment, which means the server never receives it, even in access logs.

### Boundary 2: Server vs. Database

**Principle:** PostgreSQL stores encrypted data at rest. Even a full database dump reveals nothing useful without the keys that live only in shared URLs.

| Stored in Database | Not Stored |
|--------------------|------------|
| `id` (VARCHAR) -- unique secret ID | Encryption key |
| `encrypted_data` (TEXT) -- AES-256-GCM ciphertext | Plaintext secret |
| `iv` (VARCHAR) -- initialization vector | URL fragment |
| `expires_at` (TIMESTAMP) | IP addresses (do not log) |
| `viewed` (BOOLEAN) | Access patterns |
| `password_hash` (VARCHAR, nullable) -- bcrypt hash | Raw passwords |
| `created_at` (TIMESTAMP) | |

## Data Flow

### Flow 1: Secret Creation (Sender)

```
1. User types plaintext into textarea
                |
2. Browser generates 256-bit random key
   crypto.getRandomValues(new Uint8Array(32))
                |
3. Browser generates 96-bit random IV
   crypto.getRandomValues(new Uint8Array(12))
                |
4. Browser encrypts plaintext with AES-256-GCM
   SubtleCrypto.encrypt({ name: "AES-GCM", iv }, key, plaintext)
                |
5. If password set: browser hashes password with bcrypt
   (or sends to server for bcrypt hashing -- see design choice below)
                |
6. Browser sends to API:
   POST /api/secrets
   {
     encrypted_data: base64(ciphertext),
     iv: base64(iv),
     expires_in: "24h",
     password_hash: "..." (optional)
   }
                |
7. Server generates UUID, stores record, returns { id: "abc123" }
                |
8. Browser constructs URL:
   https://secureshare.app/s/abc123#base64url(key)
                |
9. User copies URL and shares via any channel
```

### Flow 2: Secret Retrieval (Receiver)

```
1. Receiver clicks link:
   https://secureshare.app/s/abc123#Xk9mP2...
                |
2. Browser extracts:
   - secret_id = "abc123" (from path)
   - key = decode("Xk9mP2...") (from fragment -- never sent to server)
                |
3. If password-protected:
   GET /api/secrets/abc123/meta  --> { password_required: true }
   User enters password
   POST /api/secrets/abc123/verify  { password: "..." }
   Server checks bcrypt hash, returns encrypted data if match
                |
   If NOT password-protected:
   GET /api/secrets/abc123  --> { encrypted_data, iv }
                |
4. Server marks secret as viewed, deletes encrypted_data
   (atomic operation: read + delete in single transaction)
                |
5. Browser decrypts:
   SubtleCrypto.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
                |
6. Browser displays plaintext to user
                |
7. Subsequent requests to /api/secrets/abc123 return 404 or "destroyed"
```

### Flow 3: Expiration Cleanup (Background)

```
Every 5 minutes:
  1. Worker queries: SELECT id FROM secrets WHERE expires_at < NOW()
  2. Worker deletes: DELETE FROM secrets WHERE expires_at < NOW()
  3. Worker logs count (never log IDs or data)
```

### Flow 4: Password-Protected Secret (Detailed)

```
CREATION:
  Browser --> POST /api/secrets
  { encrypted_data, iv, password_hash: bcrypt(password, 12) }
  Server stores password_hash alongside encrypted blob

RETRIEVAL:
  Browser --> GET /api/secrets/:id/meta
  Server responds: { password_required: true, attempts_remaining: 3 }

  Browser --> POST /api/secrets/:id/verify
  { password: "user_entered_password" }

  Server:
    if bcrypt.compare(password, stored_hash):
      return { encrypted_data, iv }  // and delete
    else:
      increment attempt counter
      if attempts >= 3:
        DELETE secret (auto-destroy on brute force)
      return 401 { attempts_remaining: N }
```

## Recommended Project Structure

```
secureshare/
├── client/                    # Frontend application
│   ├── src/
│   │   ├── crypto/            # Encryption/decryption module
│   │   │   ├── encrypt.ts     # AES-256-GCM encrypt with Web Crypto API
│   │   │   ├── decrypt.ts     # AES-256-GCM decrypt
│   │   │   ├── keys.ts        # Key generation, base64url encode/decode
│   │   │   └── index.ts       # Public API for crypto module
│   │   ├── pages/             # Page components
│   │   │   ├── CreateSecret.tsx
│   │   │   ├── ViewSecret.tsx
│   │   │   ├── SecretCreated.tsx
│   │   │   └── NotFound.tsx
│   │   ├── components/        # Shared UI components
│   │   │   ├── CopyButton.tsx
│   │   │   ├── PasswordInput.tsx
│   │   │   └── ExpirationSelect.tsx
│   │   ├── api/               # API client functions
│   │   │   └── secrets.ts
│   │   └── App.tsx
│   └── public/
│       └── index.html
├── server/                    # Backend application
│   ├── src/
│   │   ├── routes/            # Express route handlers
│   │   │   └── secrets.ts     # POST /api/secrets, GET /api/secrets/:id
│   │   ├── middleware/        # Express middleware
│   │   │   ├── rateLimit.ts   # Redis-backed rate limiter
│   │   │   ├── security.ts    # CSP, CORS, HSTS headers
│   │   │   └── validate.ts    # Input validation/sanitization
│   │   ├── services/          # Business logic
│   │   │   ├── secrets.ts     # Create, retrieve, delete, verify password
│   │   │   └── cleanup.ts     # Expiration cleanup logic
│   │   ├── db/                # Database layer
│   │   │   ├── pool.ts        # PostgreSQL connection pool
│   │   │   ├── migrations/    # Schema migrations
│   │   │   └── queries.ts     # Parameterized SQL queries
│   │   ├── workers/           # Background jobs
│   │   │   └── expiration.ts  # Cron-based cleanup worker
│   │   └── app.ts             # Express app setup
│   └── index.ts               # Server entry point
├── shared/                    # Shared types/constants
│   └── types.ts               # SecretMetadata, CreateSecretRequest, etc.
└── docker-compose.yml         # PostgreSQL + Redis for local dev
```

### Structure Rationale

- **`client/src/crypto/`:** Isolate all cryptographic operations into a single module. This is the most security-critical code and should be auditable as a unit. No other module should import raw Web Crypto API -- everything goes through this module.
- **`server/src/services/`:** Business logic separated from HTTP handlers. The secrets service owns all database operations and password verification. Routes are thin wrappers.
- **`server/src/middleware/`:** Security headers, rate limiting, and validation applied as middleware layers. CSP headers are critical to prevent XSS from stealing decryption keys.
- **`shared/`:** TypeScript types shared between client and server ensure the API contract is enforced at compile time.
- **`server/src/workers/`:** Background job runs on a separate interval (not request-triggered) to clean up expired secrets.

## Architectural Patterns

### Pattern 1: Fragment-Based Key Distribution

**What:** Store the encryption key exclusively in the URL fragment (`#base64key`). The fragment is never sent to the server per HTTP specification (RFC 3986). The server only receives the path portion containing the secret ID.

**When to use:** Any zero-knowledge system where the server must not have access to decryption material.

**Trade-offs:**
- PRO: Eliminates key management complexity on server. Server literally cannot decrypt data.
- PRO: Simple for users -- just share a link.
- CON: If the URL is intercepted in its entirety (e.g., screen share, browser history, clipboard), the secret is compromised.
- CON: URL length limits (2048 chars in some contexts), though base64-encoded 256-bit keys are only ~44 chars.

**Example:**
```typescript
// Key generation and URL construction
async function createSecretUrl(secretId: string): Promise<{ url: string; key: CryptoKey }> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,  // extractable -- needed for URL embedding
    ["encrypt", "decrypt"]
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return {
    url: `${window.location.origin}/s/${secretId}#${keyBase64}`,
    key
  };
}
```

### Pattern 2: Atomic Read-and-Delete

**What:** The secret retrieval and deletion happen in a single database transaction. The server fetches the encrypted blob and immediately deletes (or marks viewed and nullifies the data) in one atomic operation. This prevents race conditions where two requests could read the same secret.

**When to use:** Any one-time-view secret system.

**Trade-offs:**
- PRO: Guarantees one-time access even under concurrent requests.
- PRO: Prevents TOCTOU (time-of-check-time-of-use) race conditions.
- CON: Slightly more complex than separate read/delete operations.

**Example:**
```sql
-- Atomic fetch-and-delete using DELETE ... RETURNING
DELETE FROM secrets
WHERE id = $1
  AND viewed = false
  AND expires_at > NOW()
RETURNING encrypted_data, iv, password_hash;
```

```typescript
// If password-protected, use UPDATE first to mark viewed, then return data
// Two-step: verify password, THEN atomic delete
async function retrieveSecret(id: string): Promise<SecretRow | null> {
  const result = await pool.query(
    `DELETE FROM secrets
     WHERE id = $1 AND viewed = false AND expires_at > NOW()
     RETURNING encrypted_data, iv`,
    [id]
  );
  return result.rows[0] || null;
}
```

### Pattern 3: Server-Side Password Gate, Client-Side Decryption

**What:** For password-protected secrets, the server verifies the password via bcrypt comparison before releasing the encrypted blob. The server never decrypts anything -- it only acts as a gatekeeper. The client then decrypts using the key from the URL fragment.

**When to use:** When adding an additional authentication layer on top of zero-knowledge encryption.

**Trade-offs:**
- PRO: Adds defense-in-depth: attacker needs both the URL and the password.
- PRO: Server can enforce attempt limits and auto-destroy on brute force.
- CON: Password must be transmitted to server for bcrypt verification (over HTTPS).
- CON: Two-phase retrieval adds latency and complexity.

**Design decision -- where to hash the password:**

| Option | Where bcrypt runs | Pros | Cons |
|--------|-------------------|------|------|
| **Server-side hash (recommended)** | Server hashes on create, compares on retrieve | Simpler client code, bcrypt is CPU-intensive and better suited for server | Password sent over HTTPS (acceptable) |
| Client-side hash | Browser hashes, sends hash to server | Password never leaves browser in plain text | bcrypt is slow in browser, blocks main thread, need bcrypt.js library |

**Recommendation:** Hash on the server. The password is already protected by HTTPS in transit. Server-side bcrypt with cost factor 12 is the standard approach used by OneTimeSecret, Yopass, and PrivateBin. Attempting bcrypt in the browser adds complexity and performance problems without meaningful security improvement (the server already sees only encrypted blobs it cannot decrypt).

### Pattern 4: Defense-in-Depth Security Headers

**What:** Apply strict Content Security Policy and other security headers to prevent XSS attacks that could steal encryption keys from the DOM/memory.

**When to use:** Always. This is non-negotiable for any application handling encryption keys in the browser.

**CSP is critical because:** If an attacker injects JavaScript via XSS, that script runs in the same origin and can read the URL fragment, extract the decryption key, and exfiltrate it. A strict CSP prevents script injection in the first place.

**Example:**
```typescript
// Security headers middleware
app.use((req, res, next) => {
  // Strict CSP: no inline scripts, no eval, no external scripts
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +          // No inline scripts, no CDN
    "style-src 'self'; " +           // No inline styles
    "img-src 'self' data:; " +       // Allow data URIs for icons
    "connect-src 'self'; " +         // API calls to same origin only
    "frame-ancestors 'none'; " +     // No framing
    "base-uri 'self'; " +            // Prevent base tag hijacking
    "form-action 'self'"             // Forms submit to same origin only
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');  // Prevent URL leakage
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

## API Design

### Endpoints

| Method | Path | Request Body | Response | Notes |
|--------|------|-------------|----------|-------|
| `POST` | `/api/secrets` | `{ encrypted_data, iv, expires_in, password_hash? }` | `{ id, expires_at }` | Create secret |
| `GET` | `/api/secrets/:id` | -- | `{ encrypted_data, iv }` | Retrieve + delete (atomic). Returns 404 if viewed/expired/missing |
| `GET` | `/api/secrets/:id/meta` | -- | `{ password_required, created_at }` | Check if password needed (does NOT consume the secret) |
| `POST` | `/api/secrets/:id/verify` | `{ password }` | `{ encrypted_data, iv }` | Verify password, retrieve + delete. 401 on wrong password |

### Design Notes

- **No PUT/PATCH:** Secrets are immutable after creation. No editing.
- **No LIST:** No endpoint to enumerate secrets. IDs are UUIDs, unguessable.
- **GET meta is safe:** Checking password requirement does not consume the secret, allowing the frontend to show the right UI before the user commits.
- **ID format:** Use UUIDv4 (128-bit random) to make enumeration attacks infeasible. Do NOT use sequential IDs.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Monolith is fine. Single Node.js process, single PostgreSQL, single Redis. All on one server or a basic PaaS (Railway, Render). Background worker runs in same process via `setInterval` or `node-cron`. |
| 1k-100k users | Separate background worker into its own process. Add connection pooling (PgBouncer). Redis rate limiting handles load naturally. Consider CDN for static assets. PostgreSQL `VACUUM` becomes important as delete-heavy workload creates bloat. |
| 100k+ users | Horizontal scaling of API servers behind load balancer (stateless API makes this trivial). PostgreSQL read replicas not useful (write-heavy, read-once workload). Partition secrets table by `expires_at` for faster cleanup. Consider moving to Redis or DynamoDB for secret storage (TTL-based auto-expiration eliminates background worker). |

### Scaling Priorities

1. **First bottleneck: PostgreSQL write throughput and bloat.** Every secret is written once, read once, and deleted. This create-read-delete pattern causes significant table bloat. Run `VACUUM` aggressively (autovacuum with aggressive settings). At high scale, consider TTL-based stores (Redis with EXPIRE, DynamoDB with TTL) which handle ephemeral data natively.

2. **Second bottleneck: Rate limiting under distributed API servers.** Redis-based rate limiting works naturally across multiple API server instances since Redis is centralized. Use sliding window algorithm with Lua scripts for atomic increment-and-check.

3. **Third bottleneck: Background worker reliability.** At scale, the cleanup worker must be robust. Use `pg-boss` or a similar PostgreSQL-backed job queue for reliability, or switch to a TTL-based store that handles expiration automatically.

## Anti-Patterns

### Anti-Pattern 1: Server-Side Encryption

**What people do:** Encrypt/decrypt secrets on the server, store the key in an environment variable or database.
**Why it's wrong:** This is NOT zero-knowledge. The server can decrypt every secret. A server breach exposes all secrets. You become a massive target.
**Do this instead:** All encryption/decryption happens in the browser via Web Crypto API. The server only handles encrypted blobs.

### Anti-Pattern 2: Sending the Key to the Server (via query parameter, cookie, or header)

**What people do:** Put the encryption key in a query parameter (`?key=abc`) or send it as a header/cookie.
**Why it's wrong:** Query parameters appear in server access logs, proxy logs, CDN logs, browser history, and referrer headers. Headers and cookies are sent to the server by definition. The entire security model collapses.
**Do this instead:** Use the URL fragment (`#key`). It is the ONLY part of the URL guaranteed not to be sent to the server.

### Anti-Pattern 3: Non-Atomic Read and Delete

**What people do:** Fetch the secret in one query, then delete in a separate query.
**Why it's wrong:** Race condition: two concurrent requests can both read the secret before either deletes it. The "one-time" guarantee is broken.
**Do this instead:** Use `DELETE ... RETURNING` in PostgreSQL for atomic read-and-delete, or wrap in a transaction with `SELECT ... FOR UPDATE`.

### Anti-Pattern 4: Sequential or Predictable Secret IDs

**What people do:** Use auto-incrementing integers or short random strings as secret IDs.
**Why it's wrong:** Sequential IDs allow enumeration attacks (try id=1, id=2, ...). Short random strings can be brute-forced. An attacker can discover and destroy (or read, if they also have a key somehow) secrets.
**Do this instead:** Use UUIDv4 (128-bit random, 2^122 possible values). Enumeration is computationally infeasible.

### Anti-Pattern 5: Logging Encrypted Data or IDs

**What people do:** Log secret IDs, encrypted payloads, or client IP addresses in application logs or error tracking.
**Why it's wrong:** Logs are often stored in plaintext, retained indefinitely, and accessible to multiple team members. Secret IDs in logs could be correlated with URLs. IP addresses create a privacy issue.
**Do this instead:** Log only aggregate counts ("5 secrets created", "3 secrets expired"). Never log individual secret IDs, encrypted data, or IP addresses.

### Anti-Pattern 6: Reusing IVs

**What people do:** Use a static or reused initialization vector across multiple encryptions.
**Why it's wrong:** AES-GCM is catastrophically broken if the same IV is used with the same key. In this system, each secret uses a unique random key, so IV reuse across different secrets is theoretically safe, but generating a fresh random IV per encryption is trivial and eliminates the risk entirely.
**Do this instead:** Generate a fresh 96-bit (12-byte) random IV for every encryption operation.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Connection pool via `pg` library | Use parameterized queries exclusively. Never string-interpolate SQL. Set pool max to ~20 connections. |
| Redis | Single connection via `ioredis` | Used only for rate limiting. Lua scripts for atomic sliding window. If Redis goes down, fail open (allow requests) or fail closed (block requests) -- configure based on risk tolerance. |
| CDN (optional) | Static asset delivery | Cache HTML/CSS/JS aggressively. NEVER cache API responses. Set `Cache-Control: no-store` on all `/api/*` routes. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend Crypto <-> Frontend UI | Function calls (same bundle) | Crypto module exposes `encrypt(plaintext)` and `decrypt(ciphertext, iv, key)`. UI never touches `SubtleCrypto` directly. |
| Frontend <-> API Server | HTTPS REST (JSON) | Strict CORS: only same origin. No credentials (no cookies). Encrypted data is base64-encoded in JSON body. |
| API Server <-> PostgreSQL | SQL over TCP (connection pool) | All queries parameterized. Use `DELETE ... RETURNING` for atomic operations. Secrets table is the only table in MVP. |
| API Server <-> Redis | Redis protocol over TCP | Rate limiting only. Key pattern: `ratelimit:create:{ip}`. TTL matches rate limit window. |
| Background Worker <-> PostgreSQL | SQL over TCP (separate connection) | Runs `DELETE FROM secrets WHERE expires_at < NOW()` on interval. Could be same process or separate. |

## Build Order (Dependencies)

Components should be built in this order based on technical dependencies:

```
Phase 1: Crypto Module (browser)
  No dependencies. Pure functions. Can be unit tested in isolation.
  Delivers: encrypt(), decrypt(), generateKey(), encodeKey(), decodeKey()

Phase 2: Database Schema + Secret Service (server)
  Depends on: PostgreSQL running
  Delivers: createSecret(), retrieveSecret(), deleteExpired()

Phase 3: API Routes (server)
  Depends on: Phase 2 (secret service)
  Delivers: POST /api/secrets, GET /api/secrets/:id

Phase 4: Frontend Pages (Create + View)
  Depends on: Phase 1 (crypto), Phase 3 (API)
  Delivers: Full create-and-retrieve flow

Phase 5: Security Hardening
  Depends on: Phase 3 (API running)
  Delivers: CSP headers, rate limiting, input validation, CORS

Phase 6: Password Protection
  Depends on: Phase 2-4 (core flow working)
  Delivers: Password gate on create/retrieve

Phase 7: Background Worker
  Depends on: Phase 2 (database schema)
  Delivers: Expiration cleanup cron job

Phase 8: Polish & Error States
  Depends on: All above
  Delivers: Error pages, edge cases, copy-to-clipboard, responsive design
```

**Why this order:**
- **Crypto first** because it is the core value proposition and has zero dependencies. Get the security-critical code right before building anything else.
- **Database + service before API** because routes are thin wrappers around service functions.
- **Frontend after API** because you need working endpoints to test against.
- **Security hardening as a dedicated phase** because bolting on CSP/rate-limiting after the fact is easier than building it simultaneously with core features. But it MUST happen before any real users touch the system.
- **Password protection after core flow** because it is a P1 feature that layers on top of the base create/retrieve flow.
- **Background worker last** because secrets have long expiration times (hours/days) -- manual cleanup or database TTL is fine during development.

## Sources

- [PrivateBin Encryption Format](https://github.com/PrivateBin/PrivateBin/wiki/Encryption-format) -- v1.3+ uses Web Crypto API with AES-256-GCM, PBKDF2 100k iterations for password-derived keys. Confidence: HIGH
- [PrivateBin GitHub](https://github.com/PrivateBin/PrivateBin) -- Reference implementation of zero-knowledge paste architecture. Confidence: HIGH
- [Yopass GitHub](https://github.com/jhaals/yopass) -- Go backend + React frontend, supports Memcached/Redis backends, client-side encryption with key in URL fragment. Confidence: HIGH
- [Luzifer/ots GitHub](https://github.com/Luzifer/ots) -- Symmetric 256-bit AES encryption in browser, minimal Go server. Confidence: HIGH
- [OneTimeSecret GitHub](https://github.com/onetimesecret/onetimesecret) -- Ruby/Sinatra with Redis backend, server-side encryption with AES-256 (NOT zero-knowledge -- keys stored server-side as env var). Confidence: HIGH
- [MDN Web Crypto API: SubtleCrypto.encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) -- AES-GCM parameters and usage. Confidence: HIGH
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) -- Browser crypto capabilities. Confidence: HIGH
- [MDN AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- IV requirements for AES-GCM. Confidence: HIGH
- [Redis Rate Limiting Tutorial](https://redis.io/tutorials/howtos/ratelimiting/) -- Five algorithms compared (fixed window, sliding window, token bucket, leaky bucket, sliding window counter). Confidence: HIGH
- [pg-boss GitHub](https://github.com/timgit/pg-boss) -- PostgreSQL-backed job queue for Node.js with cron scheduling. Confidence: HIGH
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) -- CSP best practices. Confidence: HIGH
- [web.dev Strict CSP](https://web.dev/articles/strict-csp) -- Nonce-based CSP to mitigate XSS. Confidence: HIGH
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) -- bcrypt with appropriate cost factor. Confidence: HIGH
- [zeitkapsl E2EE Architecture](https://zeitkapsl.eu/en/e2ee-architecture/) -- End-to-end encrypted sharing with fragment-based key distribution. Confidence: MEDIUM
- [SecShare Architecture](https://gerwinkuijntjes.nl/en/projects/secshare-open-source-secret-sharing-tool/) -- Open-source implementation using URL fragment key pattern. Confidence: MEDIUM
- [Cipher Projects: One-Time Secret Sharing Guide 2025](https://cipherprojects.com/blog/posts/complete-guide-one-time-secret-sharing-tools-2025/) -- Industry survey of secret sharing tools. Confidence: MEDIUM

---
*Architecture research for: SecureShare -- zero-knowledge one-time secret sharing*
*Researched: 2026-02-13*
