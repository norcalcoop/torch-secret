import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

/**
 * Optional auth middleware. Sets res.locals.user if a valid session exists,
 * but always calls next() — never returns 401.
 *
 * Used by POST /api/secrets so authenticated users' secrets are linked to their account.
 * Anonymous requests are not blocked; res.locals.user is simply undefined.
 *
 * ZERO-KNOWLEDGE INVARIANT: res.locals.user contains userId. The secrets route handler
 * uses it to populate userId on insert. secretId is the INSERT result and must never
 * be combined with userId in the same log line. See INVARIANTS.md.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (session) {
      res.locals.user = session.user;
    }
  } catch {
    // Session check failure is non-fatal for optional auth
  }
  next();
}
