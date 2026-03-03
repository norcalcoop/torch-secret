# Phase 36: Email Capture - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

GDPR-compliant homepage email list capture: wire up the email capture form widget (scaffolded in Phase 32), add a `marketing_subscribers` table, integrate with Resend Audiences for double opt-in, handle token confirmation and unsubscribe flows, and build the SPA pages for /confirm and /unsubscribe. Sending newsletters or triggered sequences is out of scope (Phase 37).

</domain>

<decisions>
## Implementation Decisions

### Success state UX
- After successful form submission, replace the form with an inline confirmation message — no toast, no button state
- The message echoes the submitted email address: "Check your inbox — we sent a confirmation link to [email]. Click it to join the list. Check spam if you don't see it."
- While the API request is in-flight: spinner + disabled button with "Joining..." label
- Submit button label: Claude's discretion (pick what fits the page tone)

### Opt-in confirmation email
- Format: minimal responsive HTML with Torch Secret wordmark and brand colors
- Subject line: Claude's discretion (optimize for clarity and deliverability)
- CTA button text: "Confirm my email"
- Token expiry: 24 hours from submission

### Edge case handling
- Already-confirmed email: return 200, show the same "Check your inbox" success UI — no signal that the address is already on the list
- Pending-confirmation email (token not yet clicked): resend a fresh token (replace the old one), show the same "Check your inbox" success UI
- Expired or already-used confirmation token: show an error page — "This confirmation link has expired. Go back and enter your email again." with a "Back to homepage" link
- Successful confirmation (`GET /confirm?token=valid`): show a "You're on the list!" page with a "Try Torch Secret" CTA button that links to `/create`

### Unsubscribe experience
- Rendered as an SPA route at `/unsubscribe` — client reads `?token` param, calls the unsubscribe API, shows result
- Processing is instant on page load — no "Are you sure?" confirm step
- Success message: "✓ You've been unsubscribed. You won't receive any more emails from Torch Secret." with a "Back to homepage" link
- Invalid or already-used token: show the same success message (idempotent — no state leakage)
- Layout: minimal centered card only — no nav, no footer (matches the error page pattern)

### Claude's Discretion
- Submit button label (e.g., "Join the list", "Subscribe", "Get updates")
- Subject line for confirmation email
- Exact animation/transition for the form-to-success-message swap
- HTML email template design details beyond: Torch Secret wordmark + brand colors + "Confirm my email" CTA button + 24h expiry note

</decisions>

<specifics>
## Specific Ideas

- The confirmation success page (`/confirm?token=valid`) should use the warm moment to convert — "You're on the list!" + "Try Torch Secret" CTA → `/create`
- The unsubscribe page follows the minimal centered-card pattern already used for the error page — consistent with existing simple SPA pages
- Both `/confirm` and `/unsubscribe` are SPA routes (not server-rendered), consistent with the rest of the app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 36-email-capture*
*Context gathered: 2026-02-26*
