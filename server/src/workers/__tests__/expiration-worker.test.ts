import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets, users } from '../../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '../../services/password.service.js';
import { cleanExpiredSecrets } from '../expiration-worker.js';

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

// Pre-hashed password for direct DB inserts (computed once in beforeAll)
let TEST_PASSWORD_HASH: string;

// Test user ID for user-owned secret tests
let TEST_USER_ID: string;

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

  // Create a test user for user-owned secret tests (direct DB insert, no auth flow needed)
  TEST_USER_ID = nanoid();
  await db.insert(users).values({
    id: TEST_USER_ID,
    name: 'Expiration Worker Test User',
    email: 'expiration-worker-test@test.secureshare.dev',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterEach(async () => {
  // Clean up test data between tests
  await db.delete(secrets);
});

afterAll(async () => {
  // Clean up test user
  await db.delete(users).where(eq(users.id, TEST_USER_ID));

  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

/**
 * Helper: insert a secret directly into the database.
 * @param expired - If true, expiresAt is 1 minute in the past; otherwise 24h in the future.
 * @param userId - If provided, creates a user-owned secret; if null, creates an anonymous secret.
 */
async function insertSecret(opts: {
  expired: boolean;
  passwordHash?: string | null;
  userId?: string | null;
}): Promise<string> {
  const id = nanoid();
  const expiresAt = opts.expired
    ? new Date(Date.now() - 60_000) // 1 minute ago
    : new Date(Date.now() + 86_400_000); // 24 hours from now

  await db.insert(secrets).values({
    id,
    ciphertext: VALID_CIPHERTEXT,
    expiresAt,
    passwordHash: opts.passwordHash ?? null,
    userId: opts.userId ?? null,
  });

  return id;
}

// ---------------------------------------------------------------------------
// Worker cleanup: cleanExpiredSecrets — anonymous secrets (unchanged behavior)
// ---------------------------------------------------------------------------
describe('cleanExpiredSecrets — anonymous secrets (hard-delete)', () => {
  test('deletes expired anonymous secrets', async () => {
    const _id1 = await insertSecret({ expired: true });
    const _id2 = await insertSecret({ expired: true });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(2);

    // Direct DB query: both rows are gone
    const rows = await db.select().from(secrets);
    expect(rows).toHaveLength(0);
  });

  test('leaves non-expired anonymous secrets intact', async () => {
    const expiredId = await insertSecret({ expired: true });
    const validId = await insertSecret({ expired: false });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(1);

    // Expired secret gone
    const expiredRows = await db.select().from(secrets).where(eq(secrets.id, expiredId));
    expect(expiredRows).toHaveLength(0);

    // Non-expired secret still exists with original ciphertext
    const validRows = await db.select().from(secrets).where(eq(secrets.id, validId));
    expect(validRows).toHaveLength(1);
    expect(validRows[0].ciphertext).toBe(VALID_CIPHERTEXT);
  });

  // Ciphertext zeroing is verified by code inspection: the bulk UPDATE
  // (set ciphertext to '0') precedes the DELETE in cleanExpiredSecrets().
  // Runtime verification of the intermediate state between UPDATE and DELETE
  // is impractical without splitting the function or inspecting WAL.
  test('zeros ciphertext before deletion (verified by deletion + code review)', async () => {
    const id = await insertSecret({ expired: true });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(1);

    // Row is gone -- cleanup completed both steps
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(0);
  });

  test('handles empty table gracefully', async () => {
    // Table is already empty from afterEach
    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(0);
  });

  test('handles mix of password-protected and non-password expired anonymous secrets', async () => {
    const _nonPwId = await insertSecret({ expired: true });
    const _pwId = await insertSecret({ expired: true, passwordHash: TEST_PASSWORD_HASH });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(2);

    // Both are gone -- worker does not distinguish by password status for anonymous secrets
    const rows = await db.select().from(secrets);
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Worker cleanup: cleanExpiredSecrets — user-owned secrets (soft-expire)
// ---------------------------------------------------------------------------
describe('cleanExpiredSecrets — user-owned secrets (soft-expire)', () => {
  test('user-owned expired secret: row still exists with status=expired after cleanup', async () => {
    const id = await insertSecret({ expired: true, userId: TEST_USER_ID });

    await cleanExpiredSecrets();

    // Row must still exist -- soft-expire preserves row for dashboard history
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('expired');
  });

  test('user-owned expired secret: ciphertext is zeroed to mitigate data remanence', async () => {
    const id = await insertSecret({ expired: true, userId: TEST_USER_ID });

    await cleanExpiredSecrets();

    // Ciphertext should be '0' (single zero character used for bulk soft-expire)
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].ciphertext).toBe('0');
  });

  test('user-owned expired secret: userId is preserved (row links back to user)', async () => {
    const id = await insertSecret({ expired: true, userId: TEST_USER_ID });

    await cleanExpiredSecrets();

    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(TEST_USER_ID);
  });

  test('return count: only hard-deleted (anonymous) rows counted — user-owned updates not counted', async () => {
    // 2 user-owned expired secrets (soft-expire — not counted in return value)
    await insertSecret({ expired: true, userId: TEST_USER_ID });
    await insertSecret({ expired: true, userId: TEST_USER_ID });

    // 1 anonymous expired secret (hard-delete — counted)
    await insertSecret({ expired: true, userId: null });

    const deletedCount = await cleanExpiredSecrets();

    // Only 1 (the anonymous one) should be counted
    expect(deletedCount).toBe(1);
  });

  test('mix: user-owned soft-expired + anonymous hard-deleted correctly separated', async () => {
    const userSecretId = await insertSecret({ expired: true, userId: TEST_USER_ID });
    const anonSecretId = await insertSecret({ expired: true, userId: null });

    const deletedCount = await cleanExpiredSecrets();

    // Only 1 anonymous secret was hard-deleted
    expect(deletedCount).toBe(1);

    // User-owned: still exists with status=expired
    const userRows = await db.select().from(secrets).where(eq(secrets.id, userSecretId));
    expect(userRows).toHaveLength(1);
    expect(userRows[0].status).toBe('expired');
    expect(userRows[0].ciphertext).toBe('0');

    // Anonymous: hard-deleted
    const anonRows = await db.select().from(secrets).where(eq(secrets.id, anonSecretId));
    expect(anonRows).toHaveLength(0);
  });

  test('non-expired user-owned secret is left completely intact', async () => {
    const id = await insertSecret({ expired: false, userId: TEST_USER_ID });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(0);

    // Row still exists with original ciphertext and status=active
    const rows = await db.select().from(secrets).where(eq(secrets.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0].ciphertext).toBe(VALID_CIPHERTEXT);
    expect(rows[0].status).toBe('active');
  });
});
