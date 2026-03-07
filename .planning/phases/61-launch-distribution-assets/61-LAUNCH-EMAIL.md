# Torch Secret — Launch Email Draft

_Sent to confirmed Resend Audiences subscribers on launch day._

---

## Metadata

- **Sender address:** noreply@torchsecret.com
- **Sender name:** Torch Secret
- **List:** Resend Audiences subscriber list (confirmed subscribers only — double-opt-in via homepage capture widget)
- **Send timing:** 06:00–06:30 PST on launch day
- **Platform:** Resend Audiences (NOT Loops — Loops handles onboarding sequences from hello@torchsecret.com)

---

## Subject Line

Torch Secret is live on Product Hunt today

---

## Email Body

You signed up a few weeks ago — today we launched.

Torch Secret is a one-time secret sharing tool built for developers. Here's what it does:

- Share a secret once — the link self-destructs after one view, no account required for the recipient
- The server physically cannot read your data — the decryption key lives in the URL fragment and is never transmitted to the server (it's excluded from HTTP requests by the RFC 3986 specification)
- No signup needed — works anonymously for anyone you send the link to; a Pro tier adds a dashboard and longer expiration options

The code is open source and self-hostable with `docker-compose up`. ISC license — commercial use allowed.

We're live on Product Hunt today. If you've tried it and liked it, an upvote means a lot: [PRODUCT HUNT LINK]

We'll only email you for major product updates.

— The Torch Secret team

---

## Delivery Notes

- Replace `[PRODUCT HUNT LINK]` with the actual PH listing URL on launch day. The URL is assigned at submission time and cannot be known in advance.
- Send only to confirmed subscribers — those who completed the double-opt-in via the Phase 36 confirmation email. Do not send to unconfirmed or unsubscribed contacts.
- **Coordinate timing:** The PH listing goes live at 12:01 AM PST. The email should go at 06:00–06:30 PST — this gives approximately six hours for early organic votes to accumulate before the email boost arrives at peak US morning voting time.
- **Single-CTA rule:** Do NOT add a second link (torchsecret.com, GitHub, or otherwise). The single `[PRODUCT HUNT LINK]` is intentional — Resend click analytics will show the PH conversion rate from this list cleanly, without dilution from a second destination.
