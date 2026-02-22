# Stack Research

**Domain:** Hybrid anonymous + account model additions (auth, payments, email, analytics, passphrase generation)
**Researched:** 2026-02-18
**Confidence:** HIGH — all library versions verified via npm registry; integration details verified via official docs and GitHub

---

## Scope

This document covers ONLY new additions needed for v4.0. Existing validated stack (Node.js 24, Express 5, Vite 7, Vanilla TS, Tailwind CSS 4, Drizzle ORM 0.45.1, PostgreSQL 17, Redis, Argon2id, Helmet CSP nonces, Vitest 4, Zod 4, nanoid 5, ESLint 10, Playwright, GitHub Actions) is unchanged and not re-researched.

---

## 1. EFF Diceware Passphrase Generation

### Recommendation: Ship the wordlist as a static JSON asset — no new npm dependency

**Why not `eff-diceware-passphrase@3.0.0`:** The package is CJS-only (no `"exports"` field, `"main": "index.js"`). In an ESM-only codebase with `"type": "module"` and NodeNext module resolution, importing CJS packages without `.cjs` extensions requires Vite resolve aliases. The package is also lightly maintained (13 commits total, no recent activity). It provides nothing that cannot be done in ~30 lines using the Web Crypto API already present in this codebase.

**Recommended approach — zero external dependency:**

Commit the EFF large wordlist as a static JSON file. Vite handles JSON imports natively with no plugin.

```typescript
// client/src/crypto/passphrase.ts
import wordlist from '../assets/eff-wordlist.json' with { type: 'json' }
// Note: use "assert" syntax if TypeScript < 5.3

export function generatePassphrase(wordCount: 4 | 6): string {
  const indices = new Uint32Array(wordCount)
  crypto.getRandomValues(indices)
  return Array.from(indices)
    .map(n => wordlist[n % wordlist.length])
    .join(' ')
}
```

**Entropy:** 4-word passphrase = ~51.7 bits (12.92 bits per word × 4). 6-word = ~77.5 bits. Both exceed NIST SP 800-63B minimum for memorized secrets.

**Bundle impact:** EFF large wordlist is 7,776 words, ~85 KB uncompressed, ~25 KB gzipped. Vite tree-shakes JSON imports are not tree-shakeable (it is an array), so the full ~25 KB gzipped is added to the bundle for any page that imports it. Accept this: it is a one-time download, cached by the browser.

**Wordlist source:** Download from https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt. Convert to JSON array and commit to `client/src/assets/eff-wordlist.json`.

**If the npm package is preferred anyway:**

| Package | Version | Notes |
|---------|---------|-------|
| `eff-diceware-passphrase` | `3.0.0` | CJS-only. Requires Vite `resolve.alias` workaround. Not recommended for this codebase. |

---

## 2. User Authentication

### Recommendation: `better-auth@1.4.18` + `@better-auth/stripe@1.4.18`

**Why Better Auth over alternatives:**

| Library | Status 2026 | Verdict |
|---------|-------------|---------|
| **Better Auth 1.4.18** | Active, 100% ESM since v1.4, rapidly growing | **Recommended.** Framework-agnostic, Express 5 integration documented, vanilla TS client via `createAuthClient`, built-in Drizzle ORM adapter, built-in Google + GitHub OAuth, database-backed sessions, Stripe plugin available. |
| Lucia v3 | Deprecated March 2025 | Avoid. Maintainer explicitly deprecated it; recommends migrating to Better Auth. |
| Passport.js 0.7.0 | Maintained but aging | Avoid for greenfield. Last OAuth2 strategy release was 2+ years ago. Requires hand-rolling session management, OAuth callbacks, DB schema, CSRF — everything Better Auth provides pre-built. Not TypeScript-first. |
| Auth.js v5 | Active | Next.js-centric design; Express adapter is secondary-class. Better Auth is more natural for raw Express 5. |
| Custom sessions | Always possible | Viable but adds ~2–3 phases of implementation work (session table, CSRF, OAuth callbacks, email verification, password reset). Better Auth is that work, pre-built and audited. |

**Why Better Auth fits this specific codebase:**

- **ESM-only (v1.4+):** Better Auth 1.4 is 100% ESM. SecureShare is `"type": "module"` with NodeNext resolution. Perfect match. Earlier versions had a `jose` ESM interop conflict (`ERR_REQUIRE_ESM`) that is fully resolved in v1.4+.
- **Express 5:** Official integration documented. Express 5 catch-all uses `app.all('/api/auth/*splat', toNodeHandler(auth))`, matching SecureShare's existing Express 5 wildcard pattern.
- **Vanilla TS client:** `createAuthClient` from `better-auth/client` — no React, no framework dependency. Drops into the existing SPA.
- **Drizzle ORM:** Official Drizzle adapter with peer dependency `drizzle-orm >=0.41.0`. Installed version is `drizzle-orm@0.45.1` — compatible.
- **Database-backed sessions:** Default mode uses signed cookies + PostgreSQL `session` table. Sessions are revocable. No JWT footguns. Fits the zero-trust philosophy of SecureShare (server should not know secrets; it can however know who is logged in).
- **OAuth providers:** Google and GitHub are first-class built-in providers (40+ total). Configuration is `socialProviders: { google: { clientId, clientSecret }, github: { clientId, clientSecret } }`.
- **Email verification hook:** `emailAndPassword.sendVerificationEmail` callback plugs directly into Resend (see Section 4).
- **Schema generation via CLI:** `npx @better-auth/cli generate` creates Drizzle schema for `user`, `session`, `account`, `verification` tables. No hand-writing auth tables.

### Session Strategy: Database-backed cookie sessions (not JWT)

Better Auth uses signed cookies containing a session token. Sessions live in a PostgreSQL `session` table. Cookie caching is optional for performance (reduces DB reads via short-lived signed cookie). This approach is correct for SecureShare: sessions are revocable, logout is real logout, GDPR compliance is straightforward (delete session row).

### Auth Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `better-auth` | `1.4.18` | Auth server + Drizzle adapter + OAuth providers + email/password |
| `@better-auth/stripe` | `1.4.18` | Stripe subscription plugin (version is synchronized with better-auth) |

```bash
npm install better-auth @better-auth/stripe
```

### Express 5 Integration Pattern

```typescript
// server/src/routes/auth.ts
import { toNodeHandler } from 'better-auth/node'
import { auth } from '../config/auth.js'

// Express 5 wildcard syntax (*splat, not *)
app.all('/api/auth/*splat', toNodeHandler(auth))
```

```typescript
// server/src/config/auth.ts
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '../db/connection.js'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // plug in resend.emails.send() here
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
})
```

---

## 3. Stripe Subscription Billing

### Recommendation: `stripe@20.3.1` + `@better-auth/stripe@1.4.18`

**Why `@better-auth/stripe` plugin over custom Stripe integration:**

The plugin provides ~1 phase of boilerplate for free:
- Automatic Stripe Customer creation on user signup
- Subscription lifecycle webhook handling (`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`)
- Subscription status sync to database (including `cancelAtPeriodEnd`, `cancelAt`, `canceledAt`)
- Trial period management with one-trial-per-account abuse prevention
- Customer Portal session creation helper

**Peer dependencies verified:** `@better-auth/stripe` requires `stripe@^18 || ^19 || ^20` and `better-auth@1.4.18`. Both are satisfied.

**No client-side Stripe SDK needed.** The $7/month single plan fits Stripe Hosted Checkout (redirect flow). No embedded card elements required. This means no `@stripe/stripe-js` in the Vite bundle and no additional `script-src` CSP entries for `js.stripe.com`.

### Stripe Packages

| Package | Version | Side | Purpose |
|---------|---------|------|---------|
| `stripe` | `20.3.1` | Server only | Stripe API client: checkout sessions, billing portal, webhook verification |

```bash
npm install stripe
```

### Webhook Route Pattern (raw body required)

Express 5 webhook route must bypass the JSON bodyParser to preserve the raw body for `stripe.webhooks.constructEvent()`. The `@better-auth/stripe` plugin wraps this internally, but the raw middleware must be registered before the JSON parser for this route.

```typescript
// server/src/app.ts — register webhook route BEFORE express.json() middleware
app.post('/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripe.webhookHandler  // provided by @better-auth/stripe
)

// Then register express.json() for all other routes
app.use(express.json())
```

**This ordering is critical.** The existing `app.ts` middleware comment — "middleware order is critical" — already flags this pattern. The webhook route must be added before `express.json()` in the stack.

### Stripe API Version

`@better-auth/stripe` pins API version `2025-11-17.clover`. This exceeds the minimum `2025-06-30.basil` required for accurate subscription behavior. Accept the plugin's pinned version.

### Stripe Packages

| Package | Version | Side | Notes |
|---------|---------|------|-------|
| `stripe` | `20.3.1` | Server | ESM import: `import Stripe from 'stripe'` |

---

## 4. Transactional Email

### Recommendation: `resend@6.9.2`

**Why Resend over alternatives:**

| Library | Verdict | Reason |
|---------|---------|--------|
| **Resend 6.9.2** | **Recommended** | ESM-native (`import { Resend } from 'resend'`). Plain HTML supported — no React Email required. Free tier: 3,000 emails/month, 100/day, 1 domain. Typed `{ data, error }` response pattern aligns with existing Zod validation style. Clean REST API — no SMTP server needed. |
| SendGrid | Avoid | Free tier eliminated July 2025. More complex API. Overkill for low-volume transactional email. |
| Nodemailer | Avoid for new code | Requires SMTP server or relay credentials. Single Render.com instance has no configured mail relay. More operational complexity than a REST API call. |
| AWS SES | Overkill | Requires AWS account, IAM roles, SES sandbox approval. No benefit at SecureShare's volume. |

**Integration with Better Auth's `sendVerificationEmail`:**

```typescript
// server/src/services/email.service.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'SecureShare <noreply@yourdomain.com>',
    to,
    subject: 'Verify your email address',
    html: `<p>Click to verify your email: <a href="${url}">${url}</a></p>`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSecretViewedNotification(to: string, secretLabel: string | null): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'SecureShare <noreply@yourdomain.com>',
    to,
    subject: 'Your secret was viewed',
    html: `<p>Your secret${secretLabel ? ` "${secretLabel}"` : ''} was viewed and has been destroyed.</p>`,
  })
  if (error) throw new Error(error.message)
}
```

**Note on non-awaited email sends:** Per Better Auth documentation, `sendVerificationEmail` should not be awaited on serverless platforms to prevent timing attacks. On Render.com (persistent server), awaiting is acceptable but wrapping in `void` plus catching errors separately is cleaner.

### Email Package

| Package | Version | Purpose |
|---------|---------|---------|
| `resend` | `6.9.2` | Transactional email via REST API |

```bash
npm install resend
```

---

## 5. Analytics

### Recommendation: `posthog-js@1.351.1` (client, bundled) + `posthog-node@5.24.17` (server)

**Why PostHog:**
- Open-source, self-hostable, privacy-safe by default
- Anonymous-first: no user identity until explicit identification
- No third-party cookies required
- Free tier: 1 million events/month

### CSP Compatibility — Critical for SecureShare

SecureShare uses Helmet with per-request nonces. This creates two constraints:

1. **No dynamic script injection** — scripts injected at runtime cannot receive a per-request nonce. The PostHog snippet approach injects `<script>` tags dynamically and is therefore **incompatible** with nonce-based CSP.

2. **No `unsafe-eval` required** — PostHog had a historic `unsafe-eval` dependency (issue #1918 on posthog-js). This was fixed and a linting rule added to prevent regression. Current versions do not require `unsafe-eval`.

**Solution: Use posthog-js via npm, bundled by Vite.** The bundled approach includes PostHog in the main JS bundle — no dynamic script injection, no nonce issues.

**Required CSP additions to Helmet config (connect-src only):**

```typescript
// server/src/middleware/security.ts
// Add to the connectSrc array in the Helmet CSP config:
'https://us.i.posthog.com',         // PostHog ingestion (US)
'https://us-assets.i.posthog.com',  // PostHog static assets
// Use eu.i.posthog.com + eu-assets.i.posthog.com for EU data residency
```

`script-src` does NOT need modification when using the bundled approach. No `unsafe-eval`, no `unsafe-inline`, no external script domain.

**posthog-js client initialization:**

```typescript
// client/src/analytics.ts
import posthog from 'posthog-js'

export function initAnalytics(): void {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: 'history_change',  // fires on History API pushState — fits SPA router
    session_recording: { maskAllInputs: true, maskTextSelector: '*' }, // privacy default
    persistence: 'localStorage+cookie',
    autocapture: false,  // disable for privacy; capture events explicitly
  })
}

export { posthog }
```

`capture_pageview: 'history_change'` is the correct setting for SecureShare's existing History API SPA router — pageviews fire on `pushState` without any additional integration.

**posthog-node server-side:**

```typescript
// server/src/services/analytics.service.ts
import { PostHog } from 'posthog-node'

export const analytics = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com',
  flushAt: 20,   // batch size before auto-flush
  flushInterval: 10_000, // ms between auto-flushes
})

// Register in graceful shutdown (server/src/server.ts already has SIGTERM handler)
export async function shutdownAnalytics(): Promise<void> {
  await analytics.shutdown()
}
```

**Why not `posthog-js-lite@4.5.2`:** Explicitly described as "reduced feature set" and "not officially supported for feature-complete web usage." Use full `posthog-js` with the bundled approach.

### Analytics Packages

| Package | Version | Side | Purpose |
|---------|---------|------|---------|
| `posthog-js` | `1.351.1` | Client (Vite bundle) | Pageviews, UI events, feature flags, session recording |
| `posthog-node` | `5.24.17` | Server | Server-side event capture (secret created, subscription events) |

```bash
npm install posthog-js posthog-node
```

---

## Complete Installation Command

```bash
# Auth + Stripe plugin
npm install better-auth @better-auth/stripe

# Payments
npm install stripe

# Email
npm install resend

# Analytics
npm install posthog-js posthog-node
```

**No new dev dependencies required.** All packages integrate with existing Vitest, ESLint, TypeScript, and Playwright setups.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `better-auth` | Passport.js | If you have an existing large Passport codebase or need a specific OAuth strategy from Passport's ecosystem that Better Auth does not cover |
| `better-auth` | Custom sessions | If you need unusual session semantics or want zero external auth dependencies — at cost of significant implementation time |
| `better-auth` | Auth.js v5 | If the project were Next.js-based — Auth.js is excellent there but secondary-class for plain Express |
| `resend` | Nodemailer | If you already have SMTP infrastructure (relay, credentials) and want to avoid third-party API dependencies |
| `posthog-js` bundled | PostHog snippet | Never prefer snippet in a nonce-CSP setup — dynamically injected `<script>` cannot receive a per-request nonce |
| `stripe` direct + `@better-auth/stripe` | Custom Stripe webhooks | If you need unusual billing logic that the plugin does not support |
| Custom wordlist JSON | `eff-diceware-passphrase` npm | If you want a pinned npm dependency over a committed JSON file — acceptable, but requires CJS interop workaround |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `passport` + `passport-google-oauth20` + `passport-github2` | Three packages for what Better Auth does in one. Not TS-first. Session management is manual. OAuth strategy last updated 2+ years ago. | `better-auth` with `socialProviders` |
| `lucia` (any version) | Officially deprecated March 2025. Maintainer recommends migrating to Better Auth. | `better-auth` |
| `jsonwebtoken` / JWT for sessions | For a database-backed app with revocation needs, stateless JWTs are an anti-pattern — logout does not actually revoke the token without a server-side blocklist. | Better Auth database-backed cookie sessions (default) |
| `@stripe/stripe-js` (client-side) | Not needed for hosted Checkout redirect flow. Adds bundle weight and requires `script-src https://js.stripe.com` in CSP. | Server-side `stripe` SDK only + redirect to `checkout.stripe.com` |
| SendGrid | Free tier eliminated July 2025. Complex API with legacy cruft. | `resend` |
| PostHog snippet approach | Injects `<script>` tags dynamically at runtime. Per-request CSP nonces cannot be applied to runtime-injected scripts. Breaks with strict nonce-based CSP. | `posthog-js` via npm + Vite bundle |
| `nodemailer` without SMTP relay | Requires SMTP server, TLS configuration, and authentication — none of which exist on a single Render.com instance. | `resend` REST API |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|----------------|-------|
| `better-auth` | `1.4.18` | `"type": "module"`, NodeNext, `drizzle-orm@>=0.41.0`, `vitest@^2\|\|^3\|\|^4` | All peer deps optional; ESM-only since v1.4 |
| `@better-auth/stripe` | `1.4.18` | `better-auth@1.4.18`, `stripe@^18\|\|^19\|\|^20` | Versions synchronized with better-auth |
| `stripe` | `20.3.1` | Node.js 16+, ESM + CJS dual export | `import Stripe from 'stripe'` works in ESM codebase |
| `resend` | `6.9.2` | Node.js 18+, ESM-native | `import { Resend } from 'resend'` — no interop issues |
| `posthog-js` | `1.351.1` | Vite 7, no `unsafe-eval` required | Bundled approach; `unsafe-eval` CSP issue fixed ~v1.236 |
| `posthog-node` | `5.24.17` | Node.js 14+, ESM | `import { PostHog } from 'posthog-node'` |
| `drizzle-orm` | `0.45.1` (installed) | `better-auth@1.4.18` | Peer dep `>=0.41.0` satisfied |

---

## New Environment Variables Required

```bash
# Better Auth
BETTER_AUTH_SECRET=           # 32+ char random string for signing cookies
BETTER_AUTH_URL=              # https://yourdomain.com (production URL)

# OAuth — Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth — GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=            # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=        # whsec_... from Stripe dashboard
STRIPE_PRO_PRICE_ID=          # price_... for the $7/month plan

# Resend
RESEND_API_KEY=               # re_...
RESEND_FROM_EMAIL=            # noreply@yourdomain.com

# PostHog (server-side)
POSTHOG_API_KEY=              # phc_... server key
POSTHOG_HOST=                 # https://us.i.posthog.com

# PostHog (client-side, exposed via Vite)
VITE_POSTHOG_KEY=             # phc_... same key or separate client key
VITE_POSTHOG_HOST=            # https://us.i.posthog.com
```

**Zod validation:** Add these to the existing `server/src/config/env.ts` Zod schema. Client env vars (`VITE_*`) are validated at build time by Vite; consider a separate `client/src/config/env.ts` for typed client env access.

---

## Sources

- `npm info better-auth` — version `1.4.18`; peer deps `drizzle-orm >=0.41.0` (optional), `vitest ^2||^3||^4` (optional)
- https://www.better-auth.com/blog/1-4 — 100% ESM confirmation, breaking changes (method renames), Stripe plugin details
- https://www.better-auth.com/docs/integrations/express — Express 5 `/*splat` pattern confirmed
- https://www.better-auth.com/docs/concepts/session-management — database-backed sessions, cookie caching
- https://www.better-auth.com/docs/plugins/stripe — `@better-auth/stripe` capabilities, `stripe@^18||^19||^20` requirement, API version `2025-11-17.clover`
- `npm info @better-auth/stripe` — version `1.4.18`, peer deps confirmed
- https://github.com/better-auth/better-auth/issues/6765 — Drizzle peer dep conflict history; resolved via `>=0.41.0` range in current release
- https://github.com/better-auth/better-auth/issues/3568 — ESM/`jose` conflict confirmed fixed in v1.4+
- `npm info stripe` — version `20.3.1`
- https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/express/main.ts — `express.raw()` webhook pattern, ESM `import Stripe from 'stripe'` confirmed
- `npm info resend` — version `6.9.2`
- https://resend.com/docs/send-with-nodejs — ESM import pattern, plain HTML support confirmed
- https://resend.com/pricing — free tier: 3,000/month, 100/day, 1 domain
- `npm info posthog-js` — version `1.351.1`
- `npm info posthog-node` — version `5.24.17`
- https://github.com/PostHog/posthog-js/issues/1918 — `unsafe-eval` issue confirmed fixed; linting rule added to prevent regression
- https://github.com/PostHog/posthog/issues/20461 — `connect-src` domains: `https://*.posthog.com` (or explicit `us.i.posthog.com`)
- `npm info posthog-js-lite` — version `4.5.2`; description explicitly says "reduced feature set, not officially supported for feature-complete web usage"
- `npm info eff-diceware-passphrase` — version `3.0.0`, `"main": "index.js"` (CJS), no `"exports"` field
- https://github.com/emilbayes/eff-diceware-passphrase — API reference, 25 KB gzipped wordlist size
- https://lucia-auth.com — deprecation confirmed, Better Auth recommended as successor

---
*Stack research for: SecureShare v4.0 — hybrid anonymous + account model additions*
*Researched: 2026-02-18*
