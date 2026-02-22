# Architecture Research: v5.0 Product Launch Checklist

**Domain:** Adding Stripe billing, marketing homepage, SEO content pages, and email capture to existing Express 5 / Vite 7 / Vanilla TS SPA
**Researched:** 2026-02-22
**Confidence:** HIGH (Stripe webhook raw-body pattern, Better Auth Stripe plugin, Vite MPA build, Beehiiv API, JSON-LD nonce injection), MEDIUM (programmatic /use/[slug] SEO pages via SPA — crawler JS rendering still not 100% guaranteed), LOW (none)

---

## System Overview

v5.0 adds five new subsystems to the shipped v4.0 architecture. Each has a precise insertion point. No existing middleware or route changes its position in the pipeline. The zero-knowledge invariant is not affected by any v5.0 feature (billing, marketing, SEO, email capture touch zero secret data).

```
+-----------------------------------------------------------------------+
|                        Browser (Vanilla TS SPA)                        |
|                                                                        |
|  /         /pricing   /vs/*   /use/*  (indexable, marketing)          |
|  [MODIFIED] [NEW]     [NEW]   [NEW]                                   |
|                                                                        |
|  /secret/:id  /confirmation  /dashboard  /auth/*  (unchanged)         |
|                                                                        |
|  Beehiiv email capture -> POST /api/email-capture  (NEW)              |
|  Stripe Checkout redirect -> stripe.com (NEW, leaves SPA)             |
+----------------------------------+------------------------------------+
                                   | HTTPS
+----------------------------------v------------------------------------+
|                    Express 5 Middleware Pipeline                       |
|                                                                        |
|  trust proxy -> httpsRedirect -> cspNonce -> helmet -> httpLogger      |
|  -> Better Auth /api/auth/{*splat}                                    |
|  -> express.json({ limit: '100kb' })  (unchanged)                     |
|                                                                        |
|  [NEW] POST /api/webhooks/stripe    <- raw body, BEFORE express.json  |
|  [NEW] POST /api/email-capture      <- Beehiiv proxy                  |
|  [NEW] GET  /api/billing/portal     <- Stripe portal session URL      |
|  [NEW] POST /api/billing/checkout   <- Stripe Checkout session URL    |
|                                                                        |
|  /api/health, /api/secrets, /api/me, /api/dashboard  (unchanged)     |
|  /api catch-all 404    (unchanged)                                    |
|  static + SPA catch-all (unchanged -- serves all HTML routes)        |
|  NOINDEX_PREFIXES array: /pricing stays OUT (indexable)               |
|  errorHandler (unchanged, MUST be last)                               |
+----------------------------------+------------------------------------+
                                   |
          +------------------------+----------------------------+
          |                        |                          |
+---------v-------+   +------------v----------+   +----------v---------+
|  PostgreSQL 17  |   |  External Services    |   |    SPA / Vite      |
|                 |   |                       |   |                    |
|  users table:   |   |  Stripe              |   |  Single index.html |
|   + plan col    |   |  (Checkout, Portal,  |   |  All routes served |
|  subscriptions  |   |   Webhooks)          |   |  by SPA catch-all  |
|  [NEW table]    |   |                       |   |                    |
|                 |   |  Beehiiv             |   |  /pricing [NEW]    |
|  secrets,       |   |  (email list API)    |   |  /vs/*    [NEW]    |
|  sessions,      |   |                       |   |  /use/*   [NEW]    |
|  accounts,      |   |  Resend              |   |  / [MODIFIED]      |
|  verification   |   |  (onboarding seq.)   |   |                    |
|  (unchanged)    |   |                       |   |  JSON-LD scripts   |
|                 |   |  PostHog (unchanged) |   |  per-page via      |
+-----------------+   +-----------------------+   |  router.ts         |
                                                  +--------------------+
```

---

## Integration Point 1: Stripe Billing

### The raw-body webhook problem (already solved in the codebase)

The existing `app.ts` mounts Better Auth at `/api/auth/{*splat}` before `express.json()` because Better Auth requires unconsumed body streams. The same constraint applies to Stripe: `stripe.webhooks.constructEvent()` verifies an HMAC-SHA256 signature over the raw request bytes. Once `express.json()` parses the body to an object, signature verification fails.

**Mounting pattern -- insert before `express.json()` in `buildApp()`:**

```typescript
// server/src/app.ts -- add BEFORE the express.json() line

// Stripe webhook: raw body required for HMAC-SHA256 signature verification.
// MUST be mounted before express.json() -- body-stream ordering constraint.
// Mount directly on `app`, not via a sub-router (sub-routers inherit parent middleware).
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,   // server/src/routes/stripe-webhook.ts
);

// Billing API routes (Checkout session, portal session)
// These use JSON bodies, so they mount AFTER express.json()
app.use('/api/billing', requireAuth, billingRouter);
```

The Better Auth handler already sits before `express.json()`. The Stripe webhook needs the same position. All other billing routes (`/api/billing/checkout`, `/api/billing/portal`) use JSON bodies and mount after `express.json()`.

### Better Auth Stripe Plugin vs. manual Stripe SDK

Two integration options exist:

| Approach | Adds to schema | Webhook handling | Subscription check API |
|----------|----------------|-----------------|----------------------|
| Better Auth Stripe plugin | `subscription` table via `npx @better-auth/cli generate` | Plugin handles internally via `/api/auth/stripe/webhook` | `authClient.useActiveSubscription()` on client |
| Manual Stripe SDK | Drizzle migration for `subscriptions` table | Custom handler at `/api/webhooks/stripe` | Query `subscriptions` table directly |

**Recommendation: Better Auth Stripe plugin.** The codebase already uses Better Auth for sessions, OAuth, and email auth. The plugin adds its `subscription` table through the same `@better-auth/cli generate` migration path already established. The plugin's webhook handler registers at `/api/auth/stripe/webhook` which Better Auth serves via the existing `/api/auth/{*splat}` handler. This means no additional raw-body route is needed in `app.ts` because Better Auth's handler already runs before `express.json()`.

**Caveat:** As of early 2026, the Better Auth Stripe plugin has several open GitHub issues (subscription updates not persisting, plan switching edge cases). If stability is a concern, the manual Stripe SDK approach is more predictable but requires writing the webhook handler and subscription table migration manually.

**Confidence:** MEDIUM for Better Auth Stripe plugin stability. HIGH for manual SDK pattern.

### Schema additions (Better Auth Stripe plugin path)

The plugin adds to the Better Auth schema via its own migration CLI. The `users` table gets a `plan` field (denormalized tier cache). A new `subscription` table tracks billing state. Run:

```bash
npx @better-auth/cli generate   # generates Drizzle migration for subscription table
npm run db:migrate
```

After migration, the `users` table includes a plan field. The existing `secrets.ts` route already contains an inline plan check (the `expiresIn === '30d'` guard at line 92-99). That guard becomes a proper plan check once Pro billing is live.

### Feature gate middleware

The existing `secrets.ts` route uses an inline plan check. Extract to reusable middleware for v5.0:

```typescript
// server/src/middleware/require-plan.ts [NEW]
import type { Request, Response, NextFunction } from 'express';
import type { AuthUser } from '../auth.js';

export function requirePlan(plan: 'pro') {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.user as AuthUser | undefined;
    // AuthUser from Better Auth Stripe plugin will have a `plan` field
    // after the plugin migration. Until then, check subscription table.
    if (!user || (user as AuthUser & { plan?: string }).plan !== plan) {
      res.status(403).json({
        error: 'upgrade_required',
        message: 'This feature requires a Pro subscription.',
        requiredPlan: plan,
      });
      return;
    }
    next();
  };
}
```

**Where it applies in v5.0:** Only the 30-day expiration unlock on `POST /api/secrets`. The guard is already present as an inline check; `requirePlan('pro')` makes it a composable middleware for future Pro features.

### New env vars

```typescript
// server/src/config/env.ts additions
STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
STRIPE_PRO_MONTHLY_PRICE_ID: z.string().startsWith('price_'),
STRIPE_PRO_ANNUAL_PRICE_ID: z.string().startsWith('price_'),
```

### Key webhook events (manual SDK path, or to understand what the Better Auth plugin handles)

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Provision subscription, set `users.plan = 'pro'`, upsert `subscriptions` row |
| `customer.subscription.updated` | Sync plan tier, update `subscriptions.status` |
| `customer.subscription.deleted` | Set `users.plan = 'free'`, update `subscriptions.status = 'canceled'` |
| `invoice.payment_failed` | Set `subscriptions.status = 'past_due'`, trigger Resend dunning email |
| `invoice.payment_succeeded` | Update `subscriptions.period_end` |

**Idempotency:** Stripe may deliver events more than once. Use `ON CONFLICT DO UPDATE` (Drizzle's `.onConflictDoUpdate`) on `stripeSubscriptionId`. No separate event-ID deduplication table needed.

---

## Integration Point 2: Marketing Homepage

### The homepage is currently the create-secret page

`router.ts` maps `path === '/'` to `renderCreatePage(container)`. The create page and the marketing page cannot both live at `/`. One of three strategies applies:

**Option A: Homepage becomes the marketing page; create moves to `/create`**

The marketing page renders at `/`. The create-secret form moves to `/create`. Users land on marketing, click "Create Secret" CTA, navigate to `/create`. The conversion funnel improves: new visitors see the value proposition first. Existing shareable links (`/secret/:id`) are unchanged. The header nav "Create Secret" link updates from `/` to `/create`.

**Option B: Homepage is the marketing page; the create form is a section within it**

The marketing hero renders above the fold; the create form is a section below. One URL, one page module. Smooth for returning users who scroll to the form. Harder to maintain as both sections grow.

**Option C: A/B test (redirect or split)**

Overkill for launch. Defer.

**Recommendation: Option A.** The homepage-as-app pattern was chosen for v1.0 when there were no marketing needs. With a pricing page, SEO pages, and a "free tier vs Pro" positioning, users arriving at `/` need context before the form. Moving the form to `/create` is a one-line router change plus a header nav update.

**Router change:**

```typescript
// client/src/router.ts: modify the path === '/' branch

} else if (path === '/') {
  // NEW: marketing homepage
  updatePageMeta({
    title: 'Torch Secret - Zero-Knowledge Secret Sharing',
    description: 'Share passwords, API keys, and sensitive text via one-time encrypted links. AES-256-GCM. Zero-knowledge. No accounts required.',
    canonical: 'https://torchsecret.com/',
  });
  import('./pages/home.js')         // NEW PAGE MODULE
    .then((mod) => mod.renderHomePage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));

} else if (path === '/create') {
  // MOVED: was at '/'
  updatePageMeta({
    title: 'Create a Secret',
    description: 'Share secrets securely with zero-knowledge encryption. One-time view, no accounts.',
  });
  import('./pages/create.js')
    .then((mod) => mod.renderCreatePage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

**`#app` container width constraint:** The existing `<div id="app" class="mx-auto max-w-2xl px-4 py-8">` in `index.html` constrains the app container to `max-w-2xl`. Marketing pages need full-width sections (hero, features grid, pricing preview). The container constraint must be removed from `index.html` and moved into each page module that needs it. Marketing pages manage their own layout.

**New page module:** `client/src/pages/home.ts` -- the marketing homepage. Renders hero, zero-knowledge proof points, How It Works, pricing preview, and email capture form. All within the existing SPA router pattern (dynamic import, code splitting, focus management).

---

## Integration Point 3: Pricing Page

### New SPA route at `/pricing`

A standard SPA route addition. Indexable by search engines (no `noindex`). No auth required.

```typescript
// client/src/router.ts addition
} else if (path === '/pricing') {
  updatePageMeta({
    title: 'Pricing - Torch Secret',
    description: 'Free forever for personal use. Upgrade to Pro for 30-day expiration, priority support, and more.',
    canonical: 'https://torchsecret.com/pricing',
  });
  import('./pages/pricing.js')
    .then((mod) => mod.renderPricingPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

**New page module:** `client/src/pages/pricing.ts` -- Free vs Pro tier cards, FAQ accordion, and CTAs. The upgrade CTA triggers a Stripe Checkout session:

```typescript
// In pricing.ts: upgrade flow
async function handleUpgradeClick(priceId: string): Promise<void> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });
  const { url } = await res.json() as { url: string };
  window.location.href = url;   // redirect to Stripe Checkout (leaves SPA)
}
```

**New API endpoint:**

```typescript
// POST /api/billing/checkout
// Requires: requireAuth middleware
// Body: { priceId: string }
// Returns: { url: string }  -- Stripe Checkout session URL
// Creates a Stripe Checkout session with:
//   mode: 'subscription',
//   success_url: 'https://torchsecret.com/dashboard?upgrade=success',
//   cancel_url: 'https://torchsecret.com/pricing',
```

**No CSP changes required:** Stripe Checkout is a full-page redirect away from the SPA. The browser navigates to `stripe.com` -- CSP does not apply to the destination. Stripe.js (used for embedded Checkout) is NOT used here; the redirect-to-hosted approach requires no `script-src` additions.

**NOINDEX_PREFIXES:** `/pricing` must NOT be added to `NOINDEX_PREFIXES`. It is a public, indexable marketing page. No server-side header change needed.

---

## Integration Point 4: SEO Content Pages

### The SPA-and-SEO tension

The existing SPA uses History API routing. Googlebot crawls JavaScript-rendered SPAs, but with latency (content appears in the second indexing wave, not the first). For competitor comparison pages and use-case landing pages -- where Google ranking is the primary goal -- fast first-wave indexing matters.

**Options:**

| Approach | How | SEO reliability | Dev complexity |
|----------|-----|----------------|----------------|
| SPA routes (`/vs/onetimesecret` in router.ts) | Client-side render, same as all pages | MEDIUM -- Googlebot renders JS but with delay | Low -- same pattern as pricing page |
| Vite MPA (separate HTML entry points) | `build.rollupOptions.input` with multiple `.html` files | HIGH -- static HTML, instant first-wave | Medium -- separate build config, separate JS bundles |
| Prerendering at build time | Script renders each page to static HTML | HIGH -- static HTML generated from TS | High -- headless browser or SSR setup |
| Express SSR | Render HTML in Express route handlers | HIGH -- real SSR | High -- server templating layer |

**Recommendation: SPA routes for /vs/* and /use/* pages.** The evidence is as follows:

1. Google has confirmed it renders JavaScript-heavy pages. Competitor comparison and use-case pages are thin content (mostly static text, no dynamic data). The SEO benefit of instant first-wave indexing vs. second-wave is measurable but not decisive for pages that will also be linked from the homepage and sitemap.

2. The codebase has no templating infrastructure. Vite MPA or Express SSR adds significant complexity for pages that are essentially static content. The content can be written directly in TypeScript string templates, same as `client/src/pages/privacy.ts` and `client/src/pages/terms.ts`.

3. The JSON-LD schema markup needed on these pages (`FAQPage`, `WebApplication`, `HowTo`) injects correctly via the existing CSP nonce mechanism (see Integration Point 6 below).

4. The `updatePageMeta()` function in `router.ts` already sets per-route `<title>`, `<meta description>`, `<link rel="canonical">`, and OG/Twitter tags on every navigation. These are the most important on-page SEO elements.

**If post-launch SEO underperforms:** The SPA route approach can be converted to static prerendering later by running a headless browser at build time (a Puppeteer script saves rendered HTML to `client/dist/vs/onetimesecret/index.html`). This is a build-step addition, not an architecture change.

### Router additions for /vs/* and /use/*

```typescript
// client/src/router.ts additions

} else if (path === '/vs/onetimesecret') {
  updatePageMeta({
    title: 'Torch Secret vs OneTimeSecret - Comparison',
    description: 'How Torch Secret compares to OneTimeSecret: zero-knowledge encryption, no account required, open source.',
    canonical: 'https://torchsecret.com/vs/onetimesecret',
  });
  import('./pages/vs/onetimesecret.js')
    .then((mod) => mod.renderPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));

} else if (path.startsWith('/vs/')) {
  // catch-all for unknown /vs/* slugs
  updatePageMeta({ title: 'Page Not Found', description: 'Torch Secret', noindex: true });
  import('./pages/error.js')
    .then((mod) => mod.renderErrorPage(container, 'not_found'))
    .catch(() => showLoadError(container));

} else if (path.startsWith('/use/')) {
  // Programmatic use-case pages: /use/password-sharing, /use/api-keys, etc.
  const slug = path.replace('/use/', '');
  updatePageMeta({
    title: `Securely Share ${slugToTitle(slug)} - Torch Secret`,
    description: `Securely share ${slug.replace(/-/g, ' ')} with zero-knowledge encryption.`,
    canonical: `https://torchsecret.com/use/${slug}`,
  });
  import('./pages/use-case.js')
    .then((mod) => mod.renderUseCasePage(container, slug))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

**New page modules:**
- `client/src/pages/vs/onetimesecret.ts`
- `client/src/pages/vs/pwpush.ts`
- `client/src/pages/vs/privnote.ts`
- `client/src/pages/alternatives/onetimesecret.ts`
- `client/src/pages/alternatives/pwpush.ts`
- `client/src/pages/alternatives/privnote.ts`
- `client/src/pages/use-case.ts` -- single module that switches on `slug` to render the correct content

**Sitemap update:** `client/public/sitemap.xml` must be updated to include all new indexable routes (`/pricing`, `/vs/*`, `/use/*`). The file is static; update it manually or generate it at build time with a simple Node.js script.

---

## Integration Point 5: Email Capture

### Backend proxy to Beehiiv (or Mailchimp)

The email capture form on the homepage sends a POST to `/api/email-capture`. The Express handler proxies to the email list provider's API. The provider API key never reaches the browser.

**Why a backend proxy rather than a direct browser-to-Beehiiv call:**

1. The Beehiiv API key must remain server-side. Embedding it in the client bundle exposes it to anyone who opens DevTools.
2. The `connectSrc` CSP directive would need to allow Beehiiv's API domain for direct calls. Adding third-party domains to CSP increases the attack surface.
3. A backend proxy allows rate limiting (reuse existing `express-rate-limit` infrastructure) to prevent form abuse.
4. A backend proxy allows validation (Zod schema on the email field) before the call leaves the server.

**New endpoint:**

```typescript
// server/src/routes/email-capture.ts [NEW]
// POST /api/email-capture
// Body: { email: string }
// Returns: { success: true } | { error: string }
// Proxies to Beehiiv: POST https://api.beehiiv.com/v2/publications/{PUB_ID}/subscriptions
// Headers: Authorization: Bearer {BEEHIIV_API_KEY}
// Body: { email, reactivate_existing: false, send_welcome_email: false }
```

**New env vars:**

```typescript
// server/src/config/env.ts additions
BEEHIIV_API_KEY: z.string().min(1).optional(),
BEEHIIV_PUBLICATION_ID: z.string().min(1).optional(),
```

Both are optional to allow running the app without email capture configured (development, staging).

**Rate limiting:** Apply `express-rate-limit` at 3 requests per IP per hour on `/api/email-capture`. Reuse the existing `createRateLimiter` factory from `rate-limit.ts`.

**Zero-knowledge invariant:** The email capture endpoint receives only an email address. It has no access to `secretId`. The user may or may not be authenticated; regardless, the endpoint does not combine `userId` and `secretId`. No invariant risk.

**NOINDEX_PREFIXES:** No change. `/api/email-capture` is an API route, never served as HTML.

---

## Integration Point 6: Schema Markup (JSON-LD)

### The CSP nonce constraint

The existing `index.html` already has a JSON-LD block with `nonce="__CSP_NONCE__"`. This works because Express replaces `__CSP_NONCE__` at serve time in the SPA catch-all handler (`htmlTemplate.replaceAll('__CSP_NONCE__', res.locals.cspNonce)`).

**Problem:** The `index.html` JSON-LD contains a single `WebApplication` schema for the homepage. The `/pricing` page needs a `FAQPage` schema. The `/vs/*` pages need a `WebApplication` comparison schema. These are route-specific schemas -- they cannot all live in the static `index.html`.

**Approach: JavaScript-injected JSON-LD per page (recommended)**

Each page module injects its own `<script type="application/ld+json">` element into `document.head` on navigation, and removes it on the next navigation.

```typescript
// client/src/utils/json-ld.ts [NEW UTILITY]

let currentJsonLdEl: HTMLScriptElement | null = null;

export function setJsonLd(schema: Record<string, unknown>): void {
  // Remove previous route's schema
  currentJsonLdEl?.remove();

  const el = document.createElement('script');
  el.type = 'application/ld+json';
  // XSS prevention: escape < to \u003c in JSON-LD content
  el.textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
  document.head.appendChild(el);
  currentJsonLdEl = el;
}
```

Called from each page module that needs schema markup:

```typescript
// In pricing.ts renderPricingPage():
setJsonLd({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [{ '@type': 'Question', name: '...', acceptedAnswer: { '@type': 'Answer', text: '...' } }],
});
```

**CSP behavior of dynamically created script elements:** Using `el.textContent` to set the content of a dynamically created `<script type="application/ld+json">` element does not trigger CSP `script-src` restrictions. CSP `script-src` applies to scripts that execute JavaScript. `type="application/ld+json"` is a data block -- it is not executed as JavaScript. Browsers and CSP implementations treat it as inert data, not executable code. This is confirmed by MDN CSP documentation.

**The existing `index.html` JSON-LD block:** Keep it as the default WebApplication schema for the homepage. It renders for all routes before JavaScript runs (good for SEO crawlers). The `setJsonLd()` utility replaces it on non-homepage navigation. On navigation back to `/`, `setJsonLd()` restores the WebApplication schema.

---

## Integration Point 7: Email Onboarding Sequence

### Resend transactional emails (already integrated)

The codebase already uses Resend for auth emails (`auth.ts`: password reset, email verification). The onboarding sequence (welcome, key features, upgrade prompt) adds three new Resend calls triggered by the user registration lifecycle event in Better Auth.

**Integration point:** Better Auth exposes `hooks` in the `betterAuth()` config. The `after` hook fires after successful sign-up.

```typescript
// server/src/auth.ts: add hooks to betterAuth() config
hooks: {
  after: [
    {
      matcher: (context) => context.path === '/sign-up/email',
      handler: async (ctx) => {
        const user = ctx.context.newSession?.user;
        if (user) {
          // Fire-and-forget; do not await to avoid blocking the sign-up response
          void scheduleOnboardingSequence(user.id, user.email, user.name);
        }
        return ctx;
      },
    },
  ],
},
```

**`scheduleOnboardingSequence`** sends:
1. Welcome email immediately (via Resend, fire-and-forget)
2. "Key features" email at +24h via cron worker
3. Upgrade prompt email at +72h via cron worker

**Cron worker approach:** The existing `expiration-worker.ts` runs on a cron schedule. Add an `onboarding-worker.ts` that queries for users in their first 4 days and sends timed emails. Store the `onboarding_step` (0-3) on the user row or in a separate `onboarding_emails` table.

**Simpler alternative:** A `user_onboarding` table with columns `(userId, step, send_at, sent_at)`. The worker queries `WHERE send_at <= NOW() AND sent_at IS NULL`, sends, and marks `sent_at`. Avoids adding a column to the Better Auth-managed `users` table.

**Zero-knowledge invariant:** Onboarding emails contain no `secretId`. They reference only the user's name, email, and account features. No invariant risk.

---

## New vs. Modified: Complete Inventory

### New Files

| File | Layer | Responsibility |
|------|-------|---------------|
| `server/src/routes/stripe-webhook.ts` | Routes | Raw body handler, event dispatch, idempotent DB updates |
| `server/src/routes/billing.ts` | Routes | Checkout session creation, portal session URL |
| `server/src/routes/email-capture.ts` | Routes | Beehiiv API proxy, rate-limited |
| `server/src/services/stripe.service.ts` | Services | Stripe SDK calls (checkout, portal, subscription read) |
| `server/src/middleware/require-plan.ts` | Middleware | Pro feature gate (check user plan) |
| `server/src/workers/onboarding-worker.ts` | Workers | Timed onboarding email sequence |
| `client/src/pages/home.ts` | Frontend | Marketing homepage (hero, proof points, How It Works, pricing preview, email capture) |
| `client/src/pages/pricing.ts` | Frontend | Pricing page (Free vs Pro cards, FAQ, upgrade CTA) |
| `client/src/pages/vs/onetimesecret.ts` | Frontend | Competitor comparison page |
| `client/src/pages/vs/pwpush.ts` | Frontend | Competitor comparison page |
| `client/src/pages/vs/privnote.ts` | Frontend | Competitor comparison page |
| `client/src/pages/alternatives/onetimesecret.ts` | Frontend | Alternatives page |
| `client/src/pages/alternatives/pwpush.ts` | Frontend | Alternatives page |
| `client/src/pages/alternatives/privnote.ts` | Frontend | Alternatives page |
| `client/src/pages/use-case.ts` | Frontend | Programmatic use-case pages, slug-switched content |
| `client/src/utils/json-ld.ts` | Frontend Utility | Per-route JSON-LD injection/removal |

### Modified Files

| File | Change | Reason |
|------|--------|--------|
| `server/src/app.ts` | Add Stripe raw-body webhook before `express.json()`; add `/api/billing` and `/api/email-capture` routes | New endpoints |
| `server/src/config/env.ts` | Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` | New services |
| `server/src/auth.ts` | Add `hooks.after` for onboarding sequence trigger | Better Auth lifecycle hook |
| `server/src/db/schema.ts` | Add `subscriptions` table (if manual Stripe SDK path) or run Better Auth Stripe plugin migration | Billing state storage |
| `client/src/router.ts` | Add routes for `/`, `/create`, `/pricing`, `/vs/*`, `/use/*`, `/alternatives/*` | New pages plus homepage split |
| `client/index.html` | Remove `max-w-2xl` from `#app` container; update brand references (SecureShare -> Torch Secret, domain -> torchsecret.com) | Marketing pages need full-width layout |
| `client/public/sitemap.xml` | Add all new indexable routes | SEO discoverability |
| `client/public/robots.txt` | Verify `Allow: /pricing`, `Allow: /vs/*`, `Allow: /use/*` | SEO |
| `.planning/INVARIANTS.md` | Add Stripe/billing row to enforcement table | Extension protocol compliance |

### Unchanged Files (Zero-Knowledge Core Intact)

| File | Why unchanged |
|------|---------------|
| `server/src/services/secrets.service.ts` | Atomic zero-then-delete unchanged |
| `server/src/middleware/security.ts` | No new CSP domains needed for Stripe redirect-mode; Beehiiv call is server-side |
| `client/src/crypto/` | Web Crypto module unchanged |
| `server/src/middleware/logger.ts` | No new redaction rules needed; billing/email endpoints do not contain secretId |
| All existing page modules | Only routing changes; page content unchanged |

---

## Architectural Patterns

### Pattern 1: Stripe Raw-Body Before Global JSON Parser

**What:** The Stripe webhook route must receive the request body as a raw `Buffer`. The global `express.json()` middleware consumes the body stream. Mount the Stripe route using `express.raw({ type: 'application/json' })` directly on the app instance before the `express.json()` call.

**When:** Any endpoint that uses HMAC signature verification over the raw request body. Only Stripe webhooks in this codebase.

**Trade-offs:** The webhook handler is the only route in the codebase not covered by the global JSON parser. This is correct by design. The raw buffer is passed to `stripe.webhooks.constructEvent(buffer, signature, secret)` which parses JSON internally after verification.

**Example:**
```typescript
// In buildApp(), BEFORE app.use(express.json(...)):
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);
// Then: app.use(express.json({ limit: '100kb' }));
```

### Pattern 2: SPA Route for Marketing Pages (No SSR)

**What:** Marketing pages (`/pricing`, `/vs/*`, `/use/*`) are rendered client-side by the existing SPA router, not server-side. Each page is a separate dynamic-import chunk. `updatePageMeta()` sets the correct title, description, and canonical URL on every navigation.

**When:** Content pages that are essentially static text, rendered within the existing SPA infrastructure. No external data dependencies (no API calls needed to render the page content).

**Trade-offs:** Googlebot renders JavaScript. Second-wave indexing may be slower than static HTML. For a product launching now, this trade-off is acceptable. If post-launch analytics show these pages are not indexing well, prerendering can be added as a build step later.

**Example:**
```typescript
// router.ts: standard pattern, just more routes
} else if (path === '/pricing') {
  updatePageMeta({
    title: 'Pricing - Torch Secret',
    description: '...',
    canonical: 'https://torchsecret.com/pricing',
  });
  import('./pages/pricing.js')
    .then((mod) => mod.renderPricingPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

### Pattern 3: Per-Route JSON-LD Injection

**What:** Each page module that needs schema markup calls `setJsonLd(schema)` at render time. The utility creates a `<script type="application/ld+json">` element (a data block, not executable script), escapes `<` characters to prevent XSS, and appends it to `document.head`. The previous route's element is removed before insertion.

**When:** Any route that benefits from rich schema markup: homepage (`WebApplication`), pricing (`FAQPage`), use-case pages (`HowTo`), comparison pages (`WebApplication` with comparative data).

**Trade-offs:** The JSON-LD is injected after JavaScript runs, not in the initial HTML. For Googlebot, this is fine -- it executes JavaScript and reads the final DOM. The static `index.html` JSON-LD block provides a fallback for non-JS crawlers on the initial load.

### Pattern 4: Backend-Proxied Email Capture

**What:** The email capture form POSTs to `/api/email-capture` (Express). Express validates the email with Zod, rate-limits the endpoint, and proxies to Beehiiv's `/subscriptions` API. The Beehiiv API key never reaches the browser.

**When:** Any form that submits user data to a third-party marketing service. The pattern generalizes to any service where API credentials must be kept server-side.

**Trade-offs:** One additional HTTP round-trip (browser to Express to Beehiiv) vs. a direct browser-to-Beehiiv call. The latency overhead is negligible (tens of milliseconds) relative to the security and CSP benefits.

---

## Data Flow: Key Paths

### Stripe Pro Upgrade Flow

```
Browser (pricing page):
  User clicks "Upgrade to Pro"
  POST /api/billing/checkout { priceId: 'price_...' }
        |
Express: requireAuth -> billingRouter
  Stripe SDK: stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: user.stripeCustomerId,  // or create new customer
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://torchsecret.com/dashboard?upgrade=success',
    cancel_url: 'https://torchsecret.com/pricing',
  })
  Response: { url: 'https://checkout.stripe.com/...' }
        |
Browser: window.location.href = url  (leaves SPA, goes to Stripe)
        |
User completes payment on stripe.com
        |
Stripe -> POST /api/webhooks/stripe (or /api/auth/stripe/webhook via Better Auth plugin)
  express.raw() -> Buffer body preserved
  stripe.webhooks.constructEvent(body, sig, secret)  // HMAC verification
  event.type === 'checkout.session.completed'
        |
  DB transaction:
    UPDATE users SET plan = 'pro' WHERE id = userId
    INSERT subscriptions (...) ON CONFLICT DO UPDATE SET status = ...
        |
  Resend: send 'Welcome to Pro' email (fire-and-forget)
        |
  Response: 200 { received: true }
        |
Browser: redirected to /dashboard?upgrade=success
  Dashboard reads user session (plan is now 'pro')
  Shows Pro badge, unlocks 30-day expiration option
```

### Email Capture Flow

```
Browser (homepage email capture form):
  User types email, submits form
  POST /api/email-capture { email: 'user@example.com' }
        |
Express:
  Rate limiter: 3 req/IP/hour
  Zod validation: z.string().email()
        |
  fetch('https://api.beehiiv.com/v2/publications/{PUB_ID}/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.BEEHIIV_API_KEY}` },
    body: JSON.stringify({ email, reactivate_existing: false }),
  })
        |
  Response: { success: true }
        |
Browser: show success toast "You're on the list!"
```

### SEO Page Navigation Flow

```
Googlebot or User -> GET /vs/onetimesecret
        |
Express: SPA catch-all handler
  Injects __CSP_NONCE__ -> returns index.html with static WebApplication JSON-LD
        |
Browser:
  Theme FOWT script runs (existing)
  app.ts loads, router.ts handleRoute() fires
  path === '/vs/onetimesecret'
        |
  updatePageMeta({
    title: 'Torch Secret vs OneTimeSecret',
    canonical: 'https://torchsecret.com/vs/onetimesecret',
  })
  import('./pages/vs/onetimesecret.js') -> renders comparison content
  setJsonLd({ '@type': 'WebApplication', ... }) -> injects comparison schema as data block
        |
Googlebot reads final DOM:
  <title>Torch Secret vs OneTimeSecret...</title>
  <meta description="...">
  <link rel="canonical" href="https://torchsecret.com/vs/onetimesecret">
  <script type="application/ld+json">{ ... }</script>
```

---

## Build Order: Dependency Chain

```
Phase 1: Rebrand (no deps -- string replacements across all files)
|
+-- Replace SecureShare -> Torch Secret in: index.html, router.ts, auth.ts,
    all page .ts files, README, sitemap.xml, JSON-LD, OG tags
+-- Replace secureshare.example.com -> torchsecret.com in: index.html,
    sitemap.xml, robots.txt, CLAUDE.md references
+-- Tech debt: CI env vars, /privacy + /terms noindex, schema.ts ZK comment

Phase 2: Homepage + Create Page Split (depends on Phase 1 -- rebrand complete)
|
+-- Remove max-w-2xl from index.html #app container (layout shell change)
+-- Add /create route to router.ts (move existing create logic)
+-- Create client/src/pages/home.ts (marketing homepage, no Stripe yet)
+-- Update header nav: "/" -> "/create" for "Create Secret" link
    Pricing page, SEO pages depend on homepage layout being established

Phase 3: Pricing Page (depends on Phase 2 -- create at /create, not /)
|
+-- Add /pricing route to router.ts
+-- Create client/src/pages/pricing.ts (static content, no Stripe CTA yet)
+-- Add /pricing to sitemap.xml

Phase 4: Stripe Billing (depends on Phase 3 -- pricing page must exist)
|
+-- Add STRIPE_* env vars to config/env.ts
+-- Generate subscriptions migration (Better Auth Stripe plugin OR manual Drizzle)
+-- Mount POST /api/webhooks/stripe BEFORE express.json() in app.ts
+-- server/src/routes/stripe-webhook.ts (event handlers, idempotent upserts)
+-- server/src/routes/billing.ts (checkout session, portal session)
+-- server/src/services/stripe.service.ts (Stripe SDK calls)
+-- Add requirePlan middleware (server/src/middleware/require-plan.ts)
+-- Move inline 30d expiration check to requirePlan('pro') in secrets.ts
+-- Wire upgrade CTA in pricing.ts to POST /api/billing/checkout
+-- Dashboard: show Pro badge, unlock 30d expiration option for Pro users

Phase 5: SEO Content Pages (depends on Phase 1 -- rebrand; otherwise independent)
|
+-- client/src/utils/json-ld.ts (per-route JSON-LD injection utility)
+-- Add /vs/*, /alternatives/*, /use/* routes to router.ts
+-- Create page modules: vs/onetimesecret.ts, vs/pwpush.ts, vs/privnote.ts,
    alternatives/*.ts, use-case.ts (slug-switched)
+-- Update sitemap.xml with all new routes
+-- Schema markup: WebApplication on /, FAQPage on /pricing,
    HowTo/WebApplication on /use/*, WebApplication on /vs/*

Phase 6: Email Capture (depends on Phase 5 -- homepage has the capture form)
|
+-- Add BEEHIIV_* env vars to config/env.ts
+-- server/src/routes/email-capture.ts (proxy, Zod validation, rate limit)
+-- Wire email capture form in home.ts to POST /api/email-capture

Phase 7: Email Onboarding Sequence (depends on Phase 4 Stripe, Phase 6 email)
|
+-- user_onboarding table (Drizzle migration: userId, step, send_at, sent_at)
+-- Better Auth hooks.after in auth.ts: on sign-up, insert 3 onboarding rows
+-- server/src/workers/onboarding-worker.ts (cron, queries unsent rows, Resend calls)

Phase 8: Feedback Form Links (depends on Phase 2 -- existing pages unchanged)
|
+-- Add feedback link to confirmation page (client/src/pages/confirmation.ts)
+-- Add feedback link to reveal page (client/src/pages/reveal.ts)
    (Links to an external form -- Typeform, Tally, etc. -- not a new page)
```

**Why this ordering:**

1. **Rebrand first:** Every subsequent file touch should use the new brand name. Doing rebrand last means editing files twice.
2. **Homepage/create split before pricing:** The pricing page CTA links to `/create`. If `/create` does not exist yet, the link is broken during development.
3. **Pricing page before Stripe:** The Stripe Checkout `cancel_url` points to `/pricing`. The page should exist before wiring up the checkout flow.
4. **Stripe before email onboarding:** The onboarding sequence includes an upgrade prompt email. The upgrade flow must work before the email references it.
5. **SEO pages are independent:** They can be built in parallel with billing after the rebrand is complete. Listed as Phase 5 for clarity, but could overlap with Phase 4.
6. **Email capture after homepage:** The capture form lives on the homepage. The homepage page module must exist before the form can be wired up.
7. **Feedback links last:** Smallest scope, no dependencies, safe to do anytime after the relevant page modules exist.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mounting Stripe Webhook Inside a Sub-Router

**What people do:** Create a `billingRouter`, add the webhook route to it, then mount the router on the app after `express.json()`.

**Why it's wrong:** By the time the request reaches the billing router, `express.json()` has already consumed the body stream. The raw buffer is gone. `stripe.webhooks.constructEvent()` throws because it receives a parsed object instead of a Buffer.

**Do this instead:** Mount the webhook route directly on the `app` instance before the `express.json()` middleware line.

### Anti-Pattern 2: Adding `unsafe-inline` to script-src for JSON-LD

**What people do:** Dynamically injected script elements appear to fail CSP, so they add `'unsafe-inline'` to `script-src`.

**Why it's wrong:** `'unsafe-inline'` nullifies the entire nonce-based CSP. Any injected inline script -- including XSS payloads -- runs without restriction. This is a critical security regression.

**Do this instead:** Use `<script type="application/ld+json">` (a data block, not executable code). CSP `script-src` does not apply to script elements with a MIME type other than JavaScript. No nonce is needed for JSON-LD data blocks.

### Anti-Pattern 3: Calling Beehiiv API from the Browser

**What people do:** Call the Beehiiv subscription API directly from the client-side email capture form handler.

**Why it's wrong:** The Beehiiv API key must be included in the request. Embedding it in the client bundle exposes it to anyone who opens DevTools. `connectSrc` CSP also needs to allow `api.beehiiv.com`, adding a third-party domain to the CSP attack surface.

**Do this instead:** POST to `/api/email-capture`, let Express proxy to Beehiiv with the server-side API key. Rate-limit the endpoint at the Express layer.

### Anti-Pattern 4: Removing max-w-2xl Without Moving It to Page Modules

**What people do:** Remove `max-w-2xl` from `index.html` for the marketing homepage, causing the create page and reveal page to become full-width.

**Why it's wrong:** The create form, reveal page, and confirmation page were designed at `max-w-2xl`. Full-width creates/reveals look broken.

**Do this instead:** Remove `max-w-2xl` from the `#app` div in `index.html`. Each page module that needs a constrained width applies its own `max-w-2xl mx-auto` to its outermost container. The marketing homepage and SEO pages manage their own widths per section (hero can be full-width; content sections constrained).

### Anti-Pattern 5: Combining userId and Stripe Event Data in a Log Line

**What people do:** Log `{ userId, stripeCustomerId, plan, event: 'subscription_created' }` for debugging the billing webhook.

**Why it's worth avoiding:** While `stripeCustomerId` is not a `secretId`, the general pattern of attaching user identifiers to event log lines should be scrutinized. Log the event type, plan change, and subscription status. Omit `userId` from Stripe webhook log lines. If debugging requires correlating a webhook to a user, use `stripeCustomerId` as the log's distinct identifier (it is not PII in isolation and does not combine with `secretId`).

---

## Integration Points: External Services

| Service | Integration Pattern | Specific Notes |
|---------|---------------------|---------------|
| Stripe | Redirect-to-hosted Checkout + raw-body webhook | No Stripe.js in browser; no `script-src` CSP change needed; webhook mounted before `express.json()` |
| Beehiiv | Server-side HTTP proxy from `/api/email-capture` | API key stays server-side; endpoint rate-limited; Zod validates email |
| Resend | Existing SDK (transactional email) | Onboarding sequence adds 3 email templates; triggered via Better Auth lifecycle hook |
| Better Auth Stripe plugin | Plugin added to `betterAuth()` config in `auth.ts` | Adds subscription table via `@better-auth/cli generate`; webhook handled at `/api/auth/stripe/webhook` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app.ts` webhook mount vs. `express.json()` | Ordering dependency | Webhook must precede global JSON parser; document in `app.ts` middleware order comment |
| `router.ts` vs. page modules | Dynamic import | `home.ts` is a new chunk; all SEO pages are separate chunks (code splitting) |
| `json-ld.ts` utility vs. page modules | Direct import | Called in each page's render function; singleton `currentJsonLdEl` reference tracks the active element |
| `billing.ts` routes vs. `requireAuth` middleware | Middleware chain | All billing endpoints require auth session; unauth users get 401 and are redirected to `/login` |
| `onboarding-worker.ts` vs. Resend | `resend.emails.send()` | Same service as existing auth emails; no new SDK dependency |

---

## Sources

- [Stripe Webhooks: Using with Express](https://docs.stripe.com/webhooks) -- raw body requirement, `constructEvent` pattern (HIGH -- official)
- [Stripe Subscription Webhook Events](https://docs.stripe.com/billing/subscriptions/webhooks) -- `checkout.session.completed`, `customer.subscription.*`, `invoice.*` events (HIGH -- official)
- [Better Auth Stripe Plugin](https://www.better-auth.com/docs/plugins/stripe) -- subscription table schema, `@better-auth/cli generate`, webhook at `/api/auth/stripe/webhook` (MEDIUM -- known active bugs in 2025-2026)
- [Better Auth Stripe Plugin Issues](https://github.com/better-auth/better-auth/issues/4957) -- subscription updates not persisting (MEDIUM -- open issue, risk flag)
- [Beehiiv Create Subscription API](https://developers.beehiiv.com/api-reference/subscriptions/create) -- endpoint, required params, `send_welcome_email` option (HIGH -- official)
- [Vite Multi-Page Build](https://vite.dev/guide/build) -- `build.rollupOptions.input` for multiple HTML entry points (HIGH -- official)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) -- `script-src` does not restrict `type="application/ld+json"` data blocks (HIGH -- official)
- [SPA SEO 2025](https://shahidshahmiri.com/seo-for-single-page-applications/) -- second-wave indexing for JS-rendered content; Google recommendation for SSR on mission-critical SEO pages (MEDIUM -- community blog, aligns with Google Developers guidance)
- [Stripe Express Subscription Integration](https://codingpr.com/express-stripe-subscriptions/) -- checkout session creation pattern, portal session pattern (MEDIUM -- community blog, consistent with official Stripe docs)

---

*Architecture research for: Torch Secret v5.0 Product Launch Checklist*
*Researched: 2026-02-22*
