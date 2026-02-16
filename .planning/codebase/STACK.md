# Technology Stack

**Analysis Date:** 2026-02-16

## Languages

**Primary:**
- TypeScript 5.9 - All source code (client, server, shared)
- Compiler target: ES2022, module: ESNext, strict mode enabled

**Secondary:**
- CSS - Tailwind CSS 4.x with custom OKLCH-based design tokens
- SQL - PostgreSQL migrations generated via Drizzle Kit

## Runtime

**Environment:**
- Node.js 22.18.0 (detected)
- Target: Node.js 24.x LTS (per CLAUDE.md)

**Package Manager:**
- npm 10.9.3
- Lockfile: `package-lock.json` (lockfileVersion 3) present

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server with typed routes
- Vite 7.3.1 - Frontend build tool with dev server
- Drizzle ORM 0.45.1 - Type-safe PostgreSQL client
- Tailwind CSS 4.1.18 - Utility-first CSS with Vite plugin

**Testing:**
- Vitest 4.0.18 - Test runner with dual-project setup (client: happy-dom, server: node)
- Supertest 7.2.2 - HTTP integration testing
- happy-dom 20.6.1 - Lightweight DOM environment for client tests
- vitest-axe 0.1.0 - Accessibility testing utilities

**Build/Dev:**
- tsx 4.21.0 - TypeScript execution for dev server watch mode
- drizzle-kit 0.31.9 - Database migration generation and application
- @tailwindcss/vite 4.1.18 - Vite integration for Tailwind CSS 4.x

## Key Dependencies

**Critical:**
- pg 8.18.0 - PostgreSQL client (connection pooling)
- nanoid 5.1.6 - Cryptographically secure URL-safe ID generation (21-char secrets)
- argon2 0.44.0 - OWASP-compliant password hashing (Argon2id, mem=19MiB, time=2)
- zod 4.3.6 - Runtime schema validation for API contracts and env vars
- Web Crypto API - Browser-native AES-256-GCM encryption (no external crypto dependencies)

**Infrastructure:**
- helmet 8.1.0 - Security headers (CSP with nonce, HSTS, Referrer-Policy)
- express-rate-limit 8.2.1 - Request rate limiting middleware
- ioredis 5.9.3 - Redis client for distributed rate limiting (optional)
- rate-limit-redis 4.3.1 - Redis store adapter for express-rate-limit
- node-cron 4.2.1 - Scheduled task runner for expiration cleanup worker
- pino 10.3.1 - Structured JSON logger
- pino-http 11.0.0 - Express request logging middleware
- pino-pretty 13.1.3 (dev) - Pretty-print logs in development
- dotenv 17.3.1 - Environment variable loading

**Frontend:**
- lucide 0.564.0 - Icon library (SVG sprites)
- @fontsource-variable/jetbrains-mono 5.2.8 - Variable font for monospace UI elements

## Configuration

**Environment:**
- Env vars loaded via `dotenv/config` at runtime and build time
- Zod schema validation in `server/src/config/env.ts`
- Required vars: `DATABASE_URL`, `PORT`, `LOG_LEVEL`, `NODE_ENV`
- Optional vars: `REDIS_URL` (enables distributed rate limiting)
- Env files: `.env` (local, gitignored), `.env.example` (committed template)

**Build:**
- `tsconfig.json` - Shared TypeScript config (bundler resolution, ES2022 target, strict mode)
- `vite.config.ts` - Vite config with Tailwind plugin, API proxy, CSP nonce placeholder
- `vitest.config.ts` - Dual-project test config (client + server), dotenv setup file
- `drizzle.config.ts` - Database migration config (PostgreSQL dialect, schema path)

**TypeScript:**
- Module type: ESM (`"type": "module"` in package.json)
- Module resolution: bundler (NodeNext for backend, bundler for frontend)
- Output: `dist/` directory (not committed)
- Declaration maps and source maps enabled

## Platform Requirements

**Development:**
- Node.js 24.x LTS (or 22.x compatible)
- PostgreSQL 17+ database server
- Redis (optional, for multi-instance rate limiting)

**Production:**
- Deployment target: Platform with Node.js 24.x LTS support
- PostgreSQL 17+ (connection string via `DATABASE_URL`)
- HTTPS required (HSTS enforced in production, redirects HTTP→HTTPS)
- Reverse proxy with `X-Forwarded-Proto` header support (Express trust proxy enabled)

---

*Stack analysis: 2026-02-16*
