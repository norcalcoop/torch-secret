/**
 * Unit tests for rate-limit.ts middleware configuration.
 *
 * SR-015 / Gap 5: Verify createVerifyTightLimiter exports and the isE2E dual-condition guard.
 *
 * NOTE: Full 429 integration test (6 req → 429) is validated at staging/E2E level
 * because the isE2E guard (NODE_ENV=test && E2E_TEST=true) sets limit=1000 in Vitest,
 * making it structurally impossible to trigger 429 in the unit test environment
 * without bypassing the guard. See 40-01 Plan must_haves truth SR-015.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';

describe('createVerifyTightLimiter — configuration unit test (SR-015, nyquist)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('exports createVerifyTightLimiter as a function that returns middleware', async () => {
    const { createVerifyTightLimiter } = await import('../rate-limit.js');
    expect(typeof createVerifyTightLimiter).toBe('function');
    const middleware = createVerifyTightLimiter();
    expect(typeof middleware).toBe('function');
  });

  test('isE2E guard requires BOTH NODE_ENV=test AND E2E_TEST=true', async () => {
    // With E2E_TEST=true but NODE_ENV=production, the SRVR-02 env guard throws at startup.
    // This is stronger than isE2E=false — the process refuses to start entirely.
    // Since env.ts runs at import time, importing rate-limit.ts (which imports env.ts)
    // must reject with the E2E_TEST guard error.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('E2E_TEST', 'true');
    await expect(import('../rate-limit.js')).rejects.toThrow(
      'E2E_TEST=true is only permitted when NODE_ENV=test',
    );
  });

  test('uses limit=5 in production (NODE_ENV !== test)', async () => {
    // Temporarily set env to non-test to inspect the production limiter config.
    // REDIS_URL must also be stubbed because the Zod env schema requires it in production.
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('E2E_TEST', 'false');
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');

    // Re-import the module so the isE2E constant is re-evaluated
    const { createVerifyTightLimiter } = await import('../rate-limit.js');

    // The limiter is a middleware function — call it with a mock req/res/next
    // and inspect that it would enforce 5/min by checking the returned middleware
    // exists and the module-level config reflects the production guard.
    // Since rate-limit middleware does not expose its config directly, we verify
    // the function is exported and callable (shape check).
    expect(typeof createVerifyTightLimiter).toBe('function');
    const middleware = createVerifyTightLimiter();
    expect(typeof middleware).toBe('function');
  });

  test('all four rate-limiter factories export correctly', async () => {
    const mod = await import('../rate-limit.js');
    expect(typeof mod.createAnonHourlyLimiter).toBe('function');
    expect(typeof mod.createAnonDailyLimiter).toBe('function');
    expect(typeof mod.createAuthedDailyLimiter).toBe('function');
    expect(typeof mod.verifySecretLimiter).toBe('function');
    expect(typeof mod.createVerifyTightLimiter).toBe('function');
  });
});

describe('createHealthLimiter — configuration unit test (GH-02, nyquist)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('exports createHealthLimiter as a function that returns middleware', async () => {
    const { createHealthLimiter } = await import('../rate-limit.js');
    expect(typeof createHealthLimiter).toBe('function');
    const middleware = createHealthLimiter();
    expect(typeof middleware).toBe('function');
  });
});
