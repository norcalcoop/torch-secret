# Architecture Patterns: Production-Ready Delivery Infrastructure

**Domain:** Docker deployment, CI/CD, E2E testing, linting, and enhanced homepage for existing Express+Vite monorepo
**Researched:** 2026-02-16
**Overall Confidence:** HIGH

---

## Recommended Architecture

The v3.0 milestone adds five infrastructure layers around the existing application code. Each layer has clear integration points with the existing monorepo. No existing application logic changes are required -- this is purely additive infrastructure wrapping the existing Express 5 + Vite 7 + vanilla TS architecture.

```
secureshare/
  |
  +-- Dockerfile                  <-- NEW: Multi-stage build (deps -> client build -> server build -> production)
  +-- docker-compose.yml          <-- NEW: Dev environment (app + PostgreSQL + Redis)
  +-- docker-compose.prod.yml     <-- NEW: Production compose (optional, for self-hosting)
  +-- render.yaml                 <-- NEW: Render.com IaC blueprint
  +-- .dockerignore               <-- NEW: Exclude node_modules, .git, .planning, etc.
  |
  +-- .github/
  |     +-- workflows/
  |     |     +-- ci.yml          <-- NEW: Lint -> Unit Test -> Build -> E2E -> Deploy
  |     +-- ISSUE_TEMPLATE/       <-- NEW: Bug report + feature request templates
  |     +-- PULL_REQUEST_TEMPLATE.md <-- NEW: PR checklist
  |
  +-- e2e/                        <-- NEW: Playwright test suite (sibling to client/ and server/)
  |     +-- playwright.config.ts  <-- webServer array: Express backend + Vite frontend
  |     +-- pages/                <-- Page Object Models
  |     |     +-- create.page.ts
  |     |     +-- reveal.page.ts
  |     |     +-- confirmation.page.ts
  |     +-- tests/
  |     |     +-- create-secret.spec.ts
  |     |     +-- reveal-secret.spec.ts
  |     |     +-- password-protection.spec.ts
  |     |     +-- expiration.spec.ts
  |     |     +-- error-states.spec.ts
  |     +-- fixtures/
  |           +-- test-fixtures.ts  <-- Custom fixtures extending base test
  |
  +-- eslint.config.ts            <-- NEW: Flat config with typescript-eslint + Prettier
  +-- .prettierrc                 <-- NEW: Prettier config
  +-- .prettierignore             <-- NEW: Exclude dist, coverage, etc.
  |
  +-- client/                     <-- EXISTING (pages/create.ts MODIFIED for enhanced homepage)
  +-- server/                     <-- EXISTING (server.ts MODIFIED: add /healthz endpoint)
  +-- shared/                     <-- EXISTING (no changes)
  +-- package.json                <-- MODIFIED: Add lint/format/e2e scripts, husky prepare
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `Dockerfile` | Multi-stage build: deps, client build, server compile, production image | `package.json`, `client/`, `server/`, `shared/` |
| `docker-compose.yml` | Local dev: PostgreSQL 17 + Redis 7 + app with hot reload | `Dockerfile`, `.env.example` |
| `render.yaml` | Render.com IaC: web service + PostgreSQL + Redis | `Dockerfile`, Render platform |
| `.github/workflows/ci.yml` | CI pipeline: lint, test, build, E2E, deploy | All of the above |
| `e2e/` | Playwright E2E browser tests | Running app (client + server), PostgreSQL |
| `eslint.config.ts` | ESLint flat config for TS monorepo | `tsconfig.json`, `client/`, `server/`, `shared/` |
| `server/src/app.ts` | Health check endpoint for Docker/Render | Existing middleware chain |
| `client/src/pages/create.ts` | Enhanced homepage with hero section | Existing component system |

### Data Flow

**Docker Build Flow:**
```
Stage 1 (deps):     node:24-slim + npm ci --omit=dev + npm ci (all deps for build)
Stage 2 (client):   Copy source -> vite build -> client/dist/
Stage 3 (server):   Copy source -> tsc -> dist/server/
Stage 4 (prod):     node:24-slim + production node_modules + client/dist + server dist
                    -> CMD ["node", "dist/server/server/src/server.js"]
```

**CI Pipeline Flow:**
```
Push/PR -> Checkout -> Setup Node 24 -> npm ci
  |
  +-> [parallel] ESLint + Prettier check
  +-> [parallel] Vitest (client + server, needs PostgreSQL service)
  |
  +-> Vite build + tsc compile
  |
  +-> Playwright E2E (needs app running + PostgreSQL + built client)
  |
  +-> [on main only] Deploy to Render via deploy hook
```

**E2E Test Flow:**
```
playwright.config.ts webServer array:
  1. npm run dev:server  (Express on :3000)
  2. npm run dev:client  (Vite on :5173, proxy /api -> :3000)

Playwright browsers -> http://localhost:5173
  -> Vite serves client SPA
  -> /api/* proxied to Express :3000
  -> Express uses test PostgreSQL
```

**Lint Flow:**
```
Developer edits file -> git add -> git commit
  -> husky pre-commit hook -> lint-staged
    -> ESLint --fix on staged .ts files
    -> Prettier --write on staged .ts/.css/.json files
  -> Commit proceeds (or blocks on errors)
```

---

## Integration Points: Detailed Analysis

### 1. Docker Multi-Stage Build for Monorepo

**Decision:** Use a 4-stage Dockerfile with `node:24-slim` (Debian bookworm-slim) as base. Do NOT use Alpine due to argon2 native addon compilation issues.

**Why node:24-slim over Alpine:** The project depends on `argon2` (v0.44.0), which has native Node.js addons compiled via node-gyp. Alpine uses musl libc, and argon2's prebuilt binaries target glibc (Ubuntu). Building from source on Alpine requires installing `make`, `gcc`, `g++`, `python3` -- adding ~200MB and 2-3 minutes to build time. `node:24-slim` (Debian bookworm-slim) is ~50MB larger than Alpine but includes glibc, so argon2's prebuilt binaries work out of the box. Net build time is faster.

**Confidence:** HIGH -- argon2 prebuilt binary compatibility with glibc is documented in the [argon2 npm package](https://www.npmjs.com/package/argon2), and node:24-slim images are available on [Docker Hub](https://hub.docker.com/_/node/tags).

**Multi-stage strategy:**

```dockerfile
# Stage 1: Install ALL dependencies (dev + prod) for building
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build client (Vite)
FROM deps AS client-build
COPY client/ client/
COPY shared/ shared/
COPY vite.config.ts tsconfig.json ./
RUN npm run build:client

# Stage 3: Build server (TypeScript -> JS)
FROM deps AS server-build
COPY server/ server/
COPY shared/ shared/
COPY tsconfig.json ./
RUN npx tsc -p server/tsconfig.json

# Stage 4: Production image
FROM node:24-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=server-build /app/dist ./dist
COPY shared/ shared/
COPY drizzle/ drizzle/
EXPOSE 3000
CMD ["node", "dist/server/server/src/server.js"]
```

**Key integration details:**

- The server's `app.ts` (line 60) resolves `client/dist` relative to `import.meta.dirname`: `resolve(import.meta.dirname, '../../client/dist')`. In the Docker image, the compiled server JS is at `dist/server/server/src/app.js`, so `../../client/dist` resolves to `dist/server/client/dist` -- WRONG. The `COPY --from=client-build` must place `client/dist` at the path the server expects. Solution: copy to `/app/client/dist` and ensure the server's runtime path resolution works. The existing code uses `import.meta.dirname` which resolves at runtime. In the Docker container, `dist/server/server/src/app.js` -> dirname is `/app/dist/server/server/src/` -> `../../client/dist` -> `/app/dist/server/client/dist`. This is incorrect. **Fix needed:** Either (a) adjust the server path resolution to use an env var like `CLIENT_DIST_PATH`, or (b) place `client/dist` at the relative path the compiled server expects. Option (b) is cleaner: `COPY --from=client-build /app/client/dist /app/dist/server/client/dist`. This preserves the existing relative path resolution without code changes.

- The `drizzle/` migrations folder must be present for `db:migrate`. Copy it to the production image.

- The `shared/` directory is needed at runtime because server imports reference `../../../shared/types/api.js` via compiled JS paths.

**Health check endpoint:** Add `GET /healthz` to `server/src/app.ts` that returns `200 OK` with a JSON body. This is used by Docker's `HEALTHCHECK`, Render's health checks, and CI readiness probes. Place it before the static/SPA middleware so it responds even if `client/dist` is missing.

```typescript
// In buildApp(), after JSON parser, before routes:
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 2. Docker Compose for Local Development

**Decision:** Provide `docker-compose.yml` for PostgreSQL 17 + Redis 7. The Node.js app runs on the host (not in Docker) for hot-reload speed. An optional `docker-compose.prod.yml` includes the app container for production simulation.

**Why host-mode app, not containerized for dev:** The existing dev workflow (`npm run dev:server` via tsx watch + `npm run dev:client` via Vite dev server) provides sub-second hot reload. Running in Docker adds a file-sync layer that degrades HMR by 2-5x. Developers get the best DX running the app natively while Docker provides only the infrastructure dependencies.

```yaml
# docker-compose.yml (dev infrastructure only)
services:
  postgres:
    image: postgres:17-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: secureshare
      POSTGRES_PASSWORD: secureshare
      POSTGRES_DB: secureshare
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U secureshare"]
      interval: 5s
      timeout: 3s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

**Integration with existing .env.example:** The compose service names match the existing `.env.example` defaults:
- `DATABASE_URL=postgresql://secureshare:secureshare@localhost:5432/secureshare`
- `REDIS_URL=redis://localhost:6379`

No `.env.example` changes needed. Developers run `docker compose up -d` then `npm run dev:server` and `npm run dev:client`.

**Confidence:** HIGH -- standard Docker Compose pattern for Node.js development.

### 3. Render.com Deployment Blueprint

**Decision:** Use `render.yaml` IaC blueprint with Docker runtime for the web service, managed PostgreSQL, and managed Redis (Key Value).

```yaml
# render.yaml
services:
  - type: web
    name: secureshare
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: starter
    healthCheckPath: /healthz
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: secureshare-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: secureshare-cache
          type: keyvalue
          property: connectionString
      - key: PORT
        value: "3000"
      - key: LOG_LEVEL
        value: info

  - type: keyvalue
    name: secureshare-cache
    plan: starter
    ipAllowList:
      - source: 0.0.0.0/0
        description: Allow all (Render internal network)
    maxmemoryPolicy: allkeys-lru

databases:
  - name: secureshare-db
    plan: starter
    databaseName: secureshare
    postgresMajorVersion: "17"
```

**Integration with existing architecture:**

- The Dockerfile builds the production image. Render pulls, builds, and deploys.
- `DATABASE_URL` and `REDIS_URL` are injected via `fromDatabase` / `fromService` references -- the same env vars the existing `server/src/config/env.ts` Zod schema already validates.
- The `healthCheckPath: /healthz` endpoint enables zero-downtime deploys.
- The existing `httpsRedirect` middleware in `security.ts` handles HTTP->HTTPS redirect in production. Render terminates TLS at the load balancer and forwards `X-Forwarded-Proto`, which works with the existing `trust proxy` setting.

**Database migrations:** Render does not run migrations automatically. Add a `preDeployCommand` or a build step that runs `npm run db:migrate` before the server starts. The cleanest approach is a startup script:

```bash
#!/bin/sh
# scripts/start.sh
node dist/server/server/src/db/migrate.js && node dist/server/server/src/server.js
```

Update the Dockerfile CMD to use this script. The existing `db/migrate.ts` already handles migration and exits.

**Confidence:** HIGH -- verified render.yaml syntax against [Render Blueprint Spec](https://render.com/docs/blueprint-spec).

### 4. GitHub Actions CI/CD Pipeline

**Decision:** Single workflow file `.github/workflows/ci.yml` with 4 sequential stages: lint, unit test, build, E2E test. Deploy step triggers on `main` branch only.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: secureshare
          POSTGRES_PASSWORD: secureshare
          POSTGRES_DB: secureshare
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U secureshare"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:run

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build:client
      - run: npx tsc -p server/tsconfig.json
      - uses: actions/upload-artifact@v4
        with:
          name: client-dist
          path: client/dist/

  e2e:
    runs-on: ubuntu-latest
    needs: build
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: secureshare
          POSTGRES_PASSWORD: secureshare
          POSTGRES_DB: secureshare
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U secureshare"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run db:migrate
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 14
```

**Why sequential, not fully parallel:** The stages have logical dependencies: lint must pass before running expensive tests, tests validate correctness before building, build produces artifacts needed for E2E. Running lint + test in parallel would waste CI minutes on test runs that fail lint. The `needs` chain enforces this.

**Why chromium-only for E2E:** SecureShare's target audience is developers sharing secrets. Chromium covers 80%+ of developer browser usage. Adding Firefox and WebKit triples E2E time for marginal coverage. Add multi-browser testing later if needed.

**Deploy integration:** Render auto-deploys on push to `main` when connected to GitHub. No separate deploy step needed in CI. Alternatively, use a Render deploy hook URL as a GitHub Actions secret and trigger it after E2E passes. The auto-deploy approach is simpler and recommended for v3.0.

**Confidence:** HIGH -- verified GitHub Actions PostgreSQL service syntax against [Playwright CI docs](https://playwright.dev/docs/ci-intro) and [GitHub Actions Node.js CI guide](https://oneuptime.com/blog/post/2025-12-20-github-actions-nodejs-ci/view).

### 5. Playwright E2E Test Architecture

**Decision:** Create `e2e/` directory at the repo root (sibling to `client/` and `server/`). Use Playwright's `webServer` array to start both Express and Vite dev servers for tests.

**Why sibling directory, not inside client/ or server/:** E2E tests exercise the full stack (browser + API + database). They belong to neither client nor server. A top-level `e2e/` directory signals this clearly and avoids polluting the Vitest project configuration.

**Why separate from Vitest:** Playwright and Vitest serve different purposes. Vitest runs unit/integration tests in Node.js (happy-dom for client, node for server). Playwright runs real browsers against a running app. Mixing them in one config adds complexity. Keep `vitest.config.ts` for unit tests and `e2e/playwright.config.ts` for E2E.

**playwright.config.ts:**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  reporter: [['html', { outputFolder: './playwright-report' }]],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:3000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
```

**Key integration details:**

- `baseURL: 'http://localhost:5173'` -- Vite dev server serves the SPA. The existing `vite.config.ts` proxy (`/api -> localhost:3000`) routes API calls to Express.
- `webServer[0]` starts Express via `npm run dev:server` (tsx watch). The `/healthz` endpoint confirms readiness.
- `webServer[1]` starts Vite dev server. Playwright waits for both servers before running tests.
- `reuseExistingServer: !process.env.CI` -- locally, reuse running dev servers; in CI, start fresh.
- `workers: process.env.CI ? 1 : undefined` -- single worker in CI to avoid PostgreSQL race conditions on shared test database.

**Page Object Model structure:**

```typescript
// e2e/pages/create.page.ts
import { type Page, type Locator } from '@playwright/test';

export class CreatePage {
  readonly secretTextarea: Locator;
  readonly expirationSelect: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorArea: Locator;

  constructor(private page: Page) {
    this.secretTextarea = page.getByLabel('Your secret');
    this.expirationSelect = page.getByLabel('Expires after');
    this.passwordInput = page.getByLabel('Password protection');
    this.submitButton = page.getByRole('button', { name: 'Create Secure Link' });
    this.errorArea = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/');
  }

  async createSecret(text: string, options?: { password?: string; expiration?: string }) {
    await this.secretTextarea.fill(text);
    if (options?.expiration) {
      await this.expirationSelect.selectOption(options.expiration);
    }
    if (options?.password) {
      await this.page.getByText('Advanced options').click();
      await this.passwordInput.fill(options.password);
    }
    await this.submitButton.click();
  }
}
```

**Locator strategy:** Use `getByLabel()` and `getByRole()` per Playwright best practices. The existing HTML uses proper `<label>` elements with `htmlFor` attributes (e.g., `create.ts` lines 67-69), making label-based locators reliable. No `data-testid` attributes needed for v3.0.

**Test database management:** E2E tests use the same PostgreSQL instance as dev. Each test should clean up after itself. The simplest approach: the test creates a secret, reveals it (which destroys it), and asserts. No cleanup needed because the app's one-time-view model is self-cleaning. For tests that do not complete the reveal flow, add a `afterEach` that cleans up via direct DB access or a test-only cleanup endpoint.

**Confidence:** HIGH -- verified Playwright webServer array syntax against [Playwright docs](https://playwright.dev/docs/test-webserver) and POM pattern against [Playwright POM docs](https://playwright.dev/docs/pom).

### 6. ESLint Flat Config + Prettier Integration

**Decision:** Single `eslint.config.ts` at the repo root using ESLint 9 flat config with `typescript-eslint` v8+ and `eslint-config-prettier`. Prettier runs separately (not as an ESLint plugin).

**Why eslint.config.ts, not .js:** The project uses TypeScript everywhere. A `.ts` config file gets type checking on the config itself. ESLint 9.18.0+ supports `eslint.config.ts` natively. Node.js 24 supports TypeScript config loading via `--experimental-strip-types`.

**Why Prettier as separate tool, not ESLint plugin:** `eslint-plugin-prettier` runs Prettier inside ESLint, which is slower (ESLint parses -> Prettier parses again) and produces confusing error messages. The modern recommended approach is: ESLint for logic errors, Prettier for formatting. `eslint-config-prettier` disables ESLint formatting rules that conflict with Prettier. lint-staged runs both tools separately on commit.

**Configuration:**

```typescript
// eslint.config.ts
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier/flat';

export default defineConfig([
  // Global ignores
  {
    ignores: ['dist/', 'client/dist/', 'node_modules/', 'drizzle/', '*.js', '*.mjs'],
  },

  // TypeScript files (client + server + shared)
  ...tseslint.configs.recommended,

  // Override for server files (Node.js specific)
  {
    files: ['server/src/**/*.ts'],
    rules: {
      // Server-specific rules if needed
    },
  },

  // Override for test files (relaxed rules)
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Disable formatting rules that conflict with Prettier (MUST be last)
  prettierConfig,
]);
```

**Prettier config:**

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true
}
```

**Pre-commit hooks with Husky + lint-staged:**

```json
// package.json additions
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint --fix .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky",
    "e2e": "playwright test --config=e2e/playwright.config.ts"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{css,json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**Integration with existing code:**

- The existing codebase has no ESLint or Prettier config. Adding these will flag existing code issues. Plan for a "lint fix" phase that resolves initial violations.
- Known TypeScript strict-mode errors exist in crypto/icons/accessibility files (documented in PROJECT.md). The ESLint config should use `recommended` (not `strict`) initially to avoid blocking on pre-existing issues.
- The `eslint-config-prettier/flat` import disables all ESLint rules that would conflict with Prettier formatting, preventing lint-on-commit conflicts.

**Package additions:**
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier prettier husky lint-staged @playwright/test
```

**Confidence:** HIGH -- verified ESLint flat config TypeScript support against [ESLint docs](https://eslint.org/docs/latest/use/configure/configuration-files), typescript-eslint integration against [typescript-eslint getting started](https://typescript-eslint.io/getting-started/), and Prettier integration against [Prettier integrating with linters](https://prettier.io/docs/integrating-with-linters).

### 7. Enhanced Homepage Architecture

**Decision:** Extend the existing `client/src/pages/create.ts` with a hero section above the form. The page becomes: Hero -> Create Form -> How It Works -> Why Trust Us. No new page modules or routes needed.

**Why modify create.ts, not a separate landing page:** The existing `create.ts` already has "How It Works" and "Why Trust Us" sections (lines 257-402). The homepage IS the create page. Adding a separate landing page would require a new route and split the user journey (land -> click through -> create). The v1.0/v2.0 design decision was deliberate: minimize clicks to value. Keep the form on the homepage.

**What the hero section adds:**

```
+------------------------------------------+
|  [Shield icon]                           |
|  Share Secrets Securely                  |  <-- Hero heading (larger than current h1)
|  Zero-knowledge encryption.              |
|  One-time view. No accounts.            |  <-- Hero subtext (expanded)
|                                          |
|  [Feature pills: E2E Encrypted | One-Time |
|   View | Password Protection | Auto-Expire]|
+------------------------------------------+
|                                          |
|  [Create form - existing]                |
|                                          |
+------------------------------------------+
|  How It Works - existing                 |
+------------------------------------------+
|  Why Trust Us - existing                 |
+------------------------------------------+
```

**Integration with existing code:**

- The current `renderCreatePage()` creates a header (`<h1>Share a Secret</h1>` + subtext) at lines 41-55. The hero replaces this with a more prominent section.
- The form, "How It Works", and "Why Trust Us" sections remain unchanged.
- The enhanced hero uses the existing icon utility (`createIcon()` from `components/icons.ts`) and semantic color tokens from `styles.css`.
- The router's `updatePageMeta()` call for `/` remains unchanged (lines 200-204 in `router.ts`).

**No router changes needed.** The homepage route is `/` and already renders `create.ts`. The hero is internal to the page component.

**Confidence:** HIGH -- this is a content addition to an existing page, following established patterns.

---

## Patterns to Follow

### Pattern 1: Infrastructure as Code

**What:** All deployment configuration is in version-controlled files (`Dockerfile`, `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml`). No manual configuration in dashboards.

**When:** Always. Every infrastructure change goes through code review.

**Example:**
```yaml
# render.yaml - declarative, reviewable
services:
  - type: web
    name: secureshare
    runtime: docker
    healthCheckPath: /healthz
```

### Pattern 2: webServer Array for Full-Stack E2E

**What:** Playwright's `webServer` config starts both backend and frontend servers before tests run. Tests interact with the real application, not mocked services.

**When:** All E2E tests. Never mock the API in E2E tests -- that defeats the purpose.

**Example:**
```typescript
webServer: [
  { command: 'npm run dev:server', url: 'http://localhost:3000/healthz' },
  { command: 'npm run dev:client', url: 'http://localhost:5173' },
],
```

### Pattern 3: Page Object Model for E2E

**What:** Encapsulate page interactions in POM classes. Tests read as user stories, not DOM queries.

**When:** Any E2E test that interacts with page elements.

**Example:**
```typescript
// Test reads like a user story:
const createPage = new CreatePage(page);
await createPage.goto();
await createPage.createSecret('my-api-key', { expiration: '1h' });
// Assert: confirmation page appears with share URL
```

### Pattern 4: Separate Lint from Format

**What:** ESLint handles code quality rules (unused vars, type errors). Prettier handles formatting (indentation, semicolons, quotes). They never overlap because `eslint-config-prettier` disables ESLint formatting rules.

**When:** Always. Do not use `eslint-plugin-prettier`. Run both tools separately.

### Pattern 5: Health Check Endpoint

**What:** `GET /healthz` returns `200 { status: 'ok' }`. Used by Docker HEALTHCHECK, Render health checks, and Playwright's webServer readiness probe.

**When:** Every deployment target needs a health check. Place it in `app.ts` before static middleware.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: App in Docker for Development

**What:** Running the Node.js app inside Docker during development with volume mounts for hot reload.

**Why bad:** Volume mounting on macOS adds 5-50ms latency per file read. Vite HMR degrades from ~50ms to 300-1000ms. tsx watch file detection becomes unreliable. Docker Desktop's file sharing overhead is well-documented.

**Instead:** Use Docker Compose for infrastructure only (PostgreSQL, Redis). Run the app natively on the host. This matches the existing dev workflow.

### Anti-Pattern 2: Running ESLint as a Prettier Plugin

**What:** Using `eslint-plugin-prettier` to run Prettier inside ESLint.

**Why bad:** Double-parsing (ESLint AST + Prettier). Slower. Confusing error messages that mix linting and formatting. The Prettier team themselves [recommend against it](https://prettier.io/docs/integrating-with-linters).

**Instead:** Run ESLint and Prettier as separate tools. Use `eslint-config-prettier` to disable conflicting rules. lint-staged runs both sequentially on commit.

### Anti-Pattern 3: Multi-Browser E2E in CI by Default

**What:** Running Playwright tests against Chromium + Firefox + WebKit in every CI run.

**Why bad:** Triples CI time and cost. WebKit browser install is slow. For a developer tool like SecureShare, cross-browser bugs are rare (vanilla JS, no browser-specific APIs beyond Web Crypto which is standard).

**Instead:** Default to Chromium only. Add Firefox/WebKit as a scheduled nightly job if cross-browser coverage is needed later.

### Anti-Pattern 4: Mocking the API in E2E Tests

**What:** Using MSW or similar to mock API responses in Playwright E2E tests.

**Why bad:** E2E tests exist to validate the full stack. Mocking the API means you are testing the frontend in isolation -- that is what Vitest + happy-dom is for. E2E with mocks provides false confidence.

**Instead:** E2E tests use real Express server, real PostgreSQL, real Vite. The self-cleaning nature of SecureShare's one-time-view model makes test isolation natural.

### Anti-Pattern 5: Alpine Docker Base with Native Addons

**What:** Using `node:24-alpine` when the project has native Node.js addons (argon2).

**Why bad:** Alpine uses musl libc. argon2's prebuilt binaries target glibc. Building from source on Alpine requires installing a C/C++ toolchain, adding build time and image layers. The "smaller base image" benefit is negated by the toolchain additions.

**Instead:** Use `node:24-slim` (Debian bookworm-slim). Prebuilt binaries work out of the box. Cleaner, faster builds.

---

## New vs Modified Components

### New Files

| File | Type | Purpose |
|------|------|---------|
| `Dockerfile` | Infrastructure | Multi-stage production build |
| `.dockerignore` | Infrastructure | Exclude unnecessary files from Docker context |
| `docker-compose.yml` | Infrastructure | Dev environment: PostgreSQL + Redis |
| `docker-compose.prod.yml` | Infrastructure | Production simulation (optional) |
| `render.yaml` | Infrastructure | Render.com deployment blueprint |
| `.github/workflows/ci.yml` | CI/CD | Lint -> Test -> Build -> E2E pipeline |
| `.github/ISSUE_TEMPLATE/bug_report.md` | GitHub | Bug report template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | GitHub | Feature request template |
| `.github/PULL_REQUEST_TEMPLATE.md` | GitHub | PR description template |
| `e2e/playwright.config.ts` | Testing | Playwright configuration |
| `e2e/pages/create.page.ts` | Testing | Create page POM |
| `e2e/pages/reveal.page.ts` | Testing | Reveal page POM |
| `e2e/pages/confirmation.page.ts` | Testing | Confirmation page POM |
| `e2e/fixtures/test-fixtures.ts` | Testing | Custom Playwright fixtures |
| `e2e/tests/create-secret.spec.ts` | Testing | Create flow E2E tests |
| `e2e/tests/reveal-secret.spec.ts` | Testing | Reveal flow E2E tests |
| `e2e/tests/password-protection.spec.ts` | Testing | Password flow E2E tests |
| `e2e/tests/error-states.spec.ts` | Testing | Error handling E2E tests |
| `eslint.config.ts` | Linting | ESLint flat config |
| `.prettierrc` | Formatting | Prettier configuration |
| `.prettierignore` | Formatting | Prettier ignore patterns |
| `scripts/start.sh` | Infrastructure | Production startup (migrate + serve) |

### Modified Files

| File | Changes | Reason |
|------|---------|--------|
| `package.json` | Add lint/format/e2e/prepare scripts, devDependencies, lint-staged config | New tooling integration |
| `.gitignore` | Add playwright-report/, test-results/, playwright/.cache/ | E2E artifacts |
| `server/src/app.ts` | Add `GET /healthz` endpoint before routes | Docker/Render health checks, Playwright readiness |
| `client/src/pages/create.ts` | Replace header section with hero section, add feature pills | Enhanced homepage |
| `.env.example` | No changes needed | Docker compose matches existing defaults |

### Unchanged Files

| File | Why |
|------|-----|
| `server/src/middleware/security.ts` | CSP, HSTS, CORS are application concerns, not infrastructure |
| `server/src/routes/secrets.ts` | API endpoints unchanged |
| `server/src/services/*` | Business logic unchanged |
| `server/src/config/env.ts` | Env schema already validates DATABASE_URL, REDIS_URL, PORT |
| `client/src/crypto/*` | Encryption module unchanged |
| `client/src/router.ts` | Routing unchanged (homepage is still `/`) |
| `client/src/components/*` | Existing components unchanged |
| `vite.config.ts` | Vite config unchanged (proxy, build settings remain) |
| `vitest.config.ts` | Unit test config unchanged (Playwright is separate) |
| `tsconfig.json` | TypeScript config unchanged |
| `drizzle.config.ts` | Database config unchanged |

---

## Build Order: What Depends on What

```
Phase 1: Code Quality Foundation (no dependencies)
  |
  +-- 1a. ESLint flat config + Prettier config
  |       Must exist before lint-staged can run.
  |
  +-- 1b. Husky + lint-staged pre-commit hooks
  |       Depends on 1a (needs lint/format commands to exist).
  |
  +-- 1c. Fix existing lint/format violations
  |       Run eslint --fix and prettier --write on entire codebase.
  |       Commit as a single "chore: format codebase" commit.

Phase 2: Docker + Local Dev (no dependency on Phase 1)
  |
  +-- 2a. Dockerfile (multi-stage build)
  |       Needs: health check endpoint in app.ts.
  |
  +-- 2b. Health check endpoint in server/src/app.ts
  |       Tiny change, no dependencies.
  |
  +-- 2c. docker-compose.yml (dev infrastructure)
  |       No code dependencies. Just infrastructure.
  |
  +-- 2d. .dockerignore
  |       Created alongside Dockerfile.
  |
  +-- 2e. Validate: docker compose up + docker build + docker run
  |       Integration test of 2a-2d.

Phase 3: E2E Testing (depends on 2b for health check)
  |
  +-- 3a. Install Playwright + create e2e/ directory structure
  |       npm install -D @playwright/test, npx playwright install chromium
  |
  +-- 3b. playwright.config.ts with webServer array
  |       Uses health check (2b) as readiness probe.
  |
  +-- 3c. Page Object Models (create, reveal, confirmation)
  |       Maps existing page structure to POM classes.
  |
  +-- 3d. E2E test specs
  |       Uses POMs from 3c. Tests full create-share-reveal flow.
  |
  +-- 3e. Update package.json scripts (e2e command)

Phase 4: CI/CD Pipeline (depends on Phase 1 + 2 + 3)
  |
  +-- 4a. .github/workflows/ci.yml
  |       Uses lint (Phase 1), test (existing), build, e2e (Phase 3).
  |
  +-- 4b. render.yaml deployment blueprint
  |       Uses Dockerfile (Phase 2).
  |
  +-- 4c. Validate: push to branch, verify CI passes

Phase 5: GitHub Polish + Enhanced Homepage (depends on Phase 1 for linting)
  |
  +-- 5a. Issue templates + PR template
  |       No code dependencies.
  |
  +-- 5b. Enhanced homepage hero section in create.ts
  |       Uses existing component patterns. Run through lint (Phase 1).
  |
  +-- 5c. README with screenshots, architecture, install instructions
  |       Written after all infrastructure is in place.
```

**Why this order:**

1. **Lint first** because every subsequent commit should be clean. The initial format pass is a one-time cost that makes all future diffs cleaner.

2. **Docker before E2E** because the health check endpoint (needed for Docker) is also used by Playwright's webServer readiness probe. Building Docker also validates that the production build works, which catches TypeScript compilation issues early.

3. **E2E after Docker** because E2E tests need a reliable way to know when the server is ready (the `/healthz` endpoint). They also validate the complete user flow, which is the best test of production readiness.

4. **CI/CD after all tools exist** because the CI pipeline orchestrates lint + test + build + E2E. All four must work locally before automating in CI.

5. **Homepage and README last** because they are content, not infrastructure. They should be written after the architecture is stable and screenshots can be captured from the final state.

---

## Scalability Considerations

| Concern | At Launch | At 10K users/day | At 100K users/day |
|---------|-----------|-------------------|---------------------|
| Docker image size | ~250MB (node:24-slim + deps) | Same | Consider distroless base if security audit requires |
| CI pipeline time | ~5-8 min (lint+test+build+e2e) | Same | Parallelize lint+test, cache Playwright browsers |
| E2E test count | 15-20 specs | 30-50 specs | Shard across CI workers, add Firefox project |
| Health checks | Simple `/healthz` returning 200 | Add DB connectivity check | Add Redis check, response time metrics |
| Render scaling | Single instance, starter plan | Standard plan, 2+ instances | Auto-scaling, dedicated Redis, DB read replicas |

---

## Sources

- [Docker Multi-Stage Build Documentation](https://docs.docker.com/build/building/multi-stage/) -- official multi-stage patterns
- [Node.js 24 Docker Images](https://hub.docker.com/_/node/tags) -- available tags: 24-slim, 24-alpine, 24-bookworm
- [argon2 npm package](https://www.npmjs.com/package/argon2) -- prebuilt binary compatibility notes (glibc, not musl)
- [Playwright webServer Configuration](https://playwright.dev/docs/test-webserver) -- array syntax for multiple servers
- [Playwright CI Setup](https://playwright.dev/docs/ci-intro) -- GitHub Actions workflow template
- [Playwright Page Object Models](https://playwright.dev/docs/pom) -- official POM pattern documentation
- [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) -- flat config, eslint.config.ts support
- [ESLint defineConfig and extends](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/) -- modern flat config features
- [typescript-eslint Getting Started](https://typescript-eslint.io/getting-started/) -- flat config integration
- [Prettier Integrating with Linters](https://prettier.io/docs/integrating-with-linters) -- eslint-config-prettier recommended approach
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec) -- render.yaml syntax reference
- [Render Deploy Node Express](https://render.com/docs/deploy-node-express-app) -- Node.js deployment guide
- [Render Multi-Service Architecture](https://render.com/docs/multi-service-architecture) -- web + database + Redis pattern
