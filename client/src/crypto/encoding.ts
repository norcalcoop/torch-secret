/**
 * Base64 and Base64URL encoding/decoding utilities for SecureShare.
 *
 * Uses manual btoa/atob conversion (not Buffer or Uint8Array.toBase64())
 * to ensure browser compatibility. Converts via binary string intermediary
 * using a loop (not spread operator) to avoid stack overflow on large arrays.
 *
 * Base64URL (RFC 4648 Section 5): Uses `-` and `_` instead of `+` and `/`,
 * no `=` padding. Used for encryption keys in URL fragments.
 *
 * Standard Base64: Used for ciphertext transport to/from the server.
 */

/**
 * Convert a Uint8Array to a binary string.
 * Uses a loop (not spread) to avoid stack overflow on large arrays.
 */
function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

/**
 * Convert a binary string to a Uint8Array.
 */
function binaryStringToUint8Array(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode a Uint8Array to a base64url string (RFC 4648 Section 5).
 * URL-safe: uses `-` instead of `+`, `_` instead of `/`, no `=` padding.
 */
export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  const binary = uint8ArrayToBinaryString(bytes);
  if (binary.length === 0) return '';
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string to a Uint8Array.
 * Reverses the URL-safe character replacements and restores padding.
 */
export function base64UrlToUint8Array(base64url: string): Uint8Array {
  if (base64url.length === 0) return new Uint8Array(0);
  // Restore standard base64 characters
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Restore padding
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  return binaryStringToUint8Array(binary);
}

/**
 * Encode a Uint8Array to a standard base64 string.
 * Includes `=` padding. Used for ciphertext transport.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binary = uint8ArrayToBinaryString(bytes);
  if (binary.length === 0) return '';
  return btoa(binary);
}

/**
 * Decode a standard base64 string to a Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (base64.length === 0) return new Uint8Array(0);
  const binary = atob(base64);
  return binaryStringToUint8Array(binary);
}
