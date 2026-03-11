import { Router } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { requireAuth } from '../middleware/require-auth.js';
import { db } from '../db/connection.js';
import { users, auditLogs } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
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
 * Response: { user: { id, email, name, emailVerified, image, createdAt, subscriptionTier, stripeCustomerId } }
 *
 * Returns 401 if the DB user row is missing (race condition defense — account deleted
 * between session validation and DB lookup).
 *
 * ZERO-KNOWLEDGE INVARIANT: Returns userId (user.id).
 * MUST NOT include secretId in the response body. See INVARIANTS.md.
 */

meRouter.get('/', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;

  // Project only the columns we need — avoid select-star on user rows.
  const [dbUser] = await db
    .select({
      subscriptionTier: users.subscriptionTier,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, user.id));

  // Null guard: dbUser missing means account was deleted between session validation and DB lookup
  if (!dbUser) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      subscriptionTier: dbUser.subscriptionTier,
      stripeCustomerId: dbUser.stripeCustomerId,
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

/**
 * GET /api/me/export
 *
 * GDPR Article 20 data portability endpoint.
 * Returns the authenticated user's profile metadata and audit log entries as JSON.
 *
 * Intentional exclusions:
 *   - stripeCustomerId: billing implementation detail, not personal profile data
 *   - secrets: ciphertext is zeroed and deleted at retrieval time (zero-knowledge model)
 *   - user_id in auditLog entries: redundant — export is already scoped to the authenticated user
 *
 * auditLog sorted newest-first (created_at DESC).
 * No row cap — full GDPR Article 20 portability.
 *
 * ZERO-KNOWLEDGE INVARIANT: Response contains userId (profile.id).
 * MUST NOT include secretId anywhere in the response. See INVARIANTS.md.
 */
meRouter.get('/export', requireAuth, async (_req, res) => {
  const user = res.locals.user as AuthUser;

  const [dbUser] = await db
    .select({ subscriptionTier: users.subscriptionTier })
    .from(users)
    .where(eq(users.id, user.id));

  if (!dbUser) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const auditEntries = await db
    .select({
      event_type: auditLogs.eventType,
      created_at: auditLogs.createdAt,
      ip_hash: auditLogs.ipHash,
      user_agent: auditLogs.userAgent,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, user.id))
    .orderBy(desc(auditLogs.createdAt));

  res.json({
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      subscriptionTier: dbUser.subscriptionTier,
    },
    auditLog: auditEntries,
  });
});
