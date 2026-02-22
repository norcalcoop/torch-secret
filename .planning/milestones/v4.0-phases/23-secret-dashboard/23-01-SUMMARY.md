---
phase: 23-secret-dashboard
plan: 01
subsystem: database
tags: [drizzle, postgresql, zod, schema, migration, dashboard]

# Dependency graph
requires:
  - phase: 22-authentication
    provides: users table with id PK; secrets.user_id FK established in Phase 21
  - phase: 21-schema-foundation
    provides: secrets table with userId column; zero-knowledge invariant documented in INVARIANTS.md

provides:
  - secrets table extended with label, notify, status, viewedAt columns
  - migration 0003_add_dashboard_columns.sql applied to DB
  - CreateSecretSchema with optional label and notify fields
  - DashboardSecretItem, DashboardListResponse, DashboardDeleteResponse interfaces

affects:
  - 23-02 (dashboard API routes — references body.label, body.notify, status column)
  - 23-03 (dashboard UI — references DashboardSecretItem, DashboardListResponse)
  - secrets.service.ts (must write status on create/retrieve; update viewedAt on retrieval)
  - expiration-worker.ts (must update status to 'expired' instead of hard-deleting user-owned rows)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Soft-delete status model: user-owned secrets update status on view/expire/delete; anonymous secrets hard-delete unchanged
    - status column uses text (not enum) for forward-compat; values enforced at API/service layer
    - Four-state lifecycle: active -> viewed/expired/deleted

key-files:
  created:
    - drizzle/0003_add_dashboard_columns.sql
    - drizzle/meta/0003_snapshot.json
  modified:
    - server/src/db/schema.ts
    - shared/types/api.ts
    - drizzle/meta/_journal.json

key-decisions:
  - "status column is text (not PostgreSQL enum) — avoids ALTER TYPE migrations when adding new states; values constrained at application layer"
  - "Drizzle bug #4147 does not apply — four new columns have no FK constraints, single-file migration is safe"
  - "viewedAt is nullable timestamptz — NULL means not yet viewed; populated by secrets.service.ts on retrieval"
  - "notify defaults to false at DB level — zero opt-in by default; Phase 26 wires up actual email sending"
  - "label max 100 chars enforced at API layer (Zod schema), not DB constraint — simpler migration path"

patterns-established:
  - "Drizzle migration naming: rename drizzle-kit auto-slug to descriptive name (0003_add_dashboard_columns) for operational clarity"
  - "Dashboard types section added to shared/types/api.ts with phase-labeled divider comment"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 23 Plan 01: Schema Foundation for Dashboard Summary

**Secrets table extended with four dashboard columns (label, notify, status, viewedAt) via additive migration; shared types updated with label+notify on CreateSecretSchema and three DashboardSecretItem/List/Delete response interfaces**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T19:18:48Z
- **Completed:** 2026-02-20T19:21:25Z
- **Tasks:** 3
- **Files modified:** 4 (schema.ts, api.ts, 0003_add_dashboard_columns.sql, _journal.json)

## Accomplishments

- Extended secrets table with four columns: label (nullable text), notify (boolean NOT NULL default false), status (text NOT NULL default 'active'), viewedAt (nullable timestamptz)
- Generated, renamed, and applied migration 0003_add_dashboard_columns.sql; all four columns confirmed in live DB with correct constraints
- Extended CreateSecretSchema with optional label (max 100 chars) and notify (boolean) fields; added DashboardSecretItem, DashboardListResponse, DashboardDeleteResponse to shared/types/api.ts
- All 32 existing secrets integration tests pass with no changes required

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend secrets table schema with dashboard columns** - `3631e58` (feat)
2. **Task 2: Generate migration and verify SQL** - `a81acf3` (chore)
3. **Task 3: Extend shared API types** - `3d1e6c4` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `server/src/db/schema.ts` - Added label, notify, status, viewedAt columns to secrets pgTable; updated block comment with soft-delete note
- `drizzle/0003_add_dashboard_columns.sql` - Migration: four ADD COLUMN statements for secrets table
- `drizzle/meta/_journal.json` - Updated tag from auto-slug to descriptive name
- `drizzle/meta/0003_snapshot.json` - Drizzle schema snapshot for migration 0003
- `shared/types/api.ts` - label+notify fields on CreateSecretSchema; DashboardSecretItem, DashboardListResponse, DashboardDeleteResponse interfaces

## Decisions Made

- `status` uses `text` not a PostgreSQL enum — forward-compatible (no `ALTER TYPE` needed for new states); values constrained at application layer
- Drizzle bug #4147 confirmed not applicable — four new columns have no FK constraints, single migration file is safe
- `viewedAt` is nullable and starts NULL; populated by `secrets.service.ts` when a secret is retrieved (Phase 23 Plan 02)
- `notify` defaults to `false` at DB level — explicit opt-in; actual email wired in Phase 26
- `label` max-100 enforced at Zod layer only — no DB constraint needed (reduces migration complexity)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `npx tsx -e` with top-level await fails due to CJS output format; used `psql` direct query instead for column verification. No impact on plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 23-02 (dashboard API routes) can now reference `body.label`, `body.notify`, `secrets.status`, `secrets.viewedAt` without type errors
- Plan 23-03 (dashboard UI) can import `DashboardSecretItem`, `DashboardListResponse`, `DashboardDeleteResponse` from shared/types/api.ts
- Both plans can proceed in parallel (Wave 2 dependency)
- `secrets.service.ts` will need updates in Plan 23-02 to write status on create and update status+viewedAt on retrieval

## Self-Check: PASSED

All files present and all commits verified:
- `drizzle/0003_add_dashboard_columns.sql` — FOUND
- `server/src/db/schema.ts` — FOUND
- `shared/types/api.ts` — FOUND
- `23-01-SUMMARY.md` — FOUND
- commit 3631e58 (Task 1) — FOUND
- commit a81acf3 (Task 2) — FOUND
- commit 3d1e6c4 (Task 3) — FOUND

---
*Phase: 23-secret-dashboard*
*Completed: 2026-02-20*
