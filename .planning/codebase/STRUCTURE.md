# Codebase Structure

**Analysis Date:** 2026-02-14

## Directory Layout

```
secureshare/
├── client/                    # Frontend (vanilla TS, not yet implemented except crypto)
│   └── src/
│       └── crypto/            # AES-256-GCM encryption module (Phase 1 complete)
│           └── __tests__/     # Crypto unit tests
├── server/                    # Backend (Express 5 + TypeScript)
│   └── src/
│       ├── config/            # Environment configuration
│       ├── db/                # Database schema, connection, migrations
│       ├── middleware/        # Express middleware (validation, logging, errors)
│       ├── routes/            # HTTP endpoint handlers
│       │   └── __tests__/     # API integration tests
│       └── services/          # Business logic layer
├── shared/                    # Types shared between client and server
│   └── types/                 # Zod schemas and TypeScript interfaces
├── .planning/                 # GSD workflow documentation
│   ├── codebase/              # Codebase analysis docs (this directory)
│   ├── phases/                # Phase plans and execution logs
│   └── research/              # Pre-implementation research
├── drizzle/                   # Generated SQL migrations (not in repo yet)
├── node_modules/              # Dependencies
├── package.json               # NPM manifest and scripts
├── tsconfig.json              # Root TypeScript config
├── vitest.config.ts           # Test runner configuration
├── drizzle.config.ts          # Database migration config
├── .env                       # Local environment variables (gitignored)
├── .env.example               # Template for required env vars
├── CLAUDE.md                  # Claude Code project guidance
└── secret-share-prd.md        # Original PRD
```

## Directory Purposes

**client/src/crypto/:**
- Purpose: Client-side encryption/decryption (zero-knowledge design)
- Contains: `encrypt.ts`, `decrypt.ts`, `keys.ts`, `encoding.ts`, `padding.ts`, `constants.ts`, `types.ts`, `index.ts` (barrel export)
- Key files:
  - `index.ts`: Public API (`encrypt`, `decrypt`, key functions)
  - `encrypt.ts`: AES-256-GCM encryption with PADME padding
  - `decrypt.ts`: AES-256-GCM decryption with unpadding
  - `keys.ts`: Key generation and import/export (base64url)
  - `padding.ts`: PADME padding algorithm (prevents length leakage)
  - `encoding.ts`: Base64/base64url utilities
  - `__tests__/`: 5 test files with 100% coverage

**client/src/pages/:**
- Purpose: Frontend page components (Phase 4 - not yet implemented)
- Expected files: `create.ts`, `reveal.ts`, `confirmation.ts`, `error.ts`

**client/src/components/:**
- Purpose: Reusable UI components (Phase 4 - not yet implemented)
- Expected files: `CopyButton.ts`, `PasswordInput.ts`

**client/src/api/:**
- Purpose: API client functions for server communication (Phase 4 - not yet implemented)
- Expected files: `secrets.ts` (wrapper for POST/GET `/api/secrets`)

**server/src/config/:**
- Purpose: Environment variable loading and validation
- Contains: `env.ts` (Zod schema for DATABASE_URL, PORT, LOG_LEVEL, NODE_ENV)
- Key files:
  - `env.ts`: Exports validated `env` object, fails fast on missing vars

**server/src/db/:**
- Purpose: Database schema, connection pooling, migrations
- Contains: `schema.ts`, `connection.ts`, `migrate.ts`
- Key files:
  - `schema.ts`: Drizzle schema for `secrets` table (id, ciphertext, expiresAt, createdAt, passwordHash, passwordAttempts)
  - `connection.ts`: PostgreSQL pool and Drizzle ORM instance
  - `migrate.ts`: Migration runner (called manually via `npm run db:migrate`)

**server/src/middleware/:**
- Purpose: Express middleware for cross-cutting concerns
- Contains: `validate.ts`, `logger.ts`, `error-handler.ts`
- Key files:
  - `validate.ts`: `validateBody()`, `validateParams()` factories for Zod validation
  - `logger.ts`: Pino logger with secret ID redaction, `httpLogger` middleware
  - `error-handler.ts`: Global error handler (500 responses)

**server/src/routes/:**
- Purpose: HTTP endpoint handlers (thin layer delegating to services)
- Contains: `secrets.ts`, `__tests__/secrets.test.ts`
- Key files:
  - `secrets.ts`: Express router with POST `/` (create) and GET `/:id` (retrieve-and-destroy)
  - `__tests__/secrets.test.ts`: Integration tests using supertest (6 passing tests)

**server/src/services/:**
- Purpose: Business logic and database operations
- Contains: `secrets.service.ts`
- Key files:
  - `secrets.service.ts`: `createSecret()`, `retrieveAndDestroy()` with atomic transaction

**shared/types/:**
- Purpose: Contract definitions for client-server communication
- Contains: `api.ts`
- Key files:
  - `api.ts`: Zod schemas (`CreateSecretSchema`, `SecretIdParamSchema`), TypeScript interfaces (`CreateSecretResponse`, `SecretResponse`, `ErrorResponse`)

**.planning/:**
- Purpose: GSD workflow documentation (roadmap, plans, state tracking)
- Contains: `ROADMAP.md`, `STATE.md`, `PROJECT.md`, `REQUIREMENTS.md`, `config.json`, subdirectories for phases/research/codebase
- Key files:
  - `ROADMAP.md`: 7-phase implementation plan
  - `STATE.md`: Current phase progress and blockers
  - `phases/01-*/`, `phases/02-*/`: Phase-specific plans and execution logs

**.planning/codebase/:**
- Purpose: Codebase analysis documents for GSD commands
- Contains: This file (STRUCTURE.md), ARCHITECTURE.md (sibling)

## Key File Locations

**Entry Points:**
- `server/src/server.ts`: HTTP server startup, graceful shutdown
- `server/src/app.ts`: Express app factory (testable, no server start)
- `client/src/crypto/index.ts`: Crypto module public API

**Configuration:**
- `tsconfig.json`: Root TypeScript config (ES2022, ESNext modules, bundler resolution)
- `server/tsconfig.json`: Server-specific overrides (if exists)
- `vitest.config.ts`: Test runner config
- `drizzle.config.ts`: Database migration config (PostgreSQL URL, migrations dir)
- `.env`: Local environment variables (DATABASE_URL, PORT, LOG_LEVEL, NODE_ENV)
- `.env.example`: Template showing required vars

**Core Logic:**
- `server/src/services/secrets.service.ts`: Secret creation and atomic retrieval
- `client/src/crypto/encrypt.ts`: AES-256-GCM encryption
- `client/src/crypto/decrypt.ts`: AES-256-GCM decryption

**Testing:**
- `vitest.config.ts`: Test configuration (timeout 10s)
- `server/src/routes/__tests__/secrets.test.ts`: API integration tests (6 tests)
- `client/src/crypto/__tests__/*.test.ts`: 5 crypto unit test files (21 tests total)

## Naming Conventions

**Files:**
- `.ts` extension for all TypeScript source files
- `.test.ts` suffix for test files (co-located with source in `__tests__/` subdirectories)
- `kebab-case` for multi-word filenames: `error-handler.ts`, `secrets.service.ts`
- Barrel exports use `index.ts` (e.g., `client/src/crypto/index.ts`)

**Directories:**
- `kebab-case` for multi-word directories: `__tests__`, `src`
- `camelCase` NOT used for directories (consistent with Express conventions)

**Functions:**
- `camelCase` for functions: `createSecret`, `retrieveAndDestroy`, `validateBody`
- Async functions explicitly return `Promise<T>`

**Variables:**
- `camelCase` for local variables: `ciphertext`, `expiresAt`, `plaintextBytes`
- `SCREAMING_SNAKE_CASE` for constants: `DURATION_MS`, `IV_LENGTH`, `ALGORITHM`, `SECRET_NOT_AVAILABLE`

**Types:**
- `PascalCase` for types and interfaces: `Secret`, `EncryptResult`, `CreateSecretRequest`
- Zod schemas use `PascalCase` with `Schema` suffix: `CreateSecretSchema`, `SecretIdParamSchema`

**Routers:**
- Lowercase plural noun + `Router` suffix: `secretsRouter`

## Where to Add New Code

**New API Endpoint:**
- Primary code: `server/src/routes/{resource}.ts` (new router file)
- Service logic: `server/src/services/{resource}.service.ts`
- Types/schemas: `shared/types/api.ts` (add Zod schema and TypeScript interface)
- Tests: `server/src/routes/__tests__/{resource}.test.ts`
- Mount router: Add to `server/src/app.ts` with `app.use('/api/{resource}', {resource}Router)`

**New Middleware:**
- Implementation: `server/src/middleware/{name}.ts`
- Apply globally: Add to `server/src/app.ts` middleware chain
- Apply per-route: Import in route file and add to route handler chain

**New Frontend Page:**
- Implementation: `client/src/pages/{page-name}.ts`
- Components: `client/src/components/{ComponentName}.ts`
- Styles: Inline Tailwind classes (no separate CSS files per PRD)
- API calls: `client/src/api/{resource}.ts`

**New Crypto Function:**
- Implementation: `client/src/crypto/{function-name}.ts`
- Tests: `client/src/crypto/__tests__/{function-name}.test.ts`
- Public API: Export from `client/src/crypto/index.ts` if external, keep internal otherwise
- Constants: Add to `client/src/crypto/constants.ts`
- Types: Add to `client/src/crypto/types.ts`

**New Database Table:**
- Schema: Add to `server/src/db/schema.ts` using Drizzle `pgTable()`
- Generate migration: `npm run db:generate` (creates SQL in `drizzle/migrations/`)
- Apply migration: `npm run db:migrate`
- Type exports: Export `$inferSelect` and `$inferInsert` types from schema

**New Shared Type:**
- Zod schema: Add to `shared/types/api.ts` with `z.object()`
- TypeScript interface: Export `z.infer<typeof Schema>` or manual interface
- Usage: Import in client API code and server validation middleware

**Utilities:**
- Server helpers: `server/src/utils/{category}.ts` (directory not yet created)
- Client helpers: `client/src/utils/{category}.ts` (directory not yet created)
- Shared helpers: `shared/utils/{category}.ts` (directory not yet created)

**Environment Variables:**
- Schema: Add to `EnvSchema` in `server/src/config/env.ts`
- Documentation: Add to `.env.example` with description comment
- Local value: Add to `.env` (gitignored, never committed)

## Special Directories

**node_modules/:**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (gitignored)

**drizzle/migrations/:**
- Purpose: Generated SQL migration files
- Generated: Yes (via `npm run db:generate`)
- Committed: Yes (migrations are versioned)
- Not present yet: Directory created on first migration generation

**dist/:**
- Purpose: Compiled TypeScript output
- Generated: Yes (via `tsc` build, not yet configured)
- Committed: No (gitignored)

**.planning/:**
- Purpose: GSD workflow documentation
- Generated: Partially (by GSD commands and manual planning)
- Committed: Yes (all planning docs tracked in git)

**.planning/codebase/:**
- Purpose: Codebase analysis for GSD command consumption
- Generated: Yes (by `/gsd:map-codebase` command)
- Committed: Yes (referenced by other GSD commands)

**.planning/phases/NN-{phase-name}/:**
- Purpose: Phase-specific implementation plans and logs
- Generated: Yes (by `/gsd:plan-phase` and `/gsd:execute-phase`)
- Committed: Yes (tracks implementation history)

**.planning/research/:**
- Purpose: Pre-implementation research and decisions
- Generated: Yes (by initial planning workflow)
- Committed: Yes (historical context for architecture decisions)

**.claude/:**
- Purpose: Claude Code local settings
- Generated: Yes (by Claude Code)
- Committed: No (gitignored, user-specific)

**.git/:**
- Purpose: Git repository metadata
- Generated: Yes (by git)
- Committed: No (not tracked within itself)

**coverage/:**
- Purpose: Test coverage reports (not yet generated)
- Generated: Yes (via `vitest --coverage`, not yet configured)
- Committed: No (gitignored, ephemeral)

---

*Structure analysis: 2026-02-14*
