# Roadmap: SecureShare

## Overview

SecureShare delivers a zero-knowledge, one-time secret sharing web app in 7 phases. The build order follows hard security dependencies: encryption first (the foundation everything rests on), then server-side storage with atomic destroy, then security hardening (before any user-facing code goes live), then the full frontend create/reveal flow, then password protection layered on top, then the expiration background worker, and finally trust content and accessibility polish. Every phase delivers a verifiable capability; phases 1-4 together produce the minimum working product, phases 5-7 complete the v1 feature set.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Encryption Foundation** - Client-side crypto module with AES-256-GCM, key generation, and ciphertext padding
- [x] **Phase 2: Database and API** - Server-side secret storage with atomic read-and-destroy and zero-knowledge guarantees
- [ ] **Phase 3: Security Hardening** - CSP, rate limiting, HTTPS, CORS, and referrer protection before frontend goes live
- [ ] **Phase 4: Frontend Create and Reveal** - Full user-facing flow from secret creation through one-time retrieval with two-step reveal
- [ ] **Phase 5: Password Protection** - Optional password layer with server-side hashing, attempt limiting, and auto-destroy
- [ ] **Phase 6: Expiration Worker** - Background cleanup job and expired secret handling
- [ ] **Phase 7: Trust and Accessibility** - "How it works" trust content and WCAG 2.1 AA compliance

## Phase Details

### Phase 1: Encryption Foundation
**Goal**: A standalone, fully tested crypto module that encrypts and decrypts secrets entirely in the browser -- the zero-knowledge guarantee starts here
**Depends on**: Nothing (first phase)
**Requirements**: ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05
**Success Criteria** (what must be TRUE):
  1. A secret string can be encrypted and decrypted round-trip using only the browser crypto module, producing identical plaintext
  2. Each encryption operation generates a unique 256-bit key and unique 96-bit IV (no reuse across calls)
  3. The encryption key is encoded into a URL fragment format that is never included in any server request
  4. Ciphertext is padded to fixed block sizes so that two secrets of different lengths produce same-size ciphertext within the same block tier
  5. All crypto operations use Web Crypto API (crypto.subtle) and crypto.getRandomValues -- no Math.random, no third-party crypto libraries
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Types, constants, and base64/base64url encoding utilities (TDD)
- [x] 01-02-PLAN.md — PADME plaintext padding module (TDD)
- [x] 01-03-PLAN.md — Key generation, export, and import module (TDD)
- [x] 01-04-PLAN.md — Encrypt, decrypt, and barrel export integration (TDD)

### Phase 2: Database and API
**Goal**: The server can store encrypted blobs and destroy them atomically on first retrieval -- it never sees plaintext and leaves no recoverable traces
**Depends on**: Phase 1
**Requirements**: SECR-01, SECR-07, SECR-08, SECR-09, RETR-03, RETR-04
**Success Criteria** (what must be TRUE):
  1. POST /api/secrets accepts ciphertext and returns a secret ID; the server stores only the encrypted blob and metadata (never plaintext)
  2. GET /api/secrets/:id returns the ciphertext exactly once, then atomically deletes the record in the same database transaction
  3. A second GET to the same secret ID returns an error response identical to a request for a nonexistent or expired secret (no enumeration possible)
  4. Before deletion, ciphertext is overwritten with zeros in the database row (data remanence mitigation)
  5. Application logs contain no secret IDs, ciphertext, or PII
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Server project setup, database schema, connection, env config, logging, and shared API types
- [x] 02-02-PLAN.md — Validation middleware, error handler, secrets service, route handlers, and app factory
- [x] 02-03-PLAN.md — Integration tests proving all Phase 2 success criteria

### Phase 3: Security Hardening
**Goal**: All HTTP-level security protections are in place so that the frontend can be deployed without exposing the zero-knowledge model to XSS, referrer leakage, or abuse
**Depends on**: Phase 2
**Requirements**: SECR-02, SECR-03, SECR-04, SECR-05, SECR-06
**Success Criteria** (what must be TRUE):
  1. Every HTML response includes a Content-Security-Policy header with nonce-based script-src (no unsafe-inline, no unsafe-eval) that blocks inline script injection
  2. An IP address that creates more than 10 secrets within one hour receives a 429 rate-limit response on subsequent creation attempts
  3. All HTTP requests are redirected to HTTPS and responses include Strict-Transport-Security headers
  4. All responses include Referrer-Policy: no-referrer, preventing URL fragment leakage through referrer headers
  5. CORS is restricted to same-origin only; cross-origin API requests are rejected
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Frontend Create and Reveal
**Goal**: Users can create a secret, receive a shareable link, and recipients can view the secret exactly once through a two-step reveal flow -- the complete end-to-end user journey works
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: CREA-01, CREA-02, CREA-03, CREA-04, CREA-05, RETR-01, RETR-02, RETR-05, RETR-06, COPY-01, COPY-02, COPY-03, UXUI-01, UXUI-02, UXUI-04, EXPR-03
**Success Criteria** (what must be TRUE):
  1. User lands on a page with a textarea (max 10,000 chars), expiration selector (1h/24h/7d/30d, default 24h), optional password field, and a "Create Secure Link" button
  2. After creation, user sees a confirmation page showing the shareable URL with one-click copy button and the expiration timestamp
  3. Recipient clicking the link sees a "Click to Reveal" interstitial (not the secret itself), and only after explicit action does the app fetch and decrypt the secret client-side
  4. After reveal, the URL fragment is stripped from the browser address bar and the secret text is displayed with a one-click copy button and visual "Copied!" confirmation
  5. Visiting an already-viewed, expired, or invalid link shows a clear, distinct error message for each state -- and all error responses from the API are identical to prevent enumeration
  6. The entire flow works on mobile phones, tablets, and desktop with a responsive layout
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Password Protection
**Goal**: Senders can optionally add a password to secrets, and recipients must enter the correct password before the secret is revealed -- with automatic destruction after 3 wrong attempts
**Depends on**: Phase 4
**Requirements**: PASS-01, PASS-02, PASS-03, PASS-04, PASS-05
**Success Criteria** (what must be TRUE):
  1. A password-protected secret shows a password entry form to the recipient before the reveal step
  2. The password is verified server-side using Argon2 or bcrypt, with constant-time comparison to prevent timing attacks
  3. After 3 incorrect password attempts, the secret is automatically and permanently destroyed
  4. During password entry, the user sees how many attempts remain (e.g., "2 attempts remaining")
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Expiration Worker
**Goal**: Expired secrets are automatically cleaned up and users requesting expired secrets see a clear message
**Depends on**: Phase 2
**Requirements**: EXPR-01, EXPR-02
**Success Criteria** (what must be TRUE):
  1. A background job runs every 5 minutes and deletes all secrets past their expiration timestamp
  2. Requesting an expired secret returns a clear "This secret has expired" message (handled through the same error response pattern established in Phase 2)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Trust and Accessibility
**Goal**: Users trust the application through clear explanation of the zero-knowledge model, and the application is usable by people with disabilities
**Depends on**: Phase 4
**Requirements**: UXUI-03, UXUI-05
**Success Criteria** (what must be TRUE):
  1. The landing page includes a "How it works" section that explains zero-knowledge encryption in plain language without technical jargon
  2. All interactive elements are keyboard-navigable and screen-reader accessible
  3. Color contrast meets WCAG 2.1 AA minimum ratios (4.5:1 for normal text, 3:1 for large text)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
(Phases 6 and 7 depend on Phase 2 and Phase 4 respectively, not on Phase 5, so they could run after their dependencies. The listed order is the recommended sequence.)

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Encryption Foundation | 4/4 | ✓ Complete | 2026-02-13 |
| 2. Database and API | 3/3 | ✓ Complete | 2026-02-14 |
| 3. Security Hardening | 0/TBD | Not started | - |
| 4. Frontend Create and Reveal | 0/TBD | Not started | - |
| 5. Password Protection | 0/TBD | Not started | - |
| 6. Expiration Worker | 0/TBD | Not started | - |
| 7. Trust and Accessibility | 0/TBD | Not started | - |
