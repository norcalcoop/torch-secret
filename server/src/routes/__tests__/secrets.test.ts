import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { redactUrl } from '../../middleware/logger.js';

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
    expect(res.body.expiresAt).toBeDefined();
    // expiresAt should be a valid ISO date string
    expect(new Date(res.body.expiresAt).toISOString()).toBe(res.body.expiresAt);
  });

  // Success Criterion 1b: Validation
  test('rejects missing ciphertext with 400', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ expiresIn: '24h' })
      .expect(400);

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
      .send({ ciphertext: '', expiresIn: '24h' })
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });

  test('accepts all valid expiresIn options', async () => {
    for (const expiresIn of ['1h', '24h', '7d', '30d']) {
      const res = await request(app)
        .post('/api/secrets')
        .send({ ciphertext: VALID_CIPHERTEXT, expiresIn })
        .expect(201);

      expect(res.body.id).toHaveLength(21);
    }
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // Retrieve it
    const getRes = await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
    expect(getRes.body.expiresAt).toBeDefined();
  });

  test('returns 404 on second retrieval (atomic delete)', async () => {
    // Create a secret
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // First retrieval -- should succeed
    await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

    // Second retrieval -- should fail
    await request(app)
      .get(`/api/secrets/${id}`)
      .expect(404);
  });

  test('rejects invalid ID format with 400', async () => {
    const res = await request(app)
      .get('/api/secrets/tooshort')
      .expect(400);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // First GET consumes it
    await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

    // Second GET -- consumed secret
    const consumedRes = await request(app)
      .get(`/api/secrets/${id}`)
      .expect(404);

    // GET a completely made-up 21-char ID -- nonexistent secret
    const nonexistentRes = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
      .expect(404);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // Retrieve via GET (consumes it)
    await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'test-password-123' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(21);
    expect(res.body.expiresAt).toBeDefined();
    expect(new Date(res.body.expiresAt).toISOString()).toBe(res.body.expiresAt);
  });

  test('stores password hash in database, not plaintext', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'test-password-123' })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: longPassword })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'test-password-123' })
      .expect(201);

    const res = await request(app)
      .get(`/api/secrets/${createRes.body.id}/meta`)
      .expect(200);

    expect(res.body).toEqual({
      requiresPassword: true,
      passwordAttemptsRemaining: 3,
    });
  });

  test('returns requiresPassword false for non-password secret', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const res = await request(app)
      .get(`/api/secrets/${createRes.body.id}/meta`)
      .expect(200);

    expect(res.body).toEqual({
      requiresPassword: false,
      passwordAttemptsRemaining: 3,
    });
  });

  test('returns 404 for nonexistent secret', async () => {
    const res = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01/meta')
      .expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });

  test('does not consume the secret (can be called multiple times)', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // Call meta twice
    await request(app).get(`/api/secrets/${id}/meta`).expect(200);
    await request(app).get(`/api/secrets/${id}/meta`).expect(200);

    // Secret should still be retrievable via GET /:id (non-password)
    const getRes = await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'test-password-123' })
      .expect(201);

    await request(app)
      .get(`/api/secrets/${createRes.body.id}`)
      .expect(404);
  });

  test('404 response for password-protected secret is identical to nonexistent secret', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'test-password-123' })
      .expect(201);

    // Password-bypass attempt
    const bypassRes = await request(app)
      .get(`/api/secrets/${createRes.body.id}`)
      .expect(404);

    // Nonexistent ID
    const nonexistentRes = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01')
      .expect(404);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
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
    const metaRes = await request(app)
      .get(`/api/secrets/${id}/meta`)
      .expect(200);
    expect(metaRes.body.passwordAttemptsRemaining).toBe(1);
  });

  test('auto-destroys secret after 3 wrong attempts', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // Wrong attempt 1
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-1' })
      .expect(403);

    // Wrong attempt 2
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-2' })
      .expect(403);

    // Wrong attempt 3 -- triggers auto-destroy, returns 404 (0 attempts = destroyed)
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-3' })
      .expect(404);

    // Meta should return 404 (secret is gone)
    await request(app)
      .get(`/api/secrets/${id}/meta`)
      .expect(404);

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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
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
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
      .expect(201);

    const res = await request(app)
      .post(`/api/secrets/${createRes.body.id}/verify`)
      .send({})
      .expect(400);

    expect(res.body.error).toBe('validation_error');
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Anti-enumeration (password)
// ---------------------------------------------------------------------------
describe('anti-enumeration (password)', () => {
  test('destroyed secret response is identical to nonexistent secret response', async () => {
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h', password: 'correct-password' })
      .expect(201);

    const { id } = createRes.body;

    // Destroy via 3 wrong attempts
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-1' })
      .expect(403);
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-2' })
      .expect(403);
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'wrong-3' })
      .expect(404);

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
    const destroyedMetaRes = await request(app)
      .get(`/api/secrets/${id}/meta`)
      .expect(404);

    const fakeMetaRes = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01/meta')
      .expect(404);

    expect(destroyedMetaRes.body).toEqual(fakeMetaRes.body);
  });
});
