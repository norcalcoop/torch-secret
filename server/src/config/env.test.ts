/**
 * Tests for E2E_TEST startup guard in env.ts (SRVR-02).
 *
 * Wave 0: These tests WILL FAIL (RED) until env.ts adds the E2E_TEST field
 * and .refine() guard in Wave 1.
 *
 * Expected failure: E2E_TEST field not present in EnvSchema — the production
 * guard test passes (no throw) and the guard test fails (no error thrown).
 */
import { describe, test, expect, vi, afterEach } from 'vitest';

/**
 * Minimum required env fields for EnvSchema.parse to succeed.
 * These mirror the real schema requirements in env.ts.
 */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  LOG_LEVEL: 'info',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3000',
  RESEND_API_KEY: 'test-key',
  RESEND_FROM_EMAIL: 'test@test.com',
  STRIPE_SECRET_KEY: 'sk_test_123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  STRIPE_PRO_PRICE_ID: 'price_test',
  RESEND_AUDIENCE_ID: 'aud-test',
  IP_HASH_SALT: 'a'.repeat(16),
  LOOPS_API_KEY: 'loops-test',
};

describe('SRVR-02 — E2E_TEST startup guard (env.ts)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  test('E2E_TEST=true with NODE_ENV=test is permitted', async () => {
    vi.stubEnv('E2E_TEST', 'true');
    vi.stubEnv('NODE_ENV', 'test');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    // Should not throw — E2E_TEST=true is allowed when NODE_ENV=test
    await expect(import('./env.js')).resolves.toBeDefined();
  });

  test('E2E_TEST=true with NODE_ENV=production throws at startup', async () => {
    vi.stubEnv('E2E_TEST', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    // Should throw — E2E_TEST=true is forbidden in production
    await expect(import('./env.js')).rejects.toThrow(
      'E2E_TEST=true is only permitted when NODE_ENV=test',
    );
  });

  test('E2E_TEST=false with NODE_ENV=production succeeds', async () => {
    vi.stubEnv('E2E_TEST', 'false');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('NODE_ENV', 'production');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    // Should not throw — E2E_TEST=false is always permitted
    await expect(import('./env.js')).resolves.toBeDefined();
  });
});

describe('INFR-01 — REDIS_URL production guard (env.ts)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  test('NODE_ENV=production without REDIS_URL throws at startup', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    await expect(import('./env.js')).rejects.toThrow('REDIS_URL is required in production');
  });

  test('NODE_ENV=production with REDIS_URL set succeeds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    await expect(import('./env.js')).resolves.toBeDefined();
  });

  test('NODE_ENV=development without REDIS_URL succeeds (MemoryStore allowed in dev)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    Object.entries(BASE_ENV).forEach(([k, v]) => vi.stubEnv(k, v));
    await expect(import('./env.js')).resolves.toBeDefined();
  });
});
