import { Router } from 'express';
import type { Redis } from 'ioredis';
import { validateBody, validateParams } from '../middleware/validate.js';
import { createSecretLimiter, verifySecretLimiter } from '../middleware/rate-limit.js';
import {
  CreateSecretSchema,
  SecretIdParamSchema,
  VerifySecretSchema,
} from '../../../shared/types/api.js';
import type { CreateSecretRequest, VerifySecretRequest } from '../../../shared/types/api.js';
import {
  createSecret,
  retrieveAndDestroy,
  getSecretMeta,
  verifyAndRetrieve,
} from '../services/secrets.service.js';

/**
 * Identical error response for all "not available" cases.
 * Whether the secret never existed, was already viewed, or expired,
 * the response is the same -- preventing enumeration attacks (SECR-07).
 */
const SECRET_NOT_AVAILABLE = {
  error: 'not_found',
  message: 'This secret does not exist, has already been viewed, or has expired.',
} as const;

/**
 * Create a fresh secrets router with its own rate limiter instance.
 *
 * Factory pattern ensures each Express app (including test instances
 * created by buildApp()) gets independent rate limit counters.
 *
 * Route order is critical -- Express matches top-down:
 * 1. POST /         (create secret)
 * 2. GET /:id/meta  (metadata check -- MUST be before GET /:id)
 * 3. POST /:id/verify (password verification -- MUST be before GET /:id)
 * 4. GET /:id       (retrieve and destroy -- catch-all for :id)
 */
export function createSecretsRouter(redisClient?: Redis) {
  const router = Router();

  /**
   * POST / (mounted at /api/secrets)
   * Create a new secret from an encrypted ciphertext blob.
   * The server never inspects or transforms the ciphertext.
   * Optionally accepts a password for password-protected secrets.
   */
  router.post(
    '/',
    createSecretLimiter(redisClient),
    validateBody(CreateSecretSchema),
    async (req, res) => {
      const body = req.body as CreateSecretRequest;
      const secret = await createSecret(body.ciphertext, body.expiresIn, body.password);

      res.status(201).json({
        id: secret.id,
        expiresAt: secret.expiresAt.toISOString(),
      });
    },
  );

  /**
   * GET /:id/meta (mounted at /api/secrets/:id/meta)
   * Non-destructive metadata check. Returns whether the secret
   * requires a password and how many attempts remain.
   * Does NOT consume or modify the secret.
   */
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

  /**
   * POST /:id/verify (mounted at /api/secrets/:id/verify)
   * Verify password for a password-protected secret.
   * On success: returns ciphertext and atomically destroys the secret.
   * On wrong password: returns 403 with remaining attempts.
   * On max attempts: destroys the secret and returns identical 404.
   * On not found: returns identical 404.
   */
  router.post(
    '/:id/verify',
    verifySecretLimiter(redisClient),
    validateParams(SecretIdParamSchema),
    validateBody(VerifySecretSchema),
    async (req, res) => {
      const verifyBody = req.body as VerifySecretRequest;
      const result = await verifyAndRetrieve(req.params.id as string, verifyBody.password);

      // Not found or not password-protected
      if (result === null) {
        res.status(404).json(SECRET_NOT_AVAILABLE);
        return;
      }

      // Wrong password -- secret destroyed (0 attempts remaining)
      if (!result.success && result.attemptsRemaining === 0) {
        res.status(404).json(SECRET_NOT_AVAILABLE);
        return;
      }

      // Wrong password -- attempts remain
      if (!result.success) {
        res.status(403).json({
          error: 'wrong_password',
          attemptsRemaining: result.attemptsRemaining,
        });
        return;
      }

      // Password correct -- return ciphertext
      res.status(200).json({
        ciphertext: result.secret.ciphertext,
        expiresAt: result.secret.expiresAt.toISOString(),
      });
    },
  );

  /**
   * GET /:id
   * Retrieve and atomically destroy a secret.
   * Returns identical 404 for nonexistent, expired, already-viewed,
   * and password-protected secrets.
   */
  router.get('/:id', validateParams(SecretIdParamSchema), async (req, res) => {
    const secret = await retrieveAndDestroy(req.params.id as string);

    if (!secret) {
      res.status(404).json(SECRET_NOT_AVAILABLE);
      return;
    }

    res.status(200).json({
      ciphertext: secret.ciphertext,
      expiresAt: secret.expiresAt.toISOString(),
    });
  });

  return router;
}
