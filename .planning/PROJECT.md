# SecureShare

## Current Milestone: v4.0 Hybrid Anonymous + Account Model

**Goal:** Evolve SecureShare from a pure anonymous tool into a hybrid model — anonymous users get instant secret creation with auto-generated passphrases, while optional accounts unlock dashboard, email notifications, extended expiration, and a Pro monetization tier.

**Target features:**
- Auto-generated EFF Diceware passphrases for two-channel security (all users)
- User accounts (email + OAuth) with dashboard, history, and labeling
- Pro tier ($7/month) via Stripe — extended expiration, file uploads, webhooks
- Progressive conversion funnel from anonymous → free → Pro
- PostHog analytics and legal documents (Privacy Policy, ToS)

---

## What This Is

SecureShare is a production-ready, zero-knowledge web application for sharing passwords, API keys, and sensitive text via one-time, self-destructing links. It uses client-side AES-256-GCM encryption so the server never sees plaintext secrets. Dark terminal-inspired UI with glassmorphism surfaces, complete SEO infrastructure, multi-browser E2E tests, containerized deployment, and CI/CD pipeline. No accounts, no signup — just paste, encrypt, share, and destroy.

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

### Active

<!-- v4.0 Hybrid Anonymous + Account Model -->

- [ ] Auto-generated EFF Diceware passphrases (4-word, client-side, two-channel security flow)
- [ ] User account registration and login (email/password + OAuth via Google and GitHub)
- [ ] User dashboard — secret history, pre-view deletion, secret labeling
- [ ] Email notifications when secrets are viewed (SendGrid integration)
- [ ] Extended expiration for account users (up to 7 days vs 1h anonymous)
- [ ] Pro tier ($7/month) via Stripe — 90-day expiration, unlimited secrets, file uploads (25MB), webhook notifications
- [ ] Tightened anonymous rate limits: 3/hour and 10/day with friendly conversion prompts
- [ ] Progressive conversion prompts (soft after 1st secret, medium after 3rd, hard on rate limit)
- [ ] Product analytics via PostHog (anonymous-safe, no PII)
- [ ] Legal documents: Privacy Policy and Terms of Service

### Out of Scope

- Editing/revoking secrets after creation — one-time links are the model
- Browser extensions — web-first
- Public API — internal use only; even Pro tier does not expose public API
- Team/organization features — individual sharing only; Enterprise is future
- Mobile apps — responsive web covers mobile use cases
- Offline mode — real-time server interaction is core to the destroy model
- Unit test gap coverage beyond current tests — coverage is adequate for current scope
- Enhanced homepage hero redesign — deferred; create-form homepage works well
- Real-time push notifications — email-on-view is sufficient; websocket notifications deferred

## Context

Shipped v3.0 with ~6,633 LOC TypeScript across 20 phases, 51 plans total (22 in v1.0 + 14 in v2.0 + 15 in v3.0).

Tech stack: Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17.
Crypto: Web Crypto API (AES-256-GCM), PADME padding, Argon2id password hashing.
163 unit tests (87 crypto, 32 API integration, 14 security, 13 expiration, 6 accessibility, 4 SEO, 7 UI).
E2E: Playwright with Chromium, Firefox, WebKit — 4 spec files covering all critical user flows.
CI/CD: GitHub Actions lint → test → E2E → auto-deploy to Render.com.
Design system: OKLCH semantic color tokens, dual light/dark themes, glassmorphism surfaces.
SEO: Full meta infrastructure, JSON-LD, favicons, sitemap, noindex on secret routes.

**Known tech debt:**
- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Lucide ESM workaround via Vite resolve.alias (upstream bug)
- Playwright webServer 30s timeout risk on slow CI runners (fix: pre-build client in CI e2e job)
- Codecov badge shows "unknown" until CODECOV_TOKEN added to GitHub repo secrets
- Bare `docker run <image>` skips migrations (only docker-compose / render.yaml supported paths)

## Constraints

- **Security**: Zero-knowledge — server must never see plaintext secrets
- **Simplicity**: No accounts, no signup, minimal clicks to share
- **Performance**: Page load < 1s on 3G, secret creation < 500ms, retrieval < 300ms
- **Privacy**: No tracking cookies, no PII collection, GDPR compliant
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

---
*Last updated: 2026-02-18 after v4.0 milestone started*
