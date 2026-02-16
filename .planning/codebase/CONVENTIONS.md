# Coding Conventions

**Analysis Date:** 2026-02-16

## Naming Patterns

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `secrets.service.ts`, `error-handler.ts`)
- Test files: `[source-name].test.ts` (e.g., `encoding.test.ts`, `secrets.test.ts`)
- Config files: `[tool].config.ts` (e.g., `vitest.config.ts`, `drizzle.config.ts`)
- Special: `__tests__/` directories contain test files co-located with source

**Functions:**
- camelCase for all functions (e.g., `createSecret`, `validateBody`, `retrieveAndDestroy`)
- Async functions explicitly return `Promise<T>`
- Factory functions prefixed with `create` or `build` (e.g., `createSecretsRouter`, `buildApp`)

**Variables:**
- camelCase for local variables (e.g., `ciphertext`, `expiresAt`, `plaintextBytes`)
- UPPER_SNAKE_CASE for constants (e.g., `VALID_CIPHERTEXT`, `MAX_PASSWORD_ATTEMPTS`, `IV_LENGTH`)
- Object destructuring from default imports for ESM interop:
  - `import pg from 'pg'; const { Pool } = pg;` (`server/src/db/connection.ts`)
  - `import pinoHttpDefault from 'pino-http'; const pinoHttp = pinoHttpDefault;`

**Types:**
- PascalCase for interfaces and types (e.g., `EncryptResult`, `CreateSecretRequest`, `Secret`)
- Type-only imports use `import type` (e.g., `import type { Request, Response } from 'express'`)
- Zod schemas suffixed with `Schema` (e.g., `CreateSecretSchema`, `EnvSchema`)
- Type inference via `z.infer<typeof Schema>` for runtime schema types

## Code Style

**Formatting:**
- No `.prettierrc` or `.eslintrc` detected -- formatting appears manual or editor-based
- Indentation: 2 spaces
- String literals: single quotes in server code, both single and double in client code
- Line length: generally 80-100 characters, docstrings can extend further
- Template literals used for multi-line strings and SQL

**Linting:**
- No ESLint config detected
- TypeScript strict mode enabled in `tsconfig.json`:
  - `"strict": true`
  - `"forceConsistentCasingInFileNames": true`
  - `"skipLibCheck": true`

## Import Organization

**Order:**
1. Node built-ins with `node:` prefix (e.g., `import { readFileSync } from 'node:fs'`)
2. External packages (e.g., `import express from 'express'`)
3. Internal absolute imports (e.g., `import { env } from '../config/env.js'`)
4. Type-only imports grouped separately (e.g., `import type { Request } from 'express'`)

**Path Aliases:**
- None detected -- all imports use relative paths (`../`, `./`)
- Shared types: `import { CreateSecretSchema } from '../../../shared/types/api.js'`

**ESM Extensions:**
- All imports include `.js` extension (ESM requirement with `"type": "module"`)
- Applies even to `.ts` source files: `import { db } from './connection.js'`

## Error Handling

**Patterns:**
- Use Zod for validation -- `safeParse()` returns `{ success: boolean, data?, error? }`
- Validation errors return 400 with structured JSON:
  ```typescript
  res.status(400).json({
    error: 'validation_error',
    details: result.error.flatten(),
  });
  ```
- Database transactions use Drizzle's `db.transaction(async (tx) => { ... })`
- Service functions return `null` for not-found cases (never throw)
- Anti-enumeration: identical error responses for all "not available" cases:
  ```typescript
  const SECRET_NOT_AVAILABLE = {
    error: 'not_found',
    message: 'This secret does not exist, has already been viewed, or has expired.',
  } as const;
  ```
- Global error handler in `server/src/middleware/error-handler.ts` catches unhandled errors
- Client-side crypto functions throw on validation failures (e.g., decrypt throws if auth tag fails)

## Logging

**Framework:** Pino (structured JSON logging)

**Patterns:**
- Logger instance: `server/src/middleware/logger.ts` exports `logger` and `httpLogger`
- Structured logging with objects:
  ```typescript
  logger.error({ err: { message: err.message, stack: err.stack } }, 'Unhandled error');
  ```
- HTTP logging via `pino-http` middleware
- Secret ID redaction: `redactUrl()` replaces `/api/secrets/[21-char-id]` with `/api/secrets/[REDACTED]`
- Log level via `LOG_LEVEL` env var (default: `'info'`)
- Never log: secret IDs, ciphertext, IP addresses, PII

## Comments

**When to Comment:**
- File-level JSDoc blocks describe module purpose (every module has one)
- Function-level JSDoc for public APIs and non-obvious logic:
  ```typescript
  /**
   * Atomically retrieves and destroys a secret using a three-step
   * transaction: SELECT -> ZERO ciphertext -> DELETE.
   *
   * Returns null for nonexistent, expired, already-consumed, or
   * password-protected secrets.
   */
  ```
- Inline comments for security-critical logic or non-obvious algorithms:
  ```typescript
  // Step 2: ZERO -- overwrite ciphertext with zero characters before deletion
  // PostgreSQL text columns cannot contain null bytes (\x00), so we use '0'.
  ```
- Test file headers describe coverage scope:
  ```typescript
  /**
   * Tests for the encrypt module.
   *
   * Covers: return shape, IV prepending, key/IV uniqueness,
   * padding tier verification, edge cases (empty, large, unicode).
   */
  ```

**JSDoc/TSDoc:**
- Used extensively for functions and modules
- Parameters documented with `@param` when behavior is non-obvious
- Return values documented with `@returns` for complex types
- No `@throws` tags (functions return error values or use global handler)

## Function Design

**Size:**
- Functions range 5-50 lines
- Large functions (e.g., `renderCreatePage` ~200 lines) broken into logical sections with comments

**Parameters:**
- Prefer explicit parameters over options objects for 1-3 params
- Options object for 4+ params (e.g., crypto config in `constants.ts`)
- Optional parameters typed with `?` suffix: `password?: string`
- Default values via Zod schemas (e.g., `PORT: z.coerce.number().default(3000)`)

**Return Values:**
- Explicit return types on all functions (no implicit `any`)
- Service functions return domain types or `null`:
  ```typescript
  async function retrieveAndDestroy(id: string): Promise<Secret | null>
  ```
- Discriminated unions for multi-case returns:
  ```typescript
  Promise<
    | { success: true; secret: Secret }
    | { success: false; attemptsRemaining: number }
    | null
  >
  ```
- Middleware returns `void` and uses early `return` (Express 5 pattern)

## Module Design

**Exports:**
- Named exports preferred over default exports
- Exception: external libraries requiring default import (e.g., `express`, `pino-http`)
- Crypto module (`client/src/crypto/index.ts`) re-exports public API:
  ```typescript
  export { encrypt } from './encrypt';
  export { decrypt } from './decrypt';
  ```

**Barrel Files:**
- Used sparingly -- only `client/src/crypto/index.ts` re-exports
- Shared types in `shared/types/api.ts` exports all schemas and interfaces
- Internal modules import directly (no barrel): `import { db } from '../db/connection.js'`

## TypeScript-Specific

**Type Safety:**
- `strict: true` in `tsconfig.json`
- `ZodType<T>` for generic schema types (Zod 4.x compatibility)
- Type-only imports: `import type { Request, Response, NextFunction } from 'express'`
- Explicit generic constraints: `function validateBody<T>(schema: ZodType<T>)`

**ESM Interop:**
- `"module": "ESNext"`, `"moduleResolution": "bundler"` in `tsconfig.json`
- `"type": "module"` in `package.json`
- `.js` extensions on all imports (required for ESM)
- Default import workarounds:
  ```typescript
  import pg from 'pg';
  const { Pool } = pg;
  ```

## Security-Specific Conventions

**Critical Rules:**
- Never import Web Crypto API outside `client/src/crypto/` module
- Never use `Math.random()` -- only `crypto.getRandomValues()` and `crypto.subtle`
- Never log secret IDs, ciphertext, or passwords -- use redaction middleware
- Identical error responses for not-found/expired/consumed secrets (anti-enumeration)
- Database transactions for all atomic operations (SELECT + UPDATE + DELETE)
- Zod validation on all inputs -- never trust request bodies or params

---

*Convention analysis: 2026-02-16*
