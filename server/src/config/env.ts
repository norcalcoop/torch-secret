import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string().url().optional(),
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
  // Set to root domain (e.g. "localhost") in dev to enable cross-subdomain cookie sharing,
  // allowing the OAuth state cookie set on torchsecret.localhost to reach the localhost:3000
  // callback. Leave unset in production — Better Auth defaults to the request domain.
  BETTER_AUTH_COOKIE_DOMAIN: z.string().optional(),
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
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
