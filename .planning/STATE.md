# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity -- the secret is encrypted in the browser, viewable only once, then permanently destroyed.
**Current focus:** Phase 7 in progress - Trust and Accessibility. Plan 1 complete, Plan 2 next.

## Current Position

Phase: 7 of 7 (Trust and Accessibility)
Plan: 1 of 2 in current phase -- COMPLETE
Status: SPA accessibility infrastructure complete (Plan 1). Route announcements, focus management, ARIA attributes, outline-hidden migration done.
Last activity: 2026-02-15 -- Completed 07-01-PLAN.md (SPA accessibility infrastructure)

Progress: [█████████░] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 19
- Average duration: 3min
- Total execution time: 0.95 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-encryption-foundation | 4 | 10min | 2min |
| 02-database-and-api | 3 | 8min | 3min |
| 03-security-hardening | 2 | 6min | 3min |
| 04-frontend-create-and-reveal | 4 | 13min | 3min |
| 05-password-protection | 3 | 8min | 3min |
| 06-expiration-worker | 2 | 10min | 5min |
| 07-trust-and-accessibility | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 2min, 3min, 8min, 2min, 3min
- Trend: stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 7-phase build order following security-dependency chain: crypto -> server -> hardening -> frontend -> password -> expiration -> trust
- [Roadmap]: Phase 4 is the integration point where crypto module, API, and security hardening converge into the user-facing product
- [01-01]: Use loop-based String.fromCharCode conversion (not spread) to avoid stack overflow on large arrays
- [01-01]: Extract shared binary string helpers to eliminate duplication between base64 and base64url
- [01-01]: Use as const for constant literal types to enforce compile-time type safety
- [01-03]: Imported keys are non-extractable and decrypt-only (defense in depth for receiving side)
- [01-03]: Validate base64url key length before calling crypto.subtle for clear error messages
- [01-03]: generateKey returns both CryptoKey and base64url string in one call to avoid redundant export
- [01-02]: PADME algorithm chosen over power-of-2 padding: max 12% overhead vs up to 100%
- [01-02]: 4-byte big-endian uint32 length prefix supports up to 4GB (far exceeds 10K char limit)
- [01-02]: 100KB max input validation to prevent excessive memory allocation
- [01-04]: IV prepended to ciphertext as single base64 blob for transport simplicity
- [01-04]: Generic decryption error message to prevent oracle attacks
- [01-04]: Barrel export excludes internal utilities -- only public API exposed
- [02-01]: Use pinoHttp named export (not default) for NodeNext CJS interop compatibility
- [02-01]: pg Pool imported via pg default then destructured for NodeNext CJS compatibility
- [02-01]: Password columns included in initial schema as nullable to avoid Phase 5 migration
- [02-01]: Ciphertext stored as PostgreSQL text (not bytea) since Phase 1 outputs base64 strings
- [02-02]: ZodType used for generic schema constraint (zod 4.x removed ZodSchema)
- [02-02]: Express 5 req.params.id typed as string via assertion after Zod validation
- [02-02]: Server tsconfig rootDir expanded to project root to include shared types
- [02-02]: ~~Ciphertext zeroing uses null byte repeat matching original length before deletion~~ FIXED in 02-03: changed to '0' character repeat (PostgreSQL text rejects null bytes)
- [02-03]: Ciphertext zeroing uses '0' character repeat instead of null bytes (PostgreSQL text columns reject \x00)
- [02-03]: Single vitest config covers both client and server tests (no workspace split needed)
- [02-03]: Integration tests use real PostgreSQL (not mocked) to verify transaction atomicity
- [03-01]: Helmet CSP directive functions typed as (IncomingMessage, ServerResponse) to match helmet's type contract, cast to Express Response for res.locals access
- [03-01]: HSTS conditionally disabled in non-production (not just short max-age) to prevent browser lockout
- [03-01]: secretsRouter refactored to factory function (createSecretsRouter) for rate limiter test isolation
- [03-01]: No cors package -- Express without cors enforces same-origin by default
- [03-01]: Rate limiter is a factory function creating fresh MemoryStore per app instance
- [03-02]: draft-7 rate limit header is combined 'RateLimit' (not 'RateLimit-Limit') in express-rate-limit 8.x
- [03-02]: HSTS test uses environment-conditional assertion to verify correct behavior per NODE_ENV
- [03-02]: Rate limit tests use isolated buildApp() instances to prevent counter bleed
- [04-01]: Express 5 catch-all uses {*path} syntax (path-to-regexp v8+ requires named wildcard parameters)
- [04-01]: Placeholder page modules required for Vite/Rollup dynamic import resolution at build time
- [04-01]: Tailwind theme uses oklch color space for perceptually uniform custom color palette
- [04-01]: Static serving conditional on client/dist existence so server starts in dev without a build
- [04-01]: HTML template read once at startup, nonce-replaced per request for performance
- [04-02]: Confirmation page is state-based (not URL-based) -- refresh returns to create page since key is gone from memory
- [04-02]: Password field is disabled inside collapsible details/summary element (Phase 5 placeholder)
- [04-02]: Share URL displayed in readonly input with select-on-focus for easy manual copying
- [04-02]: Character counter uses danger-500 color at max length to indicate limit reached
- [04-03]: Reveal page uses closure-scoped key variable with null cleanup after decryption (best-effort memory management)
- [04-03]: All API error responses (404, 410, unknown) map to generic 'not_available' error to prevent secret enumeration
- [04-03]: Error page uses Unicode emoji icons for visual distinction without external assets
- [04-04]: All pages use consistent responsive heading pattern: text-2xl sm:text-3xl
- [04-04]: All interactive elements have min-h-[44px] for WCAG 2.5.5 touch target compliance
- [04-04]: Focus states standardized across all pages: focus:ring-2 focus:ring-primary-500
- [05-01]: Argon2id with OWASP minimum params (m=19456, t=2, p=1) via argon2 npm package
- [05-01]: Password service is thin wrapper around argon2 for testability and library swappability
- [05-01]: retrieveAndDestroy rejects password-protected secrets to prevent bypass via GET /:id
- [05-01]: verifySecretLimiter: 15 attempts per 15 minutes per IP (defense-in-depth)
- [05-01]: Route order: POST /, GET /:id/meta, POST /:id/verify, GET /:id (meta/verify before catch-all)
- [05-02]: Metadata check inserted before interstitial: loading spinner shown during getSecretMeta call to determine password vs non-password flow
- [05-02]: Password entry form uses closure-scoped encryption key with null cleanup after decryption, matching existing handleReveal security pattern
- [05-02]: Attempt counter uses text-warning-500 for multiple attempts and text-danger-500 when 1 or fewer remaining for visual urgency
- [05-02]: Password input cleared and re-focused after wrong attempt for improved UX
- [05-03]: Auto-destroy 3rd wrong attempt returns 404 (attemptsRemaining: 0 maps to not-found for anti-enumeration)
- [05-03]: Anti-enumeration verified via both verify and meta endpoints for destroyed secrets
- [06-01]: Worker uses single-character '0' for batch ciphertext zeroing (not length-matched) per Research Pitfall 6
- [06-01]: Expiration guards placed BEFORE password checks to prevent expired password-protected secrets from entering password flow
- [06-01]: getSecretMeta has no inline cleanup (no transaction context) -- relies on worker or next retrieval
- [06-01]: Worker uses result.rowCount from pg driver passthrough for deletion count
- [06-02]: cleanExpiredSecrets extracted as exported function for testability (cron scheduling separate from business logic)
- [06-02]: Expiration tests use direct DB inserts with past timestamps instead of setTimeout/timing (immediate, deterministic)
- [06-02]: Ciphertext zeroing verified by code review rather than runtime intermediate state inspection
- [07-01]: focus:outline-hidden over focus:outline-none for forced-colors mode accessibility (outline-color:transparent is overridable, outline-style:none is not)
- [07-01]: Clear-then-set pattern with requestAnimationFrame for route announcer to handle repeated same-title navigations
- [07-01]: Dynamic aria-live on copy button (add before change, remove after reset) to avoid stale region announcements
- [07-01]: warning-500 color at oklch(0.75 0.15 85) for amber/orange attempt counter text

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: ~~Ciphertext padding strategy not yet decided~~ RESOLVED in 01-02: PADME with 256-byte minimum tier, max 12% overhead.
- [Research]: ~~Password hashing algorithm not decided (Argon2id vs bcrypt). Resolve during Phase 5 planning.~~ RESOLVED in 05-01: Argon2id with OWASP params via argon2 npm package.

## Session Continuity

Last session: 2026-02-15
Stopped at: Completed 07-01-PLAN.md (SPA accessibility infrastructure)
Resume file: None
