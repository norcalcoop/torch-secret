# Project Research Summary

**Project:** SecureShare
**Domain:** Zero-knowledge, client-side encrypted, one-time secret sharing web application
**Researched:** 2026-02-13
**Confidence:** HIGH

## Executive Summary

SecureShare is a zero-knowledge secret sharing tool -- a well-understood product category with established open-source implementations (PrivateBin, Yopass, Luzifer OTS) and commercial competitors (OneTimeSecret, Password Pusher). The core architectural pattern is proven: encrypt in the browser using AES-256-GCM via the Web Crypto API, embed the encryption key in the URL fragment (which is never sent to the server per HTTP spec), and store only the encrypted blob server-side. The recommended stack is Node.js 24 / Express 5 / PostgreSQL 17+ / Redis 7 with a vanilla TypeScript frontend bundled by Vite -- no React, no framework overhead. This stack is deliberately minimal because the product's complexity lives in the cryptographic flow and security hardening, not in the UI.

The primary competitive opportunity is combining genuine zero-knowledge security with consumer-grade UX. Most zero-knowledge tools (PrivateBin, Yopass) have developer-oriented, utilitarian interfaces. Most polished tools (Password Pusher, OneTimeSecret) use server-side encryption. SecureShare targets the gap between these tiers. The MVP feature set is clearly scoped: client-side encryption, one-time viewing, configurable expiration, optional password protection, copy-to-clipboard, link preview protection (retrieval step), and trust-building content. Dark mode, QR codes, burn confirmation status, and creation animations are post-launch polish.

The dominant risks are cryptographic and security-related, not architectural. The top three threats are: (1) XSS vulnerabilities that steal decryption keys from the URL fragment, which would collapse the entire zero-knowledge guarantee; (2) self-destruct bypass where link-preview bots or intermediaries fetch ciphertext before the recipient, defeating the one-time guarantee; and (3) URL fragment key leakage through referrer headers, browser extensions, and error-reporting tools. All three are well-documented with concrete prevention strategies: strict Content Security Policy with nonce-based scripts, a two-step retrieval flow (app shell first, explicit API call to reveal), and immediate fragment stripping via `history.replaceState`. These mitigations must be built into Phase 1 -- they cannot be retrofitted.

## Key Findings

### Recommended Stack

The stack prioritizes security, minimalism, and performance. No frontend framework -- vanilla TypeScript with Vite produces near-zero framework overhead, meeting the PRD's sub-1-second 3G load requirement. Express 5 (now the npm default since March 2025) handles the 3-4 REST endpoints with the largest middleware ecosystem. Drizzle ORM provides SQL-level visibility critical for auditing database queries in a security-focused app. All encryption uses the browser-native Web Crypto API -- zero dependencies, hardware-accelerated, and audited.

**Core technologies:**
- **Node.js 24 LTS + Express 5:** Server runtime and HTTP framework -- mature ecosystem, simple for a small REST API, Express 5 is now stable
- **TypeScript 5.9:** Type safety across client and server -- catches encryption parameter bugs (IV lengths, key sizes, buffer types) at compile time
- **PostgreSQL 17+:** Secret persistence with ACID transactions -- `DELETE ... RETURNING` enables atomic read-and-destroy
- **Redis 7:** Rate limiting counters that survive restarts and work across instances
- **Vite 7 + Tailwind CSS 4:** Frontend build and styling -- sub-second HMR, tiny CSS bundles, zero framework overhead
- **Web Crypto API (built-in):** AES-256-GCM encryption -- browser-native, no dependencies, hardware-accelerated
- **Drizzle ORM:** SQL-centric query builder with full TypeScript inference -- you see exactly what SQL hits the database
- **nanoid:** 21-character URL-safe IDs with ~126 bits of entropy, cryptographically secure

### Expected Features

**Must have (table stakes):**
- Client-side AES-256-GCM encryption with key in URL fragment (zero-knowledge foundation)
- One-time viewing with atomic database delete (the defining behavior)
- Configurable expiration (1h, 24h, 7d)
- Optional password protection with 3-attempt auto-destroy
- Link preview protection via two-step retrieval (critical for chat-app sharing)
- Copy-to-clipboard for share link and revealed secret
- Confirmation page after creation with prominent share link
- Clear error/status states (already viewed, expired, wrong password, rate limited)
- Mobile-responsive layout
- Rate limiting (10 creations per IP per hour)
- HTTPS enforcement with HSTS
- Background expiration cleanup job
- "How it works" trust explainer section

**Should have (competitive advantage):**
- Zero-knowledge + polished consumer UX (the positioning differentiator)
- Dark mode (developers expect it, most competitors lack it)
- Burn confirmation status page (sender checks if secret was viewed, no accounts needed)
- Secret creation animation ("Encrypting in your browser...")
- QR code for share link
- Accessibility (WCAG 2.1 AA) -- design for it from day one, formally audit later
- Branded marketing footer on reveal page (viral growth loop)

**Defer (v2+):**
- File upload support (scope trap, requires chunked uploads and different encryption handling)
- Public API for programmatic access (adds auth complexity and abuse surface)
- Slack/Teams bot integration (significant ongoing maintenance)
- User accounts (destroys the zero-friction differentiator)
- Self-hosting / open-source distribution (maintenance burden)
- Internationalization (English-only audience for MVP)

### Architecture Approach

The architecture follows a strict two-boundary trust model: the browser is the trusted encryption/decryption environment, and the server is untrusted encrypted-blob storage. All encryption happens client-side via Web Crypto API. The URL fragment carries the decryption key and is never transmitted to the server. The server exposes 4 REST endpoints (create, retrieve, check metadata, verify password) and handles rate limiting, password verification (bcrypt), and expiration cleanup. PostgreSQL stores encrypted blobs with metadata; Redis stores rate-limit counters. A background cron job (node-cron) cleans up expired secrets every 5 minutes.

**Major components:**
1. **Crypto Module (browser)** -- Key generation, AES-256-GCM encrypt/decrypt, base64url encoding; isolated and unit-testable with zero dependencies
2. **API Server (Express 5)** -- REST endpoints for secret CRUD, password verification gate, rate limiting middleware, security headers (CSP, HSTS, CORS)
3. **Database Layer (PostgreSQL + Drizzle)** -- Single `secrets` table, atomic `DELETE ... RETURNING` for read-and-destroy, aggressive VACUUM for data remanence mitigation
4. **Frontend UI (Vanilla TS + Vite)** -- Create form, retrieval/reveal page, confirmation page, error states; minimal DOM manipulation with `textContent` only (never `innerHTML`)
5. **Background Worker (node-cron)** -- Periodic `DELETE FROM secrets WHERE expires_at < NOW()` with batch limits
6. **Redis** -- Rate-limit counters only; sliding window per IP with Lua scripts for atomicity

### Critical Pitfalls

1. **Self-destruct bypass via link-preview bots** -- Never embed ciphertext in the initial HTML response. Require an explicit user-initiated API call to fetch and atomically delete the ciphertext. Bots fetch only the app shell.
2. **XSS destroys the entire zero-knowledge model** -- A single XSS vulnerability lets injected scripts read the URL fragment key and exfiltrate plaintext. Enforce strict nonce-based CSP from day one. Use `textContent` exclusively for rendering secrets. Zero third-party scripts.
3. **URL fragment key leakage** -- The key leaks through referrer headers, browser extensions, crash reporters, and browser history. Set `Referrer-Policy: no-referrer`, strip the fragment via `history.replaceState` immediately after reading, never use external error-tracking tools, and load zero external resources.
4. **Race condition in password attempt counter** -- Concurrent requests can bypass the 3-attempt limit. Use atomic `UPDATE ... SET attempts = attempts + 1 WHERE id = $1 AND attempts < 3 RETURNING *` with `FOR UPDATE` row locking.
5. **PostgreSQL data remanence** -- `DELETE` does not erase data from disk (dead tuples, WAL logs, backups). Overwrite ciphertext with zeros before deleting. Run aggressive autovacuum on the secrets table. Pad ciphertext to fixed block sizes to prevent length leakage. Accept that the server never has the decryption key anyway -- this is defense in depth.

## Implications for Roadmap

Based on research, the build order is dictated by hard technical dependencies and security requirements. The crypto module has zero dependencies and is the foundation. The database layer depends only on PostgreSQL. The API depends on the database layer. The frontend depends on both the crypto module and API. Security hardening must happen before any real users touch the system. Password protection layers on top of the core flow.

### Phase 1: Encryption Foundation
**Rationale:** The crypto module is the core value proposition, has zero dependencies, and is the most security-critical code. It must be built and tested in isolation before anything else. Getting encryption wrong invalidates the entire product.
**Delivers:** `encrypt()`, `decrypt()`, `generateKey()`, `encodeKey()`, `decodeKey()` functions using Web Crypto API; comprehensive unit tests including nonce uniqueness, correct IV length (12 bytes), `crypto.getRandomValues` usage (not `Math.random`), ciphertext padding to fixed block sizes.
**Addresses:** Client-side AES-256-GCM encryption (P1 feature)
**Avoids:** Nonce reuse (Pitfall 4), ciphertext length leakage (Pitfall 7)

### Phase 2: Database and API Core
**Rationale:** The server is thin -- 4 endpoints wrapping database operations. The critical operation is atomic read-and-delete (`DELETE ... RETURNING`). Database schema design (padding, overwrite-before-delete, vacuum config) must be correct from the first migration because changing ID formats or storage patterns after launch breaks existing links.
**Delivers:** PostgreSQL schema with Drizzle ORM, `POST /api/secrets` (create), `GET /api/secrets/:id` (retrieve + atomic delete), secret ID generation with nanoid, input validation with Zod, ciphertext overwrite-before-delete, aggressive autovacuum configuration.
**Addresses:** One-time viewing, configurable expiration, secret storage
**Avoids:** Self-destruct bypass (Pitfall 1 -- ciphertext never in HTML), non-atomic read-and-delete (Architecture Anti-Pattern 3), secret ID enumeration (Pitfall 6 -- high-entropy IDs, identical error responses), PostgreSQL data remanence (Pitfall 7)

### Phase 3: Security Hardening
**Rationale:** CSP headers, rate limiting, CORS, and security headers must be in place before the frontend goes live. In a zero-knowledge app, XSS is existential -- not "moderate." This phase is small but non-negotiable and must complete before any user-facing deployment.
**Delivers:** Strict nonce-based CSP (no `unsafe-inline`, no `unsafe-eval`), Helmet.js integration, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, Redis-backed rate limiting (express-rate-limit + rate-limit-redis), strict same-origin CORS, HTTPS/HSTS enforcement.
**Addresses:** Rate limiting (P1), HTTPS enforcement (P1)
**Avoids:** XSS destroying zero-knowledge model (Pitfall 2), URL fragment leakage via referrer (Pitfall 3), CORS misconfiguration

### Phase 4: Frontend -- Create and Reveal Flow
**Rationale:** With crypto module, API, and security headers in place, the frontend can integrate everything into the user-facing flow. This is where the two-step retrieval pattern (app shell first, explicit reveal action) is implemented, which prevents link-preview bots from consuming secrets.
**Delivers:** Secret creation form (textarea, expiration selector, optional passphrase), confirmation page with share link and copy button, two-step secret reveal page (interstitial "Click to reveal" then API call), fragment stripping via `history.replaceState`, error state pages (already viewed, expired, invalid link, rate limited), mobile-responsive layout with Tailwind CSS, copy-to-clipboard for link and secret.
**Addresses:** Secret creation form, confirmation page, copy-to-clipboard, link preview protection, clear error states, mobile-responsive design (all P1)
**Avoids:** Self-destruct bypass by bots (Pitfall 1), fragment key leakage (Pitfall 3 -- strip fragment immediately), rendering secrets as HTML (Pitfall 2 -- use `textContent` only)

### Phase 5: Password Protection
**Rationale:** Password protection layers on top of the working create/retrieve flow. It requires additional API endpoints (`GET /meta`, `POST /verify`), bcrypt verification, and the atomic attempt counter. Building it separately from the core flow keeps complexity manageable and ensures the base flow is solid first.
**Delivers:** Password field on creation form, `GET /api/secrets/:id/meta` endpoint, `POST /api/secrets/:id/verify` endpoint with bcrypt comparison, atomic attempt counter with `FOR UPDATE` row locking, 3-attempt auto-destroy, password prompt UI with "attempts remaining" feedback, constant-time password comparison (`crypto.timingSafeEqual`), dummy bcrypt on not-found paths for timing normalization.
**Addresses:** Optional password protection with 3-attempt auto-destroy (P1)
**Avoids:** Attempt counter race condition (Pitfall 5), timing attacks on password comparison, enumeration via different error responses (Pitfall 6)

### Phase 6: Background Worker and Expiration
**Rationale:** During development, secrets have long TTLs and manual cleanup is fine. The background worker is important for production but has no user-facing impact and no dependencies on the frontend. It can be built after the core user flow is complete.
**Delivers:** node-cron job running every 5 minutes, `DELETE FROM secrets WHERE expires_at < NOW()` with batch limits, structured logging of counts only (never IDs or data), overwrite-before-delete in cleanup path.
**Addresses:** Background expiration cleanup (P1)
**Avoids:** Table lock during cleanup (use batched deletes with LIMIT), logging sensitive data

### Phase 7: Trust and Polish
**Rationale:** The "How it works" trust section, accessibility audit, and UX polish come after the core product works. These are important for conversion but do not affect the security model. Dark mode should be layered on while the initial UI is stable.
**Delivers:** "How it works" trust explainer (plain language, diagrams, no jargon), dark mode (Tailwind `prefers-color-scheme` + toggle), secret creation animation ("Encrypting in your browser..."), burn confirmation status page (sender checks if viewed), QR code on confirmation page, branded marketing footer on reveal page, WCAG 2.1 AA accessibility audit and remediation.
**Addresses:** "How it works" trust section (P1), dark mode (P2), burn confirmation (P2), QR code (P2), creation animation (P2), accessibility audit (P2), branded footer (P2)

### Phase Ordering Rationale

- **Crypto first** because it has zero dependencies, is the foundation for everything else, and is the hardest code to get right. Errors here are unrecoverable.
- **Database + API before frontend** because the frontend needs working endpoints to test against, and the atomic read-and-delete pattern must be proven at the database level before the UI relies on it.
- **Security hardening before frontend deployment** because CSP must be in place before any page renders -- retrofitting CSP is painful and error-prone, and a single XSS before CSP is deployed could compromise every secret.
- **Password protection after core flow** because it is an additive feature that layers cleanly on top of the existing create/retrieve endpoints. Building it alongside the core flow would complicate both.
- **Background worker late** because expiration is not time-critical during development and the worker has no user-facing impact.
- **Polish last** because trust content, dark mode, and animations do not affect security or core functionality but do benefit from a stable UI to build on.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Encryption Foundation):** Needs careful implementation review -- ciphertext padding strategy, base64url encoding details, and whether to prepend IV to ciphertext or transmit separately. Reference PrivateBin's encryption format documentation.
- **Phase 5 (Password Protection):** The interaction between bcrypt verification, atomic attempt counters, and timing normalization is subtle. Reference PrivateBin Issue #374 for known edge cases in password + burn-after-read combinations.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Database + API Core):** Well-documented Express + Drizzle + PostgreSQL patterns. Atomic `DELETE ... RETURNING` is standard PostgreSQL.
- **Phase 3 (Security Hardening):** Helmet.js, express-rate-limit, and CSP configuration are thoroughly documented.
- **Phase 4 (Frontend):** Vanilla TS with Vite is straightforward. The two-step retrieval pattern is proven by Password Pusher and documented in Pitfall 1.
- **Phase 6 (Background Worker):** node-cron with a simple DELETE query is trivial.
- **Phase 7 (Trust and Polish):** Standard web development. Tailwind dark mode, accessibility auditing, and copy-to-clipboard are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are mature, widely adopted, and version-stable. Express 5 is the one newer choice but has been stable since March 2025. Drizzle ORM is pre-1.0 (0.45.x) but approaching v1 beta with a large active user base. |
| Features | HIGH | Based on analysis of 10+ competitors with official documentation. Table stakes are unambiguous. Differentiator positioning (zero-knowledge + polished UX) is a genuine gap validated by competitor analysis. |
| Architecture | HIGH | The fragment-based key distribution pattern is proven by PrivateBin, Yopass, Luzifer OTS, and zeitkapsl. Atomic read-and-delete with `DELETE ... RETURNING` is standard PostgreSQL. Multiple open-source reference implementations validate the overall approach. |
| Pitfalls | HIGH | Sourced from real CVEs (PrivateBin CVE-2024-39899), documented GitHub issues (PrivateBin #174, #374), OWASP cheat sheets, and MDN documentation. These are not theoretical risks -- they are observed failures in production systems. |

**Overall confidence:** HIGH

### Gaps to Address

- **Ciphertext padding strategy:** Research identifies the need to pad ciphertext to fixed block sizes to prevent length leakage, but does not specify the exact padding scheme (PKCS7-style, fixed power-of-2 sizes, or constant padding to max secret size of 10,000 chars). Decide during Phase 1 implementation.
- **Password hashing location:** Research notes a design choice between client-side and server-side bcrypt/Argon2 hashing. Recommendation is server-side (simpler, standard), but the STACK.md recommends Argon2 while ARCHITECTURE.md references bcrypt throughout. Decide on one: Argon2id (recommended by STACK.md as PHC winner) or bcrypt (simpler, no native compilation issues). Resolve during Phase 5 planning.
- **Deployment target:** Stack research covers VPS, serverless, and multi-server variants. The roadmap should target single VPS deployment (Railway/Render) for MVP, which keeps the architecture simplest. Serverless would require replacing Express, node-cron, and the Redis client.
- **Monitoring and observability:** No research was done on production monitoring, uptime alerting, or health checks. These are needed before launch but are standard patterns that do not need dedicated research.
- **Data retention and GDPR compliance:** PROJECT.md mentions GDPR compliance and no PII collection. The architecture naturally avoids PII (no accounts, no email, no tracking), but the legal requirements for a EU-facing service (privacy policy, cookie consent for any cookies, DPA with hosting provider) need attention outside the technical roadmap.

## Sources

### Primary (HIGH confidence)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) -- AES-GCM encryption, SubtleCrypto interface, browser support
- [MDN AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- IV requirements, encryption parameters
- [MDN Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) -- CSP directives and XSS prevention
- [MDN Referrer-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy) -- Fragment leakage prevention
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) -- Output encoding, CSP best practices
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) -- Argon2id/bcrypt guidance
- [PrivateBin Encryption Format](https://github.com/PrivateBin/PrivateBin/wiki/Encryption-format) -- Reference zero-knowledge implementation
- [PrivateBin Issue #174](https://github.com/PrivateBin/PrivateBin/issues/174) -- Self-destruct bypass documentation
- [PrivateBin Issue #374](https://github.com/PrivateBin/PrivateBin/issues/374) -- Password + burn-after-read edge case
- [PostgreSQL VACUUM documentation](https://www.postgresql.org/docs/current/sql-vacuum.html) -- Data remanence mitigation
- [Redis Expiration documentation](https://redis.io/docs/latest/commands/expire/) -- TTL behavior and sampling-based expiration
- [Password Pusher features](https://us.pwpush.com/features) -- Competitor feature analysis, retrieval step pattern

### Secondary (MEDIUM confidence)
- [Yopass GitHub](https://github.com/jhaals/yopass) -- Go + React reference implementation, client-side encryption pattern
- [Luzifer OTS GitHub](https://github.com/Luzifer/ots) -- Minimal zero-knowledge implementation, 256-bit AES in browser
- [OneTimeSecret GitHub](https://github.com/onetimesecret/onetimesecret) -- Server-side encryption approach (anti-pattern for zero-knowledge)
- [Express v5.1.0 announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) -- Express 5 stability confirmation
- [Drizzle ORM docs](https://orm.drizzle.team/) -- SQL-centric ORM, TypeScript inference
- [Cipher Projects Guide](https://cipherprojects.com/blog/posts/complete-guide-one-time-secret-sharing-tools-2025/) -- Industry survey of secret sharing tools
- [CSO Online: HashJack attack](https://www.csoonline.com/article/4097087/ai-browsers-can-be-tricked-with-malicious-prompts-hidden-in-url-fragments.html) -- Emerging URL fragment threat
- [Seald: Common encryption mistakes](https://www.seald.io/blog/3-common-mistakes-when-implementing-encryption) -- Implementation pitfalls

### Tertiary (LOW confidence)
- [DELE.TO](https://dele.to/alternatives) -- Competitor marketing claims, limited verification
- [scrt.link](https://scrt.link/) -- Limited public documentation
- [FairDevs Guide](https://fairdevs.com/blog/best-one-time-secret-sharing-tools-2025) -- Aggregator comparison, limited depth

---
*Research completed: 2026-02-13*
*Ready for roadmap: yes*
