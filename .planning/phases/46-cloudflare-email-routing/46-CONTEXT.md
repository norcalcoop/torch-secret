# Phase 46: Cloudflare Email Routing - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure Cloudflare Email Routing to receive inbound mail for all 7 torchsecret.com business addresses (hello, contact, admin, info, support, security, privacy) and forward each to torch-secret@gmail.com. Verify forwarding is live.

This is a zero-code-changes phase: only Cloudflare dashboard configuration and DNS changes. No application files, no Infisical env vars, no npm packages.

</domain>

<decisions>
## Implementation Decisions

### Routing destination
- All 7 addresses forward to the single destination: torch-secret@gmail.com
- No per-address differentiation — one inbox receives all inbound business email

### Addresses to configure
- hello, contact, admin, info, support, security, privacy — exactly these 7
- No catch-all rule this phase (explicitly deferred to EOPS-03 in REQUIREMENTS.md)

### Verification scope
- Verify all 7 routing rules show "Active" status in the Cloudflare Email Routing dashboard
- Send a real external test email to hello@torchsecret.com and confirm it arrives in torch-secret@gmail.com
- Send a real external test email to security@torchsecret.com and confirm it arrives
- The remaining 5 addresses: confirm Active status is sufficient per success criteria (no additional test emails required unless Active verification fails)

### DNS transition
- Before enabling Email Routing, check for and document any existing MX records at torchsecret.com
- If existing MX records are found (e.g., Google Workspace, Zoho, other), they must be removed before Cloudflare Email Routing MX records are added — conflicting MX records cause silent routing failures
- Cloudflare Email Routing adds its own MX records automatically when enabled — do not add Cloudflare MX records manually

### Enable sequence
- Enable Cloudflare Email Routing on the domain first, then add all 7 routing rules in a single session
- All 7 rules are simple "route to email" type (not workers, not drop, not custom) — batch all in one session

### Claude's Discretion
- Order in which the 7 routing rules are added (any order is fine)
- How to source an external test email address (any non-torchsecret.com account: Gmail, Fastmail, etc.)
- Whether to test from the same session or use a separate device/incognito window

</decisions>

<specifics>
## Specific Ideas

- The hard dependency note in STATE.md is critical: Phase 46 must be live *before* Phase 49 (Gmail Send Mail As) because Gmail sends a verification email to each alias address during "Send mail as" setup — if forwarding isn't active, Gmail never receives the verification email
- STATE.md constraint: Cloudflare Email Routing owns the apex @ SPF record — do not add a conflicting SPF TXT at the root zone (relevant for Phase 47 planner awareness, not Phase 46)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- N/A — zero-code phase; no application components involved

### Established Patterns
- N/A — this phase operates entirely in Cloudflare dashboard and DNS

### Integration Points
- No application code connects to Cloudflare Email Routing
- Phase 46 output (active forwarding) is consumed by Phase 49 (Gmail alias verification emails routed through)

</code_context>

<deferred>
## Deferred Ideas

- Catch-all address for unmapped torchsecret.com addresses — EOPS-03, future phase
- DMARC monitoring rua= pointing to dmarc@torchsecret.com — Phase 47 (DMARC record setup)
- DMARC policy progression from p=none to p=quarantine — EOPS-02, post-30-day monitoring

</deferred>

---

*Phase: 46-cloudflare-email-routing*
*Context gathered: 2026-03-04*
