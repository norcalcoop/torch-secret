import { Router } from 'express';
import { requireAuth } from '../middleware/require-auth.js';
import type { AuthUser } from '../auth.js';

export const meRouter = Router();

/**
 * GET /api/me
 *
 * Returns the authenticated user's profile.
 * Requires a valid Better Auth session cookie.
 *
 * Response: { user: { id, email, name, emailVerified, image, createdAt } }
 *
 * ZERO-KNOWLEDGE INVARIANT: This endpoint returns userId (user.id).
 * It MUST NOT include secretId in the response body. The client uses
 * this endpoint to display user info only. See .planning/INVARIANTS.md.
 */
meRouter.get('/', requireAuth, (_req, res) => {
  const user = res.locals.user as AuthUser;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
    },
  });
});
