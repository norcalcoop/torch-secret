# Feature Research

**Domain:** Secure secret-sharing web applications (one-time link sharing)
**Researched:** 2026-02-13
**Confidence:** HIGH -- based on analysis of 10+ competitor products with official docs and multiple cross-referenced sources

## Competitor Landscape

Products analyzed: OneTimeSecret, PrivateBin, Yopass, Password Pusher, scrt.link, password.link, DELE.TO, Luzifer OTS, ShareSecret, ViewOnce.link, Infisical (sharing feature), 1TimeLink.

The market divides into three tiers:
1. **Full-featured (enterprise-leaning):** Password Pusher, OneTimeSecret -- accounts, audit logs, APIs, file sharing, custom branding
2. **Privacy-focused (zero-knowledge):** PrivateBin, Yopass, Luzifer OTS, DELE.TO -- client-side encryption, minimal server trust, open-source
3. **Simple sharers:** scrt.link, password.link, ViewOnce.link -- quick share, limited features, polished UX

SecureShare targets the intersection of tier 2 (zero-knowledge security) and tier 3 (simple UX). This is a genuine gap -- most zero-knowledge tools have developer-oriented UX, and most polished tools use server-side encryption.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Client-side encryption (AES-256-GCM)** | Every serious competitor offers encryption. Server-side is the floor; client-side is the trust differentiator. Users comparing tools check for this. | MEDIUM | Key in URL fragment is the standard zero-knowledge pattern (Yopass, DELE.TO, PrivateBin, Luzifer OTS all use it). Non-negotiable for SecureShare's positioning. |
| **One-time viewing (burn after reading)** | The defining feature of the category. PrivateBin, Yopass, OneTimeSecret, Password Pusher all offer it. Users choose these tools specifically for this guarantee. | LOW | Atomic delete-on-read at the database level. Must handle race conditions (two simultaneous requests). |
| **Configurable expiration (time-based)** | Every competitor offers at least 3 TTL options. Users expect control over how long a secret lives. | LOW | Common options: 1h, 24h, 7d, 30d. Yopass offers 1h/1d/1w. Password Pusher offers granular control. Default to 24h -- matches user mental model. |
| **Optional password/passphrase protection** | OneTimeSecret, PrivateBin, Password Pusher, scrt.link, password.link all offer this. It is the standard "extra layer" users reach for when sharing highly sensitive data. | MEDIUM | Derive a secondary key from the passphrase (PBKDF2 or Argon2), use it alongside the URL-fragment key. Must handle wrong-password UX gracefully. The 3-attempt auto-destroy from PROJECT.md is a solid choice. |
| **Copy-to-clipboard (link and secret)** | Every tool has this. Failing to provide one-click copy is a UX dealbreaker -- users will not manually select and copy. | LOW | Use Clipboard API with fallback. Show confirmation toast ("Copied!"). Apply to both the generated share link and the revealed secret text. |
| **Mobile-responsive design** | 40-60% of web traffic is mobile. All modern competitors are responsive. PrivateBin and Password Pusher explicitly support mobile. | LOW | Tailwind CSS handles this natively. Test on actual devices -- textarea input and copy buttons must work on iOS Safari (known clipboard quirks). |
| **Clear error/status states** | Users must immediately understand: secret already viewed, secret expired, invalid link, wrong password, rate limited. Ambiguous errors erode trust. | LOW | Every competitor handles this differently, but the common pattern is a distinct page/state per error with a clear message and CTA to create a new secret. |
| **Link preview protection (retrieval step)** | Slack, Teams, Discord, iMessage, and email clients auto-fetch URLs to generate previews. This consumes the one-time view, destroying the secret before the recipient sees it. Password Pusher calls this "1-click retrieval step." | LOW | Insert an interstitial page: "Click to reveal secret." The preview fetcher hits the interstitial, not the secret. This is critical -- without it, secrets shared via chat apps will appear "already viewed" to recipients. Multiple competitors implement this (Password Pusher, scrt.link). |
| **HTTPS-only** | Non-negotiable for any security tool. Users and browsers flag HTTP sites. | LOW | Enforce via HSTS headers. All competitors use HTTPS exclusively. |
| **Confirmation page after creation** | After creating a secret, user needs to see the share link prominently with copy button. Every competitor does this. | LOW | Show the link, copy button, and optionally a "share via" prompt. Do not navigate away from this page until user explicitly leaves. |

### Differentiators (Competitive Advantage)

Features that set SecureShare apart. Not expected across all competitors, but valued by users who encounter them.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-knowledge + polished consumer UX** | Most zero-knowledge tools (Yopass, PrivateBin, Luzifer OTS) have developer-oriented, utilitarian interfaces. Most polished tools (Password Pusher, OneTimeSecret) use server-side encryption. SecureShare fills the gap: real zero-knowledge security with a consumer-grade interface. | HIGH (holistic) | This is not a single feature but a design philosophy. Every interaction must feel effortless. Fewer form fields, clear visual hierarchy, trust-building copy, zero jargon. DELE.TO attempts this but is less established. |
| **"How it works" trust explainer** | Users sharing passwords are anxious about trust. Most competitors bury their security model in docs or GitHub READMEs. An in-app, plain-language explanation of the zero-knowledge architecture ("your secret never reaches our servers unencrypted") builds confidence at the moment of decision. | LOW | A collapsible section or dedicated page. Use simple diagrams. Competitors like scrt.link and password.link have "about security" pages but they read like technical docs. Write for a non-technical audience. |
| **Dark mode** | Increasingly expected in modern web apps. Developers (a target audience) strongly prefer it. Most secret-sharing tools (OneTimeSecret, Yopass, Password Pusher) do not offer dark mode. PrivateBin has theme support. | LOW | Tailwind dark mode is straightforward. Respect system preference via `prefers-color-scheme`. Toggle switch optional but nice. |
| **Secret creation animation/feedback** | Most competitors have a flat, form-submit-and-redirect flow. A subtle encryption animation or progress indicator ("Encrypting in your browser...") reinforces the zero-knowledge promise and makes the product feel premium. | LOW | CSS/JS animation during the (fast) encryption step. Not a spinner -- a purposeful visual showing encryption happening locally. |
| **Burn confirmation for sender** | OneTimeSecret (account holders only) lets senders burn secrets before they are read. Without accounts, SecureShare cannot do sender-initiated burn, but it can show a "secret status" page at the creation URL: "Your secret has been viewed" or "Your secret is still waiting." This gives senders confidence without requiring accounts. | MEDIUM | Requires storing a "viewed" flag accessible via a separate URL (the creator's receipt link, distinct from the share link). Do not store the secret itself -- just the status. |
| **Branded share links as marketing** | Every shared link is a marketing touchpoint. SecureShare branding on the reveal page ("Secured by SecureShare -- create your own") converts recipients into senders. No competitor does this well. | LOW | Subtle footer on the reveal page. Not intrusive -- recipients are already security-conscious and will notice quality. |
| **QR code for share link** | Password Pusher and PrivateBin offer QR codes. Useful when sharing a link in-person or transferring from desktop to mobile. Niche but valued. | LOW | Generate client-side with a small library (qrcode.js or similar). Display alongside the share link on the confirmation page. |
| **Accessibility (WCAG 2.1 AA)** | Most competitors fail basic accessibility audits. Screen reader support, keyboard navigation, proper ARIA labels, sufficient contrast -- these are rare in this space. Builds trust with enterprise users and is ethically right. | MEDIUM | Requires intentional design from day one. Retrofitting accessibility is expensive. Plan for it in component architecture. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but undermine SecureShare's core value proposition of simplicity, privacy, or security.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **User accounts and authentication** | Power users want dashboards, history, and team features. OneTimeSecret and Password Pusher offer them. | Destroys the zero-friction differentiator. Adds auth complexity, session management, password reset flows, PII storage, GDPR obligations. The moment you add "Sign Up" you compete with OneTimeSecret and Password Pusher on their turf -- and lose. | Keep anonymous. Use the burn-confirmation link (above) to give senders status without accounts. If accounts become necessary later (v2+), make them optional and never required to create/view secrets. |
| **File upload support** | Users want to share documents, images, SSH keys. Yopass and Password Pusher support files. | Dramatically increases storage costs, complexity (chunked uploads, virus scanning, size limits), and attack surface. Client-side encryption of files is technically different from text (ArrayBuffer handling, streaming). For MVP, this is a scope trap. | Text-only for v1. Support base64-encoded content if users paste encoded files. Consider file support in v2 with strict size limits (e.g., 1MB) and client-side encryption. |
| **API for programmatic access** | Developers and CI/CD pipelines want to create secrets programmatically. OneTimeSecret and Password Pusher have APIs. | Adds authentication complexity (API keys), rate limiting per key, documentation burden, versioning, and backward compatibility commitments. Also makes the product a target for abuse (automated spam/phishing link generation). | No public API for v1. If demand is strong, add a simple create-only API endpoint in v1.x with aggressive rate limiting. No API keys -- use the same anonymous model with IP-based rate limits. |
| **Slack/Teams bot integration** | ShareSecret, Hush, 1TimeLink all integrate with Slack. Users want to share secrets without leaving chat. | Building and maintaining Slack/Teams apps is a significant ongoing effort (OAuth, event subscriptions, app review, marketplace listing). The interstitial page already works in chat contexts. | The link-sharing flow already works perfectly in Slack/Teams. The retrieval step page protects against preview fetchers. A bot is v2+ at earliest if demand warrants it. |
| **Multiple view counts** | Infisical and ViewOnce.link allow secrets viewable N times. Seems like a useful flexibility. | Undermines the one-time security guarantee, which is the core mental model. "Viewable 5 times" raises questions: who viewed it? Was it compromised? The simplicity of "one view, then gone" is a feature, not a limitation. | Keep one-time as the default and only option. The mental model "share it once" is clear and trustworthy. Users who need persistent sharing should use a password manager. |
| **Read receipts / email notifications** | OneTimeSecret offers email notification when a secret is viewed. Senders want confirmation. | Requires collecting email addresses (PII), sending transactional email (infrastructure), and contradicts the "no accounts, no PII" principle. | Use the burn-confirmation status page instead. Sender bookmarks the creation receipt URL and can check whether the secret was viewed without providing any PII. |
| **Rich text / markdown editor** | PrivateBin supports markdown and syntax highlighting. Power users want formatting. | Adds complexity (markdown parser, XSS prevention in rendered output), increases attack surface, and most secrets are short plaintext (passwords, API keys, credentials). | Plain textarea only. Monospace font for readability. If demand emerges for code sharing, consider syntax highlighting in v2 as a format option (not a full editor). |
| **Secret editing after creation** | Users occasionally want to update a shared secret before it is read. | Fundamentally conflicts with the zero-knowledge model. The server has no decryption key, so it cannot "update" encrypted content. Would require re-encryption and new URLs, making the UX confusing. | Secrets are immutable. If the sender needs to change the content, they burn the old link (via status page) and create a new secret. Simple, clear, secure. |
| **Self-hosting (open-source distribution)** | PrivateBin, Yopass, Password Pusher, Luzifer OTS are all self-hostable. Enterprise users want control. | Maintaining Docker images, Helm charts, configuration docs, and supporting self-hosted users is a significant ongoing burden. Also limits the viral growth model (self-hosted users don't send branded links). | Consider open-sourcing in v2+ if there is enterprise demand. For v1, focus on the hosted service and the viral loop. Architecture should be clean enough that self-hosting is possible later but not an explicit goal. |
| **Internationalization (i18n)** | PrivateBin and Luzifer OTS support multiple languages. Global users want localized UI. | Translation management, RTL support, and ongoing maintenance of translation files adds overhead. Most target users (developers, remote workers) operate in English. | English only for v1. Structure the codebase with i18n-ready string extraction (use constants, not inline strings) so localization is feasible later without a rewrite. |

## Feature Dependencies

```
[Client-side encryption (AES-256-GCM)]
    |-- required by --> [One-time viewing]
    |-- required by --> [Password protection]
    |-- required by --> [Burn confirmation for sender]
    |-- required by --> [Secret creation animation]

[One-time viewing]
    |-- required by --> [Link preview protection / retrieval step]
    |-- required by --> [Clear error states (already viewed)]

[Configurable expiration]
    |-- required by --> [Background cleanup job]

[Password protection]
    |-- required by --> [3-attempt auto-destroy]
    |-- required by --> [Wrong password error state]

[Confirmation page after creation]
    |-- required by --> [Copy-to-clipboard (link)]
    |-- required by --> [QR code generation]
    |-- required by --> [Burn confirmation status link]
    |-- required by --> [Branded marketing footer]

[Mobile-responsive design]
    |-- enhances --> [Copy-to-clipboard] (iOS Safari clipboard quirks)
    |-- enhances --> [QR code] (mobile-to-mobile sharing)

[Dark mode]
    |-- independent, no dependencies
    |-- should be designed alongside --> [All UI components]

[Accessibility (WCAG 2.1 AA)]
    |-- must be built into --> [All UI components from day one]
    |-- conflicts with --> [Retrofitting later] (expensive rewrite risk)
```

### Dependency Notes

- **Encryption requires careful key management:** The URL-fragment key pattern means the encryption implementation is the foundation. Get this wrong and nothing else matters. Build and test encryption first, in isolation.
- **Retrieval step depends on one-time viewing:** The interstitial page only matters because views are consumed. Must be built as part of the viewing flow, not bolted on.
- **Burn confirmation requires a second URL:** The creation flow must generate two URLs -- one share link for the recipient and one status/receipt link for the sender. These are different endpoints with different behaviors.
- **Accessibility conflicts with retrofitting:** WCAG compliance must be a design constraint from the start. Adding it later requires touching every component and is 3-5x more expensive.
- **Dark mode should be designed with, not after:** Tailwind's dark mode classes should be applied during initial component development. Adding dark mode to an existing light-only design doubles the styling work.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to validate the concept and start the viral loop.

- [ ] **Client-side AES-256-GCM encryption** -- the core security promise; without this, SecureShare has no differentiation
- [ ] **Secret creation form** -- textarea with character counter, expiration selector, optional passphrase field
- [ ] **One-time viewing with atomic delete** -- the defining behavior of the product category
- [ ] **Link preview protection (retrieval step)** -- critical for real-world usage since most secrets are shared via chat apps that prefetch URLs
- [ ] **Configurable expiration (1h, 24h, 7d)** -- minimum viable time control
- [ ] **Optional password protection** -- with 3-attempt auto-destroy
- [ ] **Copy-to-clipboard** -- for share link and revealed secret
- [ ] **Confirmation page with share link** -- clear, prominent, with copy button
- [ ] **Clear error states** -- already viewed, expired, wrong password, rate limited, invalid link
- [ ] **Mobile-responsive layout** -- Tailwind responsive classes
- [ ] **Rate limiting** -- 10 creations per IP per hour (from PROJECT.md)
- [ ] **"How it works" trust section** -- plain-language zero-knowledge explainer
- [ ] **HTTPS enforcement** -- HSTS headers
- [ ] **Background expiration cleanup** -- cron job to delete expired secrets

### Add After Validation (v1.x)

Features to add once core is working and initial users provide feedback.

- [ ] **Dark mode** -- add when initial UI is stable; design tokens should support it from v1
- [ ] **Burn confirmation status page** -- sender can check if secret was viewed; add when viral loop is generating traffic
- [ ] **QR code for share link** -- add when mobile usage data confirms demand
- [ ] **Secret creation animation** -- add when core UX is polished and stable
- [ ] **30-day expiration option** -- add based on user feedback about TTL needs
- [ ] **Accessibility audit and WCAG 2.1 AA** -- should be designed for in v1 but formally audited and gap-filled in v1.x
- [ ] **Branded marketing footer on reveal page** -- add when there is traffic to convert

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **File upload support** -- only if text-only proves insufficient; requires significant architecture work
- [ ] **Simple create-only API** -- only if developer demand is clear and repeated
- [ ] **Slack/Teams integration** -- only if chat-sharing is the dominant use case and the retrieval step is insufficient
- [ ] **Optional user accounts** -- only if there is enterprise demand; must never be required
- [ ] **Open-source / self-hosting** -- only if enterprise demand justifies the maintenance burden
- [ ] **Internationalization** -- only if non-English markets become significant

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Client-side AES-256-GCM encryption | HIGH | MEDIUM | P1 |
| One-time viewing (burn after reading) | HIGH | LOW | P1 |
| Configurable expiration | HIGH | LOW | P1 |
| Copy-to-clipboard (link + secret) | HIGH | LOW | P1 |
| Link preview protection (retrieval step) | HIGH | LOW | P1 |
| Confirmation page with share link | HIGH | LOW | P1 |
| Optional password protection | HIGH | MEDIUM | P1 |
| Clear error/status states | HIGH | LOW | P1 |
| Mobile-responsive design | HIGH | LOW | P1 |
| Rate limiting | HIGH | LOW | P1 |
| HTTPS enforcement | HIGH | LOW | P1 |
| "How it works" trust section | MEDIUM | LOW | P1 |
| Background expiration cleanup | MEDIUM | LOW | P1 |
| Dark mode | MEDIUM | LOW | P2 |
| Burn confirmation status page | MEDIUM | MEDIUM | P2 |
| QR code for share link | LOW | LOW | P2 |
| Secret creation animation | LOW | LOW | P2 |
| Accessibility (WCAG 2.1 AA) audit | HIGH | MEDIUM | P2 |
| Branded marketing footer | LOW | LOW | P2 |
| File upload support | MEDIUM | HIGH | P3 |
| Simple create-only API | MEDIUM | MEDIUM | P3 |
| Slack/Teams integration | LOW | HIGH | P3 |
| Optional user accounts | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- core value proposition and basic usability
- P2: Should have, add when possible -- polish and growth features
- P3: Nice to have, future consideration -- scope expansion that changes the product

## Competitor Feature Analysis

| Feature | OneTimeSecret | PrivateBin | Yopass | Password Pusher | DELE.TO | SecureShare (planned) |
|---------|---------------|------------|--------|-----------------|---------|----------------------|
| Encryption model | Server-side | Client-side (AES-256-GCM) | Client-side | Server-side | Client-side (AES-256) | Client-side (AES-256-GCM) |
| Zero-knowledge | No | Yes | Yes | No | Yes | Yes |
| One-time viewing | Yes | Yes (burn option) | Yes | Yes (configurable) | Yes | Yes |
| Expiration options | Yes | Yes | 1h/1d/1w | Granular (views + time) | Yes | 1h/24h/7d/30d |
| Password protection | Yes | Yes | No | Yes | Yes | Yes |
| File upload | No | Yes (with limits) | Yes | Yes (paid, up to 4GB) | No | No (v1) |
| User accounts | Yes (optional) | No | No | Yes (optional) | No | No |
| API | Yes | No | No | Yes (v2) | No | No (v1) |
| Custom branding | Yes (paid) | Themes only | No | Yes (paid) | No | No |
| Audit logging | No | No | No | Yes | No | No |
| Retrieval step / link preview protection | No | No | No | Yes | No | Yes |
| QR code | No | Yes | No | Yes | No | v1.x |
| Dark mode | No | Yes (themes) | No | No | Yes | v1.x |
| Self-hostable | Yes | Yes | Yes | Yes | No | No (v1) |
| Secret requests (receive) | No | No | No | Yes | No | No |
| Syntax highlighting | No | Yes | No | No | No | No |
| Discussions/comments | No | Yes | No | No | No | No |
| CLI tool | No | No | No | Yes | No | No |
| i18n | No | Yes | No | No | No | No |
| WCAG accessibility | Poor | Poor | Poor | Fair | Fair | Target: AA |
| UX polish | Good | Poor (utilitarian) | Minimal | Good | Good | Target: Excellent |

## Sources

- [OneTimeSecret](https://onetimesecret.com/) -- official site, docs at docs.onetimesecret.com (MEDIUM confidence)
- [PrivateBin](https://privatebin.info/) -- official site, GitHub README and wiki (MEDIUM confidence)
- [Yopass](https://yopass.se/) -- official site, GitHub at github.com/jhaals/yopass (MEDIUM confidence)
- [Password Pusher](https://us.pwpush.com/features) -- official features page, docs at docs.pwpush.com (HIGH confidence)
- [DELE.TO](https://dele.to/alternatives) -- competitor comparison pages (LOW confidence -- marketing claims)
- [password.link](https://password.link/en) -- official site and features page (MEDIUM confidence)
- [scrt.link](https://scrt.link/) -- official site (LOW confidence -- limited details in search results)
- [Luzifer OTS](https://github.com/Luzifer/ots) -- GitHub README (MEDIUM confidence)
- [Cipher Projects Guide](https://cipherprojects.com/blog/posts/complete-guide-one-time-secret-sharing-tools-2025/) -- comprehensive comparison guide (MEDIUM confidence)
- [FairDevs Guide](https://fairdevs.com/blog/best-one-time-secret-sharing-tools-2025) -- tool comparison (LOW confidence)
- [MaxSpeedBox Guide](https://maxspeedbox.com/blog/best-one-time-secret-sharing-tools-2025) -- tool comparison (LOW confidence)

---
*Feature research for: secure secret-sharing web applications*
*Researched: 2026-02-13*
