/**
 * Audit service: writes auth lifecycle events to the audit_logs table.
 *
 * ZERO-KNOWLEDGE INVARIANT: writeAuditEvent() receives userId and event metadata.
 * It must NEVER combine userId with secretId in any log line or DB record.
 * The audit_logs table has no secretId column by design. See INVARIANTS.md.
 *
 * Note: 'logout' only fires on explicit sign-out actions, not session expiry.
 * Session expiry is a TTL check — no session.delete is triggered by expiry alone.
 */

import { createHash } from 'node:crypto';
import { db } from '../db/connection.js';
import { auditLogs } from '../db/schema.js';
import { env } from '../config/env.js';
import { logger } from '../middleware/logger.js';

export type AuditEventType =
  | 'sign_up'
  | 'sign_in'
  | 'password_reset_requested'
  | 'oauth_connect'
  | 'logout';

/**
 * Hashes an IP address using SHA-256 with the IP_HASH_SALT.
 * Mirrors the pattern in subscribers.service.ts.
 * Never log the plain IP — always use the hash.
 */
export function hashIpForAudit(ip: string): string {
  return createHash('sha256')
    .update(env.IP_HASH_SALT + ip)
    .digest('hex');
}

/**
 * Writes a single audit event row to the audit_logs table.
 * Fire-and-forget safe: callers should void this and catch errors separately.
 */
export async function writeAuditEvent(opts: {
  eventType: AuditEventType;
  userId: string;
  ipHash?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(auditLogs).values({
    eventType: opts.eventType,
    userId: opts.userId,
    ipHash: opts.ipHash ?? null,
    userAgent: opts.userAgent ?? null,
    metadata: opts.metadata ?? null,
  });
}

/**
 * Fire-and-forget wrapper: calls writeAuditEvent and logs errors without throwing.
 * Use this inside Better Auth databaseHooks and Express middleware to prevent
 * an audit write failure from breaking the auth flow.
 *
 * ZK invariant: catch block logs only err.message — no userId in log output.
 */
export function fireAuditEvent(opts: Parameters<typeof writeAuditEvent>[0]): void {
  void writeAuditEvent(opts).catch((err: unknown) => {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, 'audit_write_failed');
  });
}
