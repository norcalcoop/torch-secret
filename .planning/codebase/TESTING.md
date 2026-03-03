# Testing Patterns

**Analysis Date:** 2026-03-01

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Multi-project setup: client (happy-dom), server (node, sequential)

**Assertion Library:**
- Vitest assertions (built-in `expect()`)
- Accessibility assertions: `vitest-axe` with `@axe-core/playwright`

**Run Commands:**
```bash
npm test              # Watch mode (both projects)
npm run test:run      # Single run (both projects)
npx vitest run path/to/test.ts  # Single test file
npm run test:e2e      # Playwright E2E tests
```

## Test File Organization

**Location:**
- **Server tests:** Co-located with source in `__tests__/` subdirectory or inline
  - `server/src/routes/__tests__/secrets.test.ts` (routes)
  - `server/src/workers/__tests__/expiration-worker.test.ts` (workers)
  - `server/src/services/billing.service.test.ts` (inline suffix)
- **Client tests:** Co-located with source in `__tests__/` subdirectory or inline
  - `client/src/crypto/__tests__/encrypt.test.ts`
  - `client/src/__tests__/accessibility.test.ts`
  - `client/src/pages/register.test.ts` (inline suffix)

**Naming:**
- Pattern: `{module}.test.ts` or `{module}.spec.ts` (both detected)
- Matched by Vitest config: `include: ['client/src/**/*.test.ts']`, `include: ['server/src/**/*.test.ts']`

## Multi-Project Configuration

**Client Tests:**
- Environment: `happy-dom` (lightweight DOM implementation)
- Include: `client/src/**/*.test.ts`
- Tests: `client/src/crypto/__tests__/`, `client/src/pages/`, components
- Globals: browser

**Server Tests:**
- Environment: `node`
- Include: `server/src/**/*.test.ts`
- Tests: routes, services, workers
- Globals: node
- **Important:** `fileParallelism: false` — tests run sequentially
  - Multiple tests access same PostgreSQL instance
  - Serial execution prevents database race conditions

## Test Structure

**Basic Suite Pattern:**
```typescript
import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';

const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';
let app: Express;

beforeEach(() => {
  app = buildApp();  // Fresh app per test for rate limiter isolation
});

afterEach(async () => {
  await db.delete(secrets);  // Clean up test data
});

afterAll(async () => {
  await pool.end();  // Close DB pool to allow vitest to exit
});

describe('POST /api/secrets', () => {
  test('creates secret and returns 21-char nanoid with 201 status', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
    expect(res.body.expiresAt).toBeDefined();
  });
});
```

**Key Patterns:**
- Fresh app per test (`beforeEach`) to isolate rate limiter state (MemoryStore per instance)
- Database cleanup between tests (`afterEach`)
- Connection close after all tests (`afterAll`): `await pool.end()`
- Setup SQL tables idempotently: `CREATE TABLE IF NOT EXISTS secrets`
- Meaningful test names describing success criteria: "returns ciphertext on first retrieval with 200"

**Suite Organization:**
- `describe()` for feature grouping: "POST /api/secrets", "GET /api/secrets/:id", "anti-enumeration"
- `test()` for individual assertions (synonymous with `it()`)
- Hooks: `beforeAll()`, `beforeEach()`, `afterAll()`, `afterEach()`

## Mocking

**Framework:** Vitest's built-in `vi` module

**Module Mocking Pattern:**
```typescript
vi.mock('../../services/notification.service.js', () => ({
  sendSecretViewedNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendSecretViewedNotification } from '../../services/notification.service.js';

// Later: verify the mock was called
expect(sendSecretViewedNotification).toHaveBeenCalledOnce();
const [emailArg, dateArg] = vi.mocked(sendSecretViewedNotification).mock.calls[0];
expect(emailArg).toBe('user@example.com');
expect(dateArg).toBeInstanceOf(Date);
```

**Hoisted Mocks (for accessing in beforeEach):**
```typescript
const { mockUpdateContact } = vi.hoisted(() => ({
  mockUpdateContact: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../config/loops.js', () => ({
  loops: { updateContact: mockUpdateContact },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateContact.mockResolvedValue({ success: true });
});
```

**Clearing Mocks:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**What to Mock:**
- External services: Resend email, Stripe SDK, Loops SDK
- Database when testing middleware in isolation
- File system for config loading

**What NOT to Mock:**
- Real database (tests use PostgreSQL directly for integration testing)
- HTTP client (Supertest makes real requests to Express app)
- Crypto operations (Web Crypto API tested as-is)
- Auth sessions (Better Auth returns real session cookies)

## Fixtures and Factories

**Test Data:**
```typescript
// Constants for all tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';
const NONEXISTENT_ID = 'xxxxxxxxxxxxxxxxxxx01';

// Helper function to create test users
async function createUserAndSignIn(
  appInstance: Express,
  email: string,
  password: string,
  name: string,
): Promise<{ sessionCookie: string; userId: string }> {
  await request(appInstance)
    .post('/api/auth/sign-up/email')
    .send({ email, password, name })
    .expect(200);

  const signInRes = await request(appInstance)
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200);

  // Extract session cookie from headers
  const rawCookiesHeader = signInRes.headers['set-cookie'] as unknown;
  const rawCookies: string[] = Array.isArray(rawCookiesHeader)
    ? (rawCookiesHeader as string[])
    : typeof rawCookiesHeader === 'string'
      ? [rawCookiesHeader]
      : [];
  const sessionCookie = rawCookies
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('better-auth.session_token='));

  const userId = signInRes.body.user?.id as string;
  return { sessionCookie, userId };
}

// Helper to insert secrets directly (bypasses API)
async function insertTestSecret(opts: {
  userId: string | null;
  status?: 'active' | 'viewed' | 'expired' | 'deleted';
  label?: string;
  expired?: boolean;
}): Promise<string> {
  const id = nanoid();
  const expiresAt = opts.expired
    ? new Date(Date.now() - 60_000)
    : new Date(Date.now() + 86_400_000);

  await db.insert(secrets).values({
    id,
    ciphertext: VALID_CIPHERTEXT,
    expiresAt,
    userId: opts.userId,
    status: opts.status ?? 'active',
    label: opts.label ?? null,
  });

  return id;
}
```

**Location:**
- Fixtures defined at top of test file or in shared helper files
- Per-test factory functions defined inside describe blocks when test-specific

## Coverage

**Requirements:** No minimum enforced in CI

**View Coverage:**
```bash
npm run test:run      # Outputs text summary to console
cat coverage/coverage-final.json  # View JSON report
```

**Config:**
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json-summary'],
  reportsDirectory: './coverage',
}
```

## Test Types

**Unit Tests:**
- Scope: Single function or module with mocked dependencies
- Location: `client/src/crypto/__tests__/encrypt.test.ts`, `server/src/services/password.service.ts`
- Approach: Test pure functions with deterministic outputs
- Example: Encrypt produces valid base64, contains IV, matches expected size

**Integration Tests:**
- Scope: Full request-response cycle (API route → middleware → service → database)
- Location: `server/src/routes/__tests__/secrets.test.ts` (most server tests)
- Approach: Use Supertest + real database, mock only external services (Resend, Stripe)
- Example: POST /api/secrets → ciphertext stored → GET /:id retrieves and atomically deletes
- Database state validated after mutations: `await db.select().from(secrets).where(...)`

**E2E Tests:**
- Framework: Playwright (configured in `e2e/playwright.config.ts`)
- Run: `npm run test:e2e` (requires running app on localhost:3000)
- Coverage: Full user journeys in real browser
- Location: `e2e/` directory

## Common Patterns

**Async Testing:**
```typescript
test('async operation returns expected value', async () => {
  const result = await encrypt('hello');
  expect(result.payload.ciphertext.length).toBeGreaterThan(0);
});

// Fire-and-forget dispatch (allow promise to settle)
await new Promise((resolve) => setImmediate(resolve));
expect(sendSecretViewedNotification).toHaveBeenCalledOnce();
```

**HTTP Request Testing (Supertest):**
```typescript
test('POST creates and returns response with correct shape', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
    .expect(201);

  expect(res.body.id).toBeDefined();
  expect(res.body.id).toHaveLength(21);
  expect(res.body.expiresAt).toBeDefined();
});

// With headers
test('includes correct Content-Type', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .set('Content-Type', 'application/json')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
    .expect('Content-Type', /json/);
});
```

**Error Testing:**
```typescript
test('rejects invalid expiresIn with 400', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '2h' })
    .expect(400);

  expect(res.body.error).toBe('validation_error');
});

test('wrong password returns 403 with attemptsRemaining', async () => {
  const verifyRes = await request(app)
    .post(`/api/secrets/${id}/verify`)
    .send({ password: 'wrong-password' })
    .expect(403);

  expect(verifyRes.body).toEqual({
    error: 'wrong_password',
    attemptsRemaining: 2,
  });
});
```

**Mock Verification:**
```typescript
test('calls sendSecretViewedNotification on secret view', async () => {
  // Insert user secret with notify=true
  const secretId = nanoid();
  await db.insert(secrets).values({
    id: secretId,
    userId: userId,
    notify: true,
    ciphertext: VALID_CIPHERTEXT,
    expiresAt: new Date(Date.now() + 86_400_000),
    status: 'active',
  });

  // Trigger retrieval
  await request(app).get(`/api/secrets/${secretId}`).expect(200);

  // Allow fire-and-forget to resolve
  await new Promise((resolve) => setImmediate(resolve));

  // Assert mock was called
  expect(sendSecretViewedNotification).toHaveBeenCalledOnce();
  const [emailArg, dateArg] = vi.mocked(sendSecretViewedNotification).mock.calls[0];
  expect(emailArg).toBe('user@example.com');
  expect(dateArg).toBeInstanceOf(Date);
});
```

**Crypto Testing (Client):**
```typescript
test('encrypt produces different ciphertexts for same plaintext', async () => {
  const result1 = await encrypt('same text');
  const result2 = await encrypt('same text');
  // Fresh IV + key each time
  expect(result1.payload.ciphertext).not.toBe(result2.payload.ciphertext);
  expect(result1.keyBase64Url).not.toBe(result2.keyBase64Url);
});

test('decrypted plaintext matches original', async () => {
  const plaintext = 'hello world';
  const { payload, keyBase64Url } = await encrypt(plaintext);
  const decrypted = await decrypt(payload.ciphertext, keyBase64Url);
  expect(decrypted).toBe(plaintext);
});
```

**Database State Validation:**
```typescript
test('secret is fully destroyed after retrieval', async () => {
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
    .expect(201);

  const { id } = createRes.body;

  // Consume the secret
  await request(app).get(`/api/secrets/${id}`).expect(200);

  // Verify row no longer exists in database
  const rows = await db
    .select()
    .from(secrets)
    .where(sql`${secrets.id} = ${id}`);

  expect(rows).toHaveLength(0);
});
```

**Session Cookie Testing:**
```typescript
test('authenticated request includes session cookie', async () => {
  const { sessionCookie } = await createUserAndSignIn(
    app,
    'user@test.local',
    'password123',
    'Test User',
  );

  const res = await request(app)
    .get('/api/dashboard/secrets')
    .set('Cookie', sessionCookie)
    .expect(200);

  expect(res.body).toHaveProperty('secrets');
});
```

## Gotchas & Best Practices

**Rate Limiter Isolation:**
- Fresh `buildApp()` per test creates a new MemoryStore for rate limiters
- Test data doesn't leak because each app has its own store

**Database Pool Cleanup:**
- Tests must call `await pool.end()` in `afterAll` to prevent hanging
- Prevents "vitest hangs" errors after test run completes

**Middleware Order Testing:**
- Must use real `buildApp()` to test middleware chains
- Can't mock middleware ordering — test the actual app
- Example: rate limiting must run after optional auth

**Happy-DOM Limitations:**
- Color contrast checks disabled (happy-dom can't compute computed styles)
- DOM structure checks (headings, ARIA labels) work fine

**Session Cookie Extraction:**
- Extract from `res.headers['set-cookie']` array
- Pattern: `cookies.find((c) => c.startsWith('better-auth.session_token='))`
- Pass back in subsequent requests: `.set('Cookie', sessionCookie)`

---

*Testing analysis: 2026-03-01*
