# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Vitest 4.x with multi-project configuration
- Config: `vitest.config.ts`
- Globals disabled: explicit imports required (`describe`, `it`, `expect`, `beforeEach`, etc.)

**Assertion Library:**
- Vitest built-in (Chai-compatible API)
- Custom matchers via vitest-axe for accessibility: `expect.extend(matchers)`

**Run Commands:**
```bash
npm test                    # Watch mode (all tests)
npm run test:run            # Run once (CI mode, all tests)
npx vitest run path/to/test.ts  # Run single file
npx vitest --coverage       # Coverage report
```

## Test File Organization

**Location & Naming:**
- Client tests: `client/src/**/__tests__/*.test.ts` (happy-dom environment)
- Server tests: `server/src/**/__tests__/*.test.ts` (node environment, sequential)
- Pattern: `[source-name].test.ts` (e.g., `encrypt.test.ts` tests `encrypt.ts`)

**Directory Structure:**
```
server/src/
├── routes/
│   ├── secrets.ts
│   ├── health.ts
│   ├── me.ts
│   └── __tests__/
│       ├── secrets.test.ts
│       ├── security.test.ts
│       └── expiration.test.ts
├── services/
│   ├── secrets.service.ts
│   └── password.service.ts
└── workers/
    ├── expiration-worker.ts
    └── __tests__/
        └── expiration-worker.test.ts

client/src/
├── crypto/
│   ├── encrypt.ts
│   ├── decrypt.ts
│   ├── encoding.ts
│   ├── keys.ts
│   ├── padding.ts
│   └── __tests__/
│       ├── encrypt.test.ts
│       ├── decrypt.test.ts
│       ├── encoding.test.ts
│       ├── keys.test.ts
│       └── padding.test.ts
├── components/
│   └── __tests__/
│       └── icons.test.ts
└── __tests__/
    └── accessibility.test.ts
```

## Test Configuration

**Multi-Project Setup:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: false,
    testTimeout: 10_000,  // 10s for database operations
    setupFiles: ['dotenv/config'],  // Load .env for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
    projects: [
      {
        test: {
          name: 'client',
          include: ['client/src/**/*.test.ts'],
          environment: 'happy-dom',  // Light DOM polyfill
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/src/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,  // Sequential (shared PostgreSQL)
        },
      },
    ],
  },
});
```

**Global Settings:**
- `globals: false` — explicitly import `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `test`
- `testTimeout: 10_000` — 10 second timeout for database-heavy tests
- `setupFiles: ['dotenv/config']` — loads `.env` for real database connections

## Test Structure

**Standard Import Block:**
```typescript
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';  // HTTP testing
import type { Express } from 'express';
```

**Suite Organization:**
```typescript
describe('Feature name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  it('should do something', async () => {
    // Test body
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- Top-level `describe` groups organize by feature/endpoint (not function name)
- Server route tests use section separators for clarity:
  ```typescript
  // ---------------------------------------------------------------------------
  // Success Criterion 1: POST /api/secrets stores and returns ID
  // ---------------------------------------------------------------------------
  describe('POST /api/secrets', () => { ... });
  ```
- Nested `describe` blocks used sparingly (prefer flat structure)
- `it` descriptions are complete sentences: "returns ciphertext on first retrieval with 200"
- File header documents coverage scope:
  ```typescript
  /**
   * Tests for the encrypt module.
   *
   * Covers: return shape, IV prepending, key/IV uniqueness,
   * padding tier verification, edge cases (empty, large, unicode).
   */
  ```

## Integration Tests (Server)

**Database Setup:**
- Real PostgreSQL instance (not mocked)
- Connection via `DATABASE_URL` env var
- Schema created in `beforeAll`:
  ```typescript
  beforeAll(async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS secrets (
        id TEXT PRIMARY KEY,
        ciphertext TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        ...
      )
    `);
  });
  ```
- Data cleanup in `afterEach` isolates tests:
  ```typescript
  afterEach(async () => {
    await db.delete(secrets);  // Clear table
  });
  ```
- Pool closes in `afterAll`:
  ```typescript
  afterAll(async () => {
    await pool.end();  // Allow process to exit
  });
  ```

**Fresh App Per Test:**
```typescript
let app: Express;

beforeEach(() => {
  app = buildApp();  // Fresh app instance
  // Each instance has independent rate limiter state
});
```

**HTTP Testing Pattern (Supertest):**
```typescript
test('creates secret and returns 21-char nanoid with 201 status', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);

  expect(res.body.id).toHaveLength(21);
  expect(res.body.expiresAt).toBeDefined();
});
```

## Mocking

**Framework:** Vitest built-in (not used extensively)

**Philosophy:** Test behavior end-to-end rather than mock dependencies

**What NOT to Mock:**
- Database: use real PostgreSQL (server tests require `DATABASE_URL`)
- Web Crypto API: use happy-dom polyfill (client tests)
- Express middleware: test full request/response cycle
- HTTP layer: use supertest for real request simulation

**What Might Be Mocked (Future):**
- External services not yet implemented (currently none)
- Time-dependent behavior (not yet needed)

**Current Approach:**
- No mocking in client crypto tests (test real Web Crypto API)
- No mocking in server route tests (integration with real database)
- No vi.mock or vi.spyOn patterns in codebase

## Fixtures and Factories

**Test Data Pattern:**
```typescript
// Module-level constants
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';  // Base64 "test ciphertext"
const NONEXISTENT_ID = 'xxxxxxxxxxxxxxxxxxx01';   // 21 chars, never in DB
const URL_SAFE_REGEX = /^[A-Za-z0-9_-]+$/;
```

**Data Creation Pattern:**
- No factory functions
- Tests create data inline for simplicity:
  ```typescript
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);
  const { id } = createRes.body;
  ```

**Random Data Generation:**
```typescript
const original = new Uint8Array(32);
crypto.getRandomValues(original);  // Web Crypto, not Math.random()
```

**Fixture Location:**
- Test data lives at top of each test file
- No separate fixtures directory
- Constants are module-scoped

## Coverage

**Requirements:** None enforced via tooling

**View Coverage:**
```bash
npx vitest --coverage
# Outputs: text summary + JSON to ./coverage
```

**Current Coverage Areas:**
- Client crypto: 21+ tests across 5 files (encoding, keys, padding, encrypt, decrypt)
- Server routes: 50+ tests in `secrets.test.ts` (create, retrieve, password, anti-enumeration)
- Server workers: Tests in `expiration-worker.test.ts`
- Security: Tests in `security.test.ts` (CSP, rate limiting, HTTPS redirect)
- Accessibility: Tests in `accessibility.test.ts` (vitest-axe)

## Test Types

### Unit Tests

**Scope:** Pure functions tested in isolation
**Examples:** Encoding, padding, key generation

```typescript
// From client/src/crypto/__tests__/encrypt.test.ts
describe('encrypt return shape', () => {
  it('returns an object with payload, key, and keyBase64Url', async () => {
    const result = await encrypt('hello');
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyBase64Url');
  });
});
```

### Integration Tests

**Scope:** Full system with real database and HTTP layer
**Tool:** Supertest for request simulation
**Examples:** Route handlers, atomic transactions, password verification

```typescript
// From server/src/routes/__tests__/secrets.test.ts
describe('GET /api/secrets/:id', () => {
  test('returns ciphertext on first retrieval with 200', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;
    const getRes = await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  });

  test('returns 404 on second retrieval (atomic delete)', async () => {
    // ... setup ...
    await request(app).get(`/api/secrets/${id}`).expect(200);  // First: success
    await request(app).get(`/api/secrets/${id}`).expect(404);  // Second: consumed
  });
});
```

### Accessibility Tests

**Tool:** vitest-axe (axe-core rules)
**Environment:** happy-dom
**Note:** Color contrast disabled (happy-dom cannot compute styles)

```typescript
// From client/src/__tests__/accessibility.test.ts
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';

expect.extend(matchers);

describe('Create page accessibility', () => {
  it('has no accessibility violations', async () => {
    const { renderCreatePage } = await import('../pages/create.js');
    const container = document.createElement('div');
    renderCreatePage(container);

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results).toHaveNoViolations();
  });
});
```

### E2E Tests

**Status:** Not yet implemented
**Planned:** Playwright for browser-based testing
**Config:** `e2e/playwright.config.ts` (exists, ready to extend)

## Common Patterns

**Async Testing:**
```typescript
it('encrypts unicode/emoji string successfully', async () => {
  const result = await encrypt('Hello \u{1F30D}');
  expect(result.payload.ciphertext.length).toBeGreaterThan(0);
  expect(result.keyBase64Url).toHaveLength(43);
});
```

**Error Testing (Validation):**
```typescript
test('rejects missing ciphertext with 400', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .send({ expiresIn: '24h' })  // Missing ciphertext
    .expect(400);

  expect(res.body.error).toBe('validation_error');
  expect(res.body.details).toBeDefined();
});
```

**Error Testing (Business Logic):**
```typescript
test('returns 404 for nonexistent secret', async () => {
  const res = await request(app)
    .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
    .expect(404);

  expect(res.body.error).toBe('not_found');
  expect(res.body.message).toBe(
    'This secret does not exist, has already been viewed, or has expired.'
  );
});
```

**Round-Trip Testing:**
```typescript
it('should round-trip: encode then decode produces identical Uint8Array', () => {
  const original = new Uint8Array([72, 101, 108, 108, 111]);  // "Hello"
  const encoded = uint8ArrayToBase64Url(original);
  const decoded = base64UrlToUint8Array(encoded);
  expect(decoded).toEqual(original);
});
```

**Property-Based Testing (Loop):**
```typescript
it('should never produce +, /, or = characters in base64url output', () => {
  for (let i = 0; i < 50; i++) {
    const size = Math.floor(Math.random() * 100) + 1;
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    const encoded = uint8ArrayToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);  // URL-safe chars only
  }
});
```

**Database Transaction Verification:**
```typescript
test('secret is fully destroyed after retrieval -- no trace remains', async () => {
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);

  const { id } = createRes.body;

  // Retrieve via GET (consumes and destroys)
  await request(app).get(`/api/secrets/${id}`).expect(200);

  // Direct DB verification: row no longer exists
  const rows = await db
    .select()
    .from(secrets)
    .where(sql`${secrets.id} = ${id}`);

  expect(rows).toHaveLength(0);
});
```

**Anti-Enumeration Testing:**
```typescript
test('error response for consumed secret matches nonexistent secret exactly', async () => {
  // Create and consume a secret
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);

  const { id } = createRes.body;

  // First GET consumes it
  await request(app).get(`/api/secrets/${id}`).expect(200);

  // Second GET -- consumed secret
  const consumedRes = await request(app)
    .get(`/api/secrets/${id}`)
    .expect(404);

  // GET completely made-up 21-char ID -- nonexistent secret
  const nonexistentRes = await request(app)
    .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
    .expect(404);

  // Response bodies must be byte-identical (prevents enumeration)
  expect(consumedRes.body).toEqual(nonexistentRes.body);
  expect(consumedRes.body).toEqual({
    error: 'not_found',
    message: 'This secret does not exist, has already been viewed, or has expired.',
  });
});
```

**Password Protection Flow:**
```typescript
test('verifying wrong password returns 403 with attemptsRemaining', async () => {
  // Create password-protected secret
  const createRes = await request(app)
    .post('/api/secrets')
    .send({
      ciphertext: VALID_CIPHERTEXT,
      expiresIn: '24h',
      password: 'correct-password',
    })
    .expect(201);

  const { id } = createRes.body;

  // Get metadata (non-destructive)
  const metaRes = await request(app)
    .get(`/api/secrets/${id}/meta`)
    .expect(200);

  expect(metaRes.body.requiresPassword).toBe(true);
  expect(metaRes.body.passwordAttemptsRemaining).toBe(3);

  // Wrong password
  const verifyRes = await request(app)
    .post(`/api/secrets/${id}/verify`)
    .send({ password: 'wrong-password' })
    .expect(403);

  expect(verifyRes.body.error).toBe('wrong_password');
  expect(verifyRes.body.attemptsRemaining).toBe(2);
});
```

## Test Organization by Feature

**Client Crypto Tests** (`client/src/crypto/__tests__/`)
- `encoding.test.ts`: Base64/Base64URL, round-trip, URL-safe character validation
- `keys.test.ts`: Key generation, non-extractability, export/import
- `padding.test.ts`: PADME algorithm, tier selection, overhead verification
- `encrypt.test.ts`: Return shape, IV prepending, uniqueness guarantee, padding integration
- `decrypt.test.ts`: Full round-trip, error cases, padding removal

**Server Route Tests** (`server/src/routes/__tests__/`)
- `secrets.test.ts`: POST/GET endpoints, validation, atomic deletion, password protection, anti-enumeration
- `security.test.ts`: CSP header injection, rate limiting, HTTPS redirect
- `expiration.test.ts`: Expiration behavior, automatic cleanup

**Server Worker Tests** (`server/src/workers/__tests__/`)
- `expiration-worker.test.ts`: Scheduled cleanup, deletion of expired secrets

**Client Accessibility Tests** (`client/src/__tests__/`)
- `accessibility.test.ts`: Page structure (headings, sections, aria-labelledby), vitest-axe violations

## Test Debugging & Isolation

**Rate Limiter Isolation:**
- Fresh app per test: `app = buildApp()` in `beforeEach`
- Each instance has independent MemoryStore for rate limiting
- Prevents test bleed-through across suite

**Database Isolation:**
- Server tests run sequentially (`fileParallelism: false`)
- `afterEach` cleanup: `await db.delete(secrets)`
- Fresh transaction context for each operation

**Environment Variables:**
- `setupFiles: ['dotenv/config']` loads `.env` at test startup
- Avoids needing mocks for env-dependent code paths

---

*Testing analysis: 2026-02-20*
