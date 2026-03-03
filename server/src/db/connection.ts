import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

const { Pool } = pg;

/**
 * PostgreSQL connection pool with explicit resource limits (SR-016).
 *
 * max: 10                       — bounds the pool; prevents DB connection exhaustion
 * idleTimeoutMillis: 30s        — releases idle connections promptly
 * connectionTimeoutMillis: 5s   — fails fast on exhaustion instead of hanging;
 *   error propagates to errorHandler which returns 503 + Retry-After: 30
 * options: statement_timeout=10s — kills runaway queries at the DB level
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  options: '-c statement_timeout=10000',
});

/**
 * Log idle client errors as warnings (not crashes).
 *
 * Pool emits 'error' for idle client disconnections (e.g., DB restart).
 * Without this listener, the error would be an uncaught EventEmitter exception.
 * Connection timeout errors (pool exhausted) are thrown at checkout — they
 * propagate via Express error handler (see middleware/error-handler.ts).
 */
pool.on('error', (err: Error) => {
  logger.warn({ err: err.message }, 'pg_pool_idle_client_error');
});

/** Drizzle ORM instance with typed schema */
export const db = drizzle({ client: pool, schema });
