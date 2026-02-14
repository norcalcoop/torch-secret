# Stack Research

**Domain:** Zero-knowledge, client-side encrypted, one-time secret sharing web application
**Researched:** 2026-02-13
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.x LTS ("Krypton") | Server runtime | Current LTS with support through April 2028. Native Web Crypto API support means encryption code can be shared/tested between client and server if needed. |
| Express.js | 5.x (5.2.x) | HTTP framework | v5 is now the stable `latest` on npm (since March 2025). Largest middleware ecosystem, well-understood security model, and `express-rate-limit` integrates directly. The app is a simple REST API with 3-4 endpoints -- Express's simplicity is a strength here, not a limitation. |
| TypeScript | 5.9.x | Type safety | Catches encryption parameter bugs at compile time (IV lengths, key sizes, buffer types). Drizzle ORM leverages TypeScript inference heavily. v5.9 is the current stable release. |
| PostgreSQL | 17.x or 18.x | Secret persistence | Battle-tested, ACID-compliant, excellent `TIMESTAMP WITH TIME ZONE` support for expiration logic. `DELETE` with `RETURNING` makes atomic view-and-destroy operations clean. Available on every cloud platform. |
| Redis | 7.x | Rate limiting + session state | In-memory store for rate-limit counters that survive process restarts and work across multiple server instances. Fast enough to not add latency to the critical path. |
| Vite | 7.x | Frontend build tool | Sub-second HMR, native ES modules, zero-config for vanilla JS/TS projects. Produces optimized bundles with tree-shaking. Works perfectly for building a small vanilla JS frontend without requiring a framework. |
| Tailwind CSS | 4.x | Styling | v4 released January 2025 with CSS-first configuration (no `tailwind.config.js` needed), 5x faster full builds, automatic content detection, and built-in container queries. Produces tiny CSS bundles with purging. Ideal for building an accessible, responsive UI quickly. |
| Web Crypto API | Built-in | Client-side AES-256-GCM encryption | Browser-native, no dependencies, hardware-accelerated. Baseline widely available since July 2015. Uses `crypto.subtle.encrypt` with AES-GCM and `crypto.getRandomValues` for IV generation. Zero bundle size impact. |

### Database & ORM

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Drizzle ORM | 0.45.x (approaching v1 beta) | PostgreSQL query builder + schema | SQL-centric approach means you see exactly what queries hit the database -- critical for a security-focused app where you need to audit data access. ~7.4kb minified+gzipped, zero dependencies, no code generation step. TypeScript inference gives full type safety from schema to query results. |
| drizzle-kit | latest | Schema migrations | Generates SQL migration files from schema changes. No magic -- you can review every migration before applying. |
| pg (node-postgres) | 8.x | PostgreSQL driver | The standard, battle-tested PostgreSQL driver for Node.js. Drizzle uses it under the hood. Connection pooling built in. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| helmet | 8.x | Security headers | Always. Sets CSP, HSTS, X-Frame-Options, and 10 other security headers with a single `app.use(helmet())`. Zero dependencies. |
| express-rate-limit | 7.x | Rate limiting middleware | Always. 10M+ weekly downloads. Pluggable stores. |
| rate-limit-redis | latest | Redis store for rate limiter | Always (production). Makes rate limits work across server restarts and multiple instances. |
| ioredis | 5.x | Redis client | Always. Better performance than `redis` (node-redis), built-in reconnection, pipelining support. Note: officially deprecated in favor of node-redis, but still widely used and more performant. For this project's simple rate-limiting use case, either works. Use ioredis for its auto-reconnect. |
| nanoid | 5.x | Secret ID generation | Always. 118 bytes, URL-safe by default, cryptographically secure (uses `crypto.getRandomValues`), 60% faster than UUID. Produces 21-character IDs with ~126 bits of entropy -- sufficient collision resistance. |
| argon2 | 0.41.x | Password hashing (optional password protection) | When implementing FR-4 (password-protected secrets). Winner of the Password Hashing Competition. Superior GPU/ASIC resistance over bcrypt. Use Argon2id variant. |
| zod | 4.x | Input validation | Always. Validate secret creation requests (text length, expiration values, password format). 2kb core bundle. TypeScript-first with inferred types. Validates at runtime what TypeScript checks at compile time. |
| pino | 10.x | Structured logging | Always. 5x faster than alternatives. JSON output for production log aggregation. Use with `pino-http` for Express request logging. Critical: configure to NEVER log request/response bodies (secrets). |
| pino-http | latest | Express request logging | Always. Automatic request/response logging middleware for Express. |
| cors | 2.x | CORS middleware | Always. Configure strict same-origin policy per PRD requirement. |
| node-cron | 3.x | Scheduled secret cleanup | Always. Runs the every-5-minute expired secret cleanup job. Lightweight, no Redis dependency (unlike Bull). For a single cron job, Bull/BullMQ is overkill. |
| dotenv | 16.x | Environment configuration | Development only. Load `.env` files. In production, use real environment variables from the platform. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| vitest | Unit/integration testing | Vite-native test runner. Faster than Jest, shares Vite config. |
| supertest | HTTP endpoint testing | Test Express routes without starting the server. |
| pino-pretty | Dev log formatting | Human-readable colored logs in development. Never in production. |
| eslint + @typescript-eslint | Linting | Catch security anti-patterns (eval, innerHTML). TypeScript-aware rules. |
| prettier | Code formatting | Consistent style, no debates. |
| tsx | TypeScript execution | Run TS files directly without compilation step during development. |

## Vanilla JS Frontend -- NOT React

This project should use **vanilla JavaScript (TypeScript) with Vite**, not React. Here is why:

1. **3-4 pages total**: Create secret, view confirmation, view secret, error states. This is not a complex interactive application.
2. **Performance requirement**: PRD specifies < 1 second load on 3G. React's ~140kb gzipped bundle is a significant portion of that budget. Vanilla JS is ~0kb framework overhead.
3. **Progressive enhancement**: PRD requires "works without JavaScript for basic functionality." Server-rendered HTML with vanilla JS enhancement achieves this naturally. React's hydration model fights against it.
4. **Security surface**: Fewer dependencies = fewer supply chain attack vectors. For a security-focused app, minimizing the dependency tree is a feature.
5. **Simplicity**: The encryption/decryption logic is the complex part, not the UI. Web Crypto API calls work identically in vanilla JS. No need for React's state management for what amounts to form submission and text display.

**The frontend is**: HTML templates, Tailwind CSS for styling, vanilla TypeScript modules for encryption logic and DOM interaction, bundled by Vite.

## Installation

```bash
# Core backend dependencies
npm install express@5 pg drizzle-orm helmet express-rate-limit rate-limit-redis ioredis nanoid argon2 zod pino pino-http cors node-cron dotenv

# Dev dependencies
npm install -D typescript@5.9 @types/express @types/node @types/cors @types/pg drizzle-kit vite tailwindcss vitest supertest @types/supertest pino-pretty tsx eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5 | Fastify | If you need maximum throughput (48k req/s vs ~15k for Express). For this app with ~10 req/s peak, Express's ecosystem advantage wins. |
| Express 5 | Hono | If deploying to edge/serverless (Cloudflare Workers, Deno). Hono is Web Standards native. For a traditional Node.js server, Express has better middleware ecosystem. |
| Drizzle ORM | Prisma | If team is less SQL-experienced and wants schema-first DX. Prisma's code generation adds a build step and its Rust query engine adds cold start latency. For a security app where you want to see exact SQL, Drizzle is better. |
| Drizzle ORM | Raw `pg` driver | If you want zero abstraction. For 3-4 queries total, raw SQL is viable. But Drizzle adds type safety and migrations with ~7kb cost -- worth it. |
| Vanilla JS | React | If the UI grows to 10+ interactive pages with shared state. Unlikely for a single-purpose secret sharing tool. |
| Vanilla JS | Svelte | If you want reactivity with near-zero runtime. Reasonable choice, but adds build complexity for minimal UI benefit. |
| ioredis | node-redis (redis) | If you want the officially recommended Redis client. node-redis is now Redis's recommended library, though ioredis has better DX for simple use cases. |
| Argon2 | bcrypt | If you cannot compile native modules (Argon2 requires native compilation). bcrypt with cost factor 12+ is still secure. |
| node-cron | BullMQ | If you need job persistence, retries, and concurrency control. For a single 5-minute cleanup cron, BullMQ's Redis dependency and complexity is unjustified. |
| Tailwind CSS 4 | Plain CSS | If you have a designer providing exact CSS. Tailwind accelerates building responsive, accessible UIs without design system overhead. |
| nanoid | crypto.randomUUID() | If you need standard UUID format. Built-in `crypto.randomUUID()` is zero-dependency but produces 36-character UUIDs vs nanoid's 21-character URL-safe IDs. For URLs, shorter is better. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| React / Next.js | Massive overkill for 3-4 static pages. Adds 140kb+ to bundle, SSR complexity, and hydration issues for progressive enhancement. | Vanilla TypeScript + Vite |
| Prisma ORM | Code generation step, Rust binary engine (~15mb), slower cold starts, hides SQL behind abstraction. For a security-focused app, you need to see your queries. | Drizzle ORM |
| MongoDB | No ACID transactions for atomic view-and-delete. Schema-less design is wrong for structured secret metadata. No native `TIMESTAMP` expiration queries. | PostgreSQL |
| jsonwebtoken / JWT | No user authentication needed. JWTs add complexity and security surface for zero benefit. | Nothing -- no auth needed |
| bcryptjs (pure JS bcrypt) | ~100x slower than native bcrypt, and both are inferior to Argon2 for new projects. | argon2 (native) |
| moment.js / dayjs | Deprecated (moment) or unnecessary. Native `Date` and PostgreSQL `TIMESTAMP` handle all expiration logic. | Built-in `Date` API |
| Winston logger | 5x slower than Pino. More configuration needed for same output. | Pino |
| Socket.io / WebSockets | No real-time features needed. Secret creation and viewing are simple request/response. | Standard HTTP REST |
| Express 4 | Entered maintenance mode April 2025, EOL no later than October 2026. v5 is stable and the npm default. | Express 5 |
| CryptoJS / sjcl | Third-party encryption libraries add supply chain risk and are slower than native Web Crypto API. Browser-native crypto is hardware-accelerated and audited. | Web Crypto API (built-in) |
| uuid package | 36-character IDs are unnecessarily long for URLs. 423 bytes vs nanoid's 130 bytes. Slower generation. | nanoid |
| Sequelize / TypeORM | Heavier, older ORMs with more abstraction. TypeORM has type safety issues. Sequelize uses query chaining that obscures SQL. | Drizzle ORM |

## Stack Patterns by Variant

**If deploying to a single VPS (Railway, Render, DigitalOcean):**
- Use PostgreSQL and Redis as managed add-ons from the platform
- Single process runs both API server and cron job
- `node-cron` handles scheduled cleanup in-process
- Because: Simplest deployment, lowest cost, sufficient for MVP traffic

**If deploying to serverless (Vercel, AWS Lambda):**
- Replace Express with Hono (Web Standards native)
- Replace `node-cron` with platform-native cron (Vercel Cron, CloudWatch Events)
- Replace `ioredis` with Upstash Redis (HTTP-based, serverless-friendly)
- Replace Drizzle + `pg` with Drizzle + Neon serverless driver
- Because: Serverless cannot run persistent processes or maintain connections

**If scaling beyond single server:**
- Replace in-memory rate limiting with Redis-backed rate limiting (already in recommended stack)
- Add connection pooling (PgBouncer or Drizzle's built-in pool)
- Consider read replicas for the (unlikely) case of high read volume
- Because: Multiple instances need shared state

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Express 5.x | Node.js 18+ | Dropped legacy Node.js support checks |
| Drizzle ORM 0.45.x | pg 8.x | Uses pg as the PostgreSQL driver |
| Tailwind CSS 4.x | Vite 7.x | Native Vite integration, no PostCSS plugin needed |
| TypeScript 5.9.x | Node.js 24.x LTS | Full compatibility |
| express-rate-limit 7.x | Express 5.x | Confirmed compatible |
| rate-limit-redis | ioredis 5.x, node-redis 4.x | Supports both Redis clients |
| helmet 8.x | Express 5.x | Express 5 compatible |
| zod 4.x | TypeScript 5.x | Leverages TS inference features |
| argon2 0.41.x | Node.js 18+ | Requires native compilation (node-gyp) |

## Sources

- [Express v5.1.0 announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) -- v5 is now `latest` on npm, MEDIUM confidence
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) -- Baseline widely available since July 2015, HIGH confidence
- [MDN AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- AES-GCM specification details, HIGH confidence
- [Tailwind CSS v4.0 announcement](https://tailwindcss.com/blog/tailwindcss-v4) -- Released January 22, 2025, HIGH confidence
- [Drizzle ORM docs](https://orm.drizzle.team/) -- v0.45.x current, v1 beta in progress, MEDIUM confidence
- [nanoid GitHub](https://github.com/ai/nanoid) -- 118 bytes, crypto-secure, HIGH confidence
- [Yopass (comparable project)](https://github.com/jhaals/yopass) -- Go + React stack, OpenPGP encryption, validates the overall architecture pattern, MEDIUM confidence
- [Luzifer/ots](https://github.com/Luzifer/ots) -- Another one-time-secret sharing platform using 256bit AES in browser, validates approach, MEDIUM confidence
- [Node.js endoflife.date](https://endoflife.date/nodejs) -- v24 LTS support through April 2028, HIGH confidence
- [PostgreSQL endoflife.date](https://endoflife.date/postgresql) -- v17/v18 current stable, HIGH confidence
- [Helmet.js](https://helmetjs.github.io/) -- v8.x, zero dependencies, HIGH confidence
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- 10M+ weekly downloads, HIGH confidence
- [rate-limit-redis GitHub](https://github.com/express-rate-limit/rate-limit-redis) -- Official Redis store for express-rate-limit, HIGH confidence
- [Password hashing guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) -- Argon2id recommended for new projects, MEDIUM confidence
- [Pino npm](https://www.npmjs.com/package/pino) -- v10.x, 5x faster than alternatives, HIGH confidence
- [Zod docs](https://zod.dev/) -- v4.x stable, 2kb core, HIGH confidence
- [Vite releases](https://vite.dev/releases) -- v7.x current stable, HIGH confidence

---
*Stack research for: SecureShare -- zero-knowledge one-time secret sharing*
*Researched: 2026-02-13*
