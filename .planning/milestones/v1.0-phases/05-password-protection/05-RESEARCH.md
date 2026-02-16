# Phase 5: Password Protection - Research

**Researched:** 2026-02-14
**Domain:** Server-side password hashing (Argon2id), attempt-limited verification, frontend password entry flow
**Confidence:** HIGH

## Summary

Phase 5 adds an optional password protection layer to secrets. The sender provides a password during creation, the server hashes it with Argon2id and stores the hash. When a recipient opens a password-protected secret, the frontend detects the protection via a new metadata endpoint, shows a password entry form with attempt count, and submits the password for server-side verification. After 3 failed attempts, the secret is atomically destroyed.

The existing codebase is well-prepared for this phase: the `secrets` table already has `passwordHash` (nullable text) and `passwordAttempts` (integer, default 0) columns from Phase 2. The `argon2` npm package (v0.44.0) provides Argon2id hashing with built-in constant-time comparison via `crypto.timingSafeEqual` in its `verify()` function. Two new API endpoints (`GET /api/secrets/:id/meta` and `POST /api/secrets/:id/verify`) are already specified in the project architecture.

**Primary recommendation:** Use `argon2` npm package v0.44.0 with OWASP-recommended Argon2id parameters (memoryCost: 19456, timeCost: 2, parallelism: 1). The `argon2.verify()` function handles constant-time comparison internally -- no additional `timingSafeEqual` wrappers needed. Atomic password attempt incrementing uses Drizzle's `sql` template literal for database-level atomicity.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| argon2 | 0.44.0 | Server-side password hashing (Argon2id) | OWASP-recommended algorithm; built-in TypeScript types; uses `timingSafeEqual` in verify; prebuilt native binaries |
| zod | 4.x (existing) | Request body validation for password field | Already used throughout the project |
| drizzle-orm | 0.45.x (existing) | Atomic password attempt updates | Already used; `sql` template literals enable atomic increment |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | 8.x (existing) | Rate limiting on verify endpoint | Already installed; create separate limiter for password verification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| argon2 (native bindings) | @node-rs/argon2 (Rust/NAPI) | node-rs has less community adoption (v2.0.2, last published 1+ year ago); argon2 has 565+ dependents and active maintenance |
| argon2 | bcrypt | bcrypt has 72-byte input limit, no memory-hardness; Argon2id is the OWASP-recommended standard for new implementations |

**Installation:**
```bash
npm install argon2
```

No `@types/argon2` needed -- TypeScript declarations are bundled with the package.

## Architecture Patterns

### Modified Project Structure
```
server/src/
├── services/
│   ├── secrets.service.ts    # Add: createSecret with password, verifyAndRetrieve, incrementAttempts, destroySecret
│   └── password.service.ts   # NEW: hashPassword, verifyPassword (thin wrapper around argon2)
├── routes/
│   └── secrets.ts            # Add: GET /:id/meta, POST /:id/verify endpoints
shared/types/
└── api.ts                    # Add: CreateSecretSchema gains optional password, new MetaResponse, VerifyRequest schemas
client/src/
├── api/
│   └── client.ts             # Add: getSecretMeta, verifyPassword API functions
└── pages/
    └── reveal.ts             # Modify: password entry flow before reveal
```

### Pattern 1: Password Hashing Service (Thin Wrapper)
**What:** Isolate argon2 calls behind a simple service so the hashing library is swappable and testable.
**When to use:** Any time a password is hashed or verified.
**Example:**
```typescript
// server/src/services/password.service.ts
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,  // 19 MiB (OWASP minimum)
  timeCost: 2,         // 2 iterations (OWASP minimum)
  parallelism: 1,      // 1 thread (OWASP recommendation)
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  // argon2.verify uses crypto.timingSafeEqual internally
  return argon2.verify(hash, password);
}
```

### Pattern 2: Atomic Attempt Increment with Conditional Destroy
**What:** Use a database transaction to atomically read attempt count, increment it, and destroy if threshold reached -- preventing race conditions on concurrent password guesses.
**When to use:** Every password verification attempt.
**Example:**
```typescript
// Inside secrets.service.ts
import { eq, sql } from 'drizzle-orm';

const MAX_PASSWORD_ATTEMPTS = 3;

export async function verifyAndRetrieve(
  id: string,
  password: string,
): Promise<{ success: true; secret: Secret } | { success: false; attemptsRemaining: number } | null> {
  return db.transaction(async (tx) => {
    // Step 1: SELECT the secret
    const [secret] = await tx
      .select()
      .from(secrets)
      .where(eq(secrets.id, id));

    if (!secret || !secret.passwordHash) {
      return null; // Not found or not password-protected
    }

    // Step 2: Verify password (constant-time via argon2.verify)
    const isValid = await verifyPassword(secret.passwordHash, password);

    if (isValid) {
      // Step 3a: Password correct -- do atomic retrieve-and-destroy
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
        .where(eq(secrets.id, id));
      await tx.delete(secrets).where(eq(secrets.id, id));
      return { success: true, secret };
    }

    // Step 3b: Password wrong -- atomically increment attempts
    const newAttempts = secret.passwordAttempts + 1;

    if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
      // Auto-destroy: zero ciphertext then delete
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
        .where(eq(secrets.id, id));
      await tx.delete(secrets).where(eq(secrets.id, id));
      return { success: false, attemptsRemaining: 0 };
    }

    // Increment attempt counter
    await tx
      .update(secrets)
      .set({ passwordAttempts: sql`${secrets.passwordAttempts} + 1` })
      .where(eq(secrets.id, id));

    return { success: false, attemptsRemaining: MAX_PASSWORD_ATTEMPTS - newAttempts };
  });
}
```

### Pattern 3: Metadata Endpoint (Non-Destructive Check)
**What:** A new `GET /api/secrets/:id/meta` endpoint that returns whether a secret exists and if it requires a password, WITHOUT consuming the secret.
**When to use:** Before showing reveal/password UI to the recipient.
**Example:**
```typescript
// Route handler
router.get('/:id/meta', validateParams(SecretIdParamSchema), async (req, res) => {
  const meta = await getSecretMeta(req.params.id as string);
  if (!meta) {
    res.status(404).json(SECRET_NOT_AVAILABLE);
    return;
  }
  res.status(200).json({
    requiresPassword: meta.requiresPassword,
    passwordAttemptsRemaining: meta.passwordAttemptsRemaining,
  });
});
```

### Pattern 4: Frontend Password Entry Flow
**What:** Modify the reveal page to check metadata first. If password-protected, show a password form with attempt counter before the "Reveal Secret" interstitial.
**When to use:** When the reveal page loads and the secret requires a password.
**Flow:**
```
1. User arrives at /secret/:id#key
2. Extract key from fragment, strip fragment
3. Call GET /api/secrets/:id/meta
4. If requiresPassword:
   a. Show password form with "X attempts remaining"
   b. On submit: POST /api/secrets/:id/verify with { password }
   c. On success: receive ciphertext, decrypt, show revealed secret
   d. On wrong password: update attempts remaining, show error
   e. On 0 attempts: show "secret destroyed" error
5. If !requiresPassword:
   a. Show existing "Click to Reveal" interstitial (existing flow)
   b. On click: GET /api/secrets/:id (existing flow)
```

### Anti-Patterns to Avoid
- **Client-side password hashing:** The password MUST be sent as plaintext over HTTPS and hashed server-side with Argon2id. Client-side hashing provides no security benefit (the hash becomes the password) and wastes client CPU.
- **Separate read-then-check queries:** NEVER fetch the secret, then check the password in a separate request. The password check and data retrieval must be in a single transaction.
- **Exposing attempt count in non-password-protected secrets:** The `GET /:id/meta` endpoint should only return `passwordAttemptsRemaining` when `requiresPassword` is true.
- **Different error responses for different failure reasons:** The verify endpoint should return the same 404 for "not found", "expired", and "destroyed by max attempts" -- only distinguish "wrong password with N attempts remaining" (which requires a 403 status code with attempt info).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom Argon2 bindings or bcrypt wrapper | `argon2` npm package | Built-in salt generation, TypeScript types, `timingSafeEqual` in verify, OWASP-compliant defaults |
| Constant-time comparison | Manual `crypto.timingSafeEqual` wrapper | `argon2.verify()` | Already uses `timingSafeEqual` internally -- wrapping it again adds no security benefit |
| Attempt counting | Application-level counter with in-memory state | PostgreSQL `passwordAttempts` column with atomic SQL increment | Database-level atomicity survives server restarts; `sql` template literal prevents race conditions |

**Key insight:** The `argon2` npm package handles all the crypto-level complexity (salt generation, constant-time comparison, PHC string format). The implementation work is primarily in the API endpoints, service layer, and frontend UI -- not in cryptography.

## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Password Attempts
**What goes wrong:** Two simultaneous wrong-password requests each read `passwordAttempts = 2`, both increment to 3, but neither triggers destruction because they each see "only 1 new attempt".
**Why it happens:** SELECT then UPDATE without transaction isolation.
**How to avoid:** Use a database transaction. The SELECT + UPDATE within a PostgreSQL transaction ensures serialization. Use `sql\`${secrets.passwordAttempts} + 1\`` for the atomic increment (not application-level `attempts + 1`).
**Warning signs:** Tests that test concurrent requests and see different behavior from sequential ones.

### Pitfall 2: Information Leakage via Error Response Differentiation
**What goes wrong:** Returning different error messages/status codes for "not found" vs "expired" vs "destroyed by max attempts" allows attackers to enumerate valid secret IDs.
**Why it happens:** Different `if` branches returning different responses.
**How to avoid:** For the `meta` and `verify` endpoints, return identical 404 responses when the secret doesn't exist for ANY reason. The ONLY exception: when a password-protected secret exists and the wrong password is given, return 403 with `attemptsRemaining` (this is safe because the attacker already knows the secret exists from the meta endpoint).
**Warning signs:** Test that creates a secret, exhausts its password attempts, then verifies the 404 response matches a nonexistent secret.

### Pitfall 3: Forgetting to Update CreateSecretSchema
**What goes wrong:** The `POST /api/secrets` endpoint accepts a `password` field but the Zod schema doesn't validate it, so it gets silently stripped.
**Why it happens:** Zod strips unknown fields by default.
**How to avoid:** Add `password: z.string().min(1).max(128).optional()` to `CreateSecretSchema` in `shared/types/api.ts`.
**Warning signs:** Secret creation succeeds but `passwordHash` is always null in the database.

### Pitfall 4: Argon2 Native Binary Compilation Failure
**What goes wrong:** `npm install argon2` fails because native binaries can't be built (no C compiler, wrong Node.js ABI).
**Why it happens:** argon2 has prebuilt binaries but they may not match the exact platform.
**How to avoid:** argon2 v0.26.0+ ships prebuilt binaries for common platforms (linux-x64, darwin-arm64, darwin-x64, win32-x64). Verify installation succeeds in CI. Node.js >= 18 is required (project uses Node 24, so this is fine).
**Warning signs:** `npm install` shows native compilation warnings.

### Pitfall 5: Blocking Event Loop with Argon2
**What goes wrong:** Argon2 hashing is CPU-intensive (especially with high memory/iteration settings) and blocks the Node.js event loop.
**Why it happens:** Misconfigured parameters (too-high memoryCost or timeCost).
**How to avoid:** The `argon2` npm package runs hashing in a separate thread pool (via N-API worker threads), so it does NOT block the event loop. With OWASP minimum parameters (19 MiB, t=2, p=1), each hash takes ~200-500ms but runs off the main thread. No special handling needed.
**Warning signs:** Response times spike during password verification.

### Pitfall 6: Meta Endpoint Enabling Enumeration of Unprotected Secrets
**What goes wrong:** An attacker can call `GET /api/secrets/:id/meta` on random IDs to discover which IDs have valid secrets, even if not password-protected.
**Why it happens:** The meta endpoint returns 200 for existing secrets and 404 for nonexistent ones.
**How to avoid:** This is an acceptable trade-off -- the existing `GET /api/secrets/:id` already leaks this information (200 vs 404). The meta endpoint does NOT consume the secret, so it's no worse than the status quo. However, consider rate-limiting the meta endpoint to prevent rapid enumeration.
**Warning signs:** High-volume meta requests from a single IP.

## Code Examples

Verified patterns from official sources:

### Argon2id Hashing with OWASP Parameters
```typescript
// Source: https://github.com/ranisalt/node-argon2 + OWASP Password Storage Cheat Sheet
import argon2 from 'argon2';

// OWASP minimum: m=19456 (19 MiB), t=2, p=1
const hash = await argon2.hash('userPassword', {
  type: argon2.argon2id,
  memoryCost: 19_456,  // KiB
  timeCost: 2,
  parallelism: 1,
});
// Returns PHC string: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>

const isValid = await argon2.verify(hash, 'userPassword');
// true -- uses crypto.timingSafeEqual internally
```

### Atomic Increment with Drizzle ORM
```typescript
// Source: https://orm.drizzle.team/docs/guides/incrementing-a-value
import { sql, eq, type AnyColumn } from 'drizzle-orm';

// Atomic increment helper
const increment = (column: AnyColumn, value = 1) => {
  return sql`${column} + ${value}`;
};

// Usage in transaction
await tx
  .update(secrets)
  .set({ passwordAttempts: increment(secrets.passwordAttempts) })
  .where(eq(secrets.id, id));
```

### Zod Schema Extension for Password
```typescript
// Extend existing CreateSecretSchema
export const CreateSecretSchema = z.object({
  ciphertext: z.string().min(1).max(200_000),
  expiresIn: z.enum(['1h', '24h', '7d', '30d']),
  password: z.string().min(1).max(128).optional(),
});

// New schemas for Phase 5 endpoints
export const VerifyPasswordSchema = z.object({
  password: z.string().min(1).max(128),
});

export interface SecretMetaResponse {
  requiresPassword: boolean;
  passwordAttemptsRemaining?: number;
}

export interface VerifyResponse {
  ciphertext: string;
  expiresAt: string;
}

export interface VerifyErrorResponse {
  error: 'wrong_password';
  attemptsRemaining: number;
}
```

### API Client Extensions
```typescript
// client/src/api/client.ts additions

export async function getSecretMeta(id: string): Promise<SecretMetaResponse> {
  const res = await fetch(`/api/secrets/${id}/meta`);
  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }
  return res.json() as Promise<SecretMetaResponse>;
}

export async function verifySecretPassword(
  id: string,
  password: string,
): Promise<VerifyResponse> {
  const res = await fetch(`/api/secrets/${id}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.json());
  }
  return res.json() as Promise<VerifyResponse>;
}
```

### Create Secret with Optional Password (Service Layer)
```typescript
// Modified createSecret in secrets.service.ts
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
  password?: string,
): Promise<Secret> {
  const expiresAt = new Date(Date.now() + DURATION_MS[expiresIn]);
  const passwordHash = password ? await hashPassword(password) : null;

  const [inserted] = await db
    .insert(secrets)
    .values({ ciphertext, expiresAt, passwordHash })
    .returning();

  return inserted;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt with 72-byte limit | Argon2id (no input length limit) | OWASP 2023+ recommendation | Argon2id is memory-hard; bcrypt is compute-hard only |
| Manual salt generation | Argon2 auto-generates 16-byte random salt | Always (in argon2 package) | Salt handling is automatic; stored in PHC string format |
| Separate verify + timingSafeEqual | argon2.verify() with built-in timingSafeEqual | node-argon2 implementation | No manual constant-time comparison needed |
| Custom password storage format | PHC string format ($argon2id$v=...) | Industry standard | Self-describing; includes algorithm, params, salt, and hash in one string |

**Deprecated/outdated:**
- **bcrypt for new projects:** While still secure, OWASP recommends Argon2id for all new implementations. bcrypt's 72-byte input limit and lack of memory-hardness make it the inferior choice.
- **Manual salt management:** The `argon2` package handles salt generation and storage automatically via the PHC string format. Do not generate or store salts separately.

## Open Questions

1. **Rate limiting on verify endpoint**
   - What we know: The verify endpoint accepts passwords and should be rate-limited to prevent brute-force attacks beyond the 3-attempt auto-destroy.
   - What's unclear: Whether to use the same rate limiter as POST /api/secrets or create a separate one with different parameters.
   - Recommendation: Create a separate rate limiter for `POST /api/secrets/:id/verify` with stricter limits (e.g., 10 attempts per 15 minutes per IP across all secrets). This is defense-in-depth on top of the per-secret 3-attempt limit.

2. **Password length limits**
   - What we know: Argon2id has no inherent input length limit (unlike bcrypt's 72 bytes).
   - What's unclear: Whether to impose a maximum password length for UX/DoS prevention.
   - Recommendation: Use `z.string().min(1).max(128)` -- generous enough for any reasonable password/passphrase, short enough to prevent abuse.

3. **Existing GET /api/secrets/:id behavior for password-protected secrets**
   - What we know: Currently, `GET /api/secrets/:id` returns ciphertext and atomically deletes. If a secret has a password, calling GET directly should NOT return the ciphertext.
   - What's unclear: Whether to modify the existing GET endpoint or rely on the frontend always calling meta first.
   - Recommendation: Modify `retrieveAndDestroy` to check if `passwordHash` is non-null. If so, return null (same as not-found) to prevent bypassing password protection via direct API call. This is a critical security invariant.

4. **Confirmation page for password-protected secrets**
   - What we know: The create confirmation page shows the share URL. For password-protected secrets, the sender needs to know the recipient will be prompted for a password.
   - What's unclear: Exact wording and whether to show password requirements.
   - Recommendation: Add a visual indicator on the confirmation page (e.g., lock icon + "Password-protected" badge) when a password was set. Do NOT show the password itself.

## Sources

### Primary (HIGH confidence)
- [node-argon2 GitHub](https://github.com/ranisalt/node-argon2) - API reference, options, verify implementation confirming `timingSafeEqual` usage
- [node-argon2 Wiki: Options](https://github.com/ranisalt/node-argon2/wiki/Options) - Default values: memoryCost=65536, timeCost=3, parallelism=4, hashLength=32
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) - Recommended Argon2id parameters: m=19456, t=2, p=1 (minimum) or m=47104, t=1, p=1
- [Drizzle ORM: Incrementing a Value](https://orm.drizzle.team/docs/guides/incrementing-a-value) - Atomic increment with `sql` template literal
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html) - Constant-time Buffer comparison

### Secondary (MEDIUM confidence)
- [argon2 npm registry](https://www.npmjs.com/package/argon2) - Version 0.44.0, 565+ dependents, Node >= 18 required
- [OWASP Password Hashing Comparison](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) - Argon2id vs bcrypt vs scrypt comparison

### Tertiary (LOW confidence)
- None -- all critical claims verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - argon2 npm package is well-documented, actively maintained, and OWASP-recommended. API verified against source code.
- Architecture: HIGH - Patterns follow existing codebase conventions (Drizzle transactions, Express route factory, Zod validation). New endpoints match the architecture specified in CLAUDE.md.
- Pitfalls: HIGH - Race conditions in concurrent password attempts are a well-documented database pattern. The argon2 verify source code was read directly to confirm timingSafeEqual usage.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain; argon2 and OWASP recommendations change infrequently)
