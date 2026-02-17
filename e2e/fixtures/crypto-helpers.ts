/**
 * Crypto helpers for E2E tests.
 *
 * Replicates the exact encryption pipeline from the browser crypto module:
 * UTF-8 encode -> PADME padding -> AES-256-GCM encrypt -> IV prepend -> base64 encode.
 *
 * CRITICAL: The browser's decrypt.ts calls unpadPlaintext() after decryption.
 * If PADME padding is not applied before encryption, the first 4 bytes will be
 * garbage (not a valid uint32 BE length prefix) and produce corrupted output.
 */

import { webcrypto } from 'node:crypto';

const crypto = webcrypto as unknown as Crypto;

/** Minimum padded size in bytes (matches client/src/crypto/constants.ts) */
const MIN_PADDED_SIZE = 256;

/**
 * Compute the PADME padded length for a given input length.
 * Replicates client/src/crypto/padding.ts padmeLength() exactly.
 */
function padmeLength(len: number): number {
  if (len <= MIN_PADDED_SIZE) return MIN_PADDED_SIZE;

  const e = Math.floor(Math.log2(len));
  const s = Math.floor(Math.log2(e)) + 1;
  const lastBits = e - s;
  const bitMask = (1 << lastBits) - 1;
  return (len + bitMask) & ~bitMask;
}

/**
 * Pad plaintext bytes using PADME algorithm.
 * Replicates client/src/crypto/padding.ts padPlaintext() exactly.
 *
 * Format: [4-byte uint32 BE original length][original data][zero fill to padmeLength]
 */
function padPlaintext(data: Uint8Array): Uint8Array {
  const totalDataLen = 4 + data.length;
  const paddedLen = padmeLength(totalDataLen);
  const padded = new Uint8Array(paddedLen); // zero-filled by default

  // Write original data length as big-endian uint32 in first 4 bytes
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  view.setUint32(0, data.length, false); // false = big-endian

  // Copy original data starting at offset 4
  padded.set(data, 4);

  return padded;
}

/**
 * Encrypt plaintext using the same pipeline as the browser crypto module.
 *
 * Returns the ciphertext (base64, IV prepended) and the key as base64url
 * for embedding in URL fragments.
 */
export async function encryptForTest(
  plaintext: string,
): Promise<{ ciphertext: string; keyBase64Url: string }> {
  // 1. UTF-8 encode the plaintext
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // 2. Apply PADME padding (MANDATORY for browser decrypt compatibility)
  const paddedBytes = padPlaintext(plaintextBytes);

  // 3. Generate a fresh 256-bit key
  const keyData = new Uint8Array(32);
  crypto.getRandomValues(keyData);

  // 4. Import as AES-GCM key
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, true, ['encrypt']);

  // 5. Generate a fresh 96-bit IV
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // 6. Encrypt the PADDED bytes with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    paddedBytes as Uint8Array<ArrayBuffer>,
  );

  // 7. Combine [IV 12 bytes][ciphertext + auth tag], base64 encode
  const combined = new Uint8Array(iv.byteLength + ciphertextBuffer.byteLength);
  combined.set(new Uint8Array(iv.buffer), 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.byteLength);
  const ciphertext = Buffer.from(combined.buffer).toString('base64');

  // 8. Export key to base64url
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64Url = Buffer.from(rawKey)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return { ciphertext, keyBase64Url };
}
