/**
 * AUTH-02 — Audit event write tests.
 *
 * Verifies that authentication lifecycle events (sign_up, sign_in, logout,
 * password_reset_requested) are written to the audit_logs table when the
 * corresponding Better Auth hooks are triggered.
 *
 * These are integration tests against the real database — no mocks for DB.
 * Email services are mocked to prevent real HTTP calls during auth flows.
 *
 * All tests are RED (failing) until Phase 70-03 wires the event hooks.
 */

import { describe, test, expect, beforeEach, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db, pool } from '../../db/connection.js';
import { sql, eq } from 'drizzle-orm';
import { users } from '../../db/schema.js';
import { nanoid } from 'nanoid';

// Mock Resend to avoid real HTTP calls
vi.mock('../../services/email.js', () => ({
  resend: {
    emails: { send: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }) },
    contacts: { create: vi.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }) },
  },
}));

// Mock Loops to avoid real HTTP calls
vi.mock('../../config/loops.js', () => ({
  loops: {
    sendEvent: vi.fn().mockResolvedValue({ success: true }),
    deleteContact: vi.fn().mockResolvedValue({ success: true }),
  },
}));

let app: Express;
beforeEach(() => {
  app = buildApp();
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Register + login via API to get a session cookie and the user's ID */
async function createAuthenticatedSession(
  appInstance: Express,
  email: string,
  password: string,
): Promise<{ cookie: string; userId: string }> {
  await request(appInstance).post('/api/auth/sign-up/email').send({
    email,
    password,
    name: 'Audit Test User',
  });
  const loginRes = await request(appInstance)
    .post('/api/auth/sign-in/email')
    .send({ email, password });
  const cookies = loginRes.headers['set-cookie'] as string[] | string | undefined;
  if (!cookies) throw new Error('No session cookie in login response');
  const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
  const cookie = cookieArr.map((c: string) => c.split(';')[0]).join('; ');

  // Get user ID from /api/me
  const meRes = await request(appInstance).get('/api/me').set('Cookie', cookie);
  const userId = (meRes.body as { user: { id: string } }).user.id;
  return { cookie, userId };
}

/** Clean up test users by email pattern (cascade deletes audit_logs via FK) */
async function cleanupTestUsers(emailPattern: string): Promise<void> {
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${emailPattern}`);
}

// ---------------------------------------------------------------------------
// AUTH-02 — audit event writes
// ---------------------------------------------------------------------------

describe('AUTH-02 — audit event writes', () => {
  const EMAIL_PREFIX = 'audit-events-test-';
  // Better Auth normalizes emails to lowercase before storing.
  // nanoid() can produce uppercase letters — toLowerCase() ensures the query matches the stored value.
  const makeEmail = () => `${EMAIL_PREFIX}${nanoid().toLowerCase()}@test.local`;
  const PASSWORD = 'AuditTest99!';

  afterEach(async () => {
    await cleanupTestUsers(EMAIL_PREFIX + '%@test.local');
  });

  test('sign_up event written on email registration', async () => {
    const email = makeEmail();
    const { userId } = await createAuthenticatedSession(app, email, PASSWORD);

    const result = await db.execute(sql`
      SELECT event_type FROM audit_logs
      WHERE user_id = ${userId} AND event_type = 'sign_up'
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { event_type: string }).event_type).toBe('sign_up');
  });

  test('sign_in event written on email sign-in', async () => {
    const email = makeEmail();
    const { userId } = await createAuthenticatedSession(app, email, PASSWORD);

    const result = await db.execute(sql`
      SELECT event_type FROM audit_logs
      WHERE user_id = ${userId} AND event_type = 'sign_in'
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { event_type: string }).event_type).toBe('sign_in');
  });

  test('logout event written on sign-out', async () => {
    const email = makeEmail();
    const { cookie, userId } = await createAuthenticatedSession(app, email, PASSWORD);

    await request(app).post('/api/auth/sign-out').set('Cookie', cookie).send({});

    const result = await db.execute(sql`
      SELECT event_type FROM audit_logs
      WHERE user_id = ${userId} AND event_type = 'logout'
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { event_type: string }).event_type).toBe('logout');
  });

  test('password_reset_requested event written with null ip_hash', async () => {
    const email = makeEmail();
    // Register user first (sign-up creates the user in DB)
    await request(app).post('/api/auth/sign-up/email').send({
      email,
      password: PASSWORD,
      name: 'Audit Test User',
    });

    // Find the user ID by email
    const [userRow] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    expect(userRow).toBeDefined();
    const userId = userRow.id;

    // Trigger password reset request
    // Better Auth 1.x endpoint is /api/auth/request-password-reset (not /forget-password)
    await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost/reset-password' });

    // fireAuditEvent is fire-and-forget — allow the microtask queue to flush
    // before querying the DB so the audit row is visible.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const result = await db.execute(sql`
      SELECT event_type, ip_hash FROM audit_logs
      WHERE user_id = ${userId} AND event_type = 'password_reset_requested'
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { event_type: string }).event_type).toBe('password_reset_requested');
    expect((result.rows[0] as { ip_hash: string | null }).ip_hash).toBeNull();
  });

  test.skip(
    'oauth_connect fires on OAuth sign-in — manual verification required (real OAuth provider needed)',
  );
});
