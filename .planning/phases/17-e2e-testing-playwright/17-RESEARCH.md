# Phase 17: E2E Testing with Playwright - Research

**Researched:** 2026-02-17
**Domain:** End-to-end browser testing, accessibility automation, Playwright test framework
**Confidence:** HIGH

## Summary

Playwright is the established standard for cross-browser E2E testing in the Node.js ecosystem. The project needs E2E tests that verify full user journeys (create-share-reveal, password-protected flow, error states) across Chromium, Firefox, and WebKit, plus automated accessibility checks via axe-core.

The primary challenge for this project is that secrets are **one-time-view and destructive** -- once retrieved, they are atomically deleted. This means each test needs a fresh secret, and tests cannot be retried against the same secret. The solution is to use Playwright's built-in `request` fixture to create secrets via the API as test setup, rather than going through the UI for every test. The UI-based create flow only needs testing once; the reveal/error flows should use API-created fixtures for reliability.

A second challenge is the URL fragment (`#key`) architecture. The encryption key lives in the URL fragment and is stripped by the reveal page immediately after extraction. Playwright's `page.goto()` supports URL fragments, so navigating to `/secret/{id}#{key}` works. However, `page.url()` does not include the hash, which affects assertions -- use `page.evaluate(() => location.hash)` instead if hash verification is needed.

**Primary recommendation:** Install `@playwright/test` and `@axe-core/playwright` as devDependencies. Configure a single `webServer` array launching both the Express backend (port 3000) and Vite dev server (port 5173) with proxy. Tests live in `e2e/` with `*.spec.ts` naming. Use API fixtures via Playwright's `request` context to create secrets before reveal/error tests. Run `test.describe.serial` for the create-share-reveal journey that must execute steps in order.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Playwright configured with separate e2e/ directory and *.spec.ts naming (no Vitest collision) | Vitest config only matches `**/*.test.ts` in client/server dirs. Playwright uses `e2e/` dir with `*.spec.ts`. Separate tsconfig for e2e needed. |
| TEST-02 | E2E test covers full create -> share -> reveal user journey | Serial test: fill textarea, submit, extract share URL from confirmation page, navigate to URL, click reveal, verify plaintext. Uses page interactions + URL fragment handling. |
| TEST-03 | E2E test covers password-protected secret flow | Same as TEST-02 but opens Advanced Options, enters password, then on reveal page enters password before viewing. |
| TEST-04 | E2E test covers error states (already viewed, expired, invalid link) | API fixtures create+consume secrets to produce "already viewed" state. Invalid link tests use fabricated URLs. Expired tests can use direct DB manipulation or short expiry. |
| TEST-05 | E2E tests use API fixtures for secret creation (one-time secrets are destructive) | Playwright's `request` fixture with `baseURL` creates secrets via POST /api/secrets. Custom fixture returns `{id, key}` for reveal tests. |
| TEST-06 | Playwright runs across Chromium, Firefox, and WebKit in CI | Multi-project config in playwright.config.ts with `devices['Desktop Chrome']`, `devices['Desktop Firefox']`, `devices['Desktop Safari']`. |
| TEST-07 | Automated accessibility checks (axe-core) run in Playwright E2E tests | `@axe-core/playwright` AxeBuilder scans each page state. Custom fixture for reusable axe configuration with WCAG 2.1 AA tags. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.58.0 | E2E test framework + runner | Official Playwright test runner with built-in assertions, fixtures, multi-browser, webServer |
| @axe-core/playwright | ^4.11.1 | Accessibility testing in Playwright | Official Deque axe-core integration for Playwright, provides AxeBuilder API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright (browsers) | (installed via npx playwright install) | Chromium, Firefox, WebKit browsers | Installed once after adding @playwright/test |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @playwright/test | Cypress | Playwright has native multi-browser (WebKit), better parallelism, built-in API testing fixtures |
| @axe-core/playwright | axe-playwright (community) | @axe-core/playwright is the official Deque package, better maintained |

**Installation:**
```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium firefox webkit
```

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── playwright.config.ts       # Playwright configuration (webServer, projects, baseURL)
├── tsconfig.json              # Separate tsconfig for E2E tests
├── fixtures/
│   ├── test.ts                # Extended test with API + axe fixtures
│   └── api-helpers.ts         # Secret creation helpers via API
├── specs/
│   ├── create-reveal.spec.ts  # TEST-02: Full create -> share -> reveal journey
│   ├── password-flow.spec.ts  # TEST-03: Password-protected secret flow
│   ├── error-states.spec.ts   # TEST-04: Error states (already viewed, expired, invalid)
│   └── accessibility.spec.ts  # TEST-07: axe-core accessibility checks on all pages
└── .gitignore                 # test-results/, playwright-report/ (or add to root .gitignore)
```

### Pattern 1: webServer Configuration (Two Servers)

**What:** Launch both Express backend and Vite dev server before tests.
**When to use:** Always -- E2E tests need both servers running.

The app uses Vite dev server (port 5173) with a proxy to Express (port 3000). For E2E tests, we need both running. However, there is a simpler alternative: build the client first, then run only the Express server which serves the built client from `client/dist/`. This is more production-realistic and requires only one webServer entry.

**Recommended approach -- production-like single server:**
```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false, // Sequential -- destructive one-time secrets
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker -- secrets are destructive, DB state matters
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build:client && npm run dev:server',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
      FORCE_HTTPS: 'false',
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

**Why single server:** The Express app already serves `client/dist/` when it exists (see `app.ts` lines 75-98). Building client first, then running dev:server gives us production-like behavior with CSP nonces injected at serve time. This is MORE realistic than Vite dev mode, requires only one webServer entry, and avoids proxy timing issues.

**Alternative approach -- two dev servers (Vite + Express):**
```typescript
webServer: [
  {
    command: 'npm run dev:server',
    url: 'http://localhost:3000/api/health',
    name: 'Backend',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  {
    command: 'npm run dev:client',
    url: 'http://localhost:5173',
    name: 'Frontend',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
],
use: {
  baseURL: 'http://localhost:5173', // Vite dev server with proxy
},
```

**Recommendation: Use the single-server approach.** It is production-realistic, simpler, and avoids the race condition of starting two servers.

### Pattern 2: API Fixture for Secret Creation (TEST-05)

**What:** Custom Playwright fixture that creates secrets via API, bypassing the browser UI.
**When to use:** For ALL reveal and error state tests. The UI create flow is tested once; everything else uses API fixtures.

```typescript
// e2e/fixtures/test.ts
import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Represents a secret created via API with its encryption key
interface CreatedSecret {
  id: string;
  key: string; // base64url encryption key for URL fragment
  url: string; // Full URL: /secret/{id}#{key}
}

type TestFixtures = {
  /** Create a secret via API. Returns id, key, and full URL. */
  createTestSecret: (options?: {
    plaintext?: string;
    expiresIn?: '1h' | '24h' | '7d' | '30d';
    password?: string;
  }) => Promise<CreatedSecret>;
  /** Create an AxeBuilder pre-configured with WCAG 2.1 AA tags */
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<TestFixtures>({
  createTestSecret: async ({ request }, use) => {
    const createFn = async (options?: {
      plaintext?: string;
      expiresIn?: '1h' | '24h' | '7d' | '30d';
      password?: string;
    }) => {
      const plaintext = options?.plaintext ?? 'Test secret for E2E';
      const expiresIn = options?.expiresIn ?? '1h';

      // Encrypt in Node.js using Web Crypto API (available in Node 20+)
      const keyData = crypto.getRandomValues(new Uint8Array(32));
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM' },
        true,
        ['encrypt'],
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoder = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(plaintext),
      );

      // Combine IV + ciphertext, base64 encode
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      const ciphertext = Buffer.from(combined).toString('base64');

      // Export key to base64url
      const rawKey = await crypto.subtle.exportKey('raw', key);
      const keyBase64Url = Buffer.from(rawKey)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Create via API
      const response = await request.post('/api/secrets', {
        data: {
          ciphertext,
          expiresIn,
          ...(options?.password ? { password: options.password } : {}),
        },
      });
      expect(response.ok()).toBeTruthy();
      const body = await response.json();

      return {
        id: body.id as string,
        key: keyBase64Url,
        url: `/secret/${body.id as string}#${keyBase64Url}`,
      };
    };
    await use(createFn);
  },

  makeAxeBuilder: async ({ page }, use) => {
    await use(() =>
      new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
      ]),
    );
  },
});

export { expect } from '@playwright/test';
```

**Key insight:** The fixture performs real AES-256-GCM encryption in Node.js (using the native Web Crypto API available in Node 20+), posts the ciphertext to the API, and returns the secret ID + encryption key. This mirrors exactly what the browser does, so the reveal page can decrypt successfully.

### Pattern 3: Serial Tests for Destructive Journeys

**What:** Use `test.describe.serial` for tests that must execute in order because they share destructive state.
**When to use:** The create-reveal journey where step 2 depends on step 1's output.

```typescript
// e2e/specs/create-reveal.spec.ts
import { test, expect } from '../fixtures/test';

test.describe.serial('Create and reveal secret', () => {
  let shareUrl: string;

  test('create a secret via UI', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Your secret').fill('My super secret message');
    await page.getByRole('button', { name: 'Create Secure Link' }).click();

    // Wait for confirmation page
    await expect(page.getByRole('heading', { name: 'Your Secure Link is Ready' }))
      .toBeVisible();

    // Extract the share URL from the confirmation page
    const urlCode = page.locator('code');
    shareUrl = await urlCode.textContent() as string;
    expect(shareUrl).toContain('/secret/');
    expect(shareUrl).toContain('#');
  });

  test('reveal the secret via share URL', async ({ page }) => {
    await page.goto(shareUrl);

    // Interstitial page
    await expect(page.getByRole('heading', { name: "You've received a secret" }))
      .toBeVisible();

    await page.getByRole('button', { name: 'Reveal Secret' }).click();

    // Revealed page
    await expect(page.getByRole('heading', { name: 'Secret Revealed' }))
      .toBeVisible();
    await expect(page.getByText('My super secret message')).toBeVisible();
  });

  test('secret is destroyed after viewing', async ({ page }) => {
    // Navigate to the same URL again
    await page.goto(shareUrl);

    // Should show error (secret already viewed)
    await expect(page.getByText('Secret Not Available')).toBeVisible();
  });
});
```

### Pattern 4: Accessibility Checks Per Page State

**What:** Run axe-core scans on each distinct page state.
**When to use:** Every page and significant state change (create, confirmation, interstitial, revealed, error, password entry).

```typescript
// e2e/specs/accessibility.spec.ts
import { test, expect } from '../fixtures/test';

test.describe('Accessibility', () => {
  test('create page has no critical violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/');
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('reveal interstitial has no critical violations', async ({
    page,
    createTestSecret,
    makeAxeBuilder,
  }) => {
    const secret = await createTestSecret();
    await page.goto(secret.url);

    // Wait for interstitial to render
    await expect(page.getByRole('heading', { name: "You've received a secret" }))
      .toBeVisible();

    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('error page has no critical violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/secret/invalidlinkxxxxxxxxx#fakekey');
    await expect(page.getByText('Secret Not Available')).toBeVisible();
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });
});
```

### Anti-Patterns to Avoid
- **Creating secrets through UI for every test:** Slow and brittle. Use API fixtures for all tests except the one that explicitly tests the create UI flow.
- **Parallel execution:** Secrets are one-time-view. Parallel tests would race for the same secrets. Use `workers: 1` and `fullyParallel: false`.
- **Asserting URL hash with `page.url()`:** `page.url()` does NOT include the URL fragment. Use `page.evaluate(() => location.hash)` if you need to check the hash.
- **Retrying reveal tests:** A failed reveal test consumes the secret. Retries will fail with "not found". Structure tests so reveal failures are diagnostic, not recoverable.
- **Sharing secrets between test files:** Each spec file should be self-contained. Use API fixtures to create fresh secrets per test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom puppeteer scripts | @playwright/test | Built-in test runner, assertions, fixtures, multi-browser |
| Accessibility scanning | Manual ARIA checking | @axe-core/playwright | Automated WCAG 2.1 AA compliance, 80+ rules |
| Test encryption | Separate crypto test library | Node.js native `crypto.subtle` | Node 20+ has Web Crypto API, same algorithm as browser |
| Server lifecycle | Custom start/stop scripts | Playwright webServer config | Handles startup, health check polling, shutdown |
| API test setup | fetch() calls in beforeAll | Playwright `request` fixture | Auto-configures baseURL, integrates with test lifecycle |

**Key insight:** Playwright's built-in fixtures (`request`, `page`, `context`) plus the webServer config handle all the infrastructure. The only custom code needed is the secret creation fixture that does real encryption.

## Common Pitfalls

### Pitfall 1: URL Fragment Not Included in page.url()
**What goes wrong:** Tests that assert `expect(page).toHaveURL(...)` will fail if the expected URL includes a `#fragment`, because Playwright's `page.url()` strips the hash.
**Why it happens:** This is a known Playwright limitation (issue #2247). The CDP/browser API does not expose the fragment in the URL getter.
**How to avoid:** Do not assert on URL fragments with `toHaveURL`. Use `page.evaluate(() => location.hash)` or `page.evaluate(() => location.href)` for full URL including fragment.
**Warning signs:** Tests pass locally but fragment assertions fail.

### Pitfall 2: Secrets Consumed by Failed Test Runs
**What goes wrong:** A test creates a secret, fails before revealing it, then on retry the secret is still available but the test state is wrong. Or: a test reveals a secret successfully but the assertion fails, and on retry the secret is gone.
**Why it happens:** Secrets are one-time-view. The GET endpoint atomically deletes the secret.
**How to avoid:** Create fresh secrets per test using API fixtures. Never share secrets between tests. Set `retries: 0` for local development (or accept that retries may fail for destructive tests).
**Warning signs:** Tests pass on first run, fail on retry.

### Pitfall 3: Confirmation Page is State-Based, Not URL-Based
**What goes wrong:** After creating a secret, the confirmation page renders in the same container without a URL change. If you try to navigate to the confirmation page directly, it does not exist.
**Why it happens:** The create page renders the confirmation page programmatically after successful API call (`renderConfirmationPage(container, shareUrl, expiresAt)`). The URL stays at `/`.
**How to avoid:** To test the create flow end-to-end, fill the form and submit. Wait for the confirmation heading to appear. Extract the share URL from the `<code>` element containing the URL.
**Warning signs:** Trying to `page.goto('/confirmation')` or similar -- this route does not exist.

### Pitfall 4: Reveal Page Strips URL Fragment Immediately
**What goes wrong:** Tests that navigate to a reveal URL and then try to read the hash will find it empty.
**Why it happens:** The reveal page's first action is `history.replaceState(null, '', pathname + search)` which strips the fragment. This is a security feature.
**How to avoid:** If you need to verify the key was received, do it via the outcome (successful decryption) rather than inspecting the URL.
**Warning signs:** Hash assertions are always empty on the reveal page.

### Pitfall 5: CSP Nonce Blocking Playwright Injected Scripts
**What goes wrong:** Playwright injects scripts into pages for automation. Strict CSP with nonce requirements can block these.
**Why it happens:** Helmet sets a strict CSP with nonce requirements. Playwright's injected scripts don't have the nonce.
**How to avoid:** Use `bypassCSP: true` in Playwright config `use` options. This tells the browser to ignore CSP restrictions.
**Warning signs:** Tests fail with console errors about CSP violations, scripts blocked.

### Pitfall 6: Vitest Picking Up E2E Tests
**What goes wrong:** Running `npm test` also runs Playwright spec files, causing failures.
**Why it happens:** Vitest might match `*.spec.ts` files if include patterns are too broad.
**How to avoid:** Current Vitest config only matches `client/src/**/*.test.ts` and `server/src/**/*.test.ts` -- this already excludes `e2e/`. Double-check that Vitest config does NOT include `e2e/` directory. Keep Playwright files as `*.spec.ts` (not `*.test.ts`).
**Warning signs:** Vitest reports unexpected test files or imports fail.

### Pitfall 7: WebServer Health Check URL Must Return 2xx-403
**What goes wrong:** Playwright waits forever for the server to start.
**Why it happens:** The webServer `url` option polls until it gets a 2xx, 3xx, 400, 401, 402, or 403 response. If the health endpoint is not accessible or returns 5xx, Playwright times out.
**How to avoid:** Use `/api/health` as the webServer URL. This endpoint returns 200 when the DB is connected. Ensure DATABASE_URL is set in the test environment.
**Warning signs:** "Timed out waiting for server" errors.

## Code Examples

### npm Script for E2E Tests

```json
{
  "scripts": {
    "test:e2e": "playwright test --config e2e/playwright.config.ts"
  }
}
```

### E2E tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Error State Tests Using API Fixtures

```typescript
// e2e/specs/error-states.spec.ts
import { test, expect } from '../fixtures/test';

test.describe('Error states', () => {
  test('already viewed secret shows error', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret();

    // First view -- consume the secret
    await page.goto(secret.url);
    await page.getByRole('button', { name: 'Reveal Secret' }).click();
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();

    // Second view -- should show error
    await page.goto(secret.url);
    await expect(page.getByText('Secret Not Available')).toBeVisible();
  });

  test('invalid link shows error', async ({ page }) => {
    // Fabricate a URL with valid-length ID but no real secret
    await page.goto('/secret/xxxxxxxxxxxxxxxxxxx01#somefakekey');
    await expect(page.getByText('Secret Not Available')).toBeVisible();
  });

  test('missing encryption key shows error', async ({ page, createTestSecret }) => {
    const secret = await createTestSecret();
    // Navigate WITHOUT the key fragment
    await page.goto(`/secret/${secret.id}`);
    await expect(page.getByText('Invalid Link')).toBeVisible();
  });
});
```

### Password Flow Test

```typescript
// e2e/specs/password-flow.spec.ts
import { test, expect } from '../fixtures/test';

test.describe('Password-protected secret flow', () => {
  test('create with password, reveal with correct password', async ({
    page,
    createTestSecret,
  }) => {
    const secret = await createTestSecret({
      plaintext: 'Password protected secret',
      password: 'mypassword123',
    });

    await page.goto(secret.url);

    // Should show password entry form
    await expect(page.getByRole('heading', { name: 'Password Required' })).toBeVisible();

    // Enter password and submit
    await page.getByLabel('Password').fill('mypassword123');
    await page.getByRole('button', { name: 'Verify Password' }).click();

    // Should reveal the secret
    await expect(page.getByRole('heading', { name: 'Secret Revealed' })).toBeVisible();
    await expect(page.getByText('Password protected secret')).toBeVisible();
  });

  test('wrong password shows error with attempts remaining', async ({
    page,
    createTestSecret,
  }) => {
    const secret = await createTestSecret({
      plaintext: 'Secret with password',
      password: 'correctpassword',
    });

    await page.goto(secret.url);
    await expect(page.getByRole('heading', { name: 'Password Required' })).toBeVisible();

    // Enter wrong password
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Verify Password' }).click();

    // Should show error with attempts remaining
    await expect(page.getByText('Wrong password')).toBeVisible();
    await expect(page.getByText('2 attempts remaining')).toBeVisible();
  });
});
```

### ESLint Configuration for E2E Tests

The ESLint config needs to include e2e files. Add a section for relaxed rules:

```typescript
// Addition to eslint.config.ts
{
  files: ['e2e/**/*.ts'],
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
  },
},
```

### .gitignore Additions

```
# Playwright
test-results/
playwright-report/
blob-report/
```

### .prettierignore Addition

No changes needed -- e2e files should be formatted by Prettier.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Selenium WebDriver | Playwright Test | 2020+ | Modern API, auto-wait, built-in assertions, multi-browser |
| Separate axe-core script | @axe-core/playwright AxeBuilder | 2021+ | Integrated into test assertions, per-page scanning |
| Manual server start before tests | webServer config in playwright.config.ts | Playwright 1.13+ | Automatic lifecycle management |
| PLAYWRIGHT_EXPERIMENTAL_TS_ESM env var | Native ESM support in Playwright | Playwright 1.44+ | TypeScript ESM works out of the box |
| Chromium only | Chrome for Testing builds | Playwright 1.58+ | Uses actual Chrome rather than Chromium for more accurate testing |

**Deprecated/outdated:**
- `port` option in webServer config: Use `url` instead (deprecated)
- `PLAYWRIGHT_EXPERIMENTAL_TS_ESM`: No longer needed, ESM is default

## Open Questions

1. **Expired secret testing approach**
   - What we know: Secrets can expire with `expiresIn: '1h'` minimum. No shorter option exists.
   - What's unclear: How to test expired secret error state without waiting 1 hour.
   - Recommendation: Either (a) add a test-only `expiresIn` value like `'1s'` behind a NODE_ENV=test guard, (b) directly set `expires_at` to past via DB query in test setup, or (c) skip this specific expired state test and rely on the API-level tests that already cover expiration. Option (c) is simplest and most pragmatic -- the server-side integration tests already verify expired secret behavior thoroughly.

2. **PADME padding in test fixtures**
   - What we know: The browser encrypt function applies PADME padding before encryption. The test fixture does not apply PADME padding.
   - What's unclear: Will the browser's decrypt function fail if ciphertext was not PADME-padded?
   - Recommendation: The decrypt function in the browser likely strips padding after decryption. If the Node.js fixture encryption (without PADME) produces ciphertext that the browser can still decrypt to the original text, no padding is needed in the fixture. If not, the fixture must replicate PADME padding. Testing will confirm -- start without padding, add if needed.

   **Update after code review:** The `decrypt.ts` module calls `unpadPlaintext()` after decryption which removes PADME padding. If the ciphertext was NOT PADME-padded, `unpadPlaintext()` may produce incorrect results. The fixture MUST replicate PADME padding to match the browser's encrypt behavior. The padding algorithm is in `client/src/crypto/padding.ts`.

## Sources

### Primary (HIGH confidence)
- [Playwright official docs - webServer](https://playwright.dev/docs/test-webserver) - Full webServer configuration with multiple servers, all options documented
- [Playwright official docs - accessibility testing](https://playwright.dev/docs/accessibility-testing) - AxeBuilder API, WCAG tags, fixtures pattern
- [Playwright official docs - API testing](https://playwright.dev/docs/api-testing) - request fixture, newContext(), baseURL configuration
- [Playwright official docs - fixtures](https://playwright.dev/docs/test-fixtures) - test.extend pattern, custom fixtures, mergeTests
- [Playwright official docs - parallel execution](https://playwright.dev/docs/test-parallel) - Serial mode, workers, fullyParallel

### Secondary (MEDIUM confidence)
- [npm @playwright/test](https://www.npmjs.com/package/@playwright/test) - Latest version 1.58.2
- [npm @axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright) - Latest version 4.11.1
- [Playwright GitHub issue #2247](https://github.com/microsoft/playwright/issues/2247) - page.url() does not include hash fragment

### Tertiary (LOW confidence)
- Community blog posts on Vite + Express + Playwright webServer patterns -- verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @playwright/test and @axe-core/playwright are the established standards, versions verified via npm
- Architecture: HIGH - webServer config, API fixtures, and serial mode are well-documented Playwright patterns
- Pitfalls: HIGH - URL fragment limitation verified via GitHub issue, CSP bypass is documented, destructive test patterns derived from Playwright's serial mode docs
- Secret creation fixture: MEDIUM - The encryption approach using Node.js Web Crypto is sound but PADME padding integration needs validation during implementation

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (Playwright releases monthly but API is stable)
