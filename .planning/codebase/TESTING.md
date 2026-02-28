# Testing Patterns

**Analysis Date:** 2025-02-28

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.ts`
- Multi-project setup: client (happy-dom), server (node, sequential)

**Assertion Library:**
- Vitest assertions (no external library)
- Accessibility assertions: `vitest-axe` with `@axe-core/playwright`
- Matcher extensions: `expect.extend(matchers)` for axe violations

**Run Commands:**
```bash
npm test              # Watch mode (both projects)
npm run test:run      # Single run (both projects)
npx vitest run path/to/test.ts  # Single test file
npm run test:e2e      # Playwright E2E tests
```

## Test File Organization

**Location:**
- Server: Co-located with source in `__tests__/` subdirectory
  - `server/src/routes/__tests__/secrets.test.ts` (routes)
  - `server/src/workers/__tests__/expiration-worker.test.ts` (workers)
  - `server/src/services/notification.service.test.ts` (inline suffix)
- Client: Co-located with source in `__tests__/` subdirectory
  - `client/src/crypto/__tests__/encrypt.test.ts`
  - `client/src/__tests__/accessibility.test.ts`
  - `client/src/pages/register.test.ts` (inline suffix)

**Naming:**
- Pattern: `{module}.test.ts` or `{module}.spec.ts` (both detected)
- Matched by Vitest config: `include: ['client/src/**/*.test.ts']`, `include: ['server/src/**/*.test.ts']`

**Structure:**
```
server/src/
├── routes/
│   ├── secrets.ts
│   └── __tests__/
│       └── secrets.test.ts        # Tests for secrets route
├── services/
│   ├── secrets.service.ts
│   └── notification.service.test.ts  # Inline test file
└── workers/
    ├── expiration-worker.ts
    └── __tests__/
        └── expiration-worker.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

describe('POST /api/secrets', () => {
  // Setup for all tests in suite
  beforeAll(async () => {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS secrets (...)`);
  });

  // Cleanup before each test
  beforeEach(() => {
    app = buildApp();  // Fresh app per test
  });

  // Individual test
  test('creates secret and returns 21-char nanoid with 201 status', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
  });

  // Cleanup after each test
  afterEach(async () => {
    await db.delete(secrets);
  });

  // Cleanup after all tests
  afterAll(async () => {
    await pool.end();
  });
});
```

**Patterns:**

### Server Tests (Route/Integration)
- Fresh app per test via `beforeEach(() => { app = buildApp(); })`
- Database cleanup between tests: `afterEach(async () => { await db.delete(secrets); })`
- Rate limiter isolation: each fresh app gets its own MemoryStore, preventing test-to-test bleed
- Supertest for HTTP assertions: `request(app).post('/api/secrets').send(...).expect(201)`
- Database state validated after mutations: `await db.select().from(secrets).where(...)`
- Mock external services: `vi.mock('../../services/notification.service.js', ...)`

### Client Tests (Unit/Accessibility)
- Happy-DOM environment for DOM manipulation
- Container setup: `beforeEach(() => { container = document.createElement('div'); ... })`
- Container cleanup: `afterEach(() => { document.body.removeChild(container); })`
- Page render testing: `const { renderCreatePage } = await import('../pages/create.js')`
- Axe accessibility: `const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } })`
- Query selectors for assertions: `container.querySelector('h1')`, `container.querySelectorAll('h3')`

### Crypto Tests (Functional)
```typescript
describe('encrypt return shape', () => {
  it('returns an object with payload, key, and keyBase64Url', async () => {
    const result = await encrypt('hello');
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyBase64Url');
  });

  it('keyBase64Url is 43 characters and URL-safe', async () => {
    const result = await encrypt('hello');
    expect(result.keyBase64Url).toHaveLength(43);
    expect(result.keyBase64Url).toMatch(URL_SAFE_REGEX);
  });
});
```

**Test naming:**
- Describe blocks: action + resource: `'POST /api/secrets'`, `'encrypt return shape'`
- Test names: user-facing behavior + expected outcome: `'creates secret and returns 21-char nanoid with 201 status'`
- Omit "should": write `'returns 401'` not `'should return 401'`

## Mocking

**Framework:** Vitest `vi` (not Jest, compatible API)

**Patterns:**

### Mocking Service Dependencies
```typescript
vi.mock('../../services/notification.service.js', () => ({
  sendSecretViewedNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendSecretViewedNotification } from '../../services/notification.service.js';
// Now sendSecretViewedNotification is the mock
```

### Spying on Built-ins
```typescript
let getRandomValuesSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues');
});

it('calls crypto.getRandomValues at least once', () => {
  generatePassphrase();
  expect(getRandomValuesSpy).toHaveBeenCalledTimes(4);
});

afterEach(() => {
  getRandomValuesSpy.mockRestore();
});
```

**What to Mock:**
- External services (Resend, Stripe, Loops email) — avoid real HTTP calls
- Crypto randomness (only when testing the call pattern, not randomness itself)
- Database queries in unit tests (not used here — always use real DB for route tests)

**What NOT to Mock:**
- Database queries in route/integration tests — use real PostgreSQL
- Express middleware chain — test with real `buildApp()` to validate middleware order
- Crypto.subtle functions — test encryption/decryption end-to-end with real keys
- Zod validation — test real schema parsing to catch regressions

## Fixtures and Factories

**Test Data:**

### Server
```typescript
// Constants defined at module level
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';  // base64-encoded test blob
const MAX_PASSWORD_ATTEMPTS = 3;

// Helper function for test users
async function signUpAndGetCookie(email: string, password: string, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/sign-up/email').send({ email, password, name });
  expect(res.status).toBe(200);
  const cookies = Array.isArray(res.headers['set-cookie'])
    ? (res.headers['set-cookie'] as string[])
    : [res.headers['set-cookie']];
  const sessionCookie = cookies.find((c) => c.startsWith('better-auth.session_token='));
  return sessionCookie!;
}
```

### Client
```typescript
// Container setup
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.removeChild(container);
});
```

**Location:**
- Inline helper functions in test files (no shared fixtures directory)
- Test data constants at top of file
- Database cleanup via `beforeEach`/`afterEach`

## Coverage

**Requirements:** No minimum enforced

**View Coverage:**
```bash
npm run test:run -- --coverage
# Output: text reporter to stdout + json-summary to ./coverage/coverage-final.json
```

**Config:**
- Provider: v8
- Reporters: text (stdout), json-summary (file)
- Directory: `./coverage`

## Test Types

**Unit Tests:**
- Scope: Single function or module
- Approach: Test behavior in isolation (mocks for external deps)
- Examples:
  - `server/src/services/password.service.ts` — hash/verify functions
  - `client/src/crypto/encrypt.test.ts` — encrypt shape, IV uniqueness, padding

**Integration Tests:**
- Scope: Multiple modules interacting (but not full app flow)
- Approach: Real database, real middleware chains, but isolated test DB transactions
- Examples:
  - `server/src/routes/__tests__/secrets.test.ts` — HTTP requests to routes
  - `server/src/routes/__tests__/dashboard.test.ts` — authenticated dashboard operations
  - Database state assertions after mutations

**E2E Tests:**
- Framework: Playwright (not Vitest)
- Location: `e2e/specs/`
- Config: `e2e/playwright.config.ts`
- Command: `npm run test:e2e`
- Run against: Full running app (dev server + frontend)
- Scope: User journeys (create secret → share → reveal), login flows, payment flows

## Common Patterns

**Async Testing:**
```typescript
test('async operation completes', async () => {
  const result = await encrypt('hello');
  expect(result.keyBase64Url).toHaveLength(43);
});

// Database operations
test('inserts and retrieves secret', async () => {
  const secret = await createSecret('ciphertext', '1h');
  expect(secret.id).toHaveLength(21);
  
  const retrieved = await db.select().from(secrets).where(eq(secrets.id, secret.id));
  expect(retrieved).toHaveLength(1);
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

// Exception testing
test('wrong password throws ApiError', async () => {
  const res = await request(app)
    .post('/api/secrets/:id/verify')
    .send({ password: 'wrong' })
    .expect(400);

  expect(res.body.error).toBe('wrong_password');
  expect(res.body.attemptsRemaining).toBe(2);
});
```

**HTTP Request/Response Testing (Supertest):**
```typescript
test('POST creates and returns response with correct headers', async () => {
  const res = await request(app)
    .post('/api/secrets')
    .set('Content-Type', 'application/json')
    .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
    .expect(201)
    .expect('Content-Type', /json/);

  expect(res.body).toHaveProperty('id');
  expect(res.body).toHaveProperty('expiresAt');
});

// Checking response headers
expect(res.headers['set-cookie']).toBeDefined();

// Checking status
expect(res.status).toBe(201);
```

**DOM Querying (Happy-DOM):**
```typescript
test('page has correct heading structure', async () => {
  const { renderCreatePage } = await import('../pages/create.js');
  renderCreatePage(container);

  // Single element
  const h1 = container.querySelector('h1');
  expect(h1).not.toBeNull();
  expect(h1!.textContent).toBe('Create Secret');

  // Multiple elements
  const h3s = container.querySelectorAll('h3');
  expect(h3s.length).toBe(4);
});
```

**Accessibility Testing:**
```typescript
test('page has no accessibility violations', async () => {
  const { renderCreatePage } = await import('../pages/create.js');
  renderCreatePage(container);

  const results = await axe(container, {
    rules: { 'color-contrast': { enabled: false } },  // happy-dom can't compute styles
  });
  expect(results).toHaveNoViolations();
});
```

**Database Cleanup:**
```typescript
// Between tests
afterEach(async () => {
  await db.delete(secrets);
});

// Between test suites using a pattern
async function cleanupTestUsers() {
  await db.delete(users).where(like(users.email, '%@test-auth.example.com'));
  await db.delete(verification).where(like(verification.identifier, '%@test-auth.example.com'));
}

beforeEach(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
  await pool.end();
});
```

## Gotchas

**Rate Limiter Isolation:**
- Fresh `buildApp()` per test creates a new MemoryStore for rate limiters
- Old test data doesn't leak to new tests because each app has its own store

**Database Pool Cleanup:**
- Tests must call `await pool.end()` in `afterAll` to prevent hanging
- Prevents "vitest hangs" errors after test run completes

**Happy-DOM Limitations:**
- Color contrast checks disabled (happy-dom can't compute computed styles)
- Manual verification of contrast in design system
- DOM structure checks (headings, ARIA labels) work fine

**Middleware Order Testing:**
- Must use real `buildApp()` to test middleware chains
- Can't mock middleware ordering — test the actual app
- Example: `optionalAuth` must run before rate limiters so `res.locals.user` is set

**Mocking CJS Libraries:**
- `pino-http` is CJS; use explicit module namespace import and runtime type detection
- See `server/src/middleware/logger.ts` for workaround pattern

**Session Cookies:**
- Extract from `res.headers['set-cookie']` array
- Pattern: `cookies.find((c) => c.startsWith('better-auth.session_token='))`
- Pass back in subsequent requests: `.set('Cookie', sessionCookie)`

---

*Testing analysis: 2025-02-28*
