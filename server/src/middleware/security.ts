import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * Per-request CSP nonce generation.
 *
 * Generates a cryptographically random 32-byte hex nonce and stores it
 * in `res.locals.cspNonce`. MUST run before helmet so the nonce is
 * available when helmet builds the Content-Security-Policy header.
 */
export function cspNonceMiddleware(_req: Request, res: Response, next: NextFunction): void {
  crypto.randomBytes(32, (err, randomBytes) => {
    if (err) {
      next(err);
      return;
    }
    res.locals.cspNonce = randomBytes.toString('hex');
    next();
  });
}

/**
 * Helmet security headers factory.
 *
 * Returns helmet middleware configured with:
 * - CSP: nonce-based script-src and style-src (no unsafe-inline, no unsafe-eval)
 * - HSTS: 1-year max-age in production, disabled in dev to prevent browser lockout
 * - Referrer-Policy: no-referrer (prevents URL fragment leakage)
 * - Cross-Origin isolation headers for defense in depth
 */
export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (_req: IncomingMessage, res: ServerResponse) =>
            `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
        ],
        styleSrc: [
          "'self'",
          (_req: IncomingMessage, res: ServerResponse) =>
            `'nonce-${(res as unknown as Response).locals.cspNonce}'`,
        ],
        imgSrc: ["'self'"],
        // PostHog analytics event ingestion (npm bundle approach — no script-src change needed)
        connectSrc: ["'self'", 'https://us.i.posthog.com', 'https://us-assets.i.posthog.com'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: env.FORCE_HTTPS ? [] : null,
      },
    },
    // Disable HSTS in non-production to prevent browser lockout without TLS
    strictTransportSecurity:
      env.NODE_ENV === 'production'
        ? { maxAge: 31536000, includeSubDomains: true, preload: false }
        : false,
    referrerPolicy: { policy: 'no-referrer' as const },
    xContentTypeOptions: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' as const },
    crossOriginResourcePolicy: { policy: 'same-origin' as const },
  });
}

/**
 * HTTPS redirect middleware.
 *
 * Redirects HTTP requests to HTTPS with a 301 when FORCE_HTTPS is true.
 * Decoupled from NODE_ENV so Docker Compose can run production mode
 * without HTTPS redirect (FORCE_HTTPS=false), while Render.com
 * enables it explicitly (FORCE_HTTPS=true).
 * Relies on `trust proxy` being set so `req.secure` correctly
 * reflects the X-Forwarded-Proto header from the reverse proxy.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  if (!env.FORCE_HTTPS) {
    next();
    return;
  }

  if (!req.secure) {
    res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    return;
  }

  next();
}
