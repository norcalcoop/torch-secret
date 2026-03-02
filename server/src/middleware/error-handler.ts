import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * Global Express error handler.
 *
 * Logs the error internally but never leaks stack traces
 * or internal error details to the client. Request details
 * (which could contain secret IDs) are intentionally excluded
 * from the log entry.
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // 413: request payload too large (body-parser enforces express.json({ limit: '100kb' }))
  // Handled before logging to avoid polluting error logs with expected client errors.
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: 'payload_too_large',
      message: 'Request payload exceeds the 100KB limit.',
    });
    return;
  }

  // 503: PostgreSQL pool exhausted (connectionTimeoutMillis fired)
  // Signals the client to retry after 30 seconds rather than treating it as a bug.
  if (err.message?.includes('timeout exceeded when trying to connect')) {
    res.status(503).set('Retry-After', '30').json({
      error: 'service_unavailable',
      message: 'Database temporarily unavailable. Please retry in 30 seconds.',
    });
    return;
  }

  logger.error({ err: { message: err.message, stack: err.stack } }, 'Unhandled error');

  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred.',
  });
}
