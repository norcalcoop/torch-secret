import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter for POST /api/secrets.
 *
 * Allows max 10 secret creations per IP per hour.
 * Applied as route-level middleware (NOT global) so that
 * GET /api/secrets/:id remains unrestricted -- retrieving
 * a secret is a one-time operation, not abuse-prone.
 *
 * Uses MemoryStore (default). For multi-instance production
 * deployments, swap to rate-limit-redis + ioredis.
 */
export const createSecretLimiter = rateLimit({
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
