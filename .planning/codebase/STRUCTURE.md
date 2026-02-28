# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
secureshare/
├── client/                 # Browser-side SPA (vanilla TypeScript + Vite)
│   ├── src/               # Client source code
│   │   ├── pages/        # Page renderers for SPA routes
│   │   ├── components/   # Reusable UI components
│   │   ├── crypto/       # AES-256-GCM encryption/decryption module
│   │   ├── api/          # Typed fetch wrapper for API
│   │   ├── analytics/    # PostHog integration
│   │   ├── app.ts        # Entry point (DOMContentLoaded)
│   │   ├── router.ts     # History API router with SEO meta management
│   │   ├── theme.ts      # Light/dark/system theme persistence
│   │   └── styles.css    # Tailwind CSS with @theme tokens
│   ├── public/           # Static assets (favicons, manifest, robots, sitemap)
│   ├── index.html        # HTML shell with FOWT prevention script, CSP nonce placeholder
│   └── dist/             # Vite build output (generated, not in git)
├── server/               # Express 5.x backend
│   └── src/              # Server source code
│       ├── routes/       # API endpoint handlers
│       ├── services/     # Business logic (reusable across routes)
│       ├── middleware/   # Express middleware (security, logging, validation)
│       ├── db/           # Database connection, schema, migrations
│       ├── config/       # Environment validation, Stripe, Loops config
│       ├── workers/      # Background jobs (expiration cleanup)
│       ├── auth.ts       # Better Auth configuration
│       ├── app.ts        # Express app factory with middleware order
│       └── server.ts     # HTTP server startup, graceful shutdown
├── shared/               # Code shared between client and server
│   └── types/            # API contracts (Zod schemas + TypeScript types)
├── e2e/                  # Playwright end-to-end tests
│   ├── specs/           # Test specs (journeys)
│   ├── fixtures/        # Test data and fixtures
│   ├── playwright.config.ts
│   └── e2e-config.json  # Test environment config (auth credentials)
├── .planning/            # GSD workflow documents (roadmap, phases, codebase analysis)
├── .github/              # GitHub Actions CI/CD workflows
├── drizzle/              # Generated SQL migrations (committed to git)
├── scripts/              # Build/deploy scripts (reserved)
├── node_modules/         # npm dependencies (not in git)
├── package.json          # Dependencies and npm scripts
├── package-lock.json     # Dependency lock file
├── tsconfig.json         # Root TypeScript config (ESM, bundler resolution)
├── vite.config.ts        # Vite build config (Tailwind plugin, CSP nonce, dev proxy)
├── vitest.config.ts      # Test runner config (multi-project: client+server, dotenv)
├── eslint.config.ts      # ESLint rules (typescript-eslint, imports, best practices)
├── drizzle.config.ts     # Drizzle ORM migration config
├── .lintstagedrc.json    # Pre-commit lint/format staged files
├── .prettierrc.json      # Prettier code formatter config
├── .env                  # Environment variables (secrets, API keys, DB connection)
├── .env.example          # Template for required env vars
├── CLAUDE.md             # Project context and conventions for Claude Code
└── .gitignore            # Git ignore patterns
```

## Directory Purposes

**client/src/:**
- Purpose: All browser-side code (UI, routing, crypto, API client)
- Contains: TypeScript modules for single-page application
- Key files: `app.ts` (entry point), `router.ts` (History API router), `styles.css` (Tailwind CSS 4), `theme.ts` (light/dark/system theme with localStorage persistence)

**client/src/pages/:**
- Purpose: Page components for SPA routes (one file per route)
- Contains: Page renderer functions that accept container HTMLElement and build DOM
- Files: `create.ts` (secret creation form), `reveal.ts` (secret display with password prompt), `confirmation.ts` (shareable link display), `dashboard.ts` (user's secret history, requires auth), `login.ts`, `register.ts`, `forgot-password.ts`, `reset-password.ts`, `error.ts` (404/error), `home.ts` (marketing), `pricing.ts` (pricing table), `privacy.ts`, `terms.ts`, `unsubscribe.ts` (email opt-out)
- Pattern: Each exports async PageRenderer function; router dynamically imports and renders

**client/src/components/:**
- Purpose: Reusable UI components (layout, buttons, forms, spinners)
- Contains: Component factory functions returning HTMLElement
- Files: `layout.ts` (header/footer/dot-grid shell), `theme-toggle.ts` (light/dark selector), `copy-button.ts` (copy-to-clipboard with toast), `share-button.ts` (native share API), `terminal-block.ts` (code block display), `loading-spinner.ts` (animated spinner), `expiration-select.ts` (dropdown for 1h/24h/7d/30d), `toast.ts` (notifications), `icons.ts` (Lucide icon wrapper with aliases), `form-group.ts` (label + input pair)
- Pattern: Each exports `createComponentName()` factory function

**client/src/crypto/:**
- Purpose: Zero-knowledge cryptography module (AES-256-GCM with Web Crypto API)
- Contains: Encryption, decryption, key management, padding, encoding
- Files: `encrypt.ts` (AES-256-GCM encryption with fresh key + IV), `decrypt.ts` (decryption + unpadding), `keys.ts` (key generation + import/export), `padding.ts` (PADME padding scheme), `encoding.ts` (base64 encode/decode), `constants.ts` (algorithm parameters), `passphrase.ts` (passphrase generation), `password-generator.ts` (strong password generation), `types.ts` (EncryptedPayload, EncryptResult), `index.ts` (public barrel export)
- Critical: Only module importing Web Crypto API; never uses Math.random or third-party crypto

**client/src/api/:**
- Purpose: Typed fetch wrapper for HTTP calls to backend
- Contains: `client.ts` (all API functions)
- Files:
  - Secret operations: `createSecret()`, `getSecret()`, `getSecretMeta()`, `verifySecretPassword()`
  - Dashboard: `fetchDashboardSecrets()`, `deleteDashboardSecret()`
  - Auth: `getMe()`
  - Billing: `initiateCheckout()`, `verifyCheckoutSession()`, `createPortalSession()`
  - Error class: `ApiError` with status, body, rateLimitReset (for countdown display on 429)

**client/src/analytics/:**
- Purpose: PostHog integration for analytics and feature flags
- Contains: `posthog.ts` (initialization, event tracking, property sanitization)

**client/public/:**
- Purpose: Static assets copied to client/dist during build
- Contains: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `og-image.png`, `robots.txt`, `site.webmanifest`, `sitemap.xml`

**client/dist/:**
- Purpose: Vite build output (production assets)
- Generated: Yes (via `npm run build:client`)
- Committed: No (in .gitignore)

**server/src/:**
- Purpose: Express backend with REST API
- Contains: TypeScript modules for HTTP server
- Key files: `server.ts` (entry point), `app.ts` (Express app factory), `auth.ts` (Better Auth config)

**server/src/routes/:**
- Purpose: Express route handlers for API endpoints
- Files:
  - `secrets.ts`: Factory `createSecretsRouter(redisClient?)` with routes: POST / (create), GET /:id/meta (metadata), POST /:id/verify (password verify+destroy), GET /:id (retrieve+destroy)
  - `dashboard.ts`: Factory `createDashboardRouter()` with GET /secrets, DELETE /secrets/:id (requires auth)
  - `billing.ts`: POST /checkout, GET /verify-checkout, POST /portal (requires auth)
  - `me.ts`: GET /api/me (authenticated user profile)
  - `health.ts`: GET /api/health (liveness probe)
  - `subscribers.ts`: POST / (email opt-in), GET /:token (unsubscribe verification)
  - `webhooks.ts`: POST /stripe (Stripe webhook handler for subscription updates)
  - `seo/index.ts`: SSR routes for /vs/*, /alternatives/*, /use/* (comparison pages)
- Pattern: Each exports middleware/route function or factory; mounted in app.ts

**server/src/services/:**
- Purpose: Business logic layer (no HTTP concerns; reusable across routes and workers)
- Files:
  - `secrets.service.ts`: `createSecret()`, `retrieveAndDestroy()` [atomic 3-step transaction], `getSecretMeta()`, `verifyAndRetrieve()`, `getUserSecrets()`, `deleteUserSecret()`, `cleanExpiredSecrets()`
  - `password.service.ts`: `hashPassword()` (Argon2id), `verifyPassword()`
  - `notification.service.ts`: `sendSecretViewedNotification()` (Resend email)
  - `billing.service.ts`: `getOrCreateStripeCustomer()`, `activatePro()`, `deactivatePro()`
- Pattern: Pure async functions, no HTTP/req/res handling

**server/src/middleware/:**
- Purpose: Express middleware for cross-cutting concerns
- Files:
  - `security.ts`: `cspNonceMiddleware` (per-request nonce), `createHelmetMiddleware()` (CSP, HSTS, referrer-policy), `httpsRedirect` (HTTP→HTTPS)
  - `rate-limit.ts`: `createAnonHourlyLimiter()`, `createAnonDailyLimiter()`, `createAuthedDailyLimiter()`, `verifySecretLimiter()`
  - `logger.ts`: `httpLogger` (Pino HTTP logger with secret ID redaction)
  - `validate.ts`: `validateBody()`, `validateParams()` (Zod validation factories)
  - `error-handler.ts`: `errorHandler` (global error handler, must be last)
  - `require-auth.ts`: `requireAuth` (validates session, rejects unauthenticated)
  - `optional-auth.ts`: `optionalAuth` (populates user if session exists)
- Pattern: Each independently testable; order enforced in app.ts

**server/src/db/:**
- Purpose: Database layer (PostgreSQL + Drizzle ORM)
- Files:
  - `schema.ts`: Table definitions (secrets, users, sessions, accounts, verification, marketing_subscribers) with indices, types, zero-knowledge-invariant docs
  - `connection.ts`: PostgreSQL pool + Drizzle ORM instance (singleton)
  - `migrate.ts`: Migration runner script

**server/src/config/:**
- Purpose: Configuration (env vars, external service clients)
- Files:
  - `env.ts`: Zod schema for environment variables (DATABASE_URL, PORT, NODE_ENV, REDIS_URL, LOG_LEVEL, Better Auth secrets, Stripe keys, Resend API key, Loops API key, PostHog token)
  - `stripe.ts`: Stripe SDK initialization
  - `loops.ts`: Loops API client initialization

**server/src/workers/:**
- Purpose: Background jobs (scheduled cleanup)
- Files:
  - `expiration-worker.ts`: `startExpirationWorker()`, `stopExpirationWorker()`, `cleanExpiredSecrets()` (cron job every 5 minutes)

**shared/types/:**
- Purpose: API contracts shared between client and server
- Files:
  - `api.ts`: Zod schemas (CreateSecretSchema, SecretIdParamSchema, VerifySecretSchema, etc.) + TypeScript interfaces (CreateSecretResponse, SecretResponse, MetaResponse, DashboardListResponse, MeResponse, BillingCheckoutResponse, etc.)
- Pattern: Single source of truth; used by client (type-safe fetch) and server (middleware validation)

**e2e/:**
- Purpose: End-to-end Playwright tests (browser automation)
- Files:
  - `specs/`: Test spec files (journeys-TESTS.yaml generated by gsd-uat-browser skill)
  - `fixtures/`: Test data (UAT.md files, test accounts)
  - `playwright.config.ts`: Playwright config (browsers, timeout, base URL)
  - `e2e-config.json`: Test environment config (auth credentials, test URLs)

**.planning/:**
- Purpose: GSD workflow documentation (not app code)
- Subdirectories: `phases/`, `milestones/`, `codebase/`, `state/`, `research/`, `concerns/`
- Files: `ROADMAP.md`, `STATE.md`, `INVARIANTS.md`, codebase analysis docs (ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md)

**drizzle/:**
- Purpose: Generated SQL migrations from schema changes
- Generated: Yes (via `npm run db:generate`)
- Committed: Yes (migrations are source code)
- Contents: `*.sql` migration files, `meta/` directory with migration metadata

## Key File Locations

**Entry Points:**
- `server/src/server.ts`: Backend entry point (starts HTTP server, expiration worker, graceful shutdown)
- `client/src/app.ts`: Frontend entry point (DOMContentLoaded, initializes theme + layout + router)
- `client/index.html`: HTML template with FOWT prevention script, `__CSP_NONCE__` placeholder (injected by server)

**Configuration:**
- `package.json`: Dependencies, scripts, `"type": "module"` for ESM
- `tsconfig.json`: TypeScript config (ES2022, ESNext modules, bundler resolution)
- `vite.config.ts`: Vite config (root: client, Tailwind plugin, CSP nonce, dev proxy to :3000)
- `vitest.config.ts`: Test runner config (multi-project: client + server, dotenv setup)
- `drizzle.config.ts`: Drizzle migration config (PostgreSQL connection, output dir)
- `eslint.config.ts`: ESLint rules (TypeScript, imports)
- `server/src/config/env.ts`: Runtime env var validation (Zod)
- `.env`: Environment variables (DATABASE_URL, PORT, API keys, secrets)
- `.env.example`: Template for required env vars

**Core Logic:**
- `client/src/crypto/encrypt.ts`: AES-256-GCM encryption with fresh key + IV
- `client/src/crypto/decrypt.ts`: AES-256-GCM decryption with padding removal
- `server/src/services/secrets.service.ts`: Atomic read-and-destroy transactions
- `server/src/services/password.service.ts`: Argon2id password hashing
- `client/src/router.ts`: SPA routing with History API + dynamic imports
- `server/src/auth.ts`: Better Auth configuration (email/password, OAuth2, sessions)
- `server/src/app.ts`: Express app factory with middleware order (CRITICAL)

**Testing:**
- `client/src/crypto/__tests__/`: Unit tests (encrypt, decrypt, keys, padding, encoding, passphrase, password-generator)
- `server/src/routes/__tests__/`: Integration tests (supertest + real PostgreSQL)
- `server/src/workers/__tests__/`: Worker tests
- `client/src/components/__tests__/`: Component tests
- `server/src/tests/`: Other server-level tests (auth)
- `e2e/specs/`: End-to-end Playwright tests

## Naming Conventions

**Files:**
- kebab-case: All source files use kebab-case (e.g., `expiration-select.ts`, `copy-button.ts`, `secrets.service.ts`)
- Test files: `*.test.ts` (co-located in `__tests__/` subdirectories)
- Config files: `*.config.ts` (root level)
- YAML specs: `*-TESTS.yaml` or `*-UAT.md` (test files)

**Functions:**
- camelCase: `createSecret()`, `renderCreatePage()`, `validateBody()`
- Factory functions: Prefix with `create` or `build` (e.g., `createSecretsRouter()`, `buildApp()`)
- Page renderers: Prefix with `render` (e.g., `renderCreatePage()`, `renderRevealPage()`)
- Component factories: Prefix with `create` (e.g., `createIcon()`, `createExpirationSelect()`)
- Service functions: Verb-first (e.g., `getUserSecrets()`, `deleteUserSecret()`, `cleanExpiredSecrets()`)

**Variables:**
- camelCase: `ciphertext`, `secretId`, `redisClient`, `passwordHash`
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_LENGTH`, `ALGORITHM`, `IV_LENGTH`, `DURATION_MS`, `SECRET_NOT_AVAILABLE`)

**Types:**
- PascalCase: `EncryptResult`, `Secret`, `CreateSecretResponse`, `ApiError`
- Interfaces: PascalCase (e.g., `PageMeta`, `EncryptedPayload`, `AuthUser`)
- Zod schemas: PascalCase with `Schema` suffix (e.g., `CreateSecretSchema`, `SecretIdParamSchema`)
- Enums: PascalCase (e.g., `subscriptionTierEnum: ['free', 'pro']`)

**CSS Classes:**
- Tailwind utility classes only (no custom CSS class names defined)
- No BEM convention (Tailwind-first approach)
- OKLCH semantic color system in `@theme` blocks

## Where to Add New Code

**New Feature (full-stack):**
- Client page: `client/src/pages/feature-name.ts`
- Client API function: `client/src/api/client.ts` (add to existing file)
- Server route: `server/src/routes/feature-name.ts` or extend existing route file
- Server service: `server/src/services/feature-name.service.ts`
- Shared types: `shared/types/api.ts` (add Zod schema + interfaces)
- Database schema: `server/src/db/schema.ts` (add table or columns)
- Tests:
  - Client: `client/src/pages/__tests__/feature-name.test.ts`
  - Server: `server/src/routes/__tests__/feature-name.test.ts`
  - E2E: `e2e/specs/feature-name.spec.ts`
- Router: Update `client/src/router.ts` to add route pattern

**New Component/Module:**
- Implementation: `client/src/components/component-name.ts`
- Tests: `client/src/components/__tests__/component-name.test.ts`
- Pattern: Export factory function `createComponentName()` returning HTMLElement

**New Middleware:**
- Implementation: `server/src/middleware/middleware-name.ts`
- Tests: Co-locate in `server/src/middleware/__tests__/` or test via integration tests
- Mounting: Add to middleware pipeline in `server/src/app.ts` (order matters!)

**New Background Worker:**
- Implementation: `server/src/workers/worker-name.ts`
- Tests: `server/src/workers/__tests__/worker-name.test.ts`
- Lifecycle: Start in `server/src/server.ts`, stop in graceful shutdown handler

**New API Endpoint:**
- Route handler: `server/src/routes/feature-name.ts` or extend existing router
- Service function: `server/src/services/feature-name.service.ts`
- Types: Add Zod schema + interface to `shared/types/api.ts`
- Client wrapper: Add function to `client/src/api/client.ts`

**Database Changes:**
- Schema: Edit `server/src/db/schema.ts`
- Migration: Run `npm run db:generate` (generates migration in `drizzle/`)
- Apply: Run `npm run db:migrate` to apply to database

**Utilities:**
- Shared helpers: `shared/utils/` (create if needed)
- Client-only helpers: `client/src/utils/` (create if needed)
- Server-only helpers: `server/src/utils/` (create if needed)

## Special Directories

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)

**client/dist/:**
- Purpose: Vite build output (production assets)
- Generated: Yes (via `npm run build:client`)
- Committed: No (in .gitignore)

**drizzle/:**
- Purpose: Generated SQL migrations from schema changes
- Generated: Yes (via `npm run db:generate`)
- Committed: Yes (migrations are source code)

**.planning/:**
- Purpose: GSD workflow documentation and codebase analysis
- Generated: Partially (created by `/gsd:*` commands)
- Committed: Yes (workflow state is tracked)

**.claude/ and .playwright-mcp/:**
- Purpose: Claude Code internal state and MCP server data
- Generated: Yes (by tools)
- Committed: No (in .gitignore)

**.git/:**
- Purpose: Git repository metadata
- Generated: Yes (by git)
- Committed: No (git internal directory)

## Import Patterns

**Client imports:**
- Local modules: Relative paths with `.js` extension (e.g., `from './crypto/index.js'`)
- Shared types: `from '../../../shared/types/api.js'` (relative path from client to shared)
- External: `from 'lucide'` (npm package with Vite alias to fix broken module field)
- CSS: `import './styles.css'` (processed by Vite)

**Server imports:**
- Local modules: Relative paths with `.js` extension (e.g., `from './db/connection.js'`)
- Shared types: `from '../../../shared/types/api.js'` (relative path from server to shared)
- External: Standard npm imports (e.g., `import express from 'express'`)
- Node builtins: `node:` prefix (e.g., `from 'node:fs'`, `from 'node:path'`)

**ESM quirks:**
- `.js` extension required: Even though files are `.ts`, imports use `.js` (TypeScript + Node ESM requirement)
- `import.meta.dirname`: Used instead of `__dirname` (ESM alternative)
- Default imports: `express` is default import, `pinoHttp` is named export (CJS interop)
- Pool import: `pg` destructured from default import (CJS interop)
- Zod: `ZodType` used for generic schemas (zod 4 removed `ZodSchema`)

**Path aliases:**
- None defined: All imports use relative paths (no `@/` or `~/` aliases in tsconfig)
- Vite alias: Only `lucide` aliased to fix broken npm package entry point

## File Organization

**Co-located tests:**
- Pattern: Tests live in `__tests__/` subdirectories alongside source code
- Example: `client/src/crypto/__tests__/encrypt.test.ts` tests `client/src/crypto/encrypt.ts`
- Naming: `filename.test.ts` for unit tests

**Barrel files:**
- Usage: `client/src/crypto/index.ts` exports public API only (encrypt, decrypt, keys, constants, types)
- Limited use: Other directories do not use barrel files (explicit imports preferred)

**Single-responsibility files:**
- Pattern: One primary export per file (e.g., `encrypt.ts` exports `encrypt()` function)
- Exceptions: `api.ts` exports multiple schemas/types (API contract), `icons.ts` exports `createIcon()` + icon map

**Module boundaries:**
- Client never imports from server (enforced by Vite build separation)
- Server never imports from client (enforced by TypeScript config)
- Both import from shared (common types + schemas)

## Multi-Project Test Config

**client tests (vitest):**
- Environment: happy-dom
- Include: `client/src/**/*.test.ts`
- Runs: Parallel (fileParallelism: true)

**server tests (vitest):**
- Environment: node
- Include: `server/src/**/*.test.ts`
- fileParallelism: false (sequential to avoid database lock conflicts)
- setupFiles: dotenv/config (loads .env for DATABASE_URL, etc.)

**e2e tests (playwright):**
- Environment: Chromium/Firefox/WebKit browsers
- Include: `e2e/specs/**/*.spec.ts`
- Config: `e2e/playwright.config.ts`

## Service Integration Points

**Stripe (Phase 34+):**
- Location: `server/src/config/stripe.ts` (client initialization)
- Routes: `server/src/routes/billing.ts` (checkout, verify-checkout, portal)
- Webhooks: `server/src/routes/webhooks.ts` (subscription updates)
- Services: `server/src/services/billing.service.ts` (customer management)

**Resend (Phase 26+):**
- Location: `server/src/services/notification.service.ts` (secret viewed emails)
- Better Auth integration: Email verification, password reset (configured in `server/src/auth.ts`)

**Loops (Phase 37+):**
- Location: `server/src/config/loops.ts` (client initialization)
- Integration: Onboarding sequences for users with marketingConsent=true
- Database hook: Triggered on user creation via Better Auth

**PostHog (Phase 25+):**
- Location: `client/src/analytics/posthog.ts` (client initialization)
- Usage: Event tracking (captured via `capturePageview()` in router, custom events in pages)
- Property sanitization: URL fragments stripped before events fire (zero-knowledge invariant)

**Better Auth (Phase 22+):**
- Location: `server/src/auth.ts` (configuration)
- Handler: Mounted at `/api/auth/{*splat}` in `server/src/app.ts`
- Database: Uses PostgreSQL tables (users, sessions, accounts, verification)

---

*Structure analysis: 2026-02-28*
