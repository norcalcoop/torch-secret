# Torch Secret — Product Hunt Listing Draft

_All sections are independently copyable for the PH submission form._

---

## Tagline

One-time secret sharing — the server can't read your data

---

## Short Description (card copy — ≤260 chars)

Share a secret once — the link self-destructs after one view, no account needed. The decryption key lives in the URL fragment and is never transmitted to the server. Open source, self-hostable, ISC license.

---

## Long Description (~200 words)

Sharing API keys, database passwords, or one-time credentials is a solved problem — until you think about who sees them. Slack stores them. Email stores them. Most secret-sharing services encrypt your data at rest while holding the decryption keys themselves, which means a breach, a subpoena, or a rogue employee can still recover your plaintext.

Torch Secret takes a different approach. The decryption key is generated in your browser, embedded in the URL fragment (#base64key), and shared as part of the link you send. The URL fragment is excluded from HTTP requests per RFC 3986 §3.5 — it never leaves your browser, and it never reaches our server. The server stores only AES-256-GCM ciphertext it cannot decrypt.

When the recipient opens the link, their browser extracts the key from the fragment, fetches the ciphertext, and decrypts locally. The server immediately destroys the secret: a single atomic transaction overwrites the ciphertext with zeros, then deletes the row. No second retrieval is possible.

No account required — try it at https://torchsecret.com.

Self-hosting is one command: `docker-compose up`. ISC license — commercial use allowed. Source at https://github.com/norcalcoop/torch-secret.

---

## FAQ

**Q: How does the server not see my data?**

A: The decryption key is generated in your browser using the Web Crypto API and embedded in the URL fragment — the portion of the URL after the `#` character. Per RFC 3986 §3.5, fragments are excluded from HTTP requests by specification, not by convention. When your browser fetches the secret, the server receives the path but never the fragment. The server stores only AES-256-GCM ciphertext. Without the key, it cannot decrypt what it holds.

**Q: Can I self-host it?**

A: Yes. Clone the repo and run `docker-compose up` — the stack is PostgreSQL plus the application container. No external services are required for the anonymous tier: no Redis, no third-party APIs for core functionality. ISC license means commercial use is allowed without restriction. Repo: https://github.com/norcalcoop/torch-secret

**Q: What's the difference between Free and Pro?**

A: The Free tier is fully anonymous — no account required, standard rate limits, and expiration options up to 7 days. The Pro tier adds an authenticated dashboard with a history of secrets you've created, higher rate limits, and longer expiration windows up to 30 days. The zero-knowledge property holds for both tiers: the server cannot read your secrets regardless of plan.

**Q: How do I know you haven't modified the JavaScript?**

A: The full source is at https://github.com/norcalcoop/torch-secret — the crypto module is in `client/src/crypto/`. The Content-Security-Policy headers are visible in browser devtools under the Network tab, which shows the nonce-based CSP applied to each request. Self-hosting removes this trust assumption entirely: you run your own instance from your own build, and the zero-knowledge property holds against your own infrastructure as well as ours.

---

## Gallery Image Checklist

Take all screenshots at https://torchsecret.com (not localhost). Browser zoom at 100%. Use a clean browser profile with no visible extensions.

1. **Create flow** — Navigate to `/create`. Enter secret text in the textarea (use a realistic example like a redacted API key). Capture the page showing the textarea content, expiration selector, and the "Create secret" button. This establishes UX simplicity as the first impression.

2. **Reveal page** — Open a live secret link and capture the page showing the decrypted secret text displayed. This shows the product promise fulfilled: the secret arrived, readable, on the other end.

3. **Confirmation page with URL bar visible** — After creating a secret, capture the `/confirmation` page with the full browser chrome visible, including the address bar. The generated share link with the `#base64key` fragment must be visible in the address bar. **This is the strongest visual proof of the zero-knowledge claim** — it shows the key in the URL, not stored by the server. Use a screenshot tool that captures the full browser window (not just the page content). Do not crop the address bar.

4. **Destroyed state** — Open the same secret link a second time (after it has already been viewed). Capture the error/reveal page showing "This secret has already been viewed." This demonstrates the one-time guarantee in action.

5. **(Optional) Dashboard** — Log in to a Pro account and capture the authenticated dashboard showing the list of created secrets with their status. Pro feature social proof for voters considering an upgrade.

**Production note for image 3:** The `#key` fragment must be readable in the address bar — zoom into the screenshot or use a high-resolution capture if needed. Blurring or cropping the fragment defeats the purpose of this image.

---

## First Comment (Maker Comment)

I built Torch Secret to solve a specific problem: sharing API keys, database passwords, and one-time credentials with someone without either person creating an account or trusting a third-party service with the plaintext. The server receives only AES-256-GCM ciphertext. The decryption key lives in the URL fragment and is never transmitted — per RFC 3986 §3.5, fragments are excluded from HTTP requests by specification.

RFC 3986 §3.5 defines the fragment identifier as everything after the `#` character in a URI. The critical property: fragments are processed exclusively by the browser and are not included in the HTTP request sent to the server. When a recipient opens `https://torchsecret.com/s/abc123#base64key`, the server receives `GET /s/abc123 HTTP/1.1` — the `#base64key` portion never appears on the wire. This is not a browser convention; it is a protocol requirement. Torch Secret uses this as its cryptographic boundary: the 256-bit AES-GCM key travels only in the URL fragment, which means it travels only between the sender's browser and the recipient's browser, via the URL itself.

Encryption runs entirely in the browser using `crypto.subtle.generateKey` and `crypto.subtle.encrypt` — no third-party cryptography libraries. A fresh 96-bit IV is generated per encryption via `crypto.getRandomValues`. The combined blob sent to the server has the layout `[IV 12 bytes][ciphertext][GCM auth tag 16 bytes]` encoded as a single base64 string. The server stores this blob without being able to parse or decrypt it.

On retrieval, a single database transaction executes three steps: SELECT (fetch ciphertext), ZERO (overwrite the ciphertext column with zeros to reduce PostgreSQL WAL remanence), DELETE (remove the row). All three steps are wrapped in a single transaction, so no concurrent request can retrieve the same ciphertext twice.

A few honest limitations worth naming upfront: device compromise means if your device is already controlled by an attacker before you paste a secret, the architecture offers no protection. Malicious browser extensions with page access operate at the same trust level as the page's own JavaScript. And users must trust that the server delivers unmodified JavaScript — self-hosting removes this assumption entirely.

The code is at https://github.com/norcalcoop/torch-secret, ISC licensed, Docker Compose included. No account required to try it at https://torchsecret.com.

Have you run into the credential-sharing-with-contractors problem? Curious what your current workflow looks like.
