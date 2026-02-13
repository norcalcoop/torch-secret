# SecureShare

## What This Is

SecureShare is a zero-friction web application for sharing passwords, API keys, and sensitive text securely via one-time, self-destructing links. It uses client-side encryption so the server never sees plaintext secrets. No accounts, no signup — just paste, encrypt, share, and destroy.

## Core Value

Users can share sensitive information once, securely, without accounts or complexity — the secret is encrypted in the browser, viewable only once, then permanently destroyed.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Client-side AES-256-GCM encryption with key in URL fragment (zero-knowledge)
- [ ] Secret creation with textarea input (max 10,000 chars)
- [ ] One-time viewing — secret destroyed after first view
- [ ] Configurable expiration (1h, 24h, 7d, 30d; default 24h)
- [ ] Optional password protection with 3-attempt auto-destroy
- [ ] Copy-to-clipboard for generated links and revealed secrets
- [ ] Background expiration cleanup job
- [ ] Rate limiting (10 creations per IP per hour)
- [ ] Mobile-responsive design
- [ ] Trust-building content (How it works, Why trust us)
- [ ] Clear error states (already viewed, expired, invalid password, rate limited)

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

## Context

- Target users: remote workers, developers, content creators, everyday consumers sharing credentials
- Core problem: people share credentials via Slack/email because secure alternatives are too complex
- Zero-knowledge architecture: server stores only encrypted blobs, encryption keys live in URL fragments
- URL format: `https://secureshare.app/s/[SECRET_ID]#[BASE64_ENCRYPTION_KEY]`
- Encryption: AES-256-GCM, 256-bit random key per secret, unique 96-bit IV
- PRD specifies PostgreSQL for persistence, Redis for rate limiting
- PRD suggests Node.js/Express or Python/Flask backend, vanilla JS or React frontend with Tailwind CSS
- Viral growth model: every shared link is a marketing opportunity

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
| Client-side encryption with key in URL fragment | Zero-knowledge — server never sees plaintext; URL fragments not sent to server | — Pending |
| No user accounts for MVP | Core differentiator is zero-friction; accounts add complexity | — Pending |
| One-time view model | Stronger security guarantee; simpler than revocation | — Pending |
| Password protection with 3-attempt limit | Extra security layer without complexity; auto-destroy prevents brute force | — Pending |

---
*Last updated: 2026-02-13 after initialization*
