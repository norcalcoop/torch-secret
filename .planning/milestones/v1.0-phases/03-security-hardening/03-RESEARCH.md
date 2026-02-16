# Phase 3: Security Hardening - Research

**Researched:** 2026-02-14
**Domain:** HTTP security headers, rate limiting, HTTPS enforcement, CORS policy
**Confidence:** HIGH

## Summary

Phase 3 adds five HTTP-level security protections to the Express 5.x server before the frontend goes live in Phase 4. The core stack is **helmet 8.x** for security headers (CSP with nonce, HSTS, Referrer-Policy), **express-rate-limit 8.x** for IP-based rate limiting, and a small custom HTTPS redirect middleware. CORS same-origin enforcement requires no external package -- simply not installing the `cors` middleware means Express sends no CORS headers, and browsers enforce same-origin by default.

The most architecturally significant decision is how CSP nonces integrate with Vite in Phase 4. Vite supports a `html.cspNonce` placeholder that the server replaces at request time. Phase 3 must generate per-request nonces and set CSP headers, and Phase 4 will read the HTML file from Vite's build output and replace placeholders before serving. This means Phase 3 sets up the nonce generation middleware and helmet CSP configuration, and Phase 4 wires it into the HTML serving layer. The two phases are deliberately separated: Phase 3 ensures all API responses carry correct security headers; Phase 4 handles HTML template injection.

All recommended libraries are well-established (millions of weekly npm downloads), actively maintained, and compatible with Express 5.x. Testing uses the existing Supertest + Vitest pattern -- security headers are trivially assertable on response objects.

**Primary recommendation:** Use helmet 8.x with nonce-generating middleware, express-rate-limit 8.x with in-memory store (Redis deferred to production scaling), and a custom HTTPS redirect middleware conditioned on `NODE_ENV === 'production'`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| helmet | ^8.1.0 | Security headers (CSP, HSTS, Referrer-Policy, X-Content-Type-Options, etc.) | 2M+ weekly downloads, official Express recommendation, sets 15 headers in one call |
| express-rate-limit | ^8.2.1 | IP-based rate limiting on POST /api/secrets | 10M+ weekly downloads, Express ecosystem standard, TypeScript-first |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rate-limit-redis | ^4.3.1 | Redis-backed store for express-rate-limit | Production with multiple server instances (DEFERRED -- use MemoryStore for now) |
| ioredis | latest | Redis client for rate-limit-redis | When rate-limit-redis is needed (DEFERRED) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| helmet | Manual header setting | Helmet covers 15 headers with sensible defaults; hand-rolling misses edge cases and requires ongoing maintenance |
| express-rate-limit | rate-limiter-flexible | rate-limiter-flexible is more powerful (Redis built-in, multiple algorithms) but overkill for a single endpoint with simple requirements |
| cors package | No package (same-origin default) | Not installing `cors` means Express sends no CORS headers, browsers enforce same-origin by default. Simpler and more secure for same-origin-only apps |

**Installation:**
```bash
npm install helmet express-rate-limit
```

No other packages needed. The `cors` npm package is intentionally NOT installed.

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── middleware/
│   ├── security.ts        # helmet config, CSP nonce generation, HTTPS redirect
│   ├── rate-limit.ts      # express-rate-limit configuration
│   ├── logger.ts          # (existing)
│   ├── validate.ts        # (existing)
│   └── error-handler.ts   # (existing)
├── app.ts                 # Wire middleware in correct order
└── config/env.ts          # Add RATE_LIMIT_* env vars (optional)
```

### Pattern 1: Middleware Registration Order
**What:** Security middleware must be registered in a specific order in `app.ts`
**When to use:** Always -- order matters for correctness
**Example:**
```typescript
// Source: Express best practices + helmet docs
export function buildApp() {
  const app = express();

  // 1. Trust proxy (MUST be first -- affects req.ip for rate limiting and req.secure for HTTPS redirect)
  app.set('trust proxy', 1);

  // 2. HTTPS redirect (before any response processing)
  app.use(httpsRedirect);

  // 3. CSP nonce generation (before helmet, so nonce is available)
  app.use(cspNonceMiddleware);

  // 4. Helmet (security headers including CSP with nonce)
  app.use(helmetMiddleware);

  // 5. Rate limiting (on specific routes, not global)
  // Applied directly to POST /api/secrets route

  // 6. Logging, body parsing, routes, error handler (existing)
  app.use(httpLogger);
  app.use(express.json({ limit: '100kb' }));
  app.use('/api/secrets', secretsRouter);
  app.use(errorHandler);

  return app;
}
```

### Pattern 2: Per-Request CSP Nonce Generation
**What:** Generate a unique nonce for every request, store in `res.locals.cspNonce`, reference in helmet CSP config via function
**When to use:** Every response that may include HTML with inline scripts
**Example:**
```typescript
// Source: https://helmetjs.github.io/faq/csp-nonce-example/
import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function cspNonceMiddleware(req: Request, res: Response, next: NextFunction): void {
  crypto.randomBytes(32, (err, randomBytes) => {
    if (err) {
      next(err);
      return;
    }
    res.locals.cspNonce = randomBytes.toString('hex');
    next();
  });
}
```

### Pattern 3: Route-Scoped Rate Limiting
**What:** Apply rate limiter only to secret creation endpoint, not globally
**When to use:** When only specific endpoints need throttling
**Example:**
```typescript
// Source: express-rate-limit docs
import { rateLimit } from 'express-rate-limit';

export const createSecretLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  limit: 10,                   // 10 requests per window per IP
  standardHeaders: 'draft-7',  // RateLimit header
  legacyHeaders: false,        // Disable X-RateLimit-* headers
  message: {
    error: 'rate_limited',
    message: 'Too many secrets created. Please try again later.',
  },
});

// In routes:
secretsRouter.post('/', createSecretLimiter, validateBody(CreateSecretSchema), async (req, res) => { ... });
```

### Pattern 4: Conditional HTTPS Redirect
**What:** Redirect HTTP to HTTPS only in production, skip in development/test
**When to use:** Production deployments behind a reverse proxy
**Example:**
```typescript
// Source: Express behind proxies guide
import type { Request, Response, NextFunction } from 'express';

export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  // Skip in development/test (no TLS termination locally)
  if (process.env.NODE_ENV !== 'production') {
    next();
    return;
  }

  // req.secure is true when X-Forwarded-Proto is 'https' (with trust proxy enabled)
  if (!req.secure) {
    res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
    return;
  }

  next();
}
```

### Anti-Patterns to Avoid
- **Global rate limiting:** Don't apply rate limiter to all routes -- GET /api/secrets/:id should not be rate-limited (it's a one-time operation). Only POST /api/secrets needs throttling.
- **Using `cors()` with no arguments:** This sets `Access-Control-Allow-Origin: *`, which is the opposite of what we want. For same-origin-only, don't use the cors package at all.
- **Static CSP nonce:** Never hardcode or reuse a nonce value. It MUST be regenerated per request via `crypto.randomBytes()`.
- **HTTPS redirect in development:** Causes infinite redirect loops when running locally without TLS. Always condition on `NODE_ENV`.
- **Placing helmet after routes:** Helmet must run before any route handler to ensure all responses get security headers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security headers | Custom header-setting middleware for each header | helmet 8.x | Covers 15 headers with tested defaults; manual approach misses headers like X-Permitted-Cross-Domain-Policies |
| Rate limiting | Custom counter with Map/Set | express-rate-limit 8.x | Handles IP extraction, sliding windows, proxy awareness, header standards, cleanup of expired entries |
| IP extraction behind proxies | Manual X-Forwarded-For parsing | `app.set('trust proxy', 1)` + `req.ip` | Express handles proxy-addr parsing correctly; manual parsing has off-by-one bugs with chained proxies |
| CSP nonce generation | `Math.random()` or UUID-based nonce | `crypto.randomBytes(32)` | Must be cryptographically random; Math.random is predictable, UUID v4 has less entropy than 32 raw bytes |

**Key insight:** Security middleware has subtle edge cases (proxy chains, IPv6 normalization, header encoding) that are well-handled by battle-tested libraries. Hand-rolling any of these is a security risk.

## Common Pitfalls

### Pitfall 1: Missing `trust proxy` Breaks Rate Limiting Behind Reverse Proxy
**What goes wrong:** Every client appears to have the same IP (the proxy's IP), so rate limiting either blocks everyone or no one.
**Why it happens:** Express defaults to `req.ip` = socket address. Behind nginx/load balancer, all requests come from the proxy IP.
**How to avoid:** Set `app.set('trust proxy', 1)` before any middleware that uses `req.ip`. The `1` means "trust the first proxy hop."
**Warning signs:** All rate-limited responses trigger simultaneously for different users; `req.ip` logs show a single IP for all requests.

### Pitfall 2: CSP Blocks Vite Dev Server or Production Scripts
**What goes wrong:** After adding CSP, the frontend fails to load scripts/styles.
**Why it happens:** CSP is restrictive by default. Vite injects inline scripts during development, and production builds may have inline preload helpers.
**How to avoid:** Phase 3 sets CSP headers on API responses. Phase 4 handles CSP for HTML responses with nonce injection into Vite's built HTML. During Phase 3 testing, focus on API endpoints which return JSON (CSP is less impactful on JSON responses but headers should still be correct). The `script-src` directive with nonce covers Phase 4 inline scripts.
**Warning signs:** Browser console errors mentioning "refused to execute inline script" or "blocked by Content-Security-Policy."

### Pitfall 3: HSTS Applied Before HTTPS Is Working
**What goes wrong:** HSTS header tells browsers to only use HTTPS, but if HTTPS isn't set up yet, users get locked out.
**Why it happens:** HSTS is a one-way instruction. Once a browser sees it, it refuses HTTP for the `max-age` duration.
**How to avoid:** Use a short `max-age` during development/testing (e.g., 60 seconds). Only use the full 1-year max-age in production with verified HTTPS. In development, HSTS can be effectively disabled by not sending the header (helmet respects environment-aware configuration).
**Warning signs:** "This site can't provide a secure connection" errors in browsers after visiting the site once.

### Pitfall 4: Rate Limiter MemoryStore Doesn't Survive Restarts
**What goes wrong:** Rate limit counters reset when the server restarts, allowing burst abuse during deployments.
**Why it happens:** MemoryStore lives in process memory. Server restart = clean slate.
**How to avoid:** For Phase 3 (single-server), MemoryStore is acceptable. For production scaling, use rate-limit-redis with ioredis. The CLAUDE.md already lists ioredis as a planned dependency.
**Warning signs:** Rate limits don't work across server restarts or in multi-instance deployments.

### Pitfall 5: CORS Confusion -- Adding `cors` Package When Not Needed
**What goes wrong:** Installing and using `cors()` with defaults sets `Access-Control-Allow-Origin: *`, opening the API to any origin.
**Why it happens:** Developers assume they need the cors package. With default settings, it allows all origins.
**How to avoid:** For same-origin-only apps, do NOT install the cors package. Express without cors middleware sends no CORS headers, and browsers enforce same-origin policy by default. If cross-origin requests are attempted, they fail because no `Access-Control-Allow-Origin` header is present.
**Warning signs:** API responses contain `Access-Control-Allow-Origin: *` header.

### Pitfall 6: CSP Nonce Not Available to Helmet
**What goes wrong:** Helmet CSP config references `res.locals.cspNonce` but it's undefined.
**Why it happens:** The nonce generation middleware runs after helmet, or helmet is configured before the nonce middleware.
**How to avoid:** Register the nonce generation middleware BEFORE helmet in the middleware chain. Helmet's CSP directive functions receive `(req, res)` and read from `res.locals` at request time, not at configuration time.
**Warning signs:** CSP header contains `'nonce-undefined'` instead of a valid nonce value.

## Code Examples

Verified patterns from official sources:

### Complete Helmet Configuration for SecureShare
```typescript
// Source: https://helmetjs.github.io/ + helmet GitHub README
import helmet from 'helmet';
import type { Request, Response } from 'express';

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`,
        ],
        styleSrc: [
          "'self'",
          (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`,
        ],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,         // 1 year in seconds
      includeSubDomains: true,
      preload: false,           // Enable only after HTTPS is verified in production
    },
    referrerPolicy: {
      policy: 'no-referrer',    // Prevents URL fragment leakage via Referer header
    },
    // These are helmet defaults but listed explicitly for clarity:
    xContentTypeOptions: true,          // X-Content-Type-Options: nosniff
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}
```

### Rate Limiter for Secret Creation
```typescript
// Source: express-rate-limit docs + rate-limit-redis README
import { rateLimit } from 'express-rate-limit';

/**
 * Rate limiter for POST /api/secrets.
 * Allows max 10 secret creations per IP per hour.
 */
export const createSecretLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,    // 1 hour window
  limit: 10,                    // 10 requests per window
  standardHeaders: 'draft-7',   // Send RateLimit-* headers
  legacyHeaders: false,         // Don't send X-RateLimit-* headers
  statusCode: 429,
  message: {
    error: 'rate_limited',
    message: 'Too many secrets created. Please try again later.',
  },
  // keyGenerator defaults to req.ip -- correct with trust proxy set
});
```

### Testing Security Headers with Supertest
```typescript
// Source: project test patterns (secrets.test.ts)
import request from 'supertest';
import { buildApp } from '../../app.js';

const app = buildApp();

describe('security headers', () => {
  test('responses include Content-Security-Policy with nonce', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .expect(201);

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  test('responses include Referrer-Policy: no-referrer', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .expect(201);

    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  test('responses include Strict-Transport-Security', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .expect(201);

    expect(res.headers['strict-transport-security']).toContain('max-age=');
  });

  test('no Access-Control-Allow-Origin header (same-origin only)', async () => {
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .set('Origin', 'https://evil.com')
      .expect(201);

    // No CORS header means browser enforces same-origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('rate limiting', () => {
  test('returns 429 after 10 POST requests in same window', async () => {
    // Send 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/secrets')
        .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
        .expect(201);
    }

    // 11th request should be rate-limited
    const res = await request(app)
      .post('/api/secrets')
      .send({ ciphertext: 'dGVzdA==', expiresIn: '24h' })
      .expect(429);

    expect(res.body.error).toBe('rate_limited');
  });

  test('GET requests are not rate-limited', async () => {
    // GET should never return 429 (rate limiter only on POST)
    const res = await request(app)
      .get('/api/secrets/nonexistent_id_here01')
      .expect(400); // 400 because ID format is wrong, but NOT 429

    expect(res.body.error).not.toBe('rate_limited');
  });
});
```

### CORS Rejection Test
```typescript
describe('CORS same-origin policy', () => {
  test('preflight OPTIONS from foreign origin gets no CORS headers', async () => {
    const res = await request(app)
      .options('/api/secrets')
      .set('Origin', 'https://attacker.com')
      .set('Access-Control-Request-Method', 'POST');

    // Without cors middleware, Express returns no CORS headers
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-methods']).toBeUndefined();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| helmet v4-6: `max` option for rate limiting | express-rate-limit v7+: `limit` replaces `max` | 2023 (v7 release) | Use `limit` not `max` in configuration |
| X-RateLimit-* headers | IETF draft-7/8 RateLimit headers | 2023-2024 | Use `standardHeaders: 'draft-7'` for modern clients |
| helmet CSP string-based directives | helmet 7+: array-based with function support | 2023 | Directives use arrays, functions receive (req, res) |
| `cors()` for everything | Same-origin apps: no CORS package needed | Always true | Not installing cors is the correct choice for same-origin |
| Manual security headers | helmet 8.x: 15 headers with tested defaults | Current | Single `app.use(helmet())` covers most needs |

**Deprecated/outdated:**
- helmet `max` option in express-rate-limit: use `limit` instead (renamed in v7)
- `X-RateLimit-*` legacy headers: use `standardHeaders: 'draft-7'` instead
- `csp` standalone package: use `helmet.contentSecurityPolicy()` (bundled in helmet)

## Phase 4 Integration Notes

Phase 3 creates the security infrastructure. Phase 4 must integrate it with Vite's HTML output:

1. **Vite `html.cspNonce`**: Configure Vite with `html: { cspNonce: 'CSP_NONCE_PLACEHOLDER' }` in `vite.config.ts`. This adds `nonce="CSP_NONCE_PLACEHOLDER"` to all built `<script>` and `<style>` tags.

2. **Express HTML serving middleware**: Phase 4 must read the built `index.html`, replace `CSP_NONCE_PLACEHOLDER` with `res.locals.cspNonce` for each request, then send the modified HTML.

3. **No static HTML caching**: The HTML file cannot be aggressively cached since nonce changes per request. Static assets (JS/CSS files) CAN be cached with immutable headers since they're referenced by hash filenames.

Phase 3 does NOT need to implement the HTML serving -- it only needs to ensure the nonce middleware and helmet CSP are in place so Phase 4 can use them.

## Open Questions

1. **HSTS max-age in development**
   - What we know: HSTS with long max-age can lock browsers into HTTPS mode. In development without TLS, this causes issues.
   - What's unclear: Whether helmet should send HSTS at all in development, or only in production.
   - Recommendation: Conditionally disable HSTS in development by setting `strictTransportSecurity: false` when `NODE_ENV !== 'production'`. This is the safest approach.

2. **Rate limit store for production**
   - What we know: MemoryStore works for single-server. Redis store (rate-limit-redis + ioredis) needed for multi-instance.
   - What's unclear: When the project will need multi-instance deployment.
   - Recommendation: Use MemoryStore now. The architecture allows swapping to RedisStore later with zero API changes. CLAUDE.md already lists ioredis as planned.

3. **Express 5 + helmet/express-rate-limit compatibility**
   - What we know: Both libraries are actively maintained and widely used. No Express 5 compatibility issues reported in GitHub issues or npm.
   - What's unclear: Neither library explicitly documents Express 5 support in their README.
   - Recommendation: Proceed with current versions. Express 5 middleware API is backward-compatible with Express 4 middleware (same `(req, res, next)` signature). LOW risk.

## Sources

### Primary (HIGH confidence)
- [Helmet.js official docs](https://helmetjs.github.io/) - CSP nonce configuration, all header options, complete API
- [Helmet GitHub README](https://github.com/helmetjs/helmet/blob/main/README.md) - CSP nonce function syntax, strictTransportSecurity, referrerPolicy defaults
- [Helmet CSP nonce FAQ](https://helmetjs.github.io/faq/csp-nonce-example/) - Complete working nonce example with crypto.randomBytes
- [Helmet CSP middleware README](https://github.com/helmetjs/helmet/blob/main/middlewares/content-security-policy/README.md) - useDefaults, reportOnly, directive arrays with functions
- [express-rate-limit README](https://github.com/express-rate-limit/express-rate-limit/blob/main/readme.md) - Configuration options, limit/windowMs/standardHeaders
- [express-rate-limit configuration docs](https://express-rate-limit.mintlify.app/reference/configuration) - Full option defaults, keyGenerator, store, skip
- [rate-limit-redis README](https://github.com/express-rate-limit/rate-limit-redis) - ioredis sendCommand pattern, v4.3.1
- [Express CORS middleware docs](https://expressjs.com/en/resources/middleware/cors.html) - Configuration options, origin restrictions
- [Express security best practices](https://expressjs.com/en/advanced/best-practice-security.html) - Official helmet + TLS recommendations
- [Express behind proxies guide](https://expressjs.com/en/guide/behind-proxies.html) - trust proxy settings, req.ip behavior

### Secondary (MEDIUM confidence)
- [Vite CSP features docs](https://vite.dev/guide/features) - html.cspNonce placeholder, meta tag injection
- [Vite CSP nonce SPA limitations](https://github.com/vitejs/vite/issues/20531) - Placeholder replacement per request, static cache incompatibility
- [Vite CSP production issue](https://github.com/vitejs/vite/issues/16749) - Nonce vs hash discussion, SPA considerations
- [MDN CORS documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) - Same-origin policy behavior, browser enforcement

### Tertiary (LOW confidence)
- Express 5 + helmet compatibility: No explicit documentation found. Based on middleware API backward compatibility and absence of reported issues. Proceed with caution but risk is LOW.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - helmet and express-rate-limit are the universally recommended libraries for Express security. Official Express docs recommend both. Versions verified via npm.
- Architecture: HIGH - Middleware ordering, nonce generation, route-scoped rate limiting are well-documented patterns in official sources.
- Pitfalls: HIGH - trust proxy, HSTS lockout, CORS confusion, and nonce ordering are well-documented issues with multiple sources confirming each.
- Vite CSP integration: MEDIUM - Vite's html.cspNonce works but has documented SPA limitations. The Express-served approach (read HTML, replace placeholder) is the recommended pattern but is Phase 4's concern.

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days -- stable domain, libraries change slowly)
