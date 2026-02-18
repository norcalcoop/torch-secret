# Architecture Research: v4.0 Hybrid Anonymous + Account Model

**Domain:** Adding auth, accounts, payments, and analytics to existing zero-knowledge Express+Vite monorepo
**Researched:** 2026-02-18
**Confidence:** HIGH (session/middleware/schema/Stripe), MEDIUM (PostHog CSP nonces, file upload path), LOW (none)

---

## System Overview

v4.0 grafts four new subsystems onto the existing anonymous-only architecture. Each subsystem has distinct integration points with the existing middleware pipeline, schema, and SPA router. The existing zero-knowledge invariants are preserved — the server still never touches plaintext.

```
+-----------------------------------------------------------------------+
|                        Browser (Vanilla TS SPA)                        |
|                                                                        |
|  / (create)   /secret/:id   /confirmation   /dashboard   /auth/*      |
|  [unchanged]  [unchanged]   [unchanged]     [NEW]        [NEW pages]  |
|                                                                        |
|  posthog-js (browser SDK) ─────────────────────────────────────────>  |
|  PostHog Cloud (connect-src required in CSP)                          |
+----------------------------------+------------------------------------+
                                   | HTTPS
+----------------------------------v------------------------------------+
|                         Express 5 Middleware Pipeline                  |
|                                                                        |
|  trust proxy -> httpsRedirect -> cspNonce -> helmet -> httpLogger      |
|                                                                        |
|  [NEW] express-session (Redis-backed)  <-- INSERTED after httpLogger  |
|  [NEW] auth middleware (deserializeUser, attach req.user)             |
|                                                                        |
|  express.json({ limit: '100kb' })  <-- unchanged for most routes     |
|  [NEW] express.raw() on /api/webhooks/stripe  <-- BEFORE json parser  |
|                                                                        |
|  /api/health             [unchanged]                                   |
|  /api/secrets            [unchanged -- anonymous flow intact]         |
|  [NEW] /api/auth/*       (login, register, logout, OAuth callbacks)   |
|  [NEW] /api/users/*      (profile, secrets list, plan info)           |
|  [NEW] /api/webhooks/stripe  (raw body, signature verification)       |
|  /api catch-all 404      [unchanged]                                   |
|  static + SPA catch-all  [unchanged, /dashboard added to SPA]         |
|  errorHandler            [unchanged, MUST be last]                    |
+----------------------------------+------------------------------------+
                                   |
           +───────────────────────+────────────────────────+
           |                       |                        |
+----------v------+   +────────────v────────+   +-─────────v─────────+
|   PostgreSQL 17  |   |       Redis          |   |  External Services |
|                  |   |                     |   |                    |
|  secrets table   |   |  express-session    |   |  Stripe (billing)  |
|  [MODIFIED:      |   |  store              |   |  Resend (email)    |
|   nullable       |   |  (already used for  |   |  PostHog (events)  |
|   user_id FK]    |   |   rate limiting)    |   |  Cloudflare R2     |
|                  |   |                     |   |  (file uploads)    |
|  users [NEW]     |   |  rate limit keys    |   |                    |
|  subscriptions   |   |  (existing)         |   |  Google/GitHub     |
|  [NEW]           |   |                     |   |  OAuth providers   |
+------------------+   +---------------------+   +--------------------+
```

---

## Integration Point 1: Auth Middleware Position in Existing Pipeline

### Where it fits

Auth session middleware inserts **after `httpLogger` and before `express.json()`**. This is critical: session lookup must happen before route handlers can read `req.user`, but after logging so request IDs are already set.

```typescript
// server/src/app.ts -- modified middleware order
app.set('trust proxy', 1);
app.use(httpsRedirect);
app.use(cspNonceMiddleware);
app.use(createHelmetMiddleware());   // Helmet reads cspNonce from res.locals
app.use(httpLogger);

// [NEW v4.0] Session must come before any route reads req.user
app.use(createSessionMiddleware(redisClient));  // express-session + Redis
app.use(passport.initialize());
app.use(passport.session());

// Stripe webhook BEFORE json parser (raw body required for signature)
// [NEW v4.0] Must be mounted before express.json() globally
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '100kb' }));  // unchanged

app.use('/api/health', healthRouter);        // unchanged
app.use('/api/secrets', createSecretsRouter(redisClient));  // unchanged
app.use('/api/auth', authRouter);            // [NEW]
app.use('/api/users', requireAuth, usersRouter);  // [NEW]
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
// static + SPA catch-all, errorHandler unchanged
```

**Why this exact order matters:**

- `cspNonceMiddleware` -> `helmet`: unchanged. Helmet reads `res.locals.cspNonce` to build CSP header. Moving session middleware before helmet would work fine -- it does not read `res.locals.cspNonce`.
- Session -> passport: passport requires session to be initialized first. This is a hard requirement.
- Stripe raw body -> `express.json()`: Stripe's `constructEvent()` requires the raw Buffer body. If `express.json()` runs first, the body is parsed to an object and HMAC verification fails. The raw body route must be mounted **before** the global `express.json()` call. Approach: mount the Stripe webhook route on the app directly (not via a sub-router) before `express.json()`.

**Confidence:** HIGH -- Stripe documentation explicitly requires raw body before JSON parsing; express-session docs require session before passport.

---

## Integration Point 2: Session Storage Decision

### Recommendation: express-session + Redis (not JWT cookies)

Use `express-session` backed by `connect-redis` v9, reusing the existing `ioredis` client already in `app.ts`.

**Why express-session over JWT httpOnly cookies:**

| Concern | express-session + Redis | JWT httpOnly Cookie |
|---------|------------------------|---------------------|
| Revocation | Instant -- delete Redis key | Impossible until expiry (need a denylist = Redis anyway) |
| Zero-knowledge compatibility | No conflict -- session stores user identity, not secret content | No conflict either |
| Existing Redis | Already present, reuse with new prefix | Adds complexity with no reuse benefit |
| Session size | Tiny (session ID only in cookie; user data in Redis) | Larger cookie (full payload); server parsing on every request |
| Subscription changes | Instantly reflected (read from DB on next request) | Stale tier data until token re-issuance |
| CSRF risk | SameSite=Lax cookie + state-mutating endpoints use POST | Same |
| Implementation complexity | Lower -- passport + express-session is 15+ years of production use | Higher -- key rotation, expiry management, denylist for logout |

The subscription status change scenario is decisive: when a Stripe webhook fires `customer.subscription.updated`, the user's plan changes instantly in PostgreSQL. With sessions, the next API request reads fresh data. With JWTs, the client holds a stale token until expiry. This matters for feature gate enforcement on the dashboard.

**Session cookie configuration:**

```typescript
// server/src/middleware/session.ts [NEW]
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import type { Redis } from 'ioredis';
import { env } from '../config/env.js';

export function createSessionMiddleware(redisClient?: Redis) {
  const store = redisClient
    ? new RedisStore({ client: redisClient, prefix: 'sess:' })
    : undefined; // MemoryStore fallback for dev without Redis

  return session({
    secret: env.SESSION_SECRET,  // new env var, 32+ random bytes
    resave: false,
    saveUninitialized: false,    // do not create session for unauthenticated requests
    store,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',           // 'lax' not 'strict': OAuth callbacks need cross-site top-level GET
      maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
    },
  });
}
```

**Why `sameSite: 'lax'` not `'strict'`:** OAuth callback flows (Google, GitHub) involve a redirect from the OAuth provider back to `/api/auth/google/callback`. With `sameSite: 'strict'`, the session cookie is not sent on this cross-site top-level navigation, breaking the OAuth state verification and causing a CSRF error. `sameSite: 'lax'` sends cookies on top-level navigations (the OAuth redirect) but not on cross-site subresource requests, providing adequate CSRF protection for this use case.

**Redis key namespace separation:** The existing rate-limit keys use `rl:create:` and `rl:verify:` prefixes. Session keys use `sess:` prefix. No key collisions.

**New env vars to add to `server/src/config/env.ts`:**

```typescript
SESSION_SECRET: z.string().min(32),
GOOGLE_CLIENT_ID: z.string().optional(),
GOOGLE_CLIENT_SECRET: z.string().optional(),
GITHUB_CLIENT_ID: z.string().optional(),
GITHUB_CLIENT_SECRET: z.string().optional(),
STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
RESEND_API_KEY: z.string().startsWith('re_').optional(),
POSTHOG_API_KEY: z.string().optional(),
R2_ACCOUNT_ID: z.string().optional(),
R2_ACCESS_KEY_ID: z.string().optional(),
R2_SECRET_ACCESS_KEY: z.string().optional(),
R2_BUCKET_NAME: z.string().optional(),
```

**Confidence:** HIGH -- connect-redis v9 ships with TypeScript types, supports ESM (`import { RedisStore } from 'connect-redis'`), works with ioredis. Verified via npm package docs.

---

## Integration Point 3: Database Schema

### New tables and secrets table modification

**Drizzle schema additions in `server/src/db/schema.ts`:**

```typescript
// users table [NEW]
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),       // null for OAuth-only users
  googleId: text('google_id').unique(),      // null for email/password users
  githubId: text('github_id').unique(),      // null for email/password users
  plan: text('plan', { enum: ['free', 'pro'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// subscriptions table [NEW]
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status').notNull(),          // 'active' | 'canceled' | 'past_due' | 'trialing'
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// secrets table [MODIFIED: add nullable user_id and metadata columns]
export const secrets = pgTable('secrets', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  ciphertext: text('ciphertext').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  passwordHash: text('password_hash'),
  passwordAttempts: integer('password_attempts').default(0).notNull(),
  // [NEW] nullable FK -- null means anonymous, non-null means created by a user account
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  // [NEW] dashboard metadata (viewedAt persists after ciphertext is destroyed)
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  // [NEW] Pro tier file upload fields
  fileKey: text('file_key'),         // R2 object key, null for text secrets
  fileMimeType: text('file_mime_type'),
  fileSize: integer('file_size'),    // bytes
});

// Partial index for dashboard query -- only indexed rows with a user_id
export const secretsUserIdIdx = index('secrets_user_id_idx')
  .on(secrets.userId)
  .where(isNotNull(secrets.userId));
```

**Migration strategy for adding `user_id` to secrets:**

The `user_id` column is nullable (no `.notNull()`). Adding a nullable column to an existing table is a non-breaking migration -- PostgreSQL sets existing rows to NULL and the column is ignored by all existing queries. The anonymous create flow passes no `userId`, so the services layer stays identical. Run `npm run db:generate` then `npm run db:migrate`.

**Known Drizzle migration caution:** A bug in drizzle-kit (issue #4147) causes incorrect SQL when adding a new column and a new foreign key constraint in the same migration. After generating, inspect the migration SQL before applying. If the generated SQL adds the FK before the column exists, split into two migrations: (1) add column, (2) add constraint.

**`onDelete: 'set null'` on secrets:** When a user deletes their account, their secrets' `user_id` is set to NULL rather than cascading deletion. The secret still self-destructs on view; the user just can no longer see it in their dashboard.

**Why store `plan` on users table, not just in subscriptions:** The `plan` field on `users` is a denormalized cache of the current subscription tier. It is the source of truth for feature gates on every API request. The `subscriptions` table holds the full Stripe billing history. When a Stripe webhook fires, both are updated atomically.

**Confidence:** HIGH -- Drizzle nullable FK syntax verified via official docs and GitHub discussions. Migration risk flagged.

---

## Integration Point 4: Stripe Webhook Endpoint

### Mounting strategy to avoid CSP and body-parser conflicts

Stripe webhook signature verification requires the raw request body as a Buffer. The existing `express.json()` middleware runs globally before routes. The webhook endpoint must intercept before JSON parsing.

**Pattern -- mount raw body route directly on app before `express.json()`:**

```typescript
// In buildApp(), BEFORE app.use(express.json(...)):
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

// Then:
app.use(express.json({ limit: '100kb' }));  // all other routes
```

**Why a dedicated route, not a router:** Sub-routers inherit middleware from the parent. If `express.json()` is mounted on the app before the router, the body is already parsed when the router's handler runs. The webhook handler must be mounted directly on the Express app instance, not via a router, before the `express.json()` middleware line.

**CSP implications:** The Stripe webhook is a server-to-server POST from Stripe's infrastructure. It is never initiated by a browser, so CSP headers have no relevance. The `express.raw()` middleware only affects request body parsing for this route -- it does not affect response headers.

**Key webhook events to handle:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Provision subscription, set `users.plan = 'pro'`, insert `subscriptions` row |
| `customer.subscription.updated` | Update `subscriptions` row, sync `users.plan` if tier changed |
| `customer.subscription.deleted` | Set `users.plan = 'free'`, update `subscriptions.status` |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'`, trigger email via Resend |
| `invoice.payment_succeeded` | Update `subscriptions.current_period_end` |

**Confidence:** HIGH -- Stripe documentation explicitly documents the raw body requirement and the Express mounting pattern. Verified via official Stripe docs.

---

## Integration Point 5: Dashboard Route

### New API endpoints and SPA route

**The self-destruction problem:** Secrets destroy themselves on first view. The dashboard cannot list what a user created if those secrets are gone. Solution: store metadata on creation, separate from the secret content. When a user creates a secret while authenticated, record a `secrets` row with their `user_id`. The `viewedAt` timestamp records when it was consumed. After view, the ciphertext is zeroed and deleted -- but the metadata row persists until expiry.

**New API endpoints:**

```
GET  /api/users/me              -> { id, email, plan, createdAt }
GET  /api/users/me/secrets      -> [{ id, createdAt, expiresAt, viewedAt, hasPassword, fileSize }]
     Query params: ?page=1&limit=20
     Returns metadata only -- never ciphertext (ciphertext is destroyed on view)
DELETE /api/users/me/secrets/:id -> 204 (revoke a secret before it is viewed)
GET  /api/users/me/subscription -> { plan, status, currentPeriodEnd, cancelAtPeriodEnd }
POST /api/users/me/subscription/portal -> { url } (Stripe Customer Portal session)
```

**Dashboard SPA route** -- add to `client/src/router.ts`:

```typescript
} else if (path === '/dashboard') {
  // Authenticated users only -- client-side redirect if no session
  updatePageMeta({
    title: 'Dashboard',
    description: 'Manage your secrets and subscription.',
    noindex: true,  // dashboard is private; never index
  });
  import('./pages/dashboard.js')
    .then((mod) => mod.renderDashboardPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
} else if (path.startsWith('/auth/')) {
  updatePageMeta({
    title: 'Sign In',
    description: 'Sign in to SecureShare.',
    noindex: true,
  });
  import('./pages/auth.js')
    .then((mod) => mod.renderAuthPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

**Dashboard does not need secrets to be un-destroyed.** The metadata row (id, createdAt, expiresAt, viewedAt) remains in the DB. The ciphertext is already zeroed and deleted on view -- that invariant is unchanged. The dashboard shows "viewed at [time]" or "awaiting view" or "expired" status.

**Confidence:** HIGH -- this pattern (metadata persists, content destroys) is a standard design for anonymous-but-trackable content systems.

---

## Integration Point 6: PostHog Analytics

### Browser SDK and CSP nonce

**Problem:** The existing CSP uses `nonce-{value}` for `script-src`. Vite injects `__CSP_NONCE__` as a placeholder that Express replaces at serve time. PostHog's browser SDK loads as an inline script that needs a nonce to be permitted by the CSP.

**Recommended approach:** Include PostHog via a script tag in `client/index.html` with the nonce placeholder, not via dynamic import in TypeScript:

```html
<!-- client/index.html -- PostHog initialization -->
<script nonce="__CSP_NONCE__">
  !function(t,e){/* PostHog snippet */}(window,document,'posthog');
  posthog.init('phc_YOUR_KEY', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
  });
</script>
```

The `nonce="__CSP_NONCE__"` placeholder is replaced by Express at serve time (the same mechanism already used for `<script type="module" nonce="__CSP_NONCE__">`).

**CSP directive additions needed in `security.ts`:**

```typescript
// In createHelmetMiddleware(), update existing directives:
connectSrc: [
  "'self'",
  'https://us.i.posthog.com',       // PostHog event ingestion
  'https://us-assets.i.posthog.com', // PostHog asset loading
],
scriptSrc: [
  "'self'",
  nonceFn,                           // existing nonce function
  'https://us-assets.i.posthog.com', // PostHog script CDN
],
```

**Important notes on PostHog and CSP:**
- PostHog removed eval() usage after version 1.236.5 (confirmed via GitHub issue #1918, closed). Do NOT add `script-src: 'unsafe-eval'` -- it is not needed for current versions and would weaken the CSP.
- The PostHog toolbar (admin debugging tool, NOT needed for production analytics) uses inline styles. For production event tracking only, the existing nonce-based `style-src` is sufficient. Do not add `style-src: 'unsafe-inline'`.
- If using PostHog EU region instead of US, replace `us.i.posthog.com` and `us-assets.i.posthog.com` with `eu.i.posthog.com` and `eu-assets.i.posthog.com`.

**Server-side PostHog for conversion funnels:**

Use `posthog-node` for server-side event capture. Key events to track server-side (where browser SDK cannot reliably capture):

```typescript
// server/src/services/analytics.ts [NEW]
import { PostHog } from 'posthog-node';
import { env } from '../config/env.js';

export const posthog = env.POSTHOG_API_KEY
  ? new PostHog(env.POSTHOG_API_KEY, { host: 'https://us.i.posthog.com' })
  : null;

// Events to capture:
// 'secret_created' -- { userId: string|null, hasPassword: bool, expiresIn: string, hasFile: bool }
// 'secret_viewed'  -- { userId: string|null } (on successful retrieve)
// 'user_registered'
// 'user_upgraded'  -- after Stripe webhook confirms subscription
// 'user_churned'   -- after subscription.deleted webhook
```

Server-side events use a `distinctId` of either the user's ID (authenticated) or an anonymous ID stored in the session (not IP address, which would be PII).

```typescript
// Anonymous ID: set once per session, stored in req.session
if (!req.session.anonymousId) {
  req.session.anonymousId = nanoid();
}
const distinctId = req.user?.id ?? req.session.anonymousId;
posthog?.capture({ distinctId, event: 'secret_created', properties: { ... } });
```

**Confidence:** MEDIUM -- PostHog nonce injection pattern extends the existing __CSP_NONCE__ mechanism (HIGH confidence for the mechanism; MEDIUM for PostHog-specific CSP domain list, which should be verified at integration time by checking the PostHog dashboard for your region's endpoints).

---

## Integration Point 7: File Uploads on Render.com

### The ephemeral filesystem problem and solution

Render.com's filesystem is ephemeral -- files written to disk are lost on redeploy or restart. Persistent disks exist but have a critical constraint: **a service with a persistent disk cannot scale to multiple instances** and does not support zero-downtime deploys (it stops the old instance before starting the new one).

**Recommendation: Cloudflare R2 with presigned URLs**

Use Cloudflare R2 (S3-compatible, zero egress fees) with presigned PUT URLs for direct client-to-R2 upload. The server never holds the file bytes in memory.

**Upload flow:**

```
[Browser (Pro user)]
  1. POST /api/users/me/upload-url
     body: { filename, mimeType, fileSize }
     (server validates Pro tier, file size <= 25MB, generates presigned PUT URL)
  2. Server responds: { uploadUrl, fileKey }
  3. Browser PUTs encrypted file directly to R2 uploadUrl (bypasses Express entirely)
  4. Browser POSTs /api/secrets with fileKey instead of ciphertext
  5. Server creates secrets row with fileKey

[Reveal flow]
  1. GET /api/secrets/:id -> returns fileKey (no ciphertext for file secrets)
  2. Browser requests presigned GET URL from /api/secrets/:id/download
  3. Server generates time-limited presigned GET URL (60 seconds), atomically destroys secrets row
  4. Browser downloads encrypted file from R2 using presigned URL
  5. Browser decrypts with key from URL fragment
  6. R2 object cleanup via lifecycle rule or expiration cron job
```

**R2 advantages over AWS S3 for this use case:**
- Zero egress fees (file downloads are the expensive operation on S3)
- S3-compatible API -- uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- No multi-instance constraints (unlike Render persistent disks)

**File size limit enforcement:** Validate `fileSize <= 25MB` at presigned URL generation time on the server. Include the content-length condition in the presigned URL signature so R2 rejects oversize uploads even if the client tries to bypass the limit.

**Zero-knowledge preservation for files:** The browser encrypts the file with AES-256-GCM (same Web Crypto module) before uploading to R2. The encrypted bytes go to R2; the key goes in the URL fragment. R2 sees only ciphertext, same as PostgreSQL does for text secrets.

**Confidence:** MEDIUM -- Cloudflare R2 presigned URL pattern is documented with AWS SDK v3 (HIGH). The zero-knowledge file encryption approach is an extension of existing crypto module patterns (HIGH). Render ephemeral filesystem limitation is confirmed (HIGH). The specific integration with the existing app needs implementation-time verification.

---

## Component Boundaries: New vs Modified

### New Files

| File | Layer | Responsibility |
|------|-------|---------------|
| `server/src/middleware/session.ts` | Middleware | express-session + connect-redis factory |
| `server/src/routes/auth.ts` | Routes | Login, register, logout, OAuth callbacks |
| `server/src/routes/users.ts` | Routes | Dashboard API: profile, secrets list, upload URL |
| `server/src/routes/stripe-webhook.ts` | Routes | Raw body handler, event routing |
| `server/src/services/auth.service.ts` | Services | Password verify, session management, OAuth |
| `server/src/services/users.service.ts` | Services | User CRUD, plan lookup |
| `server/src/services/stripe.service.ts` | Services | Stripe API calls, portal session creation |
| `server/src/services/email.service.ts` | Services | Resend transactional emails |
| `server/src/services/upload.service.ts` | Services | R2 presigned URL generation |
| `server/src/services/analytics.ts` | Services | posthog-node event capture singleton |
| `client/src/pages/auth.ts` | Frontend | Login/register/OAuth UI |
| `client/src/pages/dashboard.ts` | Frontend | Dashboard: secrets list, plan badge, upgrade CTA |
| `client/src/api/auth.ts` | Frontend | Auth API calls |
| `client/src/api/users.ts` | Frontend | Dashboard API calls |
| `shared/types/auth.ts` | Shared | Zod schemas: LoginRequest, RegisterRequest, UserProfile |
| `shared/types/users.ts` | Shared | Zod schemas: DashboardSecret, SubscriptionInfo |

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `server/src/app.ts` | Add session middleware, passport, Stripe raw route | New middleware pipeline requirements |
| `server/src/db/schema.ts` | Add users, subscriptions tables; add user_id FK to secrets | New entities |
| `server/src/middleware/security.ts` | Add PostHog domains to connectSrc, scriptSrc | PostHog browser SDK CSP |
| `server/src/config/env.ts` | Add SESSION_SECRET, OAuth credentials, Stripe keys, PostHog, R2 | New external services |
| `server/src/routes/secrets.ts` | Read `req.user?.id` on POST / to attach userId on create | Associate secrets with accounts |
| `client/src/router.ts` | Add /dashboard and /auth/* routes | New SPA pages |
| `client/index.html` | Add PostHog init script with nonce placeholder | Browser analytics |

### Unchanged Files (Zero-Knowledge Core Intact)

| File | Why unchanged |
|------|---------------|
| `server/src/services/secrets.service.ts` | Atomic zero-then-delete pattern unchanged |
| `server/src/services/password.service.ts` | Argon2id hashing unchanged |
| `client/src/crypto/` | Web Crypto module unchanged |
| `client/src/pages/create.ts` | Create flow unchanged (userId attached server-side via session) |
| `client/src/pages/reveal.ts` | Reveal flow unchanged |
| `server/src/workers/expiration-worker.ts` | Cleanup cron unchanged |

---

## Data Flow: Key Paths

### Anonymous Secret Creation (unchanged)

```
Browser: encrypt(plaintext) -> POST /api/secrets { ciphertext, expiresIn }
         |
Express: createSecretLimiter -> validateBody -> createSecret(ciphertext, expiresIn, null)
         | req.user is undefined
PostgreSQL: INSERT secrets (id, ciphertext, expiresAt, userId=NULL)
         |
Response: { id, expiresAt }
```

### Authenticated Secret Creation (new path through existing endpoint)

```
Browser: (session cookie sent automatically)
         encrypt(plaintext) -> POST /api/secrets { ciphertext, expiresIn }
         |
Express: session middleware resolves req.user from Redis session
         createSecretLimiter (higher limit for authenticated) -> validateBody
         createSecret(ciphertext, expiresIn, req.user.id)
         |
PostgreSQL: INSERT secrets (id, ciphertext, expiresAt, userId='abc123')
         |
posthog-node: capture('secret_created', { userId: 'abc123', ... })
```

### Stripe Subscription Webhook

```
Stripe -> POST /api/webhooks/stripe
         |
express.raw() -> Buffer body preserved
         |
stripe.webhooks.constructEvent(body, sig, secret) -> verifies HMAC-SHA256
         |
event.type = 'checkout.session.completed'
         | database transaction
PostgreSQL: UPDATE users SET plan='pro' WHERE stripeCustomerId=...
            INSERT subscriptions (userId, stripeSubscriptionId, status, ...)
            ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = EXCLUDED.status
         |
posthog-node: capture('user_upgraded', { userId, plan: 'pro' })
         |
Resend: send 'Welcome to Pro' email
         |
Response: 200 { received: true }
```

### Dashboard Secrets List

```
Browser: GET /api/users/me/secrets (session cookie in request)
         |
Express: requireAuth middleware -> 401 if no session
         |
PostgreSQL: SELECT id, created_at, expires_at, viewed_at,
              (password_hash IS NOT NULL) AS has_password, file_size
            FROM secrets
            WHERE user_id = req.user.id
            AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 20 OFFSET (page-1)*20
            -- uses partial index secrets_user_id_idx
         |
Response: [{ id, createdAt, expiresAt, viewedAt, hasPassword, fileSize }]
          NOTE: ciphertext is NEVER returned in this list
```

---

## Architectural Patterns

### Pattern 1: Feature Gate via Plan Check

**What:** Check `req.user.plan` at the route or service layer before allowing Pro-tier operations (file upload, higher rate limits, longer expiration).

**When:** Any route that requires Pro tier.

```typescript
// server/src/middleware/require-plan.ts
export function requirePlan(plan: 'pro') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.plan !== plan) {
      res.status(403).json({ error: 'upgrade_required', requiredPlan: plan });
      return;
    }
    next();
  };
}

// Usage:
router.post('/upload-url', requireAuth, requirePlan('pro'), uploadUrlHandler);
```

**Trade-off:** `req.user.plan` is the denormalized value from the users table, loaded via session deserialization. For instant plan changes after Stripe webhook fires, either (a) re-read plan from DB on each authenticated request (one lightweight query, always fresh) or (b) invalidate the session when plan changes. Option (a) is simpler and recommended for v4.0.

### Pattern 2: OAuth State Parameter for CSRF Protection

**What:** Generate a random `state` parameter before redirecting to OAuth provider. Store it in the session. Verify on callback.

**When:** All OAuth flows (Google, GitHub). Passport.js handles this automatically with `passport-google-oauth20` and `passport-github2`.

**Trade-off:** Requires the session to be established before the OAuth redirect. This is why `saveUninitialized: false` is correct -- the session is only saved when there is something to store (like the OAuth state), not for every anonymous visitor.

### Pattern 3: Idempotent Stripe Webhook Processing

**What:** Stripe may deliver the same webhook event more than once. Make handlers idempotent using `ON CONFLICT DO UPDATE` in PostgreSQL. No separate events deduplication table needed.

**When:** All Stripe webhook handlers.

```typescript
// Idempotent subscription upsert
await db.insert(subscriptions).values({
  stripeSubscriptionId: subscription.id,
  userId,
  status: subscription.status,
  currentPeriodEnd: new Date(subscription.current_period_end * 1000),
}).onConflictDoUpdate({
  target: subscriptions.stripeSubscriptionId,
  set: {
    status: sql`EXCLUDED.status`,
    currentPeriodEnd: sql`EXCLUDED.current_period_end`,
    updatedAt: new Date(),
  },
});
```

### Pattern 4: Anonymous PostHog Distinct IDs

**What:** Server-side PostHog events for unauthenticated users need a non-PII distinct ID.

**When:** Capturing anonymous events server-side (secret created/viewed by non-logged-in user).

**Implementation:** Session-scoped nanoid, set once and stored in `req.session`. Not IP address (PII). Not fingerprint data (unreliable, privacy concern).

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global JSON Parser Before Stripe Webhook

**What people do:** Mount `express.json()` globally at the top of `buildApp()`, then add a Stripe webhook route below it.

**Why it's wrong:** `stripe.webhooks.constructEvent()` receives a parsed object, not a raw Buffer. The HMAC-SHA256 signature verification fails because the signature is over the raw bytes, and JSON.stringify(JSON.parse(rawBody)) does not produce the original bytes.

**Do this instead:** Mount the Stripe webhook route directly on the app instance before the `express.json()` middleware line, using `express.raw({ type: 'application/json' })` for that specific route only.

### Anti-Pattern 2: Storing Session in PostgreSQL Instead of Redis

**What people do:** Use `connect-pg-simple` to store sessions in PostgreSQL, avoiding Redis dependency.

**Why it's wrong:** Sessions are read on every authenticated request. High read frequency on PostgreSQL for a non-relational lookup (session ID -> user data) wastes connection pool capacity and is significantly slower than Redis. The codebase already has Redis; using it for sessions is zero additional infrastructure.

**Do this instead:** `connect-redis` v9 with the existing `ioredis` client, separate key namespace (`sess:` prefix).

### Anti-Pattern 3: Uploading Files Through Express to Render

**What people do:** Use `multer` to receive file uploads in Express, write to disk, then stream to R2.

**Why it's wrong:** Render's filesystem is ephemeral. A crash or redeploy mid-upload loses the file. Express holds the entire file in memory or disk during upload, creating memory pressure for 25MB files. Does not work with multiple instances.

**Do this instead:** Presigned PUT URL pattern -- server generates a time-limited URL, browser uploads directly to R2. Server never touches file bytes. Works with any number of instances, survives Render restarts.

### Anti-Pattern 4: `sameSite: 'strict'` on Session Cookie with OAuth

**What people do:** Set the strictest possible SameSite policy on all cookies.

**Why it's wrong:** OAuth provider redirects users back to `/api/auth/google/callback` from google.com. This is a cross-site top-level navigation. With `sameSite: 'strict'`, the session cookie is not sent on this request, so the OAuth state stored in the session cannot be verified, causing a CSRF validation failure (confirmed in oauth2-proxy issue #1663 and multiple Node.js OAuth implementations).

**Do this instead:** `sameSite: 'lax'`. Cross-site top-level navigations (the OAuth redirect) include the cookie; cross-site subresource requests do not.

### Anti-Pattern 5: No Index on secrets.user_id

**What people do:** Add `user_id` column to secrets table but no index, then run `SELECT ... WHERE user_id = ?` for the dashboard.

**Why it's wrong:** Without an index, this is a full table scan on the secrets table -- the largest table in the system.

**Do this instead:** Partial index on `user_id` covering only non-null rows (the dashboard query pattern). Defined in the Drizzle schema alongside the column addition.

---

## Build Order: Dependency Chain

```
Phase 1: Database Foundation
|
+-- users table (Drizzle schema + migration)
+-- subscriptions table (Drizzle schema + migration)
+-- Add user_id FK to secrets (migration -- nullable, non-breaking)
+-- Add secrets metadata columns (viewed_at, file_key, etc.)
+-- Add partial index on secrets.user_id
    ALL subsequent phases depend on this schema

Phase 2: Authentication (depends on Phase 1 -- users table)
|
+-- SESSION_SECRET env var + session middleware
+-- express-session + connect-redis setup in app.ts
+-- passport.js local strategy (email/password)
+-- /api/auth/register, /api/auth/login, /api/auth/logout
+-- Auth pages in SPA (login, register)
+-- requireAuth middleware
    Dashboard, Stripe, Rate limiting all depend on auth being complete

Phase 3: Rate Limiting Update (depends on Phase 2 -- req.user available)
|
+-- Higher limits for authenticated users in createSecretLimiter

Phase 4: Dashboard (depends on Phase 1 schema, Phase 2 auth)
|
+-- GET /api/users/me
+-- GET /api/users/me/secrets (metadata only)
+-- DELETE /api/users/me/secrets/:id (revocation)
+-- Dashboard SPA page
+-- Modify secrets POST route to attach req.user?.id on create

Phase 5: Stripe Billing (depends on Phase 1 subscriptions table, Phase 2 users)
|
+-- Stripe raw webhook route in app.ts (BEFORE express.json)
+-- checkout.session.completed handler
+-- customer.subscription.* handlers
+-- GET/POST /api/users/me/subscription (plan info + portal)
+-- Upgrade CTA on dashboard
+-- requirePlan middleware

Phase 6: OAuth (depends on Phase 2 -- session infrastructure exists)
|
+-- passport-google-oauth20 strategy
+-- passport-github2 strategy
+-- /api/auth/google, /api/auth/google/callback
+-- /api/auth/github, /api/auth/github/callback
+-- OAuth buttons in auth page

Phase 7: PostHog Analytics (depends on Phase 2 for user IDs)
|
+-- posthog-node singleton in services/analytics.ts
+-- Browser SDK in client/index.html (with __CSP_NONCE__ placeholder)
+-- CSP directive updates in security.ts (connectSrc, scriptSrc)
+-- Event capture in secrets routes, auth routes, Stripe webhook handler

Phase 8: Transactional Email (depends on Phase 1, Phase 2, Phase 5)
|
+-- Resend SDK setup (email.service.ts)
+-- Email on registration (email verification)
+-- Email on subscription events (welcome, payment failed, cancellation)
+-- Email on secret expiry warning (Pro tier feature)

Phase 9: File Uploads (depends on Phase 1 schema, Phase 2 auth, Phase 5 plan check)
|
+-- Cloudflare R2 bucket setup + env vars
+-- POST /api/users/me/upload-url (presigned PUT URL generation)
+-- GET /api/secrets/:id/download (presigned GET URL, atomic destroy)
+-- File encryption in browser (extend crypto module)
+-- File secrets in create page (Pro tier UI)
+-- File display in reveal page
```

**Why this ordering:**

1. **Schema first:** Every other phase requires database tables. A non-nullable migration on secrets would break the app; nullable FK is safe and non-breaking.
2. **Auth before everything user-specific:** Dashboard, Stripe portal, plan enforcement all require `req.user` to exist. Session infrastructure is needed for OAuth state and anonymous PostHog IDs.
3. **Stripe before OAuth:** The upgrade flow (Stripe Checkout) should work before adding OAuth sign-in, so the billing infrastructure is testable with email/password accounts first.
4. **Analytics after auth:** Server-side events are most valuable when tied to user IDs. Building analytics before auth means all events are anonymous.
5. **Email after billing:** The most critical emails are billing-related (payment failed, subscription active). Email infrastructure is needed for billing; registration email is secondary.
6. **File uploads last:** Most complex feature, Pro-tier only, depends on all prior phases. Builds on the existing crypto module. Derisked by doing everything else first.

---

## Scaling Considerations

| Concern | At Launch (0-1K users) | At 10K users | At 100K users |
|---------|----------------------|--------------|---------------|
| Session storage | MemoryStore -> Redis (already have Redis) | Redis is fine | Redis Cluster |
| Secrets dashboard query | userId partial index is sufficient | Index + pagination | Index + pagination + read replica |
| File uploads | R2 presigned URLs (stateless, Express uninvolved) | Same | Same (R2 scales independently) |
| PostHog events | posthog-node batching (async, non-blocking) | Same | Same |
| Stripe webhooks | Single instance, idempotent handlers | Multiple instances OK | Same |
| Rate limiting | Redis-backed (already) | Same | Redis Cluster |

---

## Integration Points: External Services

| Service | Integration Pattern | Specific Notes |
|---------|---------------------|---------------|
| Stripe | Raw body webhook + Stripe.js checkout redirect | Mount before `express.json()`; verify HMAC-SHA256 signature on every event |
| Resend | `resend` npm SDK (REST over HTTPS) | Async, non-blocking; failures log but don't fail requests |
| PostHog browser | Script tag in index.html with nonce | Requires CSP `connectSrc` update: `https://us.i.posthog.com` |
| PostHog server | `posthog-node` singleton, async capture | Use session anonymousId for unauthenticated users |
| Cloudflare R2 | `@aws-sdk/client-s3` + presigned URLs | No file bytes through Express; zero egress fees |
| Google OAuth | `passport-google-oauth20` | `sameSite: 'lax'` required on session cookie |
| GitHub OAuth | `passport-github2` | Same as Google OAuth |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Auth middleware <-> Routes | `req.user` set by passport session deserialization | Type-augment Express `Request` interface in a `.d.ts` file |
| Stripe webhook <-> Services | Direct service calls in handler | Run DB updates in a transaction; idempotent via ON CONFLICT |
| Session <-> Rate limiter | Separate Redis namespaces (`sess:`, `rl:`) | Both use same ioredis client instance from buildApp() |
| Analytics <-> All routes | posthog singleton import, optional | Guard all calls with `posthog?.capture(...)` -- null if POSTHOG_API_KEY not set |

---

## Sources

- [Stripe Webhook Express.js Setup](https://docs.stripe.com/webhooks) -- raw body requirement, constructEvent pattern (HIGH -- official)
- [connect-redis v9 npm](https://www.npmjs.com/package/connect-redis) -- ESM import, ioredis compatibility, no @types needed (HIGH -- official npm)
- [PostHog CSP Issue #1918](https://github.com/PostHog/posthog-js/issues/1918) -- eval regression fixed post v1.236.5 (HIGH -- closed GitHub issue)
- [PostHog CSP Domains](https://github.com/PostHog/posthog/issues/20461) -- connect-src eu.i.posthog.com, us.i.posthog.com (MEDIUM -- GitHub issue)
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- AWS SDK v3 compatible (HIGH -- official Cloudflare docs)
- [Render Persistent Disks](https://render.com/docs/disks) -- single instance constraint, no zero-downtime deploys with disk (HIGH -- official Render docs)
- [Drizzle ORM Nullable FK Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/2531) -- nullable FK syntax without `.notNull()` (MEDIUM -- GitHub discussion)
- [Drizzle-kit FK+Column migration bug #4147](https://github.com/drizzle-team/drizzle-orm/issues/4147) -- inspect generated SQL before applying (HIGH -- open bug report)
- [express-session SameSite OAuth issue](https://github.com/oauth2-proxy/oauth2-proxy/issues/1663) -- strict breaks OAuth callbacks (HIGH -- confirmed multiple sources)
- [JWTs vs Sessions](https://stytch.com/blog/jwts-vs-sessions-which-is-right-for-you/) -- trade-off analysis (MEDIUM -- vendor blog, but analysis matches established patterns)

---
*Architecture research for: SecureShare v4.0 Hybrid Anonymous + Account Model*
*Researched: 2026-02-18*
