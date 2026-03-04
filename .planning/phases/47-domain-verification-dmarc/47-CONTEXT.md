# Phase 47: Domain Verification + DMARC - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify torchsecret.com as an authenticated sending domain in both Resend (DKIM, SPF, Resend MX on send. subdomain) and Loops.so (DKIM, SPF), and publish a DMARC monitoring record at _dmarc.torchsecret.com.

This is a zero-code-changes phase: only Cloudflare DNS records and Resend/Loops.so dashboard confirmation. No application files, no Infisical env vars, no npm packages.

</domain>

<decisions>
## Implementation Decisions

### DMARC rua= monitoring address
- Use `admin@torchsecret.com` (already routed via Phase 46) as the rua= destination
- Publish: `v=DMARC1; p=none; rua=mailto:admin@torchsecret.com`
- No new routing rule needed — admin@ is already live and forwarding to torch-secret@gmail.com
- Note: The success criteria says dmarc@torchsecret.com but that address has no routing rule; admin@ is the pragmatic substitute that avoids adding a new rule this phase

### Resend delivery verification
- Verify delivery using both the Resend dashboard "Send test" button AND a curl call to the Resend API
- Test recipient: torch-secret@gmail.com
- From address: noreply@torchsecret.com (the sender address that will be used in Phase 48)
- Success: email arrives in inbox (not spam)

### Loops.so sender address
- hello@torchsecret.com is the confirmed sender to verify in Loops.so
- No additional Loops sender addresses needed this phase

### Claude's Discretion
- Order of DNS record additions (Resend vs Loops.so records can be added in any order in a single Cloudflare session)
- Exact curl command format for Resend API test send
- How long to wait for DNS propagation before triggering Resend/Loops dashboard verification

</decisions>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — standard DNS verification flows for both providers.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notification.service.ts:23` and `subscribers.service.ts:114` — both already read `env.RESEND_FROM_EMAIL` at runtime; no code changes needed this phase
- `server/src/config/env.ts` — RESEND_FROM_EMAIL env var already validated via Zod schema; Phase 48 will update the Infisical value

### Established Patterns
- SPF subdomain isolation (from Phase 46 STATE.md): Resend uses `send.torchsecret.com`, Loops uses `envelope.torchsecret.com` — avoids RFC 7208 one-SPF-TXT-per-FQDN rule; apex @ SPF owned by Cloudflare Email Routing
- All DKIM CNAMEs must be DNS Only (grey cloud) in Cloudflare — proxied CNAMEs break DKIM verification permanently
- Never enter full FQDN in Cloudflare DNS record name fields — Cloudflare appends the zone domain automatically; enter only the subdomain prefix

### Integration Points
- Phase 47 output (Resend domain "Verified" status) is a hard prerequisite for Phase 48 (updating RESEND_FROM_EMAIL in Infisical) — updating the env var before verification causes silent 403 failures on all transactional email
- Phase 47 output (Loops.so domain verified + hello@ confirmed) is a hard prerequisite for Phase 48 (Loops onboarding emails sending from hello@torchsecret.com without third-party header indicators)

</code_context>

<deferred>
## Deferred Ideas

- DMARC policy progression from p=none to p=quarantine — EOPS-02, post-30-day monitoring period (explicitly out of scope per REQUIREMENTS.md)
- DMARC aggregate report monitoring tooling (e.g. DMARC Analyzer, dmarcian) — EOPS-01, future phase
- Adding dmarc@torchsecret.com as a dedicated routing rule — if aggregate reports warrant a canonical address in future, add it to Cloudflare Email Routing then

</deferred>

---

*Phase: 47-domain-verification-dmarc*
*Context gathered: 2026-03-04*
