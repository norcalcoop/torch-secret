# Project Research Summary

**Project:** SecureShare v3.0 — DevOps, Testing, and Code Quality Milestone
**Domain:** Production-ready deployment infrastructure for a zero-knowledge secret sharing web application
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

SecureShare has completed v2.0 with a feature-complete security product: AES-256-GCM encryption, password protection, auto-expiration, dark terminal design, WCAG 2.1 AA accessibility, and 163 unit/integration tests. The v3.0 milestone transforms this working application into a production-ready, professionally-launched product by adding five infrastructure layers: Docker containerization, CI/CD pipeline, E2E browser tests, code quality tooling (ESLint/Prettier), and an enhanced marketing homepage for Product Hunt launch.

The recommended approach is a five-phase sequential build: (1) Code quality foundation with ESLint/Prettier to establish clean code discipline, (2) Docker containerization with careful attention to argon2 native binaries requiring Debian-based images not Alpine, (3) E2E testing with Playwright configured for strict CSP bypass and one-time-secret test isolation, (4) GitHub Actions CI/CD orchestrating lint/test/build/E2E, and (5) marketing homepage enhancement as a content addition to the existing SPA.

The critical risk is that this milestone adds testing and deployment infrastructure to an app with uncommon constraints: strict CSP nonces block Playwright automation, one-time secrets destroy test data after single use, and argon2 native binaries fail in Alpine Docker images. Each pitfall has been researched with documented prevention strategies. Overall confidence is HIGH because all recommended technologies are verified against official documentation and the existing architecture is well-understood.

## Key Findings

### Recommended Stack

All new additions are dev dependencies or infrastructure configuration. Zero production runtime dependencies are added. The stack builds around the existing validated architecture (Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17, Redis 7, Vitest 4, vanilla TypeScript).

**Core technologies:**

- **Playwright ^1.50.0** (E2E testing) — The 2026 standard for browser testing. Supports Node.js 24, multi-browser (Chromium/Firefox/WebKit), built-in webServer array for dual Express+Vite launch, auto-wait for elements reducing flake. Pinned to 1.50.x to control browser version upgrades. Chosen over Cypress (no WebKit support) and Selenium (legacy architecture).

- **ESLint 10.0 + typescript-eslint ^8.56.0** (linting) — ESLint 10 released February 2026. Starting fresh with flat config (the only config system in v10), no migration cost. typescript-eslint provides type-checked linting that catches bugs strict TypeScript misses (no-floating-promises, no-unsafe-assignment). Fallback to ESLint 9 is trivial if ecosystem compatibility issues surface.

- **Prettier ^3.8.0** (formatting) — Latest stable formatter with TypeScript config file support. Opinionated, zero-config debates. Runs separately from ESLint (not as a plugin) per official Prettier team recommendation. eslint-config-prettier disables conflicting rules.

- **node:24-slim Docker base** — Debian Bookworm-slim (~200MB) chosen over Alpine because argon2 native module has prebuilt binaries for glibc only. Alpine uses musl libc, requiring source compilation with 2-3 minute build overhead and +300MB toolchain. Multi-stage build separates build dependencies from production runtime.

- **Render.com via render.yaml Blueprint** — Infrastructure-as-code for web service + PostgreSQL + Redis. Docker runtime, health checks, auto-deploy on push to main. Simpler than Railway (manual setup) or Fly.io (requires more DevOps knowledge). Free tier includes PostgreSQL 17 and Redis Key Value store.

- **GitHub Actions** — Native CI for the GitHub-hosted repo. Free for public repos, tightest integration. Workflow uses PostgreSQL and Redis service containers with health checks. Separate jobs for lint, unit test (Vitest), build (Vite client + TS server), and E2E (Playwright).

### Expected Features

**Must have (table stakes):**

- Docker Compose for local development — Contributors should not manually install PostgreSQL 17 and Redis. Compose file defines services with persistent volumes. App runs on host for hot reload, infrastructure in containers.

- Production Dockerfile (multi-stage) — Cloud deployment requires reproducible container images. Three stages: install deps, build client+server, production runtime. Critical: Use node:24-slim NOT Alpine due to argon2.

- ESLint + Prettier configuration — 163 tests exist but zero code quality tooling. Inconsistent code style is a maintenance burden. ESLint catches unused vars and type errors, Prettier enforces formatting.

- Pre-commit hooks (Husky + lint-staged) — Enforces quality at commit time, not just in CI. Runs ESLint --fix and Prettier --write on staged files.

- GitHub Actions CI pipeline — Automated validation on every push/PR. Jobs: lint, test (with PostgreSQL/Redis services), build (Vite + tsc), E2E (Playwright with Chromium).

- E2E test foundation (Playwright) — The 163 existing tests are unit/integration in Node.js. Critical user flows (create secret, reveal, password protection) involve browser-specific behavior: Web Crypto API, clipboard, URL fragments, DOM. Playwright tests the real full-stack flow.

- Enhanced marketing homepage — Current homepage is functional (form + trust sections) but not optimized for Product Hunt launch. PRD explicitly targets public launch. Needs: hero section with value prop, trust signals bar, security deep-dive (zero-knowledge diagram), use cases, open source CTA.

**Should have (polish):**

- Health check endpoint (/healthz) — 30 minutes of work. Enables Docker HEALTHCHECK, Render health checks, Playwright readiness probes. Returns 200 OK with status JSON. Includes database connectivity check.

- Privacy Policy / Terms of Service pages — Launch-ready product needs legal pages. For a privacy-focused tool, the privacy policy itself is a trust signal. Add /privacy and /terms routes to SPA.

- Animated zero-knowledge diagram (CSS-only) — Homepage "wow factor" for technical audiences. Shows data flow with three nodes: Browser (encrypts), Server (stores blob), Recipient (decrypts). Key stays in browser. Use @keyframes with prefers-reduced-motion fallback.

- GitHub badge / open source CTA — Drives engagement from launch traffic. GitHub stars are primary trust signal for developer tools on Product Hunt.

**Defer (v2+):**

- Visual regression tests (Playwright screenshots) — Valuable for dark/light theme validation, but not blocking launch.

- CI Docker image publishing to GHCR — Only matters after launch when self-hosters appear.

- Multi-platform Docker builds (linux/amd64, linux/arm64) — Nice for ARM instances but not launch-critical.

### Architecture Approach

The v3.0 milestone adds five infrastructure layers as wrappers around existing application code. No existing application logic changes required except two small additions: /healthz endpoint in server/src/app.ts and hero section in client/src/pages/create.ts. All infrastructure is additive.

**Major components:**

1. **Dockerfile (multi-stage)** — Four stages: (1) deps: install all node_modules, (2) client-build: vite build to client/dist, (3) server-build: tsc compile to dist/server, (4) production: node:24-slim with production node_modules + compiled artifacts. Integrates with existing build scripts, no changes to package.json commands.

2. **docker-compose.yml** — Dev infrastructure only. PostgreSQL 17 and Redis 7 in containers with persistent volumes. App runs on host via npm run dev:server and npm run dev:client for hot reload. Matches existing .env.example connection strings, zero configuration changes.

3. **e2e/ directory (sibling to client/ and server/)** — Playwright test suite with webServer array that auto-starts Express backend and Vite frontend. Page Object Models (create.page.ts, reveal.page.ts, confirmation.page.ts) encapsulate UI interactions. Tests use bypassCSP: true to work with strict nonce-based CSP. Each test creates its own secret via API fixtures to handle one-time-view destruction.

4. **eslint.config.ts (flat config)** — ESLint 10 TypeScript config using @eslint/js recommended + typescript-eslint recommendedTypeChecked (not strict, too aggressive). eslint-config-prettier disables formatting rules. Separate rules for test files. Husky + lint-staged runs ESLint --fix and Prettier --write on pre-commit.

5. **render.yaml (Blueprint IaC)** — Declarative service definition: web service (Docker runtime, health check /healthz), PostgreSQL 17 database, Redis Key Value store. Environment variables injected via fromDatabase and fromService references. Auto-deploys on push to main.

**Data flow:**

Docker build: deps stage -> client build (Vite) -> server build (tsc) -> production image with compiled artifacts.

CI pipeline: checkout -> install -> [parallel: lint + unit test with PostgreSQL service] -> build (Vite + tsc) -> E2E (Playwright with PostgreSQL service).

E2E tests: Playwright webServer array launches Express (:3000) and Vite (:5173) -> tests hit localhost:5173 -> Vite proxies /api to Express -> Express uses test PostgreSQL.

### Critical Pitfalls

1. **Argon2 native binary fails in Alpine Docker images** — The argon2 npm package (v0.44.0) ships prebuilt binaries compiled against glibc (Debian/Ubuntu). Alpine uses musl libc. Install fails with "No native build was found." Building from source requires gcc/g++/make/python3, adding 300MB and 2-3 minutes. Prevention: Use node:24-slim (Debian bookworm-slim, glibc). Multi-stage build keeps final image small. Confidence: HIGH — verified in argon2 GitHub issues and npm package docs.

2. **CSP nonce-based headers block Playwright test injection** — SecureShare's CSP is script-src 'self' 'nonce-RANDOM' with NO unsafe-inline or unsafe-eval. Playwright injects scripts for automation (locators, page.evaluate()). These scripts lack the nonce and are blocked. Tests timeout without clear errors. Prevention: Set bypassCSP: true in Playwright config (test-only option, does not weaken production CSP). Write a separate CSP verification test without bypassCSP to ensure headers are strict. Confidence: HIGH — verified in Playwright official docs and GitHub issues.

3. **One-time secrets destroy test data — E2E tests are non-repeatable** — SecureShare's core feature: secrets are atomically destroyed after single view (SELECT -> zero ciphertext -> DELETE). E2E tests that reveal a secret consume it permanently. Test cannot be re-run. Parallel tests may consume each other's secrets. Prevention: Each test creates its own fresh secret via API fixtures. Use fullyParallel: false or database isolation. Reset database between test suites via globalSetup. Confidence: HIGH — this is a domain-specific constraint, not a framework bug.

4. **Vitest and Playwright file pattern collision** — Both frameworks default to *.test.ts. If Playwright tests are near existing Vitest tests, Vitest tries to run Playwright files (import errors) or vice versa. TypeScript types conflict (both define global test, expect). Prevention: Strict naming convention (Vitest: *.test.ts, Playwright: *.spec.ts). Separate directory (e2e/ at repo root, outside client/ and server/). Separate tsconfig.json for e2e/ with no vitest/globals types. Confidence: HIGH — standard multi-framework setup pattern.

5. **CI pipeline exposes DATABASE_URL or runs tests without services ready** — Integration tests require real PostgreSQL. GitHub Actions services start in parallel with job steps, not sequentially. Without health checks, tests connect before PostgreSQL is ready, causing "connection refused." DATABASE_URL hardcoded in workflow exposes credentials in public repos. Prevention: Add --health-cmd, --health-interval, --health-retries to service containers. For CI, ephemeral credentials in workflow file are acceptable (database created/destroyed per run). Run npm run db:migrate before npm test. Confidence: HIGH — verified in GitHub Actions official docs.

## Implications for Roadmap

Based on research, suggested phase structure: five sequential phases with clear dependencies.

### Phase 1: Code Quality Foundation

**Rationale:** Establish clean code discipline before adding infrastructure. The initial ESLint + Prettier pass reformats the entire codebase. This should be a single commit ("chore: format codebase") before any feature work to keep git blame clean. Every subsequent commit will be linted on pre-commit, so this foundation must exist first.

**Delivers:**
- eslint.config.ts with @eslint/js recommended + typescript-eslint recommendedTypeChecked
- .prettierrc with single quotes, trailing commas, 80-char width
- Husky + lint-staged pre-commit hooks
- Initial format pass: npx prettier --write . && npx eslint --fix .
- CI job: lint (ESLint check + Prettier check)

**Addresses features:**
- ESLint + Prettier configuration (table stakes)
- Pre-commit hooks (table stakes)

**Avoids pitfall:**
- ESLint flat config assumes React (Pitfall 6) — Use vanilla TS config, no React plugins

**Research flag:** Standard patterns, no additional research needed.

### Phase 2: Docker and Local Development

**Rationale:** Docker containerization comes next because the health check endpoint (needed for Docker HEALTHCHECK) is also used by Playwright webServer readiness probes in Phase 3. Building Docker validates the production build works and catches TypeScript compilation issues before writing E2E tests.

**Delivers:**
- Dockerfile (multi-stage: deps -> client build -> server build -> production)
- docker-compose.yml (PostgreSQL 17 + Redis 7 for dev)
- .dockerignore (exclude node_modules, .git, .env, .planning, e2e)
- Health check endpoint: GET /healthz in server/src/app.ts
- Validation: docker compose up + docker build + docker run + POST /api/secrets with password

**Addresses features:**
- Docker Compose for local development (table stakes)
- Production Dockerfile (table stakes)
- Health check endpoint (should have)

**Avoids pitfalls:**
- Argon2 fails in Alpine (Pitfall 1) — Use node:24-slim base
- Trust proxy misconfiguration (Pitfall 7) — Document trust proxy: 1 for single-hop

**Research flag:** Standard patterns, no additional research needed. The argon2/Alpine issue is well-documented.

### Phase 3: End-to-End Testing with Playwright

**Rationale:** E2E tests validate the complete user flow that unit tests cannot cover (Web Crypto API, URL fragments, browser rendering). Playwright needs the health check from Phase 2 for webServer readiness probes. E2E tests also serve as the best validation of production readiness before building CI.

**Delivers:**
- e2e/ directory at repo root
- playwright.config.ts with webServer array (Express + Vite), bypassCSP: true
- Page Object Models (create.page.ts, reveal.page.ts, confirmation.page.ts)
- 5-8 E2E test specs covering: create secret, reveal secret, password protection, error states
- Test fixtures for creating fresh secrets via API
- npm scripts: test:e2e, test:e2e:ui, test:e2e:headed

**Addresses features:**
- E2E test foundation (table stakes)

**Avoids pitfalls:**
- CSP blocks Playwright (Pitfall 2) — Set bypassCSP: true, add separate CSP verification test
- One-time secrets destroy test data (Pitfall 3) — Each test creates own secret via fixtures
- Vitest/Playwright collision (Pitfall 4) — Separate directory, *.spec.ts naming, separate tsconfig

**Research flag:** Domain-specific complexity (one-time secrets, strict CSP) requires careful test design. Standard Playwright patterns otherwise.

### Phase 4: CI/CD Pipeline

**Rationale:** CI orchestrates all the tools from previous phases. All four must work locally before automating in CI. Phase 1 (lint), Phase 2 (Docker), and Phase 3 (E2E) are prerequisites. CI validates production readiness and enables auto-deployment to Render.

**Delivers:**
- .github/workflows/ci.yml with jobs: lint, test (Vitest with PostgreSQL service), build (Vite + tsc), e2e (Playwright with PostgreSQL service)
- PostgreSQL and Redis service containers with health checks
- Actions: actions/checkout@v6, actions/setup-node@v6, actions/upload-artifact@v4 (Playwright reports)
- render.yaml Blueprint (web service + PostgreSQL + Redis)
- Render auto-deploy on push to main

**Addresses features:**
- GitHub Actions CI pipeline (table stakes)

**Avoids pitfalls:**
- CI database services not ready (Pitfall 5) — Add health checks, run db:migrate before tests

**Research flag:** Standard GitHub Actions patterns. Render.com Blueprint syntax verified against official spec.

### Phase 5: Marketing Homepage and GitHub Polish

**Rationale:** Content and polish come last after infrastructure is stable. The marketing homepage is a content addition to the existing SPA (client/src/pages/create.ts), not a routing change. Screenshots can be captured from the final state.

**Delivers:**
- Enhanced hero section in client/src/pages/create.ts (replace header, add feature pills)
- Security deep-dive section with zero-knowledge diagram (CSS animation)
- Use cases section (4 cards)
- Privacy Policy and Terms of Service pages (new routes /privacy and /terms)
- GitHub star badge / open source CTA
- Footer enhancement with legal links
- .github/ issue templates and PR template
- README with screenshots, architecture diagram, installation instructions

**Addresses features:**
- Enhanced marketing homepage (table stakes)
- Privacy/Terms pages (should have)
- Animated zero-knowledge diagram (should have)
- GitHub badge/CTA (should have)

**Avoids pitfalls:**
- Marketing page breaks SPA routing (Pitfall 8) — Extend create.ts, not a separate route

**Research flag:** No research needed. Frontend design skill should be invoked per CLAUDE.md requirement before writing UI/UX code.

### Phase Ordering Rationale

- **Lint first** because every subsequent commit should be clean. The initial format pass is a one-time cost that makes all future diffs cleaner. Pre-commit hooks enforce quality from day one.

- **Docker before E2E** because the health check endpoint (needed for Docker) is also used by Playwright's webServer readiness probe. Building Docker validates the production build, which catches TypeScript issues before E2E tests.

- **E2E after Docker** because E2E tests need a reliable signal for server readiness (/healthz). E2E validates the complete user flow, which is the best test of production readiness.

- **CI after all tools exist** because CI orchestrates lint + test + build + E2E. All four must work locally before automating in CI.

- **Marketing homepage last** because it is content, not infrastructure. It should be written after the architecture is stable and screenshots can be captured.

This order minimizes rework. Each phase builds on the previous one. The only parallel work possible: Phase 5 (marketing content) could start earlier since it is independent of infrastructure, but writing it last ensures screenshots show the final state.

### Research Flags

**Phases needing deeper research during planning:** None. All phases use well-documented, established patterns.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Linting):** ESLint flat config + Prettier is documented in official guides.
- **Phase 2 (Docker):** Multi-stage builds are standard. The argon2/Alpine pitfall is well-known.
- **Phase 3 (E2E):** Playwright webServer and bypassCSP are documented features.
- **Phase 4 (CI/CD):** GitHub Actions service containers and Render Blueprint syntax are official patterns.
- **Phase 5 (Marketing):** Content work, no technical research needed. Use frontend-design skill.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs. Playwright, ESLint 10, Prettier, Docker multi-stage builds, Render.com Blueprint spec, GitHub Actions are documented patterns. |
| Features | HIGH | Competitor analysis (OneTimeSecret, Yopass, Password Pusher) confirms feature expectations. Docker Compose and E2E tests are universal for production-ready projects. |
| Architecture | HIGH | Integration points verified: Playwright webServer with Express+Vite, ESLint flat config with typescript-eslint, Docker multi-stage with node:24-slim, Render Blueprint with managed services. |
| Pitfalls | HIGH | Argon2/Alpine issue documented in GitHub issues. CSP/Playwright bypassCSP documented in official docs. One-time-secret test isolation is domain-specific but clear. |

**Overall confidence:** HIGH

### Gaps to Address

**ESLint 10 ecosystem compatibility:** ESLint 10 was released February 6, 2026 (10 days ago). typescript-eslint and eslint-config-prettier already support it. However, if any edge-case plugin is needed later and does not support ESLint 10, fallback to ESLint 9 is trivial (same flat config format). Monitor during Phase 1 setup.

**Render.com free tier PostgreSQL expiry:** Conflicting reports on whether free tier databases expire after 30 days or are permanent. Verify current terms during Phase 4 deployment setup. If expiry exists, plan for paid tier ($7/month starter plan).

**tsx in production Docker:** Running tsx (esbuild JIT) in production works but adds ~5MB to the image. The Dockerfile is structured for easy migration to compiled JS later (add tsconfig.server.json, compile to dist/server/, run with node). Optimize in a future iteration if image size becomes a concern.

**Marketing homepage SEO meta tags:** The enhanced homepage is client-rendered (part of the SPA). Search engine crawlers must execute JavaScript to see it. Server-side meta tags in the HTML template provide basic SEO. For better crawling, consider prerendering the marketing page at build time in a future iteration. Not blocking for v3.0 launch.

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [Playwright installation docs](https://playwright.dev/docs/intro) — Node.js 24 support, npm package name
- [Playwright release notes](https://playwright.dev/docs/release-notes) — v1.58 latest, version pinning rationale
- [Playwright webServer docs](https://playwright.dev/docs/test-webserver) — Multiple webServer array config
- [ESLint 10 release blog](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/) — Flat config, Node.js requirements
- [typescript-eslint getting started](https://typescript-eslint.io/getting-started/) — Flat config setup, package names
- [typescript-eslint dependency versions](https://typescript-eslint.io/users/dependency-versions/) — ESLint 10 support confirmed
- [Render.com Blueprint spec](https://render.com/docs/blueprint-spec) — render.yaml structure
- [Docker Hub node:24-slim](https://hub.docker.com/_/node) — Debian Bookworm-slim tags

**Features research:**
- [OneTimeSecret homepage](https://onetimesecret.com/) — Competitor analysis
- [Password Pusher homepage](https://pwpush.com/) — Competitor analysis
- [Yopass homepage](https://yopass.se/) — Competitor analysis

**Architecture research:**
- [Docker Multi-Stage Build Documentation](https://docs.docker.com/build/building/multi-stage/) — Official patterns
- [Playwright webServer Configuration](https://playwright.dev/docs/test-webserver) — Array syntax
- [Playwright Page Object Models](https://playwright.dev/docs/pom) — Official POM pattern
- [ESLint Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) — Flat config, eslint.config.ts support
- [Prettier Integrating with Linters](https://prettier.io/docs/integrating-with-linters) — eslint-config-prettier approach
- [Render Blueprint Spec](https://render.com/docs/blueprint-spec) — render.yaml syntax reference

**Pitfalls research:**
- [node-argon2 Alpine compatibility issue](https://github.com/ranisalt/node-argon2/issues/223) — GitHub issue, HIGH confidence
- [node-argon2 npm package](https://www.npmjs.com/package/argon2) — Prebuilt binaries for glibc only
- [Playwright bypassCSP option](https://playwright.dev/docs/api/class-testoptions#test-options-bypass-csp) — Official docs
- [GitHub Actions PostgreSQL service containers](https://docs.github.com/actions/guides/creating-postgresql-service-containers) — Official docs
- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html) — Official docs

### Secondary (MEDIUM confidence)

- [Prettier 3.8 release](https://prettier.io/blog/) — v3.8.1 latest, TS config support
- [argon2 npm](https://www.npmjs.com/package/argon2) — Prebuilt binaries, v0.44.0
- [Render.com pricing](https://render.com/pricing) — Free tier availability

### Tertiary (LOW confidence)

- ESLint 10 ecosystem compatibility needs validation during implementation (too new)
- Render.com free tier PostgreSQL expiry needs verification during deployment

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
