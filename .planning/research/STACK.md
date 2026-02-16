# Technology Stack: DevOps, Testing, and Code Quality Milestone

**Project:** SecureShare
**Researched:** 2026-02-16
**Confidence:** HIGH

## Scope

This document covers ONLY the new stack additions needed for the v3.0 milestone: Docker deployment to Render.com, GitHub Actions CI/CD, Playwright E2E tests, ESLint + Prettier, TypeScript strict mode enforcement, and enhanced marketing homepage. The existing validated stack (Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17, Redis, Vitest 4, vanilla TypeScript, lucide, JetBrains Mono, etc.) is unchanged and not re-researched.

---

## Recommended Stack Additions

### 1. E2E Testing: Playwright

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @playwright/test | ^1.50.0 | End-to-end browser testing | The standard E2E framework for 2026. Supports Node.js 24 natively. Multi-browser (Chromium, Firefox, WebKit). Built-in `webServer` config launches both Express backend and Vite frontend before tests. Auto-waits for elements, reducing flake. HTML report with traces for debugging CI failures. |

**Why NOT Cypress:** Cypress does not support WebKit (Safari), limiting cross-browser coverage. Playwright's `webServer` array natively handles the dual-server setup (Express + Vite) without `concurrently` or wrapper scripts. Playwright is also faster in CI due to parallel browser contexts sharing a single browser instance.

**Why NOT Selenium/WebdriverIO:** Legacy architecture. Playwright's auto-wait and trace viewer are a generation ahead for developer experience.

**Why pin to ^1.50.0 (not ^1.58.0):** Playwright ships breaking browser changes with every minor version. Pinning to `^1.50.0` allows patch updates within the 1.50.x series without surprise failures from browser engine upgrades. When ready, intentionally bump to `^1.51.0`, `^1.52.0`, etc. The latest available version is 1.58.2 (released 2026-02-06). Start at 1.50 minimum to ensure Node.js 24 support and stable API surface, then upgrade incrementally.

**IMPORTANT: Pin strategy.** Unlike most npm packages, Playwright bundles specific browser versions per release. A `^1.50.0` range means npm will install 1.50.x patches only. When you want to upgrade browsers, explicitly bump: `npm install @playwright/test@1.52 && npx playwright install`.

**Integration with existing Vitest:**

Playwright E2E tests live in a separate directory (`e2e/`) with their own config (`playwright.config.ts`). They do NOT run through Vitest. The two test systems are independent:
- Vitest: Unit + integration tests (163 existing tests, fast, no browser)
- Playwright: E2E tests (real browsers, full user flows)

**webServer configuration for dual Express + Vite:**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:3000/api/health',
      name: 'Express API',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev:client',
      url: 'http://localhost:5173',
      name: 'Vite Frontend',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Add firefox/webkit later when stable
  ],
});
```

**Key detail:** Playwright's `webServer` array launches both servers sequentially, waits for each URL to respond 2xx/3xx, then runs tests. This eliminates the need for `concurrently`, `wait-on`, or any process management library.

**Health check endpoint required:** The Express server needs a `GET /api/health` endpoint returning 200. This is also needed for Render.com deployment. Add it once, use it everywhere.

---

### 2. Linting: ESLint 10 + typescript-eslint

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| eslint | ^10.0.0 | JavaScript/TypeScript linting | ESLint 10 released 2026-02-06. Flat config is now the ONLY config system (eslintrc removed entirely). Smaller install (9.4MB vs 11MB). JSX reference tracking eliminates false positives. Node.js >=24 supported. |
| @eslint/js | ^10.0.0 | ESLint recommended rule set | Companion package for ESLint 10 recommended rules. |
| typescript-eslint | ^8.56.0 | TypeScript-specific linting rules | Supports ESLint `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0` and TypeScript `>=4.8.4 <6.0.0`. Provides `tseslint.configs.recommended`, `.strict`, and `.stylistic` presets. |

**Why ESLint 10 over ESLint 9:** ESLint 10 was released 10 days ago (2026-02-06). Since the project has NO existing ESLint configuration, there is zero migration cost. ESLint 9 is already in maintenance mode. Starting fresh on 10 avoids a near-future migration. typescript-eslint 8.56.0 already supports ESLint 10 (confirmed: peer dependency `^8.57.0 || ^9.0.0 || ^10.0.0`).

**Risk assessment:** ESLint 10 is brand new. Some ecosystem plugins may not yet support it. However, SecureShare's linting needs are simple (TypeScript + Prettier integration) and do not require exotic plugins. The core typescript-eslint and eslint-config-prettier packages already support ESLint 10. If any compatibility issue surfaces, falling back to ESLint 9 (`^9.0.0`) is trivial since both use flat config.

**FALLBACK: If ESLint 10 causes issues with any dependency, drop to `eslint@^9.0.0` and `@eslint/js@^9.0.0`. The config file format is identical.**

**Configuration (eslint.config.ts -- TypeScript config file):**

Since the project has `"type": "module"` and uses TypeScript 5.9, ESLint 10 supports `eslint.config.ts` natively with Node.js >= 22.13.0 (no jiti needed for Node.js 24).

```typescript
// eslint.config.ts
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  { ignores: ['dist/', 'client/dist/', 'drizzle/', 'node_modules/'] },

  // Base recommended rules
  eslint.configs.recommended,

  // TypeScript rules (recommended + strict)
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Prettier must be LAST to override formatting rules
  eslintConfigPrettier,
);
```

**Why `recommendedTypeChecked` over `recommended`:** The project already has `strict: true` in tsconfig.json. Type-checked linting catches bugs that syntax-only rules miss (e.g., `no-floating-promises`, `no-unsafe-assignment`). Since the TypeScript compiler is already running, the incremental cost is minimal.

**Why NOT `strictTypeChecked`:** Too aggressive for initial adoption. Start with `recommendedTypeChecked`, assess the findings, then optionally upgrade to `strictTypeChecked` in a future phase.

---

### 3. Code Formatting: Prettier

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| prettier | ^3.8.0 | Opinionated code formatter | Latest stable: 3.8.1 (released 2026-01-14). TypeScript config file support (3.5+). No configuration debates -- enforces consistency. |
| eslint-config-prettier | ^10.1.0 | Disables ESLint rules that conflict with Prettier | Essential when using ESLint + Prettier together. Turns off all formatting-related ESLint rules so Prettier owns formatting and ESLint owns logic. |

**Why NOT eslint-plugin-prettier:** Running Prettier as an ESLint rule (via eslint-plugin-prettier) is slower than running Prettier separately. The recommended approach is eslint-config-prettier (disable conflicts) + run Prettier as a separate step. This is the official Prettier team recommendation.

**Prettier configuration (.prettierrc):**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 80,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

**Integration with existing code:** The project has 6,296 LOC with no formatter. The initial `npx prettier --write .` will reformat everything. This should be a dedicated commit before any other changes to keep git blame clean.

---

### 4. Docker: Multi-Stage Build

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node:24-slim (Debian Bookworm) | 24.x LTS | Docker base image | Official Node.js LTS image. Debian Bookworm-slim is ~200MB (vs ~1GB for full image, ~180MB for Alpine). Slim chosen over Alpine because `argon2` native module uses prebuilt binaries compiled for glibc (Ubuntu/Debian). Alpine uses musl libc, which would require compiling argon2 from source with build tools. |

**Why NOT node:24-alpine:** The project depends on `argon2@0.44.0`, a native N-API module with prebuilt binaries for glibc-based Linux (Ubuntu/Debian). Alpine Linux uses musl libc, which is incompatible with these prebuilts. Using Alpine would require installing `python3`, `make`, `g++`, and compiling argon2 from source during Docker build -- adding 2-3 minutes to build time and ~300MB to intermediate layers. Bookworm-slim avoids this entirely.

**Why multi-stage build:** The project has both a Vite client build step and a server build step. Multi-stage builds separate build dependencies (TypeScript compiler, Vite, dev packages) from the runtime image, resulting in ~80% smaller production images.

**Dockerfile structure:**

```dockerfile
# Stage 1: Install ALL dependencies (build + runtime)
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build client (Vite) and compile server (TypeScript)
FROM deps AS build
COPY . .
RUN npm run build:client
# Server runs via tsx in production OR compile to JS:
# RUN npx tsc --project tsconfig.server.json

# Stage 3: Production runtime
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built client assets
COPY --from=build /app/client/dist ./client/dist

# Copy server source (runs via tsx) or compiled JS
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle ./drizzle

# Non-root user for security
RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 10000
CMD ["npx", "tsx", "server/src/server.ts"]
```

**Production server execution choice:** The project currently uses `tsx watch` for development. For production Docker, there are two approaches:
1. **tsx (simpler):** Include `tsx` in production dependencies. Adds ~5MB but avoids a separate server compilation step. Good for getting started.
2. **Compiled JS (smaller):** Add a `tsconfig.server.json` for server-only compilation, compile to `dist/server/`, run with `node dist/server/server.js`. Eliminates tsx dependency in production. Better for final optimization.

Recommend starting with tsx for simplicity, then optimize to compiled JS in a future iteration.

**Critical: .dockerignore**

```
node_modules
dist
client/dist
.git
.env
.env.*
.planning
*.md
e2e
playwright-report
test-results
```

---

### 5. Render.com Deployment: Blueprint YAML

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| render.yaml (Blueprint) | N/A | Infrastructure-as-code for Render.com | Declarative service definition. Defines web service, PostgreSQL, and Redis together. Git-committed, reproducible. Auto-deploys on push to main. |

**render.yaml structure:**

```yaml
services:
  - type: web
    runtime: docker
    name: secureshare
    repo: https://github.com/OWNER/secureshare
    region: oregon
    plan: starter
    branch: main
    dockerfilePath: ./Dockerfile
    dockerContext: ./
    healthCheckPath: /api/health
    numInstances: 1
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: secureshare-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: secureshare-redis
          type: keyvalue
          property: connectionString
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "10000"

  - type: keyvalue
    name: secureshare-redis
    region: oregon
    plan: free
    maxmemoryPolicy: allkeys-lru
    ipAllowList:
      - source: 0.0.0.0/0
        description: allow-all

databases:
  - name: secureshare-db
    plan: free
    region: oregon
    databaseName: secureshare
    postgresMajorVersion: "17"
```

**Key Render.com details:**
- Default PORT is 10000 (not 3000). The app must read `process.env.PORT`. The existing `env.ts` already does this with `.default(3000)`. For Render, set PORT=10000 in the blueprint.
- Health checks: Render sends GET requests to `healthCheckPath`. The Express app needs `GET /api/health` returning 200.
- PostgreSQL free tier: 1GB storage, never expires (but was previously 30-day expiry -- verify current terms).
- Redis free tier: 25MB ephemeral storage. Data lost on restart. Fine for rate limiting (MemoryStore fallback exists).
- Docker builds use BuildKit with layer caching. Multi-stage builds are parallelized.
- `ipAllowList` is REQUIRED for Key Value (Redis) instances, even if allowing all.

**Render.com PORT gotcha:** The existing `env.ts` defaults PORT to 3000. Render defaults to 10000. The render.yaml above explicitly sets PORT=10000, but the app should also work if PORT is not set (falls back to 3000 for local dev). This is already handled by the Zod schema: `PORT: z.coerce.number().default(3000)`.

---

### 6. CI/CD: GitHub Actions

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| actions/checkout | @v6 | Clone repository | Latest major (released 2024-10-14). Stores credentials under $RUNNER_TEMP for better security. |
| actions/setup-node | @v6 | Install Node.js 24 | Latest major (v6.2.0, released 2025-01-15). Auto-caches npm dependencies when package-lock.json exists. |
| actions/upload-artifact | @v4 | Upload Playwright reports | Latest major. Stores HTML reports and traces for debugging failed E2E tests. |

**GitHub Actions workflow structure (3 jobs):**

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
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: npm ci
      - run: npx eslint .
      - run: npx prettier --check .

  test:
    runs-on: ubuntu-latest
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
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/secureshare_test
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: npm ci
      - run: npm run db:migrate
      - run: npm run test:run

  e2e:
    runs-on: ubuntu-latest
    needs: [test]
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: secureshare_e2e
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/secureshare_e2e
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run db:migrate
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

**Key design decisions:**
- **3 separate jobs** (lint, test, e2e): Lint and test run in parallel. E2E depends on test passing (no point running expensive browser tests if unit tests fail).
- **PostgreSQL service container:** Real PostgreSQL 17, matching production. Uses GitHub Actions service containers (not Docker Compose). The existing integration tests already require a real database.
- **No Redis service container:** Rate limiting has a MemoryStore fallback. Redis is optional. Adding a Redis service container is easy later if needed.
- **`--with-deps chromium`:** Install only Chromium (not all 3 browsers) in CI to save ~2 minutes of download time. Add Firefox/WebKit when cross-browser testing matters.
- **`needs: [test]`:** E2E only runs after unit/integration tests pass. This saves CI minutes on PRs with test failures.

---

### 7. npm Scripts Additions

| Script | Command | Purpose |
|--------|---------|---------|
| `lint` | `eslint .` | Run ESLint |
| `lint:fix` | `eslint . --fix` | Auto-fix ESLint issues |
| `format` | `prettier --write .` | Format all files |
| `format:check` | `prettier --check .` | Check formatting (CI) |
| `test:e2e` | `playwright test` | Run E2E tests |
| `test:e2e:ui` | `playwright test --ui` | Open Playwright UI for debugging |
| `test:e2e:headed` | `playwright test --headed` | Run tests in visible browser |

---

## Installation

```bash
# E2E testing
npm install -D @playwright/test
npx playwright install chromium

# Linting
npm install -D eslint @eslint/js typescript-eslint eslint-config-prettier

# Formatting
npm install -D prettier

# No new production dependencies needed
```

Total new dev dependencies: 6 packages
Total new production dependencies: 0 packages

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| E2E testing | @playwright/test | Cypress | No WebKit support. Single-tab architecture limits complex flow testing. No native multi-server webServer config. |
| E2E testing | @playwright/test | WebdriverIO | Legacy Selenium-based architecture. Slower, more flaky, worse DX. |
| Linting | ESLint 10 | ESLint 9 | ESLint 9 is in maintenance. No existing config to migrate. Starting fresh on 10 is free. |
| Linting | ESLint 10 | Biome | Biome is fast but TypeScript type-checked linting is limited. typescript-eslint's `recommendedTypeChecked` ruleset catches more bugs. Biome cannot replace ESLint for type-aware rules like `no-floating-promises`. |
| Formatting | Prettier | Biome formatter | Would require Biome for linting too (or awkward dual-tool setup). Prettier has wider ecosystem support and editor integration. |
| Formatting | Prettier (separate) | eslint-plugin-prettier | Running Prettier as ESLint rule is slower. Official Prettier team recommends against it. |
| Docker base | node:24-slim | node:24-alpine | argon2 native module has prebuilt binaries for glibc (Debian). Alpine uses musl, requiring source compilation. |
| Docker base | node:24-slim | node:24 (full) | Full image is ~1GB vs ~200MB for slim. No need for gcc/python in runtime image. |
| Deployment | Render.com | Railway | Render has native PostgreSQL + Redis managed services with infrastructure-as-code (render.yaml). Railway requires manual service setup. |
| Deployment | Render.com | Fly.io | Fly.io requires more DevOps knowledge (Machines API, volumes). Render is simpler for a single-instance app. |
| CI/CD | GitHub Actions | CircleCI / GitLab CI | Repo is on GitHub. Actions is native, free for public repos, tightest integration. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `concurrently` / `npm-run-all` | Playwright's `webServer` array handles multi-server startup natively. No need for process management libraries for E2E tests. | Playwright `webServer: [...]` |
| `wait-on` | Playwright's webServer already polls the URL and waits for response. Redundant. | Playwright `webServer.url` + `timeout` |
| `husky` + `lint-staged` (for now) | Add AFTER linting is stable and the team has resolved all existing lint errors. Adding pre-commit hooks before cleanup creates friction. Phase later. | Run lint/format in CI first |
| `eslint-plugin-prettier` | Slower than running Prettier separately. Mixes formatting errors into lint output. | `eslint-config-prettier` + separate `prettier` command |
| `docker-compose.yml` for production | Render.com manages service orchestration via render.yaml. Docker Compose is for local dev only (and even that is optional since PostgreSQL/Redis can run natively or via standalone containers). | render.yaml for production, optional docker-compose.yml for local dev convenience |
| `ts-node` | tsx is already in use and is faster (esbuild-based vs TypeScript compiler). | tsx (already a dependency) |
| `nodemon` | tsx watch already provides file watching for development. | `tsx watch` (already in dev:server script) |

---

## Version Compatibility Matrix

| New Package | Node.js 24 | TypeScript 5.9 | Vite 7 | Express 5 | Vitest 4 |
|-------------|------------|----------------|--------|-----------|----------|
| @playwright/test ^1.50.0 | YES (tested) | YES | N/A (separate) | N/A | Independent |
| eslint ^10.0.0 | YES (requires >=24) | N/A | N/A | N/A | N/A |
| typescript-eslint ^8.56.0 | YES | YES (<6.0.0) | N/A | N/A | N/A |
| prettier ^3.8.0 | YES | YES | N/A | N/A | N/A |
| eslint-config-prettier ^10.1.0 | YES | N/A | N/A | N/A | N/A |

All new packages are dev dependencies only. They do not affect the production bundle or runtime behavior.

---

## Configuration Files to Create

| File | Purpose | Notes |
|------|---------|-------|
| `eslint.config.ts` | ESLint 10 flat config | TypeScript config (native Node.js 24 support, no jiti needed) |
| `.prettierrc` | Prettier options | JSON format, minimal options |
| `.prettierignore` | Files Prettier should skip | dist/, drizzle/, package-lock.json |
| `playwright.config.ts` | Playwright E2E config | webServer array, browser projects, CI settings |
| `Dockerfile` | Multi-stage Docker build | node:24-slim, 3 stages (deps, build, runtime) |
| `.dockerignore` | Files excluded from Docker context | node_modules, .git, .env, e2e, .planning |
| `render.yaml` | Render.com Blueprint | Web service + PostgreSQL + Redis |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline | lint + test + e2e jobs |

---

## Sources

### HIGH Confidence (verified with official docs)
- [Playwright installation docs](https://playwright.dev/docs/intro) -- Node.js 24 support confirmed, npm package name
- [Playwright release notes](https://playwright.dev/docs/release-notes) -- v1.58 latest, version history
- [Playwright webServer docs](https://playwright.dev/docs/test-webserver) -- Multiple webServer array config, all options documented
- [Playwright CI setup](https://playwright.dev/docs/ci-intro) -- GitHub Actions workflow template, action versions
- [ESLint 10 release blog](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/) -- Breaking changes, Node.js requirements, eslintrc removal
- [typescript-eslint getting started](https://typescript-eslint.io/getting-started/) -- Flat config setup, package names
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/) -- ESLint `^8.57.0 || ^9.0.0 || ^10.0.0` confirmed, TypeScript `>=4.8.4 <6.0.0`
- [Render.com Blueprint spec](https://render.com/docs/blueprint-spec) -- render.yaml structure, all field definitions
- [Render.com Docker docs](https://render.com/docs/docker) -- Multi-stage builds, layer caching, BuildKit
- [Render.com health checks](https://render.com/docs/health-checks) -- GET requests, 2xx/3xx expected
- [actions/checkout releases](https://github.com/actions/checkout/releases) -- v6 latest
- [actions/setup-node releases](https://github.com/actions/setup-node/releases) -- v6.2.0 latest
- [Docker Hub node:24-slim](https://hub.docker.com/_/node) -- Debian Bookworm-slim, LTS tags

### MEDIUM Confidence (verified with multiple sources)
- [Prettier 3.8 release](https://prettier.io/blog/) -- v3.8.1 latest, TS config support from 3.5+
- [eslint-config-prettier npm](https://www.npmjs.com/package/eslint-config-prettier) -- v10.1.8 latest, flat config support
- [argon2 npm](https://www.npmjs.com/package/argon2) -- Prebuilt binaries for glibc (Ubuntu/Debian), v0.44.0
- [Render.com pricing](https://render.com/pricing) -- Free tier PostgreSQL and Redis availability, ephemeral Redis

### LOW Confidence (needs validation during implementation)
- ESLint 10 ecosystem compatibility: While typescript-eslint and eslint-config-prettier support ESLint 10, other plugins may not yet. Test during setup and fall back to ESLint 9 if blocked.
- Render.com free tier PostgreSQL expiry: Conflicting reports on whether free tier databases expire after 30 days. Verify current terms during deployment setup.
- tsx in production Docker: Running tsx (esbuild JIT) in production works but adds ~5MB. Consider compiling to JS for production in a later optimization pass.

---
*Stack research for: SecureShare v3.0 -- DevOps, Testing, and Code Quality*
*Researched: 2026-02-16*
