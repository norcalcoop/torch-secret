# Coding Conventions

**Analysis Date:** 2026-03-01

## Naming Patterns

**Files:**
- Kebab-case for all files: `secrets.service.ts`, `rate-limit.ts`, `password-generator.test.ts`
- Directories use kebab-case: `crypto/`, `__tests__/`, `middleware/`
- Service files follow pattern: `{domain}.service.ts` (e.g., `secrets.service.ts`, `password.service.ts`)
- Test directories use `__tests__/` (co-located with source) or inline `*.test.ts` suffix

**Functions:**
- camelCase: `createSecret()`, `verifyAndRetrieve()`, `hashPassword()`, `validateBody()`
- Async functions return `Promise<T>`: `async function createSecret(...): Promise<Secret>`
- Factory functions prefixed with `build`: `buildApp()`, `buildRouter()` (not `create`)
- Middleware factories return `(req, res, next) => void`: `validateBody(schema)` returns middleware

**Variables:**
- camelCase for all variables: `redisClient`, `passwordHash`, `expiresAt`, `isAuthenticated`
- Constants in UPPER_SNAKE_CASE: `MAX_PASSWORD_ATTEMPTS`, `DURATION_MS`, `ARGON2_OPTIONS`, `IV_LENGTH`
- Unused parameters prefixed with `_`: `(_req: Request, _next: NextFunction)`
- Session/local storage use camelCase keys: `res.locals.user`, `sessionCookie`

**Types:**
- PascalCase for interfaces and types: `CreateSecretRequest`, `SessionUser`, `AuthUser`, `ApiError`
- Zod schemas follow request naming: `CreateSecretSchema`, `SecretIdParamSchema`, `VerifySecretSchema`
- Response types suffix with "Response": `CreateSecretResponse`, `SecretResponse`, `VerifySecretResponse`
- Error/meta response types suffix with "Response": `ErrorResponse`, `MetaResponse`

## Code Style

**Formatting:**
- Tool: Prettier 3.x with `prettier-plugin-tailwindcss`
- Print width: 100 characters
- Tabs: 2 spaces
- Trailing commas: `all` (comma after last list item)
- Single quotes: enabled (`'string'` not `"string"`)
- Semicolons: enabled

**Linting:**
- Tool: ESLint 10.x with `typescript-eslint` v8+
- Config: `eslint.config.ts` (flat config format, ESLint v10+)
- Key rules:
  - `@typescript-eslint/no-unused-vars`: error, allows `_` prefix for intentional params
  - Recommended TypeScript checks: `@typescript-eslint/recommended-type-checked`
  - Test files relax unsafe type rules (`no-unsafe-assignment`, `no-unsafe-member-access`, `unbound-method`)
  - Config files disable type checking

**Pre-commit Hooks:**
- Tool: Husky + lint-staged
- Staged file checks:
  - `*.{ts,js,mjs,cjs}`: `eslint --fix` then `prettier --write`
  - `*.{json,css,md,html}`: `prettier --write` only

## Import Organization

**Order (strictly enforced by linting):**
1. Node.js built-ins: `import { readFileSync } from 'node:fs'`
2. Third-party dependencies: `import express from 'express'`
3. Type imports: `import type { Express } from 'express'` (separate `type` keyword)
4. Local module imports: `import { buildApp } from './app.js'`
5. Relative imports: `import { createIcon } from '../components/icons.js'`

**Path Aliases:**
- No path aliases configured (imports use relative paths with `../` or explicit `./`)
- All imports must include `.js` extension for ESM compatibility (Node 20+ NodeNext resolution)

**Module Exports:**
- Named exports for utilities: `export function validateBody<T>(schema: ZodType<T>)`
- Default exports for page renderers: `export function renderCreatePage(container: HTMLElement)`
- Type exports use `export type`: `export type CreateSecretRequest = z.infer<typeof CreateSecretSchema>`
- Barrel files combine related exports: `/crypto/index.ts` re-exports `encrypt`, `decrypt`, `generatePassphrase`

## Error Handling

**Patterns:**
- Custom error class `ApiError` with status, body, and optional `rateLimitReset` field
- Global error handler catches unhandled errors: `server/src/middleware/error-handler.ts`
- Error responses follow standard shape: `{ error: 'error_code', message?: 'human-readable' }`
- Validation errors use `{ error: 'validation_error', details: ZodError.flatten() }`
- Identical error response for all "not found" cases (no enumeration leakage): `{ error: 'not_found', message: 'This secret does not exist, has already been viewed, or has expired.' }`
- Password verification errors: `{ error: 'wrong_password', attemptsRemaining: number }`
- Async operations in try-catch with meaningful error logging (NOT client-facing details)

**Security Notes:**
- Server never logs request details that could contain secret IDs (see logger.ts redaction)
- Error responses never leak stack traces to the client
- Status codes are meaningful but don't reveal internal state (429 for rate limit, not 403)

## Logging

**Framework:** Pino 10.x with `pino-http`

**Patterns:**
- Logger instance: `export const logger = pino({ ... })` in `server/src/middleware/logger.ts`
- HTTP request logging via `pinoHttp` middleware with request/response serialization
- Secret IDs redacted via regex: `/\/api\/secrets\/[A-Za-z0-9_-]+/g` → `/api/secrets/[REDACTED]`
- Dashboard secrets also redacted: `/\/api\/dashboard\/secrets\/[A-Za-z0-9_-]+/g`
- Sensitive headers redacted: `authorization`, `cookie`, `set-cookie`
- Request/response bodies NOT logged (prevents ciphertext leakage)
- Error logging: `logger.error({ err: { message, stack } }, 'Unhandled error')`

**When to Log:**
- Health checks: database connectivity, uptime
- Route entry/exit: method, redacted URL, status code (handled by pino-http)
- Errors with internal context: message and stack only
- Never: secret IDs, plaintext, ciphertext, user IPs, PII

## Comments

**When to Comment:**
- Explain *why*, not *what* (code explains what)
- Document security invariants: "SECR-07 — prevent enumeration attacks"
- Explain non-obvious algorithm choices: "PADME padding — max 12% overhead"
- Middleware order dependency: "cspNonce MUST run before helmet so nonce is available"
- Phase references: "Phase 26: Mock notification service to avoid real HTTP calls"
- Database transaction invariants: "Atomic 3-step transaction: SELECT → zero ciphertext → DELETE"

**JSDoc/TSDoc:**
- Function-level JSDoc for public API functions:
  ```typescript
  /**
   * Atomically retrieves and destroys a secret using a three-step
   * transaction: SELECT -> ZERO ciphertext -> DELETE (anonymous) or
   * UPDATE status='viewed' (user-owned).
   *
   * @param id - The 21-character secret ID (nanoid)
   * @returns Secret object or null if unavailable
   */
  export async function retrieveAndDestroy(id: string): Promise<Secret | null>
  ```
- Parameter descriptions for non-obvious fields
- Return type documentation
- No JSDoc on trivial getters/setters

## Function Design

**Size:**
- Target: < 50 lines per function (exception: route handlers with complex middleware ordering)
- Break long functions into smaller named helpers
- Route handlers document middleware order in comments

**Parameters:**
- Type all parameters (no implicit `any`)
- Destructure objects instead of positional params: `{ ciphertext, expiresIn }`
- Optional params use `?` and `undefined` defaults, not overloading
- Async functions always return `Promise<T>`, never `undefined` (use `Promise<T | null>` for optional results)

**Return Values:**
- Explicit return type annotation on all functions
- Use `void` for functions that don't return (middleware, handlers)
- Use `Promise<T | null>` to indicate a value might not exist: `Promise<Secret | null>`
- Throw errors rather than return error objects (service layer convention)

## Module Design

**Exports:**
- Services export functions, not classes: `export function createSecret()`
- Middleware exports factory functions: `export function validateBody<T>(schema: ZodType<T>)`
- Pages/components export a single default render function: `export function renderCreatePage()`
- Types always exported as `export type` (separate from runtime exports)

**Barrel Files:**
- Client crypto module uses barrel: `client/src/crypto/index.ts` re-exports `encrypt`, `decrypt`, `generatePassphrase`
- Reduces import paths: `import { encrypt } from '../crypto/'` (not `../crypto/encrypt.js`)
- Tests import directly from module to avoid re-export indirection

**Database Schema:**
- Drizzle ORM table definitions: `server/src/db/schema.ts`
- All tables exported as named exports: `export const secrets`, `export const users`
- Type inference from Drizzle: `type Secret = typeof secrets.$inferSelect`

**Middleware:**
- Each middleware is a separate file in `server/src/middleware/`
- Middleware factories accept config and return Express middleware: `(req, res, next) => void`
- Middleware order is critical; documented in `app.ts` with numbered comments

## Type Safety Patterns

**Zod for Runtime Validation:**
- All request bodies validated with Zod schemas: `CreateSecretSchema`, `VerifySecretSchema`
- Type inference from schemas: `type CreateSecretRequest = z.infer<typeof CreateSecretSchema>`
- Middleware validates and replaces `req.body`: `req.body = result.data` (now type-safe)
- Params validation: `validateParams(SecretIdParamSchema)` for route `:id` validation

**Better Auth Type Guards:**
- `getSession()` returns `any`; narrow with type guard to avoid unsafe member access
- Session user typed as `SessionUser` interface before access
- Example from secrets routes: `const user = res.locals.user as AuthUser | undefined`

**CryptoKey Constraints:**
- Imported keys are non-extractable: `extractable: false`
- Decrypt-only keys: algorithm set in `importKey()` but usage limited to `'decrypt'`
- Prevents key material from being read back from CryptoKey

## Zero-Knowledge Invariant (Mandatory Convention)

**Read `.planning/INVARIANTS.md` before modifying database, logs, or analytics.**

The zero-knowledge security model requires strict separation:
- **Rule:** No database record, log line, or analytics event may contain both `userId` AND `secretId`
- **Enforcement in code:**
  - `secrets.user_id` is nullable FK; `users` table never stores secret IDs
  - Logger redacts secret IDs via regex (see `logger.ts`)
  - `ApiClient` sanitizes URL fragments before analytics events (Phase 25+)

See `.planning/INVARIANTS.md` for complete enforcement table and extension protocol.

---

*Convention analysis: 2026-03-01*
