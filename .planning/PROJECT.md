# Torch Secret

## Current Milestone: v6.0 (Planning)

**Status:** v5.0 Product Launch Checklist shipped 2026-03-03. Planning next milestone.

**To start next milestone:** `/gsd:new-milestone`

## What This Is

Torch Secret is a launch-ready, zero-knowledge web application for sharing passwords, API keys, and sensitive text via one-time, self-destructing links. It uses client-side AES-256-GCM encryption so the server never sees plaintext secrets. The product has a full marketing funnel (homepage → `/pricing` → Stripe Pro checkout), 14 server-rendered SEO pages visible to AI crawlers, GDPR-compliant email capture and Loops.so onboarding sequence, Google/GitHub OAuth, Infisical secrets management, and PostHog analytics with conversion funnels. Optional free accounts unlock a secret dashboard, email notifications, extended expiration, and a progressive conversion funnel — while the zero-knowledge invariant is preserved in every DB record, log, and analytics event.

## Core Value

Users can share sensitive information once, securely, without accounts or complexity — the secret is encrypted in the browser, viewable only once, then permanently destroyed.

## Requirements

### Validated

- ✓ Client-side AES-256-GCM encryption with key in URL fragment (zero-knowledge) — v1.0
- ✓ Secret creation with textarea input (max 10,000 chars) — v1.0
- ✓ One-time viewing — secret destroyed after first view — v1.0
- ✓ Configurable expiration (1h, 24h, 7d, 30d; default 24h) — v1.0
- ✓ Optional password protection with 3-attempt auto-destroy — v1.0
- ✓ Copy-to-clipboard for generated links and revealed secrets — v1.0
- ✓ Background expiration cleanup job — v1.0
- ✓ Rate limiting (10 creations per IP per hour, Redis-backed) — v1.0
- ✓ Mobile-responsive design with WCAG 2.5.5 touch targets — v1.0
- ✓ Trust-building content (How it works section) — v1.0
- ✓ Clear error states (already viewed, expired, invalid password, rate limited) — v1.0
- ✓ WCAG 2.1 AA accessibility (keyboard nav, screen reader, contrast) — v1.0
- ✓ Dark terminal-inspired design system with OKLCH semantic tokens — v2.0
- ✓ Three-way theme toggle (dark/light/system) with localStorage persistence — v2.0
- ✓ JetBrains Mono typography, Lucide SVG icons replacing all emoji — v2.0
- ✓ Persistent header/footer layout shell across SPA routes — v2.0
- ✓ Glassmorphism surfaces, page animations, button micro-interactions — v2.0
- ✓ Terminal code-block styling for revealed secrets — v2.0
- ✓ Complete SEO infrastructure (meta tags, OG/Twitter, favicons, robots.txt, sitemap, JSON-LD) — v2.0
- ✓ Dynamic per-route meta tags with noindex protection for secret URLs — v2.0
- ✓ prefers-reduced-motion compliance for all animations — v2.0
- ✓ ESLint 10 flat config + Prettier 3.8 + Husky pre-commit hooks — v3.0
- ✓ TypeScript strict-mode errors resolved, entire codebase lints clean — v3.0
- ✓ Multi-stage Docker build + docker-compose one-command local stack — v3.0
- ✓ Health check endpoint (GET /api/health) with service status — v3.0
- ✓ Render.com Blueprint (render.yaml) for one-click production deployment — v3.0
- ✓ Playwright E2E tests: create→reveal, password flow, error states, axe-core accessibility — v3.0
- ✓ Playwright runs across Chromium, Firefox, and WebKit in CI — v3.0
- ✓ GitHub Actions CI/CD: lint gates tests, E2E with service containers, auto-deploy to Render — v3.0
- ✓ Professional GitHub presence: README, issue/PR templates, CONTRIBUTING.md, CHANGELOG, Release — v3.0
- ✓ Auto-generated EFF Diceware passphrases (4-word, client-side, two-channel security flow) — v4.0
- ✓ 4-tab protection panel (No protection / Generate password / Custom password / Passphrase) with entropy display and masked inputs — v4.0
- ✓ User account registration and login (email/password + OAuth via Google and GitHub) — v4.0
- ✓ User dashboard — secret history, pre-view deletion, secret labeling, four status states — v4.0
- ✓ Email notifications when secrets are viewed (Resend transactional email, per-secret opt-in) — v4.0
- ✓ Tightened anonymous rate limits: 3/hour and 10/day with inline conversion prompts — v4.0
- ✓ Extended expiration for authenticated users (up to 7 days vs 1h anonymous) — v4.0
- ✓ Progressive conversion prompts (soft after 1st secret, benefit-focused after 3rd, inline on rate limit) — v4.0
- ✓ Privacy-safe PostHog analytics (URL fragment sanitization, no PII, user identification by ID only) — v4.0
- ✓ Legal documents: Privacy Policy (/privacy) and Terms of Service (/terms) with noindex — v4.0
- ✓ Server-side X-Robots-Tag noindex for auth and dashboard routes — v4.0
- ✓ Docker build CI job + package.json version 4.0.0 — v4.0
- ✓ Rebrand from SecureShare → Torch Secret across all user-facing surfaces, SEO assets, and developer docs — v5.0
- ✓ Marketing homepage at `/` with hero, ZK proof points, How It Works, email capture; create-secret form at `/create` — v5.0
- ✓ Pricing page at `/pricing` with Free/Pro comparison, billing toggle, FAQ, FAQPage JSON-LD — v5.0
- ✓ Stripe Pro billing — checkout, webhooks, customer portal, 30-day expiration unlock, tier enforcement — v5.0
- ✓ 14 server-rendered SEO pages (`/vs/*`, `/alternatives/*`, `/use/*`) with JSON-LD — visible to AI crawlers — v5.0
- ✓ GDPR-compliant email capture with double opt-in, Resend Audiences, and one-click unsubscribe — v5.0
- ✓ Loops.so 3-email onboarding sequence: welcome (transactional) + day-3 features + day-7 upgrade (marketing consent gated) — v5.0
- ✓ Google + GitHub OAuth wired through Infisical secrets management across dev/staging/prod — v5.0
- ✓ PostHog event enrichment: checkout_initiated, subscription_activated, dashboard_viewed, extended secret_created and identifyUser — v5.0
- ✓ Pre-launch security hardening: Argon2id tight limiter, PostgreSQL pool hardening, Stripe webhook + ZK invariant tests — v5.0
- ✓ CHANGELOG back-filled (v4.0 + v5.0), CONTRIBUTING dual-path (Infisical/env), SECURITY.md updated, README screenshots added — v5.0
- ✓ Feedback links on confirmation and post-reveal pages (Tally.so, new tab) — v5.0
- ✓ verify-checkout race window closed (idempotent activatePro) + deactivatePro Loops sync on cancellation — v5.0

### Active

<!-- v6.0 requirements TBD — run /gsd:new-milestone to define -->

### Out of Scope

- Editing/revoking secrets after creation — one-time links are the model
- Browser extensions — web-first
- Public API — internal use only; even Pro tier does not expose public API
- Team/organization features — individual sharing only; Enterprise is future
- Mobile apps — responsive web covers mobile use cases
- Offline mode — real-time server interaction is core to the destroy model
- Session recording (PostHog) — privacy violation: create form contains sensitive plaintext before encryption
- Google Analytics — conflicts with privacy promise; requires cookie consent banners
- Claiming anonymous secrets on account creation — privacy risk: linking browser session to user identity
- Real-time push notifications — email-on-view is sufficient; websocket notifications not warranted
- Custom domains — Enterprise tier; not planned
- "Notify if expires unviewed" email option — deferred to future Pro features
- Webhook notifications on secret view — v6.0+ Pro feature
- File uploads (25MB, Cloudflare R2) — v6.0+ Pro feature
- 6-word Diceware passphrases — v6.0+ Pro feature
- Extended expiration beyond 30 days (90-day option) — v6.0+ Pro feature
- Team tier — launch with Free + Pro only; add Team when organic team patterns emerge

## Context

Shipped v5.0 with ~30,287 LOC TypeScript across 49 total phases, 152 plans total (22 in v1.0 + 14 in v2.0 + 15 in v3.0 + 38 in v4.0 + 63 in v5.0). 385 tests passing (1 todo).

Tech stack: Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17, Better Auth 1.x, Stripe, Loops.so, Resend, PostHog, Infisical.
Crypto: Web Crypto API (AES-256-GCM), PADME padding, Argon2id password hashing, EFF Diceware, rejection-sampling.
Tests: 385 Vitest unit/integration tests + Playwright E2E across Chromium, Firefox, WebKit.
CI/CD: GitHub Actions lint → test (Infisical) → E2E → docker-build → auto-deploy to Render.com (checksPass gate).
Design system: OKLCH semantic color tokens, dual light/dark themes, glassmorphism surfaces, JetBrains Mono.
Secrets: Infisical CLI injection for dev/staging/prod — no .env file in dev.

**Known tech debt (post-v5.0):**
- `BETTER_AUTH_TRUSTED_ORIGINS` in .env.example + render.yaml has no consumer in env.ts Zod schema — silently ignored at runtime (OAuth works via APP_URL)
- Three post-action CTAs call `navigate('/')` routing to marketing homepage instead of `/create` (confirmation.ts:291, dashboard.ts:868, reveal.ts:409) — UX friction
- `notification.service.test.ts:58` — 1 `test.todo` (logger.error migration); ZK invariant tests already cover the invariant
- ROADMAP.md Phase 40 plan checkboxes show `[ ]` — documentation only, 9 commits confirm all plans shipped
- STRIPE_SECRET_KEY is sk_test_ in Infisical prod pre-launch — requires manual swap to sk_live_ before going public (documented in 37.2-03-SUMMARY launch-day checklist)
- Lucide ESM workaround via Vite resolve.alias (upstream bug — ongoing)

## Constraints

- **Security**: Zero-knowledge — server must never see plaintext secrets
- **Zero-knowledge invariant**: No DB record, log line, or analytics event may contain both userId and secretId in the same payload (see .planning/INVARIANTS.md)
- **Simplicity**: Core anonymous flow stays frictionless — accounts are opt-in
- **Performance**: Page load < 1s on 3G, secret creation < 500ms, retrieval < 300ms
- **Privacy**: No PII in analytics, no tracking cookies, GDPR-oriented
- **Accessibility**: WCAG 2.1 AA compliance
- **Secret size**: Max 10,000 characters per secret

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Client-side encryption with key in URL fragment | Zero-knowledge — server never sees plaintext; URL fragments not sent to server | ✓ Good |
| No user accounts for MVP | Core differentiator is zero-friction; accounts add complexity | ✓ Good |
| One-time view model | Stronger security guarantee; simpler than revocation | ✓ Good |
| Password protection with 3-attempt limit | Extra security layer without complexity; auto-destroy prevents brute force | ✓ Good |
| Vanilla JS over React | Only 3-4 pages; <1s load on 3G; smaller supply chain attack surface | ✓ Good |
| Argon2id over bcrypt | OWASP recommended; memory-hard; future-proof against GPU attacks | ✓ Good |
| PADME over power-of-2 padding | Max 12% overhead vs up to 100%; good privacy-efficiency tradeoff | ✓ Good |
| nanoid over UUID | 21-char URL-safe IDs vs 36-char; cryptographically secure, shorter URLs | ✓ Good |
| Ciphertext as text, not bytea | Crypto module outputs base64; simpler than binary column | ✓ Good |
| Redis-backed rate limiting | Production multi-instance support with MemoryStore fallback | ✓ Good |
| Projects-based vitest config | Single-file config with sequential server tests; eliminated flaky tests | ✓ Good |
| OKLCH color tokens over hex/HSL | Perceptually uniform, wide gamut, future-proof for P3 displays | ✓ Good |
| Light theme default, dark via .dark class | Follows Tailwind convention; FOWT script prevents flash | ✓ Good |
| Three-way theme toggle (light/dark/system) | System mode removes localStorage key, falls through to OS preference | ✓ Good |
| Self-hosted JetBrains Mono over Google Fonts | Zero-knowledge app must not make external CDN requests | ✓ Good |
| Lucide SVGs over emoji icons | CSP-safe, consistent sizing, tree-shakable, accessible | ✓ Good |
| Static OG tags in HTML (not JS-rendered) | Social crawlers don't execute JS; static tags always available | ✓ Good |
| X-Robots-Tag + meta noindex defense-in-depth | Belt-and-suspenders: server header + client meta for secret routes | ✓ Good |
| Toast replace strategy (no stacking) | Simpler UX; only latest feedback visible | ✓ Good |
| Render.com for deployment | Free tier, easy Docker deploy, built-in PostgreSQL + Redis | ✓ Good |
| Playwright for E2E tests | Modern, fast, built-in multi-browser, great CI support | ✓ Good |
| ESLint 10 flat config + Prettier + Husky | Industry standard; projectService auto-discovers tsconfig; pre-commit prevents regressions | ✓ Good |
| Multi-stage Docker build (deps→build→prod) | No dev deps in production image; non-root user; argon2 native module included | ✓ Good |
| FORCE_HTTPS env var over NODE_ENV check | Decouples HTTPS redirect from environment; docker-compose can use prod mode locally | ✓ Good |
| workers: 1, fullyParallel: false for E2E | Destructive one-time secrets require serial test execution | ✓ Good |
| lint job gates test/e2e in CI | Fail fast on code quality before expensive test runs | ✓ Good |
| autoDeployTrigger: checksPass in render.yaml | Deploy only when all CI checks pass; prevents broken deploys | ✓ Good |
| YAML form issue templates over markdown | Structured validation, required fields, better contributor UX | ✓ Good |
| Better Auth over custom auth | Full-featured auth library; OAuth, sessions, email verification out of the box | ✓ Good |
| onDelete: 'set null' on secrets.userId | Preserves already-shared links if user deletes account; cascade would lose data | ✓ Good |
| onDelete: 'cascade' on sessions/accounts.userId | Better Auth requirement for session cleanup on account deletion | ✓ Good |
| Drizzle bug #4147 workaround: split FK migrations | ADD COLUMN + ADD CONSTRAINT in separate files prevents migration failure | ✓ Good |
| Zero-knowledge invariant in INVARIANTS.md | Canonical source with 3-way cross-reference (schema.ts + INVARIANTS.md + CLAUDE.md); audit enforcement | ✓ Good |
| optionalAuth never returns 401 | Session check failure is non-fatal; anonymous users proceed unchanged | ✓ Good |
| getUserSecrets() explicit column list | Sole enforcement preventing ciphertext/passwordHash from appearing in dashboard responses | ✓ Good |
| before_send hook for PostHog (not sanitize_properties) | sanitize_properties is legacy name; wrong name silently fails and leaks AES keys | ✓ Good |
| capture_pageview: false + manual capturePageview() | Prevents race with reveal-page fragment stripping | ✓ Good |
| autocapture: false for PostHog | Passive DOM capture would record plaintext from create-page textarea before encryption | ✓ Good |
| identifyUser by internal user ID only | Never email, name, or PII; PostHog receives opaque DB ID | ✓ Good |
| Tightened anonymous limits (3/hr, 10/day, 1h max) | Conversion pressure without blocking core use; versioned Redis keys prevent counter inheritance | ✓ Good |
| standardHeaders: 'draft-6' on anon hourly limiter | draft-7 embeds reset in combined header; draft-6 emits standalone RateLimit-Reset for countdown display | ✓ Good |
| sessionStorage for OAuth redirect analytics flag | Tab-scoped and cleared when tab closes; correct lifetime for one-time post-redirect analytics flag | ✓ Good |
| NOINDEX_PREFIXES array in app.ts | Extensible pattern for server-side X-Robots-Tag: future auth routes need a single array entry | ✓ Good |
| Protection panel as 4-tab tablist/tab/tabpanel | ARIA pattern with arrow-key navigation; combined password field; clear mode separation | ✓ Good |
| EFF Diceware rejection sampling cutoff 4294964736 | Eliminates modulo bias for n=7776; rejection probability ~0.0000006 per word | ✓ Good |
| docker-build CI job uses needs: [lint] (parallel) | Runs parallel with test/e2e after lint; does not extend critical path | ✓ Good |
| Express SSR for /vs/*, /alternatives/*, /use/* (not SPA) | AI crawlers (GPTBot, ClaudeBot) don't execute JS; SSR required for immediate indexing on new domains | ✓ Good |
| Raw Stripe SDK with handwritten webhook handler (no @better-auth/stripe) | 4 open bugs in the plugin (#2440, #4957, #5976, #4801 as of Feb 2026) break subscription lifecycle | ✓ Good |
| Loops.so for email onboarding (over Resend sequences) | Visual loop builder, GDPR filter nodes evaluated at send time — consent changes before day-7 take effect | ✓ Good |
| Infisical CLI injection for secrets (no .env in dev) | Single source of truth for secrets across dev/staging/prod; Render Secret Sync auto-propagates prod | ✓ Good |
| Two separate GitHub OAuth apps for dev and prod | GitHub: single redirect URI per app constraint — dev and prod apps registered separately | ✓ Good |
| activatePro() + deactivatePro() receive stripe_customer_id only | ZK constraint: webhook handler never has userId in scope alongside customer data | ✓ Good |
| Dev-only OAuth bounce middleware (localhost:3000 → APP_URL) | Fixes state_mismatch: OAuth redirects to Express host, bypassing Vite proxy; bounce restores correct origin | ✓ Good |
| Non-async databaseHooks.after handler (void+.catch pattern) | Better Auth's after hook: async without await triggers @typescript-eslint/require-await; fire-and-forget avoids it | ✓ Good |
| activatePro() idempotent — called from both verify-checkout and webhook | Eliminates race window where user sees success before webhook arrives; DB UPDATE WHERE is a no-op if already Pro | ✓ Good |

---
*Last updated: 2026-03-03 after v5.0 milestone*
