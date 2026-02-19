# SecureShare Invariants

This document is the **canonical source** for SecureShare's hard design invariants.
All other references (CLAUDE.md, schema.ts comments) cite this document.

When adding new tables, logging systems, or analytics integrations in Phases 22–27,
update the enforcement table in each relevant invariant section FIRST, then implement.

---

## Invariant 1: Zero-Knowledge User-Secret Separation

### Abstract Rule

**No database record, log line, or analytics event may contain BOTH a `userId` AND a `secretId` in the same payload.**

These two identifiers must remain permanently separated across all systems.

### Rationale

Combining `userId` + `secretId` in any shared record creates a deanonymization attack surface.
An attacker — or an insider — with access to DB rows, application logs, or analytics events
could correlate which user created which secret, directly violating the zero-knowledge security model.

SecureShare's core promise is that the server cannot learn who sent what to whom. Keeping
`userId` and `secretId` permanently separated at the data layer enforces this promise
structurally, not just operationally.

### Scope

This invariant applies to:
- Every database table in the PostgreSQL schema
- Every log line emitted by Pino (server-side logger)
- Every analytics event sent to PostHog or any future analytics provider
- Every API response body (never return userId + secretId in the same JSON object)
- Every background job record or audit trail

### Current Enforcement Points

| System | Location | Rule | Phase Added |
|--------|----------|------|-------------|
| **DB — secrets table** | `server/src/db/schema.ts` `secrets.user_id` | Column is nullable; stores `users.id` as ownership marker only. The `secrets.id` (secretId) is NEVER stored in `users`, `sessions`, or `accounts` rows. | Phase 21 |
| **DB — users table** | `server/src/db/schema.ts` `users` table | No `secret_id` or `last_secret_id` column. User rows contain no secret identifiers. | Phase 21 |
| **Logger** | `server/src/middleware/logger.ts` | Pino HTTP logger redacts secret IDs from URL paths via regex before any log line is written. Secret IDs must never appear in log output even as part of a URL. | Phase 2 |
| **Analytics** | PostHog client (Phase 25) | `sanitize_properties` must strip URL fragments (`#...`) from `$current_url` and `$referrer` before any event is sent. AES-256-GCM keys and secret IDs embedded in URL fragments must never reach PostHog servers. | Phase 25 |

### Extension Protocol

When a new table, logging system, or analytics integration is added:

1. **Before writing any code:** Read this invariant.
2. **Identify the risk:** Does the new system receive or store a `secretId`? Does it also receive or store a `userId`?
3. **If both are present in the same payload:** Redesign to separate them. Use separate records, separate log fields, or separate event types.
4. **After shipping:** Add a new row to the enforcement table above describing the system, location, and rule applied.

### CLAUDE.md Reference

The hard convention section in `CLAUDE.md` directs every future session to this document.
The block comment in `server/src/db/schema.ts` cites this document.
Both references must remain current.

---

*Document created: Phase 21 (Schema Foundation)*
*Last updated: Phase 21*
