---
phase: 21-schema-foundation
verified: 2026-02-18T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 21: Schema Foundation Verification Report

**Phase Goal:** The database schema is extended to support user accounts and secret ownership metadata, with all migrations applied safely and the zero-knowledge invariant formally documented as a hard design constraint before any auth code is written
**Verified:** 2026-02-18
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | `users` table exists in schema with Better Auth-compatible columns | VERIFIED | Lines 23-34 of `server/src/db/schema.ts`: `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` — all Better Auth-compatible column names with `{ withTimezone: true }` |
| 2   | `secrets` table has nullable `user_id` FK — existing anonymous rows remain valid | VERIFIED | Line 124 of `schema.ts`: `userId: text('user_id').references(() => users.id, { onDelete: 'set null' })` — no `.notNull()` call; NULL means anonymous |
| 3   | Migration applies without downtime (additive-only) | VERIFIED | `0002_add_secrets_user_id.sql` uses `ADD COLUMN` (nullable, no default), then `ADD CONSTRAINT`. No destructive DDL. `npx tsc --project server/tsconfig.json --noEmit` exits 0. |
| 4   | Drizzle bug #4147 workaround applied: column addition and FK are in separate migration steps | VERIFIED | `0002_add_secrets_user_id.sql` line 1: `ADD COLUMN "user_id" text` — line 2: `ADD CONSTRAINT ... FOREIGN KEY`. Column precedes constraint. Split into dedicated file separate from auth tables migration. |
| 5   | Zero-knowledge invariant is documented: no code path may create a log/analytics/DB record containing both `userId` and `secretId` | VERIFIED | Three enforcement locations confirmed: (1) block comment at lines 5-21 of `schema.ts`, (2) `.planning/INVARIANTS.md` with full abstract rule + enforcement table + extension protocol, (3) `CLAUDE.md` lines 141-166 with hard convention section citing `INVARIANTS.md` |

**Score:** 5/5 truths verified

---

## Required Artifacts

### Plan 21-01: Schema Extension

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `server/src/db/schema.ts` | 5 tables + nullable FK + partial index + zero-knowledge comment | VERIFIED | All five tables exported (`users`, `sessions`, `accounts`, `verification`, `secrets`). `secrets.userId` nullable FK with `onDelete: 'set null'`. Partial index on `(userId, createdAt DESC) WHERE userId IS NOT NULL`. Zero-knowledge block comment at file top. All timestamps use `{ withTimezone: true }`. No speculative columns (`label`, `notificationEnabled`). |

### Plan 21-02: Migrations

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `drizzle/0001_add_auth_tables.sql` | DDL for 4 auth tables + FK constraints + indexes | VERIFIED | 4 `CREATE TABLE` statements (accounts, sessions, users, verification). `ALTER TABLE accounts/sessions ADD CONSTRAINT ... REFERENCES users(id) ON DELETE cascade`. `CREATE INDEX` for `accounts_user_id_idx` and `verification_identifier_idx`. No `ALTER TABLE secrets` present. |
| `drizzle/0002_add_secrets_user_id.sql` | `ADD COLUMN user_id` before `ADD CONSTRAINT` + partial index | VERIFIED | Line 1: `ADD COLUMN "user_id" text`. Line 2: `ADD CONSTRAINT ... ON DELETE set null`. Line 3: `CREATE INDEX ... WHERE "secrets"."user_id" IS NOT NULL`. Correct ordering confirmed. |
| `drizzle/meta/_journal.json` | 3 entries with sequential idx 0, 1, 2 | VERIFIED | idx 0: `0000_youthful_blacklash`, idx 1: `0001_add_auth_tables`, idx 2: `0002_add_secrets_user_id`. Sequential timestamps (when: 1771471077389, 1771471077390). |

### Plan 21-03: Documentation

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `.planning/INVARIANTS.md` | Canonical invariant doc with abstract rule, enforcement table, extension protocol | VERIFIED | Contains abstract rule ("No database record, log line, or analytics event may contain BOTH a `userId` AND a `secretId`"). Enforcement table with 4 rows (DB secrets, DB users, Logger, Analytics). Full extension protocol section. |
| `CLAUDE.md` | "Zero-Knowledge Invariant (Hard Convention)" section between "Conventions and Gotchas" and "Frontend UI/UX Workflow" | VERIFIED | Section appears at line 141. Correct placement: after line 130 ("Conventions and Gotchas"), before line 167 ("Frontend UI/UX Workflow"). Section cites `.planning/INVARIANTS.md` 3 times. |

---

## Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `schema.ts` `secrets.userId` | `schema.ts` `users.id` | `references(() => users.id, { onDelete: 'set null' })` | WIRED | Line 124 of `schema.ts` confirms exact call. `users` table declared before `secrets` (line 23 vs line 99) — forward reference valid. |
| `schema.ts` `sessions.userId` | `schema.ts` `users.id` | `references(() => users.id, { onDelete: 'cascade' })` | WIRED | Line 40 of `schema.ts`. `onDelete: 'cascade'` as required by Better Auth. |
| `0002_add_secrets_user_id.sql` `ADD COLUMN` | `0001_add_auth_tables.sql` `users` table | FK references `users` table which must exist first | WIRED | Migration sequencing enforced by journal idx ordering (0001 before 0002). `users` table created in 0001; FK added in 0002. |
| `drizzle/meta/_journal.json` | Both new migration files | Journal entries with matching tag names | WIRED | Tags `0001_add_auth_tables` and `0002_add_secrets_user_id` match file names exactly. Sequential idx (1, 2). |
| `CLAUDE.md` Zero-Knowledge section | `.planning/INVARIANTS.md` | Explicit citation directing future sessions to canonical source | WIRED | CLAUDE.md contains 3 references to `INVARIANTS.md` in the new section (lines 143, 163, 165). |
| `schema.ts` block comment | `.planning/INVARIANTS.md` | Cross-reference in zero-knowledge comment | WIRED | Line 6 of `schema.ts`: `see also CLAUDE.md and .planning/INVARIANTS.md`. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| INFRA-21-SCHEMA | 21-01-PLAN.md | Schema extension: 4 Better Auth tables + nullable user_id FK + partial index | SATISFIED | All five tables present in `schema.ts`. FK and partial index confirmed. TSC exits 0. |
| INFRA-21-MIGRATIONS | 21-02-PLAN.md | Migration files generated, bug #4147 workaround applied, journal updated | SATISFIED | `0001_add_auth_tables.sql` and `0002_add_secrets_user_id.sql` exist with correct content. Journal has 3 sequential entries. ADD COLUMN precedes ADD CONSTRAINT. |
| INFRA-21-DOCS | 21-03-PLAN.md | INVARIANTS.md created, CLAUDE.md updated with hard convention section | SATISFIED | Both files verified. All cross-references confirmed. No existing CLAUDE.md content removed. |

---

## Anti-Patterns Found

No anti-patterns detected across any of the four modified files (`server/src/db/schema.ts`, `drizzle/0001_add_auth_tables.sql`, `drizzle/0002_add_secrets_user_id.sql`, `.planning/INVARIANTS.md`).

Specific checks run:
- No `TODO`, `FIXME`, `XXX`, `HACK`, or `PLACEHOLDER` comments in any modified file
- No speculative columns (`label`, `notificationEnabled`, `role`, `plan`) in `schema.ts`
- No auto-named drizzle-kit slug files left over in `drizzle/` directory
- `0001_add_auth_tables.sql` contains no `ALTER TABLE secrets` statements (clean separation confirmed)

---

## Human Verification Required

### 1. Database Migration Application

**Test:** With a running PostgreSQL 17+ instance at `DATABASE_URL`, run `npm run db:migrate` from the project root.
**Expected:** Command exits 0. All three migrations apply (0000, 0001, 0002). After migration, `\d users` in psql shows the Better Auth columns. `\d secrets` shows a nullable `user_id` column with a FK constraint referencing `users(id)` ON DELETE SET NULL.
**Why human:** Migration execution requires a live PostgreSQL instance. Cannot verify programmatically without a running database.

### 2. Better Auth Compatibility Confirmation

**Test:** When Phase 22 installs `better-auth` and points it at this schema, run `better-auth db:check` or the equivalent initialization to confirm column names match what Better Auth expects.
**Expected:** No schema mismatch errors. Better Auth recognizes `users`, `sessions`, `accounts`, and `verification` as its core tables.
**Why human:** Cannot verify against Better Auth expectations without the package installed. This is a deferred integration check — the schema was designed against Better Auth documentation, but runtime compatibility is confirmed only in Phase 22.

---

## Summary

Phase 21 achieved its goal. All three plans delivered:

- **Plan 21-01 (Schema):** `server/src/db/schema.ts` exports all five tables with correct Better Auth column names. The `secrets.userId` nullable FK uses `onDelete: 'set null'` (not cascade). The partial index on `(userId, createdAt DESC) WHERE userId IS NOT NULL` is defined. The zero-knowledge invariant block comment precedes all table definitions. TypeScript compiles with zero errors.

- **Plan 21-02 (Migrations):** Two correctly named migration files exist. The Drizzle bug #4147 workaround is confirmed — `ADD COLUMN "user_id"` appears on line 1 of `0002_add_secrets_user_id.sql`, the FK `ADD CONSTRAINT` on line 2. The partial index with `WHERE "secrets"."user_id" IS NOT NULL` is present. The journal has 3 sequential entries (idx 0, 1, 2). No auto-named drizzle-kit leftovers remain.

- **Plan 21-03 (Docs):** `.planning/INVARIANTS.md` is a substantive canonical document covering abstract rule, rationale, scope, enforcement table (4 systems), and extension protocol. `CLAUDE.md` has the mandatory hard convention section in the correct position (after "Conventions and Gotchas", before "Frontend UI/UX Workflow"), with three citations to `INVARIANTS.md`. All three enforcement locations (schema.ts, INVARIANTS.md, CLAUDE.md) cross-reference each other.

The zero-knowledge invariant is formally documented and enforced structurally before any auth code is written. Phase 22 has a clean foundation.

---

_Verified: 2026-02-18_
_Verifier: Claude (gsd-verifier)_
