# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Kebab-case for all files and directories: `secrets.ts`, `error-handler.ts`, `password.service.ts`
- Test files: `*.test.ts` or `__tests__` directory alongside source code
- Service files: `*.service.ts` (e.g., `secrets.service.ts`, `password.service.ts`)
- Route files: `routes/[name].ts` (e.g., `routes/secrets.ts`, `routes/health.ts`, `routes/me.ts`)
- Middleware files: `middleware/[name].ts` (e.g., `middleware/error-handler.ts`, `middleware/validate.ts`)
- Worker files: `workers/[name].ts` (e.g., `workers/expiration-worker.ts`)
- Configuration: `config/env.ts`, `drizzle.config.ts`, `vite.config.ts`, `.prettierrc.json`, `eslint.config.ts`

**Functions:**
- camelCase for all functions: `createSecret`, `retrieveAndDestroy`, `verifyAndRetrieve`, `redactUrl`, `startExpirationWorker`
- Exported service functions are async: `export async function createSecret(...)`
- Middleware factories return closures: `validateBody<T>(schema)` returns `(req, res, next) => void`
- Worker functions prefixed with action: `startExpirationWorker()`, `stopExpirationWorker()`, `cleanExpiredSecrets()`
- Route factories prefixed with `create`: `createSecretsRouter(redisClient?)`, `buildApp()`

**Variables:**
- camelCase for all variables: `ciphertext`, `expiresAt`, `passwordHash`, `redisClient`, `secret`, `result`
- Constants in UPPER_SNAKE_CASE at module scope:
  - Duration maps: `DURATION_MS: Record<string, number>`
  - Thresholds: `MAX_PASSWORD_ATTEMPTS = 3`
  - Configuration objects: `ARGON2_OPTIONS`, `SECRET_NOT_AVAILABLE`
  - Test constants: `VALID_CIPHERTEXT`, `NONEXISTENT_ID`, `URL_SAFE_REGEX`
- Numeric literals use underscores for readability: `19_456`, `3_600_000`, `604_800_000`

**Types & Interfaces:**
- PascalCase for all type names:
  - Request/response types: `CreateSecretRequest`, `SecretResponse`, `MetaResponse`, `VerifySecretResponse`
  - Error types: `ApiError`, `ErrorResponse`, `VerifyErrorResponse`
  - Domain types: `Secret`, `NewSecret`, `User`, `PageMeta`, `PageRenderer`
  - Inferred session types: `AuthSession`, `AuthUser`, `AuthSessionData`
- Zod schemas in PascalCase with "Schema" suffix: `CreateSecretSchema`, `SecretIdParamSchema`, `VerifySecretSchema`, `EnvSchema`
- Type inference from Zod: `type CreateSecretRequest = z.infer<typeof CreateSecretSchema>`
- Database inferred types: `type Secret = typeof secrets.$inferSelect`, `type NewSecret = typeof secrets.$inferInsert`

## Code Style

**Formatting:**
- Prettier enforced via `.prettierrc.json`:
  - Single quotes: `'string'` not `"string"`
  - Trailing commas: `{ a: 1, b: 2, }` in multiline
  - Print width: 100 characters
  - Tab width: 2 spaces
  - Semicolons required
  - Tailwind CSS class reordering: prettier-plugin-tailwindcss auto-sorts in client code
- Line length target: 100 characters (soft guideline)
- Indentation: 2 spaces consistently

**Linting:**
- ESLint with TypeScript support via `typescript-eslint` (ESM flat config in `eslint.config.ts`)
- Rules:
  - `@typescript-eslint/no-unused-vars`: Error for unused variables/params unless prefixed with `_`
  - `@typescript-eslint/no-unsafe-assignment/member-access/argument`: Disabled in test files (`.test.ts`, `__tests__/**`, scripts, e2e)
  - Type-checked linting enabled for all source files (`projectService: true`)
- Pre-commit hook via husky: runs `eslint --fix` then `prettier --write` on staged files
- Lint script: `npm run lint` to check, `npm run lint:fix` to auto-fix

**Comment Headers:**
- Module-level JSDoc blocks describe purpose (present in all key modules)
- Security-critical comments use block format:
  ```typescript
  /**
   * ZERO-KNOWLEDGE INVARIANT — canonical rule
   * No database record may contain BOTH userId AND secretId
   */
  ```

## Import Organization

**Order:**
1. Node.js built-in modules with `node:` prefix: `import { resolve } from 'node:path'`, `import { readFileSync } from 'node:fs'`
2. Third-party packages: `import express from 'express'`, `import { z } from 'zod'`, `import { Redis } from 'ioredis'`
3. Type-only imports from third-party: `import type { Request, Response, NextFunction } from 'express'`
4. Relative imports with explicit `.js` extension: `import { buildApp } from './app.js'`
5. Type-only relative imports: `import type { Secret } from '../db/schema.js'`

**Path Aliases:**
- No path aliases in server code
- Vite aliases in client (used mainly in e2e tests): `~` for `client/src`
- All relative imports use explicit `.js` file extension (ESM requirement)

**Import Syntax:**
- Named imports preferred: `import { createSecret } from './services/secrets.service.js'`
- Type-only imports: `import type { CreateSecretRequest } from '../../../shared/types/api.js'`
- Namespace imports for utilities: `import * as matchers from 'vitest-axe/matchers'`
- Default imports only for third-party libraries: `import express from 'express'`
- Module interop workaround for CJS packages:
  ```typescript
  import pg from 'pg';
  const { Pool } = pg;  // pg exports default that is namespace
  ```

## Error Handling

**Patterns:**
- Custom error classes: `export class ApiError extends Error` with properties `.status`, `.body`
- Service functions return `null` for missing resources (never throw for expected cases):
  - `retrieveAndDestroy(id): Promise<Secret | null>`
  - `getSecretMeta(id): Promise<{ requiresPassword, passwordAttemptsRemaining } | null>`
- Discriminated unions for multi-case outcomes:
  ```typescript
  verifyAndRetrieve(id, password): Promise<
    | { success: true; secret: Secret }
    | { success: false; attemptsRemaining: number }
    | null
  >
  ```
- Validation via Zod `.safeParse()`: `{ success: boolean, data?: T, error?: ZodError }`
- Route handlers respond with structured error objects:
  ```typescript
  res.status(400).json({ error: 'validation_error', details: result.error.flatten() })
  res.status(404).json({ error: 'not_found', message: '...' })
  res.status(403).json({ error: 'wrong_password', attemptsRemaining: N })
  ```
- Global error handler in `server/src/middleware/error-handler.ts`: logs error but returns generic 500 response
- **Anti-enumeration:** Identical error response for all "secret unavailable" cases prevents timing/content enumeration:
  ```typescript
  const SECRET_NOT_AVAILABLE = {
    error: 'not_found',
    message: 'This secret does not exist, has already been viewed, or has expired.',
  } as const;
  ```

## Logging

**Framework:** Pino with pino-http middleware (`server/src/middleware/logger.ts`)

**Patterns:**
- Base logger with redaction rules for sensitive headers:
  ```typescript
  export const logger = pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[REDACTED]',
    },
  });
  ```
- HTTP logger with custom serializer: logs method + redacted URL (secret IDs masked)
  - Secret ID redaction via regex: `/api/secrets/[A-Za-z0-9_-]+` → `/api/secrets/[REDACTED]`
  - Request/response bodies never logged (could contain ciphertext)
- Error logging: `logger.error({ err: { message, stack } }, 'Unhandled error')`
- Log level via `LOG_LEVEL` env var (default: `'info'`)
- **Never logged:** Secret IDs, ciphertext, plaintext passwords, IP addresses, PII

## Comments

**When to Comment:**
- Block comments for security-critical code: transaction steps, expiration guards, anti-enumeration logic
- JSDoc for all exported functions describing purpose, parameters, return value, side effects
- Inline comments for non-obvious logic or important invariants
- Test file headers document coverage scope:
  ```typescript
  /**
   * Tests for the encrypt module.
   *
   * Covers: return shape, IV prepending, key/IV uniqueness,
   * padding tier verification, edge cases (empty, large, unicode).
   */
  ```

**JSDoc/TSDoc:**
- Every exported function has JSDoc with:
  - Purpose (first line)
  - `@param` tags if behavior non-obvious
  - `@returns` describing return type and when null/undefined occurs
- Examples from codebase:
  ```typescript
  /**
   * Atomically retrieves and destroys a secret using a three-step
   * transaction: SELECT -> ZERO ciphertext -> DELETE.
   *
   * Returns null for nonexistent, expired, already-consumed, or
   * password-protected secrets.
   */
  export async function retrieveAndDestroy(id: string): Promise<Secret | null>
  ```
- Type definitions include inline comments:
  ```typescript
  /** Duration string to milliseconds mapping */
  const DURATION_MS: Record<string, number> = { '1h': 3_600_000, ... };
  ```
- Section separators in long files:
  ```typescript
  // ---------------------------------------------------------------------------
  // Phase 5: Password Protection
  // ---------------------------------------------------------------------------
  ```

## Function Design

**Size:**
- Target: under 40 lines for readability
- Exception: transaction handlers can be 50-70 lines with clear step comments
- Extract helpers if function body exceeds logical scope

**Parameters:**
- Explicit parameters for 1-3 args: `createSecret(ciphertext, expiresIn, password?)`
- Optional params typed with `?`: `password?: string`
- Type literals for constrained values: `expiresIn: '1h' | '24h' | '7d' | '30d'` (not generic string)
- Generic constraints: `function validateBody<T>(schema: ZodType<T>)`

**Return Values:**
- Explicit return type on all functions (no implicit `any`)
- Async functions: `Promise<T>`
- Void for side-effect operations: middleware handlers, worker initialization
- Early return for guard clauses:
  ```typescript
  if (!meta) {
    res.status(404).json(SECRET_NOT_AVAILABLE);
    return;  // Early return, not else
  }
  ```
- Prefer returning structures over exceptions for expected errors
- Use discriminated unions for multi-branch results

**Null vs Undefined:**
- `null` for "not found" from queries: `retrieveAndDestroy(id): Promise<Secret | null>`
- `undefined` for optional config/parameters: `redisClient?: Redis`
- Never use `null` as default return value (prefer explicit return shape)

## Module Design

**Exports:**
- Service modules export only functions: `export async function createSecret(...)`
- Route factories export factory function: `export function createSecretsRouter(redisClient?)`
- Middleware exports named functions: `export function errorHandler(...)`, `export const httpLogger = ...`
- Database exports schema types and instances: `export type Secret`, `export const db`, `export const pool`
- Config exports validated object: `export const env: Env`

**Barrel Files:**
- Not used for domain code (prefer explicit imports)
- Crypto module exception: `client/src/crypto/index.ts` re-exports public API
- Shared types: `shared/types/api.ts` exports all schemas and interfaces (single source of truth)

**Module Organization:**
- One main export per file or cohesive set of related functions
- Services group related operations: `secrets.service.ts` has `createSecret`, `retrieveAndDestroy`, `getSecretMeta`, `verifyAndRetrieve`
- Middleware factories co-located: `rate-limit.ts` exports `createSecretLimiter` and `verifySecretLimiter`
- Types and schemas co-located in shared file: `shared/types/api.ts`

## Constants & Magic Numbers

**Storage:**
- Module-scope constants in UPPER_SNAKE_CASE
- Documented with inline comments explaining purpose/unit
- Example: `const MAX_PASSWORD_ATTEMPTS = 3` (auto-destroy after 3 failures)
- Example: `const DURATION_MS: Record<string, number> = { '1h': 3_600_000, ... }` (human-readable with underscores)

**Type Safety:**
- Constants with limited values use union types in function signatures
- Example: `expiresIn: '1h' | '24h' | '7d' | '30d'` (not a generic string)
- Zod enum schemas enforce at validation boundary: `z.enum(['1h', '24h', '7d', '30d'])`
- TypeScript compiler ensures exhaustiveness checking on switch/if statements

## Async/Await

**Patterns:**
- All async operations use `async`/`await` (no `.then()` chains)
- Service functions are async: `export async function createSecret(...): Promise<Secret>`
- Route handlers are async: `router.post('/', async (req, res) => { ... })`
- Database transactions use async context: `await db.transaction(async (tx) => { ... })`
- Error handling via global Express error handler (unhandled errors caught)

## Security-Conscious Conventions

**Password Hashing:**
- Always hash on server using Argon2id with OWASP-minimum params:
  ```typescript
  const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,  // 19 MiB (OWASP minimum)
    timeCost: 2,         // 2 iterations
    parallelism: 1,      // Single thread
  };
  ```
- Hash verification uses constant-time comparison (built into argon2.verify)

**Encryption:**
- Client-side only: Web Crypto API in `client/src/crypto/` module
- IV generated fresh per encryption: `crypto.getRandomValues(new Uint8Array(12))`
- Keys generated fresh per encryption: `crypto.subtle.generateKey(...)`
- Keys are non-extractable (cannot be exported after creation)
- No `Math.random()` for security operations

**Zero-Knowledge Invariant:**
- **MANDATORY:** Never combine userId and secretId in same database record or log line
- Enforcement points documented in `server/src/db/schema.ts` and `.planning/INVARIANTS.md`
- Update INVARIANTS.md when adding new systems (PostHog events, analytics, etc.)

**Response Standardization:**
- Identical error responses for all "not available" cases (prevents enumeration)
- No timing differences between success/failure (use constant-time verification)
- No sensitive data in error messages to unauthenticated users

---

*Convention analysis: 2026-02-20*
