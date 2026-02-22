import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { validateParams } from '../middleware/validate.js';
import { SecretIdParamSchema } from '../../../shared/types/api.js';
import { getUserSecrets, deleteUserSecret } from '../services/secrets.service.js';
import type { AuthUser } from '../auth.js';

/**
 * Dashboard routes — authenticated users only.
 *
 * GET  /  — list current user's secrets (metadata only, never ciphertext)
 * DELETE /:id — soft-delete an Active secret owned by the authenticated user
 *
 * ZERO-KNOWLEDGE INVARIANT: These routes return secretId to the authenticated owner.
 * This is permitted (owner-only, auth-gated). What is prohibited: logging userId+secretId
 * together, or returning ciphertext/passwordHash. See .planning/INVARIANTS.md.
 */
export function createDashboardRouter() {
  const router = Router();

  // All dashboard routes require authentication
  router.use(requireAuth);

  /**
   * GET /api/dashboard/secrets
   * Returns the authenticated user's secret history (metadata only).
   * Never returns ciphertext, passwordHash, or encryption keys (DASH-05).
   */
  router.get('/secrets', async (_req, res) => {
    const user = res.locals.user as AuthUser;
    const secretsList = await getUserSecrets(user.id);
    res.status(200).json({ secrets: secretsList });
  });

  /**
   * DELETE /api/dashboard/secrets/:id
   * Soft-deletes an Active secret owned by the authenticated user.
   * Returns 404 for non-owned, non-active, or non-existent secrets
   * (identical response prevents enumeration — same principle as SECR-07).
   */
  router.delete('/secrets/:id', validateParams(SecretIdParamSchema), async (req, res) => {
    const user = res.locals.user as AuthUser;
    const result = await deleteUserSecret(req.params.id as string, user.id);

    if (!result) {
      res.status(404).json({
        error: 'not_found',
        message: 'Secret not found or cannot be deleted.',
      });
      return;
    }

    res.status(200).json({ success: true });
  });

  return router;
}
