/**
 * Tests for the passphrase module.
 *
 * Covers: word count, EFF wordlist membership, format validation,
 * uniqueness across calls, and crypto.getRandomValues usage.
 *
 * Note: Tests import directly from '../passphrase.js' (not the barrel) —
 * consistent with the existing pattern in encrypt.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generatePassphrase, EFF_WORDS } from '../passphrase.js';

describe('generatePassphrase — word count', () => {
  it('generates a passphrase with 4 words by default', () => {
    const passphrase = generatePassphrase();
    const words = passphrase.split(' ');
    expect(words).toHaveLength(4);
  });

  it('generates a passphrase with a custom word count', () => {
    const passphrase = generatePassphrase(6);
    const words = passphrase.split(' ');
    expect(words).toHaveLength(6);
  });

  it('generates a single word when wordCount is 1', () => {
    const passphrase = generatePassphrase(1);
    const words = passphrase.split(' ');
    expect(words).toHaveLength(1);
  });
});

describe('generatePassphrase — EFF wordlist membership', () => {
  it('all words are from the EFF wordlist', () => {
    const effSet = new Set(EFF_WORDS);
    for (let i = 0; i < 10; i++) {
      const passphrase = generatePassphrase();
      const words = passphrase.split(' ');
      for (const word of words) {
        expect(effSet.has(word), `"${word}" not found in EFF wordlist`).toBe(true);
      }
    }
  });

  it('words are lowercase with no internal spaces (match /^[a-z]+$/)', () => {
    for (let i = 0; i < 10; i++) {
      const passphrase = generatePassphrase();
      const words = passphrase.split(' ');
      for (const word of words) {
        expect(word).toMatch(/^[a-z]+$/);
      }
    }
  });
});

describe('generatePassphrase — uniqueness', () => {
  it('multiple calls produce different results (10 calls produce >= 2 distinct values)', () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(generatePassphrase());
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('generatePassphrase — uses crypto.getRandomValues', () => {
  let getRandomValuesSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues');
  });

  afterEach(() => {
    getRandomValuesSpy.mockRestore();
  });

  it('calls crypto.getRandomValues at least 4 times when generating 4 words', () => {
    generatePassphrase();
    // Called at least once per word (4 words minimum = 4 calls).
    // Rejection sampling may cause additional calls (extremely rare: ~0.0000006 per word).
    expect(getRandomValuesSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('EFF_WORDS constant', () => {
  it('contains exactly 7776 words', () => {
    expect(EFF_WORDS).toHaveLength(7776);
  });

  it('first word is "abacus" (dice roll 11111)', () => {
    expect(EFF_WORDS[0]).toBe('abacus');
  });

  it('last word is "zoom" (dice roll 66666)', () => {
    expect(EFF_WORDS[7775]).toBe('zoom');
  });
});
