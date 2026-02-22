---
status: complete
phase: 21-schema-foundation
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md
started: 2026-02-19T12:29:06Z
updated: 2026-02-19T12:32:00Z
---

## Current Test

[testing complete]

## Tests

### 1. TypeScript compiles clean
expected: Run `npx tsc --project server/tsconfig.json --noEmit` — exits 0 with no errors. Schema changes (new tables, sql import split) are type-correct.
result: pass

### 2. Auth tables exist in PostgreSQL
expected: Run `npm run db:migrate` (or inspect via psql `\dt`) — users, sessions, accounts, and verification tables all exist in the database.
result: pass

### 3. secrets.user_id is nullable FK
expected: The secrets table has a user_id column that is nullable (allows NULL) and references users.id. Existing secrets rows are unaffected (user_id = NULL).
result: pass

### 4. Migration files split correctly
expected: `drizzle/0001_add_auth_tables.sql` creates the auth tables; `drizzle/0002_add_secrets_user_id.sql` has ADD COLUMN user_id before ADD CONSTRAINT (bug #4147 workaround). Both files exist.
result: pass

### 5. INVARIANTS.md exists with rule
expected: `.planning/INVARIANTS.md` exists and documents the zero-knowledge rule: no DB record, log line, or analytics event may contain both userId and secretId in the same payload.
result: pass

### 6. CLAUDE.md has Zero-Knowledge section
expected: `CLAUDE.md` has a "Zero-Knowledge Invariant (Hard Convention)" section with MANDATORY CHECK wording directing future sessions to read INVARIANTS.md before writing DB/logging/analytics code.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
