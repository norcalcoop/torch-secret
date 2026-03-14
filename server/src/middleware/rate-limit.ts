import { type Store, rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import { logger } from './logger.js';
import { env } from '../config/env.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';

/**
 * E2E tests share one server across 3 browsers; raise limits to prevent 429s during test runs.
 * Requires BOTH NODE_ENV=test AND E2E_TEST=true to activate — prevents accidental bypass in
 * production if only one variable is set (SR-014 safety gate).
 */
const isE2E = env.NODE_ENV === 'test' && env.E2E_TEST === 'true';

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
 * Wraps a rate-limit Store so that any increment error is logged as a Pino warn
 * before re-throwing. The re-throw allows passOnStoreError to pass the request
 * through, while the warn gives observability into Redis outages.
 *
 * Returns undefined unchanged (MemoryStore path — no wrap needed).
 */
function wrapStoreWithWarnOnError(store: Store | undefined): Store | undefined {
  if (!store) return undefined;
  const original = store.increment.bind(store);
  store.increment = async (...args: Parameters<Store['increment']>) => {
    try {
      return await original(...args);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'rate_limit_store_error');
      throw err;
    }
  };
  return store;
}

/**
 * Create a rate limiter for anonymous secret creation — hourly window.
 *
 * Allows max 3 creations per IP per hour for anonymous (unauthenticated) users.
 * Authenticated users are skipped via the `skip` callback (res.locals.user truthy).
 *
 * standardHeaders: 'draft-6' emits separate RateLimit-Limit, RateLimit-Remaining, and
 * RateLimit-Reset headers. draft-7 uses a combined header that does NOT include a
 * standalone RateLimit-Reset — the client reads RateLimit-Reset individually for
 * countdown display on upsell prompts (CONV-06), so draft-6 is required here.
 *
 * Applied as route-level middleware on POST /api/secrets AFTER optionalAuth so that
 * res.locals.user is populated before the skip callback fires.
 */
export function createAnonHourlyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: isE2E ? 1000 : 3, // 3 creations per hour for anonymous users (1000 in E2E)
    standardHeaders: 'draft-6', // Emits separate RateLimit-Reset header the client reads for countdown
    legacyHeaders: false, // No X-RateLimit-* headers
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Create a free account for higher limits.',
    },
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:anon:h:')),
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
 * the RateLimit-Reset header emitted by the hourly limiter (draft-6). The hourly
 * limiter's RateLimit-Reset is what the client reads for countdown display (CONV-06).
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
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:anon:d:')),
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
    limit: isE2E ? 1000 : 20, // 20 creations per day for free authenticated users (1000 in E2E)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message:
        'Daily limit reached. Free accounts can create 20 secrets per day. Upgrade to Pro for unlimited secrets.',
    },
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:authed:d:')),
    passOnStoreError: true,
    // Skip anonymous users OR Pro users (Pro = unlimited secrets per pricing page)
    skip: async (_req, res) => {
      const user = res.locals.user as { id: string } | undefined;
      if (!user) return true; // anonymous — anon limiters apply
      const userRow = await db
        .select({ subscriptionTier: users.subscriptionTier })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      const tier = userRow[0]?.subscriptionTier ?? 'free';
      return tier === 'pro'; // Pro users bypass; free users are counted
    },
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
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:verify:')),
    passOnStoreError: true,
  });
}

/**
 * Tight rate limiter for POST /api/secrets/:id/verify: 5 req/min/IP.
 *
 * Applied as the FIRST middleware in the POST /:id/verify chain — BEFORE validateParams,
 * validateBody, and the Argon2id verifyAndRetrieve call. Rate limiting must fire before
 * the expensive Argon2id computation, not after.
 *
 * Complements verifySecretLimiter (15/15min) with a tighter burst guard (5/1min).
 * Both limiters apply; this tight one fires first to catch burst attacks.
 *
 * Dual-condition isE2E guard (NODE_ENV=test AND E2E_TEST=true) is intentional: neither
 * variable alone is sufficient to raise the limit, preventing accidental bypass (SR-014).
 */
export function createVerifyTightLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: isE2E ? 1000 : 5, // 5 req/min/IP in production (1000 in test/E2E)
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many password attempts. Please wait before trying again.',
    },
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:verify:tight:')),
    passOnStoreError: true,
  });
}

/**
 * Create a rate limiter for GET /api/health.
 *
 * Limits to 60 req/min per IP — prevents health polling from amplifying
 * DB load (each health check runs SELECT 1 against the pool).
 *
 * standardHeaders: 'draft-8' per REQUIREMENTS GH-02.
 * passOnStoreError: true — allows health check through if Redis is down
 * (better to return health info than to fail the health endpoint itself).
 *
 * No isE2E multiplier applied — health checks in E2E don't need raised limits
 * (60/min is not reachable in normal E2E runs).
 */
export function createHealthLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 60, // 60 req/min per IP
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: 429,
    store: wrapStoreWithWarnOnError(createStore(redisClient, 'rl:health:')),
    passOnStoreError: true,
  });
}
