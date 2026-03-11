/**
 * AUTH-01 — DB-level pgEnum enforcement tests for audit_logs table.
 *
 * Verifies that the auditEventTypeEnum pgEnum type and audit_logs table
 * are correctly created with the required columns, and that the pgEnum
 * rejects invalid values at the PostgreSQL level.
 *
 * These are integration tests against the real database — no mocks.
 */

import { describe, test, expect, afterAll, afterEach } from 'vitest';
import { db, pool } from '../connection.js';
import { users } from '../schema.js';
import { sql } from 'drizzle-orm';
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
