# Requirements: SecureShare

**Defined:** 2026-02-18
**Core Value:** Users can share sensitive information once, securely, without accounts or complexity — the secret is encrypted in the browser, viewable only once, then permanently destroyed.

## v4.0 Requirements

Requirements for the Hybrid Anonymous + Account Model milestone. Each maps to roadmap phases (starting from phase 21).

### PASS — Passphrase Generation

- [x] **PASS-01**: User can generate a 4-word EFF Diceware passphrase when creating a secret (generated client-side via crypto.getRandomValues, enabled by default)
- [x] **PASS-02**: User can regenerate the passphrase with a single click before submitting the form
- [x] **PASS-03**: User can copy the passphrase independently from the share link on the confirmation page
- [x] **PASS-04**: Confirmation page displays two-channel security guidance (share link via one channel, passphrase via another)

### AUTH — Authentication

- [x] **AUTH-01**: User can register with email and password
- [x] **AUTH-02**: User receives email verification and must verify before accessing account features
- [x] **AUTH-03**: User can log in with email and password
- [x] **AUTH-04**: User can reset password via email link
- [x] **AUTH-05**: User session persists across browser refreshes (Redis-backed server sessions)
- [x] **AUTH-06**: User can sign in with Google via OAuth
- [x] **AUTH-07**: User can sign in with GitHub via OAuth
- [x] **AUTH-08**: User can log out and session is destroyed

### DASH — Dashboard

- [x] **DASH-01**: Authenticated user can view a list of their created secrets (metadata only: label, created_at, expires_at, status, notification setting — never secret content)
- [x] **DASH-02**: Secret status correctly reflects four states: Active, Viewed, Expired, Deleted
- [x] **DASH-03**: Authenticated user can add an optional label when creating a secret
- [x] **DASH-04**: Authenticated user can delete an Active (unviewed) secret before it is accessed
- [x] **DASH-05**: Dashboard never displays secret content, ciphertext, or the encryption key

### NOTF — Email Notifications

- [x] **NOTF-01**: Authenticated user can opt in to email notification when a specific secret is viewed (per-secret toggle at creation, off by default)
- [x] **NOTF-02**: User receives a transactional email (via Resend) when an opted-in secret is viewed and destroyed
- [x] **NOTF-03**: Notification email confirms permanent deletion without including secret content, recipient IP, or encryption key

### ANLT — Analytics

- [x] **ANLT-01**: Application tracks funnel events via PostHog without collecting PII, secret content, or encryption keys
- [x] **ANLT-02**: URL fragment (#encryption-key) is stripped from all captured event properties before PostHog transmission (sanitize_properties configuration is mandatory)
- [x] **ANLT-03**: Authenticated users are identified in PostHog by user ID (not email or other PII) after login

### CONV — Conversion & Rate Limits

- [x] **CONV-01**: Anonymous users are rate-limited to 3 secrets/hour and 10 secrets/day (tightened from current 10/hour)
- [x] **CONV-02**: Anonymous users can set expiration up to 1 hour maximum (restricted from current 1h/24h/7d/30d options)
- [x] **CONV-03**: Authenticated users have higher limits: 20 secrets/day and expiration up to 7 days
- [ ] **CONV-04**: Anonymous users see an inline, non-blocking prompt after their first secret creation
- [ ] **CONV-05**: Anonymous users see a benefit-focused upsell prompt after their third secret creation
- [x] **CONV-06**: Anonymous users who hit the rate limit see an inline prompt to create a free account

### LEGAL — Legal Pages

- [ ] **LEGAL-01**: Privacy Policy page is accessible at /privacy describing what data is and is not collected
- [ ] **LEGAL-02**: Terms of Service page is accessible at /terms covering acceptable use

## v5.0 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Pro Tier

- **PRO-01**: Stripe subscription billing at $7/month
- **PRO-02**: Pro users get extended expiration up to 90 days
- **PRO-03**: Pro users receive webhook notifications on secret view (POST to user-configured URL)
- **PRO-04**: 6-word Diceware passphrases (higher entropy: ~77 bits) for Pro users

### File Uploads

- **FILE-01**: Pro user can upload files up to 25MB, encrypted client-side before upload
- **FILE-02**: File uploads stored via Cloudflare R2 with presigned PUT URL flow (Render ephemeral filesystem is unsuitable)

### Advanced Features

- **ADV-01**: "Notify if expires unviewed" email option for account users
- **ADV-02**: API key access for programmatic secret creation (Pro tier)
- **ADV-03**: Bulk secret deletion from dashboard

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Stripe payments / Pro tier | Deferred to v5.0; focus v4.0 on building account foundation first |
| File uploads (25MB) | HIGH complexity — requires Cloudflare R2, client-side binary encryption module, security review; v5.0 |
| Webhook notifications on secret view | Pro tier feature; deferred with Pro tier |
| Custom domains | Enterprise tier, different price point; not planned |
| Browser extensions | Web-first; deferred |
| Team/organization features | Individual sharing only; Enterprise is future |
| Mobile native apps | Responsive web covers mobile use cases |
| Real-time push notifications | Email-on-view sufficient; websocket notifications not warranted |
| Session recording (PostHog) | Privacy violation — create form contains sensitive plaintext before encryption |
| Google Analytics | Conflicts with privacy promise; requires cookie consent banners |
| Editing secrets after creation | One-time links are the model; immutable by design |
| Offline mode | Real-time server interaction is core to the destroy model |
| Claiming anonymous secrets on account creation | Privacy risk — linking browser session to user identity; deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PASS-01 | Phase 24 | Complete |
| PASS-02 | Phase 24 | Complete |
| PASS-03 | Phase 24 | Complete |
| PASS-04 | Phase 24 | Complete |
| AUTH-01 | Phase 22 | Complete |
| AUTH-02 | Phase 22 | Complete |
| AUTH-03 | Phase 22 | Complete |
| AUTH-04 | Phase 22 | Complete |
| AUTH-05 | Phase 22 | Complete |
| AUTH-06 | Phase 22 | Complete |
| AUTH-07 | Phase 22 | Complete |
| AUTH-08 | Phase 22 | Complete |
| DASH-01 | Phase 23 | Complete |
| DASH-02 | Phase 23 | Complete |
| DASH-03 | Phase 23 | Complete |
| DASH-04 | Phase 23 | Complete |
| DASH-05 | Phase 23 | Complete |
| NOTF-01 | Phase 26 | Complete |
| NOTF-02 | Phase 26 | Complete |
| NOTF-03 | Phase 26 | Complete |
| ANLT-01 | Phase 25 | Complete |
| ANLT-02 | Phase 25 | Complete |
| ANLT-03 | Phase 25 | Complete |
| CONV-01 | Phase 27 | Complete |
| CONV-02 | Phase 27 | Complete |
| CONV-03 | Phase 27 | Complete |
| CONV-04 | Phase 27 | Pending |
| CONV-05 | Phase 27 | Pending |
| CONV-06 | Phase 27 | Complete |
| LEGAL-01 | Phase 27 | Pending |
| LEGAL-02 | Phase 27 | Pending |

**Coverage:**
- v4.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
