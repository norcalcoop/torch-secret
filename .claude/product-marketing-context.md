# Product Marketing Context

_Last updated: 2026-02-20_

## Product Overview

**One-liner:** Zero-knowledge, one-time secret sharing — encrypted in your browser, destroyed after one view.

**What it does:** Torch Secret lets users paste sensitive text (passwords, API keys, tokens, credentials), get an encrypted link, share it once, and the secret permanently self-destructs. The encryption key never reaches the server — it lives only in the URL fragment. Even a full database breach reveals nothing.

**Product category:** Secure secret sharing / one-time link tools (how customers search: "share password securely", "one-time secret link", "send API key safely")

**Product type:** Web application (SPA), open source

**Business model:** Freemium. Free tier for anonymous use (no account required). Account tier unlocks expanded features (share history, dashboard). Paid tiers planned for future release.

---

## Target Audience

**Target users:** Developers, DevOps engineers, security engineers, IT teams, and security-conscious professionals who regularly share sensitive credentials.

**Primary use case:** Sharing one-time sensitive data (API keys, database passwords, SSH credentials, tokens, secret notes) without leaving a permanent trail in Slack, email, or SMS threads.

**Jobs to be done:**

- "I need to send a colleague a password without it sitting in Slack forever"
- "I need to share an API key with a contractor without it living in my email inbox"
- "I need a safer alternative to copy-pasting credentials into a chat app"

**Use cases:**

- Developer sends database credentials to a new team member
- IT admin shares a temporary password for an onboarded employee
- Freelancer delivers API keys to a client at project end
- Team member shares SSH private key during offboarding/handoff

---

## Personas

| Persona                       | Cares about                  | Challenge                                               | Value we promise                                        |
| ----------------------------- | ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Developer / DevOps            | Security, speed, no friction | Slack/email retains secrets forever; rotation is a pain | One command: paste → share → gone                       |
| IT Admin / SysAdmin           | Auditability, compliance     | Credential sharing is a compliance risk                 | Nothing persists after view; zero server-side plaintext |
| Security-conscious individual | Privacy, no accounts         | Doesn't trust SaaS tools with sensitive data            | Open source + zero-knowledge = verifiable trust         |

---

## Problems & Pain Points

**Core problem:** Sensitive credentials shared via Slack, email, or SMS persist indefinitely — in chat history, email archives, and server logs — long after they should have been rotated or deleted.

**Why current alternatives fall short:**

- Slack/email: No self-destruct, searchable by anyone with access, often backed up to cloud
- Password managers with "share" features: Require the recipient to have an account
- Manual rotation workflows: Cumbersome; teams skip them under time pressure
- Other one-time tools (e.g., onetimesecret.com): The server _can_ see your plaintext before it's encrypted server-side — not truly zero-knowledge

**What it costs them:** A leaked API key or credential can cause a security incident, data breach, or compliance violation — with real financial and reputational consequences.

**Emotional tension:** "I know I shouldn't send this in Slack, but it's the fastest option right now." Guilt + convenience friction + awareness that they're doing the wrong thing.

---

## Competitive Landscape

**Direct competitors:**

- **onetimesecret.com** — Falls short because: server-side encryption means the server sees plaintext; no true zero-knowledge guarantee
- **pwpush.com (Password Pusher)** — Falls short because: server-side encryption; open source but not zero-knowledge by default
- **Privnote** — Falls short because: no open source; server-side encryption; minimal trust surface

**Indirect competitors (same problem, different approach):**

- Slack/email with "delete message" — Falls short because: deletion isn't guaranteed; already logged/archived
- Password manager sharing (1Password, Bitwarden) — Falls short because: requires recipient to have an account in the same system

**What makes Torch Secret different:** True zero-knowledge — the encryption key never reaches the server. AES-256-GCM happens entirely in the browser using the Web Crypto API. A full database dump reveals only encrypted blobs. This is architecturally verifiable, not a marketing claim.

---

## Differentiation

**Key differentiators:**

- Encryption key lives only in the URL fragment — never sent to the server (RFC 3986 spec)
- Open source — anyone can audit the security claims
- No accounts required for basic use — zero friction, zero tracking
- PADME padding prevents ciphertext length from leaking secret length
- Password protection layer — optional second factor on top of the encryption key

**How we do it differently:** Client-side AES-256-GCM using the browser's native Web Crypto API. The server is a dumb encrypted blob store. It cannot decrypt what it stores.

**Why that's better:** You don't have to trust us. The architecture makes it mathematically impossible for us to read your secrets (without the URL fragment, which we never receive).

**Why customers choose us over alternatives:** Zero-knowledge is verifiable (open source), no account creation for recipients, and the UX is dead simple — paste, click, share.

---

## Objections

| Objection                                             | Response                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "How do I know you're not storing the plaintext?"     | The encryption key lives only in the URL fragment — per HTTP spec, fragments are never sent to the server. Open source code: verify it yourself.         |
| "What if the link is intercepted?"                    | HTTPS protects the link in transit. The fragment (#key) is also never logged by servers per HTTP spec. Optional password protection adds a second layer. |
| "I need something my non-technical colleague can use" | They click a link, click "Reveal Secret." That's it. No account, no app install.                                                                         |

**Anti-persona:** Teams that need persistent credential storage with audit trails (use a secrets manager like Vault or AWS Secrets Manager instead). Torch Secret is for _ephemeral_ sharing, not persistent storage.

---

## Switching Dynamics

**Push (what frustrates them about current tools):** "I hate that my API keys sit in Slack search results for years." "I got burned by a credential leak from an old email thread."

**Pull (what attracts them to Torch Secret):** True zero-knowledge architecture, no-account-required for recipients, open source auditability, one-time destruction guarantee.

**Habit (what keeps them stuck):** Slack/email is already open. Convenience beats security in the moment. No habit of reaching for a separate tool.

**Anxiety (what worries them about switching):** "What if the link breaks or expires before they open it?" "What if they accidentally trigger the one-time view?"

---

## Customer Language

**How they describe the problem:**

- "I needed to send an API key and just… Slacked it. I know."
- "There's no good way to send a password without it living somewhere forever"
- "I keep meaning to set up a proper secrets manager but we just need something now"

**How they describe a solution like this:**

- "Burn after reading"
- "Self-destructing message"
- "One-time link"
- "Secure drop"

**Words to use:** zero-knowledge, one-time, encrypted, self-destruct, no accounts, open source, browser-encrypted, permanent deletion, AES-256-GCM (for technical audiences)

**Words to avoid:** "safe" (vague), "secure" alone (overused), "military-grade" (cringe with technical audience, acceptable for non-technical), "we protect your data" (implies we can see it — we can't)

**Glossary:**
| Term | Meaning |
|------|---------|
| Zero-knowledge | The server stores only encrypted ciphertext and cannot decrypt it |
| URL fragment | The `#key` part of the share URL — never sent to the server per HTTP spec |
| One-time view | The secret is permanently deleted the moment it is revealed |
| PADME padding | Technique to prevent ciphertext size from leaking secret length |

---

## Brand Voice

**Tone:** Direct, technical, trustworthy. Respects the user's intelligence. Never fluffy. Never hype. When speaking to developers: peer-to-peer. When speaking to non-technical users: simple and reassuring.

**Style:** Short declarative sentences. Lead with the security guarantee. Avoid jargon with non-technical users; embrace precision with technical users. No exclamation points.

**Personality:** Confident, minimal, security-first. Think: the tool that does exactly one thing and does it correctly.

**Voice examples:**

- ✓ "End-to-end encrypted. One-time view. No accounts."
- ✓ "Your secrets are encrypted before reaching our servers. We never see your data."
- ✓ "Just share and go."
- ✗ "Keep your data safe with our amazing secure platform!"
- ✗ "We take security super seriously!"

---

## Brand Colors & Typography

**Primary accent:** Electric blue

- Light mode: `#154fac` (OKLCH 0.45 0.16 260) — 7.65:1 contrast vs white (WCAG AAA)
- Dark mode: `#60a4f9` (OKLCH 0.71 0.143 255)

**Background:**

- Light: Near-white `#f7f8fc` with white surfaces
- Dark: Deep purple-navy `#1a1a2e` with layered indigo surfaces (`#222240`, `#292a4a`)

**Status colors:**

- Danger: `#a9131f` (light) / `#f04546` (dark)
- Success: `#195c2e` (light) / `#1bc45e` (dark)
- Warning: `#7e4f04` (light) / `#f69e0b` (dark)

**Typography:**

- Headings / code: JetBrains Mono Variable (monospace — reinforces technical, code-native identity)
- Body: System sans-serif (ui-sans-serif, system-ui)

**Visual style:** Glassmorphism surfaces (`backdrop-blur`, `bg-surface/80`), sparse dot-grid texture, fade-in-up micro-animations. Engineering-grade aesthetic — purposeful, not decorative.

---

## Proof Points

**Metrics:** None yet (pre-launch / early stage)

**Technical proof points:**

- AES-256-GCM — the encryption standard used by NIST, TLS, and government systems worldwide
- Web Crypto API — native browser crypto, hardware-accelerated, zero third-party dependencies
- URL fragment key distribution — mathematically cannot be logged by the server (RFC 3986)
- Open source — security claims are auditable, not just marketing

**Value themes:**
| Theme | Proof |
|-------|-------|
| True zero-knowledge | Encryption key in URL fragment, never sent to server |
| Verifiable security | Open source codebase — audit it yourself |
| Zero friction | No account for recipient — click link, reveal, done |
| Permanent destruction | Atomic server-side delete on first view |

---

## Pricing

**Model:** Freemium, self-serve. No sales motion.

**Tiers:**
| Tier | Price | Key features |
|------|-------|--------------|
| Free (Anonymous) | $0 | Unlimited one-time secrets, no account required, standard expiration (1h/24h/7d), password protection, no history |
| Pro | $9/month ($7/month annual) | Account + dashboard, secret history (90 days), view receipts, extended expiration (30 days), 500 secrets/month with history |
| Team | $29/month flat (≤5 users), $6/user after | Shared team dashboard, team member management, usage analytics, priority support |
| Enterprise | Custom | Self-hosted license, SSO/SAML, custom retention, compliance docs, dedicated SLA |

**Value metric:** Account-tier features (history, dashboard), not secret creation. Anonymous secret creation is always unlimited.

**Annual discount:** 20% off (2 months free). Annual is the recommended default toggle.

**What is never gated:** Zero-knowledge encryption, anonymous secret creation, password protection, basic expiration. These are trust foundations, not upsell levers.

**Primary upgrade moments:**

- User wants to know if their secret was opened (view receipts → Pro)
- User wants to see past secrets (history → Pro)
- User needs 30-day expiration (→ Pro)
- Multiple team members need shared visibility (→ Team)

**Pre-launch sequencing:** Launch Free + Pro only. Add Team once organic team usage patterns emerge. No usage limits on the free tier at launch — establish trust before adding friction.

**Billing constraint:** Billing may only track seat counts and billing events. It must never join `userId` + `secretId` in any record — this would violate the zero-knowledge invariant. See `.planning/INVARIANTS.md`.

**Full pricing strategy:** `.claude/pricing-strategy.md`

---

## Goals

**Business goal:** Establish Torch Secret (torchsecret.com) as the go-to zero-knowledge one-time secret sharing tool for developers and security-conscious teams, then convert free users to paid accounts via expanded features.

**Key conversion action (free):** User pastes a secret and clicks "Create Secure Link." **Key conversion action (paid):** Free user creates an account to unlock share history and dashboard features. Future: free account user upgrades to paid tier for advanced features.

**Current metrics:** Early development / pre-launch. No live traffic metrics yet.

---

## Related Documents

- **Launch Strategy:** `.claude/launch-strategy.md` — 6-week launch roadmap, channel strategy (ORB), Show HN approach, Product Hunt evaluation
- **Launch Checklist:** `.claude/launch-checklist.md` — Phase-by-phase checklist from foundation through post-launch
- **Pricing Strategy:** `.claude/pricing-strategy.md` — Full tier breakdown, value metric, upgrade moments
- **Marketing Roadmap:** `.claude/marketing-roadmap.md`
- **Marketing Ideas:** `.claude/marketing-ideas.md` — Top 5 prioritized ideas for pre-launch stage: Show HN, competitor comparison pages, powered-by viral loop, Reddit marketing, problem-first SEO
- **Landing Page & Pricing Copy:** `.claude/landing-pricing-copy.md` — Full copy for the main landing page (hero, problem, how it works, comparison, objections, CTAs) and pricing page (plan cards, FAQ, CTAs); includes headline alternatives and A/B test recommendations
- **Competitor Data Files:** `.claude/competitors/` — YAML profiles for each direct competitor (onetimesecret, pwpush, privnote): pricing, encryption model, strengths/weaknesses, best-for, common complaints, SEO terms, and differentiation notes vs. Torch Secret. Single source of truth — update here when competitors change.
- **Competitor & Alternative Pages:** `.claude/competitor-pages/` — Full page copy for 6 SEO pages: `/vs/onetimesecret`, `/vs/pwpush`, `/vs/privnote`, `/alternatives/onetimesecret`, `/alternatives/pwpush`, `/alternatives/privnote`. Each includes URL, meta tags, comparison tables, all body sections, and FAQ (schema-ready).
- **Use Case Pages:** `.claude/use-case-pages.md` — Full strategy + page copy for 8 programmatic SEO use case pages at `/use/[slug]`: share-api-keys, share-database-credentials, share-ssh-keys, send-password-without-email, share-credentials-without-slack, share-env-file, share-credentials-with-contractor, onboarding-credential-handoff. Each includes URL, meta tags, full body copy, step-by-step (HowTo schema), FAQ (FAQPage schema), and internal links. Includes hub page at `/use/` and schema markup templates.
