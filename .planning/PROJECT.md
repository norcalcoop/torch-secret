# SecureShare

## What This Is

SecureShare is a zero-friction web application for sharing passwords, API keys, and sensitive text securely via one-time, self-destructing links. It uses client-side AES-256-GCM encryption so the server never sees plaintext secrets. No accounts, no signup — just paste, encrypt, share, and destroy.

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

### Active

**Current Milestone: v2.0 Developer-Grade UI & SEO**

**Goal:** Transform SecureShare's visual identity into a polished, dark-themed developer tool with full SEO infrastructure — same zero-knowledge functionality, professional presentation.

**Target features:**
- Dark terminal-inspired theme with glassmorphism cards and dot-grid background
- Monospace typography for headings, Lucide SVG icons replacing emoji
- Persistent brand header + trust footer across all pages
- Code-block styling for revealed secrets, micro-interactions
- Complete SEO infrastructure (meta tags, OG/Twitter cards, favicons, robots.txt, sitemap, JSON-LD, web manifest)
- Enhanced UI: textarea security indicator, "Why Trust Us?" section, destruction confirmation badge

### Out of Scope

- User accounts and authentication — zero-friction is the core differentiator
- File uploads — text only for MVP, reduces complexity and storage costs
- Editing/revoking secrets after creation — one-time links are the model
- Analytics dashboard for users — no accounts means no dashboard
- Browser extensions — web-first for MVP
- Public API — internal use only for now
- Team/organization features — individual sharing for MVP
- Mobile apps — responsive web covers mobile use cases
- Real-time notifications when secret is viewed — adds complexity without core value
- Offline mode — real-time server interaction is core to the destroy model

## Context

Shipped v1.0 with 5,066 LOC TypeScript across 8 phases.
Tech stack: Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17.
Crypto: Web Crypto API (AES-256-GCM), PADME padding, Argon2id password hashing.
152 tests (87 crypto, 32 API integration, 14 security, 13 expiration, 6 accessibility).
Redis-backed rate limiting with MemoryStore fallback for single-instance deployments.

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

---
*Last updated: 2026-02-14 after v2.0 milestone started*
