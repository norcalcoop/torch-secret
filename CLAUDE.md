# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SecureShare is a zero-knowledge, one-time secret sharing web app. Users paste sensitive text, get an encrypted link, share it, and the secret self-destructs after one view. No accounts, no signup. The encryption key lives exclusively in the URL fragment (`#key`) and never reaches the server.

## Tech Stack

- **Runtime:** Node.js 24.x LTS, TypeScript 5.9.x (ESM, `"type": "module"`)
- **Backend:** Express 5.x, Drizzle ORM with PostgreSQL 17+, Pino logging
- **Frontend:** Vanilla TypeScript (NOT React), Vite 7.x, Tailwind CSS 4.x (`@tailwindcss/vite` plugin), Lucide icons, JetBrains Mono font
- **Encryption:** Web Crypto API (AES-256-GCM), no third-party crypto libraries
- **Security:** Helmet (CSP with per-request nonce), express-rate-limit (Redis-backed or in-memory), Argon2id password hashing, HTTPS redirect
- **Background jobs:** node-cron (expired secret cleanup worker)
- **Testing:** Vitest 4.x (multi-project: client=happy-dom, server=node), Supertest, vitest-axe
- **Validation:** Zod 4.x for env vars, API request schemas, and shared type contracts

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
│       ├── crypto/             # AES-256-GCM encrypt/decrypt (self-contained module)
│       ├── components/         # UI components (layout, copy-button, share-button, toast, terminal-block, theme-toggle, icons, loading-spinner, expiration-select)
│       └── pages/              # create, confirmation, reveal, error
├── server/src/
│   ├── app.ts                  # Express app factory (middleware order is critical — see comments)
│   ├── server.ts               # HTTP server startup, graceful shutdown
│   ├── config/env.ts           # Zod-validated env vars
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema: secrets table
│   │   ├── connection.ts       # PostgreSQL pool + Drizzle instance
│   │   └── migrate.ts          # Migration runner script
│   ├── routes/secrets.ts       # All 4 API endpoints
│   ├── middleware/
│   │   ├── security.ts         # CSP nonce, helmet, HTTPS redirect
│   │   ├── rate-limit.ts       # Redis-backed rate limiters
│   │   ├── validate.ts         # Zod request validation
│   │   ├── logger.ts           # Pino with secret ID redaction
│   │   └── error-handler.ts    # Global error handler (must be last middleware)
│   ├── services/
│   │   ├── secrets.service.ts  # createSecret, retrieveAndDestroy, verifyAndRetrieve
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

| Method | Path                      | Purpose                                                  |
| ------ | ------------------------- | -------------------------------------------------------- |
| POST   | `/api/secrets`            | Create secret (receives encrypted blob, never plaintext) |
| GET    | `/api/secrets/:id`        | Retrieve + atomic delete (no password)                   |
| GET    | `/api/secrets/:id/meta`   | Check if password required (does NOT consume secret)     |
| POST   | `/api/secrets/:id/verify` | Password verify + retrieve + atomic delete               |

## Development Commands

```bash
npm install                        # Install dependencies
npm run dev:server                 # Backend dev server (tsx watch, requires PostgreSQL)
npm run dev:client                 # Frontend dev server (Vite, proxies /api to :3000)
npm run build:client               # Production frontend build
npm run preview:client             # Preview production build locally
npm test                           # All tests in watch mode
npm run test:run                   # All tests once
npx vitest run path/to/test.ts     # Single test file
npm run db:generate                # Generate migration from schema changes
npm run db:migrate                 # Apply migrations
```

**Prerequisites:** PostgreSQL 17+ at `DATABASE_URL` (see `.env.example`). Optional `REDIS_URL` for distributed rate limiting. No Docker Compose — start PostgreSQL manually or via Docker.

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
- **v3.0 Production-Ready Delivery** (5 phases, in progress) — ESLint/Prettier, Docker, E2E tests, CI/CD, GitHub polish

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

## Zero-Knowledge Invariant (Hard Convention)

**MANDATORY CHECK:** Before writing any code that touches the database schema, application logger, or analytics events, read `.planning/INVARIANTS.md`. This invariant governs all of v4.0 and must not be violated.

### The Rule

No database record, log line, or analytics event may contain **both** a `userId` **and** a `secretId` in the same payload. These two identifiers must remain permanently separated across all systems.

### Why This Matters

Combining `userId` + `secretId` in any shared record creates a deanonymization attack surface — an attacker with DB or log access could correlate which user created which secret, violating the zero-knowledge security model.

### Current Enforcement (as of Phase 21)

| System                 | Rule                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `secrets.user_id` (DB) | Nullable FK to users.id; `secrets.id` is NEVER stored in users/sessions rows |
| Pino logger            | Redacts secret IDs from URL paths via regex — no secretId in log output      |
| PostHog (Phase 25)     | `sanitize_properties` must strip URL fragments before any event fires        |

### When Adding New Systems

Extend the table in `.planning/INVARIANTS.md` first, then implement. Update the block comment in `server/src/db/schema.ts` to match.

See `.planning/INVARIANTS.md` for the complete rule, rationale, enforcement table, and extension protocol.

## Frontend UI/UX Workflow

**MANDATORY:** Before writing or modifying any frontend UI/UX code (HTML, CSS, templates, components, pages, layouts, styles, or visual elements), you MUST first invoke the `frontend-design` skill. This applies to any task that changes what the user sees — new pages, component creation, styling updates, layout changes, responsive adjustments, or visual redesigns. Do not skip this step even for small visual tweaks. The skill ensures design quality, consistency, and production-grade output.
