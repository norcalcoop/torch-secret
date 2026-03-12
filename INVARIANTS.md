# Torch Secret Invariants

This document is the **canonical source** for Torch Secret's hard design invariants.
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

Torch Secret's core promise is that the server cannot learn who sent what to whom. Keeping
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

| System                                    | Location                                                                            | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase Added |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| **DB — secrets table**                    | `server/src/db/schema.ts` `secrets.user_id`                                         | Column is nullable; stores `users.id` as ownership marker only. The `secrets.id` (secretId) is NEVER stored in `users`, `sessions`, or `accounts` rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Phase 21    |
| **DB — users table**                      | `server/src/db/schema.ts` `users` table                                             | No `secret_id` or `last_secret_id` column. User rows contain no secret identifiers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Phase 21    |
| **Logger**                                | `server/src/middleware/logger.ts`                                                   | Pino HTTP logger redacts secret IDs from URL paths via regex before any log line is written. Secret IDs must never appear in log output even as part of a URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Phase 2     |
| **Analytics**                             | PostHog client (Phase 25)                                                           | `sanitize_properties` must strip URL fragments (`#...`) from `$current_url` and `$referrer` before any event is sent. AES-256-GCM keys and secret IDs embedded in URL fragments must never reach PostHog servers.                                                                                                                                                                                                                                                                                                                                                                                                                   | Phase 25    |
| **Logger — dashboard route**              | `server/src/middleware/logger.ts` `redactUrl`                                       | Pino HTTP logger redaction regex extended to cover `/api/dashboard/secrets/:id` paths. Secret IDs in dashboard DELETE URLs are redacted before any log line is written.                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Phase 23    |
| **Email (Resend)**                        | `server/src/services/notification.service.ts`                                       | Notification email body contains only: viewed-at timestamp and generic "secret was viewed" message. No `secretId`, no `label`, no ciphertext, no viewer IP address in the body or subject. Resend delivery record logs recipient email + subject — no secretId. Error log line emits only `error.message` with no identifying fields.                                                                                                                                                                                                                                                                                               | Phase 26    |
| **Rate limits + conversion prompts**      | `server/src/middleware/rate-limit.ts`, `client/src/analytics/posthog.ts`            | 429 responses for anonymous users contain no `userId` (anonymous by definition) and no `secretId` (POST /api/secrets URL contains no secret ID). Conversion prompt analytics events (`conversion_prompt_shown`, `conversion_prompt_clicked`) contain only `prompt_number` — no `userId`, no `secretId`. Legal pages contain no user-identifiable or secret-identifiable data.                                                                                                                                                                                                                                                       | Phase 27    |
| **Stripe billing**                        | `server/src/routes/webhooks.ts`, `server/src/services/billing.service.ts`           | Webhook handler receives `stripe_customer_id` from the Stripe event payload. All DB lookups in billing service use `eq(users.stripeCustomerId, ...)` — user is looked up BY stripe_customer_id, not the other way around. No webhook code path receives or logs both `userId` and `secretId` simultaneously. `stripe_customer_id` must not be logged alongside `userId` in the same Pino log line. The `getOrCreateStripeCustomer` function stores `stripe_customer_id` on the user row (a `userId`+`customerId` link) — this is acceptable because Stripe is a trusted payment processor and the link does NOT involve `secretId`. | Phase 34    |
| **Email capture — marketing_subscribers** | `server/src/db/schema.ts` `marketing_subscribers` table                             | Table stores email address and GDPR consent evidence (consent_text snapshot, consent_at timestamp, ip_hash). MUST NOT store userId or secretId — it is a standalone GDPR record with no FK to the users or secrets tables. No query may JOIN marketing_subscribers with secrets in the same result set. ip_hash is SHA-256(IP_HASH_SALT + req.ip) — never plain IP.                                                                                                                                                                                                                                                                 | Phase 36    |
| **Analytics — new events (Phase 37.1)**   | `client/src/analytics/posthog.ts`                                                   | `checkout_initiated` carries only `{ source }` — no secretId, no userId. `subscription_activated` carries no properties (only fires setPersonProperties for tier). `dashboard_viewed` carries no properties. `secret_created` gains `protection_type` property derived from UI tab state — never from server response. `identifyUser()` extended with optional `tier` + `registeredAt` person properties — no email, no name, no secretId. All events pass through the existing `sanitizeEventUrls` before_send hook.                                                                                                               | Phase 37.1  |
| **Account deletion (Phase 37.3)**         | `server/src/auth.ts` `deleteUser.beforeDelete`, `server/src/routes/me.ts`           | `beforeDelete` hook calls `loops.deleteContact({ email })` — only email, no userId. Nulls out `secrets.user_id` for the deleted user (explicit defense-in-depth; FK onDelete:'set null' also handles this). No log line in beforeDelete may include both userId and the deletion event context simultaneously. DELETE /api/me returns `{ ok: true }` only — no userId in response body.                                                                                                                                                                                                                                             | Phase 37.3  |
| **audit_logs (DB)**                       | `server/src/db/schema.ts` `auditLogs` table, `server/src/services/audit.service.ts` | `audit_logs` table has `user_id` FK to users (cascades on account deletion) but NO `secret_id` column. No query may JOIN `audit_logs` with `secrets` in the same result set. `ip_hash` is SHA-256(IP_HASH_SALT + req.ip) — never stores plain IP. `password_reset_requested` events have null `ip_hash` and `user_agent` (no req object in sendResetPassword). ZK-safe by design — Phase 70.                                                                                                                                                                                                                                        | Phase 70    |
| **Redis (rate limits + expiration lock)** | `server/src/middleware/rate-limit.ts`, `server/src/workers/expiration-worker.ts`    | Rate-limit counters are keyed on `SHA-256(IP_HASH_SALT + req.ip)` — IP hash only, never `userId` or `secretId`. The distributed expiration lock (`SET NX EX 299`) uses a fixed key `expiration-worker:lock` with no user or secret identifier. Redis stores no data that could correlate userId with secretId.                                                                                                                                                                                                                                                                                                                      | Phase 71    |

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

_Document created: Phase 21 (Schema Foundation)_
_Last updated: Phase 71_
