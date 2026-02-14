# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-13)

**Core value:** Users can share sensitive information once, securely, without accounts or complexity -- the secret is encrypted in the browser, viewable only once, then permanently destroyed.
**Current focus:** Phase 4 in progress - Frontend Create and Reveal

## Current Position

Phase: 4 of 7 (Frontend Create and Reveal)
Plan: 1 of 4 in current phase -- COMPLETE
Status: Plan 04-01 complete. Vite + Tailwind CSS build toolchain, SPA router, API client, copy button, and Express production serving all wired. Ready for 04-02 (create page).
Last activity: 2026-02-14 -- Completed 04-01 (frontend toolchain and SPA skeleton)

Progress: [█████░░░░░] 48%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 2min
- Total execution time: 0.43 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-encryption-foundation | 4 | 10min | 2min |
| 02-database-and-api | 3 | 8min | 3min |
| 03-security-hardening | 2 | 6min | 3min |
| 04-frontend-create-and-reveal | 1 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 2min, 3min, 4min, 2min, 3min
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Research]: ~~Ciphertext padding strategy not yet decided~~ RESOLVED in 01-02: PADME with 256-byte minimum tier, max 12% overhead.
- [Research]: Password hashing algorithm not decided (Argon2id vs bcrypt). Resolve during Phase 5 planning.

## Session Continuity

Last session: 2026-02-14
Stopped at: Completed 04-01-PLAN.md (frontend toolchain and SPA skeleton)
Resume file: None
