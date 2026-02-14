# Coding Conventions

**Analysis Date:** 2026-02-14

## Naming Patterns

**Files:**
- camelCase for TypeScript files: `secrets.service.ts`, `error-handler.ts`, `encoding.ts`
- kebab-case for multi-word filenames: `error-handler.ts`, `secrets.service.ts`
- Test files co-located with source: `__tests__/encoding.test.ts`, `__tests__/secrets.test.ts`
- Suffix pattern: `.test.ts` for tests, `.service.ts` for service layer

**Functions:**
- camelCase for all functions: `createSecret()`, `retrieveAndDestroy()`, `uint8ArrayToBase64Url()`
- Descriptive verb-first naming: `validateBody()`, `generateKey()`, `padPlaintext()`
- Boolean checks: `redactUrl()` (returns transformed value, not boolean)

**Variables:**
- camelCase for variables: `expiresAt`, `ciphertext`, `keyBase64Url`
- SCREAMING_SNAKE_CASE for constants: `VALID_CIPHERTEXT`, `SECRET_NOT_AVAILABLE`, `ALGORITHM`, `KEY_LENGTH`
- Descriptive naming for crypto operations: `rawKey`, `binary`, `decoded`

**Types:**
- PascalCase for interfaces and types: `EncryptResult`, `Secret`, `CreateSecretRequest`
- Schema suffix for Zod schemas: `CreateSecretSchema`, `SecretIdParamSchema`, `EnvSchema`
- Descriptive response types: `CreateSecretResponse`, `SecretResponse`, `ErrorResponse`

## Code Style

**Formatting:**
- No explicit formatter config detected (no `.prettierrc` or `.editorconfig`)
- Observed patterns: 2-space indentation, single quotes for strings, semicolons required
- Maximum line length: ~80-100 characters (observed in codebase)
- Trailing commas in multi-line objects and arrays

**Linting:**
- No `.eslintrc` detected
- TypeScript strict mode enabled in `tsconfig.json`: `"strict": true`
- Strict compiler options: `forceConsistentCasingInFileNames: true`

**TypeScript:**
- Strict mode enabled globally
- ES2022 target with ESNext modules
- Explicit `.js` extensions in imports: `import { db } from '../db/connection.js'`
- Type imports use `type` keyword: `import type { Request, Response, NextFunction }`

## Import Organization

**Order:**
1. External dependencies (node modules)
2. Internal modules (relative imports)
3. Type-only imports separated with `import type`

**Example from `server/src/routes/secrets.ts`:**
```typescript
import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { CreateSecretSchema, SecretIdParamSchema } from '../../../shared/types/api.js';
import { createSecret, retrieveAndDestroy } from '../services/secrets.service.js';
```

**Example from `server/src/middleware/validate.ts`:**
```typescript
import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
```

**Path Aliases:**
- None detected
- All imports use explicit relative paths: `../`, `../../`, `../../../shared/`
- Server imports always use `.js` extension (NodeNext module resolution)

## Error Handling

**Patterns:**
- Zod validation at API boundary in `validateBody()` and `validateParams()` middleware
- Validation errors return 400 with structured shape: `{ error: 'validation_error', details: ... }`
- Global error handler in `server/src/middleware/error-handler.ts` catches unhandled errors
- Errors logged internally but never leak stack traces to client
- Anti-enumeration: identical 404 responses for all "secret not available" cases

**Standard error response shape:**
```typescript
{
  error: 'validation_error' | 'not_found' | 'internal_error',
  message: string,
  details?: unknown // Only for validation errors
}
```

**Example from `server/src/routes/secrets.ts`:**
```typescript
const SECRET_NOT_AVAILABLE = {
  error: 'not_found',
  message: 'This secret does not exist, has already been viewed, or has expired.',
} as const;
```

## Logging

**Framework:** Pino (structured JSON logging)

**Patterns:**
- Use `logger.error()`, `logger.info()` etc. from `server/src/middleware/logger.ts`
- Structured logging: pass objects first, then message string
- Sensitive data redaction via `pino.redact()`: headers, cookies, secret IDs
- Custom serializers for request objects redact secret IDs from URLs
- Never log request/response bodies (could contain ciphertext)

**Example from `server/src/middleware/error-handler.ts`:**
```typescript
logger.error(
  { err: { message: err.message, stack: err.stack } },
  'Unhandled error',
);
```

**Redaction function:**
```typescript
function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(
    /\/api\/secrets\/[A-Za-z0-9_-]+/g,
    '/api/secrets/[REDACTED]'
  );
}
```

## Comments

**When to Comment:**
- JSDoc comments for all exported functions explaining purpose, params, returns
- Inline comments for security-critical invariants and non-obvious logic
- File-level comments describing module purpose and constraints
- Test suites organized with comment headers describing success criteria

**JSDoc/TSDoc:**
- Extensive JSDoc for public API functions
- Include `@param`, `@returns`, `@throws` tags
- Document security constraints and invariants

**Example from `client/src/crypto/keys.ts`:**
```typescript
/**
 * Generate a new 256-bit AES-GCM key and its base64url representation.
 *
 * The returned key is extractable with encrypt+decrypt usages (creator side).
 * The base64url string is suitable for embedding in a URL fragment.
 *
 * @returns Object with `key` (CryptoKey) and `keyBase64Url` (string, 43 chars)
 */
export async function generateKey(): Promise<{
  key: CryptoKey;
  keyBase64Url: string;
}> { ... }
```

**Security comments:**
```typescript
// Step 2: ZERO -- overwrite ciphertext with zero characters before deletion
// PostgreSQL text columns cannot contain null bytes (\x00), so we use '0'.
// This still mitigates data remanence in PostgreSQL WAL and shared buffers.
```

## Function Design

**Size:**
- Functions are small and focused (10-30 lines typical)
- Largest functions are ~50 lines (transaction logic in `retrieveAndDestroy()`)
- Each function has single responsibility

**Parameters:**
- Positional parameters for simple functions (2-3 max)
- Descriptive parameter names: `ciphertext`, `expiresIn`, `keyBase64Url`
- Zod schemas for request validation at API boundary
- Type-safe via TypeScript inference from Zod schemas

**Return Values:**
- Explicit return types on all exported functions
- Use `Promise<Type>` for async functions
- Return objects for multiple values: `{ key, keyBase64Url }`
- Null for "not found" cases: `Promise<Secret | null>`

## Module Design

**Exports:**
- Named exports only (no default exports)
- Barrel export pattern in `client/src/crypto/index.ts` exposes public API
- Internal utilities not re-exported (encoding, padding are implementation details)

**Example barrel export:**
```typescript
export { encrypt } from './encrypt';
export { decrypt } from './decrypt';
export { generateKey, exportKeyToBase64Url, importKeyFromBase64Url } from './keys';
export type { EncryptedPayload, EncryptResult } from './types';
```

**Barrel Files:**
- Used for crypto module: `client/src/crypto/index.ts`
- Not used elsewhere (flat structure in server)

**Module organization:**
- Thin route handlers delegate to service layer
- Services contain business logic and database operations
- Middleware for cross-cutting concerns (validation, logging, error handling)
- Shared types in `shared/types/` for client-server contract

---

*Convention analysis: 2026-02-14*
