import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { requireAuth } from '../middleware/require-auth.js';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { auth } from '../auth.js';
import type { AuthUser } from '../auth.js';

export const meRouter = Router();

/**
 * GET /api/me
 *
 * Returns the authenticated user's profile including subscription tier.
 * Requires a valid Better Auth session cookie.
 *
 * subscriptionTier is fetched via DB lookup because Better Auth's AuthUser
 * type does not include custom schema columns (stripe_customer_id, subscription_tier).
 * See Research.md Pitfall 4 for details.
 *
 * Response: { user: { id, email, name, emailVerified, image, createdAt, subscriptionTier } }
 *
 * ZERO-KNOWLEDGE INVARIANT: Returns userId (user.id).
 * MUST NOT include secretId in the response body. See .planning/INVARIANTS.md.
 */

meRouter.get('/', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;

  // Fetch from DB to get subscriptionTier (not available on Better Auth session user)
  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      subscriptionTier: dbUser?.subscriptionTier ?? 'free',
    },
  });
});

/**
 * DELETE /api/me
 *
 * Account deletion endpoint. Requires authenticated session.
 * Delegates to Better Auth's built-in deleteUser endpoint, which:
 *   1. Runs beforeDelete hook (Loops GDPR delete + secrets.user_id null-out)
 *   2. Deletes the user row (cascade-deletes sessions and accounts)
 *   3. Clears the session cookie
 *
 * Returns { ok: true } on success.
 *
 * ZERO-KNOWLEDGE INVARIANT: Returns no userId or secretId in response body.
 */
meRouter.delete('/', requireAuth, async (req, res) => {
  try {
    await auth.api.deleteUser({
      headers: fromNodeHeaders(req.headers),
      body: {},
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'deletion_failed' });
  }
});
