import cron from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { lte } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets } from '../db/schema.js';
import { logger } from '../middleware/logger.js';

/** Reference to the running cron task (null when stopped) */
let task: ScheduledTask | null = null;

/**
 * Bulk-delete expired secrets using a two-step process:
 * 1. Zero ciphertext for all expired rows (data remanence mitigation, SECR-08)
 * 2. Delete the zeroed rows
 *
 * Never logs secret IDs (SECR-09).
 *
 * @returns Number of deleted rows
 */
export async function cleanExpiredSecrets(): Promise<number> {
  const now = new Date();

  // Step 1: Zero ciphertext for all expired secrets (data remanence mitigation)
  await db
    .update(secrets)
    .set({ ciphertext: '0' })
    .where(lte(secrets.expiresAt, now));

  // Step 2: Delete the zeroed rows
  const result = await db
    .delete(secrets)
    .where(lte(secrets.expiresAt, now));

  return result.rowCount ?? 0;
}

/**
 * Start the expiration cleanup worker.
 *
 * Runs every 5 minutes to bulk-delete expired secrets using a two-step
 * process: zero ciphertext (data remanence mitigation, SECR-08) then
 * delete the rows. Never logs secret IDs (SECR-09).
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
    task.stop();
    task = null;
    logger.info('Expiration worker stopped');
  }
}
