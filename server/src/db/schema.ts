import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro']);

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
 *   DB — secrets table:       secrets.user_id is nullable FK; secrets.id is never stored in users, sessions, or accounts rows
 *   DB — users table:         No secret_id or last_secret_id column. User rows contain no secret identifiers.
 *   Logger:                   server/src/middleware/logger.ts redacts secret IDs from URL paths via regex
 *   Analytics:                PostHog sanitize_properties must strip URL fragments before any event fires — Phase 25
 *   Logger — dashboard route: redactUrl regex extended to cover /api/dashboard/secrets/:id paths — Phase 23
 *   Email (Resend):           notification email body contains only viewed-at timestamp; no secretId, label, or ciphertext — Phase 26
 *   Rate limits + prompts:    429 responses and conversion prompt events contain no userId or secretId — Phase 27
 *   Stripe billing:         webhook handler receives stripe_customer_id; activatePro/deactivatePro look up by stripe_customer_id only — no code path joins userId + secretId — Phase 34
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
  /** Stripe customer ID for billing — nullable until user initiates checkout (Phase 34) */
  stripeCustomerId: text('stripe_customer_id'),
  /** Subscription tier — 'free' by default, 'pro' after successful payment (Phase 34) */
  subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('free'),
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
 * Status persistence via soft-delete: user-owned secrets update status on view/expire/delete;
 * anonymous secrets hard-delete (unchanged).
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

    /** Optional user-provided label for dashboard display (max 100 chars enforced at API layer) */
    label: text('label'),

    /** Per-secret email notification opt-in; off by default. Phase 26 sends the email. */
    notify: boolean('notify').notNull().default(false),

    /** Lifecycle status. 'active' = unviewed; 'viewed' = consumed; 'expired' = past expiresAt;
     *  'deleted' = owner pre-deleted via dashboard. User-owned rows soft-delete; anonymous rows hard-delete. */
    status: text('status').notNull().default('active'),

    /** Timestamp when secret was viewed and consumed. NULL until viewed. */
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
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
