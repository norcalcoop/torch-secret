# Technology Stack

**Analysis Date:** 2026-02-14

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (client, server, shared types)
- JavaScript ES2022 - Compilation target, ESNext module system

**Secondary:**
- SQL - PostgreSQL schema and queries via Drizzle ORM

## Runtime

**Environment:**
- Node.js 22.18.0 (project targets 24.x LTS per CLAUDE.md, current dev uses v22)

**Package Manager:**
- npm (package-lock.json present, version 10.x)
- Lockfile: Present and committed

## Frameworks

**Core:**
- Express 5.2.1 - HTTP server and routing
- Drizzle ORM 0.45.1 - Database query builder and schema management
- Vite 7.x - Frontend build tool (planned, not yet configured)
- Tailwind CSS 4.x - Styling framework (planned, not yet configured)

**Testing:**
- Vitest 4.0.18 - Test runner for both client and server
- Supertest 7.2.2 - HTTP integration testing

**Build/Dev:**
- tsx 4.21.0 - TypeScript execution and watch mode for development
- drizzle-kit 0.31.9 - Database migration generation and execution

## Key Dependencies

**Critical:**
- nanoid 5.1.6 - Cryptographically secure 21-char URL-safe ID generation for secret IDs
- zod 4.3.6 - Runtime schema validation for API requests and environment configuration
- pg 8.18.0 - PostgreSQL client driver (node-postgres)
- dotenv 17.3.1 - Environment variable loading from `.env` files

**Infrastructure:**
- pino 10.3.1 - Structured JSON logging
- pino-http 11.0.0 - HTTP request logging middleware with secret ID redaction
- pino-pretty 13.1.3 - Human-readable log formatting for development

**Planned (from CLAUDE.md, not yet installed):**
- helmet - CSP and security headers (Phase 3)
- express-rate-limit - Rate limiting middleware (Phase 3)
- ioredis or redis 7.x - Redis client for rate limiting (Phase 3)
- argon2 - Password hashing (Phase 5)
- node-cron - Background expiration worker (Phase 6)

## Configuration

**Environment:**
- Configuration via `.env` file (example: `.env.example`)
- Required variables validated with Zod schema in `server/src/config/env.ts`:
  - `DATABASE_URL` - PostgreSQL connection string (must start with "postgres")
  - `PORT` - HTTP server port (default: 3000)
  - `LOG_LEVEL` - Pino log level (default: "info")
  - `NODE_ENV` - Environment mode (development/production/test, default: "development")

**Build:**
- `tsconfig.json` - TypeScript compiler configuration (ES2022 target, ESNext modules, strict mode)
- `vitest.config.ts` - Test runner configuration (Node environment, 10s timeout, dotenv setup)
- `drizzle.config.ts` - Database migration configuration (PostgreSQL dialect, schema location)

## Platform Requirements

**Development:**
- Node.js 24.x LTS (recommended, 22.x compatible)
- PostgreSQL 17+ database
- Redis 7.x (planned for Phase 3 rate limiting)

**Production:**
- Deployment target: Not yet configured
- HTTPS required (enforced in Phase 3)

## Crypto Dependencies

**Browser-Native Only:**
- Web Crypto API (`crypto.subtle`) - AES-256-GCM encryption/decryption
- `crypto.getRandomValues()` - Cryptographically secure random number generation
- No third-party crypto libraries used (security invariant)

---

*Stack analysis: 2026-02-14*
