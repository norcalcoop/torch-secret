import { Router } from 'express';
import { validateBody, validateParams } from '../middleware/validate.js';
import { CreateSecretSchema, SecretIdParamSchema } from '../../../shared/types/api.js';
import { createSecret, retrieveAndDestroy } from '../services/secrets.service.js';

/**
 * Identical error response for all "not available" cases.
 * Whether the secret never existed, was already viewed, or expired,
 * the response is the same -- preventing enumeration attacks (SECR-07).
 */
const SECRET_NOT_AVAILABLE = {
  error: 'not_found',
  message: 'This secret does not exist, has already been viewed, or has expired.',
} as const;

export const secretsRouter = Router();

/**
 * POST / (mounted at /api/secrets)
 * Create a new secret from an encrypted ciphertext blob.
 * The server never inspects or transforms the ciphertext.
 */
secretsRouter.post(
  '/',
  validateBody(CreateSecretSchema),
  async (req, res) => {
    const secret = await createSecret(req.body.ciphertext, req.body.expiresIn);

    res.status(201).json({
      id: secret.id,
      expiresAt: secret.expiresAt.toISOString(),
    });
  },
);

/**
 * GET /:id
 * Retrieve and atomically destroy a secret.
 * Returns identical 404 for nonexistent, expired, and already-viewed secrets.
 */
secretsRouter.get(
  '/:id',
  validateParams(SecretIdParamSchema),
  async (req, res) => {
    const secret = await retrieveAndDestroy(req.params.id as string);

    if (!secret) {
      res.status(404).json(SECRET_NOT_AVAILABLE);
      return;
    }

    res.status(200).json({
      ciphertext: secret.ciphertext,
      expiresAt: secret.expiresAt.toISOString(),
    });
  },
);
