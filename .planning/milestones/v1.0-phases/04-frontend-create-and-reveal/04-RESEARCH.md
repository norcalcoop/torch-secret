# Phase 4: Frontend Create and Reveal - Research

**Researched:** 2026-02-14
**Domain:** Vanilla TypeScript SPA with Vite, Tailwind CSS, Express integration
**Confidence:** HIGH

## Summary

Phase 4 builds the complete user-facing frontend for SecureShare: a secret creation page, a confirmation page with shareable link, and a two-step reveal flow. This is the convergence point where the Phase 1 crypto module, Phase 2 API, and Phase 3 security middleware come together into a working product.

The stack is well-defined by prior decisions: Vite 7.x as the build tool, Tailwind CSS 4.x for styling, and vanilla TypeScript (no framework). The key architectural challenge is integrating the Vite-built SPA with the existing Express server, particularly around CSP nonce injection. Since the Express server already generates per-request nonces via helmet, the production setup must serve the built HTML through Express (not as static files from a CDN) so nonces can be injected on each request. In development, Vite's dev server proxies API requests to Express.

The frontend itself is structurally simple: 3-4 "pages" rendered by swapping DOM content based on URL path. No framework router is needed. The app reads the URL fragment (`#key`) for decryption keys, strips it immediately via `history.replaceState`, and uses the existing `encrypt`/`decrypt` functions from `client/src/crypto/`.

**Primary recommendation:** Use Express as the HTML server in both dev and production. In development, run Vite dev server separately and proxy `/api` to Express. In production, Express serves the Vite build output with per-request nonce replacement in the HTML. Keep routing minimal -- a simple switch on `window.location.pathname` with DOM swapping, no router library.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 7.3.x | Build tool, dev server, HMR | Already decided. Fast, native ESM, TypeScript out of the box |
| Tailwind CSS | 4.1.x | Utility-first CSS framework | Already decided. CSS-first config in v4 (no tailwind.config.js), `@tailwindcss/vite` plugin |
| @tailwindcss/vite | 4.1.x | Vite plugin for Tailwind v4 | Official first-party Vite integration, replaces PostCSS approach |
| TypeScript | 5.9.x | Type safety | Already installed and configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| happy-dom | latest | DOM simulation for frontend unit tests | Vitest environment for testing DOM manipulation code |

### No Additional Libraries Needed

| Concern | Solution | Why No Library |
|---------|----------|----------------|
| Client-side routing | Simple path-based switch + `history.pushState` | Only 3-4 pages; a router library adds unnecessary weight |
| API client | `fetch()` with thin wrapper | Native browser API, no axios/ky needed for 2 endpoints |
| Clipboard | `navigator.clipboard.writeText()` | 97%+ browser support, native API |
| State management | Module-scoped variables | No shared state complexity; each page is self-contained |
| Form validation | Direct DOM validation + Zod (already installed) | Simple forms, no form library needed |

**Installation:**
```bash
npm install -D vite tailwindcss @tailwindcss/vite happy-dom
```

Note: `vite` is a dev dependency (build tool). `tailwindcss` and `@tailwindcss/vite` are also dev dependencies (build-time only -- CSS is compiled to plain CSS at build time).

## Architecture Patterns

### Recommended Project Structure

```
client/
  src/
    crypto/              # Phase 1 (existing) - encrypt/decrypt module
    pages/               # Page render functions (one per "route")
      create.ts          # Landing page: textarea, settings, submit
      confirmation.ts    # Post-creation: shareable link, expiration
      reveal.ts          # Two-step reveal: interstitial -> decrypted secret
      error.ts           # Error states: expired, viewed, invalid
    components/          # Reusable UI pieces
      copy-button.ts     # One-click copy with "Copied!" feedback
      expiration-select.ts  # Dropdown for 1h/24h/7d/30d
      loading-spinner.ts # Loading/encrypting indicator
    api/                 # API client module
      client.ts          # fetch wrapper for POST/GET /api/secrets
    router.ts            # Simple path-based routing
    app.ts               # Entry point: initialize router, mount root
    styles.css           # Tailwind imports and custom theme
  index.html             # SPA shell with CSP nonce placeholder
  vite.config.ts         # Vite + Tailwind plugin config
```

### Pattern 1: Express-Served SPA with CSP Nonce Injection

**What:** Express serves the Vite-built `index.html` in production, replacing a nonce placeholder string with a fresh cryptographic nonce on every request. The same nonce is used in the CSP header (already set by helmet).

**When to use:** Always in production. This is required because the project uses nonce-based CSP (Phase 3).

**How it works:**
1. Vite builds with `html.cspNonce: '__CSP_NONCE__'` -- adds nonce attributes to all script/style/link tags with the placeholder string
2. Express reads the built `index.html` at startup, stores it as a template string
3. On each request, Express generates a nonce (already done by `cspNonceMiddleware`), replaces `__CSP_NONCE__` with the real nonce, and sends the HTML
4. Helmet's CSP header already includes the same nonce via `res.locals.cspNonce`

```typescript
// Production: Express serves index.html with nonce replacement
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML_TEMPLATE = readFileSync(
  resolve(import.meta.dirname, '../client/dist/index.html'),
  'utf-8'
);

// Catch-all route (after API routes, after static assets)
app.get('*', (req, res) => {
  const html = HTML_TEMPLATE.replaceAll('__CSP_NONCE__', res.locals.cspNonce);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
```

### Pattern 2: Simple Path-Based Client Router

**What:** A minimal router that maps URL paths to page render functions. No library needed for 3-4 routes.

**When to use:** Always. This is the app's navigation backbone.

```typescript
// Source: Standard vanilla SPA pattern
type PageRenderer = (container: HTMLElement) => void | Promise<void>;

const routes: Record<string, PageRenderer> = {
  '/': renderCreatePage,
  '/secret/:id': renderRevealPage,
  // Confirmation is navigated to programmatically after creation
};

function navigate(path: string): void {
  history.pushState(null, '', path);
  handleRoute();
}

function handleRoute(): void {
  const path = window.location.pathname;
  const container = document.getElementById('app')!;

  // Clear previous page content safely
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Match routes (simple prefix matching for /secret/:id)
  if (path.startsWith('/secret/')) {
    renderRevealPage(container);
  } else if (path === '/') {
    renderCreatePage(container);
  } else {
    renderErrorPage(container, 'not_found');
  }
}

// Handle browser back/forward
window.addEventListener('popstate', handleRoute);
```

### Pattern 3: Two-Step Reveal Flow (Security Critical)

**What:** When a recipient opens a share link, the app does NOT immediately fetch the secret. It shows an interstitial "Click to Reveal" button. Only after explicit user action does it fetch and decrypt.

**Why:** Prevents prefetch/prerender from consuming the one-time secret. URL preview bots, browser prefetch, and link-in-chat previews would destroy secrets without this protection.

**Flow:**
1. App loads at `/secret/:id#key` -- shell renders, NO API call
2. App reads `window.location.hash` to extract the key, stores in memory
3. App immediately strips the hash: `history.replaceState(null, '', window.location.pathname)`
4. App renders "Click to Reveal" interstitial with the secret ID displayed
5. User clicks "Reveal Secret" button
6. App calls `GET /api/secrets/:id` to fetch ciphertext (atomic delete happens server-side)
7. App decrypts ciphertext using the stored key via `decrypt(ciphertext, key)`
8. App renders the decrypted plaintext with a copy button
9. Key variable is set to `null` (best-effort memory cleanup)

```typescript
// RETR-06: Strip URL fragment immediately after reading
const key = window.location.hash.slice(1); // Remove '#'
history.replaceState(null, '', window.location.pathname + window.location.search);

// Key is now in memory only -- URL bar shows /secret/abc123 with no fragment
```

### Pattern 4: API Client with Type-Safe Responses

**What:** A thin fetch wrapper that types API responses using the shared Zod schemas from `shared/types/api.ts`.

```typescript
// client/src/api/client.ts
import type { CreateSecretResponse, SecretResponse, ErrorResponse } from '../../../shared/types/api';

const BASE = '/api/secrets';

export async function createSecret(
  ciphertext: string,
  expiresIn: '1h' | '24h' | '7d' | '30d'
): Promise<CreateSecretResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, expiresIn }),
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

export async function getSecret(id: string): Promise<SecretResponse> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

### Pattern 5: Copy-to-Clipboard with Visual Feedback

**What:** One-click copy buttons using the Clipboard API with a "Copied!" confirmation that auto-resets.

```typescript
// Source: MDN Clipboard API docs
async function copyToClipboard(text: string, button: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('text-green-600');
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove('text-green-600');
    }, 2000);
  } catch {
    // Fallback: select text in a hidden textarea
    fallbackCopy(text);
  }
}
```

### Anti-Patterns to Avoid

- **Fetching the secret on page load:** The reveal page MUST NOT call the API until the user explicitly clicks "Reveal." Browser prefetch, link previews, and bots would consume the one-time secret.
- **Storing the key in a global/window variable:** Keep the decryption key in a function-scoped variable within the reveal flow. Set to null after decryption.
- **Using element.innerHTML for user-provided content:** The decrypted secret text MUST use `element.textContent` to prevent XSS from crafted secret content. Never insert untrusted content as HTML.
- **Distinguishing error types in the UI when API returns identical errors:** The API intentionally returns the same error for expired/viewed/nonexistent secrets (SECR-07 anti-enumeration). The frontend shows a single generic "not available" message, not different messages per error type. However, client-side checks (no key in URL, malformed ID) can show distinct errors since those don't reveal server state.
- **Caching API responses:** Never cache `GET /api/secrets/:id` responses. Each call atomically destroys the secret.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS framework | Custom CSS system | Tailwind CSS 4.x | Responsive utilities, consistent spacing/colors, tree-shaken output |
| Build tooling | Custom bundler config | Vite 7.x | HMR, TypeScript, CSS processing, production optimization all built-in |
| Clipboard interaction | Custom selection/execCommand | `navigator.clipboard.writeText()` | Native API, 97%+ support, async/promise-based |
| CSP nonce in HTML | Custom HTML templating engine | Vite `html.cspNonce` + string replace | Vite handles all script/style/link tags automatically |
| Form validation | Custom validation logic | Zod schemas (already in shared/types) | Reuse the same schemas the server uses |
| UUID/ID generation | Custom random IDs | nanoid (already installed, server-side) | IDs generated server-side only |

**Key insight:** This phase is an integration phase, not a library-heavy build. The crypto, API, and security pieces already exist. The frontend's job is to wire them together with a clean UI, not introduce new complexity.

## Common Pitfalls

### Pitfall 1: CSP Blocks Inline Scripts/Styles

**What goes wrong:** Vite injects inline scripts for HMR in development, or Tailwind generates inline styles. Helmet's strict CSP blocks them.
**Why it happens:** The CSP is `script-src 'self' 'nonce-xxx'` -- no `unsafe-inline`.
**How to avoid:**
- In development: Vite's dev server runs on a separate port. The browser loads the app directly from Vite (localhost:5173), not through Express. CSP from Express doesn't apply to dev mode.
- In production: Vite's `html.cspNonce` adds nonce to all built script/style tags. Express replaces the placeholder with the real nonce.
- Tailwind v4 with `@tailwindcss/vite` compiles to a CSS file (not inline styles), so CSP `style-src 'self'` is sufficient for the compiled stylesheet. However, the nonce is also on `<link>` tags for module preloading.
**Warning signs:** Blank page in production with CSP violation errors in browser console.

### Pitfall 2: URL Fragment Leakage

**What goes wrong:** The encryption key in the URL fragment (`#base64key`) leaks through referrer headers, JavaScript errors reported to external services, or browser extensions.
**Why it happens:** While HTTP spec says fragments aren't sent to the server, they ARE visible to JavaScript on the page and could leak through other channels.
**How to avoid:**
- Strip the fragment immediately after reading: `history.replaceState(null, '', pathname)`
- Phase 3 already sets `Referrer-Policy: no-referrer` (prevents fragment in referer header)
- Never log `window.location.hash` or include it in error reports
- Never pass the key as a URL parameter (query string) -- only in the fragment
**Warning signs:** Key visible in URL bar after reveal page loads. Key appearing in any network request.

### Pitfall 3: Secret Consumed by Bot/Prefetch

**What goes wrong:** A chat app (Slack, Teams, Discord) or browser prefetcher fetches the reveal URL, triggering the API call and consuming the secret before the real recipient sees it.
**Why it happens:** Bots load URLs to generate previews. If the app fetches the secret on page load, the bot consumes it.
**How to avoid:** The two-step reveal flow (RETR-05). The initial page load renders only the app shell and "Click to Reveal" button. The API call happens only on explicit user interaction (click/tap). Bots render the shell but don't click buttons.
**Warning signs:** Recipients report "secret already viewed" when they haven't opened the link yet.

### Pitfall 4: XSS via Decrypted Secret Content

**What goes wrong:** An attacker creates a secret containing malicious HTML/script content. If the reveal page inserts it as HTML, the script executes.
**Why it happens:** The decrypted text is untrusted user input.
**How to avoid:** Always use `element.textContent = decryptedSecret` (never insert as HTML). Use `<pre>` or `<textarea readonly>` to preserve whitespace formatting. The CSP with nonce-based script-src is a defense-in-depth layer, but `textContent` is the primary defense.
**Warning signs:** HTML tags rendering as formatted content instead of literal text on the reveal page.

### Pitfall 5: Vite Dev Server Proxy Misconfiguration

**What goes wrong:** API calls from the frontend in development get 404s or CORS errors.
**Why it happens:** Vite dev server (port 5173) and Express (port 3000) are different origins. Without proxy config, fetch('/api/secrets') goes to Vite, not Express.
**How to avoid:** Configure `server.proxy` in `vite.config.ts` to forward `/api` requests to Express.
**Warning signs:** 404 responses on API calls in development. CORS errors in browser console.

### Pitfall 6: Clipboard API Requires Secure Context

**What goes wrong:** `navigator.clipboard.writeText()` fails silently or throws in HTTP (non-HTTPS) contexts.
**Why it happens:** The Clipboard API requires a secure context (HTTPS or localhost).
**How to avoid:** Development uses `localhost` (which is a secure context). Production uses HTTPS (enforced by Phase 3). Add a fallback for edge cases using a hidden textarea + `document.execCommand('copy')`.
**Warning signs:** Copy button does nothing on some browsers or environments.

## Code Examples

### Vite Configuration

```typescript
// client/vite.config.ts (or project root with root: 'client')
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  root: 'client',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  html: {
    cspNonce: '__CSP_NONCE__',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### SPA HTML Shell

```html
<!-- client/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="referrer" content="no-referrer" />
  <title>SecureShare</title>
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
  <div id="app" class="max-w-2xl mx-auto px-4 py-8"></div>
  <script type="module" src="/src/app.ts"></script>
</body>
</html>
```

### Tailwind CSS Entry File

```css
/* client/src/styles.css */
@import "tailwindcss";

@theme {
  --color-primary-50: oklch(0.97 0.01 250);
  --color-primary-100: oklch(0.93 0.03 250);
  --color-primary-500: oklch(0.55 0.15 250);
  --color-primary-600: oklch(0.48 0.15 250);
  --color-primary-700: oklch(0.40 0.15 250);
  --color-danger-500: oklch(0.60 0.18 25);
  --color-success-500: oklch(0.65 0.15 145);
}
```

### Express Production Static + HTML Serving

```typescript
// In server/src/app.ts (production additions)
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

// Serve Vite build static assets (JS, CSS, images)
const clientDistPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
app.use(express.static(clientDistPath, { index: false })); // index: false -- we handle HTML ourselves

// Read HTML template once at startup
const htmlTemplate = readFileSync(resolve(clientDistPath, 'index.html'), 'utf-8');

// SPA catch-all: serve index.html with fresh nonce for every request
// MUST be after API routes and static assets
app.get('*', (req, res) => {
  const html = htmlTemplate.replaceAll('__CSP_NONCE__', res.locals.cspNonce);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
```

### Create Page Flow

```typescript
// Pseudocode for create page
import { encrypt } from '../crypto';
import { createSecret } from '../api/client';

async function handleSubmit(text: string, expiresIn: string): Promise<void> {
  // 1. Encrypt in the browser (zero-knowledge)
  const { payload, keyBase64Url } = await encrypt(text);

  // 2. Send encrypted blob to server
  const { id, expiresAt } = await createSecret(payload.ciphertext, expiresIn);

  // 3. Build the shareable URL with key in fragment
  const shareUrl = `${window.location.origin}/secret/${id}#${keyBase64Url}`;

  // 4. Navigate to confirmation page
  navigateToConfirmation(shareUrl, expiresAt);
}
```

### Reveal Page Flow

```typescript
// Pseudocode for reveal page
import { decrypt } from '../crypto';
import { getSecret } from '../api/client';

function renderRevealPage(container: HTMLElement): void {
  // 1. Extract key from fragment IMMEDIATELY
  const key = window.location.hash.slice(1);

  // 2. Strip fragment from URL bar (RETR-06)
  history.replaceState(null, '', window.location.pathname);

  // 3. Extract secret ID from path
  const id = window.location.pathname.split('/').pop()!;

  if (!key) {
    renderError(container, 'Invalid link: missing decryption key');
    return;
  }

  // 4. Show interstitial (RETR-05) -- do NOT fetch yet
  renderInterstitial(container, () => handleReveal(container, id, key));
}

async function handleReveal(
  container: HTMLElement,
  id: string,
  key: string
): Promise<void> {
  try {
    // 5. NOW fetch (triggers atomic delete on server)
    const { ciphertext } = await getSecret(id);

    // 6. Decrypt client-side
    const plaintext = await decrypt(ciphertext, key);

    // 7. Display with textContent (never as HTML!)
    renderDecryptedSecret(container, plaintext);
  } catch (err) {
    renderError(container, 'This secret does not exist, has already been viewed, or has expired.');
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 with tailwind.config.js + PostCSS | Tailwind v4 with @tailwindcss/vite plugin + CSS-first @theme | Jan 2025 (v4.0 release) | No config file needed. Theme defined in CSS. Vite plugin replaces PostCSS setup. |
| Vite html.cspNonce as build-time value | Vite html.cspNonce as placeholder for server replacement | Ongoing (documented pattern) | Must use Express to replace placeholder per request. Static hosting incompatible with nonce CSP. |
| document.execCommand('copy') | navigator.clipboard.writeText() | Widely supported since ~2022 | Async, promise-based, more reliable. execCommand is deprecated but useful as fallback. |
| Hash-based routing (#/page) | History API pushState(/page) | HTML5 standard | Clean URLs, better UX. But requires server-side fallback (Express catch-all). |

**Deprecated/outdated:**
- `document.execCommand('copy')` -- deprecated but still works. Use as fallback only.
- Tailwind CSS v3 PostCSS configuration -- v4 uses `@tailwindcss/vite` plugin instead.
- `tailwind.config.js` -- v4 uses CSS `@theme` directive for customization.

## Development vs Production Architecture

### Development

```
Browser (localhost:5173)
  |
  |-- HTML/CSS/JS --> Vite Dev Server (port 5173, HMR)
  |-- /api/*       --> Vite proxy --> Express (port 3000) --> PostgreSQL
```

- Vite serves HTML directly with its own HMR scripts
- CSP nonce is NOT enforced in dev (Vite's injected scripts would be blocked)
- The `server.proxy` in vite.config.ts forwards `/api` to Express
- Two processes: `npm run dev:server` (Express) + `npm run dev:client` (Vite)

### Production

```
Browser
  |
  |--> Express (single port)
         |-- /api/*   --> API routes --> PostgreSQL
         |-- *.js/css --> express.static(client/dist)
         |-- *        --> index.html with nonce replacement
```

- Express serves everything from one port
- Static assets (JS, CSS) served via `express.static`
- HTML requests get fresh nonce injection via string replacement
- Helmet CSP header matches the nonce in the HTML
- `vite build` must run before deployment

## Testing Strategy

### Frontend Unit Tests

Use Vitest with `happy-dom` environment for DOM manipulation tests:

```typescript
// In test files or via vitest config per-file override
// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
```

Configure in vitest.config.ts with workspace or per-file `@vitest-environment` directive. The existing `node` environment works for crypto tests. Frontend tests that manipulate DOM need `happy-dom`.

### What to Test

| Category | Test Approach |
|----------|--------------|
| Crypto integration | Already tested (Phase 1, node environment) |
| API client | Mock `fetch`, verify request shape and error handling |
| Page rendering | happy-dom: verify DOM structure, element attributes |
| Copy button | Mock `navigator.clipboard`, verify "Copied!" feedback |
| Router | Verify correct page renders for each path |
| URL fragment handling | Verify key extraction and immediate stripping |
| Error states | Verify correct messages for API errors |

### What NOT to Test in Unit Tests

| Category | Why |
|----------|-----|
| Full end-to-end flow | Requires real browser, database, server -- integration/E2E test territory |
| CSS/layout | Visual tests require real rendering; Tailwind is well-tested |
| Actual clipboard writes | Requires secure context; mock the API instead |

## Open Questions

1. **Vite config location and root**
   - What we know: Vite's `root` option determines where it looks for `index.html`. The client code is in `client/`.
   - What's unclear: Should `vite.config.ts` live at project root (with `root: 'client'`) or inside `client/`? Project root is simpler for the proxy config, but `client/vite.config.ts` keeps client concerns isolated.
   - Recommendation: Place at project root with `root: 'client'` for simpler proxy config and single `package.json` scripts. This matches the existing flat monorepo structure.

2. **Confirmation page: separate URL or state-based?**
   - What we know: After creating a secret, the user sees a confirmation with the share link.
   - What's unclear: Should this be a distinct URL (e.g., `/created?id=xxx`) or just a state transition within the create page?
   - Recommendation: Use programmatic state transition (no URL). The confirmation contains the share URL with the key fragment -- putting it in a bookmarkable/refreshable URL would either lose the key or require storing it, both bad. Render confirmation content in the same page lifecycle. If the user refreshes, they return to the create page (the key is gone anyway).

3. **Password field scope**
   - What we know: CREA-03 says "optional password field" on create page. Phase 5 implements password protection server-side.
   - What's unclear: Should Phase 4 include the password field UI even though Phase 5 isn't done yet?
   - Recommendation: Include the password field UI in Phase 4 (collapsed under "Advanced options"), but make it non-functional -- visually present but either disabled or with a tooltip "Coming soon." This prevents a Phase 5 UI rework. The alternative is to add it entirely in Phase 5.

## Sources

### Primary (HIGH confidence)
- [Vite Getting Started](https://vite.dev/guide/) -- confirmed Vite 7.3.1, Node 20.19+ required, vanilla-ts template
- [Vite Server Options](https://vite.dev/config/server-options) -- proxy configuration for dev server
- [Vite Features: CSP Nonce](https://vite.dev/guide/features) -- html.cspNonce placeholder pattern
- [Vite Backend Integration](https://vite.dev/guide/backend-integration) -- Express middleware mode, manifest.json
- [Vite SSR Guide](https://vite.dev/guide/ssr) -- createViteDevServer, middleware mode API
- [Tailwind CSS Vite Guide](https://tailwindcss.com/docs/guides/vite) -- @tailwindcss/vite plugin, @import "tailwindcss"
- [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme) -- @theme directive syntax, CSS-first configuration
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) -- writeText() browser support, secure context requirement
- npm registry -- confirmed versions: vite@7.3.1, tailwindcss@4.1.18, @tailwindcss/vite@4.1.18

### Secondary (MEDIUM confidence)
- [Vite CSP Nonce Issue #20531](https://github.com/vitejs/vite/issues/20531) -- clarifies html.cspNonce is a placeholder for server replacement, not a build-time value
- [Plain Vanilla Web: Clean Client-Side Routing](https://plainvanillaweb.com/blog/articles/2025-06-25-routing/) -- modern vanilla JS routing patterns
- [MDN history.replaceState](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState) -- URL fragment stripping pattern

### Tertiary (LOW confidence)
- [Vitest happy-dom discussion](https://github.com/vitest-dev/vitest/discussions/1607) -- happy-dom vs jsdom performance comparison (community anecdotal)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- versions verified against npm registry, official docs confirm all patterns
- Architecture: HIGH -- patterns are standard (Express + Vite, SPA with vanilla JS, CSP nonce injection)
- Pitfalls: HIGH -- CSP nonce, fragment leakage, and bot-consumption are well-documented concerns with established solutions
- Testing: MEDIUM -- happy-dom vs jsdom choice is preference-based; DOM testing of vanilla TS is less standardized than framework testing

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days -- stable stack, no fast-moving dependencies)
