# Phase 37: Email Onboarding Sequence - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Every new account holder automatically receives a timed 3-email sequence: a welcome email immediately on registration, a key features email on day 3, and an upgrade prompt email on day 7. Marketing consent (opt-in checkbox on the registration form) gates the day-3 and day-7 emails. The welcome email is sent to all new accounts regardless of consent. Loops.so is the email delivery platform. No email authoring UI, no manual sending, no email template editor.

</domain>

<decisions>
## Implementation Decisions

### Email copy & tone
- Tone is warm and casual across all 3 emails — friendly, direct, short sentences. Feels human, not corporate.
- Personalization: first name in both the subject line and the opening greeting for all 3 emails
- Welcome email CTA: "Create your first secret" — deep link to `/create`
- Day-3 email highlights power features: password protection, expiration options, one-time view guarantee
- Day-7 email uses feature unlock angle: "With Pro you get X, Y, Z" — concrete features the free user is currently locked out of

### Consent checkbox UX
- Label text: "Send me product tips and updates" (unchecked by default)
- Placement: below the submit button, above any fine print — clearly optional, doesn't interrupt form flow
- No explanatory text below the checkbox — label is self-explanatory
- OAuth registrations (Google/GitHub) default to opted-out — no marketing consent is assumed, no post-OAuth prompt

### Day-7 upgrade CTA
- Link destination: in-app `/pricing` page — user sees plan details and Stripe Checkout button in context
- If the user is already Pro when day 7 arrives: suppress the email entirely (do not send)
- Unsubscribe: Loops.so handles unsubscribe footer automatically on all marketing emails

### Loops.so integration
- Trigger: server-side Loops API call at registration time — registration handler calls Loops to create/update the contact and fire the "registered" event
- Failure handling: silent fail — if the Loops API call fails, log the error but let registration succeed. Email sequence is non-critical path.
- Marketing consent flag: passed to Loops as a contact property (e.g., `marketingConsent: true/false`). Loops sequence conditions use this property to gate day-3 and day-7 emails.
- Delay ownership: configured inside Loops — the app fires a single "registered" event and Loops handles the day 0 / day 3 / day 7 scheduling internally

### Claude's Discretion
- Exact Pro features to list in the day-7 email (based on what Phase 34 built)
- Loops contact property naming conventions
- Error logging format for Loops API failures
- How to check Pro status before suppressing the day-7 email (whether Loops supports this natively or requires a separate webhook/contact update)

</decisions>

<specifics>
## Specific Ideas

- The welcome email should get the user into the product immediately — the CTA is the most important element
- The day-7 email suppression for existing Pro users should be handled cleanly — no awkward "upgrade to Pro" email landing in a paying customer's inbox

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 37-email-onboarding-sequence*
*Context gathered: 2026-02-26*
