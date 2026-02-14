# Pitfalls Research

**Domain:** Zero-knowledge, client-side encrypted, one-time secret sharing web application
**Researched:** 2026-02-13
**Confidence:** HIGH (multiple sources corroborate; real-world CVEs and documented bypass issues from PrivateBin, OneTimeSecret, and similar projects)

---

## Critical Pitfalls

### Pitfall 1: Self-Destruct Bypass via Ciphertext Interception

**What goes wrong:**
The one-time "burn after reading" mechanism is defeated by an intermediary (man-in-the-middle, link-preview bot, or malicious proxy) that fetches the ciphertext before the intended recipient, stores it offline, then forwards the original link. The recipient opens the link, JavaScript triggers deletion, and both parties believe the secret was delivered securely. Meanwhile the interceptor already has the ciphertext AND the key (from the URL fragment in the shared message) and can decrypt at leisure.

**Why it happens:**
If the server delivers the ciphertext in the initial page payload (embedded in HTML), any HTTP client (curl, wget, link-preview bots in Slack/Teams/Skype) can retrieve it without triggering the JavaScript-based deletion. The decryption key lives in the URL fragment, which was already shared in the same channel as the link. This is PrivateBin's documented Issue #174 -- the fundamental flaw in client-side-only self-destruct.

**How to avoid:**
1. Never embed ciphertext in the initial HTML response. The first request should serve only the application shell.
2. Require a separate, explicit API call (triggered by user action such as clicking "Reveal Secret") to fetch the ciphertext. Delete the secret server-side atomically as part of that same API call -- use a database transaction that SELECTs the row with `FOR UPDATE SKIP LOCKED` and DELETEs it in one operation, returning the ciphertext only if the delete succeeds.
3. This two-step approach means bots and curl fetch only the app shell (no ciphertext), and the actual retrieval-plus-deletion is atomic.
4. For password-protected secrets, require the password in the retrieval API call. Validate the password BEFORE returning ciphertext, but decrement the attempt counter regardless.

**Warning signs:**
- Ciphertext appears anywhere in the initial HTML or in a response that does not also delete the record
- The deletion is triggered by a client-side callback after data has already been sent
- Link previews in chat apps can trigger secret destruction (meaning bots are getting the ciphertext)

**Phase to address:**
Phase 1 (Core API). This is the single most important architectural decision. Getting the retrieval-deletion flow wrong means the security guarantee of "one-time" is theater. Must be designed correctly from the first API endpoint.

---

### Pitfall 2: XSS Destroys the Entire Zero-Knowledge Model

**What goes wrong:**
A single XSS vulnerability in a zero-knowledge encrypted application is catastrophic -- far worse than XSS in a conventional app. Because the decryption key arrives in the URL fragment and decryption happens in the browser, any injected JavaScript can read `window.location.hash`, intercept the plaintext after decryption, or exfiltrate both to an attacker-controlled server. XSS effectively gives the attacker the same access as the legitimate user, completely bypassing all encryption.

**Why it happens:**
Developers treat XSS as a "moderate" issue from generic web security training. In a zero-knowledge context, it is an existential threat. Common vectors in secret-sharing apps:
- Rendering user-supplied content (the decrypted secret) without sanitization
- Attachment filenames containing HTML/JS (PrivateBin CVE in versions 1.2.0-1.2.2, 1.3.0-1.3.2)
- Error messages that reflect user input
- Third-party scripts (analytics, error tracking) that have DOM access

**How to avoid:**
1. Implement a strict Content Security Policy with nonce-based script loading. No `unsafe-inline`, no `unsafe-eval`, no external script sources. Every script tag must carry a server-generated nonce.
2. Zero third-party JavaScript. No analytics, no tracking pixels, no CDN-hosted libraries in production. Bundle everything. If external resources are unavoidable, use Subresource Integrity (SRI) hashes.
3. Display decrypted secrets in a non-HTML context: use `textContent` (never `innerHTML`), render in a `<pre>` or `<textarea readonly>` element, or use CSS `white-space: pre-wrap` on a div populated via textContent.
4. Set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer` on every response.
5. Treat the decrypted plaintext as untrusted input even though it came from the user -- it could have been crafted by an attacker who created the secret link.

**Warning signs:**
- Any use of `innerHTML`, `document.write`, or React's `dangerouslySetInnerHTML` to render secret content
- CSP header is missing, in report-only mode in production, or includes `unsafe-inline`
- Third-party scripts loaded from external domains
- Error messages that include user-supplied data without encoding

**Phase to address:**
Phase 1 (Core Frontend + API). CSP headers and output encoding must be in place from the very first page render. Not something to "add later" -- retrofitting CSP onto an existing app is painful and error-prone.

---

### Pitfall 3: URL Fragment Key Leakage via Referrer, Extensions, and Crash Reporters

**What goes wrong:**
The encryption key in the URL fragment (`#key`) leaks through multiple browser-level side channels:
1. **Referrer header**: If the page contains any outbound links (even in decrypted content) or loads external resources, the `Referer` header may include the full URL with fragment on some browsers/configurations.
2. **Browser extensions**: Extensions have access to `window.location` including the hash. Password managers, ad blockers, Grammarly, and similar tools can read and transmit the fragment.
3. **Crash/error reporters**: Sentry, Bugsnag, and similar tools capture `window.location.href` by default, which includes the fragment. PrivateBin developers documented this exact issue with Sentry.
4. **Browser history**: The full URL including fragment is stored in browser history on the recipient's machine.
5. **AI browser assistants**: The "HashJack" attack vector (documented 2025) shows that AI-powered browser features can be manipulated via URL fragment content.

**Why it happens:**
Developers assume URL fragments are "never sent to the server" (true for the HTTP request itself) and therefore conclude they are private. But the fragment is fully accessible to client-side code, extensions, and browser features. The threat model is broader than just "the server."

**How to avoid:**
1. Set `Referrer-Policy: no-referrer` header on all responses (not just `same-origin` -- use `no-referrer`).
2. Strip the fragment from the URL immediately after reading it in JavaScript. Use `history.replaceState(null, '', window.location.pathname)` as the first operation in the app.
3. Store the extracted key only in a JavaScript closure or a non-exported module variable -- never in `localStorage`, `sessionStorage`, or a global variable.
4. Configure error/crash reporters to scrub URLs. For Sentry: use `beforeSend` to strip fragments. Better yet: do not use client-side error reporters in production for a security-focused app.
5. Do not load ANY external resources. No external fonts, no CDN scripts, no analytics pixels. Every outbound request is a potential fragment leak vector.
6. Add `rel="noopener noreferrer"` to any links that could appear in the UI (though the decrypted content should not render as HTML with clickable links).

**Warning signs:**
- `window.location.hash` is read but never cleared from the URL bar
- Any external resource loading (check Network tab in DevTools)
- Sentry/Bugsnag/LogRocket initialized without URL scrubbing
- CSP allows connections to external domains

**Phase to address:**
Phase 1 (Core Frontend). Fragment handling is the first thing the client-side code does. Must be correct from day one. The `history.replaceState` call and Referrer-Policy header should be in the initial implementation.

---

### Pitfall 4: Nonce Reuse in AES-256-GCM Catastrophically Breaks Encryption

**What goes wrong:**
AES-GCM requires a unique nonce (IV) for every encryption operation under the same key. If a nonce is ever reused with the same key, an attacker can recover the authentication key (GHASH key), forge authentication tags at will, and potentially recover plaintext via XOR of ciphertext streams. This is not a theoretical weakness -- it is a complete, practical break of both confidentiality and integrity.

**Why it happens:**
1. Using `Math.random()` instead of `crypto.getRandomValues()` for nonce generation (Math.random is not cryptographically secure and can produce collisions).
2. Using a 16-byte nonce with GCM when the spec requires 12 bytes (non-12-byte nonces trigger an internal hash that can degrade security properties).
3. Generating nonces randomly when the key is reused across multiple secrets (birthday bound: with random 96-bit nonces, collision probability exceeds 50% at around 2^48 encryptions under the same key).

For SecureShare, where each secret gets a unique random key, the nonce-reuse risk is low because each key encrypts exactly one message. But the implementation must still be correct.

**How to avoid:**
1. Use the Web Crypto API (`crypto.subtle.encrypt` with `AES-GCM`) which handles nonce generation correctly when given proper parameters.
2. Generate a 12-byte nonce using `crypto.getRandomValues(new Uint8Array(12))` for every encryption.
3. Since SecureShare generates a fresh key per secret, nonce reuse across different keys is not dangerous. But always generate a fresh nonce anyway as defense in depth.
4. Prepend the nonce to the ciphertext for transmission (it is not secret, just must be unique). The recipient reads the first 12 bytes as the nonce and the rest as ciphertext+tag.
5. Never use `Math.random()` anywhere in the cryptographic path.

**Warning signs:**
- `Math.random()` appears anywhere in encryption-related code
- Nonce/IV is hardcoded, derived from predictable data, or not generated fresh per encryption
- Nonce length is not exactly 12 bytes for GCM
- The Web Crypto API is not being used (custom AES implementation in JS)

**Phase to address:**
Phase 1 (Encryption Module). This is the foundational crypto. Must be implemented correctly before any secret can be created. Should use Web Crypto API exclusively -- no custom crypto libraries.

---

### Pitfall 5: Password-Protected Secrets with Race Condition in Attempt Counter

**What goes wrong:**
The 3-attempt auto-destroy for password-protected secrets has a race condition: multiple concurrent requests can each read the attempt count as (e.g.) 1, each increment it to 2, and each get a response -- effectively allowing 6+ attempts instead of 3. With enough parallel requests, an attacker can brute-force weak passwords before the auto-destroy triggers.

Additionally, if the password is checked AFTER decrementing the counter, a legitimate user who types the wrong password once may find the secret destroyed by a concurrent attacker. If checked BEFORE decrementing, the timing difference between "wrong password" and "right password" can leak information.

**Why it happens:**
The attempt counter update is not atomic with the password verification. Typical implementation:
1. Read current attempt count
2. Check password
3. Increment attempt count
4. If count >= 3, delete

Steps 1-4 are not in a single transaction, or the transaction isolation level is too low.

**How to avoid:**
1. Use a single atomic database operation: `UPDATE secrets SET attempts = attempts + 1 WHERE id = $1 AND attempts < 3 RETURNING *`. If no row is returned, the secret is already destroyed.
2. This approach increments FIRST, then returns the data for password checking. If the password is wrong, the attempt is consumed. If right, proceed with returning ciphertext.
3. After the RETURNING clause, if `attempts >= 3`, delete the record in the same transaction regardless of whether the password was correct.
4. Use `FOR UPDATE` row-level locking to prevent concurrent attempts from racing.
5. The password comparison must use `crypto.timingSafeEqual()` (Node.js built-in) to prevent timing attacks. Pad both buffers to equal length before comparing.
6. Apply server-side rate limiting (e.g., 1 request per 2 seconds per secret ID) as an additional layer on top of the atomic counter.

**Warning signs:**
- Attempt counter check and password check are separate database queries
- No `FOR UPDATE` or equivalent row locking in the retrieval query
- Password comparison uses `===` or `==` instead of constant-time comparison
- No rate limiting per secret ID endpoint

**Phase to address:**
Phase 2 (Password Protection feature). Must be implemented with atomic operations from the start. This is not a feature to add naively and then "fix the race condition later."

---

### Pitfall 6: Secret ID Enumeration Allowing Existence Discovery

**What goes wrong:**
If the API returns different responses for "secret exists but wrong password" vs. "secret does not exist" (e.g., 404 vs. 401), an attacker can enumerate which secret IDs are valid. Even with encrypted content they cannot read, knowing which IDs are active reveals metadata: how many secrets are in the system, when they were created (if IDs are sequential), and which ones are password-protected.

**Why it happens:**
Different HTTP status codes or response bodies for different error states. Sequential or predictable secret IDs. Timing differences between "ID not found" (fast DB miss) and "ID found, wrong password" (slow bcrypt comparison).

**How to avoid:**
1. Return identical responses (same status code, same response body structure, same headers) for "not found" and "wrong password" and "already destroyed." Use a generic 404 with body `{"error": "Secret not found or already destroyed"}` for all three cases.
2. Generate secret IDs using `crypto.randomBytes(32).toString('base64url')` -- 256 bits of entropy, yielding approximately 43 character URL-safe IDs that are computationally infeasible to enumerate.
3. Normalize response timing: when a secret is not found, still perform a dummy bcrypt comparison against a stored dummy hash to equalize response times with the "found but wrong password" path.
4. Apply aggressive rate limiting on the retrieval endpoint: token bucket per IP, max 10 requests per minute to `/api/secrets/:id`.

**Warning signs:**
- Secret IDs are sequential integers or short UUIDs
- Different HTTP status codes for "not found" vs. "wrong password"
- Response time differs noticeably between found/not-found paths
- No rate limiting on the retrieval endpoint

**Phase to address:**
Phase 1 (Core API). Secret ID generation and response normalization must be designed into the initial API. Changing ID format after launch breaks all existing links.

---

### Pitfall 7: Incomplete Deletion -- PostgreSQL Data Remanence

**What goes wrong:**
Deleting a row in PostgreSQL does not erase the data from disk. PostgreSQL's MVCC model marks deleted rows as "dead tuples" that persist until VACUUM reclaims the space -- and even then, the data may remain on disk until overwritten. WAL (Write-Ahead Log) files contain a full record of all changes including the original INSERT of the ciphertext. Database backups, replicas, and filesystem snapshots also retain copies.

For a secret-sharing app, this means "deleted" secrets may be recoverable through:
- Dead tuples before VACUUM
- WAL segments before archival/rotation
- pg_dump backups
- Filesystem-level forensics
- Cloud provider snapshots

**Why it happens:**
PostgreSQL is designed for data durability, not data destruction. The entire storage engine works against secure deletion. Developers assume `DELETE FROM secrets WHERE id = X` means the data is gone.

**How to avoid:**
1. Accept that you cannot guarantee cryptographic erasure in PostgreSQL. Design the threat model accordingly: the ciphertext on the server is always encrypted with a key the server never sees. Even if ciphertext is recovered forensically, it is useless without the key from the URL fragment.
2. Overwrite before deleting: `UPDATE secrets SET ciphertext = repeat('0', length(ciphertext)) WHERE id = $1` followed by `DELETE`. This overwrites the ciphertext in place, and while MVCC still keeps the old tuple temporarily, aggressive VACUUM will clean it.
3. Run `VACUUM` aggressively on the secrets table (consider `autovacuum_vacuum_scale_factor = 0` with a low `autovacuum_vacuum_threshold` for this table specifically).
4. Configure WAL retention to be as short as operationally feasible.
5. Do NOT store the encryption key or any key-derived material server-side. The server should only ever hold ciphertext + nonce + salt (for password-derived keys).
6. Consider using Redis with `volatile-ttl` eviction as the primary store for short-lived secrets, with PostgreSQL only for metadata/audit. Redis `DEL` followed by key eviction is more favorable for secure deletion than PostgreSQL (though still not guaranteed at the OS level).
7. Pad all ciphertext to fixed block sizes before storage so the stored length does not reveal the plaintext length.

**Warning signs:**
- No `UPDATE ... SET ciphertext = zeros` before `DELETE`
- Default autovacuum settings on the secrets table
- WAL archiving enabled with long retention
- Database backups include the secrets table
- Ciphertext stored at its natural length (leaks approximate plaintext size)

**Phase to address:**
Phase 1 (Database Layer). The storage approach for ciphertext must be designed with remanence in mind from the initial schema. The overwrite-then-delete pattern and padding strategy should be in the first database migration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `innerHTML` to render decrypted secrets | Quick implementation of formatting | XSS attack surface that defeats entire encryption model | Never -- use `textContent` always |
| Storing secrets in PostgreSQL without Redis | Simpler architecture, one fewer service | Harder secure deletion, no native TTL, higher latency on expiration checks | MVP only, migrate to Redis-backed approach in Phase 2 |
| Skip ciphertext padding | Simpler encryption code | Secret length leaked via ciphertext size (attacker can estimate password length, API key length, etc.) | Never for a security-focused product |
| CSP in report-only mode | Easier development, fewer broken features | No actual XSS protection | Development only, enforce in staging and production |
| Using `express-rate-limit` with in-memory store | Quick setup, no Redis dependency | Rate limits reset on server restart, not shared across instances | Single-instance MVP only |
| Lazy VACUUM configuration | Default PostgreSQL behavior, no tuning needed | Dead tuples with ciphertext linger on disk for extended periods | Never for the secrets table |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Redis TTL for secret expiration | Relying solely on Redis TTL for guaranteed deletion (keys can persist up to 25% longer than TTL due to Redis's sampling-based expiration) | Use Redis TTL as the primary mechanism but also run a background job (e.g., every 60 seconds) to explicitly DELETE expired secrets. Belt and suspenders. |
| PostgreSQL + Redis dual-store | Storing ciphertext in both PostgreSQL and Redis, creating two copies to clean up | Store ciphertext in Redis only (with TTL). Store metadata (creation time, expiry, attempt count, password hash) in PostgreSQL. Deletion requires clearing only Redis. |
| Sentry / Error Tracking | Default configuration captures full URL including `#fragment` containing the encryption key | Either do not use client-side error tracking, or configure `beforeSend` to strip everything after `#` from all URLs in events, breadcrumbs, and stack traces |
| Reverse Proxy (nginx) | Access logs capturing full request URLs | Fragments are not sent to the server (this is safe), but ensure no middleware logs request bodies or response bodies that contain ciphertext |
| Docker / Cloud Deployment | Container logs capturing application output including ciphertext | Never log ciphertext or key material. Audit all logging calls. Use structured logging with explicit field allowlists. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| bcrypt password verification on every secret retrieval | High CPU usage, slow responses under load, request queuing | Only run bcrypt for password-protected secrets (obvious but ensure non-password secrets skip this path entirely). Use bcrypt cost factor 10-12 (not higher for a web endpoint). | Around 50 concurrent password-protected retrievals per CPU core |
| Synchronous background expiration job scanning full table | Database table locks, slow queries during cleanup, API latency spikes | Use an index on `expires_at`, query only `WHERE expires_at < NOW()` with `LIMIT` batching. Run in a separate process/worker, not in the API event loop. | Around 100K active secrets |
| No connection pooling for PostgreSQL | Connection exhaustion, "too many connections" errors, process spawning overhead | Use `pg-pool` or PgBouncer. Set pool size to 2-3x CPU cores. | Around 200 concurrent requests |
| Generating secret IDs with UUID v4 (hex encoding) | 36-character URLs, B-tree index fragmentation in PostgreSQL | Use `crypto.randomBytes(32).toString('base64url')` for shorter, denser IDs. Use a BYTEA column with B-tree index, or store as TEXT. | Cosmetic at any scale, but index fragmentation at 1M+ rows |
| Single Redis instance without persistence for ciphertext | Secrets lost on Redis restart or OOM eviction | Configure Redis with AOF persistence (`appendonly yes`), set `maxmemory-policy` to `noeviction` (fail writes rather than evict secrets). Monitor memory. | Any unexpected Redis restart |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `Math.random()` for any security-relevant value (IDs, nonces, keys) | Predictable output enables brute-force of secret IDs and nonce reuse attacks | Use `crypto.getRandomValues()` (browser) and `crypto.randomBytes()` (Node.js) exclusively |
| Serving the application over HTTP (even in development) | MITM can inject scripts into the page, steal fragments, modify encryption code | HTTPS everywhere. Use HSTS header. Redirect HTTP to HTTPS. Use `Secure` flag on all cookies. |
| Embedding ciphertext in server-rendered HTML | Bots, curl, and link previews fetch ciphertext without triggering deletion | Serve app shell only on initial load. Ciphertext delivered via separate authenticated API call. |
| Allowing `unsafe-inline` in CSP for convenience | Attacker-injected inline scripts execute with full page access including fragment key | Nonce-based CSP. Generate random nonce per request. Only script tags with matching nonce execute. |
| Password comparison with `===` operator | Timing attack leaks password correctness character-by-character | Use `crypto.timingSafeEqual()` with buffers padded to equal length |
| Not setting `Referrer-Policy: no-referrer` | Clicking any link on the page (or in decrypted content rendered as HTML) sends the full URL including `#key` to the linked site | Set header on every response. Also set `<meta name="referrer" content="no-referrer">` as backup. |
| CORS wildcard `Access-Control-Allow-Origin: *` | Any website can make API calls to your secret endpoints | Allow only your exact origin. Never use `*`. Do not reflect the `Origin` header blindly. |
| Loading scripts from CDN without SRI | CDN compromise (like polyfill.io incident) injects malicious code that steals decryption keys | Bundle all JavaScript locally. If CDN is used, require `integrity` attribute with SHA-384/512 hash. |
| Different error responses for "not found" vs. "wrong password" | Secret existence enumeration | Return identical 404 response for all retrieval failures |
| OPTIONS preflight responses that differ based on secret existence | CORS preflight can probe which secret IDs are active | Return same CORS headers for all paths, including nonexistent ones |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No distinction between "secret was already viewed" and "secret never existed" | Recipient cannot tell if they were the one who viewed it or if the link was wrong | Show "This secret has already been viewed or does not exist" (ambiguous by design for security, but include a "This is expected if you already viewed it" help text) |
| Secret destroyed by link-preview bots in Slack/Teams before recipient sees it | Recipient gets "secret not found" and is confused; sender has no idea what happened | Two-step retrieval (serve app shell first, require explicit user action to fetch ciphertext). Bots do not execute JavaScript or click buttons. |
| No feedback after creating a secret (is the link copied? did it work?) | User unsure if secret was saved, may re-create or navigate away without copying | Show clear confirmation with auto-copy-to-clipboard, visual feedback ("Link copied!"), and a "Copy" button as fallback. Show the link text so user can manually copy. |
| Password-protected secret deleted after 3 wrong attempts with no warning to sender | Sender shares link, recipient typos password 3 times, secret is gone forever | Show attempt counter ("2 of 3 attempts remaining") to the person entering the password. Consider allowing sender to see "secret was destroyed due to failed attempts" status. |
| Link contains visible encryption key making it look suspicious | Non-technical users see a long, complex URL and think it is spam or phishing | Keep the key in the fragment (not visible in most sharing contexts), make the main URL clean and short. Add a branded landing page that explains what the user is about to see. |
| No indication of expiry time to the recipient | Recipient opens link hours later and finds it expired, with no idea when it expired or why | Show "This secret expires in X hours" on the reveal page (before clicking "Reveal"). On expired page, show "This secret expired. Ask the sender for a new link." |
| Mobile browser handling of long URLs with fragments | URL may be truncated by SMS or certain apps, breaking the decryption key | Test on all major platforms. Provide a "short link" option (redirect through your own domain, preserving fragment). Warn sender about link-sharing limitations. |

## "Looks Done But Isn't" Checklist

- [ ] **Encryption:** Implemented AES-256-GCM but nonce is not prepended to ciphertext -- recipient cannot decrypt without knowing which nonce was used
- [ ] **One-time retrieval:** Secret is "deleted" after viewing but ciphertext exists in PostgreSQL dead tuples, WAL logs, and any backups
- [ ] **CSP headers:** CSP header is set but includes `unsafe-inline` or `unsafe-eval`, negating XSS protection
- [ ] **Rate limiting:** Rate limiter is per-IP but does not limit per-secret-ID, allowing distributed brute-force of password-protected secrets
- [ ] **Secret expiration:** Redis TTL handles expiry but no background job catches secrets that survive TTL (Redis sampling misses up to 25%)
- [ ] **Password protection:** bcrypt comparison works but is not constant-time at the application level (early return on wrong-length input before bcrypt runs)
- [ ] **URL fragment cleanup:** Fragment is read on page load but not removed from the browser URL bar via `history.replaceState`
- [ ] **Error handling:** Different HTTP status codes returned for "not found" vs "expired" vs "wrong password" enabling enumeration
- [ ] **Referrer policy:** Header is set to `same-origin` instead of `no-referrer` -- fragment still leaks to same-origin pages
- [ ] **CORS:** `Access-Control-Allow-Origin` reflects the request Origin header (wildcard by reflection), allowing any site to probe the API
- [ ] **Ciphertext padding:** Secrets of different lengths produce different-length ciphertexts, leaking approximate content length

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| XSS vulnerability discovered in production | HIGH | Rotate all active secrets (impossible -- you cannot contact anonymous users). Deploy fix immediately. Invalidate and delete all existing secrets as a precaution. Publish security advisory. Add CSP + output encoding + automated XSS scanning. |
| Nonce reuse in encryption | HIGH | Cannot retroactively fix already-encrypted secrets. Fix the code, audit all encryption paths. Fortunately, if each secret has a unique key (as designed), nonce reuse under different keys is not catastrophic. |
| Secret ID format change needed | HIGH | Cannot change IDs for existing links (they would break). Must support both old and new formats forever, or accept that old links break. Design the ID format correctly from day one. |
| Referrer header leaked encryption keys | MEDIUM | Deploy `no-referrer` policy immediately. Cannot recall leaked keys. Affected secrets are compromised if a third party logged the referrer. |
| Race condition in password attempt counter | MEDIUM | Fix with atomic DB operations. Existing password-protected secrets may have been brute-forced. Cannot determine which ones. Notify users if possible. |
| PostgreSQL data remanence after deletion | LOW-MEDIUM | Run VACUUM FULL on secrets table (requires table lock, brief downtime). Overwrite free space at OS level. For cloud-hosted DB, this may not be feasible. Accept residual risk. |
| Bot-triggered secret destruction | LOW | Implement two-step retrieval. Cannot recover already-destroyed secrets, but the bot never had the key (fragments are not sent to servers), so confidentiality was maintained -- only availability was impacted. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Self-destruct bypass (ciphertext interception) | Phase 1: Core API | Verify: `curl` the secret URL and confirm NO ciphertext in response. Only the API reveal endpoint returns ciphertext, and it atomically deletes. |
| XSS destroys zero-knowledge model | Phase 1: Core Frontend | Verify: Run automated XSS scanner. Confirm CSP header blocks inline scripts. Manually test that decrypted content renders as text, not HTML. |
| URL fragment key leakage | Phase 1: Core Frontend | Verify: After page load, check browser URL bar shows no fragment. Check Network tab for zero external requests. Confirm `Referrer-Policy: no-referrer` in response headers. |
| AES-GCM nonce misuse | Phase 1: Encryption Module | Verify: Unit test that each encryption produces a unique 12-byte nonce. Verify `crypto.subtle` is used, not a JS polyfill. Confirm nonce is prepended to ciphertext. |
| Password attempt counter race condition | Phase 2: Password Protection | Verify: Fire 10 concurrent password attempts. Confirm exactly 3 are allowed total (not 10). Check DB shows atomic increment. |
| Secret ID enumeration | Phase 1: Core API | Verify: Hit `/api/secrets/nonexistent` and `/api/secrets/real-but-wrong-password` -- confirm identical response code, body, and timing (within 50ms). |
| PostgreSQL data remanence | Phase 1: Database Layer | Verify: Create and delete a secret. Run `SELECT * FROM pg_stat_user_tables WHERE relname = 'secrets'` and confirm dead tuples are vacuumed promptly. Confirm ciphertext is overwritten before deletion. |
| Ciphertext padding / length leakage | Phase 1: Encryption Module | Verify: Encrypt secrets of length 1, 50, and 500 characters. Confirm stored ciphertext lengths are identical (padded to same block size). |
| Bot-triggered destruction (link previews) | Phase 1: Core API | Verify: Fetch the secret page URL with curl (simulating a bot). Confirm the response contains no ciphertext. Secret is still retrievable via the reveal API. |
| Referrer header leaks | Phase 1: Security Headers | Verify: Check all response headers include `Referrer-Policy: no-referrer`. Click an external link from the page and confirm no referrer is sent (check with request inspector). |

## Sources

- [PrivateBin Issue #174: Self-destroying mechanism can be circumvented](https://github.com/PrivateBin/PrivateBin/issues/174) -- HIGH confidence, primary source for self-destruct bypass
- [PrivateBin Issue #374: Burn after reading + password combination bug](https://github.com/PrivateBin/PrivateBin/issues/374) -- HIGH confidence, documents password + self-destruct interaction flaw
- [PrivateBin CVE-2024-39899: Authentication bypass](https://security.snyk.io/vuln/SNYK-PHP-PRIVATEBINPRIVATEBIN-7438560) -- HIGH confidence, NVD-listed CVE
- [MDN: Web Crypto API SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) -- HIGH confidence, official documentation
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) -- HIGH confidence, official documentation
- [MDN: Referrer-Policy header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) -- HIGH confidence, official documentation
- [MDN: Referrer header privacy and security concerns](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Referer_header:_privacy_and_security_concerns) -- HIGH confidence, official documentation
- [OWASP: Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) -- HIGH confidence, industry standard
- [OWASP: Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) -- HIGH confidence, industry standard
- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) -- HIGH confidence, industry standard
- [Romain Clement: Scrubbing URL fragments from Sentry crash reports](https://romain-clement.net/articles/sentry-url-fragments/) -- MEDIUM confidence, practitioner report on real-world fragment leak
- [Neil Madden: Can you safely include credentials in a URL?](https://neilmadden.blog/2019/01/16/can-you-ever-safely-include-credentials-in-a-url/) -- MEDIUM confidence, security researcher analysis
- [Snyk: Timing attack in Node.js](https://snyk.io/blog/node-js-timing-attack-ccc-ctf/) -- MEDIUM confidence, documented Node.js timing attack
- [Simon Willison: Constant-time comparison in Node.js](https://til.simonwillison.net/node/constant-time-compare-strings) -- MEDIUM confidence, practical implementation guide
- [Andrew Lock: Avoiding CDN supply-chain attacks with SRI](https://andrewlock.net/avoiding-cdn-supply-chain-attacks-with-subresource-integrity/) -- MEDIUM confidence, SRI best practices
- [CSO Online: AI browsers tricked via URL fragments (HashJack)](https://www.csoonline.com/article/4097087/ai-browsers-can-be-tricked-with-malicious-prompts-hidden-in-url-fragments.html) -- MEDIUM confidence, emerging threat vector
- [SecLab BU: Referrer leakage in collaboration services (academic paper)](https://seclab.bu.edu/papers/referrers-dimva2019.pdf) -- HIGH confidence, academic paper with empirical findings
- [PostgreSQL Docs: VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.html) -- HIGH confidence, official documentation
- [PostgreSQL Docs: Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) -- HIGH confidence, official documentation
- [Redis Docs: Key Expiration (EXPIRE command)](https://redis.io/docs/latest/commands/expire/) -- HIGH confidence, official documentation
- [Redis Docs: Key Eviction](https://redis.io/docs/latest/develop/reference/eviction/) -- HIGH confidence, official documentation
- [Redis Docs: Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/) -- HIGH confidence, official documentation
- [Seald: Common encryption implementation mistakes](https://www.seald.io/blog/3-common-mistakes-when-implementing-encryption) -- MEDIUM confidence, encryption vendor blog
- [Uniqkey: Is One-Time Secret safe?](https://blog.uniqkey.eu/one-time-secret/) -- MEDIUM confidence, security analysis
- [Google Cloud: Deep dive into PostgreSQL VACUUM](https://cloud.google.com/blog/products/databases/deep-dive-into-postgresql-vacuum-garbage-collector) -- HIGH confidence, authoritative technical analysis
- [web.dev: Strict CSP to mitigate XSS](https://web.dev/articles/strict-csp) -- HIGH confidence, Google security team guidance
- [Liran Tal: Poor Express Authentication Patterns](https://lirantal.com/blog/poor-express-authentication-patterns-nodejs) -- MEDIUM confidence, Node.js security practitioner

---
*Pitfalls research for: SecureShare -- Zero-knowledge secret sharing web application*
*Researched: 2026-02-13*
