# Phase 8: Tech Debt Cleanup - Research

**Researched:** 2026-02-14
**Domain:** Test reliability, WCAG accessibility, distributed rate limiting
**Confidence:** HIGH

## Summary

Phase 8 addresses 4 tech debt items from the v1 milestone audit. Research reveals that items 1 (flaky test) and 3 (test parallelism) share a single root cause: 4 server test files import the same `pool` singleton from `connection.ts`, and each calls `pool.end()` in `afterAll`. When Vitest runs files in parallel (the default), one file's teardown can close the shared pool while another file's tests are still executing. This explains why each suite passes independently but intermittent failures occur during full-suite runs.

Item 2 (color contrast) is a one-line CSS class change from `text-gray-400` to `text-gray-500` on the character counter in `create.ts`. Item 4 (Redis rate limiting) requires adding `ioredis` and `rate-limit-redis` packages and modifying the existing rate limiter factory functions to accept an optional Redis client, falling back to MemoryStore when no Redis is available.

**Primary recommendation:** Fix items 1 and 3 together as a single test infrastructure improvement (either disable file parallelism for server tests or add per-file table truncation with a shared pool lifecycle), then fix item 2 as a trivial CSS change, and implement item 4 as an opt-in Redis store behind environment configuration.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.x (installed: ^4.0.18) | Test framework | Already in use; `fileParallelism` and `projects` configs control isolation |
| ioredis | 5.9.3 | Redis client | Standard Node.js Redis client, built-in TypeScript types, ESM support since 5.2.5 |
| rate-limit-redis | 4.3.1 | Express rate limit Redis store | Official companion to express-rate-limit, peer dep `express-rate-limit >= 6` (project has 8.x) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | ^8.2.1 (installed) | Rate limiting middleware | Already in use; `store` option accepts RedisStore |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ioredis | `redis` (node-redis) | node-redis is the official Redis client; ioredis has richer API, better cluster support, and is already listed in CLAUDE.md as planned |
| rate-limit-redis | Custom Redis store | express-rate-limit store interface is non-trivial (sliding window, increment, decrement); rate-limit-redis handles edge cases |
| Disabling file parallelism | Per-file database isolation (separate schemas/databases) | Separate databases add infrastructure complexity; sequential execution is simpler and acceptable for ~150 tests |

**Installation:**
```bash
npm install ioredis rate-limit-redis
```

## Architecture Patterns

### Pattern 1: Fix Test Parallelism via `fileParallelism: false` for Server Tests

**What:** Use Vitest's `projects` configuration to run server test files sequentially while keeping client tests parallel.
**When to use:** When multiple test files share a singleton database connection pool.
**Why it works:** The root cause of both the flaky test (item 1) and the test parallelism issue (item 3) is that 4 server test files (`secrets.test.ts`, `security.test.ts`, `expiration.test.ts`, `expiration-worker.test.ts`) all import the same `pool` singleton and each calls `pool.end()` in `afterAll`. Running them in parallel means one file's `afterAll` can close the pool mid-test for another file.

**Option A: Vitest `projects` split (RECOMMENDED)**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    testTimeout: 10_000,
    setupFiles: ['dotenv/config'],
    projects: [
      {
        test: {
          name: 'client',
          include: ['client/src/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/src/**/*.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
```
Source: Context7 /vitest-dev/vitest - fileParallelism Configuration, projects configuration

**Option B: Global `fileParallelism: false` (simpler but slower)**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    fileParallelism: false,
    // ... rest of config
  },
});
```

**Option C: Centralize pool lifecycle in globalSetup/globalTeardown**
Remove `pool.end()` from individual test files and manage it once in a global teardown file. This allows parallel execution but requires removing the per-file `afterAll` pool cleanup.

### Pattern 2: Redis Rate Limiting with MemoryStore Fallback

**What:** Make the rate limiter factory functions accept an optional Redis client. When `REDIS_URL` is set, use `RedisStore`; otherwise fall back to `MemoryStore`.
**When to use:** Production multi-instance deployments.

```typescript
// server/src/middleware/rate-limit.ts
import { rateLimit, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type Redis from 'ioredis';

function createStore(redisClient?: Redis, prefix?: string): Store | undefined {
  if (!redisClient) return undefined; // MemoryStore (default)
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.call(...args) as Promise<RedisReply>,
    prefix: prefix ?? 'rl:',
  });
}

export function createSecretLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Please try again later.',
    },
    store: createStore(redisClient, 'rl:create:'),
  });
}
```
Source: Context7 /express-rate-limit/express-rate-limit - Using External Data Stores, GitHub rate-limit-redis README

### Pattern 3: WCAG Color Contrast Fix

**What:** Change `text-gray-400` to `text-gray-500` on the character counter element.
**When to use:** Character counter currently at 2.60:1 contrast ratio; `text-gray-500` provides ~4.84:1 ratio (passes WCAG 2.1 AA 4.5:1 threshold for normal text).

```typescript
// client/src/pages/create.ts, line 70
// BEFORE:
const counter = document.createElement('div');
counter.className = 'text-right text-sm text-gray-400';

// AFTER:
const counter = document.createElement('div');
counter.className = 'text-right text-sm text-gray-500';
```

**Tailwind v4 gray values (OKLCH on white background):**
- `gray-400`: oklch(70.7% 0.022 261.325) -- approx 2.60:1 contrast vs white
- `gray-500`: oklch(55.1% 0.027 264.364) -- approx 4.84:1 contrast vs white (PASSES AA)
- `gray-600`: oklch(44.6% 0.03 256.802) -- approx 7.56:1 contrast vs white

### Anti-Patterns to Avoid

- **Calling `pool.end()` in every test file's `afterAll`:** When files run in parallel, the shared singleton pool gets destroyed while other files are still using it. Either centralize teardown or run sequentially.
- **Using `ioredis` `client.sendCommand()` with rate-limit-redis:** The correct ioredis method is `client.call()`, not `client.sendCommand()`. This was a documented bug in rate-limit-redis (GitHub issue #70, fixed in 3.0.1+).
- **Making Redis mandatory for development:** Redis store should be opt-in via `REDIS_URL` environment variable. MemoryStore must remain the default for local dev and testing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Redis rate limiting store | Custom Redis increment/decrement logic | `rate-limit-redis` v4.3.1 | Handles sliding window, atomic Lua scripts, key expiry, connection error recovery |
| Test file parallelism control | Custom test orchestration scripts | Vitest `projects` + `fileParallelism` config | Built into Vitest, officially supported, handles worker lifecycle |

**Key insight:** Both rate limiting storage and test orchestration are solved problems with first-party or officially blessed solutions. Custom implementations would be fragile and under-tested.

## Common Pitfalls

### Pitfall 1: pool.end() Race Condition (Items 1 & 3)

**What goes wrong:** One test file's `afterAll(() => pool.end())` closes the shared PostgreSQL pool while another test file's tests are still executing queries. This causes `Error: Client was closed` or connection timeout errors that appear intermittent.
**Why it happens:** Vitest runs test files in parallel by default. All 4 server test files import the same singleton `pool` from `server/src/db/connection.ts`. The pool is created once (module-level) and shared across all files in the same worker or across workers.
**How to avoid:** Either (a) run server tests sequentially via `fileParallelism: false`, or (b) remove `pool.end()` from individual test files and centralize it in a `globalTeardown` file, or (c) use Vitest `projects` to isolate server tests into their own sequential project.
**Warning signs:** Tests pass individually (`npx vitest run path/to/test.ts`) but fail intermittently when running `npm test` or `npm run test:run`.

### Pitfall 2: ioredis sendCommand Syntax

**What goes wrong:** Using `client.sendCommand()` (node-redis syntax) instead of `client.call()` (ioredis syntax) when configuring RedisStore.
**Why it happens:** rate-limit-redis docs historically showed incorrect ioredis example (GitHub issue #70).
**How to avoid:** Always use the spread pattern: `sendCommand: (...args: string[]) => client.call(...args)`.
**Warning signs:** Runtime TypeError or Redis command failures when rate limiting is active.

### Pitfall 3: Redis Dependency in Tests

**What goes wrong:** Tests that previously used MemoryStore now require a running Redis instance, breaking CI/CD and local development.
**Why it happens:** Hard-coding RedisStore without a fallback.
**How to avoid:** Make Redis opt-in via `REDIS_URL` environment variable. Tests should continue using MemoryStore (the default when no Redis client is passed). The `buildApp()` factory should accept an optional Redis client or detect `REDIS_URL` from env.
**Warning signs:** Tests fail with `ECONNREFUSED` on Redis port when Redis is not running.

### Pitfall 4: Vitest projects Config Migration

**What goes wrong:** Switching from flat `test` config to `projects` array can break `environmentMatchGlobs`, `setupFiles`, or `include` patterns if not properly migrated.
**Why it happens:** The `projects` syntax requires each project to independently specify its test config.
**How to avoid:** Move `environment`, `include`, and `environmentMatchGlobs` into each project block. Keep `setupFiles` at the top level or duplicate into each project.
**Warning signs:** Client tests stop using happy-dom environment, or server tests don't run at all.

### Pitfall 5: passOnStoreError for Redis Resilience

**What goes wrong:** Rate limiting completely blocks all requests when Redis is temporarily unavailable.
**Why it happens:** Default behavior of rate-limit-redis rejects requests when the store errors.
**How to avoid:** Set `passOnStoreError: true` on the rate limiter. This allows requests through if Redis is down, preferring availability over strict rate enforcement.
**Warning signs:** All API requests return 500 during Redis maintenance windows.

## Code Examples

Verified patterns from official sources:

### ioredis Connection with ESM Import
```typescript
// Source: ioredis npm docs, ESM named export (v5.2.5+)
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Or with explicit options:
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null, // Required for some use cases
});
```

### RedisStore with ioredis for express-rate-limit
```typescript
// Source: rate-limit-redis README (ioredis example, corrected syntax per issue #70)
import { rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { Redis } from 'ioredis';

const client = new Redis(process.env.REDIS_URL);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: string[]) =>
      client.call(...args) as Promise<RedisReply>,
    prefix: 'rl:',
  }),
  passOnStoreError: true,
});
```

### Vitest Projects Config for Sequential Server Tests
```typescript
// Source: Context7 /vitest-dev/vitest - projects configuration
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    testTimeout: 10_000,
    setupFiles: ['dotenv/config'],
    projects: [
      {
        test: {
          name: 'client',
          include: ['client/src/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
      {
        test: {
          name: 'server',
          include: ['server/src/**/*.test.ts'],
          environment: 'node',
          fileParallelism: false,
        },
      },
    ],
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `environmentMatchGlobs` for mixed environments | `projects` array with per-project environment | Vitest 4.x | More reliable environment assignment, especially for nested paths |
| `import Redis from 'ioredis'` (default import) | `import { Redis } from 'ioredis'` (named export) | ioredis 5.2.5 | Named export is ESM-compatible; default import deprecated in next major |
| `client.sendCommand()` for rate-limit-redis | `client.call(...args)` for ioredis | rate-limit-redis 3.0.1 (issue #70 fix) | Corrected ioredis syntax; spread args required |

**Deprecated/outdated:**
- `@types/ioredis`: Not needed -- ioredis 5.x includes its own TypeScript declarations
- Default import `import Redis from 'ioredis'`: Works but will be deprecated in next major version

## Open Questions

1. **Redis availability for local development**
   - What we know: Redis is listed as planned (`ioredis`) in CLAUDE.md but not yet used. No Docker Compose exists.
   - What's unclear: Whether Redis should be required for `npm run dev:server` or remain fully optional.
   - Recommendation: Keep Redis optional. Detect `REDIS_URL` in env config; use MemoryStore when absent. Add `REDIS_URL` to `.env.example` with a comment. Do not create Docker Compose (out of scope for tech debt).

2. **Vitest projects vs. simple fileParallelism: false**
   - What we know: Both work. `projects` is more granular (keeps client tests parallel). Simple `fileParallelism: false` is fewer lines of config but slows all tests.
   - What's unclear: Whether the performance difference matters (~150 tests, <10s total run time).
   - Recommendation: Use `projects` split. It's the correct long-term architecture and the config is not significantly more complex. The existing `environmentMatchGlobs` approach was already noted as unreliable in vitest 4.x for nested paths (decision [07-02]).

3. **Should pool.end() calls be removed from individual test files?**
   - What we know: With `fileParallelism: false`, the race condition is eliminated. The `pool.end()` calls are harmless when files run sequentially (first file closes it, subsequent calls are no-ops on an already-ended pool).
   - What's unclear: Whether Drizzle/pg pool handles multiple `end()` calls gracefully or throws.
   - Recommendation: Keep `pool.end()` in each file for now. If `fileParallelism: false` solves the flaky tests, this is not a blocking concern. If issues persist, centralize to a single `globalTeardown` file.

## Sources

### Primary (HIGH confidence)
- Context7 `/express-rate-limit/express-rate-limit` - External data stores, Redis store configuration
- Context7 `/vitest-dev/vitest` - fileParallelism, projects, test isolation, pool configuration
- [rate-limit-redis GitHub README](https://github.com/express-rate-limit/rate-limit-redis) - ioredis sendCommand syntax (raw README fetch)
- Codebase inspection: `vitest.config.ts`, all 4 server test files, `rate-limit.ts`, `connection.ts`, `create.ts`

### Secondary (MEDIUM confidence)
- [rate-limit-redis npm](https://www.npmjs.com/package/rate-limit-redis) - Version 4.3.1, peer dep `express-rate-limit >= 6`
- [ioredis npm](https://www.npmjs.com/package/ioredis) - Version 5.9.3, built-in TypeScript types, ESM named export
- [rate-limit-redis issue #70](https://github.com/express-rate-limit/rate-limit-redis/issues/70) - Corrected ioredis sendCommand syntax
- [Tailwind CSS v4 gray palette](https://tailwindcolor.com/gray) - OKLCH values for gray-400/500/600

### Tertiary (LOW confidence)
- None. All findings verified with multiple sources.

## Metadata

**Confidence breakdown:**
- Test isolation fix (items 1 & 3): HIGH - Root cause identified via code inspection (shared pool singleton + parallel afterAll pool.end()). Vitest projects/fileParallelism solution verified in Context7 official docs.
- Color contrast fix (item 2): HIGH - One-line change, contrast ratios confirmed in v1 audit and Tailwind color docs.
- Redis rate limiting (item 4): HIGH - express-rate-limit + rate-limit-redis integration documented in Context7 with verified code examples. ioredis sendCommand syntax confirmed via GitHub issue #70 resolution.
- Pitfalls: HIGH - Based on documented bugs (issue #70), codebase inspection, and verified Vitest behavior.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable libraries, no rapid-change risk)
