import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets } from '../../db/schema.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '../../services/password.service.js';

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

// Nonexistent 21-char ID (matches nanoid format)
const NONEXISTENT_ID = 'xxxxxxxxxxxxxxxxxxx01';

// Pre-hashed password for direct DB inserts (computed once in beforeAll)
let TEST_PASSWORD_HASH: string;

// Fresh app per test to isolate rate limiter state
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

  // Pre-hash a test password for direct DB inserts
  TEST_PASSWORD_HASH = await hashPassword('test-password');
});

afterEach(async () => {
  // Clean up test data between tests
  await db.delete(secrets);
});

afterAll(async () => {
  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

/**
 * Helper: insert an expired secret directly into the database.
 * Uses a past expiresAt to bypass API validation and test expiration immediately.
 */
async function insertExpiredSecret(opts?: { passwordHash?: string | null }): Promise<string> {
  const id = nanoid();
  await db.insert(secrets).values({
    id,
    ciphertext: VALID_CIPHERTEXT,
    expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
    passwordHash: opts?.passwordHash ?? null,
  });
  return id;
}

// ---------------------------------------------------------------------------
// Expiration enforcement: GET /api/secrets/:id
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id expiration', () => {
  test('returns 404 for expired non-password secret', async () => {
    const id = await insertExpiredSecret();

    const res = await request(app).get(`/api/secrets/${id}`).expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });

  test('non-expired secret is still retrievable (expiration guard does not block valid secrets)', async () => {
    // Create via normal API flow (future expiration)
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '1h' })
      .expect(201);

    const getRes = await request(app).get(`/api/secrets/${createRes.body.id}`).expect(200);

    expect(getRes.body.ciphertext).toBe(VALID_CIPHERTEXT);
  });

  test('expired secret is cleaned up from database after retrieval attempt', async () => {
    const id = await insertExpiredSecret();

    // Attempt retrieval -- should get 404
    await request(app).get(`/api/secrets/${id}`).expect(404);

    // Direct DB query: row should be gone (inline cleanup in transaction)
    const rows = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Expiration enforcement: GET /api/secrets/:id/meta
// ---------------------------------------------------------------------------
describe('GET /api/secrets/:id/meta expiration', () => {
  test('returns 404 for expired secret', async () => {
    const id = await insertExpiredSecret();

    const res = await request(app).get(`/api/secrets/${id}/meta`).expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });

  test('returns 404 for expired password-protected secret', async () => {
    const id = await insertExpiredSecret({ passwordHash: TEST_PASSWORD_HASH });

    const res = await request(app).get(`/api/secrets/${id}/meta`).expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });
});

// ---------------------------------------------------------------------------
// Expiration enforcement: POST /api/secrets/:id/verify
// ---------------------------------------------------------------------------
describe('POST /api/secrets/:id/verify expiration', () => {
  test('returns 404 for expired password-protected secret', async () => {
    const id = await insertExpiredSecret({ passwordHash: TEST_PASSWORD_HASH });

    const res = await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'test-password' })
      .expect(404);

    expect(res.body).toEqual({
      error: 'not_found',
      message: 'This secret does not exist, has already been viewed, or has expired.',
    });
  });

  test('expired password-protected secret is cleaned up from database after verify attempt', async () => {
    const id = await insertExpiredSecret({ passwordHash: TEST_PASSWORD_HASH });

    // Attempt verification -- should get 404
    await request(app)
      .post(`/api/secrets/${id}/verify`)
      .send({ password: 'test-password' })
      .expect(404);

    // Direct DB query: row should be gone (inline cleanup in transaction)
    const rows = await db
      .select()
      .from(secrets)
      .where(sql`${secrets.id} = ${id}`);

    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Anti-enumeration: expired secret responses identical to nonexistent
// ---------------------------------------------------------------------------
describe('anti-enumeration (expiration)', () => {
  test('expired secret 404 response is identical to nonexistent secret response across all endpoints', async () => {
    // Insert expired secrets for each endpoint test
    const expiredId1 = await insertExpiredSecret();
    const expiredId2 = await insertExpiredSecret();
    const expiredIdPw = await insertExpiredSecret({ passwordHash: TEST_PASSWORD_HASH });

    // --- GET /api/secrets/:id ---
    const expiredGetRes = await request(app).get(`/api/secrets/${expiredId1}`).expect(404);

    const nonexistentGetRes = await request(app).get(`/api/secrets/${NONEXISTENT_ID}`).expect(404);

    expect(expiredGetRes.body).toEqual(nonexistentGetRes.body);

    // --- GET /api/secrets/:id/meta ---
    const expiredMetaRes = await request(app).get(`/api/secrets/${expiredId2}/meta`).expect(404);

    const nonexistentMetaRes = await request(app)
      .get(`/api/secrets/${NONEXISTENT_ID}/meta`)
      .expect(404);

    expect(expiredMetaRes.body).toEqual(nonexistentMetaRes.body);

    // --- POST /api/secrets/:id/verify ---
    const expiredVerifyRes = await request(app)
      .post(`/api/secrets/${expiredIdPw}/verify`)
      .send({ password: 'any-password' })
      .expect(404);

    const nonexistentVerifyRes = await request(app)
      .post(`/api/secrets/${NONEXISTENT_ID}/verify`)
      .send({ password: 'any-password' })
      .expect(404);

    expect(expiredVerifyRes.body).toEqual(nonexistentVerifyRes.body);
  });
});
