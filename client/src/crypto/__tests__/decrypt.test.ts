/**
 * Tests for the decrypt module.
 *
 * Covers: round-trip encryption/decryption, wrong key rejection,
 * tampered ciphertext/IV detection, truncated input handling.
 */

import { describe, it, expect } from 'vitest';
import { encrypt } from '../encrypt';
import { decrypt } from '../decrypt';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../encoding';
import { generateKey } from '../keys';

describe('round-trip encryption/decryption', () => {
  it('decrypts a typical secret back to original plaintext', async () => {
    const original = 'my-secret-api-key-12345';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts a short string', async () => {
    const original = 'hi';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts a medium string (500 chars)', async () => {
    const original = 'a'.repeat(500);
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts a max-length string (10000 chars)', async () => {
    const original = 'x'.repeat(10000);
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts an empty string', async () => {
    const original = '';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts unicode/emoji string', async () => {
    const original = 'Hello \u{1F30D} from the future \u{1F680}';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts special characters: newlines, tabs, quotes, HTML', async () => {
    const original = 'line1\nline2\ttab "quotes" \'single\' <html>&amp;';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });

  it('decrypts multi-byte UTF-8: combining accent (cafe\\u0301)', async () => {
    const original = 'cafe\u0301';
    const result = await encrypt(original);
    const decrypted = await decrypt(result.payload.ciphertext, result.keyBase64Url);
    expect(decrypted).toBe(original);
  });
});

describe('wrong key rejection', () => {
  it('throws when decrypting with a different key', async () => {
    const result = await encrypt('secret data');
    const { keyBase64Url: wrongKey } = await generateKey();
    await expect(
      decrypt(result.payload.ciphertext, wrongKey),
    ).rejects.toThrow('Decryption failed');
  });

  it('error does not expose internal details', async () => {
    const result = await encrypt('secret data');
    const { keyBase64Url: wrongKey } = await generateKey();
    try {
      await decrypt(result.payload.ciphertext, wrongKey);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toBe('Decryption failed: invalid key or corrupted data');
      // Should NOT contain internal crypto error details
      expect(message).not.toMatch(/OperationError/i);
    }
  });
});

describe('tampered ciphertext', () => {
  it('throws when a bit is flipped in the ciphertext portion', async () => {
    const result = await encrypt('tamper test');
    const decoded = base64ToUint8Array(result.payload.ciphertext);

    // Flip a bit in the ciphertext portion (after the 12-byte IV)
    const tampered = new Uint8Array(decoded);
    const targetIndex = 20; // well past the IV, in the ciphertext
    tampered[targetIndex] = tampered[targetIndex] ^ 0x01;

    const tamperedBase64 = uint8ArrayToBase64(tampered);
    await expect(
      decrypt(tamperedBase64, result.keyBase64Url),
    ).rejects.toThrow('Decryption failed');
  });
});

describe('tampered IV', () => {
  it('throws when a bit is flipped in the IV portion', async () => {
    const result = await encrypt('iv tamper test');
    const decoded = base64ToUint8Array(result.payload.ciphertext);

    // Flip a bit in the IV portion (first 12 bytes)
    const tampered = new Uint8Array(decoded);
    tampered[5] = tampered[5] ^ 0x01;

    const tamperedBase64 = uint8ArrayToBase64(tampered);
    await expect(
      decrypt(tamperedBase64, result.keyBase64Url),
    ).rejects.toThrow('Decryption failed');
  });
});

describe('truncated ciphertext', () => {
  it('throws when ciphertext is too short for IV + auth tag', async () => {
    // 27 bytes is less than IV_LENGTH (12) + TAG_LENGTH (16) = 28
    const shortData = new Uint8Array(27);
    crypto.getRandomValues(shortData);
    const shortBase64 = uint8ArrayToBase64(shortData);

    const { keyBase64Url } = await generateKey();
    await expect(decrypt(shortBase64, keyBase64Url)).rejects.toThrow(
      'Invalid ciphertext: too short',
    );
  });
});
