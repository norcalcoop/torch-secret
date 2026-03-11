import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z
  .object({
    DATABASE_URL: z.string().startsWith('postgres'),
    PORT: z.coerce.number().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    REDIS_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    FORCE_HTTPS: z
      .string()
      .default('false')
      .transform((v) => v === 'true' || v === '1'),

    // === Authentication (Phase 22) ===
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
    BETTER_AUTH_URL: z.string().url(),
    // Frontend origin for email links. In dev, set to Vite's port (e.g. http://localhost:5173)
    // so reset/verify links land on the dev server, not Express. In production, omit or set
    // to the same value as BETTER_AUTH_URL.
    APP_URL: z.string().url().default('http://localhost:3000'),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().min(1),

    // === Stripe Billing (Phase 34) ===
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    STRIPE_PRO_PRICE_ID: z.string().startsWith('price_'),

    // === Email Capture (Phase 36) ===
    RESEND_AUDIENCE_ID: z.string().min(1),
    /** Salt for SHA-256 IP hashing — prevents rainbow-table reversal of IPv4 space (ECAP-05) */
    IP_HASH_SALT: z.string().min(16),

    // === Loops Onboarding (Phase 37) ===
    LOOPS_API_KEY: z.string().min(1),

    // === E2E test mode guard (Phase 65, SRVR-02) ===
    E2E_TEST: z.string().optional().default('false'),
  })
  .refine((data) => !(data.E2E_TEST === 'true' && data.NODE_ENV !== 'test'), {
    message:
      'E2E_TEST=true is only permitted when NODE_ENV=test. Refusing to start to prevent rate-limit bypass on non-test environments.',
    path: ['E2E_TEST'],
  })
  // INFR-01: Redis is required in production. MemoryStore is not shared across instances
  // and breaks rate limiting correctness under horizontal scaling.
  .refine((data) => !(data.NODE_ENV === 'production' && !data.REDIS_URL), {
    message:
      'REDIS_URL is required in production. MemoryStore is dev-only and unsafe for multi-instance deployments.',
    path: ['REDIS_URL'],
  });

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
