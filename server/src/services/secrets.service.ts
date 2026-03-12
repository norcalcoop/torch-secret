import { eq, sql, desc, and, or, lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets, users, type Secret } from '../db/schema.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { sendSecretViewedNotification } from './notification.service.js';

/** Duration string to milliseconds mapping */
const DURATION_MS: Record<string, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

/** Maximum password attempts before auto-destroy */
const MAX_PASSWORD_ATTEMPTS = 3;

/**
 * Creates a new secret with the given ciphertext and expiration.
 *
 * The server never inspects or transforms the ciphertext -- it is
 * stored exactly as received from the client's encryption module.
 *
 * If a password is provided, it is hashed with Argon2id and stored
 * alongside the secret. The password is never stored in plaintext.
 *
 * If a userId is provided, the secret is linked to the user's account
 * for dashboard display. Anonymous secrets have userId = null.
 *
 * If notify is true and userId is set, an email is sent when the secret is viewed.
 *
 * @returns The inserted row (contains nanoid ID, expiresAt, createdAt)
 */
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
  password?: string,
  userId?: string,
  label?: string,
  notify?: boolean,
): Promise<Secret> {
  const expiresAt = new Date(Date.now() + DURATION_MS[expiresIn]);
  const passwordHash = password ? await hashPassword(password) : null;

  const [inserted] = await db
    .insert(secrets)
    .values({
      ciphertext,
      expiresAt,
      passwordHash,
      userId: userId ?? null,
      label: label ?? null,
      notify: notify ?? false,
    })
    .returning();

  return inserted;
}

/**
 * Atomically retrieves and destroys a secret using a three-step
 * transaction: SELECT -> ZERO ciphertext -> DELETE (anonymous) or
 * UPDATE status='viewed' (user-owned).
 *
 * For anonymous secrets: ciphertext is overwritten with zero characters
 * before row deletion to mitigate data remanence in PostgreSQL's WAL
 * and shared buffers (SECR-08). Row is hard-deleted.
 *
 * For user-owned secrets: ciphertext is zeroed and status is set to
 * 'viewed' with viewedAt timestamp. Row is preserved for dashboard history.
 *
 * Returns null for nonexistent, expired, already-consumed, or
 * password-protected secrets. Password-protected secrets MUST be
 * retrieved via verifyAndRetrieve to prevent bypassing password
 * protection via direct API call.
 *
 * The caller must not distinguish between these cases (SECR-07
 * anti-enumeration).
 */
export async function retrieveAndDestroy(id: string): Promise<Secret | null> {
  return db.transaction(async (tx) => {
    // Step 1: SELECT -- get the secret with owner email via JOIN (single DB round-trip)
    const [secret] = await tx
      .select({
        id: secrets.id,
        ciphertext: secrets.ciphertext,
        expiresAt: secrets.expiresAt,
        passwordHash: secrets.passwordHash,
        passwordAttempts: secrets.passwordAttempts,
        userId: secrets.userId,
        notify: secrets.notify,
        status: secrets.status,
        label: secrets.label,
        viewedAt: secrets.viewedAt,
        createdAt: secrets.createdAt,
        userEmail: users.email,
      })
      .from(secrets)
      .leftJoin(users, eq(secrets.userId, users.id))
      .where(eq(secrets.id, id));

    if (!secret) {
      return null;
    }

    // Expiration guard: treat expired secrets as not-found (SECR-07 anti-enumeration)
    // Opportunistically clean up the expired row since we're already in a transaction
    if (secret.expiresAt <= new Date()) {
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
        .where(eq(secrets.id, id));
      await tx.delete(secrets).where(eq(secrets.id, id));
      return null;
    }

    // Reject password-protected secrets -- they must go through verifyAndRetrieve
    if (secret.passwordHash !== null) {
      return null;
    }

    // Separate userEmail from the Secret-compatible fields before any returns
    const { userEmail, ...secretRow } = secret;

    // Step 2: ZERO -- overwrite ciphertext with zero characters before deletion/update
    // PostgreSQL text columns cannot contain null bytes (\x00), so we use '0'.
    // This still mitigates data remanence in PostgreSQL WAL and shared buffers.
    await tx
      .update(secrets)
      .set({ ciphertext: '0'.repeat(secretRow.ciphertext.length) })
      .where(eq(secrets.id, id));

    if (secretRow.userId !== null) {
      // Step 3 (user-owned): UPDATE status='viewed', viewedAt -- preserve row for dashboard history
      await tx
        .update(secrets)
        .set({ status: 'viewed', viewedAt: new Date() })
        .where(eq(secrets.id, id));
    } else {
      // Step 3 (anonymous): DELETE -- remove the row entirely
      await tx.delete(secrets).where(eq(secrets.id, id));
    }

    // Fire-and-forget: dispatch notification after transaction resolves
    // Only fires if the owner opted in AND the lookup returned a valid email
    // userId !== null is defense-in-depth (anonymous secrets always have notify=false)
    if (secretRow.notify && secretRow.userId !== null && userEmail) {
      void sendSecretViewedNotification(userEmail, new Date());
    }

    // Return the original secret row (with real ciphertext from Step 1)
    return secretRow;
  });
}

/**
 * Non-destructive metadata check for a secret.
 *
 * Returns whether the secret requires a password and how many
 * password attempts remain.
 *
 * Expired secrets are opportunistically cleaned up (mirrors retrieveAndDestroy):
 * - Anonymous: hard-deleted after ciphertext is zeroed
 * - User-owned: ciphertext zeroed and status set to 'expired' (row preserved for dashboard history)
 *
 * Returns null if the secret does not exist or has expired.
 */
export async function getSecretMeta(id: string): Promise<{
  requiresPassword: boolean;
  passwordAttemptsRemaining: number;
} | null> {
  const [secret] = await db
    .select({
      passwordHash: secrets.passwordHash,
      passwordAttempts: secrets.passwordAttempts,
      expiresAt: secrets.expiresAt,
      userId: secrets.userId,
      ciphertext: secrets.ciphertext,
    })
    .from(secrets)
    .where(eq(secrets.id, id));

  if (!secret) {
    return null;
  }

  // Expiration guard: treat expired secrets as not-found (SECR-07 anti-enumeration)
  // Opportunistically clean up the expired row (no transaction wrapper — cleanup is idempotent)
  if (secret.expiresAt <= new Date()) {
    // Zero ciphertext first (data remanence mitigation — matches retrieveAndDestroy pattern)
    await db
      .update(secrets)
      .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
      .where(eq(secrets.id, id));
    if (secret.userId !== null) {
      // User-owned: soft-expire — preserve row for dashboard history
      await db.update(secrets).set({ status: 'expired' }).where(eq(secrets.id, id));
    } else {
      // Anonymous: hard-delete
      await db.delete(secrets).where(eq(secrets.id, id));
    }
    return null;
  }

  return {
    requiresPassword: secret.passwordHash !== null,
    passwordAttemptsRemaining: Math.max(0, MAX_PASSWORD_ATTEMPTS - secret.passwordAttempts),
  };
}

/**
 * Verify a password and atomically retrieve + destroy a password-protected secret.
 *
 * Uses a database transaction to ensure atomicity of:
 * 1. Password verification (constant-time via argon2.verify)
 * 2. Attempt increment on failure
 * 3. Auto-destroy after MAX_PASSWORD_ATTEMPTS failures
 * 4. Ciphertext zeroing + row deletion (anonymous) or status update (user-owned) on success
 *
 * Returns:
 * - `{ success: true, secret }` -- password correct, secret destroyed/soft-deleted
 * - `{ success: false, attemptsRemaining: N }` -- wrong password, N attempts left
 * - `null` -- secret not found or not password-protected
 */
export async function verifyAndRetrieve(
  id: string,
  password: string,
): Promise<
  { success: true; secret: Secret } | { success: false; attemptsRemaining: number } | null
> {
  return db.transaction(async (tx) => {
    // Step 0: Acquire a pessimistic row-level lock (FOR UPDATE) before reading.
    // Without this lock, concurrent correct-password requests all read the secret
    // before any of them deletes it — all pass argon2.verify and all receive the
    // ciphertext (race condition). FOR UPDATE serializes concurrent calls: the
    // second caller blocks until the first transaction commits (row deleted), then
    // sees no row and returns null → 404. Drizzle ORM does not expose FOR UPDATE
    // natively, so we use a raw execute() exclusively for the lock acquisition.
    // The subsequent Drizzle ORM SELECT (Step 1) runs inside the same transaction
    // and inherits the lock without contention.
    const lockRows = await tx.execute(sql`SELECT id FROM secrets WHERE id = ${id} FOR UPDATE`);
    if (lockRows.rows.length === 0) {
      return null;
    }

    // Step 1: SELECT the full secret row with owner email via JOIN (single DB round-trip)
    const [secret] = await tx
      .select({
        id: secrets.id,
        ciphertext: secrets.ciphertext,
        expiresAt: secrets.expiresAt,
        passwordHash: secrets.passwordHash,
        passwordAttempts: secrets.passwordAttempts,
        userId: secrets.userId,
        notify: secrets.notify,
        status: secrets.status,
        label: secrets.label,
        viewedAt: secrets.viewedAt,
        createdAt: secrets.createdAt,
        userEmail: users.email,
      })
      .from(secrets)
      .leftJoin(users, eq(secrets.userId, users.id))
      .where(eq(secrets.id, id));

    if (!secret) {
      return null;
    }

    // Expiration guard: treat expired secrets as not-found (SECR-07 anti-enumeration)
    // Opportunistically clean up the expired row since we're already in a transaction
    if (secret.expiresAt <= new Date()) {
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
        .where(eq(secrets.id, id));
      await tx.delete(secrets).where(eq(secrets.id, id));
      return null;
    }

    // Should not happen (route guards prevent this), but defend in depth
    if (!secret.passwordHash) {
      return null;
    }

    // Separate userEmail from the Secret-compatible fields
    const { userEmail, ...secretRow } = secret;

    // Step 2: Verify password (constant-time via argon2.verify)
    // passwordHash is non-null here: the `!secret.passwordHash` guard above returned early
    const isValid = await verifyPassword(secretRow.passwordHash!, password);

    if (isValid) {
      // Step 3a: Password correct -- zero ciphertext first (data remanence mitigation)
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secretRow.ciphertext.length) })
        .where(eq(secrets.id, id));

      if (secretRow.userId !== null) {
        // User-owned: soft-delete (preserve row for dashboard history)
        await tx
          .update(secrets)
          .set({ status: 'viewed', viewedAt: new Date() })
          .where(eq(secrets.id, id));
      } else {
        // Anonymous: hard-delete
        await tx.delete(secrets).where(eq(secrets.id, id));
      }

      // Fire-and-forget: dispatch notification after transaction resolves
      // Only fires if the owner opted in AND the lookup returned a valid email
      // userId !== null is defense-in-depth (anonymous secrets always have notify=false)
      if (secretRow.notify && secretRow.userId !== null && userEmail) {
        void sendSecretViewedNotification(userEmail, new Date());
      }

      return { success: true, secret: secretRow };
    }

    // Step 3b: Password wrong -- atomically increment attempts
    const newAttempts = secretRow.passwordAttempts + 1;

    if (newAttempts >= MAX_PASSWORD_ATTEMPTS) {
      // Auto-destroy: zero ciphertext then delete (always hard-delete on auto-destroy)
      await tx
        .update(secrets)
        .set({ ciphertext: '0'.repeat(secretRow.ciphertext.length) })
        .where(eq(secrets.id, id));
      await tx.delete(secrets).where(eq(secrets.id, id));
      return { success: false, attemptsRemaining: 0 };
    }

    // Increment attempt counter atomically at the database level
    await tx
      .update(secrets)
      .set({ passwordAttempts: sql`${secrets.passwordAttempts} + 1` })
      .where(eq(secrets.id, id));

    return { success: false, attemptsRemaining: MAX_PASSWORD_ATTEMPTS - newAttempts };
  });
}

/** Number of secrets returned per dashboard page (API-02) */
const DASHBOARD_PAGE_SIZE = 20;

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      typeof (parsed as Record<string, unknown>).id === 'string' &&
      'createdAt' in parsed &&
      typeof (parsed as Record<string, unknown>).createdAt === 'string'
    ) {
      const { id, createdAt } = parsed as { id: string; createdAt: string };
      return { id, createdAt: new Date(createdAt) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the authenticated user's secrets (metadata only — no ciphertext, no passwordHash).
 * Supports cursor-based pagination and optional status filtering.
 *
 * DASH-05: This SELECT explicitly lists safe columns only. Never add ciphertext or passwordHash.
 *
 * @param userId - The authenticated user's ID
 * @param options.cursor - Opaque base64 cursor encoding { id, createdAt } of last seen item
 * @param options.status - Filter by status; 'all' returns all statuses (default)
 * @param options.limit - Override page size (defaults to DASHBOARD_PAGE_SIZE)
 * @returns { secrets, nextCursor } where nextCursor is null on the last page
 */
export async function getUserSecrets(
  userId: string,
  options?: {
    cursor?: string;
    status?: 'all' | 'active' | 'viewed' | 'expired' | 'deleted';
    limit?: number;
  },
): Promise<{
  secrets: {
    id: string;
    label: string | null;
    createdAt: Date;
    expiresAt: Date;
    status: 'active' | 'viewed' | 'expired' | 'deleted';
    notify: boolean;
    viewedAt: Date | null;
  }[];
  nextCursor: string | null;
}> {
  const pageSize = options?.limit ?? DASHBOARD_PAGE_SIZE;
  const status = options?.status ?? 'all';

  // Status filter: undefined for 'all' — Drizzle's and() silently drops undefined
  const statusFilter = status === 'all' ? undefined : eq(secrets.status, status);

  // Cursor filter: undefined for first page (no cursor)
  let cursorFilter: ReturnType<typeof or> | undefined;
  if (options?.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded) {
      cursorFilter = or(
        lt(secrets.createdAt, decoded.createdAt),
        and(eq(secrets.createdAt, decoded.createdAt), lt(secrets.id, decoded.id)),
      );
    }
    // Invalid cursor: treat as no cursor (route validates before calling service)
  }

  // Fetch pageSize + 1 to detect if a next page exists
  const rows = await db
    .select({
      id: secrets.id,
      label: secrets.label,
      createdAt: secrets.createdAt,
      expiresAt: secrets.expiresAt,
      status: secrets.status,
      notify: secrets.notify,
      viewedAt: secrets.viewedAt,
      // ciphertext intentionally excluded (DASH-05)
      // passwordHash intentionally excluded (DASH-05)
    })
    .from(secrets)
    .where(and(eq(secrets.userId, userId), statusFilter, cursorFilter))
    .orderBy(desc(secrets.createdAt), desc(secrets.id))
    .limit(pageSize + 1);

  // N+1 detection
  if (rows.length > pageSize) {
    // There IS a next page — encode cursor from the last item in the current page (index pageSize - 1)
    const lastItem = rows[pageSize - 1];
    const nextCursor = encodeCursor(lastItem.id, lastItem.createdAt);
    return { secrets: rows.slice(0, pageSize), nextCursor };
  }

  return { secrets: rows, nextCursor: null };
}

/**
 * Soft-deletes an Active secret owned by the given user.
 * Zeros ciphertext and sets status='deleted'. Row is preserved for dashboard history.
 * Returns true on success, null if not found / wrong owner / non-active status.
 *
 * Owner verification and status check happen inside the transaction to prevent TOCTOU.
 */
export async function deleteUserSecret(secretId: string, userId: string): Promise<true | null> {
  return db.transaction(async (tx) => {
    const [secret] = await tx
      .select({
        userId: secrets.userId,
        status: secrets.status,
        ciphertext: secrets.ciphertext,
      })
      .from(secrets)
      .where(eq(secrets.id, secretId));

    if (!secret || secret.userId !== userId || secret.status !== 'active') {
      return null;
    }

    await tx
      .update(secrets)
      .set({
        ciphertext: '0'.repeat(secret.ciphertext.length),
        status: 'deleted',
      })
      .where(eq(secrets.id, secretId));

    return true;
  });
}
