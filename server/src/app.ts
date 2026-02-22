import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { Redis } from 'ioredis';
import { toNodeHandler } from 'better-auth/node';
import {
  cspNonceMiddleware,
  createHelmetMiddleware,
  httpsRedirect,
} from './middleware/security.js';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { createSecretsRouter } from './routes/secrets.js';
import { healthRouter } from './routes/health.js';
import { auth } from './auth.js';
import { meRouter } from './routes/me.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { env } from './config/env.js';

/**
 * Express app factory.
 *
 * Returns a configured Express app without starting the HTTP server.
 * This pattern enables supertest-based testing without port conflicts.
 *
 * Middleware order is critical for correctness:
 * 1. trust proxy    -- enables correct req.ip behind reverse proxy
 * 2. httpsRedirect  -- redirect HTTP->HTTPS before any response
 * 3. cspNonce       -- generate nonce BEFORE helmet reads it
 * 4. helmet         -- set all security headers (CSP uses nonce from step 3)
 * 5. httpLogger     -- logging
 * 6. auth handler   -- /api/auth/*splat MUST be before express.json() (body-stream ordering)
 * 7. json parser    -- body parsing (for non-auth routes)
 * 8. routes         -- API endpoints (health, secrets, me)
 * 9. static assets + SPA catch-all (production only, when client/dist exists)
 * 10. errorHandler  -- MUST be last
 */
export function buildApp() {
  const app = express();

  // Create Redis client for distributed rate limiting (opt-in via REDIS_URL)
  let redisClient: InstanceType<typeof Redis> | undefined;
  if (env.REDIS_URL) {
    redisClient = new Redis(env.REDIS_URL);
  }

  // Trust first proxy hop (enables correct req.ip for rate limiting
  // and req.secure for HTTPS redirect behind reverse proxy)
  app.set('trust proxy', 1);

  // Redirect HTTP -> HTTPS in production (before any response processing)
  app.use(httpsRedirect);

  // Generate per-request CSP nonce (BEFORE helmet so nonce is available)
  app.use(cspNonceMiddleware);

  // Set all security headers (CSP with nonce, HSTS, Referrer-Policy, etc.)
  app.use(createHelmetMiddleware());

  // HTTP request logging (pino-http with secret ID redaction)
  app.use(httpLogger);

  // Better Auth handler -- MUST be before express.json() to avoid body-stream conflict.
  // Better Auth parses its own bodies internally; if express.json() runs first,
  // the stream is consumed and all auth requests hang indefinitely.
  // Express 5 wildcard syntax: /api/auth/*splat (not /api/auth/*)
  app.all('/api/auth/{*splat}', toNodeHandler(auth));

  // Parse JSON bodies with explicit size limit (100kb prevents abuse)
  app.use(express.json({ limit: '100kb' }));

  // Health check -- before rate-limited routes
  app.use('/api/health', healthRouter);

  // Mount API routes (factory creates fresh router + rate limiter per app)
  app.use('/api/secrets', createSecretsRouter(redisClient));

  // Mount /api/me route (requires auth session)
  app.use('/api/me', meRouter);

  // Mount /api/dashboard routes (requires auth session)
  app.use('/api/dashboard', createDashboardRouter());

  // API catch-all: return JSON 404 for any unmatched /api/* request.
  // MUST come after ALL API routes (health, secrets, me) and before the SPA catch-all
  // to prevent API requests from falling through to the HTML response.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Serve built frontend assets in production (or when client/dist exists)
  const clientDistPath = resolve(import.meta.dirname, '../../client/dist');
  if (existsSync(clientDistPath)) {
    // Serve static assets (JS, CSS, images) -- index:false because we handle HTML ourselves
    app.use(express.static(clientDistPath, { index: false }));

    // Read HTML template once at startup for nonce injection
    const htmlTemplate = readFileSync(resolve(clientDistPath, 'index.html'), 'utf-8');

    // SPA catch-all: inject per-request CSP nonce into HTML template
    // Express 5 requires named wildcard parameter (path-to-regexp v8+)
    app.get('{*path}', (req, res) => {
      const html = htmlTemplate.replaceAll('__CSP_NONCE__', res.locals.cspNonce as string);
      res.setHeader('Content-Type', 'text/html');

      // Defense-in-depth: HTTP-level noindex for routes that must not be crawled.
      // /secret/* routes contain encrypted-secret interstitials (crawlers should never index them).
      // Auth and dashboard routes (/login, /register, /forgot-password, /reset-password, /dashboard)
      // should not appear in search results — they are private-state pages with no SEO value.
      // X-Robots-Tag is server-side complement to the client-side <meta name="robots"> tag.
      const NOINDEX_PREFIXES = [
        '/secret/',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
        '/dashboard',
        '/privacy',
        '/terms',
      ];
      if (NOINDEX_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }

      res.send(html);
    });
  }

  // Global error handler (MUST be last middleware)
  app.use(errorHandler);

  return app;
}
