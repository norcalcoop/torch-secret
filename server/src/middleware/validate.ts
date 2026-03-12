import type { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';

/**
 * Express middleware factory that validates request body against a Zod schema.
 *
 * On validation failure: responds 400 with structured error details.
 * On success: replaces req.body with parsed (type-safe) data and calls next().
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: 'validation_error',
        details: z.flattenError(result.error),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates query string params against a Zod schema.
 *
 * On validation failure: responds 400 with structured error details.
 * On success: replaces req.validatedQuery with parsed (type-safe, defaulted) data and calls next().
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: 'validation_error',
        details: z.flattenError(result.error),
      });
      return;
    }

    // Attach parsed data — cast needed because Express types req.query as ParsedQs
    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}

/**
 * Express middleware factory that validates request params against a Zod schema.
 *
 * On validation failure: responds 400 with structured error details.
 * On success: calls next().
 */
export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json({
        error: 'validation_error',
        details: z.flattenError(result.error),
      });
      return;
    }

    next();
  };
}
