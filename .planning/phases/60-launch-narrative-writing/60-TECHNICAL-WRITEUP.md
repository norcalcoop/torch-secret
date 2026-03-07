# How Torch Secret Works: A Zero-Knowledge Architecture for One-Time Secret Sharing

_Cross-post targets: HN text post, dev.to, Medium, GitHub wiki. ~2,060 words._

---

## 1. Opening: What Can a Malicious Server Operator Do?

Suppose the operators of a secret-sharing service are compromised, subpoenaed, or simply dishonest. What can they read?

With Torch Secret, the answer is: AES-256-GCM ciphertext they cannot decrypt. The decryption key is generated in the sender's browser, embedded in the URL fragment, and never transmitted to the server — not by convention, but by specification. The server stores an encrypted blob, serves it once, then destroys it. Without the key, the blob is indistinguishable from random noise.

Most secret-sharing services ask you to trust their infrastructure. "We encrypt your data at rest" typically means the provider holds the encryption keys — so a breach, a court order, or a rogue employee can recover plaintext. Torch Secret eliminates that trust assumption for the transit and storage path. The server is architecturally incapable of decrypting what it stores.

This writeup explains how that property holds, where the implementation enforces it, and what it cannot protect against.

---

## 2. The URL Fragment Insight

The mechanism that makes this possible is a property of HTTP and URLs defined in RFC 3986.

RFC 3986 §3.5 defines the fragment identifier as the component of a URI that follows the `#` character. The critical property: the fragment is processed exclusively by the client (the browser) and is not included in the HTTP request sent to the server. When a browser fetches `https://torchsecret.com/s/abc123#base64key`, the server receives only `GET /s/abc123 HTTP/1.1`. The `#base64key` component never appears on the wire.

This is not a browser implementation convention — it is a requirement. RFC 3986 §3.5 states that the fragment "is not used in the scheme-specific processing of a URI" and that a retrieval action (an HTTP request) uses only the URI without the fragment.

Torch Secret uses this property as its cryptographic boundary. The 256-bit AES-GCM key is exported as 43 base64url characters and embedded in the URL fragment. The sender shares the full URL (including the fragment). The server never sees it. The recipient's browser extracts the key from the fragment locally, fetches the ciphertext from the server, and decrypts in-browser. The server learns only that the secret was retrieved.

There is no configuration option, no flag, and no code path that causes the key to be sent to the server. The boundary is enforced by the HTTP protocol itself, not by application logic that could be accidentally disabled or bypassed in a future change.

---

## 3. Key Generation and Encryption

The entire encryption pipeline runs in the browser using the Web Crypto API (`crypto.subtle`). No third-party cryptography libraries are involved.

**Key generation (sender side):**

```typescript
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true, // extractable: must be true to export for URL embedding
  ['encrypt', 'decrypt'],
);
```

The key is created with `extractable: true` because the raw bytes must be exported and encoded as base64url for embedding in the URL fragment. Without extractability, the key would be confined to the browser's key store and could not be shared.

**Key import (recipient side):**

```typescript
return crypto.subtle.importKey(
  'raw',
  rawKey,
  'AES-GCM',
  false, // non-extractable: no need to re-export after import
  ['decrypt'], // decrypt-only: receiving side restriction
);
```

When the recipient's browser imports the key from the URL fragment, it is imported as non-extractable and decrypt-only. Once imported, the key cannot be extracted from the browser's key store and cannot be used to encrypt new data. This is defense in depth: even if the decryption page were somehow instrumented to exfiltrate the key after retrieval, the key cannot be re-extracted from the CryptoKey object.

**Encryption with a fresh IV:**

```typescript
// Generate a fresh 96-bit IV (NIST-recommended for AES-GCM)
const iv = crypto.getRandomValues(new Uint8Array(12));

// Encrypt the padded plaintext with AES-GCM
const ciphertextBuffer = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  paddedBytes,
);

// Prepend IV to ciphertext for transport: [IV 12 bytes][ciphertext + auth tag]
const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
combined.set(iv, 0);
combined.set(new Uint8Array(ciphertextBuffer), iv.length);
```

Every encryption call generates a fresh 96-bit IV using `crypto.getRandomValues` — the cryptographically secure random source. The IV is NIST-recommended for AES-GCM (96 bits = 12 bytes minimizes padding overhead and avoids birthday-bound collision risk at reasonable message counts). AES-256-GCM produces a 128-bit authentication tag appended to the ciphertext.

The final blob sent to the server is a single base64 string with the layout: `[IV 12 bytes][ciphertext][GCM auth tag 16 bytes]`. The server stores this blob without being able to parse or decrypt it — it has no key and no IV is reused.

---

## 4. PADME Padding: Bounding Length Leakage

AES-GCM is a stream cipher: the ciphertext length is exactly equal to the plaintext length. A server that stores ciphertext without the key can still observe the ciphertext's byte length — which is the plaintext's byte length. An attacker with access to the ciphertext can narrow-bracket the message content based on length alone. A 6-character ciphertext is almost certainly a short PIN; a 3,000-character ciphertext is probably a long document.

To mitigate this, every secret is padded before encryption using the PADME algorithm, described in the PURBs paper (PETS 2019, https://lbarman.ch/blog/padme/).

```typescript
// Reference: PADME algorithm (PURBs paper, PETS 2019): https://lbarman.ch/blog/padme/
export function padmeLength(len: number): number {
  if (len <= 256) return 256;  // minimum padded size

  const e = Math.floor(Math.log2(len));
  const s = Math.floor(Math.log2(e)) + 1;
  const lastBits = e - s;
  const bitMask = (1 << lastBits) - 1;
  return (len + bitMask) & ~bitMask;
}
```

PADME groups messages into logarithmic tiers. All messages within a tier are padded to the same length — the tier ceiling. The maximum overhead is 12% of the original message size. Power-of-2 padding (the naive approach) guarantees 100% overhead in the worst case. PADME achieves substantially less leakage at a fraction of the storage cost.

An important caveat: PADME bounds the attacker's information, it does not eliminate it. The padded length is visible to the server. An attacker who knows the tier boundaries can still narrow-bracket the original message length within a tier. This is documented in the Limitations section.

The minimum padded size is 256 bytes. A 6-character PIN and a 180-character short paragraph produce identical ciphertext lengths after padding. Beyond 256 bytes, the tiers widen as messages grow — a 10,000-character secret (the maximum) sits in a tier with roughly 12% overhead separating it from the next tier boundary.

All secrets are padded to a minimum of 256 bytes before encryption. A 6-character secret and a 200-character secret both produce 256-byte ciphertext after padding.

---

## 5. The Atomic Destroy Transaction

When a recipient opens a one-time secret link, the server performs a single database transaction with three steps: SELECT, ZERO, DELETE.

```typescript
return db.transaction(async (tx) => {
  // Step 1: SELECT — retrieve the secret
  const [secret] = await tx.select().from(secrets).where(eq(secrets.id, id));

  if (!secret || secret.passwordHash !== null) return null;

  // Step 2: ZERO — overwrite ciphertext with zero characters
  // PostgreSQL text columns cannot contain null bytes (\x00), so we use '0'.
  // This mitigates data remanence in PostgreSQL WAL and shared buffers.
  await tx
    .update(secrets)
    .set({ ciphertext: '0'.repeat(secret.ciphertext.length) })
    .where(eq(secrets.id, id));

  // Step 3: DELETE — remove the row entirely
  await tx.delete(secrets).where(eq(secrets.id, id));

  return secret; // return original ciphertext from Step 1
});
// Note: simplified for readability. Full implementation handles user-owned secrets
// (soft-delete vs hard-delete) and notification email lookup.
```

**Why not just DELETE?** A naive implementation reads the ciphertext and immediately issues a DELETE. PostgreSQL's write-ahead log (WAL) and shared buffer pool retain page contents after a DELETE until those pages are vacuumed and overwritten. A forensic attacker with direct filesystem access to the database could potentially recover deleted ciphertext from WAL segments. By overwriting the ciphertext column with zeros before the DELETE, we shrink the remanence window: the WAL records the zero-overwrite, and only after that does the DELETE propagate through the WAL. The original ciphertext bytes are no longer in the latest WAL segment by the time the transaction commits.

**Why atomicity?** Without a single transaction, the sequence READ → ZERO → DELETE has race windows. A second concurrent request could issue its own READ between the first request's READ and DELETE, receiving the ciphertext a second time. Wrapping all three steps in a single `db.transaction()` call ensures the sequence is atomic: no other operation can observe intermediate state.

---

## 6. Password-Protected Secrets

Some secrets are protected with an additional passphrase. The passphrase is hashed server-side using Argon2id before storage:

- Memory cost: 19,456 KiB (19 MiB) — OWASP minimum
- Time cost: 2 iterations — OWASP minimum
- Parallelism: 1 thread
- Output: PHC format (`$argon2id$v=19$m=19456,t=2,p=1$...`)

A concurrent request attack applies specifically to password-protected secrets: without additional locking, two simultaneous requests with the correct passphrase would both pass `argon2.verify` before either of them deletes the secret row, resulting in both receiving the ciphertext.

The implementation prevents this with a pessimistic row-level lock acquired at the start of the transaction:

```typescript
// Acquire a pessimistic row-level lock before reading.
// Without this, concurrent correct-password requests all pass argon2.verify
// before any of them deletes the secret — all receive the ciphertext.
const lockRows = await tx.execute(
  sql`SELECT id FROM secrets WHERE id = ${id} FOR UPDATE`
);
if (lockRows.rows.length === 0) return null;
```

`FOR UPDATE` acquires an exclusive row lock that blocks concurrent transactions from reading or modifying the same row until this transaction commits. The first request wins the lock, deletes the secret, and commits. The second request's lock acquisition returns an empty result set — the row is already gone — and it receives the same "not found" response as an invalid ID.

To prevent memory exhaustion from simultaneous Argon2id hashing (19 MiB per operation), a concurrency limiter caps password verification at four simultaneous operations.

---

## 7. Honest Limitations

This section is not a footnote. Four real limitations exist, and pre-announcing them is more useful than waiting for someone to surface them in comments.

**Device compromise.** If a sender's device is compromised before they paste their secret, an attacker with access to the device can read the plaintext in the browser textarea before `crypto.subtle.encrypt` runs. The architecture protects against server-side attackers; it has no defense against an attacker who already controls the client.

**Malicious browser extensions.** A browser extension with `activeTab` or `scripting` permissions can read the DOM — including the contents of the textarea — before the secret is encrypted. Extensions granted page access operate at the same trust level as the page's own JavaScript. Users who require strong security guarantees should use a browser profile without extensions, or use a browser that enforces stricter extension isolation.

**Ciphertext length visibility.** PADME bounds length leakage to at most 12% overhead per tier, but the padded ciphertext length is visible to the server and to anyone monitoring network traffic. A determined attacker who knows the PADME tier boundaries can narrow-bracket the original message length. For messages where even approximate length is sensitive, this limitation applies.

**Client-side JavaScript trust model.** HTTPS protects transit: the server cannot silently modify JavaScript after TLS is established and a pinned certificate is in use. However, users must trust that the server delivers unmodified JavaScript in the first place. A supply-chain attack in the build pipeline, a compromised CDN, or a malicious Content-Security-Policy bypass could cause the browser to execute attacker-controlled JavaScript that intercepts plaintext before encryption. This is the fundamental trust assumption of any browser-based cryptographic tool.

---

## 8. Open Source and Self-Hosted

The full implementation is available at https://github.com/norcalcoop/torch-secret under the MIT license. Docker Compose files are included for local and production deployment.

The server is designed to be untrusted — it stores only encrypted blobs and has no access to decryption keys. Self-hosting removes the need to trust our infrastructure at all. If you run your own instance, the zero-knowledge property holds against your own server operators as well as against ours.

---

## 9. Try It

Try it at https://torchsecret.com — no account required.

Create a secret, examine the URL fragment, share the link, and watch the destruction screen appear after the first view. The source for every step described in this writeup is in the `client/src/crypto/` module and `server/src/services/secrets.service.ts`.
