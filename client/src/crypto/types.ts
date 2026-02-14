/**
 * Crypto module type definitions for SecureShare.
 *
 * These types define the shapes of encrypted data and encryption results.
 * All other crypto module files import from here.
 */

/**
 * The encrypted payload sent to/received from the server.
 * Contains a single base64-encoded string: IV (12 bytes) + ciphertext + auth tag (16 bytes).
 */
export interface EncryptedPayload {
  /** Base64-encoded blob: [IV 12 bytes][ciphertext][auth tag 16 bytes] */
  ciphertext: string;
}

/**
 * The result of an encryption operation.
 * Contains the encrypted payload, the CryptoKey object, and the base64url-encoded
 * raw key for embedding in URL fragments.
 */
export interface EncryptResult {
  /** The encrypted payload to send to the server */
  payload: EncryptedPayload;
  /** The CryptoKey object (extractable) used for encryption */
  key: CryptoKey;
  /** Base64url-encoded raw key bytes for the URL fragment (#key) */
  keyBase64Url: string;
}
