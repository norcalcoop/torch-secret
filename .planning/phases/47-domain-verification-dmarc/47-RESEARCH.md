# Phase 47: Domain Verification + DMARC - Research

**Researched:** 2026-03-04
**Domain:** DNS-only email authentication — Resend domain verification, Loops.so domain verification, DMARC TXT record
**Confidence:** HIGH (Resend records structure), MEDIUM (Loops.so record specifics — account-generated values must be read from dashboard), HIGH (DMARC format)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Zero-code scope
- This is a zero-code-changes phase: only Cloudflare DNS records and Resend/Loops.so dashboard confirmation. No application files, no Infisical env vars, no npm packages.

#### DMARC rua= monitoring address
- Use `admin@torchsecret.com` (already routed via Phase 46) as the rua= destination
- Publish: `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com`
- No new routing rule needed — admin@ is already live and forwarding to torch-secret@gmail.com
- Note: The success criteria says dmarc@torchsecret.com but that address has no routing rule; admin@ is the pragmatic substitute

#### Resend delivery verification
- Verify delivery using both the Resend dashboard "Send test" button AND a curl call to the Resend API
- Test recipient: torch-secret@gmail.com
- From address: noreply@torchsecret.com (the sender address that will be used in Phase 48)
- Success: email arrives in inbox (not spam)

#### Loops.so sender address
- hello@torchsecret.com is the confirmed sender to verify in Loops.so
- No additional Loops sender addresses needed this phase

### Claude's Discretion
- Order of DNS record additions (Resend vs Loops.so records can be added in any order in a single Cloudflare session)
- Exact curl command format for Resend API test send
- How long to wait for DNS propagation before triggering Resend/Loops dashboard verification

### Deferred Ideas (OUT OF SCOPE)
- DMARC policy progression from p=none to p=quarantine — EOPS-02, post-30-day monitoring period
- DMARC aggregate report monitoring tooling (e.g. DMARC Analyzer, dmarcian) — EOPS-01, future phase
- Adding dmarc@torchsecret.com as a dedicated routing rule — future phase if aggregate reports warrant it
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSND-01 | Admin can verify torchsecret.com in Resend with DKIM, SPF, and DMARC DNS records | Resend DNS record structure documented: 1 DKIM TXT (resend._domainkey), 1 SPF TXT (send subdomain), 1 MX (send subdomain). Dashboard verification flow documented. DMARC is separate — not gated by Resend. |
| LOOP-01 | Admin can verify torchsecret.com in Loops.so with DKIM and SPF DNS records | Loops.so DNS record structure documented: 3 DKIM CNAMEs (account-generated names), 1 SPF TXT (envelope subdomain), 1 MX (envelope subdomain). Must retrieve actual values from Loops Settings → Domain → View Records. |
| LOOP-02 | Admin can confirm hello@torchsecret.com is the verified sender address in Loops.so | Loops sender address is set in Settings → Domain (sender name + From address). Once domain DNS is verified, hello@torchsecret.com is usable as the From address. |
</phase_requirements>

---

## Summary

Phase 47 is a pure DNS operations phase with three parallel workstreams: (1) add Resend's required DNS records to Cloudflare and trigger dashboard verification, (2) add Loops.so's required DNS records to Cloudflare and trigger dashboard verification, and (3) publish a DMARC TXT record at `_dmarc.torchsecret.com`. All work happens in two dashboards — Cloudflare DNS and the Resend/Loops.so provider dashboards. Zero code changes.

Both Resend and Loops.so are built on Amazon SES infrastructure. Their DNS records follow SES conventions: SPF is `v=spf1 include:amazonses.com ~all` on a dedicated subdomain (Resend uses `send`, Loops uses `envelope`), DKIM uses account-specific selectors pointing to amazonaws.com, and the MX for bounce processing points to `feedback-smtp.us-east-1.amazonses.com`. The SPF subdomain isolation pattern (established in Phase 46 STATE.md) is correctly applied: Resend and Loops each get their own subdomain, keeping the apex @ SPF record owned solely by Cloudflare Email Routing.

The critical operational pattern for this phase: all DKIM CNAME records (and the DKIM TXT record for Resend) must be set to DNS Only (grey cloud) in Cloudflare. Proxied CNAME/TXT records route traffic through Cloudflare's CDN, breaking DKIM verification permanently. DMARC and SPF TXT records are not proxiable — Cloudflare will not offer the orange cloud for them — so that setting only applies to DKIM.

**Primary recommendation:** Add all DNS records in a single Cloudflare session, wait 5-15 minutes for Cloudflare's near-instant propagation, then click "Verify" in Resend and Loops.so dashboards. If verification fails, wait up to 24 hours before troubleshooting. Do not add FQDN in Cloudflare name fields — enter only the subdomain prefix.

---

## Standard Stack

### What Each Provider Requires

Both Resend and Loops.so use Amazon SES as their underlying infrastructure. DNS record values are account-generated and must be retrieved from each provider's dashboard — exact values (especially DKIM keys) are unique per account.

#### Resend Domain Records

| Record | Type | Name (Cloudflare field) | Value / Target |
|--------|------|------------------------|----------------|
| DKIM | TXT | `resend._domainkey` | Account-generated public key (copy from Resend dashboard) |
| SPF | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| MX (bounces) | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (Priority: 10) |

**Record count:** 3 total (1 DKIM TXT, 1 SPF TXT, 1 MX)

**Source:** Resend Cloudflare documentation (resend.com/docs/knowledge-base/cloudflare) — HIGH confidence

**Important:** The Resend DKIM record is a TXT record (not CNAME). The name is `resend._domainkey` without the domain suffix. In Cloudflare: set proxy status to DNS Only (grey cloud) for the DKIM TXT record — TXT records cannot be proxied, so Cloudflare won't show the orange toggle, but it must be DNS Only regardless.

**Note on MX regions:** Resend warns that if you see a "multiple-regions" error, all MX records for a domain must point to the same AWS region. The region shown in your Resend dashboard when creating the domain is the authoritative region to use.

#### Loops.so Domain Records

| Record | Type | Name (Cloudflare field) | Value / Target |
|--------|------|------------------------|----------------|
| DKIM 1 | CNAME | Account-generated (e.g., `loopsXXX._domainkey`) | Account-generated target at amazonaws.com |
| DKIM 2 | CNAME | Account-generated | Account-generated target at amazonaws.com |
| DKIM 3 | CNAME | Account-generated | Account-generated target at amazonaws.com |
| SPF | TXT | `envelope` | `v=spf1 include:amazonses.com ~all` |
| MX (bounces) | MX | `envelope` | `feedback-smtp.us-east-1.amazonses.com` (Priority: 10) |

**Record count:** 5 total (3 DKIM CNAMEs, 1 SPF TXT, 1 MX)

**Source:** Loops.so sending-domain documentation and multiple third-party guides — MEDIUM confidence on DKIM names (account-generated); HIGH confidence on SPF value and subdomain pattern.

**CRITICAL:** Loops.so DKIM records are CNAME records, and CNAMEs CAN be proxied in Cloudflare. Set each DKIM CNAME to DNS Only (grey cloud). The SPF TXT and MX records cannot be proxied and will not show the orange toggle.

**Retrieve actual values from:** Loops dashboard → Settings → Domain → View Records

#### DMARC Record

| Record | Type | Name (Cloudflare field) | Value |
|--------|------|------------------------|-------|
| DMARC | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com` |

**Source:** DMARC RFC (RFC 7489) format, Cloudflare learning docs — HIGH confidence

**Cloudflare DMARC Management caveat:** Cloudflare has a "DMARC Management" wizard (Email → DMARC Management). If you use this wizard instead of adding the TXT record manually, Cloudflare appends its own rua= email address alongside yours to receive reports. For a pure monitoring record without Cloudflare's intervention, add the TXT record directly in DNS (without using the wizard).

---

## Architecture Patterns

### Verification Flow Overview

```
Cloudflare DNS (single session)
├── Add Resend records (resend._domainkey TXT, send TXT SPF, send MX)
├── Add Loops.so records (3x DKIM CNAME, envelope TXT SPF, envelope MX)
└── Add DMARC record (_dmarc TXT)
         ↓
Wait 5-15 min (Cloudflare propagates in seconds; allow buffer for SES polling)
         ↓
Resend dashboard → Domains → torchsecret.com → Verify
         ↓
Loops.so dashboard → Settings → Domain → Verify Records
         ↓
Test: curl Resend API → noreply@torchsecret.com → torch-secret@gmail.com
         ↓
Confirm: email arrives in Gmail inbox (not spam)
```

### Cloudflare Field Naming Rule

Cloudflare DNS automatically appends `.torchsecret.com` to record names. Enter ONLY the subdomain prefix:

| What you want | What to type in Cloudflare "Name" field |
|---------------|----------------------------------------|
| `resend._domainkey.torchsecret.com` | `resend._domainkey` |
| `send.torchsecret.com` | `send` |
| `envelope.torchsecret.com` | `envelope` |
| `_dmarc.torchsecret.com` | `_dmarc` |

**This is the #1 source of record misconfiguration in Cloudflare.** Entering the full FQDN creates a record at `resend._domainkey.torchsecret.com.torchsecret.com` which is always wrong.

### Proxy Status Rules

| Record Type | Proxy Status | Why |
|-------------|-------------|-----|
| DKIM TXT (Resend) | DNS Only (grey) — Cloudflare won't show toggle for TXT | TXT records cannot be proxied; verify this is grayed out |
| DKIM CNAME (Loops) | DNS Only (grey cloud) — MUST turn off | CNAMEs can be proxied; proxied CNAME breaks DKIM lookup permanently |
| SPF TXT | DNS Only — cannot be proxied | |
| MX | DNS Only — cannot be proxied | |
| DMARC TXT | DNS Only — cannot be proxied | |

### Resend Dashboard Verification States

| State | Meaning |
|-------|---------|
| Not started | Domain added but no DNS records detected |
| Pending | Resend is checking your records |
| Verified | All three records (DKIM, SPF, MX) detected and valid |
| Failed | One or more records missing or malformed |

Resend shows per-record status (DKIM: verified / SPF: verified / MX: verified) in the domain detail pane. A domain is considered "Verified" only when all three show green.

**DMARC is NOT required by Resend to reach "Verified" status.** Resend documents: "if you have a verified domain with Resend, it means you are already passing SPF and DKIM." DMARC is a separate, independent TXT record — publish it separately.

### Loops.so Dashboard Verification States

| State | Meaning |
|-------|---------|
| Records present (green per record) | DNS records detected and valid |
| Verification failed | Missing or incorrect records |

In Loops: Settings → Domain → View Records shows the records needed. After adding them, click "Verify Records." DNS propagation may require up to an hour per Loops docs (Cloudflare typically propagates in under 5 minutes, but SES polling adds delay).

### How to Confirm hello@torchsecret.com as Sender in Loops.so

The Loops sender address is configured in Settings → Domain (not a separate per-address verification). The From address is composed of: (sender name in Loops settings) + (From email prefix) + (verified domain). Once `torchsecret.com` is verified as the sending domain in Loops, `hello@torchsecret.com` is automatically usable as the From address without a separate email confirmation step.

Confirm in the Loops dashboard that the From address for campaigns is set to `hello@torchsecret.com` — this is the LOOP-02 success criterion.

### Resend API Test Send (curl)

After Resend shows "Verified," send a test email via API:

```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer YOUR_RESEND_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Torch Secret <noreply@torchsecret.com>",
    "to": ["torch-secret@gmail.com"],
    "subject": "Resend domain verification test",
    "text": "This email confirms noreply@torchsecret.com is sending successfully via Resend."
  }'
```

**Source:** Resend Send Email API reference (resend.com/docs/api-reference/emails/send-email) — HIGH confidence

The API key to use is `RESEND_API_KEY` from Infisical (the existing production key). Do not create a new key for this test — that is Phase 49 scope (Gmail SMTP relay key).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DKIM public key value | Manually generate key pair | Copy from Resend/Loops dashboard | Keys are account-bound, account-generated, and must match the private key the provider holds |
| SPF record at apex (@) | Add include:amazonses.com to apex @ | Use subdomain isolation (send./envelope.) already established | Apex @ SPF is owned by Cloudflare Email Routing; two SPF TXT records at the same FQDN violates RFC 7208 (one SPF per FQDN) |
| DMARC reporting parsing | Build XML parser for rua= reports | Defer to EOPS-01 (future phase) | p=none is monitoring-only; reports are useful but not this phase's scope |
| DNS propagation polling script | Shell loop checking dig output | Just wait and click verify in dashboard | Cloudflare propagates in seconds; provider dashboards poll on their own schedule |

---

## Common Pitfalls

### Pitfall 1: Entering Full FQDN in Cloudflare Name Field

**What goes wrong:** Admin types `resend._domainkey.torchsecret.com` in the Name field. Cloudflare creates `resend._domainkey.torchsecret.com.torchsecret.com` — wrong record, DKIM never verifies.

**Why it happens:** Most DNS documentation shows full FQDNs. Cloudflare auto-appends the zone domain.

**How to avoid:** Enter only the subdomain prefix: `resend._domainkey`, `send`, `envelope`, `_dmarc`.

**Warning signs:** DKIM verification fails even after 24+ hours. Use `dig resend._domainkey.torchsecret.com TXT` — if it returns nothing, the record is at the wrong name.

---

### Pitfall 2: Loops.so DKIM CNAME Left as Proxied (Orange Cloud)

**What goes wrong:** DKIM CNAME records are saved with Cloudflare proxy enabled. Cloudflare intercepts the DNS lookup and returns its own IP instead of the DKIM public key. DKIM verification fails permanently.

**Why it happens:** Cloudflare defaults new CNAME records to proxied (orange cloud). The admin forgets to toggle to DNS Only.

**How to avoid:** For every Loops DKIM CNAME: expand the record in Cloudflare, click the orange cloud icon to turn it grey before saving.

**Warning signs:** Loops.so shows DKIM as failed after propagation. `dig loopsXXX._domainkey.torchsecret.com CNAME` returns Cloudflare IP instead of amazonaws.com target.

---

### Pitfall 3: Adding SPF Records at the Apex Domain (@)

**What goes wrong:** Admin adds `v=spf1 include:amazonses.com ~all` at the apex `@` (torchsecret.com) instead of at `send.torchsecret.com` (Resend) or `envelope.torchsecret.com` (Loops).

**Why it happens:** Generic SPF setup guides tell you to add SPF to your domain. They mean the sending subdomain.

**How to avoid:** Apex @ already has the Cloudflare Email Routing SPF TXT: `v=spf1 include:_spf.mx.cloudflare.net ~all`. DO NOT modify it. Add Resend SPF at `send` and Loops SPF at `envelope` — separate subdomains.

**RFC reference:** RFC 7208 section 3.1: only one SPF TXT record permitted per FQDN. Two SPF records at the same name causes a `PermError` result.

**Warning signs:** Resend/Loops dashboard reports SPF as failing even though you added a record. `dig TXT torchsecret.com +short` shows two SPF records at apex.

---

### Pitfall 4: Triggering Verify Before DNS Propagates

**What goes wrong:** Records are added in Cloudflare and verify is clicked within seconds. The provider's DNS lookup may hit a resolver that has cached the old (empty) response. Verification fails.

**Why it happens:** Impatience. Cloudflare propagates in seconds but recursive resolvers around the world have varying TTLs.

**How to avoid:** Wait 5-15 minutes after adding records before clicking verify. If verification fails on first attempt, wait up to 30 minutes and retry. The Resend and Loops dashboards can be re-triggered — look for a "Verify" or "Verify Records" button.

**Quick check before triggering verify:**
```bash
# Confirm Resend DKIM is resolvable
dig resend._domainkey.torchsecret.com TXT +short

# Confirm Resend SPF is resolvable
dig send.torchsecret.com TXT +short

# Confirm Loops SPF is resolvable
dig envelope.torchsecret.com TXT +short

# Confirm DMARC record is live
dig _dmarc.torchsecret.com TXT +short
```

If `dig` returns the expected values, it's safe to click verify.

---

### Pitfall 5: Cloudflare DMARC Management Wizard Interference

**What goes wrong:** Admin navigates to Email → DMARC Management in Cloudflare and uses the wizard to create the DMARC record. Cloudflare automatically appends its own `rua=` address to receive reports via Cloudflare's analytics service. The record becomes: `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com,mailto:xxxx@dmarc.cloudflare.net`.

**Why it happens:** Cloudflare DMARC Management is a paid analytics feature. The wizard enrolls the domain automatically.

**How to avoid:** Add the DMARC record as a plain TXT record via DNS (not via the DMARC Management wizard). Go to Websites → torchsecret.com → DNS → Records → Add record. This produces the exact record specified in the locked decision without Cloudflare modification.

**Warning signs:** After using the wizard, `dig _dmarc.torchsecret.com TXT +short` shows two rua= addresses, one at cloudflare.net.

---

### Pitfall 6: Gmail Delivers Test Email to Spam

**What goes wrong:** The Resend API test send to torch-secret@gmail.com lands in spam rather than inbox.

**Why it happens:** A freshly verified domain has no reputation history. Gmail may be conservative with new sender domains.

**How to avoid:** Send to torch-secret@gmail.com which already has a "Never send to Spam" Gmail filter from Phase 46 (the filter uses `deliveredto:` for Cloudflare-forwarded mail). However, the Resend test send is a direct SMTP delivery (not forwarded), so the Phase 46 filter may not apply. If it lands in spam: mark "Not spam" and resend — this trains Gmail.

**Additional mitigation:** Resend sends from authenticated SES infrastructure with DKIM signed. Gmail should honor DKIM-signed email from Resend post-verification.

---

## Code Examples

### DNS Verification Commands

Run after adding records to confirm correct propagation before clicking verify:

```bash
# Resend DKIM TXT — should return a "p=..." public key
dig resend._domainkey.torchsecret.com TXT +short

# Resend SPF on send subdomain — should return: "v=spf1 include:amazonses.com ~all"
dig send.torchsecret.com TXT +short

# Resend MX on send subdomain — should return: 10 feedback-smtp.us-east-1.amazonses.com
dig send.torchsecret.com MX +short

# Loops SPF on envelope subdomain — should return: "v=spf1 include:amazonses.com ~all"
dig envelope.torchsecret.com TXT +short

# Loops MX on envelope subdomain — should return: 10 feedback-smtp.us-east-1.amazonses.com
dig envelope.torchsecret.com MX +short

# Loops DKIM CNAMEs (replace loopsXXX with actual selector from Loops dashboard)
dig loopsXXX._domainkey.torchsecret.com CNAME +short

# DMARC record — should return: "v=DMARC1; p=none; rua=mailto:admin@torchsecret.com"
dig _dmarc.torchsecret.com TXT +short

# Apex @ SPF sanity check — must NOT show amazonses.com here
dig torchsecret.com TXT +short
# Expected output (Cloudflare Email Routing only): "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

### Resend API Test Send

```bash
# Replace YOUR_RESEND_API_KEY with actual key from Infisical
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer YOUR_RESEND_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Torch Secret <noreply@torchsecret.com>",
    "to": ["torch-secret@gmail.com"],
    "subject": "Resend domain verification test — noreply@torchsecret.com",
    "text": "This email confirms noreply@torchsecret.com is an authenticated sending address via Resend. Domain verification is complete."
  }'
```

Expected response (success):
```json
{"id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
```

Expected response (error — domain not yet verified):
```json
{"statusCode": 403, "message": "The 'noreply@torchsecret.com' from address is not allowed..."}
```

**Source:** Resend Send Email API reference — HIGH confidence

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| One SPF record at apex (@) for all senders | Subdomain SPF isolation per sender (send., envelope.) | RFC 7208 mandates one SPF per FQDN; subdomain isolation became standard practice for multi-provider stacks |
| Manually crafted DKIM keys | Provider-generated, account-bound DKIM keys (copy from dashboard) | Keys are tied to provider's signing infrastructure; self-generated keys not supported |
| DMARC p=reject from day one | p=none monitoring-first, graduate to p=quarantine after 30 days | p=reject with forwarding services (like Cloudflare Email Routing) breaks SPF alignment; p=none is the safe start |
| Single DKIM selector per provider | Loops uses 3 DKIM selectors per domain | Multiple selectors allow key rotation without downtime |

---

## Open Questions

1. **Exact Loops.so DKIM selector names**
   - What we know: Loops provides 3 DKIM CNAME records; their selector names (host prefixes) are account-generated and retrieved from Settings → Domain → View Records.
   - What's unclear: The exact selector format (e.g., `loops1._domainkey`, `loopsXXX._domainkey`, or a UUID-style prefix).
   - Recommendation: Read selector names from Loops dashboard at plan-execution time. The pattern is consistent (CNAME pointing to amazonaws.com) but the names are account-specific.

2. **Loops.so MX record exact value (region)**
   - What we know: Uses `feedback-smtp.{region}.amazonses.com` format; SPF is `include:amazonses.com`.
   - What's unclear: Whether the region shown in Loops dashboard matches `us-east-1` or another region.
   - Recommendation: Copy the MX value verbatim from Loops Settings → Domain → View Records. Do not guess the region.

3. **Whether Resend's "Send test" dashboard button supports custom From addresses**
   - What we know: Resend has a dashboard "Send test" feature. The locked decision says to use both the dashboard button AND a curl call.
   - What's unclear: Whether the dashboard Send test forces use of a Resend default address or allows noreply@torchsecret.com as the From.
   - Recommendation: Use the dashboard Send test button for a quick smoke test, then use the curl call to confirm noreply@torchsecret.com specifically works as the From address. The curl call is authoritative for RSND-01.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification only (zero-code phase — no automated test coverage applicable) |
| Config file | N/A |
| Quick run command | `dig resend._domainkey.torchsecret.com TXT +short` (confirms Resend DKIM propagated) |
| Full suite command | Manual: Resend dashboard "Verified" + Loops dashboard "Records present" + curl test send + Gmail inbox confirm |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSND-01 | Resend dashboard shows torchsecret.com Verified (DKIM + SPF + MX all green) | manual | `dig resend._domainkey.torchsecret.com TXT +short` (confirms DNS live) | N/A |
| RSND-01 | noreply@torchsecret.com delivers to external inbox via Resend | manual | `curl -X POST https://api.resend.com/emails ...` (see Code Examples) | N/A |
| LOOP-01 | Loops.so dashboard shows torchsecret.com Records present (green) | manual | `dig envelope.torchsecret.com TXT +short` (confirms Loops SPF live) | N/A |
| LOOP-02 | hello@torchsecret.com confirmed as sender address in Loops.so settings | manual | N/A — dashboard confirmation only | N/A |

### Sampling Rate

- **Per task:** `dig` checks for each new record type added
- **Per wave:** Full manual check — Resend dashboard status + Loops dashboard status
- **Phase gate:** All success criteria satisfied before `/gsd:verify-work`

### Wave 0 Gaps

None — this is a zero-code DNS configuration phase. No test files needed.

---

## Sources

### Primary (HIGH confidence)
- [Resend Cloudflare documentation](https://resend.com/docs/knowledge-base/cloudflare) — DKIM TXT name (`resend._domainkey`), SPF TXT at `send` subdomain, MX at `send` subdomain, DNS Only proxy requirement
- [Resend Domain Management](https://resend.com/docs/dashboard/domains/introduction) — verification states, per-record status display, domain lifecycle
- [Resend DMARC documentation](https://resend.com/docs/dashboard/domains/dmarc) — confirmed DMARC is NOT required for Resend "Verified" status; p=none monitoring recommendation
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email) — curl command format for test send
- [Loops.so Sending Domain docs](https://loops.so/docs/sending-domain) — SPF at `envelope` subdomain, 3 DKIM CNAMEs, MX at `envelope`, DNS Only requirement for CNAMEs
- [Cloudflare DMARC Management docs](https://developers.cloudflare.com/dmarc-management/security-records/) — wizard behavior and manual TXT alternative
- [Cloudflare DMARC learning](https://www.cloudflare.com/learning/dns/dns-records/dns-dmarc-record/) — DMARC TXT record format and `_dmarc` name convention
- Phase 46 STATE.md (project context) — SPF subdomain isolation pattern, DNS Only requirement for DKIM, no-FQDN rule for Cloudflare name fields — all confirmed and carry forward

### Secondary (MEDIUM confidence)
- [dmarc.wiki/resend](https://dmarc.wiki/resend) — confirmed Resend SPF value `v=spf1 include:amazonses.com ~all`, MX `feedback-smtp.us-east-1.amazonses.com`
- Third-party Loops.so guides (dmarcdkim.com, powerdmarc.com) — confirmed envelope subdomain for SPF, 3 DKIM CNAMEs, `include:amazonses.com` SPF value
- Cloudflare Community threads — DNS Only requirement for DKIM, propagation timing (5 min to 24h), resend._domainkey TXT format

### Tertiary (LOW confidence)
- Loops.so MX record region: assumed `us-east-1` based on SES pattern; must be confirmed from Loops dashboard

---

## Metadata

**Confidence breakdown:**
- Resend DNS record structure: HIGH — official Resend Cloudflare docs confirm all three record types, names, and values
- Loops.so DNS record structure: MEDIUM — SPF value, subdomain (envelope), and CNAME count (3) confirmed from official Loops docs; exact DKIM selector names are account-generated and must be read from dashboard
- DMARC record format: HIGH — standard RFC 7489 format confirmed from multiple authoritative sources
- Pitfalls (FQDN, proxy, RFC 7208): HIGH — derived from established Phase 46 patterns and official Cloudflare/RFC documentation
- Loops.so sender confirmation flow (LOOP-02): MEDIUM — From address is set in Settings → Domain in Loops; no separate per-address email verification required once domain is verified

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (6 months — DNS record formats are stable; Resend/Loops dashboard UI may change but record requirements are unlikely to change)
