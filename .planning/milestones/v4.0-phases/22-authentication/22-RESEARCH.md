# Phase 22: Authentication - Research

**Researched:** 2026-02-19
**Domain:** Better Auth 1.4.x, email/password auth, OAuth (Google + GitHub), session management, Resend email, Express 5 integration
**Confidence:** HIGH (core API verified via Context7 and official docs; pitfalls verified via GitHub issues)

---

## Summary

Phase 22 wires up Better Auth as the authentication layer on top of the schema Phase 21 created. The phase covers: installing `better-auth` and `resend`; creating a server-side `auth.ts` configuration; mounting the Better Auth handler in Express; building a session middleware for protected routes; adding four client-side pages (register, login, password-reset request, password-reset confirm); and covering the flows with integration tests.

The critical integration concern is **middleware ordering in `app.ts`**: `express.json()` must NOT precede the Better Auth handler — if it does, Better Auth cannot read the request body and requests hang indefinitely. Better Auth manages its own body parsing internally. The existing `app.ts` already places `express.json()` after early middleware, but the auth handler must be spliced in before the JSON parser.

Better Auth uses **scrypt** (not Argon2id) for password hashing internally. This does not conflict with the existing `password.service.ts` which uses Argon2id for *secret* passwords, because they are completely separate concerns. No change to `password.service.ts` is needed.

The Express 5 wildcard syntax for mounting the Better Auth handler is `/api/auth/*splat` (not the Express 4 `/api/auth/*`). The CSP in `security.ts` needs `connectSrc` expanded to allow `/api/auth/*` calls from the browser; no other Helmet changes are required.

**Primary recommendation:** Install `better-auth` and `resend`. Create `server/src/auth.ts` with the Drizzle adapter (mapping `users` table), email/password with verification, Google and GitHub OAuth, and Resend email callbacks. Mount the handler before `express.json()` in `app.ts`. Build a thin `requireAuth` middleware using `auth.api.getSession`. Add four new frontend pages in vanilla TS. Test with Supertest by capturing `better-auth.session_token` from sign-up/sign-in response headers.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can register with email and password | `betterAuth({ emailAndPassword: { enabled: true } })` + client `authClient.signUp.email()` |
| AUTH-02 | User receives email verification and must verify before accessing account features | `emailVerification.sendVerificationEmail` + `emailAndPassword.requireEmailVerification: true` + Resend for delivery |
| AUTH-03 | User can log in with email and password | `authClient.signIn.email()` client method; session cookie set automatically |
| AUTH-04 | User can reset password via email link | `emailAndPassword.sendResetPassword` + `authClient.requestPasswordReset()` + `authClient.resetPassword()` |
| AUTH-05 | User session persists across browser refreshes (Redis-backed server sessions) | Better Auth uses DB-backed sessions (PostgreSQL via Drizzle); session cookie persists across refreshes; Redis is NOT used for Better Auth sessions — Better Auth uses its own `sessions` table |
| AUTH-06 | User can sign in with Google via OAuth | `socialProviders.google: { clientId, clientSecret }` + `authClient.signIn.social({ provider: 'google' })` |
| AUTH-07 | User can sign in with GitHub via OAuth | `socialProviders.github: { clientId, clientSecret }` + `authClient.signIn.social({ provider: 'github' })` |
| AUTH-08 | User can log out and session is destroyed | `authClient.signOut()` — server deletes session row from DB |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-auth | 1.4.18 (latest) | Authentication framework: email/password, OAuth, sessions, DB adapter | Already chosen in Phase 21 schema; Drizzle adapter maps to Phase 21 tables |
| resend | 6.9.2 (latest) | Transactional email delivery | Already decided in phase requirements; simple Node.js SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-auth/adapters/drizzle` | (ships with better-auth) | Maps Better Auth's internal model to Drizzle tables | Required — our tables use plural names (`users` not `user`) |
| `better-auth/node` | (ships with better-auth) | `toNodeHandler`, `fromNodeHeaders` for Express integration | Required for Express handler mounting and server-side session reads |
| `better-auth/client` | (ships with better-auth) | Vanilla TypeScript client for browser — no framework dependency | Required since frontend is vanilla TS (not React) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-auth | Passport.js | Passport has no built-in session storage or OAuth PKCE; would require writing much more glue code |
| better-auth | Auth.js (NextAuth) | Auth.js is tightly coupled to Next.js; not viable for Express |
| resend | Nodemailer + SMTP | Resend is simpler, hosted, no SMTP server needed; Nodemailer requires an SMTP relay |
| better-auth/client | express-session + connect-redis | Phase description says "Redis-backed server sessions" but Better Auth sessions are DB-backed (PostgreSQL). The Redis MemoryStore fallback already exists for *rate limiting*. Better Auth does not use express-session. |

**Installation:**
```bash
npm install better-auth resend
```

**No types packages needed**: `better-auth` ships its own TypeScript types. `resend` ships types.

---

## Architecture Patterns

### Recommended Project Structure (after Phase 22)

```
server/src/
├── auth.ts                      # Better Auth instance (NEW) — single source of truth
├── app.ts                       # Updated: mount auth handler BEFORE express.json()
├── config/
│   └── env.ts                   # Updated: add BETTER_AUTH_SECRET, BETTER_AUTH_URL, OAuth creds, RESEND_API_KEY, RESEND_FROM_EMAIL
├── middleware/
│   ├── require-auth.ts          # NEW: Express middleware — calls auth.api.getSession, 401 if none
│   └── security.ts              # Updated: connectSrc must allow /api/auth/* calls
├── routes/
│   ├── secrets.ts               # Existing — no change (auth is optional here for now)
│   └── me.ts                    # NEW: GET /api/me — returns current user from session
└── services/
    └── email.ts                 # NEW: thin Resend wrapper used by auth callbacks

client/src/
├── api/
│   └── auth-client.ts           # NEW: Better Auth client instance (better-auth/client)
└── pages/
    ├── login.ts                 # NEW: email/password login + Google/GitHub OAuth buttons
    ├── register.ts              # NEW: registration form with email verification notice
    ├── forgot-password.ts       # NEW: request password reset email
    └── reset-password.ts        # NEW: set new password via token from email link

shared/types/
└── api.ts                       # Updated: add auth-related response types
```

### Pattern 1: Better Auth Server Instance

**What:** A single `auth.ts` file exports the configured `betterAuth` instance. All other server files import from this one file.

**When to use:** Always — single source of truth for all auth configuration.

**Example:**
```typescript
// Source: Context7 /better-auth/better-auth — installation.mdx + drizzle.mdx + email.mdx
// server/src/auth.ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';
import { resend } from './services/email.js';
import { env } from './config/env.js';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,  // Better Auth uses singular "user" internally; our table is "users"
    },
    usePlural: true,        // All our tables use plural names
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // url is the full reset URL with token — send as-is
      void resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Reset your SecureShare password',
        text: `Click the link to reset your password: ${url}`,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void resend.emails.send({
        from: env.RESEND_FROM_EMAIL,
        to: user.email,
        subject: 'Verify your SecureShare email',
        text: `Click the link to verify your email: ${url}`,
      });
    },
    sendOnSignIn: true,
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
  },

  trustedOrigins: [env.BETTER_AUTH_URL],
});

// Export inferred types for use in middleware and routes
export type AuthSession = typeof auth.$Infer.Session;
```

### Pattern 2: Express Handler Mounting (CRITICAL order)

**What:** Mount the Better Auth handler at `/api/auth/*splat` (Express 5 syntax) BEFORE `express.json()`. Better Auth parses its own bodies. If `express.json()` precedes it, the request stream is consumed and Better Auth's sign-up/sign-in endpoints hang indefinitely.

**When to use:** Always in Express 5.

**Example:**
```typescript
// Source: Context7 /better-auth/better-auth — express.mdx
// Source: WebFetch official docs https://www.better-auth.com/docs/integrations/express
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

// In buildApp():
app.all('/api/auth/*splat', toNodeHandler(auth));  // Express 5 syntax

// express.json() MUST come AFTER the auth handler
app.use(express.json({ limit: '100kb' }));
```

**Existing app.ts comment:** The current middleware order comment will need updating to reflect the auth handler as step 3 (after CSP nonce and before Helmet... or actually: Helmet runs after CSP nonce, and Better Auth needs to be before `express.json()`). The safe order is:

```
1. trust proxy
2. httpsRedirect
3. cspNonceMiddleware
4. Helmet
5. httpLogger
6. toNodeHandler(auth)  ← NEW: BEFORE express.json()
7. express.json()
8. routes (secrets, me, health)
9. API catch-all
10. static/SPA
11. errorHandler
```

### Pattern 3: Server-Side Session Middleware

**What:** A `requireAuth` Express middleware that calls `auth.api.getSession` with the current request headers. Returns 401 if no valid session. Sets `res.locals.user` and `res.locals.session` for downstream handlers.

**When to use:** Applied to any route that requires authentication (e.g., `/api/me`, future `/api/dashboard/*`).

**Example:**
```typescript
// Source: Context7 /better-auth/better-auth — express.mdx (getSession pattern)
// server/src/middleware/require-auth.ts
import type { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, type AuthSession } from '../auth.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required.' });
    return;
  }

  res.locals.user = session.user;
  res.locals.session = session.session;
  next();
}
```

### Pattern 4: Client-Side Auth Client (Vanilla TypeScript)

**What:** Better Auth provides `better-auth/client` for vanilla TypeScript (no framework required). This client handles sign-in, sign-up, sign-out, and session reads.

**When to use:** The frontend is vanilla TS — do NOT use `better-auth/react`.

**Example:**
```typescript
// Source: Context7 /better-auth/better-auth — client.mdx
// client/src/api/auth-client.ts
import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
  // baseURL is optional when client and server share the same domain/port
  // For Vite dev proxy (/api → :3000), omit baseURL
});

export const { signIn, signUp, signOut, getSession } = authClient;
```

**Session retrieval (non-reactive, for vanilla TS):**
```typescript
// Source: Context7 /better-auth/better-auth — basic-usage.mdx
const { data: session, error } = await authClient.getSession();
if (session) {
  // session.user.id, session.user.email, session.user.name, session.user.emailVerified
}
```

**Social sign-in:**
```typescript
// Source: Context7 /better-auth/better-auth — basic-usage.mdx
await authClient.signIn.social({
  provider: 'google',   // or 'github'
  callbackURL: '/dashboard',
  errorCallbackURL: '/login?error=oauth',
});
```

### Pattern 5: Resend Email Service Wrapper

**What:** A thin wrapper around the Resend SDK that the auth callbacks use. Keeping Resend initialization in one file makes it mockable in tests and keeps `auth.ts` clean.

**Example:**
```typescript
// Source: Context7 /resend/resend-node — readme
// server/src/services/email.ts
import { Resend } from 'resend';
import { env } from '../config/env.js';

export const resend = new Resend(env.RESEND_API_KEY);
```

### Pattern 6: Integration Test — Session Cookie Capture

**What:** In Vitest integration tests, sign up or sign in via Supertest, extract the `better-auth.session_token` cookie from `set-cookie` headers, and pass it to subsequent authenticated requests.

**When to use:** For all tests that need an authenticated user context.

**Example:**
```typescript
// Source: GitHub discussion #2299 better-auth/better-auth
import request from 'supertest';

async function signUpAndGetCookie(app: Express, email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Content-Type', 'application/json')
    .send({ email, password, name: 'Test User' });

  const rawCookie = response.headers['set-cookie'] as string[];
  const sessionCookie = rawCookie.find(c => c.startsWith('better-auth.session_token='));
  if (!sessionCookie) throw new Error('Session cookie not found in response');
  return sessionCookie;
}

// In test:
const cookie = await signUpAndGetCookie(app, 'test@example.com', 'password123');
const meResponse = await request(app)
  .get('/api/me')
  .set('Cookie', cookie)
  .expect(200);
```

### Anti-Patterns to Avoid

- **`express.json()` before `toNodeHandler(auth)`:** Body stream consumed; auth requests hang indefinitely.
- **Using `better-auth/react` in vanilla TS client:** Causes React dependency error; use `better-auth/client` instead.
- **Letting Better Auth auto-migrate its tables:** Phase 21 already created all tables via Drizzle migrations. Never call `auth.migrate()` — it would attempt to create already-existing tables or bypass the Drizzle journal.
- **Hardcoding `usePlural: false`:** Our schema uses plural table names (`users`, `sessions`, `accounts`, `verification`). Set `usePlural: true` OR provide explicit `schema: { ...schema, user: schema.users }` mapping. Using both is redundant but safe.
- **Omitting `baseURL` / `BETTER_AUTH_URL`:** Without `baseURL`, Better Auth infers the URL from the incoming request. OAuth callback redirect URIs will be wrong in production. Always set `BETTER_AUTH_URL` explicitly.
- **Using `app.all('/api/auth/*', ...)` (Express 4 syntax) in Express 5:** Express 5 path-to-regexp v8+ requires named wildcard parameters. Use `/api/auth/*splat`.
- **Storing `userId` + `secretId` together in session data or logs:** Violates the zero-knowledge invariant. See `.planning/INVARIANTS.md`. The session only stores `userId`; it must never be augmented with `secretId`.
- **Using `authClient.forgotPassword`:** Renamed to `authClient.requestPasswordReset` in Better Auth 1.4. Using the old name causes a runtime error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing for user accounts | Custom Argon2id for auth users | Better Auth's built-in scrypt (via `emailAndPassword: { enabled: true }`) | Better Auth internally handles hash/verify for user passwords; Argon2id in `password.service.ts` is only for *secret* passwords — they're separate |
| Session creation/validation | Custom JWT or cookie handling | `auth.api.getSession` + Better Auth session cookies | Token signing, rotation, expiry, and DB cleanup are all handled internally |
| OAuth PKCE flow | Custom state/nonce generation | Better Auth social providers | OAuth state and PKCE are stored in DB automatically, preventing CSRF/injection |
| Email verification tokens | Custom token generation + DB storage | Better Auth `emailVerification` config | Uses the `verification` table (created in Phase 21) with expiry handled automatically |
| Password reset token flow | Custom token storage + validation | Better Auth `sendResetPassword` callback | Token lifecycle is fully managed; only need to deliver the URL via email |
| CSRF protection | Custom CSRF tokens | Better Auth's Origin validation + SameSite=Lax cookies | Built in; "non-simple requests with JSON content type are already CSRF-safe" |

**Key insight:** Better Auth handles the entire session lifecycle, token management, and security primitives. The implementation task is configuration + email delivery + UI, not auth mechanics.

---

## Common Pitfalls

### Pitfall 1: express.json() Before Better Auth Handler Causes Silent Hang
**What goes wrong:** Sign-up and sign-in requests from the client never complete — they remain "pending" indefinitely with no error logged.
**Why it happens:** `express.json()` consumes the request body stream. Better Auth's `toNodeHandler` then tries to read the body but finds an already-consumed stream. The request never resolves.
**How to avoid:** Mount `app.all('/api/auth/*splat', toNodeHandler(auth))` BEFORE `app.use(express.json())` in `app.ts`. This is non-negotiable.
**Warning signs:** POST to `/api/auth/sign-up/email` hangs; no 4xx or 5xx response; no error in logs.

### Pitfall 2: Express 5 Wildcard Route Syntax
**What goes wrong:** Using `/api/auth/*` (Express 4) in Express 5 causes 404 for all auth routes.
**Why it happens:** Express 5 uses path-to-regexp v8+ which requires named wildcard params (e.g. `*splat`).
**How to avoid:** Use `app.all('/api/auth/*splat', toNodeHandler(auth))`.
**Warning signs:** All `/api/auth/*` routes return 404 even though the handler is mounted.

### Pitfall 3: Table Naming Mismatch Breaks Drizzle Adapter at Runtime
**What goes wrong:** Better Auth throws `Column not found` or silently fails to write sessions.
**Why it happens:** Better Auth's adapter internally uses singular model names (`user`, `session`, `account`). Our schema uses plural names (`users`, `sessions`, `accounts`). Without the explicit `schema: { ...schema, user: schema.users }` mapping, the adapter cannot find the tables.
**How to avoid:** Always provide `schema: { ...schema, user: schema.users }` in `drizzleAdapter(db, { ... })`. Adding `usePlural: true` is an alternative but the explicit mapping is more explicit and less error-prone.
**Warning signs:** `auth.api.getSession` always returns null; sign-up creates no DB row.

### Pitfall 4: BETTER_AUTH_URL Not Set — OAuth Callbacks Fail
**What goes wrong:** OAuth redirect URIs are constructed from the incoming request hostname. In production behind a proxy, this produces incorrect or `http://` URLs when the app expects `https://`.
**Why it happens:** Better Auth infers `baseURL` from `req.hostname` when `BETTER_AUTH_URL` is not set. This is fragile.
**How to avoid:** Always set `BETTER_AUTH_URL=http://localhost:3000` in `.env` (dev) and the production URL in production env vars. Register the same value as the OAuth callback URL in Google/GitHub developer consoles.
**Warning signs:** OAuth returns "redirect_uri_mismatch" error from Google or GitHub.

### Pitfall 5: CSP Blocks Auth API Calls From Browser
**What goes wrong:** Browser blocks `fetch('/api/auth/sign-up/email')` due to `connect-src: 'self'` not covering the auth endpoints — OR the auth client's internal polling is blocked.
**Why it happens:** The current CSP in `security.ts` has `connectSrc: ["'self'"]`. This should be fine since auth calls are same-origin, but any auth-initiated cross-origin requests (e.g., OAuth redirects) need to be allowed.
**How to avoid:** `connectSrc: ["'self'"]` is correct for same-domain auth API calls. No change needed for basic auth. OAuth provider redirects are navigation-level (not `fetch`), so they are not blocked by `connect-src`. Verify CSP does not block session polling if Better Auth uses it.
**Warning signs:** Browser console shows `CSP violation: connect-src` on auth fetch calls.

### Pitfall 6: `authClient.forgotPassword` Does Not Exist in Better Auth 1.4
**What goes wrong:** Calling `authClient.forgotPassword(...)` throws `TypeError: authClient.forgotPassword is not a function`.
**Why it happens:** Better Auth 1.4 renamed this to `authClient.requestPasswordReset` (breaking change in 1.4 release).
**How to avoid:** Use `authClient.requestPasswordReset({ email })` throughout.
**Warning signs:** TypeScript compiler shows no type error (because the Proxy returns a value for any property), but the call silently fails or throws at runtime.

### Pitfall 7: Reset Password URL Has Inconsistent Base Path
**What goes wrong:** The URL provided to `sendResetPassword` callback may have path format `/reset-password/<token>` (missing `/api/auth/` prefix), while `sendVerificationEmail` gets a full `/api/auth/verify-email?token=...` URL.
**Why it happens:** Known inconsistency in Better Auth reported in GitHub discussion #5665 — not yet resolved as of 1.4.18.
**How to avoid:** In `sendResetPassword`, do not assume the URL format. Inspect the actual `url` argument at runtime in development. The frontend reset-password page should handle the token from either URL structure. Alternatively, construct the reset URL manually using `token` parameter: `${env.BETTER_AUTH_URL}/reset-password?token=${token}` and route the frontend accordingly.
**Warning signs:** Reset password links in emails lead to 404 pages.

### Pitfall 8: Zero-Knowledge Invariant — Session Must Not Carry secretId
**What goes wrong:** A future developer augments the session object (e.g., in a pre-login hook) to include a recently created `secretId` for "auto-attach" UX. This violates the invariant.
**Why it happens:** Auth hooks and middleware have access to both `userId` (from session) and request body (which might contain `secretId`). Tempting to combine them.
**How to avoid:** Read `.planning/INVARIANTS.md` before writing any hook or session-augmentation code. The session object must never contain `secretId`. Secret attachment to a user happens in Phase 23 via a separate `secrets.user_id` UPDATE that does NOT log both IDs together.
**Warning signs:** Any code that calls `auth.api.getSession()` and then reads `req.body.secretId` in the same function, then stores or logs both values together.

### Pitfall 9: Email Verification Required But Resend Not Configured
**What goes wrong:** With `requireEmailVerification: true`, new users cannot log in because verification emails are not delivered (Resend API key missing or invalid). Entire auth flow is broken in staging/production.
**How to avoid:** Gate `requireEmailVerification: true` on `NODE_ENV !== 'test'` to allow integration tests to create verified users without email. In staging/production, always provide `RESEND_API_KEY`. Add `.env.example` entries for all new env vars.
**Warning signs:** Users register but get `email_not_verified` error on sign-in; no email arrives.

---

## Code Examples

Verified patterns from official sources:

### Full betterAuth Configuration
```typescript
// Source: Context7 /better-auth/better-auth (drizzle.mdx, email.mdx, options.mdx, google.mdx)
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db/connection.js';
import * as schema from './db/schema.js';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      ...schema,
      user: schema.users,
    },
    usePlural: true,
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // void prevents awaiting; avoids timing attacks
      void sendResetEmail(user.email, url);
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail(user.email, url);
    },
    sendOnSignIn: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
});
```

### Express 5 Handler Mounting
```typescript
// Source: Context7 /better-auth/better-auth — express.mdx
// Source: https://www.better-auth.com/docs/integrations/express
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';

// MUST be before express.json()
app.all('/api/auth/*splat', toNodeHandler(auth));

// Then JSON parser (only for non-auth routes)
app.use(express.json({ limit: '100kb' }));
```

### Server-Side Session Retrieval in Express Route
```typescript
// Source: Context7 /better-auth/better-auth — express.mdx
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth.js';

app.get('/api/me', async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return res.json({ user: session.user });
});
```

### Client-Side Sign-Up (Vanilla TS)
```typescript
// Source: Context7 /better-auth/better-auth — client.mdx
import { createAuthClient } from 'better-auth/client';
const authClient = createAuthClient();

const { data, error } = await authClient.signUp.email({
  email: 'user@example.com',
  password: 'securepassword',
  name: 'User Name',
  callbackURL: '/dashboard',
});
```

### Client-Side Sign-In (Vanilla TS)
```typescript
// Source: Context7 /better-auth/better-auth — basic-usage.mdx
const { data, error } = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'securepassword',
  callbackURL: '/dashboard',
  rememberMe: true,
});
```

### Client-Side OAuth Sign-In
```typescript
// Source: Context7 /better-auth/better-auth — basic-usage.mdx
await authClient.signIn.social({
  provider: 'google',  // or 'github'
  callbackURL: '/dashboard',
  errorCallbackURL: '/login?error=oauth',
  newUserCallbackURL: '/welcome',
});
// User is immediately redirected — no return value to handle
```

### Password Reset Flow (Client)
```typescript
// Source: Context7 /better-auth/better-auth — email-password.mdx
// Step 1: Request reset email
const { error } = await authClient.requestPasswordReset({
  email: 'user@example.com',
  redirectTo: '/reset-password',  // page where user lands after clicking email link
});

// Step 2: On the reset-password page, extract token from URL and submit new password
const token = new URLSearchParams(window.location.search).get('token');
const { error } = await authClient.resetPassword({
  newPassword: 'newSecurePassword',
  token: token!,
});
```

### Resend Email Sending
```typescript
// Source: Context7 /resend/resend-node — readme
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: 'SecureShare <noreply@yourdomain.com>',
  to: 'user@example.com',
  subject: 'Verify your email',
  text: 'Click here to verify: https://...',
});
```

### New Environment Variables Required
```bash
# .env additions for Phase 22
BETTER_AUTH_SECRET=<random 32-byte hex string>    # Cookie signing key
BETTER_AUTH_URL=http://localhost:3000             # Base URL for OAuth callbacks

# OAuth (register apps at Google Cloud Console and GitHub Developer Settings)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GITHUB_CLIENT_ID=<from GitHub Developer Settings>
GITHUB_CLIENT_SECRET=<from GitHub Developer Settings>

# Email delivery
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=SecureShare <noreply@yourdomain.com>
```

### TypeScript Type Augmentation for Express Request
```typescript
// Better Auth inferred types — use res.locals pattern (no req augmentation needed)
// server/src/auth.ts
export type AuthUser = typeof auth.$Infer.Session.user;
export type AuthSessionData = typeof auth.$Infer.Session.session;

// In require-auth.ts, populate res.locals:
res.locals.user = session.user;      // type: AuthUser
res.locals.session = session.session; // type: AuthSessionData

// In routes that use requireAuth, cast res.locals:
const user = res.locals.user as AuthUser;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `authClient.forgotPassword()` | `authClient.requestPasswordReset()` | Better Auth 1.4 (breaking change) | Must use new name or get silent failure |
| `app.all('/api/auth/*', ...)` (Express 4) | `app.all('/api/auth/*splat', ...)` (Express 5) | Express 5 / path-to-regexp v8 | Breaking — Express 4 wildcard no longer works |
| `better-auth/react` for client | `better-auth/client` for vanilla TS | Always — framework-specific clients are opt-in | Use `/client` not `/react` for this project |
| express-session + connect-redis for auth sessions | Better Auth's built-in DB-backed sessions | Phase 22 design decision | Redis is still used for rate limiting; Better Auth sessions live in PostgreSQL `sessions` table |
| `@better-auth/cli generate` to inspect schema | Context7 / official docs for schema reference | Phase 21 decision (CLI overwrites schema.ts) | Never run the CLI against the live schema file |

**Deprecated/outdated:**
- `auth.migrate()`: Never call — Phase 21 already created all tables via Drizzle migrations. Calling `auth.migrate()` would attempt to create duplicate tables or bypass the migration journal.
- Better Auth's internal `advanced.generateId` (pre-1.4): Renamed to `advanced.database.generateId`. Not needed for Phase 22 since nanoid is already used for secrets.
- `createAuthClient({ baseURL: 'http://localhost:3000' })` in tests: Avoid explicit baseURL in tests — use relative paths or let Supertest handle the base URL.

---

## Key Architectural Decision: Session Storage

**AUTH-05 says "Redis-backed server sessions"** but Better Auth does NOT use Redis or `express-session`. Better Auth stores sessions in the PostgreSQL `sessions` table (created in Phase 21) with a cookie containing the session token. Sessions persist across browser refreshes because the cookie is `httpOnly`, `SameSite=Lax`, and persists until expiry (7-day default, with 1-day threshold for automatic extension).

Redis in this project is only for `express-rate-limit` (via `rate-limit-redis` and `ioredis`). There is no `express-session` in use and Better Auth does not integrate with it.

**Resolution:** AUTH-05 is satisfied by Better Auth's PostgreSQL-backed sessions — the session survives browser refreshes because the cookie is long-lived and the server validates it against the `sessions` table. The requirement's mention of "Redis-backed" appears to have been a pre-decision assumption that is superseded by the Better Auth choice. The planner should note this discrepancy and confirm the PostgreSQL-backed session is acceptable.

---

## Open Questions

1. **Should `requireEmailVerification` be disabled for integration tests?**
   - What we know: With `requireEmailVerification: true`, programmatic sign-ups via Supertest produce unverified users who cannot log in. Resend cannot deliver emails to test addresses.
   - What's unclear: Whether there's a cleaner way to bypass verification in tests short of creating a test-specific `auth` instance.
   - Recommendation: Conditionally set `requireEmailVerification: NODE_ENV !== 'test'` in `auth.ts`, OR in tests call `auth.api.signUpEmail` and then directly update the DB to mark `emailVerified = true` before testing login.

2. **Which frontend routes need auth-gate vs. soft-check?**
   - What we know: `/dashboard` (Phase 23) requires auth. The create/reveal pages work for anonymous users. Login/register pages should redirect if already logged in.
   - What's unclear: Whether the router.ts needs a session check on every navigation or only on specific routes.
   - Recommendation: Phase 22 only needs to implement the auth pages themselves (login, register, forgot-password, reset-password) and a `/dashboard` stub that checks session. The full dashboard is Phase 23.

3. **OAuth app registration prerequisites — are credentials available?**
   - What we know: Google and GitHub OAuth apps must be registered in their respective developer consoles. The callback URLs must match `BETTER_AUTH_URL/api/auth/callback/google` and `.../callback/github`.
   - What's unclear: Whether OAuth credentials are available or whether the plan should include a "register OAuth apps" prerequisite step.
   - Recommendation: The plan should include a prerequisites step for OAuth app registration. Plans should document exact callback URL formats for both providers.

4. **Dashboard stub vs. full dashboard in Phase 22?**
   - What we know: Phase 22's success criteria say "User can sign in with Google or GitHub and land on their dashboard." Phase 23 is where the actual dashboard is built.
   - What's unclear: Whether Phase 22 needs a minimal `/dashboard` route that just shows the user's email, or whether the router just redirects to `/` after login.
   - Recommendation: Add a minimal `/dashboard` page in Phase 22 that displays the user's name/email and a logout button, sufficient to validate the OAuth and session flows. Phase 23 adds the full secret history UI.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/better-auth/better-auth` — queried for: Express integration, email/password config, OAuth social providers, Drizzle adapter schema mapping, client-side auth client, session management, `$Infer.Session` types, trustedOrigins, `sendVerificationEmail`, `sendResetPassword`, `requestPasswordReset`, `resetPassword`
- Context7 `/resend/resend-node` — queried for: SDK installation, `resend.emails.send()` API
- `server/src/app.ts` (codebase) — confirmed existing middleware order and Express 5 patterns
- `server/src/db/schema.ts` (codebase) — confirmed Phase 21 table names and types
- `server/src/config/env.ts` (codebase) — confirmed env var pattern for adding new vars
- `server/src/middleware/logger.ts` (codebase) — confirmed redaction patterns (auth routes not currently redacted)
- `package.json` (codebase) — confirmed no `better-auth` or `resend` installed yet; confirmed `ioredis`, `express-rate-limit`, `rate-limit-redis` present
- `npm view better-auth version` → 1.4.18 confirmed
- `npm view resend version` → 6.9.2 confirmed

### Secondary (MEDIUM confidence)
- [Better Auth Express Integration Docs](https://www.better-auth.com/docs/integrations/express) — Express 5 `*splat` syntax, express.json() ordering warning
- [Better Auth Security Docs](https://www.better-auth.com/docs/reference/security) — cookie defaults (SameSite=Lax, httpOnly, secure), CSRF protections, Origin validation
- [Better Auth 1.4 Release Blog](https://www.better-auth.com/blog/1-4) — confirmed breaking changes: `forgotPassword` → `requestPasswordReset`
- [Better Auth Email/Password Docs](https://www.better-auth.com/docs/authentication/email-password) — requireEmailVerification, minPasswordLength, reset password flow
- [GitHub Discussion #2299](https://github.com/better-auth/better-auth/discussions/2299) — Supertest cookie capture pattern verified by community

### Tertiary (LOW confidence — flag for validation)
- [GitHub Issue #7044](https://github.com/better-auth/better-auth/issues/7044) — sign-up hanging: root cause confirmed as middleware order; fix is confirmed as "auth handler before express.json()"
- [GitHub Discussion #5665](https://github.com/better-auth/better-auth/discussions/5665) — `sendResetPassword` URL inconsistency: reported but not resolved in 1.4.18; treat as a risk requiring manual inspection
- [GitHub Issue #5609](https://github.com/better-auth/better-auth/issues/5609) — `auth.test.*` utilities: NOT shipped in 1.4.18 stable; PR pending. Do not plan to use `auth.test.createUser` — use Supertest sign-up + DB query instead.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both `better-auth` 1.4.18 and `resend` 6.9.2 verified via `npm view`; adapter config verified via Context7
- Architecture (handler mounting, Drizzle adapter): HIGH — verified via Context7 + official docs + codebase review
- Architecture (session middleware pattern): HIGH — `fromNodeHeaders` + `auth.api.getSession` is the canonical Express pattern, verified via Context7
- Architecture (client-side vanilla TS): HIGH — `better-auth/client` import verified via Context7; confirmed not React
- Pitfalls: HIGH — `express.json()` ordering and Express 5 wildcard confirmed via official docs + GitHub issues; `requestPasswordReset` rename confirmed via 1.4 release blog
- Open questions: MEDIUM — session storage, testing strategy, and OAuth prerequisites require planner decisions

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (better-auth has active release cadence; re-check if 1.5.x releases before planning begins)
