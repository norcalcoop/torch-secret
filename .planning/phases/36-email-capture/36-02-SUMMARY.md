---
phase: 36-email-capture
plan: 02
subsystem: api
tags: [express, drizzle, resend, gdpr, email-capture, vitest]

requires:
  - phase: 36-email-capture
    plan: 01
    provides: "marketingSubscribers schema + migration 0005 applied + 16 RED integration tests"

provides:
  - "subscribers.service.ts: createSubscriber, confirmSubscriber, unsubscribeByToken, hashIp, CONSENT_TEXT"
  - "subscribersRouter mounted at /api/subscribers in app.ts (POST /, GET /confirm, GET /unsubscribe)"
  - "All 16 ECAP integration tests GREEN (318 total tests passing)"

affects: [36-03-confirmation-flow, 36-04-frontend-widget]

tech-stack:
  added: []
  patterns:
    - "onConflictDoUpdate with WHERE clause (Drizzle 0.45.x) — pending-only guard prevents confirmed row downgrade"
    - "Fire-and-forget Resend Audience sync with .catch() error logging — local DB is source of truth"
    - "z.literal(true) consent enforcement — Zod rejects false/undefined at schema level"
    - "req.ip ?? '127.0.0.1' fallback — safe default in test environments where trust proxy is inactive"

key-files:
  created:
    - "server/src/services/subscribers.service.ts"
    - "server/src/routes/subscribers.ts"
  modified:
    - "server/src/app.ts"

key-decisions:
  - "onConflictDoUpdate WHERE clause checks status='pending' — only pending rows are refreshed; confirmed rows are silently preserved (no email sent, no status downgrade)"
  - "createSubscriber always returns void — no indication of which case (fresh/pending/confirmed) occurred; prevents subscriber status enumeration"
  - "Resend contacts.create is fire-and-forget with .catch() — Resend Audience is best-effort; local DB is the source of truth for subscriber status"
  - "subscribersRouter mounted at position 6/7 in app.ts route order — after billing, before /api catch-all"

patterns-established:
  - "Double-opt-in token flow: nanoid token INSERT → email with /confirm?token= link → GET confirm clears token + generates permanent unsubscribeToken"
  - "IP pseudonymization pattern: hashIp(ip) = SHA-256(IP_HASH_SALT + ip).digest('hex') — salt prevents IPv4 rainbow-table reversal"

requirements-completed: [ECAP-01, ECAP-02, ECAP-03, ECAP-04, ECAP-05]

duration: 2min
completed: 2026-02-26
---

# Phase 36 Plan 02: Subscribers API Implementation Summary

**Complete GDPR double opt-in API (subscribers.service.ts + subscribersRouter) turning 16 RED integration tests GREEN with zero regressions in the 302-test suite**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T19:31:21Z
- **Completed:** 2026-02-26T19:33:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `subscribers.service.ts` created with full GDPR business logic:
  - `hashIp(ip)`: SHA-256(IP_HASH_SALT + ip) — never stores plain IP (ECAP-05)
  - `CONSENT_TEXT`: snapshot constant stored with each subscriber record
  - `createSubscriber`: upsert with `onConflictDoUpdate WHERE status='pending'` guard prevents confirmed row downgrade
  - `confirmSubscriber`: token lookup + expiry check + Resend Audience fire-and-forget
  - `unsubscribeByToken`: idempotent; fire-and-forgets Resend contact with `unsubscribed: true`
- `subscribersRouter` created with all three endpoints wired to the service
- Router mounted in `app.ts` at `/api/subscribers` before the `/api` catch-all
- All 16 subscriber integration tests GREEN; 302 pre-existing tests unaffected (318 total passing)

## Task Commits

1. **Task 1: subscribers.service.ts** - `84a0fec` (feat)
2. **Task 2: subscribersRouter + app.ts wiring** - `a60a91d` (feat)

## Files Created/Modified

- `server/src/services/subscribers.service.ts` — GDPR double opt-in service (202 lines)
- `server/src/routes/subscribers.ts` — Express router with POST / GET /confirm GET /unsubscribe
- `server/src/app.ts` — import + mount subscribersRouter at /api/subscribers (2 lines added)

## Decisions Made

- `onConflictDoUpdate` with `WHERE eq(marketingSubscribers.status, 'pending')` — this is the critical guard that prevents a confirmed subscriber from being downgraded back to pending when they re-submit the form. Drizzle 0.45.x supports the conditional WHERE clause on conflict updates.
- `createSubscriber` always returns void with no status indication — prevents subscriber status enumeration; all valid states (fresh/pending/confirmed) return `{ ok: true }` at the API layer.
- Resend Audience sync is fire-and-forget via `void .catch()` — the local `marketing_subscribers` DB table is the source of truth; Resend sync failure does not fail the request.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled clean on first pass; all 16 tests passed on first run.

## User Setup Required

The following env vars must be set for the Resend integration to work in production (already added to `.env.example` and CI in Plan 01):

- `RESEND_AUDIENCE_ID` — Resend Dashboard -> Audiences -> select or create audience -> copy Audience ID
- `IP_HASH_SALT` — generate via `openssl rand -base64 24` (min 16 chars)

## Next Phase Readiness

- Plan 03 (confirmation flow): `/confirm` frontend page reads `?token=` query param → calls `GET /api/subscribers/confirm` → shows success/error state; `/unsubscribe` page reads `?token=` → calls `GET /api/subscribers/unsubscribe` → shows success page
- Plan 04 (frontend widget): marketing capture form on home page; calls `POST /api/subscribers`; handles all response states

## Self-Check: PASSED

All files exist and contain expected content:
- server/src/services/subscribers.service.ts: createSubscriber, confirmSubscriber, unsubscribeByToken, hashIp, CONSENT_TEXT exports present
- server/src/routes/subscribers.ts: subscribersRouter export present
- server/src/app.ts: subscribersRouter import + mount present

Commits verified: 84a0fec (Task 1 — subscribers.service.ts), a60a91d (Task 2 — subscribersRouter + app.ts)

---
*Phase: 36-email-capture*
*Completed: 2026-02-26*
