import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

/**
 * Express middleware that validates a Better Auth session.
 *
 * Uses auth.api.getSession() with the incoming request headers.
 * On success: sets res.locals.user (AuthUser) and res.locals.session (AuthSessionData).
 * On failure: returns 401 JSON immediately.
 *
 * ZERO-KNOWLEDGE INVARIANT: res.locals.user contains userId.
 * Never augment res.locals or pass userId to any code that also reads secretId
 * from the request body or URL. See INVARIANTS.md.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    return;
  }

  res.locals.user = session.user;
  res.locals.session = session.session;
  next();
}
