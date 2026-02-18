# Pitfalls Research: Auth, Payments, and Analytics on a Zero-Knowledge App

**Domain:** Adding OAuth authentication, Stripe subscriptions, and PostHog analytics to an existing zero-knowledge anonymous-first secret sharing application
**Researched:** 2026-02-18
**Confidence:** HIGH for OAuth/session pitfalls, Stripe webhook pitfalls, CSP/PostHog integration; MEDIUM for zero-knowledge erosion patterns, anonymous-to-account transition, schema migration strategies
**Scope:** Pitfalls specific to ADDING accounts, payments, and analytics to SecureShare -- an existing Express 5 + Vanilla TS SPA with strict nonce-based CSP, zero-knowledge AES-256-GCM encryption, Drizzle ORM + PostgreSQL, Redis rate limiting, and a production anonymity guarantee

---

## Critical Pitfalls

Mistakes that violate the zero-knowledge guarantee, create security vulnerabilities, or require rewrites.

### Pitfall 1: Missing or Improperly Validated OAuth State Parameter Enables Account Hijacking

**What goes wrong:**
When the OAuth callback (`/auth/callback`) does not validate that the returned `state` parameter matches the value stored before the authorization redirect, attackers can forge authentication requests. The attack: an attacker initiates an OAuth flow with their own account, captures the authorization code, tricks a victim's browser into completing the callback with the attacker's code, and links the attacker's OAuth account to the victim's application session. The victim then unknowingly operates inside the attacker's account context.

This is not a theoretical concern. Slack disclosed a real vulnerability on HackerOne where the state parameter was missing on Google OAuth, allowing session hijacking. RFC 9700 (OAuth 2.0 Security Best Current Practice, January 2025) mandates one-time CSRF tokens in state, securely bound to the user agent.

**Why it happens:**
- Tutorials show the minimum viable OAuth flow and omit state validation
- The callback "works" without state validation -- the failure mode is invisible until attacked
- Developers conflate PKCE (which protects code interception) with CSRF protection (which state provides) -- they are NOT interchangeable

**How to avoid:**
Generate a cryptographically secure random value before the authorization redirect, store it in a server-side session (not a cookie that JavaScript can read), include it as `state` in the authorization URL, and validate it on callback before processing the tokens:

```typescript
// In GET /auth/:provider -- before redirect
const stateToken = crypto.randomBytes(32).toString('hex');
req.session.oauthState = stateToken; // server-side session only
const authUrl = buildOAuthUrl({ state: stateToken });
res.redirect(authUrl);

// In GET /auth/callback -- before accepting tokens
if (!req.query.state || req.query.state !== req.session.oauthState) {
  res.status(403).json({ error: 'invalid_state' });
  return;
}
delete req.session.oauthState; // one-time use
```

Use `express-session` with a strong `secret` stored in an environment variable. Never store state in `localStorage` (writable by XSS) or in a query parameter (visible in logs and referrers).

**Warning signs:**
- OAuth callback does not check `req.query.state`
- State is stored in a cookie without `HttpOnly` flag
- State is a predictable value (timestamp, user ID)

**Phase to address:** Auth foundation phase

---

### Pitfall 2: Storing Session Tokens in localStorage Exposes Them to XSS

**What goes wrong:**
Storing session tokens, JWTs, or OAuth access tokens in `localStorage` or `sessionStorage` makes them readable by any JavaScript executing on the page. If a third-party script (analytics, ads, injected via a compromised CDN) runs in the same origin, it can exfiltrate all stored tokens. For SecureShare, which handles sensitive secrets, this is especially damaging: a compromised token means an attacker can act as an authenticated user and create/view secrets associated with their account.

OWASP explicitly states: "Do not store session identifiers in local storage as the data is always accessible by JavaScript. Cookies can mitigate this risk using the httpOnly flag."

**Why it happens:**
- `localStorage` is simple, synchronous, and works without server coordination
- JWT tutorials commonly use `localStorage.setItem('token', jwt)` as the simplest implementation
- Developers incorrectly believe that because SecureShare has a tight CSP, XSS is impossible -- but CSP failures (misconfigured nonce, injected inline styles loading scripts) can still occur

**How to avoid:**
Use `HttpOnly; Secure; SameSite=Strict` cookies for session tokens:

```typescript
res.cookie('session', sessionId, {
  httpOnly: true,   // not readable by JavaScript
  secure: true,     // HTTPS only
  sameSite: 'strict', // no cross-origin sending -- also provides CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});
```

`SameSite=Strict` provides CSRF protection for same-domain requests. If cross-domain requests are needed (unlikely for SecureShare), use `SameSite=Lax` combined with a synchronizer token pattern.

Store session data server-side (Redis or PostgreSQL). The cookie carries only an opaque session ID, never the actual user data.

**Warning signs:**
- `localStorage.setItem('token', ...)` anywhere in the codebase
- JWT decoded and stored client-side
- Auth state persisted via `window.sessionStorage`

**Phase to address:** Auth foundation phase

---

### Pitfall 3: Zero-Knowledge Erosion via User-Secret Association Logging

**What goes wrong:**
When user accounts are added, application logs, analytics events, or database audit trails may accidentally record which user ID created which secret ID. This directly violates the zero-knowledge guarantee: a server-side log entry of `userId=abc123 created secretId=xyz789` means the server now knows which user is associated with each secret, and by extension, which user sent what to whom.

The current logger already redacts secret IDs from URL paths. But when auth is added, new log patterns emerge:

```typescript
// DANGEROUS: Associates user with secret in logs
logger.info({ userId: req.user.id, secretId: secret.id }, 'Secret created');

// DANGEROUS: PostHog event with both user identity and secret creation
posthog.capture({ distinctId: userId, event: 'secret_created', properties: { secretId } });

// DANGEROUS: Database audit table linking users to secrets
// INSERT INTO audit_log (user_id, action, resource_id) VALUES (?, 'create_secret', ?)
```

Once this association exists anywhere -- logs, analytics, database -- it cannot be "un-leaked." The zero-knowledge guarantee is permanently broken for all secrets created while the logging existed.

**Why it happens:**
- Standard "good practice" logging includes user context with every action
- Analytics tools capture both user identity and action properties by default
- Audit tables for compliance seem like a good idea but conflict with zero-knowledge
- The association only becomes a problem later (subpoena, breach) -- developers do not see immediate harm

**How to avoid:**
Establish a hard rule: **no system log, analytics event, or database record may contain both a user identifier AND a secret identifier in the same record.** Enforce this through code review and automated testing:

```typescript
// SAFE: Log the action category, never the specific secret ID
logger.info({ userId: req.user.id }, 'Secret created'); // no secretId

// SAFE: Track event count without secret ID
posthog.capture({ distinctId: userId, event: 'secret_created' }); // no secretId property

// SAFE: Anonymous aggregate statistics only
// UPDATE user_stats SET secrets_created = secrets_created + 1 WHERE user_id = ?
```

Add a lint rule or test that scans for any code path that reads both `req.user.id` and `secret.id` in the same scope and logs or stores both.

The `secrets` table should NOT have a `created_by_user_id` column. This is the central zero-knowledge invariant for the accounts feature.

**Warning signs:**
- Log lines that contain both user context and secret path
- PostHog events with `secretId` in properties
- Database columns like `secrets.created_by` or `secrets.owner_id`
- Any JOIN between `users` and `secrets` tables that is persisted

**Phase to address:** Auth foundation phase (establish the invariant before any auth code is written)

---

### Pitfall 4: Analytics Scripts Capture the Encryption Key from the URL Fragment

**What goes wrong:**
SecureShare's encryption key lives in the URL fragment: `https://example.com/secret/xyz#AES-KEY-HERE`. The URL fragment is NOT sent to servers by HTTP spec, which is the entire basis of the zero-knowledge model. However, client-side analytics libraries (PostHog, Google Analytics, Mixpanel) running in the browser CAN read `window.location.href` which includes the fragment.

PostHog's JavaScript library captures `$current_url` as a property of every event by default. Without configuration, `posthog.capture('page_view')` sends the full URL including the `#AES-KEY-HERE` fragment to PostHog's servers. This completely destroys the zero-knowledge guarantee for every user whose secret reveal URL is captured.

Research confirmed: PostHog does capture `$current_url` including hash fragments by default. The `sanitize_properties` option exists specifically for this scenario (PostHog GitHub issue #7118 documents the masking approach).

**Why it happens:**
- Analytics documentation shows `posthog.init(key, { api_host })` with no mention of URL sanitization
- URL fragment exclusion from server requests gives a false sense of security -- it only protects against HTTP, not JavaScript
- The encryption key is Base64 and looks like a typical hash fragment to developers reviewing analytics configs

**How to avoid:**
Configure PostHog to strip the URL fragment from ALL captured properties at initialization:

```typescript
posthog.init(POSTHOG_KEY, {
  api_host: 'https://app.posthog.com',
  sanitize_properties: (properties) => {
    // Strip URL fragment (contains encryption key on /secret/:id pages)
    if (properties.$current_url) {
      properties.$current_url = (properties.$current_url as string).split('#')[0];
    }
    if (properties.$referrer) {
      properties.$referrer = (properties.$referrer as string).split('#')[0];
    }
    if (properties.$pathname) {
      // Also strip secret IDs from path
      properties.$pathname = (properties.$pathname as string).replace(
        /\/secret\/[A-Za-z0-9_-]+/,
        '/secret/[redacted]',
      );
    }
    return properties;
  },
  capture_pageview: false, // Manually capture pageviews after sanitization
  autocapture: false,      // Prevent autocapture from leaking DOM text/attributes
});
```

Additionally, set `autocapture: false` because PostHog's autocapture can capture text content, input values, and element attributes that may contain sensitive data.

**Warning signs:**
- PostHog initialized without `sanitize_properties`
- PostHog events visible in browser DevTools Network tab showing `$current_url` with `#` fragment
- `autocapture: true` (the default) on any page that handles encryption keys

**Phase to address:** Analytics integration phase

---

### Pitfall 5: CSP Violations When Adding Analytics Scripts

**What goes wrong:**
SecureShare's CSP is strict: `script-src 'self' 'nonce-<random>'`. There is no `'unsafe-inline'`, no `'unsafe-eval'`, and no external domains in `connect-src`. Adding PostHog requires:
1. Loading the PostHog script (needs a `<script>` with the nonce OR needs the domain in `script-src`)
2. PostHog making XHR/fetch requests to `app.posthog.com` (needs `connect-src`)
3. PostHog loading styles for its toolbar (needs `style-src` for `*.posthog.com`)

If any of these are not added to the CSP, PostHog silently fails -- no events are captured, no error is shown to the user, no JavaScript exception is thrown. The analytics integration appears to work in development (where CSP is often disabled) but fails silently in production.

Additionally, PostHog's toolbar feature historically used dynamic code evaluation, which requires `unsafe-eval` and is blocked by the strict CSP. As of PostHog's fix for issue #1918, event reporting works without `unsafe-eval` -- only the toolbar fails to load. Do NOT add `unsafe-eval` to the CSP to accommodate the toolbar.

**Why it happens:**
- The CSP was designed before analytics was in scope
- Analytics SDKs are typically added to apps with permissive CSPs
- Silent failures mean the misconfiguration is not caught until a review of analytics dashboards shows no data
- Vite's dev server does not enforce CSP in development

**How to avoid:**
Add PostHog domains to the helmet CSP configuration:

```typescript
// In createHelmetMiddleware():
contentSecurityPolicy: {
  directives: {
    scriptSrc: [
      "'self'",
      (_req, res) => `'nonce-${(res as Response).locals.cspNonce}'`,
      'https://app.posthog.com',  // PostHog script (remove if self-hosting)
    ],
    connectSrc: [
      "'self'",
      'https://app.posthog.com',  // PostHog event ingestion
    ],
    styleSrc: [
      "'self'",
      (_req, res) => `'nonce-${(res as Response).locals.cspNonce}'`,
      'https://app.posthog.com',  // PostHog toolbar styles
    ],
  },
}
```

Write a test that verifies PostHog events are received after initialization with the production CSP active. Use the PostHog `loaded` callback to confirm initialization succeeded.

Consider self-hosting PostHog (`https://analytics.yourdomain.com`) to keep all analytics traffic under `'self'`, eliminating the need for external domains in CSP.

**Warning signs:**
- Browser DevTools shows CSP violation for `app.posthog.com`
- PostHog dashboard shows zero events despite the SDK being initialized
- `connect-src` does not include PostHog's ingestion endpoint

**Phase to address:** Analytics integration phase

---

### Pitfall 6: Stripe Webhook Handler Without Idempotency Causes Double-Provisioning

**What goes wrong:**
Stripe retries webhook delivery for up to 3 days with exponential backoff when the endpoint does not return a 2xx. If the webhook handler succeeds in provisioning a subscription (granting premium access) but then crashes before returning 200, Stripe retries and the handler runs again -- provisioning the subscription a second time. This can result in duplicate credits, duplicate welcome emails, or access being granted even after a subscription lapses because the cancel event was processed twice with conflicting results.

The 5-minute signature verification window compounds this: you cannot buffer all webhooks, process them later, and verify signatures -- signature verification must happen immediately, so a persist-then-process approach does not work.

**Why it happens:**
- Stripe's documentation mentions idempotency but does not make it a required step in quickstart examples
- The failure mode only manifests under network instability or server restarts during processing
- Developers test with Stripe CLI's webhook forwarding, which delivers each event exactly once

**How to avoid:**
Store processed Stripe event IDs in the database and skip re-processing:

```typescript
// In the webhook handler, after signature verification:
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

// Check if already processed
const existing = await db
  .select()
  .from(stripeEvents)
  .where(eq(stripeEvents.stripeEventId, event.id));

if (existing.length > 0) {
  res.status(200).json({ received: true }); // idempotent -- already handled
  return;
}

// Mark as processing before handling (prevents concurrent duplicates)
await db.insert(stripeEvents).values({
  stripeEventId: event.id,
  type: event.type,
  processedAt: new Date(),
});

// Now process the event
await handleStripeEvent(event);
```

Also handle out-of-order delivery: Stripe does not guarantee event order. `customer.subscription.updated` can arrive before `customer.subscription.created`. Query Stripe's API directly for the current subscription state rather than applying state transitions based solely on event order.

**Warning signs:**
- Webhook handler does not check for previously processed event IDs
- User subscriptions show as active after cancellation (or cancelled after payment)
- Duplicate emails sent on subscription creation

**Phase to address:** Payments/Stripe integration phase

---

### Pitfall 7: Not Verifying Stripe Webhook Signatures Opens the Endpoint to Forgery

**What goes wrong:**
The Stripe webhook endpoint (`POST /webhooks/stripe`) must grant premium access, revoke access, or process refunds based on incoming events. Without signature verification, anyone who knows the URL can send a forged `checkout.session.completed` event to grant themselves premium access for free.

Stripe provides a webhook signing secret (`whsec_...`) for each endpoint. Verification requires the raw request body -- if Express's JSON middleware runs first and parses the body, the raw bytes are gone and signature verification fails with a cryptic error about the signature not matching.

**Why it happens:**
- Most Express tutorials apply `express.json()` globally before all routes
- The error from mismatched signatures ("No signatures found matching the expected signature for payload") does not explain that the body was pre-parsed
- Developers test with Stripe CLI locally, which generates valid signatures, but production endpoints skip verification

**How to avoid:**
Register the webhook route BEFORE the global JSON middleware, using `express.raw()` for that specific route:

```typescript
// In app.ts -- BEFORE app.use(express.json())
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }), // raw body for signature verification
  stripeWebhookHandler,
);

// AFTER the webhook route
app.use(express.json()); // global JSON parsing for all other routes

// In the webhook handler:
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,                      // raw Buffer, not parsed JSON
      sig as string,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }
  // handle event...
}
```

**Warning signs:**
- `stripe.webhooks.constructEvent` throws "No signatures found"
- `express.json()` middleware registered globally before the webhook route
- `STRIPE_WEBHOOK_SECRET` not in `.env.example`

**Phase to address:** Payments/Stripe integration phase

---

### Pitfall 8: Race Condition Between Stripe Checkout Return and Webhook Delivery

**What goes wrong:**
When a user completes Stripe Checkout and is redirected to the success page (`/billing?success=true`), the application immediately queries its own database to show subscription status. However, the Stripe webhook (`checkout.session.completed`) arrives asynchronously 1-5 seconds after the redirect. The database shows the user has no subscription, the success page displays a confusing "no active plan" state, and the user assumes payment failed even though they were charged.

**Why it happens:**
- The HTTP redirect from Stripe and the webhook delivery are independent asynchronous events
- Developers design the success page to query local state, not Stripe's API
- The race condition only manifests under normal operation -- it is not a bug state

**How to avoid:**
On the checkout success redirect, fetch subscription status directly from Stripe's API (not the local database) and immediately update the database synchronously before rendering the success page:

```typescript
// GET /billing?session_id=cs_...
if (req.query.session_id) {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id as string, {
    expand: ['subscription'],
  });
  if (session.payment_status === 'paid' && session.subscription) {
    // Immediately sync to database -- don't wait for webhook
    await syncSubscriptionToDatabase(session.subscription as Stripe.Subscription, req.user.id);
  }
}
```

Use a polling fallback: if direct sync fails (Stripe API unavailable), poll the local database for up to 10 seconds before showing a "processing" state with a manual refresh option.

**Warning signs:**
- Success page queries only the local database
- No `session_id` query parameter handling on the return URL
- User reports showing "no subscription" immediately after successful checkout

**Phase to address:** Payments/Stripe integration phase

---

### Pitfall 9: Subscription Lapse Silent Failure -- No `invoice.payment_failed` Handler

**What goes wrong:**
Stripe does not automatically cancel subscriptions on the first failed payment. Instead, it sends `invoice.payment_failed` and retries over several days per the Dunning schedule. If the application has no handler for this event, subscriptions stay active in the local database long after Stripe considers them delinquent (`past_due` status). Users who stopped paying continue to have premium access for days or weeks.

When the subscription eventually reaches `canceled` status and `customer.subscription.deleted` fires, access is revoked suddenly and without warning -- frustrating users who may have updated their payment method during the retry period.

**Why it happens:**
- Most tutorials show only the "happy path" (`checkout.session.completed`)
- The unhappy path (`invoice.payment_failed`) requires more UI (dunning emails, payment update flow)
- Payment failures are rare in development testing

**How to avoid:**
Handle all subscription lifecycle events explicitly. The minimum required set:

```typescript
switch (event.type) {
  case 'checkout.session.completed':
    await activateSubscription(event.data.object);
    break;
  case 'invoice.paid':
    await renewSubscription(event.data.object);
    break;
  case 'invoice.payment_failed':
    await markSubscriptionPastDue(event.data.object);
    await sendPaymentFailedEmail(event.data.object.customer_email ?? '');
    break;
  case 'customer.subscription.updated':
    await syncSubscriptionStatus(event.data.object);
    break;
  case 'customer.subscription.deleted':
    await deactivateSubscription(event.data.object);
    break;
  default:
    logger.warn({ type: event.type }, 'Unhandled Stripe webhook event');
}
```

**Warning signs:**
- Webhook handler only handles `checkout.session.completed`
- No `invoice.payment_failed` or `customer.subscription.deleted` handling
- Users with `past_due` Stripe subscriptions still have premium access

**Phase to address:** Payments/Stripe integration phase

---

### Pitfall 10: Rate Limit Reduction Breaks Legitimate Existing Usage Patterns

**What goes wrong:**
The current anonymous rate limit is 10 secrets/hour per IP. If v4.0 tightens this for anonymous users (e.g., to 3/hour) while giving account users higher limits, legitimate workflows that rely on the current limit break silently. Examples: CI/CD pipelines that rotate secrets hourly, developers who share 5-6 credentials at a time during onboarding, or teams that use SecureShare for daily secret distribution.

Since rate limits are enforced per IP via Redis with a 1-hour rolling window, existing counters persist after deployment. A user who has already created 7 secrets in the current window suddenly gets a 429 on request 4 under the new limit, with no explanation for why the limit changed.

**Why it happens:**
- Rate limit changes take effect immediately without a grace period
- Existing Redis counters from the old limit remain in place
- The current error message ("Too many secrets created") does not indicate the new limit

**How to avoid:**
Do not lower the anonymous rate limit without a plan:

1. **Staged rollout:** Keep anonymous limit at 10/hour for 30 days after account launch, then reduce to 3/hour. Announce the change in the UI.
2. **Transparent error messages:** Include the new limit in the 429 response:

```typescript
message: {
  error: 'rate_limited',
  message: 'Anonymous users can create 3 secrets per hour. Sign in for higher limits.',
  limit: 3,
  upgrade_url: '/login',
},
```

3. **Version the Redis key prefix when changing limits:** Use `rl:create:v2:{ip}` instead of `rl:create:{ip}`. Old keys with the v1 prefix expire naturally, preventing users from being double-counted against old and new limits simultaneously.

4. **Never lower limits in a breaking way without a deprecation notice**, even for an anonymous-only feature.

**Warning signs:**
- Rate limit changes deploy simultaneously with account launch
- No UI indication that anonymous limits changed
- Redis keys use same prefix as old limits (no version isolation)

**Phase to address:** Auth foundation phase (define new rate limit strategy) and rate limiting phase

---

### Pitfall 11: Anonymous-to-Account Transition Creates Implicit Secret Association

**What goes wrong:**
If the application allows users to "claim" their previously anonymous secrets after creating an account, this creates exactly the kind of user-secret association that violates the zero-knowledge model. To claim a secret, the application must know which secrets the user previously created. The only way to know this is to have recorded it at creation time -- which requires logging user identity (IP address, session, fingerprint) alongside the secret, contradicting anonymous-first design.

Even a "soft" solution -- storing a local-storage token at creation time that maps to secrets -- creates a server-side association record when the claim is made: `userId + secretId` in the same database write.

**Why it happens:**
- The feature seems user-friendly: "Don't lose your history when you sign up"
- Developers implement the obvious solution (store a token client-side, send it on claim) without recognizing it creates the forbidden association server-side
- Product requirements often ask for this feature without recognizing the privacy implication

**How to avoid:**
**Do not implement "claim anonymous secrets" for v4.0.** The correct zero-knowledge-preserving design is:

1. Secrets created while anonymous remain anonymous forever. There is no retroactive association.
2. After account creation, new secrets are tracked under the account by incrementing a counter, NOT by storing secret IDs.
3. No migration of pre-account secrets into the account view.

If account holders want a "my secrets" dashboard, it shows only secrets created after account creation, and even then, only the creation timestamp and expiration -- never the secret ID, which would allow server-side association with plaintext.

Document this as a deliberate design decision in the UI: "Secrets you created before signing in remain private. We have no way to associate them with your account, and that's by design."

**Warning signs:**
- Any feature that allows looking up secrets by user identity
- `secrets` table gains a `created_by_user_id` column
- "Import anonymous secrets" or "claim history" feature in the roadmap

**Phase to address:** Auth foundation phase (architecture review before coding)

---

### Pitfall 12: OAuth Redirect URI Validation Too Permissive Enables Token Theft

**What goes wrong:**
OAuth providers (Google, GitHub) validate that the redirect URI in the authorization request exactly matches a pre-registered URI. If the application registers `https://app.example.com/auth/callback` but passes query parameters in the redirect URI (e.g., `?next=/dashboard`), provider validation fails because the URI with query params no longer matches the registered URI exactly. Developers then either register multiple URIs or relax validation, creating attack surface.

GitHub performs exact match. Google performs exact match. Neither accepts partial path or query parameter wildcards for server-side apps. An attacker who can modify the redirect URI in transit can redirect the authorization code to an attacker-controlled endpoint.

**Why it happens:**
- Developers add `?next=...` to `redirect_uri` to preserve post-login destination
- The `next` or `state` parameter is conflated: state is used for both CSRF protection AND destination URL
- Provider documentation does not make it obvious that query parameters break exact match

**How to avoid:**
Register the exact callback URI with NO query parameters: `https://app.example.com/auth/callback`. Store the post-login destination separately in the session state, not in the redirect URI:

```typescript
// Store destination in session, not in redirect_uri
req.session.postLoginRedirect = req.query.next as string || '/dashboard';
const authUrl = buildOAuthUrl({
  redirect_uri: 'https://app.example.com/auth/callback', // exact, no query params
  state: stateToken,
});

// In callback: read destination from session after validating state
const destination = req.session.postLoginRedirect || '/dashboard';
delete req.session.postLoginRedirect;
// Validate destination is internal before redirecting
if (!destination.startsWith('/')) {
  res.redirect('/dashboard'); // block open redirect
  return;
}
res.redirect(destination);
```

Validate the post-login redirect destination against an allowlist of internal paths to prevent open redirect vulnerabilities.

**Warning signs:**
- `redirect_uri` includes query parameters or dynamic path segments
- Post-login destination URL passed via `redirect_uri` rather than session
- Multiple provider callback URLs registered including query-parameter variants

**Phase to address:** Auth foundation phase

---

### Pitfall 13: Session Fixation on Login -- Old Session ID Persists After Authentication

**What goes wrong:**
If the application does not regenerate the session ID when a user authenticates, an attacker who obtained a pre-authentication session ID (via a different vector) can "fix" that session ID in the victim's browser, then wait for the victim to log in. After authentication, the session is now valid (associated with the authenticated user) and the attacker uses the pre-known session ID to access the victim's account.

`express-session` does NOT automatically regenerate the session on login. The developer must call `req.session.regenerate()` explicitly.

**Why it happens:**
- Session regeneration is not automatic in Express -- it is an easy-to-miss one-liner
- Developers test authentication but do not test the pre/post-auth session ID change
- The vulnerability requires an existing session ID leak to exploit -- which makes it seem unlikely but is a defense-in-depth requirement

**How to avoid:**
Always call `req.session.regenerate()` before setting authenticated user data on the session:

```typescript
// In the OAuth callback, after validating state and exchanging code for tokens:
await new Promise<void>((resolve, reject) => {
  req.session.regenerate((err) => {  // creates a new session ID
    if (err) reject(err);
    else resolve();
  });
});
// Now safe to set user data on the new session
req.session.userId = user.id;
req.session.authenticated = true;
```

**Warning signs:**
- `req.session.regenerate()` not called anywhere in the auth callback handler
- Session ID is the same before and after login (check browser cookies in DevTools)

**Phase to address:** Auth foundation phase

---

### Pitfall 14: Timing Attack Reveals Valid Email Addresses During Login

**What goes wrong:**
If the login endpoint responds faster for non-existent email addresses than for existing ones (because it skips the Argon2id hash comparison), an attacker can probe the endpoint with thousands of email addresses and identify which ones are registered by measuring response time differences. Argon2id with OWASP parameters takes ~300-500ms, while a "user not found" short-circuit returns in ~1ms -- a timing difference easily detectable over the network.

The existing `verifyPassword` implementation uses Argon2id, which is timing-safe for the comparison itself. The vulnerability is in whether the comparison is ALWAYS performed.

**Why it happens:**
- Early-return on "user not found" is a natural performance optimization
- The timing gap is not apparent from reading the code -- it only manifests under measurement
- CVE-2025-22234 shows that even authentication frameworks designed to prevent this can introduce timing regressions through patches

**How to avoid:**
Always perform the Argon2id comparison even when the user does not exist, using a dummy hash:

```typescript
// Pre-computed dummy hash for non-existent user comparison
const DUMMY_HASH = await argon2.hash('dummy-comparison-value');

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = await getUserByEmail(email);

  // Always compare against SOME hash -- prevents timing oracle
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  const isValid = await argon2.verify(hashToCompare, password);

  if (!user || !isValid) {
    // Identical response for both "user not found" and "wrong password"
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  // ... proceed with login
}
```

Use a single generic error message for both "user not found" and "wrong password" -- identical response body AND identical response time.

**Warning signs:**
- Login handler has an early return before the hash comparison when user is not found
- Different error messages for "user not found" vs. "wrong password"
- No dummy hash comparison for the not-found path

**Phase to address:** Auth foundation phase

---

### Pitfall 15: Drizzle ORM Bug Generates Invalid Migration When Adding FK Column

**What goes wrong:**
Drizzle Kit has a documented bug (#4147): when adding a new column that also has a foreign key constraint in the same schema change, the generated migration SQL may be invalid -- it attempts to add the FK constraint referencing the column before the column exists. This causes the migration to fail with a PostgreSQL error on a live production database.

For v4.0, adding `userId` relationships to any existing table triggers this exact scenario: new nullable column + FK constraint in one `ALTER TABLE` operation.

**Why it happens:**
- Drizzle's `generate` command analyzes the schema diff and bundles column + constraint in one statement
- The ordering of DDL statements within the migration is incorrect under this bug
- The bug is in the migration generator, not the ORM itself -- it only manifests when running migrations

**How to avoid:**
After running `drizzle-kit generate`, ALWAYS review the generated SQL before applying it to production:

```bash
npm run db:generate
# Review the generated file in drizzle/ before applying
cat drizzle/<timestamp>_migration.sql
```

If the migration contains both `ADD COLUMN` and `ADD CONSTRAINT FOREIGN KEY` for the same column in a single statement, split them into two migrations manually:

```sql
-- Migration 1: Add nullable column (safe, additive, no downtime)
ALTER TABLE "subscriptions" ADD COLUMN "user_id" text;

-- Migration 2 (separate file, run after Migration 1): Add FK constraint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
```

For live PostgreSQL tables with significant data, adding a non-null FK column requires a three-step process to avoid table locks: add nullable column, backfill data, then add NOT NULL constraint.

**Warning signs:**
- Generated migration contains `FOREIGN KEY` constraint referencing a column being added in the same file
- Migration fails with "column does not exist" during FK constraint creation
- Schema diff includes both column addition and FK in one `ALTER TABLE`

**Phase to address:** Schema/database phase (before any schema changes)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip `sanitize_properties` on PostHog init | Faster analytics setup | Encryption keys sent to PostHog -- zero-knowledge violated permanently | Never |
| Store session tokens in localStorage | Simpler client-side auth | Vulnerable to XSS token theft; OWASP explicitly warns against | Never |
| Skip OAuth state parameter | Simpler callback handler | Account hijacking via CSRF; violates RFC 9700 | Never |
| Use `secrets.created_by_user_id` column | Easy "my secrets" dashboard | User-secret association in database breaks zero-knowledge model | Never |
| Only handle `checkout.session.completed` webhook | Faster payment integration | Users who cancel or fail payment retain access indefinitely | Never for production |
| Skip webhook idempotency check | Simpler webhook handler | Double-provisioning on retry -- users credited twice | Never |
| Register Stripe webhook without signature verification | Avoids body parser debugging | Webhook endpoint spoofable in production -- free subscription grants | Never |
| Tighten anonymous rate limit without notice | Reduces abuse immediately | Breaks legitimate existing users, no notice for CI/CD scripts | Only with 30-day deprecation notice |
| Add `unsafe-eval` to CSP for PostHog toolbar | PostHog toolbar works | Weakens CSP protecting encryption key fragments; higher XSS risk | Never -- self-host PostHog without toolbar instead |
| Log `userId + secretId` for debugging | Easier to trace issues | Creates the user-secret association the zero-knowledge model forbids | Never |
| Skip `req.session.regenerate()` on login | One less async call | Session fixation vulnerability | Never |

---

## Integration Gotchas

Common mistakes when connecting auth, payments, and analytics in this specific stack.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PostHog + URL fragments | `$current_url` captures `#ENCRYPTION-KEY` | `sanitize_properties` strips fragment before every event |
| PostHog + CSP nonces | PostHog script blocked silently | Add `app.posthog.com` to `script-src`, `connect-src`, `style-src` in helmet config |
| PostHog + autocapture | DOM attributes with secret metadata captured | Set `autocapture: false`, use manual event capture only |
| Stripe webhooks + Express JSON | `constructEvent` fails with signature mismatch | Register webhook route with `express.raw()` BEFORE global `express.json()` |
| Stripe webhooks + Render.com | Webhook secret differs between CLI and dashboard | Separate `STRIPE_WEBHOOK_SECRET_TEST` and `STRIPE_WEBHOOK_SECRET` env vars |
| OAuth state + sessions | State stored in cookie that JS can read | Store state in server-side session (`express-session` with Redis store) |
| OAuth state + PKCE | Treating PKCE as a replacement for state | PKCE protects code interception; state protects CSRF -- both required |
| OAuth callback + `next` param | `next` in redirect_uri breaks exact match validation | Store post-login destination in session, not in redirect_uri |
| Rate limits + Redis keys | Tightening limits reuses old Redis counters | Version the Redis key prefix (`rl:create:v2:`) when changing limits |
| Drizzle + nullable FK migration | Adding FK column + FK constraint in one migration (bug #4147) | Add nullable column first (one migration), then FK constraint (second migration) |
| Sessions + Render.com | `SESSION_SECRET` rotated causing all users to be logged out | Rotate session secret during low-traffic window; old sessions invalidate gracefully |
| express-session + Redis | Sessions lost on Render.com deploy restart | Use `connect-redis` with the existing Redis instance; sessions survive restarts |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing full JWT payload in session cookie | Cookie too large (>4KB), requests rejected by proxies | Store only session ID in cookie, user data in Redis session store | At user objects > ~500 bytes |
| Querying Stripe API on every authenticated request to check subscription status | 200ms+ added to every request, Stripe rate limits hit | Cache subscription status in Redis with 5-minute TTL, refresh on webhook events | At ~100 concurrent users |
| No Redis for session storage | Sessions lost on server restart (Render.com restarts on deploy) | Use `connect-redis` with the existing Redis instance | Every deployment |
| Webhook handler synchronously sends emails | Webhook timeout, Stripe retries, duplicate emails | Queue emails via background job, return 200 immediately from webhook | When email provider is slow (>5s) |
| PostgreSQL full-table scan for user by email on every login | Login latency degrades as user count grows | Unique index on `users.email` (case-insensitive) | At ~10k users |

---

## Security Mistakes

Domain-specific security issues when adding auth, payments, and analytics to a zero-knowledge app.

| Mistake | Risk | Prevention |
|---------|------|------------|
| `secrets` table gains `user_id` foreign key | Zero-knowledge destroyed -- server knows user-secret association | No FK from secrets to users; use aggregated counters instead |
| PostHog `$current_url` contains `#ENCRYPTION_KEY` | Encryption keys sent to third-party analytics server | `sanitize_properties` on init strips fragment from all URL properties |
| Early-return on user not found during login | Timing oracle enables email enumeration | Always run Argon2id comparison against a dummy hash when user not found |
| Session ID not regenerated on authentication | Session fixation attack enables account takeover | Call `req.session.regenerate()` before setting authenticated user data |
| `STRIPE_SECRET_KEY` in client bundle | Stripe key exposed to all users | Stripe secret key only on server; client uses Stripe.js with publishable key only |
| Analytics tracking on the reveal page | User behavior on secret reveal page sent to third party | Explicitly exclude `/secret/:id` path from all PostHog tracking |
| Unvalidated `next` redirect after login | Open redirect to phishing site | Allowlist post-login destinations to internal paths only |
| OAuth access token stored server-side for long periods | Token theft from database breach grants provider access | Store only `sub` (subject claim) from OAuth; do not persist access tokens |

---

## UX Pitfalls

User experience mistakes specific to adding accounts to an anonymous-first tool.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Account signup required before using the tool | Defeats the anonymous-first value proposition; users churn | Anonymous usage first, account creation is optional upgrade with visible benefits |
| "Your secrets" dashboard shows secret IDs | Implies server stores which secrets user created (privacy expectation violated) | Show only aggregate count and creation timestamps, never secret IDs |
| Login page announces user does not exist | Enables email enumeration | Same generic response for "wrong password" and "user not found" |
| No clear indication of what account provides | Users do not understand upgrade value | List specific benefits before the signup form: higher limits, longer expiry, etc. |
| Subscription cancellation revokes access immediately | User paid for the month; expects access until period end | Use `cancel_at_period_end: true` in Stripe, maintain access until `current_period_end` |
| No "processing" state on checkout return | User sees "no subscription" for 5 seconds while webhook arrives; assumes failure | Immediate Stripe API check on `session_id` return URL parameter |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth flow:** Login works but `req.session.oauthState` is never validated in the callback -- CSRF protection is absent. Test by manually submitting the callback with a mismatched state.
- [ ] **Session cookies:** Auth works in browser but cookies lack `HttpOnly`, `Secure`, and `SameSite` attributes -- verify with browser DevTools Application tab.
- [ ] **PostHog integration:** Events appear in dashboard but `$current_url` contains `#BASE64KEY` -- check PostHog event properties on the reveal page specifically.
- [ ] **Stripe webhooks:** Checkout works but `express.json()` middleware runs before the webhook route -- `constructEvent` will fail in production with live signatures.
- [ ] **Stripe idempotency:** Webhook handler processes events but has no deduplication -- test by sending the same event twice: `stripe events resend evt_...`
- [ ] **Payment failure handling:** Subscription activates on checkout but `invoice.payment_failed` is not handled -- simulate with `stripe triggers invoice.payment_failed`
- [ ] **Rate limit change:** New lower anonymous limit deployed but Redis still contains counters from the old limit window -- users at 4/10 suddenly hit the 3/3 limit.
- [ ] **Schema migration:** User-related FK column added but Drizzle bug #4147 generated a migration that adds FK and column in one statement -- review generated SQL before applying to production.
- [ ] **Secret-user association:** Auth is working but log lines like `{ userId, secretId }` appear in server logs -- scan production logs for any co-occurrence of both values.
- [ ] **Analytics on reveal page:** PostHog initialized globally but the reveal page (`/secret/:id`) should be explicitly excluded -- verify no events fire when viewing a secret.
- [ ] **Session fixation:** Login handler sets `req.session.userId` without calling `req.session.regenerate()` first -- verify session ID changes between pre-auth and post-auth requests.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing OAuth state validation discovered post-launch | HIGH | Audit all user sessions for compromise, invalidate all sessions, deploy fix, notify users |
| Encryption keys captured in PostHog | HIGH | Immediately disable PostHog, delete all captured events from PostHog dashboard, deploy sanitize_properties fix, query PostHog for scope of `$current_url` with fragments |
| User-secret association in logs | HIGH | Delete affected log files, deploy log redaction fix, assess how many associations were recorded and for how long |
| Stripe webhook double-provisioning | MEDIUM | Query Stripe for canonical subscription state, reconcile local database, add idempotency key table |
| Stripe webhook signature verification missing | MEDIUM | Deploy fix immediately (raw body parser before JSON middleware), test with Stripe CLI, audit webhook logs for forged events |
| Anonymous rate limit broken existing users | LOW | Revert rate limit change, communicate in UI, staged rollout with deprecation notice |
| Session fixation (no regenerate on login) | MEDIUM | Invalidate all existing sessions, deploy `req.session.regenerate()` fix |
| Drizzle FK + column migration failure | LOW | Roll back migration, manually split into two migration files, re-apply |
| Timing attack on email lookup | LOW | Deploy dummy hash comparison, no user notification needed |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth state parameter missing (1) | Auth foundation | Playwright test: callback without valid state returns 403 |
| localStorage token storage (2) | Auth foundation | No `localStorage.setItem` for session/token; cookie attributes verified in browser |
| User-secret association in logs (3) | Auth foundation (design invariant) | Log scan test: no log line contains both `userId` and `secretId` patterns |
| Analytics capturing encryption key (4) | Analytics integration | Manual test: view a secret with PostHog active, inspect `$current_url` in PostHog event properties |
| CSP violations from analytics (5) | Analytics integration | No browser CSP violations after PostHog init; PostHog events confirmed in dashboard |
| Stripe webhook idempotency (6) | Payments integration | Resend same webhook event twice via Stripe CLI, verify no double-provisioning |
| Stripe signature verification (7) | Payments integration | Send forged webhook without valid signature, expect 400 rejection |
| Checkout/webhook race condition (8) | Payments integration | Complete checkout, check success page before webhook arrives, confirm subscription shown |
| Payment failure not handled (9) | Payments integration | `stripe triggers invoice.payment_failed` -- user status updates, email sent |
| Rate limit reduction breakage (10) | Rate limiting phase | Staged rollout plan documented; Redis key version bump verified in code |
| Anonymous secret claim creates association (11) | Auth foundation (architecture) | No `secrets.created_by_user_id` column exists; no JOIN between users and secrets tables |
| OAuth redirect URI permissive (12) | Auth foundation | Authorization request with modified redirect_uri rejected by provider |
| Session fixation (13) | Auth foundation | Session ID verified different before and after login in integration test |
| Timing attack on login (14) | Auth foundation | Response time within 50ms variance for existing vs non-existing user on login endpoint |
| Drizzle FK migration bug (15) | Schema/database phase | Generated migration SQL reviewed before applying; no FK constraint before column ADD |

---

## Sources

### OAuth Security
- [RFC 9700 - OAuth 2.0 Security Best Current Practice (January 2025)](https://datatracker.ietf.org/doc/rfc9700/) -- HIGH confidence, IETF standard
- [Auth0: Prevent Attacks with OAuth 2.0 State Parameters](https://auth0.com/docs/secure/attack-protection/state-parameters) -- HIGH confidence, official docs
- [PortSwigger: OAuth 2.0 Authentication Vulnerabilities](https://portswigger.net/web-security/oauth) -- HIGH confidence, security research
- [Slack missing state parameter on HackerOne](https://hackerone.com/reports/2688) -- HIGH confidence, disclosed vulnerability
- [WorkOS: OAuth Best Practices from RFC 9700](https://workos.com/blog/oauth-best-practices) -- MEDIUM confidence, practitioner guide

### Token Storage and Session Security
- [OWASP: HTML5 Security Cheat Sheet -- localStorage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) -- HIGH confidence, official OWASP
- [OWASP ASVS session storage guidance issue #1141](https://github.com/OWASP/ASVS/issues/1141) -- HIGH confidence, official OWASP
- [Pivot Point Security: Local Storage vs Cookies](https://www.pivotpointsecurity.com/local-storage-versus-cookies-which-to-use-to-securely-store-session-tokens/) -- MEDIUM confidence, security firm

### Timing Attacks and Enumeration
- [Triaxiom Security: Timing-Based Username Enumeration](https://www.triaxiomsecurity.com/vulnerability-walkthrough-timing-based-username-enumeration/) -- MEDIUM confidence, security research
- [CVE-2025-22234: Spring Security timing attack regression](https://www.cve.news/cve-2025-22234/) -- HIGH confidence, CVE record

### Stripe Webhooks
- [Stripe: Using Webhooks with Subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) -- HIGH confidence, official Stripe docs
- [Stripe: Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) -- HIGH confidence, official Stripe docs
- [Stigg: Best practices for Stripe webhook integration](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- MEDIUM confidence, practitioner experience
- [Pedro Alonso: Stripe Webhooks Race Conditions](https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/) -- MEDIUM confidence, practitioner experience

### Analytics Privacy
- [PostHog: URL masking via sanitize_properties (GitHub issue #7118)](https://github.com/PostHog/posthog.com/issues/7118) -- HIGH confidence, PostHog official issue
- [PostHog: CSP unsafe-eval issue and fix (GitHub issue #1918)](https://github.com/PostHog/posthog-js/issues/1918) -- HIGH confidence, PostHog official issue
- [Privacy-Friendly Analytics: GDPR-Compliant Insights](https://secureprivacy.ai/blog/privacy-friendly-analytics) -- MEDIUM confidence, industry overview

### Schema Migrations
- [Drizzle ORM: FK + column migration bug #4147](https://github.com/drizzle-team/drizzle-orm/issues/4147) -- HIGH confidence, official Drizzle issue tracker
- [Xata: Zero-downtime PostgreSQL schema migrations](https://xata.io/blog/zero-downtime-schema-migrations-postgresql) -- MEDIUM confidence, engineering blog

---
*Pitfalls research for: SecureShare v4.0 Hybrid Anonymous + Account Model*
*Researched: 2026-02-18*
*Supersedes: Previous PITFALLS.md covering v3.0 Docker/CI/CD/E2E pitfalls*
