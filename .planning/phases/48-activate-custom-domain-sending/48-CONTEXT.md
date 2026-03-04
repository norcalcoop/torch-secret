# Phase 48: Activate Custom Domain Sending - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Update `RESEND_FROM_EMAIL` in Infisical for staging and production environments to `noreply@torchsecret.com`, then verify all three Resend-powered email types (secret-viewed notification, subscriber confirmation, and Better Auth transactional) send from the new address. Separately verify that Loops.so onboarding emails arrive without "via loops.so" or similar third-party header indicators.

This is a zero-code-changes phase: only Infisical env var update and manual email delivery verification. No application files, no DNS changes, no npm packages.

</domain>

<decisions>
## Implementation Decisions

### Rollout sequencing
- Update staging Infisical environment first, verify email delivery, then update production
- Staged rollout reduces risk: if the Resend API returns unexpected errors after the env var change, it surfaces in staging before touching production traffic
- Both environments must be updated before the phase is complete (RSND-02 requires both)

### Verification scope
- Success criteria explicitly name three email types: secret-viewed notification, subscriber confirmation, and Loops.so onboarding
- Better Auth emails (email verification on registration, password reset) also read `RESEND_FROM_EMAIL` at runtime — they are implicitly covered by the same env var change; no additional manual verification step required beyond the three named in success criteria
- Verification confirms "From" header shows `noreply@torchsecret.com` (not `onboarding@resend.dev`)

### Loops "via" header verification
- Trigger the welcome email (fires immediately on new user registration) — if the domain is authenticated, all three sequence emails use the same Loops sending config
- Verify using Gmail "Show original" / "View raw message" to inspect `Authentication-Results` and `DKIM-Signature` headers
- Success: no `via loops.so`, no `via amazonses.com`, DKIM alignment on torchsecret.com

### Environment update order
- Staging first → verify notification + subscriber emails arrive from noreply@torchsecret.com
- Production second → verify same email types; Loops verification can target production (fresh account registration triggers the welcome email)

### Claude's Discretion
- Which test email addresses to use (existing test accounts are acceptable; a fresh throwaway is fine for Loops)
- Whether to wait for DNS propagation (already confirmed in Phase 47 — no wait needed)
- Order in which the three email types are verified within a session
- How long to wait between staging update and verification sends (Infisical propagation is near-instant; 1–2 minutes is sufficient)

</decisions>

<specifics>
## Specific Ideas

- STATE.md confirmed: "RESEND_FROM_EMAIL env var is the only application-layer change — all three email callers (notification.service.ts, subscribers.service.ts, Better Auth) already read it at runtime"
- Phase 47 confirmed: Resend API returned HTTP 200 on a test send from `noreply@torchsecret.com` before Phase 47 completed — the sending address already works at the API level; Phase 48 is the env var flip + end-to-end verification
- Loops.so welcome email is the fastest to trigger (fires on new user registration) and the most deterministic for "via" header inspection

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `notification.service.ts` — reads `env.RESEND_FROM_EMAIL` at runtime; no code change needed
- `subscribers.service.ts` — reads `env.RESEND_FROM_EMAIL` at runtime; no code change needed
- Better Auth email handler — reads `env.RESEND_FROM_EMAIL` at runtime; no code change needed
- `server/src/config/env.ts` — `RESEND_FROM_EMAIL` already in the Zod-validated env schema; Infisical update propagates automatically on next server restart

### Established Patterns
- Infisical update pattern (from Phase 47 context): update the value in the Infisical dashboard for the target environment, then restart the server (or redeploy on Render.com) to pick up the new value
- Resend API key scope: the existing `RESEND_API_KEY` in Infisical is already scoped to the verified `torchsecret.com` domain — no key rotation needed for Phase 48

### Integration Points
- All three Resend email send calls are in `server/src/services/` — updating one env var covers all three
- Loops.so sends via its own SDK (separate from Resend); the "via" header elimination is handled by the domain authentication completed in Phase 47, not by any env var in this phase

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 48-activate-custom-domain-sending*
*Context gathered: 2026-03-04*
