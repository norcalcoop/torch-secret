# Phase 46: Cloudflare Email Routing - Research

**Researched:** 2026-03-04
**Domain:** Cloudflare Email Routing — dashboard configuration, DNS records, destination verification
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Routing destination
- All 7 addresses forward to the single destination: torch-secret@gmail.com
- No per-address differentiation — one inbox receives all inbound business email

#### Addresses to configure
- hello, contact, admin, info, support, security, privacy — exactly these 7
- No catch-all rule this phase (explicitly deferred to EOPS-03 in REQUIREMENTS.md)

#### Verification scope
- Verify all 7 routing rules show "Active" status in the Cloudflare Email Routing dashboard
- Send a real external test email to hello@torchsecret.com and confirm it arrives in torch-secret@gmail.com
- Send a real external test email to security@torchsecret.com and confirm it arrives
- The remaining 5 addresses: confirm Active status is sufficient per success criteria (no additional test emails required unless Active verification fails)

#### DNS transition
- Before enabling Email Routing, check for and document any existing MX records at torchsecret.com
- If existing MX records are found (e.g., Google Workspace, Zoho, other), they must be removed before Cloudflare Email Routing MX records are added — conflicting MX records cause silent routing failures
- Cloudflare Email Routing adds its own MX records automatically when enabled — do not add Cloudflare MX records manually

#### Enable sequence
- Enable Cloudflare Email Routing on the domain first, then add all 7 routing rules in a single session
- All 7 rules are simple "route to email" type (not workers, not drop, not custom) — batch all in one session

### Claude's Discretion
- Order in which the 7 routing rules are added (any order is fine)
- How to source an external test email address (any non-torchsecret.com account: Gmail, Fastmail, etc.)
- Whether to test from the same session or use a separate device/incognito window

### Deferred Ideas (OUT OF SCOPE)
- Catch-all address for unmapped torchsecret.com addresses — EOPS-03, future phase
- DMARC monitoring rua= pointing to dmarc@torchsecret.com — Phase 47 (DMARC record setup)
- DMARC policy progression from p=none to p=quarantine — EOPS-02, post-30-day monitoring
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EROT-01 | Admin can route all 7 business addresses (hello, contact, admin, info, support, security, privacy) at torchsecret.com to torch-secret@gmail.com via Cloudflare Email Routing | Dashboard flow documented: Enable routing → verify destination → create 7 routing rules |
| EROT-02 | Admin can verify forwarding works for each address by sending a test email | Verification approach documented: external sender → hello@ and security@; remaining 5 confirmed by Active status |
</phase_requirements>

---

## Summary

This is a zero-code phase: configure Cloudflare Email Routing entirely through the Cloudflare dashboard to forward 7 business email addresses to torch-secret@gmail.com. The setup involves two distinct concepts: (1) a **destination address** (torch-secret@gmail.com) that must be verified once by clicking a verification link Cloudflare emails to it, and (2) **routing rules** (one per custom address) that link each @torchsecret.com address to that verified destination. All 7 routing rules can share the same verified destination.

DNS check (confirmed via live `dig` query): torchsecret.com currently has **no MX records and no TXT records at the apex**. This is a clean slate — no existing email service conflicts, no need to delete records before enabling Email Routing. Cloudflare Email Routing will add its MX records and SPF TXT record automatically when enabled.

The main operational risk is the Gmail spam/spam-folder issue for forwarded mail. Cloudflare's SRS envelope rewriting can cause Gmail's spam filter to flag forwarded messages. This is a known, documented issue but is mitigated by a simple Gmail filter ("Never send to Spam" for emails arriving at the forwarding destination). Phase 49 (Gmail Send Mail As) depends on this phase being complete — Gmail sends a verification email to each alias address, which must traverse this forwarding pipeline.

**Primary recommendation:** Enable Cloudflare Email Routing → verify destination torch-secret@gmail.com → create 7 routing rules in one session → create Gmail "Never send to Spam" filter → send test emails to hello@ and security@ from an external account.

---

## Standard Stack

### What Cloudflare Email Routing Is

Cloudflare Email Routing is a free email forwarding service available to all Cloudflare customers using Cloudflare as the authoritative nameserver. It creates a forwarding layer — it is NOT an SMTP server and cannot send outbound email. It only receives inbound mail and forwards it to a verified destination.

Source: [Cloudflare Email Routing Overview](https://developers.cloudflare.com/email-routing/) — HIGH confidence

### Key Concepts

| Concept | Definition |
|---------|-----------|
| **Destination address** | The email inbox that receives forwarded mail (torch-secret@gmail.com). Account-level resource — shared across all domains in the account. Must be verified by clicking a link Cloudflare emails to it. |
| **Custom address** | The @torchsecret.com address that receives inbound mail (e.g., hello@torchsecret.com). Defined per-domain. |
| **Routing rule** | A pair: custom address + action. Action is "Route to" + a verified destination address. |
| **Active status** | A routing rule whose destination address has been verified. Mail sent to this custom address will be forwarded. |
| **Pending status** | The destination address has not yet been verified. No mail is forwarded until destination is verified. |

### DNS Records Added Automatically

Cloudflare Email Routing adds these records automatically when enabled:

**MX records (3, added to apex @):**

| Priority | Value |
|----------|-------|
| 13 | amir.mx.cloudflare.net |
| 24 | linda.mx.cloudflare.net |
| 86 | isaac.mx.cloudflare.net |

**SPF TXT record (added to apex @):**
```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

The `_spf.mx.cloudflare.net` include resolves to `v=spf1 ip4:104.30.0.0/20 ~all`.

Source: [Cloudflare Email Routing Postmaster](https://developers.cloudflare.com/email-routing/postmaster/) — HIGH confidence

**CRITICAL:** Do NOT add these records manually. Cloudflare adds them automatically when Email Routing is enabled. Manual additions cause duplicates.

---

## Architecture Patterns

### Dashboard Navigation Path

```
Cloudflare Dashboard
  → Select account
  → Websites → select torchsecret.com zone
  → Email (left sidebar, below DNS)
  → Email Routing
  → Routing rules
```

If "Email" tab does not appear in the left sidebar, the zone must be using Cloudflare as authoritative nameserver (it is for torchsecret.com).

### Enable Sequence (Correct Order)

**Step 1: Pre-check DNS**
Before enabling Email Routing, run `dig MX torchsecret.com` and `dig TXT torchsecret.com`. Document any existing records.

*Research finding: torchsecret.com currently has NO MX records and NO TXT records at the apex (confirmed 2026-03-04). Clean slate — no conflicts.*

**Step 2: Enable Email Routing**
Navigate to Email > Email Routing. Cloudflare presents a setup wizard or "Get started" button. Review the DNS records Cloudflare proposes to add (3 MX + 1 SPF TXT). Click "Add records and enable."

If existing MX records are detected: Cloudflare prompts to delete them first. Accept the deletion — it is safe in this case since torchsecret.com has no existing email service.

**Step 3: Verify destination address**
Navigate to "Destination addresses" tab. Add torch-secret@gmail.com. Cloudflare sends a verification email to torch-secret@gmail.com. **Check inbox AND spam folder.** Click "Verify email address" in the email. Status changes to "Verified."

**CRITICAL:** All routing rules are automatically disabled ("Pending") until this destination verification is complete. Destination verification must happen before creating routing rules, or the rules cannot be saved pointing to an unverified destination. (Alternatively: create rules while destination is pending — they will activate automatically once destination is verified.)

**Step 4: Create 7 routing rules**
Navigate to "Routing rules" tab. For each address:
1. Click "Create address"
2. In "Custom address" field: enter only the prefix (e.g., `hello`) — Cloudflare appends `@torchsecret.com` automatically
3. In "Action" dropdown: select "Send to"
4. In "Destination" field: select `torch-secret@gmail.com` (already verified)
5. Save

Repeat for: hello, contact, admin, info, support, security, privacy.

**Step 5: Configure Gmail spam filter**
In Gmail (torch-secret@gmail.com), create a filter:
- Matches: `deliveredto:hello@torchsecret.com OR deliveredto:contact@torchsecret.com OR deliveredto:admin@torchsecret.com OR deliveredto:info@torchsecret.com OR deliveredto:support@torchsecret.com OR deliveredto:security@torchsecret.com OR deliveredto:privacy@torchsecret.com`
- Action: "Never send it to Spam"

This prevents Gmail's spam filter from discarding forwarded mail from Cloudflare's relay IPs.

**Step 6: Send test emails**
From an external non-torchsecret.com email account (e.g., personal Gmail, Fastmail):
- Send one email to hello@torchsecret.com
- Send one email to security@torchsecret.com
- Confirm both arrive in torch-secret@gmail.com (check inbox and spam)

**Step 7: Confirm Active status for all 7**
Return to Cloudflare Email Routing → Routing rules. Confirm all 7 rules show "Active" status.

### What "Active" vs "Pending" Actually Means

The status on a **routing rule** reflects whether the associated destination address is verified:

| Rule Status | Meaning |
|-------------|---------|
| Active | Destination address is verified; mail is forwarded |
| Pending | Destination address not yet verified; mail is dropped |

All 7 routing rules share one destination (torch-secret@gmail.com). Once that destination is verified, all 7 rules become Active simultaneously. There is no per-rule verification — the verification is on the destination address, not on each custom address.

Source: [Configure rules and addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/) — HIGH confidence

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MX record values for Cloudflare routing | Manual DNS research | Cloudflare auto-adds them on enable | Cloudflare adds exactly the right records; manual entry causes duplicates |
| SPF record for inbound forwarding | Writing custom SPF | Cloudflare auto-adds `v=spf1 include:_spf.mx.cloudflare.net ~all` | Auto-added; do not write your own |
| Email forwarding logic | Custom worker | Simple "Route to" rule in dashboard | Workers are for conditional logic only; 7 identical-destination rules need no code |
| Spam prevention | Cloudflare-side filtering | Gmail "Never send to Spam" filter | Cloudflare does SRS rewriting; Gmail filter is the correct mitigation layer |

---

## Common Pitfalls

### Pitfall 1: Destination Not Verified Before Creating Rules

**What goes wrong:** You create routing rules before verifying the destination address. The rules show "Pending" and mail is silently dropped.

**Why it happens:** The Cloudflare UI allows creating rules pointing to an unverified destination, but the rule won't activate until the destination is verified.

**How to avoid:** Add the destination address first in the "Destination addresses" tab, verify it by clicking the email link, then create routing rules. Alternatively: create rules first — they will activate automatically once verification completes.

**Warning signs:** All 7 rules show "Pending" in the dashboard. No test emails arrive.

### Pitfall 2: Verification Email Lands in Gmail Spam

**What goes wrong:** Cloudflare sends the destination verification email to torch-secret@gmail.com, but Gmail marks it as spam. You never see it. The destination stays "Pending."

**Why it happens:** Cloudflare's verification email originates from cloudflare.com infrastructure. Gmail spam filters can flag it, especially for new accounts.

**How to avoid:** Immediately after adding the destination, check both inbox AND spam in Gmail. Allow emails from noreply@cloudflare.com. Use "Resend email" in the Cloudflare dashboard if the first attempt is not received within 2-3 minutes.

**Warning signs:** Status shows "Pending" after 5+ minutes with no email in inbox.

**Rate limit note:** Cloudflare enforces a rate limit on resending verification emails (Error Code 2025: "Verification email has been sent too recently"). Wait a few minutes before requesting another resend.

### Pitfall 3: Forwarded Business Emails Land in Gmail Spam

**What goes wrong:** After routing is active, real emails sent to @torchsecret.com addresses arrive in torch-secret@gmail.com spam folder rather than inbox.

**Why it happens:** Cloudflare uses SRS (Sender Rewriting Scheme) to rewrite the MAIL FROM envelope address. Gmail's spam filter associates this pattern with forwarding services that carry spam. This is a known, ongoing issue with Cloudflare Email Routing → Gmail forwarding.

**How to avoid:** Create a Gmail filter BEFORE sending test emails: `deliveredto:hello@torchsecret.com OR deliveredto:contact@torchsecret.com OR ...` with action "Never send it to Spam."

**Warning signs:** Test email sent to hello@torchsecret.com appears in Gmail spam rather than inbox.

### Pitfall 4: Manually Adding Cloudflare MX Records

**What goes wrong:** You try to add the Cloudflare MX records manually in DNS before or alongside enabling Email Routing. The dashboard detects duplicates and blocks activation.

**Why it happens:** Some guides show the MX record values without clarifying they are auto-added.

**How to avoid:** Click "Add records and enable" in the Email Routing wizard. Do not add amir/linda/isaac.mx.cloudflare.net records manually.

**Warning signs:** "Duplicate Zone rules" error during Email Routing setup.

### Pitfall 5: Conflicting Existing MX Records

**What goes wrong:** If torchsecret.com had existing MX records (Google Workspace, Zoho, etc.) and you don't delete them, Email Routing cannot be enabled.

**How to avoid:** Pre-check with `dig MX torchsecret.com`. Accept Cloudflare's prompt to delete any existing MX records.

**Research finding:** torchsecret.com currently has NO existing MX records (confirmed 2026-03-04 via live DNS query). This pitfall does not apply for this phase.

### Pitfall 6: Custom Address Field Appends Domain Automatically

**What goes wrong:** You enter `hello@torchsecret.com` in the custom address field instead of just `hello`. Cloudflare rejects it or creates a malformed rule.

**How to avoid:** Enter only the prefix in the custom address field. Cloudflare shows the `@torchsecret.com` suffix separately and appends it automatically.

---

## Code Examples

This is a zero-code phase. All configuration is through the Cloudflare dashboard. No scripts, no API calls, no application changes.

### Pre-flight DNS Check Commands

Run these before enabling Email Routing to confirm clean state:

```bash
# Check for existing MX records
dig MX torchsecret.com +short

# Check for existing TXT/SPF records
dig TXT torchsecret.com +short

# Expected output for clean state: empty (no output)
```

### Post-configuration Verification Commands

```bash
# Confirm Cloudflare MX records are live
dig MX torchsecret.com +short
# Expected:
# 13 amir.mx.cloudflare.net.
# 24 linda.mx.cloudflare.net.
# 86 isaac.mx.cloudflare.net.

# Confirm Cloudflare SPF TXT record is live
dig TXT torchsecret.com +short
# Expected (contains):
# "v=spf1 include:_spf.mx.cloudflare.net ~all"
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Manual MX record configuration | Cloudflare auto-adds MX records on enable | Has been automatic since Email Routing launch |
| Per-address destination verification | Destination verified once, shared across all rules | Destination is account-level, reusable across all rules and domains |
| DMARC p=reject with forwarding | DMARC p=none or p=quarantine maximum | Cloudflare SRS breaks SPF alignment under p=reject — p=reject is explicitly out of scope (see REQUIREMENTS.md) |

**July 2025 change (MEDIUM confidence):** Cloudflare began enforcing that inbound messages must be authenticated with SPF or DKIM before being forwarded. Unauthenticated mail is rejected rather than forwarded. This reduces spam forwarded to destination inboxes but does not affect legitimate business email.

Sources: Spam Resource blog (SpamResource.com, 2025-07); community verification incomplete.

---

## Open Questions

1. **Does torch-secret@gmail.com have any prior Cloudflare email history?**
   - What we know: If torch-secret@gmail.com was previously used with Cloudflare and ever unsubscribed from or marked a Cloudflare email as spam, it may be on Cloudflare's suppression list.
   - What's unclear: Current suppression list status.
   - Recommendation: If the verification email does not arrive within 3 minutes, check the Destination addresses tab for a "Resend email" option. If still blocked, Cloudflare support can remove the address from the suppression list.

2. **Will the Gmail spam filter issue affect verification email delivery?**
   - What we know: Cloudflare verification emails can land in Gmail spam.
   - What's unclear: Current Gmail spam aggressiveness for Cloudflare sender domains.
   - Recommendation: Immediately after adding the destination, check spam folder in Gmail before concluding the email was not received.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification only (zero-code phase — no automated test coverage applicable) |
| Config file | N/A |
| Quick run command | `dig MX torchsecret.com +short` (DNS confirmation) |
| Full suite command | Manual: send test emails + confirm Active status + check Gmail inbox |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EROT-01 | All 7 routing rules exist and show Active status in Cloudflare dashboard | manual | `dig MX torchsecret.com +short` (confirms routing enabled) | N/A |
| EROT-02 | External email to hello@torchsecret.com arrives in torch-secret@gmail.com | manual | N/A — requires live email send from external account | N/A |
| EROT-02 | External email to security@torchsecret.com arrives in torch-secret@gmail.com | manual | N/A — requires live email send from external account | N/A |

### Sampling Rate

- **Per task:** `dig MX torchsecret.com +short` — confirms DNS records are live
- **Per wave:** Full manual test: send emails to hello@ and security@ from external account, confirm delivery
- **Phase gate:** All 7 rules Active + 2 test emails confirmed delivered before `/gsd:verify-work`

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements (manual verification only; no test files needed for a zero-code DNS configuration phase).

---

## Sources

### Primary (HIGH confidence)
- [Cloudflare Email Routing Overview](https://developers.cloudflare.com/email-routing/) — feature capabilities, free tier availability
- [Enable Email Routing](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/) — step-by-step enable flow, DNS auto-add behavior, MX conflict handling
- [Configure Rules and Addresses](https://developers.cloudflare.com/email-routing/setup/email-routing-addresses/) — custom address creation, destination verification, Active/Pending status
- [Cloudflare Email Routing Postmaster](https://developers.cloudflare.com/email-routing/postmaster/) — exact MX record values (amir/linda/isaac priorities 13/24/86), SPF record value, SRS explanation
- Live DNS query for torchsecret.com — confirmed no existing MX or TXT records (2026-03-04)

### Secondary (MEDIUM confidence)
- [Cloudflare Community: Pending verification email](https://community.cloudflare.com/t/pending-verification-email-when-adding-a-new-routing-destination-address/448896) — destination verification flow, suppression list issue, resend procedure
- [Cloudflare Community: Email routing to gmail blocked as spam](https://community.cloudflare.com/t/email-routing-to-gmail-blocked-as-spam/422232) — Gmail spam filter issue, "Never send to Spam" filter workaround
- [Cloudflare Community: Duplicate Zone rules error](https://community.cloudflare.com/t/email-routing-setup-stuck-with-duplicate-zone-rules-error/884308) — manual MX record conflict pitfall
- [Cloudflare SPF Troubleshooting](https://developers.cloudflare.com/email-routing/troubleshooting/email-routing-spf-records/) — multiple SPF record prohibition

### Tertiary (LOW confidence)
- Spam Resource (spamresource.com, July 2025) — Cloudflare new authentication enforcement for inbound forwarding; partial content, not fully verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Cloudflare is the authoritative source; documentation confirmed via direct fetch
- Architecture: HIGH — enable sequence and Active/Pending semantics confirmed from official docs
- Pitfalls: HIGH — Gmail spam issue and verification pitfalls documented across multiple official community threads
- DNS state (torchsecret.com): HIGH — confirmed via live `dig` query at research time

**Research date:** 2026-03-04
**Valid until:** 2026-09-04 (6 months — Cloudflare Email Routing is a stable, mature product; dashboard flow unlikely to change significantly)
