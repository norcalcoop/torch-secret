import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq, and, not } from 'drizzle-orm';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';
import { secrets, accounts } from './db/schema.js';
import { resend } from './services/email.js';
import { env } from './config/env.js';
import { loops } from './config/loops.js';
import { enrollInOnboardingSequence } from './services/onboarding.service.js';
import { logger } from './middleware/logger.js';
import { fireAuditEvent } from './services/audit.service.js';

/**
 * In-memory set of userIds that were JUST created via sign-up.
 * Better Auth fires user.create.after before session.create.after in the sign-up flow.
 * When session.create.after fires for a sign-up, the userId will be in this set.
 * We consume it (delete) to prevent writing sign_in for a sign-up-triggered session.
 *
 * This is safe in a single-process deployment. In multi-process (clustered) deployments,
 * race conditions are theoretically possible but negligible — the worst case is one extra
 * sign_in row for an OAuth sign-up, which is acceptable. Phase 70.
 */
const justSignedUpUserIds = new Set<string>();

/**
 * Rewrites a Better Auth-generated URL so its origin (and any embedded
 * callbackURL param) points at APP_URL instead of BETTER_AUTH_URL.
 *
 * In dev, BETTER_AUTH_URL=:3000 but users should land on Vite (:5173).
 * In production both vars share the same origin, making this a no-op.
 */
function toAppUrl(url: string): string {
  if (!env.APP_URL) return url;
  const target = new URL(env.APP_URL);
  const parsed = new URL(url);
  parsed.protocol = target.protocol;
  parsed.host = target.host;
  const callbackParam = parsed.searchParams.get('callbackURL');
  if (callbackParam) {
    try {
      const cb = new URL(callbackParam);
      cb.protocol = target.protocol;
      cb.host = target.host;
      parsed.searchParams.set('callbackURL', cb.toString());
    } catch {
      // relative path — leave as-is
    }
  }
  return parsed.toString();
}

/**
 * ZERO-KNOWLEDGE INVARIANT — read before modifying this file.
 * See: INVARIANTS.md
 *
 * The session object contains userId. No auth hook, middleware, or route may combine
 * res.locals.user.id with a secretId in the same log line, DB record, or API response.
 * These two identifiers must remain permanently separated across all systems.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      // Better Auth uses singular model names internally; our tables are plural.
      // With usePlural: true, Better Auth appends 's' when resolving model names to schema keys.
      // This means it looks for "users", "sessions", "accounts", "verifications" — but our
      // schema object has keys "users", "sessions", "accounts", "verification" (no trailing 's').
      //
      // Explicit mappings resolve all naming mismatches:
      //   Better Auth "user" -> appends 's' -> looks for "users" -> found via ...schema
      //   Better Auth "verification" -> appends 's' -> looks for "verifications" -> NOT in schema
      //     Workaround: provide "verifications" key pointing to schema.verification table
      user: schema.users,
      verifications: schema.verification,
    },
    usePlural: true,
  }),

  emailAndPassword: {
    enabled: true,
    // Bypass email verification in test env — test users cannot receive real emails
    requireEmailVerification: env.NODE_ENV !== 'test',
    minPasswordLength: 8,
    sendResetPassword: ({ user, url }) => {
      // Audit: password_reset_requested — no ip_hash (no req object in this callback)
      // Audit hooks log only userId — no secretId ever appears in audit_logs (Phase 70)
      fireAuditEvent({ eventType: 'password_reset_requested', userId: user.id });
      // void fires email without awaiting — avoids timing attacks that leak email existence
      void resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Reset your Torch Secret password',
        text: `Click to reset your password: ${toAppUrl(url)}\n\nIf you did not request this, you can ignore this email.`,
      });
      return Promise.resolve();
    },
  },

  emailVerification: {
    sendVerificationEmail: ({ user, url }) => {
      void resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Verify your Torch Secret email',
        text: `Click to verify your email: ${toAppUrl(url)}\n\nIf you did not create an account, you can ignore this email.`,
      });
      return Promise.resolve();
    },
    sendOnSignIn: true,
  },

  /**
   * SECURITY AUDIT (Phase 40, Item #10, SR-004): OAuth account-linking behavior
   *
   * Finding: Better Auth 1.x does NOT automatically link an OAuth account to an
   * existing email/password account without explicit user consent. The default
   * behavior requires a separate sign-in flow — an OAuth provider claiming an
   * existing email address cannot silently take over a pre-existing account.
   *
   * Evidence: No `account.accountLinking.trustedProviders` config is present in
   * this betterAuth() call. Better Auth's linkAccountOnSignIn default is false.
   * Two accounts with the same email but different providers remain separate
   * unless the user explicitly links them via the account linking API.
   *
   * Action required: None. Default behavior is secure.
   * Re-audit trigger: If account.accountLinking is added to this config in the
   * future, ensure trustedProviders is carefully scoped and re-verification
   * (requireEmailVerification on linking) is enforced.
   */
  socialProviders: {
    // Only include Google provider when env vars are defined
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    // Only include GitHub provider when env vars are defined
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  trustedOrigins: [env.BETTER_AUTH_URL, ...(env.APP_URL ? [env.APP_URL] : [])],

  advanced: {
    // Supertest (used in integration tests) sends no Origin or Sec-Fetch-* headers,
    // which triggers Better Auth's CSRF check and returns 403. Disable in test env only.
    disableCSRFCheck: env.NODE_ENV === 'test',
  },

  user: {
    additionalFields: {
      marketingConsent: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true, // allows client to pass value during signUp.email()
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        // Step 1: GDPR — delete Loops contact (best-effort; deletion must succeed even if Loops is down)
        // Pass only email — userId field in Loops API refers to external system ID, not our Better Auth userId
        await loops.deleteContact({ email: user.email }).catch((err: unknown) => {
          // ZK invariant: log only err.message — no userId alongside email in the same log line
          logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            'Loops deleteContact failed on account deletion',
          );
        });

        // Step 2: ZK invariant — null secrets.user_id so existing shared links keep working
        // FK is onDelete:'set null' (defense-in-depth: explicit null-out covers new secrets created
        // between the beforeDelete call and the actual user row deletion)
        await db.update(secrets).set({ userId: null }).where(eq(secrets.userId, user.id));
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: (user) => {
          // Audit: sign_up — no ip_hash (databaseHook has no req context)
          // Audit hooks log only userId — no secretId ever appears in audit_logs (Phase 70)
          fireAuditEvent({ eventType: 'sign_up', userId: user.id });
          // Mark this userId so session.create.after can skip writing sign_in for the
          // auto-created session that Better Auth creates immediately after sign-up.
          justSignedUpUserIds.add(user.id);
          // Fire-and-forget: registration must succeed even if Loops is down.
          // Cast user to access additionalFields — Better Auth's inferred hook types
          // may not include additionalFields without explicit type augmentation.
          const userWithConsent = user as typeof user & { marketingConsent?: boolean };
          void enrollInOnboardingSequence({
            email: user.email,
            name: user.name,
            marketingConsent: userWithConsent.marketingConsent ?? false,
            subscriptionTier: 'free', // new users are always free tier
          }).catch((err: unknown) => {
            // ZK invariant: log only err.message — no userId, no email in the same log line
            logger.error(
              { err: err instanceof Error ? err.message : String(err) },
              'Loops onboarding enrollment failed',
            );
          });
          return Promise.resolve();
        },
      },
    },
    account: {
      create: {
        after: (account) => {
          // Only fire for OAuth accounts — skip email/password ('credential') provider
          if (account.providerId !== 'credential') {
            fireAuditEvent({
              eventType: 'oauth_connect',
              userId: account.userId,
              metadata: { provider: account.providerId },
            });
          }
          return Promise.resolve();
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // Determine if this session was created by email/password sign-in
          // vs sign-up or OAuth sign-in.
          //
          // Sign-up also creates a session immediately after user creation.
          // user.create.after fires first and adds userId to justSignedUpUserIds.
          // Consume the flag here — if it was present, this is the sign-up session (skip).
          if (justSignedUpUserIds.delete(session.userId)) {
            // Session was created as part of sign-up — sign_up hook already recorded the event
            return;
          }

          // OAuth sign-in also creates an account row (providerId != 'credential').
          // Check: if user has any non-credential account, skip sign_in event
          // (oauth_connect from account.create.after already captured it).
          //
          // Known limitation: once a user has linked an OAuth provider, email sign-in events
          // will NOT be recorded (to avoid double-counting with oauth_connect). This is a
          // conscious tradeoff — tracking the exact sign-in method requires Better Auth internals
          // not currently exposed via databaseHooks. Phase 70.
          const oauthAccounts = await db
            .select({ id: accounts.id })
            .from(accounts)
            .where(
              and(eq(accounts.userId, session.userId), not(eq(accounts.providerId, 'credential'))),
            );
          // If no OAuth accounts exist, this was an email/password sign-in
          if (oauthAccounts.length === 0) {
            fireAuditEvent({ eventType: 'sign_in', userId: session.userId });
          }
        },
      },
      delete: {
        after: (session) => {
          fireAuditEvent({ eventType: 'logout', userId: session.userId });
          return Promise.resolve();
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSessionData = typeof auth.$Infer.Session.session;
