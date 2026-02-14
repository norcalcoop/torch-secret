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
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error(
    { err: { message: err.message, stack: err.stack } },
    'Unhandled error',
  );

  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred.',
  });
}
