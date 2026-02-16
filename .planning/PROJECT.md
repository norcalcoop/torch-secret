# SecureShare

## What This Is

SecureShare is a polished, developer-grade web application for sharing passwords, API keys, and sensitive text securely via one-time, self-destructing links. It uses client-side AES-256-GCM encryption so the server never sees plaintext secrets. Dark terminal-inspired UI with glassmorphism surfaces, complete SEO infrastructure, and professional presentation. No accounts, no signup — just paste, encrypt, share, and destroy.

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

### Active

(No active milestone — planning next)

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

Shipped v2.0 with ~6,296 LOC (6,089 TS + 207 CSS) across 14 phases (8 in v1.0 + 6 in v2.0).
Tech stack: Node.js 24, Express 5, Vite 7, Tailwind CSS 4, Drizzle ORM, PostgreSQL 17.
Crypto: Web Crypto API (AES-256-GCM), PADME padding, Argon2id password hashing.
163 tests (87 crypto, 32 API integration, 14 security, 13 expiration, 6 accessibility, 4 SEO, 7 UI).
Redis-backed rate limiting with MemoryStore fallback for single-instance deployments.
Design system: OKLCH semantic color tokens, dual light/dark themes, glassmorphism surfaces.
SEO: Full meta infrastructure, JSON-LD, favicons, sitemap, noindex on secret routes.

**Known tech debt:**
- Placeholder domain `secureshare.example.com` in SEO assets (needs production domain)
- Pre-existing TypeScript strict-mode errors in crypto/icons/accessibility files
- Lucide ESM workaround via Vite resolve.alias (upstream bug)

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

---
*Last updated: 2026-02-16 after v2.0 milestone*
