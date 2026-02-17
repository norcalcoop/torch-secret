import { describe, it, expect } from 'vitest';
import {
  uint8ArrayToBase64Url,
  base64UrlToUint8Array,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '../encoding';

describe('uint8ArrayToBase64Url', () => {
  it('should encode "Hello" bytes to URL-safe base64 with no +, /, or = characters', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const result = uint8ArrayToBase64Url(input);
    expect(result).not.toMatch(/[+/=]/);
    // "Hello" in standard base64 is "SGVsbG8=" - in base64url it should be "SGVsbG8"
    expect(result).toBe('SGVsbG8');
  });

  it('should encode an empty array to an empty string', () => {
    const input = new Uint8Array([]);
    const result = uint8ArrayToBase64Url(input);
    expect(result).toBe('');
  });

  it('should encode a 32-byte array (simulating a key) with no +, /, or = characters', () => {
    // A 32-byte array with values that would produce +, /, and = in standard base64
    const input = new Uint8Array([
      62, 63, 255, 254, 253, 252, 251, 250, 128, 129, 130, 131, 132, 133, 134, 135, 200, 201, 202,
      203, 204, 205, 206, 207, 0, 1, 2, 3, 4, 5, 6, 7,
    ]);
    const result = uint8ArrayToBase64Url(input);
    expect(result).not.toMatch(/[+/=]/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle binary data with bytes >127 (non-ASCII)', () => {
    const input = new Uint8Array([128, 200, 255, 0, 127]);
    const result = uint8ArrayToBase64Url(input);
    expect(result).not.toMatch(/[+/=]/);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('base64UrlToUint8Array', () => {
  it('should round-trip: encode then decode produces identical Uint8Array', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = uint8ArrayToBase64Url(original);
    const decoded = base64UrlToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });

  it('should decode a known base64url string to expected byte array', () => {
    // "SGVsbG8" is base64url for "Hello" = [72, 101, 108, 108, 111]
    const result = base64UrlToUint8Array('SGVsbG8');
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });
});

describe('uint8ArrayToBase64', () => {
  it('should encode "Hello" bytes to standard base64', () => {
    const input = new Uint8Array([72, 101, 108, 108, 111]);
    const result = uint8ArrayToBase64(input);
    expect(result).toBe('SGVsbG8=');
  });

  it('should encode an empty array to an empty string', () => {
    const input = new Uint8Array([]);
    const result = uint8ArrayToBase64(input);
    expect(result).toBe('');
  });
});

describe('base64ToUint8Array', () => {
  it('should round-trip: encode then decode produces identical Uint8Array', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]);
    const encoded = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });

  it('should decode a known base64 string to expected byte array', () => {
    const result = base64ToUint8Array('SGVsbG8=');
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });
});

describe('round-trip property tests', () => {
  it('should round-trip a 256-bit (32-byte) random array via base64url', () => {
    const original = new Uint8Array(32);
    crypto.getRandomValues(original);
    const encoded = uint8ArrayToBase64Url(original);
    const decoded = base64UrlToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });

  it('should round-trip a large array (1000 bytes) via base64url', () => {
    const original = new Uint8Array(1000);
    crypto.getRandomValues(original);
    const encoded = uint8ArrayToBase64Url(original);
    const decoded = base64UrlToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });

  it('should never produce +, /, or = characters in base64url output', () => {
    // Test with many random arrays to increase confidence
    for (let i = 0; i < 50; i++) {
      const size = Math.floor(Math.random() * 100) + 1;
      const bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      const encoded = uint8ArrayToBase64Url(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
    }
  });

  it('should round-trip a large array (1000 bytes) via standard base64', () => {
    const original = new Uint8Array(1000);
    crypto.getRandomValues(original);
    const encoded = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });
});
