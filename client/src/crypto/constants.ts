/**
 * Crypto constants for Torch Secret.
 *
 * Defines AES-256-GCM parameters and application-level crypto limits.
 * All values are derived from NIST SP800-38D and project requirements.
 */

/** The Web Crypto API algorithm name for AES-GCM */
export const ALGORITHM = 'AES-GCM' as const;

/** Key length in bits (AES-256) */
export const KEY_LENGTH = 256 as const;

/** IV length in bytes (96-bit, per NIST recommendation for AES-GCM) */
export const IV_LENGTH = 12 as const;

/** Authentication tag length in bytes (128-bit, produced by AES-GCM) */
export const TAG_LENGTH = 16 as const;

/** Maximum secret text length in characters (application limit) */
export const MAX_SECRET_SIZE = 10_000 as const;

/** Minimum padded size in bytes (floor for PADME padding tiers) */
export const MIN_PADDED_SIZE = 256 as const;
