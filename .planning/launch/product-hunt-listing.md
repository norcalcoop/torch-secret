# Product Hunt Listing: Torch Secret

## Tagline

Zero-knowledge secret sharing — key stays in the URL.

## Description (short)

Paste a secret, get an encrypted link, share it — the link self-destructs after one view. The encryption key lives only in the URL fragment and never reaches our server (RFC 3986 §3.5). Even under subpoena, there's nothing to hand over. Burn timer included.

## Gallery Image Checklist

1. Create page — protection panel visible, burn timer dropdown open on "30s" option, expiry select visible. 1270×760px.
2. Confirmation page — 4-way sharing row in full (Copy Link / Share / Email / QR). 1270×760px.
3. Reveal page — secret revealed in terminal block, burn timer countdown visible (e.g. "28s remaining"). 1270×760px.
4. Burn timer firing — content hides, "secret destroyed" state with timestamp. 1270×760px.

## First Comment (300–400 words)

The core property: the fragment identifier in a URL (`#...`) is defined in RFC 3986 §3.5 as a client-side reference only. The browser HTTP stack strips it before establishing the TCP connection. No server-side logging, proxy, CDN, or middleware ever sees it — by specification, not by configuration.

**How the crypto path works:**

**Key generation.** The browser generates a 256-bit key via the OS CSPRNG using the Web Crypto API — `Math.random` is never involved.

**Encryption.** AES-256-GCM via the Web Crypto API. GCM provides authenticated encryption: the 128-bit auth tag catches any ciphertext tampering before decryption completes. A fresh 96-bit IV is generated per secret; the IV is prepended to the ciphertext + auth tag as a single base64 blob.

**URL delivery.** The key is the fragment: `https://torchsecret.com/reveal/[id]#[43-char-key]`. The recipient's browser fetches the encrypted blob, extracts the key from the fragment (never transmitted), and decrypts locally.

**Atomic destroy.** Retrieval runs as a single database transaction: (1) SELECT to read the ciphertext, (2) overwrite the ciphertext column with zeroes — a defense against write-ahead log data remanence, (3) DELETE the row. A second concurrent caller blocks on the lock, then sees no row.

We also offer a burn-after-reading countdown (15, 30, or 60 seconds) — the secret self-destructs when the timer fires, not just on first view.

**A few honest limitations worth naming upfront:**

- Device compromise nullifies all guarantees — if RAM or the browser tab are accessible to an attacker, the plaintext and key are exposed
- Malicious browser extensions can intercept plaintext before the Web Crypto API encrypts it
- Ciphertext length is observable at the network layer (mitigated by PADME padding but not eliminated for very short secrets above the 256-byte floor)
- JS trust model: users must trust the browser to run the correct client-side crypto code; the source is auditable at the GitHub link

**Q: What prevents the server from logging the URL before the fragment is stripped?**
**A:** The browser's HTTP stack strips the fragment before establishing the TCP connection — by specification (RFC 3986 §3.5), not by configuration. No server-side workaround exists.

Source: https://github.com/norcalcoop/torch-secret (ISC license)
