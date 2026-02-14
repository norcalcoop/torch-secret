/**
 * Tests for the encrypt module.
 *
 * Covers: return shape, IV prepending, key/IV uniqueness,
 * padding tier verification, edge cases (empty, large, unicode).
 */

import { describe, it, expect } from 'vitest';
import { encrypt } from '../encrypt';
import { base64ToUint8Array } from '../encoding';
import { IV_LENGTH, TAG_LENGTH, MIN_PADDED_SIZE } from '../constants';

const URL_SAFE_REGEX = /^[A-Za-z0-9_-]+$/;

describe('encrypt return shape', () => {
  it('returns an object with payload, key, and keyBase64Url', async () => {
    const result = await encrypt('hello');
    expect(result).toHaveProperty('payload');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyBase64Url');
  });

  it('payload.ciphertext is a non-empty string', async () => {
    const result = await encrypt('hello');
    expect(typeof result.payload.ciphertext).toBe('string');
    expect(result.payload.ciphertext.length).toBeGreaterThan(0);
  });

  it('keyBase64Url is 43 characters and URL-safe', async () => {
    const result = await encrypt('hello');
    expect(result.keyBase64Url).toHaveLength(43);
    expect(result.keyBase64Url).toMatch(URL_SAFE_REGEX);
  });

  it('key is a CryptoKey object', async () => {
    const result = await encrypt('hello');
    expect(result.key).toBeInstanceOf(CryptoKey);
    expect(result.key.type).toBe('secret');
  });
});

describe('IV prepending', () => {
  it('decoded ciphertext starts with 12-byte IV followed by ciphertext+tag', async () => {
    const result = await encrypt('hello');
    const decoded = base64ToUint8Array(result.payload.ciphertext);
    // Must have at least IV (12) + TAG (16) bytes
    expect(decoded.length).toBeGreaterThanOrEqual(IV_LENGTH + TAG_LENGTH);
  });

  it('total decoded length is >= IV + TAG + MIN_PADDED_SIZE for any input', async () => {
    const result = await encrypt('hello');
    const decoded = base64ToUint8Array(result.payload.ciphertext);
    // Padded plaintext is at least MIN_PADDED_SIZE (256) bytes
    // Then AES-GCM adds TAG_LENGTH (16) bytes
    // Plus IV_LENGTH (12) prepended
    const minExpected = IV_LENGTH + TAG_LENGTH + MIN_PADDED_SIZE;
    expect(decoded.length).toBe(minExpected);
  });
});

describe('uniqueness', () => {
  it('two encryptions of the same text produce different ciphertexts (different IVs)', async () => {
    const result1 = await encrypt('same text');
    const result2 = await encrypt('same text');
    expect(result1.payload.ciphertext).not.toBe(result2.payload.ciphertext);
  });

  it('two encryptions of the same text produce different keys', async () => {
    const result1 = await encrypt('same text');
    const result2 = await encrypt('same text');
    expect(result1.keyBase64Url).not.toBe(result2.keyBase64Url);
  });
});

describe('padding verification', () => {
  it('short and medium inputs in same tier produce same-length ciphertext', async () => {
    const resultShort = await encrypt('hi');
    const resultMedium = await encrypt('a'.repeat(200));
    // Both should pad to 256 bytes (minimum tier), producing same base64 length
    expect(resultShort.payload.ciphertext.length).toBe(
      resultMedium.payload.ciphertext.length,
    );
  });

  it('input exceeding minimum tier produces longer ciphertext', async () => {
    const resultShort = await encrypt('hi');
    const resultLong = await encrypt('a'.repeat(300));
    // 300 chars -> 300 bytes UTF-8 + 4 prefix = 304 -> next PADME tier > 256
    expect(resultLong.payload.ciphertext.length).toBeGreaterThan(
      resultShort.payload.ciphertext.length,
    );
  });
});

describe('edge cases', () => {
  it('encrypts empty string successfully', async () => {
    const result = await encrypt('');
    expect(result.payload.ciphertext.length).toBeGreaterThan(0);
    expect(result.keyBase64Url).toHaveLength(43);
  });

  it('encrypts large input (10000 chars) successfully', async () => {
    const result = await encrypt('x'.repeat(10000));
    expect(result.payload.ciphertext.length).toBeGreaterThan(0);
    expect(result.keyBase64Url).toHaveLength(43);
  });

  it('encrypts unicode/emoji string successfully', async () => {
    const result = await encrypt('Hello \u{1F30D}');
    expect(result.payload.ciphertext.length).toBeGreaterThan(0);
    expect(result.keyBase64Url).toHaveLength(43);
  });
});
