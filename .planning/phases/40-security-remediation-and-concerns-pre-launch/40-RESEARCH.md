# Phase 40: Security Remediation and Concerns Pre-Launch — Research

**Researched:** 2026-03-01
**Domain:** Node.js backend security hardening — rate limiting, concurrency control, PostgreSQL pool configuration, test coverage, structured logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope**
- All 10 Immediate Action Items from the security posture report are in scope
- CONCERNS.md quick wins are also included: `console.error` → Pino migration (3 files), E2E_TEST safety gate (add `NODE_ENV === 'test'` check), and `passOnStoreError` warn logging
- All 7 test coverage gaps are in scope

**Argon2id /verify defense (Items #1 + #2, D2, SR-015)**
- Rate limit for POST /api/secrets/:id/verify: **5 req/min/IP** (tighter than current 15/15min)
- Add a new dedicated rate limiter in `rate-limit.ts` following the existing factory pattern (not modifying `verifySecretLimiter`)
- Apply rate limit BEFORE Argon2id computation in route handler
- Concurrency cap: **max 4 simultaneous Argon2id operations via p-limit**
- Apply concurrency cap to **verify-only** (not POST /api/secrets)
- Wire p-limit in `services/password.service.ts` or `services/secrets.service.ts` at the verifyPassword call site

**PostgreSQL pool hardening (Items #3 + #4, D3, SR-016)**
- Pool max: **10 connections** (explicit `max: 10` in `db/connection.ts`)
- Add `idleTimeoutMillis`, `connectionTimeoutMillis`, and `statement_timeout`
- Add **503 circuit breaker**: on pool exhaustion (connection timeout error), return HTTP 503 + `Retry-After` header
- Circuit breaker implemented as middleware or pool error event handler — Claude's discretion

**Payload size limit (Item #6, D1, SR-014)**
- Add 100KB hard cap to POST /api/secrets payload
- Apply both at `express.json()` middleware level AND in the route handler/Zod schema validation
- Return HTTP 413 Payload Too Large with `error: 'payload_too_large'`

**ZK invariant enforcement test (Item #5, I4, SR-012)**
- Add automated Vitest test for `notification.service.ts` asserting no nanoid pattern (`/[A-Za-z0-9_-]{21}/`) in email body or subject
- Test also verifies no `secretId` field is passed to any Resend API call

**IDOR dashboard test (Item #7, E1, SR-017)**
- Integration test: user A creates secret → user B logs in → user B requests dashboard → asserts A's secret not returned

**Session deletion test (Item #8, E3, SR-003)**
- Integration test: login → get session cookie → logout → use same cookie → assert 401

**Pro-gate re-validation test (Item #9, E4, SR-018)**
- Integration test: user is Pro → subscription downgraded (DB update, not webhook) → calls Pro-gated endpoint → assert 403

**OAuth account-linking audit (Item #10, E2, SR-004)**
- Audit Better Auth OAuth account-linking behavior in code
- Document finding in a code comment; if vulnerable add re-verification gate

**Test coverage gaps — all 7 (integration tests)**
- All tests follow Supertest + real PostgreSQL integration pattern from `server/src/routes/__tests__/secrets.test.ts`
1. Stripe webhook signature verification (Critical)
2. IDOR on dashboard (High)
3. Session logout invalidation (Medium)
4. Pro-gate re-validation (Medium)
5. ZK invariant systematic test (Medium)
6. Password attempt auto-destroy race condition (High)
7. Expiration worker soft-delete vs hard-delete (High)

**CONCERNS.md quick wins**
- `console.error` → `logger.error` in: `notification.service.ts` (line 36), `subscribers.service.ts` (lines 162, 177, 213)
- E2E_TEST bypass: gate with `const isE2E = process.env.NODE_ENV === 'test' && process.env.E2E_TEST === 'true'`
- `passOnStoreError` on all rate limiters: add `logger.warn('rate_limit_store_error')` when Redis store fails

### Claude's Discretion
- Exact `idleTimeoutMillis` and `connectionTimeoutMillis` values (30s idle, 5s connection are sensible)
- `statement_timeout` value (10s is a reasonable default for OLTP queries)
- Whether circuit breaker is a pool `error` event listener, try/catch in a db wrapper, or middleware
- Whether p-limit is applied in `password.service.ts` or `secrets.service.ts`
- Exact test file placement (new files vs extend existing `__tests__/` files)

### Deferred Ideas (OUT OF SCOPE)
- Redis MAXMEMORY eviction policy configuration — infrastructure, not application code
- WAF / DDoS protection at CDN layer — Cloudflare configuration, not application code
- Dashboard pagination (cursor-based)
- User data export (GDPR right-to-data)
- Audit logging table for auth events
- Expiration worker distributed locking (Redis SET with EX)
- Email delivery retry queue (Bull/MQ)
- Stripe idempotency key for customer creation
</user_constraints>

---

## Summary

Phase 40 remediates concrete security gaps identified in the 2026-03-01 posture audit (Grade C/77) without adding new product features. The work decomposes into four workstreams: (1) Argon2id DoS hardening via a new tight rate limiter and a p-limit concurrency cap, (2) PostgreSQL pool configuration with explicit resource limits and a 503 circuit breaker, (3) seven new integration tests closing test coverage gaps, and (4) three CONCERNS.md quick wins (console.error → logger.error, E2E_TEST safety gate, passOnStoreError warn logging).

All changes are purely backend. The codebase already has strong foundational patterns to build on: the rate-limit factory (`createStore` + `rateLimit()` calls), Supertest integration tests with real PostgreSQL, Pino logger already imported in services like `billing.service.ts`, and a Zod schema in `shared/types/api.ts` for payload capping. The largest unknown is the `p-limit` ESM compatibility — it is pure ESM v7.x, but the server is already configured for NodeNext module resolution, so the import will work without any config changes.

The OAuth account-linking audit (Item #10) is largely a code-read task: Better Auth does NOT automatically link OAuth accounts without email verification by default. The current `auth.ts` does not configure `account.accountLinking.trustedProviders`, so the default behavior (no auto-link without verified email) is in effect. This finding should be documented as a code comment — no code change is needed unless the audit reveals otherwise.

**Primary recommendation:** Sequence as five plans: (P01) rate-limit + p-limit hardening, (P02) pool + circuit breaker, (P03) payload size limit + Zod, (P04) seven integration tests, (P05) CONCERNS.md quick wins + OAuth audit. Each plan is self-contained and independently verifiable.

---

## Standard Stack

### Core (already in project — no new dependencies except p-limit)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express-rate-limit` | ^8.2.1 (already installed) | Rate limiting middleware | Factory pattern already established in `rate-limit.ts` |
| `argon2` | ^0.44.0 (already installed) | Argon2id hashing | Already wired in `password.service.ts` |
| `pg` (Pool) | ^8.18.0 (already installed) | PostgreSQL connection pool | `db/connection.ts` uses `new Pool({ connectionString })` |
| `drizzle-orm` | ^0.45.1 (already installed) | ORM | All DB queries use Drizzle |
| `vitest` | ^4.0.18 (already installed) | Test framework | Multi-project config, server tests in node env |
| `supertest` | ^7.2.2 (already installed) | HTTP integration testing | Pattern established in `secrets.test.ts` |
| `pino` | ^10.3.1 (already installed) | Structured logging | Already exported from `middleware/logger.ts` |

### New Dependency

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `p-limit` | `^7.3.0` | Concurrency cap for Argon2id | Pure ESM; NodeNext module resolution already configured in `server/tsconfig.json` — no config changes needed |

**Installation:**
```bash
npm install p-limit
```

p-limit v7.x is pure ESM. The server `tsconfig.json` already uses `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`, which handles pure ESM packages correctly. Import syntax is standard named default import:

```typescript
import pLimit from 'p-limit';
const limit = pLimit(4); // max 4 concurrent
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `p-limit` | `Bottleneck` | Bottleneck is heavier (queue-based, CJS+ESM); p-limit is the ecosystem standard for simple concurrency caps |
| `p-limit` | Manual semaphore with `Promise` + counter | Hand-rolling is error-prone; p-limit handles edge cases (rejection propagation, queue clearing) |
| Pool `error` event for circuit breaker | Middleware wrapper around all db calls | Pool event fires on unhandled errors; try/catch in a thin db wrapper is more targeted and testable |

---

## Architecture Patterns

### Pattern 1: Rate Limiter Factory (existing, extend here)

**What:** Export a factory function that creates a rate limiter with a Redis store (or MemoryStore fallback). New /verify-tight limiter follows the same signature.

**When to use:** Every new rate limiter in this project.

**Code reference** (`server/src/middleware/rate-limit.ts`):
```typescript
// Existing pattern — the new verifyTightLimiter follows this exactly:
export function verifySecretLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: isE2E ? 1000 : 15,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'rate_limited', message: '...' },
    store: createStore(redisClient, 'rl:verify:'),
    passOnStoreError: true,
  });
}
```

**New limiter to add:**
```typescript
// 5 req/min/IP on POST /api/secrets/:id/verify
export function createVerifyTightLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 1000,           // 1 minute
    limit: isE2E ? 1000 : 5,       // 5 req/min (vs current 15/15min)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'rate_limited', message: 'Too many password attempts. Please wait before trying again.' },
    store: createStore(redisClient, 'rl:verify:tight:'),
    passOnStoreError: true,        // + add logger.warn here (see CONCERNS.md)
  });
}
```

**Wire-up in `secrets.ts`:** Apply `createVerifyTightLimiter(redisClient)` BEFORE `verifySecretLimiter(redisClient)` in the `POST /:id/verify` middleware chain. Both limiters apply — tight limiter fires first, catching burst attacks; existing limiter provides broader coverage. Alternatively the existing `verifySecretLimiter` can be replaced by the new tighter one, but the CONTEXT.md says "new dedicated rate limiter" (not replacing), so both should be in place.

> **Critical ordering note:** Rate limiter middleware must be the FIRST item in the `POST /:id/verify` middleware chain — before `validateParams`, before `validateBody`, and critically before `verifyAndRetrieve()` which calls Argon2id. If the limiter is placed after `validateBody`, the Argon2id computation already starts on invalid requests.

### Pattern 2: p-limit Concurrency Cap for Argon2id

**What:** Wrap `verifyPassword()` in a p-limit concurrency cap so at most 4 Argon2id operations run simultaneously, protecting the CPU/thread pool.

**When to use:** Wrap the `verifyPassword` call site — either in `password.service.ts` (wrapping the export) or in `secrets.service.ts` (wrapping the call to `verifyPassword`). The CONTEXT.md gives discretion on placement. Wrapping in `password.service.ts` is cleaner: the concurrency enforcement is co-located with the expensive operation.

```typescript
// server/src/services/password.service.ts
import pLimit from 'p-limit';

const argon2Limit = pLimit(4); // max 4 simultaneous Argon2id operations

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2Limit(() => argon2.verify(hash, password));
}
```

**Anti-pattern to avoid:** Do NOT apply the limit to `hashPassword`. The CONTEXT.md explicitly states "Apply concurrency cap to verify-only" — creation (`hashPassword`) is already rate-limited by the anon/authed daily limiters.

### Pattern 3: PostgreSQL Pool Hardening

**What:** Extend the bare `new Pool({ connectionString })` in `db/connection.ts` with explicit resource limits.

**Current state** (`server/src/db/connection.ts`):
```typescript
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});
```

**Target state:**
```typescript
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,                          // Cap at 10 connections (default is unlimited)
  idleTimeoutMillis: 30_000,        // Release idle connections after 30s
  connectionTimeoutMillis: 5_000,   // Fail fast if pool exhausted (throw, don't hang)
  statement_timeout: 10_000,        // Kill queries running > 10s (set on connection)
});
```

`statement_timeout` is a PostgreSQL session-level parameter passed as `options` in the connection string or via `pg`'s connection options. The `pg` Pool does not have a native `statement_timeout` key — it must be passed as a connection parameter:

```typescript
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // statement_timeout as a pg connection option (ms value, pg v8 supports this)
  options: '--statement-timeout=10000',
});
```

> **Confidence note:** The `options` field passes PostgreSQL server-level parameters. `--statement-timeout=10000` sets a 10-second hard limit per statement. Verified that `pg` Pool accepts this via `connectionString` extras or the `options` key. (MEDIUM confidence — validate during implementation that `pg` Pool v8 accepts `options` as a top-level key vs via connection string.)

### Pattern 4: 503 Circuit Breaker on Pool Exhaustion

**What:** When `connectionTimeoutMillis` fires (pool exhausted, 5s elapsed), `pg` throws an error with `message: 'timeout exceeded when trying to connect'`. The circuit breaker intercepts this and returns 503 + `Retry-After: 30` instead of letting it propagate as an unhandled 500.

**Implementation options (Claude's discretion):**

Option A — Global error handler (simplest): The existing `error-handler.ts` already catches unhandled errors. Add a type check there:
```typescript
// server/src/middleware/error-handler.ts
if (err.message?.includes('timeout exceeded when trying to connect')) {
  res.status(503).set('Retry-After', '30').json({ error: 'service_unavailable', message: 'Database temporarily unavailable. Please retry in 30 seconds.' });
  return;
}
```

Option B — Pool `error` event (for logging only): Pool emits `'error'` on idle client errors, not on checkout timeouts. Checkout timeout errors are thrown at the `pool.connect()` call site and reach the Express error handler naturally.

**Recommendation:** Option A (global error handler) is cleanest — zero duplication, one place to maintain, automatically covers all routes. The pool error event should also be listened to for logging (pool `'error'` events are for idle client disconnections, which should be logged as warnings, not circuit-broken).

```typescript
// Add to db/connection.ts:
pool.on('error', (err) => {
  logger.warn({ err: err.message }, 'PostgreSQL pool idle client error');
});
```

### Pattern 5: Payload Size Limit (100KB)

**What:** Two-layer enforcement for `POST /api/secrets`:
1. `express.json({ limit: '100kb' })` — Express middleware level (returns 413 automatically)
2. Zod schema: `ciphertext: z.string().min(1).max(100_000)` — reduces from current 200,000 char cap

**Current state** (`shared/types/api.ts` line 10):
```typescript
ciphertext: z.string().min(1).max(200_000),
```

**Target state:**
```typescript
ciphertext: z.string().min(1).max(100_000), // 100KB max (SR-014)
```

The `express.json()` middleware is configured in `server/src/app.ts`. Its current call should have `limit` added:
```typescript
app.use(express.json({ limit: '100kb' }));
```

When `express.json({ limit: '100kb' })` fires and the payload exceeds the limit, it sends a 413 response with `{ type: 'entity.too.large' }`. The CONTEXT.md requires `{ error: 'payload_too_large' }` format, so a custom `type` error handler should be added or the existing error handler should intercept `entity.too.large` errors and re-format them.

Express 5 propagates body-parser errors to the error handler via `next(err)` — the `err.type` will be `'entity.too.large'` and `err.status` will be 413. Intercept in the global error handler:

```typescript
// In error-handler.ts, before the generic 500:
if ((err as { type?: string }).type === 'entity.too.large') {
  res.status(413).json({ error: 'payload_too_large', message: 'Request payload exceeds the 100KB limit.' });
  return;
}
```

### Pattern 6: Integration Test Structure (existing, all new tests follow this)

**What:** All 7 new tests use the established Supertest + real PostgreSQL pattern from `secrets.test.ts`.

**Key elements to replicate:**
```typescript
// Standard test file header (ALL server tests)
import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

// Standard teardown
afterEach(async () => { await db.delete(secrets); });
afterAll(async () => { await pool.end(); }); // CRITICAL — must close pool or vitest hangs
```

**User creation helper (already exists in `dashboard.test.ts` and `secrets.test.ts`):**
```typescript
async function createUserAndSignIn(app, email, password, name): Promise<{ sessionCookie: string; userId: string }>
// Calls /api/auth/sign-up/email then /api/auth/sign-in/email
// Extracts 'better-auth.session_token=...' from Set-Cookie header
// Returns { sessionCookie, userId }
```

This helper is duplicated across test files. New test files should define their own local copy (the existing pattern) rather than importing from another test file.

### Pattern 7: ZK Invariant Test for notification.service.ts

**What:** Unit test (not integration test) that mocks `resend.emails.send` and captures the email payload, then asserts the body and subject do not match the nanoid pattern.

```typescript
// server/src/services/__tests__/notification.service.test.ts
vi.mock('../email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ error: null }) },
  },
}));

import { resend } from '../email.js';

test('email body never contains a nanoid-pattern secret ID', async () => {
  await sendSecretViewedNotification('user@example.com', new Date());
  const call = vi.mocked(resend.emails.send).mock.calls[0][0];
  const nanoidPattern = /[A-Za-z0-9_-]{21}/;
  expect(call.subject).not.toMatch(nanoidPattern);
  expect(call.text).not.toMatch(nanoidPattern);
  // Also assert no 'secretId' field exists anywhere in the payload
  expect(JSON.stringify(call)).not.toContain('secretId');
});
```

### Pattern 8: Stripe Webhook Signature Test

**What:** Integration test that sends a tampered webhook (no signature header or wrong signature) and asserts 400 + no DB mutation.

The existing `server/src/routes/webhooks.ts` uses `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET`. When signature is invalid, Stripe SDK throws `Stripe.errors.StripeSignatureVerificationError`. The existing error handler should catch this and return 400.

```typescript
test('tampered webhook returns 400 and does NOT trigger Pro upgrade', async () => {
  const res = await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 'invalid-signature')
    .send(JSON.stringify({ type: 'checkout.session.completed' }))
    .expect(400);
  // Verify no subscription_tier update in DB
});
```

**Critical:** The Stripe webhook route requires `express.raw()` body parsing (not `express.json()`). In tests, send raw JSON string body with `Content-Type: application/json`. The existing `buildApp()` already mounts the webhook route with `express.raw()` before `express.json()`.

### Pattern 9: Race Condition Test for Password Auto-Destroy

**What:** Send multiple simultaneous Supertest requests via `Promise.all()`. This is the only way to simulate true concurrency — sequential requests will not trigger the race.

```typescript
test('concurrent verify requests with attemptsRemaining=1 destroy secret exactly once', async () => {
  const { id } = await createPasswordSecret('correct');
  // Exhaust to 1 attempt remaining
  await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-1' });
  await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-2' });
  // Now send 3 concurrent requests — only one should destroy, others see 404
  const results = await Promise.all([
    request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-3' }),
    request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-3' }),
    request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-3' }),
  ]);
  // Exactly one request triggers auto-destroy (404); others are also 404 (already gone)
  // Key assertion: secret is NOT in DB (not duplicated/lingering)
  const rows = await db.select().from(secrets).where(eq(secrets.id, id));
  expect(rows).toHaveLength(0);
});
```

Note: With `fileParallelism: false` (server test config), Supertest requests within a single test ARE truly concurrent because they go to the same Express HTTP server in-process.

### Pattern 10: OAuth Account Linking Audit Finding

**Research outcome (HIGH confidence — verified via Better Auth official docs):**

Better Auth's DEFAULT behavior for OAuth sign-in when an email already exists:
- Account linking is enabled by default
- Auto-linking ONLY occurs if the OAuth provider confirms the email as **verified**
- If the email is unverified from the provider, Better Auth creates a NEW account (or throws an error depending on version)
- The current `auth.ts` does NOT configure `account.accountLinking.trustedProviders` — no trustedProviders list is present

**Security implication:** Google and GitHub OAuth providers both return verified emails. This means: if a user has a `user@gmail.com` email+password account, and someone signs in with Google OAuth using the same `user@gmail.com`, Better Auth WILL link the OAuth account to the existing user record because Google marks the email as verified. This is "account linking by verified email" — it's the intended behavior, not a vulnerability per se, but it's worth documenting.

**Is this a vulnerability?** For Google and GitHub specifically: both providers' tokens are issued to verified, authenticated users. A Bad Actor cannot initiate a Google OAuth flow for someone else's email without controlling their Google account. This is NOT an account takeover vector. The risk is: if an attacker somehow compromises the OAuth provider's token issuance, they could link to an existing account. This is within acceptable risk for social OAuth.

**Action required:** Add a code comment in `auth.ts` documenting this finding. No code change is required unless the audit surfaces a gap (e.g., if the app were using a custom OAuth provider that does not verify emails). The current implementation with Google + GitHub is safe.

### Anti-Patterns to Avoid

- **Rate limiter placed after Argon2id:** If `verifyTightLimiter` is placed after `validateBody` but `verifyAndRetrieve` is called in the route handler, the rate limiter fires AFTER the CPU-intensive work has started. Limiter must be FIRST in the chain.
- **Applying p-limit to `hashPassword`:** CONTEXT.md explicitly limits concurrency cap to verify-only. Applying to creation would slow down secret creation without security benefit.
- **Using `pool.on('error')` as the circuit breaker:** Pool `error` events are for idle client errors (lost connections), NOT for checkout timeouts. Checkout timeouts throw at the application level and reach Express error handler naturally.
- **Duplicate `pool.end()` calls across new test files:** Every test file that uses `db` must call `pool.end()` in its `afterAll`. If two test files share a pool instance without isolating, closing the pool in one file breaks the other. The server vitest config already uses `fileParallelism: false` which serializes test files, so `pool.end()` at end of each file is safe.
- **ZK invariant in console.error replacements:** The console.error → logger.error migration must NOT add any identifying fields. The existing messages are correct (no userId, no secretId). Just replace `console.error(msg, ...)` with `logger.error({ err: msg }, 'description')` following Pino's structured logging pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency semaphore for Argon2id | Manual Promise counter + mutex | `p-limit` | p-limit handles rejection propagation, queue clearing, and TypeScript types correctly |
| Express payload size limiting | Custom body-parser or streaming check | `express.json({ limit: '100kb' })` | Express delegates to `body-parser` which handles chunked transfer, streaming, and correct 413 semantics |
| Rate limiter window/counting | Custom Redis INCR+EXPIRE logic | `express-rate-limit` + `rate-limit-redis` | Already installed; handles IP extraction, sliding windows, `passOnStoreError`, and standardized headers |

---

## Common Pitfalls

### Pitfall 1: p-limit ESM Import in NodeNext

**What goes wrong:** TypeScript error `ERR_REQUIRE_ESM` or "default export not found" at runtime if the import is wrong.

**Why it happens:** p-limit v7+ is pure ESM. NodeNext requires `.js` extensions on relative imports. For npm packages, NodeNext reads `package.json` exports and resolves correctly.

**How to avoid:** Use `import pLimit from 'p-limit'` (default import). Do NOT use `const { default: pLimit } = await import('p-limit')` (dynamic import is unnecessary). The server `tsconfig.json` is already `NodeNext`, which handles `p-limit`'s pure-ESM `exports` field correctly.

**Warning signs:** If TypeScript gives "Module 'p-limit' has no exported member 'default'" — this indicates the wrong tsconfig module resolution.

### Pitfall 2: Stripe Webhook Raw Body in Tests

**What goes wrong:** Stripe signature verification fails with "No signatures found" in integration tests.

**Why it happens:** The Stripe webhook route uses `express.raw()`. Supertest must send a raw body string, not a JS object. If `.send(object)` is used instead of `.send(JSON.stringify(object))` with correct Content-Type, the raw body is malformed.

**How to avoid:**
```typescript
// CORRECT for webhook tests:
.set('Content-Type', 'application/json')
.send(JSON.stringify({ type: 'checkout.session.completed' }))
// WRONG:
.send({ type: 'checkout.session.completed' }) // Supertest serializes to JSON automatically only for express.json routes
```

### Pitfall 3: passOnStoreError + warn logging — store error event

**What goes wrong:** The `store` option on `express-rate-limit` does not expose a direct `onError` callback in v8. The `passOnStoreError: true` flag silently swallows Redis errors.

**How to avoid:** In `express-rate-limit` v8, `passOnStoreError` silences errors. To add logging, use the `RedisStore`'s underlying Redis client's error event OR override `createStore` to wrap the store's `increment`/`decrement` calls with a try/catch that logs. The simpler approach: set `passOnStoreError: false` in production to fail closed, which surfaces errors to the Express error handler where logging happens naturally. However CONTEXT.md says to keep `passOnStoreError: true` and ADD a warn log — this requires checking the `rate-limit-redis` store or using the `express-rate-limit` `skip` callback pattern.

**Best approach:** Add a `sendCommand` wrapper in `createStore()` that catches Redis errors and calls `logger.warn` before re-throwing (so `passOnStoreError` catches the re-thrown error and passes through):

```typescript
function createStore(redisClient?: Redis, prefix?: string): Store | undefined {
  if (!redisClient) return undefined;
  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      try {
        return await redisClient.call(...(args as [string, ...string[]])) as Promise<RedisReply>;
      } catch (err) {
        logger.warn({ err: (err as Error).message }, 'rate_limit_store_error');
        throw err; // re-throw so passOnStoreError catches it
      }
    },
    prefix: prefix ?? 'rl:',
  });
}
```

### Pitfall 4: E2E_TEST safety gate — module-level const

**What goes wrong:** `const isE2E = process.env.E2E_TEST === 'true'` is evaluated once at module load time. If the env var is set after module import (e.g., by test setup), the constant won't reflect the change.

**Why this matters for the fix:** The fix changes `isE2E` to `process.env.NODE_ENV === 'test' && process.env.E2E_TEST === 'true'`. This evaluation happens at module load. In normal `npm run test:run` (NODE_ENV=test, E2E_TEST unset) → `isE2E = false`. In E2E test run (NODE_ENV=test, E2E_TEST=true) → `isE2E = true`. In production (NODE_ENV=production, E2E_TEST=true accidentally) → `isE2E = false`. The fix is correct as a module-level const.

### Pitfall 5: Pool connectionTimeoutMillis Error Class

**What goes wrong:** The pool timeout error message varies between pg versions. `if (err.message.includes('timeout'))` is fragile.

**How to avoid:** Use a specific string match OR check the error code. The `pg` Pool throws `Error: timeout exceeded when trying to connect` for `connectionTimeoutMillis` exhaustion. In Express error handler, check `err.message?.includes('timeout exceeded when trying to connect')` — this string is stable across pg v8.x.

### Pitfall 6: Test File Pool Ownership

**What goes wrong:** Two test files both call `pool.end()` in `afterAll`, but they share the same pool singleton from `db/connection.ts`. If the pool closes in the first file, the second file's tests fail with "Cannot use a pool after calling end on the pool."

**How to avoid:** With `fileParallelism: false`, test files run sequentially. Each test file's `afterAll` that calls `pool.end()` is called when that file finishes. If a new test file is added to the same describe block as an existing file that calls `pool.end()`, move `pool.end()` to a shared global setup file, or add it only to the last test file that runs.

**Safe approach for new files:** For new test files, check whether they will be the last file in the run order. If uncertain, add `pool.end()` to each new test file. `pool.end()` on an already-ended pool throws "Cannot use a pool after calling end on the pool" — add a guard or accept that the last file to call it "wins."

The existing test files each call `pool.end()` independently. This works with `fileParallelism: false` because vitest runs each file to completion before starting the next. The pool is a Node.js module singleton — the first `pool.end()` call succeeds, subsequent calls from the next file would fail. This is currently a known fragility in the test suite. For new test files, follow the same pattern as existing files (call `pool.end()` in `afterAll`).

---

## Code Examples

### Example 1: createVerifyTightLimiter (new rate limiter)

```typescript
// server/src/middleware/rate-limit.ts — add after verifySecretLimiter

/**
 * Tight rate limiter for POST /api/secrets/:id/verify.
 * 5 requests per minute per IP — significantly tighter than the existing
 * 15/15min verifySecretLimiter. Applied FIRST in the middleware chain
 * to block burst attacks before Argon2id computation begins (D2, SR-015).
 */
export function createVerifyTightLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 1000,          // 1 minute
    limit: isE2E ? 1000 : 5,      // 5 req/min (1000 in E2E)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many password attempts. Please wait before trying again.',
    },
    store: createStore(redisClient, 'rl:verify:tight:'),
    passOnStoreError: true,
  });
}
```

### Example 2: p-limit in password.service.ts

```typescript
// server/src/services/password.service.ts
import argon2 from 'argon2';
import pLimit from 'p-limit';

// Max 4 concurrent Argon2id operations — protects CPU/thread pool from exhaustion (D2, SR-015)
const argon2Limit = pLimit(4);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2Limit(() => argon2.verify(hash, password));
}
```

### Example 3: Pool hardening in db/connection.ts

```typescript
// server/src/db/connection.ts
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  options: '--statement-timeout=10000',
});

pool.on('error', (err) => {
  logger.warn({ err: err.message }, 'pg_pool_idle_client_error');
});
```

### Example 4: 503 circuit breaker in error-handler.ts

```typescript
// Add BEFORE the generic 500 handler in server/src/middleware/error-handler.ts
if (err.message?.includes('timeout exceeded when trying to connect')) {
  res.status(503).set('Retry-After', '30').json({
    error: 'service_unavailable',
    message: 'Service temporarily unavailable. Please retry in 30 seconds.',
  });
  return;
}
```

### Example 5: express.json payload limit + 413 handler

```typescript
// server/src/app.ts — modify the existing express.json() line:
app.use(express.json({ limit: '100kb' }));

// In error-handler.ts, add before generic 500:
if ((err as { type?: string }).type === 'entity.too.large') {
  res.status(413).json({
    error: 'payload_too_large',
    message: 'Request payload exceeds the 100 KB limit.',
  });
  return;
}
```

### Example 6: console.error → logger.error migration

The existing pattern used in `auth.ts` and `billing.service.ts`:
```typescript
import { logger } from '../middleware/logger.js'; // Add this import

// notification.service.ts line 36 — change:
console.error('Failed to send secret-viewed notification:', error.message);
// to:
logger.error({ err: error.message }, 'notification_send_failed');
// ZK INVARIANT: no userEmail, no secretId in this log line — message only contains error.message
```

### Example 7: IDOR integration test pattern

```typescript
// server/src/routes/__tests__/dashboard.test.ts (extend this file) or new security.test.ts
test('user B cannot see user A secrets in dashboard', async () => {
  // User A creates a secret via API
  await request(app)
    .post('/api/secrets')
    .set('Cookie', userASessionCookie)
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
    .expect(201);

  // User B fetches dashboard
  const res = await request(app)
    .get('/api/dashboard/secrets')
    .set('Cookie', userBSessionCookie)
    .expect(200);

  // User B's list must not contain any secret owned by User A
  const secretIds = (res.body.secrets as { id: string }[]).map((s) => s.id);
  // get User A's secrets directly from DB
  const userASecrets = await db.select({ id: secrets.id }).from(secrets).where(eq(secrets.userId, userAId));
  for (const { id } of userASecrets) {
    expect(secretIds).not.toContain(id);
  }
});
```

### Example 8: Session logout invalidation test

```typescript
test('session cookie is invalid after logout', async () => {
  const { sessionCookie } = await createUserAndSignIn(app, email, password, name);

  // Verify the cookie works pre-logout
  await request(app).get('/api/dashboard/secrets').set('Cookie', sessionCookie).expect(200);

  // Logout
  await request(app).post('/api/auth/sign-out').set('Cookie', sessionCookie).expect(200);

  // Same cookie must now fail
  await request(app).get('/api/dashboard/secrets').set('Cookie', sessionCookie).expect(401);
});
```

### Example 9: Pro-gate re-validation test

```typescript
test('downgraded Pro user gets 403 on Pro-gated endpoint', async () => {
  const { sessionCookie, userId } = await createUserAndSignIn(app, email, password, name);

  // Elevate to Pro via direct DB update (same pattern as Phase 34.1 tier tests)
  await db.update(users).set({ subscriptionTier: 'pro' }).where(eq(users.id, userId));

  // Simulate downgrade — direct DB update without webhook
  await db.update(users).set({ subscriptionTier: 'free' }).where(eq(users.id, userId));

  // Try to create a 30d secret (Pro-only via expiresIn cap) — should get 400 (free user cap)
  const res = await request(app)
    .post('/api/secrets')
    .set('Cookie', sessionCookie)
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '30d' })
    .expect(400);
  expect(res.body.error).toBe('validation_error');
});
```

Note: The Pro gate for `expiresIn: '30d'` returns 400 (validation_error), not 403. The test should use this existing gate as the verification point. For a stricter test of "middleware re-reads from DB on each request", use `POST /api/billing/checkout` which calls `requireAuth` and would hit the billing route (but this requires Stripe mock). The expiresIn gate in the secrets route already reads from DB on each request (via `subscriptionTier` lookup for password type). The test verifies that the session does not cache the old Pro status.

### Example 10: Stripe webhook tampered signature test

```typescript
test('webhook with invalid signature returns 400 and does not upgrade user', async () => {
  // Direct DB: create a test user and simulate a checkout session payload
  const fakePayload = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { customer: 'cus_fake123' } },
  });

  const res = await request(app)
    .post('/api/webhooks/stripe')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', 't=123456,v1=invalidsignature')
    .send(fakePayload)
    .expect(400);

  expect(res.body.error).toBeDefined();
  // Verify no user was upgraded (check DB — subscriptionTier unchanged)
});
```

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` (root) — multi-project: `client` (happy-dom) + `server` (node) |
| Quick run command | `npx vitest run server/src/routes/__tests__/secrets.test.ts` |
| Full suite command | `npm run test:run` |
| Server parallelism | `fileParallelism: false` (sequential test files) |
| Timeout | 10,000ms per test |

### Phase Requirements → Test Map

| Item | Behavior | Test Type | File | Exists? |
|------|----------|-----------|------|---------|
| Item #1 + #2 (D2, SR-015) | POST /verify limited to 5 req/min, Argon2id capped at 4 concurrent | Integration | `server/src/routes/__tests__/secrets.test.ts` (extend) | Partial (existing 15/15min test) |
| Item #3 + #4 (D3, SR-016) | Pool exhaustion returns 503 + Retry-After | Integration | New: `server/src/routes/__tests__/security.test.ts` (extend) | No |
| Item #5 (I4, SR-012) | notification.service.ts email body contains no nanoid pattern | Unit | New: `server/src/services/__tests__/notification.service.test.ts` | No |
| Item #6 (D1, SR-014) | POST /api/secrets > 100KB returns 413 payload_too_large | Integration | `server/src/routes/__tests__/secrets.test.ts` (extend) | No |
| Item #7 (E1, SR-017) | IDOR: user B cannot see user A's secrets | Integration | `server/src/routes/__tests__/dashboard.test.ts` (extend) | No |
| Item #8 (E3, SR-003) | Logout invalidates server-side session | Integration | New: `server/src/routes/__tests__/auth.test.ts` | No |
| Item #9 (E4, SR-018) | Downgraded Pro user gets 4xx on Pro-gated endpoint | Integration | New: `server/src/routes/__tests__/auth.test.ts` | No |
| Item #10 (E2, SR-004) | OAuth email-match auto-linking behavior documented | Code comment | `server/src/auth.ts` | No (audit only) |
| Gap 1: Stripe webhook sig | Tampered webhook returns 400, no DB upgrade | Integration | `server/src/routes/__tests__/webhooks.test.ts` | No |
| Gap 2: IDOR dashboard | User B cannot see User A secrets | Integration | `server/src/routes/__tests__/dashboard.test.ts` (extend) | No |
| Gap 3: Session logout | Logout invalidates cookie | Integration | `server/src/routes/__tests__/auth.test.ts` | No |
| Gap 4: Pro-gate re-validation | Free tier after downgrade blocks Pro features | Integration | `server/src/routes/__tests__/auth.test.ts` | No |
| Gap 5: ZK invariant | notification.service email body has no secretId | Unit | `server/src/services/__tests__/notification.service.test.ts` | No |
| Gap 6: Race condition auto-destroy | Concurrent verify only destroys secret once | Integration | `server/src/routes/__tests__/secrets.test.ts` (extend) | No |
| Gap 7: Expiration soft/hard | User-owned secrets get status='expired'; anonymous get deleted | Unit | `server/src/workers/__tests__/expiration-worker.test.ts` (extend) | Partial |
| CONCERNS: console.error | logger.error in 3 service files | Code change | `notification.service.ts`, `subscribers.service.ts` | No (3 occurrences) |
| CONCERNS: E2E_TEST gate | NODE_ENV==='test' guard prevents production bypass | Code change | `rate-limit.ts` line 6 | No |
| CONCERNS: passOnStoreError warn | logger.warn on Redis store errors | Code change | `rate-limit.ts` createStore() | No |

### Sampling Rate

- **Per task commit:** `npx vitest run server/src/routes/__tests__/secrets.test.ts` (or the specific new file)
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

New test files to create:

- [ ] `server/src/services/__tests__/notification.service.test.ts` — ZK invariant unit test (Gap 5, Item #5)
- [ ] `server/src/routes/__tests__/auth.test.ts` — Session logout + Pro-gate tests (Gap 3, Gap 4, Item #8, Item #9)
- [ ] `server/src/routes/__tests__/webhooks.test.ts` — Stripe webhook signature tests (Gap 1)

Existing files to extend:
- [ ] `server/src/routes/__tests__/secrets.test.ts` — payload 413 test (Item #6), race condition test (Gap 6), tight rate limiter test (Item #1)
- [ ] `server/src/routes/__tests__/dashboard.test.ts` — IDOR test (Gap 2, Item #7)
- [ ] `server/src/workers/__tests__/expiration-worker.test.ts` — soft/hard delete verification (Gap 7)

---

## Open Questions

1. **`pg` Pool `options` field for statement_timeout**
   - What we know: `pg` Pool v8.x accepts connection-level parameters via `connectionString` extras or a top-level `options` field
   - What's unclear: Whether `options: '--statement-timeout=10000'` is the correct syntax for `pg` Pool v8 (vs `statement_timeout` in milliseconds as a field)
   - Recommendation: During implementation, test both `options: '--statement-timeout=10000'` and the alternative of setting it via `connectionString` with `?options=--statement-timeout%3D10000`. Fall back to per-query `SET statement_timeout` if neither works cleanly.

2. **passOnStoreError warn logging — RedisStore sendCommand wrapper**
   - What we know: `passOnStoreError: true` silences store errors; `rate-limit-redis` v4's `sendCommand` is async
   - What's unclear: Whether wrapping `sendCommand` in try/catch + re-throw is the correct interception point or if `express-rate-limit` v8 exposes a `storeError` callback
   - Recommendation: Check `express-rate-limit` v8 changelog/options for any `onStoreError` hook before implementing the wrapper. If none exists, the `sendCommand` wrapper approach is correct.

3. **Stripe webhook test — mock vs real Stripe SDK**
   - What we know: `stripe.webhooks.constructEvent()` throws `StripeSignatureVerificationError` for invalid signatures
   - What's unclear: Whether the webhook test needs to mock the Stripe SDK or can use the real SDK with `STRIPE_WEBHOOK_SECRET=whsec_test...` in test env
   - Recommendation: Use real Stripe SDK with `STRIPE_WEBHOOK_SECRET=whsec_test_fake_secret_for_tests` in test environment — the SDK validates against the secret, so a mismatched signature will correctly throw. This tests the real validation path without mocking. The CI already has Stripe env vars set.

4. **Pro-gate test — which endpoint is the most reliable gate to test**
   - What we know: The Pro gate for `expiresIn: '30d'` is checked in `secrets.ts` as a direct DB lookup per request; `protection_type: 'password'` also does a DB lookup
   - What's unclear: Whether testing `expiresIn: '30d'` correctly validates "middleware re-reads from DB" (it does — the check is `if (userId && expiresIn === '30d')` which is a hardcoded tier check, NOT a DB lookup)
   - Recommendation: Use `protection_type: 'password'` for the Pro-gate test — that path does an actual DB lookup (`select subscriptionTier from users where id = userId`) and is the most robust test of "DB re-reads on each request." After downgrading in DB, the next request will read `free` tier and return 403 `pro_required`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Manual semaphore with Promise/counter | `p-limit` (v7.3.0, pure ESM) | Simpler, correctly typed, handles edge cases |
| Unbounded pg Pool | Explicit `max`, `idleTimeoutMillis`, `connectionTimeoutMillis` | Prevents connection exhaustion under load |
| `passOnStoreError: true` silent | `passOnStoreError: true` + `logger.warn` | Ops visibility into Redis outages |
| `E2E_TEST === 'true'` (no NODE_ENV guard) | `NODE_ENV === 'test' && E2E_TEST === 'true'` | Prevents accidental production rate limit bypass |
| `console.error()` in service files | `logger.error()` via Pino | Structured log output; visible to log aggregators |

---

## Sources

### Primary (HIGH confidence)
- Better Auth official docs (https://better-auth.com/docs/concepts/users-accounts) — OAuth account linking default behavior, trustedProviders config, email verification requirement
- Code audit of `server/src/auth.ts` — confirmed no `account.accountLinking` config present (default behavior in effect)
- Code audit of `server/src/middleware/rate-limit.ts` — verified factory pattern, `createStore` signature, `isE2E` declaration
- Code audit of `server/src/services/password.service.ts` — verified `verifyPassword` signature for p-limit wrapping
- Code audit of `server/src/db/connection.ts` — confirmed 3-line bare Pool, no existing config
- Code audit of `server/src/routes/__tests__/secrets.test.ts` — verified Supertest integration test pattern, `createUserAndSignIn` helper, `pool.end()` teardown
- Code audit of `server/src/workers/__tests__/expiration-worker.test.ts` — verified soft/hard delete test infrastructure exists (partial)
- Code audit of `vitest.config.ts` — confirmed multi-project setup, `fileParallelism: false`, `testTimeout: 10000`

### Secondary (MEDIUM confidence)
- p-limit v7.3.0 (GitHub releases) — pure ESM, Node.js 20+ required, `import pLimit from 'p-limit'` syntax
- Better Auth Context7 docs — account linking configuration options (`trustedProviders`, `allowDifferentEmails`)
- Web search: p-limit NodeNext TypeScript compatibility — ESM works with NodeNext module resolution without config changes

### Tertiary (LOW confidence — validate during implementation)
- pg Pool v8 `options` field for `statement_timeout` — documented in pg API but exact syntax for Pool constructor vs connectionString needs verification
- `express-rate-limit` v8 `onStoreError` hook existence — not confirmed; sendCommand wrapper fallback identified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project except p-limit (verified v7.3.0 release)
- Architecture patterns: HIGH — patterns directly derived from existing codebase code audit
- Pitfalls: HIGH for known patterns; MEDIUM for pg Pool `options` field syntax
- OAuth audit finding: HIGH — verified from Better Auth official docs + code audit

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable libraries; better-auth 1.x still iterating but account linking API is stable)
