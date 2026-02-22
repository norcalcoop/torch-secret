# Milestones

## v1.0 MVP (Shipped: 2026-02-15)

**Phases completed:** 8 phases, 22 plans
**Timeline:** 2 days (2026-02-13 - 2026-02-14)
**Codebase:** 5,066 LOC TypeScript, 152 tests
**Git range:** feat(01-01) - docs(v1.0), 95 commits

**Key accomplishments:**
- Zero-knowledge AES-256-GCM encryption with PADME padding (87 crypto tests)
- Atomic read-and-destroy API with anti-enumeration on PostgreSQL
- Security hardening: CSP nonces, rate limiting, HSTS, Referrer-Policy, same-origin CORS
- Complete create-share-reveal frontend with responsive design and WCAG touch targets
- Password protection with Argon2id, 3-attempt auto-destroy, and attempt counters
- Background expiration worker with inline guards on all retrieval paths
- "How It Works" trust section and automated vitest-axe accessibility test suite
- Redis-backed rate limiting with MemoryStore fallback

**Delivered:** A production-ready, zero-knowledge one-time secret sharing web app with client-side encryption, password protection, automatic expiration, and WCAG 2.1 AA accessibility.

**Archives:**
- [Roadmap](milestones/v1.0-ROADMAP.md)
- [Requirements](milestones/v1.0-REQUIREMENTS.md)
- [Audit](milestones/v1.0-MILESTONE-AUDIT.md)

---


## v2.0 Developer-Grade UI & SEO (Shipped: 2026-02-16)

**Phases completed:** 6 phases, 14 plans, 33 tasks
**Timeline:** 3 days (2026-02-13 - 2026-02-16)
**Codebase:** 6,296 LOC (6,089 TS + 207 CSS), 163 tests
**Git range:** feat(09-01) - feat(14-02), 135 files changed (+9,258/-315)

**Key accomplishments:**
- Dark terminal-inspired design system with OKLCH semantic tokens and JetBrains Mono typography
- Complete SEO infrastructure — favicons, robots.txt, sitemap, web manifest, OG/Twitter meta, JSON-LD structured data
- Persistent header/footer layout shell with full Lucide SVG icon migration (all emoji replaced)
- Page-level UI enhancements — toast notifications, terminal code blocks, encryption indicators, trust sections
- Three-way theme toggle (dark/light/system) with glassmorphism surfaces and micro-interactions
- Dynamic per-route meta tags with noindex/X-Robots-Tag protection for secret URLs

**Delivered:** A polished, dark-themed developer tool with professional presentation, complete SEO infrastructure, and full design system — same zero-knowledge functionality, now with production-grade UI.

**Archives:**
- [Roadmap](milestones/v2.0-ROADMAP.md)
- [Requirements](milestones/v2.0-REQUIREMENTS.md)
- [Audit](milestones/v2.0-MILESTONE-AUDIT.md)

---


## v3.0 Production-Ready Delivery (Shipped: 2026-02-18)

**Phases completed:** 6 phases, 15 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---


## v4.0 Hybrid Anonymous + Account Model (Shipped: 2026-02-22)

**Phases completed:** 10 phases (21-30), 38 plans
**Timeline:** 4 days (2026-02-18 → 2026-02-22)
**Codebase:** ~21,775 LOC TypeScript (+44,306 insertions across 196 files)
**Git range:** feat(21-01) → test(30), 38 plans shipped

**Key accomplishments:**
- Better Auth integration — email/password + Google/GitHub OAuth, email verification, sessions, password reset, and 8 integration-tested auth flows
- Secret dashboard — authenticated users view owned-secret history (label, status, created/expires dates) with Active/Viewed/Expired/Deleted states and pre-view deletion
- EFF Diceware passphrase generator + password generator — 4-tab protection panel (No protection / Generate password / Custom password / Passphrase) with entropy display, brute-force estimates, rejection-sampling, and masked inputs with eye toggles
- Privacy-safe PostHog analytics — `before_send` hook strips URL fragments enforcing zero-knowledge invariant; funnel events + user identity without PII
- Email notifications via Resend — per-secret opt-in; fire-and-forget dispatch after atomic destroy; confirms deletion without secret content or viewer IP
- Conversion funnel + rate limits — tightened anonymous limits (3/hr, 10/day, 1h max expiration), authenticated higher tier (20/day, 7d max), inline upsell prompts at 3 trigger points, Privacy Policy and ToS pages

**Delivered:** SecureShare evolved from a pure anonymous tool into a hybrid model — anonymous users get instant secret creation with client-side passphrase generation, while optional free accounts unlock a secret dashboard, email notifications, extended expiration, and a progressive conversion funnel. All features preserve the zero-knowledge invariant: no log, DB record, or analytics event contains both userId and secretId.

**Archives:**
- [Roadmap](milestones/v4.0-ROADMAP.md)
- [Requirements](milestones/v4.0-REQUIREMENTS.md)
- [Audit](milestones/v4.0-MILESTONE-AUDIT.md)

---

