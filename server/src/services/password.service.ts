import argon2 from 'argon2';

/**
 * OWASP-recommended Argon2id parameters for password hashing.
 *
 * - memoryCost: 19,456 KiB (19 MiB) -- OWASP minimum
 * - timeCost: 2 iterations -- OWASP minimum
 * - parallelism: 1 thread -- OWASP recommendation
 *
 * The argon2 package runs hashing in a separate thread pool (via N-API
 * worker threads) so these parameters do NOT block the Node.js event loop.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a plaintext password with Argon2id.
 *
 * Returns a PHC-format string containing algorithm, params, salt, and hash:
 * `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`
 *
 * Salt is auto-generated (16 random bytes) by the argon2 library.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against an Argon2id hash.
 *
 * Uses `crypto.timingSafeEqual` internally (PASS-05) to prevent
 * timing side-channel attacks on the hash comparison.
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}
