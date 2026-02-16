---
phase: 02-database-and-api
plan: 01
subsystem: database
tags: [express, drizzle-orm, postgresql, nanoid, zod, pino, typescript, esm]

# Dependency graph
requires:
  - phase: 01-encryption-foundation
    provides: Base64-encoded ciphertext format (EncryptedPayload.ciphertext) stored as text
provides:
  - Drizzle secrets table schema with 6 columns (id, ciphertext, expiresAt, createdAt, passwordHash, passwordAttempts)
  - PostgreSQL connection pool and drizzle ORM instance
  - Zod-validated environment config (DATABASE_URL, PORT, LOG_LEVEL, NODE_ENV)
  - Pino logger with secret ID redaction in URL paths
  - Shared API types (CreateSecretSchema, SecretIdParamSchema, response interfaces)
  - Drizzle Kit migration configuration
  - Server TypeScript project configured for Node.js ESM (NodeNext)
affects: [02-02-PLAN, 02-03-PLAN, 03-security-hardening, 04-frontend]

# Tech tracking
tech-stack:
  added: [express@5, pg, drizzle-orm, nanoid, zod, pino, pino-http, dotenv, drizzle-kit, tsx, pino-pretty, supertest]
  patterns: [Zod env validation at startup, pino URL redaction via custom serializer, NodeNext module resolution for server, nanoid $defaultFn for ID generation]

key-files:
  created:
    - server/tsconfig.json
    - server/src/config/env.ts
    - server/src/db/schema.ts
    - server/src/db/connection.ts
    - server/src/db/migrate.ts
    - server/src/middleware/logger.ts
    - shared/types/api.ts
    - drizzle.config.ts
    - .env.example
  modified:
    - package.json
    - tsconfig.json

key-decisions:
  - "Use pinoHttp named export (not default) for NodeNext CJS interop compatibility"
  - "pg Pool imported via pg default then destructured for NodeNext CJS compatibility"
  - "Password columns included in initial schema as nullable to avoid Phase 5 migration"
  - "Ciphertext stored as PostgreSQL text (not bytea) since Phase 1 outputs base64 strings"

patterns-established:
  - "Zod env validation: parse process.env at startup, export typed env object"
  - "Logger redaction: custom pino serializer replaces /api/secrets/:id with [REDACTED]"
  - "Server ESM: NodeNext module resolution with .js extensions in imports"
  - "Drizzle schema: $defaultFn(() => nanoid()) for application-layer ID generation"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 2 Plan 01: Server Foundation Summary

**Express 5 + Drizzle ORM server skeleton with secrets table schema, Zod env config, pino logger with ID redaction, and shared API types**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T13:02:36Z
- **Completed:** 2026-02-14T13:05:41Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Server TypeScript project configured for Node.js ESM with NodeNext module resolution
- Database schema defines secrets table with all 6 columns (id, ciphertext, expiresAt, createdAt, passwordHash, passwordAttempts)
- Zod-validated environment configuration catches invalid config at startup
- Pino logger redacts secret IDs from all URL paths to prevent log leakage
- Shared API types provide CreateSecretSchema, SecretIdParamSchema, and response interfaces for client/server contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and configure server TypeScript** - `c72cf21` (chore)
2. **Task 2: Create database schema, connection, env config, logger, and shared types** - `796402d` (feat)

## Files Created/Modified
- `package.json` - Added "type": "module", scripts, production and dev dependencies
- `tsconfig.json` - Added server/src to include paths
- `server/tsconfig.json` - Server-specific TypeScript config (NodeNext, Node types)
- `server/src/config/env.ts` - Zod-validated environment variables
- `server/src/db/schema.ts` - Drizzle secrets table definition with nanoid IDs
- `server/src/db/connection.ts` - PostgreSQL connection pool and drizzle instance
- `server/src/db/migrate.ts` - Programmatic migration runner
- `server/src/middleware/logger.ts` - Pino logger with URL path redaction
- `shared/types/api.ts` - Zod schemas and TypeScript interfaces for API contracts
- `drizzle.config.ts` - Drizzle Kit migration configuration
- `.env.example` - Documented environment variables template

## Decisions Made
- **pinoHttp named import:** Used `{ pinoHttp }` named export instead of default import for CJS/ESM interop under NodeNext module resolution. pino-http is a CJS package and default imports do not resolve correctly with NodeNext.
- **pg Pool destructuring:** Imported pg as default then destructured Pool (`const { Pool } = pg`) for the same CJS interop reason.
- **Password columns upfront:** Included passwordHash and passwordAttempts in the initial schema to avoid a migration in Phase 5.
- **Text for ciphertext:** Phase 1 outputs base64 strings, so PostgreSQL text column avoids encode/decode overhead vs bytea.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pino-http CJS import for NodeNext**
- **Found during:** Task 2 (logger creation)
- **Issue:** `import pinoHttp from 'pino-http'` fails under NodeNext because pino-http is a CJS module without proper ESM wrapper. TypeScript error: "This expression is not callable."
- **Fix:** Changed to named import `import { pinoHttp } from 'pino-http'` and added explicit `IncomingMessage` type for the req serializer parameter
- **Files modified:** server/src/middleware/logger.ts
- **Verification:** `npx tsc --project server/tsconfig.json --noEmit` passes cleanly
- **Committed in:** 796402d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** CJS/ESM interop fix necessary for compilation. No scope creep.

## Issues Encountered
- 4 moderate npm audit vulnerabilities reported (in dev dependencies). Not blocking for development; will address during Phase 3 security hardening or dependency updates.

## User Setup Required
None - no external service configuration required. Database setup is handled by docker-compose in subsequent plans.

## Next Phase Readiness
- Schema, connection pool, env config, logger, and shared types are all ready for import by service layer and routes
- Plan 02-02 (secrets service + routes) can import directly from these modules
- Plan 02-03 (integration tests) can use supertest (installed) with the app factory pattern

---
*Phase: 02-database-and-api*
*Completed: 2026-02-14*
