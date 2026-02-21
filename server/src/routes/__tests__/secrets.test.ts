import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets, users } from '../../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { redactUrl } from '../../middleware/logger.js';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Phase 26: Mock notification service to avoid real Resend HTTP calls
// ---------------------------------------------------------------------------
vi.mock('../../services/notification.service.js', () => ({
  sendSecretViewedNotification: vi.fn().mockResolvedValue(undefined),
}));

import { sendSecretViewedNotification } from '../../services/notification.service.js';

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

// Fresh app per test to isolate rate limiter state.
// Each buildApp() creates a new router with its own MemoryStore,
// so rate limit counters don't bleed across tests.
let app: Express;

beforeEach(() => {
  app = buildApp();
});

beforeAll(async () => {
  // Ensure secrets table exists (idempotent)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS secrets (
      id TEXT PRIMARY KEY,
      ciphertext TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      password_hash TEXT,
      password_attempts INTEGER NOT NULL DEFAULT 0
    )
  `);
});

afterEach(async () => {
  // Clean up test data between tests
  await db.delete(secrets);
});

afterAll(async () => {
  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

// ---------------------------------------------------------------------------
// Success Criterion 1: POST /api/secrets stores and returns ID
// ---------------------------------------------------------------------------
describe('POST /api/secrets', () => {
  test('creates secret and returns 21-char nanoid with 201 status', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
    expect(res.body.expiresAt).toBeDefined();
    // expiresAt should be a valid ISO date string
    expect(new Date(res.body.expiresAt).toISOString()).toBe(res.body.expiresAt);
  });

  // Success Criterion 1b: Validation
  test('rejects missing ciphertext with 400', async () => {
    const res = await request(app).post('/api/secrets').send({ expiresIn: '1h' }).expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('rejects invalid expiresIn with 400', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '2h' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('rejects empty ciphertext with 400', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: '', expiresIn: '1h' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('accepts expiresIn 1h for anonymous user (only valid anonymous option)', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    expect(res.body.id).toHaveLength(21);
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 2: GET returns ciphertext exactly once, then deletes
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id', () => {
  test('returns ciphertext on first retrieval with 200', async () => {
    // Create a secret
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const { id } = createRes.body;

    // Retrieve it
    const getRes = await request(app).get(`/api/secrets/${id}`).expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
    expect(getRes.body.expiresAt).toBeDefined();
  });

  test('returns 404 on second retrieval (atomic delete)', async () => {
    // Create a secret
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const { id } = createRes.body;

    // First retrieval -- should succeed
    await request(app).get(`/api/secrets/${id}`).expect(200);

    // Second retrieval -- should fail
    await request(app).get(`/api/secrets/${id}`).expect(404);
  });

  test('rejects invalid ID format with 400', async () => {
    const res = await request(app).get('/api/secrets/tooshort').expect(400);

    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 3: Identical error responses (anti-enumeration)
// ---------------------------------------------------------------------------
describe('anti-enumeration', () => {
  test('error response for consumed secret matches nonexistent secret exactly', async () => {
    // Create and consume a secret
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const { id } = createRes.body;

    // First GET consumes it
    await request(app).get(`/api/secrets/${id}`).expect(200);

    // Second GET -- consumed secret
    const consumedRes = await request(app).get(`/api/secrets/${id}`).expect(404);

    // GET a completely made-up 21-char ID -- nonexistent secret
    const nonexistentRes = await request(app).get('/api/secrets/xxxxxxxxxxxxxxxxxxx01').expect(404);

    // Response bodies must be byte-identical
    expect(consumedRes.body).toEqual(nonexistentRes.body);
    expect(consumedRes.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 4: Ciphertext zeroed before deletion (row fully destroyed)
// ---------------------------------------------------------------------------
describe('data destruction', () => {
  test('secret is fully destroyed after retrieval -- no trace remains', async () => {
    // Create a secret
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const { id } = createRes.body;

    // Retrieve via GET (consumes it)
    await request(app).get(`/api/secrets/${id}`).expect(200);

    // Verify row no longer exists in the database
    const rows = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 5: No secret IDs in logs (structural verification)
// ---------------------------------------------------------------------------
describe('logger redaction', () => {
  test('redacts secret IDs from URL paths', () => {
    const input = '/api/secrets/abc123def456ghi789012';
    const output = redactUrl(input);
    expect(output).toBe('/api/secrets/[REDACTED]');
  });

  test('redacts secret IDs with nanoid characters (hyphens, underscores)', () => {
    const input = '/api/secrets/Abc_-def123ghiJK56789';
    const output = redactUrl(input);
    expect(output).toBe('/api/secrets/[REDACTED]');
  });

  test('does not redact non-secret paths', () => {
    const input = '/api/health';
    const output = redactUrl(input);
    expect(output).toBe('/api/health');
  });

  test('handles undefined input', () => {
    const output = redactUrl(undefined);
    expect(output).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Password-protected secret creation
// ---------------------------------------------------------------------------
describe('POST /api/secrets with password', () => {
  test('creates password-protected secret and returns 201 with same shape as non-password secret', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'test-password-123' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
    expect(res.body.expiresAt).toBeDefined();
    expect(new Date(res.body.expiresAt).toISOString()).toBe(res.body.expiresAt);
  });

  test('stores password hash in database, not plaintext', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'test-password-123' })
      .expect(201);

    const { id } = createRes.body;

    // Direct DB query to verify hash format
    const [row] = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);

    expect(row.passwordHash).not.toBeNull();
    expect(row.passwordHash).not.toBe('test-password-123');
    expect(row.passwordHash!.startsWith('$argon2id$')).toBe(true);
  });

  test('rejects password over 128 characters with 400', async () => {
    const longPassword = 'a'.repeat(129);
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: longPassword })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
// Phase 5: GET /api/secrets/:id/meta
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id/meta', () => {
  test('returns requiresPassword true for password-protected secret', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'test-password-123' })
      .expect(201);

    const res = await request(app).get(`/api/secrets/${createRes.body.id}/meta`).expect(200);

    expect(res.body).toEqual({
      requiresPassword: true,
      passwordAttemptsRemaining: 3,
    });
  });

  test('returns requiresPassword false for non-password secret', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const res = await request(app).get(`/api/secrets/${createRes.body.id}/meta`).expect(200);

    expect(res.body).toEqual({
      requiresPassword: false,
      passwordAttemptsRemaining: 3,
    });
  });

  test('returns 404 for nonexistent secret', async () => {
    const res = await request(app).get('/api/secrets/xxxxxxxxxxxxxxxxxxx01/meta').expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });

  test('does not consume the secret (can be called multiple times)', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const { id } = createRes.body;

    // Call meta twice
    await request(app).get(`/api/secrets/${id}/meta`).expect(200);
    await request(app).get(`/api/secrets/${id}/meta`).expect(200);

    // Secret should still be retrievable via GET /:id (non-password)
    const getRes = await request(app).get(`/api/secrets/${id}`).expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  });
});

// ---------------------------------------------------------------------------
// Phase 5: GET /api/secrets/:id bypass prevention
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id bypass prevention', () => {
  test('returns 404 for password-protected secret (cannot bypass password)', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'test-password-123' })
      .expect(201);

    await request(app).get(`/api/secrets/${createRes.body.id}`).expect(404);
  });

  test('404 response for password-protected secret is identical to nonexistent secret', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'test-password-123' })
      .expect(201);

    // Password-bypass attempt
    const bypassRes = await request(app).get(`/api/secrets/${createRes.body.id}`).expect(404);

    // Nonexistent ID
    const nonexistentRes = await request(app).get('/api/secrets/xxxxxxxxxxxxxxxxxxx01').expect(404);

    // Response bodies must be identical (anti-enumeration)
    expect(bypassRes.body).toEqual(nonexistentRes.body);
  });
});

// ---------------------------------------------------------------------------
// Phase 5: POST /api/secrets/:id/verify
// ---------------------------------------------------------------------------
describe('POST /api/secrets/:id/verify', () => {
  test('returns ciphertext on correct password with 200', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({ password: 'correct-password' })
      .expect(200);

    expect(verifyRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
    expect(verifyRes.body.expiresAt).toBeDefined();
    expect(new Date(verifyRes.body.expiresAt).toISOString()).toBe(verifyRes.body.expiresAt);
  });

  test('destroys secret after successful verification (one-time use)', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    // First verify -- should succeed
    await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({ password: 'correct-password' })
      .expect(200);

    // Second verify -- secret is gone
    await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({ password: 'correct-password' })
      .expect(404);
  });

  test('returns 403 with attemptsRemaining on wrong password', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const verifyRes = await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({ password: 'wrong-password' })
      .expect(403);

    expect(verifyRes.body).toEqual({
      error: 'wrong_password',
      attemptsRemaining: 2,
    });
  });

  test('decrements attemptsRemaining on each wrong attempt', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // First wrong attempt
    const wrong1 = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-1' })
      .expect(403);
    expect(wrong1.body.attemptsRemaining).toBe(2);

    // Second wrong attempt
    const wrong2 = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-2' })
      .expect(403);
    expect(wrong2.body.attemptsRemaining).toBe(1);

    // Meta should reflect decremented attempts
    const metaRes = await request(app).get(`/api/secrets/${id}/meta`).expect(200);
    expect(metaRes.body.passwordAttemptsRemaining).toBe(1);
  });

  test('auto-destroys secret after 3 wrong attempts', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // Wrong attempt 1
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-1' }).expect(403);

    // Wrong attempt 2
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-2' }).expect(403);

    // Wrong attempt 3 -- triggers auto-destroy, returns 404 (0 attempts = destroyed)
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-3' }).expect(404);

    // Meta should return 404 (secret is gone)
    await request(app).get(`/api/secrets/${id}/meta`).expect(404);

    // Direct DB: row no longer exists
    const rows = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);
    expect(rows).toHaveLength(0);
  });

  test('correct password still works after 2 wrong attempts', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // 2 wrong attempts
    const wrong1 = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-1' })
      .expect(403);
    expect(wrong1.body.attemptsRemaining).toBe(2);

    const wrong2 = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-2' })
      .expect(403);
    expect(wrong2.body.attemptsRemaining).toBe(1);

    // Correct password on 3rd attempt -- should still succeed
    const verifyRes = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'correct-password' })
      .expect(200);

    expect(verifyRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  });

  test('returns 404 for nonexistent secret', async () => {
    await request(app)
      .post('/api/secrets/xxxxxxxxxxxxxxxxxxx01/verify')
      .send({ password: 'any-password' })
      .expect(404);
  });

  test('returns 400 for missing password in body', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const res = await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({})
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
// Phase 26: notify persistence and notification dispatch
// ---------------------------------------------------------------------------

/**
 * Helper: register + sign in to get a session cookie.
 * Returns { sessionCookie, userId } for the created user.
 * Mirrors the same helper pattern from dashboard.test.ts.
 */
async function createUserAndSignIn(
  appInstance: Express,
  email: string,
  password: string,
  name: string,
): Promise<{ sessionCookie: string; userId: string }> {
  await request(appInstance)
    .post('/api/auth/sign-up/email')
    .send({ email, password, name })
    .expect(200);

  const signInRes = await request(appInstance)
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200);

  const rawCookiesHeader = signInRes.headers['set-cookie'] as unknown;
  const rawCookies: string[] = Array.isArray(rawCookiesHeader)
    ? (rawCookiesHeader as string[])
    : typeof rawCookiesHeader === 'string'
      ? [rawCookiesHeader]
      : [];
  const sessionCookie = rawCookies
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('better-auth.session_token='));
  if (!sessionCookie) {
    throw new Error('No session cookie found in sign-in response');
  }

  const userId = signInRes.body.user?.id as string;
  if (!userId) {
    throw new Error('No userId found in sign-in response body');
  }

  return { sessionCookie, userId };
}

describe('Phase 26: notify persistence and notification dispatch', () => {
  let notifyTestApp: Express;
  let notifyUserSessionCookie: string;
  let notifyUserId: string;

  const NOTIFY_TEST_EMAIL = 'notify-test-user@test.secureshare.dev';
  const NOTIFY_TEST_PASSWORD = 'password-for-notify-test-123';

  beforeAll(async () => {
    notifyTestApp = buildApp();

    const result = await createUserAndSignIn(
      notifyTestApp,
      NOTIFY_TEST_EMAIL,
      NOTIFY_TEST_PASSWORD,
      'Notify Test User',
    );
    notifyUserSessionCookie = result.sessionCookie;
    notifyUserId = result.userId;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.email, NOTIFY_TEST_EMAIL));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sendSecretViewedNotification).mockResolvedValue(undefined);
  });

  test('createSecret persists notify=true when userId provided', async () => {
    const createRes = await request(notifyTestApp)
      .post('/api/secrets')
      .set('Cookie', notifyUserSessionCookie)
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', notify: true })
      .expect(201);

    const { id } = createRes.body;

    // Verify DB row has notify=true and userId set
    const [row] = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);
    expect(row).toBeDefined();
    expect(row.notify).toBe(true);
    expect(row.userId).toBe(notifyUserId);
  });

  test('createSecret stores notify=false for anonymous secrets even if client sends notify:true', async () => {
    // POST without auth cookie, body includes notify:true
    const createRes = await request(notifyTestApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', notify: true })
      .expect(201);

    const { id } = createRes.body;

    // Route guard enforces notify=false for anonymous users
    const [row] = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);
    expect(row).toBeDefined();
    expect(row.notify).toBe(false);
    expect(row.userId).toBeNull();
  });

  test('retrieveAndDestroy dispatches notification when notify=true and userId set', async () => {
    // Insert a user-owned secret with notify=true directly via DB
    const secretId = nanoid();
    await db.insert(secrets).values({
      id: secretId,
      ciphertext: VALID_CIPHERTEXT,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: notifyUserId,
      notify: true,
      status: 'active',
    });

    // GET /api/secrets/:id triggers retrieveAndDestroy
    const getRes = await request(notifyTestApp).get(`/api/secrets/${secretId}`).expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);

    // Allow fire-and-forget to resolve
    await new Promise((resolve) => setImmediate(resolve));

    // sendSecretViewedNotification should have been called with an email string and a Date
    expect(sendSecretViewedNotification).toHaveBeenCalledOnce();
    const [emailArg, dateArg] = vi.mocked(sendSecretViewedNotification).mock.calls[0];
    expect(typeof emailArg).toBe('string');
    expect(emailArg).toBe(NOTIFY_TEST_EMAIL);
    expect(dateArg).toBeInstanceOf(Date);
  });

  test('retrieveAndDestroy does not dispatch notification when notify=false', async () => {
    // Insert a user-owned secret with notify=false
    const secretId = nanoid();
    await db.insert(secrets).values({
      id: secretId,
      ciphertext: VALID_CIPHERTEXT,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: notifyUserId,
      notify: false,
      status: 'active',
    });

    await request(notifyTestApp).get(`/api/secrets/${secretId}`).expect(200);

    await new Promise((resolve) => setImmediate(resolve));

    expect(sendSecretViewedNotification).not.toHaveBeenCalled();
  });

  test('retrieveAndDestroy does not dispatch notification for anonymous secrets (no userId)', async () => {
    // Insert anonymous secret (userId=null, notify=false enforced by route)
    const secretId = nanoid();
    await db.insert(secrets).values({
      id: secretId,
      ciphertext: VALID_CIPHERTEXT,
      expiresAt: new Date(Date.now() + 86_400_000),
      userId: null,
      notify: false,
      status: 'active',
    });

    await request(notifyTestApp).get(`/api/secrets/${secretId}`).expect(200);

    await new Promise((resolve) => setImmediate(resolve));

    expect(sendSecretViewedNotification).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Phase 27-01: Anonymous rate limits (CONV-01)
// ---------------------------------------------------------------------------
describe('POST /api/secrets — anonymous rate limits', () => {
  let rateLimitApp: Express;

  beforeEach(() => {
    // Fresh app per test — each buildApp() creates a new MemoryStore so
    // rate limit counters do not bleed between tests.
    rateLimitApp = buildApp();
  });

  test('anonymous user is limited to 3 secrets per hour', async () => {
    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      await request(rateLimitApp)
        .post('/api/secrets')
        .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
        .expect(201);
    }

    // 4th request should be rate limited
    const limitedRes = await request(rateLimitApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(429);

    expect(limitedRes.body.error).toBe('rate_limited');
    // RateLimit-Reset header must be a numeric string (Unix timestamp)
    const resetHeader = limitedRes.headers['ratelimit-reset'];
    expect(resetHeader).toBeDefined();
    expect(Number.isFinite(parseInt(resetHeader, 10))).toBe(true);
  });

  test('authenticated user is not subject to hourly anonymous limit', async () => {
    // Sign up and sign in to get a session cookie
    const email = `rl-authed-test-${Date.now()}@test.secureshare.dev`;
    const password = 'password-for-rl-test-123';
    const { sessionCookie } = await createUserAndSignIn(
      rateLimitApp,
      email,
      password,
      'RL Test User',
    );

    try {
      // Send 4 POST requests with session cookie — authenticated users bypass the 3/hour anon limit
      for (let i = 0; i < 4; i++) {
        await request(rateLimitApp)
          .post('/api/secrets')
          .set('Cookie', sessionCookie)
          .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
          .expect(201);
      }
    } finally {
      await db.delete(users).where(eq(users.email, email));
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 27-01: expiresIn tier enforcement (CONV-02, CONV-03)
// ---------------------------------------------------------------------------
describe('POST /api/secrets — expiresIn tier enforcement', () => {
  let tierApp: Express;

  beforeEach(() => {
    tierApp = buildApp();
  });

  test('anonymous user cannot set expiresIn to 24h', async () => {
    const res = await request(tierApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('anonymous user cannot set expiresIn to 7d', async () => {
    const res = await request(tierApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '7d' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('anonymous user cannot set expiresIn to 30d', async () => {
    const res = await request(tierApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '30d' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('anonymous user can set expiresIn to 1h', async () => {
    const res = await request(tierApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    expect(res.body.id).toHaveLength(21);
  });

  test('authenticated user can set expiresIn to 7d', async () => {
    const email = `tier-7d-test-${Date.now()}@test.secureshare.dev`;
    const password = 'password-for-tier-test-123';
    const { sessionCookie } = await createUserAndSignIn(tierApp, email, password, 'Tier Test User');

    try {
      const res = await request(tierApp)
        .post('/api/secrets')
        .set('Cookie', sessionCookie)
        .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '7d' })
        .expect(201);

      expect(res.body.id).toHaveLength(21);
    } finally {
      await db.delete(users).where(eq(users.email, email));
    }
  });

  test('authenticated user cannot set expiresIn to 30d', async () => {
    const email = `tier-30d-test-${Date.now()}@test.secureshare.dev`;
    const password = 'password-for-tier-test-123';
    const { sessionCookie } = await createUserAndSignIn(tierApp, email, password, 'Tier Test User');

    try {
      const res = await request(tierApp)
        .post('/api/secrets')
        .set('Cookie', sessionCookie)
        .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '30d' })
        .expect(400);

      expect(res.body.error).toBe('validation_error');
    } finally {
      await db.delete(users).where(eq(users.email, email));
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Anti-enumeration (password)
// ---------------------------------------------------------------------------
describe('anti-enumeration (password)', () => {
  test('destroyed secret response is identical to nonexistent secret response', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // Destroy via 3 wrong attempts
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-1' }).expect(403);
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-2' }).expect(403);
    await request(app).post(`/api/secrets/${id}/verify`).send({ password: 'wrong-3' }).expect(404);

    // POST verify to destroyed ID
    const destroyedVerifyRes = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'any-password' })
      .expect(404);

    // POST verify to fake ID
    const fakeVerifyRes = await request(app)
      .post('/api/secrets/xxxxxxxxxxxxxxxxxxx01/verify')
      .send({ password: 'any-password' })
      .expect(404);

    // Response bodies must be identical
    expect(destroyedVerifyRes.body).toEqual(fakeVerifyRes.body);

    // Also verify via meta endpoint
    const destroyedMetaRes = await request(app).get(`/api/secrets/${id}/meta`).expect(404);

    const fakeMetaRes = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01/meta')
      .expect(404);

    expect(destroyedMetaRes.body).toEqual(fakeMetaRes.body);
  });
});
