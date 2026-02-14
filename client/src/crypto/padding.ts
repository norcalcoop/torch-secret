/**
 * PADME plaintext padding for ciphertext length-leakage prevention.
 *
 * AES-GCM is a stream cipher -- ciphertext length equals plaintext length.
 * Without padding, an attacker can infer approximate secret length from
 * ciphertext size. PADME ensures secrets within the same tier produce
 * identical-size ciphertext, with at most 12% overhead.
 *
 * Padding format: [4-byte uint32 BE original length] + [original data] + [zero fill]
 *
 * Reference: PADME algorithm from PURBs paper (PETS 2019)
 * https://lbarman.ch/blog/padme/
 */

import { MIN_PADDED_SIZE } from './constants';

/**
 * Maximum allowed input data size in bytes.
 * 10,000 UTF-8 characters can be up to ~40,000 bytes.
 * Adding generous headroom to 100,000 bytes.
 */
const MAX_INPUT_SIZE = 100_000;

/**
 * Compute the PADME padded length for a given input length.
 *
 * For inputs <= MIN_PADDED_SIZE (256), returns MIN_PADDED_SIZE.
 * For larger inputs, rounds up to the nearest PADME tier boundary,
 * guaranteeing at most 12% overhead.
 *
 * @param len - The input length in bytes
 * @returns The padded length in bytes
 */
export function padmeLength(len: number): number {
  if (len <= MIN_PADDED_SIZE) return MIN_PADDED_SIZE;

  const e = Math.floor(Math.log2(len));
  const s = Math.floor(Math.log2(e)) + 1;
  const lastBits = e - s;
  const bitMask = (1 << lastBits) - 1;
  return (len + bitMask) & ~bitMask;
}

/**
 * Pad plaintext bytes using PADME algorithm.
 *
 * Format: [4-byte uint32 BE original length] + [original data] + [zero fill to padmeLength]
 *
 * @param data - The original plaintext bytes
 * @returns Padded byte array with length prefix
 * @throws Error if data exceeds MAX_INPUT_SIZE
 */
export function padPlaintext(data: Uint8Array): Uint8Array {
  if (data.length > MAX_INPUT_SIZE) {
    throw new Error(
      `Input data exceeds maximum size: ${data.length} > ${MAX_INPUT_SIZE} bytes`
    );
  }

  const totalDataLen = 4 + data.length; // 4 bytes for length prefix
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
 * Remove PADME padding and extract original plaintext bytes.
 *
 * Reads the 4-byte big-endian uint32 length prefix, validates it,
 * and returns the original data slice.
 *
 * @param padded - The padded byte array
 * @returns The original plaintext bytes
 * @throws Error if the length prefix exceeds the available buffer
 */
export function unpadPlaintext(padded: Uint8Array): Uint8Array {
  if (padded.length < 4) {
    throw new Error('Invalid padding: buffer too small for length prefix');
  }

  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const originalLen = view.getUint32(0, false); // false = big-endian

  if (originalLen > padded.length - 4) {
    throw new Error('Invalid padding: length exceeds padded data');
  }

  return padded.slice(4, 4 + originalLen);
}
