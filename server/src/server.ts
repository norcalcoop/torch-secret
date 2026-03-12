import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './middleware/logger.js';
import { pool } from './db/connection.js';
import { startExpirationWorker, stopExpirationWorker } from './workers/expiration-worker.js';
import { Redis } from 'ioredis';

// Create Redis client once — shared between rate limiters (via buildApp) and expiration worker
let redisClient: InstanceType<typeof Redis> | undefined;
if (env.REDIS_URL) {
  redisClient = new Redis(env.REDIS_URL);
}

const app = buildApp(redisClient);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Torch Secret server started');
  startExpirationWorker(redisClient);
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

/**
 * Fatal process event handler.
 *
 * Registered for both 'unhandledRejection' and 'uncaughtException'.
 * Logs at fatal level (includes stack trace via Pino serializer) and exits immediately.
 *
 * Intentionally does NOT call server.close() or pool.end() — graceful shutdown
 * risks deadlocking if the error originated in those code paths.
 * The process manager (Docker/Render) detects the exit code and auto-restarts.
 */
function fatalHandler(err: unknown, origin: string): never {
  logger.fatal({ err, origin }, 'fatal process event');
  process.exit(1);
}

process.on('unhandledRejection', (reason) => fatalHandler(reason, 'unhandledRejection'));
process.on('uncaughtException', (error, origin) => fatalHandler(error, origin));

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
