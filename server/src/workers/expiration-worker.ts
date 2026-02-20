import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { lte, and, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';
import { logger } from '../middleware/logger.js';

/** Reference to the running cron task (null when stopped) */
let task: ScheduledTask | null = null;

/**
 * Bulk-expire and bulk-delete expired secrets using split logic:
 *
 * Step 1: Soft-expire user-owned rows — zero ciphertext and set status='expired'.
 *         Row is preserved for dashboard history (SECR-08 for data remanence).
 *
 * Step 2: Zero ciphertext for anonymous expired rows (data remanence mitigation).
 *
 * Step 3: Hard-delete anonymous expired rows (unchanged behavior for anonymous secrets).
 *
 * Never logs secret IDs (SECR-09).
 *
 * @returns Number of hard-deleted (anonymous) rows
 */
export async function cleanExpiredSecrets(): Promise<number> {
  const now = new Date();

  // Step 1: Soft-expire user-owned rows — keep for dashboard history
  // Zero ciphertext and set status='expired'; do NOT delete the row.
  await db
    .update(secrets)
    .set({ ciphertext: '0', status: 'expired' })
    .where(and(lte(secrets.expiresAt, now), isNotNull(secrets.userId)));

  // Step 2: Zero ciphertext for anonymous expired rows (data remanence mitigation)
  await db
    .update(secrets)
    .set({ ciphertext: '0' })
    .where(and(lte(secrets.expiresAt, now), isNull(secrets.userId)));

  // Step 3: Hard-delete anonymous expired rows (unchanged behavior for anonymous)
  const result = await db
    .delete(secrets)
    .where(and(lte(secrets.expiresAt, now), isNull(secrets.userId)));

  return result.rowCount ?? 0;
}

/**
 * Start the expiration cleanup worker.
 *
 * Runs every 5 minutes to expire/delete expired secrets using split logic:
 * user-owned rows are soft-expired (status='expired', row kept);
 * anonymous rows are hard-deleted. Never logs secret IDs (SECR-09).
 */
export function startExpirationWorker(): void {
  task = cron.schedule('*/5 * * * *', async () => {
    try {
      const deletedCount = await cleanExpiredSecrets();

      if (deletedCount > 0) {
        logger.info({ deletedCount }, 'Expired secrets cleaned up');
      }
    } catch (err) {
      logger.error({ err }, 'Expiration worker error');
      // Do NOT re-throw -- prevents process crash from cron callback
    }
  });

  logger.info('Expiration worker started (every 5 minutes)');
}

/**
 * Stop the expiration cleanup worker.
 *
 * Called during graceful shutdown to prevent new cron runs
 * while in-flight requests complete.
 */
export function stopExpirationWorker(): void {
  if (task) {
    void task.stop();
    task = null;
    logger.info('Expiration worker stopped');
  }
}
