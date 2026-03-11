/**
 * AUTH-01 — DB-level pgEnum enforcement tests for audit_logs table + audit.service.ts.
 *
 * Verifies:
 * 1. The auth_event_type pgEnum rejects invalid values at the PostgreSQL level.
 * 2. The audit_logs table exists with the expected columns.
 * 3. writeAuditEvent() inserts rows correctly (valid eventType, userId, optional fields).
 * 4. hashIpForAudit() returns a 64-char hex SHA-256 string.
 *
 * These are integration tests against the real database — no mocks.
 */

import { describe, test, expect, afterAll, afterEach } from 'vitest';
import { db, pool } from '../connection.js';
import { auditLogs, users } from '../schema.js';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// audit_logs schema enforcement (AUTH-01)
// ---------------------------------------------------------------------------

describe('audit_logs schema enforcement (AUTH-01)', () => {
  const TEST_USER_ID_PREFIX = 'audit-schema-test-';

  afterEach(async () => {
    // Cascade deletes audit_logs rows via FK onDelete cascade
    await db.execute(sql`DELETE FROM users WHERE id LIKE ${TEST_USER_ID_PREFIX + '%'}`);
  });

  test('audit_logs table exists with required columns', async () => {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'audit_logs'
      ORDER BY column_name
    `);

    const columns = result.rows.map((r) => (r as { column_name: string }).column_name);

    expect(columns).toContain('id');
    expect(columns).toContain('event_type');
    expect(columns).toContain('user_id');
    expect(columns).toContain('ip_hash');
    expect(columns).toContain('user_agent');
    expect(columns).toContain('created_at');
    expect(columns).toContain('metadata');
  });

  test('inserting an invalid event_type raises a Postgres error at DB level', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO audit_logs (id, event_type, user_id)
        VALUES (${nanoid()}, 'INVALID_EVENT', 'fake-user')
      `),
    ).rejects.toThrow();
  });

  test('inserting a valid event_type sign_in persists correctly', async () => {
    const testUserId = `${TEST_USER_ID_PREFIX}${nanoid()}`;
    const testEmail = `audit-schema-test-${nanoid()}@test.local`;
    const auditId = nanoid();

    // Create a real user row to satisfy the FK constraint
    await db.insert(users).values({
      id: testUserId,
      name: 'audit-test',
      email: testEmail,
      emailVerified: false,
    });

    await db.execute(sql`
      INSERT INTO audit_logs (id, event_type, user_id)
      VALUES (${auditId}, 'sign_in', ${testUserId})
    `);

    const result = await db.execute(sql`
      SELECT event_type FROM audit_logs WHERE id = ${auditId}
    `);

    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { event_type: string }).event_type).toBe('sign_in');
  });
});

// ---------------------------------------------------------------------------
// writeAuditEvent() integration tests (AUTH-01)
// ---------------------------------------------------------------------------

describe('writeAuditEvent() (AUTH-01)', () => {
  const TEST_USER_ID_PREFIX = 'audit-service-test-';

  afterEach(async () => {
    await db.execute(sql`DELETE FROM users WHERE id LIKE ${TEST_USER_ID_PREFIX + '%'}`);
  });

  async function createTestUser(): Promise<string> {
    const userId = `${TEST_USER_ID_PREFIX}${nanoid()}`;
    await db.insert(users).values({
      id: userId,
      name: 'audit-service-test',
      email: `audit-svc-${nanoid()}@test.local`,
      emailVerified: false,
    });
    return userId;
  }

  test('inserts a row with eventType, userId, ipHash, and userAgent', async () => {
    const { writeAuditEvent } = await import('../../services/audit.service.js');
    const userId = await createTestUser();

    await writeAuditEvent({
      eventType: 'sign_in',
      userId,
      ipHash: 'abc123hash',
      userAgent: 'TestAgent/1.0',
    });

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('sign_in');
    expect(rows[0].ipHash).toBe('abc123hash');
    expect(rows[0].userAgent).toBe('TestAgent/1.0');
    expect(rows[0].metadata).toBeNull();
  });

  test('inserts a row with null ipHash and null userAgent (password_reset_requested pattern)', async () => {
    const { writeAuditEvent } = await import('../../services/audit.service.js');
    const userId = await createTestUser();

    await writeAuditEvent({
      eventType: 'password_reset_requested',
      userId,
    });

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe('password_reset_requested');
    expect(rows[0].ipHash).toBeNull();
    expect(rows[0].userAgent).toBeNull();
  });

  test('inserts a row with metadata JSONB (oauth_connect)', async () => {
    const { writeAuditEvent } = await import('../../services/audit.service.js');
    const userId = await createTestUser();

    await writeAuditEvent({
      eventType: 'oauth_connect',
      userId,
      metadata: { provider: 'google' },
    });

    const rows = await db.select().from(auditLogs).where(eq(auditLogs.userId, userId));

    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({ provider: 'google' });
  });
});

// ---------------------------------------------------------------------------
// hashIpForAudit() unit tests (AUTH-01)
// ---------------------------------------------------------------------------

describe('hashIpForAudit() (AUTH-01)', () => {
  test('returns a 64-char hex string (SHA-256 output)', async () => {
    const { hashIpForAudit } = await import('../../services/audit.service.js');

    const result = hashIpForAudit('1.2.3.4');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  test('returns different hashes for different IPs', async () => {
    const { hashIpForAudit } = await import('../../services/audit.service.js');

    const hash1 = hashIpForAudit('1.2.3.4');
    const hash2 = hashIpForAudit('5.6.7.8');
    expect(hash1).not.toBe(hash2);
  });

  test('returns same hash for same IP (deterministic)', async () => {
    const { hashIpForAudit } = await import('../../services/audit.service.js');

    const hash1 = hashIpForAudit('10.0.0.1');
    const hash2 = hashIpForAudit('10.0.0.1');
    expect(hash1).toBe(hash2);
  });
});
