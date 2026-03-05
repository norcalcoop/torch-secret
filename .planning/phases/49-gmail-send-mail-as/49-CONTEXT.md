# Phase 49: Gmail Send Mail As - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a dedicated Resend API key for Gmail SMTP relay, then add all 7 torchsecret.com business addresses (hello, contact, admin, info, support, security, privacy) to Gmail "Send mail as" using smtp.resend.com:465. Verify each address via Cloudflare-forwarded confirmation email, then set hello@torchsecret.com as the default outbound address.

This is a zero-code-changes phase: only Resend dashboard (API key creation) and Gmail Settings configuration. No application files, no Infisical env vars, no DNS changes.

</domain>

<decisions>
## Implementation Decisions

### SMTP relay configuration
- Server: smtp.resend.com, port 465 (SSL)
- Username: resend (literal string — Resend's SMTP protocol requires this)
- Password: the dedicated Resend API key created in this phase
- NOT smtp.gmail.com — that would send via Google's servers and add "via gappssmtp.com" banner
- NOT the production RESEND_API_KEY — separate key isolates Gmail relay from transactional email

### Dedicated Resend API key
- Create a new Resend API key explicitly for Gmail SMTP relay use
- Name it clearly: "Gmail SMTP Relay" or similar, to distinguish from the production app key
- Restrict to sending domain: torchsecret.com only (not full account access)
- Store the key value securely (password manager) — it goes into Gmail SMTP password field and cannot be retrieved from Resend after creation

### Display names per alias
- Use "Torch Secret" as the display name for all 7 aliases — consistent brand identity
- No role-specific suffixes ("Torch Secret Support", "Torch Secret Security") — brand consistency over granularity at this stage
- Display name is editable in Gmail later if the decision changes

### Alias setup sequencing
- Add all 7 aliases in a single Gmail Settings session before clicking any verification links
- This triggers 7 verification emails arriving at torch.secrets@gmail.com simultaneously
- After all 7 are added, process the verification emails in batch — faster than 7 separate add/verify cycles
- Each verification email contains a confirmation code; enter it in Gmail Settings (or click the link)

### Default outbound address
- Set hello@torchsecret.com as the default "Send mail as" address in Gmail
- This is already specified in the success criteria (GMAI-04)
- Gmail's "Reply from the same address the message was sent to" setting should be enabled to ensure context-appropriate replies

### Reply-to behavior
- No custom reply-to specified — default Gmail behavior: replies go to the alias address the email was sent from
- This is the correct behavior: a reply to an email from support@torchsecret.com should route back to support@torchsecret.com (which forwards to torch.secrets@gmail.com via Phase 46)

### Verification scope
- All 7 addresses must reach "verified" status in Gmail Settings before GMAI-02/GMAI-03 are complete
- Verify DKIM alignment on at least one address (hello@torchsecret.com — the default) using Gmail "Show original" to confirm "Signed by: torchsecret.com" and no "via gappssmtp.com"
- Remaining 6 addresses: verified status in Gmail Settings is sufficient (no additional header inspection needed — same SMTP config applies to all)

### Claude's Discretion
- Order in which the 7 aliases are added within the Gmail Settings session
- Whether to use the verification code entry method vs. clicking the emailed link (both work; code entry is faster if codes arrive quickly)
- How long to wait between adding all 7 and starting verification (usually seconds; Gmail sends immediately)

</decisions>

<specifics>
## Specific Ideas

- STATE.md constraint: "Gmail SMTP relay must use smtp.resend.com (port 465) with a dedicated restricted Resend API key — NOT smtp.gmail.com and NOT the production RESEND_API_KEY"
- Phase 46 is live — all 7 addresses forward to torch.secrets@gmail.com, so Gmail verification emails will arrive successfully during alias setup. This was the hard prerequisite (Phase 46 must be live before Phase 49).
- Resend SMTP username is literally the string "resend" — this is a Resend-specific convention, not the API key itself. API key goes in the password field.
- The restricted Resend key cannot be retrieved after creation — document creation in the plan so the planner includes a "save the key" checkpoint before closing the Resend dashboard.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- N/A — zero-code phase; no application components involved

### Established Patterns
- Zero-code-changes pattern (consistent with Phases 46, 47, 48): this phase is entirely dashboard/settings configuration with no application file edits
- Verification sequencing pattern (from Phase 46): verify a representative subset first, then confirm remaining entries via status indicators — adapted here to "verify all 7 via status + DKIM spot-check on hello@"

### Integration Points
- Phase 46 output (active Cloudflare Email Routing) → Phase 49 input: Gmail verification emails routed through Cloudflare forwarding → arrive in torch.secrets@gmail.com
- Phase 47 output (Resend domain verified, DKIM active on torchsecret.com) → Phase 49 output: emails sent via Gmail + Resend SMTP relay will be DKIM-signed as torchsecret.com
- Phase 49 produces no output consumed by other phases — this is the final email infrastructure configuration phase before Phase 50 (doc updates)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 49-gmail-send-mail-as*
*Context gathered: 2026-03-05*
