import pino from 'pino';
import pinoHttpDefault from 'pino-http';
import type { Options, HttpLogger } from 'pino-http';
import { env } from '../config/env.js';

// pino-http is CJS. Under NodeNext the default import is the module namespace
// (callable lives at .default); under bundler+esModuleInterop it IS the callable.
// Use runtime detection with explicit type annotation.
const pinoHttpModule = pinoHttpDefault as unknown as
  | { default: (opts?: Options) => HttpLogger }
  | ((opts?: Options) => HttpLogger);
const pinoHttp: (opts?: Options) => HttpLogger =
  typeof (pinoHttpModule as { default: unknown }).default === 'function'
    ? (pinoHttpModule as { default: (opts?: Options) => HttpLogger }).default
    : (pinoHttpModule as (opts?: Options) => HttpLogger);

/** Base pino logger with sensitive header redaction */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[REDACTED]',
  },
});

/** Redact secret IDs from URL paths to prevent log leakage */
function redactUrl(url: string | undefined): string | undefined {
  return url?.replace(/\/api\/secrets\/[A-Za-z0-9_-]+/g, '/api/secrets/[REDACTED]');
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
