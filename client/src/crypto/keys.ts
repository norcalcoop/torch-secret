/**
 * Key management module for SecureShare.
 *
 * Generates 256-bit AES-GCM keys, exports them to base64url for URL fragment
 * embedding, and imports them back for decryption. This module is the foundation
 * of the zero-knowledge guarantee: the key lives only in the URL fragment (#key)
 * and never reaches the server.
 *
 * Security constraints:
 * - Uses crypto.subtle exclusively (no Math.random, no third-party crypto)
 * - Generated keys are extractable (needed for URL embedding)
 * - Imported keys are non-extractable, decrypt-only (receiving side restriction)
 * - Each call generates a fresh 256-bit key via crypto.getRandomValues internally
 */

import { ALGORITHM, KEY_LENGTH } from './constants';
import { uint8ArrayToBase64Url, base64UrlToUint8Array } from './encoding';

/** Expected base64url string length for a 256-bit (32-byte) key without padding */
const EXPECTED_KEY_BASE64URL_LENGTH = 43;

/**
 * Generate a new 256-bit AES-GCM key and its base64url representation.
 *
 * The returned key is extractable with encrypt+decrypt usages (creator side).
 * The base64url string is suitable for embedding in a URL fragment.
 *
 * @returns Object with `key` (CryptoKey) and `keyBase64Url` (string, 43 chars)
 */
export async function generateKey(): Promise<{
  key: CryptoKey;
  keyBase64Url: string;
}> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable: must be true to export for URL embedding
    ['encrypt', 'decrypt'],
  );

  const keyBase64Url = await exportKeyToBase64Url(key);

  return { key, keyBase64Url };
}

/**
 * Export a CryptoKey to a base64url string.
 *
 * Extracts the raw key bytes and encodes them as a URL-safe base64 string
 * without padding. A 256-bit key produces exactly 43 characters.
 *
 * @param key - An extractable AES-GCM CryptoKey
 * @returns base64url-encoded key string (43 characters for 256-bit keys)
 */
export async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return uint8ArrayToBase64Url(new Uint8Array(rawKey));
}

/**
 * Import a CryptoKey from a base64url string.
 *
 * The imported key is non-extractable (no need to re-export) and restricted
 * to decrypt-only usage (receiving side only decrypts).
 *
 * @param base64url - base64url-encoded key string (must be 43 chars for 256-bit)
 * @throws Error if the base64url string is not the expected length for a 256-bit key
 * @throws DOMException if the decoded bytes do not form a valid AES key
 * @returns A non-extractable, decrypt-only AES-GCM CryptoKey
 */
export async function importKeyFromBase64Url(base64url: string): Promise<CryptoKey> {
  if (base64url.length !== EXPECTED_KEY_BASE64URL_LENGTH) {
    throw new Error(
      `Invalid key length: expected ${EXPECTED_KEY_BASE64URL_LENGTH} base64url characters for a 256-bit key, got ${base64url.length}`,
    );
  }

  const rawKey = base64UrlToUint8Array(base64url);

  return crypto.subtle.importKey(
    'raw',
    rawKey as Uint8Array<ArrayBuffer>,
    ALGORITHM,
    false, // non-extractable: no need to re-export after import
    ['decrypt'], // decrypt-only: receiving side restriction
  );
}
