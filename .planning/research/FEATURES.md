# Feature Research

**Domain:** Business email infrastructure for a security-focused SaaS (Torch Secret / torchsecret.com)
**Milestone:** v5.1 Email Infrastructure
**Researched:** 2026-03-03
**Confidence:** HIGH (Cloudflare, Resend, Loops.so official docs; RFC 2142/9116 primary sources)

---

## Scope

This research covers what's needed to go from placeholder sends (`onboarding@resend.dev`) to a
fully verified, production-grade email identity for torchsecret.com. The existing email *sending*
code (Resend transactional + Loops.so onboarding) is already built — this milestone is purely about
domain ownership, address hierarchy, DNS authentication, and operator convenience (Gmail "Send mail
as"). No new sending features are included.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that signal "this is a real, trustworthy product." Missing any of these at launch makes the
product look unfinished or untrustworthy — especially critical for a security-focused tool.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Emails arrive from `@torchsecret.com` not `@resend.dev` | Users trust the product's own domain; `onboarding@resend.dev` is a visible placeholder that erodes credibility | LOW | Resend domain verification: 2 DNS records (SPF + DKIM TXT). Propagation up to 24h. |
| SPF record for torchsecret.com | Required for deliverability; missing SPF causes spam or rejection | LOW | Resend adds this automatically when you verify the domain in their dashboard |
| DKIM signing for outgoing mail | Verifies email integrity; required by Gmail/Yahoo 2024+ bulk sender requirements | LOW | Resend handles DKIM key management; you add one CNAME/TXT record |
| DMARC record (`p=none` to start) | Required by Gmail/Yahoo for bulk senders since Feb 2024; signals responsible sender | LOW | Add `_dmarc.torchsecret.com` TXT record. Start at `p=none` with `rua=` monitoring, then move to `p=quarantine` after 2 weeks of clean reports |
| `hello@torchsecret.com` receives email | General contact inbox — every SaaS needs a monitored human inbox | LOW | Cloudflare Email Routing → gmail forward |
| `support@torchsecret.com` receives email | Users expect to email support when help docs fail | LOW | Cloudflare Email Routing → gmail forward |
| `security@torchsecret.com` receives AND is listed | RFC 2142 §4 defines `security@` for security bulletins/queries; researchers expect it. A ZK/encryption SaaS that lacks `security@` looks amateurish | LOW | Cloudflare Email Routing → gmail forward. MUST be listed in SECURITY.md and ideally security.txt |
| `privacy@torchsecret.com` receives email | GDPR data rights requests (erasure, portability, access). Privacy Policy must list a contact; regulators check | LOW | Cloudflare Email Routing → gmail forward. Required in Privacy Policy |
| `noreply@torchsecret.com` authorized to send | All app transactional email currently uses `onboarding@resend.dev`. Must switch to owned domain for deliverability and trust | LOW | Resend domain verification; update `RESEND_FROM_EMAIL` env var in Infisical |
| `hello@torchsecret.com` authorized to send via Loops.so | Loops onboarding sequence currently uses unverified sender. Domain must be verified in Loops dashboard | LOW | Loops.so domain auth: MX + TXT + CNAME records. Up to 24h propagation |

### Differentiators (Nice-to-Have)

| Feature | Value Proposition | Complexity | Notes | When |
|---------|-------------------|------------|-------|------|
| Gmail "Send mail as" for hello@, support@, security@, privacy@ | Operators can reply from the correct address without paid Google Workspace | MEDIUM | Uses Resend SMTP relay (host: `smtp.resend.com`, port: 465/587, user: `resend`, password: API key). Gmail → Settings → "Add another email address" per address. Cloudflare routing must be verified first (gmail sends a confirmation link to the address) | Before launch |
| `security.txt` at `/.well-known/security.txt` | RFC 9116 machine-readable security contact. CISA recommends all orgs have one. Researchers check before reporting. Directly references `security@torchsecret.com` | LOW | Required fields: `Contact:` and `Expires:`. Optional: `Policy:`, `Preferred-Languages:`. Static file served by Express | Before launch |
| `contact@torchsecret.com` receives email | Press, partnerships, general business contact | LOW | Cloudflare Email Routing → gmail forward | Before launch |
| Cloudflare catch-all rule | Absorbs `info@`, `admin@`, stray addresses without dedicated routes | LOW | One Cloudflare rule pointing to gmail | Before launch |
| Reply-to header on `noreply@` sends | Redirects replies to `support@` rather than bouncing | LOW | Set `reply-to: support@torchsecret.com` in Resend send calls. 3 lines of code change in `email.ts` and `notification.service.ts` | After launch |
| DMARC enforcement (`p=quarantine`) | Prevents spoofed `@torchsecret.com` emails landing in inboxes | LOW | Migrate `p=none` → `p=quarantine` after 2 weeks of clean `rua=` reports. Can't skip the monitoring phase safely | 2 weeks post-launch |
| DMARC enforcement (`p=reject`) | Full spoofing prevention; strongest signal of email security maturity | LOW | Migrate `p=quarantine` → `p=reject` after confirming clean reports at quarantine level | 4+ weeks post-launch |

### Anti-Features (Over-Engineering for This Milestone)

| Feature | Why Requested | Why It's Wrong Here | Better Approach |
|---------|---------------|---------------------|-----------------|
| Google Workspace ($6+/user/month) | "Professional email" — full Gmail UI per address | Single-operator SaaS at launch. Cloudflare Routing + Gmail "Send mail as" provides identical capability for $0 | Use Cloudflare Email Routing (free) + Gmail "Send mail as" via Resend SMTP |
| Dedicated IMAP inbox per address | Full threading per address | Overkill for 7 role addresses with 1-2 operators. Threading works fine when all addresses land in one Gmail inbox | Single Gmail inbox receives all; reply via "Send mail as" |
| Custom MX / self-hosted mail | Full control of mail infrastructure | Catastrophic maintenance burden. Deliverability is a full-time job. Blacklist risk is high | Cloudflare Email Routing (receive) + Resend (send) |
| `postmaster@` mailbox | RFC 5321 requires postmaster@ on SMTP server domains | Torch Secret does not run an SMTP server — Resend does. RFC 5321's postmaster@ requirement applies to MTA operators, not API customers | No action needed; catch-all absorbs it if configured |
| `abuse@` mailbox | RFC 2142 §3 requires `abuse@` for ISPs/hosting providers | RFC 2142 `abuse@` is required for domains that *provide internet services to others* (ISPs, hosting providers). Torch Secret is an end-user SaaS, not an ISP | No action needed; catch-all absorbs any stray messages |
| `admin@` mailbox | Instinct to have an admin-facing address | No user-facing purpose; no RFC requirement for non-ISPs; confusing to users | Skip entirely |
| `info@` dedicated route | Synonym for general contact | Redundant with `hello@` or `contact@`. Catch-all captures it without a dedicated route | Use catch-all |
| Separate sending subdomains (`mail.`, `app.`) | Some ESPs recommend subdomain isolation for reputation | Only relevant at high send volume (100k+/month). Pre-launch Torch Secret sends hundreds of emails, not millions | Single root domain `torchsecret.com` for all sending |
| Third-party email aliasing (ImprovMX, Forward Email) | Email forwarding services | Redundant — torchsecret.com is already on Cloudflare DNS, which provides Email Routing for free | Use Cloudflare Email Routing |

---

## Address Hierarchy for a Security SaaS

### Required for Launch

| Address | Direction | Purpose | Setup Required |
|---------|-----------|---------|----------------|
| `noreply@torchsecret.com` | Send-only (outbound) | All transactional app email: secret-viewed notifications, subscriber confirm/unsubscribe | Resend domain verification. No inbound inbox needed. |
| `hello@torchsecret.com` | Two-way | Loops.so onboarding sender AND general human contact | Cloudflare Email Routing → gmail. Loops.so domain auth. Gmail "Send mail as" |
| `security@torchsecret.com` | Two-way (inbound primary) | Vulnerability reports, researcher contact. RFC 2142 §4. Listed in SECURITY.md | Cloudflare Email Routing → gmail. Gmail "Send mail as" for replies |
| `privacy@torchsecret.com` | Two-way (inbound primary) | GDPR data subject requests. Listed in Privacy Policy | Cloudflare Email Routing → gmail. Gmail "Send mail as" for replies |

### Recommended Before Launch (Low Effort)

| Address | Direction | Purpose | Setup Required |
|---------|-----------|---------|----------------|
| `support@torchsecret.com` | Two-way | Customer support escalations | Cloudflare Email Routing → gmail. Gmail "Send mail as" |
| `contact@torchsecret.com` | Two-way | Press, partnerships | Cloudflare Email Routing → gmail |
| catch-all | Inbound only | Absorbs `info@`, `admin@`, stray sends | One Cloudflare catch-all rule → gmail |

### Skip — Not Applicable to This Product

| Address | Why Skip |
|---------|----------|
| `postmaster@` | RFC 5321 applies to SMTP server operators. Torch Secret uses Resend as MTA |
| `abuse@` | RFC 2142 applies to ISPs/hosting providers. Not applicable to SaaS end products |
| `admin@` | No user-facing purpose. No RFC requirement for non-ISPs |
| `info@` | Catch-all covers it. Redundant with `hello@` / `contact@` |

---

## Two-Way vs Send-Only Decision Criteria

| Address | Two-Way? | Rationale |
|---------|----------|-----------|
| `noreply@` | No — send-only | Notification emails are not conversational. Bounces on reply are correct behavior. Optional: set `Reply-To: support@torchsecret.com` as a soft redirect |
| `hello@` | Yes | Loops.so sends from it AND humans reply to it. Needs inbound routing |
| `security@` | Yes | Researchers email it. Operators must respond. Two-way is non-negotiable for security product credibility |
| `privacy@` | Yes | GDPR data subject requests require a response. Regulators expect replies |
| `support@` | Yes | Support is inherently conversational |
| `contact@` | Yes | General business inquiries expect responses |

---

## Feature Dependencies

```
Resend domain verification (SPF + DKIM)
    └──required for──> noreply@torchsecret.com as From address in Resend API
    └──required for──> DMARC record (SPF + DKIM must pass before DMARC enforcement makes sense)
    └──required for──> RESEND_FROM_EMAIL env var update in Infisical

Cloudflare Email Routing enabled for torchsecret.com
    └──required for──> all inbound addresses (hello, support, security, privacy, contact)
    └──required for──> Gmail "Send mail as" verification email delivery
    └──enables──> catch-all rule (captures info@, admin@, abuse@ without dedicated routes)

Gmail destination address verified in Cloudflare Email Routing
    └──required for──> Gmail "Send mail as" (confirmation email must arrive at the custom address)

Loops.so domain authentication (MX + TXT + CNAME)
    └──required for──> hello@torchsecret.com as Loops.so sending address

DMARC record (p=none with rua=)
    └──enables──> DMARC aggregate reporting (reveals all send streams)
    └──gates──> safe upgrade to p=quarantine (only after 2 weeks of clean rua= reports)
    └──gates──> safe upgrade to p=reject (only after p=quarantine confirmed clean)
```

### Dependency Notes

- **Gmail "Send mail as" requires Cloudflare routing first.** Gmail sends a confirmation email to the custom address during setup. If Cloudflare routing is not verified, this confirmation is undeliverable and the setup flow fails silently.
- **DMARC enforcement (p=quarantine/reject) requires monitoring phase.** Jumping to `p=reject` without first running `p=none` with `rua=` reporting risks rejecting legitimate mail from Loops.so or any other sender if a record is misconfigured.
- **Loops.so and Resend domain auth are independent.** They share the same root domain (`torchsecret.com`) but require separate DNS record sets in separate dashboards. Neither substitutes for the other.
- **`noreply@` does not need Cloudflare Email Routing.** It is send-only. Resend's domain verification covers outbound. No inbound rule is needed. A catch-all rule (if configured) naturally absorbs any bounced replies.

---

## MVP Definition

### Launch With (v5.1 — Must Have)

- [ ] Resend domain verification for `torchsecret.com` (SPF + DKIM DNS records) — enables `noreply@torchsecret.com` as From address
- [ ] `RESEND_FROM_EMAIL` updated to `noreply@torchsecret.com` in Infisical (dev + staging + prod) — removes `onboarding@resend.dev` placeholder from all outgoing mail
- [ ] Loops.so domain authentication for `torchsecret.com` — enables `hello@torchsecret.com` as Loops onboarding sender
- [ ] Cloudflare Email Routing enabled for `torchsecret.com` with verified destination (torch.secrets@gmail.com)
- [ ] Routing rules for: `hello@`, `security@`, `privacy@`, `support@` → gmail destination
- [ ] DMARC record at `_dmarc.torchsecret.com` with `p=none; rua=mailto:<gmail address>` for monitoring
- [ ] `SECURITY.md` updated to list `security@torchsecret.com` as vulnerability report contact
- [ ] Privacy Policy updated to list `privacy@torchsecret.com` for data subject requests

### Include in v5.1 (Low Effort, High Value)

- [ ] Gmail "Send mail as" for `hello@`, `security@`, `privacy@`, `support@` via Resend SMTP — operators reply from the correct address
- [ ] `contact@torchsecret.com` Cloudflare routing rule — press and partnerships inbox
- [ ] Cloudflare catch-all rule → gmail — absorbs `info@`, `admin@`, stray sends
- [ ] `/.well-known/security.txt` static file with `Contact: mailto:security@torchsecret.com` and `Expires:` field — RFC 9116, CISA-recommended

### Defer Post-Launch

- [ ] DMARC upgrade from `p=none` to `p=quarantine` — only after reviewing 2 weeks of `rua=` aggregate reports confirming no legitimate send streams are misconfigured
- [ ] DMARC upgrade from `p=quarantine` to `p=reject` — strictest enforcement; defer until launch email volume is stable and reports are clean
- [ ] `Reply-To: support@torchsecret.com` on `noreply@` sends — softens bounce UX for recipients who reply to notifications

---

## Feature Prioritization Matrix

| Feature | User/Operator Value | Implementation Cost | Priority |
|---------|---------------------|---------------------|----------|
| `noreply@torchsecret.com` auth via Resend | HIGH — credibility, deliverability | LOW — 2 DNS records + env var | P1 |
| `hello@torchsecret.com` via Loops.so auth | HIGH — onboarding emails reach inbox | LOW — DNS records in Loops dashboard | P1 |
| Cloudflare Email Routing (hello, security, privacy, support) | HIGH — operators receive user email | LOW — dashboard clicks, DNS auto-configured | P1 |
| DMARC `p=none` monitoring record | HIGH — required monitoring foundation; Gmail/Yahoo mandate | LOW — one TXT record | P1 |
| SECURITY.md + Privacy Policy address updates | HIGH — legal/trust requirement | LOW — text edits only | P1 |
| Gmail "Send mail as" (4 addresses via Resend SMTP) | MEDIUM — operator convenience and reply correctness | MEDIUM — per-address Gmail settings flow | P2 |
| `security.txt` at `/.well-known/` | MEDIUM — researcher UX, CISA recommended | LOW — static file + Express route | P2 |
| `contact@` routing rule | LOW — nice-to-have inbox | LOW — one Cloudflare rule | P2 |
| Catch-all rule | LOW — absorbs stray addresses cleanly | LOW — one Cloudflare rule | P2 |
| DMARC `p=quarantine` upgrade | MEDIUM — spoofing protection | LOW — DNS change; gated on 2 weeks monitoring | P3 — post-launch |
| DMARC `p=reject` upgrade | MEDIUM — full spoofing prevention | LOW — DNS change | P3 — post-launch |

**Priority key:** P1 = must have for launch, P2 = include in v5.1 (low effort), P3 = future milestone

---

## Email Authentication Completeness Criteria

For torchsecret.com to be considered fully authenticated on launch day:

| Protocol | DNS Record Location | Managed By | Verified In |
|----------|--------------------|-----------:|-------------|
| SPF (Resend) | TXT at `send.torchsecret.com` (or root) | Resend | Resend dashboard shows "Verified" |
| DKIM (Resend) | CNAME/TXT per Resend instructions | Resend | Resend dashboard shows "Verified" |
| DMARC | TXT at `_dmarc.torchsecret.com` | Manual (you) | `rua=` reports arriving in gmail |
| SPF (Loops.so) | TXT record per Loops instructions | Loops.so | Loops dashboard shows "Verified" |
| DKIM (Loops.so) | CNAME per Loops instructions | Loops.so | Loops dashboard shows "Verified" |

Both Resend and Loops.so require separate domain authentication flows. They share `torchsecret.com`
as the root domain but add distinct DNS records — they do not conflict, but both must be completed
independently in their respective dashboards.

---

## Security-SaaS Specific Notes

**`security@` is not optional for a ZK encryption product.** RFC 2142 §4 reserves this address for
"Network Security — Security bulletins or queries." Researchers routinely check for it before
attempting responsible disclosure. A product whose entire value proposition is encryption and
security, but that lacks `security@`, sends a contradictory signal to technically sophisticated
users and early adopters.

**`security.txt` is low-effort and high-signal.** RFC 9116 defines the standard. CISA actively
recommends it for all organizations. The minimum viable file is two fields (`Contact:` + `Expires:`).
Serving it from Express takes 5 minutes and reinforces the zero-knowledge security brand.

**`privacy@` is a legal requirement, not a preference.** GDPR Article 13/14 requires a listed
contact address for data subject requests (erasure, portability, access). The Privacy Policy must
list a *functional* address — not a placeholder — before launch.

**`noreply@` is appropriate for transactional email.** Despite the general industry advice against
noreply addresses, that guidance applies to marketing and relationship emails. For transactional
one-way notifications (secret-viewed alerts, email confirmations), noreply is semantically correct
behavior. The mitigation is a `Reply-To: support@torchsecret.com` header so recipients who try to
reply are directed somewhere useful rather than hitting a bounce.

**Gmail "Send mail as" with Resend SMTP, not Gmail SMTP.** The community-documented approach of
using Gmail's own SMTP (`smtp.gmail.com`) for "Send mail as" does not add DKIM signatures for
custom domains — that requires Google Workspace. Using Resend's SMTP relay (`smtp.resend.com`)
instead signs outbound mail with the Resend-managed DKIM key, achieving proper authentication.
Resend SMTP credentials: host `smtp.resend.com`, port 465 (SSL) or 587 (TLS), username `resend`,
password = your Resend API key.

---

## Sources

- [RFC 2142 — Mailbox Names for Common Services, Roles and Functions](https://tools.ietf.org/html/rfc2142) — Primary source for `security@`, `abuse@`, `postmaster@` requirements. Confidence: HIGH
- [RFC 9116 — security.txt File Format](https://www.rfc-editor.org/rfc/rfc9116.html) — Required and optional fields for `/.well-known/security.txt`. Confidence: HIGH
- [Cloudflare Email Routing — Configure rules and addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/) — One-to-one rule architecture, verification requirement, catch-all support. Confidence: HIGH
- [Resend — Send with SMTP](https://resend.com/docs/send-with-smtp) — Host: `smtp.resend.com`, Port: 465/587, User: `resend`, Password: API key. Confidence: HIGH
- [Resend — DMARC documentation](https://resend.com/docs/dashboard/domains/dmarc) — SPF/DKIM auto-handled by Resend; DMARC is a manual TXT record. Confidence: HIGH
- [Loops.so — Start here documentation](https://loops.so/docs/start-here) — MX + TXT + CNAME records; up to 24h propagation; sender domain must match. Confidence: HIGH
- [DMARC policy guidance — EmailOnAcid 2025](https://www.emailonacid.com/blog/article/email-deliverability/why-strong-dmarc-policy/) — Gmail/Yahoo 2024 bulk sender DMARC requirements; phased p=none → quarantine → reject. Confidence: MEDIUM
- [Gmail "Send mail as" with Cloudflare + SMTP — Community guide](https://gist.github.com/irazasyed/a5ca450f1b1b8a01e092b74866e9b2f1) — Setup flow and caveats; use Resend SMTP not Gmail SMTP for DKIM signing. Confidence: MEDIUM
- [CISA security.txt recommendation](https://www.cisa.gov/news-events/news/securitytxt-simple-file-big-value) — US government recommendation for all organizations. Confidence: HIGH

---

*Feature research for: Business email infrastructure (v5.1)*
*Researched: 2026-03-03*
