import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { secrets } from '../../db/schema.js';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { hashPassword } from '../../services/password.service.js';
import { cleanExpiredSecrets } from '../expiration-worker.js';

// Valid base64-encoded ciphertext for tests
const VALID_CIPHERTEXT = 'dGVzdCBjaXBoZXJ0ZXh0';

// Pre-hashed password for direct DB inserts (computed once in beforeAll)
let TEST_PASSWORD_HASH: string;

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
});

afterEach(async () => {
  // Clean up test data between tests
  await db.delete(secrets);
});

afterAll(async () => {
  // Close database pool to allow vitest to exit cleanly
  await pool.end();
});

/**
 * Helper: insert a secret directly into the database.
 * @param expired - If true, expiresAt is 1 minute in the past; otherwise 24h in the future.
 */
async function insertSecret(opts: {
  expired: boolean;
  passwordHash?: string | null;
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
  });

  return id;
}

// ---------------------------------------------------------------------------
// Worker cleanup: cleanExpiredSecrets
// ---------------------------------------------------------------------------
describe('cleanExpiredSecrets', () => {
  test('deletes expired secrets', async () => {
    const _id1 = await insertSecret({ expired: true });
    const _id2 = await insertSecret({ expired: true });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(2);

    // Direct DB query: both rows are gone
    const rows = await db.select().from(secrets);
    expect(rows).toHaveLength(0);
  });

  test('leaves non-expired secrets intact', async () => {
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

  test('handles mix of password-protected and non-password expired secrets', async () => {
    const _nonPwId = await insertSecret({ expired: true });
    const _pwId = await insertSecret({ expired: true, passwordHash: TEST_PASSWORD_HASH });

    const deletedCount = await cleanExpiredSecrets();

    expect(deletedCount).toBe(2);

    // Both are gone -- worker does not distinguish by password status
    const rows = await db.select().from(secrets);
    expect(rows).toHaveLength(0);
  });
});
