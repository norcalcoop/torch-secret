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
import { generatePassphrase, EFF_WORDS } from '../passphrase';

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

  it('words are lowercase with no internal spaces (match /^[a-z][a-z-]*$/)', () => {
    for (let i = 0; i < 10; i++) {
      const passphrase = generatePassphrase();
      const words = passphrase.split(' ');
      for (const word of words) {
        expect(word).toMatch(/^[a-z][a-z-]*$/);
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

// ---------------------------------------------------------------------------
// Custom wordList param tests (RED — Plan 02 will add the optional wordList param)
//
// Note: These tests do NOT import from word-lists.ts (file doesn't exist yet).
// Instead they use inline word arrays that mimic the TECH_WORDS / NATURE_WORDS /
// SHORT_WORDS exports that Plan 02 will create. The tests are RED because:
//   1. generatePassphrase() currently ignores a second argument (no wordList param)
//   2. SHORT_WORDS words are all 3–5 chars, but EFF_WORDS contains longer words
// ---------------------------------------------------------------------------

describe('generatePassphrase — custom wordList param (Plan 02)', () => {
  // Inline arrays that mirror what word-lists.ts will export.
  // Plan 02 will create the real TECH_WORDS, NATURE_WORDS, SHORT_WORDS exports.
  const TECH_WORDS = [
    'kernel',
    'daemon',
    'socket',
    'buffer',
    'mutex',
    'thread',
    'proxy',
    'token',
    'cipher',
    'nonce',
  ];
  const NATURE_WORDS = [
    'river',
    'stone',
    'cloud',
    'forest',
    'ocean',
    'petal',
    'coral',
    'fern',
    'maple',
    'cedar',
  ];
  // SHORT_WORDS: all 3–5 chars (no EFF word passes the constraint at that length range alone)
  const SHORT_WORDS = ['fog', 'dew', 'mist', 'reed', 'bay', 'cove', 'glen', 'dell', 'fern', 'vale'];

  it('all words come from TECH_WORDS when passed as second argument', () => {
    const techSet = new Set(TECH_WORDS);
    // Plan 02 extends generatePassphrase signature to: generatePassphrase(wordCount?, wordList?)
    // Until then, it ignores the second arg and returns EFF_WORDS — test will FAIL (RED).
    const passphrase = generatePassphrase(4, TECH_WORDS as unknown as never);
    const words = passphrase.split(' ');
    expect(words).toHaveLength(4);
    for (const word of words) {
      expect(techSet.has(word), `"${word}" not found in TECH_WORDS`).toBe(true);
    }
  });

  it('all words come from NATURE_WORDS when passed as second argument', () => {
    const natureSet = new Set(NATURE_WORDS);
    const passphrase = generatePassphrase(4, NATURE_WORDS as unknown as never);
    const words = passphrase.split(' ');
    for (const word of words) {
      expect(natureSet.has(word), `"${word}" not found in NATURE_WORDS`).toBe(true);
    }
  });

  it('all words from SHORT_WORDS are 3–5 characters long', () => {
    const passphrase = generatePassphrase(4, SHORT_WORDS as unknown as never);
    const words = passphrase.split(' ');
    for (const word of words) {
      expect(word.length, `"${word}" is not 3–5 chars`).toBeGreaterThanOrEqual(3);
      expect(word.length, `"${word}" is not 3–5 chars`).toBeLessThanOrEqual(5);
    }
  });

  it('generatePassphrase() with no second arg still returns words from EFF_WORDS (backward compat)', () => {
    const effSet = new Set(EFF_WORDS);
    const passphrase = generatePassphrase();
    const words = passphrase.split(' ');
    for (const word of words) {
      expect(effSet.has(word), `"${word}" not found in EFF_WORDS`).toBe(true);
    }
  });

  it('does not always return the word at index 0 of a small list (no index-0 bias)', () => {
    // A list of 8 short words — smaller than 7776 EFF_WORDS; tests rejection sampling fairness
    const smallList = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const passphrase = generatePassphrase(1, smallList as unknown as never);
      results.add(passphrase);
    }
    // With 8 words and 50 samples, expect to see more than 1 distinct word
    expect(results.size).toBeGreaterThan(1);
    // And the first word should not be selected 100% of the time
    expect(results.has('alpha') && results.size === 1).toBe(false);
  });
});
