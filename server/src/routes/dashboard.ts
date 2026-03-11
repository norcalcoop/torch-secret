import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { SecretIdParamSchema, DashboardQuerySchema } from '../../../shared/types/api.js';
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
 * together, or returning ciphertext/passwordHash. See INVARIANTS.md.
 */
export function createDashboardRouter() {
  const router = Router();

  // All dashboard routes require authentication
  router.use(requireAuth);

  /**
   * GET /api/dashboard/secrets
   * Returns the authenticated user's secret history (metadata only) with cursor pagination.
   * Supports ?cursor=<opaque> and ?status=<active|viewed|expired|deleted|all>.
   * Never returns ciphertext, passwordHash, or encryption keys (DASH-05).
   */
  router.get('/secrets', validateQuery(DashboardQuerySchema), async (req, res) => {
    const user = res.locals.user as AuthUser;
    const { cursor, status } = (
      req as typeof req & { validatedQuery: { cursor?: string; status: string } }
    ).validatedQuery;

    // Validate cursor decodability if provided (route is the guard layer — 400 on bad cursor)
    if (cursor !== undefined) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as unknown;
        if (
          typeof decoded !== 'object' ||
          decoded === null ||
          !('id' in decoded) ||
          typeof (decoded as Record<string, unknown>).id !== 'string' ||
          !('createdAt' in decoded) ||
          typeof (decoded as Record<string, unknown>).createdAt !== 'string'
        ) {
          res
            .status(400)
            .json({ error: 'validation_error', details: { cursor: 'Invalid cursor format' } });
          return;
        }
      } catch {
        res
          .status(400)
          .json({ error: 'validation_error', details: { cursor: 'Invalid cursor format' } });
        return;
      }
    }

    const result = await getUserSecrets(user.id, {
      cursor,
      status: status as 'all' | 'active' | 'viewed' | 'expired' | 'deleted',
    });

    res.status(200).json({ secrets: result.secrets, nextCursor: result.nextCursor });
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
