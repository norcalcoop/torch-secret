import pino from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { env } from '../config/env.js';

/** Base pino logger with sensitive header redaction */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});

/** HTTP request logger middleware that redacts secret IDs from URL paths */
export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req(req: IncomingMessage) {
      return {
        method: req.method,
        // Replace secret IDs in /api/secrets/:id paths to prevent log leakage
        url: req.url?.replace(
          /\/api\/secrets\/[A-Za-z0-9_-]+/g,
          '/api/secrets/[REDACTED]'
        ),
      };
    },
  },
  // Do not log request/response bodies (could contain ciphertext)
  autoLogging: true,
  wrapSerializers: false,
});
