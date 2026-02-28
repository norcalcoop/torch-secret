# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Torch Secret is a zero-knowledge, one-time secret sharing web app. Users paste sensitive text, get an encrypted link, share it, and the secret self-destructs after one view. No accounts, no signup. The encryption key lives exclusively in the URL fragment (`#key`) and never reaches the server.

## Tech Stack

- **Runtime:** Node.js 24.x LTS, TypeScript 5.9.x (ESM, `"type": "module"`)
- **Backend:** Express 5.x, Drizzle ORM with PostgreSQL 17+, Pino logging
- **Frontend:** Vanilla TypeScript (NOT React), Vite 7.x, Tailwind CSS 4.x (`@tailwindcss/vite` plugin), Lucide icons, JetBrains Mono font
- **Auth:** Better Auth 1.x (email/password, Google + GitHub OAuth, email verification, session management)
- **Encryption:** Web Crypto API (AES-256-GCM), no third-party crypto libraries
- **Security:** Helmet (CSP with per-request nonce), express-rate-limit (Redis-backed or in-memory), Argon2id password hashing, HTTPS redirect
- **Background jobs:** node-cron (expired secret cleanup worker)
- **Payments:** Stripe (subscription billing, webhooks, customer portal)
- **Analytics:** PostHog (event capture with ZK-safe URL sanitization)
- **Email:** Loops (onboarding sequences), Resend (transactional + marketing list + Audiences)
- **Secrets management:** Infisical (per-environment secrets injection via CLI; replaces .env files)
- **Testing:** Vitest 4.x (multi-project: client=happy-dom, server=node), Supertest, vitest-axe, Playwright (E2E + axe-core)
- **Validation:** Zod 4.x for env vars, API request schemas, and shared type contracts
- **Code quality:** ESLint 10.x (typescript-eslint), Prettier 3.x (prettier-plugin-tailwindcss), Husky + lint-staged
- **Containers:** Docker + Docker Compose for local development and production

## Project Structure

```
secureshare/
├── client/
│   ├── index.html              # HTML shell with SEO meta, JSON-LD, FOWT prevention
│   └── src/
│       ├── app.ts              # Application entry point
│       ├── router.ts           # SPA router (History API, dynamic imports, SEO meta management)
│       ├── theme.ts            # Light/dark/system theme with localStorage persistence
│       ├── styles.css          # Tailwind CSS 4 with @theme tokens (OKLCH color system)
│       ├── api/client.ts       # Typed fetch wrapper for API calls
│       ├── analytics/          # PostHog client (sanitizeEventUrls, identifyUser, captureSecretCreated, etc.)
│       ├── crypto/             # AES-256-GCM encrypt/decrypt (self-contained module)
│       ├── components/         # UI components (layout, copy-button, share-button, toast, terminal-block, theme-toggle, icons, loading-spinner, expiration-select)
│       └── pages/              # home, create, confirmation, reveal, error, dashboard, login, register, forgot-password, reset-password, pricing, privacy, terms, confirm, unsubscribe
├── server/src/
│   ├── app.ts                  # Express app factory (middleware order is critical — see comments)
│   ├── server.ts               # HTTP server startup, graceful shutdown
│   ├── config/
│   │   ├── env.ts              # Zod-validated env vars
│   │   ├── stripe.ts           # Stripe SDK singleton (never new Stripe() in service files)
│   │   └── loops.ts            # Loops email SDK singleton
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema: secrets + Better Auth tables (users, sessions, accounts, verifications)
│   │   ├── connection.ts       # PostgreSQL pool + Drizzle instance
│   │   └── migrate.ts          # Migration runner script
│   ├── routes/
│   │   ├── secrets.ts          # Secret CRUD (4 endpoints)
│   │   ├── billing.ts          # Stripe checkout, portal, verify-checkout
│   │   ├── subscribers.ts      # GDPR email list capture + confirm/unsubscribe
│   │   ├── webhooks.ts         # Stripe webhook (raw body; MUST mount before express.json)
│   │   ├── dashboard.ts        # Authenticated user dashboard secrets
│   │   ├── me.ts               # GET /api/me — current authenticated user
│   │   ├── health.ts           # GET /api/health
│   │   └── seo/                # Express SSR routes: /vs/*, /alternatives/*, /use/* (not SPA — bots need SSR)
│   ├── middleware/
│   │   ├── security.ts         # CSP nonce, helmet, HTTPS redirect
│   │   ├── rate-limit.ts       # Redis-backed rate limiters
│   │   ├── validate.ts         # Zod request validation
│   │   ├── logger.ts           # Pino with secret ID redaction
│   │   ├── require-auth.ts     # Better Auth session guard middleware
│   │   └── error-handler.ts    # Global error handler (must be last middleware)
│   ├── services/
│   │   ├── secrets.service.ts  # createSecret, retrieveAndDestroy, verifyAndRetrieve
│   │   ├── billing.service.ts  # Stripe customer management, activatePro, deactivatePro
│   │   ├── email.ts            # Resend transactional email sender + Audiences sync
│   │   ├── notification.service.ts  # Secret-viewed emails (ZK-safe: no secretId in body)
│   │   ├── onboarding.service.ts    # Loops email onboarding (welcome + drip sequence)
│   │   ├── subscribers.service.ts   # GDPR marketing list (no FK to users/secrets)
│   │   └── password.service.ts # Argon2id hashing (OWASP params)
│   └── workers/
│       └── expiration-worker.ts  # Cron job for expired secret cleanup
├── shared/types/api.ts         # Zod schemas + TS interfaces for API contracts
├── .planning/                  # GSD workflow docs (PROJECT.md, ROADMAP.md, STATE.md)
└── drizzle/                    # Generated migrations (drizzle-kit generate)
```

## Architecture: Security Boundaries

Two trust boundaries define the entire security model:

1. **Browser vs. Server:** The server is untrusted storage. It handles encrypted blobs but NEVER touches plaintext or encryption keys. The URL fragment (`#base64key`) is never sent to the server per HTTP spec (RFC 3986).

2. **Server vs. Database:** PostgreSQL stores only encrypted ciphertext, IVs, and metadata. A full DB dump reveals nothing without the keys that live only in shared URLs.

### Critical Invariants

- All encryption/decryption uses `crypto.subtle` and `crypto.getRandomValues` only. No `Math.random`, no third-party crypto libs.
- The crypto module (`client/src/crypto/`) is the only code that imports Web Crypto API.
- Secret retrieval uses an atomic 3-step transaction: SELECT → zero ciphertext → DELETE. Never separate read/delete queries.
- API error responses for not-found/expired/viewed/wrong-password must be identical to prevent enumeration.
- Application logs must never contain secret IDs, ciphertext, IP addresses, or PII. Secret IDs are redacted via regex in the logger middleware.
- Every encryption generates a fresh 256-bit key AND a fresh 96-bit IV. No reuse.

## API Endpoints

| Method | Path                           | Purpose                                                   |
| ------ | ------------------------------ | --------------------------------------------------------- |
| POST   | `/api/secrets`                 | Create secret (receives encrypted blob, never plaintext)  |
| GET    | `/api/secrets/:id`             | Retrieve + atomic delete (no password)                    |
| GET    | `/api/secrets/:id/meta`        | Check if password required (does NOT consume secret)      |
| POST   | `/api/secrets/:id/verify`      | Password verify + retrieve + atomic delete                |
| GET    | `/api/me`                      | Current authenticated user (null if anonymous)            |
| GET    | `/api/health`                  | Health check                                              |
| ANY    | `/api/auth/**`                 | Better Auth handler (login, register, OAuth, sessions)    |
| POST   | `/api/billing/checkout`        | Create Stripe checkout session (requires auth)            |
| GET    | `/api/billing/verify-checkout` | Verify Stripe checkout session post-redirect              |
| POST   | `/api/billing/portal`          | Create Stripe customer portal session                     |
| POST   | `/api/webhooks/stripe`         | Stripe webhook (raw body; MUST mount before express.json) |
| POST   | `/api/subscribers`             | GDPR marketing email capture                              |
| GET    | `/api/subscribers/confirm`     | Email confirmation via token                              |
| GET    | `/api/subscribers/unsubscribe` | One-click unsubscribe via token                           |

## Development Commands

```bash
npm install                        # Install dependencies
npm run dev:server                 # Backend dev server (tsx watch, Infisical injects env vars)
npm run dev:client                 # Frontend dev server (Vite via portless → http://torchsecret.localhost:1355)
npm run staging:up                 # Start staging environment via Docker Compose (Infisical staging env)
npm run build:client               # Production frontend build
npm run preview:client             # Preview production build locally
npm test                           # All tests in watch mode
npm run test:run                   # All tests once
npm run test:e2e                   # Playwright E2E tests (requires running app)
npx vitest run path/to/test.ts     # Single test file
npm run lint                       # ESLint check
npm run lint:fix                   # ESLint auto-fix
npm run format                     # Prettier format all files
npm run format:check               # Prettier format check (CI)
npm run db:generate                # Generate migration from schema changes
npm run db:migrate                 # Apply migrations
```

**Prerequisites:** PostgreSQL 17+ at `DATABASE_URL`. Infisical CLI — run `infisical login` once; env vars inject automatically. Optional `REDIS_URL` for distributed rate limiting. See `.env.example` for required key names.

**Test setup:** Vitest uses multi-project config — client tests run in happy-dom, server tests run in node with `fileParallelism: false` (sequential). `dotenv/config` loads env vars. Integration tests require a running PostgreSQL instance (real DB, not mocks).

## Frontend Architecture

- **SPA router** (`client/src/router.ts`): History API with dynamic imports for code splitting. Each page is a separate chunk. Route changes update SEO meta tags (title, description, canonical, robots, OG/Twitter). Secret/error routes get `noindex`.
- **Theme system** (`client/src/theme.ts`): Three modes (light/dark/system) persisted in localStorage. FOWT prevention script in `<head>` applies theme before first paint.
- **Design tokens:** OKLCH semantic colors in Tailwind CSS 4 `@theme` blocks. Glassmorphism surfaces with backdrop-blur.
- **Accessibility:** Skip link, aria-live route announcer, focus management (h1 focus after navigation), `motion-safe:` animation guards. Tested with vitest-axe.
- **CSP nonce flow:** Vite injects `__CSP_NONCE__` placeholder during build → Express replaces with per-request nonce at serving time.
- **Lucide workaround:** `vite.config.ts` has a resolve alias for lucide's broken ESM entry point.

## Build Phases (GSD Workflow)

The project uses the GSD workflow. State is tracked in `.planning/STATE.md`, roadmap in `.planning/ROADMAP.md`.

- **v1.0 MVP** (8 phases, 22 plans) — SHIPPED: Crypto, DB/API, security hardening, frontend, password protection, expiration worker, accessibility
- **v2.0 UI & SEO** (6 phases, 14 plans) — SHIPPED: Visual design, glassmorphism, SEO, theme toggle
- **v3.0 Production-Ready Delivery** (6 phases, 15 plans) — SHIPPED: ESLint/Prettier, Docker, Playwright E2E, CI/CD, GitHub polish
- **v4.0 Hybrid Anonymous + Account Model** (10 phases, 38 plans) — SHIPPED: Dashboard, Stripe billing, PostHog analytics, pricing page, SSR SEO pages, email capture, notification emails, rate-limit conversion prompts
- **v5.0 Product Launch Checklist** (11 phases, in progress) — Brand rename (Torch Secret), marketing home page, Loops email onboarding, Infisical secrets management; Phase 37.2 active

## Key Design Decisions

- **Vanilla TS over React:** 4 pages total. Performance target <1s load on 3G. Smaller bundle = smaller attack surface.
- **Server-side password hashing:** Argon2id on the server (OWASP-recommended params). HTTPS protects transit.
- **nanoid over UUID:** 21-char URL-safe IDs. Cryptographically secure, shorter URLs.
- **PADME padding:** Max 12% overhead vs 100% for power-of-2. Prevents length leakage.
- **Ciphertext as text, not bytea:** Base64 text in PostgreSQL matches crypto module output. Simpler than binary columns.

## Conventions and Gotchas

- **Zod 4.x:** Uses `ZodType` for generic schemas (zod 4 removed `ZodSchema`).
- **ESM imports:** `pg` Pool is destructured from default import; `pinoHttp` uses named export — both for NodeNext CJS interop.
- **Crypto encoding:** IV is prepended to ciphertext as a single base64 blob: `[IV 12 bytes][ciphertext][auth tag 16 bytes]`.
- **Imported keys are non-extractable and decrypt-only** — defense in depth.
- **Loop-based `String.fromCharCode`** in encoding.ts (not spread) to avoid stack overflow on large buffers.
- **Express 5 wildcards:** SPA catch-all uses `{*path}` (path-to-regexp v8+), not `*`.
- **Server tsconfig:** Extends root but overrides to `NodeNext` module resolution and excludes DOM types.
- **Middleware order in `app.ts`:** Trust proxy → HTTPS redirect → CSP nonce → Helmet → logger → JSON parser → routes → static/SPA → error handler. Order matters for correctness.
- **Better Auth session cookie:** Must use `sameSite: 'lax'` (not `'strict'`) — OAuth callback redirects break with strict mode.
- **Better Auth `createAuthClient()`:** Omit `baseURL` — Better Auth infers from `window.location`, which works for both Vite dev proxy and same-origin production.
- **Better Auth `getSession()` typing:** Returns `any`; use an `isSession()` type guard to safely narrow the result and avoid `@typescript-eslint/no-unsafe-member-access` throughout the codebase.
- **Better Auth email verification bypass:** Use `requireEmailVerification: env.NODE_ENV !== 'test'` to skip the email gate in test environments.
- **Drizzle bug #4147:** After `db:generate`, inspect the generated SQL. If a migration adds both a new column and a FK constraint on that column in the same file, split into two separate migration files (ADD COLUMN first, then ADD CONSTRAINT). Failing to split causes the migration to fail.
- **Stripe webhook ordering:** `stripeWebhookHandler` with `express.raw()` MUST be mounted before `express.json()` in `app.ts`. Mounting after causes silent signature verification failures ("No signatures found matching the expected signature").
- **@better-auth/stripe:** Do NOT use the `@better-auth/stripe` billing webhook plugin — 4 open bugs (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle. Use raw Stripe SDK with a hand-written webhook handler.
- **SEO SSR requirement:** `/vs/*`, `/alternatives/*`, `/use/*` pages MUST be Express SSR (`server/src/routes/seo/`). SPA routes are invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and delay Googlebot indexing by days-to-weeks on a new domain.

## Zero-Knowledge Invariant (Hard Convention)

**MANDATORY CHECK:** Before writing any code that touches the database schema, application logger, or analytics events, read `.planning/INVARIANTS.md`. This invariant governs all phases and must not be violated.

### The Rule

No database record, log line, or analytics event may contain **both** a `userId` **and** a `secretId` in the same payload. These two identifiers must remain permanently separated across all systems.

### Why This Matters

Combining `userId` + `secretId` in any shared record creates a deanonymization attack surface — an attacker with DB or log access could correlate which user created which secret, violating the zero-knowledge security model.

### Current Enforcement (as of Phase 37.1)

| System                 | Rule                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `secrets.user_id` (DB) | Nullable FK to users.id; `secrets.id` is NEVER stored in users/sessions rows    |
| Pino logger            | Redacts secret IDs from URL paths via regex — no secretId in log output         |
| PostHog analytics      | `sanitize_properties` strips URL fragments before any event fires               |
| Stripe webhooks        | Webhook handler uses `stripe_customer_id` only — no userId+secretId co-location |
| marketing_subscribers  | Standalone table — no FK to users or secrets; no JOIN with secrets permitted    |

_(Excerpt — see `.planning/INVARIANTS.md` for all 10 enforcement points.)_

### When Adding New Systems

Extend the table in `.planning/INVARIANTS.md` first, then implement. Update the block comment in `server/src/db/schema.ts` to match.

See `.planning/INVARIANTS.md` for the complete rule, rationale, enforcement table, and extension protocol.

## Frontend UI/UX Workflow

**MANDATORY:** Before writing or modifying any frontend UI/UX code (HTML, CSS, templates, components, pages, layouts, styles, or visual elements), you MUST first invoke the `frontend-design` skill. This applies to any task that changes what the user sees — new pages, component creation, styling updates, layout changes, responsive adjustments, or visual redesigns. Do not skip this step even for small visual tweaks. The skill ensures design quality, consistency, and production-grade output.
