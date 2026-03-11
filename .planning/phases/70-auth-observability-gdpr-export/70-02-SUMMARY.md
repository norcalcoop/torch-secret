---
phase: 70-auth-observability-gdpr-export
plan: 02
subsystem: database
tags: [drizzle, postgres, pgenum, audit-logs, sha256, zk-invariant]

# Dependency graph
requires:
  - phase: 70-01
    provides: "Test files for audit events (audit-events.test.ts, me.test.ts with /api/me/export tests)"
provides:
  - "auth_event_type pgEnum in PostgreSQL (5 values: sign_up, sign_in, password_reset_requested, oauth_connect, logout)"
  - "audit_logs table with userId FK (cascade), ip_hash, user_agent, metadata JSONB, created_at"
  - "Migration 0009_polite_landau.sql applied"
  - "audit.service.ts: writeAuditEvent(), fireAuditEvent(), hashIpForAudit(), AuditEventType"
  - "INVARIANTS.md audit_logs enforcement row added (Phase 70)"
affects:
  - 70-03
  - 70-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: RED failing tests committed before implementation (writeAuditEvent, hashIpForAudit)"
    - "fireAuditEvent() fire-and-forget pattern: void writeAuditEvent().catch() with err.message only (ZK: no userId in logs)"
    - "hashIpForAudit() mirrors subscribers.service.ts hashIp() pattern: SHA-256(IP_HASH_SALT + ip)"
    - "jsonb column for audit metadata: Record<string, unknown> | null (OAuth provider, etc.)"

key-files:
  created:
    - server/src/services/audit.service.ts
    - drizzle/0009_polite_landau.sql
    - drizzle/meta/0009_snapshot.json
  modified:
    - server/src/db/schema.ts
    - server/src/db/__tests__/audit-logs-schema.test.ts
    - INVARIANTS.md

key-decisions:
  - "audit_logs FK uses onDelete cascade (all audit rows deleted with account — GDPR compliance by default)"
  - "password_reset_requested events have null ip_hash and user_agent — no req object in Better Auth sendResetPassword hook"
  - "fireAuditEvent() catch logs err.message only — ZK: never logs userId alongside error context"
  - "Migration file is 0009_polite_landau.sql (Drizzle-generated name, not 0009_add_audit_logs.sql)"

patterns-established:
  - "writeAuditEvent(): async insert with nullable ipHash/userAgent/metadata; call with void for fire-and-forget"
  - "hashIpForAudit(): always use for IP before storing or passing to writeAuditEvent()"
  - "fireAuditEvent(): use in Better Auth databaseHooks where Promise cannot be returned"

requirements-completed: [AUTH-01]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 70 Plan 02: audit_logs Schema + audit.service.ts Summary

**PostgreSQL auth_event_type pgEnum + audit_logs table with cascading FK, jsonb metadata, and audit.service.ts providing writeAuditEvent/fireAuditEvent/hashIpForAudit**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T16:56:07Z
- **Completed:** 2026-03-11T17:00:04Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- auth_event_type pgEnum created in PostgreSQL with 5 values; invalid values rejected at DB level
- audit_logs table created with all required columns; ZK-safe by design (no secretId column)
- audit.service.ts exports writeAuditEvent, fireAuditEvent, hashIpForAudit — foundation for Plan 03 hooks
- INVARIANTS.md updated with audit_logs enforcement row (Phase 70)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update INVARIANTS.md, add auditLogs schema + migration** - `a39f55b` (feat)
2. **Task 2: Implement audit.service.ts** - `877bdf9` (feat)

**Plan metadata:** `(pending)` (docs: complete plan)

_Note: Task 2 followed TDD — RED tests committed in Task 1 commit, GREEN verified after service implementation._

## Files Created/Modified

- `server/src/db/schema.ts` - Added authEventTypeEnum, auditLogs table, jsonb import, ZK invariant comment update
- `server/src/services/audit.service.ts` - New: writeAuditEvent, fireAuditEvent, hashIpForAudit, AuditEventType
- `drizzle/0009_polite_landau.sql` - Migration: CREATE TYPE auth_event_type + CREATE TABLE audit_logs + ADD CONSTRAINT FK
- `INVARIANTS.md` - audit_logs enforcement row added (Phase 70), Last updated updated
- `server/src/db/__tests__/audit-logs-schema.test.ts` - Extended with writeAuditEvent + hashIpForAudit integration tests (9 total)
- `drizzle/meta/0009_snapshot.json` - Drizzle-generated migration snapshot

## Decisions Made

- `onDelete: cascade` for audit_logs.user_id FK — GDPR compliance: all audit rows deleted automatically when account deleted
- `password_reset_requested` events write with null ipHash/userAgent — Better Auth's sendResetPassword callback has no req object
- `fireAuditEvent()` catch block logs only `err.message` — ZK invariant prevents userId appearing alongside error context
- Migration file named by Drizzle as `0009_polite_landau.sql` (not the planned `0009_add_audit_logs.sql`) — used actual generated name

## Deviations from Plan

None — plan executed exactly as written. The TDD RED tests were embedded in the same test file (`audit-logs-schema.test.ts`) that already existed from Phase 70-01 planning context, extended with service behavior tests.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 03 (AUTH-02): Better Auth databaseHooks can now import `fireAuditEvent` from `audit.service.ts`
- Plan 04 (GDPR-01): `writeAuditEvent` provides audit log rows for the `/api/me/export` endpoint
- `audit-events.test.ts` (AUTH-02 tests) and `me.test.ts` GDPR-01 tests are still RED — expected, hooks not yet wired
- 640/645 tests passing; 5 failures are all pre-written RED tests for Plans 03 and 04

---
*Phase: 70-auth-observability-gdpr-export*
*Completed: 2026-03-11*
