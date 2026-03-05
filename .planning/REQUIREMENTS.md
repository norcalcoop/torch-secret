# Requirements: Torch Secret

**Defined:** 2026-03-03
**Core Value:** Zero-knowledge, one-time secret sharing — users share sensitive text via encrypted self-destructing links, with no accounts required and no server-side plaintext access.

## v5.1 Requirements

Requirements for milestone v5.1 Email Infrastructure.

### Cloudflare Email Routing (EROT)

- [x] **EROT-01**: Admin can route all 7 business addresses (hello, contact, admin, info, support, security, privacy) at torchsecret.com to torch.secrets@gmail.com via Cloudflare Email Routing
- [x] **EROT-02**: Admin can verify forwarding works for each address by sending a test email

### Resend Domain Authorization (RSND)

- [x] **RSND-01**: Admin can verify torchsecret.com in Resend with DKIM, SPF, and DMARC DNS records
- [x] **RSND-02**: Admin can update RESEND_FROM_EMAIL to noreply@torchsecret.com in Infisical (staging + production)
- [x] **RSND-03**: User receives transactional emails (secret-viewed notifications, subscriber confirmations) from noreply@torchsecret.com

### Loops.so Domain Authorization (LOOP)

- [x] **LOOP-01**: Admin can verify torchsecret.com in Loops.so with DKIM and SPF DNS records
- [x] **LOOP-02**: Admin can confirm hello@torchsecret.com is the verified sender address in Loops.so
- [x] **LOOP-03**: User receives onboarding emails from hello@torchsecret.com without "via loops.so" header indicators

### Gmail Send Mail As (GMAI)

- [ ] **GMAI-01**: Admin can create a Resend API key dedicated to Gmail SMTP relay
- [ ] **GMAI-02**: Admin can add all 7 business addresses to Gmail "Send mail as" using smtp.resend.com:465 with the Resend API key
- [ ] **GMAI-03**: Admin can verify all 7 Send mail as addresses in Gmail via Cloudflare-forwarded verification emails
- [ ] **GMAI-04**: Admin can set hello@torchsecret.com as the default outbound address in Gmail

### App & Documentation Updates (ADOC)

- [ ] **ADOC-01**: Admin can update SECURITY.md to include security@torchsecret.com as the security disclosure email
- [ ] **ADOC-02**: Admin can update Privacy Policy to reference privacy@torchsecret.com for data subject requests

## Future Requirements

Deferred to post-v5.1. Tracked but not in current roadmap.

### Email Operations

- **EOPS-01**: Admin can monitor DMARC aggregate reports (rua= address configured)
- **EOPS-02**: Admin can progress DMARC policy from `p=none` to `p=quarantine` after 30-day clean monitoring period
- **EOPS-03**: Admin can set up a catch-all address to receive mail sent to any unlisted torchsecret.com address

### Security

- **SEC-01**: Admin can publish `/.well-known/security.txt` referencing security@torchsecret.com per RFC 9116

## Out of Scope

Explicitly excluded from v5.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Custom email client / webmail | Gmail serves as the client via Send mail as — no additional tooling needed |
| Email autoresponders | Out of scope for infrastructure setup milestone |
| Email templates redesign | Loops/Resend template changes are a separate product concern |
| Domain transfer away from Cloudflare | Cloudflare Email Routing requires Cloudflare DNS — not replaceable this milestone |
| DMARC p=reject | Incompatible with Cloudflare Email Routing SRS envelope rewriting — SPF alignment breaks; p=quarantine is the stable posture |
| New npm packages | Zero code changes required — only DNS records, Infisical env vars, and docs |

## Traceability

Which phases cover which requirements. Populated by roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EROT-01 | Phase 46 | Complete |
| EROT-02 | Phase 46 | Complete |
| RSND-01 | Phase 47 | Complete |
| LOOP-01 | Phase 47 | Complete |
| LOOP-02 | Phase 47 | Complete |
| RSND-02 | Phase 48 | Complete |
| RSND-03 | Phase 48 | Complete |
| LOOP-03 | Phase 48 | Complete |
| GMAI-01 | Phase 49 | Pending |
| GMAI-02 | Phase 49 | Pending |
| GMAI-03 | Phase 49 | Pending |
| GMAI-04 | Phase 49 | Pending |
| ADOC-01 | Phase 50 | Pending |
| ADOC-02 | Phase 50 | Pending |

**Coverage:**
- v5.1 requirements: 14 total
- Mapped to phases: 14 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 — traceability populated by roadmapper*
