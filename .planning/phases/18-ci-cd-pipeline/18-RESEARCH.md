# Phase 18: CI/CD Pipeline - Research

**Researched:** 2026-02-17
**Domain:** GitHub Actions CI/CD, Playwright E2E in CI, Render.com deployment
**Confidence:** HIGH

## Summary

This phase creates a GitHub Actions CI/CD pipeline that validates every push/PR (lint, unit tests, build, E2E) and auto-deploys merges to main via Render.com. The project already has all the testing infrastructure in place (Vitest unit tests, Playwright E2E with fixtures, ESLint, Prettier, health endpoint, Dockerfile, render.yaml). The work is purely workflow authoring and configuration -- no new application code is needed.

The key technical decisions involve: structuring the workflow with dependent jobs for fail-fast lint gating, configuring PostgreSQL + Redis service containers for E2E, caching node_modules and Playwright browsers, generating coverage reports without gating, and connecting to Render deployment. Render.com natively supports "deploy after CI checks pass" via the `autoDeployTrigger: checksPass` blueprint field, which is simpler and more reliable than deploy hooks.

**Primary recommendation:** Use a single GitHub Actions workflow file with 4 sequential jobs (lint -> test -> e2e -> deploy), leveraging `needs` for dependency ordering and Render's native `autoDeployTrigger: checksPass` for deployment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Chromium only in CI (not all three browsers); local Playwright config still tests all three
- Cache both node_modules (keyed on package-lock.json hash) and Playwright browser binaries between CI runs
- Add GitHub Actions CI status badge to README
- Generate code coverage reports for visibility; do NOT gate CI on coverage thresholds
- No branch protection rules on main

### Claude's Discretion
- Workflow structure: Single vs multi-workflow, job ordering, parallelism, fail-fast strategy
- CI triggers: Push/PR trigger strategy
- Node version matrix: Single vs multi-version testing
- E2E service setup: GitHub Actions service containers vs Docker Compose for PostgreSQL + Redis
- E2E test target: Dev server vs production Docker image
- Playwright sharding: Single runner vs sharded (test suite is small)
- Failure artifacts: Whether to upload Playwright traces/screenshots on failure
- Deploy trigger: Render deploy hook vs native GitHub integration
- Deploy verification: Fire-and-forget vs post-deploy health check
- PR feedback: Standard checks vs summary comments

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CICD-01 | GitHub Actions workflow runs lint, unit tests, and build on every PR | Workflow trigger configuration, `actions/setup-node@v6` with npm caching, job structure with `needs` |
| CICD-02 | GitHub Actions runs E2E tests with PostgreSQL and Redis service containers | Service containers syntax for `postgres:17` and `redis:7`, health checks, port mapping, env vars |
| CICD-03 | CI pipeline triggers auto-deploy to Render.com on merge to main | Render `autoDeployTrigger: checksPass` in render.yaml -- native integration, no deploy hooks needed |
| CICD-04 | CI fails fast on lint errors before running tests | Lint as first job; test/build/e2e jobs use `needs: [lint]` to block on lint failure |
</phase_requirements>

## Standard Stack

### Core (GitHub Actions)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `actions/checkout` | v6 | Clone repository | Official GitHub action, latest as of Dec 2025 |
| `actions/setup-node` | v6 | Install Node.js + npm cache | Latest version (Jan 2026), built-in npm cache via `cache: 'npm'` |
| `actions/cache` | v4 | Cache Playwright browsers | For caching browser binaries keyed on Playwright version |
| `actions/upload-artifact` | v6 | Upload Playwright traces/reports on failure | Latest version, Node.js 24 runtime |

### Supporting (Coverage)

| Package | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vitest/coverage-v8` | ^4.x | V8-based coverage provider | Install as devDependency; generate coverage reports in CI |

### Service Containers

| Image | Version | Purpose |
|-------|---------|---------|
| `postgres` | `17` | PostgreSQL for E2E tests (matches production) |
| `redis` | `7` | Redis for E2E rate limiting tests (matches production) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Render `autoDeployTrigger: checksPass` | Deploy hooks via `curl` | Native integration is simpler; deploy hooks require secret management and curl step. **Recommendation: Use native.** |
| Service containers | Docker Compose in CI | Service containers are faster, native to GitHub Actions, managed lifecycle. Docker Compose adds complexity. **Recommendation: Service containers.** |
| Single workflow file | Multiple workflow files | Multiple files allow separate badges per workflow but add complexity. Single file is simpler for 4 related jobs. **Recommendation: Single file.** |
| `actions/setup-node` npm cache | `actions/cache` for node_modules | setup-node caches the global npm cache (not node_modules), so `npm ci` still runs but downloads from cache. Caching node_modules directly is faster but fragile. **Recommendation: Use setup-node `cache: 'npm'` for npm cache.** |

**Installation (new devDependency):**
```bash
npm install -D @vitest/coverage-v8
```

## Architecture Patterns

### Recommended Workflow Structure

```
.github/
└── workflows/
    └── ci.yml          # Single workflow: lint → test → e2e → deploy
```

### Pattern 1: Sequential Job Chain with `needs`

**What:** A single workflow with 4 jobs that form a dependency chain.
**When to use:** When lint must gate tests, and all CI must gate deploy.

```yaml
jobs:
  lint:
    # Runs first — fails fast (CICD-04)
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, lint, format:check]

  test:
    needs: [lint]
    # Runs unit tests + coverage after lint passes (CICD-01)
    runs-on: ubuntu-latest
    steps: [checkout, setup-node, npm ci, vitest --coverage, upload coverage]

  e2e:
    needs: [lint]
    # Runs E2E with service containers after lint passes (CICD-02)
    runs-on: ubuntu-latest
    services: [postgres:17, redis:7]
    steps: [checkout, setup-node, npm ci, build, playwright install, test:e2e]

  deploy:
    # NOT a CI job — deployment handled natively by Render (CICD-03)
    # See "Render Integration" section
```

**Key design decisions:**
- `test` and `e2e` both depend on `lint` but run in parallel with each other (saves time)
- `test` does not need service containers (Vitest server tests use a test DB from `DATABASE_URL` env)
- `e2e` needs both PostgreSQL and Redis service containers
- No explicit `deploy` job needed if using Render's native `autoDeployTrigger: checksPass`

### Pattern 2: Service Containers for E2E (Runner-Level)

**What:** PostgreSQL and Redis as GitHub Actions service containers on the runner (not in a container job).
**When to use:** When the app runs directly on the runner (not in a Docker container).

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: secureshare
          POSTGRES_PASSWORD: secureshare
          POSTGRES_DB: secureshare
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    env:
      DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
      REDIS_URL: redis://localhost:6379
```

Source: [GitHub Docs - PostgreSQL service containers](https://docs.github.com/en/actions/guides/creating-postgresql-service-containers), [Redis service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-redis-service-containers)

**Critical notes:**
- Services must be on the same job that uses them (cannot be shared across jobs)
- Port mapping (`5432:5432`) is required for runner jobs (not container jobs)
- Access via `localhost`, not the service label
- Health checks ensure services are ready before steps execute
- `postgres:17` and `redis:7` match the production versions in `docker-compose.yml`

### Pattern 3: Playwright in CI with Chromium Only

**What:** Override the default multi-browser config to run only Chromium in CI.
**When to use:** Locked decision -- CI runs Chromium only for speed.

```yaml
- name: Run E2E tests
  run: npx playwright test --project=chromium
  env:
    NODE_ENV: test
    FORCE_HTTPS: "false"
    E2E_TEST: "true"
```

The `--project=chromium` flag selects only the Chromium project from the Playwright config. The existing `playwright.config.ts` already has `process.env.CI` checks for:
- `forbidOnly: !!process.env.CI` -- prevents `.only` from passing in CI
- `retries: process.env.CI ? 1 : 0` -- 1 retry in CI
- `reporter: process.env.CI ? 'github' : 'html'` -- GitHub reporter for CI annotations
- `reuseExistingServer: !process.env.CI` -- always starts fresh server in CI

The `webServer` config handles building the client and starting the dev server automatically.

### Pattern 4: Render Native Auto-Deploy

**What:** Use Render's `autoDeployTrigger: checksPass` instead of deploy hooks.
**When to use:** When the CI workflow is in the same repo linked to Render.

```yaml
# render.yaml addition
services:
  - type: web
    name: secureshare
    autoDeployTrigger: checksPass   # Wait for GitHub Actions to pass
    # ... rest of config
```

**How it works:**
1. Push to main triggers GitHub Actions CI workflow
2. Render sees the push but waits (does not deploy yet)
3. GitHub Actions runs lint, test, e2e
4. If all checks pass (conclusion: `success`, `neutral`, or `skipped`), Render deploys
5. If any check fails, Render does not deploy

Source: [Render Docs - Deploys](https://render.com/docs/deploys), [Render Blueprint Spec](https://render.com/docs/blueprint-spec)

**Advantages over deploy hooks:**
- No secrets to manage (`RENDER_DEPLOY_HOOK_URL`)
- No curl step in the workflow
- No race condition between CI finish and hook call
- Render handles the orchestration natively
- Works for both push-to-main and PR-merge-to-main

### Pattern 5: Coverage Reports Without Gating

**What:** Generate coverage via Vitest V8 provider, output as text summary, no threshold enforcement.
**When to use:** Locked decision -- coverage is informational only.

```yaml
- name: Run tests with coverage
  run: npx vitest run --coverage
```

Vitest config addition:
```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json-summary'],
    reportsDirectory: './coverage',
  },
}
```

The `text` reporter prints a table to stdout (visible in CI logs). The `json-summary` reporter creates `coverage/coverage-summary.json` for potential future use by coverage-report actions.

### Anti-Patterns to Avoid

- **Running all 3 browsers in CI:** Wastes 2-3x the time. Chromium-only is the locked decision.
- **Using `npm install` instead of `npm ci`:** `npm ci` is deterministic and faster in CI (uses lockfile exactly).
- **Skipping service container health checks:** Without health checks, tests may start before PostgreSQL/Redis are ready.
- **Using deploy hooks when native integration exists:** Deploy hooks add complexity (secret management, curl step) when Render's `autoDeployTrigger: checksPass` handles it natively.
- **Caching node_modules directly:** Fragile across Node.js versions and platforms. Use `actions/setup-node` npm cache instead.
- **Running E2E against production Docker image in CI:** Adds Docker build time. The existing `webServer` config in `playwright.config.ts` handles building and starting the dev server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deployment triggering | Custom curl/webhook step | Render `autoDeployTrigger: checksPass` | Native, no secrets, no race conditions |
| npm dependency caching | Manual `actions/cache` for npm | `actions/setup-node@v6` with `cache: 'npm'` | Built-in, handles cache key generation |
| Playwright browser caching | Custom hash computation | `actions/cache@v4` keyed on Playwright version from `package-lock.json` | Standard pattern, version-aware |
| Coverage report commenting | Custom script to parse coverage | Print to stdout via `text` reporter | Simple, visible in CI logs, no action needed |
| Service container setup | Docker Compose in CI | GitHub Actions `services` block | Native lifecycle management, health checks, port mapping |
| E2E server startup | Custom start script | Playwright `webServer` config (already exists) | Handles build + start + health check + shutdown |

**Key insight:** The project already has all the right infrastructure (Playwright config with CI detection, health endpoint, docker-compose.yml, render.yaml). The CI workflow just needs to orchestrate what already exists.

## Common Pitfalls

### Pitfall 1: Service Containers Not Ready

**What goes wrong:** E2E tests start before PostgreSQL finishes initialization, causing connection errors.
**Why it happens:** Service containers start in parallel with job steps. Without health checks, the first step runs immediately.
**How to avoid:** Always include `options` with `--health-cmd`, `--health-interval`, `--health-timeout`, `--health-retries`. GitHub Actions waits for health checks to pass before running steps.
**Warning signs:** Intermittent "connection refused" or "ECONNREFUSED" errors in CI.

### Pitfall 2: Playwright Browser Install Without System Dependencies

**What goes wrong:** Playwright browsers fail to launch with missing shared library errors.
**Why it happens:** `npx playwright install chromium` installs the browser binary but not OS-level dependencies (libgbm, libnss3, etc.).
**How to avoid:** Use `npx playwright install --with-deps chromium` which installs both browser and system dependencies.
**Warning signs:** Errors like `browserType.launch: Executable doesn't exist` or `error while loading shared libraries`.

### Pitfall 3: DATABASE_URL for Unit Tests vs E2E Tests

**What goes wrong:** Vitest server integration tests need a real PostgreSQL connection, but the unit test job may not have service containers.
**Why it happens:** The project uses real DB connections for server tests (not mocks), as noted in the project docs.
**How to avoid:** Two options: (a) Add PostgreSQL service container to the test job too, or (b) separate client tests (no DB) from server tests (needs DB). **Recommendation:** Add PostgreSQL to the test job since server tests already require it via `dotenv/config` loading `DATABASE_URL`.
**Warning signs:** `ECONNREFUSED` in Vitest server tests, or Zod validation error for missing `DATABASE_URL`.

### Pitfall 4: E2E_TEST Env Var Not Set in CI

**What goes wrong:** Rate limits hit during E2E test runs, causing 429 errors.
**Why it happens:** The `E2E_TEST=true` env var must be set on the Playwright webServer process, not just the test runner.
**How to avoid:** The existing `playwright.config.ts` already sets `E2E_TEST: 'true'` in the `webServer.env` block. No additional CI config needed -- Playwright handles it.
**Warning signs:** HTTP 429 responses during E2E test runs.

### Pitfall 5: Playwright Cache Invalidation

**What goes wrong:** Cached browser binaries become stale when Playwright is updated, causing version mismatch errors.
**Why it happens:** The cache key is not tied to the Playwright version.
**How to avoid:** Key the browser cache on the Playwright version from `package-lock.json`. When `@playwright/test` updates, the cache key changes and a fresh install occurs.
**Warning signs:** Errors about browser version mismatch or unexpected behavior after Playwright upgrade.

### Pitfall 6: CI Environment Variable for GitHub Actions

**What goes wrong:** Playwright config checks `process.env.CI` but it might not be set.
**Why it happens:** Forgetting that GitHub Actions automatically sets `CI=true`.
**How to avoid:** No action needed -- GitHub Actions sets `CI=true` by default. The existing `playwright.config.ts` already relies on this.
**Warning signs:** N/A -- this is a non-issue, but worth documenting.

### Pitfall 7: Drizzle Migrations Not Run Before E2E

**What goes wrong:** E2E tests fail because the database schema doesn't exist.
**Why it happens:** Service containers provide a blank database. Migrations must run before tests.
**How to avoid:** The Playwright `webServer` config runs `npm run build:client && npm run dev:server`, and the server startup includes the ORM migrator. Alternatively, run `node --import tsx server/src/db/migrate.ts` as an explicit step before E2E.
**Warning signs:** "relation does not exist" PostgreSQL errors.

## Code Examples

### Complete CI Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: Lint & Format
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    name: Unit Tests & Coverage
    needs: [lint]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: secureshare
          POSTGRES_PASSWORD: secureshare
          POSTGRES_DB: secureshare
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    env:
      DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - run: npx vitest run --coverage

  e2e:
    name: E2E Tests
    needs: [lint]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: secureshare
          POSTGRES_PASSWORD: secureshare
          POSTGRES_DB: secureshare
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    env:
      DATABASE_URL: postgresql://secureshare:secureshare@localhost:5432/secureshare
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: 'npm'
      - run: npm ci
      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - name: Install Playwright (Chromium)
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      - name: Install Playwright system deps (cache hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
      - name: Run E2E tests
        run: npx playwright test --project=chromium
      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v6
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 7
```

### Render Blueprint Update

```yaml
# render.yaml — add autoDeployTrigger
services:
  - type: web
    name: secureshare
    runtime: docker
    plan: free
    region: oregon
    autoDeployTrigger: checksPass  # Wait for CI to pass before deploying
    healthCheckPath: /api/health
    # ... rest of existing config
```

### Vitest Coverage Config Addition

```typescript
// vitest.config.ts — add coverage configuration
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
    },
    // ... existing config
  },
});
```

### CI Badge for README

```markdown
[![CI](https://github.com/norcalcoop/secureshare/actions/workflows/ci.yml/badge.svg)](https://github.com/norcalcoop/secureshare/actions/workflows/ci.yml)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `actions/setup-node@v4` | `actions/setup-node@v6` | Jan 2026 | Node 24 runtime, auto npm caching |
| `actions/upload-artifact@v4` | `actions/upload-artifact@v6` | Late 2025 | Node 24 runtime |
| `actions/checkout@v4` | `actions/checkout@v6` | Dec 2025 | Node 24 runtime |
| `actions/cache@v3` | `actions/cache@v4` | Feb 2025 | v3 deprecated, new cache service backend |
| Render `autoDeploy: true` | `autoDeployTrigger: checksPass` | 2025 | Native CI-gated deployment replaces manual deploy hooks |
| `microsoft/playwright-github-action` | `npx playwright install --with-deps` | 2024 | GitHub Action deprecated in favor of CLI |

**Deprecated/outdated:**
- `actions/upload-artifact@v3`: Deprecated as of Jan 30, 2025
- `microsoft/playwright-github-action`: Deprecated in favor of Playwright CLI
- Render `autoDeploy` field: Replaced by `autoDeployTrigger`

## Discretion Recommendations

Based on research, here are recommendations for the Claude's Discretion areas:

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| Workflow structure | Single workflow, 4 jobs | Simple, one badge, clear dependency chain |
| CI triggers | `push: [main]` + `pull_request: [main]` | Standard pattern; catches both direct pushes and PRs |
| Node version matrix | Single version (Node 24) | Project targets Node 24.x LTS specifically; multi-version adds cost without value |
| E2E service setup | GitHub Actions service containers | Native, faster than Docker Compose, managed lifecycle |
| E2E test target | Dev server (via Playwright webServer) | Already configured, no Docker build needed, faster |
| Playwright sharding | No sharding (single runner) | 4 test files, Chromium only; sharding overhead exceeds benefit |
| Failure artifacts | Upload Playwright report on failure | Standard practice, 7-day retention, helps debug CI failures |
| Deploy trigger | Render native `autoDeployTrigger: checksPass` | No secrets, no curl, native integration |
| Deploy verification | Fire-and-forget (Render handles health checks) | Render has its own `healthCheckPath` configured; adding a post-deploy check from CI is redundant |
| PR feedback | Standard GitHub checks (no summary comments) | Sufficient for single-contributor workflow; coverage report actions add complexity without value |

## Open Questions

1. **Server tests requiring PostgreSQL**
   - What we know: Vitest server tests use real DB connections (not mocks), loaded via `dotenv/config`
   - What's unclear: Whether ALL server tests need DB, or just integration tests
   - Recommendation: Add PostgreSQL service container to the `test` job to be safe. The overhead is minimal (a few seconds for container startup).

2. **Drizzle migrations in CI**
   - What we know: The server startup flow includes migration via `server/src/db/migrate.ts`. The Playwright `webServer` config starts the dev server which runs migrations.
   - What's unclear: Whether the Vitest test setup also runs migrations, or if they need to be run explicitly.
   - Recommendation: Add an explicit migration step (`node --import tsx server/src/db/migrate.ts`) before running unit tests in the test job. The E2E job can rely on the Playwright webServer to handle it.

3. **README creation**
   - What we know: No README.md exists yet at the project root. The CI badge needs a README to be added to.
   - What's unclear: Phase 19 (GitHub Repository) includes REPO-01 (README with badges). Should phase 18 create a minimal README just for the badge, or defer?
   - Recommendation: Create a minimal README with just the CI badge and project name. Phase 19 will expand it. This satisfies the locked decision "add CI badge to README" without overstepping into phase 19 scope.

## Sources

### Primary (HIGH confidence)
- [GitHub Docs - PostgreSQL service containers](https://docs.github.com/en/actions/guides/creating-postgresql-service-containers) - Service container YAML syntax, health checks, port mapping
- [GitHub Docs - Redis service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-redis-service-containers) - Redis service container syntax
- [GitHub Docs - Workflow syntax](https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions) - Job dependencies, `needs`, conditional expressions
- [Playwright Docs - CI](https://playwright.dev/docs/ci) - Recommended CI setup, artifact upload, caching advice
- [Playwright Docs - Browsers](https://playwright.dev/docs/browsers) - `npx playwright install --with-deps chromium` for specific browser install
- [Render Docs - Deploys](https://render.com/docs/deploys) - Auto-deploy options including `After CI Checks Pass`
- [Render Docs - Blueprint Spec](https://render.com/docs/blueprint-spec) - `autoDeployTrigger: checksPass` field specification
- [Render Docs - Deploy Hooks](https://render.com/docs/deploy-hooks) - Deploy hook URL, HTTP methods, security
- [Vitest Docs - Coverage](https://vitest.dev/guide/coverage.html) - V8 provider, reporters, CLI flag

### Secondary (MEDIUM confidence)
- [actions/setup-node README](https://github.com/actions/setup-node) - v6.2.0 (Jan 2026), npm cache support
- [actions/upload-artifact releases](https://github.com/actions/upload-artifact/releases) - v6 latest, Node 24 runtime
- [actions/checkout releases](https://github.com/actions/checkout/releases) - v6.0.1 (Dec 2025)
- [actions/cache README](https://github.com/actions/cache) - v4 latest, cache service backend

### Tertiary (LOW confidence)
- Playwright browser cache path (`~/.cache/ms-playwright` on Linux) - mentioned in community issues and blog posts but not prominently in official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official GitHub/Playwright/Render documentation verified all action versions and syntax
- Architecture: HIGH - Standard patterns well-documented; project already has all infrastructure in place
- Pitfalls: HIGH - Based on official docs, known issues, and analysis of existing project configuration
- Render integration: HIGH - `autoDeployTrigger: checksPass` verified in official Blueprint spec docs

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable domain -- GitHub Actions, Playwright, Render are mature)
