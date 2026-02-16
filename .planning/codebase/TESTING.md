# Testing Patterns

**Analysis Date:** 2026-02-16

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in (Chai-compatible API)

**Run Commands:**
```bash
npm test              # Watch mode
npm run test:run      # Run once (CI mode)
npx vitest run path/to/test.ts  # Run single file
```

## Test File Organization

**Location:**
- Co-located in `__tests__/` subdirectories next to source
- Client tests: `client/src/crypto/__tests__/*.test.ts`
- Server tests: `server/src/routes/__tests__/*.test.ts`, `server/src/workers/__tests__/*.test.ts`
- Component tests: `client/src/components/__tests__/*.test.ts`

**Naming:**
- Pattern: `[source-name].test.ts`
- Examples:
  - `client/src/crypto/__tests__/encrypt.test.ts` tests `client/src/crypto/encrypt.ts`
  - `server/src/routes/__tests__/secrets.test.ts` tests `server/src/routes/secrets.ts`

**Structure:**
```
client/src/crypto/
├── encrypt.ts
├── decrypt.ts
├── encoding.ts
├── keys.ts
├── padding.ts
└── __tests__/
    ├── encrypt.test.ts
    ├── decrypt.test.ts
    ├── encoding.test.ts
    ├── keys.test.ts
    └── padding.test.ts
```

## Test Configuration

**Project-Based Setup:**
- Vitest projects separate client (happy-dom) from server (node) environments
- Config in `vitest.config.ts`:
  ```typescript
  projects: [
    {
      test: {
        name: 'client',
        include: ['client/src/**/*.test.ts'],
        environment: 'happy-dom',
      },
    },
    {
      test: {
        name: 'server',
        include: ['server/src/**/*.test.ts'],
        environment: 'node',
        fileParallelism: false,  // Server tests share PostgreSQL database
      },
    },
  ]
  ```

**Global Settings:**
- `globals: false` -- explicit imports required (no auto-injected `describe`, `it`, `expect`)
- `testTimeout: 10_000` -- 10 second timeout (database operations)
- `setupFiles: ['dotenv/config']` -- loads `.env` for integration tests

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';

describe('encrypt return shape', () => {
  it('returns an object with payload, key, and keyBase64Url', async () => {
    const result = await encrypt('hello');
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyBase64Url');
  });
});

describe('edge cases', () => {
  it('encrypts empty string successfully', async () => {
    const result = await encrypt('');
    expect(result.payload.ciphertext.length).toBeGreaterThan(0);
  });
});
```

**Patterns:**
- Top-level `describe` groups organize by feature/scenario (not by function name)
- Examples from `client/src/crypto/__tests__/encrypt.test.ts`:
  - `describe('encrypt return shape', ...)`
  - `describe('IV prepending', ...)`
  - `describe('uniqueness', ...)`
  - `describe('padding verification', ...)`
  - `describe('edge cases', ...)`
- Nested `describe` blocks used sparingly (prefer flat structure)
- `it` descriptions are complete sentences describing expected behavior
- File header comments document coverage scope:
  ```typescript
  /**
   * Tests for the encrypt module.
   *
   * Covers: return shape, IV prepending, key/IV uniqueness,
   * padding tier verification, edge cases (empty, large, unicode).
   */
  ```

## Integration Tests

**Server Tests:**
- Use real PostgreSQL database (not mocked)
- Connection via `DATABASE_URL` env var
- Schema setup in `beforeAll`:
  ```typescript
  beforeAll(async () => {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS secrets (...)
    `);
  });
  ```
- Cleanup in `afterEach` to isolate tests:
  ```typescript
  afterEach(async () => {
    await db.delete(secrets);
  });
  ```
- Close pool in `afterAll`:
  ```typescript
  afterAll(async () => {
    await pool.end();
  });
  ```

**HTTP Testing:**
- Supertest for request simulation
- Fresh app per test to isolate rate limiter state:
  ```typescript
  let app: Express;

  beforeEach(() => {
    app = buildApp();
  });

  test('creates secret', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);
  });
  ```

## Mocking

**Framework:** Vitest built-in mocking (not used extensively)

**Patterns:**
- **Client crypto tests:** No mocking -- test real Web Crypto API via happy-dom
- **Server tests:** No mocking -- integration tests use real database and HTTP stack
- **Philosophy:** Test behavior end-to-end rather than mock dependencies

**What to Mock:**
- External services not yet implemented (currently none)
- Time-dependent behavior (not yet used)

**What NOT to Mock:**
- Database (use real PostgreSQL for server tests)
- Web Crypto API (use happy-dom polyfill)
- Express middleware (test full request/response cycle)
- HTTP layer (use supertest, not mocked req/res)

## Fixtures and Factories

**Test Data:**
```typescript
// Constants at top of test file
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';  // Base64 "test ciphertext"
const URL_SAFE_REGEX = /^[A-Za-z0-9_-]+$/;
```

**Pattern:**
- Simple constants defined at module level
- No factory functions -- tests create data inline:
  ```typescript
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);
  ```
- Random data via `crypto.getRandomValues()`:
  ```typescript
  const original = new Uint8Array(32);
  crypto.getRandomValues(original);
  ```

**Location:**
- Test data lives at the top of each test file (not in separate fixtures directory)

## Coverage

**Requirements:** None enforced via tooling

**View Coverage:**
```bash
npx vitest --coverage
```

**Current Coverage:**
- Client crypto module: 21+ tests across 5 files (encoding, keys, padding, encrypt, decrypt)
- Server routes: 50+ tests in `secrets.test.ts` (creation, retrieval, password protection, anti-enumeration)
- Server workers: Tests in `expiration-worker.test.ts`
- Security: Tests in `security.test.ts`

## Test Types

**Unit Tests:**
- Client crypto functions tested in isolation
- Pure functions (encoding, padding) tested with property-based patterns:
  ```typescript
  it('should round-trip a 256-bit (32-byte) random array via base64url', () => {
    const original = new Uint8Array(32);
    crypto.getRandomValues(original);
    const encoded = uint8ArrayToBase64Url(original);
    const decoded = base64UrlToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });
  ```

**Integration Tests:**
- Server routes tested end-to-end with real database and HTTP
- Full request/response cycle via supertest
- Example from `server/src/routes/__tests__/secrets.test.ts`:
  ```typescript
  test('returns ciphertext on first retrieval with 200', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const getRes = await request(app)
      .get(`/api/secrets/${createRes.body.id}`)
      .expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  });
  ```

**E2E Tests:**
- Not yet implemented
- Planned: Playwright for browser-based end-to-end testing

## Common Patterns

**Async Testing:**
```typescript
it('encrypts unicode/emoji string successfully', async () => {
  const result = await encrypt('Hello \u{1F30D}');
  expect(result.payload.ciphertext.length).toBeGreaterThan(0);
  expect(result.keyBase64Url).toHaveLength(43);
});
```

**Error Testing:**
```typescript
test('rejects missing ciphertext with 400', async () => {
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

**Database Transaction Testing:**
```typescript
test('secret is fully destroyed after retrieval -- no trace remains', async () => {
  const createRes = await request(app)
    .post('/api/secrets')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
    .expect(201);

  await request(app)
    .get(`/api/secrets/${createRes.body.id}`)
    .expect(200);

  // Direct DB verification
  const rows = await db
    .select()
    .from(secrets)
    .where(sql`${secrets.id} = ${createRes.body.id}`);

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

  await request(app).get(`/api/secrets/${createRes.body.id}`).expect(200);

  // Second GET -- consumed secret
  const consumedRes = await request(app)
    .get(`/api/secrets/${createRes.body.id}`)
    .expect(404);

  // GET nonexistent secret
  const nonexistentRes = await request(app)
    .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
    .expect(404);

  // Response bodies must be identical
  expect(consumedRes.body).toEqual(nonexistentRes.body);
});
```

## Test Organization by Feature

**Client Crypto Tests:**
- `encoding.test.ts`: Base64/Base64URL encoding, round-trip, edge cases
- `keys.test.ts`: Key generation, export/import, non-extractability
- `padding.test.ts`: PADME algorithm, tier selection, overhead verification
- `encrypt.test.ts`: Return shape, IV prepending, uniqueness, padding integration
- `decrypt.test.ts`: Full encrypt/decrypt round-trip, error cases, padding removal

**Server Route Tests:**
- `secrets.test.ts`: POST/GET endpoints, validation, atomic deletion, password protection, anti-enumeration
- `expiration.test.ts`: Expiration behavior
- `security.test.ts`: CSP, rate limiting, HTTPS redirect

**Test Comments:**
- Section separators in long test files:
  ```typescript
  // ---------------------------------------------------------------------------
  // Success Criterion 1: POST /api/secrets stores and returns ID
  // ---------------------------------------------------------------------------
  describe('POST /api/secrets', () => { ... });
  ```

---

*Testing analysis: 2026-02-16*
