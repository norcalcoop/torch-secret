# Phase 49: Gmail Send Mail As - Research

**Researched:** 2026-03-05
**Domain:** Gmail "Send mail as" with Resend SMTP relay — zero-code admin configuration
**Confidence:** HIGH (Gmail configuration procedure), HIGH (Resend SMTP credentials), MEDIUM (DKIM "via" banner elimination — functionally confirmed via prior Phase 48 evidence but not directly from Resend SMTP documentation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Phase scope
- Zero-code-changes phase: only Resend dashboard (API key creation) and Gmail Settings configuration. No application files, no Infisical env vars, no DNS changes.

#### SMTP relay configuration
- Server: smtp.resend.com, port 465 (SSL)
- Username: resend (literal string — Resend's SMTP protocol requires this)
- Password: the dedicated Resend API key created in this phase
- NOT smtp.gmail.com — that would send via Google's servers and add "via gappssmtp.com" banner
- NOT the production RESEND_API_KEY — separate key isolates Gmail relay from transactional email

#### Dedicated Resend API key
- Create a new Resend API key explicitly for Gmail SMTP relay use
- Name it clearly: "Gmail SMTP Relay" or similar, to distinguish from the production app key
- Restrict to sending domain: torchsecret.com only (not full account access)
- Store the key value securely (password manager) — it goes into Gmail SMTP password field and cannot be retrieved from Resend after creation

#### Display names per alias
- Use "Torch Secret" as the display name for all 7 aliases — consistent brand identity
- No role-specific suffixes ("Torch Secret Support", "Torch Secret Security") — brand consistency over granularity at this stage
- Display name is editable in Gmail later if the decision changes

#### Alias setup sequencing
- Add all 7 aliases in a single Gmail Settings session before clicking any verification links
- This triggers 7 verification emails arriving at torch.secrets@gmail.com simultaneously
- After all 7 are added, process the verification emails in batch — faster than 7 separate add/verify cycles
- Each verification email contains a confirmation code; enter it in Gmail Settings (or click the link)

#### Default outbound address
- Set hello@torchsecret.com as the default "Send mail as" address in Gmail
- Gmail's "Reply from the same address the message was sent to" setting should be enabled to ensure context-appropriate replies

#### Reply-to behavior
- No custom reply-to specified — default Gmail behavior: replies go to the alias address the email was sent from

#### Verification scope
- All 7 addresses must reach "verified" status in Gmail Settings before GMAI-02/GMAI-03 are complete
- Verify DKIM alignment on at least one address (hello@torchsecret.com — the default) using Gmail "Show original" to confirm "Signed by: torchsecret.com" and no "via gappssmtp.com"
- Remaining 6 addresses: verified status in Gmail Settings is sufficient

### Claude's Discretion
- Order in which the 7 aliases are added within the Gmail Settings session
- Whether to use the verification code entry method vs. clicking the emailed link (both work; code entry is faster if codes arrive quickly)
- How long to wait between adding all 7 and starting verification (usually seconds; Gmail sends immediately)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GMAI-01 | Admin can create a Resend API key dedicated to Gmail SMTP relay | Resend API key creation flow documented; restricted-by-domain option confirmed; key value shown only once at creation — plan must include save checkpoint |
| GMAI-02 | Admin can add all 7 business addresses to Gmail "Send mail as" using smtp.resend.com:465 with the Resend API key | Gmail Settings > Accounts and Import > Send mail as > Add another email address flow documented; all SMTP fields specified; port 465 + SSL confirmed as locked decision |
| GMAI-03 | Admin can verify all 7 Send mail as addresses in Gmail via Cloudflare-forwarded verification emails | Verification email flow documented; Phase 46 routing is live so all 7 verification emails will arrive at torch.secrets@gmail.com; code-entry and link-click both work |
| GMAI-04 | Admin can set hello@torchsecret.com as the default outbound address in Gmail | "Make default" option in Gmail Settings > Accounts and Import documented; "Reply from same address" toggle also identified |
</phase_requirements>

---

## Summary

Phase 49 is a pure admin configuration phase with two workstreams: (1) create a dedicated restricted Resend API key for SMTP relay use, and (2) add all 7 torchsecret.com business addresses to Gmail "Send mail as" using smtp.resend.com as the outbound SMTP server. No code changes, no DNS changes, no Infisical updates.

The technical premise is sound: when Resend's SMTP relay (smtp.resend.com:465) is used with a verified custom domain (torchsecret.com was verified in Phase 47), Resend signs outbound messages with `d=torchsecret.com` using the DKIM key at `resend._domainkey.torchsecret.com`. This produces `dkim=pass header.i=@torchsecret.com` in the Authentication-Results header, which Gmail surfaces as "Signed by: torchsecret.com" — eliminating the "via gappssmtp.com" indicator. The precedent for this DKIM signing behavior is already confirmed in Phase 48 STATE.md: Loops (also SES-backed) shows `dkim=pass header.i=@torchsecret.com`.

The key operational risk is the Resend API key: it is shown in plaintext only at creation time and cannot be retrieved afterward from the Resend dashboard. The plan must include an explicit "save the key to password manager" checkpoint before closing the Resend dashboard tab, and another checkpoint to paste it into Gmail SMTP password fields across all 7 alias configurations in the same session.

**Primary recommendation:** Create the API key first, save it immediately, then execute all 7 alias additions in a single Gmail Settings session using the batch-then-verify sequencing established in the CONTEXT.md decisions.

---

## Standard Stack

### What This Phase Uses

This is a zero-code phase. No libraries or npm packages are involved. The "stack" consists of two web dashboards and Gmail Settings.

| Tool | Access Point | Purpose |
|------|-------------|---------|
| Resend Dashboard | resend.com/api-keys | Create restricted API key for Gmail SMTP relay |
| Gmail Settings | mail.google.com → Settings → Accounts and Import | Add and verify 7 "Send mail as" aliases |
| torch.secrets@gmail.com | Gmail inbox | Receive 7 verification emails from Gmail |

### Resend SMTP Credentials (Confirmed)

| Field | Value | Source |
|-------|-------|--------|
| SMTP Host | `smtp.resend.com` | Resend docs (HIGH) |
| Port | `465` | Resend docs — SMTPS (Implicit SSL/TLS) (HIGH) |
| Encryption | SSL (not STARTTLS) | Port 465 = implicit SSL (HIGH) |
| Username | `resend` | Resend docs — literal string, not the API key (HIGH) |
| Password | The dedicated Resend API key created in GMAI-01 | Resend docs (HIGH) |

**Source:** [Resend SMTP documentation](https://resend.com/docs/send-with-smtp) — HIGH confidence

**Note on port alternatives:** Resend also supports ports 25, 587, 2465, 2587. Port 465 (SMTPS) is the locked decision and is the correct choice — Gmail's "Send mail as" supports SSL on port 465, and SSL is preferable over STARTTLS for this use case.

---

## Architecture Patterns

### End-to-End Flow

```
GMAI-01: Resend Dashboard
├── Navigate to API Keys → Create API Key
├── Name: "Gmail SMTP Relay"
├── Restrict to domain: torchsecret.com
├── Copy key value → password manager (KEY SHOWN ONCE)
└── Key is ready for Gmail SMTP password field

GMAI-02 + GMAI-03: Gmail Settings Session
├── Settings → See all settings → Accounts and Import → Send mail as
├── Add alias 1: hello@torchsecret.com
│   ├── Name: Torch Secret
│   ├── SMTP server: smtp.resend.com
│   ├── Port: 465
│   ├── Username: resend
│   ├── Password: [Resend API key from GMAI-01]
│   └── Security: SSL
├── [Repeat for aliases 2-7: contact, admin, info, support, security, privacy]
├── ← All 7 added; Gmail sends 7 verification emails simultaneously →
├── Open torch.secrets@gmail.com inbox
├── Open verification email 1 → copy code → return to Gmail Settings → enter code
└── [Repeat for verification emails 2-7]

GMAI-04: Set Default
├── In Accounts and Import → Send mail as
├── Click "make default" next to hello@torchsecret.com
└── Enable "Reply from the same address the message was sent to"
```

### Gmail Settings Navigation

```
Gmail → ⚙️ (top right) → See all settings
→ "Accounts and Import" tab
→ "Send mail as" section
→ "Add another email address"
```

The "Add another email address" dialog has two screens:
1. **Screen 1:** Name (display name), Email address — enter alias details, click "Next Step"
2. **Screen 2:** SMTP configuration — server, port, username, password, SSL option — click "Add Account"

After "Add Account," Gmail immediately sends a verification email to the alias address. Because Phase 46 is live, all 7 alias addresses forward to torch.secrets@gmail.com — verification emails will arrive there.

### Verification Email Flow

Gmail sends a verification email titled "Gmail Confirmation - Send Mail as..." to the alias address. Two options to complete verification:
1. **Click the confirmation link** in the email (opens a browser tab, confirms automatically)
2. **Copy the numeric code** from the email, return to Gmail Settings "Send mail as" section, click "Verify" next to the pending alias, enter the code in the popup

Option 2 (code entry) is faster for batch verification of 7 aliases — avoids managing 7 browser tabs.

**Source:** [Gmail Help — Send emails from a different address](https://support.google.com/mail/answer/22370?hl=en), [Auth-Email documentation](https://auth-email.com/documentation/creating-a-gmail-send-as-address) — HIGH confidence

### Gmail "Send mail as" Field Mapping

| Dialog Field | Value for all 7 aliases |
|-------------|------------------------|
| Name | Torch Secret |
| Email address | [alias]@torchsecret.com |
| SMTP Server | smtp.resend.com |
| Port | 465 |
| Username | resend |
| Password | [dedicated Resend API key] |
| Secured connection | SSL |

The alias addresses in order: hello, contact, admin, info, support, security, privacy

### DKIM Alignment Mechanism

When torchsecret.com is a verified domain in Resend (confirmed Phase 47), Resend signs all outbound emails — including those sent via SMTP relay — with `d=torchsecret.com` using the private key corresponding to the public key at `resend._domainkey.torchsecret.com`.

This produces `Authentication-Results` headers of the form:
```
dkim=pass header.i=@torchsecret.com header.s=resend
```

Gmail surfaces this as **"Signed by: torchsecret.com"** in the sender tooltip, with no "via gappssmtp.com" indicator — because the message was not routed through Gmail's servers for signing (it was relayed externally via Resend's SMTP, which signed it with the torchsecret.com DKIM key before delivery).

**Confidence:** MEDIUM-HIGH. The mechanism is logically derived from:
- Phase 47: torchsecret.com DKIM verified in Resend with key at `resend._domainkey.torchsecret.com`
- Phase 48 STATE.md: Loops (SES-backed, same signing model) confirmed `dkim=pass header.i=@torchsecret.com`
- Resend docs: "DKIM signature domain would instead match your sender domain exactly"
- General SMTP behavior: when external SMTP signs with matching From domain, Gmail shows "Signed by: [domain]" not "via [relay]"

The success criterion in GMAI-03 ("Signed by: torchsecret.com" confirmed via Gmail Show original) is the verification gate for this assumption.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMTP relay for Gmail | Set up a self-hosted Postfix/Sendmail relay | smtp.resend.com — already configured, domain already verified in Resend | Zero infrastructure to maintain; Resend handles deliverability, DKIM signing, and bounce processing |
| Custom domain DKIM signing in Gmail | Google Workspace DKIM key setup ($6+/user/month) | Resend SMTP relay with existing torchsecret.com verification | Phase 47 already established DKIM for torchsecret.com in Resend; no Google Workspace needed |
| Verification email routing | New Cloudflare routing rule for each alias | Phase 46 is already live — all 7 aliases forward to torch.secrets@gmail.com | The routing infrastructure was the hard prerequisite Phase 46 solved |
| Batch alias management API | Gmail API scripting | Manual Gmail Settings session | Only 7 aliases; one-time setup; manual is faster than scripting for this volume |

---

## Common Pitfalls

### Pitfall 1: Resend API Key Lost After Creation

**What goes wrong:** Admin creates the restricted API key in Resend, closes the creation dialog without copying the key, and discovers it cannot be retrieved from the Resend dashboard afterward. Must delete and recreate, which generates a new key that needs to be entered into all Gmail alias configurations.

**Why it happens:** Resend follows the security best practice of showing secret keys only once at creation. The dashboard shows only the key name and creation date afterward.

**How to avoid:** Immediately after clicking "Create" in Resend, copy the key to a password manager before doing anything else. Only proceed to Gmail Settings once the key is saved.

**Warning signs:** After closing the creation dialog, the key field shows masked characters — if you didn't copy it, it's gone.

---

### Pitfall 2: Wrong SMTP Username

**What goes wrong:** Admin enters the email address (hello@torchsecret.com) or the Resend account email as the SMTP username. Gmail returns an authentication error. Verification emails are never sent.

**Why it happens:** Most SMTP servers use the email address or account email as the username. Resend uses the literal string `resend` as the SMTP username for all customers — the API key in the password field identifies the account.

**How to avoid:** Enter exactly `resend` (lowercase, no @, no domain) in the SMTP Username field.

**Warning signs:** Gmail shows "Failed to add the email address" or "Username and password not accepted" after entering SMTP credentials.

---

### Pitfall 3: Port 465 Without SSL Selected

**What goes wrong:** Admin enters port 465 but selects TLS (STARTTLS) instead of SSL. The connection type doesn't match the port. Gmail may fail to connect or the connection may silently fall back to an unsecured connection.

**Why it happens:** Port 587 is the STARTTLS port; port 465 is the SMTPS (implicit SSL) port. Gmail's dialog has both port and security type fields, and it's easy to mismatch them.

**How to avoid:** Port 465 → select "SSL" (not TLS/STARTTLS). Port 587 → select "TLS". This phase uses port 465 + SSL (locked decision).

**Warning signs:** Gmail shows connection errors when testing the SMTP configuration.

---

### Pitfall 4: Verification Emails Not Arriving

**What goes wrong:** Admin adds all 7 aliases and waits for verification emails, but some or all verification emails don't appear in torch.secrets@gmail.com.

**Why it happens:**
- Gmail spam filter: verification emails from Gmail to a Gmail-derived alias can occasionally land in spam
- Cloudflare routing delay: forwarding adds a small delay (usually seconds, occasionally minutes)
- Gmail session issue: if the alias was added with incorrect SMTP credentials, Gmail may silently skip sending the verification

**How to avoid:**
1. Check the Spam folder in torch.secrets@gmail.com before waiting more than 5 minutes
2. Gmail typically sends all 7 verification emails within 30 seconds of each alias being added
3. If a verification email is missing after 5 minutes: in Gmail Settings, look for a "Resend verification" option next to the pending alias

**Warning signs:** Fewer verification emails than aliases added; some aliases remain in "pending" state after all others are verified.

---

### Pitfall 5: "via gappssmtp.com" Still Appears

**What goes wrong:** After completing alias setup, the admin sends a test email from hello@torchsecret.com via Gmail and sees "via gappssmtp.com" in the header tooltip, not "Signed by: torchsecret.com."

**Why it happens:** This would indicate the email was signed by Gmail's infrastructure rather than by Resend. Possible causes:
- Gmail Settings saved with smtp.gmail.com instead of smtp.resend.com (accidental use of Gmail SMTP)
- The alias was configured in Gmail Settings as "through Gmail" (no custom SMTP), which uses gappssmtp.com signing by default

**How to avoid:** Confirm smtp.resend.com is the saved SMTP server for each alias. In Gmail Settings → Accounts and Import → Send mail as, each alias should show "Send through smtp.resend.com" in its entry. If it shows "Send through Gmail," the SMTP was not configured — remove and re-add the alias with correct SMTP credentials.

**Warning signs:** Gmail "Show original" shows `dkim=pass header.i=@gappssmtp.com` instead of `header.i=@torchsecret.com`; sender tooltip shows "via gappssmtp.com."

---

### Pitfall 6: Default Address Not Set / Wrong Default

**What goes wrong:** After verifying all 7 aliases, the Gmail compose window defaults to torch.secrets@gmail.com (the underlying Gmail account) rather than hello@torchsecret.com.

**Why it happens:** Gmail keeps the original account address as default until explicitly changed. The "make default" step must be performed after aliases are verified.

**How to avoid:** After all 7 aliases show "verified" status, click "make default" next to hello@torchsecret.com in the Accounts and Import → Send mail as section.

**Warning signs:** Composing a new email shows the from address as torch.secrets@gmail.com instead of hello@torchsecret.com.

---

## Code Examples

### Resend API Key Restriction

When creating the API key in the Resend dashboard (resend.com/api-keys), the "Domain Access" field restricts the key to one domain. Select "torchsecret.com" (not "All domains"). This means the key can only be used to send from addresses at torchsecret.com — if it is ever leaked, the blast radius is limited to that domain.

The key permission level should be "Sending access" (not full account access).

### DKIM Alignment Verification Command

After completing alias setup and sending a test email from hello@torchsecret.com:

```bash
# Check DNS confirms DKIM public key is live
dig resend._domainkey.torchsecret.com TXT +short
# Expected: TXT record with "p=..." public key value (set in Phase 47)
```

For Gmail header inspection:
1. Open the sent test email in Gmail (check the recipient's Gmail inbox, or view in Sent folder)
2. Click the three-dot menu → "Show original"
3. In the raw headers, confirm:
   - `DKIM-Signature: v=1; a=rsa-sha256; d=torchsecret.com; s=resend; ...`
   - `Authentication-Results: ... dkim=pass header.i=@torchsecret.com`
4. In the Gmail UI (tooltip next to sender name), confirm:
   - "Signed by: torchsecret.com" is present
   - No "via gappssmtp.com" or "via smtp.resend.com" indicator

### Batch Verification Sequencing

The CONTEXT.md decision specifies adding all 7 aliases before verifying any. The recommended order:

**Phase 1 — Add all aliases (one session):**
```
Settings → Accounts and Import → Send mail as → Add another email address

Alias 1: hello@torchsecret.com    → Next → SMTP credentials → Add Account
Alias 2: contact@torchsecret.com  → Next → SMTP credentials → Add Account
Alias 3: admin@torchsecret.com    → Next → SMTP credentials → Add Account
Alias 4: info@torchsecret.com     → Next → SMTP credentials → Add Account
Alias 5: support@torchsecret.com  → Next → SMTP credentials → Add Account
Alias 6: security@torchsecret.com → Next → SMTP credentials → Add Account
Alias 7: privacy@torchsecret.com  → Next → SMTP credentials → Add Account
```

**Phase 2 — Verify all aliases (batch):**
```
Open torch.secrets@gmail.com inbox
Find 7 verification emails titled "Gmail Confirmation - Send Mail as..."
For each: open email → copy 9-digit code
Return to Gmail Settings → Send mail as → click "Verify" → enter code
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| smtp.gmail.com for Send mail as (gappssmtp signing) | smtp.resend.com (custom domain DKIM signing) | Using Gmail's own SMTP signs with gappssmtp.com, adding "via" banner; external SMTP with verified custom domain signs with your domain |
| Google Workspace for custom DKIM ($6/user/month) | Resend SMTP relay with verified domain (cost: covered by existing Resend plan) | Workspace DKIM requires paid subscription; Resend provides equivalent DKIM signing for verified domains at no extra cost |
| Individual alias add-then-verify cycle (7 separate cycles) | Batch add-all-then-verify-all (one session) | Batch approach avoids repeated SMTP credential entry and processes all verification emails efficiently |

---

## Open Questions

1. **Whether Resend restricts API keys by permission type beyond domain restriction**
   - What we know: Resend API keys can be restricted to specific domains; the plan calls for "torchsecret.com only"
   - What's unclear: Whether there is a separate "SMTP only" permission mode vs "full sending API access" on the key
   - Recommendation: At creation time, select the most restrictive permission set available. "Sending access" (vs "Full access") is sufficient for SMTP relay — select it if present.

2. **Exact Gmail dialog behavior when entering port 465 + SSL**
   - What we know: Gmail "Send mail as" supports external SMTP with port 465 and SSL; this is the locked configuration
   - What's unclear: Whether Gmail's dialog auto-selects SSL when 465 is entered, or requires manual selection
   - Recommendation: Explicitly verify the SSL checkbox/dropdown is set to SSL after entering port 465 — do not assume auto-detection.

3. **Whether the "Reply from the same address" setting is global or per-alias**
   - What we know: Gmail has a "Reply from the same address the message was sent to" toggle in Accounts and Import
   - What's unclear: Exact location of this toggle (may be "When replying to a message" section, not "Send mail as" section)
   - Recommendation: Look for this setting in Gmail Settings → Accounts and Import, near the "Send mail as" section. It is typically a global toggle. Enable it.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification only (zero-code phase — no automated test coverage applicable) |
| Config file | N/A |
| Quick run command | `dig resend._domainkey.torchsecret.com TXT +short` (confirms DKIM DNS is still live from Phase 47) |
| Full suite command | Manual: all 7 aliases show "verified" in Gmail Settings + DKIM spot-check on hello@torchsecret.com via Gmail "Show original" |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GMAI-01 | Dedicated Resend API key exists, restricted to torchsecret.com domain | manual | N/A — Resend dashboard confirmation only | N/A |
| GMAI-02 | All 7 aliases appear in Gmail Settings Send mail as with smtp.resend.com as SMTP server | manual | N/A — Gmail UI verification | N/A |
| GMAI-03 | All 7 aliases show "verified" status in Gmail Settings | manual | N/A — Gmail UI verification | N/A |
| GMAI-03 | hello@torchsecret.com shows "Signed by: torchsecret.com", no "via gappssmtp.com" | manual | `dig resend._domainkey.torchsecret.com TXT +short` (confirms DKIM key live) | N/A |
| GMAI-04 | hello@torchsecret.com is the default outbound address; new compose window shows it | manual | N/A — Gmail UI verification | N/A |

### Sampling Rate

- **Per task:** Check Gmail Settings after each step to confirm expected state
- **Per wave:** Full manual check — all 7 verified + DKIM spot check + default address confirmed
- **Phase gate:** All 4 GMAI requirements satisfied before `/gsd:verify-work`

### Wave 0 Gaps

None — zero-code configuration phase. No test files needed.

---

## Sources

### Primary (HIGH confidence)
- [Resend SMTP documentation](https://resend.com/docs/send-with-smtp) — hostname (smtp.resend.com), port options (465/587/25/2465/2587), username (literal "resend"), password (API key), SSL vs STARTTLS behavior
- [Gmail Help — Send emails from a different address or alias](https://support.google.com/mail/answer/22370?hl=en) — "Add another email address" navigation path, verification email flow, code entry procedure
- Phase 47 RESEARCH.md — Resend DKIM TXT record structure at `resend._domainkey.torchsecret.com`, verification already complete
- Phase 48 STATE.md — confirmed `dkim=pass header.i=@torchsecret.com` for Loops (SES-backed, same signing model), establishing the precedent for Resend DKIM signing domain behavior

### Secondary (MEDIUM confidence)
- [Auth-Email documentation — creating a Gmail send as address](https://auth-email.com/documentation/creating-a-gmail-send-as-address) — Gmail dialog fields, port 465 + SSL confirmed, verification code/link options
- [dmarc.wiki — Resend](https://dmarc.wiki/resend) — confirms Resend supports custom DKIM signature domains for DMARC alignment
- [Resend blog — Email Authentication](https://resend.com/blog/email-authentication-a-developers-guide) — "DKIM signature domain would instead match your sender domain exactly" when domain is verified
- [GMass — Proof of external SMTP with Gmail Send mail as](https://www.gmass.co/blog/send-from-gmail-through-external-smtp-server/) — confirms Gmail allows external SMTP for Send mail as; "via [provider]" appears when provider signs with own domain (not eliminated when provider signs with customer domain)

### Tertiary (LOW confidence)
- General WebSearch results on Gmail "via" banner elimination — multiple sources confirm "via" banner disappears when DKIM d= matches From domain; specific confirmation for smtp.resend.com path requires the GMAI-03 spot check to validate at execution time

---

## Metadata

**Confidence breakdown:**
- Resend SMTP credentials (host/port/username/password): HIGH — official Resend docs
- Gmail "Send mail as" procedure (navigation, fields, verification): HIGH — official Gmail Help + multiple corroborating sources
- DKIM alignment elimination of "via" banner via smtp.resend.com: MEDIUM — logically derived from Phase 47/48 evidence; validated by GMAI-03 success criterion at execution time
- API key restriction behavior (domain-scoped): HIGH — established from Resend domain verification docs

**Research date:** 2026-03-05
**Valid until:** 2026-09-05 (6 months — Gmail UI may change; SMTP credentials and DKIM behavior are stable)
