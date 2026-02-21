import { type Store, rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';

/** E2E tests share one server across 3 browsers; raise limits to prevent 429s during test runs. */
const isE2E = process.env.E2E_TEST === 'true';

/**
 * Create a RedisStore for rate limiting when a Redis client is provided,
 * otherwise return undefined to use the default MemoryStore.
 *
 * passOnStoreError is handled at the rateLimit() call site, not here.
 */
function createStore(redisClient?: Redis, prefix?: string): Store | undefined {
  if (!redisClient) return undefined; // MemoryStore (default)
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redisClient.call(...(args as [string, ...string[]])) as Promise<RedisReply>,
    prefix: prefix ?? 'rl:',
  });
}

/**
 * Create a rate limiter for anonymous secret creation — hourly window.
 *
 * Allows max 3 creations per IP per hour for anonymous (unauthenticated) users.
 * Authenticated users are skipped via the `skip` callback (res.locals.user truthy).
 *
 * standardHeaders: 'draft-7' emits RateLimit-* headers so the client can read
 * RateLimit-Reset for countdown display on upsell prompts.
 *
 * Applied as route-level middleware on POST /api/secrets AFTER optionalAuth so that
 * res.locals.user is populated before the skip callback fires.
 */
export function createAnonHourlyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: isE2E ? 1000 : 3, // 3 creations per hour for anonymous users (1000 in E2E)
    standardHeaders: 'draft-7', // RateLimit-* headers (IETF draft-7); client reads RateLimit-Reset
    legacyHeaders: false, // No X-RateLimit-* headers
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Create a free account for higher limits.',
    },
    store: createStore(redisClient, 'rl:anon:h:'),
    passOnStoreError: true,
    // Skip authenticated users — they have their own daily limiter
    skip: (_req, res) => !!(res.locals.user as unknown),
    // Default keyGenerator uses req.ip, which works correctly with trust proxy
  });
}

/**
 * Create a rate limiter for anonymous secret creation — daily window.
 *
 * Allows max 10 creations per IP per day for anonymous (unauthenticated) users.
 * Authenticated users are skipped via the `skip` callback (res.locals.user truthy).
 *
 * standardHeaders: false — CRITICAL: prevents this daily limiter from overwriting
 * the RateLimit-* headers emitted by the hourly limiter. The hourly limiter's
 * RateLimit-Reset is what the client uses for countdown display on upsell prompts.
 *
 * Applied as route-level middleware on POST /api/secrets AFTER optionalAuth.
 */
export function createAnonDailyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    limit: isE2E ? 1000 : 10, // 10 creations per day for anonymous users (1000 in E2E)
    standardHeaders: false, // Do NOT overwrite hourly RateLimit-* headers the client depends on
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message:
        'Daily limit reached for anonymous sharing. Create a free account for higher limits.',
    },
    store: createStore(redisClient, 'rl:anon:d:'),
    passOnStoreError: true,
    // Skip authenticated users — they have their own daily limiter
    skip: (_req, res) => !!(res.locals.user as unknown),
  });
}

/**
 * Create a rate limiter for authenticated secret creation — daily window.
 *
 * Allows max 20 creations per user per day for authenticated users.
 * Anonymous users (res.locals.user falsy) are skipped.
 *
 * keyGenerator uses the authenticated user's ID (not req.ip) to avoid
 * shared-IP false positives for authenticated users on NAT/corporate networks.
 *
 * Applied as route-level middleware on POST /api/secrets AFTER optionalAuth.
 */
export function createAuthedDailyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    limit: isE2E ? 1000 : 20, // 20 creations per day for authenticated users (1000 in E2E)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Daily limit reached. You can create 20 secrets per day.',
    },
    store: createStore(redisClient, 'rl:authed:d:'),
    passOnStoreError: true,
    // Skip anonymous users — they use the anon hourly/daily limiters
    skip: (_req, res) => !(res.locals.user as unknown),
    // Per-user counter keyed on userId, not IP — avoids shared-IP false positives
    keyGenerator: (_req, res) => (res.locals.user as { id: string }).id,
  });
}

/**
 * Create a rate limiter for POST /api/secrets/:id/verify.
 *
 * Returns a fresh middleware instance. Uses RedisStore when a Redis
 * client is provided, otherwise falls back to MemoryStore.
 * passOnStoreError ensures requests are allowed through if Redis
 * is temporarily unavailable.
 *
 * Allows max 15 password verification attempts per IP per 15 minutes
 * across ALL secrets (not per-secret). Prevents brute-force campaigns
 * even when targeting multiple secrets.
 */
export function verifySecretLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: isE2E ? 1000 : 15, // 15 attempts per window per IP (1000 in test)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many password attempts. Please try again later.',
    },
    store: createStore(redisClient, 'rl:verify:'),
    passOnStoreError: true,
  });
}
