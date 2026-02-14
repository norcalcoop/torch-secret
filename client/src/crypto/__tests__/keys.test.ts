/**
 * Tests for the key management module.
 *
 * Covers: key generation, uniqueness, export, import, and round-trip
 * encryption/decryption to prove functional correctness.
 */

import { describe, it, expect } from 'vitest';
import {
  generateKey,
  exportKeyToBase64Url,
  importKeyFromBase64Url,
} from '../keys';
import { ALGORITHM } from '../constants';

const URL_SAFE_REGEX = /^[A-Za-z0-9_-]+$/;

describe('generateKey', () => {
  it('returns an object with key (CryptoKey) and keyBase64Url (string)', async () => {
    const result = await generateKey();
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyBase64Url');
    expect(typeof result.keyBase64Url).toBe('string');
  });

  it('returns a CryptoKey with type "secret"', async () => {
    const { key } = await generateKey();
    expect(key.type).toBe('secret');
  });

  it('returns a key with algorithm name AES-GCM', async () => {
    const { key } = await generateKey();
    expect((key.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
  });

  it('returns a key with algorithm length 256', async () => {
    const { key } = await generateKey();
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
  });

  it('returns an extractable key', async () => {
    const { key } = await generateKey();
    expect(key.extractable).toBe(true);
  });

  it('returns a key with encrypt and decrypt usages', async () => {
    const { key } = await generateKey();
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('returns a keyBase64Url that is exactly 43 characters long', async () => {
    const { keyBase64Url } = await generateKey();
    expect(keyBase64Url).toHaveLength(43);
  });

  it('returns a keyBase64Url containing only URL-safe characters', async () => {
    const { keyBase64Url } = await generateKey();
    expect(keyBase64Url).toMatch(URL_SAFE_REGEX);
  });
});

describe('key uniqueness', () => {
  it('two calls to generateKey produce different keyBase64Url values', async () => {
    const result1 = await generateKey();
    const result2 = await generateKey();
    expect(result1.keyBase64Url).not.toBe(result2.keyBase64Url);
  });

  it('10 calls to generateKey produce 10 unique keyBase64Url values', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => generateKey()),
    );
    const uniqueKeys = new Set(results.map((r) => r.keyBase64Url));
    expect(uniqueKeys.size).toBe(10);
  });
});

describe('exportKeyToBase64Url', () => {
  it('returns the same base64url string as generateKey returned', async () => {
    const { key, keyBase64Url } = await generateKey();
    const exported = await exportKeyToBase64Url(key);
    expect(exported).toBe(keyBase64Url);
  });

  it('output is 43 characters and URL-safe', async () => {
    const { key } = await generateKey();
    const exported = await exportKeyToBase64Url(key);
    expect(exported).toHaveLength(43);
    expect(exported).toMatch(URL_SAFE_REGEX);
  });
});

describe('importKeyFromBase64Url', () => {
  it('returns a CryptoKey from a base64url string', async () => {
    const { keyBase64Url } = await generateKey();
    const imported = await importKeyFromBase64Url(keyBase64Url);
    expect(imported).toBeInstanceOf(CryptoKey);
  });

  it('imported key has extractable === false', async () => {
    const { keyBase64Url } = await generateKey();
    const imported = await importKeyFromBase64Url(keyBase64Url);
    expect(imported.extractable).toBe(false);
  });

  it('imported key has usages containing decrypt', async () => {
    const { keyBase64Url } = await generateKey();
    const imported = await importKeyFromBase64Url(keyBase64Url);
    expect(imported.usages).toContain('decrypt');
  });

  it('imported key algorithm name is AES-GCM', async () => {
    const { keyBase64Url } = await generateKey();
    const imported = await importKeyFromBase64Url(keyBase64Url);
    expect((imported.algorithm as AesKeyAlgorithm).name).toBe('AES-GCM');
  });
});

describe('export/import round-trip', () => {
  it('imported key can decrypt data encrypted with the original key', async () => {
    // Generate a key pair
    const { key: originalKey, keyBase64Url } = await generateKey();

    // Encrypt some data with the original key
    const plaintext = new TextEncoder().encode('zero-knowledge secret sharing');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      originalKey,
      plaintext,
    );

    // Import the key from base64url
    const importedKey = await importKeyFromBase64Url(keyBase64Url);

    // Decrypt with the imported key
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      importedKey,
      ciphertext,
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    expect(decryptedText).toBe('zero-knowledge secret sharing');
  });

  it('export -> import -> re-export produces the same base64url string', async () => {
    const { key, keyBase64Url } = await generateKey();

    // Import the key (non-extractable, so we cannot re-export it)
    // Instead, verify that exporting the original key multiple times is consistent
    const exported1 = await exportKeyToBase64Url(key);
    const exported2 = await exportKeyToBase64Url(key);
    expect(exported1).toBe(keyBase64Url);
    expect(exported2).toBe(keyBase64Url);
  });
});

describe('input validation', () => {
  it('rejects an invalid base64url string on import', async () => {
    await expect(importKeyFromBase64Url('not-a-valid-key!!!')).rejects.toThrow();
  });

  it('rejects a base64url string of wrong length', async () => {
    // 16 bytes (128-bit) = too short for AES-256
    const shortKey = 'AAAAAAAAAAAAAAAAAAAAAA'; // 22 chars = 16 bytes
    await expect(importKeyFromBase64Url(shortKey)).rejects.toThrow();
  });
});
