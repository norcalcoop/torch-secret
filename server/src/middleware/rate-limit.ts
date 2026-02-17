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
 * Create a rate limiter for POST /api/secrets.
 *
 * Returns a fresh middleware instance. Uses RedisStore when a Redis
 * client is provided (multi-instance deployments), otherwise falls
 * back to MemoryStore (default). passOnStoreError ensures requests
 * are allowed through if Redis is temporarily unavailable.
 *
 * Allows max 10 secret creations per IP per hour.
 * Applied as route-level middleware (NOT global) so that
 * GET /api/secrets/:id remains unrestricted -- retrieving
 * a secret is a one-time operation, not abuse-prone.
 */
export function createSecretLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: isE2E ? 1000 : 10, // 10 requests per window per IP (1000 in test)
    standardHeaders: 'draft-7', // RateLimit-* headers (IETF draft-7)
    legacyHeaders: false, // No X-RateLimit-* headers
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Please try again later.',
    },
    store: createStore(redisClient, 'rl:create:'),
    passOnStoreError: true,
    // Default keyGenerator uses req.ip, which works correctly with trust proxy
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
