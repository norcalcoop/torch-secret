# Feature Research: v4.0 Hybrid Anonymous + Account Model

**Domain:** Zero-knowledge one-time secret sharing SaaS with hybrid anonymous/account model
**Researched:** 2026-02-18
**Confidence:** HIGH (verified against EFF official docs, competitor live products, SaaS conversion research)

---

## Context: What Already Exists

SecureShare v3.0 is production-ready: AES-256-GCM browser encryption, create/share/reveal workflow, password protection (Argon2id), configurable expiration (1h/24h/7d/30d), 3-attempt auto-destroy, copy-to-clipboard, toast notifications, terminal-style reveal UI, rate limiting (10 creations/hour per IP, Redis-backed), dark/light/system theme, WCAG 2.1 AA, full SEO, Playwright E2E tests, Docker + CI/CD, ESLint/Prettier, marketing homepage.

v4.0 adds: EFF Diceware passphrase generator, user accounts (email + OAuth), secret dashboard with history metadata, email viewed-notifications, Pro tier (extended expiration, file uploads, webhooks, custom passwords), progressive conversion prompts, tightened anonymous rate limits (3/hour, 10/day), PostHog analytics.

---

## Feature Landscape

### Feature Area 1: EFF Diceware Passphrase Generator

**What it is:** Browser-side random passphrase generation using the EFF long wordlist (7,776 words, 5-dice selection scheme) as a convenience feature on the create-secret form. Replaces the burden of choosing a manual password.

**Technical grounding:** EFF long wordlist = 7,776 words (6^5). Each word = 12.9 bits of entropy. 4-word passphrase = ~51.7 bits (adequate for most use cases; EFF recommends 6 words / 77 bits for high-security contexts). Generation must use `crypto.getRandomValues()` — no `Math.random()`. The wordlist must be bundled client-side; no server round-trip for generation. Source: [EFF Diceware official docs](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases).

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Generate Passphrase" button in password field | Users who enable password protection shouldn't have to invent passwords themselves. Every comparable tool offers generation. | LOW | Appears as an icon/link inside or adjacent to the password input. Replaces field value on click. |
| Regenerate button | Generated phrases are accepted or retried. One-time generation with no way to regenerate creates friction — user may not like the words. | LOW | Same button or separate small "Regenerate" link. Each click calls `crypto.getRandomValues()` fresh. |
| Copy-to-clipboard for generated passphrase | The passphrase must reach the recipient separately (two-channel security). If the user can't copy it easily, they'll skip password protection entirely. | LOW | Existing copy-button component can be reused. |
| Two-channel security note | Users must understand the passphrase travels separately from the link. Without this instruction, they'll email/message both together, defeating the purpose. | LOW | Static inline callout: "Share this passphrase separately — not in the same message as the link." |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Display word count selector (4 vs 6 words) | 4 words (~51 bits) is convenient but not high-security. Pro users sharing credentials to enterprise systems need 6 words (~77 bits). Giving users control over strength signals sophistication. | LOW | Toggle or dropdown: "Standard (4 words)" / "Strong (6 words, Pro)". Free tier: 4-word only. Pro: both. |
| Entropy readout alongside passphrase | "~52 bits of entropy" shown next to the generated phrase reassures technical users that generation is cryptographically strong, not random-looking-but-weak. | LOW | Text label, not a strength meter. "~52 bits" is more honest and less gameable than a color bar. |
| Inline word-list attribution ("EFF Diceware") | EFF is a trusted privacy organization. Attributing the wordlist adds credibility without adding UI complexity. | LOW | Small "EFF wordlist" link in tooltip or footnote. Differentiates from "we rolled our own" generators. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Strength meter color bar | Meaningless for diceware — all 4-word EFF passphrases have identical entropy. A strength bar on a diceware output is misleading theater. | Show entropy bits (factual) instead of a subjective bar. |
| User-typed passphrase strength estimation | Scope creep. If the user types their own password, we hash it with Argon2id — strength estimation is not our responsibility in a zero-knowledge model. | Show only the entropy readout for generated passphrases. Leave typed passwords unevaluated. |
| Server-side passphrase generation | Defeats zero-knowledge property. Server would see passphrase candidates in logs. | All generation in browser via `crypto.getRandomValues()`. |
| Storing the generated passphrase | We store only the Argon2id hash of whatever password the user sets, not the passphrase itself. Never log, never store, never transmit in plaintext. | Client discards passphrase after user copies it. Never sent to server in unhashed form. |

---

### Feature Area 2: User Accounts (Registration, Login, OAuth)

**What it is:** Optional account system layered on top of the existing anonymous flow. No account required to use core features. Accounts unlock: secret history dashboard, email notifications, Pro features.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email + password registration | Every SaaS with accounts needs baseline email auth. Users expect to sign up with email, even if they prefer OAuth in practice. | MEDIUM | Use existing Argon2id for password hashing. Add `users` table to Drizzle schema. Email verification required before dashboard access. |
| Google OAuth | Google OAuth is the most common social login for developer-facing tools. Reduces friction significantly. | MEDIUM | Use passport.js or a purpose-built OAuth library. Callback route needed. No account-linking complexity if email matches existing account. |
| GitHub OAuth | Developer-tool users skew toward GitHub accounts. SecureShare targets developers. GitHub OAuth is expected for this audience, more than Facebook or Apple. | MEDIUM | Same OAuth library as Google. Prioritize GitHub as the second OAuth option. |
| Secure session management | After login, users need a session (cookie or JWT). Session must not store or expose secret content — sessions are only for identity, never for secret retrieval. | MEDIUM | HTTP-only signed cookies with express-session and Redis store. Session data: user ID, email, plan. Nothing about secrets. |
| Password reset via email | Required for any production email-based auth. Users forget passwords. Without reset, support burden grows. | MEDIUM | Time-limited reset tokens (24h), emailed link, server-side token invalidation after use. |
| Logout | Trivially expected. | LOW | Session destruction, cookie clearing. |
| Anonymous → account upgrade path | Anonymous users who created secrets and then register should see those secrets in their dashboard IF they created them during the same browser session. | HIGH | Associate anonymous-session secrets with account on upgrade by matching session ID at registration time. Requires planning (see Feature Area 3). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Save to account" prompt shown after secret creation | Anonymous users see a prompt after creating their first secret: "Create a free account to track when this is viewed." Converts at the moment of highest motivation. | MEDIUM | Non-blocking inline prompt below the share link. Not a modal — non-intrusive. Dismissible. |
| Remember anonymous secrets across devices via account | An anonymous secret is tied to a browser session. Registering converts those secrets to persistent history, accessible from any device. | HIGH | Complex identity merge — session-scoped secrets must be claimed at account creation. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Requiring account for core features | The zero-knowledge anonymous model is the product's core identity. Gating creates abandonment, contradicts the "no accounts" value prop on the homepage. | Preserve anonymous-first UX. Accounts are enhancement, not prerequisite. |
| Storing passwords in plaintext or reversible form | Obvious security failure. | Argon2id only, OWASP parameters (already in codebase). |
| Facebook / Apple OAuth as primary options | Developer audience does not skew toward these. Adds implementation complexity with lower conversion value. | Google + GitHub covers 80%+ of the target audience. Add others post-launch if user demand warrants. |
| Email verification on registration before first use | Forces users to go check email before using the dashboard — kills momentum. | Allow limited dashboard access immediately (view the secret you just created), require email verification only for notifications and Pro features. |

---

### Feature Area 3: Secret History Dashboard

**What it is:** A list of metadata about secrets the authenticated user has created. Zero-knowledge constraint applies: the dashboard shows only metadata (label, creation time, expiry time, status). It never shows secret content or the URL fragment key.

**The fundamental dashboard challenge:** Once a secret is viewed, it is atomically destroyed (SELECT → zero → DELETE). The system retains a metadata record with the viewed status. The user can see "this secret was viewed at 14:32 UTC" but cannot see what the secret contained or retrieve it. This is correct behavior — explaining it clearly in the UI is important.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Secret list with status states | Users who create secrets expect to know if they were viewed. The core value of a notification dashboard is confirmation of delivery. | MEDIUM | See status model below. |
| Status states: Active / Viewed / Expired / Deleted | These four states cover all possible outcomes for a one-time secret. Users need distinct visual treatment for each. | LOW | Active: green dot, "Awaiting view". Viewed: checkmark, "Viewed [time]". Expired: gray, "Expired [time]". Deleted: strikethrough, "Deleted by you". |
| Created time and expiry time display | Users want to know when the secret was created and when it will self-destruct if never viewed. | LOW | Both stored in existing `secrets` table already. |
| Optional label per secret | Without labels, a list of secrets is meaningless ("Secret created at 14:30" tells the user nothing). Labels let users track which secret went to whom. | LOW | Optional free-text label (max 100 chars), set at creation time. Stored in metadata row only — never encrypted alongside the secret. |
| Pre-view deletion (delete before recipient opens) | Users frequently realize they sent the wrong link or changed their mind. Ability to revoke an unviewed secret is essential. | MEDIUM | "Delete" action on Active secrets only. Triggers existing atomic destroy. Updates metadata row status to "Deleted". |
| Pagination or virtual scroll | A user who creates 50+ secrets needs a usable list. | LOW-MEDIUM | Simple pagination (20 per page). No infinite scroll needed — this is not a high-volume list. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Copy share link again" from dashboard | After creation, the share link exists only in the confirmation page. Users who navigate away lose it. The dashboard shows the share URL (NOT the fragment key). | MEDIUM | Store share URL (without #key) in metadata. User can copy the base URL. Note: the key in the fragment is gone — they cannot regenerate the full URL with key. Add explicit "Link cannot be reconstructed — store it now" warning on creation. |
| Bulk delete | Power users who create many secrets for testing/dev want to clean up. | LOW | Checkbox multi-select + bulk delete action. Active secrets only. |
| Secret count and usage stats | "You've created 47 secrets this month" — lightweight usage awareness that may nudge Pro consideration. | LOW | Simple aggregate count in dashboard header. No detailed analytics (that's PostHog's job). |
| Filter by status | For users with long history, filtering to "Active" only (secrets still unviewed) is the highest-value view. | LOW | Tab-based filter: All / Active / Viewed / Expired. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Showing or reconstructing secret content | Fatal zero-knowledge violation. The server never had plaintext. The URL fragment (#key) was never stored. | Show metadata only. Explicitly tell users "Secret content is not stored." in empty state copy. |
| Showing IP address of viewer | Privacy violation for the recipient. Logs must not contain IPs (already a constraint in existing middleware). | Show only timestamp of view event. No geolocation, no IP, no device data. |
| Infinite secret history by default (free tier) | Unbounded metadata storage per free user. | Free tier: 30 days of history. Pro: 90 days or unlimited. |
| "Re-share" or duplicate secret button | A "re-share" creates a new secret with identical content — but the server never had the plaintext content in the first place. Cannot re-encrypt what was never stored. | Explain in UI: "One-time secrets cannot be duplicated. Create a new secret." |

---

### Feature Area 4: Email Notifications (Secret Viewed Alert)

**What it is:** When an authenticated user creates a secret with notifications enabled, they receive an email when their secret is viewed (or when it expires unviewed, if they opt in).

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Notify me when viewed" toggle at creation | Users who want notification must be able to opt in per-secret. This is why they created an account — a global setting is insufficient because some secrets are casual (no notification needed), others are important (notification required). | LOW-MEDIUM | Toggle on the create form, only visible to logged-in users. Default off. |
| Email alert on secret view | The primary value of account creation for many users. Reduces the need to check the dashboard. | MEDIUM | Trigger on the POST /api/secrets/:id (GET + verify routes) atomic destroy sequence. After destroy, if user opted in, enqueue an email job. |
| Notification email content | The email must convey the right information without revealing what the secret contained (zero-knowledge). | LOW | See email content design below. |
| Unsubscribe / notification preferences | Users must be able to turn off email notifications at the account level. Required by anti-spam regulations (CAN-SPAM, GDPR). | LOW-MEDIUM | Account settings page with notification toggles. One-click unsubscribe link in every email. |

**Email content design (zero-knowledge compliant):**

Subject line: `Your secret was viewed — SecureShare`

Body should include:
- Confirmation that the specific secret (referenced by label if set, or by creation time) was viewed
- Exact timestamp of the view event (UTC)
- Statement that the secret has been permanently deleted
- Explicit statement that the email does NOT contain the secret content (zero-knowledge reassurance)
- Link to the dashboard to see full history
- One-click unsubscribe link

What NOT to include:
- Secret content (never stored server-side)
- Recipient IP address or location (privacy violation)
- Link to "view the secret again" (it no longer exists)
- Any personal information about the recipient

Example body structure:
```
Your secret "[label or 'created Jan 15 at 14:30']" was viewed.

Viewed at: 2026-01-18 09:14 UTC

The secret has been permanently deleted from our servers.
(The content is end-to-end encrypted — we never had access to it.)

View your secret history →

Unsubscribe from viewed notifications
```

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Notify if not viewed by expiry" alert | Sender discovers recipient never opened the link. Useful for chasing up. Different from viewed notification — triggers on the expiration worker cron job instead. | MEDIUM | Separate opt-in toggle: "Notify me if this secret expires unviewed." Requires expiration worker to check notification preference on cleanup. |
| Notification channel: email + webhook (Pro) | Power users (developers, DevOps teams) want webhook delivery for secrets viewed notifications, not just email. Enables integration into Slack, PagerDuty, CI/CD pipelines. | MEDIUM | Webhook URL per account (Pro). POST JSON payload to configured URL on view event. Same payload structure as password.link. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Notification email containing the secret label by default | If the label is "SSH key for AWS prod", that's sensitive information in a potentially insecure email inbox. | Make label inclusion in email opt-in at account settings level. Default: "A secret you created" (no label). |
| Real-time "read receipt" branding ("Your recipient opened your secret at X:XX from IP 192.168.x.x") | Mimics surveillance product aesthetics. Creates discomfort for recipients if they learn their IP was logged and emailed. | Log only the timestamp. Do not collect or display IP. |
| Email at account signup level only (all-or-nothing) | Some secrets are sensitive (notify me), some are casual (don't care). All-or-nothing wastes time for both types. | Per-secret opt-in toggle at creation time. |

---

### Feature Area 5: Pro Subscription Tier

**What it is:** A paid tier (~$7/month based on spec) unlocking features that go beyond the free account. In the one-time secret sharing market, the direct comparator is OneTimeSecret (free + $35/month Identity Plus) and password.link (team/Pro tier). The $7/month price point targets individual developers and small teams.

**Market positioning at $7/month:** This price signals "professional tool, not enterprise platform." At this price, users expect: increased limits, access to all features (file uploads, longer expiration, webhooks), and reliable service — not custom domains or white-labeling (that's $35/month territory).

#### Table Stakes (for a $7/month secret-sharing Pro tier)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Extended expiration: up to 90 days | Free: 1h/24h/7d/30d. Pro users share secrets in long-running projects and need 90-day window. 90 days is the standard industry extension (beyond 30 days). | LOW | Add 90-day option to expiration select, gated behind Pro check. |
| File uploads up to 25MB | Sharing configuration files, certificates, key files alongside text secrets is a common need. File support is the single feature most cited in competitor comparisons as a differentiator for Pro tiers. | HIGH | File uploads require: client-side AES-256-GCM encryption of binary files, base64 or ArrayBuffer storage, MIME type validation, size limits, and storage considerations (DB vs object storage). This is the highest-complexity item in v4.0. |
| Higher rate limits | Free: 3/hour, 10/day. Pro should remove or significantly raise these. Rate limiting anonymous users is good; penalizing paying customers is churn. | LOW | Pro: 60 creations/hour, no daily cap. Or: unlimited. Check Redis key by user ID, not IP, for authenticated users. |
| Unlimited secret history retention | Free: 30-day history. Pro: unlimited or 1-year. History is the primary ongoing value for Pro users managing DevOps secrets. | LOW | Database retention policy tied to plan in users table. Cleanup cron skips Pro user metadata rows. |
| Webhook notifications on secret view | Developers integrating SecureShare into CI/CD pipelines or Slack workflows need webhook delivery, not just email. password.link offers this. It is the second-most cited Pro feature after file uploads. | MEDIUM | Webhook URL stored per-account. POST on view event. Include: timestamp, label (if set), secret ID hash (not content). Retry logic for failures (3 attempts, exponential backoff). |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 6-word Diceware passphrase option | Longer passphrases for high-security use cases. Small feature, low cost, meaningful for security-conscious Pro users. | LOW | 6-word = ~77 bits entropy. Toggle in passphrase generator, gated to Pro. |
| Custom password complexity (Pro enforced strength) | Pro users in regulated industries may need to enforce minimum passphrase entropy. | LOW-MEDIUM | Account-level setting: "Require strong passphrase (6+ words) on all secrets I create." |
| API access for programmatic secret creation | Developers want to create secrets from CI/CD pipelines, scripts, deploy hooks. SecureShare already has REST endpoints — the question is authentication and rate limits. | MEDIUM | API key management in account settings. API keys authenticate as the user. Rate limits apply to API key, not IP. |
| Priority support | At $7/month, users expect a way to report issues and get timely response. | LOW | Email support SLA, labeled in pricing. Not a live chat. |

#### Anti-Features (what $7/month does NOT warrant)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Custom domain / white-labeling | This is OneTimeSecret's $35/month Identity Plus differentiator. Custom domains require DNS configuration, TLS cert management per domain, and branded email sending — far too much ops burden for $7/month. | Custom domains are a future tier ($25-35/month) or enterprise offering. |
| Team member accounts / SSO | Multi-user management, seat billing, and SSO integration (SAML, OIDC) are enterprise features. Way beyond a $7/month personal Pro tier. | If team demand emerges post-launch, introduce a separate "Teams" plan. |
| Unlimited file uploads / no size cap | Unbounded storage is a cost center. 25MB per file with reasonable usage limits keeps this manageable. | 25MB per file, 500MB monthly storage quota for Pro. Beyond: overage or higher tier. |
| Annual billing complexity at launch | Adds payment infrastructure complexity. Not worth it until monthly retention is proven. | Monthly billing only at v4.0 launch. Annual option post-launch. |

---

### Feature Area 6: Progressive Conversion Prompts

**What it is:** The system of in-product messages that move users from anonymous use → free account → Pro subscription. Research shows behavior-triggered prompts outperform time-based email sequences: 47% higher open rate, 115% higher clickthrough vs time-based email, 265% higher clickthrough vs newsletters. Key principle from Spotify/Dropbox/Grammarly analysis: prompts work when users feel they're choosing to pay, not being forced.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Anonymous → account prompt after secret creation | The moment immediately after creating a secret is peak motivation. User just experienced value. Inline (non-modal) prompt: "Want to know when it's viewed? Create a free account." | LOW | Shown below share link on confirmation page. Dismissible. One-time per session (not every creation). |
| Feature discovery callout on restricted actions | When anonymous user tries to access a feature that requires an account (dashboard, notifications), redirect to registration with context: "Create a free account to track your secrets." Not a generic 401 page. | LOW-MEDIUM | Context-aware auth redirect. Each restricted feature has a specific benefit message, not a generic "please log in." |
| Rate limit upsell messaging | When anonymous user hits the new 3/hour or 10/day limit, the error message must include upsell: "Anonymous limit reached. Create a free account for higher limits." | LOW | Update rate limit error response JSON and frontend display to include account upgrade CTA. |
| Free → Pro conversion at feature gate | When free user tries to use a Pro feature (file upload, 90-day expiry, 6-word passphrase, webhook), show an inline gate with brief benefit explanation and "Upgrade to Pro" link. | LOW-MEDIUM | Feature gate component: lock icon + short copy + upgrade CTA. Not a full-screen modal. Consistent pattern across all Pro features. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Persistent low-friction banner for free users approaching limits | Dropbox pattern: persistent non-blocking banner once a user has created 8+ secrets in a day on free tier. "You're nearing your daily limit. Upgrade for unlimited." Dismissible, reappears on next session. | LOW | Dashboard header banner. Not on every page — only dashboard and creation page. |
| Contextual "save this secret's history" prompt | If a free user creates a secret without being logged in and then visits the dashboard route, show: "Create a free account to see all your secrets in one place." Converts the user at the moment they're already looking for dashboard functionality. | LOW | 404-style page for /dashboard when anonymous, but with registration CTA rather than plain error. |
| PostHog funnel tracking to measure prompt effectiveness | Without analytics on which prompts convert, iteration is guesswork. Track: prompt shown → dismissed vs. clicked → registration completion rate → first paid conversion. | MEDIUM | PostHog event schema: `prompt_shown`, `prompt_dismissed`, `prompt_clicked`, `account_created`, `subscription_started`. Anonymous ID merges to identified user on registration (PostHog's standard `identify()` + `alias()` flow). |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-screen modal blocking secret creation | Interrupts the core flow. The product's value prop is frictionless anonymous use. A blocking modal converts but destroys brand trust and causes abandonment. | Inline prompts only. Modal reserved for hard feature gates (file upload attempted on free). |
| Repeated upsell on every page view | Aggressive prompting causes users to install ad blockers or abandon entirely. Appcues research confirms coercive prompts backfire. | Show the same prompt max once per session per type. |
| Showing Pro pricing prominently before user sees value | Pricing before value is a conversion killer. Users need to experience the product before they care about price. | Prompt shows benefit first ("Track when your secrets are viewed"), price only on the upgrade page itself. |
| Email drip campaign to anonymous users | We don't have anonymous users' emails. Even if we collected them, emailing users who expected anonymity damages trust. | In-product prompts only for conversion. Email is only for users who explicitly registered. |

---

### Feature Area 7: Rate Limiting Changes (Anonymous Tightening)

**What it is:** Reducing the anonymous creation rate limit from current 10/hour to 3/hour, 10/day — with account creation as the upsell path.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-IP daily rate limit (10/day) | Existing hourly limit catches burst abuse but not sustained low-rate abuse. Daily cap prevents determined anonymous users from relying on the app as a free unlimited service. | LOW | Redis key with 24h TTL per IP. Incremented on each creation. |
| Rate limit error with upsell copy | Plain 429 error with no guidance causes abandonment. Rate limit error should educate: what the limit is, why it exists, how to get more (create account). | LOW | Update `rate-limit.ts` error response and frontend error display component. |
| Free account exemption from IP-based anonymous limits | Authenticated users are rate-limited by user ID, not IP. Free account = 60/hour, unlimited daily. This incentivizes registration without blocking legitimate use. | LOW | Middleware checks auth state first. Authenticated → user-ID rate limit key. Anonymous → IP rate limit key. |

---

### Feature Area 8: PostHog Analytics Integration

**What it is:** Privacy-respecting product analytics to understand usage patterns, conversion funnels, and feature adoption.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Anonymous event tracking (no PII for anonymous users) | PostHog can track product events without identifying users. Anonymous session = anonymous distinct ID. No email, no IP in event properties. | LOW-MEDIUM | PostHog JS SDK initialized with `person_profiles: 'identified_only'` to avoid storing anonymous user profiles. Track: `secret_created`, `secret_viewed`, `page_viewed`. |
| User identification on account creation | On registration, call `posthog.identify(userId, { plan: 'free' })`. On upgrade, `posthog.capture('$set', { plan: 'pro' })`. This merges pre-registration behavior with the identified user. | LOW | Standard PostHog pattern. `identify()` automatically aliases the previous anonymous ID. |
| Conversion funnel events | Track the five-step funnel: `create_page_visited` → `secret_created` → `conversion_prompt_shown` → `account_created` → `subscription_started`. | LOW | Five `posthog.capture()` calls at the relevant moments. No additional infrastructure needed. |
| CSP nonce compatibility | PostHog JS must work with the existing per-request CSP nonce (inline script policy). | MEDIUM | PostHog script must be loaded via the nonce mechanism, not injected as an inline script. Use PostHog's `<script>` tag loading with nonce attribute applied by the server's CSP nonce injection. |

#### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Tracking secret content or recipient behavior | Privacy violation, zero-knowledge violation. | Track only sender-side creation events and account-level actions. Never instrument the reveal page in a way that sends data to third parties. |
| PostHog session recording on the create form | Session recording would capture keystrokes in the secret textarea. Catastrophic privacy failure. | Disable session recording entirely (PostHog default is off for `<textarea>` but explicitly disable globally). |
| Google Analytics / GA4 | Sends data to Google, conflicts with the no-tracking privacy promise, and requires cookie consent banners (GDPR). | PostHog self-hosted or PostHog Cloud EU region. Avoids third-party data sharing. |

---

## Feature Dependencies

```
[User Accounts]
    |-- required by --> [Secret Dashboard]
    |-- required by --> [Email Notifications]
    |-- required by --> [Pro Tier Subscription]
    |-- required by --> [Progressive Conversion (account prompts)]
    |-- required by --> [API Access (Pro)]
    |-- required by --> [Webhook Notifications (Pro)]

[Secret Dashboard]
    |-- requires --> [User Accounts]
    |-- requires --> [Metadata schema: label, status, viewed_at]
    |-- enhances --> [Email Notifications] (viewed status visible in both)
    |-- required by --> [Progressive Conversion (save-to-dashboard prompt)]

[Email Notifications]
    |-- requires --> [User Accounts] (email address to send to)
    |-- requires --> [Transactional email provider] (e.g., Resend, Postmark)
    |-- optional --> [Secret Dashboard] (link in email to dashboard)

[Pro Tier]
    |-- requires --> [User Accounts] (plan stored on user record)
    |-- requires --> [Payment processor] (Stripe)
    |-- unlocks --> [File Uploads] (complex: requires separate implementation)
    |-- unlocks --> [Extended Expiration 90d] (low: add expiry option)
    |-- unlocks --> [Webhook Notifications] (medium: requires webhook infra)
    |-- unlocks --> [6-word Diceware] (low: add word count option)
    |-- unlocks --> [API Keys] (medium: key management UI + auth middleware)
    |-- unlocks --> [Unlimited History Retention] (low: skip cleanup for Pro)

[EFF Diceware Generator]
    |-- requires --> [existing password field] (already built)
    |-- enhances --> [password protection] (already built)
    |-- no account dependency --> [4-word version is free/anonymous]
    |-- gated by Pro --> [6-word version only]

[Progressive Conversion Prompts]
    |-- requires --> [User Accounts] (to offer as upsell destination)
    |-- requires --> [Rate Limiting Changes] (rate limit upsell needs new limits)
    |-- enhances --> [PostHog Analytics] (track prompt effectiveness)

[PostHog Analytics]
    |-- requires --> [CSP nonce system] (existing — must allow PostHog domain)
    |-- enhances --> [Progressive Conversion] (measure which prompts convert)
    |-- no dependency on other v4.0 features (can ship independently)

[File Uploads (Pro)]
    |-- requires --> [Pro Tier]
    |-- requires --> [Client-side binary encryption] (new crypto module work)
    |-- requires --> [Storage solution decision] (DB vs S3 vs object storage)
    |-- conflicts with --> [Zero-knowledge model requires client-side encryption of files, not just text]
```

### Dependency Notes

- **Accounts are the v4.0 backbone:** Dashboard, notifications, Pro, and conversion all require accounts. Build accounts first.
- **File uploads are the highest-complexity item:** Client-side binary encryption, storage architecture, and size limits all interact. This should be a standalone phase even within Pro tier work.
- **Diceware is independent:** No account dependency for the core 4-word free version. Can ship in Phase 1 before accounts are built.
- **PostHog is independent:** Can be instrumented at any time. Best done early to capture conversion funnel data from day one of accounts.
- **Rate limiting changes have a UX dependency:** Tightening anonymous limits without the account upsell messaging ready creates a bad experience. Ship both together.

---

## MVP Definition

### Ship in v4.0 (enables the hybrid model)

- [ ] **User accounts (email + OAuth)** — backbone of all other v4.0 features
- [ ] **Secret dashboard with status metadata** — primary reason users create accounts
- [ ] **Email "secret viewed" notification** — single highest-value conversion driver (users create accounts explicitly for this)
- [ ] **EFF Diceware passphrase generator (4-word, free tier)** — independent, low-complexity, high UX value
- [ ] **Anonymous rate limit tightening with upsell messaging** — drives account creation
- [ ] **Progressive conversion prompts** — inline, non-blocking, post-creation and at rate limit
- [ ] **PostHog analytics (anonymous + identified)** — needed from day one to measure conversion
- [ ] **Pro tier with extended expiration (90 days)** — lowest-complexity Pro feature, validates payment infrastructure

### Add After Accounts Are Stable (v4.1)

- [ ] **Pro: Webhook notifications** — add after email notifications are proven
- [ ] **Pro: API key access** — add after Pro billing is validated
- [ ] **Pro: 6-word Diceware (Pro)** — trivial feature extension, not launch-critical
- [ ] **"Notify if expires unviewed" email** — useful but secondary to viewed notification

### Defer (v4.2+)

- [ ] **Pro: File uploads (25MB)** — highest complexity in v4.0 scope; requires storage architecture decision, client-side binary encryption, and extensive security review. Do not ship alongside accounts launch. Needs its own milestone.
- [ ] **Bulk secret delete** — nice-to-have, not blocking
- [ ] **Annual billing option** — add after monthly retention is proven
- [ ] **Custom domains** — enterprise feature, different price tier

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| User accounts (email + OAuth) | HIGH | MEDIUM | P1 |
| Secret dashboard with status | HIGH | MEDIUM | P1 |
| Email viewed notification | HIGH | MEDIUM | P1 |
| EFF Diceware generator (4-word) | MEDIUM | LOW | P1 |
| Anonymous rate limit + upsell | MEDIUM | LOW | P1 |
| Progressive conversion prompts | HIGH | LOW-MEDIUM | P1 |
| PostHog analytics | MEDIUM | LOW-MEDIUM | P1 |
| Pro tier: extended expiration (90d) | MEDIUM | LOW | P1 |
| Pro tier: webhooks | MEDIUM | MEDIUM | P2 |
| Pro tier: API keys | MEDIUM | MEDIUM | P2 |
| Notify if expires unviewed | LOW-MEDIUM | MEDIUM | P2 |
| Pro tier: 6-word Diceware | LOW | LOW | P2 |
| Pro tier: file uploads | HIGH | HIGH | P2 |
| Annual billing | LOW | MEDIUM | P3 |
| Bulk secret delete | LOW | LOW | P3 |
| Custom domains | LOW | HIGH | P3 |

---

## Competitor Feature Analysis

| Feature | OneTimeSecret | password.link | scrt.link | SecureShare v4.0 Approach |
|---------|--------------|---------------|-----------|--------------------------|
| Anonymous use | Yes (default) | Yes | Yes | Yes (preserved, tightened limits) |
| User accounts | Yes (email) | Yes | Yes | Email + Google + GitHub OAuth |
| Secret dashboard | Yes (basic) | Yes (team) | Not confirmed | Yes, metadata-only, zero-knowledge compliant |
| Email notification on view | Confirmed | Yes (+ Slack + webhook) | Not confirmed | Yes (per-secret opt-in toggle) |
| Diceware passphrase | No | No | No | Yes (EFF long wordlist, differentiator) |
| File uploads | No (text only) | Yes (registered) | No | Pro tier, v4.2 (deferred) |
| Webhooks | No | Yes (Pro) | No | Pro tier v4.1 |
| Custom domain | $35/month | Enterprise | No | Future tier (not v4.0) |
| Pricing (Pro) | $35/month (Identity Plus) | Not public | Free only | ~$7/month |
| Rate limiting messaging | Basic 429 | Unknown | Unknown | Upsell copy in rate limit error |

---

## Zero-Knowledge Implications Per Feature

This section flags how the zero-knowledge constraint affects each feature area — critical for implementation and copy writing.

| Feature | ZK Implication | Implementation Constraint |
|---------|---------------|--------------------------|
| Secret dashboard | Cannot show content, cannot reconstruct link with key | Store only: label, created_at, expires_at, viewed_at, status. Never store the #key fragment. |
| "Copy link again" from dashboard | The full share URL with #key is not stored server-side | Store the base URL only. Display clear message: "Key cannot be recovered. Store your share link now." |
| Email notification | Email cannot confirm what the secret contained | Email says "a secret was viewed" never "your [thing] was viewed" (content unknown to server) |
| File uploads (Pro, v4.2) | Files must be encrypted in-browser before upload | New binary encryption module needed. Same AES-256-GCM, but for ArrayBuffer. No server-side processing of file content. |
| PostHog on reveal page | Reveal page must not send analytics events that include secret metadata | Capture only `secret_revealed` event with no properties. No label, no content, no timing that could leak sensitivity. |
| Webhook payload | Webhook cannot include secret content | Webhook payload: { event: "secret_viewed", timestamp, secret_id_hash, label_if_set }. Never ciphertext, never plaintext. |

---

## Sources

### EFF Diceware
- [EFF's New Wordlists for Random Passphrases](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases) — HIGH confidence (official EFF documentation)
- [Diceware.dmuth.org — UX pattern reference](https://diceware.dmuth.org/) — HIGH confidence (live reference implementation, observed directly)
- [EFF Dice-Generated Passphrases](https://www.eff.org/dice) — HIGH confidence (official)

### Secret Dashboard / Competitor Analysis
- [OneTimeSecret Pricing](https://onetimesecret.com/en/pricing/) — HIGH confidence (live product, observed directly; $0 + $35/month Identity Plus)
- [password.link Features](https://password.link/en) — HIGH confidence (live product, observed directly; notifications, webhooks, attachments, teams)
- [OneTimeSecret Security Best Practices Docs](https://docs.onetimesecret.com/en/security-best-practices/) — HIGH confidence (official docs)
- [The Ultimate Guide to Secure One-Time Secret Sharing 2025](https://techopsasia.com/blog/best-one-time-secret-sharing-tools-2025) — MEDIUM confidence (third-party analysis)
- [scrt.link vs OneTimeSecret Comparison](https://blog.stophe.com/scrtlink-vs-one-time-secret) — MEDIUM confidence (blog post, author is scrt.link creator)

### Progressive Conversion
- [Best Freemium Upgrade Prompts (Appcues)](https://www.appcues.com/blog/best-freemium-upgrade-prompts) — HIGH confidence (multiple real-world examples from Spotify, Dropbox, Grammarly, Slack)
- [PostHog Anonymous User Tracking](https://github.com/PostHog/posthog.com/blob/master/contents/tutorials/identifying-users-guide.md) — HIGH confidence (official PostHog docs)
- [Progressive Profiling 101 (Descope)](https://www.descope.com/learn/post/progressive-profiling) — MEDIUM confidence
- [SaaS Signup Flow UX (Userpilot)](https://userpilot.com/blog/saas-signup-flow/) — MEDIUM confidence

### SaaS Pricing / Pro Tier
- [SaaS Freemium Conversion Rates 2026 (First Page Sage)](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/) — MEDIUM confidence
- [Upgrade Trigger — Product-Led Growth (SEOJuice)](https://seojuice.com/glossary/growth/product-led-growth/upgrade-trigger/) — MEDIUM confidence
- [Freemium Conversion Rate Guide (Userpilot)](https://userpilot.com/blog/freemium-conversion-rate/) — MEDIUM confidence

### Email Notifications
- [password.link Notifications](https://password.link/en) — HIGH confidence (observed: email + Slack + webhook triggers confirmed)
- [Security Notifications Deliverability (MailChannels)](https://blog.mailchannels.com/security-notifications-alerts-account-activity-emails-why-deliverability-matters/) — MEDIUM confidence
- [What is Transactional Email? (MagicBell)](https://www.magicbell.com/blog/what-is-a-transactional-email-and-why-is-it-important) — MEDIUM confidence

---

*Feature landscape research for: SecureShare v4.0 Hybrid Anonymous + Account Model*
*Researched: 2026-02-18*
