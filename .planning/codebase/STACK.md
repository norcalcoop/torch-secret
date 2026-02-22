# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript 5.9 - All source code (client, server, shared)

**Secondary:**
- JavaScript - Configuration files (ESLint, Drizzle, Vite, Vitest)

## Runtime

**Environment:**
- Node.js 22.x LTS (no `.nvmrc` file; version determined by user/system)

**Package Manager:**
- npm (v10 or later, default with Node 22.x)
- Lockfile: Present (`package-lock.json` expected)

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server and REST API
- Vite 7.3.1 - Frontend development and production build
- Tailwind CSS 4.1.18 - Styling with `@tailwindcss/vite` plugin for JIT compilation

**Testing:**
- Vitest 4.0.18 - Multi-project test runner (client in happy-dom, server in node)
- Playwright 1.58.2 - E2E testing (3 browser families: chromium, firefox, webkit)
- Supertest 7.2.2 - HTTP assertion library for API testing
- vitest-axe 0.1.0 - Accessibility testing

**Build/Dev:**
- tsx 4.21.0 - TypeScript execution and watch mode for server development
- drizzle-kit 0.31.9 - Database migration generation and execution
- ESLint 10.0.0 - Linting with flat config (typescript-eslint)
- Prettier 3.8.1 - Code formatting with prettier-plugin-tailwindcss
- Husky 9.1.7 - Git hooks
- lint-staged 16.2.7 - Pre-commit linting

## Key Dependencies

**Critical:**
- drizzle-orm 0.45.1 - TypeScript ORM for PostgreSQL with schema-first design
- pg 8.18.0 - PostgreSQL driver (connected via pg.Pool)
- better-auth 1.4.18 - Authentication framework with built-in email/OAuth providers
- argon2 0.44.0 - Password hashing using Argon2id (OWASP-recommended parameters)
- Web Crypto API (native) - AES-256-GCM encryption for secrets (no third-party crypto)

**Infrastructure:**
- ioredis 5.9.3 - Redis client for distributed rate limiting (optional, multi-instance deployments)
- express-rate-limit 8.2.1 - Rate limiting middleware
- rate-limit-redis 4.3.1 - Redis store for rate limiting
- node-cron 4.2.1 - Scheduled task runner for expired secret cleanup
- helmet 8.1.0 - HTTP security headers (CSP nonce per request)
- resend 6.9.2 - Email delivery service (OAuth verification, password reset)

**UI/UX:**
- lucide 0.564.0 - Icon library (ESM workaround in Vite config for broken module field)
- @fontsource-variable/jetbrains-mono 5.2.8 - JetBrains Mono variable font

**Utilities:**
- nanoid 5.1.6 - URL-safe secret ID generation (21 characters, cryptographically secure)
- zod 4.3.6 - TypeScript-first schema validation (env vars, API contracts, shared types)
- dotenv 17.3.1 - Environment variable loading from `.env` files
- pino 10.3.1 - Structured JSON logging
- pino-http 11.0.0 - HTTP request logging middleware (with secret ID redaction)
- pino-pretty 13.1.3 - Human-readable log formatting (dev mode)

## Configuration

**Environment:**

Environment variables are validated at startup via Zod schema in `server/src/config/env.ts`. Required vars:
- `DATABASE_URL`: PostgreSQL connection string (must start with `postgres://`)
- `PORT`: HTTP server port (default: 3000)
- `LOG_LEVEL`: Pino log level (default: info)
- `NODE_ENV`: development | production | test (default: development)
- `BETTER_AUTH_SECRET`: 32+ character hex string for auth encryption
- `BETTER_AUTH_URL`: Base URL for auth redirects (e.g., `http://localhost:3000`)
- `RESEND_API_KEY`: Resend API key for email delivery
- `RESEND_FROM_EMAIL`: "From" address for emails (e.g., `SecureShare <noreply@yourdomain.com>`)

Optional vars:
- `REDIS_URL`: Redis connection URL for distributed rate limiting (if omitted, in-memory store used)
- `FORCE_HTTPS`: Set to `true` behind TLS-terminating reverse proxy (default: false)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth (optional if disabled)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth (optional if disabled)

See `.env.example` for template.

**Build:**

Configuration files:
- `tsconfig.json` - Root TypeScript config (target: ES2022, moduleResolution: bundler, strict mode)
- `server/tsconfig.json` - Server overrides (module: NodeNext, lib: ES2022 only, no DOM)
- `vite.config.ts` - Vite plugins, Tailwind CSS 4, client root, Lucide ESM alias, CSP nonce placeholder
- `vitest.config.ts` - Multi-project (client: happy-dom, server: node with sequential fileParallelism)
- `drizzle.config.ts` - PostgreSQL dialect, schema path, migration output
- `eslint.config.ts` - Flat config with typescript-eslint, recommended rules, Prettier integration
- `.prettierrc.json` - Single quotes, trailing commas, print width 100, Tailwind CSS class sorting

## Platform Requirements

**Development:**
- PostgreSQL 17+ (at `DATABASE_URL`, no Docker Compose; start manually or via Docker)
- Node.js 22.x LTS
- Optional: Redis for distributed rate limiting (if `REDIS_URL` not set, in-memory store used)

**Production:**
- PostgreSQL 17+ database
- Node.js 22.x runtime
- Reverse proxy with TLS termination (set `FORCE_HTTPS=true`)
- Optional: Redis for multi-instance deployments
- Email delivery: Resend API key required
- Optional: Google and/or GitHub OAuth credentials

---

*Stack analysis: 2026-02-20*
