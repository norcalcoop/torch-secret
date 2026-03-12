/**
 * QUAL-01 — DB-level pgEnum enforcement tests.
 *
 * Verifies that the secretStatusEnum and subscriberStatusEnum pgEnum types
 * actually reject invalid values at the PostgreSQL level, and that valid
 * enum values persist correctly through Drizzle ORM inserts.
 *
 * These are integration tests against the real database — no mocks.
 */

import { describe, test, expect, afterAll, afterEach } from 'vitest';
import { db, pool } from '../connection.js';
import { secrets, marketingSubscribers } from '../schema.js';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clean up any test rows inserted during a test */
async function cleanupSecret(id: string): Promise<void> {
  await db.delete(secrets).where(eq(secrets.id, id));
}

async function cleanupSubscriber(email: string): Promise<void> {
  await db.delete(marketingSubscribers).where(eq(marketingSubscribers.email, email));
}

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// secrets.status pgEnum enforcement
// ---------------------------------------------------------------------------

describe('secrets.status pgEnum enforcement (QUAL-01)', () => {
  afterEach(async () => {
    // Remove any surviving test rows (valid-insert tests)
    await db.execute(sql`DELETE FROM secrets WHERE label LIKE 'schema-enum-test-%'`);
  });

  test('inserting an invalid status value raises a Postgres error at DB level', async () => {
    const id = nanoid();

    await expect(
      db.execute(sql`
        INSERT INTO secrets (id, ciphertext, expires_at, status)
        VALUES (
          ${id},
          'dGVzdA==',
          NOW() + INTERVAL '1 hour',
          'INVALID_STATUS_VALUE'
        )
      `),
    ).rejects.toThrow();
  });

  test('inserting a valid status value "active" persists correctly', async () => {
    const id = nanoid();
    try {
      await db.insert(secrets).values({
        id,
        ciphertext: 'dGVzdA==',
        expiresAt: new Date(Date.now() + 3_600_000),
        status: 'active',
        label: 'schema-enum-test-active',
      });

      const [row] = await db
        .select({ status: secrets.status })
        .from(secrets)
        .where(eq(secrets.id, id));

      expect(row).toBeDefined();
      expect(row.status).toBe('active');
    } finally {
      await cleanupSecret(id);
    }
  });

  test('inserting a valid status value "expired" persists correctly', async () => {
    const id = nanoid();
    try {
      await db.insert(secrets).values({
        id,
        ciphertext: 'dGVzdA==',
        expiresAt: new Date(Date.now() + 3_600_000),
        status: 'expired',
        label: 'schema-enum-test-expired',
      });

      const [row] = await db
        .select({ status: secrets.status })
        .from(secrets)
        .where(eq(secrets.id, id));

      expect(row).toBeDefined();
      expect(row.status).toBe('expired');
    } finally {
      await cleanupSecret(id);
    }
  });

  test('inserting a valid status value "viewed" persists correctly', async () => {
    const id = nanoid();
    try {
      await db.insert(secrets).values({
        id,
        ciphertext: 'dGVzdA==',
        expiresAt: new Date(Date.now() + 3_600_000),
        status: 'viewed',
        label: 'schema-enum-test-viewed',
      });

      const [row] = await db
        .select({ status: secrets.status })
        .from(secrets)
        .where(eq(secrets.id, id));

      expect(row).toBeDefined();
      expect(row.status).toBe('viewed');
    } finally {
      await cleanupSecret(id);
    }
  });

  test('inserting a valid status value "deleted" persists correctly', async () => {
    const id = nanoid();
    try {
      await db.insert(secrets).values({
        id,
        ciphertext: 'dGVzdA==',
        expiresAt: new Date(Date.now() + 3_600_000),
        status: 'deleted',
        label: 'schema-enum-test-deleted',
      });

      const [row] = await db
        .select({ status: secrets.status })
        .from(secrets)
        .where(eq(secrets.id, id));

      expect(row).toBeDefined();
      expect(row.status).toBe('deleted');
    } finally {
      await cleanupSecret(id);
    }
  });
});

// ---------------------------------------------------------------------------
// marketing_subscribers.status pgEnum enforcement
// ---------------------------------------------------------------------------

describe('marketing_subscribers.status pgEnum enforcement (QUAL-01)', () => {
  const TEST_EMAIL_PREFIX = 'schema-enum-sub-test-';

  afterEach(async () => {
    await db.execute(
      sql`DELETE FROM marketing_subscribers WHERE email LIKE ${TEST_EMAIL_PREFIX + '%'}`,
    );
  });

  test('inserting an invalid subscriber status value raises a Postgres error at DB level', async () => {
    await expect(
      db.execute(sql`
        INSERT INTO marketing_subscribers (id, email, status, consent_text, ip_hash)
        VALUES (
          ${nanoid()},
          'schema-enum-sub-invalid@test.local',
          'INVALID_STATUS_VALUE',
          'test consent',
          'fakehash'
        )
      `),
    ).rejects.toThrow();
  });

  test('inserting a valid subscriber status value "pending" persists correctly', async () => {
    const email = `${TEST_EMAIL_PREFIX}pending@test.local`;
    try {
      await db.insert(marketingSubscribers).values({
        email,
        status: 'pending',
        consentText: 'test consent',
        ipHash: 'fakehash',
      });

      const [row] = await db
        .select({ status: marketingSubscribers.status })
        .from(marketingSubscribers)
        .where(eq(marketingSubscribers.email, email));

      expect(row).toBeDefined();
      expect(row.status).toBe('pending');
    } finally {
      await cleanupSubscriber(email);
    }
  });

  test('inserting a valid subscriber status value "confirmed" persists correctly', async () => {
    const email = `${TEST_EMAIL_PREFIX}confirmed@test.local`;
    try {
      await db.insert(marketingSubscribers).values({
        email,
        status: 'confirmed',
        consentText: 'test consent',
        ipHash: 'fakehash',
      });

      const [row] = await db
        .select({ status: marketingSubscribers.status })
        .from(marketingSubscribers)
        .where(eq(marketingSubscribers.email, email));

      expect(row).toBeDefined();
      expect(row.status).toBe('confirmed');
    } finally {
      await cleanupSubscriber(email);
    }
  });

  test('inserting a valid subscriber status value "unsubscribed" persists correctly', async () => {
    const email = `${TEST_EMAIL_PREFIX}unsubscribed@test.local`;
    try {
      await db.insert(marketingSubscribers).values({
        email,
        status: 'unsubscribed',
        consentText: 'test consent',
        ipHash: 'fakehash',
      });

      const [row] = await db
        .select({ status: marketingSubscribers.status })
        .from(marketingSubscribers)
        .where(eq(marketingSubscribers.email, email));

      expect(row).toBeDefined();
      expect(row.status).toBe('unsubscribed');
    } finally {
      await cleanupSubscriber(email);
    }
  });
});
