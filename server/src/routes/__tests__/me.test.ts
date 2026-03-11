import { describe, test, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { pool } from '../../db/connection.js';

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

import { loops } from '../../config/loops.js';
const loopsDeleteContact = () => vi.mocked(loops.deleteContact);

let app: Express;
beforeEach(() => {
  app = buildApp();
  vi.clearAllMocks();
});

afterAll(async () => {
  await pool.end();
});

// Helper: register + login via API to get a session cookie
async function createAuthenticatedSession(
  appInstance: Express,
  email: string,
  password: string,
): Promise<string> {
  await request(appInstance).post('/api/auth/sign-up/email').send({
    email,
    password,
    name: 'Test User',
  });
  const loginRes = await request(appInstance)
    .post('/api/auth/sign-in/email')
    .send({ email, password });
  // Extract session cookie from set-cookie header
  const cookies = loginRes.headers['set-cookie'] as string[] | string | undefined;
  if (!cookies) throw new Error('No session cookie in login response');
  const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
  return cookieArr.map((c: string) => c.split(';')[0]).join('; ');
}

// ---------------------------------------------------------------------------
// GET /api/me — API-03: projected select with stripeCustomerId field
// ---------------------------------------------------------------------------
describe('GET /api/me', () => {
  test('returns 401 without authentication', async () => {
    await request(app).get('/api/me').expect(401);
  });

  test('authenticated user response includes stripeCustomerId field', async () => {
    const cookie = await createAuthenticatedSession(app, 'get-me-test@test.local', 'password123');

    const res = await request(app).get('/api/me').set('Cookie', cookie).expect(200);

    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('stripeCustomerId');
  });

  test('authenticated user response includes expected profile fields', async () => {
    const cookie = await createAuthenticatedSession(app, 'get-me-fields@test.local', 'password123');

    const res = await request(app).get('/api/me').set('Cookie', cookie).expect(200);

    const { user } = res.body as {
      user: {
        id: string;
        email: string;
        name: string;
        subscriptionTier: string;
        stripeCustomerId: string | null;
      };
    };
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('subscriptionTier');
    // stripeCustomerId is null for a newly registered user (no Stripe checkout yet)
    expect(user.stripeCustomerId).toBeNull();
    // subscriptionTier defaults to 'free' for new users
    expect(user.subscriptionTier).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/me
// ---------------------------------------------------------------------------
describe('DELETE /api/me', () => {
  test('returns 401 without authentication', async () => {
    await request(app).delete('/api/me').expect(401);
  });

  test('deletes account and returns { ok: true }', async () => {
    const cookie = await createAuthenticatedSession(app, 'delete-test@test.local', 'password123');
    const res = await request(app).delete('/api/me').set('Cookie', cookie).expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('calls loops.deleteContact with user email', async () => {
    const cookie = await createAuthenticatedSession(app, 'loops-delete@test.local', 'password123');
    await request(app).delete('/api/me').set('Cookie', cookie).expect(200);
    expect(loopsDeleteContact()).toHaveBeenCalledWith({ email: 'loops-delete@test.local' });
  });

  test('subsequent GET /api/me returns 401 after deletion', async () => {
    const cookie = await createAuthenticatedSession(app, 'gone-after@test.local', 'password123');
    await request(app).delete('/api/me').set('Cookie', cookie).expect(200);
    await request(app).get('/api/me').set('Cookie', cookie).expect(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/me/export — GDPR-01: user data export
// ---------------------------------------------------------------------------
describe('GET /api/me/export', () => {
  test('returns 401 without authentication', async () => {
    await request(app).get('/api/me/export').expect(401);
  });

  test('returns exportedAt, profile, and auditLog for authenticated user', async () => {
    const cookie = await createAuthenticatedSession(app, 'export-test@test.local', 'password123');

    const res = await request(app).get('/api/me/export').set('Cookie', cookie).expect(200);

    expect(typeof res.body.exportedAt).toBe('string');
    expect(res.body.profile).toHaveProperty('id');
    expect(res.body.profile).toHaveProperty('email', 'export-test@test.local');
    expect(res.body.profile).toHaveProperty('subscriptionTier', 'free');
    expect(Array.isArray(res.body.auditLog)).toBe(true);
  });

  test('profile excludes stripeCustomerId', async () => {
    const cookie = await createAuthenticatedSession(
      app,
      'export-stripe-test@test.local',
      'password123',
    );

    const res = await request(app).get('/api/me/export').set('Cookie', cookie).expect(200);

    expect(res.body.profile.stripeCustomerId).toBeUndefined();
  });

  test('auditLog sorted newest-first', async () => {
    const cookie = await createAuthenticatedSession(
      app,
      'export-sort-test@test.local',
      'password123',
    );

    const res = await request(app).get('/api/me/export').set('Cookie', cookie).expect(200);

    const auditLog = res.body.auditLog as Array<{ created_at: string }>;
    expect(Array.isArray(auditLog)).toBe(true);
    // If two or more entries exist, verify descending order
    if (auditLog.length >= 2) {
      const first = new Date(auditLog[0].created_at).getTime();
      const second = new Date(auditLog[1].created_at).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });
});
