import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { pool } from './db/connection.js';
import { startExpirationWorker, stopExpirationWorker } from './workers/expiration-worker.js';

const app = buildApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'SecureShare server started');
  startExpirationWorker();
});

/**
 * Graceful shutdown handler.
 * Closes the HTTP server and database pool before exiting.
 */
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutdown signal received');
  stopExpirationWorker();

  server.close(() => {
    void pool.end().then(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
