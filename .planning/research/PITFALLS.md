# Pitfalls Research: Docker, CI/CD, E2E Testing, Linting, and Marketing Homepage

**Domain:** Production delivery infrastructure for a zero-knowledge secret sharing application
**Researched:** 2026-02-16
**Confidence:** HIGH for Docker/argon2, CSP/Playwright, CI service containers; MEDIUM for ESLint flat config migration, marketing page routing
**Scope:** Pitfalls specific to ADDING Docker containerization, GitHub Actions CI/CD, Playwright E2E tests, ESLint linting, and a marketing homepage to SecureShare -- an existing Express 5 + Vite 7 SPA with strict CSP nonces, Argon2id native binaries, Redis rate limiting, 163 Vitest tests, and zero-knowledge security requirements

---

## Critical Pitfalls

Mistakes that cause build failures, security regressions, or require rework of the approach.

### Pitfall 1: Argon2 Native Binary Fails in Alpine Docker Images

**What goes wrong:**
The `argon2` npm package (v0.44.0) ships prebuilt binaries compiled against glibc (Ubuntu 22.04). Alpine Linux uses musl libc, not glibc. When running `npm ci` inside an Alpine-based Docker image (`node:24-alpine`), the prebuilt binary fails to load with `Error: No native build was found for platform=linux arch=x64 runtime=node abi=... libc=musl`. The fallback is to compile from source, which requires `gcc`, `g++`, `make`, and `python3` -- none of which are present in Alpine by default. Without these build tools, the install fails entirely.

Even if build tools are installed in Alpine, the resulting image is 300-500MB larger than necessary, defeating the purpose of using Alpine. The build also takes 2-3 minutes longer.

**Why it happens:**
- Alpine is the default "slim" Docker choice for Node.js apps, and most tutorials use it
- node-argon2 prebuilt binaries target glibc-based Linux distributions only (Ubuntu, Debian)
- The error message is unclear -- it references "No native build found" without explaining the musl/glibc mismatch
- Developers who use macOS locally never encounter this because macOS prebuilts exist

**How to avoid:**
Use `node:24-slim` (Debian Bookworm-based, glibc) instead of `node:24-alpine`. The prebuilt argon2 binary loads without compilation. The image is ~50MB larger than Alpine but avoids all native compilation issues. For production, use a multi-stage build:

```dockerfile
# Stage 1: Install dependencies
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Build client
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:client

# Stage 3: Production image
FROM node:24-slim AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/client/dist ./client/dist
COPY package.json ./
COPY server/ ./server/
COPY shared/ ./shared/
COPY drizzle/ ./drizzle/
USER node
CMD ["node", "--import", "tsx", "server/src/server.ts"]
```

**Warning signs:**
- Docker build fails at `npm ci` with "No native build was found"
- Build succeeds locally but fails in CI
- Build succeeds but takes 5+ minutes (compiling from source)

**Phase to address:** Docker/containerization phase

---

### Pitfall 2: CSP Nonce-Based Headers Block Playwright Test Injection

**What goes wrong:**
Playwright injects scripts into pages for automation (locators, assertions, `page.evaluate()`). SecureShare's CSP header sets `script-src 'self' 'nonce-<random>'` with NO `unsafe-inline` and NO `unsafe-eval`. Playwright's injected scripts do not have the CSP nonce, so they are blocked by the browser's CSP enforcement. This causes Playwright actions to fail silently or throw timeout errors. The tests appear to hang rather than producing clear CSP violation messages.

Additionally, Playwright's `addScriptTag()` and `addStyleTag()` methods are also blocked by CSP, making it impossible to inject test utilities or modify page appearance for visual testing.

**Why it happens:**
- SecureShare intentionally has the strictest possible CSP -- nonce-only for scripts and styles
- Playwright's automation protocol operates below the CSP layer for most operations, but `page.evaluate()` and script injection go through the browser's content security enforcement
- Developers write tests that pass in apps without strict CSP and do not anticipate nonce-based blocking

**How to avoid:**
Set `bypassCSP: true` in the Playwright browser context configuration. This is a Playwright-specific option that tells Chromium/Firefox/WebKit to bypass Content Security Policy for the test context only.

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    bypassCSP: true,
    // ... other options
  },
});
```

**Important:** This does NOT weaken production CSP. It only affects the test browser context. The CSP headers are still sent by the server -- Playwright instructs the browser to not enforce them. This is the correct approach for E2E testing apps with strict CSP.

Do NOT "fix" this by loosening the production CSP (adding `unsafe-inline` or `unsafe-eval`). That would compromise the zero-knowledge security model.

Separately, write a dedicated CSP verification test that does NOT use `bypassCSP` to confirm the headers are present and correct:

```typescript
test('CSP headers are strict', async ({ request }) => {
  const response = await request.get('/');
  const csp = response.headers()['content-security-policy'];
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});
```

**Warning signs:**
- Playwright tests time out without clear error messages
- `page.evaluate()` calls throw "Execution context was destroyed"
- Tests pass locally in dev mode (Vite, no CSP) but fail against the Express server

**Phase to address:** E2E testing phase

---

### Pitfall 3: One-Time Secrets Destroy Test Data -- E2E Tests Are Non-Repeatable

**What goes wrong:**
SecureShare's core feature is that secrets are atomically destroyed after a single view (`SELECT -> zero ciphertext -> DELETE` in a transaction). E2E tests that create a secret and then reveal it consume the secret permanently. If a test fails after creating but before asserting on the reveal, the secret is gone and the test cannot be re-run against the same data. Worse, if tests run in parallel, one test may consume a secret created by another test.

This is fundamentally different from testing a CRUD app where data can be read repeatedly. Every "reveal" test is a destructive, irreversible operation.

**Why it happens:**
- The one-time-view is a core security requirement, not a bug
- Developers write E2E tests assuming data is stable and repeatable
- Playwright's default parallel execution means multiple workers share the same database
- There is no "preview" or "safe read" endpoint -- retrieval always destroys

**How to avoid:**
1. **Each test must create its own fresh secret.** Never share secrets between tests. Use a `beforeEach` or test fixture that creates a new secret via the API:

```typescript
// e2e/fixtures.ts
import { test as base } from '@playwright/test';

type SecretFixture = { secretUrl: string };

export const test = base.extend<SecretFixture>({
  secretUrl: async ({ request }, use) => {
    // Create a secret via API (bypassing the UI for speed)
    const encryptedPayload = await encryptTestPayload('test secret');
    const response = await request.post('/api/secrets', {
      data: { ciphertext: encryptedPayload, expiresIn: '1h' },
    });
    const { id } = await response.json();
    const url = `http://localhost:3000/secret/${id}#${testKey}`;
    await use(url);
    // No cleanup needed -- secret self-destructs
  },
});
```

2. **Use `fullyParallel: false` for tests that interact with the same database state** if isolation is not achievable through fixtures.

3. **Reset the database between test suites**, not between individual tests (too slow). Use a `globalSetup` that truncates the `secrets` table:

```typescript
// e2e/global-setup.ts
import pg from 'pg';
export default async function globalSetup() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('DELETE FROM secrets');
  await pool.end();
}
```

4. **Never test the reveal page by navigating to a hardcoded URL.** The secret ID changes every run.

**Warning signs:**
- E2E tests pass on first run but fail on second run
- Tests pass individually but fail when run together
- "Secret not found" errors in E2E test logs

**Phase to address:** E2E testing phase

---

### Pitfall 4: Vitest and Playwright File Pattern Collision

**What goes wrong:**
SecureShare has 163 existing Vitest tests matching `**/*.test.ts`. Playwright's default test pattern is also `**/*.test.ts` (or `**/*.spec.ts`). If Playwright tests are placed alongside or near existing tests, Vitest will attempt to run Playwright test files (which import from `@playwright/test`, not `vitest`) and fail with import errors. Conversely, if the Playwright test runner is pointed at a broad glob, it may try to run Vitest unit tests.

The `@playwright/test` package and Vitest also have conflicting global type definitions (`test`, `expect`, `describe`). If both are in scope, TypeScript will report type conflicts.

**Why it happens:**
- Both frameworks use `*.test.ts` by convention
- Vitest's project config includes `client/src/**/*.test.ts` and `server/src/**/*.test.ts`, which are currently safe but would break if someone adds a test file in the wrong directory
- TypeScript's `types` array in `tsconfig.json` includes `vitest/globals`, which conflicts with Playwright's types

**How to avoid:**
1. **Strict file naming convention:** All Playwright E2E tests use `*.spec.ts`, all Vitest unit/integration tests use `*.test.ts`. No exceptions.

2. **Separate directory:** Place all Playwright tests in `e2e/` at the project root, completely outside `client/` and `server/`:
```
secureshare/
  e2e/
    specs/
      create-secret.spec.ts
      reveal-secret.spec.ts
    fixtures.ts
    playwright.config.ts
  client/src/  (Vitest tests only)
  server/src/  (Vitest tests only)
```

3. **Separate TypeScript config for E2E:**
```json
// e2e/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "types": []  // Do NOT include vitest/globals
  },
  "include": ["./**/*.ts"]
}
```

4. **Explicit include patterns in vitest.config.ts** (already done -- the existing config uses `client/src/**/*.test.ts` and `server/src/**/*.test.ts`, which is correct).

5. **Separate npm scripts:**
```json
{
  "test": "vitest",
  "test:e2e": "playwright test --config e2e/playwright.config.ts"
}
```

**Warning signs:**
- Vitest reports "Cannot find module @playwright/test" errors
- Playwright reports "Cannot find module vitest" errors
- TypeScript shows duplicate `expect` or `test` type definitions

**Phase to address:** E2E testing phase (must be set up correctly from the start)

---

### Pitfall 5: CI Pipeline Exposes DATABASE_URL or Runs Tests Without Services

**What goes wrong:**
SecureShare's existing Vitest integration tests require a real PostgreSQL database (`server/src/routes/__tests__/secrets.test.ts` uses actual database connections, not mocks). The app also requires Redis for rate limiting. In GitHub Actions, three things commonly go wrong:

1. **Services not ready when tests start:** PostgreSQL and Redis containers are started via `services:` but the job steps begin immediately. The Node.js test runner connects before PostgreSQL finishes initialization, causing "connection refused" or "database does not exist" errors.

2. **DATABASE_URL hardcoded in workflow YAML:** Developers put the full connection string directly in the workflow file instead of using secrets, exposing credentials in the public repository.

3. **Missing database migrations:** Tests assume the schema exists, but CI starts with a fresh database. Without running `npm run db:migrate` before tests, all queries fail with "relation 'secrets' does not exist."

**Why it happens:**
- GitHub Actions `services:` starts containers in parallel with job steps -- `depends_on` behavior is not available
- Developers copy CI templates that use ephemeral credentials (acceptable for CI databases) but do not add health checks
- The migration step is forgotten because local development already has the schema

**How to avoid:**
```yaml
services:
  postgres:
    image: postgres:17
    env:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: secureshare_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd="pg_isready -U test"
      --health-interval=5s
      --health-timeout=5s
      --health-retries=5
  redis:
    image: redis:7
    ports:
      - 6379:6379
    options: >-
      --health-cmd="redis-cli ping"
      --health-interval=5s
      --health-timeout=5s
      --health-retries=5

env:
  DATABASE_URL: postgres://test:test@localhost:5432/secureshare_test
  REDIS_URL: redis://localhost:6379
  NODE_ENV: test
```

Key points:
- Health checks on BOTH services with `--health-retries=5` -- the job step will not start until both report healthy
- DATABASE_URL uses localhost because GitHub Actions runs services as sidecar containers accessible on localhost
- For CI, ephemeral credentials in the workflow file are acceptable (the database is created and destroyed per run) -- do NOT use GitHub Secrets for CI-only test databases
- Add `npm run db:migrate` as a step BEFORE `npm test`

**Warning signs:**
- CI fails with "connection refused" on first run but passes on retry
- CI fails with "relation 'secrets' does not exist"
- Different test results between local and CI

**Phase to address:** CI/CD phase

---

### Pitfall 6: ESLint Flat Config Assumes React -- TypeScript Rules Break Vanilla TS

**What goes wrong:**
Most ESLint + TypeScript tutorials and starter configs are React-focused. They include `eslint-plugin-react`, `eslint-plugin-react-hooks`, and `eslint-plugin-jsx-a11y`, which produce errors when applied to vanilla TypeScript files. Worse, many shared configs implicitly enable JSX parsing, which causes false positives on TypeScript files that use angle brackets for generics (e.g., `Array<string>` parsed as JSX).

Additionally, typescript-eslint's `strict-type-checked` config enables rules like `@typescript-eslint/no-unsafe-assignment` and `@typescript-eslint/no-unsafe-call` that produce hundreds of errors in an existing untyped codebase. Developers enable "strict" thinking it means "good defaults" and are overwhelmed.

**Why it happens:**
- React dominates the ESLint ecosystem -- "TypeScript ESLint setup" searches return React-first results
- ESLint v9 flat config is still relatively new; many copy-paste configs mix legacy and flat formats
- typescript-eslint's naming is confusing: `recommended` is lenient, `strict` is aggressive, `strict-type-checked` requires a running TypeScript program

**How to avoid:**
1. **Start with `recommended-type-checked`, not `strict-type-checked`.** The recommended config catches real bugs without overwhelming an existing codebase. Upgrade to strict later.

2. **Use a vanilla TypeScript config -- no React plugins:**
```typescript
// eslint.config.ts
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import vitestPlugin from '@vitest/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Vitest-specific rules for test files only
  {
    files: ['**/*.test.ts'],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  },
  // Ignore build output and node_modules
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'drizzle/**'],
  },
);
```

3. **Do NOT install or configure:** `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` -- this is a vanilla TypeScript project.

4. **Use `@vitest/eslint-plugin`** (the official Vitest ESLint plugin) scoped to test files only. Do not apply Vitest rules globally.

5. **Run ESLint with `--max-warnings 0` in CI** to catch new violations, but initially set `--max-warnings` to the current count to avoid blocking the entire team on day one.

**Warning signs:**
- ESLint reports JSX-related errors in `.ts` files
- Hundreds of type-safety errors on first run (too strict)
- ESLint config file uses `.eslintrc.json` format (legacy, not flat config)

**Phase to address:** Linting phase

---

### Pitfall 7: Docker Trust Proxy Misconfiguration Breaks Rate Limiting

**What goes wrong:**
SecureShare sets `app.set('trust proxy', 1)` to trust one proxy hop for correct `req.ip` resolution behind a reverse proxy. In a Docker deployment with Nginx as a reverse proxy, the request chain is: `Client -> Nginx -> Express`. With `trust proxy: 1`, Express reads `X-Forwarded-For` from Nginx to get the real client IP.

However, if the Docker Compose network introduces an additional hop (e.g., a load balancer or Docker's built-in DNS), `trust proxy: 1` may point to the wrong IP. Worse, if `trust proxy` is set too high (e.g., `true`, which trusts ALL proxies), an attacker can spoof `X-Forwarded-For` to bypass rate limiting entirely.

The failure mode is silent: rate limiting appears to work in testing (single-client) but fails in production because all requests appear to come from the Nginx container IP (e.g., `172.17.0.2`), making the rate limiter treat all users as one.

**Why it happens:**
- Docker networking adds hops that are not present in local development
- `trust proxy: 1` is correct for single-proxy setups but wrong for multi-hop
- The default Docker bridge network assigns internal IPs to containers
- Rate limiting uses `req.ip` which depends entirely on the trust proxy setting

**How to avoid:**
1. **Count the exact number of proxy hops in your Docker Compose setup.** If the chain is `Client -> Nginx -> Express`, use `trust proxy: 1`. If there is a load balancer: `Client -> LB -> Nginx -> Express`, use `trust proxy: 2`.

2. **Configure Nginx to set `X-Forwarded-For` correctly:**
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
```

3. **Never use `trust proxy: true`** (trusts everything -- allows spoofing).

4. **Add a health check endpoint that logs `req.ip`** to verify correct IP resolution:
```typescript
app.get('/health', (req, res) => {
  // Only log in non-production for debugging
  if (env.NODE_ENV !== 'production') {
    console.log('Client IP:', req.ip);
  }
  res.json({ status: 'ok' });
});
```

5. **Test rate limiting through the full Nginx -> Express chain** in Docker Compose, not just against Express directly.

**Warning signs:**
- All rate limit counters increment under the same IP key
- Rate limiting works locally but not in Docker
- `req.ip` returns `172.17.0.x` (Docker internal IP) instead of the real client IP

**Phase to address:** Docker/containerization phase

---

### Pitfall 8: Marketing Homepage Breaks SPA Routing or Creates Duplicate Content

**What goes wrong:**
SecureShare's current router handles `/` as the "create secret" page. Adding a marketing homepage introduces a conflict: should `/` be the marketing page or the create page? Three common mistakes:

1. **Marketing page at `/` replaces the create page:** Users who bookmark or share the homepage URL now land on marketing content instead of the app. Existing links to `secureshare.example.com/` break.

2. **Marketing page as server-rendered HTML at `/` with SPA at `/app`:** This breaks the SPA catch-all routing. The server must now distinguish between `/` (marketing, server-rendered) and `/app/*` (SPA, client-rendered with nonce injection). The CSP nonce replacement only happens for the SPA HTML template -- the marketing page needs its own nonce handling or its own CSP policy.

3. **Marketing page as a separate SPA route:** The marketing page is a heavy DOM with animations and content. The client-side router loads it every time, adding bundle size to the core secret-sharing flow. Marketing content changes frequently but the SPA requires a rebuild for every change.

**Why it happens:**
- The SPA was designed with `/` as the primary create page -- there was no marketing page in the original architecture
- Server-side rendered pages and SPA pages have different CSP nonce requirements
- Developers underestimate the complexity of mixing server-rendered and client-rendered pages

**How to avoid:**
The cleanest approach for SecureShare is to make the marketing homepage a client-side route within the existing SPA, using code-splitting to keep it out of the core bundle:

1. **Route `/` to the marketing page, move the create page to a sub-path (e.g., keep at `/` but within the marketing page, or use `/new`):**
```typescript
// router.ts
if (path === '/') {
  import('./pages/home.js')
    .then((mod) => mod.renderHomePage(container))
    .then(() => focusPageHeading());
} else if (path === '/new' || path === '/create') {
  import('./pages/create.js')
    .then((mod) => mod.renderCreatePage(container))
    .then(() => focusPageHeading());
}
```

2. **OR embed the create form directly on the marketing page** (most common pattern for single-purpose tools). The marketing homepage IS the product page -- hero section, trust signals, then the create form inline. This avoids the routing conflict entirely.

3. **Update the server-side SPA catch-all:** The existing `app.ts` code already handles all routes through the same HTML template with nonce injection. A new client-side route requires zero server changes.

4. **Ensure the marketing page is crawlable:** Since it is client-rendered, search engine crawlers must execute JavaScript to see it. Add server-side meta tags in the HTML template for the homepage route, or consider prerendering the marketing page at build time.

5. **Do NOT create a separate `marketing.html` template.** This introduces a second HTML file requiring separate CSP nonce handling, separate Vite build configuration, and duplicate build infrastructure.

**Warning signs:**
- Existing users cannot find the create form after the marketing page is added
- SEO meta tags show "Share a Secret" for the marketing page (wrong content)
- Marketing page loads the full SPA bundle including create/reveal page code
- CSP violations on the marketing page because nonce handling is missing

**Phase to address:** Marketing homepage phase

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip multi-stage Docker build | Faster initial Docker setup | 800MB+ production image (vs ~200MB with multi-stage), slow deployments, larger attack surface | Never for production |
| Use `docker-compose up` for CI instead of GitHub Actions services | Simpler CI config | Docker-in-Docker issues, slower CI, non-standard approach | Never for GitHub Actions CI |
| Disable ESLint type-checked rules | Avoids initial wave of errors | Missing type-safety bugs that existing TypeScript catches, inconsistent code quality | Only temporarily during migration (set deadline) |
| Skip E2E database isolation (shared state) | Faster test setup | Flaky tests, tests depend on execution order, parallelism impossible | Never |
| Put Playwright tests in `src/` alongside Vitest | Less directory juggling | Type conflicts, framework confusion, accidental cross-execution | Never |
| Use `unsafe-inline` in CSP for Playwright | Tests pass without `bypassCSP` | Production CSP weakened if someone forgets to remove it, false sense of security | Never -- use `bypassCSP` option instead |
| Static marketing page served outside SPA | No SPA router changes needed | Duplicate CSP handling, two HTML templates to maintain, inconsistent nonce injection | Only if marketing and app are truly separate domains |

---

## Integration Gotchas

Common mistakes when connecting components in this specific stack.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Argon2 + Docker Alpine | Using `node:24-alpine` base image | Use `node:24-slim` (Debian/glibc) -- argon2 prebuilts work |
| Playwright + CSP nonces | Tests fail silently on script injection | Set `bypassCSP: true` in playwright config |
| Playwright + one-time secrets | Reusing secret URLs across tests | Each test creates its own secret via API fixture |
| Vitest + Playwright | Both match `*.test.ts` files | Vitest uses `*.test.ts`, Playwright uses `*.spec.ts`, separate directories |
| ESLint + Vitest types | Vitest globals conflict with ESLint `no-undef` | Use `@vitest/eslint-plugin` scoped to test files |
| Express trust proxy + Docker | `req.ip` returns Docker internal IP | Count exact proxy hops, configure Nginx `X-Forwarded-For` |
| Redis + CI | Tests fail because Redis is not running | Add Redis service container with health check in GitHub Actions |
| Vite build + Docker | Running `vite build` in production image | Build in a separate stage, copy only `client/dist` to production |
| Database migrations + CI | Tests fail with "relation does not exist" | Run `npm run db:migrate` before `npm test` in CI |
| Marketing page + SPA catch-all | Server returns SPA HTML for marketing page with wrong meta | Use client-side routing for marketing, server-side meta tags for SEO |
| Docker + `node_modules` volume mount | Dev `node_modules` overrides container's `node_modules` | Use `.dockerignore` to exclude `node_modules`, or named volumes |
| Playwright + URL fragments (encryption keys) | `page.goto()` with `#fragment` -- fragment may not propagate | Verify `window.location.hash` in page context after navigation |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Single `docker-compose.yml` for all environments | Dev, test, and prod configs diverge, volume mounts in prod | Use `docker-compose.override.yml` for dev, base for prod | Immediately when deploying |
| Running Vitest and Playwright sequentially in CI | CI takes 10+ minutes | Run in parallel jobs, Vitest first (fast), Playwright second (slow) | At ~200 tests total |
| No Docker layer caching in CI | Every CI run reinstalls all npm packages | Use GitHub Actions cache for `~/.npm` and Docker layer cache | First CI run takes 5+ minutes |
| Playwright tests against Vite dev server | Tests are slow (HMR overhead), inconsistent with production | Build client, start Express, test against production-like server | Always -- dev server behavior differs from production |
| Full E2E for every PR | CI takes 15+ minutes, developers skip waiting | Run unit tests on every push, E2E only on PR merge or nightly | At ~50 E2E tests |

---

## Security Mistakes

Domain-specific security issues when adding production infrastructure to a zero-knowledge app.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging secret IDs in CI output | Secret URLs discoverable in public CI logs | Existing pino redaction handles this, but verify Playwright test output does not log URLs |
| `.env` file in Docker image | Database credentials, Redis URL exposed if image is published | Use `.dockerignore` to exclude `.env`, pass environment variables at runtime |
| `bypassCSP` leaking to production | CSP protections disabled for all users | `bypassCSP` is a Playwright test option, not an Express setting -- verify CSP headers in a dedicated test |
| Docker image runs as root | Container compromise gives root access | Add `USER node` in Dockerfile (Node.js images include a `node` user) |
| Playwright screenshots capture secrets | Revealed secrets visible in CI artifacts | Mask or skip screenshots on reveal page, or use `expect(page).toHaveScreenshot()` only on non-secret pages |
| GitHub Actions secrets in PR from forks | Fork PRs cannot access repo secrets, tests fail | Use `pull_request_target` carefully, or run E2E only on push to main |
| Marketing page includes analytics/tracking | Third-party scripts can access URL fragments (encryption keys) | Never add any third-party scripts -- CSP blocks them, but do not weaken CSP |
| Docker Compose exposes PostgreSQL port publicly | Database accessible from outside the Docker network | Bind to `127.0.0.1:5432:5432` instead of `5432:5432` in production |

---

## UX Pitfalls

User experience mistakes when adding production infrastructure features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Marketing page buries the create form | Users who want to share a secret immediately must scroll or click through | Put the create form above the fold on the marketing page, or make it the first interactive element |
| Docker health check returns 200 before migrations run | Load balancer routes traffic to an instance that cannot serve requests | Health check should verify database connectivity: `SELECT 1` in the health endpoint |
| Long E2E test suite blocks deployment | Developers wait 15+ minutes for feedback | Separate CI: fast checks (lint, types, unit) must pass before E2E runs |
| ESLint warnings flood developer output | Developers ignore all warnings, including important ones | Start with zero warnings policy (`--max-warnings 0`) from day one, use error-level rules only |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Docker build:** Image starts, but argon2 crashes on first password hash -- test a POST with password in container
- [ ] **CI pipeline:** Tests pass, but migrations were not run -- the test database was pre-seeded from a previous run's cache
- [ ] **Playwright setup:** Tests pass against Vite dev server, but fail against production Express (CSP, nonce replacement, static file serving)
- [ ] **ESLint config:** Linting passes, but `tsconfig.json` project references are wrong -- type-checked rules silently skip files
- [ ] **Marketing page:** Page renders, but SEO meta tags still show "Share a Secret" instead of marketing copy for crawlers
- [ ] **Docker Compose:** Services start, but Express connects to local PostgreSQL (not the container) because `DATABASE_URL` is still set in `.env`
- [ ] **Rate limiting in Docker:** Works locally, but all Docker requests share one IP -- rate limiter blocks everyone or no one
- [ ] **Playwright in CI:** Tests pass locally but fail in CI because CI runs headless and screen resolution differs (visual tests fail)
- [ ] **E2E secret creation:** Test creates secret via UI, but encryption uses Web Crypto API which requires secure context -- ensure test server uses `localhost` (treated as secure)
- [ ] **ESLint + existing code:** Config is valid, but 200+ pre-existing errors mean ESLint is effectively disabled because developers ignore it

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Argon2 fails in Docker (Pitfall 1) | LOW | Change base image from Alpine to Slim in Dockerfile, rebuild |
| CSP blocks Playwright (Pitfall 2) | LOW | Add `bypassCSP: true` to Playwright config, re-run |
| Test data contamination (Pitfall 3) | MEDIUM | Truncate secrets table, refactor tests to use fixtures, re-run |
| Vitest/Playwright collision (Pitfall 4) | MEDIUM | Rename files (`.test.ts` -> `.spec.ts`), move to separate directory, update configs |
| CI database not ready (Pitfall 5) | LOW | Add health checks to service containers, re-run |
| ESLint too strict (Pitfall 6) | LOW | Switch from `strict-type-checked` to `recommended-type-checked` |
| Trust proxy wrong (Pitfall 7) | LOW | Adjust `trust proxy` value, restart Express |
| Marketing page routing conflict (Pitfall 8) | HIGH | Requires rethinking URL structure, updating existing links, potential redirect setup |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Argon2 Alpine failure (1) | Docker/containerization | `docker build` succeeds AND `docker run` + POST with password works |
| CSP blocks Playwright (2) | E2E testing setup | Playwright tests pass against Express server (not just Vite dev) |
| One-time secret test isolation (3) | E2E testing setup | Tests pass when run in parallel (`--workers=4`) |
| Vitest/Playwright collision (4) | E2E testing setup | `npm test` runs only Vitest, `npm run test:e2e` runs only Playwright |
| CI database services (5) | CI/CD pipeline | CI passes on first run against a fresh runner (no cache) |
| ESLint React assumptions (6) | Linting setup | `npm run lint` produces zero React-related errors on vanilla TS files |
| Trust proxy in Docker (7) | Docker/containerization | Rate limiting correctly identifies distinct client IPs through Nginx |
| Marketing page routing (8) | Marketing homepage | `/` serves marketing content, create form is accessible, existing `/secret/:id` links work |

---

## Sources

### Docker and Native Binaries
- [node-argon2 Alpine Linux compatibility issue](https://github.com/ranisalt/node-argon2/issues/223) -- HIGH confidence, GitHub issue
- [node-argon2 prebuilt binaries documentation](https://www.npmjs.com/package/argon2) -- HIGH confidence, npm docs
- [node-argon2 release workflow](https://github.com/ranisalt/node-argon2/blob/master/.github/workflows/release.yml) -- HIGH confidence, builds for glibc only
- [Docker Compose health checks guide](https://www.tvaidyan.com/2025/02/13/health-checks-in-docker-compose-a-practical-guide/) -- MEDIUM confidence, community guide

### Playwright and CSP
- [Playwright bypassCSP option](https://playwright.dev/docs/api/class-testoptions#test-options-bypass-csp) -- HIGH confidence, official docs
- [Playwright bypassCSP bug report](https://github.com/microsoft/playwright/issues/20078) -- HIGH confidence, GitHub issue
- [Playwright test isolation](https://playwright.dev/docs/browser-contexts) -- HIGH confidence, official docs
- [Playwright database isolation discussion](https://github.com/microsoft/playwright/issues/33699) -- MEDIUM confidence, GitHub issue

### ESLint Flat Config
- [ESLint flat config migration guide](https://eslint.org/docs/latest/use/configure/migration-guide) -- HIGH confidence, official docs
- [typescript-eslint shared configs](https://typescript-eslint.io/users/configs/) -- HIGH confidence, official docs
- [ESLint defineConfig and extends](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) -- HIGH confidence, official blog
- [vitest-dev/eslint-plugin-vitest](https://github.com/vitest-dev/eslint-plugin-vitest) -- HIGH confidence, official repo

### CI/CD
- [GitHub Actions PostgreSQL service containers](https://docs.github.com/actions/guides/creating-postgresql-service-containers) -- HIGH confidence, official docs
- [GitHub Actions Redis service containers](https://docs.github.com/en/actions/using-containerized-services/creating-redis-service-containers) -- HIGH confidence, official docs
- [GitHub Actions secrets management](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions) -- HIGH confidence, official docs
- [Postgres and Redis in GitHub Actions](https://sevic.dev/notes/postgres-redis-github-actions/) -- MEDIUM confidence, community guide

### Vite CSP Nonce
- [Vite html.cspNonce documentation](https://vite.dev/config/shared-options) -- HIGH confidence, official docs
- [Vite CSP nonce limitations for SPA](https://github.com/vitejs/vite/issues/20531) -- HIGH confidence, GitHub issue
- [Vite CSP production issues](https://github.com/vitejs/vite/issues/16749) -- HIGH confidence, GitHub issue

### Express and Docker
- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html) -- HIGH confidence, official docs
- [Vitest and Playwright coexistence](https://github.com/vitest-dev/vitest/issues/3807) -- HIGH confidence, GitHub issue
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) -- HIGH confidence, official docs

---
*Pitfalls research for: SecureShare v3.0 Production-Ready Delivery (Docker, CI/CD, E2E, Linting, Marketing)*
*Researched: 2026-02-16*
*Supersedes: Previous PITFALLS.md covering UI redesign pitfalls (v2.0)*
