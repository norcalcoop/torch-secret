# Show HN: Torch Secret – decryption key lives in the URL fragment, never reaches the server (RFC 3986 §3.5)

**URL:** https://torchsecret.com

---

## Submitter Comment

I built Torch Secret to solve a specific problem: sharing API keys, database passwords, and one-time credentials with someone without either person creating an account or trusting a third-party service with the plaintext. The server receives only AES-256-GCM ciphertext. The decryption key lives in the URL fragment and is never transmitted — per RFC 3986 §3.5, fragments are excluded from HTTP requests by specification.

RFC 3986 §3.5 defines the fragment identifier as everything after the `#` character in a URI. The critical property: fragments are processed exclusively by the browser and are not included in the HTTP request sent to the server. When a recipient opens `https://torchsecret.com/s/abc123#base64key`, the server receives `GET /s/abc123 HTTP/1.1` — the `#base64key` portion never appears on the wire. This is not a browser convention; it is a protocol requirement. Torch Secret uses this boundary as its cryptographic boundary: the 256-bit AES-GCM key travels only in the URL fragment, which means it travels only between the sender's browser and the recipient's browser, via the URL itself.

Encryption runs entirely in the browser using `crypto.subtle.generateKey` and `crypto.subtle.encrypt` — no third-party cryptography libraries. A fresh 96-bit IV is generated per encryption via `crypto.getRandomValues`. The combined blob sent to the server has the layout `[IV 12 bytes][ciphertext][GCM auth tag 16 bytes]` encoded as a single base64 string. The server receives and stores this blob without being able to parse it. It has no key.

On retrieval, a single database transaction executes three steps: SELECT (fetch ciphertext), ZERO (overwrite the ciphertext column with zeros to reduce PostgreSQL WAL remanence), DELETE (remove the row). All three steps are wrapped in a single transaction, so no concurrent request can slip in between SELECT and DELETE to read the same ciphertext twice. For password-protected secrets, a `FOR UPDATE` pessimistic row lock is acquired before the password verification step. Without this lock, two simultaneous requests with the correct passphrase would both pass `argon2.verify` before either of them deletes the row — both would receive the ciphertext. The lock serializes them: the second request's lock acquisition returns an empty result set, and it gets the same "not found" response as an invalid ID.

AES-GCM is a stream cipher, so ciphertext length exactly equals plaintext length. Without padding, the ciphertext size leaks the message size to anyone with server access. Every secret is padded using the PADME algorithm (PURBs paper, PETS 2019) before encryption. PADME groups messages into logarithmic tiers and pads to the tier ceiling, at most 12% overhead versus 100% for power-of-2 padding. The padded length is still visible to the server; PADME narrows the attacker's length bracket, it does not eliminate it.

I want to pre-answer the obvious questions about what this architecture cannot protect against. Device compromise: if the sender's device is compromised before they paste their secret, an attacker with device access can read the plaintext in the textarea before encryption runs. Malicious browser extensions: an extension with page access operates at the same trust level as the page's own JavaScript and can read the textarea contents. Client-side JS trust model: HTTPS protects transit, but users must trust that the server delivers unmodified JavaScript — a supply-chain attack or compromised build pipeline could cause the browser to execute attacker-controlled code that intercepts plaintext before `crypto.subtle.encrypt` runs. These are real limitations; they're documented in the technical writeup linked in the GitHub README.

The code is at https://github.com/norcalcoop/torch-secret, ISC licensed, Docker Compose included. The server is designed to be untrusted — self-hosting removes the need to trust our infrastructure entirely. Try it at https://torchsecret.com — no account required.

---

## Notes for Submitter

**Word count:** The submitter comment above is approximately 490 words. Verify it is within the 300–500 word target before posting. If it runs long, trim the PADME paragraph first — it is the least novel detail to an HN audience.

**Best time to post:** Weekday mornings US Eastern time, between 8–10 AM. Show HN posts surface best when the US-based HN audience is starting their day. Avoid Friday afternoons, weekends, and US holidays.

**What to do if flagged:** Email hn@ycombinator.com with the submission URL and a brief explanation of what you built. Show HN posts are occasionally auto-flagged by the spam filter for new accounts or for links that resemble prior submissions. A short, factual email to the moderators resolves this in most cases within a few hours.

**Social coordination:** Do not simultaneously post to Twitter/X, LinkedIn, or Reddit at the exact moment you submit to HN. HN's ranking algorithm penalizes posts that appear to be receiving coordinated off-site traffic. Wait until the HN post has been live for 2–4 hours before linking to it from other channels.

**Submitter comment timing:** Post the submitter comment within the first 5 minutes of the submission going live. HN ranks comments by time within the same score tier — an early submitter comment establishes the technical framing before other commenters arrive.

**URL:** Submit with https://torchsecret.com as the URL — the free-tier anonymous flow satisfies HN's Show HN requirement that the project be accessible without an account or payment.
