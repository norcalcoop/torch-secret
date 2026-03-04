# Project Research Summary

**Project:** Torch Secret — v5.1 Business Email Infrastructure
**Domain:** Email deliverability, DNS authentication, inbound routing, operator alias setup
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

v5.1 is a pure infrastructure milestone: replacing the `onboarding@resend.dev` placeholder sender with a fully authenticated `@torchsecret.com` email identity. The existing sending code (Resend transactional + Loops.so onboarding sequences) requires zero application code changes — the entire milestone is DNS records in Cloudflare, domain verification in Resend and Loops.so dashboards, one environment variable update in Infisical, and Gmail alias configuration for operators. The codebase already externalizes the from-address to `RESEND_FROM_EMAIL`, so updating that env var is the only "deployment" action required after DNS verification is complete.

The recommended architecture connects three external email systems through a shared Cloudflare DNS zone: Cloudflare Email Routing (inbound MX for all role addresses forwarded to Gmail), Resend (outbound transactional via verified `noreply@torchsecret.com`), and Loops.so (onboarding sequences via verified `hello@torchsecret.com`). Each provider uses subdomain isolation for SPF (`send.` for Resend, `envelope.` for Loops) so all three coexist without SPF record conflicts. DKIM selectors are provider-specific and coexist freely. Gmail "Send mail as" via Resend SMTP (`smtp.resend.com`) gives operators the ability to reply from business addresses with proper DKIM alignment and no "via gappssmtp.com" trust-eroding banner — critical for a security-focused product.

The primary risk in this milestone is ordering: six of the seven documented critical pitfalls are caused by doing steps out of sequence (proxied DKIM CNAMEs, duplicate SPF records, DMARC deployed before senders are verified, env var updated before domain is verified, Gmail aliases configured before inbound routing is live). The research provides an explicit hard dependency chain. Following it eliminates all critical pitfalls. For a security-focused product, `security@torchsecret.com` and a `/.well-known/security.txt` file are non-negotiable trust signals that researchers and AI crawlers expect before responsible disclosure is possible.

---

## Key Findings

### Recommended Stack

v5.1 requires no new npm packages and no new server infrastructure. All sending code (Resend SDK, Loops.so SDK) is already shipped from v4.0 and v5.0. The only application-layer change is one environment variable value.

**Core technologies in use (unchanged):**
- **Resend SDK** (`resend@6.9.2`): Transactional email — already in use. Domain verification unlocks `noreply@torchsecret.com` as the From address.
- **Loops.so SDK** (`loops@6.2.0`): Onboarding sequences — already in use. Domain verification unlocks `hello@torchsecret.com` as the onboarding sender.
- **Infisical**: Env var injection — `RESEND_FROM_EMAIL` is the configuration seam. Updating it in Infisical and redeploying is the entire "code deployment" for this milestone.
- **Cloudflare**: DNS authoritative server and Email Routing provider — the single control plane for all email authentication records.

**No new dependencies needed.** All tooling is external configuration: Cloudflare dashboard, Resend dashboard, Loops dashboard, Gmail settings. The v4.0 stack research established the passphrase generation approach (EFF wordlist as static JSON, Web Crypto `getRandomValues`) which remains the correct approach and is already implemented.

### Expected Features

**Must have for launch (P1 — table stakes):**
- Emails arrive from `@torchsecret.com` not `@resend.dev` — visible placeholder erodes trust; a ZK encryption product using a third-party sandbox domain is a contradiction
- SPF + DKIM for Resend (enables `noreply@torchsecret.com` as verified outbound sender)
- SPF + DKIM for Loops.so (enables `hello@torchsecret.com` as verified onboarding sender)
- Cloudflare Email Routing active for `hello@`, `security@`, `privacy@`, `support@` → Gmail
- DMARC at `p=none` with `rua=` monitoring — Gmail/Yahoo 2024 mandate for bulk senders; also establishes the reporting baseline required before safe enforcement escalation
- `security@torchsecret.com` listed in SECURITY.md — RFC 2142 §4 defines this address for security bulletins; researchers check for it before responsible disclosure; absence signals amateurism for an encryption product
- `privacy@torchsecret.com` listed in Privacy Policy — GDPR Articles 13/14 require a listed, functional contact address for data subject requests; regulators check

**Should have before launch (P2 — low effort, high value):**
- Gmail "Send mail as" for `hello@`, `security@`, `privacy@`, `support@` via Resend SMTP — operators reply from the correct address with `d=torchsecret.com` DKIM signing; no "via" banner
- `/.well-known/security.txt` — RFC 9116, CISA-recommended, 5-minute Express static route; reinforces zero-knowledge security brand
- `contact@torchsecret.com` Cloudflare routing rule (press, partnerships)
- Cloudflare catch-all rule → Gmail (absorbs `info@`, `admin@`, stray sends without hard bounces)

**Defer post-launch (P3):**
- DMARC upgrade `p=none` → `p=quarantine` — only after 2+ weeks of clean RUA aggregate reports confirming no legitimate send stream has a misconfiguration
- DMARC upgrade `p=quarantine` → `p=reject` — only after confirming quarantine phase is clean; use `p=quarantine` (not `p=reject`) as permanent posture because Cloudflare Email Routing's envelope rewriting during forwarding breaks SPF alignment under `p=reject`
- `Reply-To: support@torchsecret.com` on `noreply@` sends — softens bounce UX for transactional email recipients who try to reply; 3 lines of code change in `email.ts` and `notification.service.ts`

**Anti-features confirmed out of scope:**
- Google Workspace ($6+/user/month) — Cloudflare Email Routing + Gmail "Send mail as" via Resend SMTP provides identical operator capability at $0
- Self-hosted SMTP / custom MX — catastrophic maintenance burden; blacklist risk is high; Resend handles deliverability as MTA
- `postmaster@` and `abuse@` mailboxes — RFC requirements apply to SMTP server operators and ISPs, not to SaaS products using third-party MTAs
- Separate sending subdomains (`mail.`, `app.`) — only relevant at 100k+/month send volume; pre-launch Torch Secret sends hundreds of emails, not millions

### Architecture Approach

The architecture is a DNS-coordinated multi-provider email system with no shared application code between providers. Cloudflare DNS is the single control plane: all MX, SPF, DKIM, and DMARC records live there. Each provider (Cloudflare Email Routing, Resend, Loops.so) operates independently with subdomain isolation for SPF and selector-based DKIM. Inbound email flows through Cloudflare MX → Gmail forwarding → operator reads and replies via Gmail "Send mail as" via Resend SMTP. Outbound transactional email flows through Express → Resend SDK → verified `noreply@torchsecret.com`. Outbound onboarding email flows through Express → Loops.so SDK → verified `hello@torchsecret.com`.

**Major components:**
1. **Cloudflare Email Routing** — exclusive inbound MX ownership of apex domain; forwards 7+ addresses to `torch.secrets@gmail.com`; must be configured and verified first (all other steps depend on it being live)
2. **Resend domain verification** — authorizes `noreply@torchsecret.com` as outbound sender; DKIM CNAME `resend._domainkey` must be DNS Only (not proxied) in Cloudflare; SPF lives on `send.` subdomain, not apex
3. **Loops.so domain verification** — authorizes `hello@torchsecret.com` as onboarding sender; three DKIM CNAME records all DNS Only in Cloudflare; SPF lives on `envelope.` subdomain, not apex
4. **DMARC TXT record** — monitoring and eventual spoofing protection; must be deployed last in the DNS sequence after DKIM/SPF for both providers are confirmed verified
5. **Infisical env var update** — `RESEND_FROM_EMAIL` = `noreply@torchsecret.com`; the only deployment action; must follow Resend showing "Verified" status
6. **Gmail "Send mail as"** — per-alias configuration via `smtp.resend.com`; must be last (requires inbound routing live to receive verification email, and Resend SMTP available to sign with your DKIM key)

**Key architectural patterns:**
- **Subdomain SPF isolation:** `send.torchsecret.com` for Resend, `envelope.torchsecret.com` for Loops — avoids RFC 7208's one-SPF-TXT-per-FQDN rule; Cloudflare Email Routing owns the apex `@` SPF record
- **Environment variable as configuration seam:** Zero code changes required; all three transactional email callers (`notification.service.ts`, `subscribers.service.ts`, Better Auth) already read `env.RESEND_FROM_EMAIL` at runtime
- **DKIM selector namespace separation:** Each provider uses distinct selectors; no conflicts possible between Resend (`resend._domainkey`) and Loops (account-specific selectors); DNS resolves each independently

### Critical Pitfalls

1. **Cloudflare DKIM CNAME records left proxied (orange cloud)** — Cloudflare intercepts the CNAME lookup and returns its own IP instead of delegating to the provider's DKIM key infrastructure; DKIM verification fails permanently; Resend dashboard shows "Pending" indefinitely; Cloudflare throws error Code 1004. Prevention: explicitly set all DKIM CNAME records to DNS Only (grey cloud) before clicking Verify in Resend or Loops dashboards.

2. **Multiple SPF TXT records at apex after enabling Cloudflare Email Routing** — Cloudflare Email Routing adds its own `v=spf1 include:_spf.mx.cloudflare.net ~all` at the apex. Any pre-existing SPF record produces a second TXT record; RFC 7208 returns `PermError` for all senders — equivalent to authentication failure. Prevention: merge all SPF includes into exactly one `@` TXT record immediately after enabling Email Routing; confirm with `dig TXT torchsecret.com` before proceeding.

3. **`RESEND_FROM_EMAIL` updated before Resend domain is "Verified"** — All transactional emails (secret-viewed notifications, Better Auth password reset/verification, subscriber confirmations) fail silently with Resend 403 errors; the Express app does not crash, but users receive nothing. Prevention: update the Infisical env var only after Resend dashboard shows green "Verified" status for all three record types AND a manual test send from `noreply@torchsecret.com` succeeds.

4. **DMARC deployed at `p=reject` immediately** — Legitimate emails rejected permanently if any DKIM/SPF configuration has an error; Cloudflare Email Routing's envelope rewriting during forwarding also breaks SPF alignment, causing `p=reject` to bounce legitimate forwarded messages. Prevention: always start at `p=none` with `rua=` monitoring; advance to `p=quarantine` only after 2-4 weeks of clean aggregate reports; use `p=quarantine` (not `p=reject`) as permanent posture for domains using email forwarding.

5. **Gmail "Send mail as" using `smtp.gmail.com` instead of `smtp.resend.com`** — Emails display a permanent "via gappssmtp.com" banner; DKIM signed with `d=gappssmtp.com` rather than `d=torchsecret.com`; fails DMARC strict alignment. For a security product, this "via" banner signals non-authoritative sending to technically sophisticated users. Prevention: use `smtp.resend.com` (port 465, user=`resend`, password=dedicated restricted Resend API key — do not reuse the production `RESEND_API_KEY`).

6. **Cloudflare destination address on suppression list** — Cloudflare sends a verification email to `torch.secrets@gmail.com`; if that address previously bounced or spam-flagged a Cloudflare email, it is on Cloudflare's suppression list and the verification email is never delivered; routing rules stay "Pending" indefinitely with no error in the dashboard. Prevention: pre-allowlist Cloudflare sender addresses in Gmail before starting; if verification email doesn't arrive in 10 minutes, contact Cloudflare support.

7. **Full FQDN entered in Cloudflare DNS record name fields** — Cloudflare appends the zone domain automatically; entering `resend._domainkey.torchsecret.com` creates `resend._domainkey.torchsecret.com.torchsecret.com`, which Resend's verifier can never find; the record appears to be created successfully but verification fails silently. Prevention: enter only the subdomain prefix (`resend._domainkey`, `send`, `envelope`, `_dmarc`) — never the full FQDN.

---

## Implications for Roadmap

The research reveals a hard 7-step dependency chain where each step is a prerequisite for the next. This maps directly to a single phase with ordered tasks rather than multiple parallel phases. The milestone is narrowly scoped — one env var change, DNS records, dashboard configuration, and two document edits — but sequencing is strict and each step requires verification before proceeding.

### Phase 1: Inbound Infrastructure (Cloudflare Email Routing)

**Rationale:** Every other step depends on inbound email being live and verified. Gmail "Send mail as" requires receiving Gmail's setup verification email at the custom address. DMARC RUA reporting requires `dmarc@torchsecret.com` to be a live forwarding rule. This step must be first and confirmed with a real inbound test before proceeding.

**Delivers:** All 7+ `@torchsecret.com` addresses receive email at `torch.secrets@gmail.com`. Cloudflare adds 3 MX records and a base SPF TXT at `@`. Operators can receive support, security, and privacy inquiries immediately.

**Addresses:** `hello@`, `security@`, `privacy@`, `support@`, `contact@`, `dmarc@` routing rules; catch-all rule for `info@`, `admin@`, stray sends

**Avoids:** Pitfall 1 (MX record deletion — document all existing MX records before enabling; verify Loops MX lives on `envelope.` subdomain not apex); Pitfall 6 (suppression list — pre-allowlist Cloudflare senders in Gmail before starting)

**Verification:** Send a real email to `hello@torchsecret.com` from an external account and confirm it arrives in Gmail. Do not proceed to Phase 2 until this passes.

### Phase 2: Resend Domain Verification (Outbound Transactional)

**Rationale:** Resend domain verification unlocks `noreply@torchsecret.com` as the From address for all transactional email. This is a prerequisite for updating the Infisical env var (Phase 5) and for Gmail "Send mail as" via Resend SMTP (Phase 6). Phases 2 and 3 are independent and can be worked in parallel.

**Delivers:** `noreply@torchsecret.com` authorized as outbound sender. Resend dashboard shows "Verified" for all three record types (DKIM CNAME, SPF on `send.`, MX on `send.`).

**Addresses:** Resend DKIM CNAME (`resend._domainkey`, DNS Only in Cloudflare), SPF and MX on `send.torchsecret.com` subdomain

**Avoids:** Pitfall 2 (DKIM CNAME proxy — explicitly set DNS Only before clicking Verify); Pitfall 7 (full FQDN in Cloudflare record name — enter prefix `resend._domainkey` not the full FQDN)

**Verification:** Resend dashboard shows green "Verified" for all three record types. Send a test email via Resend API from `noreply@torchsecret.com` and confirm delivery to an external inbox (not spam).

### Phase 3: Loops.so Domain Verification (Outbound Onboarding)

**Rationale:** Independent of Resend; can run in parallel with Phase 2. Loops.so domain verification unlocks `hello@torchsecret.com` as the onboarding sequence sender, ensuring onboarding emails appear authoritative rather than arriving from Amazon SES infrastructure.

**Delivers:** `hello@torchsecret.com` authorized as Loops.so sender. DKIM headers in outgoing onboarding emails show `d=torchsecret.com`. Loops dashboard shows domain as verified.

**Addresses:** Three Loops DKIM CNAME records (all DNS Only in Cloudflare), MX and SPF on `envelope.torchsecret.com` subdomain — does NOT conflict with apex SPF or `send.` subdomain

**Avoids:** Pitfall 2 (DKIM proxy — all three Loops CNAME records must be DNS Only); Pitfall 7 (full FQDN in record names)

**Note on gap:** Loops DKIM selector names are account-specific and not disclosed in public documentation — they must be read from the Loops dashboard → Settings → Domain during execution.

**Verification:** Loops dashboard shows verified. Send a Loops test event and inspect email headers: `DKIM-Signature: d=torchsecret.com` must appear.

### Phase 4: DMARC Monitoring Record

**Rationale:** DMARC must be added after DKIM and SPF are verified for both senders (Phases 2+3). The `rua=` reporting address (`dmarc@torchsecret.com`) must already route to Gmail via Cloudflare Email Routing (Phase 1) before the DMARC record is published — otherwise reports are silently lost from day one and there is no visibility into authentication failures.

**Delivers:** `_dmarc.torchsecret.com` TXT record with `v=DMARC1; p=none; rua=mailto:dmarc@torchsecret.com`. Daily XML aggregate reports begin arriving at `dmarc@torchsecret.com` → Gmail within 24-48 hours.

**Avoids:** Pitfall 4 (premature `p=reject` — start at `p=none` for monitoring; the research recommends `p=quarantine` as the stable production posture for forwarding setups, not `p=reject`, because Cloudflare Email Routing's SRS envelope rewriting breaks SPF alignment under `p=reject`)

**Verification:** After 24-48 hours, DMARC aggregate reports arrive at `dmarc@torchsecret.com` in Gmail. Reports show zero or low `dkim=fail` and `spf=fail` counts for Resend and Loops sends.

### Phase 5: Infisical Env Var Update + Deploy

**Rationale:** This is the one step that touches production. It must follow Phase 2 (Resend "Verified"). This single env var change switches all transactional email From addresses from `onboarding@resend.dev` to `noreply@torchsecret.com` — `notification.service.ts`, `subscribers.service.ts`, and Better Auth auth emails all read `env.RESEND_FROM_EMAIL` at runtime. No application code change required.

**Delivers:** All outbound transactional email (secret-viewed notifications, subscriber confirmations, Better Auth password reset/verification) sends from `noreply@torchsecret.com`. Placeholder domain eliminated.

**Addresses:** `RESEND_FROM_EMAIL` updated in Infisical (dev + staging + production environments); Render redeploys automatically via Infisical Secret Sync or manually triggered

**Avoids:** Pitfall 3 (env var updated before domain verified — Phase 2 must show green "Verified" status in Resend dashboard before this step; test with a manual Resend API send first)

**Note on gap:** Confirm whether the Better Auth email sender configuration in `server/src/app.ts` reads `env.RESEND_FROM_EMAIL` or hardcodes a separate from-address. If it reads the env var, this phase handles auth emails automatically. If not, a code fix is needed before deploy.

**Verification:** Trigger a password reset on staging after deploy. Confirm the reset email arrives from `noreply@torchsecret.com` (not `onboarding@resend.dev`). Check Resend send logs for any 403 errors.

### Phase 6: Gmail "Send Mail As" + Operator Aliases

**Rationale:** Requires both Phase 1 (inbound routing live — to receive Gmail's verification email during alias setup) and Phase 2 (Resend domain verified — to have a working SMTP relay that signs with your DKIM key). Must use `smtp.resend.com` with a dedicated restricted API key, not `smtp.gmail.com` and not the production `RESEND_API_KEY`.

**Delivers:** Operators can reply from `hello@`, `security@`, `privacy@`, `support@` with proper `d=torchsecret.com` DKIM signing and no "via gappssmtp.com" banner. Each alias added via Gmail → Settings → Accounts and Import → Send mail as, using Resend SMTP credentials.

**Avoids:** Pitfall 5 (using `smtp.gmail.com` produces "via" banner and DKIM misalignment — use `smtp.resend.com` port 465, user=`resend`); security mistake of reusing production `RESEND_API_KEY` — create a dedicated restricted send-only key in Resend for Gmail SMTP use

**Verification:** Send a test reply from each alias. Inspect full email headers: `Signed-by: torchsecret.com` must appear; `via gappssmtp.com` must NOT appear.

### Phase 7: Documentation Updates (SECURITY.md, Privacy Policy, security.txt)

**Rationale:** Two are legal/trust requirements that must be live before launch. `security@torchsecret.com` in SECURITY.md is required for responsible disclosure. `privacy@torchsecret.com` in the Privacy Policy is required for GDPR compliance. `security.txt` is a 5-minute Express static route with outsized trust signal value for a ZK security product. These documentation changes are code-only (no DNS) and can be staged and committed independently of the DNS phases.

**Delivers:** SECURITY.md lists `security@torchsecret.com` as the vulnerability report contact. Privacy Policy page (`client/src/pages/privacy.ts`) lists `privacy@torchsecret.com` for data subject requests. `/.well-known/security.txt` served from Express with `Contact: mailto:security@torchsecret.com` and a future `Expires:` date field (RFC 9116 required fields).

**Addresses:** RFC 2142 §4 (`security@` for security-focused products), RFC 9116 (`security.txt`), GDPR Articles 13/14 (`privacy@` listed in privacy policy)

**Verification:** `curl https://torchsecret.com/.well-known/security.txt` returns valid security.txt with `Contact:` and `Expires:` fields. Privacy Policy page displays `privacy@torchsecret.com` as a clickable mailto link.

### Phase Ordering Rationale

- **Inbound before outbound aliases:** Cloudflare Email Routing must be first because Gmail "Send mail as" setup requires receiving Gmail's verification email at the custom address. This is a hard prerequisite with no workaround.
- **Verification before env var update:** Resend domain verification (Phase 2) must show green status in the Resend dashboard before the Infisical env var (Phase 5) is updated. Reversing this order causes silent 403 failures on all transactional email in production.
- **Phases 2 and 3 are parallelizable:** Resend and Loops.so domain verification are fully independent. Both provider dashboards can be worked concurrently, cutting total clock time.
- **DKIM/SPF before DMARC:** DMARC enforcement against misconfigured DKIM/SPF causes legitimate emails to be rejected. Phase 4 is always last in the DNS sequence. The `rua=` address (Phase 1) must be live before the DMARC record is published.
- **Documentation (Phase 7) is code-only:** Can be committed and staged at any point but should be deployed before launch. Not blocked by DNS phases.

### Research Flags

Phases with well-documented patterns — no additional research needed:
- **All DNS phases:** Fully documented in official Cloudflare, Resend, and Loops.so documentation. The research files cover every step with exact DNS record structures, credential formats, proxy settings, and verification procedures.
- **Phase 5 (env var update):** One Infisical env var change. No research needed.
- **Phase 7 (documentation):** RFC 9116 security.txt format is simple (two required fields). Privacy Policy and SECURITY.md are text edits.

Execution-time discoveries (not research gaps):
- **Phase 2 (Resend SPF location):** The exact DNS records displayed in the Resend dashboard are account-specific. Research confirms Resend uses `send.` subdomain for SPF (not apex), but the TXT values must be copied from the Resend dashboard during execution.
- **Phase 3 (Loops DKIM selectors):** Loops DKIM selector names are not publicly disclosed — must be read from the Loops dashboard → Settings → Domain. The research confirms 3 CNAME records on `envelope.` subdomain but not the selector prefixes.
- **Phase 4 (DMARC RUA address):** Either `dmarc@torchsecret.com` (via Cloudflare routing rule from Phase 1) or an external DMARC reporting service (Postmark free tier, dmarcian) is valid. Operator choice during execution.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | v4.0 stack already shipped and production-validated. v5.1 requires zero new dependencies. All patterns reuse existing code. |
| Features | HIGH | RFC 2142, RFC 9116, and GDPR Articles 13/14 are primary sources with no ambiguity. Anti-features (Google Workspace, self-hosted MX, `abuse@`, `postmaster@`) definitively ruled out with cited rationale. |
| Architecture | HIGH | Cloudflare, Resend, and Loops.so official docs confirmed DNS record types, DKIM selector names, SPF subdomain architecture (`send.`, `envelope.`), SMTP credentials, and proxy requirements. One MEDIUM residual: exact Loops DKIM selector names are account-specific and visible only in the dashboard. |
| Pitfalls | HIGH | 7 critical pitfalls documented with official source citations, recovery strategies, and phase-to-pitfall mapping. Hard dependency chain validated against all three providers' documentation. Ordering requirements are deterministic and non-negotiable. |

**Overall confidence: HIGH**

### Gaps to Address

- **Loops DKIM selector names:** Must be read from Loops dashboard during execution. Research confirms the structure (3 CNAME records, all DNS Only) but selector prefixes are account-specific and not publicly documented.

- **Resend SPF record location (root `@` vs `send.` subdomain):** Research indicates Resend places its SPF on the `send.` subdomain (does not touch the root `@`). Confirm this in the Resend dashboard during Phase 2 — if Resend requests a root-level `include:amazonses.com`, it must be merged into the single `@` TXT record created by Cloudflare Email Routing. Architecture research notes: "Check whether Resend's dashboard adds `include:amazonses.com` to the root `@` or to a `send.*` subdomain."

- **Better Auth email sender configuration:** Confirm in `server/src/app.ts` whether the Better Auth email sender reads `env.RESEND_FROM_EMAIL` or uses a hardcoded from-address. If it reads the env var, Phase 5 handles auth emails automatically. If hardcoded, a code fix is needed before deploy.

- **Domain reputation warmup:** New `@torchsecret.com` sender domain has zero reputation on launch day. Resend recommends a 6-week send-volume ramp. At current Torch Secret send volumes (hundreds, not thousands, of emails), impact is low but expect 1-2 weeks of elevated spam classification on the new From address. Monitor Resend delivery dashboard for bounce/complaint spikes in the first week.

- **`noreply@` inbound handling:** Research notes a potential UX issue where users who reply to transactional emails (secret-viewed notifications) get a hard bounce from `noreply@torchsecret.com`. The post-launch mitigation is adding `Reply-To: support@torchsecret.com` to those sends (3 lines of code). The catch-all Cloudflare rule also optionally accepts and discards mail to `noreply@` without hard-bouncing. Decide which approach before launch.

---

## Sources

### Primary (HIGH confidence)

- RFC 2142 — Mailbox Names for Common Services — defines `security@`, `abuse@`, `postmaster@` requirements and which RFC sections apply to SaaS vs. ISPs
- RFC 9116 — security.txt File Format — required fields (`Contact:`, `Expires:`), optional fields, canonical URL `/.well-known/security.txt`
- RFC 7208 — Sender Policy Framework — one SPF TXT record per FQDN rule; `PermError` on multiple records
- [Cloudflare Email Routing docs](https://developers.cloudflare.com/email-routing/) — MX exclusivity requirement, SPF merge requirement, SRS envelope rewriting during forwarding, MX deletion behavior when enabling
- [Cloudflare Email Routing SPF troubleshooting](https://developers.cloudflare.com/email-routing/troubleshooting/email-routing-spf-records/) — multiple SPF records forbidden; merged record pattern
- [Resend Cloudflare knowledge base](https://resend.com/docs/knowledge-base/cloudflare) — DKIM selector `resend._domainkey` confirmed; DNS Only requirement; record name truncation (no FQDN in Cloudflare name field)
- [Resend Send with SMTP docs](https://resend.com/docs/send-with-smtp) — `smtp.resend.com`, port 465/587, username `resend`, password = API key
- [Resend Domain warming guide](https://resend.com/blog/how-to-warm-up-a-new-domain) — six-week ramp recommendation; cold domain spam risk
- [Loops.so sending domain docs](https://loops.so/docs/sending-domain) — SPF at `envelope.` subdomain; 3 DKIM CNAMEs; DNS Only requirement for Cloudflare
- [CISA security.txt recommendation](https://www.cisa.gov/news-events/news/securitytxt-simple-file-big-value) — US government endorsement for all organizations
- GDPR Articles 13/14 — data subject rights contact address requirement; regulators check for functional `privacy@` address

### Secondary (MEDIUM confidence)

- [Cloudflare community: Email Routing and SPF](https://community.cloudflare.com/t/email-routing-and-spf/341490) — merged SPF record pattern confirmed; Cloudflare auto-adds SPF for Email Routing
- [Cloudflare community: DMARC Reject + Email Routing](https://community.cloudflare.com/t/dmarc-reject-policy-cloudflare-email-routing/753410) — `p=reject` conflicts with Cloudflare Email Routing forwarding; `p=quarantine` is the correct posture
- [Gmail "Send mail as" with Cloudflare + SMTP gist](https://gist.github.com/irazasyed/a5ca450f1b1b8a01e092b74866e9b2f1) — Resend SMTP vs gmail.com SMTP DKIM behavior; "via" banner cause and prevention
- [dmarc.wiki/resend](https://dmarc.wiki/resend) — Resend SPF architecture on `send.` subdomain confirmed
- [Google DMARC rollout guidance](https://support.google.com/a/answer/10032473) — `p=none` → `p=quarantine` (with pct ramp) → `p=reject` timeline; Gmail/Yahoo 2024 bulk sender requirements
- [Cloudflare community: Destination address suppression list](https://community.cloudflare.com/t/email-routing-destination-address-verification-emails-not-being-delivered/380285) — suppression list root cause; Cloudflare support can remove addresses
- [GMass: Gmail "Send mail as" deliverability](https://www.gmass.co/blog/gmail-send-mail-as-setting-affects-email-deliverability/) — "via" banner DKIM behavior when using gmail.com SMTP

---

*Research completed: 2026-03-03*
*Ready for roadmap: yes*
