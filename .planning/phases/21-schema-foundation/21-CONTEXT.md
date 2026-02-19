# Phase 21: Schema Foundation - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the database schema to support user accounts and secret ownership metadata. Deliverables: a `users` table compatible with Better Auth, a nullable `user_id` FK on `secrets`, and the zero-knowledge invariant formally documented. No auth logic, no session handling, no UI — those are Phase 22+.

</domain>

<decisions>
## Implementation Decisions

### Invariant documentation
- Document the zero-knowledge invariant in **all three locations**: (1) a prominent block comment in `server/src/db/schema.ts`, (2) `CLAUDE.md` as a hard convention that future sessions must check before writing any DB or logging code, and (3) `.planning/PROJECT.md` or a dedicated `INVARIANTS.md` in `.planning/`
- The documented rule must state **both** the abstract invariant ("no record, log line, or analytics event may contain both `userId` and `secretId` in the same payload") **and** a concrete enumeration of the specific tables, columns, and systems where it currently applies (secrets.user_id, Pino logger redaction, PostHog events)
- The enumeration must be written so it can be extended as new tables/systems are added in Phases 22–27

### Claude's Discretion
- **DB-level enforcement:** Claude decides whether to add a CHECK constraint, trigger, or database comment to enforce the invariant, or rely on code-level enforcement + documentation — whichever is simpler given PostgreSQL and Drizzle constraints
- **Better Auth schema ownership:** Claude decides whether to define Better Auth's tables (user, session, account, verification) in our `schema.ts` for Drizzle-managed migrations, or let Better Auth manage its own tables separately — prioritize whichever gives cleaner referential integrity on `secrets.user_id`
- **Real FK constraint:** If Better Auth tables live outside Drizzle, Claude decides whether to use a real PG FK or an application-level reference for `secrets.user_id`, based on what's achievable
- **Migration scope:** Claude decides whether Phase 21 creates all auth-related tables upfront or only adds `secrets.user_id` (deferring users/sessions to Phase 22) — whichever minimizes phase coupling and migration risk
- **Users table extra fields:** Claude adds only what the v4.0 feature set requires; avoid speculative columns
- **Rate limit storage:** Claude picks Redis-only or DB-backed based on existing rate-limit architecture; no opinion from user
- **Notification preferences:** Claude decides whether a global user preference column makes sense in phase 21 or defers to Phase 26's per-secret column
- **Index strategy:** Claude designs indexes for user-scoped queries on `secrets` (sort order, status filtering, partial index consideration) based on expected dashboard access patterns
- **Label column timing:** Claude decides whether `secrets.label` is added in Phase 21 (alongside user_id) or deferred to Phase 23 — whichever minimizes schema churn

</decisions>

<specifics>
## Specific Ideas

- The zero-knowledge rule is already referenced in `STATE.md` and `CLAUDE.md`'s Key Design Decisions — phase 21's documentation should be the authoritative, comprehensive version that those references point to
- Drizzle bug #4147 workaround is a hard requirement: if drizzle-kit generates a migration that adds a FK and a column in the same step, split into two separate migration files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-schema-foundation*
*Context gathered: 2026-02-18*
