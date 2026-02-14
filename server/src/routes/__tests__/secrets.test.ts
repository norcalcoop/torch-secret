import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { redactUrl } from '../../middleware/logger.js';

const app = buildApp();

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

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
