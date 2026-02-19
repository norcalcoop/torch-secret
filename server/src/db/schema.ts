import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

/**
 * ZERO-KNOWLEDGE INVARIANT — canonical rule (see also CLAUDE.md and .planning/INVARIANTS.md)
 *
 * No database record, log line, or analytics event may contain BOTH a userId AND a secretId
 * in the same payload. These two identifiers must remain permanently separated.
 *
 * Rationale: Combining userId + secretId creates a deanonymization attack surface.
 * An attacker (or insider) with DB/log access could correlate which user created which secret,
 * violating the zero-knowledge security model.
 *
 * Current enforcement points (update .planning/INVARIANTS.md when adding new systems):
 *   DB:        secrets.user_id is nullable; secrets.id is never stored in users or sessions rows
 *   Logger:    server/src/middleware/logger.ts redacts secret IDs from URL paths via regex
 *   Analytics: PostHog events must strip URL fragments (sanitize_properties) — Phase 25
 *
 * To extend this list: update .planning/INVARIANTS.md first, then update this comment.
 */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
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
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

/**
 * Secrets table: stores encrypted blobs with expiration metadata.
 *
 * The server never sees plaintext -- only base64-encoded ciphertext from Phase 1.
 * Secrets are atomically destroyed on first retrieval (zero-then-delete pattern).
 */
export const secrets = pgTable(
  'secrets',
  {
    /** 21-char nanoid, generated at application layer */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),

    /** Base64-encoded ciphertext blob (IV + ciphertext + auth tag) */
    ciphertext: text('ciphertext').notNull(),

    /** When this secret expires (1h, 24h, 7d, or 30d from creation) */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** Creation timestamp for metadata */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Argon2id hash of optional password (Phase 5) */
    passwordHash: text('password_hash'),

    /** Password attempt counter for auto-destroy after 3 failures (Phase 5) */
    passwordAttempts: integer('password_attempts').default(0).notNull(),

    /** Nullable FK to users.id — NULL means anonymous secret. onDelete: set null preserves
     *  already-shared links if user account is deleted. NEVER use cascade here. */
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    /** Partial index for dashboard queries: filter + sort by user, skip anonymous rows */
    index('secrets_user_id_created_at_idx')
      .on(table.userId, table.createdAt.desc())
      .where(sql`${table.userId} IS NOT NULL`),
  ],
);

/** Row type returned from SELECT queries */
export type Secret = typeof secrets.$inferSelect;

/** Row type for INSERT operations */
export type NewSecret = typeof secrets.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
