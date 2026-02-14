import { rateLimit } from 'express-rate-limit';

/**
 * Create a rate limiter for POST /api/secrets.
 *
 * Returns a fresh middleware instance with its own MemoryStore.
 * This factory pattern ensures each Express app (including test
 * instances) gets an independent rate limit counter.
 *
 * Allows max 10 secret creations per IP per hour.
 * Applied as route-level middleware (NOT global) so that
 * GET /api/secrets/:id remains unrestricted -- retrieving
 * a secret is a one-time operation, not abuse-prone.
 *
 * Uses MemoryStore (default). For multi-instance production
 * deployments, swap to rate-limit-redis + ioredis.
 */
export function createSecretLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 10, // 10 requests per window per IP
    standardHeaders: 'draft-7', // RateLimit-* headers (IETF draft-7)
    legacyHeaders: false, // No X-RateLimit-* headers
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Please try again later.',
    },
    // Default keyGenerator uses req.ip, which works correctly with trust proxy
  });
}

/**
 * Create a rate limiter for POST /api/secrets/:id/verify.
 *
 * Returns a fresh middleware instance with its own MemoryStore.
 * Stricter than createSecretLimiter -- defense-in-depth on top of
 * the per-secret 3-attempt auto-destroy limit.
 *
 * Allows max 15 password verification attempts per IP per 15 minutes
 * across ALL secrets (not per-secret). Prevents brute-force campaigns
 * even when targeting multiple secrets.
 */
export function verifySecretLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 15, // 15 attempts per window per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many password attempts. Please try again later.',
    },
  });
}
