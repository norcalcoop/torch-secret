# Architecture Research: v5.1 Business Email Infrastructure

**Domain:** Adding business email infrastructure (inbound routing + outbound verification + Gmail aliases) to existing Express app with Resend + Loops
**Researched:** 2026-03-03
**Confidence:** HIGH (Resend DNS records confirmed via official docs, DKIM selector `resend._domainkey` confirmed, Cloudflare Email Routing MX/SPF behavior confirmed, SMTP credentials confirmed, SPF single-record rule confirmed), MEDIUM (Loops DKIM selector names not publicly disclosed — must be read from Loops dashboard; DMARC p=quarantine recommendation for forwarding is community-sourced)

---

## System Overview

v5.1 connects three independent external email systems through a shared DNS zone (Cloudflare). No new server-side code is required beyond updating one environment variable in Infisical. The codebase change surface is exactly one env var value.

```
+-----------------------------------------------------------+
|              torchsecret.com DNS (Cloudflare)              |
|                                                            |
|  MX @ → Cloudflare Email Routing  (inbound)               |
|  SPF @ → combined: Cloudflare + Resend includes            |
|  DKIM resend._domainkey → Resend TXT (outbound auth)      |
|  DKIM [3 CNAME selectors] → Loops (outbound auth)        |
|  SPF envelope.torchsecret.com → Loops sub-SPF             |
|  DMARC _dmarc → p=quarantine; rua=...                     |
+-----------------------------------------------------------+
         |                    |                    |
         v                    v                    v
+----------------+  +------------------+  +------------------+
| Cloudflare     |  | Resend           |  | Loops.so         |
| Email Routing  |  | (outbound SMTP)  |  | (email sequences)|
| (inbound only) |  |                  |  |                  |
| Forwards 7     |  | noreply@         |  | hello@           |
| addresses to   |  | torchsecret.com  |  | torchsecret.com  |
| Gmail          |  | verified domain  |  | verified domain  |
+-------+--------+  +--------+---------+  +--------+---------+
        |                    |                      |
        v                    v                      v
+----------------+  +------------------+  +------------------+
| torch-secret   |  | Express          |  | Loops.so         |
| @gmail.com     |  | notification.    |  | onboarding       |
| (receives all) |  | service.ts       |  | sequences        |
|                |  | subscribers.     |  | (registered +    |
| Gmail "Send    |  | service.ts       |  | subscribed       |
| mail as" 7     |  | (sends via       |  | events)          |
| aliases via    |  | RESEND_API_KEY + |  |                  |
| smtp.resend.com|  | RESEND_FROM_EMAIL|  |                  |
+----------------+  +------------------+  +------------------+
```

### Component Responsibilities

| Component | Responsibility | Managed In |
|-----------|----------------|------------|
| Cloudflare Email Routing | Inbound MX for all 7 addresses → Gmail forwarding | Cloudflare dashboard |
| Resend domain verification | Authorize `noreply@torchsecret.com` as outbound sender | Resend dashboard + Cloudflare DNS |
| Loops.so domain verification | Authorize `hello@torchsecret.com` as Loops sender | Loops dashboard + Cloudflare DNS |
| Gmail "Send mail as" | Let torch.secrets@gmail.com send as 7 business addresses | Gmail settings + smtp.resend.com |
| Express email.ts | Resend SDK singleton; no change needed | No code change |
| notification.service.ts | Reads `env.RESEND_FROM_EMAIL`; no change needed | No code change |
| subscribers.service.ts | Reads `env.RESEND_FROM_EMAIL`; no change needed | No code change |
| Infisical | Source of truth for `RESEND_FROM_EMAIL` value | Infisical dashboard |

---

## DNS Record Architecture

### Current State (before v5.1)

```
torchsecret.com DNS:
  (no MX records — domain receives no email)
  (no SPF/DKIM/DMARC records)
  RESEND_FROM_EMAIL = onboarding@resend.dev  (Resend sandbox)
```

### Target State (after v5.1)

```
torchsecret.com DNS:
  MX  @                          → route1.mx.cloudflare.net (priority 98)
  MX  @                          → route2.mx.cloudflare.net (priority 59)
  MX  @                          → route3.mx.cloudflare.net (priority 14)
  TXT @                          → "v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all"
  TXT resend._domainkey          → "p=[resend-dkim-public-key]"  (DNS Only, not proxied)
  MX  send                       → feedback-smtp.[region].amazonses.com (Resend bounce/return)
  TXT send                       → "v=spf1 include:amazonses.com ~all"  (Resend sub-SPF)
  CNAME [loops-selector-1]._domainkey → [loops DKIM target]  (DNS Only)
  CNAME [loops-selector-2]._domainkey → [loops DKIM target]  (DNS Only)
  CNAME [loops-selector-3]._domainkey → [loops DKIM target]  (DNS Only)
  TXT  envelope                  → "v=spf1 include:amazonses.com ~all"  (Loops sub-SPF, no conflict)
  TXT  _dmarc                    → "v=DMARC1; p=quarantine; rua=mailto:dmarc@torchsecret.com"
```

**Note:** Exact MX hostnames, DKIM public key values, and Loops selector names must be read from the respective dashboards (Cloudflare → Email Routing → View DNS records; Resend → Domains → torchsecret.com; Loops → Settings → Domain → View records). The selectors and public keys are account-specific and are not published in documentation.

### SPF Architecture: Why No Conflict Between Cloudflare + Resend + Loops

There is only ever **one SPF TXT record per FQDN**. Multiple SPF TXT records on the same hostname invalidate each other (RFC 7208). The three providers are arranged to avoid this:

| Provider | SPF location | Mechanism | Why no conflict |
|----------|-------------|-----------|-----------------|
| Cloudflare Email Routing | `@` (root domain) | `include:_spf.mx.cloudflare.net` | In root SPF record |
| Resend | `send.torchsecret.com` (subdomain) | `include:amazonses.com` | Resend's SPF lives on `send` subdomain — separate FQDN from `@` |
| Loops | `envelope.torchsecret.com` (subdomain) | `include:amazonses.com` | Loops explicitly uses `envelope.*` subdomain — separate FQDN from `@` |

The root `@` SPF record must include both Cloudflare (for inbound rewriting) and any top-level senders. Resend and Loops handle their own SPF via subdomains automatically — nothing extra needed at `@` for them beyond what Resend's domain dashboard auto-generates.

**However:** Check whether Resend's dashboard adds `include:amazonses.com` to the root `@` or to a `send.*` subdomain. If Resend requests a root-level SPF entry, it must be merged into the single `@` TXT record. Cloudflare's DMARC Management UI can help construct the merged record.

### DKIM Architecture: Multiple Selectors Coexist Freely

DKIM selectors are unique sub-hostnames. Different providers use different selectors — they do not conflict because each lookup is `[selector]._domainkey.torchsecret.com` and resolves independently.

| Provider | DKIM record type | DKIM selector | Proxy status |
|----------|-----------------|---------------|--------------|
| Resend | TXT | `resend._domainkey` | DNS Only (gray cloud) |
| Loops | CNAME (x3) | [from Loops dashboard] | DNS Only (gray cloud) |

**Critical:** All DKIM records in Cloudflare must be set to **DNS Only (gray cloud)**. Cloudflare's proxy (orange cloud) intercepts CNAME/TXT lookups and returns proxy IPs instead of the actual DKIM public key, causing DKIM verification to fail silently.

---

## Order of Operations

The sequence matters because Gmail "Send mail as" sends a verification email to the address being added. That email must be receivable before Gmail can be configured.

### Phase 1: Cloudflare Email Routing (inbound prerequisite)

Must be done first because Gmail "Send mail as" verification sends an email to `hello@torchsecret.com`, `contact@torchsecret.com`, etc. — those addresses must be live and forwarding to Gmail before Gmail configuration can proceed.

```
1. Cloudflare Dashboard → Email → Email Routing → Enable
2. Cloudflare auto-adds 3 MX records and a base SPF TXT record at @
3. Create 7 custom addresses:
     hello@, contact@, admin@, info@, support@, security@, privacy@
   All forwarding to: torch.secrets@gmail.com
4. Confirm destination address (Cloudflare sends verification to torch.secrets@gmail.com)
5. Test: send email to hello@torchsecret.com → verify arrives in Gmail
```

**DNS propagation:** MX records typically propagate within minutes on Cloudflare's authoritative DNS, but allow up to 1 hour before testing.

### Phase 2: Resend Domain Verification (outbound prerequisite)

Must be done before updating `RESEND_FROM_EMAIL` in Infisical. Sending from an unverified domain fails with a Resend API error.

```
1. Resend Dashboard → Domains → Add Domain → torchsecret.com
2. Resend displays 3 DNS records to add:
     a. MX record on "send" subdomain (bounce return path)
     b. TXT record on "send" subdomain (SPF)
     c. TXT record on "resend._domainkey" (DKIM public key)
3. Add all 3 records in Cloudflare DNS:
     - Set DKIM TXT record to DNS Only (NOT proxied)
     - Omit ".torchsecret.com" from record names (Cloudflare appends domain automatically)
4. Merge SPF if needed:
     - If Resend requires a root @ SPF entry, update the existing @ TXT record
       (created by Cloudflare Email Routing) to add include:amazonses.com
       Merged: "v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all"
     - If Resend puts its SPF only on "send" subdomain (most likely), root @ is unchanged
5. Return to Resend → click "Verify DNS Records"
6. Wait for "Verified" status (typically minutes; up to 24 hours)
7. Do NOT update RESEND_FROM_EMAIL yet
```

**DNS propagation:** Allow 15–60 minutes before clicking Verify.

### Phase 3: Loops.so Domain Verification

Independent of Resend; can be done in parallel with Phase 2. Loops uses `hello@torchsecret.com` as sender, which is authorized through the DKIM CNAME records.

```
1. Loops Dashboard → Settings → Domain → View records
2. Loops displays several records to add:
     a. 3 DKIM CNAME records (account-specific selectors)
     b. MX record(s) for envelope subdomain
     c. TXT record on "envelope" subdomain (SPF — will NOT conflict with root @)
3. Add all records in Cloudflare DNS:
     - Set all 3 DKIM CNAME records to DNS Only (NOT proxied)
     - Omit ".torchsecret.com" from record names
4. Loops Dashboard → click "Verify Records"
5. Wait for verification (up to 1 hour per Loops docs)
```

### Phase 4: DMARC Record

Add after SPF and DKIM are verified (both Resend and Loops). DMARC without working DKIM/SPF is ineffective and will cause deliverability failures immediately.

```
1. Add TXT record in Cloudflare:
     Name:    _dmarc
     Type:    TXT
     Content: "v=DMARC1; p=quarantine; rua=mailto:dmarc@torchsecret.com"

2. Use p=quarantine (not p=reject):
     - Cloudflare Email Routing rewrites the envelope sender during forwarding
     - This breaks SPF alignment for forwarded emails from strict senders
     - p=reject would cause legitimate forwarded emails to bounce
     - p=quarantine is the correct posture for forwarding setups
     - p=none during initial testing is also acceptable, then promote to quarantine
```

**Note:** `dmarc@torchsecret.com` will forward to Gmail via the custom address routing established in Phase 1. Alternatively, use an external DMARC reporting inbox (Postmark, dmarcian free tier).

### Phase 5: Update RESEND_FROM_EMAIL in Infisical

Only after Phase 2 is complete and Resend shows domain as "Verified":

```
1. Infisical Dashboard → [project] → [environment: production]
2. Update RESEND_FROM_EMAIL:
     From: onboarding@resend.dev
     To:   noreply@torchsecret.com
3. Repeat for staging environment if desired
4. Render auto-deploys if Secret Sync is configured; or trigger manual deploy
5. Verify first outbound email sends successfully (e.g., create a secret on staging with notify-on-view enabled)
```

**No application code changes required for this step.** All three email callers (`notification.service.ts`, `subscribers.service.ts`, and Better Auth's built-in email verification) read `env.RESEND_FROM_EMAIL` at runtime via the Zod-validated env schema. The env var is the entire implementation.

### Phase 6: Gmail "Send mail as" Configuration

Requires Phase 1 (addresses live and forwarding to Gmail) and Phase 2 (Resend SMTP available for verified domain).

```
For each of the 7 addresses (hello, contact, admin, info, support, security, privacy):
1. Gmail → Settings → Accounts and Import → Send mail as → Add another email address
2. Enter: Name = "Torch Secret", Email = [address]@torchsecret.com
3. Select: "Send through [address]'s SMTP servers"
4. SMTP settings:
     Server:   smtp.resend.com
     Port:     465  (SSL) — recommended; or 587 (TLS)
     Username: resend
     Password: [RESEND_API_KEY]  (same API key as application uses)
5. Gmail sends verification code to [address]@torchsecret.com
   → Email arrives in Gmail inbox (via Cloudflare Email Routing from Phase 1)
   → Enter verification code in Gmail dialog
6. Repeat for all 7 addresses
```

**Important:** The Resend API key used for Gmail SMTP must belong to a Resend account where `torchsecret.com` is a verified domain. The same key as `RESEND_API_KEY` in Infisical can be used — no separate key required.

---

## Codebase Changes vs. External Configuration

| Item | Type | Location | What changes |
|------|------|----------|-------------|
| `RESEND_FROM_EMAIL` env var | External config (Infisical) | Infisical dashboard | Value changes from `onboarding@resend.dev` to `noreply@torchsecret.com` |
| DNS records (MX, SPF, DKIM, DMARC) | External config (Cloudflare) | Cloudflare DNS dashboard | New records added |
| Resend domain verification | External config (Resend) | Resend dashboard | Domain added and verified |
| Loops domain verification | External config (Loops) | Loops dashboard | Domain verified |
| Gmail "Send mail as" | External config (Gmail) | Gmail settings | 7 aliases added |
| `notification.service.ts` | No change | Existing file | Already reads `env.RESEND_FROM_EMAIL` |
| `subscribers.service.ts` | No change | Existing file | Already reads `env.RESEND_FROM_EMAIL` |
| `email.ts` | No change | Existing file | Resend SDK singleton; no from-address logic |
| `onboarding.service.ts` | No change | Existing file | Loops handles sending address — no Resend |
| `env.ts` | No change | Existing file | `RESEND_FROM_EMAIL` schema already accepts any non-empty string |
| `SECURITY.md` | Code/docs change | Repo file | Add `security@torchsecret.com` contact |
| Privacy Policy page | Code change | `client/src/pages/privacy.ts` | Add `privacy@torchsecret.com` for data requests |

**Bottom line:** Zero application code changes are needed to make transactional email work with the new domain. The only code-touching tasks are documentation updates (SECURITY.md and Privacy Policy page).

---

## Data Flow: Inbound Email to Gmail

```
External sender → [address]@torchsecret.com
    ↓ (SMTP lookup: MX record → Cloudflare Email Routing servers)
Cloudflare Email Routing
    ↓ (rewrites envelope sender using SRS to avoid SPF failure)
torch.secrets@gmail.com (Gmail inbox)
    ↓ (user reads email in Gmail)
User replies using Gmail "Send mail as" [address]@torchsecret.com
    ↓ (Gmail submits outbound via smtp.resend.com:465)
Resend SMTP (authenticates with API key, uses verified torchsecret.com domain)
    ↓ (adds DKIM signature using resend._domainkey)
Recipient mail server (SPF + DKIM pass → delivered to inbox)
```

## Data Flow: Outbound Transactional Email (Notification + Subscriber Confirmation)

```
Express app event (secret viewed / subscriber signs up)
    ↓
notification.service.ts OR subscribers.service.ts
    ↓ (resend.emails.send({ from: env.RESEND_FROM_EMAIL, ... }))
Resend API (HTTPS to api.resend.com)
    ↓ (Resend sends via verified torchsecret.com domain)
    ↓ (adds DKIM signature: resend._domainkey.torchsecret.com)
    ↓ (envelope from: send.torchsecret.com for bounce handling)
Recipient mail server (SPF + DKIM pass via amazonses.com)
    ↓
User inbox
```

## Data Flow: Loops Onboarding Email

```
User registers / subscriber confirms
    ↓
onboarding.service.ts OR subscribers.service.ts
    ↓ (loops.sendEvent({ email, eventName: 'registered' | 'subscribed' }))
Loops.so API
    ↓ (sends from hello@torchsecret.com via verified Loops domain)
    ↓ (DKIM signed via Loops CNAME selectors)
    ↓ (SPF authorized via envelope.torchsecret.com subdomain)
User inbox
```

---

## Architectural Patterns

### Pattern 1: Subdomain Isolation for Multi-Provider SPF

**What:** Each email provider that needs SPF authorization is given its own subdomain (`send.*` for Resend, `envelope.*` for Loops), leaving the root `@` SPF record clean and minimal.

**Why:** RFC 7208 allows exactly one SPF TXT record per FQDN. Multiple providers trying to share the root `@` TXT record hit the 10-DNS-lookup limit and must be merged into one record — a maintenance burden. Subdomain isolation lets each provider own its SPF record independently.

**When to use:** Always when running multiple outbound email providers on the same domain.

**Example:**
```
@                      TXT  "v=spf1 include:_spf.mx.cloudflare.net ~all"
send.torchsecret.com   TXT  "v=spf1 include:amazonses.com ~all"  (Resend-owned)
envelope.torchsecret.com TXT "v=spf1 include:amazonses.com ~all" (Loops-owned)
```

### Pattern 2: DKIM Selector Namespace Separation

**What:** Each provider uses a distinct DKIM selector prefix (`resend._domainkey` for Resend; Loops uses its own selectors). DNS resolves each independently.

**Why:** DKIM selectors form independent sub-hostnames. There is no conflict between providers as long as they each use unique selector names. Unlike SPF (one record per hostname), DKIM allows unlimited records across different selectors.

**When to use:** Always — this is the standard DKIM mechanism and requires no special setup beyond using the selectors each provider assigns.

### Pattern 3: Environment Variable as Configuration Seam

**What:** The `from` address in all transactional emails is externalized to `RESEND_FROM_EMAIL` and injected by Infisical. Updating the sender address requires zero code changes.

**Why:** Separates configuration (which address to send from) from implementation (how to send). The codebase remains unchanged whether sending from `onboarding@resend.dev` or `noreply@torchsecret.com`.

**Trade-off:** The Zod schema for `RESEND_FROM_EMAIL` does not validate email format (just `z.string().min(1)`). A typo in Infisical would silently produce a Resend API error at runtime rather than a startup crash. Acceptable for this low-churn env var.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Proxying DKIM CNAME Records in Cloudflare

**What people do:** Add DKIM CNAME records in Cloudflare and leave proxy (orange cloud) enabled.

**Why it's wrong:** Cloudflare's proxy intercepts the CNAME lookup and returns its own IP addresses. The receiving mail server's DKIM verifier expects the DNS lookup to resolve to the provider's public key TXT record via CNAME chain. With proxying, the TXT record is unreachable — DKIM verification fails, emails land in spam or are rejected.

**Do this instead:** Ensure all DKIM CNAME records show the gray cloud (DNS Only) in Cloudflare DNS management. This is required for all three Loops CNAME records and for any CNAME-based Resend records.

### Anti-Pattern 2: Multiple SPF TXT Records on the Same Hostname

**What people do:** Add a second TXT record at `@` for the new email provider's SPF instead of merging into the existing record.

**Why it's wrong:** RFC 7208 §3.2 requires exactly one SPF TXT record per domain. Having two causes "permerror" in SPF evaluation — equivalent to failing. Some providers will also warn or fail outright.

**Do this instead:** There is exactly one `@` TXT record with type SPF. All includes are merged into it: `"v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all"`. Resend and Loops avoid this problem by using subdomain SPF records.

### Anti-Pattern 3: Using p=reject DMARC with Email Forwarding

**What people do:** Set DMARC to `p=reject` for maximum security immediately after adding records.

**Why it's wrong:** Cloudflare Email Routing rewrites the envelope sender during forwarding. This breaks SPF alignment for the forwarded copy. With `p=reject`, Gmail (the destination) rejects forwarded messages from senders who also have `p=reject` DMARC, because the email fails both SPF alignment (envelope rewritten) and potentially DKIM alignment (DKIM signatures from sender's domain remain, but pass when the key is valid — ARC helps here). In practice, some strict senders' emails will bounce or be quarantined.

**Do this instead:** Use `p=quarantine` for your own domain's DMARC record. This quarantines spoofed emails from your domain without bouncing legitimate forwarded mail from third parties.

### Anti-Pattern 4: Updating RESEND_FROM_EMAIL Before Domain is Verified

**What people do:** Update the env var first to get it done, then verify the domain.

**Why it's wrong:** Resend API rejects sends from unverified domains with a 403 error. All transactional emails (secret-viewed notifications and subscriber confirmation emails) will silently fail until the domain is verified. The failure surfaces as `notification_send_failed` in Pino logs but does not crash the request.

**Do this instead:** Verify the domain in Resend and confirm it shows "Verified" status, then update `RESEND_FROM_EMAIL` in Infisical.

### Anti-Pattern 5: Omitting Domain from Cloudflare Record Names

**What people do (the opposite mistake):** When adding DNS records in Cloudflare, include the full FQDN in the record name field (e.g., `resend._domainkey.torchsecret.com`).

**Why it's wrong:** Cloudflare automatically appends `.torchsecret.com` to all record names. Adding the full FQDN creates a double-suffixed record (`resend._domainkey.torchsecret.com.torchsecret.com`) that Resend's verifier can never find.

**Do this instead:** Enter only the subdomain prefix in the Name field (e.g., `resend._domainkey`, or `send`, or `envelope`). Cloudflare appends the zone domain automatically.

---

## Integration Points

### External Services

| Service | Integration Pattern | Key Gotcha |
|---------|---------------------|------------|
| Cloudflare Email Routing | Inbound MX + forwarding rules via dashboard | Locks DNS records when active; disabling Email Routing deletes MX records |
| Resend (domain) | TXT DKIM + subdomain MX/SPF via DNS | DKIM selector is always `resend._domainkey`; set DNS Only in Cloudflare |
| Resend (SMTP) | smtp.resend.com:465, user=`resend`, pass=API key | Must use API key for verified domain; same key as `RESEND_API_KEY` |
| Loops.so (domain) | 3 CNAME DKIM + subdomain MX/SPF via DNS | Selector names visible only in Loops dashboard; proxy must be off |
| Gmail "Send mail as" | SMTP credentials configured per alias in Gmail settings | Gmail sends verification email — requires Cloudflare Email Routing live first |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `env.ts` → email services | `RESEND_FROM_EMAIL` value at startup | Zod validates non-empty; no email format validation |
| `notification.service.ts` → Resend | `resend.emails.send()` with `from: env.RESEND_FROM_EMAIL` | No code change; env var update only |
| `subscribers.service.ts` → Resend | `resend.emails.send()` with `from: env.RESEND_FROM_EMAIL` | No code change; env var update only |
| `onboarding.service.ts` → Loops | `loops.sendEvent()` — Loops controls sender address | Loops sends from `hello@torchsecret.com` after domain verification; no code change |
| Better Auth → Resend | Auth email sender configured in `server/src/app.ts` auth setup | Check if `RESEND_FROM_EMAIL` is also used for auth emails (email verification, password reset) |

### Better Auth Email Sender — Verify Before Updating

Better Auth's email sender in `server/src/app.ts` may also use `env.RESEND_FROM_EMAIL` as the `from` address for auth emails (email verification links, password reset). Confirm this in the `auth` configuration block before updating the env var:

- If it uses `env.RESEND_FROM_EMAIL`: updating the env var changes auth email sender too — correct behavior
- If it hardcodes a different address: may need a separate check after deploy

---

## Scaling Considerations

This milestone is pure configuration — no scaling implications for the email infrastructure itself. The Resend free tier allows 3,000 emails/month; Pro is 50,000/month. Loops.so pricing is contact-based. Neither poses a scaling constraint at current stage.

| Scale | Email Architecture Adjustments |
|-------|-------------------------------|
| 0–1k users | Current setup adequate; single Resend API key shared for SMTP + SDK |
| 1k–100k users | Separate Resend API keys for SMTP-only (Gmail) vs. SDK (transactional) to scope permissions |
| 100k+ users | Evaluate dedicated sending IP, BIMI record for brand indicators, dedicated bounce monitoring |

---

## DNS Propagation Timeline

| Phase | Action | Expected propagation |
|-------|--------|---------------------|
| Phase 1 | Cloudflare Email Routing MX records | Minutes (Cloudflare authoritative) |
| Phase 2 | Resend DKIM TXT + send.* records | 15 min – 1 hour |
| Phase 3 | Loops DKIM CNAME + envelope.* records | Up to 1 hour |
| Phase 4 | DMARC TXT record | 15 min – 48 hours |
| Phase 5 | Infisical env var update + Render deploy | Minutes (after deploy) |
| Phase 6 | Gmail "Send mail as" verification | Immediate (email arrives via Phase 1) |

**Total minimum clock time (sequential):** ~2–4 hours if DNS propagates quickly.
**Total safe estimate (with verification gaps):** Same day if started in the morning.

---

## Sources

- [Resend Cloudflare knowledge base](https://resend.com/docs/knowledge-base/cloudflare) — DKIM selector `resend._domainkey` confirmed, DNS Only requirement confirmed, record name truncation for Cloudflare (HIGH confidence)
- [Resend Send with SMTP docs](https://resend.com/docs/send-with-smtp) — SMTP host `smtp.resend.com`, user `resend`, password = API key, ports 465/587 (HIGH confidence)
- [Loops.so sending domain docs](https://loops.so/docs/sending-domain) — SPF at `envelope.*` subdomain to avoid conflict confirmed (MEDIUM confidence — selector names not disclosed)
- [Cloudflare Email Routing DNS records docs](https://developers.cloudflare.com/email-routing/setup/email-routing-dns-records/) — MX record structure, SPF `include:_spf.mx.cloudflare.net` (HIGH confidence)
- [Cloudflare community: Email Routing and SPF](https://community.cloudflare.com/t/email-routing-and-spf/341490) — Combined SPF record pattern confirmed (MEDIUM confidence, community source)
- [Multiple DKIM records - DMARCLY](https://dmarcly.com/blog/can-i-have-multiple-dkim-records-on-my-domain) — Multiple DKIM selectors coexist freely, unique selectors required (HIGH confidence)
- [Gmail Send mail as with Cloudflare Email Routing gist](https://gist.github.com/irazasyed/a5ca450f1b1b8a01e092b74866e9b2f1) — SMTP credentials confirmed; DMARC p=quarantine recommendation for forwarding (MEDIUM confidence, community source)
- [Cloudflare DMARC Reject + Email Routing community](https://community.cloudflare.com/t/dmarc-reject-policy-cloudflare-email-routing/753410) — p=reject conflicts with email forwarding (MEDIUM confidence, community source)

---
*Architecture research for: v5.1 Business Email Infrastructure (torchsecret.com)*
*Researched: 2026-03-03*
