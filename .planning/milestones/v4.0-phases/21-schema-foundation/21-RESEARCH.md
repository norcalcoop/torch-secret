# Phase 21: Schema Foundation - Research

**Researched:** 2026-02-18
**Domain:** PostgreSQL schema extension, Drizzle ORM migrations, Better Auth schema compatibility, zero-knowledge invariant documentation
**Confidence:** HIGH (core schema patterns verified via Context7 and official docs; bug workaround verified against GitHub issue)

## Summary

Phase 21 is a pure schema + documentation phase: extend the existing Drizzle/PostgreSQL schema to support user accounts and secret ownership metadata, apply migrations safely, and formally document the zero-knowledge invariant as a hard constraint that all future phases must uphold.

The key architectural question — "should Better Auth tables live in our Drizzle schema or be managed separately?" — has a clear answer: **define all four Better Auth tables (user, session, account, verification) in our `schema.ts` and manage them with drizzle-kit migrations.** This is the only approach that gives us a real PostgreSQL FK constraint on `secrets.user_id`. The alternative (letting Better Auth self-manage its tables) produces application-level references only, which are weaker and harder to enforce. The Better Auth Drizzle adapter explicitly supports this model and includes `--output` CLI flag to direct generated schema to a specific file.

The Drizzle bug #4147 (FK + column addition in same migration step generating incorrect SQL) was originally reported for SQLite but applies structurally to PostgreSQL as well when drizzle-kit emits `ADD COLUMN` and `ADD CONSTRAINT FOREIGN KEY` in the wrong order within a single migration. The workaround is simple: inspect the generated `.sql` file after `npm run db:generate` and manually split into two separate migration files if both operations appear in the same file. drizzle-kit 0.31.9 (the version in use) does not have the beta fix applied yet.

**Primary recommendation:** Define all Better Auth tables + `secrets.user_id` in a single schema change. Generate migrations. Inspect the generated SQL file — if `ADD COLUMN "user_id"` and `ADD CONSTRAINT ... FOREIGN KEY` appear in the same file, manually split into `0001_add_users_tables.sql` (creates users/sessions/accounts/verification) and `0002_add_secrets_user_id.sql` (adds the FK column to secrets). Update the drizzle migration journal accordingly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Invariant documentation
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 (installed) | Schema definition, typed queries | Already in project; all existing tables use it |
| drizzle-kit | 0.31.9 (installed) | Migration generation and application | Already in project; `drizzle.config.ts` points to `server/src/db/schema.ts` |
| better-auth | 1.4.18 (latest npm) | Auth framework with Drizzle adapter | Phase 22 dependency — tables must exist before Phase 22 installs it |
| pg (node-postgres) | 8.18.0 (installed) | PostgreSQL driver | Already in project |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `better-auth/adapters/drizzle` | Ships inside `better-auth` package | Needed in Phase 22; schema shape must match what the adapter expects |
| `@better-auth/cli` | Schema generation tool | Optional — use `npx @better-auth/cli@latest generate --output ...` to see what tables Better Auth needs, then hand-merge into our schema.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle-managed Better Auth tables | Better Auth self-manages (adapter auto-migrate) | Self-managed = no real FK on `secrets.user_id`; Drizzle-managed = real FK, migration history, type safety |
| All tables in one migration | Split migrations (users first, FK second) | Bug #4147 may require splitting; splitting is always safe; combined is risky |
| `secrets.label` in Phase 21 | Defer label to Phase 23 | Phase 23 dashboard is where label is needed; adding it in 21 causes schema churn if the column signature changes; defer to Phase 23 |

**Installation for Phase 22 (not Phase 21):**
```bash
npm install better-auth
```
Phase 21 only modifies `schema.ts` and generates SQL migrations. `better-auth` is installed in Phase 22.

---

## Architecture Patterns

### Recommended Project Structure (after Phase 21)

```
server/src/db/
├── schema.ts           # All tables: secrets + users + sessions + accounts + verification
├── connection.ts       # Drizzle instance (no changes needed)
└── migrate.ts          # Migration runner (no changes needed)

drizzle/
├── meta/
│   ├── _journal.json   # Updated with new migration entries
│   ├── 0000_snapshot.json
│   └── 0001_snapshot.json   (new)
├── 0000_youthful_blacklash.sql   (existing — secrets table)
├── 0001_add_auth_tables.sql      (new — users, sessions, accounts, verification)
└── 0002_add_secrets_user_id.sql  (new — nullable user_id FK on secrets)

.planning/
├── INVARIANTS.md       (new — authoritative invariant documentation)
└── PROJECT.md          (update: add pointer to INVARIANTS.md)

CLAUDE.md               (update: add Zero-Knowledge Invariant hard convention section)
```

### Pattern 1: Better Auth Tables in Drizzle Schema (Recommended)

**What:** Define the four Better Auth tables (`users`, `sessions`, `accounts`, `verification`) directly in `server/src/db/schema.ts` using Drizzle's `pgTable`. The Better Auth Drizzle adapter then maps its internal model names to your table exports via the `schema` option.

**When to use:** Always — this gives real PostgreSQL FK constraints, migration history, and Drizzle type safety.

**Example (from Context7 — Better Auth official Drizzle schema):**
```typescript
// Source: https://context7.com/better-auth/better-auth/llms.txt
import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),   // email/password login hash lives here
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_user_id_idx').on(table.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);
```

**Note on table naming:** Better Auth's internal model is named `user` (singular). Our table is named `users` (plural). The Drizzle adapter handles this via either `usePlural: true` or explicit schema mapping in Phase 22's auth config:
```typescript
// Phase 22 concern — but schema must be named consistently now
drizzleAdapter(db, {
  provider: 'pg',
  schema: { ...schema, user: schema.users },
})
```

### Pattern 2: Nullable FK Column on Secrets (the zero-knowledge-safe approach)

**What:** Add `user_id text` as a nullable foreign key on `secrets` referencing `users.id`. NULL = anonymous secret. Non-null = owned by an account user.

**Why nullable (not NOT NULL):** All existing anonymous secrets must remain valid. Making the column nullable is an additive-only change — existing rows get `user_id = NULL`, no data migration needed.

**Example:**
```typescript
// Source: derived from Drizzle FK pattern (orm.drizzle.team/docs/indexes-constraints)
// Add to secrets table definition:
userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

// Add composite index for dashboard queries:
// (table) => [
//   index('secrets_user_id_created_at_idx').on(table.userId, table.createdAt.desc()),
// ]
```

**`onDelete: 'set null'`:** When a user account is deleted, their secrets become anonymous (user_id → NULL) rather than being cascade-deleted. This preserves the integrity of already-shared links.

### Pattern 3: Partial Index for User-Scoped Dashboard Queries

**What:** A standard index on `(user_id, created_at DESC)` covers dashboard list queries. A partial index `WHERE user_id IS NOT NULL` provides a smaller, faster index for queries that only touch owned secrets.

**Drizzle syntax for partial index:**
```typescript
// Source: orm.drizzle.team/docs/indexes-constraints (Advanced Indexing API)
import { index, sql } from 'drizzle-orm';

// In pgTable second argument:
(table) => [
  index('secrets_user_id_created_at_idx')
    .on(table.userId, table.createdAt.desc())
    .where(sql`${table.userId} IS NOT NULL`),
]
```

**Recommendation:** Use the partial index. The `secrets` table will grow to include all anonymous secrets (the vast majority). A partial index restricted to `user_id IS NOT NULL` is physically smaller and hit by every dashboard query. The planner will prefer it over a full index on `(user_id, created_at)` for authenticated queries.

### Pattern 4: Migration Splitting (Drizzle Bug #4147 Workaround)

**What:** After running `npm run db:generate`, inspect the generated `.sql` file. If it contains both `ADD COLUMN "user_id"` and `ALTER TABLE "secrets" ADD CONSTRAINT ... FOREIGN KEY` in the same file, manually split into two files.

**Why:** drizzle-kit 0.31.9 may emit both statements in a single migration but in the wrong order (constraint before column exists). The beta fix is in `drizzle-orm@beta` / `drizzle-kit@beta`, not in the `0.31.9` stable release.

**Migration split procedure:**

Step 1 — File `drizzle/0001_add_auth_tables.sql`:
```sql
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  ...
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (...);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (...);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (...);
--> statement-breakpoint
-- FK constraints between auth tables (sessions->users, accounts->users)
ALTER TABLE "sessions" ADD CONSTRAINT ...;
ALTER TABLE "accounts" ADD CONSTRAINT ...;
```

Step 2 — File `drizzle/0002_add_secrets_user_id.sql`:
```sql
--> statement-breakpoint
ALTER TABLE "secrets" ADD COLUMN "user_id" text;
--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "secrets_user_id_created_at_idx" ON "secrets" ("user_id", "created_at" DESC)
  WHERE "user_id" IS NOT NULL;
```

**Journal update:** After splitting, update `drizzle/meta/_journal.json` to include both entries with sequential `idx` values.

### Anti-Patterns to Avoid

- **Better Auth self-managed tables:** Never let Better Auth auto-create its own tables via its internal migrate command. This bypasses Drizzle's migration journal and breaks referential integrity with `secrets.user_id`.
- **Using `@better-auth/cli generate` to regenerate schema.ts:** The CLI **overwrites** the entire schema file (issue #5874). It cannot merge with existing tables. Use the CLI output only as a reference to cross-check column names, not as a generator to run against the live schema file.
- **NOT NULL on `secrets.user_id`:** Never add the FK column as NOT NULL in Phase 21 — this would require a data migration to populate existing rows and break anonymous secret creation.
- **CASCADE DELETE on `secrets.user_id`:** Do not use `onDelete: 'cascade'`. If a user deletes their account, their secrets should become anonymous (set null), not deleted. Already-shared links must remain valid.
- **Storing `label` in Phase 21:** The `secrets.label` column is a Phase 23 concern (dashboard display). Adding it now means two separate migrations touching `secrets` within 3 phases, which creates schema churn. Defer to Phase 23.
- **Storing `notificationEnabled` in Phase 21:** Phase 26 adds per-secret notification preference. The column is only meaningful when email infrastructure exists. Defer to Phase 26.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Better Auth table schema | Custom user/session tables | Copy from Better Auth's Drizzle snapshots (Context7 verified) | Columns must match exactly what `better-auth/adapters/drizzle` expects at runtime |
| Migration generation | Write SQL migrations by hand | `npm run db:generate` then inspect/split | drizzle-kit handles snapshot diffing and journal management |
| FK referential integrity | Application-level user_id validation | Real PostgreSQL FK constraint | DB enforces integrity even if app code has bugs |
| Zero-knowledge invariant enforcement | Custom DB trigger or rule | Documentation + code convention + linting | PostgreSQL has no native "never combine two column values in a log" constraint; code layer is the correct enforcement boundary |

**Key insight:** The zero-knowledge invariant ("no record may contain both userId and secretId") cannot be enforced at the database level with a CHECK constraint or trigger — it applies across multiple systems (DB, logger, analytics). The correct enforcement boundary is code + documentation + code review. Document it authoritatively and ensure every relevant system references the canonical invariant document.

---

## Common Pitfalls

### Pitfall 1: Better Auth CLI Overwrites schema.ts
**What goes wrong:** Running `npx @better-auth/cli generate` outputs to `schema.ts` and overwrites the existing `secrets` table definition and all custom columns.
**Why it happens:** The CLI generates a complete schema file, not a diff or append. GitHub issue #5874 confirms this is current behavior.
**How to avoid:** Do not run `npx @better-auth/cli generate` against `server/src/db/schema.ts`. Instead, use the Context7-verified column list (or run `npx @better-auth/cli generate --output /tmp/auth-schema.ts`) to generate a reference file, then manually add the Better Auth table definitions to the existing schema.ts.
**Warning signs:** Running the CLI without `--output` drops the `secrets` table from schema.ts; the next `db:generate` would emit `DROP TABLE secrets`.

### Pitfall 2: Drizzle Bug #4147 — Incorrect Migration Order
**What goes wrong:** drizzle-kit 0.31.9 may emit `ADD CONSTRAINT FOREIGN KEY` before `ADD COLUMN` in the same migration file, causing `ERROR: column "user_id" does not exist` when applying migrations.
**Why it happens:** drizzle-kit's migration generator does not always topologically sort DDL statements within a single migration file. The bug is confirmed in the GitHub issue; the fix is in `drizzle-kit@beta` only.
**How to avoid:** After `npm run db:generate`, open the generated SQL file and verify that `ADD COLUMN "user_id"` appears before `ADD CONSTRAINT`. If they are in the same file and in the wrong order, split into two files per the procedure in Pattern 4 above.
**Warning signs:** Generated SQL contains both `ADD COLUMN "user_id"` and `ADD CONSTRAINT ... FOREIGN KEY ("user_id")` in the same statement-breakpoint block.

### Pitfall 3: Mismatched Table/Column Names Break the Drizzle Adapter
**What goes wrong:** Better Auth's Drizzle adapter expects specific column names (camelCase in code, snake_case in DB). Using `user_id` in the DB column is correct; the Drizzle export property name must be `userId` (camelCase). Mismatches cause runtime errors in Phase 22 where the adapter cannot find expected columns.
**Why it happens:** Drizzle maps camelCase TypeScript properties to snake_case column names automatically, but Better Auth's adapter also has its own internal field map. Any deviation requires an explicit `fields` override in the auth config.
**How to avoid:** Follow the exact column names from the Context7-verified Better Auth Drizzle schema (see Pattern 1 above). Do not rename columns without consulting the adapter field mapping.
**Warning signs:** Better Auth throws `Column not found: email_verified` or similar at Phase 22 startup.

### Pitfall 4: `onDelete: 'cascade'` on secrets.user_id Destroys Shared Links
**What goes wrong:** If user account deletion cascades to `secrets`, all secrets the user ever created are permanently deleted — including links already shared with recipients who haven't viewed them yet.
**Why it happens:** Developer instinct is to cascade-delete to avoid orphaned rows.
**How to avoid:** Use `onDelete: 'set null'` on `secrets.user_id`. Orphaned rows with `user_id = NULL` are perfectly valid anonymous secrets and do not need to be cleaned up.
**Warning signs:** Accidentally applied CASCADE; the expiration worker will clean up expired secrets, so orphaned rows are not a long-term problem if caught early.

### Pitfall 5: Zero-Knowledge Invariant Documentation Is Incomplete
**What goes wrong:** The invariant is documented in only one location (e.g., schema.ts comment only), so future sessions miss it when writing logging code or analytics events.
**Why it happens:** Documentation written in one place rarely propagates to all relevant touch points.
**How to avoid:** Document in all three locked locations: `schema.ts` block comment, `CLAUDE.md` hard convention section, `.planning/INVARIANTS.md`. Cross-reference all three. The INVARIANTS.md must be the canonical source with the full enumeration; the other two must cite it.
**Warning signs:** A future phase's implementation plan does not mention the invariant at all.

### Pitfall 6: Rate Limiting Architecture Not Changed
**What goes wrong:** Phase 27 tightens anonymous vs. authenticated rate limits. If Phase 21 mistakenly changes rate limit storage (e.g., DB-backed), it creates unnecessary coupling.
**How to avoid:** The existing Redis-backed / MemoryStore fallback architecture is correct for Phase 21. Rate limit storage should not change in Phase 21. Leave `server/src/middleware/rate-limit.ts` entirely untouched in this phase.

---

## Code Examples

Verified patterns from official sources:

### Complete users Table (PostgreSQL, Better Auth-compatible)
```typescript
// Source: Context7 /better-auth/better-auth — verified against official Better Auth Drizzle snapshots
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),                                    // Better Auth generates IDs
  name: text('name').notNull(),                                   // display name
  email: text('email').notNull().unique(),                        // login identifier
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),                                           // avatar URL (nullable)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**What NOT to add speculatively:** `role`, `plan`, `stripeCustomerId`, `notificationPreferences` — all belong to Phase 22–27. The only columns Phase 21 needs are the ones Better Auth requires at runtime.

### Nullable FK on secrets (additive migration)
```typescript
// Source: Drizzle ORM FK pattern (orm.drizzle.team/docs/indexes-constraints)
// Added to existing secrets pgTable definition:
userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
```

The `users` table must be declared before `secrets` in `schema.ts` for the forward reference to resolve at TypeScript compile time (or use a deferred reference pattern with `() =>` arrow function — already the Drizzle standard).

### Partial Index for Dashboard Queries
```typescript
// Source: orm.drizzle.team/docs/indexes-constraints (Advanced Indexing API)
import { index, sql } from 'drizzle-orm';

// Added to secrets pgTable second argument:
(table) => [
  index('secrets_user_id_created_at_idx')
    .on(table.userId, table.createdAt.desc())
    .where(sql`${table.userId} IS NOT NULL`),
]
```

### Drizzle Adapter Schema Mapping (Phase 22 reference, not Phase 21 code)
```typescript
// Source: Context7 /better-auth/better-auth — drizzle.mdx adapter docs
// This belongs in Phase 22's auth.ts, but schema.ts must be compatible now:
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,      // Better Auth uses singular "user" internally
    },
  }),
});
```

### Zero-Knowledge Invariant Block Comment (for schema.ts)
```typescript
/**
 * ZERO-KNOWLEDGE INVARIANT (canonical rule — see also CLAUDE.md and .planning/INVARIANTS.md)
 *
 * No database record, log line, or analytics event may contain BOTH a userId AND a secretId
 * in the same payload. These two identifiers must remain permanently separated.
 *
 * Rationale: Combining userId + secretId creates a deanonymization attack surface.
 * An attacker (or insider) with DB access could correlate which user created which secret,
 * violating the zero-knowledge security model.
 *
 * Current enforcement points:
 *   DB:        secrets.user_id is nullable; secrets.id is never stored in users or sessions
 *   Logger:    server/src/middleware/logger.ts redacts secret IDs from URL paths
 *   Analytics: PostHog events must strip URL fragments (sanitize_properties) — Phase 25
 *
 * To extend this list when adding new tables or systems, update .planning/INVARIANTS.md first,
 * then update this comment.
 */
```

---

## Discretion Decisions (Research Recommendations)

These are the "Claude's Discretion" items from CONTEXT.md. Based on research, here are the recommended answers:

### DB-level enforcement of invariant
**Recommendation: Documentation only — no CHECK constraint or trigger.**
The invariant ("no record may contain both userId and secretId in same payload") spans multiple systems (DB, logger, PostHog). A PostgreSQL trigger could catch DB-level violations but cannot enforce the logger or analytics constraint. A CHECK constraint on `secrets` cannot express cross-table logic. The correct enforcement is documentation (all three locations) + code review + potentially an ESLint rule in Phase 22+. Keep it simple; document it thoroughly.

### Better Auth schema ownership
**Recommendation: Define all four Better Auth tables in our `schema.ts`, managed by drizzle-kit.**
Rationale: This is the only way to get a real PostgreSQL FK on `secrets.user_id`. The Drizzle adapter's `schema` option maps our table exports to Better Auth's internal model names. The overhead is one-time (writing the table definitions) and the benefit is permanent (FK integrity, migration history, Drizzle type safety).

### Real FK constraint
**Recommendation: Real PostgreSQL FK.**
With Drizzle-owned Better Auth tables, this is trivially achievable. Use `references(() => users.id, { onDelete: 'set null' })` on `secrets.user_id`.

### Migration scope (all auth tables upfront vs. only user_id)
**Recommendation: Create ALL four auth tables in Phase 21, plus the `secrets.user_id` column.**
Rationale: Phase 22 (Authentication) is the very next phase and will immediately need `users`, `sessions`, `accounts`, and `verification` to exist. Creating only `secrets.user_id` without the `users` table would make the FK impossible to enforce. Creating all four auth tables now makes Phase 22 a code-only phase (no schema migrations needed), which reduces deployment risk and phase coupling.

### Rate limit storage
**Recommendation: No change — keep existing Redis-backed / MemoryStore fallback.**
The existing `server/src/middleware/rate-limit.ts` is correct for current requirements. Phase 27 will introduce authenticated vs. anonymous limit tiers; any storage change should happen there with context.

### Notification preferences column timing
**Recommendation: Defer to Phase 26.**
The per-secret `notificationEnabled` column only makes sense when email infrastructure (Resend) exists. Phase 26 adds that column alongside the email notification feature. Adding it in Phase 21 adds dead weight to every `CREATE SECRET` INSERT for 5 phases.

### Index strategy
**Recommendation: Single partial index on `(user_id, created_at DESC) WHERE user_id IS NOT NULL`.**
Dashboard queries always filter by `user_id` and sort by `created_at DESC` to show newest secrets first. A partial index (WHERE user_id IS NOT NULL) is smaller and avoids indexing the large anonymous secret population. No additional index is needed for Phase 21; Phase 23 can add status-filtering indexes if query analysis shows they are needed.

### Label column timing
**Recommendation: Defer to Phase 23.**
`secrets.label` is displayed only on the dashboard (Phase 23). Adding it in Phase 21 means the column sits empty until Phase 23 writes to it. More importantly, Phase 23 may need to refine the column signature (max length, nullable vs not-null with default, etc.) — deferring avoids a follow-up ALTER TABLE.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Better Auth self-managed tables (`npx auth migrate`) | Drizzle-owned tables with manual schema definition | Better Auth 1.x with Drizzle adapter | Full FK integrity, migration history |
| `drizzle-kit push` for dev schema changes | `drizzle-kit generate` + `drizzle-kit migrate` | Drizzle best practice for production | Explicit SQL files, reversible, reviewable |
| All tables in one migration | Split into multiple migration files for FK safety | drizzle-kit bug #4147 awareness | Avoids incorrect DDL ordering |
| `ZodSchema` generic type | `ZodType` | Zod 4.x (already in project) | Not applicable to Phase 21 |

**Deprecated/outdated:**
- `npx auth migrate` (Better Auth): Manages tables outside Drizzle — cannot coexist with Drizzle FK constraints on the same tables
- `drizzle-kit push`: Fine for local dev, but bypasses migration journal; never use in CI/production
- `better-auth` `advanced.generateId`: Removed in Better Auth 1.4 — use `advanced.database.generateId` (relevant to Phase 22, not Phase 21 schema)

---

## Open Questions

1. **Does the Better Auth Drizzle adapter require `updatedAt` to be auto-updating?**
   - What we know: Context7 snapshots show `$onUpdate(() => new Date())` on `updatedAt` for sessions and accounts tables. The official "llms.txt" schema (simpler) shows just `.defaultNow()` without `$onUpdate`.
   - What's unclear: Whether `$onUpdate` is required for the adapter to function, or whether it is just a best-practice recommendation.
   - Recommendation: Include `$onUpdate(() => new Date())` on `updatedAt` for all auth tables — it is the safer choice and matches all Better Auth CLI-generated schemas. Drizzle's `$onUpdate` is ORM-level only (does not add a DB trigger), so it is low-cost.

2. **Will drizzle-kit 0.31.9 actually trigger bug #4147 for our specific schema change?**
   - What we know: Bug #4147 was confirmed on drizzle-kit 0.30.4. The fix is in `drizzle-kit@beta`. The current project uses 0.31.9 (stable). The original bug report was SQLite-specific but the root cause (DDL ordering) applies to any dialect.
   - What's unclear: Whether 0.31.9 includes a partial fix for PostgreSQL.
   - Recommendation: After `npm run db:generate`, always inspect the generated SQL. If the FK and ADD COLUMN appear in the same file, split. The inspection step is a mandatory verification step regardless.

3. **Do `withTimezone: true` timestamps on Better Auth tables cause any conflict with existing `secrets` table timestamps?**
   - What we know: The existing `secrets` table uses `{ withTimezone: true }` on all timestamps. The Better Auth Context7 schema omits `withTimezone` in some examples, includes it in others.
   - What's unclear: Whether Better Auth's internal date handling differs between `timestamp` and `timestamptz`.
   - Recommendation: Use `{ withTimezone: true }` on all timestamps in the Better Auth tables for consistency with the existing `secrets` table. Better Auth stores UTC dates; `timestamptz` is always the correct PostgreSQL choice for UTC storage.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/better-auth/better-auth` — queried for: Drizzle adapter schema, all four table definitions, CLI behavior, schema mapping
- Context7 `/websites/orm_drizzle_team` — queried for: FK declaration patterns, index/partial index API, migration generation
- `server/src/db/schema.ts` (codebase) — existing schema shape confirmed
- `drizzle.config.ts` (codebase) — schema path, dialect, output dir confirmed
- `package.json` (codebase) — drizzle-orm 0.45.1, drizzle-kit 0.31.9, no better-auth yet

### Secondary (MEDIUM confidence)
- [Better Auth Drizzle Adapter docs](https://www.better-auth.com/docs/adapters/drizzle) — table name mapping, `schema` option, `usePlural` config
- [Better Auth Database Concepts](https://www.better-auth.com/docs/concepts/database) — four required tables, column list
- [Better Auth CLI docs](https://www.better-auth.com/docs/concepts/cli) — `--output` flag, Drizzle adapter generate behavior
- `npm view better-auth version` — confirmed 1.4.18 is latest stable
- [GitHub Issue #5874](https://github.com/better-auth/better-auth/issues/5874) — CLI generate overwrites existing schema (not merge-safe)

### Tertiary (LOW confidence)
- [GitHub Issue #4147](https://github.com/drizzle-team/drizzle-orm/issues/4147) — Bug confirmed; fix in `drizzle-kit@beta`. Status: **closed as completed** but fix not yet in stable 0.31.9 (needs verification by inspecting generated SQL)
- WebSearch results for drizzle-kit 0.31.x PostgreSQL FK ordering — no definitive confirmation that 0.31.9 includes the fix; treat as potentially unresolved until SQL inspection confirms

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from package.json; all libraries already installed except better-auth
- Architecture (schema patterns): HIGH — Better Auth column names verified via Context7 against official Drizzle snapshots
- Architecture (migration strategy): MEDIUM — split migration workaround is well-reasoned; exact behavior of drizzle-kit 0.31.9 not fully confirmed
- Pitfalls: HIGH — CLI overwrite behavior confirmed (GitHub issue), FK onDelete semantics are standard PostgreSQL
- Discretion decisions: HIGH — all recommendations follow from verified constraints (FK needs users table, label not yet needed, etc.)

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (drizzle-kit and better-auth release cadence is fast; re-check if either releases a new minor version before planning)
