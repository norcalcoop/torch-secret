import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

/**
 * Secrets table: stores encrypted blobs with expiration metadata.
 *
 * The server never sees plaintext -- only base64-encoded ciphertext from Phase 1.
 * Secrets are atomically destroyed on first retrieval (zero-then-delete pattern).
 */
export const secrets = pgTable('secrets', {
  /** 21-char nanoid, generated at application layer */
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),

  /** Base64-encoded ciphertext blob (IV + ciphertext + auth tag) */
  ciphertext: text('ciphertext').notNull(),

  /** When this secret expires (1h, 24h, 7d, or 30d from creation) */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /** Creation timestamp for metadata */
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),

  /** Argon2id hash of optional password (Phase 5) */
  passwordHash: text('password_hash'),

  /** Password attempt counter for auto-destroy after 3 failures (Phase 5) */
  passwordAttempts: integer('password_attempts').default(0).notNull(),
});

/** Row type returned from SELECT queries */
export type Secret = typeof secrets.$inferSelect;

/** Row type for INSERT operations */
export type NewSecret = typeof secrets.$inferInsert;
