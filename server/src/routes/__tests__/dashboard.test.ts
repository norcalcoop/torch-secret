import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../app.js';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets, users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

// Nonexistent 21-char ID (matches nanoid format)
const NONEXISTENT_ID = 'xxxxxxxxxxxxxxxxxxx01';

// Fresh app per describe block (rate limiter isolation)
let app: Express;

// Session cookie for authenticated user A (and optionally user B)
let userASessionCookie: string;
let userAId: string;

let userBSessionCookie: string;
let userBId: string;

/**
 * Helper: insert a secret directly into the database for a specific user.
 * Bypasses the API so we can control status, userId, and other fields directly.
 */
async function insertTestSecret(opts: {
  userId: string | null;
  status?: 'active' | 'viewed' | 'expired' | 'deleted';
  label?: string;
  expired?: boolean;
}): Promise<string> {
  const id = nanoid();
  const expiresAt = opts.expired
    ? new Date(Date.now() - 60_000) // 1 minute ago
    : new Date(Date.now() + 86_400_000); // 24 hours from now

  await db.insert(secrets).values({
    id,
    ciphertext: VALID_CIPHERTEXT,
    expiresAt,
    userId: opts.userId,
    status: opts.status ?? 'active',
    label: opts.label ?? null,
  });

  return id;
}

/**
 * Helper: register + sign in to get a session cookie.
 * Returns { sessionCookie, userId } for the created user.
 */
async function createUserAndSignIn(
  app: Express,
  email: string,
  password: string,
  name: string,
): Promise<{ sessionCookie: string; userId: string }> {
  // Sign up
  await request(app).post('/api/auth/sign-up/email').send({ email, password, name }).expect(200);

  // Sign in
  const signInRes = await request(app)
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200);

  // Extract session cookie — supertest header may be string or string[]
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

  // Extract userId from response body
  const userId = signInRes.body.user?.id as string;
  if (!userId) {
    throw new Error('No userId found in sign-in response body');
  }

  return { sessionCookie, userId };
}

beforeAll(async () => {
  app = buildApp();

  // Create User A and User B, sign in both
  const userA = await createUserAndSignIn(
    app,
    'dashboard-user-a@test.secureshare.dev',
    'password-for-user-a-123',
    'User A',
  );
  userASessionCookie = userA.sessionCookie;
  userAId = userA.userId;

  const userB = await createUserAndSignIn(
    app,
    'dashboard-user-b@test.secureshare.dev',
    'password-for-user-b-123',
    'User B',
  );
  userBSessionCookie = userB.sessionCookie;
  userBId = userB.userId;
});

afterEach(async () => {
  // Clean up secrets between tests (but not users/sessions — those persist for the test run)
  await db.delete(secrets);
});

afterAll(async () => {
  // Clean up users created during tests
  await db.delete(users).where(eq(users.email, 'dashboard-user-a@test.secureshare.dev'));
  await db.delete(users).where(eq(users.email, 'dashboard-user-b@test.secureshare.dev'));

  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

// ---------------------------------------------------------------------------
// Authentication guard: GET /api/dashboard/secrets
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/secrets — authentication guard', () => {
  test('returns 401 without a session cookie', async () => {
    const res = await request(app).get('/api/dashboard/secrets').expect(401);

    expect(res.body.error).toBe('unauthorized');
  });

  test('returns 401 with invalid session cookie', async () => {
    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', 'better-auth.session_token=fakeinvalidtoken')
      .expect(401);

    expect(res.body.error).toBe('unauthorized');
  });
});

// ---------------------------------------------------------------------------
// Authentication guard: DELETE /api/dashboard/secrets/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/dashboard/secrets/:id — authentication guard', () => {
  test('returns 401 without a session cookie', async () => {
    const id = await insertTestSecret({ userId: userAId });

    const res = await request(app).delete(`/api/dashboard/secrets/${id}`).expect(401);

    expect(res.body.error).toBe('unauthorized');
  });

  test('returns 401 with invalid session cookie', async () => {
    const id = await insertTestSecret({ userId: userAId });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', 'better-auth.session_token=fakeinvalidtoken')
      .expect(401);

    expect(res.body.error).toBe('unauthorized');
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/secrets — authenticated
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/secrets — authenticated', () => {
  test('returns 200 with empty array when user has no secrets', async () => {
    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toEqual([]);
    expect(res.body.nextCursor).toBeNull();
  });

  test('returns secrets belonging to the authenticated user', async () => {
    await insertTestSecret({ userId: userAId, label: 'Secret A' });

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(1);
    expect(res.body.secrets[0].label).toBe('Secret A');
  });

  test('does NOT return secrets belonging to other users', async () => {
    // Insert secret for User B
    await insertTestSecret({ userId: userBId, label: 'User B Secret' });

    // User A should see no secrets
    const resA = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(resA.body.secrets).toHaveLength(0);
  });

  test('does NOT return anonymous secrets', async () => {
    // Insert an anonymous secret (userId = null)
    await insertTestSecret({ userId: null });

    // User A should see no secrets
    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(0);
  });

  test('returns multiple secrets sorted newest first', async () => {
    // Insert secrets with a slight delay to ensure different createdAt timestamps
    const id1 = await insertTestSecret({ userId: userAId, label: 'First' });
    // Manually set createdAt to be older for id1
    await db
      .update(secrets)
      .set({ createdAt: new Date(Date.now() - 5000) })
      .where(eq(secrets.id, id1));
    const _id2 = await insertTestSecret({ userId: userAId, label: 'Second' });

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(2);
    // Newest first: 'Second' should come before 'First'
    expect(res.body.secrets[0].label).toBe('Second');
    expect(res.body.secrets[1].label).toBe('First');
  });

  test('returns secrets of all statuses: active, viewed, expired, deleted', async () => {
    await insertTestSecret({ userId: userAId, status: 'active', label: 'Active' });
    await insertTestSecret({ userId: userAId, status: 'viewed', label: 'Viewed' });
    await insertTestSecret({ userId: userAId, status: 'expired', label: 'Expired' });
    await insertTestSecret({ userId: userAId, status: 'deleted', label: 'Deleted' });

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(4);

    const secretsList = res.body.secrets as { status: string }[];
    const statuses = secretsList.map((s) => s.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('viewed');
    expect(statuses).toContain('expired');
    expect(statuses).toContain('deleted');
  });

  test('response body never contains ciphertext key (DASH-05)', async () => {
    await insertTestSecret({ userId: userAId, status: 'active' });
    await insertTestSecret({ userId: userAId, status: 'viewed' });

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets.length).toBeGreaterThan(0);

    for (const secret of res.body.secrets) {
      expect(secret).not.toHaveProperty('ciphertext');
      expect(secret).not.toHaveProperty('passwordHash');
    }
  });

  test('response includes expected safe fields per secret', async () => {
    await insertTestSecret({ userId: userAId, label: 'My Secret' });

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    const secret = res.body.secrets[0];
    expect(secret).toHaveProperty('id');
    expect(secret).toHaveProperty('label', 'My Secret');
    expect(secret).toHaveProperty('createdAt');
    expect(secret).toHaveProperty('expiresAt');
    expect(secret).toHaveProperty('status', 'active');
    expect(secret).toHaveProperty('notify', false);
    // viewedAt may be null for active secrets
    expect('viewedAt' in secret).toBe(true);

    // DASH-05: these MUST NOT be present
    expect(secret).not.toHaveProperty('ciphertext');
    expect(secret).not.toHaveProperty('passwordHash');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/dashboard/secrets/:id — authenticated
// ---------------------------------------------------------------------------
describe('DELETE /api/dashboard/secrets/:id — authenticated', () => {
  test('returns 200 { success: true } for an active secret owned by the user', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'active' });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body).toEqual({ success: true });
  });

  test('after deletion: row still exists in DB with status=deleted (soft-delete)', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'active' });

    await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    // Row should still exist
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('deleted');
  });

  test('after deletion: ciphertext is zeroed (data remanence mitigation)', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'active' });

    await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    // Ciphertext should be zeroed
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].ciphertext).toBe('0'.repeat(VALID_CIPHERTEXT.length));
  });

  test('returns 404 for a secret with status viewed', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'viewed' });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('returns 404 for a secret with status expired', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'expired' });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('returns 404 for a secret with status deleted', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'deleted' });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('returns 404 for a secret owned by a different user (cross-user protection)', async () => {
    // Secret belongs to User B
    const id = await insertTestSecret({ userId: userBId, status: 'active' });

    // User A tries to delete it — should fail
    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');

    // Verify the secret was NOT deleted (row still has status 'active')
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
  });

  test('returns 404 for a non-existent secret ID', async () => {
    const res = await request(app)
      .delete(`/api/dashboard/secrets/${NONEXISTENT_ID}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('returns 404 for an anonymous secret (not owned by any user)', async () => {
    const id = await insertTestSecret({ userId: null, status: 'active' });

    const res = await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(404);

    expect(res.body.error).toBe('not_found');
  });

  test('deleted secret no longer appears as active in dashboard list', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'active' });

    // Delete it
    await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    // Check dashboard list — still shows but with status=deleted
    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(1);
    expect(res.body.secrets[0].status).toBe('deleted');
  });
});

// ---------------------------------------------------------------------------
// Zero-knowledge invariant: logger redaction (DASH-05 adjacent)
// ---------------------------------------------------------------------------
describe('logger redaction — dashboard DELETE URL', () => {
  test('redactUrl redacts secret IDs from /api/dashboard/secrets/:id paths', async () => {
    // Import and test the redactUrl function directly
    const { redactUrl } = await import('../../middleware/logger.js');

    const input = '/api/dashboard/secrets/abc123def456ghi789012';
    const output = redactUrl(input);
    expect(output).toBe('/api/dashboard/secrets/[REDACTED]');
  });

  test('redactUrl handles nanoid characters in dashboard paths (hyphens, underscores)', async () => {
    const { redactUrl } = await import('../../middleware/logger.js');

    const input = '/api/dashboard/secrets/Abc_-def123ghiJK56789';
    const output = redactUrl(input);
    expect(output).toBe('/api/dashboard/secrets/[REDACTED]');
  });

  test('redactUrl still redacts /api/secrets/:id paths (regression)', async () => {
    const { redactUrl } = await import('../../middleware/logger.js');

    const input = '/api/secrets/abc123def456ghi789012';
    const output = redactUrl(input);
    expect(output).toBe('/api/secrets/[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// INVARIANTS.md verification (documentation check)
// ---------------------------------------------------------------------------
describe('INVARIANTS.md enforcement table', () => {
  test('contains Phase 23 dashboard logger entry', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    // Resolve relative to project root (4 levels up from server/src/routes/__tests__)
    const invariantsPath = resolve(import.meta.dirname, '../../../../INVARIANTS.md');
    const content = readFileSync(invariantsPath, 'utf-8');

    expect(content).toMatch(/dashboard/i);
    expect(content).toMatch(/Phase 23/);
  });

  test('INVARIANTS.md dashboard entry covers logger.ts redactUrl', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');

    const invariantsPath = resolve(import.meta.dirname, '../../../../INVARIANTS.md');
    const content = readFileSync(invariantsPath, 'utf-8');

    // The entry should reference the logger file and the dashboard route
    expect(content).toContain('logger.ts');
    expect(content).toContain('dashboard');
  });
});

// ---------------------------------------------------------------------------
// Gap 2 / E1 / SR-017: IDOR protection — user cannot see other users' secrets
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/secrets — IDOR protection (Gap 2, SR-017)', () => {
  test('user B cannot see user A secrets in their dashboard', async () => {
    // User A creates a secret
    const secretId = await insertTestSecret({ userId: userAId, label: 'user-a-secret' });

    // User B requests their own dashboard
    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userBSessionCookie)
      .expect(200);

    // User B's dashboard must not contain User A's secret
    const secretIds = (res.body.secrets as { id: string }[]).map((s) => s.id);
    expect(secretIds).not.toContain(secretId);
    // Sanity check: secrets is a valid array (not undefined/null)
    expect(Array.isArray(res.body.secrets)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Cross-user isolation: User B cannot affect User A's secrets
// ---------------------------------------------------------------------------
describe('cross-user isolation', () => {
  test('User A and User B see only their own secrets', async () => {
    // Insert one secret for each user
    await insertTestSecret({ userId: userAId, label: 'A Secret' });
    await insertTestSecret({ userId: userBId, label: 'B Secret' });

    const resA = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    const resB = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userBSessionCookie)
      .expect(200);

    expect(resA.body.secrets).toHaveLength(1);
    expect(resA.body.secrets[0].label).toBe('A Secret');

    expect(resB.body.secrets).toHaveLength(1);
    expect(resB.body.secrets[0].label).toBe('B Secret');
  });

  test('User B cannot delete User A secret even with their own valid session', async () => {
    const id = await insertTestSecret({ userId: userAId, status: 'active' });

    // User B tries to delete User A's secret
    await request(app)
      .delete(`/api/dashboard/secrets/${id}`)
      .set('Cookie', userBSessionCookie)
      .expect(404);

    // Secret still belongs to User A and is still active
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
    expect(rows[0].userId).toBe(userAId);
  });
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/secrets — pagination (API-02)
// ---------------------------------------------------------------------------
describe('GET /api/dashboard/secrets — pagination (API-02)', () => {
  test('returns at most 20 secrets and non-null nextCursor when >20 exist', async () => {
    // Insert 21 secrets with distinct createdAt timestamps for deterministic ordering
    for (let i = 0; i < 21; i++) {
      const id = await insertTestSecret({ userId: userAId });
      await db
        .update(secrets)
        .set({ createdAt: new Date(Date.now() - i * 1000) })
        .where(eq(secrets.id, id));
    }

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets.length).toBe(20);
    expect(res.body.nextCursor).not.toBeNull();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  test('returns nextCursor: null when ≤20 secrets exist', async () => {
    // Insert 5 secrets
    for (let i = 0; i < 5; i++) {
      const id = await insertTestSecret({ userId: userAId });
      await db
        .update(secrets)
        .set({ createdAt: new Date(Date.now() - i * 1000) })
        .where(eq(secrets.id, id));
    }

    const res = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(5);
    expect(res.body.nextCursor).toBeNull();
  });

  test('second page fetched with cursor returns correct continuation', async () => {
    // Insert 21 secrets with distinct createdAt timestamps
    const insertedIds: string[] = [];
    for (let i = 0; i < 21; i++) {
      const id = await insertTestSecret({ userId: userAId });
      await db
        .update(secrets)
        .set({ createdAt: new Date(Date.now() - i * 1000) })
        .where(eq(secrets.id, id));
      insertedIds.push(id);
    }

    // Fetch page 1
    const page1 = await request(app)
      .get('/api/dashboard/secrets')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(page1.body.secrets).toHaveLength(20);
    const cursor = page1.body.nextCursor as string;
    expect(cursor).not.toBeNull();

    const page1Ids = (page1.body.secrets as { id: string }[]).map((s) => s.id);

    // Fetch page 2 using cursor
    const page2 = await request(app)
      .get(`/api/dashboard/secrets?cursor=${encodeURIComponent(cursor)}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(page2.body.secrets).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();

    // The second page's secret must NOT appear in the first page
    const page2Id = (page2.body.secrets as { id: string }[])[0].id;
    expect(page1Ids).not.toContain(page2Id);
  });

  test('returns 400 for malformed cursor', async () => {
    // URL-encoded '!!!not-base64'
    await request(app)
      .get('/api/dashboard/secrets?cursor=%21%21%21not-base64')
      .set('Cookie', userASessionCookie)
      .expect(400);
  });

  test('returns 400 for invalid status value', async () => {
    await request(app)
      .get('/api/dashboard/secrets?status=invalid')
      .set('Cookie', userASessionCookie)
      .expect(400);
  });

  test('status=active returns only active secrets', async () => {
    // Insert 3 active + 2 viewed secrets
    for (let i = 0; i < 3; i++) {
      await insertTestSecret({ userId: userAId, status: 'active' });
    }
    for (let i = 0; i < 2; i++) {
      await insertTestSecret({ userId: userAId, status: 'viewed' });
    }

    const res = await request(app)
      .get('/api/dashboard/secrets?status=active')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(res.body.secrets).toHaveLength(3);
    const statuses = (res.body.secrets as { status: string }[]).map((s) => s.status);
    expect(statuses.every((s) => s === 'active')).toBe(true);
  });

  test('status filter is preserved across cursor pages', async () => {
    // Insert 21 active secrets with distinct createdAt timestamps
    for (let i = 0; i < 21; i++) {
      const id = await insertTestSecret({ userId: userAId, status: 'active' });
      await db
        .update(secrets)
        .set({ createdAt: new Date(Date.now() - i * 1000) })
        .where(eq(secrets.id, id));
    }

    // Fetch page 1 with status=active filter
    const page1 = await request(app)
      .get('/api/dashboard/secrets?status=active')
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(page1.body.secrets).toHaveLength(20);
    expect(page1.body.nextCursor).not.toBeNull();

    const cursor = page1.body.nextCursor as string;

    // Fetch page 2 preserving status filter
    const page2 = await request(app)
      .get(`/api/dashboard/secrets?status=active&cursor=${encodeURIComponent(cursor)}`)
      .set('Cookie', userASessionCookie)
      .expect(200);

    expect(page2.body.secrets).toHaveLength(1);
    expect(page2.body.nextCursor).toBeNull();
    const statuses = (page2.body.secrets as { status: string }[]).map((s) => s.status);
    expect(statuses.every((s) => s === 'active')).toBe(true);
  });
});
