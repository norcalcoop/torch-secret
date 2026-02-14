/**
 * Decrypt module for SecureShare.
 *
 * Decrypts ciphertext using AES-256-GCM with a key from a base64url string.
 * Integrates: keys (importKeyFromBase64Url), padding (unpadPlaintext), encoding (base64ToUint8Array).
 *
 * Security invariants:
 * - Wrong key or tampered data produces a generic error (no internals exposed)
 * - Validates ciphertext length before attempting decryption
 * - No Math.random, no third-party crypto libraries
 */

import { importKeyFromBase64Url } from './keys';
import { unpadPlaintext } from './padding';
import { base64ToUint8Array } from './encoding';
import { ALGORITHM, IV_LENGTH, TAG_LENGTH } from './constants';

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 *
 * The ciphertext is base64-decoded, split into IV and encrypted data,
 * decrypted with the imported key, then unpadded to recover the original
 * plaintext.
 *
 * @param ciphertextBase64 - Base64-encoded blob: [IV 12 bytes][ciphertext + auth tag]
 * @param keyBase64Url - Base64url-encoded 256-bit AES-GCM key (43 characters)
 * @returns The original plaintext string
 * @throws Error if ciphertext is too short, key is wrong, or data is tampered
 */
export async function decrypt(
  ciphertextBase64: string,
  keyBase64Url: string,
): Promise<string> {
  // 1. Decode from base64
  const combined = base64ToUint8Array(ciphertextBase64);

  // 2. Validate minimum length: IV (12) + auth tag (16) = 28 bytes minimum
  if (combined.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short');
  }

  // 3. Extract IV (first 12 bytes)
  const iv = combined.slice(0, IV_LENGTH);

  // 4. Extract ciphertext + auth tag (remaining bytes)
  const ciphertextWithTag = combined.slice(IV_LENGTH);

  // 5. Import the key from base64url
  const key = await importKeyFromBase64Url(keyBase64Url);

  // 6. Decrypt with AES-GCM (catches wrong key / tampered data)
  let paddedBuffer: ArrayBuffer;
  try {
    paddedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertextWithTag,
    );
  } catch {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }

  // 7. Remove PADME padding to recover original plaintext bytes
  const paddedBytes = new Uint8Array(paddedBuffer);
  const plaintextBytes = unpadPlaintext(paddedBytes);

  // 8. Decode UTF-8 bytes back to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}
