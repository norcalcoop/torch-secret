**Title:** I built a one-time secret sharer where the decryption key lives in the URL fragment and never reaches the server (RFC 3986 §3.5)

**Body:**

RFC 3986 §3.5 defines the fragment identifier — everything after `#` in a URI — as client-only. Browsers don't include it in HTTP requests. When someone opens `https://torchsecret.com/s/abc123#base64key`, the server receives `GET /s/abc123 HTTP/1.1`. The `#base64key` portion never appears on the wire. This is a protocol requirement, not a browser convention.

I used that boundary as the cryptographic boundary.

**How the crypto works:**

The sender's browser calls `crypto.subtle.generateKey` (AES-256-GCM, 256-bit) and encrypts the secret using a fresh 96-bit IV via `crypto.getRandomValues`. The blob sent to the server has the layout `[IV 12 bytes][ciphertext][GCM auth tag 16 bytes]`, base64-encoded. The server stores this without being able to parse or decrypt it — it has no key.

**Atomic destroy:**

Retrieval runs a single DB transaction: SELECT (fetch ciphertext) → ZERO (overwrite ciphertext column with zeros to reduce WAL remanence) → DELETE. For password-protected secrets, a `FOR UPDATE` pessimistic row lock is acquired before Argon2id verification. Without it, two concurrent correct-password requests would both pass `argon2.verify` before either deletes the row — both would receive the ciphertext. The lock serializes them: the second request's lock acquisition returns empty, and it gets the same "not found" response as an invalid ID.

**Limitations — naming them explicitly:**

Device compromise: if the sender's device is compromised before encryption runs, an attacker with device access can read plaintext in the textarea. Malicious browser extensions: an extension with page access operates at the same trust level as the page's own JavaScript and can read textarea contents. JS trust model: users must trust that the server delivers unmodified JavaScript. A compromised build pipeline could intercept plaintext before `crypto.subtle.encrypt` runs.

Code is at https://github.com/norcalcoop/torch-secret (ISC licensed) — all crypto is in `client/src/crypto/`, retrieval logic in `server/src/services/secrets.service.ts`. Try it at https://torchsecret.com — no account required.
