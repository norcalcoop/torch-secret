# Phase 27: Conversion Prompts + Rate Limits + Legal Pages - Research

**Researched:** 2026-02-21
**Domain:** Rate limiting (server), conversion UI (client), legal pages (client/router)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Conversion prompt copy — 1st secret**
- Angle: pure benefit highlight, no limit awareness messaging
- Format: one punchy headline leading with the single most compelling benefit (not a list)
- Headline: lead with "Know when your secret is read" (emotionally resonant read-notification benefit)
- CTA label: "Sign up — it's free"

**Conversion prompt copy — 3rd secret**
- CTA label: "Sign up — it's free" (consistent)
- Format: same one-punchy-headline rule applies
- Angle: Claude's discretion — pick what converts best at this third touchpoint

**Prompt visual placement and treatment**
- Position: below the share link on the confirmation page — user has already copied the link
- Dismissibility: dismissible with an X button; dismissed state does NOT persist across page visits
- Style: branded accent card using the primary color accent — visible but non-blocking, consistent with glassmorphism design system
- The prompt must not compete visually with the share link (primary action)

**Conversion prompt triggering**
- Claude's discretion on tracking mechanism (server-side counter vs. localStorage)

**Rate limit error UX**
- Placement: Claude decides (inline on create page vs. dedicated error state)
- Reset time: show when the limit resets ("Limit resets in 45 minutes")
- Copy tone: Claude's discretion, consistent with app voice
- 429 response structure: Claude's discretion
- The upsell in the 429 context must include: reset time, CTA "Sign up — it's free", brief mention of higher limits

**Legal pages — content**
- Real content now, not stubs
- Tokens: [Company Name] and [Contact Email] throughout
- Content must accurately reflect zero-knowledge model

**Legal pages — design and placement**
- Visual style: same glassmorphism design system, full layout shell, dark/light theme, same typography
- Both pages get noindex meta tags
- Canonical URLs: /privacy and /terms
- Link placement: footer globally + inline consent copy on registration page
- Footer must appear on the create page (first page most users land on)

### Claude's Discretion
- Exact copy for 3rd-secret prompt (angle and hook)
- Conversion prompt trigger mechanism (server vs. localStorage)
- Rate limit error placement (inline vs. error state)
- Rate limit 429 response structure (JSON fields vs. client-side handling)
- Rate limit copy tone

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | Anonymous users are rate-limited to 3 secrets/hour and 10 secrets/day (tightened from current 10/hour) | express-rate-limit supports multiple limiters in sequence; need both hourly + daily limiters applied to POST /api/secrets for anonymous requests only |
| CONV-02 | Anonymous users can set expiration up to 1 hour maximum (restricted from current 1h/24h/7d/30d options) | expiration-select.ts and CreateSecretSchema must be made auth-aware; schema must allow per-role enum values |
| CONV-03 | Authenticated users have higher limits: 20 secrets/day and expiration up to 7 days | optionalAuth already populates res.locals.user; rate limiter can skip authenticated requests by checking req headers/session; expiration select can show full options conditionally |
| CONV-04 | Anonymous users see an inline, non-blocking prompt after their first secret creation | Prompt rendered on confirmation page below share link; trigger mechanism must be determined |
| CONV-05 | Anonymous users see a benefit-focused upsell prompt after their third secret creation | Same prompt component, different copy; same trigger architecture |
| CONV-06 | Anonymous users who hit the rate limit see an inline prompt to create a free account | 429 response from server must include reset timestamp; client error handler in create.ts shows upsell card |
| LEGAL-01 | Privacy Policy page accessible at /privacy describing what data is and is not collected | New route in router.ts + new page module + real content |
| LEGAL-02 | Terms of Service page accessible at /terms covering acceptable use | New route in router.ts + new page module + real content |
</phase_requirements>

---

## Summary

Phase 27 has three distinct work streams that can largely be planned independently: (1) server-side rate limit changes, (2) client-side conversion prompts, and (3) two new legal pages.

The rate limit changes are surgical. The existing `createSecretLimiter` in `server/src/middleware/rate-limit.ts` uses a single express-rate-limit instance capped at 10/hour (for all users, ignoring auth state). The requirements call for 3/hour and 10/day for anonymous users, with authenticated users getting higher limits (20/day). The cleanest approach is two separate anonymous limiters (hourly + daily) that are bypassed for authenticated requests by checking `res.locals.user` via a `skip` callback — `optionalAuth` must run before the limiters for this to work. The existing `standardHeaders: 'draft-7'` configuration already emits a `RateLimit-Reset` header (Unix timestamp in seconds) which the client can use to calculate and display the reset countdown without any server-side changes to the response body format.

The conversion prompt trigger mechanism requires a clear decision. Server-side counters (via the existing rate limit Redis/memory store) expose the remaining count via `RateLimit-Remaining` response headers — this is already available for free from the `draft-7` standard headers. This is the cleaner approach: the client reads `RateLimit-Remaining` from the `POST /api/secrets` 201 response headers and renders the prompt when `remaining === 2` (first creation = 2 remaining of 3) or `remaining === 0` (third creation = 0 remaining). No localStorage required, no separate counter, no cross-session state. The dismissed state (X button) does not persist per the locked decision, so session-scoped in-memory state in the confirmation page module is sufficient.

The legal pages are straightforward SPA additions: two new route entries in `router.ts`, two new page modules (`privacy.ts`, `terms.ts`), and a footer update in `layout.ts`. The glassmorphism design system is already established. The registration page needs a consent line below the submit button. Real content for both documents needs to be drafted, accurately reflecting the zero-knowledge model.

**Primary recommendation:** Implement in three plans — (1) server rate limits + 429 enrichment, (2) confirmation page conversion prompts + expiration restriction, (3) legal pages + footer + register consent link.

---

## Standard Stack

### Core (already in codebase — no new installs)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| express-rate-limit | 8.2.1 | Rate limit middleware | Already in use; needs new limiter instances |
| rate-limit-redis | 4.3.1 | Redis store for distributed rate limits | Already in use with prefix system |
| optionalAuth middleware | — | Populates res.locals.user for authenticated requests | Must run before anonymous limiters |
| Vite / Vanilla TS | 7.x | Frontend build | No new dependencies |

### No New Dependencies Required

All work for this phase uses existing infrastructure. No npm installs needed.

---

## Architecture Patterns

### Pattern 1: Two-Limiter Anonymous-Only Rate Limiting

The current codebase has one limiter (10/hour, applies to all users). The new model requires:
- Anonymous users: 3/hour AND 10/day
- Authenticated users: 20/day (no hourly limit needed at this tier)

**Correct approach:** Chain two express-rate-limit middlewares with `skip` callbacks that check `res.locals.user`. The `skip` callback receives `(req, res)` — `res.locals.user` is set by `optionalAuth` which already runs before the limiter in the secrets router.

**Route middleware order on POST /api/secrets (current):**
```
createSecretLimiter(redisClient) → optionalAuth → validateBody → handler
```

**New order required:**
```
optionalAuth → anonHourlyLimiter(redisClient) → anonDailyLimiter(redisClient) → authedDailyLimiter(redisClient) → validateBody → handler
```

`optionalAuth` must move before all limiters so the `skip` callback can read `res.locals.user`.

```typescript
// Source: express-rate-limit 8.x docs — skip callback signature
function createAnonHourlyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: isE2E ? 1000 : 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'rate_limited', message: '...' },
    store: createStore(redisClient, 'rl:anon:hourly:'),
    passOnStoreError: true,
    skip: (_req, res) => !!(res.locals.user), // skip authenticated users
  });
}

function createAnonDailyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    limit: isE2E ? 1000 : 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'rate_limited', message: '...' },
    store: createStore(redisClient, 'rl:anon:daily:'),
    passOnStoreError: true,
    skip: (_req, res) => !!(res.locals.user),
  });
}

function createAuthedDailyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    limit: isE2E ? 1000 : 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'rate_limited', message: '...' },
    store: createStore(redisClient, 'rl:authed:daily:'),
    passOnStoreError: true,
    skip: (_req, res) => !(res.locals.user), // skip anonymous users
  });
}
```

**Key insight:** The `skip` callback in express-rate-limit 8.x receives `(req, res)`. Since `optionalAuth` runs first and populates `res.locals.user`, the skip logic is clean and requires no header parsing.

### Pattern 2: Reading RateLimit-Reset from 201 Response Headers

The `standardHeaders: 'draft-7'` configuration emits IETF draft-7 format headers on every response including successes:

```
RateLimit-Limit: 3
RateLimit-Remaining: 2
RateLimit-Reset: 1708545600   ← Unix timestamp (seconds)
RateLimit-Policy: 3;w=3600
```

The client can read these from the `201` response after secret creation:

```typescript
// In the createSecret API client wrapper, return headers alongside the response
const res = await fetch('/api/secrets', { method: 'POST', ... });
const remaining = parseInt(res.headers.get('RateLimit-Remaining') ?? '-1', 10);
const resetTimestamp = parseInt(res.headers.get('RateLimit-Reset') ?? '0', 10);
// Pass to renderConfirmationPage to conditionally show prompt
```

**Important:** With two anonymous limiters (hourly + daily), each will emit its own headers. Express-rate-limit 8.x sets headers for each limiter independently; the last one to run wins if they write the same header name. The hourly limiter (more restrictive) should be the one that matters most for prompt triggering (3/hour), so its `RateLimit-Remaining` value is the correct trigger. Since the hourly limiter runs first, its headers are set first, then the daily limiter may overwrite them. To avoid ambiguity, use a custom `headerName` prefix or check both separately. **Simplest approach:** Use `standardHeaders: false` on the daily limiter (or a uniquely named header) and emit daily remaining in the JSON body of 429 responses. The hourly limiter retains `draft-7` headers for the prompt trigger.

**Alternative (simpler):** Track anonymous creation count client-side with a session-scoped variable in the confirmation page module (an in-module counter that increments each time `renderConfirmationPage` is called during the same page session). This avoids header parsing complexity entirely and needs no server changes. The counter resets on page refresh — which is acceptable since the dismissed state also does not persist per the locked decision.

**Recommendation:** Use client-side session counter (incrementing a module-level variable in `create.ts`). Simple, no server changes, no header parsing, consistent with the "dismissed state does not persist" decision. The server's `RateLimit-Remaining` header IS available from the 201 response for free, but it requires threading headers through the API client layer, which adds complexity. The session counter is a cleaner implementation for the prompt triggering use case.

### Pattern 3: 429 Response Enrichment with Reset Time

When an anonymous user hits the rate limit, the server's 429 response currently returns:
```json
{ "error": "rate_limited", "message": "Too many secrets created. Please try again later." }
```

The `RateLimit-Reset` header (Unix timestamp) is already present. The client can compute the minutes remaining from this header. No server body changes are strictly required — the client reads the header.

**Recommended 429 response structure (no server body change needed):**
- Keep existing JSON body for backward compatibility
- Client reads `RateLimit-Reset` header from the 429 response
- `ApiError` in `client/src/api/client.ts` currently discards headers; needs to expose them OR the create.ts error handler uses `res.headers` before throwing

**Preferred approach:** Modify `createSecret` in `api/client.ts` to return rate limit headers in the thrown `ApiError` when status is 429:

```typescript
// In api/client.ts
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly rateLimitReset?: number; // Unix timestamp from RateLimit-Reset header

  constructor(status: number, body: unknown, rateLimitReset?: number) {
    super(`API error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.rateLimitReset = rateLimitReset;
  }
}

// When status === 429, extract header:
const resetHeader = res.headers.get('RateLimit-Reset');
const rateLimitReset = resetHeader ? parseInt(resetHeader, 10) : undefined;
throw new ApiError(res.status, body, rateLimitReset);
```

The create page error handler catches `ApiError` with `status === 429` and renders the upsell card inline with the computed countdown.

### Pattern 4: Conversion Prompt Component

The prompt is a dismissible card rendered on the confirmation page. Since dismissed state does not persist across page visits (locked decision), a simple boolean in the component closure suffices:

```typescript
// In confirmation.ts
function createConversionPrompt(headline: string): HTMLElement | null {
  let dismissed = false;
  if (dismissed) return null; // guard (always false on first call)

  const card = document.createElement('div');
  card.className = 'p-4 rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-md shadow-sm relative';

  // Dismiss button (X)
  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.setAttribute('aria-label', 'Dismiss');
  dismissBtn.className = 'absolute top-3 right-3 text-text-muted hover:text-text-primary ...';
  dismissBtn.addEventListener('click', () => {
    card.remove();
  });

  const headlineEl = document.createElement('p');
  headlineEl.className = 'font-semibold text-text-primary text-sm';
  headlineEl.textContent = headline;

  const ctaLink = document.createElement('a');
  ctaLink.href = '/register';
  ctaLink.className = 'mt-3 inline-block ...'; // accent button styling
  ctaLink.textContent = 'Sign up — it\'s free';
  ctaLink.addEventListener('click', (e) => { e.preventDefault(); navigate('/register'); });

  card.appendChild(dismissBtn);
  card.appendChild(headlineEl);
  card.appendChild(ctaLink);
  return card;
}
```

**Positioning:** inserted into `wrapper` after the `urlCard` block and before the expiration notice, so the share link is fully visible above the prompt.

### Pattern 5: Expiration Restriction for Anonymous Users

CONV-02 requires anonymous users to have a maximum 1-hour expiration. This requires changes in two places:

**Server (Zod schema):** `CreateSecretSchema` currently validates `expiresIn: z.enum(['1h', '24h', '7d', '30d'])`. This cannot easily be auth-aware at the Zod layer (Zod schemas are static). The server should enforce this via route handler logic after auth resolution:

```typescript
// In secrets.ts route handler, after optionalAuth runs:
const userId = (res.locals.user as AuthUser | undefined)?.id;
const expiresIn = body.expiresIn;
// Enforce anonymous expiration cap server-side
if (!userId && expiresIn !== '1h') {
  res.status(400).json({ error: 'validation_error', message: 'Anonymous users can only set expiration to 1 hour.' });
  return;
}
```

**Client (expiration-select.ts):** The component must be made auth-aware via a parameter or factory pattern. Two approaches:

Option A: `createExpirationSelect(isAuthenticated: boolean)` — filters options based on auth state.
Option B: `createExpirationSelect()` stays static, caller restricts options after.

Option A is cleaner. Anonymous users see only `['1h']` (or a single option, possibly as a disabled-looking select or static text). Authenticated users see `['1h', '24h', '7d']` (7d cap for free accounts; 30d deferred to Pro).

**Important nuance:** The requirements say authenticated users get "up to 7 days" (CONV-03). The current schema includes `'30d'`. The `'30d'` option belongs to Pro tier (CONV-02/03 say authenticated free = 7d max). The server must enforce this: if `userId` is set but not Pro, cap at `'7d'`. Since there is no Pro tier yet (Pro is v5.0), all authenticated users in Phase 27 get the 7-day cap. The `'30d'` Zod enum value should remain valid for future Pro use but the server route handler enforces the 7-day limit for free authenticated accounts.

**Recommendation:** Keep `'30d'` in the Zod enum (backward-compatible, needed for future Pro). Add server-side enforcement in the route handler. Remove `'30d'` from the expiration select entirely for now (no user should see it yet) and add `'7d'` as the max for authenticated users. The `'24h'` default stays. This means expiration select options become:
- Anonymous: `['1h']` only (force-selected, locked)
- Authenticated (free): `['1h', '24h', '7d']` with `'24h'` as default

### Pattern 6: Legal Pages

Two new SPA pages following the exact existing pattern.

**router.ts additions:**
```typescript
} else if (path === '/privacy') {
  updatePageMeta({
    title: 'Privacy Policy',
    description: 'How Torch Secret handles your data — zero-knowledge architecture explained.',
    noindex: true, // per locked decision
  });
  import('./pages/privacy.js')
    .then((mod) => mod.renderPrivacyPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
} else if (path === '/terms') {
  updatePageMeta({
    title: 'Terms of Service',
    description: 'Terms of Service for Torch Secret.',
    noindex: true,
  });
  import('./pages/terms.js')
    .then((mod) => mod.renderTermsPage(container))
    .then(() => focusPageHeading())
    .catch(() => showLoadError(container));
}
```

**layout.ts footer update:** The current footer contains three trust-signal `<span>` elements. It needs anchor links to `/privacy` and `/terms` added. The footer element is created once at DOMContentLoaded; anchor clicks should use `navigate()`.

**register.ts consent line:** A small paragraph below the submit button:
```
By creating an account, you agree to our [Terms of Service] and [Privacy Policy].
```
Links use `navigate('/terms')` and `navigate('/privacy')`. This is inserted between the submit button and the error area, or below the submit button — matches standard SaaS consent copy placement.

**Legal page structure (both pages):** Use a simple prose layout consistent with the glassmorphism system. A max-width container (max-w-2xl), an h1 heading, a "last updated" date, and section headings (h2) for each section. Body text uses `text-text-secondary leading-relaxed`. No tables needed for most sections.

### Anti-Patterns to Avoid

- **Zod enum for auth-scoped validation:** Do not try to make `expiresIn` validation auth-aware in Zod. Zod schemas are static; enforce auth-scoped limits in the route handler after `optionalAuth` runs.
- **Skip callback reading req.headers for auth:** Do not re-implement session parsing in the rate limiter skip callback. `optionalAuth` already resolves auth; just read `res.locals.user`.
- **Footer link using `<a href>` without navigate():** All internal links in the layout must use `navigate()` to stay within the SPA. Plain href causes a full page reload.
- **Persisting dismissed prompt state to localStorage:** The locked decision says dismissed state does not persist across page visits. Do not write to localStorage for the X-dismiss state.
- **Using innerHTML for legal page content:** All DOM construction must use `textContent` / `createElement`. The project security policy prohibits innerHTML.
- **Combining userId + secretId in any 429 log or response:** The zero-knowledge invariant applies to error responses too. The 429 message must not contain secretId.
- **Showing the conversion prompt to authenticated users:** The prompt is for anonymous users only. The `renderConfirmationPage` function receives a `isAuthenticated` flag (or is called with knowledge of auth state from `create.ts`) to conditionally omit it.
- **Placing the 30d expiration option in the UI now:** 30d is a Pro feature (v5.0). Remove it from the client-side select entirely in Phase 27.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distributed rate limiting | Custom Redis counter | express-rate-limit + RedisStore (already in codebase) | Handles window sliding, store errors, standard headers |
| Rate limit reset time calculation | Manual header parsing or server-side countdown | `RateLimit-Reset` header (Unix timestamp) from express-rate-limit draft-7 | Already emitted by existing limiter configuration |
| Legal page prose rendering | Custom markdown renderer | Vanilla DOM construction (textContent, createElement) | Consistent with codebase security policy; legal pages are static content |

---

## Common Pitfalls

### Pitfall 1: optionalAuth Must Run Before Rate Limiters

**What goes wrong:** If `optionalAuth` runs after the rate limiters, `res.locals.user` is undefined when the `skip` callback fires. Authenticated users get rate-limited as if anonymous.

**Why it happens:** The current router order is `createSecretLimiter → optionalAuth → validateBody → handler`. Moving to per-role limiters requires reversing `optionalAuth` and the limiters.

**How to avoid:** In `secrets.ts` `createSecretsRouter()`, reorder the POST route middleware: `optionalAuth` first, then all rate limiters, then `validateBody`, then handler.

**Warning signs:** Integration test for authenticated user limit shows 429 after fewer than 20 requests.

### Pitfall 2: Header Collision Between Multiple Limiters

**What goes wrong:** When two express-rate-limit middlewares both use `standardHeaders: 'draft-7'`, they each attempt to write `RateLimit-Remaining`. The second limiter overwrites the first. If the daily limiter runs after the hourly limiter, the client sees the daily remaining count (e.g., 9) instead of the hourly remaining count (e.g., 2), triggering the prompt at the wrong time.

**Why it happens:** HTTP headers are last-writer-wins. Express-rate-limit 8.x writes headers in middleware execution order.

**How to avoid:** Use `standardHeaders: false` on the daily limiter (or disable headers entirely and use only the hourly limiter's headers for prompt logic). Alternatively, use client-side session counter (recommended — avoids this entirely).

**Warning signs:** Conversion prompt fires at wrong creation count during manual testing.

### Pitfall 3: E2E Tests Break on Tighter Anonymous Limits

**What goes wrong:** Playwright E2E tests that create multiple secrets without authentication will hit the new 3/hour limit.

**Why it happens:** E2E tests share one server across multiple browser contexts. The `isE2E` check in `rate-limit.ts` already handles this (`limit: isE2E ? 1000 : 3`), but only if E2E_TEST env var is correctly set.

**How to avoid:** Extend the `isE2E` override to all new limiter instances, not just the old one. Verify `E2E_TEST=true` is set in the Playwright config or test server startup.

**Warning signs:** E2E tests fail with 429 during secret creation flows.

### Pitfall 4: Expiration Enforcement Gap (Server + Client Mismatch)

**What goes wrong:** If only the client is updated (expiration select shows only '1h' for anonymous), a raw API call with `expiresIn: '30d'` from an anonymous user succeeds because the Zod schema still allows it.

**Why it happens:** The Zod schema allows all four enum values. Server enforcement is absent.

**How to avoid:** Add server-side enforcement in the POST /api/secrets route handler immediately after `optionalAuth`. Return 400 with a clear message if `expiresIn` exceeds the user tier's cap.

**Warning signs:** Integration test `POST /api/secrets` with `expiresIn: '30d'` and no auth cookie returns 201 instead of 400.

### Pitfall 5: Legal Page Links in Footer Cause Full-Page Reload

**What goes wrong:** If footer links are plain `<a href="/privacy">` without `e.preventDefault()` and `navigate()`, clicking them causes a full browser navigation instead of SPA routing.

**Why it happens:** The footer is built with `createElement` and raw `href` attributes. Without click handler interception, the browser follows the href.

**How to avoid:** Pattern: `link.addEventListener('click', (e) => { e.preventDefault(); navigate('/privacy'); })` — same pattern used by all existing nav links in `layout.ts`.

**Warning signs:** Network tab shows a full page load (200 with HTML response) on /privacy click instead of a client-side render.

### Pitfall 6: Zero-Knowledge Invariant in 429 Upsell Response

**What goes wrong:** A careless 429 response or log line includes `secretId` alongside rate limit context (which is user-IP-scoped). Even though this doesn't directly violate the `userId + secretId` rule (no userId in a 429 for anonymous users), log lines must be checked.

**Why it happens:** Pino may log the request URL which contains `/api/secrets` (no secretId here — POST to `/api/secrets` has no ID in the path). Safe.

**How to avoid:** POST /api/secrets 429 responses are safe — the URL contains no secretId. No INVARIANTS.md update needed for this path. Confirm the logger redaction regex covers GET/POST paths correctly.

---

## Code Examples

### Example 1: Anonymous-Only Limiter with Skip Callback

```typescript
// server/src/middleware/rate-limit.ts
export function createAnonHourlyLimiter(redisClient?: Redis) {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: isE2E ? 1000 : 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: {
      error: 'rate_limited',
      message: 'Too many secrets created. Create a free account for higher limits.',
    },
    store: createStore(redisClient, 'rl:anon:h:'),
    passOnStoreError: true,
    skip: (_req, res) => !!(res.locals.user as unknown),
  });
}
```

### Example 2: Reading RateLimit-Reset from 201 Response

```typescript
// In create.ts submit handler, after API call:
// The response object from fetch is needed before ApiError wraps it
// Modify createSecret() in api/client.ts to return headers in ApiError:

// Or simpler: expose remaining count directly from the success response
const res = await fetch('/api/secrets', { method: 'POST', ... });
const rateLimitRemaining = parseInt(res.headers.get('RateLimit-Remaining') ?? '-1', 10);
const rateLimitReset = parseInt(res.headers.get('RateLimit-Reset') ?? '0', 10);
if (!res.ok) {
  throw new ApiError(res.status, await res.json(), rateLimitReset);
}
const data = await res.json();
// Pass rateLimitRemaining to renderConfirmationPage
```

### Example 3: Conversion Prompt Trigger in create.ts

```typescript
// Module-level counter (session-scoped, resets on page refresh)
let anonymousSecretCount = 0;

// In renderCreatePage submit handler, after successful creation:
const isAnonymous = !isSession(data); // from auth check IIFE
if (isAnonymous) {
  anonymousSecretCount++;
}
renderConfirmationPage(container, shareUrl, response.expiresAt, label, currentPassphrase, {
  showPrompt: isAnonymous ? anonymousSecretCount : null,
});
```

### Example 4: Dismissible Prompt Card (Glassmorphism)

```typescript
// Uses accent/10 background and accent/30 border — consistent with existing warning card pattern
// See confirmation.ts line 186: 'px-4 py-3 rounded-lg bg-accent/10 backdrop-blur-sm text-accent text-sm'
function createConversionPromptCard(headline: string): HTMLElement {
  const card = document.createElement('div');
  card.className =
    'relative p-4 rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-md shadow-sm text-left';

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.setAttribute('aria-label', 'Dismiss signup prompt');
  dismissBtn.className =
    'absolute top-2 right-2 p-1 text-text-muted hover:text-text-primary rounded focus:ring-2 focus:ring-accent focus:outline-hidden transition-colors cursor-pointer';
  dismissBtn.textContent = '×'; // or X Lucide icon
  dismissBtn.addEventListener('click', () => card.remove());

  const headlineEl = document.createElement('p');
  headlineEl.className = 'font-semibold text-text-primary text-sm pr-6';
  headlineEl.textContent = headline; // e.g. "Know when your secret is read"

  const ctaLink = document.createElement('a');
  ctaLink.href = '/register';
  ctaLink.className =
    'mt-3 inline-block min-h-[36px] px-4 py-1.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg focus:outline-hidden transition-all cursor-pointer';
  ctaLink.textContent = "Sign up — it's free";
  ctaLink.addEventListener('click', (e) => { e.preventDefault(); navigate('/register'); });

  card.appendChild(dismissBtn);
  card.appendChild(headlineEl);
  card.appendChild(ctaLink);
  return card;
}
```

### Example 5: 429 Inline Error State in create.ts

```typescript
// In create.ts error handler:
if (err instanceof ApiError && err.status === 429) {
  const resetMs = (err.rateLimitReset ?? 0) * 1000;
  const minutesUntilReset = Math.ceil((resetMs - Date.now()) / 60_000);
  const resetText = minutesUntilReset > 0
    ? `Limit resets in ${minutesUntilReset} minute${minutesUntilReset === 1 ? '' : 's'}.`
    : 'Limit resets soon.';

  // Show upsell card instead of generic error
  showRateLimitUpsell(errorArea, resetText);
  return;
}

function showRateLimitUpsell(container: HTMLElement, resetText: string): void {
  container.classList.remove('hidden');
  // Build inline upsell: reset time + CTA + brief benefit mention
  // "You've reached the limit for anonymous sharing. " + resetText
  // "Create a free account for 20 secrets/day and 7-day expiration."
  // CTA: "Sign up — it's free" → navigate('/register')
}
```

### Example 6: Footer Link Pattern (navigate-safe)

```typescript
// In layout.ts createFooter():
function createFooterLink(text: string, path: string): HTMLElement {
  const a = document.createElement('a');
  a.href = path;
  a.textContent = text;
  a.className = 'hover:text-text-secondary transition-colors';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(path);
  });
  return a;
}

// Usage:
inner.appendChild(createFooterLink('Privacy Policy', '/privacy'));
inner.appendChild(createFooterLink('Terms of Service', '/terms'));
```

---

## Conversion Prompt Copy Decisions

### 1st Secret Prompt (benefit highlight, no limit awareness)

**Headline:** "Know when your secret is read."

**Sub-copy (optional, one line):** "Get a read receipt by email — free with an account."

**CTA:** "Sign up — it's free"

**Rationale:** Directly from CONTEXT.md `## Specifics`. This is the most emotionally compelling differentiator — anonymous users have no way to know if their secret was ever opened. The read receipt benefit is the single biggest delta between anonymous and account usage, and it maps to the PostHog upgrade trigger documented in `.claude/pricing-strategy.md`: "I shared a secret last week — was it ever opened?" It is also the primary upgrade moment listed in both `.claude/product-marketing-context.md` and `.claude/pricing-strategy.md`.

### 3rd Secret Prompt (engaged user, Claude's discretion)

**Headline:** "Your secrets, tracked."

**Sub-copy:** "A dashboard that shows you what's active, what's been opened, and what's expired."

**CTA:** "Sign up — it's free"

**Rationale:** A user on their third secret in a session is power-using the tool. They've moved beyond one-off use. The dashboard/history benefit addresses their implicit need — they're creating enough secrets that tracking them matters. This shifts from a single-feature hook (read receipt) to a workflow benefit (history and visibility), appropriate for a more engaged user. Consistent with brand voice: direct, no exclamation points, peer-to-peer developer tone.

### Rate Limit 429 Upsell

**Headline:** "You've reached the free limit for anonymous sharing."

**Reset line:** "Limit resets in [N] minutes." (computed from RateLimit-Reset header)

**Benefit line:** "Create a free account for 20 secrets/day and up to 7-day expiration."

**CTA:** "Sign up — it's free"

**Tone rationale:** The copy is factual and transactional, not apologetic or pushy. The target audience (developers) appreciates clarity over warmth. The benefit line cites specific numbers (20/day, 7 days) — specific numbers build credibility with this audience. No exclamation points per brand voice.

---

## Legal Page Content Outline

Both pages must accurately reflect the zero-knowledge architecture. Key truth claims (verified against codebase):

**Verified technical facts to include:**
- Secrets are encrypted in the user's browser using AES-256-GCM (Web Crypto API)
- The encryption key lives only in the URL fragment (#key) — the fragment is never transmitted to our servers per RFC 3986
- The server stores only AES-256-GCM ciphertext; it cannot decrypt secrets
- Secrets are permanently deleted from the database in the same atomic operation as retrieval
- Password protection uses Argon2id hashing server-side (not stored in plaintext)
- For authenticated users: email addresses are stored for account authentication; no secret content is ever associated with a user record

### Privacy Policy — Section Outline

1. Who we are — [Company Name], [Contact Email]
2. What we collect
   - Anonymous users: encrypted ciphertext blobs, expiration metadata, IP address for rate limiting (not logged permanently), no cookies for tracking
   - Authenticated users: name, email, hashed password (Argon2id), session token, secret metadata (label, created_at, expires_at, status — never content)
3. What we never collect — secret content (the server cannot read it), encryption keys (stored only in URL fragments, never transmitted to us)
4. How data is used — secret delivery and self-destruction; authentication; rate limiting
5. Data retention — anonymous secrets: auto-deleted on view or expiration; account metadata: retained while account is active, deleted on account deletion
6. Third-party services — [list: hosting provider, email provider (Resend), analytics (PostHog with privacy-safe config)]
7. Cookies — session cookies (authentication only, no tracking cookies)
8. Your rights — access, deletion, correction (contact [Contact Email])
9. Changes to this policy
10. Contact — [Contact Email]

### Terms of Service — Section Outline

1. Acceptance of terms
2. What the service does — one-time encrypted secret sharing
3. Acceptable use — prohibited: illegal content, abuse of the service, automated scraping, using the service to distribute malware or violate third-party rights
4. Prohibited content — the user is solely responsible for content they share; [Company Name] cannot read secret content
5. Account responsibilities — accurate information, password security, notify us of unauthorized access
6. Service limitations — secrets are permanently destroyed on first view; we cannot recover secrets after deletion; no guarantee of delivery if link expires before recipient opens it
7. Zero-knowledge model — we cannot and will not access secret content; law enforcement requests cannot compel disclosure of secret content because we do not possess it
8. Intellectual property
9. Disclaimer of warranties
10. Limitation of liability
11. Governing law — [jurisdiction]
12. Contact — [Contact Email]

---

## Rate Limit UX Decision: Inline vs. Error State

**Decision: inline on the create page (the error area that already exists).**

Rationale:
- The create page (`create.ts`) already has an `errorArea` (`div.hidden.px-4.py-3.rounded-lg.bg-danger/10.text-danger`) and the submit handler catches ApiError
- A dedicated error state (navigate to a new route) would lose the form content and feel disproportionately disruptive for a temporary limit
- Inline display keeps the user on the same page; they can read the reset time, click the CTA, or simply wait and retry
- The inline error area is already announced via `role="alert"` for screen readers
- This is consistent with how auth errors are handled on login/register (inline, not a redirect)

**Implementation:** Replace the generic `showError()` call for 429s with a specialized `showRateLimitUpsell()` function that renders a richer card (including reset time + CTA + benefit mention) in the same error container. The `bg-danger/10 text-danger` classes should be swapped to neutral/accent styling since this is informational, not an error in the traditional sense.

---

## PostHog Event for Conversion Prompt

Per Phase 25 patterns (analytics module in `client/src/analytics/posthog.ts`), add:

```typescript
// Zero-knowledge invariant: no userId, no secretId
export function captureConversionPromptShown(promptNumber: 1 | 3 | 'rate_limit'): void {
  if (!isInitialized()) return;
  posthog.capture('conversion_prompt_shown', { prompt_number: promptNumber });
}

export function captureConversionPromptClicked(promptNumber: 1 | 3 | 'rate_limit'): void {
  if (!isInitialized()) return;
  posthog.capture('conversion_prompt_clicked', { prompt_number: promptNumber });
}
```

This enables PostHog funnel analysis of prompt effectiveness without violating the zero-knowledge invariant (no user identity or secret identity in these events).

---

## INVARIANTS.md Update Required

Phase 27 does not introduce new systems that risk combining userId + secretId. However, the INVARIANTS.md enforcement table should be updated with a Phase 27 row confirming that:
- The 429 response for anonymous rate limits contains no userId (anonymous by definition) and no secretId (POST /api/secrets URL contains no ID)
- Legal page content contains no user-identifiable or secret-identifiable data
- Conversion prompt analytics events contain no userId and no secretId per the PostHog invariant

The INVARIANTS.md table entry for Phase 27:
```
| Rate limits + conversion prompts | server/src/middleware/rate-limit.ts, client/src/analytics/posthog.ts | 429 responses for anonymous users contain no userId or secretId. Conversion prompt analytics events (conversion_prompt_shown, conversion_prompt_clicked) contain only prompt_number — no userId, no secretId. | Phase 27 |
```

---

## Recommended Plan Structure

**3 plans:**

**Plan 27-01: Server Rate Limits + 429 Enrichment**
- Refactor `rate-limit.ts`: replace `createSecretLimiter` with `createAnonHourlyLimiter`, `createAnonDailyLimiter`, `createAuthedDailyLimiter`
- Update `secrets.ts` POST route: move `optionalAuth` before limiters; add server-side `expiresIn` cap enforcement
- Extend `ApiError` in `api/client.ts` to capture `rateLimitReset` from response headers
- Update `CreateSecretSchema` if needed (keep 30d in Zod, enforce cap in route handler)
- Integration tests: anonymous 3/hour limit, anonymous 10/day limit, authenticated 20/day limit, anonymous expiresIn cap, authenticated expiresIn cap

**Plan 27-02: Client Conversion Prompts + Expiration Restriction**
- Update `expiration-select.ts` to accept auth-aware options (anonymous: 1h only; authenticated: 1h/24h/7d)
- Update `create.ts` to thread auth state into expiration select; add session-level anonymous counter; pass prompt trigger data to `renderConfirmationPage`
- Update `confirmation.ts` to accept prompt metadata and render dismissible branded accent card
- Update `create.ts` error handler for 429: call `showRateLimitUpsell()` with reset time and CTA
- Add PostHog events: `captureConversionPromptShown` and `captureConversionPromptClicked`
- Tests: prompt renders on first creation, prompt renders on third creation, prompt absent for authenticated users, dismiss removes card, 429 shows upsell with reset time

**Plan 27-03: Legal Pages + Footer + Register Consent**
- Add `/privacy` and `/terms` routes to `router.ts`
- Create `client/src/pages/privacy.ts` and `client/src/pages/terms.ts` with full content
- Update `layout.ts` `createFooter()` to add Privacy Policy and Terms of Service anchor links
- Update `register.ts` to add consent line below submit button
- Update `INVARIANTS.md` with Phase 27 row
- Tests: /privacy and /terms routes render correctly (accessibility), noindex meta present on both, footer links navigate correctly, register page has consent copy

---

## Open Questions

1. **Anonymous expiresIn enforcement UX:** When an anonymous user selects a restricted expiration value (impossible if select only shows '1h', but possible via direct API call), should the 400 response message be exposed to the user in the UI? Recommendation: yes, via the existing errorArea with a clear message ("Anonymous sharing is limited to 1-hour expiration. Sign up free for more options.").

2. **Authenticated daily limit counter key:** The authenticated daily limiter uses `req.ip` as the key by default. For multi-account scenarios (family sharing an IP), IP-based limits for authenticated users are correct since we cannot use userId as the key without violating the zero-knowledge invariant (if the key includes both userId and creates per-user counters, that's fine — the count is not a secretId). Actually, using userId as the key for authenticated limits is safe: the counter is `userId → count`, no secretId involved. Consider `keyGenerator: (req) => (res.locals.user as AuthUser).id` for the authenticated limiter. This gives true per-user limits instead of per-IP. **Recommendation:** Use userId as the key for the authenticated daily limiter to avoid false positives from shared IPs.

3. **Expiration select for anonymous with only one option:** When anonymous users can only choose '1h', showing a full `<select>` with one option is poor UX. Consider rendering a static text display ("1 hour") instead of a disabled select, with a note like "Create a free account for longer expiration." This is a UX refinement — the planner should address this as an implementation detail.

---

## Sources

### Primary (HIGH confidence — read directly from codebase)

- `/Users/ourcomputer/Github-Repos/secureshare/server/src/middleware/rate-limit.ts` — existing limiter implementation, `skip` callback API, store prefix pattern
- `/Users/ourcomputer/Github-Repos/secureshare/server/src/routes/secrets.ts` — current middleware order, optionalAuth position, route handler pattern
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/create.ts` — submit handler, auth IIFE pattern, error handling, progressive enhancement
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/confirmation.ts` — DOM construction pattern, glassmorphism card styles, navigate() usage
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/components/expiration-select.ts` — current options, component structure
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/components/layout.ts` — footer construction, navigate pattern for nav links, routechange listener
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/router.ts` — route handler pattern for new pages, updatePageMeta, dynamic imports, noindex usage
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/api/client.ts` — ApiError class, fetch patterns, header access
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/analytics/posthog.ts` — event capture patterns, zero-knowledge invariant enforcement
- `/Users/ourcomputer/Github-Repos/secureshare/client/src/pages/register.ts` — existing register page structure, consent copy insertion point
- `/Users/ourcomputer/Github-Repos/secureshare/shared/types/api.ts` — CreateSecretSchema, expiresIn enum
- `/Users/ourcomputer/Github-Repos/secureshare/.planning/INVARIANTS.md` — zero-knowledge enforcement requirements
- `/Users/ourcomputer/Github-Repos/secureshare/.claude/product-marketing-context.md` — brand voice, tier descriptions, upgrade triggers
- `/Users/ourcomputer/Github-Repos/secureshare/.claude/landing-pricing-copy.md` — existing copy patterns, tone examples
- `/Users/ourcomputer/Github-Repos/secureshare/.claude/pricing-strategy.md` — tier limits, upgrade moments, what-to-gate decisions
- `express-rate-limit@8.2.1` installed package — `standardHeaders: 'draft-7'` emits `RateLimit-Remaining` and `RateLimit-Reset` on all responses including 201s; `skip` callback signature is `(req: Request, res: Response) => boolean | Promise<boolean>`

### Secondary (MEDIUM confidence)

- express-rate-limit GitHub README / IETF draft-7 spec — `RateLimit-Reset` is a Unix timestamp in seconds (not relative seconds); client must convert to relative time via `resetTimestamp * 1000 - Date.now()`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing libraries verified in codebase
- Architecture: HIGH — implementation patterns directly derived from existing codebase conventions
- Pitfalls: HIGH — derived from codebase inspection and known project gotchas (STATE.md accumulated decisions)
- Copy decisions: HIGH — directly referenced from locked decisions in CONTEXT.md and .claude/ marketing documents
- Legal content outline: MEDIUM — structure is standard, specific legal language requires human review before launch

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable stack, 30-day window)
