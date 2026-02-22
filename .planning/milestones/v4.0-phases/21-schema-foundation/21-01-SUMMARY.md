---
phase: 21-schema-foundation
plan: 01
subsystem: database

tags: [drizzle-orm, postgresql, better-auth, schema, zero-knowledge]

# Dependency graph
requires: []
provides:
  - users table (Better Auth-compatible: id, name, email, emailVerified, image, createdAt, updatedAt)
  - sessions table with cascade FK to users.id
  - accounts table with cascade FK to users.id + accounts_user_id_idx
  - verification table with verification_identifier_idx
  - secrets.userId nullable FK to users.id with onDelete set null
  - Partial index on secrets (user_id, created_at DESC) WHERE user_id IS NOT NULL
  - Zero-knowledge invariant block comment in schema.ts
affects: [22-better-auth-core, 23-user-profile, 24-secret-ownership, 25-analytics, 26-notifications, 27-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Better Auth schema convention: text PKs (not UUID), withTimezone timestamps, $onUpdate for updatedAt"
    - "Partial index pattern: WHERE user_id IS NOT NULL — skips anonymous rows in dashboard queries"
    - "Nullable FK with set null: preserves anonymous shared links when user account is deleted"
    - "sql tag imported from drizzle-orm (core), not drizzle-orm/pg-core"

key-files:
  created: []
  modified:
    - server/src/db/schema.ts

key-decisions:
  - "onDelete: set null on secrets.userId (not cascade) — preserves already-shared links if user deletes account"
  - "onDelete: cascade on sessions.userId and accounts.userId (Better Auth requirement for session cleanup)"
  - "sql template tag must be imported from drizzle-orm, not drizzle-orm/pg-core (pg-core does not re-export it)"
  - "No label, notificationEnabled, role, or plan columns added — deferred to Phase 23/26 per plan constraints"

patterns-established:
  - "Zero-knowledge invariant comment: canonical rule placed at top of schema.ts, references .planning/INVARIANTS.md"
  - "Better Auth table order: users first (FK source), then sessions/accounts/verification (FK targets)"

requirements-completed: [INFRA-21-SCHEMA]

# Metrics
duration: 1min
completed: 2026-02-19
---

# Phase 21 Plan 01: Schema Foundation Summary

**Drizzle schema extended with four Better Auth tables (users, sessions, accounts, verification) and nullable userId FK on secrets with partial index for dashboard queries**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-19T03:12:28Z
- **Completed:** 2026-02-19T03:13:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added users, sessions, accounts, and verification tables using Better Auth-compatible column names and text PKs
- Added nullable `userId` FK on secrets referencing users.id with `onDelete: 'set null'` (preserves shared links on account deletion)
- Added partial index `secrets_user_id_created_at_idx` on `(user_id, created_at DESC) WHERE user_id IS NOT NULL` for efficient dashboard queries
- Placed canonical zero-knowledge invariant block comment in schema.ts, documenting the userId/secretId separation rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Better Auth tables to schema.ts** - `9df0416` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `/Users/ourcomputer/Github-Repos/secureshare/server/src/db/schema.ts` - Extended from secrets-only schema to five-table schema with zero-knowledge invariant comment, four Better Auth tables, nullable userId FK on secrets, and partial index

## Decisions Made

- `onDelete: 'set null'` on secrets.userId — a user deleting their account must not destroy already-shared secret links that recipients may not yet have viewed. Cascade would be a data-loss bug.
- `onDelete: 'cascade'` on sessions.userId and accounts.userId — Better Auth requirement; session/account rows are meaningless without the owning user.
- No speculative columns (label, notificationEnabled, role, plan) added per plan constraints; those are Phase 23/26 concerns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect import location for sql template tag**

- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** Plan specified `sql` in the `drizzle-orm/pg-core` import, but `sql` is exported from `drizzle-orm` core, not `drizzle-orm/pg-core`. TypeScript compilation failed with `TS2305: Module '"drizzle-orm/pg-core"' has no exported member 'sql'`.
- **Fix:** Split imports — `sql` from `drizzle-orm`, everything else from `drizzle-orm/pg-core`
- **Files modified:** server/src/db/schema.ts
- **Verification:** `npx tsc --project server/tsconfig.json --noEmit` exits 0
- **Committed in:** 9df0416 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — import bug in plan's code sample)
**Impact on plan:** Fix was necessary for TypeScript compilation. No scope creep, no behavioral change.

## Issues Encountered

None beyond the auto-fixed import bug above.

## User Setup Required

None - no external service configuration required. This is a schema-only change; migrations will be run in a later phase.

## Next Phase Readiness

- Phase 22 (Better Auth Core): users, sessions, accounts, verification tables are defined with exact column names Better Auth expects. Ready for `betterAuth()` configuration.
- Phase 24 (Secret Ownership): secrets.userId FK and partial index are in place. Ready for migration generation and service layer updates.
- `drizzle-kit generate` will produce the migration for all five tables. Drizzle bug #4147 may require splitting FK + column additions into two migration steps — verify generated SQL before applying.

---
*Phase: 21-schema-foundation*
*Completed: 2026-02-19*
