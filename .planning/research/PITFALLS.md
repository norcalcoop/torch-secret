# Pitfalls Research

**Domain:** Business email infrastructure — Cloudflare Email Routing + Resend custom domain + Loops.so domain auth + Gmail "Send mail as"
**Researched:** 2026-03-03
**Confidence:** HIGH (Cloudflare, Resend, Loops official docs verified; Gmail behavior verified via multiple sources)

---

## Critical Pitfalls

### Pitfall 1: Cloudflare Email Routing Deletes All Existing MX Records

**What goes wrong:**
When you click "Enable Email Routing" in the Cloudflare dashboard, Cloudflare detects any existing MX records and presents a prompt asking if you want to delete them. If you click yes without understanding the consequence, all prior MX configuration is gone. Worse: **Email Routing will not enable unless you delete existing MX records.** There is no "run alongside" option. The official docs state: "When Email Routing is configured and running, no other email services can be active in the domain you are configuring."

**Why it happens:**
Developers assume Email Routing is additive — that it just adds Cloudflare's MX alongside existing ones. It isn't. It requires exclusive MX ownership of the apex domain.

**How to avoid:**
Screenshot or export every existing MX record before touching Email Routing. For torchsecret.com, Loops.so requires MX records on the `envelope.torchsecret.com` subdomain for bounce handling — these live on a *subdomain*, not on the apex domain, so they will NOT conflict with Cloudflare Email Routing (which only controls the apex `torchsecret.com` MX). Verify this is the case before proceeding. If any MX record is on the apex domain for another service, resolve that conflict first.

**Warning signs:**
- Cloudflare dashboard shows "Email Routing requires removing these MX records" during setup
- Existing email service (Loops, external mail host) stops working after enabling Email Routing

**Phase to address:**
DNS setup phase — must be the first step before any other DNS changes.

---

### Pitfall 2: Cloudflare Blocks Multiple SPF Records (Two SPF TXT Records = PermError)

**What goes wrong:**
After enabling Email Routing, Cloudflare adds its own SPF TXT record at the apex: `v=spf1 include:_spf.mx.cloudflare.net ~all`. If your domain already has an SPF record, you now have two SPF TXT records on the same apex label. RFC 7208 forbids multiple SPF records — receiving servers return a `PermError` and may reject or spam-classify all email from your domain.

Cloudflare's Email Routing dashboard will display a warning and may refuse to activate if it detects multiple SPF records.

**Why it happens:**
Developers add each email service's SPF independently, not realizing they must all be merged into one single TXT record on the apex.

**How to avoid:**
Merge all SPF includes into one record before or immediately after enabling Email Routing:

```
v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
```

`_spf.mx.cloudflare.net` covers Cloudflare Email Routing inbound forwarding.
`amazonses.com` covers both Resend and Loops (both route outbound through Amazon SES infrastructure).

Important nuance: Resend places its SPF on the `send.torchsecret.com` subdomain (not the apex), and Loops places its SPF on the `envelope.torchsecret.com` subdomain. Neither adds to the apex SPF record. Only Cloudflare Email Routing touches the apex SPF. Confirm this before merging.

**Warning signs:**
- Cloudflare Email Routing dashboard shows "Multiple SPF records detected"
- Email deliverability tools (MXToolbox, mail-tester.com) report `SPF PermError`
- Emails to Gmail land in spam even though DKIM passes

**Phase to address:**
DNS setup phase, immediately after enabling Cloudflare Email Routing.

---

### Pitfall 3: Resend DKIM CNAME Records Set to Proxied (Orange Cloud) in Cloudflare

**What goes wrong:**
When adding Resend's DKIM record in Cloudflare DNS, the record type is CNAME with name `resend._domainkey`. If the Cloudflare proxy toggle is left ON (orange cloud), Cloudflare intercepts the CNAME lookup and returns its own IP instead of delegating to Resend's DKIM key infrastructure. Receiving mail servers cannot resolve the public key, DKIM verification fails, and Resend dashboard shows the domain as "Not Verified" indefinitely. Cloudflare also returns error Code 1004 when you attempt to save a proxied CNAME for email records.

**Why it happens:**
Cloudflare defaults new CNAME records to proxied. The email-specific DNS records are not web traffic, but Cloudflare does not distinguish automatically.

**How to avoid:**
When entering the Resend DKIM CNAME in Cloudflare, explicitly set proxy status to **DNS Only** (grey cloud icon). Same applies to all three Loops.so DKIM CNAME records. Never proxy DKIM, SPF TXT, or MX records.

Also: when pasting values from Resend dashboard into Cloudflare, **omit the apex domain from the record name**. Cloudflare appends it automatically. Enter `resend._domainkey` not `resend._domainkey.torchsecret.com`. Entering the full FQDN creates a duplicate-domain record that fails silently.

**Warning signs:**
- Resend domain dashboard shows "Pending" or "Failed" after 30+ minutes
- `dig CNAME resend._domainkey.torchsecret.com` resolves to Cloudflare IPs instead of Resend's infrastructure
- Cloudflare throws error 1004 when saving the record

**Phase to address:**
Resend domain verification phase.

---

### Pitfall 4: DMARC Policy Deployed at p=reject Before All Senders Are Verified

**What goes wrong:**
Setting `p=reject` in the DMARC record before Resend and Loops.so DKIM records are fully propagated and verified causes legitimate transactional emails (secret-viewed notifications, Better Auth password reset/verification, onboarding sequences) to be permanently rejected by receiving mail servers. Users never receive the email. The damage is silent — no bounce comes back to the application because rejection happens at the receiving server's policy evaluation layer.

**Why it happens:**
Developers read that p=reject is the "correct" final state and deploy it immediately. They don't realize DMARC enforcement acts on any email that fails DKIM/SPF alignment — including their own emails if DNS changes haven't propagated yet.

**How to avoid:**
Deploy DMARC in three phases with monitoring time between each:

1. **Day 0 (DNS setup):** `v=DMARC1; p=none; rua=mailto:dmarc@torchsecret.com`
2. **After 2-4 weeks of clean RUA reports:** `v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@torchsecret.com`
3. **After another 2-4 weeks:** `v=DMARC1; p=reject; rua=mailto:dmarc@torchsecret.com`

The `rua` address must be a real mailbox that can receive XML reports (daily, gzip-compressed). Set up `dmarc@torchsecret.com` as a Cloudflare Email Routing destination forwarding to the Gmail inbox first, so DMARC reports actually arrive.

**Warning signs:**
- Resend or Loops sending logs show delivery success but users report no emails received
- DMARC RUA reports show high `dkim=fail` or `spf=fail` counts shortly after DNS changes
- MXToolbox DMARC check shows `p=reject` but DKIM is not yet "Verified" in Resend dashboard

**Phase to address:**
DMARC setup — must be last in the DNS sequence, after DKIM/SPF for all senders are confirmed working.

---

### Pitfall 5: Gmail "Send Mail As" via smtp.gmail.com Produces "via gappssmtp.com" Banner

**What goes wrong:**
When using Gmail's "Send mail as" with `smtp.gmail.com` as the SMTP relay (the most commonly documented approach), emails sent from `hello@torchsecret.com` display a "via gappssmtp.com" secondary header in Gmail recipients' clients. This banner signals that the email was not sent directly from torchsecret.com's mail infrastructure, which undermines trust for a security-focused product.

Additionally, emails sent this way are signed with `d=*.gappssmtp.com` DKIM, not `d=torchsecret.com`. If DMARC strict alignment is later enabled, these emails fail DMARC.

**Why it happens:**
`smtp.gmail.com` signs with Google's own DKIM key, not your domain's key. Google cannot use your `resend._domainkey.torchsecret.com` private key because Google doesn't have it.

**How to avoid:**
Use **`smtp.resend.com`** as the SMTP relay for Gmail "Send mail as", not `smtp.gmail.com`. Resend's SMTP server signs outgoing mail with your verified `resend._domainkey.torchsecret.com` DKIM key, so the DKIM signature is aligned with your From domain and no "via" banner appears.

Resend SMTP credentials:
- Host: `smtp.resend.com`
- Port: 465 (SSL/TLS) or 587 (STARTTLS)
- Username: `resend` (literal string, not your email address)
- Password: A Resend API key (create a restricted key with Send access only — do not reuse the production `RESEND_API_KEY` from Infisical)

Gmail requires a verification email when adding "Send mail as." Cloudflare Email Routing must already be active and forwarding `hello@torchsecret.com` to `torch.secrets@gmail.com` before this verification email can be received.

**Warning signs:**
- Gmail shows "Sent via gappssmtp.com" in email header details
- Gmail shows a "?" icon where a padlock should appear in the recipient's view
- DMARC RUA reports show `dkim=fail` for emails sent from "Send mail as" accounts

**Phase to address:**
Gmail "Send mail as" setup phase — must come after both Cloudflare Email Routing (to receive verification email) and Resend domain verification (to have a working SMTP relay that signs with your DKIM key).

---

### Pitfall 6: Cloudflare Email Routing Destination Address on Internal Suppression List

**What goes wrong:**
The Gmail address (`torch.secrets@gmail.com`) used as a forwarding destination must be verified by Cloudflare before routing rules become active. Cloudflare sends a verification email to that address. If the Gmail account previously marked a Cloudflare email as spam, or the address previously bounced a Cloudflare-originated email, Cloudflare places it on an internal suppression list and the verification email is never delivered. All routing rules remain inactive indefinitely with no clear error in the dashboard.

**Why it happens:**
Suppression lists are standard practice at email providers. Cloudflare's suppression list is not user-visible from the dashboard.

**How to avoid:**
Before starting Email Routing setup, check the Gmail spam/trash for any prior Cloudflare notification emails and mark them "Not Spam." If verification email doesn't arrive within 10 minutes after clicking "Resend," contact Cloudflare support to check if the destination address is suppressed — they can remove it manually.

Pre-allowlist `noreply@notify.cloudflare.com` and `no-reply@cloudflare.com` in Gmail before starting.

**Warning signs:**
- Verification email never arrives after multiple "Resend" attempts
- Routing rules stay in "Pending" state permanently
- No email in spam/junk folder either

**Phase to address:**
Cloudflare Email Routing setup — this is the first thing to confirm before adding routing rules.

---

### Pitfall 7: Updating RESEND_FROM_EMAIL Mid-Production Without Verifying Domain First

**What goes wrong:**
Changing `RESEND_FROM_EMAIL` from `onboarding@resend.dev` to `noreply@torchsecret.com` in Infisical and redeploying looks like a one-line env var change, but has three failure modes:

1. If Resend domain verification is not yet complete when the deploy hits, ALL transactional emails (secret-viewed notifications, Better Auth password reset and verification emails) fail silently with a `403 Unauthorized` from Resend — the app does not crash but users receive nothing.
2. Better Auth uses `RESEND_FROM_EMAIL` as the sender for verification and password reset emails. The new `noreply@torchsecret.com` address has zero sender reputation on day one and is more likely to land in spam for users who registered during the transition.
3. In-flight email flows (e.g., a user awaiting a Better Auth email verification email) see the sender address change between the trigger and delivery, which can confuse email clients.

**Why it happens:**
Env var changes feel atomic and safe. The dependency on Resend domain verification state is not visible in the application code — the `resend.emails.send()` call simply fails at runtime.

**How to avoid:**
- Verify Resend domain is in "Verified" state (green, all three records) in Resend dashboard before updating `RESEND_FROM_EMAIL` in Infisical
- Test by sending a real email via Resend API using the new from-address before deploying
- Update `RESEND_FROM_EMAIL` in Infisical production only after confirming the test email arrives in the recipient inbox (not spam)
- Expect 1-2 weeks of slightly lower deliverability on the new address; monitor Resend delivery logs for bounce or complaint spikes

**Warning signs:**
- Resend dashboard shows `Error: 403` entries in send logs immediately after deploy
- Users report not receiving password reset emails after a deployment
- Better Auth email verification flow stops working in production

**Phase to address:**
This is an ordering constraint: Resend domain verification must be fully complete before the Infisical env var is updated.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip DMARC RUA monitoring address | Faster setup | Blind to authentication failures; cannot detect spoofing attempts or misconfigured senders | Never — it requires only one extra email address |
| Deploy `p=reject` immediately | Looks more secure | Breaks legitimate email if any sender has a misconfiguration; damage is silent | Never — always ramp through p=none first |
| Leave SPF at `~all` (SoftFail) indefinitely | Avoids false positives | Allows spoofed emails from your domain to soft-pass; signals lower domain security posture | Only during initial 2-4 week ramp-up |
| Use `smtp.gmail.com` (not `smtp.resend.com`) for "Send mail as" | Simpler App Password setup | Permanent "via gappssmtp.com" banner; DKIM misalignment; spam classification by Outlook | Never for a security product |
| Leave Loops/Resend DKIM CNAME records proxied in Cloudflare | Default behavior | DKIM verification fails; emails may be unsigned or fail authentication | Never |
| Skip domain warming and send full volume immediately | Ship faster | New domain flagged as suspicious; transactional emails land in spam for weeks | Never — even a 1-week light ramp matters |
| Reuse production `RESEND_API_KEY` for Gmail SMTP credential | One less credential to manage | Single key compromise grants full Resend API access; key stored in Gmail account settings | Never — use a restricted send-only key |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cloudflare Email Routing + Resend outbound | Assuming Resend outbound sending conflicts with Cloudflare MX | It does NOT. Cloudflare Email Routing only controls inbound MX. Resend sends outbound via its own SES-backed infrastructure, completely independent of Cloudflare MX. |
| Cloudflare Email Routing + Loops.so MX | Worrying Loops MX records will conflict | Loops MX records live on the `envelope.torchsecret.com` subdomain, not the apex. Cloudflare Email Routing controls only the apex `torchsecret.com` MX. No conflict. |
| Resend + Loops apex SPF | Creating two separate SPF TXT records at apex | Both Resend (via `send.` subdomain) and Loops (via `envelope.` subdomain) use subdomains for their SPF records — they do NOT add entries to the apex SPF. Only Cloudflare Email Routing adds `include:_spf.mx.cloudflare.net` to the apex SPF. |
| Resend DKIM record type | Using TXT type for DKIM instead of CNAME | Resend uses CNAME-based DKIM delegation (one record: `resend._domainkey` as CNAME). Do not attempt to add a TXT record instead. |
| Loops DKIM in Cloudflare | Leaving proxy ON for any of the three DKIM CNAME records | All three Loops DKIM CNAME records must be DNS Only (grey cloud). Any proxied record will fail DKIM verification. |
| Gmail "Send mail as" ordering | Attempting to add "Send mail as" before Cloudflare Email Routing is active | The Cloudflare routing rule for the address must be active and verified before Gmail's setup verification email can arrive. |
| Resend SMTP username | Entering email address as the SMTP username | Resend SMTP username is the literal string `resend` (not your email). Password is the API key. |
| Cloudflare DNS record names | Pasting full FQDN from Resend/Loops dashboard into Cloudflare record name field | Cloudflare auto-appends the zone apex. Enter `resend._domainkey` not `resend._domainkey.torchsecret.com`. Same pattern for `send`, `envelope`, and any other subdomain records. |
| DMARC RUA mailbox | Publishing `rua=mailto:dmarc@torchsecret.com` before that address has a Cloudflare routing rule | The RUA address must be a functioning mailbox before the DMARC record is published, or reports are silently lost from day one. |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Publishing DMARC `p=reject` before monitoring phase | Legitimate emails permanently rejected; no visibility into why | Always run `p=none` with `rua=` for minimum 2 weeks; check RUA reports before advancing |
| `noreply@torchsecret.com` that hard-bounces replies | User replies to transactional emails bounce; damages sender reputation; Gmail may classify as suspicious | Configure Cloudflare Email Routing catch-all or a specific rule to accept mail to `noreply@` and forward to Gmail; or use a properly configured mailbox that accepts but auto-responds |
| Enabling catch-all forwarding without filtering | Spam sent to arbitrary@torchsecret.com floods the destination Gmail inbox | Set catch-all action to "Drop" for addresses not in the 7-address list, or enable after confirming specific rules work |
| Reusing production API key as SMTP password in Gmail | Resend API key stored in Gmail account settings; compromise gives full Resend API access | Create a dedicated restricted Resend API key with send-only permissions for Gmail SMTP use |
| Not monitoring Resend bounce/complaint dashboard | Hard bounce rate above 2% permanently damages domain reputation; Resend may suspend sending | Check Resend delivery dashboard weekly; suppress bounced addresses immediately |

---

## "Looks Done But Isn't" Checklist

- [ ] **Cloudflare Email Routing active:** Verify by actually sending an email from an external account to `hello@torchsecret.com` and confirming it arrives in `torch.secrets@gmail.com`. Dashboard showing "Active" is not sufficient.
- [ ] **Resend domain verified:** Resend dashboard must show "Verified" (green) for ALL record types: MX on `send.`, SPF TXT on `send.`, and DKIM CNAME `resend._domainkey`. Any single "Pending" means sends from `noreply@torchsecret.com` will be rejected.
- [ ] **Loops domain verified:** Loops dashboard must show domain as verified. Send a Loops test email and inspect headers — DKIM signature should show `d=torchsecret.com`, not `d=amazonses.com`.
- [ ] **Gmail "Send mail as" sends with DKIM alignment:** After adding via Resend SMTP, send a test email and check full headers. "Signed-by: torchsecret.com" must appear. "via gappssmtp.com" must NOT appear.
- [ ] **DMARC RUA mailbox is receiving reports:** After 24-48 hours at `p=none`, XML aggregate reports should arrive at `dmarc@torchsecret.com`. If none arrive after 48 hours, the RUA address is not working.
- [ ] **SPF record is a single merged record:** Run `dig TXT torchsecret.com` and confirm exactly ONE TXT record starting with `v=spf1`. Two SPF records equals permanent PermError for all senders.
- [ ] **RESEND_FROM_EMAIL updated in Infisical:** The env var in Infisical production must be updated and synced. Confirm the new value is visible in the Render service environment view before considering this done.
- [ ] **Better Auth transactional emails use new from-address:** Trigger a password reset on staging to confirm the reset email arrives from `noreply@torchsecret.com`, not `onboarding@resend.dev`.
- [ ] **No DKIM CNAME records are proxied:** Check each DKIM CNAME for Resend and Loops in Cloudflare DNS — all must show grey cloud (DNS Only).
- [ ] **Catch-all routing behavior explicitly decided:** Either set catch-all to "Drop" (silently discard unknown addresses) or "Forward" to a monitored inbox. Leaving it disabled means unrecognized addresses get a hard bounce from Cloudflare.
- [ ] **DMARC RUA address has an active routing rule:** `dmarc@torchsecret.com` must have a Cloudflare Email Routing rule forwarding to `torch.secrets@gmail.com` before the DMARC record is published.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| SPF PermError from two apex SPF records | LOW | Delete the duplicate SPF record; merge includes into the surviving record; re-enable Email Routing if needed |
| Resend domain stuck "Pending" due to proxied CNAME | LOW | Change CNAME proxy to DNS Only in Cloudflare; wait 15-30 min for Resend to re-poll |
| DMARC `p=reject` deployed too early, legit emails bouncing | MEDIUM | Change DMARC record to `p=none` immediately; wait up to 48h for propagation; debug authentication issues via RUA reports; ramp back up |
| Gmail "Send mail as" showing "via gappssmtp.com" banner | LOW | Remove the "Send mail as" account from Gmail settings; re-add using `smtp.resend.com` instead of `smtp.gmail.com` |
| Cloudflare routing destination address on suppression list | LOW | Contact Cloudflare support with the destination Gmail address; request suppression list removal |
| RESEND_FROM_EMAIL changed before domain verified | LOW | Revert `RESEND_FROM_EMAIL` to `onboarding@resend.dev` in Infisical; redeploy; complete domain verification; then change again |
| Loops DKIM not signing emails | LOW | Check Loops dashboard for verification status; confirm all three DKIM CNAME records are DNS Only (not proxied); re-verify in Loops |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cloudflare MX record deletion (data loss) | Phase 1: Cloudflare Email Routing setup | Document all existing MX before enabling; send real inbound test email to each address |
| SPF PermError from duplicate records | Phase 1: SPF merge after Email Routing setup | `dig TXT torchsecret.com` shows exactly one `v=spf1` record |
| Resend CNAME proxy enabled | Phase 2: Resend domain verification | Resend dashboard shows "Verified" green for all three record types |
| Loops CNAME proxy enabled | Phase 3: Loops domain verification | Loops dashboard shows verified; test email headers show `d=torchsecret.com` |
| DMARC deployed at `p=reject` too early | Phase 4: DMARC setup | Start at `p=none`; advance only after 2+ weeks of clean RUA reports |
| Gmail "via" banner from wrong SMTP server | Phase 5: Gmail "Send mail as" setup | Full email headers show `signed-by: torchsecret.com`; no `via` line |
| Destination address on suppression list | Phase 1 pre-flight | Verification email from Cloudflare arrives at `torch.secrets@gmail.com` |
| RESEND_FROM_EMAIL changed before domain verified | Phase 2-3 ordering constraint | Resend shows "Verified" before Infisical env var is updated |
| Production API key reused for Gmail SMTP | Phase 5: Gmail "Send mail as" setup | A dedicated restricted Resend API key is created and used |
| DMARC RUA address not receiving reports | Phase 4: DMARC setup | Reports arrive at `dmarc@torchsecret.com` within 48h of DNS propagation |

---

## Ordering Requirement (Hard Dependency Chain)

The phases have strict dependencies. This is the only safe order:

1. **Cloudflare Email Routing** — first. Takes exclusive ownership of apex MX. Verify forwarding for all 7 addresses works before proceeding to any other step.
2. **Merge apex SPF record** — immediately after enabling Email Routing, before enabling Resend or Loops outbound sends.
3. **Resend domain verification** — add DKIM CNAME (`resend._domainkey`, DNS Only), SPF on `send.` subdomain, MX on `send.` subdomain. Wait for "Verified" status in Resend dashboard.
4. **Loops.so domain verification** — add all three DKIM CNAMEs (all DNS Only), MX on `envelope.` subdomain. Wait for verification in Loops dashboard.
5. **DMARC at `p=none` with `rua=`** — deploy monitoring record. Requires `dmarc@torchsecret.com` routing rule already active (from step 1).
6. **Update `RESEND_FROM_EMAIL` in Infisical** — only after step 3 is complete and a test send from `noreply@torchsecret.com` succeeds.
7. **Gmail "Send mail as"** — last. Requires Cloudflare routing (step 1) to receive Gmail's verification email, and Resend SMTP (step 3) to sign with your DKIM key.
8. **DMARC progression** — ongoing. After 2-4 weeks of clean `p=none` RUA reports, advance to `p=quarantine; pct=25`, then `p=quarantine; pct=100`, then `p=reject`.

---

## Sources

- [Cloudflare Email Routing: Enable Email Routing — MX deletion behavior, exclusivity requirement](https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/)
- [Cloudflare Email Routing: Troubleshooting SPF Records — multiple SPF records forbidden](https://developers.cloudflare.com/email-routing/troubleshooting/email-routing-spf-records/)
- [Cloudflare Email Routing: Postmaster — outbound sending not supported](https://developers.cloudflare.com/email-routing/postmaster/)
- [Resend: Managing Domains — DKIM selector name `resend._domainkey`, subdomain SPF architecture](https://resend.com/docs/dashboard/domains/introduction)
- [Resend: Cloudflare knowledge base — DKIM CNAME proxy issue, error Code 1004, domain name truncation when entering records](https://resend.com/docs/knowledge-base/cloudflare)
- [Resend: Send with SMTP — host `smtp.resend.com`, port, username `resend`, password = API key](https://resend.com/docs/send-with-smtp)
- [Resend: Domain warming guide — six-week ramp-up recommendation; cold domain spam classification risk](https://resend.com/blog/how-to-warm-up-a-new-domain)
- [Loops.so: Setting up your domain — subdomain SPF at `envelope.`, MX on `envelope.`, three DKIM CNAMEs, DNS Only requirement for Cloudflare](https://loops.so/docs/sending-domain)
- [dmarc.wiki/resend — Resend SPF on `send.` subdomain; strict DKIM alignment possible; relaxed SPF alignment required](https://dmarc.wiki/resend)
- [Google: Recommended DMARC rollout — `p=none` → `p=quarantine` (with pct ramp) → `p=reject` timeline](https://support.google.com/a/answer/10032473)
- [GMass: How Gmail "Send mail as" affects deliverability — "via" banner, DKIM signing behavior with external SMTP](https://www.gmass.co/blog/gmail-send-mail-as-setting-affects-email-deliverability/)
- [Cloudflare community: Destination address verification emails not delivered — suppression list root cause](https://community.cloudflare.com/t/email-routing-destination-address-verification-emails-not-being-delivered/380285)
- [Cloudflare community: Email Routing and SPF conflicts — merging SPF includes](https://community.cloudflare.com/t/email-routing-and-spf/341490)
- [GitHub gist: Gmail SMTP with Cloudflare Email Routing — DKIM signing failures when using smtp.gmail.com](https://gist.github.com/irazasyed/a5ca450f1b1b8a01e092b74866e9b2f1)
- [Suped: DKIM CNAME issues in Cloudflare — proxied CNAME breaks DKIM lookup for any ESP](https://www.suped.com/knowledge/email-deliverability/technical/what-issues-occur-when-adding-dkim-record-to-dns-via-cname-with-cloudflare)

---

*Pitfalls research for: Torch Secret v5.1 — business email infrastructure (Cloudflare Email Routing + Resend + Loops.so + Gmail "Send mail as")*
*Researched: 2026-03-03*
