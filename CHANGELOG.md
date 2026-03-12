# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.3.0] - 2026-03-12

### Added

- Auth audit log: five auth lifecycle events (sign_up, sign_in, logout, password_reset_requested, oauth_connect) write durable rows to a new `audit_logs` table — ZK-safe by design (no secretId column) with cascading FK to users (AUTH-01, AUTH-02)
- GDPR data export: authenticated `GET /api/me/export` returns a JSON payload with profile metadata and audit log entries — no ciphertext included (GDPR-01)
- Dashboard cursor pagination: `GET /api/dashboard/secrets` accepts an optional `cursor` parameter and returns `nextCursor`; "Load More" control on dashboard appends results without a full-page reload (API-02)
- Distributed expiration lock: expiration worker acquires a Redis `SET NX EX 299` lock before each cleanup run — prevents duplicate deletes under horizontal scaling (INFR-02)
- Dunning email: `invoice.payment_failed` Stripe webhook dispatches a payment failure notification via Resend (BILL-01)
- Dependabot coverage for GitHub Actions workflows (GH-03)

### Changed

- Redis is now required in production (`REDIS_URL` must be set; `NODE_ENV=production` without it fails at startup via Zod env validation) — MemoryStore is dev-only (INFR-01)
- Stripe `customer.subscription.updated` webhook syncs the user's `subscriptionTier` in the database — mid-period upgrades and downgrades handled (BILL-02)
- `verify-checkout` endpoint is fail-closed: returns 403 when `session.customer` is set but `dbUser.stripeCustomerId` is null, closing a race-window bypass (BILL-03)
- `secrets.status` and `marketingSubscribers.status` columns converted to Postgres `pgEnum` types — invalid status values are rejected at the database level (QUAL-01)
- `getSecretMeta()` opportunistically deletes expired rows on meta lookup — stale expired rows no longer accumulate from meta-only requests (API-01)
- Billing and `/api/me` queries project only `stripeCustomerId` — no full user row fetched for operations that need only the customer ID (API-03)
- Retro theme modules excluded from production bundle by default — dynamic import gate controlled by `VITE_RETRO_ENABLED` env var (BNDL-01)
- Passphrase wordlist (~280 KB) lazy-loaded via dynamic import on first passphrase tab selection — absent from initial bundle (BNDL-02)
- `isSession()` type guard consolidated to a single export in `client/src/api/auth-client.ts` — duplicate implementations removed from dashboard, create, login, and register pages (QUAL-02)

### Fixed

- Unhandled Promise rejections and uncaught exceptions now log at fatal level and exit the process — no more silent crashes without a trace (SRVR-01)
- Server startup with `E2E_TEST=true` outside of test mode now throws immediately — prevents accidental rate-limit disable on staging or production (SRVR-02)
- GitHub Actions pinned to commit SHAs; workflow declares `permissions: contents: read` at workflow level (GH-01, GH-02)

## [5.2.0] - 2026-03-09

### Added

- QR code sharing on confirmation page — scan-to-open link without copy-paste
- Email mailto button — 4-way secret sharing UI: Copy Link, Share (native), Email, QR code
- Burn-after-reading reveal timer — auto-hides secret content after 15, 30, or 60 seconds
- Smart expiry hints on create page — time and day-aware expiration suggestions for authenticated users
- Clipboard auto-clear countdown — secret URL removed from clipboard after 60 seconds for security
- One-click reshare from dashboard — pre-fills the create form with previous expiration and protection settings
- Secret preview panel on create page — terminal-style preview before committing to create
- Passphrase word list themes — Tech, Nature, and Short variants alongside the default EFF word list
- Two new competitor comparison pages: `/vs/bitwarden-send` and `/vs/email-and-slack`
- Dependabot coverage for Docker base image updates

### Changed

- Marketing homepage: ZK-focused H1 ("We can't read your secrets"), security architecture section, guarantee badge, viral reveal CTA, internal linking improvements
- SSR comparison pages visually consistent with SPA: matching theme dropdown, design tokens, and JetBrains Mono font loading
- Email capture section removed from homepage (conversion liability)

### Fixed

- Race condition: concurrent password verification under load correctly destroys the secret exactly once (atomic transaction + pessimistic lock test suite)
- ZK invariant systematically enforced via test suite — no Pino log line, DB row, or PostHog event payload contains both userId and secretId
- Server code quality: auth/dashboard routes return `X-Robots-Tag: noindex`, console.error migrated to Pino logger in service files, E2E rate-limit bypass unreachable outside test environment
- Stripe customer creation is idempotent — idempotency key prevents duplicate customers on network retries
- DMARC upgraded from p=none to p=quarantine — active spoofing enforcement for torchsecret.com

## [5.1.0] - 2026-03-06

### Added

- Cloudflare Email Routing: `admin@torchsecret.com` and `hello@torchsecret.com` forward to Gmail; apex catch-all in place
- Domain verification: DKIM, SPF, and DMARC records configured for `torchsecret.com`; Resend and Loops both sending from custom domain
- Gmail Send Mail As: team can reply from `hello@torchsecret.com` directly in Gmail
- SECURITY.md with private vulnerability reporting instructions and contact addresses
- Privacy Policy updated with Loops.so and PostHog data processing contacts

### Changed

- Repository made public on GitHub (`norcalcoop/torch-secret`) with `.planning/` and `CLAUDE.md` gitignored
- `.env.example` updated to reflect Infisical-managed secrets; only public key names listed, no values

## [5.0.0] - 2026-03-02

### Added

- Google OAuth and GitHub OAuth sign-in (Better Auth social providers; two separate GitHub OAuth Apps for dev and prod environments)
- Marketing homepage at `/` with hero section, zero-knowledge proof points, use-case sections, and GDPR-compliant email capture form
- Pricing page at `/pricing` with Free vs Pro tier cards, monthly/annual billing toggle, FAQ accordion, and FAQPage JSON-LD in `<head>`
- SEO content pages (Express SSR): `/vs/*`, `/alternatives/*`, `/use/*` — server-rendered so content is visible to AI crawlers and Googlebot without JavaScript execution
- GDPR-compliant email capture: homepage form with explicit consent checkbox, double opt-in confirmation, Resend Audiences sync, one-click unsubscribe
- Loops.so email onboarding sequence: welcome email on registration, day-3 key features email, day-7 upgrade prompt (marketing consent gated)
- PostHog enrichment: `checkout_initiated`, `subscription_activated`, `dashboard_viewed` events; launch dashboard, conversion funnels, and user cohorts configured in PostHog Cloud
- Security hardening: Argon2id concurrency cap via p-limit (max 4 concurrent), tighter rate limiting on password-verify endpoint (5 req/min), PostgreSQL pool hardening (max 10 connections, statement timeout 10s), payload size cap enforcement (100KB)
- Infisical secrets management: all secrets stored in Infisical Cloud; no `.env` file required for team development
- Supply chain security scanning via Socket.dev on every pull request

### Changed

- App renamed from SecureShare to Torch Secret across all user-facing surfaces, canonical URLs, structured data, and source code
- All canonical URLs, sitemap entries, JSON-LD `@id`/`url` fields, and OG image URLs updated to `torchsecret.com`
- Create-secret form moved from `/` to `/create`; `/` now serves the marketing homepage
- `.env.example` stripped to keys-only reference; all values managed via Infisical
- Package version bumped to 5.0.0

## [4.0.0] - 2026-02-22

### Added

- User accounts with email/password registration, login, session management, and email verification (Better Auth 1.x)
- Secret dashboard: authenticated users can view, track, and manage all their created secrets with expiration status
- EFF Diceware passphrase generator for secret protection (client-side generation, word list bundled, offline-capable)
- Optional password or passphrase protection for secrets (Argon2id server-side hashing, OWASP-recommended parameters)
- Passphrase/password tier enforcement: anonymous users blocked from all protection options; free users limited to generated passphrases; Pro users unlock custom passwords
- Privacy-safe PostHog analytics with URL fragment stripping before every event — no plaintext secrets or keys can appear in analytics data
- Email notification: optional secret-viewed alert sent to the creator (zero-knowledge safe — no secretId in email body)
- Stripe Pro billing: subscription checkout, Customer Portal, webhook lifecycle handler (`customer.subscription.created/deleted`), 30-day expiration unlock for Pro subscribers
- Rate-limit conversion prompts: anonymous users see account upgrade CTA after hitting rate limits
- Legal pages: `/privacy` and `/terms` with server-side `noindex` header enforcement
- Feedback links on confirmation and reveal pages (Tally.so embedded link)

### Changed

- Package version bumped to 4.0.0

## [3.0.0] - 2026-02-18

### Added

- ESLint 10 flat config with typescript-eslint type-aware rules
- Prettier 3.8 with Tailwind CSS plugin and pre-commit enforcement via Husky
- Multi-stage Dockerfile with non-root user and production optimizations
- docker-compose.yml for one-command local development (PostgreSQL + Redis + app)
- Health check endpoint (`GET /api/health`) with database connectivity status
- Render.com Blueprint (`render.yaml`) for one-click cloud deployment
- Playwright E2E tests covering create-reveal, password protection, error states, and accessibility
- GitHub Actions CI pipeline (lint, test with coverage, E2E with service containers)
- CI-gated auto-deploy to Render.com
- Comprehensive README with architecture diagram, screenshots, and quick-start guide
- GitHub issue templates (bug report, feature request) and PR template
- CONTRIBUTING.md and SECURITY.md
- ISC LICENSE file

### Changed

- Package version bumped from 1.0.0 to 3.0.0

### Fixed

- TypeScript strict-mode errors in crypto, icons, and accessibility modules
- API 404 catch-all prevents `/api/*` routes from returning SPA HTML
- HTTPS redirect decoupled from NODE_ENV via FORCE_HTTPS environment variable
- OKLCH color values replaced with sRGB hex in CSS custom properties for axe-core compatibility

## [2.0.0] - 2026-02-16

### Added

- OKLCH design system with semantic color tokens and dual light/dark themes
- Glassmorphism UI surfaces with backdrop-blur and frosted-glass effects
- Three-way theme toggle (light/dark/system) with localStorage persistence
- FOWT (flash of wrong theme) prevention via synchronous inline script
- SEO infrastructure: meta tags, JSON-LD structured data, Open Graph, sitemap, robots.txt
- SPA router with History API, dynamic imports, and per-route SEO metadata
- Persistent layout shell with glassmorphism header and trust-signal footer
- Terminal-style secret display with copy functionality
- Toast notification system with aria-live accessibility
- How It Works and Why Trust Us content sections
- Web Share API integration with progressive enhancement
- JetBrains Mono font and Lucide icon system
- Page-enter animations with prefers-reduced-motion compliance

## [1.0.0] - 2026-02-15

### Added

- Zero-knowledge encryption (AES-256-GCM via Web Crypto API)
- One-time secret sharing with atomic retrieve-and-destroy
- Optional password protection with Argon2id server-side hashing
- Configurable secret expiration (1 hour, 24 hours, 7 days, 30 days)
- PADME padding to prevent ciphertext length analysis
- Express 5 API with Zod-validated request schemas
- PostgreSQL storage via Drizzle ORM with nanoid identifiers
- Rate limiting (Redis-backed with in-memory fallback)
- Content Security Policy with per-request nonces via Helmet
- Automatic expired secret cleanup worker (node-cron)
- Accessibility foundations: skip links, aria-live route announcer, focus management
- Vanilla TypeScript SPA with Vite and Tailwind CSS

[Unreleased]: https://github.com/norcalcoop/torch-secret/compare/v5.3...HEAD
[5.3.0]: https://github.com/norcalcoop/torch-secret/compare/v5.2...v5.3
[5.2.0]: https://github.com/norcalcoop/torch-secret/compare/v5.1...v5.2
[5.1.0]: https://github.com/norcalcoop/torch-secret/compare/v5.0...v5.1
[5.0.0]: https://github.com/norcalcoop/torch-secret/compare/v4.0...v5.0
[4.0.0]: https://github.com/norcalcoop/torch-secret/compare/v3.0...v4.0
[3.0.0]: https://github.com/norcalcoop/torch-secret/compare/v2.0...v3.0
[2.0.0]: https://github.com/norcalcoop/torch-secret/compare/v1.0...v2.0
[1.0.0]: https://github.com/norcalcoop/torch-secret/releases/tag/v1.0
