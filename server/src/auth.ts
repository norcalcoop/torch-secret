import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';
import { resend } from './services/email.js';
import { env } from './config/env.js';

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
      // Better Auth uses singular "user" internally; our table is plural "users"
      user: schema.users,
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
        subject: 'Reset your SecureShare password',
        text: `Click to reset your password: ${url}\n\nIf you did not request this, you can ignore this email.`,
      });
      return Promise.resolve();
    },
  },

  emailVerification: {
    sendVerificationEmail: ({ user, url }) => {
      void resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Verify your SecureShare email',
        text: `Click to verify your email: ${url}\n\nIf you did not create an account, you can ignore this email.`,
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

  trustedOrigins: [env.BETTER_AUTH_URL],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSessionData = typeof auth.$Infer.Session.session;
