import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets } from '../../db/schema.js';
import { sql } from 'drizzle-orm';

// Valid base64-encoded ciphertext for test payloads
const VALID_CIPHERTEXT = 'dGVzdA==';

// Shared app instance for non-rate-limit tests.
// Rate limit tests use their own fresh buildApp() instances.
let app: Express;

beforeAll(async () => {
  app = buildApp();

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
// Success Criterion 1: Content-Security-Policy with nonce
// ---------------------------------------------------------------------------
describe('Success Criterion 1: Content-Security-Policy with nonce', () => {
  test('CSP header includes nonce-based script-src', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  test('CSP nonce is unique per request', async () => {
    const res1 = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const res2 = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const csp1 = res1.headers['content-security-policy'];
    const csp2 = res2.headers['content-security-policy'];

    // Extract nonces using regex
    const nonceRegex = /nonce-([a-f0-9]+)/;
    const nonce1 = csp1.match(nonceRegex)?.[1];
    const nonce2 = csp2.match(nonceRegex)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  test('CSP header includes style-src with nonce', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("style-src 'self' 'nonce-");
  });

  test('CSP blocks object and frame embedding', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 2: Rate limiting on POST /api/secrets
// ---------------------------------------------------------------------------
describe('Success Criterion 2: Rate limiting on POST /api/secrets', () => {
  test('returns 429 after 10 POST requests in same window', async () => {
    // Fresh app instance so rate limit counter starts at 0
    const rateLimitApp = buildApp();

    // First 10 requests should all succeed
    for (let i = 0; i < 10; i++) {
      const res = await request(rateLimitApp)
        .post('/api/secrets')
        .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' });
      expect(res.status).toBe(201);
    }

    // 11th request should be rate-limited
    const res = await request(rateLimitApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('rate_limited');
  }, 30000); // Extended timeout for 11 sequential requests

  test('GET requests are not rate-limited', async () => {
    // Fresh app instance with its own rate limiter
    const rateLimitApp = buildApp();

    // Send 15 GET requests -- none should return 429
    // (they will return 400 for bad ID format, which is expected)
    for (let i = 0; i < 15; i++) {
      const res = await request(rateLimitApp)
        .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01');
      expect(res.status).not.toBe(429);
    }
  });

  test('rate limit headers present on responses', async () => {
    const rateLimitApp = buildApp();

    const res = await request(rateLimitApp)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    // draft-7 uses a single combined "RateLimit" header (lowercase in supertest)
    expect(res.headers['ratelimit']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 3: HTTPS redirect and HSTS
// ---------------------------------------------------------------------------
describe('Success Criterion 3: HTTPS redirect and HSTS', () => {
  test('HSTS header correctly conditional on environment', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    if (process.env.NODE_ENV === 'production') {
      // In production, HSTS should be present
      expect(res.headers['strict-transport-security']).toBeDefined();
    } else {
      // In non-production (test/development), HSTS should be disabled
      // to prevent browser lockout without TLS
      expect(res.headers['strict-transport-security']).toBeUndefined();
    }
  });

  test('HTTPS redirect skipped in non-production', async () => {
    // In test environment, a plain HTTP request should NOT redirect
    const res = await request(app)
      .get('/api/secrets/xxxxxxxxxxxxxxxxxxx01');

    // Should NOT be a 301 redirect -- confirms HTTPS redirect is skipped
    expect(res.status).not.toBe(301);
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 4: Referrer-Policy
// ---------------------------------------------------------------------------
describe('Success Criterion 4: Referrer-Policy', () => {
  test('Referrer-Policy is no-referrer on POST response', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  test('Referrer-Policy is no-referrer on GET response', async () => {
    // Create a secret first
    const createRes = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    const { id } = createRes.body;

    // Retrieve it and check referrer policy
    const getRes = await request(app)
      .get(`/api/secrets/${id}`)
      .expect(200);

    expect(getRes.headers['referrer-policy']).toBe('no-referrer');
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 5: Same-origin CORS
// ---------------------------------------------------------------------------
describe('Success Criterion 5: Same-origin CORS', () => {
  test('no Access-Control-Allow-Origin header on same-origin request', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    // No CORS headers should be present (same-origin enforcement)
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('no Access-Control-Allow-Origin header on cross-origin request', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .set('Origin', 'https://evil.com')
      .send({ ciphertext: VALID_CIPHERTEXT, expiresIn: '24h' })
      .expect(201);

    // Even with a foreign Origin, no CORS headers should be sent
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('preflight OPTIONS from foreign origin gets no CORS headers', async () => {
    const res = await request(app)
      .options('/api/secrets')
      .set('Origin', 'https://attacker.com')
      .set('Access-Control-Request-Method', 'POST');

    // No CORS headers in the response
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Success Criterion 6: X-Robots-Tag for secret routes
// ---------------------------------------------------------------------------
describe('Success Criterion 6: X-Robots-Tag', () => {
  // The SPA catch-all only registers when client/dist/index.html exists.
  // Create a minimal dist directory if it doesn't exist so tests are
  // self-contained and work in CI without a prior client build.
  const clientDistPath = resolve(import.meta.dirname, '../../../../client/dist');
  const indexPath = resolve(clientDistPath, 'index.html');
  let createdDist = false;
  let spaApp: Express;

  beforeAll(() => {
    if (!existsSync(indexPath)) {
      mkdirSync(clientDistPath, { recursive: true });
      writeFileSync(
        indexPath,
        '<!DOCTYPE html><html><head></head><body>__CSP_NONCE__</body></html>',
      );
      createdDist = true;
    }
    // Build a fresh app instance with the SPA catch-all active
    spaApp = buildApp();
  });

  afterAll(() => {
    // Clean up temp dist only if we created it
    if (createdDist) {
      rmSync(clientDistPath, { recursive: true, force: true });
    }
  });

  test('sets X-Robots-Tag: noindex, nofollow for /secret/ routes', async () => {
    const res = await request(spaApp).get('/secret/abc123');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
  });

  test('does not set X-Robots-Tag for homepage', async () => {
    const res = await request(spaApp).get('/');
    expect(res.headers['x-robots-tag']).toBeUndefined();
  });

  test('does not set X-Robots-Tag for non-secret SPA routes', async () => {
    const res = await request(spaApp).get('/about');
    expect(res.headers['x-robots-tag']).toBeUndefined();
  });
});
