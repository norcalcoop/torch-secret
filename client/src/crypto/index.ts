/**
 * SecureShare Crypto Module - Public API
 *
 * This barrel export exposes only the public interface needed by the application.
 * Internal utilities (encoding, padding) are implementation details and not exported.
 *
 * Usage:
 *   import { encrypt, decrypt } from './crypto';
 *
 *   // Encrypt a secret
 *   const { payload, keyBase64Url } = await encrypt('my secret');
 *
 *   // Decrypt a secret
 *   const plaintext = await decrypt(payload.ciphertext, keyBase64Url);
 */

export { encrypt } from './encrypt';
export { decrypt } from './decrypt';
export { generateKey, exportKeyToBase64Url, importKeyFromBase64Url } from './keys';
export type { EncryptedPayload, EncryptResult } from './types';
export { generatePassphrase } from './passphrase.js';
