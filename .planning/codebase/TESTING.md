# Testing Patterns

**Analysis Date:** 2026-02-14

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in assertions (expect API, Jest-compatible)

**Run Commands:**
```bash
npx vitest              # Watch mode (default)
npx vitest run          # Run all tests once
npm test                # Alias for npx vitest
npm run test:run        # Alias for npx vitest run
```

## Test File Organization

**Location:**
- Co-located with source in `__tests__/` subdirectories
- Client tests: `client/src/crypto/__tests__/*.test.ts`
- Server tests: `server/src/routes/__tests__/*.test.ts`

**Naming:**
- Pattern: `<module-name>.test.ts`
- Examples: `encoding.test.ts`, `keys.test.ts`, `secrets.test.ts`

**Structure:**
```
client/src/crypto/
├── encoding.ts
├── keys.ts
└── __tests__/
    ├── encoding.test.ts
    ├── keys.test.ts
    └── ...

server/src/routes/
├── secrets.ts
└── __tests__/
    └── secrets.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('module or function name', () => {
  it('describes expected behavior in plain English', () => {
    // Arrange
    const input = new Uint8Array([72, 101, 108, 108, 111]);

    // Act
    const result = uint8ArrayToBase64Url(input);

    // Assert
    expect(result).toBe('SGVsbG8');
  });
});
```

**Patterns:**
- Use `describe()` blocks to group related tests by function/feature
- Use `it()` (not `test()`) for individual test cases
- Test descriptions are full sentences describing expected behavior
- Nested `describe()` blocks for subcategories (e.g., "edge cases", "validation")

**Server integration tests structure:**
```typescript
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';

beforeAll(async () => {
  // Setup: create tables, seed data
});

afterEach(async () => {
  // Cleanup: delete test data between tests
});

afterAll(async () => {
  // Teardown: close DB connections
});

describe('POST /api/secrets', () => {
  test('creates secret and returns 21-char nanoid with 201 status', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    expect(res.body.id).toHaveLength(21);
  });
});
```

## Mocking

**Framework:** Vitest built-in mocking (no separate library)

**Patterns:**
- Minimal mocking observed in current codebase
- Integration tests use real database connections
- API tests use Supertest with real Express app (no HTTP server started)

**What to Mock:**
- External services (not yet implemented in codebase)
- Time-dependent behavior (not yet in use)

**What NOT to Mock:**
- Database operations (use real DB in tests with cleanup)
- Crypto operations (use real Web Crypto API)
- Express middleware (use real middleware stack)

## Fixtures and Factories

**Test Data:**
```typescript
// Simple constants for valid inputs
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0'; // base64 "test ciphertext"
const URL_SAFE_REGEX = /^[A-Za-z0-9_-]+$/;
```

**Location:**
- Defined at top of test files (no separate fixtures directory)
- Constants for valid/invalid inputs declared before test suites

**Pattern for crypto tests:**
```typescript
// Generate real crypto values inline for each test
const original = new Uint8Array(32);
crypto.getRandomValues(original);
const encoded = uint8ArrayToBase64Url(original);
const decoded = base64UrlToUint8Array(encoded);
expect(decoded).toEqual(original);
```

## Coverage

**Requirements:** None enforced (no coverage thresholds in config)

**View Coverage:**
```bash
npx vitest run --coverage
```

**Current Status:**
- Phase 1 (crypto module): 100% coverage (all functions tested)
- Phase 2 (API routes): Integration tests cover all endpoints and success criteria

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation
- Location: `client/src/crypto/__tests__/*.test.ts`
- Examples: encoding, padding, key generation
- Pattern: Pure function input/output testing with no external dependencies

**Integration Tests:**
- Scope: Full API request/response cycle with real database
- Location: `server/src/routes/__tests__/*.test.ts`
- Examples: `POST /api/secrets`, `GET /api/secrets/:id`
- Pattern: Supertest + real Express app + real PostgreSQL database

**E2E Tests:**
- Not yet implemented (will be added in Phase 4 for frontend flows)

## Common Patterns

**Async Testing:**
```typescript
it('returns a CryptoKey from a base64url string', async () => {
  const { keyBase64Url } = await generateKey();
  const imported = await importKeyFromBase64Url(keyBase64Url);
  expect(imported).toBeInstanceOf(CryptoKey);
});
```

**Error Testing:**
```typescript
it('rejects an invalid base64url string on import', async () => {
  await expect(importKeyFromBase64Url('not-a-valid-key!!!')).rejects.toThrow();
});

it('rejects missing ciphertext with 400', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .send({ expiresIn: '24h' })
    .expect(400);

  expect(res.body.error).toBe('validation_error');
});
```

**Property-Based Testing:**
```typescript
it('should never produce +, /, or = characters in base64url output', () => {
  // Test with many random arrays to increase confidence
  for (let i = 0; i < 50; i++) {
    const size = Math.floor(Math.random() * 100) + 1;
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);
    const encoded = uint8ArrayToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  }
});
```

**Round-Trip Testing:**
```typescript
it('should round-trip: encode then decode produces identical Uint8Array', () => {
  const original = new Uint8Array([72, 101, 108, 108, 111]);
  const encoded = uint8ArrayToBase64Url(original);
  const decoded = base64UrlToUint8Array(encoded);
  expect(decoded).toEqual(original);
});
```

**Database Testing with Cleanup:**
```typescript
beforeAll(async () => {
  // Idempotent table creation
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      password_hash TEXT,
      password_attempts INTEGER NOT NULL DEFAULT 0
    )
  `);
});

afterEach(async () => {
  // Clean up test data between tests
  await db.delete(secrets);
});

afterAll(async () => {
  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});
```

**Supertest API Testing:**
```typescript
test('returns ciphertext on first retrieval with 200', async () => {
  // Create a secret
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);

  const { id } = createRes.body;

  // Retrieve it
  const getRes = await request(app)
    .get(`/api/secrets/${id}`)
    .expect(200);

  expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  expect(getRes.body.expiresAt).toBeDefined();
});
```

**Testing Security Invariants:**
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
  const consumedRes = await request(app).get(`/api/secrets/${id}`).expect(404);

  // GET a completely made-up 21-char ID -- nonexistent secret
  const nonexistentRes = await request(app)
    .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
    .expect(404);

  // Response bodies must be byte-identical (anti-enumeration)
  expect(consumedRes.body).toEqual(nonexistentRes.body);
});
```

**Uniqueness Testing:**
```typescript
it('two calls to generateKey produce different keyBase64Url values', async () => {
  const result1 = await generateKey();
  const result2 = await generateKey();
  expect(result1.keyBase64Url).not.toBe(result2.keyBase64Url);
});

it('10 calls to generateKey produce 10 unique keyBase64Url values', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => generateKey()),
  );
  const uniqueKeys = new Set(results.map((r) => r.keyBase64Url));
  expect(uniqueKeys.size).toBe(10);
});
```

**Parameterized Testing:**
```typescript
test('accepts all valid expiresIn options', async () => {
  for (const expiresIn of ['1h', '24h', '7d', '30d']) {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn })
      .expect(201);

    expect(res.body.id).toHaveLength(21);
  }
});
```

## Test Organization by Success Criteria

Integration tests organized with comment headers mapping to phase success criteria:

```typescript
// ---------------------------------------------------------------------------
// Success Criterion 1: POST /api/secrets stores and returns ID
// ---------------------------------------------------------------------------
describe('POST /api/secrets', () => { ... });

// ---------------------------------------------------------------------------
// Success Criterion 2: GET returns ciphertext exactly once, then deletes
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id', () => { ... });

// ---------------------------------------------------------------------------
// Success Criterion 3: Identical error responses (anti-enumeration)
// ---------------------------------------------------------------------------
describe('anti-enumeration', () => { ... });
```

## Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,                                      // No globals, explicit imports
    environment: 'node',                                 // Node.js environment
    include: ['client/src/**/*.test.ts', 'server/src/**/*.test.ts'],
    testTimeout: 10_000,                                 // 10 second timeout
    setupFiles: ['dotenv/config'],                       // Load env vars before tests
  },
});
```

**TypeScript config includes test globals:**
```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

---

*Testing analysis: 2026-02-14*
