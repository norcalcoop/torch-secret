# Phase 1: Encryption Foundation - Research

**Researched:** 2026-02-13
**Domain:** Client-side AES-256-GCM encryption with Web Crypto API, ciphertext padding, URL-fragment key distribution
**Confidence:** HIGH

## Summary

Phase 1 builds the standalone crypto module that is the security foundation for the entire SecureShare application. The module lives at `client/src/crypto/` and uses exclusively the browser-native Web Crypto API (`crypto.subtle` and `crypto.getRandomValues`) -- zero third-party crypto dependencies. The core operations are: generate a 256-bit AES-GCM key, generate a 96-bit IV, encrypt plaintext to padded ciphertext, decrypt ciphertext back to plaintext, and encode/decode the key as a base64url string for embedding in URL fragments.

AES-GCM is a stream cipher mode -- it produces ciphertext exactly equal in length to the plaintext, plus a fixed 16-byte (128-bit) authentication tag automatically appended by `crypto.subtle.encrypt()`. This means different-length secrets produce different-length ciphertexts, which leaks information about the plaintext length. The project requirements (ENCR-05) mandate padding to fixed block sizes to prevent this. The PADME algorithm is the recommended padding strategy: it provides O(log(log(M))) leakage with at most 12% overhead, is trivial to implement (5 lines of code), and is used by real-world cryptographic tools (Sequoia PGP, age).

Testing uses Vitest with the default Node.js environment. Node.js 20+ exposes `globalThis.crypto.subtle` natively (no import needed), so tests run the real Web Crypto API -- no mocks required. This means the test environment is cryptographically identical to the browser environment, giving high confidence in test results.

**Primary recommendation:** Build a pure-function crypto module using Web Crypto API with PADME-based plaintext padding, base64url key encoding via manual btoa/atob conversion (not the new `Uint8Array.toBase64()` which requires Node.js 25+), and IV prepended to ciphertext. Test with Vitest in Node.js environment using the real `crypto.subtle`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Crypto API (`crypto.subtle`) | Built-in (browser + Node.js 20+) | AES-256-GCM encrypt/decrypt, key generation | Browser-native, hardware-accelerated, zero dependencies, audited by browser vendors. The only acceptable crypto API per project requirements. |
| `crypto.getRandomValues` | Built-in (browser + Node.js 20+) | IV generation, random bytes | CSPRNG built into the platform. Required by project invariants (no `Math.random`). |
| TypeScript | 5.9.x | Type safety for crypto parameters | Catches IV length, key size, and buffer type errors at compile time. |
| Vitest | latest | Unit testing the crypto module | Vite-native, runs in Node.js environment with real `crypto.subtle`. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `TextEncoder` / `TextDecoder` | Built-in | String to/from Uint8Array conversion | Every encrypt/decrypt call -- converting plaintext strings to byte arrays for the crypto API. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual base64url functions | `Uint8Array.toBase64({ alphabet: "base64url" })` | The native method is cleaner but requires Node.js 25+ / browsers from Sept 2025. Node.js 24 LTS does not support it. Use manual conversion for maximum compatibility. |
| Manual base64url functions | `Buffer.from().toString('base64url')` (Node.js only) | Only works server-side. The crypto module must run in browsers. Not an option. |
| Web Crypto API | CryptoJS / sjcl / libsodium.js | Third-party libraries add supply chain risk, are slower than hardware-accelerated native crypto, and violate project requirements. Never use. |
| PADME padding | Power-of-2 padding | Power-of-2 has excellent anonymity but up to 100% overhead (a 17-byte secret pads to 32 bytes). PADME achieves similar leakage resistance with max 12% overhead. |
| PADME padding | Fixed constant size (pad everything to 10KB) | Zero leakage but enormous overhead for short secrets. Wastes storage and bandwidth. |

**Installation:**
```bash
# No crypto dependencies to install -- all browser-native.
# Dev dependencies only:
npm install -D typescript@5.9 vitest
```

## Architecture Patterns

### Recommended Project Structure

```
client/src/crypto/
  encrypt.ts          # encrypt(plaintext: string): Promise<EncryptedPayload>
  decrypt.ts          # decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string>
  keys.ts             # generateKey(), exportKey(), importKey(), encodeKeyToBase64Url(), decodeKeyFromBase64Url()
  padding.ts          # padPlaintext(data: Uint8Array): Uint8Array, unpadPlaintext(data: Uint8Array): Uint8Array
  encoding.ts         # base64url encode/decode, Uint8Array <-> string helpers
  constants.ts        # ALGORITHM, KEY_LENGTH, IV_LENGTH, TAG_LENGTH, MAX_SECRET_SIZE, PADDING_TIERS
  types.ts            # EncryptedPayload, EncryptResult interfaces
  index.ts            # Public API barrel export
  __tests__/
    encrypt.test.ts   # Round-trip, uniqueness, padding verification
    decrypt.test.ts   # Success, wrong key, tampered data, error handling
    keys.test.ts      # Key generation, export/import round-trip, base64url encoding
    padding.test.ts   # Tier boundaries, round-trip, max size
    encoding.test.ts  # base64url edge cases
```

### Pattern 1: Encrypt-Then-Package (IV Prepended to Ciphertext)

**What:** Prepend the 12-byte IV to the ciphertext+tag output. The final blob is `[IV (12 bytes)] + [ciphertext (variable)] + [auth tag (16 bytes)]`. The IV is not secret -- it just must be unique. Prepending it means a single blob contains everything needed for decryption (except the key).

**When to use:** Always. This is the standard pattern used by PrivateBin, Yopass, and virtually every Web Crypto AES-GCM implementation.

**Example:**
```typescript
// Source: MDN SubtleCrypto.encrypt() + standard pattern
interface EncryptedPayload {
  ciphertext: string;  // base64-encoded: IV + ciphertext + tag
}

interface EncryptResult {
  payload: EncryptedPayload;
  key: CryptoKey;
  keyBase64Url: string;  // For URL fragment
}

async function encrypt(plaintext: string): Promise<EncryptResult> {
  // 1. Encode plaintext to bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // 2. Pad to prevent length leakage
  const paddedBytes = padPlaintext(plaintextBytes);

  // 3. Generate fresh 256-bit key
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable -- needed for URL embedding
    ['encrypt', 'decrypt']
  );

  // 4. Generate fresh 96-bit IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 5. Encrypt (returns ciphertext + 16-byte auth tag)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    paddedBytes
  );

  // 6. Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);

  // 7. Encode to base64 for transport
  const ciphertext = uint8ArrayToBase64(combined);

  // 8. Export key for URL fragment
  const keyBase64Url = await exportKeyToBase64Url(key);

  return {
    payload: { ciphertext },
    key,
    keyBase64Url,
  };
}
```

### Pattern 2: Key in URL Fragment

**What:** The encryption key is exported as raw bytes, encoded as base64url (URL-safe, no padding), and placed in the URL fragment (`#`). The fragment is never sent to the server per RFC 3986 Section 3.5.

**When to use:** Always. This is the zero-knowledge guarantee.

**Example:**
```typescript
// Source: MDN SubtleCrypto.exportKey() + RFC 3986
async function exportKeyToBase64Url(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return uint8ArrayToBase64Url(new Uint8Array(rawKey));
}

async function importKeyFromBase64Url(base64url: string): Promise<CryptoKey> {
  const rawKey = base64UrlToUint8Array(base64url);
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    'AES-GCM',
    false,  // not extractable after import -- no need
    ['decrypt']
  );
}

// URL construction (used in Phase 4, but the format is defined here)
function buildShareUrl(secretId: string, keyBase64Url: string): string {
  return `${window.location.origin}/s/${secretId}#${keyBase64Url}`;
}
```

### Pattern 3: PADME Plaintext Padding

**What:** Before encryption, pad the plaintext bytes to a PADME-calculated size. After decryption, remove the padding. This ensures secrets of different lengths produce same-size ciphertexts within padding tiers.

**When to use:** Always before encryption. The padding is applied to the plaintext bytes before they reach `crypto.subtle.encrypt()`.

**Example:**
```typescript
// Source: PADME algorithm (PURBs paper, lbarman.ch/blog/padme/)
// PADME: pad to a length whose binary representation has a mantissa
// no longer than its exponent. Max 12% overhead, O(log log M) leakage.

function padmeLength(len: number): number {
  if (len <= 256) return 256;  // Minimum tier: 256 bytes
  const e = Math.floor(Math.log2(len));
  const s = Math.floor(Math.log2(e)) + 1;
  const lastBits = e - s;
  const bitMask = (1 << lastBits) - 1;
  return (len + bitMask) & ~bitMask;
}

// Padding format: [original length as 4-byte uint32 BE] + [plaintext] + [zero padding]
function padPlaintext(data: Uint8Array): Uint8Array {
  const totalDataLen = 4 + data.length;  // 4 bytes for length prefix
  const paddedLen = padmeLength(totalDataLen);
  const padded = new Uint8Array(paddedLen);
  // Write original length as big-endian uint32
  const view = new DataView(padded.buffer);
  view.setUint32(0, data.length, false);  // big-endian
  padded.set(data, 4);
  // Remaining bytes are zero (Uint8Array default)
  return padded;
}

function unpadPlaintext(padded: Uint8Array): Uint8Array {
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  const originalLen = view.getUint32(0, false);
  if (originalLen > padded.length - 4) {
    throw new Error('Invalid padding: length exceeds padded data');
  }
  return padded.slice(4, 4 + originalLen);
}
```

### Pattern 4: Base64URL Encoding (Manual Implementation)

**What:** Encode/decode Uint8Array to/from base64url (RFC 4648 Section 5) for URL-safe transport. Uses `-` and `_` instead of `+` and `/`, no `=` padding.

**When to use:** Key encoding for URL fragments, ciphertext encoding for API transport.

**Why manual:** `Uint8Array.toBase64({ alphabet: "base64url" })` requires Node.js 25+ / browsers from Sept 2025. Node.js 24 LTS does not support it. Manual implementation ensures compatibility.

**Example:**
```typescript
// Source: RFC 4648 Section 5 + standard practice
function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  // Convert to binary string
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa -> standard base64 -> base64url
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  // base64url -> standard base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// For general base64 (ciphertext transport to server)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
```

### Anti-Patterns to Avoid

- **Using `Math.random()` anywhere in crypto code:** Not cryptographically secure. Always use `crypto.getRandomValues()`.
- **Generating a non-12-byte IV for AES-GCM:** The spec allows other sizes but 12 bytes (96 bits) is the recommended size. Non-12-byte IVs trigger an internal hash that can degrade security properties.
- **Making the key non-extractable:** The key MUST be extractable (`true`) because it needs to be exported to raw bytes for URL embedding. After import on the decryption side, it should be non-extractable (`false`).
- **Using `innerHTML` to display decrypted content:** XSS vector. Always use `textContent`. (Phase 4 concern but the crypto module's return type should be `string`, not HTML.)
- **Storing the key in `localStorage` or `sessionStorage`:** Accessible to any script on the same origin. Store only in a JavaScript closure/module-scoped variable.
- **Separate IV transmission:** Do not send IV as a separate field to the server. Prepend it to the ciphertext blob. Simpler, fewer moving parts, standard practice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AES-256-GCM encryption | Custom AES implementation in JS | `crypto.subtle.encrypt({ name: 'AES-GCM' })` | Native is hardware-accelerated, audited, and correct. JS implementations are slow and error-prone. |
| Random key/IV generation | Custom PRNG or `Math.random` | `crypto.subtle.generateKey()` and `crypto.getRandomValues()` | Platform CSPRNG is the only acceptable source. |
| Authentication tags | Manual HMAC on top of encryption | AES-GCM built-in authentication | GCM mode includes authentication. Adding HMAC is redundant and can introduce bugs. |
| Base64 encoding | npm package (base64-js, etc.) | Manual `btoa`/`atob` with URL-safe character replacement | 10 lines of code vs a dependency. Avoid supply chain risk for trivial utility. |
| Ciphertext padding | PKCS7 padding library | PADME algorithm (5 lines of code) | PADME is specifically designed for length-leakage prevention, not block-cipher padding. Different problem, different solution. |

**Key insight:** This phase uses NO third-party libraries. Every operation is built on platform APIs (`crypto.subtle`, `TextEncoder`, `btoa`/`atob`) or trivial helper functions (base64url, PADME). This is by design -- the crypto module is the most security-critical code and must have zero supply-chain attack surface.

## Common Pitfalls

### Pitfall 1: AES-GCM Produces Variable-Length Ciphertext

**What goes wrong:** AES-GCM is a stream cipher -- ciphertext length equals plaintext length (plus 16-byte auth tag). Without padding, encrypting "hi" and "hello world" produces observably different ciphertext sizes, leaking approximate plaintext length.
**Why it happens:** Developers familiar with AES-CBC (which pads to block boundaries) assume GCM also normalizes length. It does not.
**How to avoid:** Pad the plaintext before encryption using PADME. The padding is applied at the byte level before `crypto.subtle.encrypt()` is called.
**Warning signs:** Ciphertext lengths vary with plaintext length in tests.

### Pitfall 2: Auth Tag Is Inside the Ciphertext Buffer

**What goes wrong:** `crypto.subtle.encrypt()` with AES-GCM returns an `ArrayBuffer` containing both the ciphertext AND the 16-byte authentication tag appended at the end. Developers sometimes try to handle the tag separately, or don't realize decryption expects the combined buffer.
**Why it happens:** Other crypto libraries (like libsodium) may return tag separately. Web Crypto API combines them.
**How to avoid:** Treat the output of `encrypt()` as a single opaque blob. Pass the entire blob (including tag) to `decrypt()`. The 16 bytes of overhead are the auth tag and are non-negotiable.
**Warning signs:** Decryption fails with `OperationError` when trying to separate ciphertext and tag.

### Pitfall 3: btoa/atob Cannot Handle Raw Binary Directly

**What goes wrong:** `btoa()` only handles Latin-1 strings (code points 0-255). Passing a `Uint8Array` directly throws. Developers may try `btoa(bytes)` or `btoa(bytes.toString())` which produce garbage.
**Why it happens:** `btoa`/`atob` are string-based APIs from an era before typed arrays.
**How to avoid:** Convert `Uint8Array` to a binary string character by character: `String.fromCharCode(...bytes)`. For large arrays, loop instead of spread to avoid stack overflow.
**Warning signs:** `InvalidCharacterError` from `btoa()`, or garbled base64 output.

### Pitfall 4: Forgetting to Include IV in the Ciphertext Blob

**What goes wrong:** The IV is generated for encryption but not transmitted to the decryption side. Decryption fails because it cannot reconstruct the `{ name: 'AES-GCM', iv }` parameter.
**Why it happens:** The IV is generated as a separate variable and must be manually bundled with the output.
**How to avoid:** Always prepend IV to the ciphertext buffer before encoding. On decryption, slice the first 12 bytes as IV, rest as ciphertext+tag.
**Warning signs:** Decryption works when IV is in-memory but fails after serialization/deserialization.

### Pitfall 5: Key Encoded as Standard Base64 Instead of Base64URL

**What goes wrong:** Standard base64 uses `+`, `/`, and `=` which are special characters in URLs. When placed in a URL fragment, they may be percent-encoded or misinterpreted by URL parsers, browsers, or messaging apps.
**Why it happens:** Developers use `btoa()` without converting to base64url.
**How to avoid:** Always replace `+` with `-`, `/` with `_`, and strip trailing `=` padding for URL-embedded keys. This is base64url per RFC 4648 Section 5.
**Warning signs:** Keys with `+` or `/` that work in some contexts but fail when copy-pasted through certain apps.

### Pitfall 6: PADME Minimum Tier Too Small

**What goes wrong:** Without a minimum tier, very short secrets (1-byte, 10-byte) produce tiny ciphertext that reveals the secret is very short. An attacker knows it is likely a PIN, short password, or single word.
**Why it happens:** PADME calculates padding relative to input size, so small inputs get small padding.
**How to avoid:** Set a minimum padded size of 256 bytes. All secrets shorter than ~252 bytes (256 minus 4 bytes for length prefix) produce the same ciphertext size. This covers the vast majority of passwords, API keys, and short messages.
**Warning signs:** Very short secrets producing noticeably smaller ciphertexts than longer ones.

### Pitfall 7: Padding Length Prefix Overflow

**What goes wrong:** Using a 2-byte length prefix limits original plaintext to 65,535 bytes. The project allows 10,000 character secrets which in UTF-8 could be up to 40,000 bytes.
**Why it happens:** Choosing a small length prefix to minimize overhead.
**How to avoid:** Use a 4-byte (uint32) big-endian length prefix. Supports up to 4GB, far beyond the 10,000 character limit. The 4-byte overhead is negligible.
**Warning signs:** Secrets over ~65KB failing to decrypt (unlikely to hit given the 10K char limit, but the 4-byte prefix costs nothing as insurance).

## Code Examples

Verified patterns from official sources:

### Full Decrypt Function

```typescript
// Source: MDN SubtleCrypto.decrypt() + standard IV-prepend pattern
async function decrypt(
  ciphertextBase64: string,
  keyBase64Url: string
): Promise<string> {
  // 1. Decode the combined blob
  const combined = base64ToUint8Array(ciphertextBase64);

  // 2. Extract IV (first 12 bytes) and ciphertext+tag (rest)
  const iv = combined.slice(0, 12);
  const ciphertextWithTag = combined.slice(12);

  // 3. Import the key from base64url
  const key = await importKeyFromBase64Url(keyBase64Url);

  // 4. Decrypt (will throw OperationError if key is wrong or data tampered)
  const paddedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertextWithTag
  );

  // 5. Remove padding
  const paddedBytes = new Uint8Array(paddedBuffer);
  const plaintextBytes = unpadPlaintext(paddedBytes);

  // 6. Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintextBytes);
}
```

### Key Generation and Export

```typescript
// Source: MDN SubtleCrypto.generateKey() + SubtleCrypto.exportKey()
async function generateKey(): Promise<{ key: CryptoKey; keyBase64Url: string }> {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable
    ['encrypt', 'decrypt']
  );

  const rawKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64Url = uint8ArrayToBase64Url(new Uint8Array(rawKey));

  return { key, keyBase64Url };
}
```

### PADME Padding Tiers (Reference)

```
Input length -> PADME padded length (with 256-byte minimum):

  1 byte    -> 256 bytes   (minimum tier)
  100 bytes -> 256 bytes   (minimum tier)
  252 bytes -> 256 bytes   (minimum tier, 252 + 4 byte prefix = 256)
  253 bytes -> 264 bytes   (257 rounded up by PADME)
  500 bytes -> 512 bytes
  1000 bytes -> 1024 bytes
  2000 bytes -> 2048 bytes
  5000 bytes -> 5120 bytes
  10000 bytes -> 10240 bytes
  40000 bytes -> 40960 bytes  (max UTF-8 for 10K chars)

Total ciphertext size = padded_size + 12 (IV) + 16 (auth tag)
```

### Test Pattern: Round-Trip Verification

```typescript
// Source: Vitest docs + Web Crypto API
import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../index';

describe('encrypt/decrypt round-trip', () => {
  it('should round-trip a plaintext string', async () => {
    const plaintext = 'my-secret-api-key-12345';
    const result = await encrypt(plaintext);
    const decrypted = await decrypt(
      result.payload.ciphertext,
      result.keyBase64Url
    );
    expect(decrypted).toBe(plaintext);
  });

  it('should produce unique IV per encryption', async () => {
    const result1 = await encrypt('same-text');
    const result2 = await encrypt('same-text');
    // Ciphertext should differ because IV differs
    expect(result1.payload.ciphertext).not.toBe(result2.payload.ciphertext);
  });

  it('should produce unique key per encryption', async () => {
    const result1 = await encrypt('same-text');
    const result2 = await encrypt('same-text');
    expect(result1.keyBase64Url).not.toBe(result2.keyBase64Url);
  });

  it('should fail decryption with wrong key', async () => {
    const result = await encrypt('secret');
    const wrongKeyResult = await encrypt('other');
    await expect(
      decrypt(result.payload.ciphertext, wrongKeyResult.keyBase64Url)
    ).rejects.toThrow();
  });

  it('should pad secrets of different lengths to same tier size', async () => {
    const short = await encrypt('hi');
    const medium = await encrypt('a'.repeat(100));
    // Both should be in the 256-byte minimum tier
    // Ciphertext base64 length should be equal
    expect(short.payload.ciphertext.length).toBe(
      medium.payload.ciphertext.length
    );
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CryptoJS / sjcl for browser encryption | Web Crypto API (`crypto.subtle`) | Baseline since ~2015, dominant since ~2020 | Hardware-accelerated, zero dependencies, audited by browser vendors. No reason to use JS crypto libraries. |
| `btoa`/`atob` for base64 | `Uint8Array.toBase64()` / `Uint8Array.fromBase64()` | Baseline Sept 2025 (browsers), Node.js 25+ | Cleaner API, but not available in Node.js 24 LTS. Use manual `btoa`/`atob` conversion for now. |
| `window.crypto` with vendor prefixes | `globalThis.crypto` (standardized) | Node.js 19+ (global by default) | No imports needed in Node.js 20+. Works identically in browser and Node.js test environments. |
| bcrypt for password hashing | Argon2id | PHC winner 2015, adopted broadly by 2020 | Phase 5 concern, not Phase 1. Mentioned for context. |
| Manual HMAC + encryption | AEAD modes (AES-GCM) | GCM standardized 2007, widely adopted by 2015 | Encrypt-then-MAC is obsolete. GCM provides authentication built-in. |

**Deprecated/outdated:**
- **CryptoJS:** Abandoned since 2021, known vulnerabilities. Never use.
- **sjcl (Stanford):** Not maintained. Web Crypto API replaced its use case entirely.
- **`msCrypto` prefix:** IE-specific. Dead since IE deprecation.
- **`webkitSubtle` prefix:** Safari dropped it years ago. All modern Safari uses standard `crypto.subtle`.

## Open Questions

1. **PADME vs simpler tier-based padding**
   - What we know: PADME provides optimal leakage/overhead tradeoff with a 5-line implementation.
   - What's unclear: Whether the implementation simplicity is better served by a simpler "round up to next power of 2 with 256-byte minimum" approach for this use case where max secret size is 10KB.
   - Recommendation: Use PADME. The implementation is trivial, the overhead is better than power-of-2 (max 12% vs max 100%), and it is a well-studied algorithm from a peer-reviewed paper. If implementation concerns arise during coding, fall back to power-of-2 with 256-byte minimum.

2. **Whether to also transmit IV as a separate JSON field**
   - What we know: The standard pattern is to prepend IV to ciphertext. PrivateBin sends parameters separately. The project architecture document shows `{ encrypted_data, iv }` as separate fields in the API.
   - What's unclear: The ARCHITECTURE.md shows IV as a separate field, but the standard crypto pattern prepends it.
   - Recommendation: The crypto module should prepend IV to the ciphertext internally (single blob). If the API needs separate fields (for the server to store metadata), the API layer can split them. The crypto module's public API should deal in single blobs for simplicity. Resolve during implementation: if the server needs the IV separately, add an extraction utility.

3. **additionalData (AAD) parameter for AES-GCM**
   - What we know: AES-GCM supports Additional Authenticated Data -- data that is authenticated but not encrypted. Could be used to bind the ciphertext to a secret ID or expiration time.
   - What's unclear: Whether to use AAD in Phase 1 or defer it. Using AAD requires the same data to be available at both encryption and decryption time.
   - Recommendation: Do NOT use AAD in Phase 1. The encryption happens before a secret ID is assigned (the server returns the ID after receiving the ciphertext). AAD would add coupling between the crypto module and the API. Keep the crypto module pure and self-contained.

## Sources

### Primary (HIGH confidence)
- [MDN SubtleCrypto.encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) - AES-GCM encryption API, parameters, return value (ciphertext + auth tag combined), code examples
- [MDN SubtleCrypto.decrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/decrypt) - Decryption API, OperationError on wrong key/tampered data
- [MDN SubtleCrypto.generateKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey) - AES-256 key generation, extractable flag, key usages
- [MDN SubtleCrypto.exportKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey) - Raw key export to ArrayBuffer
- [MDN SubtleCrypto.importKey()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey) - Raw key import from ArrayBuffer
- [MDN Uint8Array.toBase64()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64) - Native base64 encoding (Baseline Sept 2025, NOT in Node.js 24)
- [Node.js Web Crypto API docs](https://nodejs.org/api/webcrypto.html) - `globalThis.crypto` available in Node.js 20+ without imports, full AES-GCM support
- [NIST SP800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) - AES-GCM specification, 96-bit IV recommendation
- [SOPS Issue #223](https://github.com/getsops/sops/issues/223) - Documents GCM length leakage problem: ciphertext = plaintext length + 16 byte tag

### Secondary (MEDIUM confidence)
- [PADME algorithm (lbarman.ch)](https://lbarman.ch/blog/padme/) - PADME padding formula, overhead analysis, implementation guide
- [PADME Go implementation (jedisct1)](https://github.com/jedisct1/go-padme-padding) - Reference implementation of PADME in Go
- [PURBs paper (PETS 2019)](https://petsymposium.org/popets/2019/popets-2019-0056.pdf) - Academic paper defining PADME, peer-reviewed
- [Vitest Discussion #893](https://github.com/vitest-dev/vitest/discussions/893) - Confirmed: Node.js 20+ provides `crypto.subtle` natively in Vitest's default Node.js environment
- [Chris Veness AES-GCM Gist](https://gist.github.com/chrisveness/43bcda93af9f646d083fad678071b90a) - Complete Web Crypto AES-GCM encrypt/decrypt example with IV prepending
- [PrivateBin Encryption Format](https://github.com/PrivateBin/PrivateBin/wiki/Encryption-format) - Reference: PrivateBin uses AES-256-GCM with PBKDF2, 128-bit IV, 128-bit auth tag
- [Node.js PR #42083](https://github.com/nodejs/node/pull/42083) - Enabled global WebCrypto by default in Node.js

### Tertiary (LOW confidence)
- [mdn/browser-compat-data #28228](https://github.com/mdn/browser-compat-data/issues/28228) - `Uint8Array.toBase64` support tracking: Node.js 25+ only, not in Node.js 24

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Web Crypto API is a W3C standard, MDN documentation is authoritative, Node.js docs confirm globalThis.crypto availability
- Architecture: HIGH - IV-prepend pattern is universal in AES-GCM implementations, verified across PrivateBin, Yopass, and MDN examples
- Padding strategy: MEDIUM - PADME is well-studied (peer-reviewed PETS 2019 paper) but the specific "minimum 256 bytes" floor is a project-specific decision not validated by external sources
- Pitfalls: HIGH - Sourced from MDN API docs (auth tag in ciphertext), real-world implementations, and project-level pitfall research
- Testing approach: HIGH - Node.js 20+ globalThis.crypto availability confirmed by official Node.js docs and Vitest community

**Research date:** 2026-02-13
**Valid until:** 2026-06-13 (Web Crypto API is stable; padding strategy is project-specific and won't change externally)
