# Pitfalls Research: Product Launch (Stripe Billing, Marketing SEO, Email)

**Domain:** Adding Stripe Pro billing, marketing homepage, programmatic SEO pages, schema markup, and email capture to an existing zero-knowledge Express 5 + Vanilla TS SPA
**Researched:** 2026-02-22
**Confidence:** HIGH for Stripe CSP, raw body ordering, SEO crawler limitations, JSON-LD in SPAs; MEDIUM for GDPR email classification boundaries, Stripe billing ZK invariant surface, programmatic page SEO risk
**Scope:** Pitfalls specific to ADDING v5.0 features to Torch Secret — an existing app with a per-request nonce-based CSP, zero-knowledge AES-256-GCM encryption, Better Auth sessions, PostHog analytics, and the hard invariant that no system may store both userId and secretId together. Previous pitfalls for v4.0 (OAuth, Stripe webhooks basics, PostHog URL fragment capture) are documented in milestones/v4.0-phases/. This file covers net-new v5.0 integration pitfalls only.

---

## Critical Pitfalls

Mistakes that violate the zero-knowledge guarantee, silently break production, or require rewrites.

### Pitfall 1: Stripe Billing Creates a userId + Payment Data Association That Needs Careful Scoping

**What goes wrong:**
Stripe requires creating a `Customer` object to track subscriptions. The natural implementation stores `stripeCustomerId` on the `users` row. This is correct and safe — a `stripeCustomerId` on a `users` row creates no user-secret association.

The dangerous variation: adding `stripeCustomerId` or any billing metadata to a row that also contains a `secretId`, or logging both `userId` and any Stripe `customer` property in the same log line. A second danger: storing the user's email address in Stripe Customer metadata labeled in a way that could be cross-referenced with secret creation. Stripe's own privacy policy confirms it shares device and activity data with advertising partners — any metadata you attach to a Stripe Customer object is shared under those same terms.

The third danger is the most subtle: the webhook handler for `checkout.session.completed` receives a `customer` object containing the customer's email. If the webhook logs this email alongside any request context that could be correlated with a secretId, the ZK invariant is violated via the log system rather than the DB.

**Why it happens:**
- Standard webhook logging includes full event objects for debugging
- Developers assume the ZK invariant only applies to the DB schema, not logs or Stripe metadata
- The `@better-auth/stripe` plugin auto-creates Stripe Customers from the Better Auth user object, which includes the user's email — this is expected behavior but developers must ensure the email does not flow into any system that co-locates it with secretIds

**How to avoid:**
Apply the ZK invariant explicitly to the Stripe integration:

1. `stripeCustomerId` on the `users` table: SAFE — no secretId in the same row
2. Webhook log lines: emit only `{ event_type, customer_id }` — never email, userId, and secretId in the same log line
3. Stripe Customer metadata: store only the internal `userId` (opaque DB ID, not email, not username) so Stripe can route webhooks back to the right user
4. Extend `INVARIANTS.md` before shipping the Stripe phase to add a row for the webhook handler

```typescript
// SAFE webhook log — no email, no secretId
logger.info({ stripeEventType: event.type, stripeCustomerId: event.data.object.customer }, 'Stripe webhook received');

// DANGEROUS webhook log — email co-located with user activity
logger.info({ userId, email, stripeEventType: event.type }, 'Subscription activated');
```

**Warning signs:**
- Webhook handler logs `email` or `user.email` alongside any user-identifiable field
- Stripe Customer metadata contains more than an opaque userId
- Any log line that contains both `customerId` and a path that could include a secretId

**Phase to address:** Stripe billing phase (before webhook handler is written)

---

### Pitfall 2: Stripe Checkout Hosted Redirect Still Requires CSP Changes — But Different Ones Than Expected

**What goes wrong:**
The existing plan uses Stripe hosted Checkout (server-side redirect to `checkout.stripe.com`). This is the correct choice — it means `js.stripe.com` does NOT need to be in `script-src`, because the merchant page never loads Stripe.js. However, the existing CSP will still reject Stripe traffic for a different reason: the browser's redirect to `checkout.stripe.com` and the return redirect from Stripe fire requests that touch Stripe's telemetry domains.

More specifically: when Stripe's Checkout success page returns the user to your `success_url`, some browsers make a pre-flight or reporting request to `q.stripe.com` (Stripe's telemetry endpoint). If `connect-src` does not include this domain, a CSP violation is logged but the user flow is NOT blocked — it is a silent telemetry failure, not a broken payment flow. However, it generates CSP violation noise in production monitoring that can obscure real violations.

Additionally: the Customer Portal (`/api/billing/portal`) also redirects to `billing.stripe.com`. If the app ever adds an embedded billing widget rather than a redirect, `frame-src` for `js.stripe.com` and `hooks.stripe.com` would become required — this is not needed for the current redirect-only architecture but is a common mis-step during future upgrades.

**Why it happens:**
- Documentation for Stripe Checkout (hosted/redirect) and Stripe Checkout (embedded) uses the same examples
- Developers add all CSP domains from Stripe docs without distinguishing redirect vs. embedded mode
- The `q.stripe.com` telemetry domain is not prominently documented

**How to avoid:**
For the redirect-only architecture (current plan), the minimal CSP changes are:

```typescript
// In createHelmetMiddleware() — additions for Stripe hosted Checkout + Customer Portal
connectSrc: [
  "'self'",
  'https://us.i.posthog.com',
  'https://us-assets.i.posthog.com',
  // Stripe: NOT needed for redirect Checkout, but add if billing widget is ever embedded
  // 'https://api.stripe.com',
  // 'https://q.stripe.com',  // Stripe telemetry (silent CSP violation if omitted)
],
// frame-src NOT required for redirect-only Checkout
// script-src NOT required for redirect-only Checkout (no js.stripe.com on merchant page)
```

If Stripe.js is ever added to the merchant page (e.g., for embedded Checkout or Payment Element), the required additions are:
- `script-src`: `https://js.stripe.com`
- `frame-src`: `https://js.stripe.com`, `https://hooks.stripe.com`
- `connect-src`: `https://api.stripe.com`
- `worker-src`: `blob:` (for Stripe's internal web workers)
- `img-src`: `https://*.stripe.com`

Do NOT add `unsafe-eval`. Stripe.js does not require it and the existing CSP must not be weakened.

**Warning signs:**
- CSP violation reports containing `q.stripe.com` or `js.stripe.com` in production
- Code that imports `@stripe/stripe-js` (the client-side library) when only the server-side `stripe` package is needed
- `frame-src` containing Stripe domains despite using hosted redirect Checkout

**Phase to address:** Stripe billing phase (CSP changes in `security.ts` before Checkout session creation is wired up)

---

### Pitfall 3: Express JSON Middleware Ordering Breaks Stripe Webhook Signature Verification

**What goes wrong:**
This is documented in v4.0 pitfalls but is worth a specific call-out for v5.0 because the existing `app.ts` already has a precedent that makes this easy to get wrong: Better Auth's handler is registered BEFORE `express.json()` to avoid body-stream consumption. The Stripe webhook handler must follow the same pattern for a different reason — signature verification requires the raw byte Buffer, not a parsed object.

The current `app.ts` comment in step 6 says "auth handler must be before express.json()". When the Stripe webhook route is added, it must be inserted at the same position (before `express.json()`), not after step 7. If a developer reads the comments and concludes "only auth needs to be first", they will add the Stripe route after `express.json()` and get a signature mismatch error in production that is very hard to debug.

**Why it happens:**
- The comment in `app.ts` documents auth ordering but does not mention Stripe
- `stripe.webhooks.constructEvent` error message ("No signatures found matching the expected signature") does not say "the body was pre-parsed"
- Stripe CLI local testing generates valid signatures, masking the ordering bug until a production deploy

**How to avoid:**
Register the Stripe webhook route between the auth handler and `express.json()` in `app.ts`. Update the comment block to document this:

```typescript
// Step 6a: Better Auth handler -- before express.json() (body-stream ordering)
app.all('/api/auth/{*splat}', toNodeHandler(auth));

// Step 6b: Stripe webhook -- before express.json() (raw body required for signature verification)
// express.raw() reads the full body as a Buffer WITHOUT parsing it as JSON.
// constructEvent() hashes the raw Buffer; any JSON pre-parsing invalidates the HMAC signature.
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// Step 7: JSON parser (for all other routes)
app.use(express.json({ limit: '100kb' }));
```

**Warning signs:**
- `stripe.webhooks.constructEvent` throws in production but works with Stripe CLI locally
- The Stripe webhook route is registered after `app.use(express.json())`
- The `app.ts` comment block for middleware ordering does not mention the webhook

**Phase to address:** Stripe billing phase (first task: wire up the route, verifying ordering against existing app.ts comment)

---

### Pitfall 4: SPA SEO Pages Are Invisible to AI Crawlers and Slow to Index for Google

**What goes wrong:**
The v5.0 SEO plan includes competitor comparison pages (`/vs/onetimesecret`), alternative pages (`/alternatives/pwpush`), and programmatic use-case pages (`/use/[slug]`). These are currently planned as SPA routes rendered client-side by Vanilla TS. This is the wrong architecture for SEO-critical content.

Google Googlebot executes JavaScript and CAN eventually index JS-rendered content, but in two waves: (1) an initial crawl of the raw HTML (which for this SPA is just a shell `index.html` with no meaningful content), then (2) a deferred rendering queue that can take days to weeks, especially for new domains. The content is not guaranteed to appear in search results at all during launch.

AI crawlers (GPTBot, ClaudeBot, PerplexityBot, which affect AI search citations) cannot execute JavaScript at all. They see the empty HTML shell and extract zero content. JSON-LD structured data injected by JS is also invisible to these crawlers.

For a launch strategy built around SEO content pages, this means the competitor comparison pages — the ones designed to capture users searching "onetimesecret alternative" — will be invisible to the very crawlers they target at launch.

**Why it happens:**
- The app is an SPA and the natural implementation adds new routes to the SPA router
- Googlebot's deferred rendering gives a false sense of security — content eventually gets indexed, so developers assume it "works"
- AI crawlers are a relatively new concern not on most developers' radar

**How to avoid:**
Serve SEO content pages as static HTML from the Express server, not as SPA routes. The correct approach for this stack:

1. Create server-rendered HTML templates for each SEO page (`/vs/:competitor`, `/use/:slug`, `/alternatives/:competitor`) that Express serves directly with `res.send(fullHtml)` — fully-formed HTML including `<head>`, meta tags, and body content
2. These server-rendered HTML pages include all content in the initial HTTP response — no JS execution required for Googlebot or AI crawlers to read the full content
3. The SPA router in `client/src/router.ts` does NOT need to handle these routes — the server handles them directly
4. JSON-LD schema blocks go in the `<head>` of the server-rendered HTML as static `<script type="application/ld+json">` tags — not injected by JS
5. Apply the same CSP nonce injection that already exists for `index.html` to these server-rendered pages

Alternative approach (if full server-render is too complex): pre-build static HTML files at deploy time using a script that renders each page's content into a full HTML template, then serve them as static assets. This is simpler than true SSR and achieves the same crawler result.

**Warning signs:**
- SEO page routes (e.g. `/vs/onetimesecret`) are handled by the SPA router in `client/src/router.ts`
- The Express server's `{*path}` SPA catch-all handles SEO page requests and serves the empty `index.html` shell
- Running `curl -L https://torchsecret.com/vs/onetimesecret` returns a near-empty HTML body

**Phase to address:** SEO content pages phase (before any page content is written — architecture decision first)

---

### Pitfall 5: JSON-LD Schema Markup Injected by JavaScript Is Invisible to AI Crawlers

**What goes wrong:**
The SPA already has JSON-LD for `WebApplication` schema in `index.html`. For v5.0, additional schemas are planned: `FAQPage`, `HowTo`, and `WebApplication` on the marketing homepage and pricing page. If these are injected by the SPA router's JS (as the current pattern does for per-route meta tags), Googlebot will eventually parse them but AI crawlers (GPTBot, ClaudeBot, PerplexityBot) will not.

Google explicitly states JSON-LD can be dynamically injected by JS and Google will process it — but only for traditional Googlebot. For AI overview features, speed of rendering matters: Google's AI Overviews prefer readily available structured data over deferred JS rendering.

The current SPA router pattern of updating `<head>` content via JS works for human-facing meta tags where latency in Google indexing is acceptable. It is NOT adequate for structured data on launch-day SEO pages where AI search citations are a goal.

**Why it happens:**
- The existing router already injects `<title>`, `<meta description>`, and OG tags via JS — structured data follows the same pattern
- Developers conflate "Google can process JS-injected JSON-LD" with "all crawlers process JS-injected JSON-LD"
- No explicit signal that JS-injected structured data fails for AI crawlers

**How to avoid:**
Embed JSON-LD as static `<script type="application/ld+json">` tags directly in the HTML served by the server for each SEO page. For the SPA's existing `index.html` (marketing homepage and pricing if they remain SPA routes), move the JSON-LD block from JS injection into the static `index.html` template — it is simpler and more reliable:

```html
<!-- In the server-rendered HTML for /vs/onetimesecret — static, not JS-injected -->
<head>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Torch Secret vs OneTimeSecret",
    "description": "Zero-knowledge comparison...",
    "mainEntity": {
      "@type": "ItemList",
      ...
    }
  }
  </script>
</head>
```

For the marketing homepage and pricing page (which remain as SPA routes served from `index.html`), add the `WebApplication` and `FAQPage` JSON-LD blocks directly to `client/index.html` as static tags rather than injecting them via the router. The only downside is that all SPA routes share this JSON-LD — use `sameAs` and broad schema types that are accurate for the homepage.

**Warning signs:**
- JSON-LD for SEO pages is written in a JS file (`router.ts`, a page module, or a helper) rather than in HTML
- Running `curl https://torchsecret.com/vs/onetimesecret | grep 'application/ld+json'` returns nothing
- Google Rich Results Test shows "item could not be detected" even after indexing

**Phase to address:** SEO content pages phase (same phase as Pitfall 4 — both address the static-vs-SPA architecture decision)

---

### Pitfall 6: Email Onboarding Sequence May Cross the GDPR Transactional/Marketing Boundary

**What goes wrong:**
The v5.0 plan includes a 3-email onboarding sequence: welcome, key features, upgrade prompt. Under GDPR, the classification of these emails determines whether explicit prior consent is required:

- **Transactional emails:** Triggered by user action (registration, purchase), reasonably expected by the recipient. No explicit marketing consent required. No unsubscribe link legally required (though good practice).
- **Marketing emails:** Promotional content sent to a user for business benefit. Explicit prior opt-in consent required. Unsubscribe link mandatory.

The welcome email (email 1) is clearly transactional — it is triggered by account registration. The "key features" email (email 2) is borderline — it educates the user about the product but could be seen as promotional. The "upgrade prompt" email (email 3) is marketing — it explicitly promotes a paid tier.

If emails 2 and 3 are sent via Resend to all newly registered users without an explicit marketing consent checkbox on the registration form, this violates GDPR for EU users. The fact that the app already has a privacy-first positioning ("zero-knowledge", "GDPR-oriented") makes this violation more visible and more damaging to trust.

**Why it happens:**
- "Welcome onboarding" emails are intuitively associated with account setup (transactional), but the upgrade prompt is promotional
- Resend sends all emails regardless of classification — the developer must enforce the boundary
- Registration forms commonly omit marketing consent checkboxes as an intentional UX choice, leaving the boundary enforcement undefined

**How to avoid:**
Classify each email before building:

| Email | Classification | Consent Required | Unsubscribe Required |
|-------|---------------|-----------------|---------------------|
| Welcome (email 1) | Transactional | No | No (good practice) |
| Key features (email 2) | Transactional if focused on product use, Marketing if promotional | No / Yes | No / Yes |
| Upgrade prompt (email 3) | Marketing (promotes paid tier) | YES | YES |

For GDPR compliance, either:
- **Option A:** Add a marketing consent checkbox to the registration form ("Send me product tips and upgrade news"), store the consent flag, and only send emails 2 and 3 to users who opted in
- **Option B:** Limit the onboarding sequence to email 1 only (unambiguously transactional), defer the upgrade prompt to in-app UI only

For EU users specifically, "legitimate interest" does NOT cover promotional upgrade emails — explicit consent is required. Given that Torch Secret explicitly positions itself as privacy-respecting and GDPR-oriented, Option A with a clear unchecked opt-in checkbox is the defensible implementation.

Also required for any marketing email via Resend: a one-click unsubscribe link that actually removes the user from the marketing list (not just marks them as "unsubscribed" in a way that requires them to email support).

**Warning signs:**
- Registration form has no marketing consent checkbox and still sends 3 emails to all new users
- Emails 2 or 3 contain promotional copy ("upgrade to Pro") with no unsubscribe link
- Resend audience list includes all registered users without a consent flag filter
- "GDPR" is in the privacy policy but the email consent flow does not reflect it

**Phase to address:** Email onboarding phase (consent model defined before Resend sequence is built)

---

### Pitfall 7: Marketing Email Capture Form on Homepage Stores Email Addresses Without GDPR Consent Flow

**What goes wrong:**
The marketing homepage redesign includes an email capture form for pre-launch or launch interest. This form collects email addresses for marketing purposes — it is unambiguously a marketing list, not transactional. Storing these addresses without:
1. An explicit, unchecked opt-in checkbox with clear description of what subscribers will receive
2. A documented consent record (timestamp, source, what they agreed to)
3. A working unsubscribe mechanism

...is a GDPR violation. The fine is up to 4% of annual global revenue or €20M, whichever is higher. More pragmatically, if a user complains, the regulator will check whether the consent record exists.

The second failure mode: storing these email addresses in the same database table that stores user accounts, without separating the "prospective subscriber" record from the "registered user" record. If a subscriber later registers, the marketing consent status should carry through — but the two should be separate systems during the pre-registration phase.

**Why it happens:**
- Email capture forms feel lightweight ("just an email address") so developers skip the consent infrastructure
- The form is built in the marketing phase before the privacy policy is finalized
- The backend "just stores it in a table" without thinking about the legal consent requirements

**How to avoid:**
Treat the email capture form as a GDPR consent capture:

1. Checkbox (unchecked by default): "I agree to receive product updates and launch announcements from Torch Secret. You can unsubscribe at any time."
2. Store alongside the email: `{ email, consented_at, consent_source: 'homepage_capture', ip_hash }` — use a hash of the IP, not the raw IP, to avoid storing PII unnecessarily
3. Confirmation email (double opt-in recommended): a brief email confirming subscription with a one-click unsubscribe link
4. Unsubscribe endpoint: `GET /unsubscribe?token=...` that sets `unsubscribed_at` on the record
5. Never use the email addresses from this list for transactional emails or share them with third parties

Store the email capture list in a separate table (`marketing_subscribers`) from the `users` table. These are different populations with different consent bases.

**Warning signs:**
- Email capture form has no checkbox — just an email field and a submit button
- The captured emails are stored in the `users` table or mixed with user account data
- No double opt-in confirmation email is sent
- No unsubscribe endpoint exists

**Phase to address:** Marketing homepage phase (consent flow designed before the form is built)

---

### Pitfall 8: Programmatic SEO Pages Risk Thin Content Penalties

**What goes wrong:**
The plan includes 8+ programmatic use-case pages (`/use/[slug]`) plus 3 competitor comparison pages and 3 alternative pages. If these pages are generated from a shared template with only the company/use-case name swapped in, Google's algorithms classify them as "thin content" — pages that provide little value beyond keyword targeting. Post-2025 Google core updates heavily penalize thin programmatic content.

The failure mode is not immediate — the pages may initially index and even rank. But at the next core update, traffic drops sharply and Google may de-index them. This is particularly dangerous for a new domain (torchsecret.com) where the domain authority is low: thin content will be filtered out faster than on established domains.

A secondary risk: if the competitor comparison pages (`/vs/onetimesecret`) simply repeat the competitor's marketing copy with superficial differences, the page fails user intent (users want a real comparison, not a sales pitch) AND may trigger a manual quality review.

**Why it happens:**
- Programmatic SEO is attractive: build the template once, generate many pages, capture many keywords
- The initial template looks complete (it has a heading, paragraphs, CTAs) but the content is thin
- Developers confuse "more pages" with "more SEO value"

**How to avoid:**
Each SEO page must have unique, substantive content that genuinely serves user intent:

- **Competitor comparison pages (`/vs/onetimesecret`):** Include a factual feature comparison table, genuine pro/con analysis based on actual product testing, specific differentiators with evidence (e.g., "OneTimeSecret stores server-side; Torch Secret uses client-side AES-256-GCM — here's how to verify this"). Minimum ~800 words of original content per page.
- **Alternative pages (`/alternatives/pwpush`):** Similar depth — explain the competitor's actual model, where it falls short for specific use cases, and why Torch Secret addresses those gaps.
- **Use case pages (`/use/[slug]`):** Each page should include a use-case-specific workflow, a concrete example, and possibly a snippet showing the specific flow. Different from a feature-list page.

Consider shipping 3 high-quality comparison pages rather than 8 thin use-case pages at launch. Thin pages damage domain authority for ALL pages on the domain.

**Warning signs:**
- The use-case page template has only 2-3 paragraphs that change between slugs
- Comparison pages are generated from a JSON data file with no original prose
- Pages pass Lighthouse but a human reading them would learn nothing new about the products

**Phase to address:** SEO content pages phase (content quality gate before publishing any programmatic page)

---

### Pitfall 9: Pro Feature Gate Checked at Request Time Against Stale Subscription Status

**What goes wrong:**
The `requirePlan` middleware (or equivalent) for v5.0 gates the 30-day expiration feature behind Pro status. The middleware checks subscription status from the local database. Two failure modes:

**Mode A — Stale "active" after cancellation:** A user cancels their Stripe subscription. The `customer.subscription.deleted` webhook is delayed or fails to deliver. The database still shows `status: 'active'`. The user continues to create 30-day secrets after their billing period ends. This is a revenue leak.

**Mode B — Stale "inactive" after payment:** A user upgrades. The `checkout.session.completed` webhook has not yet arrived (1-5 second delay). The user is redirected to the success page. The feature gate middleware checks the database and finds no active subscription. The 30-day expiration option does not appear. The user thinks their upgrade failed.

Both modes stem from the same root cause: trusting the local database as the source of truth for subscription status, when the actual source of truth is Stripe.

**Why it happens:**
- Checking the local database is fast (microseconds) vs. calling Stripe's API (50-200ms)
- The v4.0 pitfalls research documented Mode B (race condition) — but Mode A is equally important and less intuitive
- Developers trust webhook reliability ("Stripe retries for 3 days") without accounting for the window between cancellation and webhook delivery

**How to avoid:**
For the feature gate middleware, use a cache-aside pattern with a short TTL:

1. On webhook events (`customer.subscription.updated`, `customer.subscription.deleted`): immediately update the local DB AND clear/update the Redis subscription cache for that user
2. In `requirePlan` middleware: check Redis cache first (fast), fall back to DB if cache miss, cache result with a 5-minute TTL
3. On the success page return (with `session_id` query param): call Stripe API directly to get current subscription state, update DB and cache synchronously before showing the success UI — this handles Mode B explicitly

For Mode A (stale active after cancellation), add a secondary check: when a user creates a secret with `expiresIn: '30d'`, verify that `subscription.current_period_end > now()` in the DB before honoring the 30-day expiration. If the period has ended, cap the expiration at 7 days (the max for free accounts) and return a `402` response instructing the user to renew. Do NOT silently create a 30-day secret for a cancelled subscriber.

**Warning signs:**
- `requirePlan` middleware reads only from the local database without a cache or TTL
- No `current_period_end` check in the secret creation handler
- Success page shows subscription status without querying Stripe API directly on `session_id` param

**Phase to address:** Stripe billing phase (both the middleware implementation and the success page race condition handler)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add Stripe webhook route after `express.json()` | Simpler app.ts ordering | Signature verification fails in production (error is cryptic) | Never |
| Serve SEO pages as SPA routes from `index.html` | No new server code | Content invisible to AI crawlers; slow indexing; poor Google ranking at launch | Never for launch-critical SEO pages |
| Send all 3 onboarding emails without marketing consent checkbox | Simpler registration flow | GDPR violation for EU users; fines up to 4% annual revenue; reputational damage | Never for EU-facing app |
| Skip double opt-in for email capture form | One less friction step | Higher deliverability risk; harder to prove consent to regulators | Avoid — double opt-in is GDPR best practice |
| Generate 8 use-case pages from a minimal template | More URL surface area for SEO | Thin content penalties from Google core updates; domain authority damage | Never at launch — fewer high-quality pages beat many thin ones |
| Check subscription status from DB only in feature gate | Fast, no external API call | Stale "active" status after cancellation leaks revenue; stale "inactive" blocks paying users | Acceptable only with a Redis TTL cache + explicit success-page Stripe API sync |
| Log full Stripe webhook event objects for debugging | Easy debugging | May log user email alongside request context correlated with secretId — ZK invariant at risk | Never in production logs; use structured fields only |
| Inject JSON-LD via JS router (extending existing pattern) | Consistent code style | Invisible to AI crawlers (GPTBot, ClaudeBot, PerplexityBot) | Never for launch SEO pages |
| Store marketing email list in the `users` table | Simpler data model | Marketing consent and account consent are different legal bases; mixing them creates compliance complexity | Never |
| Add Stripe.js `script-src` to CSP "just in case" | Avoid future CSP debugging | Weakens CSP; `js.stripe.com` is a large attack surface; not needed for redirect Checkout | Never unless embedded Stripe elements are actually used |

---

## Integration Gotchas

Common mistakes when connecting Stripe billing, SEO pages, and email capture in this specific stack.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stripe hosted Checkout + CSP | Adding `script-src js.stripe.com` and `frame-src js.stripe.com` when using server-side redirect | Redirect Checkout does NOT load Stripe.js on the merchant page; no `script-src` or `frame-src` additions needed |
| Stripe webhook + `app.ts` ordering | Adding webhook route after `app.use(express.json())` (follows auth handler pattern superficially) | Webhook route BEFORE `express.json()`, same position as auth handler; update `app.ts` comment block |
| Stripe webhook + ZK invariant | Logging `userId + email` or `userId + stripeCustomerId + any Stripe event data` in same log line | Log only `{ event.type, customer }` — no email, no userId, no secretId in same payload |
| Stripe Customer metadata | Storing email, name, or other PII in metadata | Store only the internal opaque `userId` (DB ID); never email or username |
| `@better-auth/stripe` plugin | Assuming plugin handles all webhook events including `invoice.payment_failed` | Plugin handles subscription lifecycle; verify its event coverage; add custom handler for `invoice.payment_failed` if needed |
| Subscription feature gate + Redis | Checking subscription status from DB on every request | Cache subscription status in Redis with 5-minute TTL; clear on webhook events |
| SEO pages + SPA router | Routing `/vs/:competitor` and `/use/:slug` through `client/src/router.ts` | Server-render these pages as full HTML in Express; do not put them in the SPA router |
| JSON-LD + SPA router | Injecting schema markup in the JS router's per-route setup (consistent with existing meta tag pattern) | Embed JSON-LD as static `<script type="application/ld+json">` in server-rendered HTML templates |
| Email onboarding + Resend | Sending upgrade prompt email to all registered users without a marketing consent flag | Filter Resend sends by `marketing_consent: true` on the user record; only send promotional emails to opted-in users |
| Email capture form + DB schema | Storing pre-launch subscribers in the `users` table | Use a separate `marketing_subscribers` table with `consented_at`, `consent_source`, and `unsubscribed_at` columns |
| NOINDEX_PREFIXES + SEO pages | SEO pages accidentally inheriting noindex from a wildcard prefix match | Verify `/vs/`, `/alternatives/`, `/use/` are NOT in `NOINDEX_PREFIXES` in `app.ts`; confirm with `curl -I https://torchsecret.com/vs/onetimesecret | grep X-Robots` |
| Referrer-Policy: no-referrer + Stripe redirect | Stripe redirect back to success URL may lose referrer context needed for analytics attribution | Use `session_id` query param on success URL (not referrer) to identify checkout completions |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Calling Stripe API on every `requirePlan` check | 50-200ms added to every Pro feature request; Stripe rate limits hit (~100 req/s default) | Cache subscription status in Redis with 5-minute TTL; refresh on webhook events | At ~50 concurrent Pro users making rapid requests |
| Server-rendering SEO pages synchronously from a database query | First-byte latency spikes if DB is slow; pages not cacheable | Pre-render pages at deploy time as static HTML files, or cache rendered HTML in Redis with long TTL | At any meaningful search traffic |
| Storing email capture list in-process (memory) | Emails lost on server restart (Render.com restarts on each deploy) | Write to `marketing_subscribers` table immediately on form submit | Every deployment |
| Programmatic use-case pages generated dynamically from a DB query per request | Latency scales with DB query time; no cache layer | Pre-generate static HTML at build time for a finite slug set; cache-bust only on content change | At crawl-level traffic (Googlebot may hit many slugs rapidly) |

---

## Security Mistakes

Domain-specific security issues specific to v5.0 additions.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Stripe secret key (`STRIPE_SECRET_KEY`) bundled in Vite client build | All users can see the key in browser DevTools; anyone can make Stripe API calls as the merchant | Stripe secret key server-only (`server/src/config/env.ts`); only publishable key on client (and only if Stripe.js is used) |
| Stripe webhook endpoint without `express.raw()` before `express.json()` | Forged webhooks accepted (signature verification silently fails, not throws) | Confirm `constructEvent()` throws on invalid signature — test with a wrong secret in dev |
| Marketing email consent stored without timestamp | Cannot prove consent to regulators; invalid consent record | Store `{ email, consented_at: new Date(), consent_text: '...' }` — the exact consent language is part of the legal record |
| SEO comparison page copies competitor screenshots or content | Copyright infringement and DMCA risk | Use only factual feature claims; cite public documentation; no screenshots of competitor UIs without permission |
| Stripe Customer object metadata contains email + any field correlatable with secretId | Violates ZK invariant via Stripe's data — Stripe's privacy policy allows them to share this with partners | Metadata: `{ userId: db_user_id }` only — never email, never secretId |
| GDPR double opt-in email uses a shared unsubscribe token | Token reuse allows one subscriber to unsubscribe another | Per-subscriber signed token: `crypto.createHmac('sha256', env.UNSUBSCRIBE_SECRET).update(email).digest('hex')` |
| Programmatic SEO pages served with user-controlled slug without sanitization | Path traversal or HTML injection in page content | Validate slug against an allowlist of known slugs; never interpolate raw slug into HTML |

---

## UX Pitfalls

User experience mistakes specific to adding billing and marketing pages to an existing privacy-first tool.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Pricing page uses industry-standard "Contact Sales" for Pro tier | Friction kills self-serve conversion; users expect instant upgrade | Stripe Checkout redirect on "Upgrade to Pro" button — no contact form for $9/month |
| Success page queries local DB before webhook arrives | User sees "No active subscription" for 5 seconds after paying | Query Stripe API directly on `?session_id=...` return URL before rendering success UI |
| Subscription cancelled but access revoked immediately | User paid for the billing period; expects access until `current_period_end` | Set `cancel_at_period_end: true` in Stripe; show "Your Pro access ends on [date]" in settings |
| Pro feature upsell shown on the secret creation form to anonymous users | Interrupts the zero-friction anonymous flow — the core value proposition | Show upsell only after successful creation (on confirmation page), never during creation |
| Marketing homepage email capture with no confirmation that email was received | Users resubmit the form; you get duplicates; users lose trust | Show inline confirmation: "Check your inbox — we sent a confirmation." Prevent duplicate submissions with a debounce |
| Competitor comparison page is clearly written to rank, not to help | Users distrust biased comparison; converts poorly | Include genuine trade-offs; Torch Secret is NOT the right tool for every user; say so |
| Privacy page says "GDPR-compliant" but email capture form has no consent checkbox | Users (especially EU users) notice the contradiction | Audit every data collection touchpoint before launch; the marketing homepage form is a data collection touchpoint |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Stripe billing:** Checkout flow works end-to-end in test mode, but `STRIPE_WEBHOOK_SECRET` in production is the live secret, not the CLI test secret — verify `stripe listen --forward-to` uses test secret and production uses the dashboard webhook secret
- [ ] **Stripe webhook route ordering:** The Stripe webhook handler is registered in `app.ts`, but its position is after `express.json()` — verify by checking `app.ts` middleware comment block step numbers
- [ ] **Pro feature gate:** The 30-day expiration option appears in the UI for Pro users, but `requirePlan` middleware checks only the DB without cache — verify the subscription status check under Redis cache miss vs. cache hit
- [ ] **SEO pages:** `/vs/onetimesecret` returns a 200 from the Express server, but `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` returns nothing — the content is JS-rendered and invisible to crawlers
- [ ] **JSON-LD schema:** Google Rich Results Test shows the schema is valid, but the test uses a rendered version — run the test with "Fetch as Google" (raw HTML) to confirm the JSON-LD is in the initial HTML response
- [ ] **Email onboarding:** The 3-email Resend sequence sends successfully in development, but no marketing consent flag is checked — verify the code filters sends by `user.marketing_consent === true` for emails 2 and 3
- [ ] **Email capture form:** The form stores emails, but there is no unsubscribe endpoint — verify `GET /unsubscribe?token=...` sets `unsubscribed_at` and Resend respects it
- [ ] **GDPR double opt-in:** Confirmation email is sent, but clicking the confirmation link sets `confirmed: true` in a session cookie, not in the DB — verify the record in `marketing_subscribers` has `confirmed_at` populated
- [ ] **CSP + Stripe:** No new CSP violations appear in browser DevTools after the Checkout redirect flow — check the Network tab for any `q.stripe.com` requests blocked by CSP
- [ ] **Competitor comparison pages:** Pages are published, but Semrush/Ahrefs shows zero indexed pages 2 weeks after launch — verify the pages are server-rendered HTML (not SPA routes) and are in the sitemap with `changefreq: weekly`
- [ ] **NOINDEX\_PREFIXES audit:** After adding `/pricing`, `/vs/`, and `/use/` routes, confirm they are NOT accidentally matched by any prefix in `NOINDEX_PREFIXES` in `app.ts`
- [ ] **ZK invariant in INVARIANTS.md:** After Stripe phase ships, confirm the Stripe webhook handler and email capture table have been added to the enforcement table in `.planning/INVARIANTS.md`

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Stripe webhook after `express.json()` — forged webhook events accepted | MEDIUM | Audit Stripe webhook logs for suspicious events; add idempotency check to prevent replay of any forged events already processed; deploy fix immediately (mount before `express.json()`); rotate `STRIPE_WEBHOOK_SECRET` |
| GDPR consent missing from email capture — regulatory complaint | HIGH | Stop all marketing sends immediately; delete records without consent; redesign form with proper consent; notify affected users if consent reconstruction is impossible; consult legal counsel |
| SEO pages served as SPA routes — not indexed after 4 weeks | MEDIUM | Convert pages to server-rendered HTML; resubmit to Google Search Console; expect 2-4 weeks for re-indexing |
| Thin content penalty on programmatic pages — traffic drop after core update | MEDIUM | Identify affected pages in Search Console; either beef up content to meet quality bar or noindex the pages until they are improved; do not delete pages (404s create new indexing latency) |
| Subscription status stale — cancelled users retain Pro access | LOW | Query Stripe API to identify active vs. cancelled subscriptions; sync DB to Stripe source of truth; implement Redis cache with short TTL going forward |
| Stripe secret key in client bundle (Vite config error) | HIGH | Immediately rotate the leaked key in Stripe dashboard; audit all API calls made with the leaked key; deploy fix (move key to server-only env); notify affected users if any unauthorized charges occurred |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stripe billing ZK invariant surface (1) | Stripe billing phase | INVARIANTS.md updated before any webhook handler code is written; log audit: no email in log lines alongside user context |
| Stripe CSP for redirect Checkout (2) | Stripe billing phase | No CSP violations in browser DevTools after Checkout redirect flow; no `js.stripe.com` in `script-src` |
| Stripe webhook ordering in `app.ts` (3) | Stripe billing phase | `app.ts` middleware comment block updated; send forged webhook (wrong secret) — expect 400 rejection |
| SPA-rendered SEO pages invisible to crawlers (4) | SEO content pages phase | `curl https://torchsecret.com/vs/onetimesecret | grep '<h1>'` returns page content in raw HTML |
| JS-injected JSON-LD invisible to AI crawlers (5) | SEO content pages phase | `curl https://torchsecret.com/vs/onetimesecret | grep 'application/ld+json'` returns the schema block |
| GDPR boundary for onboarding emails (6) | Email onboarding phase | Marketing consent flag in DB checked before each Resend send for emails 2 and 3; unsubscribe link present |
| GDPR consent for email capture form (7) | Marketing homepage phase | Form has unchecked consent checkbox; consent record stored with timestamp in `marketing_subscribers` table |
| Thin content SEO penalty (8) | SEO content pages phase | Manual review: each page has 800+ words of original substantive content; no template-only pages published |
| Stale subscription status in Pro feature gate (9) | Stripe billing phase | Redis cache confirmed present; success page queries Stripe API directly on `?session_id=`; cancellation test shows access retained until `current_period_end` |

---

## Sources

### Stripe CSP and Webhook
- [Stripe Security Guide](https://docs.stripe.com/security) — CSP directives for different Stripe integration modes (HIGH confidence, official Stripe docs)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature) — raw body requirement, `constructEvent` pattern (HIGH confidence)
- [stripe-js GitHub issue #127: q.stripe.com CSP connect-src](https://github.com/stripe/stripe-js/issues/127) — telemetry domain CSP violation (MEDIUM confidence)
- [Fixing CSP with Stripe.js web workers](https://medium.com/@tempmailwithpassword/fixing-content-security-policy-problems-with-javascript-web-workers-and-stripe-js-0c6306089e89) — `worker-src: blob:` requirement (MEDIUM confidence)
- [csplite.com Stripe CSP reference](https://csplite.com/csp/svc155/) — full directive list for Stripe services (MEDIUM confidence)

### SEO and Crawlers
- [Google: Generate Structured Data with JavaScript](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript) — JS-injected JSON-LD timing requirements (HIGH confidence, official Google docs)
- [Google: JavaScript SEO Basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) — two-wave rendering, deferred indexing (HIGH confidence, official Google docs)
- [Why SPAs Still Struggle with SEO (2025)](https://devtechinsights.com/spas-seo-challenges-2025/) — crawl budget, render queue delays (MEDIUM confidence)
- [AI Search Optimization: Structured Data Accessibility](https://www.searchenginejournal.com/ai-search-optimization-make-your-structured-data-accessible/537843/) — AI crawlers cannot execute JS (MEDIUM confidence)
- [Avoiding thin content penalties](https://www.semrush.com/blog/thin-content/) — what constitutes thin content (MEDIUM confidence)
- [JSON-LD in SPA: GTM vs SSR visibility to AI crawlers](https://semking.com/json-ld-google-tag-manager-no-ssr-invisible-ai-crawlers/) — AI crawlers miss JS-injected JSON-LD (MEDIUM confidence)

### GDPR and Email
- [GDPR Transactional vs Marketing Email distinction (TermsFeed)](https://www.termsfeed.com/blog/gdpr-transactional-emails/) — legal classification of onboarding emails (HIGH confidence)
- [MailerSend: Transactional vs Marketing Emails](https://www.mailersend.com/help/transactional-email-vs-marketing-email) — classification rules and examples (MEDIUM confidence)
- [GDPR Email Compliance Guide 2025 (Omnisend)](https://www.omnisend.com/blog/gdpr-video-gdpr-ready-email-marketing-automation-consent/) — double opt-in, consent records, unsubscribe requirements (HIGH confidence)
- [Landing Page GDPR Compliance (Apexure)](https://www.apexure.com/blog/landing-page-compliance-everything-about-gdpr-and-more) — email capture form requirements (MEDIUM confidence)
- [EU Digital Consent Requirements 2026 (Mailbird)](https://www.getmailbird.com/eu-digital-consent-email-tracking-requirements/) — current enforcement trends (MEDIUM confidence)

### Stripe Billing Race Conditions
- [Stripe: Using Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) — webhook event order, timing (HIGH confidence, official Stripe docs)
- [Pedro Alonso: Stripe Webhooks Race Conditions](https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/) — checkout/webhook race condition pattern (MEDIUM confidence)
- [Better Auth Stripe plugin](https://www.better-auth.com/docs/plugins/stripe) — plugin's race condition handling via modified `successUrl` (HIGH confidence, official Better Auth docs)
- [Billing webhook race condition guide (excessivecoding.com)](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide) — cache-aside pattern, polling fallback (MEDIUM confidence)

---
*Pitfalls research for: Torch Secret v5.0 Product Launch (Stripe billing, marketing SEO, email)*
*Researched: 2026-02-22*
*Supersedes: Previous PITFALLS.md covering v4.0 OAuth, Stripe basics, PostHog analytics pitfalls*
