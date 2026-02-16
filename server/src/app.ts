import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express from 'express';
import { Redis } from 'ioredis';
import { cspNonceMiddleware, createHelmetMiddleware, httpsRedirect } from './middleware/security.js';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { createSecretsRouter } from './routes/secrets.js';
import { env } from './config/env.js';

/**
 * Express app factory.
 *
 * Returns a configured Express app without starting the HTTP server.
 * This pattern enables supertest-based testing without port conflicts.
 *
 * Middleware order is critical for correctness:
 * 1. trust proxy  -- enables correct req.ip behind reverse proxy
 * 2. httpsRedirect -- redirect HTTP->HTTPS before any response
 * 3. cspNonce     -- generate nonce BEFORE helmet reads it
 * 4. helmet       -- set all security headers (CSP uses nonce from step 3)
 * 5. httpLogger   -- logging
 * 6. json parser  -- body parsing
 * 7. routes       -- API endpoints
 * 8. static assets + SPA catch-all (production only, when client/dist exists)
 * 9. errorHandler -- MUST be last
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

  // Parse JSON bodies with explicit size limit (100kb prevents abuse)
  app.use(express.json({ limit: '100kb' }));

  // Mount API routes (factory creates fresh router + rate limiter per app)
  app.use('/api/secrets', createSecretsRouter(redisClient));

  // Serve built frontend assets in production (or when client/dist exists)
  const clientDistPath = resolve(import.meta.dirname, '../../client/dist');
  if (existsSync(clientDistPath)) {
    // Serve static assets (JS, CSS, images) -- index:false because we handle HTML ourselves
    app.use(express.static(clientDistPath, { index: false }));

    // Read HTML template once at startup for nonce injection
    const htmlTemplate = readFileSync(
      resolve(clientDistPath, 'index.html'),
      'utf-8',
    );

    // SPA catch-all: inject per-request CSP nonce into HTML template
    // Express 5 requires named wildcard parameter (path-to-regexp v8+)
    app.get('{*path}', (req, res) => {
      const html = htmlTemplate.replaceAll(
        '__CSP_NONCE__',
        res.locals.cspNonce,
      );
      res.setHeader('Content-Type', 'text/html');

      // Defense-in-depth: HTTP-level noindex for secret routes.
      // Crawlers see this header before parsing HTML, preventing indexing
      // even if the client-side meta tag fails to render.
      if (req.path.startsWith('/secret/')) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }

      res.send(html);
    });
  }

  // Global error handler (MUST be last middleware)
  app.use(errorHandler);

  return app;
}
