/**
 * Encrypt module for SecureShare.
 *
 * Encrypts plaintext using AES-256-GCM with a fresh key and IV per call.
 * Integrates: keys (generateKey), padding (padPlaintext), encoding (uint8ArrayToBase64).
 *
 * Security invariants:
 * - Every call generates a unique 256-bit key via crypto.subtle.generateKey
 * - Every call generates a unique 96-bit IV via crypto.getRandomValues
 * - Plaintext is PADME-padded before encryption to prevent length leakage
 * - No Math.random, no third-party crypto libraries
 */

import { generateKey } from './keys';
import { padPlaintext } from './padding';
import { uint8ArrayToBase64 } from './encoding';
import { ALGORITHM, IV_LENGTH } from './constants';
import type { EncryptResult } from './types';

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * The plaintext is UTF-8 encoded, PADME-padded to prevent length leakage,
 * then encrypted with a fresh key and IV. The IV is prepended to the
 * ciphertext for transport.
 *
 * @param plaintext - The secret text to encrypt
 * @returns EncryptResult with padded ciphertext (IV prepended), CryptoKey, and base64url key
 */
export async function encrypt(plaintext: string): Promise<EncryptResult> {
  // 1. UTF-8 encode the plaintext
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // 2. Apply PADME padding to prevent length leakage
  const paddedBytes = padPlaintext(plaintextBytes);

  // 3. Generate a fresh 256-bit AES-GCM key
  const { key, keyBase64Url } = await generateKey();

  // 4. Generate a fresh 96-bit IV (NIST-recommended for AES-GCM)
  const iv = crypto.getRandomValues(
    new Uint8Array(IV_LENGTH),
  ) as Uint8Array<ArrayBuffer>;

  // 5. Encrypt the padded plaintext with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    paddedBytes as Uint8Array<ArrayBuffer>,
  );

  // 6. Prepend IV to ciphertext for transport: [IV 12 bytes][ciphertext + auth tag]
  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  // 7. Base64 encode for transport
  const ciphertext = uint8ArrayToBase64(combined);

  return { payload: { ciphertext }, key, keyBase64Url };
}
