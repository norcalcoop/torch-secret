# Technology Stack

**Analysis Date:** 2025-03-01

## Languages

**Primary:**
- TypeScript 5.9 - Full codebase (ESM modules, `"type": "module"` in `package.json`)
  - Client: `client/src/**/*.ts`
  - Server: `server/src/**/*.ts`
  - Shared: `shared/types/**/*.ts`

**Secondary:**
- HTML5 - `client/index.html` (entry point with SEO meta, JSON-LD, FOWT prevention script)
- CSS - `client/src/styles.css` (Tailwind CSS 4 with @theme tokens)
- SQL - `drizzle/` migrations and `server/src/db/schema.ts` (Drizzle schema definitions)

## Runtime

**Environment:**
- Node.js 24.x LTS
  - Dockerfile uses `node:24-slim` as base image
  - Development via `tsx` 4.21.0 for TypeScript execution

**Package Manager:**
- npm (v10 or later)
- Lockfile: `package-lock.json` (committed)

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server, middleware orchestration, REST API routes
  - Configuration: `server/src/app.ts` (middleware order critical — trust proxy → HTTPS → CSP → Helmet → logger → JSON → routes → static → error handler)
  - Server startup: `server/src/server.ts`

- Drizzle ORM 0.45.1 - PostgreSQL query builder with schema-first design
  - Schema: `server/src/db/schema.ts`
  - Connection: `server/src/db/connection.ts` (pg.Pool + Drizzle instance singleton)
  - Migrations: `npm run db:generate`, `npm run db:migrate`

- Vite 7.3.1 - Frontend build tool and dev server
  - Config: `vite.config.ts`
  - Plugins: `@tailwindcss/vite` for JIT Tailwind compilation
  - CSP nonce injection: Vite replaces `__CSP_NONCE__` placeholder at build time

- Better Auth 1.4.18 - Authentication framework
  - Strategies: email/password, Google OAuth 2.0, GitHub OAuth 2.0
  - Email verification via Resend
  - Session management: token-based, stored in PostgreSQL
  - Database: Drizzle adapter managing `users`, `sessions`, `accounts`, `verification` tables

**Frontend:**
- Vanilla TypeScript (no React/Vue/Svelte)
  - Application entry: `client/src/app.ts`
  - Router: `client/src/router.ts` (History API, dynamic imports, SEO meta management)
  - Components: `client/src/components/` (layout, copy-button, share-button, theme-toggle, loading-spinner, etc.)
  - Pages: `client/src/pages/` (home, create, confirmation, reveal, dashboard, login, pricing, etc.)

- Tailwind CSS 4.1.18 with `@tailwindcss/vite` 4.1.18 plugin
  - OKLCH semantic color system via `@theme` blocks
  - Glassmorphism design patterns
  - Class sorting via `prettier-plugin-tailwindcss`

- Lucide 0.575.0 - Icon library (ESM workaround in `vite.config.ts`)
- JetBrains Mono 5.2.8 (variable font for monospace display)

**Testing:**
- Vitest 4.0.18 - Unit and integration test runner
  - Config: `vitest.config.ts`
  - Multi-project setup:
    - Client: happy-dom 20.6.1 (lightweight DOM implementation)
    - Server: Node.js environment, sequential execution (fileParallelism: false)
  - Coverage: v8 provider, reporters: text + json-summary

- Playwright 1.58.2 - End-to-end browser automation and testing
  - Config: `e2e/playwright.config.ts`
  - Browsers: Chromium, Firefox, WebKit
  - Trace: on-first-retry
  - Base URL: http://localhost:3000

- Supertest 7.2.2 - HTTP assertion library for API testing
- vitest-axe 0.1.0 - Accessibility testing integration

**Build/Dev:**
- tsx 4.21.0 - TypeScript execution runtime for Node.js (server dev + migrations)
- Drizzle Kit 0.31.9 - Migration generation and schema synchronization
- ESLint 10.0.0 with typescript-eslint 8.56.0 - Linting
  - Config: `eslint.config.ts` (flat config format)
  - Rules: strict type-checking, no unused variables (with `_` exception), no unsafe assignments in tests

- Prettier 3.8.1 - Code formatting
  - Config: `.prettierrc.json`
  - Plugin: `prettier-plugin-tailwindcss` 0.7.2 (class sorting)
  - Settings: single quotes, trailing commas, 100 char line width

- Husky 9.1.7 - Git hook framework (prepare hook)
- lint-staged 16.2.7 - Pre-commit file linting

## Key Dependencies

**Critical Infrastructure:**
- `pg` 8.18.0 - PostgreSQL client driver (native bindings)
- `drizzle-orm` 0.45.1 - ORM query builder and schema definitions
- `nanoid` 5.1.6 - URL-safe secret ID generation (21 chars, cryptographically secure)
- `argon2` 0.44.0 - Password hashing (Argon2id with OWASP parameters)

**Web Crypto API (Native):**
- `crypto.subtle` - AES-256-GCM symmetric encryption
- `crypto.getRandomValues()` - Cryptographic randomness
- No third-party crypto libraries

**Logging & Security:**
- `pino` 10.3.1 - Structured JSON logging
  - Middleware: `server/src/middleware/logger.ts`
  - Secret ID redaction: regex pattern removes IDs from URL paths
  - Output: JSON to stdout (machine-readable)

- `pino-http` 11.0.0 - HTTP request/response logging middleware
- `pino-pretty` 13.1.3 - Human-readable log formatting (dev mode)
- `helmet` 8.1.0 - HTTP security headers
  - CSP with per-request nonce
  - HSTS, X-Frame-Options, X-Content-Type-Options, etc.

**Rate Limiting & Availability:**
- `express-rate-limit` 8.2.1 - Request rate limiting middleware
- `rate-limit-redis` 4.3.1 - Redis store adapter for distributed rate limiting
- `ioredis` 5.9.3 - Redis client (optional; fallback to in-memory)

**Background Jobs:**
- `node-cron` 4.2.1 - Scheduled task runner
  - Job: `server/src/workers/expiration-worker.ts` (expired secret cleanup at 03:00 UTC daily)

**Email & Communication:**
- `resend` 6.9.2 - Transactional email delivery
  - Service: `server/src/services/email.ts`
  - Features: Transactional templates, Audiences API for marketing lists
  - Events: Email verification, password reset, secret viewed notifications

- `loops` 6.2.0 - Email automation and onboarding
  - Service: `server/src/services/onboarding.service.ts`
  - Sequences: Day-1 welcome, day-3 features, day-7 upgrade prompt
  - Integration: Better Auth `databaseHooks` on user.create event

**Payments:**
- `stripe` 20.3.1 - Payment processing, subscriptions, webhooks
  - Config singleton: `server/src/config/stripe.ts`
  - Service: `server/src/services/billing.service.ts`
  - Webhook handler: `server/src/routes/webhooks.ts`
  - Events: customer.subscription.updated, checkout.session.completed

**Analytics:**
- `posthog-js` 1.352.0 - Client-side product analytics
  - Module: `client/src/analytics/posthog.ts`
  - Zero-knowledge enforcement: before_send hook strips URL fragments (encryption keys)
  - Events: secret_created, secret_viewed, user_registered, checkout_initiated, subscription_activated

**Validation:**
- `zod` 4.3.6 - Runtime schema validation
  - Env vars: `server/src/config/env.ts`
  - API contracts: `shared/types/api.ts`
  - Request validation: `server/src/middleware/validate.ts`

**Utilities:**
- `dotenv` 17.3.1 - Environment variable loading (local dev; Infisical used in prod)
- `happy-dom` 20.6.1 - Lightweight DOM for client tests (alternative to jsdom)

## Configuration

**TypeScript:**
- `tsconfig.json` - Root config (ES2022 target, bundler resolution, strict mode)
- `server/tsconfig.json` - Server overrides (NodeNext resolution, DOM types excluded)

**Build:**
- `vite.config.ts` - Frontend build, Tailwind plugin, proxy to `/api` → localhost:3000, CSP nonce placeholder
- `vitest.config.ts` - Test runner (multi-project, happy-dom for client, node for server)
- `eslint.config.ts` - Flat ESLint config (typescript-eslint, test overrides, Prettier integration)
- `.prettierrc.json` - Prettier (single quotes, trailing commas, 100 width, tailwind sorting)

**Database:**
- `drizzle.config.ts` - ORM config (PostgreSQL dialect, schema path, migrations)
- Migrations: `drizzle/` directory (auto-generated, applied at startup)

**Container:**
- `Dockerfile` - 3-stage build (deps → build frontend → production)
- `docker-compose.yml` - Local dev services (PostgreSQL 17, Redis 7, app container)
- `.dockerignore` - Build context optimization

**Environment Variables:**
- `.env.example` - Template for required/optional vars
- Secrets management: Infisical CLI (`infisical run --env=dev -- npm run dev:server`)

## Platform Requirements

**Development:**
- Node.js 24.x LTS
- PostgreSQL 17+ (or via `docker-compose up`)
- Redis 7+ (optional; required for distributed rate limiting)
- Infisical CLI (required for staging/production; optional for local dev)

**Production:**
- Node.js 24.x runtime
- PostgreSQL 17+ database (managed service: Render Postgres, Neon, AWS RDS, etc.)
- Redis 7+ (optional; for multi-instance rate limiting)
- TLS-terminating reverse proxy (Render, Vercel, Railway, AWS ALB, etc.)
- Secret injection: Infisical vault or hosting platform env vars

**Performance Targets:**
- Frontend bundle: <1s load on 3G (vanilla TS, no React)
- API response: <100ms (secrets CRUD, auth endpoints)
- Database: Connection pool size 10-20 (configurable via DATABASE_URL)

---

*Stack analysis: 2025-03-01*
