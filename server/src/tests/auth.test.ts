import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../app.js';
import { db } from '../db/connection.js';
import { pool } from '../db/connection.js';
import { users, verification } from '../db/schema.js';
import { like, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Test setup
//
// NODE_ENV=test disables requireEmailVerification in auth.ts.
// This allows sign-in immediately after sign-up without email verification.
//
// Uses distinct @test-auth.example.com email domain to avoid colliding with
// any other test data from other test suites.
// ---------------------------------------------------------------------------

let app: Express;

beforeEach(() => {
  // Fresh app per test — each buildApp() creates a new router with its own
  // MemoryStore so rate limit counters don't bleed across tests.
  app = buildApp();
});

async function cleanupTestUsers() {
  // Delete in FK dependency order to avoid constraint violations
  // verification table has no FK to users; sessions/accounts cascade from users
  await db.delete(verification).where(like(verification.identifier, '%@test-auth.example.com'));

  // Get user IDs before deleting so we can cascade sessions/accounts if needed
  // (Better Auth uses onDelete: cascade on sessions and accounts — direct delete is safe)
  await db.execute(
    sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test-auth.example.com')`,
  );
  await db.execute(
    sql`DELETE FROM accounts WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test-auth.example.com')`,
  );
  await db.delete(users).where(like(users.email, '%@test-auth.example.com'));
}

beforeEach(async () => {
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

// ---------------------------------------------------------------------------
// Helper: sign up a test user and return the session cookie string
// ---------------------------------------------------------------------------
async function signUpAndGetCookie(email: string, password: string, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/sign-up/email').send({ email, password, name });

  expect(res.status).toBe(200);

  // Extract better-auth.session_token cookie from set-cookie header
  // set-cookie is an array of strings in supertest; find the session token
  const cookies: string[] = Array.isArray(res.headers['set-cookie'])
    ? (res.headers['set-cookie'] as string[])
    : [res.headers['set-cookie']];

  const sessionCookie = cookies.find((c) => c.startsWith('better-auth.session_token='));
  expect(sessionCookie).toBeDefined();
  return sessionCookie!;
}

// ---------------------------------------------------------------------------
// Test Suite 1: Sign up (AUTH-01)
// ---------------------------------------------------------------------------
describe('POST /api/auth/sign-up/email — AUTH-01', () => {
  test('returns 200 with session cookie on valid credentials', async () => {
    const res = await request(app).post('/api/auth/sign-up/email').send({
      email: 'signup@test-auth.example.com',
      password: 'testpass123',
      name: 'Test User',
    });

    expect(res.status).toBe(200);

    // Should set a session cookie (NODE_ENV=test bypasses email verification)
    const cookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? (res.headers['set-cookie'] as string[])
      : [res.headers['set-cookie']];

    const sessionCookie = cookies.find((c) => c.startsWith('better-auth.session_token='));
    expect(sessionCookie).toBeDefined();
  });

  test('returns error status on duplicate email (422)', async () => {
    const payload = {
      email: 'duplicate@test-auth.example.com',
      password: 'testpass123',
      name: 'Test User',
    };

    // First sign-up succeeds
    const first = await request(app).post('/api/auth/sign-up/email').send(payload);
    expect(first.status).toBe(200);

    // Second sign-up with same email fails
    const second = await request(app).post('/api/auth/sign-up/email').send(payload);
    expect(second.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 2: Sign in (AUTH-03)
// ---------------------------------------------------------------------------
describe('POST /api/auth/sign-in/email — AUTH-03', () => {
  test('returns 200 with session cookie on valid credentials', async () => {
    const email = 'signin@test-auth.example.com';
    const password = 'testpass123';

    // Create user first
    await request(app).post('/api/auth/sign-up/email').send({ email, password, name: 'Test User' });

    // Sign in
    const res = await request(app).post('/api/auth/sign-in/email').send({ email, password });

    expect(res.status).toBe(200);

    const cookies: string[] = Array.isArray(res.headers['set-cookie'])
      ? (res.headers['set-cookie'] as string[])
      : [res.headers['set-cookie']];

    const sessionCookie = cookies.find((c) => c.startsWith('better-auth.session_token='));
    expect(sessionCookie).toBeDefined();
  });

  test('returns non-200 on wrong password (401 or 422)', async () => {
    const email = 'wrongpass@test-auth.example.com';

    // Create user
    await request(app)
      .post('/api/auth/sign-up/email')
      .send({ email, password: 'correctpass123', name: 'Test User' });

    // Attempt sign-in with wrong password
    const res = await request(app)
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'wrongpass123' });

    expect(res.status).not.toBe(200);
    // Better Auth returns 401 or 422 for invalid credentials
    expect([401, 422]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 3: Session via /api/me (AUTH-05)
// ---------------------------------------------------------------------------
describe('GET /api/me — AUTH-05', () => {
  test('returns 200 with user data when valid session cookie present', async () => {
    const email = 'session@test-auth.example.com';
    const password = 'testpass123';
    const name = 'Session User';

    const sessionCookie = await signUpAndGetCookie(email, password, name);

    // Extract just the cookie value portion (name=value; other attributes...)
    const cookieValue = sessionCookie.split(';')[0];

    const res = await request(app).get('/api/me').set('Cookie', cookieValue);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.name).toBe(name);
    expect(res.body.user.id).toBeDefined();
    expect(typeof res.body.user.id).toBe('string');
    expect(res.body.user.id.length).toBeGreaterThan(0);
  });

  test('returns 401 when no session cookie present', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 4: Sign out (AUTH-08)
// ---------------------------------------------------------------------------
describe('POST /api/auth/sign-out — AUTH-08', () => {
  test('destroys session — subsequent /api/me returns 401', async () => {
    const email = 'signout@test-auth.example.com';
    const password = 'testpass123';

    const sessionCookie = await signUpAndGetCookie(email, password, 'Sign Out User');
    const cookieValue = sessionCookie.split(';')[0];

    // Verify session is valid before sign-out
    const beforeRes = await request(app).get('/api/me').set('Cookie', cookieValue);
    expect(beforeRes.status).toBe(200);

    // Sign out
    const signOutRes = await request(app).post('/api/auth/sign-out').set('Cookie', cookieValue);
    expect(signOutRes.status).toBe(200);

    // Session should now be invalid
    const afterRes = await request(app).get('/api/me').set('Cookie', cookieValue);
    expect(afterRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 5: Password reset request (AUTH-04)
//
// Better Auth endpoint: POST /api/auth/request-password-reset
// (path confirmed via auth.api.requestPasswordReset.path = '/request-password-reset')
// ---------------------------------------------------------------------------
describe('POST /api/auth/request-password-reset — AUTH-04', () => {
  test('returns 200 for existing email (prevents enumeration)', async () => {
    const email = 'resetexist@test-auth.example.com';

    // Create user first
    await request(app)
      .post('/api/auth/sign-up/email')
      .send({ email, password: 'testpass123', name: 'Reset User' });

    const res = await request(app).post('/api/auth/request-password-reset').send({
      email,
      redirectTo: '/reset-password',
    });

    expect(res.status).toBe(200);
  });

  test('returns 200 for non-existent email (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/request-password-reset').send({
      email: 'nonexistent@test-auth.example.com',
      redirectTo: '/reset-password',
    });

    // Better Auth returns 200 regardless of whether email exists (prevents user enumeration)
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Test Suite 6: Zero-knowledge invariant — structural check
// ---------------------------------------------------------------------------
describe('Zero-knowledge invariant', () => {
  test('GET /api/me response body does not contain secretId field', async () => {
    const email = 'zk@test-auth.example.com';
    const sessionCookie = await signUpAndGetCookie(email, 'testpass123', 'ZK User');
    const cookieValue = sessionCookie.split(';')[0];

    const res = await request(app).get('/api/me').set('Cookie', cookieValue);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();

    // The invariant: user response must not contain secretId
    expect(res.body.user).not.toHaveProperty('secretId');

    // Also verify top-level response does not expose secret identifiers
    expect(res.body).not.toHaveProperty('secretId');
  });
});

// ---------------------------------------------------------------------------
// Test Suite 7: OAuth redirect initiation (AUTH-06, AUTH-07)
//
// OAuth flows are browser-redirect-based and cannot be fully integration-tested
// with Supertest. However, the initiation endpoint IS testable — it returns the
// provider authorization URL.
//
// Better Auth 1.x POST /api/auth/sign-in/social behaviour:
//   - Status: 200 (not 3xx — Better Auth returns JSON, not an HTTP redirect)
//   - Body: { url: "https://accounts.google.com/...", redirect: true }
//   - Header: Location set to the authorization URL
//
// We assert on res.body.url (the canonical place Better Auth returns the URL)
// and also check the Location header as defense-in-depth.
//
// These tests are skipped gracefully when OAuth credentials are not configured
// in the test environment. The human-verify checkpoint (Task 2) verifies the
// complete round-trip flows manually.
// ---------------------------------------------------------------------------
describe('OAuth redirect initiation — AUTH-06, AUTH-07', () => {
  test('POST /api/auth/sign-in/social with provider=google returns authorization URL for accounts.google.com', async () => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.warn('Skipping Google OAuth test — GOOGLE_CLIENT_ID not set');
      return;
    }

    const res = await request(app)
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', callbackURL: '/dashboard' })
      .redirects(0);

    // Better Auth 1.x returns 200 + JSON body with authorization URL (not 3xx)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url as string).toMatch(/accounts\.google\.com/);
    expect(res.headers['location']).toMatch(/accounts\.google\.com/);
  });

  test('POST /api/auth/sign-in/social with provider=github returns authorization URL for github.com/login/oauth', async () => {
    if (!process.env.GITHUB_CLIENT_ID) {
      console.warn('Skipping GitHub OAuth test — GITHUB_CLIENT_ID not set');
      return;
    }

    const res = await request(app)
      .post('/api/auth/sign-in/social')
      .send({ provider: 'github', callbackURL: '/dashboard' })
      .redirects(0);

    // Better Auth 1.x returns 200 + JSON body with authorization URL (not 3xx)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url as string).toMatch(/github\.com\/login\/oauth/);
    expect(res.headers['location']).toMatch(/github\.com\/login\/oauth/);
  });
});
