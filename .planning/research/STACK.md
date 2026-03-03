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

### Recommendation: `stripe@20.3.1` (raw) — DO NOT use `@better-auth/stripe` for v5.0

**v4.0 used `@better-auth/stripe@1.4.18`. For v5.0, migrate to a raw Stripe integration.**

**Why skip the `@better-auth/stripe` plugin for billing:**

The plugin has multiple open bugs as of February 2026 that directly affect the v5.0 billing requirements:

| Bug | Impact | Status |
|-----|--------|--------|
| `subscription.upgrade` creates a new Stripe Customer on every call (issue #2440) | Pro upgrade flow broken | Open |
| Subscription updates not persisting to DB after upgrade (issue #4957) | Plan change invisible to app | Open |
| Webhook fails: `subscription_exposed_id must be a string, got null` with API version `2025-09-30.clover`+ (issue #5976) | All subscription webhooks fail on new API versions | Open |
| POST `/api/auth/subscription/upgrade` returns 404 (issue #4801) | Upgrade flow completely non-functional | Open |

These are not edge cases — they affect the core subscription lifecycle. A raw Stripe integration with hand-written webhook handlers is ~80 lines of code (one service file) and eliminates all plugin-layer risk.

**`@better-auth/stripe` can remain installed for session management compatibility,** but its subscription webhooks should NOT be relied on. Handle `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` directly.

**Why Stripe Hosted Checkout (not Payment Element):**

- Single plan ($9/month + $7/month annual): no UI needed for plan selection beyond a pricing page link
- Hosted Checkout is Stripe's recommended path for SaaS subscriptions — optimized for conversion, handles PCI compliance
- No `@stripe/stripe-js` needed in the Vite bundle — server creates session, browser redirects to `checkout.stripe.com`, Stripe redirects back
- No additional `script-src` CSP entries for `js.stripe.com` required
- `redirectToCheckout()` from `@stripe/stripe-js` is deprecated as of Stripe API version 2025-09-30.clover anyway

**No client-side Stripe SDK needed. Do not add `@stripe/stripe-js` to the bundle.**

### Stripe Packages

| Package | Version | Side | Purpose |
|---------|---------|------|---------|
| `stripe` | `20.3.1` | Server only | Checkout sessions, billing portal, webhook verification, subscription queries |

```bash
# Already installed in v4.0 — no new package required
npm install stripe  # if not already present; stripe@20.3.1 is the current version
```

### Webhook Route Pattern (raw body required)

Express 5 webhook route must bypass the JSON bodyParser to preserve the raw body for `stripe.webhooks.constructEvent()`.

```typescript
// server/src/app.ts — register webhook route BEFORE express.json() middleware
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler  // custom handler in server/src/routes/stripe-webhooks.ts
)

// Then register express.json() for all other routes
app.use(express.json())
```

**This ordering is critical.** The existing `app.ts` middleware comment — "middleware order is critical" — already flags this pattern.

### Required Webhook Events to Handle

| Event | When It Fires | What to Do |
|-------|---------------|------------|
| `checkout.session.completed` | Customer completes checkout | Set `users.stripeCustomerId`, create `subscriptions` row |
| `customer.subscription.updated` | Plan change, renewal, cancellation scheduled | Update `subscriptions.status`, `cancelAtPeriodEnd` |
| `customer.subscription.deleted` | Subscription actually ends | Downgrade user to Free tier, update `subscriptions.status` |
| `invoice.payment_failed` | Payment declined | Optionally notify user via email |

### Database Schema Additions

Add a `subscriptions` table (do NOT extend the `users` table — keeps billing decoupled from identity):

```typescript
// server/src/db/schema.ts additions
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  status: text('status').notNull().default('free'), // 'free' | 'active' | 'past_due' | 'canceled'
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})
```

**Zero-knowledge invariant:** `subscriptions.userId` links billing to a user. This table must never be joined with `secrets` in any query. The `subscriptions` table contains no `secretId` column and is never queried in the same statement as the `secrets` table.

### Stripe API Version

Pin to `'2025-06-30.basil'` minimum. The `stripe` npm package sets a default API version per SDK major version — `stripe@20.x` targets a specific API version. Accept the SDK default; do not override unless Stripe docs require it for a specific feature.

### Stripe Environment Variables (new for v5.0)

```bash
STRIPE_SECRET_KEY=            # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=        # whsec_... from Stripe CLI or dashboard
STRIPE_PRO_MONTHLY_PRICE_ID=  # price_... for $9/month plan
STRIPE_PRO_ANNUAL_PRICE_ID=   # price_... for $7/month annual plan
```

---

## 4. Transactional Email

### Recommendation: `resend@6.9.2` (already installed — no change)

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

## 6. Email List Capture — v5.0 Addition

### Recommendation: Resend Audiences API — no new package required

**Why Resend Audiences over a dedicated email list tool:**

`resend@6.9.2` (already installed) includes a full Audiences + Contacts API. The `resend.contacts.create()` method adds an email to a named Audience. From the Audience, you can send Broadcasts (marketing emails) directly from the Resend dashboard. This eliminates a separate email marketing account for the pre-launch waitlist use case.

**Key API calls:**

```typescript
// server/src/services/email.service.ts — add to existing service
export async function addToMarketingList(email: string): Promise<void> {
  const audienceId = process.env.RESEND_AUDIENCE_ID!  // from Resend dashboard
  const { error } = await resend.contacts.create({
    audienceId,
    email,
    unsubscribed: false,
  })
  if (error) throw new Error(error.message)
}
```

**Express endpoint pattern:**

```typescript
// POST /api/subscribe
// Rate-limit: 3 per IP per hour (reuse existing rate-limiter factory)
// Validate: Zod schema { email: z.string().email() }
// On success: resend.contacts.create() → 200 OK
// Never leak whether email already exists — always return 200
```

**Why not Mailchimp / Beehiiv / Loops for list capture:**

- Resend Audiences does 100% of what's needed for a waitlist: store emails, send a broadcast
- No additional API key, no additional dashboard, no additional npm package
- Mailchimp's API is SOAP-era complexity for a simple email field; Beehiiv is newsletter-first (subscribe forms require Beehiiv branding on free tier)

**Resend Audiences limitations to know:**

- Free tier: 1,000 contacts; paid starts at $40/month for 5,000 contacts
- No visual automation builder (sequences require code or Loops.so — see Section 7)
- Broadcasts are one-time sends, not drip sequences

**Environment variable:**

```bash
RESEND_AUDIENCE_ID=   # aud_... from Resend dashboard Audiences tab
```

---

## 7. Email Onboarding Sequences — v5.0 Addition

### Recommendation: `loops@6.2.0` for the 3-email onboarding sequence

**Why Loops.so over extending Resend:**

The 3-email onboarding sequence (welcome → key features → upgrade prompt) requires **time-delayed, trigger-based automation**. Resend does not have this natively — it is a transactional send API, not a sequence engine. To build delays with Resend alone requires either: a cron job that checks elapsed time since registration and sends emails, or a third-party workflow runner (Inngest, Trigger.dev). That is significant infrastructure for what Loops.so provides as a dashboard-configured flow.

| Criterion | Resend alone | Loops.so |
|-----------|-------------|----------|
| Welcome email (immediate) | Yes | Yes |
| Delay 3 days, send features email | Requires custom cron + DB tracking | Yes — built-in `step.delay()` |
| Delay 7 days, send upgrade email | Requires custom cron + DB tracking | Yes |
| Edit sequence without deploy | No | Yes (dashboard) |
| Pricing | Already paid for | Free up to 2,000 contacts |

**Loops.so SDK:**

```typescript
// server/src/services/loops.service.ts
import { LoopsClient } from 'loops'

const loops = new LoopsClient(process.env.LOOPS_API_KEY!)

// Called at user registration (in the Better Auth onAfterUserCreated hook or signup handler)
export async function enrollInOnboarding(email: string, userId: string): Promise<void> {
  // Create/update contact in Loops
  await loops.createContact(email, {
    userId,            // custom property for internal tracking
    source: 'signup',
  })
  // Trigger the onboarding Loop (sequence configured in Loops dashboard)
  await loops.sendEvent({
    email,
    eventName: 'user_signed_up',
  })
}

// Called when user upgrades to Pro
export async function triggerUpgradeSequence(email: string): Promise<void> {
  await loops.sendEvent({
    email,
    eventName: 'user_upgraded_to_pro',
  })
}
```

**Loops.so configuration (in Loops dashboard, not code):**

1. Create a Loop triggered by `user_signed_up` event
2. Step 1: Send welcome email immediately
3. Step 2: Wait 3 days → send key features email
4. Step 3: Wait 7 days from signup (or 4 days after step 2) → send upgrade prompt

**Email copy for the 3 emails lives in the Loops dashboard**, not in code. This is intentional — marketing can edit copy without a code deploy.

**Version note:** `loops@6.2.0` (released Feb 9, 2026) is the current version. Breaking change in v6.0.0 (Aug 2025): `createContact()` and `updateContact()` now use a single object parameter. Use v6.x syntax.

**Why not Mailchimp / ConvertKit / Beehiiv for sequences:**

- Mailchimp: overly complex API, pricing tied to list size at large scale, legacy tooling
- ConvertKit (now Kit): strong for creator newsletters, not SaaS developer-tooling fit
- Beehiiv: newsletter-first product, free tier adds branding to subscribe forms, not API-first for code-triggered enrollment
- Loops is specifically designed for developer SaaS, has a clean REST API + SDK, and is affordable (free to 2,000 contacts)

### Loops.so Package

| Package | Version | Purpose |
|---------|---------|---------|
| `loops` | `6.2.0` | Trigger-based email sequences for onboarding |

```bash
npm install loops
```

**New environment variable:**

```bash
LOOPS_API_KEY=   # from Loops.so dashboard → Settings → API
```

---

## 8. SEO Content Pages — v5.0 Addition

### Recommendation: No new packages — Express SSR with template strings

**Why no new packages:**

The SEO content pages (`/vs/onetimesecret`, `/use/[slug]`, etc.) are static-content pages. They do not require fetching dynamic data at request time — the content is known at build time. The existing Express app already serves HTML. The correct approach is:

1. Store page content as TypeScript data objects (competitor comparisons, use case text)
2. Generate HTML from template strings in Express route handlers
3. Inject JSON-LD schema markup server-side as part of the HTML response
4. Return fully-rendered HTML from Express (not a SPA shell)

**Why not a static site generator (Astro, 11ty):**

- Adding a second build tool (Astro) for 15-20 pages adds complexity, CI steps, and a new deployment artifact
- The existing Express server already handles SSR — route handlers returning HTML are the established pattern (used for the SPA shell)
- Astro would introduce framework lock-in for what is fundamentally a data-to-HTML problem

**Why not the existing Vite SPA for SEO pages:**

- SPA pages get `noindex` by design (secret URLs, error pages)
- Even with correct meta tags, Google's crawler may not wait for JS execution on new domains
- Server-rendered HTML is the only guaranteed approach for SEO pages at launch

**Express SSR pattern for SEO pages:**

```typescript
// server/src/routes/seo-pages.ts

interface CompetitorPageData {
  slug: string
  competitorName: string
  metaTitle: string
  metaDescription: string
  h1: string
  comparisonRows: Array<{ feature: string; ours: string; theirs: string }>
  faqItems: Array<{ question: string; answer: string }>
}

const COMPETITOR_PAGES: Record<string, CompetitorPageData> = {
  onetimesecret: { /* ... */ },
  pwpush: { /* ... */ },
  privnote: { /* ... */ },
}

router.get('/vs/:slug', (req, res) => {
  const data = COMPETITOR_PAGES[req.params.slug]
  if (!data) return res.status(404).send(render404())
  return res.send(renderCompetitorPage(data, res.locals.cspNonce))
})
```

**JSON-LD injection pattern (server-side, nonce not required for JSON-LD):**

JSON-LD `<script type="application/ld+json">` blocks do NOT need a CSP nonce. The `type="application/ld+json"` attribute means the browser treats the block as data, not executable JavaScript. Helmet's default CSP `script-src` does not block them.

```typescript
function buildFAQSchema(items: Array<{ question: string; answer: string }>): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  }
  // JSON.stringify escapes <, >, & automatically (XSS-safe for JSON-LD)
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
}
```

**Confirm with Helmet config:** Verify that `script-src` in `server/src/middleware/security.ts` does not include a blanket `'none'` that would block `application/ld+json`. Standard Helmet configuration allows `type="application/ld+json"` blocks — only `text/javascript` requires nonce or hash.

**Programmatic use case pages (`/use/[slug]`):**

Same SSR pattern. Store 8 use-case data objects in a TypeScript file. One route handler pattern covers all 8 pages + the hub page at `/use`.

**No new packages required.** All needed APIs (string templates, `JSON.stringify`, Express router) are already present.

---

## 9. Schema Markup (JSON-LD) — v5.0 Addition

### Recommendation: Hand-written schema builders — no library

**Why not a JSON-LD library:**

Libraries like `schema-dts` (TypeScript types for Schema.org) add types but no runtime value. `JSON.stringify()` is all you need to produce valid JSON-LD. Adding a library adds a dependency for zero behavioral benefit.

**WebApplication schema (homepage + pricing page):**

```typescript
function buildWebApplicationSchema(): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Torch Secret',
    url: 'https://torchsecret.com',
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier with zero-knowledge secret sharing',
    },
    description: 'Zero-knowledge, one-time secret sharing. Encrypted in your browser. Self-destructs after one view.',
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
}
```

**HowTo schema (how it works section):**

```typescript
function buildHowToSchema(): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to share a secret with Torch Secret',
    step: [
      { '@type': 'HowToStep', name: 'Paste your secret', text: 'Type or paste sensitive text into the input field.' },
      { '@type': 'HowToStep', name: 'Get a link', text: 'Click "Create Secret Link". Your browser encrypts the secret.' },
      { '@type': 'HowToStep', name: 'Share the link', text: 'Send the link to the recipient. The key is in the URL fragment.' },
      { '@type': 'HowToStep', name: 'One view only', text: 'The recipient opens the link. The secret is destroyed immediately after.' },
    ],
  }
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`
}
```

**FAQPage schema (pricing page FAQ section):**

See Section 8 for the `buildFAQSchema()` pattern.

**XSS safety note:** `JSON.stringify()` escapes `<`, `>`, and `&` in string values automatically. This is safe for injecting into HTML. Do not use string concatenation to build JSON-LD.

---

## Complete Installation Commands for v5.0

```bash
# Already installed from v4.0 — no new install needed:
#   stripe@20.3.1 (server billing)
#   resend@6.9.2 (transactional + audience capture)
#   better-auth@1.4.18
#   posthog-js + posthog-node

# New for v5.0 (email onboarding sequences):
npm install loops
```

**Only one new npm package** for v5.0. Everything else uses existing infrastructure.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `better-auth` | Passport.js | If you have an existing large Passport codebase or need a specific OAuth strategy from Passport's ecosystem that Better Auth does not cover |
| `better-auth` | Custom sessions | If you need unusual session semantics or want zero external auth dependencies — at cost of significant implementation time |
| `better-auth` | Auth.js v5 | If the project were Next.js-based — Auth.js is excellent there but secondary-class for plain Express |
| `resend` | Nodemailer | If you already have SMTP infrastructure (relay, credentials) and want to avoid third-party API dependencies |
| `posthog-js` bundled | PostHog snippet | Never prefer snippet in a nonce-CSP setup — dynamically injected `<script>` cannot receive a per-request nonce |
| Raw `stripe` webhooks | `@better-auth/stripe` webhook handling | Use `@better-auth/stripe` once issues #2440, #4957, #5976 are resolved and the plugin is stable |
| `loops` for sequences | Resend + cron job | Resend alone if you only need one immediate email with no delays; Loops for any time-delayed sequence |
| Express SSR template strings | Astro/11ty static generation | Use Astro if you have 100+ SEO pages — the build infrastructure pays off at that scale; for <25 pages, Express SSR is simpler |
| Custom wordlist JSON | `eff-diceware-passphrase` npm | If you want a pinned npm dependency over a committed JSON file — acceptable, but requires CJS interop workaround |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@better-auth/stripe` webhook handling for billing | Multiple open bugs (issues #2440, #4957, #5976, #4801) causing duplicate customers, DB sync failures, and webhook signature failures as of Feb 2026 | Raw `stripe` SDK with custom webhook handler |
| `@stripe/stripe-js` (client-side) | Not needed for hosted Checkout redirect flow; `redirectToCheckout()` is deprecated in API version 2025-09-30.clover+; adds bundle weight + CSP `script-src` complexity | Server-side `stripe` SDK only + browser redirect to `checkout.stripe.com` |
| `passport` + `passport-google-oauth20` + `passport-github2` | Three packages for what Better Auth does in one. Not TS-first. Session management is manual. OAuth strategy last updated 2+ years ago. | `better-auth` with `socialProviders` |
| `lucia` (any version) | Officially deprecated March 2025. Maintainer recommends migrating to Better Auth. | `better-auth` |
| `jsonwebtoken` / JWT for sessions | For a database-backed app with revocation needs, stateless JWTs are an anti-pattern — logout does not actually revoke the token without a server-side blocklist. | Better Auth database-backed cookie sessions (default) |
| SendGrid | Free tier eliminated July 2025. Complex API with legacy cruft. | `resend` |
| PostHog snippet approach | Injects `<script>` tags dynamically at runtime. Per-request CSP nonces cannot be applied to runtime-injected scripts. Breaks with strict nonce-based CSP. | `posthog-js` via npm + Vite bundle |
| `nodemailer` without SMTP relay | Requires SMTP server, TLS configuration, and authentication — none of which exist on a single Render.com instance. | `resend` REST API |
| Mailchimp for email list capture | SOAP-era API complexity; pricing tied to list size; overkill when Resend Audiences already handles the use case | Resend Audiences API |
| Beehiiv/ConvertKit for onboarding sequences | Newsletter-first UX; branding on free tier subscribe forms; not code-triggered enrollment | `loops` |
| JSON-LD library (`schema-dts`) | Types only, zero runtime value; `JSON.stringify()` produces identical output | Hand-written schema builders with `JSON.stringify()` |
| `schema-dts` | TypeScript types for Schema.org that add a dev dependency for no behavioral benefit | Inline TypeScript types in the schema builder functions |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|----------------|-------|
| `better-auth` | `1.4.18` | `"type": "module"`, NodeNext, `drizzle-orm@>=0.41.0`, `vitest@^2\|\|^3\|\|^4` | All peer deps optional; ESM-only since v1.4 |
| `@better-auth/stripe` | `1.4.18` | `better-auth@1.4.18`, `stripe@^18\|\|^19\|\|^20` | Installed but NOT used for billing webhooks in v5.0 due to open bugs |
| `stripe` | `20.3.1` | Node.js 16+, ESM + CJS dual export | `import Stripe from 'stripe'` works in ESM codebase |
| `resend` | `6.9.2` | Node.js 18+, ESM-native | `import { Resend } from 'resend'` — no interop issues; Audiences API included |
| `loops` | `6.2.0` | Node.js 18+, ESM, TypeScript | v6.0 breaking change: `createContact()` uses single object param; use v6.x syntax |
| `posthog-js` | `1.351.1` | Vite 7, no `unsafe-eval` required | Bundled approach; `unsafe-eval` CSP issue fixed ~v1.236 |
| `posthog-node` | `5.24.17` | Node.js 14+, ESM | `import { PostHog } from 'posthog-node'` |
| `drizzle-orm` | `0.45.1` (installed) | `better-auth@1.4.18` | Peer dep `>=0.41.0` satisfied |

---

## New Environment Variables Required for v5.0

```bash
# Stripe (new for v5.0 billing — raw integration)
STRIPE_SECRET_KEY=               # sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=           # whsec_... from Stripe CLI or dashboard
STRIPE_PRO_MONTHLY_PRICE_ID=     # price_... for $9/month plan
STRIPE_PRO_ANNUAL_PRICE_ID=      # price_... for $7/month billed annually plan

# Resend Audiences (new for v5.0 email capture)
RESEND_AUDIENCE_ID=              # aud_... from Resend dashboard Audiences tab

# Loops.so (new for v5.0 onboarding sequences)
LOOPS_API_KEY=                   # from Loops.so dashboard → Settings → API

# Previously added in v4.0 (no change):
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
POSTHOG_API_KEY=
POSTHOG_HOST=
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=
```

---

## Sources

- [stripe - npm](https://www.npmjs.com/package/stripe) — version `20.3.1` confirmed; Node.js 16+ requirement
- [Build a subscriptions integration | Stripe Documentation](https://docs.stripe.com/billing/subscriptions/build-subscriptions) — Hosted Checkout flow, webhook event list, raw body requirement
- [Stripe Checkout | Stripe Documentation](https://docs.stripe.com/payments/checkout) — Hosted Checkout redirect flow confirmed, no client-side JS required
- [Removes support for the redirectToCheckout method | Stripe](https://docs.stripe.com/changelog/clover/2025-09-30/remove-redirect-to-checkout) — `redirectToCheckout` deprecated in API 2025-09-30.clover — confirms no `@stripe/stripe-js` needed
- [stripe/stripe-node webhook example](https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/express/main.ts) — `express.raw()` pattern confirmed
- Better Auth Stripe plugin open issues: [#2440](https://github.com/better-auth/better-auth/issues/2440), [#4957](https://github.com/better-auth/better-auth/issues/4957), [#5976](https://github.com/better-auth/better-auth/issues/5976), [#4801](https://github.com/better-auth/better-auth/issues/4801) — MEDIUM confidence (GitHub issues, not official docs; bugs may be fixed in unreleased versions)
- [Stripe | Better Auth](https://www.better-auth.com/docs/plugins/stripe) — `@better-auth/stripe` capabilities; `stripe@^18||^19||^20` peer dep; API version `2025-11-17.clover`
- [loops - npm](https://www.npmjs.com/package/loops) — version `6.2.0` confirmed; Feb 9, 2026 release
- [JavaScript SDK - Loops](https://loops.so/docs/sdks/javascript) — `createContact()`, `sendEvent()` API patterns; v6.0 breaking change documented
- [Resend vs Loops.so | Buildcamp](https://www.buildcamp.io/blogs/resend-vs-loopsso-choosing-the-right-email-platform-for-your-saas) — MEDIUM confidence (third-party comparison); confirms Resend is transactional, Loops is sequences
- [Resend Audiences - Managing Contacts](https://resend.com/docs/dashboard/audiences/contacts) — `contacts.create()` API with `audienceId`; global contacts update (no audienceId required for GET)
- [Broadcast API - Resend](https://resend.com/blog/broadcast-api) — Audiences + Broadcasts confirmed as email list + send mechanism
- [Generate Structured Data with JavaScript | Google](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript) — `type="application/ld+json"` does not require CSP nonce — MEDIUM confidence (Google doc, not Express-specific)
- [Schema Markup with JSON-LD Guide 2025 | SEODesignLab](https://seodesignlab.com/schema-markup-with-json-ld-guide-2025/) — FAQPage, HowTo, WebApplication schema types confirmed current
- `npm info better-auth` — version `1.4.18`; peer deps `drizzle-orm >=0.41.0`
- `npm info resend` — version `6.9.2`
- `npm info posthog-js` — version `1.351.1`
- `npm info posthog-node` — version `5.24.17`

---
*Stack research for: Torch Secret v5.0 — Product Launch Checklist (Stripe billing, email capture, onboarding sequences, SEO content pages)*
*Researched: 2026-02-22*
