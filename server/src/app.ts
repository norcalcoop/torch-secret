import express from 'express';
import { httpLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { secretsRouter } from './routes/secrets.js';

/**
 * Express app factory.
 *
 * Returns a configured Express app without starting the HTTP server.
 * This pattern enables supertest-based testing without port conflicts.
 */
export function buildApp() {
  const app = express();

  // HTTP request logging (pino-http with secret ID redaction)
  app.use(httpLogger);

  // Parse JSON bodies with explicit size limit (100kb prevents abuse)
  app.use(express.json({ limit: '100kb' }));

  // Mount API routes
  app.use('/api/secrets', secretsRouter);

  // Global error handler (MUST be last middleware)
  app.use(errorHandler);

  return app;
}
