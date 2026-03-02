/**
 * Integration tests for auth-related security behaviors.
 *
 * Gap 3 (SR-003, E3): Session logout invalidation — server-side session revoked
 * Gap 4 (SR-018, E4): Pro-gate re-validation — DB read on each request, not session cache
 *
 * Uses real PostgreSQL (same pattern as dashboard.test.ts).
 */
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

let app: Express;

// Unique email suffixes prevent collision with other test files
const AUTH_TEST_EMAIL_PREFIX = 'auth-security-test';

/**
 * Helper: register + sign in, return session cookie + userId.
 * Copy of the pattern from dashboard.test.ts.
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
  if (!sessionCookie) throw new Error('No session cookie found in sign-in response');
  const userId = (signInRes.body as { user?: { id?: string } }).user?.id;
  if (!userId) throw new Error('No userId found in sign-in response body');
  return { sessionCookie, userId };
}

beforeAll(() => {
  app = buildApp();
});

afterEach(async () => {
  // Clean up test users between tests (users table; sessions cascade-delete)
  await db
    .delete(users)
    .where(eq(users.email, `${AUTH_TEST_EMAIL_PREFIX}-logout@test.secureshare.dev`));
  await db
    .delete(users)
    .where(eq(users.email, `${AUTH_TEST_EMAIL_PREFIX}-progate@test.secureshare.dev`));
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Gap 3 / SR-003: Session logout invalidation
// ---------------------------------------------------------------------------
describe('Session logout invalidation (Gap 3, SR-003)', () => {
  test('session cookie is rejected with 401 after logout (server-side session deleted)', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}-logout@test.secureshare.dev`;
    const { sessionCookie } = await createUserAndSignIn(
      app,
      email,
      'Logout-Pass-99',
      'Logout User',
    );

    // Confirm session is valid — GET /api/me uses requireAuth and returns 200 with a valid session
    await request(app).get('/api/me').set('Cookie', sessionCookie).expect(200);

    // Sign out — Better Auth destroys the session record server-side
    await request(app).post('/api/auth/sign-out').set('Cookie', sessionCookie).expect(200);

    // Same cookie must now be rejected with 401 — GET /api/me uses requireAuth middleware
    // which returns 401 when no valid session is found in the DB. This confirms
    // server-side session deletion (not just client-side cookie removal).
    await request(app).get('/api/me').set('Cookie', sessionCookie).expect(401);
  });
});

// ---------------------------------------------------------------------------
// Gap 4 / SR-018: Pro-gate re-validation (DB read per request)
// ---------------------------------------------------------------------------
describe('Pro-gate re-validation after subscription downgrade (Gap 4, SR-018)', () => {
  test('subscriptionTier is read from DB on each request — downgrade visible without re-login', async () => {
    const email = `${AUTH_TEST_EMAIL_PREFIX}-progate@test.secureshare.dev`;
    const { sessionCookie, userId } = await createUserAndSignIn(
      app,
      email,
      'ProGate-Pass-99',
      'ProGate User',
    );

    // Elevate to Pro directly in DB (simulates webhook activation)
    await db.update(users).set({ subscriptionTier: 'pro' }).where(eq(users.id, userId));

    // Verify Pro tier reflected without re-login
    // GET /api/me returns { user: { ..., subscriptionTier } } — subscriptionTier is nested under user
    const proRes = await request(app).get('/api/me').set('Cookie', sessionCookie).expect(200);
    expect((proRes.body as { user?: { subscriptionTier?: string } }).user?.subscriptionTier).toBe(
      'pro',
    );

    // Downgrade to Free directly in DB (simulates subscription cancellation)
    await db.update(users).set({ subscriptionTier: 'free' }).where(eq(users.id, userId));

    // Verify Free tier reflected on next request without re-login
    const freeRes = await request(app).get('/api/me').set('Cookie', sessionCookie).expect(200);
    expect((freeRes.body as { user?: { subscriptionTier?: string } }).user?.subscriptionTier).toBe(
      'free',
    );
  });
});
