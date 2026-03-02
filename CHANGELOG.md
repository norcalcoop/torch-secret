# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/norcalcoop/secureshare/compare/v5.0...HEAD
[5.0.0]: https://github.com/norcalcoop/secureshare/compare/v4.0...v5.0
[4.0.0]: https://github.com/norcalcoop/secureshare/compare/v3.0...v4.0
[3.0.0]: https://github.com/norcalcoop/secureshare/compare/v2.0...v3.0
[2.0.0]: https://github.com/norcalcoop/secureshare/compare/v1.0...v2.0
[1.0.0]: https://github.com/norcalcoop/secureshare/releases/tag/v1.0
