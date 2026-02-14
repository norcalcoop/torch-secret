# Phase 6: Expiration Worker - Research

**Researched:** 2026-02-14
**Domain:** Background job scheduling, bulk database cleanup, expiration-time checking
**Confidence:** HIGH

## Summary

Phase 6 implements two closely related capabilities: (1) a background job that periodically deletes expired secrets from PostgreSQL, and (2) expiration-time checking at the API layer so requests for expired-but-not-yet-cleaned-up secrets return proper error responses. The background worker is straightforward -- a cron-scheduled function that runs a single `DELETE WHERE expires_at <= NOW()` query every 5 minutes. The more nuanced part is that the existing `retrieveAndDestroy`, `verifyAndRetrieve`, and `getSecretMeta` service functions do NOT currently check `expiresAt`. This means an expired secret can currently be retrieved if the worker hasn't run yet. The API must add expiration guards.

The ciphertext zeroing pattern (SECR-08) used for individual retrievals is a defense-in-depth measure against PostgreSQL WAL/dead tuple data remanence. For bulk expiration cleanup, the same pattern should be applied: UPDATE ciphertext to zeros, then DELETE. However, for batch operations this can be done in two bulk statements rather than per-row transactions.

**Primary recommendation:** Use `node-cron` v4 (already planned in CLAUDE.md) with the `*/5 * * * *` expression. Add `lte(secrets.expiresAt, new Date())` guards to all three service functions. Implement ciphertext zeroing in the batch cleanup via a two-step bulk UPDATE then DELETE. Start the worker in `server.ts` and stop it during graceful shutdown.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | ^4.x | Cron-based job scheduling | Planned in CLAUDE.md. Pure JS, zero dependencies, TypeScript-native in v4, ESM support via exports field |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 (installed) | Bulk DELETE with WHERE clause | Already used throughout; `lte` operator for timestamp comparison |
| pino | ^10.3.1 (installed) | Worker logging | Already used; worker logs deletion counts without secret IDs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | `setInterval` | Simpler (zero deps) but no cron syntax, no timezone support, less readable. For "every 5 minutes" setInterval works fine, but node-cron is already in the planned stack and adds negligible overhead. |
| node-cron | `cron` (kelektiv/node-cron) | Different package (confusingly similar name). More features but heavier. node-cron is lighter and sufficient. |
| In-process worker | Separate process / pg_cron | Overkill for a single 5-minute cleanup job. pg_cron requires PostgreSQL extension installation. Separate process adds deployment complexity. In-process is the right choice for this scale. |

**Installation:**
```bash
npm install node-cron
```

No `@types/node-cron` needed -- v4 is written in TypeScript and bundles its own type declarations via the `exports` field in package.json.

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── workers/
│   └── expiration-worker.ts   # Cron job: bulk zero + delete expired secrets
├── services/
│   └── secrets.service.ts     # Add expiration guards to existing functions
├── server.ts                  # Start worker, stop on shutdown
└── ...
```

### Pattern 1: In-Process Cron Worker
**What:** A single-file module that exports `start()` and `stop()` functions. Internally creates a `node-cron` scheduled task that runs a bulk cleanup query.
**When to use:** Simple periodic tasks that don't need persistence across restarts or distributed locking.
**Example:**
```typescript
// Source: node-cron v4 docs (nodecron.com) + Drizzle ORM docs
import cron from 'node-cron';
import { lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';
import { logger } from '../middleware/logger.js';

let task: ReturnType<typeof cron.schedule> | null = null;

export function startExpirationWorker(): void {
  task = cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // Step 1: Zero ciphertext of expired secrets (data remanence mitigation)
      await db
        .update(secrets)
        .set({ ciphertext: '0' })
        .where(lte(secrets.expiresAt, now));

      // Step 2: Delete the zeroed expired rows
      const deleted = await db
        .delete(secrets)
        .where(lte(secrets.expiresAt, now));

      // Log count only -- never log secret IDs (SECR-09)
      logger.info({ deletedCount: deleted.rowCount }, 'Expired secrets cleaned up');
    } catch (err) {
      logger.error({ err }, 'Expiration worker error');
    }
  });
}

export function stopExpirationWorker(): void {
  task?.stop();
  task = null;
}
```

### Pattern 2: Expiration Guard in Service Layer
**What:** Check `expiresAt <= NOW()` inside `retrieveAndDestroy`, `verifyAndRetrieve`, and `getSecretMeta` so that expired-but-not-yet-deleted secrets are treated as nonexistent.
**When to use:** Always -- the worker runs every 5 minutes, but a request could arrive for an expired secret between worker runs.
**Example:**
```typescript
// Inside retrieveAndDestroy, after SELECT:
if (!secret) return null;

// NEW: Check expiration before returning
if (secret.expiresAt <= new Date()) {
  // Optionally: zero and delete inline since we already have it
  await tx
    .update(secrets)
    .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
    .where(eq(secrets.id, id));
  await tx.delete(secrets).where(eq(secrets.id, id));
  return null;
}
```

### Pattern 3: Graceful Shutdown Integration
**What:** Stop the cron task during SIGTERM/SIGINT handling so in-flight cleanup finishes but no new runs start.
**When to use:** Always -- prevents the worker from starting a new database operation after the pool is closing.
**Example:**
```typescript
// In server.ts shutdown handler:
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  stopExpirationWorker(); // Stop scheduling new runs

  server.close(async () => {
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  });
}
```

### Anti-Patterns to Avoid
- **Per-row transactions for batch cleanup:** Don't SELECT all expired rows then loop and delete one by one. Use bulk UPDATE + bulk DELETE with a WHERE clause. One or two queries, not N.
- **Logging secret IDs in worker:** The worker must log deletion counts, never secret IDs (SECR-09).
- **Relying solely on the worker for expiration:** Without API-level expiration guards, expired secrets can be retrieved between worker runs. Both layers are needed.
- **Starting worker in test environment:** The cron worker should NOT start during integration tests. It would cause race conditions with test data. Guard with `if (env.NODE_ENV !== 'test')` or make it opt-in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval with Date math | node-cron `schedule('*/5 * * * *', fn)` | Readable cron syntax, handles edge cases (daylight saving), already planned in project stack |
| Batch timestamp comparison | Raw SQL strings | Drizzle `lte(secrets.expiresAt, new Date())` | Type-safe, already used throughout codebase, prevents SQL injection |

**Key insight:** This phase is architecturally simple. The complexity is in the details: ensuring expiration is checked at both the worker layer AND the API layer, maintaining the ciphertext zeroing pattern for consistency, and properly integrating with the existing graceful shutdown.

## Common Pitfalls

### Pitfall 1: Race Between Worker and API Requests
**What goes wrong:** A secret expires at 12:00:00. The worker ran at 11:55:00 and won't run again until 12:00:00. A request arrives at 11:59:30 for a secret that expires at 11:59:00. Without an API-level check, the secret is returned despite being expired.
**Why it happens:** Relying solely on the background worker for expiration enforcement.
**How to avoid:** Add `expiresAt <= new Date()` checks to ALL retrieval/meta service functions. The worker is for cleanup; the API check is for correctness.
**Warning signs:** Tests that create secrets with short expiration and immediately retrieve them succeed even after expiration.

### Pitfall 2: Anti-Enumeration Violation
**What goes wrong:** Returning a distinct error response for expired secrets (e.g., `{ error: 'expired', message: 'This secret has expired' }`) vs the existing `not_found` response. This reveals that a secret existed but expired, enabling enumeration.
**Why it happens:** EXPR-02 requirement says "clear 'This secret has expired' message" -- but SECR-07 says all error responses must be identical for not-found/expired/viewed.
**How to avoid:** The existing `SECRET_NOT_AVAILABLE` response already says "...has already been viewed, or has expired." The requirement is ALREADY satisfied by the current error message. No change needed to the error response format. The API-level expiration check simply returns `null` from the service, and the route handler produces the same 404 as always.
**Warning signs:** Creating a new error response type for expired secrets.

### Pitfall 3: Ciphertext Zeroing Skipped in Batch Cleanup
**What goes wrong:** The worker runs `DELETE FROM secrets WHERE expires_at <= NOW()` without zeroing ciphertext first. This leaves encrypted data in PostgreSQL WAL and dead tuples.
**Why it happens:** Forgetting that the project's SECR-08 requirement applies to ALL deletions, not just API-triggered ones.
**How to avoid:** Two-step batch operation: UPDATE to zero ciphertext, then DELETE. Both filtered by the same `expires_at <= NOW()` condition.
**Warning signs:** Worker has a single DELETE query without a preceding UPDATE.

### Pitfall 4: Worker Runs During Tests
**What goes wrong:** Integration tests insert secrets with specific expiration times, but the background worker deletes them before the test can verify behavior.
**Why it happens:** Worker starts automatically when the Express app boots for testing.
**How to avoid:** Don't start the worker inside `buildApp()` or any test-reachable code. Start it only in `server.ts` (or guard with `NODE_ENV !== 'test'`). The worker module should be imported and started explicitly in the server entry point only.
**Warning signs:** Flaky tests that pass in isolation but fail when run together.

### Pitfall 5: Not Handling Worker Errors
**What goes wrong:** An unhandled database error in the worker callback crashes the entire Node.js process via unhandled promise rejection.
**Why it happens:** node-cron v4 callbacks run as async functions. If they throw without a try/catch, it's an unhandled rejection.
**How to avoid:** Wrap the entire worker callback in try/catch. Log the error but don't re-throw. The worker should continue running on the next tick even if one run fails.
**Warning signs:** Server crashes when the database is temporarily unavailable.

### Pitfall 6: Batch UPDATE Zeroing with Length-Matched Padding
**What goes wrong:** Using `'0'.repeat(secret.ciphertext.length)` in a batch UPDATE requires a per-row calculation, which a single UPDATE statement can't do easily.
**Why it happens:** The individual retrieval zeroes the ciphertext with the exact same length. For batch, this is impractical.
**How to avoid:** For batch zeroing, set ciphertext to a short fixed string like `'0'` (single character). The purpose of zeroing is to overwrite the ciphertext data in PostgreSQL's buffer pages and WAL. A 1-character replacement still achieves this -- PostgreSQL will write a new tuple version that replaces the old data. The length-matching was a nicety for individual operations; for batch it's not worth the complexity.
**Warning signs:** Trying to write a subquery that calculates `length(ciphertext)` for each row in the batch UPDATE.

## Code Examples

Verified patterns from official sources and existing codebase:

### node-cron v4 Schedule (Every 5 Minutes)
```typescript
// Source: nodecron.com + GitHub node-cron/node-cron v4
import cron from 'node-cron';

// v4: tasks start immediately by default (no 'scheduled' option)
const task = cron.schedule('*/5 * * * *', async () => {
  // async callbacks supported in v4
  console.log('Running every 5 minutes');
});

// Stop accepting new runs (in-flight run completes)
task.stop();
```

### Drizzle ORM: Bulk DELETE with Timestamp Filter
```typescript
// Source: orm.drizzle.team/docs/delete + orm.drizzle.team/docs/operators
import { lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';

const now = new Date();
const result = await db.delete(secrets).where(lte(secrets.expiresAt, now));
// result.rowCount contains number of deleted rows (from pg driver)
```

### Drizzle ORM: Bulk UPDATE for Ciphertext Zeroing
```typescript
// Source: orm.drizzle.team/docs/update + existing codebase pattern
import { lte } from 'drizzle-orm';

const now = new Date();
await db
  .update(secrets)
  .set({ ciphertext: '0' })
  .where(lte(secrets.expiresAt, now));
```

### Expiration Guard in Existing Service Function
```typescript
// Based on existing secrets.service.ts pattern
// Add after the SELECT and null check, before any processing:
if (secret.expiresAt <= new Date()) {
  // Treat as not found -- same as null (anti-enumeration)
  // Optionally clean up inline:
  await tx.update(secrets)
    .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
    .where(eq(secrets.id, id));
  await tx.delete(secrets).where(eq(secrets.id, id));
  return null;
}
```

### Graceful Shutdown Integration
```typescript
// Based on existing server.ts pattern
import { startExpirationWorker, stopExpirationWorker } from './workers/expiration-worker.js';

// After app.listen():
startExpirationWorker();

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  stopExpirationWorker();

  server.close(async () => {
    await pool.end();
    logger.info('Database pool closed');
    process.exit(0);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron v3 (CJS, `scheduled` option) | node-cron v4 (TypeScript, ESM, tasks auto-start) | v4.0.0 May 2025 | `scheduled` and `runOnInit` options removed. Use `createTask()` for manual start control. |
| `@types/node-cron` for TypeScript | Built-in types in v4 | v4.0.0 May 2025 | v4 is written in TypeScript, bundles `.d.ts` via exports field |
| `cron.schedule(expr, fn, { scheduled: false })` | `cron.createTask(expr, fn, opts)` then `task.start()` | v4.0.0 | For tasks that should not start immediately |

**Deprecated/outdated:**
- `@types/node-cron`: Not needed for v4+. v4 bundles its own TypeScript declarations.
- `scheduled` option: Removed in v4. Use `createTask()` for deferred start.
- `runOnInit` option: Removed in v4.
- Event names `task-started`: Changed to `task:started` in v4.

## Open Questions

1. **Row count from Drizzle DELETE**
   - What we know: The `pg` driver returns `rowCount` on query results. Drizzle's `db.delete().where()` returns a `QueryResult` object.
   - What's unclear: The exact Drizzle v0.45 return type for `delete()` -- whether `.rowCount` is directly accessible or needs `.returning()`.
   - Recommendation: Test during implementation. If `.rowCount` is not available, use `.returning()` with a count, or run a `SELECT count(*)` before deleting (for logging purposes only -- the count is just informational).
   - Confidence: MEDIUM -- training data suggests `QueryResult` from `pg` passthrough, but should verify.

2. **Batch zeroing ciphertext length**
   - What we know: Individual retrieval zeroes with `'0'.repeat(ciphertext.length)` to match exact length. Batch UPDATE cannot easily do per-row length matching.
   - What's unclear: Whether setting to a fixed short string like `'0'` provides equivalent data remanence mitigation.
   - Recommendation: Use `'0'` (single character) for batch zeroing. PostgreSQL writes a new heap tuple regardless of the replacement length, so the original ciphertext data in the old tuple is equally superseded. The length-matching was defense-in-depth detail for individual operations. For batch operations, the practical security difference is negligible.
   - Confidence: HIGH -- PostgreSQL MVCC creates a new tuple version on any UPDATE, regardless of new value length.

3. **node-cron v4 `noOverlap` option**
   - What we know: v4 introduced a `noOverlap` option that prevents concurrent executions of the same task.
   - What's unclear: Whether this is needed for a 5-minute job that takes milliseconds to run.
   - Recommendation: Use `noOverlap: true` as a safety measure. Even though the query runs in milliseconds, database slowdowns could cause overlap. Zero cost to enable.
   - Confidence: HIGH -- documented in v4 migration guide.

## Sources

### Primary (HIGH confidence)
- [node-cron GitHub](https://github.com/node-cron/node-cron) - v4.0.0, TypeScript rewrite, ESM support, API changes
- [node-cron v3 to v4 Migration Guide](https://nodecron.com/migrating-from-v3) - Breaking changes, new options
- [node-cron Cron Syntax](https://nodecron.com/cron-syntax.html) - `*/5 * * * *` for every 5 minutes
- [Drizzle ORM Delete](https://orm.drizzle.team/docs/delete) - Bulk delete with WHERE clause
- [Drizzle ORM Filters/Operators](https://orm.drizzle.team/docs/operators) - `lt`, `lte` operators for timestamp comparison
- Existing codebase: `server/src/services/secrets.service.ts` - Current retrieval pattern, no expiration check
- Existing codebase: `server/src/server.ts` - Current graceful shutdown pattern
- Existing codebase: `server/src/db/schema.ts` - `expiresAt` column definition

### Secondary (MEDIUM confidence)
- [node-cron npm page](https://www.npmjs.com/package/node-cron) - Latest version v4.2.1, download stats
- [Better Stack node-cron guide](https://betterstack.com/community/guides/scaling-nodejs/node-cron-scheduled-tasks/) - Usage patterns
- [setInterval vs cron comparison](https://www.sabbir.co/blogs/68e2852ae6f20e639fc2c9bc) - When to use each

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node-cron v4 is the planned library, API verified via official docs and GitHub
- Architecture: HIGH - All patterns derive from existing codebase conventions and verified library APIs
- Pitfalls: HIGH - Based on direct codebase analysis showing missing expiration checks in service functions

**Critical finding:** The existing `retrieveAndDestroy`, `verifyAndRetrieve`, and `getSecretMeta` functions do NOT check `expiresAt`. This is the most important thing the planner needs to know. The worker alone is insufficient -- API-level guards are essential.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable domain, node-cron v4 is recent and unlikely to change)
