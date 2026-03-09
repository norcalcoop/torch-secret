Torch Secret: the encryption key is in the URL fragment, so the server can't see it (RFC 3986 §3.5)

Per RFC 3986 §3.5, the fragment identifier (`#...`) is a client-side reference only. Browsers strip it before constructing the HTTP request. This is not a configuration option or a policy — it is how the URI specification defines fragment handling across all compliant HTTP implementations. The server never receives the fragment, not in the request line, not in the headers.

The practical result: the server stores only ciphertext it cannot decrypt.

Retrieval runs as a single database transaction: SELECT the ciphertext, overwrite the ciphertext column with zeroes (addresses WAL data remanence — PostgreSQL WAL stores pre-image rows until the segment is recycled, so the zeroing step ensures the WAL copy contains `'0000...'` rather than the original ciphertext), then DELETE the row. A second caller blocks on the transaction lock and sees no row.

Plaintext is padded to PADME boundaries before encryption (PURBs paper, PETS 2019). Maximum overhead is 12%, versus 100% for power-of-2 rounding. A 256-byte floor eliminates length leakage entirely for secrets under 256 bytes.

**Limitations**

- Device compromise nullifies all guarantees — if RAM or the browser tab are accessible to an attacker, the plaintext and key are exposed
- Malicious browser extensions can intercept plaintext before the Web Crypto API encrypts it
- Ciphertext length is observable at the network layer (mitigated by PADME but not eliminated for very short secrets above the 256-byte floor)
- JS trust model: users must trust the browser to run the correct client-side crypto code; the source is auditable at the GitHub link

We built this to address a gap we kept hitting.

Source: https://github.com/norcalcoop/torch-secret (ISC license)
Live: https://torchsecret.com
