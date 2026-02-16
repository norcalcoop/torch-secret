# Phase 2: Database and API - Research

**Researched:** 2026-02-13
**Domain:** Express 5 + Drizzle ORM + PostgreSQL -- server-side encrypted blob storage with atomic one-time retrieval
**Confidence:** HIGH

## Summary

Phase 2 builds the server that stores encrypted blobs and destroys them atomically on first retrieval. The core challenge is implementing a zero-knowledge storage layer where the server never touches plaintext, combined with an atomic read-and-destroy pattern that prevents double-retrieval and data remanence. The Phase 1 crypto module outputs base64-encoded ciphertext strings (IV + ciphertext + auth tag) via `EncryptedPayload.ciphertext`, which the API receives and stores as-is.

The tech stack is Express 5.x (stable since March 2025, now default on npm), Drizzle ORM 0.45.x with `node-postgres` driver, PostgreSQL 17+, and supporting libraries: nanoid 5.x for URL-safe IDs, zod 4.x for request validation, and pino 10.x / pino-http 11.x for structured logging with redaction. Express 5 provides built-in async error handling (rejected promises auto-forward to error middleware), eliminating the need for `express-async-errors` or manual try-catch wrappers.

**Primary recommendation:** Store ciphertext as PostgreSQL `text` (since Phase 1 outputs base64 strings), use Drizzle's `db.transaction()` for the zero-then-delete atomic pattern, generate 21-char nanoid IDs at the application layer via `$defaultFn()`, and configure pino with path-based redaction to ensure no secret IDs, ciphertext, or PII reach logs.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.x (latest 5.2.1) | HTTP framework | Stable since 2025, native async error handling, built-in body parsing |
| drizzle-orm | 0.45.x | TypeScript ORM | Type-safe queries, `DELETE ... RETURNING`, transaction support, SQL-first design |
| drizzle-kit | latest | Migration CLI | Schema-driven migrations via `generate` + `migrate` commands |
| pg | latest | PostgreSQL driver | Mature, pool support, pg-native optional 10% perf boost |
| nanoid | 5.x (5.1.6) | URL-safe ID generation | 21-char cryptographically secure IDs, ESM-native, used via `$defaultFn()` |
| zod | 4.x (4.3.6) | Request validation | 14x faster than zod 3, TypeScript inference, schema-first |
| pino | 10.x (10.3.1) | Structured JSON logging | Fastest Node.js logger, built-in redaction, low overhead |
| pino-http | 11.x (11.0.0) | Express HTTP logging | Auto request/response logging, custom serializers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/express | 5.x (5.0.6) | Express TypeScript types | Always -- must match Express major version |
| @types/pg | latest | pg TypeScript types | Always with pg driver |
| supertest | latest | HTTP assertion testing | Integration tests for API routes |
| @types/supertest | latest | Supertest TypeScript types | Always with supertest |
| dotenv | latest | Environment variable loading | Development config (.env for DATABASE_URL) |
| tsx | latest | TypeScript execution | Dev server via `tsx watch` |
| pino-pretty | latest | Human-readable log output | Development only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg (node-postgres) | postgres.js | postgres.js uses prepared statements by default (issues in some AWS envs); pg has broader ecosystem and pg-native option |
| text column for ciphertext | bytea column | Phase 1 outputs base64 strings; text avoids encode/decode overhead and is ~15% faster for reads; bytea saves ~33% storage but adds complexity |
| nanoid | uuid | nanoid is 21 chars vs 36 for UUID; both cryptographically secure; nanoid is URL-safe by default |
| zod | express-validator | zod provides TypeScript type inference from schemas; express-validator is more verbose |

**Installation:**

```bash
# Production dependencies
npm install express@5 pg drizzle-orm nanoid zod pino pino-http dotenv

# Development dependencies
npm install -D drizzle-kit @types/express @types/pg @types/supertest supertest tsx pino-pretty
```

## Architecture Patterns

### Recommended Project Structure

```
server/
  src/
    app.ts                  # Express app factory (buildApp function)
    server.ts               # HTTP server startup, graceful shutdown
    db/
      schema.ts             # Drizzle table definitions (secrets table)
      connection.ts         # Database connection pool + drizzle instance
      migrate.ts            # Programmatic migration runner
    routes/
      secrets.ts            # POST /api/secrets, GET /api/secrets/:id (thin handlers)
    services/
      secrets.service.ts    # Business logic: create, retrieve-and-destroy
    middleware/
      error-handler.ts      # Global error handling middleware
      validate.ts           # Zod validation middleware factory
      logger.ts             # Pino HTTP logger setup with redaction
    config/
      env.ts                # Environment variable schema (zod-validated)
shared/
  types/
    api.ts                  # Request/response types shared with client
drizzle/                    # Migration output folder (auto-generated)
drizzle.config.ts           # Drizzle Kit configuration
```

### Pattern 1: App Factory (for Testing)

**What:** Export a `buildApp()` function that creates and configures the Express app, separate from `server.ts` that starts listening.
**When to use:** Always. Enables supertest to import the app without starting a real server.

```typescript
// server/src/app.ts
import express from 'express';
import { secretsRouter } from './routes/secrets.js';
import { errorHandler } from './middleware/error-handler.js';
import { httpLogger } from './middleware/logger.js';

export function buildApp() {
  const app = express();

  app.use(httpLogger);
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/secrets', secretsRouter);

  app.use(errorHandler);

  return app;
}
```

```typescript
// server/src/server.ts
import { buildApp } from './app.js';

const app = buildApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server listening on port ${PORT}`);
});
```

### Pattern 2: Atomic Zero-Then-Delete (Data Remanence Mitigation)

**What:** Overwrite ciphertext with zeros, then delete the row, in a single database transaction.
**When to use:** Every secret retrieval (SECR-08, RETR-03).
**Why transaction, not CTE:** Drizzle ORM's CTE support is limited to SELECT statements in `$with()`. The `db.transaction()` approach is the supported pattern.

```typescript
// server/src/services/secrets.service.ts
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';

export async function retrieveAndDestroy(id: string) {
  return db.transaction(async (tx) => {
    // Step 1: Overwrite ciphertext with zeros (data remanence mitigation)
    const [updated] = await tx
      .update(secrets)
      .set({ ciphertext: '' })  // overwrite with empty string
      .where(eq(secrets.id, id))
      .returning();

    if (!updated) {
      return null; // not found / already consumed
    }

    // Step 2: Delete the row
    await tx.delete(secrets).where(eq(secrets.id, id));

    return updated;
  });
}
```

**Important:** The UPDATE ... RETURNING in step 1 returns the row data *before* the SET takes effect for columns in RETURNING. However, in Drizzle ORM, `.returning()` returns the NEW values (post-update). We need the ORIGINAL ciphertext. Two approaches:

**Approach A -- SELECT then UPDATE then DELETE (recommended):**
```typescript
export async function retrieveAndDestroy(id: string) {
  return db.transaction(async (tx) => {
    // 1. Read the secret
    const [secret] = await tx
      .select()
      .from(secrets)
      .where(eq(secrets.id, id));

    if (!secret) return null;

    // 2. Zero the ciphertext
    await tx
      .update(secrets)
      .set({ ciphertext: '\x00'.repeat(secret.ciphertext.length) })
      .where(eq(secrets.id, id));

    // 3. Delete the row
    await tx.delete(secrets).where(eq(secrets.id, id));

    return secret;
  });
}
```

**Approach B -- Raw SQL with CTE (single statement):**
```typescript
import { sql } from 'drizzle-orm';

export async function retrieveAndDestroy(id: string) {
  const result = await db.execute(sql`
    WITH deleted AS (
      DELETE FROM secrets
      WHERE id = ${id}
      RETURNING *
    ),
    zeroed AS (
      UPDATE secrets SET ciphertext = repeat(E'\\x00', length(ciphertext))
      WHERE id = ${id}
    )
    SELECT * FROM deleted
  `);
  // Note: CTE ordering is complex; transaction approach is clearer
}
```

**Recommendation: Use Approach A** (SELECT + UPDATE + DELETE in transaction). It is clearer, uses Drizzle's type-safe API, and the transaction guarantees atomicity. The CTE approach has ordering complexity and bypasses Drizzle's type system.

### Pattern 3: Identical Error Responses (Anti-Enumeration)

**What:** Return the exact same error shape for not-found, expired, already-viewed, and wrong-password.
**When to use:** All secret retrieval failures (SECR-07).

```typescript
// Identical error for all "secret unavailable" cases
const SECRET_NOT_AVAILABLE = {
  error: 'not_found',
  message: 'This secret does not exist, has already been viewed, or has expired.',
} as const;

// In route handler -- same response regardless of WHY it's unavailable
if (!secret) {
  return res.status(404).json(SECRET_NOT_AVAILABLE);
}
```

### Pattern 4: Zod Validation Middleware

**What:** Factory function that validates request body/params/query against a Zod schema.
**When to use:** All route handlers.

```typescript
// server/src/middleware/validate.ts
import { type ZodSchema, ZodError } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        error: 'validation_error',
        details: result.error.flatten(),
      });
    }
    next();
  };
}
```

### Pattern 5: Express 5 Async Error Handling

**What:** Express 5 auto-catches rejected promises in async handlers.
**When to use:** All route handlers. No `express-async-errors` package needed.

```typescript
// Express 5: errors from async handlers automatically reach error middleware
router.get('/:id', async (req, res) => {
  const secret = await retrieveAndDestroy(req.params.id);
  if (!secret) {
    return res.status(404).json(SECRET_NOT_AVAILABLE);
  }
  res.json({ ciphertext: secret.ciphertext, createdAt: secret.createdAt });
});
// If retrieveAndDestroy throws, Express 5 catches and forwards to error handler
```

### Anti-Patterns to Avoid

- **Separate SELECT then DELETE (non-atomic):** Never read and delete in separate non-transactional queries. A concurrent request could read between them. Always use a transaction.
- **Logging request bodies on secret routes:** pino-http logs request bodies if configured; ensure body logging is disabled or ciphertext fields are redacted.
- **Using `req.param()` (removed in Express 5):** Use `req.params.id` directly. `req.param()` was removed in Express 5.
- **`app.del()` instead of `app.delete()`:** `app.del()` was removed in Express 5.
- **Wildcard routes without names:** Express 5 requires named wildcards: `/*splat` not `/*`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ID generation | Custom random string generator | nanoid 5.x | Cryptographically secure, URL-safe, 21 chars, battle-tested collision resistance |
| Request validation | Manual `if (!req.body.x)` checks | zod 4.x schemas | Type inference, composable, consistent error format, handles edge cases |
| Structured logging | Custom `console.log` wrappers | pino + pino-http | JSON output, built-in redaction, request correlation, production-grade performance |
| Database migrations | Raw SQL files + manual tracking | drizzle-kit | Schema-driven, version tracking, programmatic apply, rollback support |
| Body parsing | Custom stream reading | express.json() | Built into Express 5, handles content-type, size limits, error cases |
| Connection pooling | Manual pg.Client management | pg.Pool via drizzle | Automatic connection reuse, health checks, configurable pool size |

**Key insight:** The server layer handles ONLY encrypted blobs. It has zero need for crypto operations, password hashing (Phase 5), or any plaintext processing. Keep the service layer thin: validate input shape, store, retrieve-and-destroy, return.

## Common Pitfalls

### Pitfall 1: Non-Atomic Read-and-Delete Race Condition

**What goes wrong:** Two concurrent requests hit GET /api/secrets/:id. Both read the secret before either deletes it, resulting in the secret being viewed twice.
**Why it happens:** Separate SELECT then DELETE queries without transaction isolation.
**How to avoid:** Wrap SELECT + UPDATE (zero) + DELETE in `db.transaction()`. PostgreSQL's default `READ COMMITTED` isolation is sufficient because the UPDATE acquires a row-level lock.
**Warning signs:** Tests pass with single-threaded test runner but fail under concurrent load.

### Pitfall 2: MVCC Dead Tuple Data Remanence

**What goes wrong:** PostgreSQL's MVCC creates "dead tuples" on UPDATE/DELETE. Old row versions persist on disk until VACUUM reclaims the space. The ciphertext may remain in dead tuples.
**Why it happens:** PostgreSQL never overwrites data in-place; it always writes new tuple versions.
**How to avoid:** Zero the ciphertext before deletion (reduces exposure window). Accept that PostgreSQL is not designed for cryptographic data erasure -- the zeroing is a defense-in-depth measure, not a guarantee. Document this as a known limitation. Full-disk encryption at the infrastructure layer is the real solution for at-rest protection.
**Warning signs:** N/A -- this is a design-level awareness issue, not a runtime bug.

### Pitfall 3: Leaking Secret IDs in Logs

**What goes wrong:** pino-http automatically logs URL paths (`/api/secrets/abc123`), which contain the secret ID.
**Why it happens:** Default request serializer includes the full URL.
**How to avoid:** Custom request serializer that redacts the path for secret routes, or redact the `req.url` field entirely. Configure pino's `redact` option for known sensitive paths.
**Warning signs:** Grep production logs for `/api/secrets/` -- if IDs appear, logging is misconfigured.

### Pitfall 4: Express 5 req.body Is Undefined Without Middleware

**What goes wrong:** `req.body` is `undefined` in Express 5 if `express.json()` middleware is not applied. In Express 4 it defaulted to `{}`.
**Why it happens:** Express 5 changed the default behavior.
**How to avoid:** Always call `app.use(express.json())` before route handlers.
**Warning signs:** "Cannot read property X of undefined" errors in route handlers.

### Pitfall 5: nanoid ESM Import Issues

**What goes wrong:** `require('nanoid')` fails because nanoid 5.x is ESM-only.
**Why it happens:** nanoid v4+ dropped CommonJS support.
**How to avoid:** Ensure the project uses ESM (`"type": "module"` in package.json) or use dynamic `import()`. Node.js 24 LTS supports ESM natively.
**Warning signs:** `ERR_REQUIRE_ESM` error at startup.

### Pitfall 6: @types/express Version Mismatch

**What goes wrong:** TypeScript compilation errors because @types/express v4 types don't match Express 5 API.
**Why it happens:** Installing @types/express without specifying major version may install v4.
**How to avoid:** Explicitly install `@types/express@5`.
**Warning signs:** Type errors on `app.listen` callback signature (Express 5 passes error as first arg).

### Pitfall 7: JSON Body Size Limit Too Small for Ciphertext

**What goes wrong:** Large encrypted payloads get rejected by Express with a 413 "Payload Too Large" error.
**Why it happens:** Default `express.json()` limit is 100kb. PADME-padded ciphertext for a 10,000-char secret, base64-encoded, could exceed this.
**How to avoid:** Calculate worst-case: 10,000 chars UTF-8 encoded (up to 40KB) + PADME padding (12% max) + base64 overhead (33%) = ~60KB. The 100kb default is sufficient, but set it explicitly: `express.json({ limit: '100kb' })`.
**Warning signs:** 413 errors when creating secrets with large text.

## Code Examples

### Database Schema Definition

```typescript
// server/src/db/schema.ts
// Source: Drizzle ORM docs (orm.drizzle.team/docs/sql-schema-declaration)
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const secrets = pgTable('secrets', {
  // 21-char nanoid, generated at application layer
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),

  // Base64-encoded ciphertext blob (IV + ciphertext + auth tag)
  // Stored as text because Phase 1 outputs base64 strings
  ciphertext: text('ciphertext').notNull(),

  // Expiration options: 1h, 24h, 7d, 30d from creation
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  // Creation timestamp for metadata
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Whether this secret requires a password (for Phase 5)
  passwordHash: text('password_hash'),

  // Password attempt counter (for Phase 5 auto-destroy)
  passwordAttempts: integer('password_attempts').default(0).notNull(),
});
```

### Database Connection Setup

```typescript
// server/src/db/connection.ts
// Source: Drizzle ORM PostgreSQL docs (orm.drizzle.team/docs/get-started-postgresql)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle({ client: pool, schema });
```

### Drizzle Config

```typescript
// drizzle.config.ts
// Source: Drizzle ORM docs (orm.drizzle.team/docs/drizzle-config-file)
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Programmatic Migration

```typescript
// server/src/db/migrate.ts
// Source: Drizzle ORM migration docs (orm.drizzle.team/docs/migrations)
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const db = drizzle(process.env.DATABASE_URL!);
await migrate(db);
```

### Pino Logger with Redaction

```typescript
// server/src/middleware/logger.ts
// Source: Pino docs (github.com/pinojs/pino), pino-http docs
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

export const httpLogger = pinoHttp({
  logger,
  // Custom serializer to strip secret IDs from URLs
  serializers: {
    req(req) {
      return {
        method: req.method,
        // Redact the specific secret ID from the path
        url: req.url?.replace(
          /\/api\/secrets\/[A-Za-z0-9_-]+/,
          '/api/secrets/[REDACTED]'
        ),
        // Do NOT log query params or headers that might leak info
      };
    },
  },
  // Don't auto-log request bodies (could contain ciphertext)
  autoLogging: true,
});
```

### Zod Schemas for API

```typescript
// shared/types/api.ts
import { z } from 'zod';

export const CreateSecretSchema = z.object({
  ciphertext: z.string().min(1).max(200_000),  // base64 has overhead
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
});

export type CreateSecretRequest = z.infer<typeof CreateSecretSchema>;

export const SecretIdParamSchema = z.object({
  id: z.string().length(21),  // nanoid length
});
```

### Integration Test with Supertest

```typescript
// server/src/routes/__tests__/secrets.test.ts
import request from 'supertest';
import { describe, test, expect } from 'vitest';
import { buildApp } from '../../app.js';

describe('POST /api/secrets', () => {
  test('stores ciphertext and returns a secret ID', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.id).toHaveLength(21);
  });
});

describe('GET /api/secrets/:id', () => {
  test('returns ciphertext on first retrieval', async () => {
    const app = buildApp();
    // Create a secret first
    const create = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' });

    // Retrieve it
    const res = await request(app)
      .get(`/api/secrets/${create.body.id}`)
      .expect(200);

    expect(res.body.ciphertext).toBe('dGVzdA==');
  });

  test('returns 404 on second retrieval (atomic delete)', async () => {
    const app = buildApp();
    const create = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' });

    // First retrieval consumes the secret
    await request(app).get(`/api/secrets/${create.body.id}`).expect(200);

    // Second retrieval returns same error as nonexistent
    const res = await request(app)
      .get(`/api/secrets/${create.body.id}`)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('returns identical error for nonexistent secret', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/secrets/nonexistent_id_12345')
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });
});
```

### Error Handler Middleware

```typescript
// server/src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log error without sensitive context
  logger.error({ err: { message: err.message, stack: err.stack } }, 'Unhandled error');

  // Generic error response -- never leak internal details
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred.',
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 4 + express-async-errors | Express 5 native async/await | Oct 2024 (v5.0) | No wrapper packages needed; rejected promises auto-caught |
| @types/express@4 | @types/express@5 (5.0.6) | 2024 | Must match Express major version; app.listen callback signature changed |
| zod 3.x | zod 4.x (4.3.6) | Mid-2025 | 14x faster parsing; @zod/mini available for lighter bundle |
| drizzle-orm early versions | drizzle-orm 0.45.x | Ongoing | Stable API, DELETE ... RETURNING, transaction support, programmatic migrations |
| express-validator | zod schemas as middleware | N/A (ecosystem shift) | Type inference from schemas, shared with client |
| CommonJS requires | ESM imports | Node.js 18+ | nanoid 5.x is ESM-only; project must use `"type": "module"` or dynamic import |

**Deprecated/outdated:**
- `express-async-errors`: Unnecessary with Express 5 native async support
- `req.param()`: Removed in Express 5; use `req.params`, `req.body`, `req.query`
- `app.del()`: Removed; use `app.delete()`
- `res.send(status)`: Use `res.sendStatus(status)` or `res.status(status).send()`

## Open Questions

1. **ESM Configuration for Server**
   - What we know: nanoid 5.x is ESM-only; Node.js 24 LTS supports ESM natively
   - What's unclear: Current project has no `"type": "module"` in package.json, and tsconfig uses `"module": "ESNext"` / `"moduleResolution": "bundler"`. Server needs its own tsconfig with `"module": "NodeNext"` for proper Node.js ESM support
   - Recommendation: Add `"type": "module"` to root package.json or create separate server tsconfig. Use `.js` extensions in imports per Node.js ESM requirements

2. **Test Database Strategy**
   - What we know: Integration tests need a real PostgreSQL instance for atomic transaction testing
   - What's unclear: Whether to use docker-compose for CI, a test-specific database, or in-memory PGlite
   - Recommendation: Use a test-specific PostgreSQL database (same docker-compose, separate DB name). Run migrations before test suite. Truncate tables between tests. PGlite could work for unit tests but transaction behavior should be verified against real PostgreSQL.

3. **Password Columns in Phase 2 Schema**
   - What we know: Phase 5 adds password protection; the schema needs `password_hash` and `password_attempts` columns
   - What's unclear: Whether to include these columns now (nullable) or add them via migration in Phase 5
   - Recommendation: Include them now as nullable columns. This avoids a schema migration mid-project and the columns have no storage cost when null. Phase 2 ignores them; Phase 5 uses them.

4. **Data Remanence Guarantee Limitations**
   - What we know: PostgreSQL MVCC means dead tuples persist until VACUUM. Zeroing before delete is defense-in-depth, not cryptographic erasure.
   - What's unclear: Whether the PRD considers this acceptable or needs stronger guarantees
   - Recommendation: Implement the zero-then-delete pattern as specified. Document the MVCC limitation. Note that full-disk encryption (infrastructure layer) is the proper solution for at-rest data protection. The application-layer zeroing reduces the window of exposure.

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM - Delete](https://orm.drizzle.team/docs/delete) - DELETE ... RETURNING syntax and examples
- [Drizzle ORM - Transactions](https://orm.drizzle.team/docs/transactions) - Transaction API, rollback, PostgreSQL isolation levels
- [Drizzle ORM - Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration) - pgTable, column types, $defaultFn
- [Drizzle ORM - PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg) - text, timestamp, integer, bytea
- [Drizzle ORM - Config File](https://orm.drizzle.team/docs/drizzle-config-file) - drizzle.config.ts options
- [Drizzle ORM - Migrations](https://orm.drizzle.team/docs/migrations) - Programmatic migrate() function
- [Drizzle ORM - SQL Operator](https://orm.drizzle.team/docs/sql) - Raw SQL, parameterized queries, db.execute()
- [Drizzle ORM - Update](https://orm.drizzle.team/docs/update) - UPDATE ... SET ... RETURNING
- [Drizzle ORM - Get Started PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) - Driver setup (pg vs postgres.js)
- [Express 5 Migration Guide](https://expressjs.com/en/guide/migrating-5.html) - Breaking changes, async handling, removed methods
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html) - Error middleware, async promise catching

### Secondary (MEDIUM confidence)
- [Express 5.1.0 Release](https://expressjs.com/2025/03/31/v5-1-latest-release.html) - Confirmed stable/default on npm
- [nanoid GitHub](https://github.com/ai/nanoid) - ESM-only, 21-char default, cryptographically secure
- [Pino Redaction Docs](https://github.com/pinojs/pino/blob/main/docs/redaction.md) - Built-in path-based redaction
- [pino-http GitHub](https://github.com/pinojs/pino-http) - Express middleware, custom serializers
- [PostgreSQL text vs bytea](https://www.postgrespro.com/list/thread-id/1509166) - text ~15% faster for reads of base64 data
- [Express 5 Production Setup](https://janhesters.com/blog/how-to-set-up-express-5-for-production-in-2025) - App factory pattern, test setup, validation middleware

### Tertiary (LOW confidence)
- PostgreSQL MVCC dead tuple behavior for zeroed data - no authoritative source confirms zeroing is effective against forensic recovery; treated as defense-in-depth only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm and official docs; versions confirmed current
- Architecture: HIGH - Patterns verified against Drizzle ORM docs, Express 5 docs, and established Node.js patterns
- Pitfalls: HIGH - Express 5 breaking changes documented in official migration guide; MVCC behavior well-documented
- Data remanence: MEDIUM - Zeroing pattern is defense-in-depth; PostgreSQL MVCC limitations are well-known but no authoritative source quantifies the security benefit

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days -- stable ecosystem, unlikely to change)
