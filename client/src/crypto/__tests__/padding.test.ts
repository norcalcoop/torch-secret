/**
 * Tests for PADME plaintext padding module.
 *
 * Covers: padmeLength tier calculations, padPlaintext format,
 * unpadPlaintext round-trip, edge cases, and property tests.
 */

import { describe, it, expect } from 'vitest';
import { padmeLength, padPlaintext, unpadPlaintext } from '../padding';

describe('padmeLength', () => {
  it('should return 256 for 1-byte input (minimum tier)', () => {
    expect(padmeLength(1)).toBe(256);
  });

  it('should return 256 for 100-byte input (minimum tier)', () => {
    expect(padmeLength(100)).toBe(256);
  });

  it('should return 256 for exact minimum boundary (256 bytes)', () => {
    expect(padmeLength(256)).toBe(256);
  });

  it('should round up 257 using PADME formula', () => {
    const result = padmeLength(257);
    expect(result).toBeGreaterThanOrEqual(257);
    // PADME for 257: e=8, s=4, lastBits=4, bitMask=15 -> (257+15)&~15 = 272
    expect(result).toBe(272);
  });

  it('should return 512 for 500-byte input', () => {
    expect(padmeLength(500)).toBe(512);
  });

  it('should return 1024 for 1000-byte input', () => {
    expect(padmeLength(1000)).toBe(1024);
  });

  it('should return 5120 for 5000-byte input', () => {
    expect(padmeLength(5000)).toBe(5120);
  });

  it('should return 10240 for 10000-byte input', () => {
    expect(padmeLength(10000)).toBe(10240);
  });

  it('should return 40960 for 40000-byte input', () => {
    expect(padmeLength(40000)).toBe(40960);
  });

  it('should never return a value smaller than the input', () => {
    const testSizes = [1, 10, 100, 256, 257, 500, 1000, 5000, 10000, 40000];
    for (const size of testSizes) {
      expect(padmeLength(size)).toBeGreaterThanOrEqual(size);
    }
  });

  it('should have at most 12% overhead for inputs above minimum tier', () => {
    const testSizes = [257, 500, 1000, 5000, 10000, 40000];
    for (const size of testSizes) {
      const padded = padmeLength(size);
      const overhead = (padded - size) / size;
      expect(overhead).toBeLessThanOrEqual(0.12);
    }
  });

  it('should return 256 for 0-byte input (edge case)', () => {
    expect(padmeLength(0)).toBe(256);
  });
});

describe('padPlaintext', () => {
  it('should pad 1-byte input to exactly 256 bytes', () => {
    const data = new Uint8Array([42]);
    const padded = padPlaintext(data);
    expect(padded.length).toBe(256);
  });

  it('should pad 100-byte input to exactly 256 bytes (same tier as 1-byte)', () => {
    const data = new Uint8Array(100).fill(0xab);
    const padded = padPlaintext(data);
    expect(padded.length).toBe(256);
  });

  it('should encode original data length as big-endian uint32 in first 4 bytes', () => {
    const data = new Uint8Array(100).fill(0xcd);
    const padded = padPlaintext(data);
    const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
    expect(view.getUint32(0, false)).toBe(100);
  });

  it('should contain original data starting at offset 4', () => {
    const data = new Uint8Array([10, 20, 30, 40, 50]);
    const padded = padPlaintext(data);
    const embedded = padded.slice(4, 4 + data.length);
    expect(embedded).toEqual(data);
  });

  it('should zero-fill remaining bytes after data', () => {
    const data = new Uint8Array([1, 2, 3]);
    const padded = padPlaintext(data);
    const remaining = padded.slice(4 + data.length);
    for (let i = 0; i < remaining.length; i++) {
      expect(remaining[i]).toBe(0);
    }
  });

  it('should throw when input exceeds maximum size', () => {
    const oversized = new Uint8Array(100_001);
    expect(() => padPlaintext(oversized)).toThrow('exceeds maximum size');
  });
});

describe('unpadPlaintext', () => {
  it('should round-trip 1-byte input exactly', () => {
    const original = new Uint8Array([42]);
    const result = unpadPlaintext(padPlaintext(original));
    expect(result).toEqual(original);
  });

  it('should round-trip 50-byte input exactly', () => {
    const original = new Uint8Array(50);
    for (let i = 0; i < 50; i++) original[i] = i % 256;
    const result = unpadPlaintext(padPlaintext(original));
    expect(result).toEqual(original);
  });

  it('should round-trip 252-byte input exactly (max that fits in 256-byte min tier)', () => {
    const original = new Uint8Array(252);
    for (let i = 0; i < 252; i++) original[i] = i % 256;
    const result = unpadPlaintext(padPlaintext(original));
    expect(result).toEqual(original);
  });

  it('should round-trip 500-byte input exactly', () => {
    const original = new Uint8Array(500);
    for (let i = 0; i < 500; i++) original[i] = i % 256;
    const result = unpadPlaintext(padPlaintext(original));
    expect(result).toEqual(original);
  });

  it('should round-trip 10000-byte input exactly', () => {
    const original = new Uint8Array(10000);
    for (let i = 0; i < 10000; i++) original[i] = i % 256;
    const result = unpadPlaintext(padPlaintext(original));
    expect(result).toEqual(original);
  });

  it('should throw on invalid padding where length exceeds buffer size', () => {
    // Create a buffer with an impossibly large length prefix
    const badPadded = new Uint8Array(256);
    const view = new DataView(badPadded.buffer);
    view.setUint32(0, 999, false); // claims 999 bytes but buffer only has 252 after prefix
    expect(() => unpadPlaintext(badPadded)).toThrow('Invalid padding');
  });

  it('should throw on buffer too small for length prefix', () => {
    const tinyBuffer = new Uint8Array(3); // less than 4 bytes needed for uint32
    expect(() => unpadPlaintext(tinyBuffer)).toThrow('buffer too small');
  });
});

describe('property tests', () => {
  it('should produce identically-sized output for different inputs in the same PADME tier', () => {
    const small = new Uint8Array(10).fill(0x11);
    const medium = new Uint8Array(200).fill(0x22);
    // Both 10+4=14 and 200+4=204 are <= 256, so both should pad to 256
    const paddedSmall = padPlaintext(small);
    const paddedMedium = padPlaintext(medium);
    expect(paddedSmall.length).toBe(paddedMedium.length);
  });

  it('should produce deterministic output (no random padding)', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const padded1 = padPlaintext(data);
    const padded2 = padPlaintext(data);
    expect(padded1).toEqual(padded2);
  });
});
