import { describe, test, expect, afterAll } from 'vitest';
import { db } from '../../db/connection.js';
import { pool } from '../../db/connection.js';
import { sql } from 'drizzle-orm';

afterAll(async () => {
  await pool.end();
});

/**
 * ZK Invariant — DB schema enforcement (TEST-04)
 *
 * No non-secrets table may contain a column whose name resembles a secretId.
 * The `secrets` table itself is excluded: it legitimately holds `id` (secretId)
 * and `user_id` (userId FK) by design. The invariant prevents OTHER tables from
 * ever gaining a cross-reference to a secretId, which would allow an attacker
 * with DB read access to correlate which user created which secret.
 *
 * Coverage of ZK invariant across all layers:
 *   - DB schema:  enforced here via information_schema.columns query
 *   - Pino logs:  enforced by redactUrl() regex — covered by unit tests in secrets.test.ts
 *   - PostHog:    enforced by sanitizeEventUrls() before_send hook (client-side browser JS;
 *                 not reachable by Vitest server tests — structural enforcement reviewed
 *                 in Phase 57 CONTEXT.md)
 */
describe('ZK invariant — DB schema (TEST-04)', () => {
  const NON_SECRET_TABLES = [
    'users',
    'sessions',
    'accounts',
    'verification',
    'marketing_subscribers',
    'audit_logs',
  ];

  test('non-secrets tables contain no secretId-shaped column', async () => {
    // Single IN (...) query across all 5 tables — efficient and readable.
    // PostgreSQL ~* is case-insensitive regex: catches secret_id, secretId,
    // secret_ref_id, etc. The 'public' schema filter prevents false positives
    // from pg_catalog tables with the same names.
    // Note: sql.raw() is used for the array literal because Drizzle's ${...}
    // interpolation in sql`` renders a JS array as a tuple ($1, $2, ...) rather
    // than a PostgreSQL array literal, which causes ANY() to reject it.
    const tableList = NON_SECRET_TABLES.map((t) => `'${t}'`).join(', ');
    const result = await db.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY(ARRAY[${sql.raw(tableList)}])
        AND column_name ~* 'secret.*(id|_id)$'
    `);

    // If any rows exist, a future migration introduced a secretId column to a
    // non-secrets table — the ZK invariant is violated. The error will name
    // the offending table and column for fast diagnosis.
    expect(result.rows).toHaveLength(0);
  });
});
