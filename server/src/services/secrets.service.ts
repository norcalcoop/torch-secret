import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { secrets, type Secret } from '../db/schema.js';

/** Duration string to milliseconds mapping */
const DURATION_MS: Record<string, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

/**
 * Creates a new secret with the given ciphertext and expiration.
 *
 * The server never inspects or transforms the ciphertext -- it is
 * stored exactly as received from the client's encryption module.
 *
 * @returns The inserted row (contains nanoid ID, expiresAt, createdAt)
 */
export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d',
): Promise<Secret> {
  const expiresAt = new Date(Date.now() + DURATION_MS[expiresIn]);

  const [inserted] = await db
    .insert(secrets)
    .values({ ciphertext, expiresAt })
    .returning();

  return inserted;
}

/**
 * Atomically retrieves and destroys a secret using a three-step
 * transaction: SELECT -> ZERO ciphertext -> DELETE.
 *
 * The ciphertext is overwritten with zero characters before row deletion
 * to mitigate data remanence in PostgreSQL's WAL and shared buffers
 * (SECR-08).
 *
 * Returns null for nonexistent, expired, or already-consumed secrets.
 * The caller must not distinguish between these cases (SECR-07
 * anti-enumeration).
 */
export async function retrieveAndDestroy(
  id: string,
): Promise<Secret | null> {
  return db.transaction(async (tx) => {
    // Step 1: SELECT -- get the secret
    const [secret] = await tx
      .select()
      .from(secrets)
      .where(eq(secrets.id, id));

    if (!secret) {
      return null;
    }

    // Step 2: ZERO -- overwrite ciphertext with zero characters before deletion
    // PostgreSQL text columns cannot contain null bytes (\x00), so we use '0'.
    // This still mitigates data remanence in PostgreSQL WAL and shared buffers.
    await tx
      .update(secrets)
      .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
      .where(eq(secrets.id, id));

    // Step 3: DELETE -- remove the row entirely
    await tx.delete(secrets).where(eq(secrets.id, id));

    // Return the original secret (with real ciphertext from Step 1)
    return secret;
  });
}
