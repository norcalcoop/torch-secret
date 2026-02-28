import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';
import { secrets } from './db/schema.js';
import { resend } from './services/email.js';
import { env } from './config/env.js';
import { loops } from './config/loops.js';
import { enrollInOnboardingSequence } from './services/onboarding.service.js';
import { logger } from './middleware/logger.js';

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
 * See: .planning/INVARIANTS.md
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
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSessionData = typeof auth.$Infer.Session.session;
