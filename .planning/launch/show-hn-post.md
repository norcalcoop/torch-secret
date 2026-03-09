# Show HN: Torch Secret

---

## Title (locked — do not change)

Show HN: A secret sharer where the encryption key never reaches the server (RFC 3986 URL fragments)

---

## Post Body

We all know we shouldn't paste API keys into Slack. But the alternative is usually... more Slack.

Torch Secret is a one-time secret sharer with a zero-knowledge architecture: the encryption key never touches the server. Here's how it works.

You paste your secret — an API key, password, credentials, anything — into the browser. AES-256-GCM encrypts it locally using the Web Crypto API. The encrypted blob goes to the server. The 256-bit key goes into the URL fragment: `https://torchsecret.com/reveal/[id]#[43-char-key]`.

You share that URL. The recipient's browser fetches the encrypted blob and decrypts it locally using the key from the fragment. The server deletes the blob after one view — no second read is possible.

The zero-knowledge property rests on a specific part of the HTTP specification: per RFC 3986 §3.5, the URL fragment is a client-side reference only. Browsers strip it before constructing the HTTP request. The key never appears in the network packet the server receives — not in the request line, not in the headers, nowhere. This isn't a configuration choice or a policy. It's how the URI specification defines fragment handling across all compliant browsers.

The result: our server stores only ciphertext it cannot decrypt. Even under subpoena, there's nothing to hand over.

No accounts required for basic use. Sign up if you want a dashboard to track your active secrets.

We recently shipped a set of features from our internal "58.x" sprint: a burn-after-reading countdown timer (15, 30, or 60 seconds — the secret self-destructs when the timer fires, not just on first view), QR code sharing for mobile handoff, clipboard auto-clear (the copied link disappears from your clipboard after 60 seconds), and intelligent expiry suggestions that read the time of day and suggest appropriate defaults.

Source: <https://github.com/norcalcoop/torch-secret> (ISC license)
Live: <https://torchsecret.com>

Happy to answer questions about the architecture.

---

## Submitter Comment (~490 words)

The core property: the fragment identifier in a URL (`#...`) is defined in RFC 3986 §3.5 as a client-side reference only. The browser HTTP stack strips it before establishing the TCP connection. No server-side logging, proxy, CDN, or middleware ever sees it — by specification, not by configuration.

**How the crypto path works:**

**Key generation.** The browser calls `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])` to produce a 256-bit key via the OS CSPRNG. The key is exported as a 43-character base64url string for embedding in the URL. `Math.random` is never involved.

**Encryption.** AES-256-GCM via the Web Crypto API. We use GCM specifically because it provides authenticated encryption: the 128-bit auth tag catches any ciphertext tampering by the server or a network attacker — the recipient's browser will reject a modified blob before decryption completes. A fresh 96-bit IV is generated per secret using `crypto.getRandomValues`. Reusing an IV with the same GCM key is catastrophic (it leaks the auth key material), so we generate a new IV for every secret. The IV is prepended to the ciphertext + auth tag as a single standard base64 blob: `[IV 12 bytes][ciphertext][auth tag 16 bytes]`. That blob is what gets stored on the server.

**URL delivery.** The key is the fragment: `https://torchsecret.com/reveal/[id]#[43-char-key]`. When you share that URL, the browser opens the link, fetches the encrypted blob from the server (no key in the request), extracts the key from the fragment (never transmitted), and decrypts locally. A common question: what stops the server from logging the URL before the fragment is stripped? The answer is that the browser's HTTP implementation strips the fragment before the TCP connection is established — there is no point at which the server could observe it, even in principle. No server-side workaround exists.

**Atomic destroy.** Retrieval runs as a single database transaction: (1) SELECT to read the ciphertext, (2) overwrite the ciphertext column with zeroes (`'0'.repeat(length)`) — a defense against write-ahead log data remanence, since PostgreSQL WAL stores pre-image rows until the segment is recycled, (3) DELETE the row. The zeroing step means that even the WAL copy contains `'0000...'`, not the original ciphertext. The transaction serializes concurrent reads: a second caller blocks on the lock, then sees no row.

**PADME padding.** Plaintext is padded to the nearest PADME boundary before encryption (from the PURBs paper, PETS 2019). Maximum overhead is 12%, versus 100% for power-of-2 rounding. A 256-byte floor means any secret under 256 bytes produces the same padded output — eliminating length leakage entirely for the most common case (API keys, passwords, tokens).

**Limitations**

These are architectural, not implementation bugs — I want to name them upfront:

- Device compromise nullifies all guarantees — if RAM or the browser tab are accessible to an attacker, the plaintext and key are exposed
- Malicious browser extensions can intercept plaintext before the Web Crypto API encrypts it
- Ciphertext length is observable at the network layer (mitigated by PADME but not eliminated for very short secrets above the 256-byte floor)
- JS trust model: users must trust the browser to run the correct client-side crypto code; the source is auditable at the GitHub link

Source: <https://github.com/norcalcoop/torch-secret> (ISC license). Happy to dig into any of these in the thread.
