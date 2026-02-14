import pino from 'pino';
import pinoHttpModule from 'pino-http';
import { env } from '../config/env.js';

// pino-http is CJS — NodeNext resolves default as module namespace, not the function.
// The callable is on .default at runtime.
const pinoHttp = (pinoHttpModule as unknown as { default: typeof pinoHttpModule.default }).default ?? pinoHttpModule.default;

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

/** Redact secret IDs from URL paths to prevent log leakage */
function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(
    /\/api\/secrets\/[A-Za-z0-9_-]+/g,
    '/api/secrets/[REDACTED]'
  );
}

/** HTTP request logger middleware that redacts secret IDs from URL paths */
export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req(raw: Record<string, unknown>) {
      return {
        method: raw.method,
        url: redactUrl(raw.url as string | undefined),
      };
    },
  },
  // Do not log request/response bodies (could contain ciphertext)
  autoLogging: true,
  wrapSerializers: false,
});

export { redactUrl };
