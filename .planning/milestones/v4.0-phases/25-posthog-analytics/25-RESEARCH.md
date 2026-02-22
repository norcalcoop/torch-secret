# Phase 25: PostHog Analytics - Research

**Researched:** 2026-02-20
**Domain:** Client-side analytics SDK integration with zero-knowledge privacy constraints
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLT-01 | Application tracks funnel events via PostHog without collecting PII, secret content, or encryption keys | `before_send` hook strips all URL fragments at init time; `autocapture: false` and `disable_session_recording: true` prevent passive PII collection; manual `posthog.capture()` calls control exactly what is sent |
| ANLT-02 | URL fragment (#encryption-key) is stripped from all captured event properties before PostHog transmission (sanitize_properties configuration is mandatory) | `before_send` is the current API (not `sanitize_properties` — that name is legacy); strips `$current_url` and `$referrer` fragments via regex; applies to every event including automatic pageview capture |
| ANLT-03 | Authenticated users are identified in PostHog by user ID (not email or other PII) after login, enabling funnel analysis across anonymous and authenticated sessions | `posthog.identify(userId)` with no additional properties satisfies this; `posthog.reset()` on logout regenerates anonymous ID; zero-knowledge invariant satisfied because identify call contains only userId (no secretId ever) |
</phase_requirements>

---

## Summary

PostHog provides a first-class JavaScript browser SDK (`posthog-js`) installable via npm and bundleable with Vite, which is the correct approach for this project. The npm/ESM route means posthog is bundled into the Vite output — no separate CDN script injection occurs, which keeps the existing nonce-based CSP intact with only one change required: adding `*.posthog.com` (or the specific region domain) to `connect-src` in the Helmet configuration.

The requirement text uses the phrase `sanitize_properties`, but the current PostHog JS API uses `before_send` for this purpose. The `before_send` hook is a synchronous function called for every event before transmission and is the canonical modern pattern. It must strip the URL fragment (`#...`) from `$current_url` and `$referrer` in every event, because the URL fragment on reveal-page URLs (`/secret/:id#base64key`) contains the AES-256-GCM encryption key.

The zero-knowledge invariant (no `userId` + `secretId` in the same payload) governs which events can be captured and how. Secret funnel events (`secret_created`, `secret_viewed`) must never include `userId` — they can only contain non-identifying metadata (expiration tier, whether password was set). User events (`user_registered`, `user_logged_in`) must never include `secretId`. Separate event types prevent correlation.

**Primary recommendation:** Use `posthog-js@^1.352.0` via npm import in `client/src/analytics/posthog.ts`. Initialize in `app.ts` with `autocapture: false`, `disable_session_recording: true`, `capture_pageview: false` (manual SPA tracking), and a `before_send` hook that strips URL fragments from `$current_url` and `$referrer` on every event.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `posthog-js` | `^1.352.0` (latest as of research date) | PostHog browser analytics SDK | Official PostHog browser SDK; ESM-compatible; bundles cleanly with Vite; TypeScript types included |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None additional | — | — | No wrapper needed; direct posthog-js API is sufficient for vanilla TS project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `posthog-js` npm import | CDN snippet in `<head>` | CDN snippet injects its own `<script>` tag dynamically, requiring `script-src` CSP changes; npm bundle avoids this entirely |
| `posthog-js` | `posthog-js-lite` | posthog-js-lite is a cut-down package that was moved back into the main posthog-js repo; standard posthog-js is the correct choice |

**Installation:**
```bash
npm install posthog-js
```

---

## Architecture Patterns

### Recommended Project Structure

```
client/src/
├── analytics/
│   └── posthog.ts        # PostHog init, before_send, capture helpers, identify, reset
└── app.ts                # Calls initAnalytics() at startup
```

A single `analytics/posthog.ts` module encapsulates all PostHog interaction. Pages and components import named capture functions from this module. This isolates all analytics logic and makes it easy to stub in tests.

### Pattern 1: Initialization with before_send Fragment Stripping

**What:** Initialize PostHog once at app startup with privacy-safe defaults and a `before_send` hook that strips URL fragments from every event.

**When to use:** Called once in `app.ts` inside the `DOMContentLoaded` listener, after `initThemeListener()`, `createLayoutShell()`, and `initRouter()`.

**Example:**
```typescript
// Source: Context7 /posthog/posthog.com — contents/docs/product-analytics/privacy.mdx
// Source: Context7 /posthog/posthog-js — llms.txt (initialization docs)
import posthog, { type CaptureResult } from 'posthog-js';

/**
 * Strip URL fragment from a URL string.
 * Fragment contains AES-256-GCM encryption key on reveal-page URLs.
 * Returns null if input is not a string.
 */
function stripFragment(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    // Relative URLs or non-URL strings: strip fragment with regex
    return value.replace(/#.*$/, '');
  }
}

/**
 * before_send hook: strip URL fragments from $current_url and $referrer
 * before any event is transmitted to PostHog.
 *
 * This is the MANDATORY guard against AES-256-GCM key leakage.
 * Reveal-page URLs are /secret/:id#base64key — the fragment is the key.
 */
function sanitizeEventUrls(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;

  if (event.properties['$current_url']) {
    event.properties['$current_url'] = stripFragment(event.properties['$current_url']);
  }
  if (event.properties['$referrer']) {
    event.properties['$referrer'] = stripFragment(event.properties['$referrer']);
  }
  if (event.properties['$initial_referrer']) {
    event.properties['$initial_referrer'] = stripFragment(event.properties['$initial_referrer']);
  }

  return event;
}

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com';

  // Skip initialization if no key (dev/test environments)
  if (!key) return;

  posthog.init(key, {
    api_host: host,
    autocapture: false,             // No passive DOM event capture
    disable_session_recording: true, // Out of scope per REQUIREMENTS.md
    capture_pageview: false,        // Manual SPA pageview tracking
    capture_pageleave: false,       // Disable pageleave (requires capture_pageview)
    before_send: sanitizeEventUrls,
  });
}
```

### Pattern 2: Manual SPA Pageview Capture

**What:** Capture `$pageview` events manually on each SPA route change, after the URL fragment has already been stripped from the address bar (the reveal page strips the fragment in `renderRevealPage()` before any rendering).

**When to use:** In `router.ts` `handleRoute()` function after the route is matched, or in `analytics/posthog.ts` as a `capturePageview()` helper called from the router.

**Note on timing:** The reveal page (`renderRevealPage`) calls `history.replaceState` to strip the fragment from the URL bar *before* any rendering or PostHog capture. By the time any PostHog event fires, `window.location.href` no longer contains the fragment. The `before_send` hook is a belt-and-suspenders guard, but the timing is already safe.

```typescript
// Source: Context7 /posthog/posthog-js — llms.txt (capture_pageview: false + manual pageview)
export function capturePageview(): void {
  if (!isInitialized()) return;
  posthog.capture('$pageview', {
    $current_url: window.location.href, // Fragment already stripped by reveal page
  });
}
```

### Pattern 3: Funnel Event Capture (Zero-Knowledge Safe)

**What:** Named capture functions for each funnel event. Each function is scoped to contain only the data that is safe to send per the zero-knowledge invariant.

**Critical constraint:** Secret events must NEVER contain `userId`. User events must NEVER contain `secretId`.

```typescript
// Source: Context7 /posthog/posthog-js — llms.txt (capture events docs)

/** Fired after the encrypted ciphertext is successfully POSTed to /api/secrets */
export function captureSecretCreated(expiresIn: string, hasPassword: boolean): void {
  if (!isInitialized()) return;
  // ZERO-KNOWLEDGE INVARIANT: no userId, no secretId, no ciphertext
  posthog.capture('secret_created', {
    expires_in: expiresIn,       // e.g. '1h', '24h', '7d', '30d'
    has_password: hasPassword,   // boolean — passphrase was set
  });
}

/** Fired when the plaintext secret is successfully decrypted and displayed */
export function captureSecretViewed(): void {
  if (!isInitialized()) return;
  // ZERO-KNOWLEDGE INVARIANT: no userId, no secretId
  posthog.capture('secret_viewed');
}

/** Fired after user successfully registers a new account */
export function captureUserRegistered(method: 'email' | 'google' | 'github'): void {
  if (!isInitialized()) return;
  // No secretId — registration is separate from secret creation
  posthog.capture('user_registered', { method });
}

/** Fired after user successfully logs in */
export function captureUserLoggedIn(method: 'email' | 'google' | 'github'): void {
  if (!isInitialized()) return;
  posthog.capture('user_logged_in', { method });
}
```

### Pattern 4: Identify and Reset (ANLT-03)

**What:** Call `posthog.identify(userId)` after login to link the anonymous session to the known user ID. Call `posthog.reset()` on logout to generate a new anonymous distinct ID for the next anonymous session.

**Critical:** Pass only `userId` (the internal database ID) — never email, name, or any PII. This satisfies ANLT-03 and the privacy policy promise.

```typescript
// Source: Context7 /posthog/posthog-js — llms.txt (identify and manage users docs)

/** Called after successful login. Links anonymous session to userId. */
export function identifyUser(userId: string): void {
  if (!isInitialized()) return;
  // ZERO-KNOWLEDGE INVARIANT: userId only — no email, no name, no secretId
  posthog.identify(userId);
}

/** Called on logout. Generates new anonymous distinct ID. */
export function resetAnalyticsIdentity(): void {
  if (!isInitialized()) return;
  posthog.reset();
}
```

### Anti-Patterns to Avoid

- **Anti-pattern: `posthog.identify(userId, { email, name })`:** Passing PII properties to identify violates the privacy promise and ANLT-03. Pass only the user ID, no additional properties.
- **Anti-pattern: Calling `posthog.capture('secret_created', { userId, secretId })`:** Combining userId and secretId in any event violates the zero-knowledge invariant. These must be separate events with separate scopes.
- **Anti-pattern: Using the CDN snippet approach:** The snippet dynamically injects a `<script>` tag without a CSP nonce, which would be blocked by the existing strict CSP. Use the npm import.
- **Anti-pattern: `autocapture: true`:** Autocapture would capture DOM interactions including the create-page textarea while the user is typing their plaintext secret. Plaintext must NEVER reach PostHog.
- **Anti-pattern: `disable_session_recording: false` (the default):** Session recording is explicitly out of scope (REQUIREMENTS.md Out of Scope section: "Session recording (PostHog): Privacy violation — create form contains sensitive plaintext before encryption"). Session recording MUST be disabled.
- **Anti-pattern: `capture_pageview: true` (the default):** Automatic pageview capture fires on `history.pushState` — this can race with the reveal page's fragment-stripping. Manual pageview capture after the route is settled is safer.
- **Anti-pattern: Sharing the `posthog` default export between modules by re-initializing:** Call `posthog.init()` exactly once in `app.ts`. All other modules call the named capture functions from `analytics/posthog.ts`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Analytics event queue + retry | Custom fetch wrapper with retries | `posthog-js` built-in batching | PostHog SDK batches events, handles offline/retry, manages distinct IDs and session IDs automatically |
| Anonymous → identified user linking | Browser localStorage session tracking | `posthog.identify()` + `posthog.reset()` | PostHog's alias/identify system handles the anonymous-to-identified transition with correct funnel attribution |
| Feature flags / A/B tests | Custom localStorage toggle system | PostHog feature flags (future) | Already included in posthog-js; no extra cost if needed in v5.0 |

**Key insight:** The PostHog SDK handles the hard parts: batching, distinct IDs, session continuity, and anonymous-to-identified linking. The only custom code needed is the `before_send` sanitizer and named capture wrapper functions.

---

## Common Pitfalls

### Pitfall 1: `sanitize_properties` vs `before_send`

**What goes wrong:** The REQUIREMENTS.md (written before this research) uses the phrase `sanitize_properties` as the configuration option name. This name does not exist in the current posthog-js API. Using it silently fails — PostHog ignores unknown config keys and URL fragments reach PostHog servers.

**Why it happens:** `sanitize_properties` was used in older PostHog documentation and some older blog posts. The current API uses `before_send`.

**How to avoid:** Use `before_send` (verified against Context7 /posthog/posthog.com — contents/docs/product-analytics/privacy.mdx and contents/docs/privacy/data-collection.mdx). The `before_send` function receives a `CaptureResult | null` and must return the modified event or `null` to drop it.

**Warning signs:** If PostHog events appear in the dashboard with `$current_url` containing `#...` fragments, the sanitizer is not firing.

### Pitfall 2: URL Fragment Already Stripped vs. Belt-and-Suspenders

**What goes wrong:** The reveal page (`renderRevealPage`) does `history.replaceState(null, '', pathname + search)` which strips `#key` from the address bar before any PostHog capture. However, PostHog captures `$current_url` from `document.location.href` at event time. If a pageview fires before `replaceState`, the key is in `$current_url`.

**Why it happens:** The `$pageview` event from autocapture (if enabled) fires on `history.pushState` — before the reveal page has had a chance to strip the fragment.

**How to avoid:** Two defenses in combination: (1) `capture_pageview: false` prevents automatic pageview on route change; (2) `before_send` strips fragments from all events regardless of timing. Together they guarantee no fragment reaches PostHog.

### Pitfall 3: CSP `connect-src` Blocks PostHog API Calls

**What goes wrong:** After initialization, `posthog.capture()` calls will silently fail because the current Helmet CSP has `connectSrc: ["'self'"]` only. All requests to `us.i.posthog.com` (or the configured API host) are blocked by the browser's CSP enforcement. Events appear to fire in code but are never received by PostHog.

**Why it happens:** `connect-src` governs `fetch()` and `XMLHttpRequest` calls. PostHog uses these for event transmission.

**How to avoid:** Add the PostHog API host to `connectSrc` in `server/src/middleware/security.ts`. The PostHog-recommended approach is `*.posthog.com` to cover all their routing infrastructure. For production, the specific value depends on whether using US (`us.i.posthog.com`) or EU (`eu.i.posthog.com`) cloud. The `VITE_POSTHOG_HOST` env var drives which region is used.

**CSP directive to add:**
```typescript
// In security.ts createHelmetMiddleware():
connectSrc: [
  "'self'",
  'https://us.i.posthog.com',      // or VITE_POSTHOG_HOST value
  'https://us-assets.i.posthog.com',
],
```

**Note:** The CSP `connectSrc` is set at build time in server middleware, but the actual PostHog host is a client-side env var. In production, these must match. The simplest approach: always add the US host (default) and document that EU cloud requires a separate CSP update.

**Bigger picture:** Since `VITE_POSTHOG_HOST` is a client-side variable, the security.ts CSP needs to be updated to match whatever value is configured. A reasonable approach is to add the PostHog domain to the CSP only in production (check `env.NODE_ENV`) or make it configurable via a server-side env var as well. The simpler approach given project conventions: add both `us.i.posthog.com` and `us-assets.i.posthog.com` unconditionally (PostHog API keys are public-safe; the domain is not a secret).

### Pitfall 4: PostHog npm Import Does Not Inject a `<script>` Tag

**What goes wrong:** Some sources describe PostHog initialization as injecting a `<script>` tag that loads from a CDN. This is the "snippet" approach. When using `import posthog from 'posthog-js'` with Vite, posthog is bundled into the output JS chunk — no script tag is dynamically injected. The existing CSP nonce mechanism is not affected.

**Why it happens:** PostHog has two integration methods: (1) HTML snippet (CDN, injects script) and (2) npm package (bundled). Project documentation often conflates them.

**How to avoid:** Confirmed that `import posthog from 'posthog-js'` uses the npm package route. Vite bundles it. The `script-src` CSP does NOT need a PostHog CDN domain. Only `connect-src` requires updating.

### Pitfall 5: `$referrer` Can Contain a Fragment

**What goes wrong:** Even with `before_send` stripping `$current_url`, `$referrer` and `$initial_referrer` can contain URL fragments. A user who bookmarks a reveal URL and navigates to it from the bookmark may have a `$referrer` that contains `#key`.

**Why it happens:** The browser's `document.referrer` is used by PostHog for the `$referrer` property. If a user navigated from a page whose URL had a fragment (e.g., a previous reveal URL before fragment-stripping), it could appear in the referrer.

**How to avoid:** The `before_send` hook must strip fragments from `$referrer` and `$initial_referrer` in addition to `$current_url`. All three URL properties must be sanitized.

### Pitfall 6: Zero-Knowledge Invariant in Analytics Events

**What goes wrong:** A developer adds `posthog.capture('secret_created', { userId: currentUser?.id, ... })` to attribute secret creation to a user for funnel analysis. This violates the zero-knowledge invariant — both `userId` and `secretId` would be available in the same PostHog session/event stream.

**Why it happens:** The business goal (funnel analysis) naturally pushes toward combining user + secret data.

**How to avoid:** Secret events (`secret_created`, `secret_viewed`) must have zero user identity properties. User identification via `posthog.identify(userId)` means PostHog can already correlate events in a session with the identified user — but this correlation happens in PostHog's backend for aggregate analytics, not in the event payload itself. The event payload for a secret action must not reference `userId`.

**The correct pattern:** `posthog.identify(userId)` sets the distinct ID for the session. Subsequent `posthog.capture('secret_created', { expires_in, has_password })` events are implicitly attributed to that session's distinct ID by PostHog's infrastructure. No explicit `userId` property in the event body is needed or safe.

### Pitfall 7: `import.meta.env.VITE_POSTHOG_KEY` Type Safety

**What goes wrong:** TypeScript complains that `VITE_POSTHOG_KEY` is not defined in `ImportMetaEnv`, or worse, the code proceeds with `undefined` as the key and initializes PostHog with `undefined`.

**How to avoid:** Add a `vite-env.d.ts` type augmentation. Guard the init with `if (!key) return` to skip analytics in dev/test when no key is configured.

```typescript
// client/src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

---

## Code Examples

Verified patterns from official sources:

### Initialization (posthog.com docs — before_send)

```typescript
// Source: Context7 /posthog/posthog.com — contents/docs/product-analytics/privacy.mdx
import posthog, { type CaptureResult } from 'posthog-js';

posthog.init('<ph_project_api_key>', {
  api_host: 'https://us.i.posthog.com',
  autocapture: false,
  disable_session_recording: true,
  capture_pageview: false,
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (!event) return null;
    if (event.properties['$current_url']) {
      event.properties['$current_url'] = (event.properties['$current_url'] as string)
        .replace(/#.*$/, '');
    }
    if (event.properties['$referrer']) {
      event.properties['$referrer'] = (event.properties['$referrer'] as string)
        .replace(/#.*$/, '');
    }
    return event;
  },
});
```

### Identify User (posthog-js README)

```typescript
// Source: Context7 /posthog/posthog-js — packages/web/README.md
// Called after login with user ID (not email)
posthog.identify('my-internal-user-id');

// Called on logout
posthog.reset();
```

### Manual Pageview Capture

```typescript
// Source: Context7 /posthog/posthog-js — llms.txt (capture_pageview: false pattern)
// Called in router.ts handleRoute() after route change
posthog.capture('$pageview', {
  $current_url: window.location.href,
});
```

### TypeScript Type for CaptureResult

```typescript
// Source: Context7 /posthog/posthog.com — contents/tutorials/hash-based-routing.md
import posthog, { CaptureResult } from 'posthog-js';

// CaptureResult is the type for the before_send parameter
// before_send: (event: CaptureResult | null): CaptureResult | null => { ... }
```

---

## Integration Points in the Existing Codebase

Based on codebase analysis, here is where each event fires and what already exists:

| Event | Firing Location | Current Code | Notes |
|-------|----------------|--------------|-------|
| `secret_created` | `client/src/pages/create.ts` submit handler | After `renderConfirmationPage()` call on line ~346 | Fire after `renderConfirmationPage()` so the URL is no longer in `shareUrl` scope |
| `secret_viewed` | `client/src/pages/reveal.ts` `renderRevealedSecret()` | Line ~344 (after terminal block render) | Fragment already stripped by `history.replaceState` on line 44 |
| `user_registered` | `client/src/pages/register.ts` | After successful `signUp()` call | Method: 'email' for form, 'google'/'github' for OAuth |
| `user_logged_in` | `client/src/pages/login.ts` | After successful `signIn()` call | Method: 'email' for form, 'google'/'github' for OAuth |
| `$pageview` | `client/src/router.ts` `handleRoute()` | Fires on every route change | Route dispatch is the right place; fires after `updatePageMeta()` |
| `identifyUser()` | `client/src/pages/login.ts` / `client/src/pages/register.ts` | After successful auth | Must call with user ID from `/api/me` or auth callback response |
| `resetAnalyticsIdentity()` | `client/src/components/layout.ts` | In signOut handler | After `authClient.signOut()` completes |

**`initAnalytics()` call location:** Inside `DOMContentLoaded` in `app.ts`, after `initThemeListener()` and before `createLayoutShell()` / `initRouter()`.

---

## CSP Changes Required

The existing CSP in `server/src/middleware/security.ts` `createHelmetMiddleware()` must add PostHog to `connectSrc`:

```typescript
// BEFORE:
connectSrc: ["'self'"],

// AFTER:
connectSrc: [
  "'self'",
  'https://us.i.posthog.com',
  'https://us-assets.i.posthog.com',
],
```

No `script-src` changes are required (npm bundle approach, not CDN snippet).
No `style-src` changes are required (toolbar is not used).

---

## Environment Variables Required

Two new client-side (Vite-exposed) env vars:

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_POSTHOG_KEY` | Yes (production) | PostHog project API key | `phc_xxxxxxxxxxxxxxxx` |
| `VITE_POSTHOG_HOST` | No | PostHog API host (defaults to US cloud) | `https://us.i.posthog.com` |

These go in `.env` (gitignored) and `.env.example`. They are `VITE_` prefixed so Vite injects them into the client bundle. PostHog API keys are designed to be public (client-side use is their intended purpose).

No server-side env vars are needed — PostHog is client-only for this phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sanitize_properties` config option | `before_send` callback | posthog-js v1.x (current) | Code using `sanitize_properties` silently does nothing |
| `disable_session_recording: true` flag | Same — still valid | — | No change |
| `capture_pageview: 'history_change'` | Valid; `false` + manual is safer for this use case | — | Manual is more predictable than history_change for SPA with fragment stripping |

**Deprecated/outdated:**
- `sanitize_properties`: This option name is referenced in REQUIREMENTS.md but does NOT exist in the posthog-js API. `before_send` is the correct implementation.

---

## Open Questions

1. **PostHog project setup**
   - What we know: A PostHog API key (`VITE_POSTHOG_KEY`) is required before any events flow. PostHog Cloud (US) at `us.i.posthog.com` is the standard destination.
   - What's unclear: Whether a PostHog project/account exists or needs to be created by the developer. This is out of scope for the implementation but required to verify events.
   - Recommendation: Document in `.env.example` that `VITE_POSTHOG_KEY` must be obtained from posthog.com. Analytics silently skips init when the key is absent (safe default for dev).

2. **EU vs US cloud region**
   - What we know: Default is US (`us.i.posthog.com`). EU cloud (`eu.i.posthog.com`) requires GDPR compliance but offers EU data residency.
   - What's unclear: Which region the project will use.
   - Recommendation: Default to US cloud in implementation. Document EU as an option via `VITE_POSTHOG_HOST`. The CSP `connect-src` would need to be adjusted accordingly.

3. **`$pageview` timing relative to `updatePageMeta()`**
   - What we know: `updatePageMeta()` updates `document.title` synchronously. `handleRoute()` dispatches dynamic page module imports asynchronously.
   - What's unclear: Whether `$pageview` should fire synchronously in `handleRoute()` (capturing the new route URL before the module loads) or inside the loaded module (capturing after render).
   - Recommendation: Fire `capturePageview()` synchronously in `handleRoute()` immediately after `updatePageMeta()`. The URL is already correct at that point (it was set by `history.pushState` before `handleRoute` runs). The fragment on reveal pages is stripped *within* `renderRevealPage()` but `$pageview` fires before that. The `before_send` hook handles the fragment strip on the reveal `$pageview` as a result.

4. **`identify` timing — from session or from auth callbacks**
   - What we know: `posthog.identify(userId)` needs the userId. The login page uses `authClient.signIn()` which does not currently return user data in the response we inspect.
   - What's unclear: The cleanest way to get userId immediately after login/register without an extra `/api/me` call.
   - Recommendation: After successful signIn/signUp, call `/api/me` to retrieve the userId (the request is already pattern-established in `dashboard.ts`), then call `identifyUser(userId)`. Alternatively, check if `authClient.getSession()` returns the userId immediately after login (it likely does since the session cookie is set).

---

## Sources

### Primary (HIGH confidence)
- Context7 `/posthog/posthog-js` — initialization, identify/reset, capture events API, before_send
- Context7 `/posthog/posthog.com` — before_send with URL sanitization patterns (`contents/docs/product-analytics/privacy.mdx`, `contents/docs/privacy/data-collection.mdx`, `contents/tutorials/web-redact-properties.md`, `contents/docs/libraries/js/usage.mdx`)
- Codebase analysis — `client/src/pages/reveal.ts` (fragment stripping pattern), `server/src/middleware/security.ts` (CSP structure), `vite.config.ts` (nonce mechanism), `client/src/app.ts` (init sequence), `server/src/config/env.ts` (env schema pattern)

### Secondary (MEDIUM confidence)
- npm registry (`npm show posthog-js version`) — confirmed version 1.352.0 as of 2026-02-20
- GitHub issue PostHog/posthog-js #1918 — confirmed `unsafe-eval` CSP issue is resolved; toolbar requires style-src addition but event capture does not; posthog-js does not need unsafe-eval for event capture

### Tertiary (LOW confidence)
- WebSearch results on CSP connect-src domains — `*.posthog.com` wildcard recommended by PostHog team; `us.i.posthog.com` and `us-assets.i.posthog.com` specific domains confirmed; marked LOW because the routing infrastructure note from the PostHog team ("we recommend a permissive CSP") was in a GitHub issue, not official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — posthog-js npm import confirmed; version 1.352.0 from npm registry; ESM/Vite compatibility confirmed
- Architecture: HIGH — before_send hook verified in official docs; zero-knowledge event schema derived from INVARIANTS.md which is a locked project constraint; CSP changes are well-understood
- Pitfalls: HIGH for sanitize_properties naming (confirmed in docs); MEDIUM for connect-src specifics (npm registry URL pattern confirmed, specific subdomains from GitHub issue discussion)

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (PostHog SDK is fast-moving; before_send API has been stable for ~1 year but verify version on install)
