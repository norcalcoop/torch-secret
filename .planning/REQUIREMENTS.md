# Requirements: Torch Secret

**Defined:** 2026-03-06
**Core Value:** Users can share sensitive information once, securely, without accounts or complexity

## v5.2 Requirements

### Bug Fixes

- [x] **BUG-01**: User clicking "Create a New Secret" on the error page is taken to `/create` (not `/`)
- [x] **BUG-02**: Social media previews show correct domain `torchsecret.com` (not `secureshare.example.com` placeholder in `client/index.html`)

### Code Quality

- [x] **QUAL-01**: Auth and dashboard routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/dashboard`) receive `X-Robots-Tag: noindex` at server level via NOINDEX_PREFIXES, not only client-side
- [x] **QUAL-02**: `console.error()` replaced with `logger.error()` in `notification.service.ts` and `subscribers.service.ts` so email delivery failures appear in structured Pino logs
- [x] **QUAL-03**: E2E rate-limit bypass (`E2E_TEST=true`) only activates when `NODE_ENV === 'test'`, preventing accidental production rate-limit disablement
- [x] **QUAL-04**: Stripe customer creation includes an idempotency key (`torch-secret-${user.id}`) to prevent duplicate customers on network retry

### Test Coverage

- [x] **TEST-01**: `notification.service.test.ts:58` test.todo filled in (logger.error migration test)
- [x] **TEST-02**: Stripe webhook handler rejects tampered and unsigned webhooks — test suite covers signature verification failure modes (Critical security gap)
- [x] **TEST-03**: Password auto-destroy at `attemptsRemaining = 0` is verified under concurrent load; no race condition bypass possible
- [x] **TEST-04**: Systematic integration test confirms no log line, DB record, or analytics event contains both `userId` and `secretId` in the same payload

### Infrastructure

- [x] **INFRA-01**: DMARC policy upgraded from `p=none` to `p=quarantine` in DNS after verifying 30-day clean monitoring period in Cloudflare email reports

### Documentation & Launch Assets

- [x] **DOCS-01**: README includes Tally.so feedback form link (completing the trilogy: confirmation page ✓, reveal page ✓, README ○)
- [x] **DOCS-02**: Open GitHub issues triaged — stale issues closed, remaining issues labeled with appropriate tags
- [x] **LAUNCH-01**: Demo screencast script and shot list written (30–60 second flow: paste → create → share → reveal → gone)
- [x] **LAUNCH-02**: Show HN post drafted and reviewed (title leads with RFC 3986 / URL fragment angle; submitter-comment template included)
- [x] **LAUNCH-03**: Technical writeup drafted ("How we built a zero-knowledge secret sharer where we mathematically cannot read your data")
- [ ] **LAUNCH-04**: Community post drafts for r/netsec, r/selfhosted, and r/devops (3 distinct angles, each ≤ 300 words)
- [ ] **LAUNCH-05**: Product Hunt listing drafted (tagline, description, gallery image checklist, FAQ, first-comment template)
- [ ] **LAUNCH-06**: "We launched on Product Hunt" email drafted for the subscriber list

## Future Requirements

### v6.0+

- Webhook notifications on secret view (Pro feature)
- File uploads — 25MB, Cloudflare R2 (Pro feature)
- 6-word Diceware passphrases (Pro feature)
- Extended expiration beyond 30 days — 90-day option (Pro feature)
- GDPR user data export endpoint (`/api/me/export`)
- Auth event audit trail table
- Dashboard cursor-based pagination
- Email notification retry queue (Bull or similar)
- Expiration worker distributed locking (Redis SET with EX)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Editing/revoking secrets after creation | One-time links are the model |
| Browser extensions | Web-first |
| Public API | Internal use only |
| Team/organization features | Individual sharing only; Enterprise is future |
| Mobile apps | Responsive web covers mobile |
| Offline mode | Real-time server interaction is core to destroy model |
| Session recording (PostHog) | Privacy violation: create form contains sensitive plaintext |
| Real-time push notifications | Email-on-view is sufficient |
| Rate limit MemoryStore replacement | Redis required in production; MemoryStore fallback is documented |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 54 | Complete |
| BUG-02 | Phase 54 | Complete |
| QUAL-01 | Phase 55 | Complete |
| QUAL-02 | Phase 55 | Complete |
| QUAL-03 | Phase 55 | Complete |
| QUAL-04 | Phase 55 | Complete |
| TEST-01 | Phase 56 | Complete |
| TEST-02 | Phase 56 | Complete |
| TEST-03 | Phase 57 | Complete |
| TEST-04 | Phase 57 | Complete |
| INFRA-01 | Phase 58 | Complete |
| DOCS-01 | Phase 59 | Complete |
| DOCS-02 | Phase 59 | Complete |
| LAUNCH-01 | Phase 60 | Complete |
| LAUNCH-02 | Phase 60 | Complete |
| LAUNCH-03 | Phase 60 | Complete |
| LAUNCH-04 | Phase 61 | Pending |
| LAUNCH-05 | Phase 61 | Pending |
| LAUNCH-06 | Phase 61 | Pending |

**Coverage:**
- v5.2 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 — traceability filled after roadmap creation*
